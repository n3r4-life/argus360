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

  function createActionBar(rawMarkdown, questionText) {
    const bar = document.createElement("div");
    bar.className = "argus-chat-actions";

    // Copy
    const copyBtn = document.createElement("button");
    copyBtn.className = "pill-chip";
    copyBtn.title = "Copy to clipboard";
    copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(rawMarkdown);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`; }, 1500);
      } catch { /* */ }
    });
    bar.appendChild(copyBtn);

    // Save to Project
    const projBtn = document.createElement("button");
    projBtn.className = "pill-chip";
    projBtn.title = "Save to project";
    projBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Project`;
    projBtn.addEventListener("click", () => showProjectPicker(rawMarkdown, questionText, projBtn));
    bar.appendChild(projBtn);

    // Save as Draft
    const draftBtn = document.createElement("button");
    draftBtn.className = "pill-chip";
    draftBtn.title = "Save as draft";
    draftBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Draft`;
    draftBtn.addEventListener("click", async () => {
      try {
        const draftId = "draft-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
        await browser.runtime.sendMessage({
          action: "draftSave",
          draft: {
            id: draftId,
            title: questionText || "Chat Analysis",
            content: rawMarkdown,
            updatedAt: Date.now()
          }
        });
        draftBtn.textContent = "Saved!";
        setTimeout(() => { draftBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Draft`; }, 1500);
      } catch { /* */ }
    });
    bar.appendChild(draftBtn);

    // Paste (Gist / PrivateBin)
    const pasteBtn = document.createElement("button");
    pasteBtn.className = "pill-chip";
    pasteBtn.title = "Paste to Gist or PrivateBin";
    pasteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Paste`;
    pasteBtn.addEventListener("click", () => showPastePicker(rawMarkdown, questionText, pasteBtn));
    bar.appendChild(pasteBtn);

    // Share to X
    const xBtn = document.createElement("button");
    xBtn.className = "pill-chip";
    xBtn.title = "Share on X";
    xBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    xBtn.addEventListener("click", () => {
      const snippet = rawMarkdown.slice(0, 250).replace(/\n/g, " ");
      const text = `${snippet}${rawMarkdown.length > 250 ? "..." : ""}\n\nvia Argus`;
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
    });
    bar.appendChild(xBtn);

    // Share to Reddit
    const redditBtn = document.createElement("button");
    redditBtn.className = "pill-chip";
    redditBtn.title = "Share on Reddit";
    redditBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`;
    redditBtn.addEventListener("click", () => {
      const title = questionText || "AI Analysis";
      window.open(`https://www.reddit.com/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(rawMarkdown)}`, "_blank");
    });
    bar.appendChild(redditBtn);

    // Email
    const emailBtn = document.createElement("button");
    emailBtn.className = "pill-chip";
    emailBtn.title = "Share via email";
    emailBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
    emailBtn.addEventListener("click", () => {
      const subject = questionText || "Argus AI Analysis";
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(rawMarkdown)}`, "_blank");
    });
    bar.appendChild(emailBtn);

    return bar;
  }

  async function showProjectPicker(markdown, questionText, anchorBtn) {
    // Remove existing picker if open
    const existing = anchorBtn.parentElement.querySelector(".argus-chat-project-picker");
    if (existing) { existing.remove(); return; }

    const picker = document.createElement("div");
    picker.className = "argus-chat-project-picker";

    try {
      const resp = await browser.runtime.sendMessage({ action: "getProjects" });
      const projects = resp?.projects || [];
      if (!projects.length) {
        picker.textContent = "No projects found.";
        anchorBtn.parentElement.appendChild(picker);
        setTimeout(() => picker.remove(), 2000);
        return;
      }
      for (const p of projects) {
        const btn = document.createElement("button");
        btn.className = "argus-chat-project-option";
        btn.textContent = p.name;
        btn.addEventListener("click", async () => {
          try {
            await browser.runtime.sendMessage({
              action: "addProjectItem",
              projectId: p.id,
              item: {
                type: "note",
                title: questionText || "KG Chat Analysis",
                summary: markdown.slice(0, 500),
                analysisContent: markdown,
                analysisPreset: "chat",
                notes: `Chat Q: ${questionText || "(initial)"}`,
                tags: ["kg-chat"]
              }
            });
            picker.innerHTML = `<span style="color:var(--success,#4caf50);">Saved to ${p.name}</span>`;
            setTimeout(() => picker.remove(), 1500);
          } catch {
            picker.innerHTML = `<span style="color:var(--error,#ff6b6b);">Failed to save</span>`;
            setTimeout(() => picker.remove(), 2000);
          }
        });
        picker.appendChild(btn);
      }
    } catch {
      picker.textContent = "Could not load projects.";
    }
    anchorBtn.parentElement.appendChild(picker);
    // Close on outside click
    const closeHandler = (e) => {
      if (!picker.contains(e.target) && e.target !== anchorBtn) {
        picker.remove();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  async function showPastePicker(markdown, questionText, anchorBtn) {
    const existing = anchorBtn.parentElement.querySelector(".argus-chat-project-picker");
    if (existing) { existing.remove(); return; }

    const picker = document.createElement("div");
    picker.className = "argus-chat-project-picker";

    const providers = [
      { key: "gist", label: "GitHub Gist" },
      { key: "privatebin", label: "PrivateBin" }
    ];

    for (const p of providers) {
      const btn = document.createElement("button");
      btn.className = "argus-chat-project-option";
      btn.textContent = p.label;
      btn.addEventListener("click", async () => {
        btn.textContent = "Pasting...";
        btn.disabled = true;
        try {
          const title = questionText || "Argus Chat Analysis";
          const resp = await browser.runtime.sendMessage({
            action: "pasteCreate",
            providerKey: p.key,
            title,
            content: markdown,
            files: p.key === "gist" ? { "argus-chat.md": markdown } : null,
            isPublic: false
          });
          if (resp && resp.success && resp.url) {
            picker.innerHTML = `<a href="${resp.url}" target="_blank" style="color:var(--accent);font-size:12px;padding:6px 10px;display:block;word-break:break-all;">${resp.url}</a>`;
            // Also copy URL to clipboard
            try { await navigator.clipboard.writeText(resp.url); } catch { /* */ }
          } else {
            picker.innerHTML = `<span style="color:var(--error,#ff6b6b);font-size:12px;padding:6px 10px;display:block;">${resp?.error || "Failed"} — configure ${p.label} in Settings → Cloud</span>`;
          }
          setTimeout(() => picker.remove(), 5000);
        } catch (err) {
          picker.innerHTML = `<span style="color:var(--error,#ff6b6b);font-size:12px;padding:6px 10px;">${err.message}</span>`;
          setTimeout(() => picker.remove(), 3000);
        }
      });
      picker.appendChild(btn);
    }

    anchorBtn.parentElement.appendChild(picker);
    const closeHandler = (e) => {
      if (!picker.contains(e.target) && e.target !== anchorBtn) {
        picker.remove();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
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
    // Placeholder while async load happens
    const defOpt = document.createElement("option");
    defOpt.value = "";
    defOpt.textContent = "Default";
    providerSelect.appendChild(defOpt);

    // Async: populate with ★ (default) and ✓ (has API key) indicators
    (async () => {
      try {
        const api = typeof browser !== 'undefined' ? browser : chrome;
        const settings = await api.storage.local.get({
          defaultProvider: "xai",
          providers: { xai: {}, openai: {}, anthropic: {}, gemini: {}, custom: {} }
        });
        const defaultProv = settings.defaultProvider || "xai";
        const provConfigs = settings.providers || {};
        const provLabels = [["xai", "Grok"], ["openai", "OpenAI"], ["anthropic", "Claude"], ["gemini", "Gemini"], ["custom", "Custom"]];

        providerSelect.innerHTML = "";
        const auto = document.createElement("option");
        auto.value = "";
        auto.textContent = "Default";
        providerSelect.appendChild(auto);

        for (const [key, label] of provLabels) {
          const o = document.createElement("option");
          o.value = key;
          let text = label;
          const hasKey = key === "custom" ? !!(provConfigs[key]?.baseUrl && provConfigs[key]?.model) : !!provConfigs[key]?.apiKey;
          if (hasKey) text += " ✓";
          if (key === defaultProv) text += " ★";
          o.textContent = text;
          providerSelect.appendChild(o);
        }
      } catch { /* keep placeholder */ }
    })();

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

      // Collect image URLs if the page provides them (e.g. selected images)
      const imageUrls = typeof opts.getImageUrls === "function" ? opts.getImageUrls() : [];

      if (!conversationId) {
        // First message — seed conversation with context
        response = await browser.runtime.sendMessage({
          action: "startConversation",
          contextType: opts.contextType || "Data",
          contextData: opts.contextData || "",
          pageUrl: opts.pageUrl || "",
          pageTitle: opts.pageTitle || "",
          question,
          imageUrls,
          provider: providerOverride
        });
      } else {
        // Subsequent messages — follow-up on existing conversation
        response = await browser.runtime.sendMessage({
          action: "followUp",
          resultId: conversationId,
          question,
          imageUrls,
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

      await pollForResult(response.followupResultId, answerDiv, question);
    } catch (err) {
      answerDiv.classList.remove("streaming");
      answerDiv.textContent = `Error: ${err.message}`;
      answerDiv.style.color = "var(--error, #ff6b6b)";
    }

    sendBtn.disabled = false;
  }

  async function pollForResult(resultId, answerDiv, questionText) {
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
        answerDiv.after(createActionBar(data.content, questionText));
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

  /**
   * Update context data dynamically (e.g. when selection changes).
   * Resets conversation so next message uses fresh context.
   */
  function updateContext(contextData) {
    opts.contextData = contextData;
    conversationId = null; // force re-seed on next message
  }

  return { init, updateContext };
})();
