(function (root) {
  function pemToBytes(pem) {
    const b64 = String(pem).replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToB64(bytes) {
    const chunk = 8192;
    let bin = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
      bin += String.fromCharCode.apply(null, slice);
    }
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function importPublic(pem) {
    return crypto.subtle.importKey("spki", pemToBytes(pem), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  }

  async function importPrivate(pem) {
    return crypto.subtle.importKey("pkcs8", pemToBytes(pem), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  }

  async function encryptPayload(pem, data) {
    if (!crypto.subtle) throw new Error("Encryption needs a secure page. Open the site through its web address, not as a downloaded file.");
    const json = new TextEncoder().encode(JSON.stringify(data));
    const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, json));
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", aes));
    const pub = await importPublic(pem);
    const ek = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, raw));
    return { iv: bytesToB64(iv), ek: bytesToB64(ek), ct: bytesToB64(ct) };
  }

  async function decryptPayload(pem, envelope) {
    if (!crypto.subtle) throw new Error("Decryption needs a secure page.");
    const priv = await importPrivate(pem);
    const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64ToBytes(envelope.ek));
    const aes = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(envelope.iv) }, aes, b64ToBytes(envelope.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  root.TranquilCrypto = { encryptPayload, decryptPayload, bytesToB64 };
})(typeof globalThis !== "undefined" ? globalThis : this);
