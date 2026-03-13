// ── Argus Email Share ──
// Reusable email compose utility with saved contacts and mailto: generation.
// Usage: EmailShare.compose({ subject, body, url }) — shows contact picker modal, opens mailto:

const EmailShare = (() => {
  const STORAGE_KEY = "argusEmailContacts";

  async function getContacts() {
    const { [STORAGE_KEY]: contacts } = await browser.storage.local.get({ [STORAGE_KEY]: [] });
    return contacts;
  }

  async function saveContacts(contacts) {
    await browser.storage.local.set({ [STORAGE_KEY]: contacts });
  }

  async function addContact(email, name) {
    const contacts = await getContacts();
    if (contacts.some(c => c.email === email)) return contacts;
    contacts.push({ email, name: name || "", addedAt: Date.now() });
    await saveContacts(contacts);
    return contacts;
  }

  async function removeContact(email) {
    let contacts = await getContacts();
    contacts = contacts.filter(c => c.email !== email);
    await saveContacts(contacts);
    return contacts;
  }

  // Build mailto: URL
  function buildMailto(to, subject, body) {
    const toStr = Array.isArray(to) ? to.join(",") : to;
    return `mailto:${encodeURIComponent(toStr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // Compose email with contact picker modal
  // opts: { subject, body, url, pasteUrl, onSend }
  async function compose(opts = {}) {
    const contacts = await getContacts();

    // Remove existing modal if any
    const existing = document.getElementById("argus-email-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "argus-email-modal";
    modal.className = "argus-email-overlay";
    modal.innerHTML = `
      <div class="argus-email-panel">
        <div class="argus-email-header">
          <span class="argus-email-title">Email Share</span>
          <button class="argus-email-close">&times;</button>
        </div>
        <div class="argus-email-body">
          <div class="argus-email-field">
            <label>To</label>
            <div class="argus-email-to-row">
              <input type="email" class="argus-email-to-input" placeholder="email@example.com" />
              <button class="argus-email-add-btn">+</button>
            </div>
            <div class="argus-email-recipients"></div>
            ${contacts.length ? `
              <div class="argus-email-contacts">
                <span class="argus-email-contacts-label">Contacts:</span>
                ${contacts.map(c => `<button class="argus-email-contact-chip" data-email="${c.email}" title="${c.email}">${c.name || c.email}</button>`).join("")}
              </div>
            ` : ""}
          </div>
          <div class="argus-email-field">
            <label>Subject</label>
            <input type="text" class="argus-email-subject" value="" />
          </div>
          <div class="argus-email-field">
            <label>Message</label>
            <textarea class="argus-email-body-input" rows="8"></textarea>
          </div>
          <div class="argus-email-field">
            <label><input type="checkbox" class="argus-email-save-contact" /> Save new recipients to contacts</label>
          </div>
          <div class="argus-email-actions">
            <button class="argus-email-send-btn">Open in Email Client</button>
            <button class="argus-email-cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Populate fields
    const subjectInput = modal.querySelector(".argus-email-subject");
    const bodyInput = modal.querySelector(".argus-email-body-input");
    const toInput = modal.querySelector(".argus-email-to-input");
    const recipientsDiv = modal.querySelector(".argus-email-recipients");
    const saveCheckbox = modal.querySelector(".argus-email-save-contact");
    saveCheckbox.checked = true;

    subjectInput.value = opts.subject || "";
    bodyInput.value = opts.body || "";

    const selectedRecipients = new Set();

    function renderRecipients() {
      recipientsDiv.innerHTML = "";
      for (const email of selectedRecipients) {
        const chip = document.createElement("span");
        chip.className = "argus-email-recipient-chip";
        chip.textContent = email;
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", () => { selectedRecipients.delete(email); renderRecipients(); });
        chip.appendChild(removeBtn);
        recipientsDiv.appendChild(chip);
      }
    }

    // Add recipient
    function addRecipient(email) {
      email = email.trim().toLowerCase();
      if (!email || !email.includes("@")) return;
      selectedRecipients.add(email);
      renderRecipients();
      toInput.value = "";
    }

    modal.querySelector(".argus-email-add-btn").addEventListener("click", () => addRecipient(toInput.value));
    toInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addRecipient(toInput.value); }
    });

    // Contact chip clicks
    modal.querySelectorAll(".argus-email-contact-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        addRecipient(chip.dataset.email);
        chip.style.opacity = "0.4";
      });
    });

    // Close
    const close = () => modal.remove();
    modal.querySelector(".argus-email-close").addEventListener("click", close);
    modal.querySelector(".argus-email-cancel-btn").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    // Send
    modal.querySelector(".argus-email-send-btn").addEventListener("click", async () => {
      const to = [...selectedRecipients];
      if (!to.length) {
        // Allow sending without saved recipient — just use whatever is in the input
        const raw = toInput.value.trim();
        if (raw) to.push(raw);
      }
      const subject = subjectInput.value;
      const body = bodyInput.value;

      // Save new contacts
      if (saveCheckbox.checked) {
        const existingEmails = new Set(contacts.map(c => c.email));
        for (const email of to) {
          if (!existingEmails.has(email)) {
            await addContact(email, "");
          }
        }
      }

      const mailtoUrl = buildMailto(to, subject, body);
      window.open(mailtoUrl);
      if (opts.onSend) opts.onSend(to, subject, body);
      close();
    });

    toInput.focus();
  }

  // Helper: build email body for different content types
  function formatBody(opts = {}) {
    let body = "";
    if (opts.summary) body += opts.summary + "\n\n";
    if (opts.url) body += "Link: " + opts.url + "\n";
    if (opts.pasteUrl) body += "Paste: " + opts.pasteUrl + "\n";
    if (opts.content) {
      // Strip markdown for email body
      const plain = opts.content
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*|__/g, "")
        .replace(/[*_`]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      body += "\n" + plain.slice(0, 2000);
      if (plain.length > 2000) body += "\n...";
    }
    body += "\n\n— Shared via Argus";
    return body;
  }

  return { compose, getContacts, saveContacts, addContact, removeContact, buildMailto, formatBody };
})();
