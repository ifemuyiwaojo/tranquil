import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "public/js/crypto.js"), "utf8") + "\nexport default globalThis.TranquilCrypto;\n";
const api = (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;
if (!api) throw new Error("Encryption code did not load.");

const pem = readFileSync(join(root, "secrets/tranquil-public.pem"), "utf8");
const privatePem = readFileSync(join(root, "secrets/tranquil-private.pem"), "utf8");
const sample = {
  title: "Test record",
  sections: [{ title: "Client", rows: [{ label: "Name of client", text: "Test Client", image: "", files: [] }] }]
};
const sealed = await api.encryptPayload(pem, sample);
const opened = await api.decryptPayload(privatePem, sealed);
if (opened.sections[0].rows[0].text !== "Test Client") {
  throw new Error("Decrypted text did not match.");
}
if (JSON.stringify(sealed).includes("Test Client")) {
  throw new Error("The encrypted package still contains the client name.");
}
console.log("Encryption round trip passed.");
