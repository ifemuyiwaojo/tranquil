(function () {
  const ALLOWED_FILE = ["application/pdf", "image/jpeg", "image/png"];

  function draftKey(form) {
    return "tq-draft:" + (form.dataset.form || form.id || "form");
  }

  function fieldInputs(field) {
    return Array.from(field.querySelectorAll("input, textarea, select"));
  }

  function isBlankCanvas(canvas) {
    if (!canvas.width || !canvas.height) return true;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 0) return false;
    }
    return true;
  }

  function setupPad(canvas) {
    const width = Math.max(280, Math.round(canvas.getBoundingClientRect().width || canvas.parentElement.clientWidth || 640));
    canvas.width = width;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0c2340";
    let drawing = false;
    let last = null;
    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    canvas.addEventListener("pointerdown", function (event) {
      drawing = true;
      last = point(event);
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", function (event) {
      if (!drawing) return;
      const next = point(event);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      last = next;
    });
    canvas.addEventListener("pointerup", function () { drawing = false; });
    canvas.addEventListener("pointerleave", function () { drawing = false; });
    const clear = canvas.parentElement.querySelector("[data-sig-clear]");
    if (clear) {
      clear.addEventListener("click", function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }

  async function readFiles(input) {
    const files = [];
    for (const file of input.files) {
      if (file.size > 4 * 1024 * 1024) {
        throw new Error(file.name + " is larger than 4 MB. Mail that copy to the post office box, or send a smaller file.");
      }
      if (file.type && !ALLOWED_FILE.includes(file.type)) {
        throw new Error(file.name + " must be a PDF, JPG, or PNG.");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      files.push({ name: file.name, type: file.type || "application/octet-stream", data: TranquilCrypto.bytesToB64(bytes) });
    }
    return files;
  }

  async function readField(field) {
    const kind = field.dataset.kind || "";
    if (kind === "checks") {
      const picked = Array.from(field.querySelectorAll("input:checked")).map(function (input) { return input.value; });
      return { text: picked.join(", ") };
    }
    if (kind === "radio") {
      const picked = field.querySelector("input:checked");
      return { text: picked ? picked.value : "" };
    }
    if (kind === "files") {
      const input = field.querySelector("input[type=file]");
      const files = input ? await readFiles(input) : [];
      return { text: files.map(function (file) { return file.name; }).join(", "), files: files };
    }
    if (kind === "signature") {
      const name = field.querySelector("[data-sig-name]");
      const date = field.querySelector("[data-sig-date]");
      const canvas = field.querySelector("canvas");
      const who = name ? name.value.trim() : "";
      const when = date ? date.value : "";
      const row = { text: [who, when].filter(Boolean).join(" · ") };
      if (canvas && !isBlankCanvas(canvas)) row.image = canvas.toDataURL("image/png");
      return row;
    }
    const boxes = field.querySelectorAll("input[type=checkbox]");
    if (boxes.length === 1 && field.querySelectorAll("input, textarea, select").length === 1) {
      if (!boxes[0].checked) return { text: "" };
      const words = field.querySelector("span");
      return { text: words ? words.textContent.trim() : boxes[0].value };
    }
    const control = field.querySelector("input, textarea, select");
    if (!control || control.type === "file") return { text: "" };
    return { text: control.value.trim() };
  }

  async function collectForm(form) {
    const keepBlanks = form.dataset.blanks === "yes";
    const sections = [];
    for (const section of form.querySelectorAll("[data-section]")) {
      const rows = [];
      for (const field of section.querySelectorAll("[data-field]")) {
        const row = await readField(field);
        const empty = !row.text && !row.image && !(row.files && row.files.length);
        if (empty && !keepBlanks) continue;
        if (empty) row.text = "—";
        rows.push({ label: field.dataset.label || "Response", text: row.text, image: row.image || "", files: row.files || [] });
      }
      if (rows.length) sections.push({ title: section.dataset.section, rows: rows });
    }
    return { title: form.dataset.title || document.title, sections: sections };
  }

  function snapshot(form) {
    const data = [];
    form.querySelectorAll("input, textarea, select").forEach(function (control) {
      if (control.type === "file" || control.name === "company_website") return;
      if (control.type === "checkbox" || control.type === "radio") {
        data.push([control.name, control.value, control.checked]);
      } else {
        data.push([control.name, control.value]);
      }
    });
    return data;
  }

  function restore(form, data) {
    data.forEach(function (item) {
      if (item.length === 3) {
        const box = form.querySelector('input[name="' + CSS.escape(item[0]) + '"][value="' + CSS.escape(item[1]) + '"]');
        if (box) box.checked = item[2];
      } else {
        const control = form.querySelector('[name="' + CSS.escape(item[0]) + '"]');
        if (control && control.type !== "file") control.value = item[1];
      }
    });
  }

  function bindDraft(form) {
    const key = draftKey(form);
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (error) { saved = null; }
    if (saved && saved.length) {
      restore(form, saved);
      const note = document.createElement("p");
      note.className = "notice";
      note.textContent = "A draft from this browser tab was restored. It stays on this device only until you submit, clear it, or close the tab.";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "btn btn-ghost btn-sm";
      clear.textContent = "Clear draft";
      clear.addEventListener("click", function () {
        sessionStorage.removeItem(key);
        form.reset();
        note.remove();
      });
      note.appendChild(document.createTextNode(" "));
      note.appendChild(clear);
      form.prepend(note);
    }
    let timer = 0;
    form.addEventListener("input", function () {
      form.dataset.dirty = "yes";
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        try { sessionStorage.setItem(key, JSON.stringify(snapshot(form))); } catch (error) { /* quota */ }
      }, 400);
    });
    window.addEventListener("beforeunload", function (event) {
      if (form.dataset.dirty === "yes" && form.dataset.submitted !== "yes") {
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }

  function bindJobs(form) {
    const host = form.querySelector("[data-jobs]");
    if (!host) return;
    const add = form.querySelector("[data-add-job]");
    let count = 0;
    function row(index) {
      const wrap = document.createElement("div");
      wrap.className = "job-block";
      wrap.innerHTML = '<div class="job-head"><h3>Employer ' + index + '</h3></div>';
      const grid = document.createElement("div");
      grid.className = "fields";
      const specs = [
        ["from", "From", "date"],
        ["to", "To", "date"],
        ["rate", "Hourly rate", "text"],
        ["employer", "Employer", "text"],
        ["phone", "Phone", "tel"],
        ["address", "Address", "text"],
        ["title", "Job title", "text"],
        ["supervisor", "Supervisor", "text"]
      ];
      specs.forEach(function (spec) {
        const field = document.createElement("div");
        field.dataset.field = "";
        field.dataset.label = "Employer " + index + " — " + spec[1];
        if (spec[0] === "address") field.className = "wide";
        const label = document.createElement("label");
        label.appendChild(document.createTextNode(spec[1]));
        const input = document.createElement("input");
        input.name = "job_" + index + "_" + spec[0];
        input.type = spec[2];
        input.autocomplete = "off";
        label.appendChild(input);
        field.appendChild(label);
        grid.appendChild(field);
      });
      const reason = document.createElement("div");
      reason.className = "wide";
      reason.dataset.field = "";
      reason.dataset.label = "Employer " + index + " — Reason for leaving";
      const reasonLabel = document.createElement("label");
      reasonLabel.appendChild(document.createTextNode("Reason for leaving"));
      const area = document.createElement("textarea");
      area.name = "job_" + index + "_reason";
      area.rows = 2;
      reasonLabel.appendChild(area);
      reason.appendChild(reasonLabel);
      grid.appendChild(reason);
      wrap.appendChild(grid);
      if (index > 1) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-ghost btn-sm";
        remove.textContent = "Remove this employer";
        remove.addEventListener("click", function () {
          wrap.remove();
        });
        wrap.appendChild(remove);
      }
      return wrap;
    }
    function addRow() {
      if (count >= 8) return;
      count += 1;
      host.appendChild(row(count));
      if (add) add.hidden = count >= 8;
    }
    addRow();
    addRow();
    if (add) add.addEventListener("click", addRow);
  }

  function requireAny(form) {
    const groups = form.querySelectorAll("[data-require-any]");
    for (const group of groups) {
      if (!group.querySelector("input:checked")) {
        const legend = group.dataset.label || "This question";
        group.querySelector("input")?.focus();
        throw new Error(legend + " needs at least one choice.");
      }
    }
  }

  function statusNode(form) {
    let node = form.querySelector(".form-status");
    if (!node) {
      node = document.createElement("div");
      node.className = "form-status";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      form.appendChild(node);
    }
    return node;
  }

  function ensureGate(form) {
    let gate = document.getElementById("staff-gate");
    if (gate) return gate;
    gate = document.createElement("div");
    gate.id = "staff-gate";
    gate.className = "notice";
    gate.hidden = true;
    gate.innerHTML = '<p><strong>Staff access is required to submit this clinical form.</strong> You can fill it in first. The code is not a password for client records. Records stay encrypted.</p><form id="staff-login"><label>Staff access code <input name="code" type="password" autocomplete="current-password" required></label><button class="btn btn-sm" type="submit">Unlock submission</button><span class="gate-msg" role="status"></span></form>';
    (form.closest(".form-shell") || form).before(gate);
    gate.querySelector("#staff-login").addEventListener("submit", async function (event) {
      event.preventDefault();
      const msg = gate.querySelector(".gate-msg");
      msg.textContent = "Checking…";
      const code = new FormData(event.currentTarget).get("code");
      let response;
      try {
        response = await fetch("/api/staff/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ code: code })
        });
      } catch (error) {
        msg.textContent = "This preview does not accept staff codes. Call (678) 290-0070.";
        return;
      }
      if (response.ok) {
        gate.hidden = true;
        msg.textContent = "";
        form.dataset.staffOk = "yes";
      } else if (response.status === 404) {
        msg.textContent = "This preview does not accept staff codes. Call (678) 290-0070.";
      } else {
        msg.textContent = "That code was not accepted.";
      }
    });
    return gate;
  }

  async function refreshStaff(form) {
    if (form.dataset.staff !== "yes") return true;
    const response = await fetch("/api/staff/session", { credentials: "same-origin" });
    const ok = response.ok;
    form.dataset.staffOk = ok ? "yes" : "no";
    const gate = ensureGate(form);
    gate.hidden = ok;
    return ok;
  }

  function showConfirmation(form, reference) {
    const panel = document.createElement("section");
    panel.className = "panel confirm";
    const title = document.createElement("h2");
    title.textContent = "Received securely";
    const copy = document.createElement("p");
    copy.textContent = "Your answers were encrypted in this browser before they were sent. This page no longer shows them.";
    const ref = document.createElement("p");
    ref.className = "reference";
    ref.textContent = "Reference " + reference;
    const next = document.createElement("p");
    next.textContent = "Keep this reference. Tranquil opens the encrypted record at the office. If this is an emergency, call 911.";
    const again = document.createElement("a");
    again.className = "btn";
    again.href = location.pathname + location.search;
    again.textContent = "Start another form";
    panel.append(title, copy, ref, next, again);
    form.replaceWith(panel);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function enhance(form) {
    if (!form || form.dataset.enhanced === "yes") return;
    form.dataset.enhanced = "yes";
    form.setAttribute("novalidate", "novalidate");
    if (!form.querySelector(".hp")) {
      const trap = document.createElement("div");
      trap.className = "hp";
      trap.setAttribute("aria-hidden", "true");
      trap.innerHTML = '<label>Company website <input name="company_website" tabindex="-1" autocomplete="off"></label>';
      form.prepend(trap);
    }
    form.querySelectorAll("[data-kind=signature] canvas").forEach(setupPad);
    bindJobs(form);
    bindDraft(form);
    if (form.dataset.staff === "yes") refreshStaff(form);

    const print = form.querySelector("[data-print]");
    if (print) print.addEventListener("click", function () { window.print(); });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const status = statusNode(form);
      status.textContent = "";
      status.classList.remove("is-error");
      if (form.querySelector('[name="company_website"]').value) {
        showConfirmation(form, "TQ-RECEIVED");
        return;
      }
      if (!form.checkValidity()) {
        form.reportValidity();
        status.textContent = "Please complete the highlighted required items.";
        status.classList.add("is-error");
        return;
      }
      try {
        requireAny(form);
      } catch (error) {
        status.textContent = error.message;
        status.classList.add("is-error");
        return;
      }
      if (form.dataset.staff === "yes" && form.dataset.staffOk !== "yes") {
        const ok = await refreshStaff(form);
        if (!ok) {
          status.textContent = "Enter the staff access code to submit this clinical form.";
          status.classList.add("is-error");
          document.getElementById("staff-gate")?.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      const button = form.querySelector("[type=submit]");
      if (button) button.disabled = true;
      status.textContent = "Encrypting and sending…";
      try {
        const record = await collectForm(form);
        const sealed = await TranquilCrypto.encryptPayload(window.TRANQUIL_PUBLIC_KEY_PEM, record);
        const response = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            v: 1,
            form: form.dataset.form,
            iv: sealed.iv,
            ek: sealed.ek,
            ct: sealed.ct
          })
        });
        const body = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(body.error || "This preview does not keep submissions. Call Tranquil at (678) 290-0070.");
        try { sessionStorage.removeItem(draftKey(form)); } catch (error) { /* ignore */ }
        form.dataset.submitted = "yes";
        form.dataset.dirty = "no";
        showConfirmation(form, body.reference || "received");
      } catch (error) {
        status.textContent = error.message || "Something went wrong before the form was sent. Nothing was emailed.";
        status.classList.add("is-error");
        if (button) button.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("form.secure-form").forEach(enhance);
  });

  window.TranquilForms = { enhance: enhance };
})();
