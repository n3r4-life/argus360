/* ──────────────────────────────────────────────
   shared/text-it.js  —  Reusable "Text It" SMS modal component
   Called as TextIt.open(content) from any surface.
   Handles number input, recent recipients from Sources,
   message preview, send via background XMPP handler.
   ────────────────────────────────────────────── */

// eslint-disable-next-line no-unused-vars
const TextIt = (() => {
  "use strict";

  let _modal = null;

  // SMS phone icon SVG (used across all surfaces)
  const ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

  /**
   * Check if XMPP is configured in the background.
   * @returns {Promise<boolean>}
   */
  async function isConfigured() {
    try {
      const resp = await browser.runtime.sendMessage({ action: "xmppGetStatus" });
      return !!resp?.configured;
    } catch {
      return false;
    }
  }

  /**
   * Open the Text It send modal.
   * @param {string} content - Content to send (markdown or plain text)
   */
  async function open(content) {
    // Remove any existing modal
    close();

    // Check vault status
    const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
    if (vaultStatus?.value?.enabled && !vaultStatus?.value?.unlocked) {
      _showToast("Vault is locked — unlock it in Settings before sending", "error");
      return;
    }

    // Prep message
    const plain = _stripToPlain(content);
    const segInfo = _segmentCount(plain + "\n— Argus");

    // Build modal
    _modal = document.createElement("div");
    _modal.className = "textit-overlay";
    _modal.innerHTML = `
      <div class="textit-modal">
        <div class="textit-header">
          <span class="textit-title">${ICON_SVG} Text It</span>
          <button class="textit-close" title="Close">&times;</button>
        </div>
        <div class="textit-body">
          <div class="textit-field">
            <label class="textit-label" for="textit-phone">Recipient Phone Number</label>
            <input type="tel" id="textit-phone" class="textit-input" placeholder="+1 555 123 4567" autocomplete="tel">
          </div>
          <div id="textit-recent" class="textit-recent hidden"></div>
          <div class="textit-field">
            <label class="textit-label">Message Preview</label>
            <div class="textit-preview">${_escapeHtml(plain.slice(0, 200))}${plain.length > 200 ? "..." : ""}<span class="textit-attrib">\n— Argus</span></div>
            <div class="textit-meta">
              <span id="textit-chars">${segInfo.chars} chars</span>
              <span class="textit-sep">·</span>
              <span id="textit-segments">${segInfo.segments} segment${segInfo.segments !== 1 ? "s" : ""}</span>
              ${segInfo.chars > 1530 ? '<span class="textit-sep">·</span><span class="textit-warn">Will auto-paste &amp; link</span>' : ""}
            </div>
          </div>
          <div class="textit-field textit-save-row hidden" id="textit-save-row">
            <label class="textit-check-label">
              <input type="checkbox" id="textit-save-contact"> Save as contact in Sources
            </label>
            <input type="text" id="textit-contact-name" class="textit-input textit-input-sm hidden" placeholder="Contact name">
          </div>
          <div class="textit-actions">
            <button class="pill-chip textit-cancel">Cancel</button>
            <button class="pill-chip" id="textit-send" disabled>Send SMS</button>
          </div>
          <div id="textit-status" class="textit-status hidden"></div>
        </div>
      </div>
    `;

    document.body.appendChild(_modal);

    // Wire events
    const phoneInput = _modal.querySelector("#textit-phone");
    const sendBtn = _modal.querySelector("#textit-send");
    const closeBtn = _modal.querySelector(".textit-close");
    const cancelBtn = _modal.querySelector(".textit-cancel");
    const saveCheckbox = _modal.querySelector("#textit-save-contact");
    const saveNameInput = _modal.querySelector("#textit-contact-name");
    const saveRow = _modal.querySelector("#textit-save-row");

    // Enable send when phone has input
    phoneInput.addEventListener("input", () => {
      const val = phoneInput.value.replace(/[^\d+]/g, "");
      sendBtn.disabled = val.length < 7;
      // Show save row if number entered
      if (val.length >= 7) saveRow.classList.remove("hidden");
      else saveRow.classList.add("hidden");
    });

    // Toggle contact name field
    saveCheckbox.addEventListener("change", () => {
      saveNameInput.classList.toggle("hidden", !saveCheckbox.checked);
    });

    // Close
    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    _modal.addEventListener("click", (e) => {
      if (e.target === _modal) close();
    });

    // Escape key
    const escHandler = (e) => {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); }
    };
    document.addEventListener("keydown", escHandler);

    // Send
    sendBtn.addEventListener("click", async () => {
      const phone = phoneInput.value.trim();
      if (!phone) return;

      sendBtn.disabled = true;
      sendBtn.textContent = "Sending...";
      _setStatus("Connecting to XMPP gateway...", "info");

      try {
        const resp = await browser.runtime.sendMessage({
          action: "xmppSend",
          to: phone,
          body: content
        });

        if (resp?.success) {
          _setStatus(`Sent! (${resp.chars} chars to ${resp.to})`, "success");

          // Save contact if checked
          if (saveCheckbox.checked) {
            const name = saveNameInput.value.trim() || phone;
            await browser.runtime.sendMessage({
              action: "sourcesSaveContact",
              name,
              phone,
              tags: ["sms"]
            });
          }

          // Auto-close after success
          setTimeout(close, 2000);
        } else {
          _setStatus("Failed: " + (resp?.error || "Unknown error"), "error");
          sendBtn.disabled = false;
          sendBtn.textContent = "Send SMS";
        }
      } catch (err) {
        _setStatus("Error: " + err.message, "error");
        sendBtn.disabled = false;
        sendBtn.textContent = "Send SMS";
      }
    });

    // Load recent recipients from Sources
    _loadRecentRecipients(phoneInput);

    // Focus phone input
    phoneInput.focus();
  }

  /**
   * Close and remove the modal.
   */
  function close() {
    if (_modal) {
      _modal.remove();
      _modal = null;
    }
  }

  /**
   * Load SMS-capable contacts from Sources and show as recent recipients.
   */
  async function _loadRecentRecipients(phoneInput) {
    try {
      const resp = await browser.runtime.sendMessage({ action: "sourcesGetSmsContacts" });
      const contacts = resp?.contacts || [];
      if (!contacts.length) return;

      const recentEl = _modal?.querySelector("#textit-recent");
      if (!recentEl) return;

      recentEl.classList.remove("hidden");
      recentEl.innerHTML = '<div class="textit-recent-label">Recent:</div>';

      // Show up to 5 most recent
      const sorted = contacts
        .flatMap(c => (c.addresses || [])
          .filter(a => a.label === "Phone" || a.label === "phone" || a.label === "SMS" || a.label === "sms")
          .map(a => ({ name: c.name, phone: a.value, lastUsed: a.lastUsed || 0 }))
        )
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, 5);

      for (const r of sorted) {
        const chip = document.createElement("button");
        chip.className = "pill-chip textit-recent-chip";
        chip.textContent = r.name || r.phone;
        chip.title = r.phone;
        chip.addEventListener("click", () => {
          phoneInput.value = r.phone;
          phoneInput.dispatchEvent(new Event("input"));
        });
        recentEl.appendChild(chip);
      }
    } catch { /* Sources not available */ }
  }

  // ── UI Helpers ──

  function _setStatus(msg, type) {
    const el = _modal?.querySelector("#textit-status");
    if (!el) return;
    el.classList.remove("hidden");
    el.className = `textit-status textit-status-${type}`;
    el.textContent = msg;
  }

  function _showToast(msg, type) {
    // Minimal inline toast for when modal isn't open
    const toast = document.createElement("div");
    toast.className = `textit-toast textit-toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function _stripToPlain(content) {
    return content
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/[*_~`]{1,3}/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function _segmentCount(text) {
    const chars = text.length;
    if (chars <= 160) return { segments: 1, chars, perSegment: 160 };
    const segments = Math.ceil(chars / 153);
    return { segments, chars, perSegment: 153 };
  }

  function _escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  return { open, close, isConfigured, ICON_SVG };
})();
