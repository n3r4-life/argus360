/* ──────────────────────────────────────────────
   shared/xmpp-chat.js  —  XMPP Chat Panel (Phase 2)
   Floating panel for bidirectional XMPP / SMS messaging.
   Conversations with contacts, inbound message display,
   presence indicators, recent conversations list.
   ────────────────────────────────────────────── */

// eslint-disable-next-line no-unused-vars
const XmppChat = (() => {
  "use strict";

  let _panel = null;
  let _activeJid = null;       // currently open conversation JID
  let _conversations = {};     // { jid: { messages: [], unread: 0, presence: "offline" } }
  let _pollTimer = null;
  let _container = null;
  let _pageId = "default";

  const PHONE_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  const SEND_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  const CHAT_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

  /**
   * Initialize the XMPP Chat panel.
   * @param {Object} opts
   * @param {HTMLElement} opts.container - Element to append the panel to
   * @param {string} [opts.pageId]      - Page identifier for PanelState persistence
   */
  async function init(opts = {}) {
    _container = opts.container || document.body;
    _pageId = opts.pageId || "default";

    // Check if XMPP is configured
    const status = await browser.runtime.sendMessage({ action: "xmppGetStatus" });
    if (!status?.configured) return;

    _buildToggle();
    _buildPanel();
    _startPolling();

    // Load saved conversations from storage
    await _loadConversations();
  }

  function _buildToggle() {
    const toggle = document.createElement("button");
    toggle.className = "xmpp-chat-toggle";
    toggle.innerHTML = `${CHAT_ICON}<span class="xmpp-chat-badge hidden" id="xmpp-chat-badge">0</span>`;
    toggle.title = "XMPP / SMS Chat";
    toggle.addEventListener("click", () => {
      if (_panel) {
        _panel.classList.toggle("hidden");
        if (!_panel.classList.contains("hidden")) {
          _clearBadge();
          if (typeof PanelState !== "undefined") {
            PanelState.save(_pageId, "xmpp-chat", { visible: true });
          }
        } else {
          if (typeof PanelState !== "undefined") {
            PanelState.save(_pageId, "xmpp-chat", { visible: false });
          }
        }
      }
    });
    _container.appendChild(toggle);
  }

  function _buildPanel() {
    _panel = document.createElement("div");
    _panel.className = "fp xmpp-chat-panel hidden";
    _panel.dataset.panelId = "xmpp-chat";
    _panel.style.cssText = "right:16px;bottom:60px;width:360px;height:480px;";
    _panel.innerHTML = `
      <div class="fp-header xmpp-chat-drag-handle">
        <span class="fp-title">${PHONE_ICON} XMPP Chat</span>
        <span class="xmpp-chat-conn-status" id="xmpp-conn-dot" title="Disconnected">●</span>
        <button class="fp-close" id="xmpp-chat-close">&times;</button>
      </div>
      <div class="fp-tabs">
        <button class="fp-tab active" data-xmpp-tab="conversations">Conversations</button>
        <button class="fp-tab" data-xmpp-tab="contacts">Contacts</button>
      </div>
      <div class="fp-pane active" data-xmpp-pane="conversations">
        <div class="xmpp-conv-toolbar">
          <button class="pill-chip" id="xmpp-new-chat" title="New conversation">+ New</button>
          <button class="pill-chip" id="xmpp-connect-btn" title="Connect to XMPP">Connect</button>
        </div>
        <div id="xmpp-conv-list" class="xmpp-conv-list"></div>
      </div>
      <div class="fp-pane" data-xmpp-pane="contacts">
        <div id="xmpp-contacts-list" class="xmpp-contacts-list">
          <div class="xmpp-empty">Loading contacts...</div>
        </div>
      </div>
      <div id="xmpp-chat-view" class="xmpp-chat-view hidden">
        <div class="xmpp-chat-view-header">
          <button class="pill-chip xmpp-back-btn" id="xmpp-back">← Back</button>
          <span class="xmpp-chat-view-title" id="xmpp-chat-view-title">...</span>
          <span class="xmpp-chat-view-presence" id="xmpp-chat-view-presence">●</span>
        </div>
        <div class="xmpp-messages" id="xmpp-messages"></div>
        <div class="xmpp-compose">
          <input type="text" class="xmpp-compose-input" id="xmpp-compose-input" placeholder="Type a message...">
          <button class="btn btn-sm btn-primary xmpp-compose-send" id="xmpp-compose-send" title="Send">${SEND_ICON}</button>
        </div>
      </div>
      <div class="fp-resize"></div>
    `;

    _container.appendChild(_panel);

    // Wire events
    _panel.querySelector("#xmpp-chat-close").addEventListener("click", () => {
      _panel.classList.add("hidden");
      if (typeof PanelState !== "undefined") {
        PanelState.save(_pageId, "xmpp-chat", { visible: false });
      }
    });

    // Tab switching
    _panel.querySelectorAll(".fp-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        _panel.querySelectorAll(".fp-tab").forEach(t => t.classList.remove("active"));
        _panel.querySelectorAll(".fp-pane").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        const pane = _panel.querySelector(`[data-xmpp-pane="${tab.dataset.xmppTab}"]`);
        if (pane) pane.classList.add("active");
        // Hide chat view when switching tabs
        _panel.querySelector("#xmpp-chat-view").classList.add("hidden");

        if (tab.dataset.xmppTab === "contacts") _loadContacts();
      });
    });

    // Connect button
    _panel.querySelector("#xmpp-connect-btn").addEventListener("click", _handleConnect);

    // New chat button
    _panel.querySelector("#xmpp-new-chat").addEventListener("click", _showNewChatPrompt);

    // Back from chat view
    _panel.querySelector("#xmpp-back").addEventListener("click", () => {
      _panel.querySelector("#xmpp-chat-view").classList.add("hidden");
      _panel.querySelectorAll(".fp-pane")[0].classList.add("active");
      _panel.querySelectorAll(".fp-tabs")[0].classList.remove("hidden");
      _activeJid = null;
    });

    // Send message
    const composeInput = _panel.querySelector("#xmpp-compose-input");
    const sendBtn = _panel.querySelector("#xmpp-compose-send");

    sendBtn.addEventListener("click", () => _sendFromCompose());
    composeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        _sendFromCompose();
      }
    });

    // Make draggable & resizable
    _makeDraggable(_panel);
    _makeResizable(_panel);

    // Restore panel state
    if (typeof PanelState !== "undefined") {
      PanelState.apply(_panel, _pageId, "xmpp-chat", { skipVisibility: false });
    }
  }

  // ── Connection ──

  async function _handleConnect() {
    const connBtn = _panel.querySelector("#xmpp-connect-btn");
    const dot = _panel.querySelector("#xmpp-conn-dot");
    connBtn.textContent = "Connecting...";
    connBtn.disabled = true;

    try {
      const resp = await browser.runtime.sendMessage({ action: "xmppChatConnect" });
      if (resp?.success) {
        dot.className = "xmpp-chat-conn-status online";
        dot.title = "Connected";
        connBtn.textContent = "Connected";
        _renderConversationList();
      } else {
        dot.className = "xmpp-chat-conn-status offline";
        dot.title = "Disconnected";
        connBtn.textContent = "Connect";
        connBtn.disabled = false;
        _showNotice(resp?.error || "Connection failed");
      }
    } catch (e) {
      connBtn.textContent = "Connect";
      connBtn.disabled = false;
      _showNotice(e.message);
    }
  }

  // ── Conversations list ──

  function _renderConversationList() {
    const list = _panel.querySelector("#xmpp-conv-list");
    const jids = Object.keys(_conversations).sort((a, b) => {
      const lastA = _conversations[a].messages.length ? _conversations[a].messages[_conversations[a].messages.length - 1].timestamp : 0;
      const lastB = _conversations[b].messages.length ? _conversations[b].messages[_conversations[b].messages.length - 1].timestamp : 0;
      return lastB - lastA;
    });

    if (!jids.length) {
      list.innerHTML = '<div class="xmpp-empty">No conversations yet. Click "+ New" to start one.</div>';
      return;
    }

    list.innerHTML = "";
    for (const jid of jids) {
      const conv = _conversations[jid];
      const lastMsg = conv.messages.length ? conv.messages[conv.messages.length - 1] : null;
      const displayName = _jidToDisplay(jid);
      const presClass = conv.presence === "available" || conv.presence === "online" ? "online" : "offline";

      const row = document.createElement("div");
      row.className = "xmpp-conv-row" + (conv.unread ? " unread" : "");
      row.innerHTML = `
        <span class="xmpp-conv-presence ${presClass}">●</span>
        <div class="xmpp-conv-info">
          <div class="xmpp-conv-name">${_escapeHtml(displayName)}</div>
          <div class="xmpp-conv-preview">${lastMsg ? _escapeHtml(lastMsg.body.slice(0, 60)) : "<em>No messages</em>"}</div>
        </div>
        <div class="xmpp-conv-meta">
          ${lastMsg ? `<span class="xmpp-conv-time">${_formatTime(lastMsg.timestamp)}</span>` : ""}
          ${conv.unread ? `<span class="xmpp-conv-badge">${conv.unread}</span>` : ""}
        </div>
      `;
      row.addEventListener("click", () => _openConversation(jid));
      list.appendChild(row);
    }
  }

  // ── Chat view ──

  function _openConversation(jid) {
    _activeJid = jid;
    if (!_conversations[jid]) {
      _conversations[jid] = { messages: [], unread: 0, presence: "offline" };
    }
    _conversations[jid].unread = 0;
    _updateBadge();

    // Hide tab panes, show chat view
    _panel.querySelectorAll(".fp-pane").forEach(p => p.classList.remove("active"));
    _panel.querySelectorAll(".fp-tabs")[0].classList.add("hidden");
    const chatView = _panel.querySelector("#xmpp-chat-view");
    chatView.classList.remove("hidden");

    // Set header
    _panel.querySelector("#xmpp-chat-view-title").textContent = _jidToDisplay(jid);
    const presDot = _panel.querySelector("#xmpp-chat-view-presence");
    const pres = _conversations[jid].presence;
    presDot.className = "xmpp-chat-view-presence " + (pres === "available" || pres === "online" ? "online" : "offline");

    _renderMessages();

    // Focus input
    _panel.querySelector("#xmpp-compose-input").focus();

    // Save to storage
    _saveConversations();
  }

  function _renderMessages() {
    const container = _panel.querySelector("#xmpp-messages");
    if (!_activeJid || !_conversations[_activeJid]) {
      container.innerHTML = '<div class="xmpp-empty">Start typing to send a message.</div>';
      return;
    }

    const msgs = _conversations[_activeJid].messages;
    container.innerHTML = "";

    for (const msg of msgs) {
      const bubble = document.createElement("div");
      const isMine = msg.direction === "out";
      bubble.className = "xmpp-msg " + (isMine ? "xmpp-msg-out" : "xmpp-msg-in");
      bubble.innerHTML = `
        <div class="xmpp-msg-body">${_escapeHtml(msg.body)}</div>
        <div class="xmpp-msg-time">${_formatTime(msg.timestamp)}</div>
      `;

      // Action buttons on incoming messages
      if (!isMine) {
        const actions = document.createElement("div");
        actions.className = "xmpp-msg-actions";

        const copyBtn = document.createElement("button");
        copyBtn.className = "pill-chip";
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(msg.body);
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
        });
        actions.appendChild(copyBtn);

        const draftBtn = document.createElement("button");
        draftBtn.className = "pill-chip";
        draftBtn.textContent = "Draft";
        draftBtn.addEventListener("click", async () => {
          await browser.storage.local.set({
            draftPendingInsert: { content: msg.body, source: "xmpp-chat", timestamp: Date.now() }
          });
          draftBtn.textContent = "Sent!";
          setTimeout(() => { draftBtn.textContent = "Draft"; }, 1200);
        });
        actions.appendChild(draftBtn);

        bubble.appendChild(actions);
      }

      container.appendChild(bubble);
    }

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  async function _sendFromCompose() {
    const input = _panel.querySelector("#xmpp-compose-input");
    const body = input.value.trim();
    if (!body || !_activeJid) return;

    input.value = "";

    // Add to local conversation
    const msg = {
      from: "me",
      to: _activeJid,
      body,
      direction: "out",
      timestamp: Date.now(),
      id: "msg-" + Date.now().toString(36)
    };
    _conversations[_activeJid].messages.push(msg);
    _renderMessages();

    // Send via background
    try {
      const resp = await browser.runtime.sendMessage({
        action: "xmppChatSend",
        to: _activeJid,
        body
      });
      if (!resp?.success) {
        _showNotice("Send failed: " + (resp?.error || "Unknown error"));
      }
    } catch (e) {
      _showNotice("Send error: " + e.message);
    }

    _saveConversations();
  }

  // ── New chat prompt ──

  function _showNewChatPrompt() {
    // Remove existing prompt
    const existing = _panel.querySelector(".xmpp-new-prompt");
    if (existing) { existing.remove(); return; }

    const prompt = document.createElement("div");
    prompt.className = "xmpp-new-prompt";
    prompt.innerHTML = `
      <input type="text" class="xmpp-new-input" placeholder="Phone number or JID (e.g. +15551234567 or user@server)" id="xmpp-new-jid">
      <button class="btn btn-sm btn-primary" id="xmpp-new-go">Chat</button>
    `;

    const convList = _panel.querySelector("#xmpp-conv-list");
    convList.parentElement.insertBefore(prompt, convList);

    const goBtn = prompt.querySelector("#xmpp-new-go");
    const jidInput = prompt.querySelector("#xmpp-new-jid");

    const startChat = async () => {
      let target = jidInput.value.trim();
      if (!target) return;

      // If it looks like a phone number, format as SMS JID
      if (/^\+?\d[\d\s\-()]+$/.test(target)) {
        const cfg = await browser.runtime.sendMessage({ action: "xmppGetConfig" });
        if (cfg?.gateway) {
          const cleaned = target.replace(/[^\d+]/g, "");
          const e164 = cleaned.startsWith("+") ? cleaned : "+" + cleaned;
          target = e164 + "@" + cfg.gateway;
        }
      }

      prompt.remove();
      _openConversation(target);
    };

    goBtn.addEventListener("click", startChat);
    jidInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") startChat();
      if (e.key === "Escape") prompt.remove();
    });
    jidInput.focus();
  }

  // ── Contacts tab ──

  async function _loadContacts() {
    const list = _panel.querySelector("#xmpp-contacts-list");
    list.innerHTML = '<div class="xmpp-empty">Loading...</div>';

    try {
      // Get Sources with phone/sms addresses
      const resp = await browser.runtime.sendMessage({ action: "sourcesGetSmsContacts" });
      const contacts = resp?.contacts || [];

      // Also try XMPP roster
      let roster = [];
      try {
        const rosterResp = await browser.runtime.sendMessage({ action: "xmppGetRoster" });
        roster = rosterResp?.items || [];
      } catch { /* roster not available */ }

      if (!contacts.length && !roster.length) {
        list.innerHTML = '<div class="xmpp-empty">No contacts yet. Send a message to add contacts.</div>';
        return;
      }

      list.innerHTML = "";

      // Render roster contacts
      for (const item of roster) {
        const row = _createContactRow(item.name || item.jid, item.jid, _conversations[item.jid]?.presence || "offline");
        list.appendChild(row);
      }

      // Render Sources SMS contacts
      for (const c of contacts) {
        const phones = (c.addresses || []).filter(a => {
          const label = (a.label || "").toLowerCase();
          return label === "phone" || label === "sms" || label === "mobile" || label === "tel";
        });
        for (const p of phones) {
          const row = _createContactRow(c.name || p.value, p.value, "sms");
          list.appendChild(row);
        }
      }
    } catch (e) {
      list.innerHTML = `<div class="xmpp-empty">Error: ${_escapeHtml(e.message)}</div>`;
    }
  }

  function _createContactRow(name, jidOrPhone, presence) {
    const row = document.createElement("div");
    row.className = "xmpp-contact-row";
    const presClass = presence === "available" || presence === "online" ? "online" : (presence === "sms" ? "sms" : "offline");
    row.innerHTML = `
      <span class="xmpp-conv-presence ${presClass}">●</span>
      <div class="xmpp-conv-info">
        <div class="xmpp-conv-name">${_escapeHtml(name)}</div>
        <div class="xmpp-conv-preview">${_escapeHtml(jidOrPhone)}</div>
      </div>
    `;
    row.addEventListener("click", async () => {
      let target = jidOrPhone;
      // If it's a phone number, convert to JID
      if (/^\+?\d/.test(target) && !target.includes("@")) {
        const cfg = await browser.runtime.sendMessage({ action: "xmppGetConfig" });
        if (cfg?.gateway) {
          const cleaned = target.replace(/[^\d+]/g, "");
          const e164 = cleaned.startsWith("+") ? cleaned : "+" + cleaned;
          target = e164 + "@" + cfg.gateway;
        }
      }
      _openConversation(target);
    });
    return row;
  }

  // ── Polling for inbound messages ──

  function _startPolling() {
    if (_pollTimer) return;
    _pollTimer = setInterval(_pollMessages, 2000);
    _pollMessages(); // initial check
  }

  async function _pollMessages() {
    try {
      const resp = await browser.runtime.sendMessage({ action: "xmppChatPoll" });
      if (!resp?.messages?.length && !resp?.presenceUpdates?.length && !resp?.statusUpdate) return;

      // Connection status
      if (resp.statusUpdate) {
        const dot = _panel?.querySelector("#xmpp-conn-dot");
        if (dot) {
          dot.className = "xmpp-chat-conn-status " + (resp.statusUpdate === "connected" ? "online" : "offline");
          dot.title = resp.statusUpdate;
        }
        const connBtn = _panel?.querySelector("#xmpp-connect-btn");
        if (connBtn) {
          connBtn.textContent = resp.statusUpdate === "connected" ? "Connected" : "Connect";
          connBtn.disabled = resp.statusUpdate === "connected";
        }
      }

      // Process inbound messages
      for (const msg of (resp.messages || [])) {
        const jid = _bareJid(msg.from);
        if (!_conversations[jid]) {
          _conversations[jid] = { messages: [], unread: 0, presence: "offline" };
        }
        // Dedup by ID
        if (msg.id && _conversations[jid].messages.some(m => m.id === msg.id)) continue;

        _conversations[jid].messages.push({
          from: msg.from,
          to: msg.to,
          body: msg.body,
          direction: "in",
          timestamp: msg.timestamp || Date.now(),
          id: msg.id || ("in-" + Date.now().toString(36))
        });

        // Update unread count if not the active conversation
        if (_activeJid !== jid || _panel?.classList.contains("hidden")) {
          _conversations[jid].unread = (_conversations[jid].unread || 0) + 1;
        }
      }

      // Process presence updates
      for (const pres of (resp.presenceUpdates || [])) {
        const jid = _bareJid(pres.from);
        if (_conversations[jid]) {
          _conversations[jid].presence = pres.show || pres.type || "offline";
        }
      }

      // Re-render if we got updates
      if (resp.messages?.length || resp.presenceUpdates?.length) {
        _updateBadge();
        _renderConversationList();
        if (_activeJid) _renderMessages();
        _saveConversations();
      }
    } catch { /* polling failure is non-critical */ }
  }

  // ── Badge ──

  function _updateBadge() {
    const total = Object.values(_conversations).reduce((sum, c) => sum + (c.unread || 0), 0);
    const badge = document.getElementById("xmpp-chat-badge");
    if (badge) {
      badge.textContent = total;
      badge.classList.toggle("hidden", total === 0);
    }
  }

  function _clearBadge() {
    if (_activeJid && _conversations[_activeJid]) {
      _conversations[_activeJid].unread = 0;
    }
    _updateBadge();
  }

  // ── Persistence ──

  async function _loadConversations() {
    try {
      const { xmppConversations } = await browser.storage.local.get({ xmppConversations: {} });
      _conversations = xmppConversations;
      _renderConversationList();
    } catch { /* fresh start */ }
  }

  async function _saveConversations() {
    try {
      // Trim to last 100 messages per conversation to keep storage reasonable
      const trimmed = {};
      for (const [jid, conv] of Object.entries(_conversations)) {
        trimmed[jid] = {
          ...conv,
          messages: conv.messages.slice(-100)
        };
      }
      await browser.storage.local.set({ xmppConversations: trimmed });
    } catch { /* best-effort */ }
  }

  // ── Drag & Resize (mirrors reporting.js pattern) ──

  function _makeDraggable(panel) {
    const header = panel.querySelector(".xmpp-chat-drag-handle");
    if (!header) return;
    let dragging = false, startX, startY, startLeft, startTop;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button, input")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      header.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = (startLeft + (e.clientX - startX)) + "px";
      panel.style.top = (startTop + (e.clientY - startY)) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        header.style.cursor = "grab";
        if (typeof PanelState !== "undefined") {
          const rect = panel.getBoundingClientRect();
          PanelState.save(_pageId, "xmpp-chat", { left: rect.left, top: rect.top });
        }
      }
    });
  }

  function _makeResizable(panel) {
    const handle = panel.querySelector(".fp-resize");
    if (!handle) return;
    let resizing = false, startX, startY, startW, startH;

    handle.addEventListener("mousedown", (e) => {
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = panel.offsetWidth;
      startH = panel.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      panel.style.width = Math.max(280, startW + (e.clientX - startX)) + "px";
      panel.style.height = Math.max(300, startH + (e.clientY - startY)) + "px";
    });

    document.addEventListener("mouseup", () => {
      if (resizing) {
        resizing = false;
        if (typeof PanelState !== "undefined") {
          PanelState.save(_pageId, "xmpp-chat", { width: panel.offsetWidth, height: panel.offsetHeight });
        }
      }
    });
  }

  // ── Helpers ──

  function _showNotice(msg) {
    const convList = _panel?.querySelector("#xmpp-conv-list");
    if (!convList) return;
    const notice = document.createElement("div");
    notice.className = "xmpp-notice";
    notice.textContent = msg;
    convList.parentElement.insertBefore(notice, convList);
    setTimeout(() => notice.remove(), 4000);
  }

  function _jidToDisplay(jid) {
    if (!jid) return "Unknown";
    // Phone-style JID: +15551234567@cheogram.com → +1 (555) 123-4567
    const phonePart = jid.split("@")[0];
    if (/^\+\d{10,}$/.test(phonePart)) {
      const d = phonePart.slice(2); // strip +1 for US
      if (d.length === 10) return `+${phonePart[1]} (${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
      return phonePart;
    }
    // Regular JID: user@domain → user
    return phonePart || jid;
  }

  function _bareJid(jid) {
    // Strip resource: user@domain/resource → user@domain
    return (jid || "").split("/")[0];
  }

  function _formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function _escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /**
   * Programmatically open a conversation with a JID.
   * Used by other components to deep-link into chat.
   */
  function openChat(jid) {
    if (_panel) {
      _panel.classList.remove("hidden");
      _openConversation(jid);
    }
  }

  function destroy() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    if (_panel) { _panel.remove(); _panel = null; }
    const toggle = _container?.querySelector(".xmpp-chat-toggle");
    if (toggle) toggle.remove();
  }

  return { init, openChat, destroy };
})();
