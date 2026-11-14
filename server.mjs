import { createServer } from "node:http";
import { createPublicKey, createPrivateKey, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import tls from "node:tls";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(root, "public");
const inboxDir = resolve(root, "secrets", "inbox");
const sessions = new Map();
const hits = new Map();

const FORMS = {
  contact: { title: "General message", staff: false },
  referral: { title: "Care referral", staff: false },
  employment: { title: "Employment application", staff: false },
  grievance: { title: "Client concern", staff: false },
  "assessment-ccsp-initial": { title: "CCSP initial nursing assessment", staff: true },
  "assessment-icwp-initial": { title: "ICWP initial nursing assessment", staff: true },
  "assessment-icwp-bimonthly": { title: "ICWP bi-monthly nursing assessment", staff: true },
  "supervisory-ccsp": { title: "CCSP RN supervisory visit", staff: true }
};

function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    out[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return out;
}

const fileConfig = loadEnvFile(join(root, "secrets", "config.env"));
const config = {
  INTAKE_EMAIL: "tranquil2754@hotmail.com",
  SMTP_HOST: "",
  SMTP_PORT: "587",
  SMTP_USER: "",
  SMTP_PASS: "",
  STAFF_ACCESS_CODE: "",
  HOST: "127.0.0.1",
  PORT: "8787",
  ...fileConfig
};
for (const key of Object.keys(config)) {
  if (process.env[key]) config[key] = process.env[key];
}
if (!config.STAFF_ACCESS_CODE && existsSync(join(root, "secrets", "staff-access-code.txt"))) {
  config.STAFF_ACCESS_CODE = readFileSync(join(root, "secrets", "staff-access-code.txt"), "utf8").trim();
}

function checkKeys() {
  const privatePath = join(root, "secrets", "tranquil-private.pem");
  const keyJs = readFileSync(join(publicDir, "js", "key.js"), "utf8");
  if (!existsSync(privatePath)) {
    console.error("Missing secrets/tranquil-private.pem. Submissions cannot be opened.");
    process.exit(1);
  }
  const derived = createPublicKey(createPrivateKey(readFileSync(privatePath))).export({ type: "spki", format: "pem" });
  const body = derived.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  if (!keyJs.replace(/\s+/g, "").includes(body)) {
    console.error("The public key on the website does not match secrets/tranquil-private.pem.");
    process.exit(1);
  }
}

function sameSecret(left, right) {
  const a = createHash("sha256").update(String(left)).digest();
  const b = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(a, b);
}

function clientIp(req) {
  return req.socket.remoteAddress || "local";
}

function limited(ip, bucket, max, windowMs) {
  const key = bucket + ":" + ip;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

function readBody(req, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("This submission is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, status, body, type = "application/json; charset=utf-8", extra = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": payload.length,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    "Cache-Control": type.startsWith("image/") ? "public, max-age=86400" : "no-cache",
    ...extra
  });
  res.end(payload);
}

function cookieValue(req) {
  const raw = req.headers.cookie || "";
  const match = raw.match(/(?:^|;\s*)tq_staff=([a-f0-9]+)/);
  return match ? match[1] : "";
}

function staffOk(req) {
  const token = cookieValue(req);
  const expiry = sessions.get(token);
  if (!token || !expiry || expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function setStaffCookie(req, res) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `tq_staff=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
}

function b64(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function wrap76(value) {
  return value.replace(/.{1,76}/g, "$&\r\n").trim();
}

function buildMessage({ from, to, subject, text, attachmentName, attachment }) {
  const boundary = "tq_" + randomBytes(12).toString("hex");
  const body = [
    `From: Tranquil, Inc. <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${boundary}`,
    `Content-Type: application/json; name="${attachmentName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    "",
    wrap76(attachment.toString("base64")),
    "",
    `--${boundary}--`,
    ""
  ].join("\r\n");
  return body.split("\r\n").map((line) => (line.startsWith(".") ? "." + line : line)).join("\r\n");
}

function smtpSend({ host, port, user, pass, from, to, subject, text, filename, json }) {
  const message = buildMessage({
    from, to, subject, text, attachmentName: filename,
    attachment: Buffer.from(json)
  });
  return new Promise((resolveMail, reject) => {
    let buffer = "";
    let responseLines = [];
    let stage = "greeting";
    let current;
    const portNumber = Number(port || 587);
    const pending = [];
    function fail(error) {
      current?.destroy();
      reject(error);
    }
    function write(line) {
      current.write(line + "\r\n");
    }
    function onResponse(code) {
      if (stage === "greeting" && code === 220) {
        stage = "ehlo";
        write("EHLO tranquil.local");
      } else if (stage === "ehlo" && code === 250) {
        if (portNumber === 465) {
          stage = "auth";
          write("AUTH LOGIN");
        } else {
          stage = "starttls";
          write("STARTTLS");
        }
      } else if (stage === "starttls" && code === 220) {
        const plain = current;
        plain.removeAllListeners("data");
        current = tls.connect({ socket: plain, servername: host });
        current.on("error", fail);
        current.on("secureConnect", () => {
          buffer = "";
          responseLines = [];
          stage = "ehlo2";
          current.on("data", onData);
          write("EHLO tranquil.local");
        });
      } else if (stage === "ehlo2" && code === 250) {
        stage = "auth";
        write("AUTH LOGIN");
      } else if (stage === "auth" && code === 334) {
        stage = "user";
        write(b64(user));
      } else if (stage === "user" && code === 334) {
        stage = "pass";
        write(b64(pass));
      } else if (stage === "pass" && code === 235) {
        stage = "from";
        write(`MAIL FROM:<${from}>`);
      } else if (stage === "from" && code === 250) {
        stage = "to";
        write(`RCPT TO:<${to}>`);
      } else if (stage === "to" && code === 250) {
        stage = "data";
        write("DATA");
      } else if (stage === "data" && code === 354) {
        stage = "sent";
        current.write(message + "\r\n.\r\n");
      } else if (stage === "sent" && code === 250) {
        stage = "quit";
        write("QUIT");
      } else if (stage === "quit") {
        current.end();
        resolveMail();
      } else {
        fail(new Error("Mail server refused the message (" + code + ")."));
      }
    }
    function onData(chunk) {
      buffer += chunk.toString("utf8");
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);
        responseLines.push(line);
        if (line.length >= 4 && line[3] === " ") {
          const code = Number(line.slice(0, 3));
          responseLines = [];
          onResponse(code);
        }
      }
    }
    current = portNumber === 465
      ? tls.connect({ host, port: portNumber, servername: host })
      : net.connect({ host, port: portNumber });
    if (portNumber === 465) stage = "greeting";
    current.setTimeout(20000, () => fail(new Error("Mail server timed out.")));
    current.on("data", onData);
    current.on("error", fail);
  });
}

async function saveAndMaybeEmail(record) {
  mkdirSync(inboxDir, { recursive: true, mode: 0o700 });
  const reference = "TQ-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + randomBytes(3).toString("hex").toUpperCase();
  const stored = {
    reference,
    form: record.form,
    title: record.title,
    receivedAt: new Date().toISOString(),
    envelope: record.envelope
  };
  const file = join(inboxDir, reference + ".json");
  writeFileSync(file, JSON.stringify(stored), { mode: 0o600 });
  let emailed = false;
  if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS && config.INTAKE_EMAIL) {
    const text = [
      "A secure Tranquil, Inc. form was submitted.",
      "",
      "Form: " + record.title,
      "Reference: " + reference,
      "Received: " + stored.receivedAt,
      "",
      "The attachment is encrypted. Open Read a submission on the Tranquil website,",
      "choose the agency private key, and select this file. The key never leaves your computer.",
      "",
      "This message contains no client information."
    ].join("\n");
    try {
      await smtpSend({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
        from: config.SMTP_USER,
        to: config.INTAKE_EMAIL,
        subject: "Tranquil secure form: " + record.title + " [" + reference + "]",
        text,
        filename: reference + ".json",
        json: JSON.stringify(stored)
      });
      emailed = true;
    } catch (error) {
      console.error("Saved " + reference + " but email was not sent: " + error.message);
    }
  } else {
    console.log("Saved " + reference + " in the encrypted inbox. SMTP is not configured.");
  }
  if (emailed) console.log("Emailed " + reference + " to the intake mailbox.");
  return reference;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(publicDir, "." + relative);
  if (filePath !== publicDir && !filePath.startsWith(publicDir + "/")) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  let target = filePath;
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
  if (!existsSync(target) || !statSync(target).isFile()) {
    const missing = readFileSync(join(publicDir, "404.html"));
    send(res, 404, missing, "text/html; charset=utf-8");
    return;
  }
  send(res, 200, readFileSync(target), MIME[extname(target)] || "application/octet-stream");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/staff/session") {
      send(res, staffOk(req) ? 200 : 401, JSON.stringify({ ok: staffOk(req) }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/staff/login") {
      if (limited(clientIp(req), "login", 8, 15 * 60 * 1000)) {
        send(res, 429, JSON.stringify({ error: "Too many attempts. Wait a few minutes." }));
        return;
      }
      const body = JSON.parse((await readBody(req, 4000)).toString("utf8") || "{}");
      if (!config.STAFF_ACCESS_CODE || !sameSecret(body.code || "", config.STAFF_ACCESS_CODE)) {
        send(res, 401, JSON.stringify({ error: "The staff code was not accepted." }));
        return;
      }
      setStaffCookie(req, res);
      send(res, 200, JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/staff/logout") {
      sessions.delete(cookieValue(req));
      res.setHeader("Set-Cookie", "tq_staff=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
      send(res, 200, JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/inbox") {
      if (!staffOk(req)) {
        send(res, 401, JSON.stringify({ error: "Staff access required." }));
        return;
      }
      mkdirSync(inboxDir, { recursive: true });
      const items = readdirSync(inboxDir).filter((name) => name.endsWith(".json")).map((name) => {
        const stored = JSON.parse(readFileSync(join(inboxDir, name), "utf8"));
        return { reference: stored.reference, form: stored.form, title: stored.title, receivedAt: stored.receivedAt };
      }).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      send(res, 200, JSON.stringify(items));
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/inbox/")) {
      if (!staffOk(req)) {
        send(res, 401, JSON.stringify({ error: "Staff access required." }));
        return;
      }
      const reference = url.pathname.slice("/api/inbox/".length);
      if (!/^TQ-[A-Z0-9-]+$/.test(reference)) {
        send(res, 400, JSON.stringify({ error: "Unknown reference." }));
        return;
      }
      const file = join(inboxDir, reference + ".json");
      if (!existsSync(file)) {
        send(res, 404, JSON.stringify({ error: "Not found." }));
        return;
      }
      send(res, 200, readFileSync(file), "application/json; charset=utf-8");
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/intake") {
      if (limited(clientIp(req), "intake", 12, 15 * 60 * 1000)) {
        send(res, 429, JSON.stringify({ error: "Too many submissions. Please wait and try again, or call the office." }));
        return;
      }
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (origin && host && origin !== "http://" + host && origin !== "https://" + host) {
        send(res, 403, JSON.stringify({ error: "This form can only be sent from the Tranquil website." }));
        return;
      }
      if (!String(req.headers["content-type"] || "").includes("application/json")) {
        send(res, 415, JSON.stringify({ error: "Send the encrypted form as JSON." }));
        return;
      }
      const body = JSON.parse((await readBody(req, 12_000_000)).toString("utf8"));
      const spec = FORMS[body.form];
      if (!spec || body.v !== 1 || ![body.iv, body.ek, body.ct].every((part) => typeof part === "string" && part.length >= 16)) {
        send(res, 400, JSON.stringify({ error: "This submission was not in the expected encrypted format." }));
        return;
      }
      if (spec.staff && !staffOk(req)) {
        send(res, 401, JSON.stringify({ error: "Staff access is required before this clinical form can be submitted." }));
        return;
      }
      const reference = await saveAndMaybeEmail({
        form: body.form,
        title: spec.title,
        envelope: { v: 1, iv: body.iv, ek: body.ek, ct: body.ct }
      });
      send(res, 200, JSON.stringify({ ok: true, reference }));
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res, url);
      return;
    }
    send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
  } catch (error) {
    const status = error.status || 400;
    send(res, status, JSON.stringify({ error: status === 413 ? error.message : "The request could not be completed." }));
  }
});

checkKeys();
mkdirSync(inboxDir, { recursive: true, mode: 0o700 });
server.listen(Number(config.PORT), config.HOST, () => {
  console.log("Tranquil, Inc.  http://" + (config.HOST === "0.0.0.0" ? "localhost" : config.HOST) + ":" + config.PORT);
  console.log("Intake mailbox  " + config.INTAKE_EMAIL);
  console.log(config.SMTP_USER ? "Email           SMTP is configured" : "Email           not configured — encrypted copies stay in secrets/inbox");
});
