/**
 * ArgusChat — Reusable "Discuss with AI" component for any Argus result page.
 *
 * Usage:
 *   // Page must include: purify.min.js, marked.min.js, argus-chat.css
 *   ArgusChat.init({
 *     container: document.getElementById("my-container"), // where to append
 *     contextType: "Tech Stack",                          // label for system prompt
 *     contextData: "...serialized result data...",        // text the AI sees
 *     pageUrl: "https://example.com",                     // optional
 *     pageTitle: "Example"                                // optional
 *   });
 */
const ArgusChat = (() => {
  'use strict';

  let conversationId = null;  // set after first message seeds the conversation
  let panel = null;
  let messagesEl = null;
  let inputEl = null;
  let sendBtn = null;
  let providerSelect = null;
  let opts = {};

  function renderMarkdown(md, el) {
    if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      const clean = DOMPurify.sanitize(marked.parse(md), { RETURN_DOM_FRAGMENT: true });
      el.textContent = "";
      el.appendChild(clean);
    } else {
      el.textContent = md;
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function createDOM(container) {
    // Toggle button
    const toggle = document.createElement("button");
    toggle.className = "argus-chat-toggle";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
    svg.appendChild(path);
    toggle.appendChild(svg);
    toggle.append(" Discuss with AI");

    // Panel
    panel = document.createElement("div");
    panel.className = "argus-chat-panel";

    // Messages area
    messagesEl = document.createElement("div");
    messagesEl.className = "argus-chat-messages";

    // Input row
    const inputRow = document.createElement("div");
    inputRow.className = "argus-chat-input-row";

    providerSelect = document.createElement("select");
    providerSelect.className = "argus-chat-provider";
    for (const [val, label] of [["", "Default"], ["xai", "Grok"], ["openai", "OpenAI"], ["anthropic", "Claude"], ["gemini", "Gemini"], ["custom", "Custom"]]) {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = label;
      providerSelect.appendChild(o);
    }

    inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.className = "argus-chat-input";
    inputEl.placeholder = "Ask about these results...";

    sendBtn = document.createElement("button");
    sendBtn.className = "argus-chat-send";
    sendBtn.textContent = "Send";

    inputRow.append(providerSelect, inputEl, sendBtn);
    panel.append(messagesEl, inputRow);
    container.append(toggle, panel);

    // Events
    toggle.addEventListener("click", () => {
      const open = panel.classList.toggle("open");
      toggle.classList.toggle("active", open);
      if (open) inputEl.focus();
    });

    sendBtn.addEventListener("click", () => sendMessage());
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  async function sendMessage() {
    const question = inputEl.value.trim();
    if (!question || sendBtn.disabled) return;

    const providerOverride = providerSelect.value || null;
    inputEl.value = "";
    sendBtn.disabled = true;

    // Append question bubble
    const questionDiv = document.createElement("div");
    questionDiv.className = "argus-chat-question";
    const strong = document.createElement("strong");
    strong.textContent = "You: ";
    questionDiv.appendChild(strong);
    questionDiv.appendChild(document.createTextNode(question));
    messagesEl.appendChild(questionDiv);

    // Append answer placeholder
    const answerDiv = document.createElement("div");
    answerDiv.className = "argus-chat-answer streaming";
    answerDiv.textContent = "Thinking...";
    messagesEl.appendChild(answerDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      let response;

      if (!conversationId) {
        // First message — seed conversation with context
        response = await browser.runtime.sendMessage({
          action: "startConversation",
          contextType: opts.contextType || "Data",
          contextData: opts.contextData || "",
          pageUrl: opts.pageUrl || "",
          pageTitle: opts.pageTitle || "",
          question,
          provider: providerOverride
        });
      } else {
        // Subsequent messages — follow-up on existing conversation
        response = await browser.runtime.sendMessage({
          action: "followUp",
          resultId: conversationId,
          question,
          provider: providerOverride
        });
      }

      if (!response || !response.success) {
        answerDiv.classList.remove("streaming");
        answerDiv.textContent = `Error: ${response?.error || "Failed to send message."}`;
        answerDiv.style.color = "var(--error, #ff6b6b)";
        sendBtn.disabled = false;
        return;
      }

      if (response.conversationId) {
        conversationId = response.conversationId;
      }

      await pollForResult(response.followupResultId, answerDiv);
    } catch (err) {
      answerDiv.classList.remove("streaming");
      answerDiv.textContent = `Error: ${err.message}`;
      answerDiv.style.color = "var(--error, #ff6b6b)";
    }

    sendBtn.disabled = false;
  }

  async function pollForResult(resultId, answerDiv) {
    const POLL_INTERVAL = 300;
    const MAX_POLLS = 1000;

    for (let i = 0; i < MAX_POLLS; i++) {
      const stored = await browser.storage.local.get(resultId);
      const data = stored[resultId];

      if (!data) { await sleep(POLL_INTERVAL); continue; }

      if (data.status === "loading") {
        await sleep(POLL_INTERVAL);
        continue;
      }

      if (data.status === "streaming") {
        renderMarkdown(data.content || "", answerDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        await sleep(POLL_INTERVAL);
        continue;
      }

      if (data.status === "done") {
        answerDiv.classList.remove("streaming");
        renderMarkdown(data.content, answerDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        browser.storage.local.remove(resultId);
        return;
      }

      if (data.status === "error") {
        answerDiv.classList.remove("streaming");
        answerDiv.textContent = `Error: ${data.error}`;
        answerDiv.style.color = "var(--error, #ff6b6b)";
        browser.storage.local.remove(resultId);
        return;
      }

      await sleep(POLL_INTERVAL);
    }
  }

  /**
   * Initialize the chat component.
   * @param {Object} config
   * @param {HTMLElement} config.container  - DOM element to append chat to
   * @param {string}      config.contextType - e.g. "Tech Stack", "Whois", "Link Map"
   * @param {string}      config.contextData - serialized data for AI context
   * @param {string}      [config.pageUrl]   - URL of the analyzed page
   * @param {string}      [config.pageTitle] - Title of the analyzed page
   */
  function init(config) {
    // Clean up previous instance if re-initialized
    if (config.container) {
      const oldToggle = config.container.querySelector(".argus-chat-toggle");
      const oldPanel = config.container.querySelector(".argus-chat-panel");
      if (oldToggle) oldToggle.remove();
      if (oldPanel) oldPanel.remove();
    }
    opts = config;
    conversationId = null;
    createDOM(config.container);
  }

  return { init };
})();
