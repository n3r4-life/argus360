// ── Argus Chat ──
// Standalone conversational AI chat with persistent sessions.
// No project context, no hidden system prompts — just chat.

(async () => {
  "use strict";

  // ── Elements ──
  const sidebar = document.getElementById("chat-sidebar");
  const sessionList = document.getElementById("session-list");
  const sessionSearch = document.getElementById("session-search");
  const newChatBtn = document.getElementById("new-chat");
  const toggleSidebarBtn = document.getElementById("toggle-sidebar");
  const chatTitle = document.getElementById("chat-title");
  const chatProvider = document.getElementById("chat-provider");
  const chatMessages = document.getElementById("chat-messages");
  const chatEmpty = document.getElementById("chat-empty");
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatStatus = document.getElementById("chat-status");
  const exportBtn = document.getElementById("chat-export");
  const emailBtn = document.getElementById("chat-email");

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

  // ── Sessions ──
  async function loadSessions() {
    const resp = await browser.runtime.sendMessage({ action: "chatGetSessions" });
    sessions = resp?.sessions || [];
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
      del.textContent = "×";
      del.title = "Delete";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await browser.runtime.sendMessage({ action: "chatDeleteSession", sessionId: session.id });
        if (session.id === currentSessionId) {
          currentSessionId = null;
          renderEmptyChat();
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
    renderSessionList();
    scrollToBottom();
    chatInput.focus();
  }

  function renderEmptyChat() {
    chatMessages.replaceChildren();
    chatMessages.appendChild(chatEmpty.cloneNode(true));
  }

  // ── Message rendering ──
  function renderMessages(messages) {
    chatMessages.replaceChildren();
    for (const msg of messages) {
      if (msg.role === "user" || msg.role === "assistant") {
        appendMessageBubble(msg.role, msg.content, msg.timestamp);
      }
    }
  }

  function appendMessageBubble(role, content, timestamp) {
    // Remove empty state if present
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

    // Show user bubble
    appendMessageBubble("user", text, Date.now());
    scrollToBottom();

    // Create streaming placeholder for assistant
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

      // We now have a streamId — poll for chunks
      currentSessionId = resp.sessionId;
      const streamId = resp.streamId;

      await pollStream(streamId, assistantDiv, assistantBody);

      // Refresh sidebar
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
    const MAX_POLLS = 1200; // 96 seconds
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
          // Render markdown live
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
            ? `${state.model || ""} · ${state.usage.totalTokens || "?"} tokens`
            : "";
          // Clean up transient storage
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

  // Auto-resize textarea
  function autoResize() {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + "px";
  }
  chatInput.addEventListener("input", autoResize);

  // ── Sidebar toggle ──
  toggleSidebarBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

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
        md += `**AI:** ${msg.content}\n\n`;
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
      else if (msg.role === "assistant") body += `AI: ${msg.content}\n\n`;
    }

    EmailShare.compose({
      subject: `Chat: ${session.title || "Conversation"} - Argus`,
      body: body.slice(0, 3000) + (body.length > 3000 ? "\n..." : "") + "\n\n— Shared via Argus"
    });
  });

})();
