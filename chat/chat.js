// ── Argus Chat ──
// Standalone conversational AI chat with persistent sessions.
// No project context, no hidden system prompts — just chat.

(async () => {
  "use strict";

  // ── Elements ──
  const chatTitle = document.getElementById("chat-title");
  const chatProvider = document.getElementById("chat-provider");
  const chatMessages = document.getElementById("chat-messages");
  const chatEmpty = document.getElementById("chat-empty");
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatStatus = document.getElementById("chat-status");
  const newChatBtn = document.getElementById("new-chat");
  const exportBtn = document.getElementById("chat-export");
  const emailBtn = document.getElementById("chat-email");

  // Panel
  const panel = document.getElementById("chat-panel");
  const panelTab = document.getElementById("chat-panel-tab");
  const panelClose = document.getElementById("chat-panel-close");
  const sessionList = document.getElementById("session-list");
  const sessionSearch = document.getElementById("session-search");
  const sessionCount = document.getElementById("chat-session-count");

  // ── State ──
  let currentSessionId = null;
  let sessions = [];
  let isStreaming = false;
  let streamPollTimer = null;

  // ── Init ──
  await loadSessions();
  restoreProvider();

  // Check URL for prefilled message or session
  const params = new URLSearchParams(location.search);
  const prefill = params.get("msg");
  const resumeId = params.get("session");

  if (resumeId) {
    await switchSession(resumeId);
  } else if (prefill) {
    await startNewSession();
    chatInput.value = prefill;
    sendMessage();
  }

  // Check for pending insert from Images or other pages
  try {
    const { chatPendingInsert } = await browser.storage.local.get("chatPendingInsert");
    if (chatPendingInsert && chatPendingInsert.content && (Date.now() - chatPendingInsert.timestamp) < 30000) {
      await browser.storage.local.remove("chatPendingInsert");
      if (!currentSessionId) await startNewSession();
      chatInput.value = chatPendingInsert.content;
      chatInput.focus();
    }
  } catch (e) { /* ignore */ }

  // Listen for inserts while chat is open
  browser.storage.onChanged.addListener((changes) => {
    if (changes.chatPendingInsert?.newValue) {
      const insert = changes.chatPendingInsert.newValue;
      if (insert.content && (Date.now() - insert.timestamp) < 30000) {
        browser.storage.local.remove("chatPendingInsert");
        if (!currentSessionId) startNewSession().then(() => { chatInput.value = insert.content; chatInput.focus(); });
        else { chatInput.value = insert.content; chatInput.focus(); }
      }
    }
  });

  // ── Floating panel: draggable by header ──
  setupFloatingPanel(panel);
  PanelState.apply(panel, "chat", "sessions");

  panelTab.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    PanelState.save("chat", "sessions", { visible: !panel.classList.contains("hidden") });
  });
  panelClose.addEventListener("click", () => {
    panel.classList.add("hidden");
    PanelState.save("chat", "sessions", { visible: false });
  });

  function setupFloatingPanel(p) {
    const header = p.querySelector(".chat-panel-header");
    let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".chat-panel-close")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = p.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      p.classList.add("dragging");
      p.style.zIndex = 25;
      p.style.right = "auto";
      p.style.left = origLeft + "px";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - 60, origLeft + dx));
      const newTop = Math.max(46, Math.min(window.innerHeight - 60, origTop + dy));
      p.style.left = newLeft + "px";
      p.style.top = newTop + "px";
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      p.classList.remove("dragging");
      p.style.zIndex = "";
      const rect = p.getBoundingClientRect();
      PanelState.save("chat", "sessions", { left: rect.left, top: rect.top });
    });
  }

  // ── Sessions ──
  async function loadSessions() {
    const resp = await browser.runtime.sendMessage({ action: "chatGetSessions" });
    sessions = resp?.sessions || [];
    sessionCount.textContent = sessions.length || "";
    renderSessionList();
  }

  function renderSessionList(filter) {
    sessionList.replaceChildren();
    let list = sessions;
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(s =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.preview || "").toLowerCase().includes(q)
      );
    }
    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:20px 14px;color:var(--text-muted);font-size:12px;text-align:center;";
      empty.textContent = filter ? "No matching chats." : "No chats yet.";
      sessionList.appendChild(empty);
      return;
    }
    for (const session of list) {
      const item = document.createElement("div");
      item.className = "session-item" + (session.id === currentSessionId ? " active" : "");
      item.addEventListener("click", () => switchSession(session.id));

      const info = document.createElement("div");
      info.className = "session-item-info";

      const title = document.createElement("div");
      title.className = "session-item-title";
      title.textContent = session.title || "Untitled";

      const meta = document.createElement("div");
      meta.className = "session-item-meta";
      const d = new Date(session.updatedAt);
      meta.textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) +
        (session.provider ? ` · ${session.provider}` : "");

      info.appendChild(title);
      info.appendChild(meta);
      item.appendChild(info);

      const del = document.createElement("button");
      del.className = "session-item-delete";
      del.textContent = "\u00D7";
      del.title = "Delete";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await browser.runtime.sendMessage({ action: "chatDeleteSession", sessionId: session.id });
        if (session.id === currentSessionId) {
          currentSessionId = null;
          renderEmptyChat();
          showSessionButtons(false);
        }
        await loadSessions();
      });
      item.appendChild(del);

      sessionList.appendChild(item);
    }
  }

  async function startNewSession() {
    currentSessionId = null;
    chatTitle.textContent = "New Chat";
    renderEmptyChat();
    showSessionButtons(false);
    chatInput.focus();
    renderSessionList();
  }

  async function switchSession(id) {
    const resp = await browser.runtime.sendMessage({ action: "chatGetSession", sessionId: id });
    if (!resp?.session) return;
    currentSessionId = id;
    const session = resp.session;
    chatTitle.textContent = session.title || "Chat";
    if (session.provider) chatProvider.value = session.provider;
    renderMessages(session.messages || []);
    showSessionButtons(true);
    renderSessionList();
    scrollToBottom();
    chatInput.focus();
  }

  function renderEmptyChat() {
    chatMessages.replaceChildren();
    chatMessages.appendChild(chatEmpty.cloneNode(true));
  }

  function showSessionButtons(show) {
    exportBtn.style.display = show ? "" : "none";
    emailBtn.style.display = show ? "" : "none";
  }

  // ── Message rendering ──
  function renderMessages(messages) {
    chatMessages.replaceChildren();
    for (const msg of messages) {
      if (msg.role === "user" || msg.role === "assistant") {
        appendMessageBubble(msg.role, msg.content, msg.timestamp,
          msg.role === "assistant" ? { provider: msg.provider, model: msg.model } : null);
      }
    }
  }

  function appendMessageBubble(role, content, timestamp, meta) {
    const emptyEl = chatMessages.querySelector(".chat-empty");
    if (emptyEl) emptyEl.remove();

    const div = document.createElement("div");
    div.className = `chat-msg ${role}`;

    const header = document.createElement("div");
    header.className = "chat-msg-header";

    const roleSpan = document.createElement("span");
    roleSpan.className = "chat-msg-role";
    roleSpan.textContent = role === "user" ? "You" : "AI";
    header.appendChild(roleSpan);

    if (timestamp) {
      const timeSpan = document.createElement("span");
      timeSpan.className = "chat-msg-time";
      const d = new Date(timestamp);
      timeSpan.textContent = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      header.appendChild(timeSpan);
    }

    const body = document.createElement("div");
    body.className = "chat-msg-body";

    if (role === "assistant" && typeof marked !== "undefined") {
      body.innerHTML = DOMPurify.sanitize(marked.parse(content || ""));
    } else {
      body.textContent = content || "";
    }

    div.appendChild(header);
    div.appendChild(body);

    // Provider/model footnote for AI messages
    if (role === "assistant" && meta && (meta.provider || meta.model)) {
      const footnote = document.createElement("div");
      footnote.className = "chat-msg-footnote";
      const parts = [];
      if (meta.provider) parts.push(meta.provider);
      if (meta.model) parts.push(meta.model);
      footnote.textContent = parts.join(" · ");
      div.appendChild(footnote);
    }

    // Action bar for assistant messages
    if (role === "assistant" && content) {
      const actions = document.createElement("div");
      actions.className = "chat-msg-actions";

      const copyBtn = document.createElement("button");
      copyBtn.className = "chat-msg-action";
      copyBtn.textContent = "Copy";
      copyBtn.title = "Copy to clipboard";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(content);
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
      });
      actions.appendChild(copyBtn);

      const draftBtn = document.createElement("button");
      draftBtn.className = "chat-msg-action chat-msg-action-accent";
      draftBtn.textContent = "Send to Draft";
      draftBtn.title = "Insert into Draft Pad";
      draftBtn.addEventListener("click", async () => {
        await browser.storage.local.set({ draftPendingInsert: { content, timestamp: Date.now() } });
        draftBtn.textContent = "Sent!";
        setTimeout(() => { draftBtn.textContent = "Send to Draft"; }, 1500);
        const draftUrl = browser.runtime.getURL("reporting/reporting.html");
        const existing = await browser.tabs.query({ url: draftUrl + "*" });
        if (existing.length > 0) {
          await browser.tabs.update(existing[0].id, { active: true });
          await browser.windows.update(existing[0].windowId, { focused: true });
        } else {
          await browser.tabs.create({ url: draftUrl });
        }
      });
      actions.appendChild(draftBtn);

      div.appendChild(actions);
    }

    chatMessages.appendChild(div);
    return div;
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ── Send message ──
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isStreaming) return;

    isStreaming = true;
    chatSend.disabled = true;
    chatInput.value = "";
    autoResize();

    appendMessageBubble("user", text, Date.now());
    scrollToBottom();

    const assistantDiv = appendMessageBubble("assistant", "", Date.now());
    assistantDiv.classList.add("streaming");
    const assistantBody = assistantDiv.querySelector(".chat-msg-body");
    scrollToBottom();

    const provider = chatProvider.value || "";
    chatStatus.textContent = "Thinking...";

    try {
      const resp = await browser.runtime.sendMessage({
        action: "chatSendMessage",
        sessionId: currentSessionId,
        text,
        provider
      });

      if (!resp?.success) {
        assistantBody.textContent = resp?.error || "Failed to get response.";
        assistantDiv.classList.remove("streaming");
        chatStatus.textContent = "";
        isStreaming = false;
        chatSend.disabled = false;
        return;
      }

      currentSessionId = resp.sessionId;
      const streamId = resp.streamId;

      await pollStream(streamId, assistantDiv, assistantBody);

      showSessionButtons(true);
      await loadSessions();
      renderSessionList();

    } catch (err) {
      assistantBody.textContent = "Error: " + err.message;
      assistantDiv.classList.remove("streaming");
      chatStatus.textContent = "";
    }

    isStreaming = false;
    chatSend.disabled = false;
    chatInput.focus();
  }

  async function pollStream(streamId, msgDiv, bodyEl) {
    const POLL_MS = 80;
    const MAX_POLLS = 1200;
    let polls = 0;

    return new Promise((resolve) => {
      streamPollTimer = setInterval(async () => {
        polls++;
        const data = await browser.storage.local.get(streamId);
        const state = data[streamId];

        if (!state || polls >= MAX_POLLS) {
          clearInterval(streamPollTimer);
          msgDiv.classList.remove("streaming");
          if (!state) bodyEl.textContent = "Stream timed out.";
          chatStatus.textContent = "";
          resolve();
          return;
        }

        if (state.status === "streaming" || state.status === "done") {
          if (typeof marked !== "undefined" && state.content) {
            bodyEl.innerHTML = DOMPurify.sanitize(marked.parse(state.content));
          } else {
            bodyEl.textContent = state.content || "";
          }
          scrollToBottom();

          if (state.status === "streaming") {
            chatStatus.textContent = `Streaming... (${(state.content || "").length} chars)`;
          }
        }

        if (state.status === "done") {
          clearInterval(streamPollTimer);
          msgDiv.classList.remove("streaming");
          chatStatus.textContent = state.usage
            ? `${state.usage.totalTokens || "?"} tokens`
            : "";
          // Add provider/model footnote
          if (state.provider || state.model) {
            const existing = msgDiv.querySelector(".chat-msg-footnote");
            if (!existing) {
              const footnote = document.createElement("div");
              footnote.className = "chat-msg-footnote";
              const parts = [];
              if (state.provider) parts.push(state.provider);
              if (state.model) parts.push(state.model);
              footnote.textContent = parts.join(" · ");
              msgDiv.appendChild(footnote);
            }
          }
          browser.storage.local.remove(streamId);
          resolve();
        }

        if (state.status === "error") {
          clearInterval(streamPollTimer);
          msgDiv.classList.remove("streaming");
          bodyEl.textContent = state.error || "Unknown error.";
          chatStatus.textContent = "";
          browser.storage.local.remove(streamId);
          resolve();
        }
      }, POLL_MS);
    });
  }

  // ── Input handling ──
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatSend.addEventListener("click", sendMessage);

  function autoResize() {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + "px";
  }
  chatInput.addEventListener("input", autoResize);

  // ── New chat ──
  newChatBtn.addEventListener("click", startNewSession);

  // ── Session search ──
  let searchTimeout;
  sessionSearch.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderSessionList(sessionSearch.value.trim());
    }, 200);
  });

  // ── Provider persistence ──
  chatProvider.addEventListener("change", () => {
    browser.storage.local.set({ chatDefaultProvider: chatProvider.value });
  });
  function restoreProvider() {
    browser.storage.local.get({ chatDefaultProvider: "" }).then(r => {
      if (r.chatDefaultProvider) chatProvider.value = r.chatDefaultProvider;
    });
  }

  // ── Export ──
  exportBtn.addEventListener("click", async () => {
    if (!currentSessionId) return;
    const resp = await browser.runtime.sendMessage({ action: "chatGetSession", sessionId: currentSessionId });
    if (!resp?.session) return;
    const session = resp.session;

    let md = `# ${session.title || "Chat"}\n\n`;
    for (const msg of (session.messages || [])) {
      if (msg.role === "user") {
        md += `**You:** ${msg.content}\n\n`;
      } else if (msg.role === "assistant") {
        const attr = [msg.provider, msg.model].filter(Boolean).join(" · ");
        md += `**AI:** ${msg.content}\n`;
        if (attr) md += `*— ${attr}*\n`;
        md += `\n`;
      }
    }
    md += `\n---\n*Exported from Argus Chat*\n`;

    if (typeof exportAsMarkdown !== "undefined") {
      exportAsMarkdown(md, `chat-${session.title || "export"}.md`);
    } else {
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${session.title || "export"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  // ── Email+ ──
  emailBtn.addEventListener("click", async () => {
    if (!currentSessionId) return;
    const resp = await browser.runtime.sendMessage({ action: "chatGetSession", sessionId: currentSessionId });
    if (!resp?.session) return;
    const session = resp.session;

    let body = "";
    for (const msg of (session.messages || [])) {
      if (msg.role === "user") body += `You: ${msg.content}\n\n`;
      else if (msg.role === "assistant") {
        const attr = [msg.provider, msg.model].filter(Boolean).join(" · ");
        body += `AI: ${msg.content}\n`;
        if (attr) body += `— ${attr}\n`;
        body += `\n`;
      }
    }

    EmailShare.compose({
      subject: `Chat: ${session.title || "Conversation"} - Argus`,
      body: body.slice(0, 3000) + (body.length > 3000 ? "\n..." : "") + "\n\n\u2014 Shared via Argus"
    });
  });

})();
