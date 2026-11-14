(function () {
  const keyInput = document.getElementById("key-file");
  const packInput = document.getElementById("pack-file");
  const inboxButton = document.getElementById("load-inbox");
  const inboxList = document.getElementById("inbox-list");
  const output = document.getElementById("record");
  const keyStatus = document.getElementById("key-status");
  const forget = document.getElementById("forget-key");
  let privatePem = "";

  function setStatus(text) {
    keyStatus.textContent = text;
  }

  keyInput.addEventListener("change", function () {
    const file = keyInput.files && keyInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      privatePem = String(reader.result || "");
      setStatus("Private key is ready in this browser tab. It was not uploaded.");
    };
    reader.readAsText(file);
  });

  forget.addEventListener("click", function () {
    privatePem = "";
    keyInput.value = "";
    output.replaceChildren();
    setStatus("Private key forgotten. Choose the key file again to open a record.");
  });

  function downloadFile(file) {
    const bytes = Uint8Array.from(atob(file.data), function (char) { return char.charCodeAt(0); });
    const blob = new Blob([bytes], { type: file.type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name || "document";
    link.textContent = file.name || "Download";
    link.addEventListener("click", function () {
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });
    return link;
  }

  function render(record, meta) {
    output.replaceChildren();
    const head = document.createElement("header");
    head.className = "record-head";
    const h = document.createElement("h2");
    h.textContent = record.title || "Submission";
    head.appendChild(h);
    if (meta) {
      const p = document.createElement("p");
      p.textContent = [meta.reference, meta.receivedAt ? new Date(meta.receivedAt).toLocaleString() : ""].filter(Boolean).join(" · ");
      head.appendChild(p);
    }
    output.appendChild(head);
    (record.sections || []).forEach(function (section) {
      const block = document.createElement("section");
      block.className = "panel";
      const title = document.createElement("h3");
      title.textContent = section.title || "Section";
      const list = document.createElement("dl");
      (section.rows || []).forEach(function (row) {
        const term = document.createElement("dt");
        term.textContent = row.label || "";
        const detail = document.createElement("dd");
        detail.textContent = row.text || "—";
        if (row.image && String(row.image).startsWith("data:image/png;base64,")) {
          const img = document.createElement("img");
          img.alt = "Handwritten signature";
          img.src = row.image;
          detail.appendChild(img);
        }
        (row.files || []).forEach(function (file) {
          if (!file || !file.data) return;
          detail.appendChild(document.createTextNode(" "));
          detail.appendChild(downloadFile(file));
        });
        list.append(term, detail);
      });
      block.append(title, list);
      output.appendChild(block);
    });
    const print = document.createElement("button");
    print.type = "button";
    print.className = "btn noprint";
    print.textContent = "Print this record";
    print.addEventListener("click", function () { window.print(); });
    output.appendChild(print);
  }

  async function openEnvelope(envelope, meta) {
    if (!privatePem) {
      setStatus("Choose the agency private key first. It is the file secrets/tranquil-private.pem on the office computer.");
      return;
    }
    try {
      const record = await TranquilCrypto.decryptPayload(privatePem, envelope);
      render(record, meta);
    } catch (error) {
      setStatus("That key could not open this submission. Use the private key created with this website.");
    }
  }

  packInput.addEventListener("change", function () {
    const file = packInput.files && packInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const pack = JSON.parse(String(reader.result || ""));
        const envelope = pack.envelope || pack;
        openEnvelope(envelope, pack);
      } catch (error) {
        setStatus("That file is not a Tranquil submission.");
      }
    };
    reader.readAsText(file);
  });

  inboxButton.addEventListener("click", async function () {
    inboxList.replaceChildren();
    const response = await fetch("/api/inbox", { credentials: "same-origin" });
    if (response.status === 401) {
      const message = document.createElement("p");
      message.textContent = "Enter the staff access code to list the office inbox.";
      inboxList.appendChild(message);
      return;
    }
    const items = await response.json();
    if (!items.length) {
      const message = document.createElement("p");
      message.textContent = "No encrypted submissions are waiting in the office inbox.";
      inboxList.appendChild(message);
      return;
    }
    items.forEach(function (item) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "inbox-row";
      row.textContent = item.reference + " — " + item.title + " — " + new Date(item.receivedAt).toLocaleString();
      row.addEventListener("click", async function () {
        const detail = await fetch("/api/inbox/" + encodeURIComponent(item.reference), { credentials: "same-origin" });
        if (!detail.ok) {
          setStatus("That submission could not be loaded.");
          return;
        }
        openEnvelope(await detail.json(), item);
      });
      inboxList.appendChild(row);
    });
  });

  const login = document.getElementById("staff-login");
  if (login) {
    login.addEventListener("submit", async function (event) {
      event.preventDefault();
      const code = new FormData(login).get("code");
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: code })
      });
      const msg = document.getElementById("login-msg");
      msg.textContent = response.ok ? "Staff access is on for this browser." : "That code was not accepted.";
    });
  }
})();
