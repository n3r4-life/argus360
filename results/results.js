const elements = {
  presetLabel: document.getElementById("preset-label"),
  pageTitle: document.getElementById("page-title"),
  pageUrl: document.getElementById("page-url"),
  loadingContainer: document.getElementById("loading-container"),
  loadingText: document.getElementById("loading-text"),
  resultsContainer: document.getElementById("results-container"),
  resultContent: document.getElementById("result-content"),
  resultMeta: document.getElementById("result-meta"),
  copyResult: document.getElementById("copy-result"),
  exportMd: document.getElementById("export-md"),
  exportHtml: document.getElementById("export-html"),
  exportTxt: document.getElementById("export-txt"),
  thinkingSection: document.getElementById("thinking-section"),
  thinkingToggle: document.getElementById("thinking-toggle"),
  thinkingContent: document.getElementById("thinking-content"),
  errorContainer: document.getElementById("error-container"),
  errorMessage: document.getElementById("error-message"),
  followupContainer: document.getElementById("followup-container"),
  followupInput: document.getElementById("followup-input"),
  followupSend: document.getElementById("followup-send"),
  followupProvider: document.getElementById("followup-provider"),
  sourcesPanel: document.getElementById("sources-panel"),
  sourcesList: document.getElementById("sources-list"),
  bookmarkPage: document.getElementById("bookmark-page"),
  monitorPage: document.getElementById("monitor-page"),
};

let rawMarkdown = "";
let pageTitle = "";
let resultId = null;
let analysisProvider = "";
let analysisModel = "";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  resultId = params.get("id");

  if (!resultId) {
    showError("No result ID provided. This page must be opened by the extension.");
    return;
  }

  pollForResult(resultId);

  elements.copyResult.addEventListener("click", () => {
    navigator.clipboard.writeText(rawMarkdown).then(() => {
      elements.copyResult.textContent = "Copied!";
      setTimeout(() => { elements.copyResult.textContent = "Copy Markdown"; }, 1500);
    });
  });

  elements.exportMd.addEventListener("click", () => {
    exportAsMarkdown(rawMarkdown, (pageTitle || "analysis") + ".md");
  });

  elements.exportHtml.addEventListener("click", () => {
    exportAsHTML(rawMarkdown, pageTitle || "analysis");
  });

  elements.exportTxt.addEventListener("click", () => {
    exportAsText(rawMarkdown, (pageTitle || "analysis") + ".txt");
  });

  // Share buttons
  function getShareSnippet() {
    // Strip markdown formatting, headings, bullets, links, labels
    const lines = rawMarkdown.split("\n")
      .map(l => l.replace(/^#{1,6}\s+/g, "").replace(/\*\*|__/g, "").replace(/[*_`>\[\]()!]/g, "").replace(/^[-•]\s+/g, "").trim())
      .filter(l => l.length > 30 && !/^(summary|source|url|article|publication|http)/i.test(l));
    const snippet = lines.slice(0, 2).join(" ").trim();
    return snippet.length > 180 ? snippet.slice(0, 177) + "..." : snippet;
  }

  function getShareUrl() {
    const url = elements.pageUrl.href;
    return (url && url !== "#") ? url : "";
  }

  function getShareAttrib() {
    const prov = analysisProvider || "";
    const provNames = { xai: "Grok", openai: "ChatGPT", anthropic: "Claude", gemini: "Gemini" };
    const name = provNames[prov] || prov;
    return name ? `Argus w/ ${name}` : "Argus";
  }

  document.getElementById("share-x").addEventListener("click", () => {
    const url = getShareUrl();
    const title = pageTitle || "this page";
    const attrib = getShareAttrib();
    const text = url
      ? `${title}\n\n${getShareSnippet()}\n\n— ${attrib}\n${url}`
      : `${title}\n\n${getShareSnippet()}\n\n— ${attrib}`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank");
  });

  document.getElementById("share-reddit").addEventListener("click", () => {
    const url = getShareUrl();
    const attrib = getShareAttrib();
    const title = `${pageTitle || "Analysis"} — ${attrib}`;
    if (url) {
      window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, "_blank");
    } else {
      window.open(`https://www.reddit.com/submit?selftext=true&title=${encodeURIComponent(title)}&text=${encodeURIComponent(getShareSnippet() + "\n\n— " + attrib)}`, "_blank");
    }
  });

  document.getElementById("share-linkedin").addEventListener("click", () => {
    const url = getShareUrl();
    if (url) {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank");
    }
  });

  document.getElementById("share-email").addEventListener("click", () => {
    const url = getShareUrl();
    const attrib = getShareAttrib();
    const subject = `${pageTitle || "Analysis"} — ${attrib}`;
    const body = url
      ? `${getShareSnippet()}\n\nSource: ${url}\n\n— ${attrib}`
      : `${getShareSnippet()}\n\n— ${attrib}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  });

  // Save to Project
  const projBtn = document.getElementById("save-to-project");
  const projPicker = document.getElementById("proj-picker");

  projBtn.addEventListener("click", async () => {
    const resp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (!resp || !resp.success) return;

    projPicker.innerHTML = "";
    if (resp.projects.length === 0) {
      projPicker.innerHTML = `<div class="proj-picker-empty">No projects yet. Create one in the Console.</div>`;
    } else {
      for (const proj of resp.projects) {
        const btn = document.createElement("button");
        btn.className = "proj-picker-item";
        btn.innerHTML = `<span class="proj-color-dot" style="background:${proj.color || '#e94560'};width:8px;height:8px;border-radius:50%;display:inline-block;"></span> ${proj.name}`;
        btn.addEventListener("click", async () => {
          const url = elements.pageUrl.href !== "#" ? elements.pageUrl.href : "";
          await browser.runtime.sendMessage({
            action: "addProjectItem",
            projectId: proj.id,
            item: {
              type: "analysis",
              refId: resultId,
              url,
              title: pageTitle,
              summary: rawMarkdown.slice(0, 500)
            }
          });
          projPicker.classList.add("hidden");
          projBtn.textContent = "Saved!";
          setTimeout(() => { projBtn.textContent = "Save to Project"; }, 1500);
        });
        projPicker.appendChild(btn);
      }
    }
    projPicker.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!projBtn.contains(e.target) && !projPicker.contains(e.target)) {
      projPicker.classList.add("hidden");
    }
  });

  elements.thinkingToggle.addEventListener("click", () => {
    elements.thinkingContent.classList.toggle("hidden");
    elements.thinkingToggle.textContent =
      elements.thinkingContent.classList.contains("hidden") ? "Show Thinking" : "Hide Thinking";
  });

  // Monitor
  elements.monitorPage.addEventListener("click", async () => {
    const pageUrl = elements.pageUrl.href;
    if (!pageUrl || pageUrl === "#") {
      elements.monitorPage.textContent = "No URL";
      return;
    }
    elements.monitorPage.disabled = true;
    elements.monitorPage.textContent = "Setting up...";
    const response = await browser.runtime.sendMessage({
      action: "addMonitor",
      url: pageUrl,
      title: pageTitle,
      intervalMinutes: 60,
      aiAnalysis: true
    });
    if (response && response.success) {
      elements.monitorPage.textContent = "Monitoring!";
      elements.monitorPage.style.color = "var(--success)";
    } else {
      elements.monitorPage.textContent = response?.error || "Failed";
      elements.monitorPage.disabled = false;
    }
  });

  // Bookmark
  elements.bookmarkPage.addEventListener("click", async () => {
    elements.bookmarkPage.disabled = true;
    elements.bookmarkPage.textContent = "Saving...";
    const pageUrl = elements.pageUrl.href;
    const response = await browser.runtime.sendMessage({
      action: "bookmarkPage",
      pageData: {
        title: pageTitle,
        url: pageUrl !== "#" ? pageUrl : "",
        text: rawMarkdown,
        description: ""
      },
      aiTag: true
    });
    if (response && response.success) {
      elements.bookmarkPage.textContent = "Bookmarked!";
      elements.bookmarkPage.style.color = "var(--success)";
    } else {
      elements.bookmarkPage.textContent = "Failed";
      elements.bookmarkPage.disabled = false;
    }
  });

  // Follow-up
  elements.followupSend.addEventListener("click", sendFollowUp);
  elements.followupInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendFollowUp();
    }
  });
});

async function pollForResult(id) {
  const POLL_INTERVAL = 300;
  const MAX_POLLS = 1000; // ~5 minutes

  for (let i = 0; i < MAX_POLLS; i++) {
    const stored = await browser.storage.local.get(id);
    const data = stored[id];

    if (!data) {
      await sleep(POLL_INTERVAL);
      continue;
    }

    updatePageInfo(data);

    if (data.status === "loading") {
      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "streaming") {
      elements.loadingContainer.classList.add("hidden");
      elements.resultsContainer.classList.remove("hidden");
      elements.resultContent.classList.add("streaming");

      rawMarkdown = data.content || "";
      renderMarkdown(rawMarkdown, elements.resultContent);

      if (data.provider && data.model) {
        elements.resultMeta.textContent = `${data.provider} | ${data.model} | Streaming...`;
      }

      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "done") {
      elements.resultContent.classList.remove("streaming");
      showResult(data);
      browser.storage.local.remove(id);
      return;
    }

    if (data.status === "error") {
      showError(data.error);
      browser.storage.local.remove(id);
      return;
    }
  }

  showError("Analysis timed out. Please try again.");
  browser.storage.local.remove(id);
}

function updatePageInfo(data) {
  if (data.presetLabel) {
    elements.presetLabel.textContent = data.presetLabel;
  }
  if (data.pageTitle) {
    pageTitle = data.pageTitle;
    elements.pageTitle.textContent = data.pageTitle;
    document.title = `${data.presetLabel || "Analysis"} — ${data.pageTitle}`;
  }
  if (data.pageUrl) {
    elements.pageUrl.textContent = data.pageUrl;
    elements.pageUrl.href = data.pageUrl;
  }
}

function showResult(data) {
  rawMarkdown = data.content;
  pageTitle = data.pageTitle || pageTitle;

  renderMarkdown(data.content, elements.resultContent);

  // Research mode: show sources panel and enhance content
  if (data.isResearch && data.sources) {
    renderSourcesPanel(data.sources);
    makeCitationsClickable(elements.resultContent);
    makeCollapsibleSections(elements.resultContent);
  }

  if (data.thinking) {
    elements.thinkingSection.classList.remove("hidden");
    elements.thinkingContent.textContent = data.thinking;
  }

  if (data.provider) analysisProvider = data.provider;
  if (data.model) analysisModel = data.model;

  let meta = "";
  if (data.provider) meta += data.provider;
  if (data.model) meta += ` | ${data.model}`;
  if (data.usage) {
    meta += ` | Tokens: ${data.usage.prompt_tokens || "?"} in / ${data.usage.completion_tokens || "?"} out`;
  }
  elements.resultMeta.textContent = meta;

  elements.loadingContainer.classList.add("hidden");
  elements.resultsContainer.classList.remove("hidden");

  // Show follow-up input
  elements.followupContainer.classList.remove("hidden");
}

function renderSourcesPanel(sources) {
  elements.sourcesList.replaceChildren();
  sources.forEach(src => {
    const item = document.createElement("a");
    item.className = "source-item";
    item.href = src.url;
    item.target = "_blank";
    item.id = `source-${src.index}`;

    const badge = document.createElement("span");
    badge.className = "source-badge";
    badge.textContent = src.index;

    const title = document.createElement("span");
    title.className = "source-title";
    title.textContent = src.title || src.url;

    item.appendChild(badge);
    item.appendChild(title);
    elements.sourcesList.appendChild(item);
  });
  elements.sourcesPanel.classList.remove("hidden");
}

function makeCitationsClickable(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const citationRegex = /\[Source (\d+)\]/g;
  const textNodes = [];

  while (walker.nextNode()) {
    if (citationRegex.test(walker.currentNode.textContent)) {
      textNodes.push(walker.currentNode);
    }
    citationRegex.lastIndex = 0;
  }

  textNodes.forEach(node => {
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    const text = node.textContent;
    let match;
    citationRegex.lastIndex = 0;

    while ((match = citationRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const link = document.createElement("a");
      link.className = "citation-link";
      link.href = `#source-${match[1]}`;
      link.textContent = match[0];
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.getElementById(`source-${match[1]}`);
        if (target) {
          target.classList.add("highlight");
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => target.classList.remove("highlight"), 1500);
        }
      });
      frag.appendChild(link);
      lastIndex = citationRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode.replaceChild(frag, node);
  });
}

function makeCollapsibleSections(container) {
  const headings = container.querySelectorAll("h2");
  headings.forEach(h2 => {
    const details = document.createElement("details");
    details.className = "collapsible-section";
    details.open = true;

    const summary = document.createElement("summary");
    summary.textContent = h2.textContent;

    details.appendChild(summary);
    h2.replaceWith(details);

    // Gather siblings until next h2 or end
    while (details.nextSibling && details.nextSibling.nodeName !== "H2") {
      details.appendChild(details.nextSibling);
    }
  });
}

// ──────────────────────────────────────────────
// Follow-up questions
// ──────────────────────────────────────────────
async function sendFollowUp() {
  const question = elements.followupInput.value.trim();
  if (!question) return;

  const providerOverride = elements.followupProvider.value || null;
  const provNames = { xai: "Grok", openai: "OpenAI", anthropic: "Claude", gemini: "Gemini" };

  elements.followupInput.value = "";
  elements.followupSend.disabled = true;

  // Append question to result area
  const questionDiv = document.createElement("div");
  questionDiv.className = "followup-question";
  const strong = document.createElement("strong");
  strong.textContent = providerOverride
    ? `Follow-up (${provNames[providerOverride] || providerOverride}):`
    : "Follow-up:";
  questionDiv.appendChild(strong);
  questionDiv.appendChild(document.createTextNode(" " + question));
  elements.resultContent.appendChild(questionDiv);

  // Create answer placeholder
  const answerDiv = document.createElement("div");
  answerDiv.className = "followup-answer streaming";
  elements.resultContent.appendChild(answerDiv);
  elements.resultContent.scrollTop = elements.resultContent.scrollHeight;

  // Send to background
  const response = await browser.runtime.sendMessage({
    action: "followUp",
    resultId,
    question,
    provider: providerOverride
  });

  if (!response || !response.success) {
    answerDiv.classList.remove("streaming");
    answerDiv.textContent = `Error: ${response?.error || "Failed to send follow-up."}`;
    answerDiv.style.color = "var(--error)";
    elements.followupSend.disabled = false;
    return;
  }

  // Poll for follow-up result
  await pollForFollowUp(response.followupResultId, answerDiv);
  elements.followupSend.disabled = false;
}

async function pollForFollowUp(followupId, answerDiv) {
  const POLL_INTERVAL = 300;
  const MAX_POLLS = 1000;

  for (let i = 0; i < MAX_POLLS; i++) {
    const stored = await browser.storage.local.get(followupId);
    const data = stored[followupId];

    if (!data) { await sleep(POLL_INTERVAL); continue; }

    if (data.status === "loading") {
      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "streaming") {
      renderMarkdown(data.content || "", answerDiv);
      elements.resultContent.scrollTop = elements.resultContent.scrollHeight;
      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "done") {
      answerDiv.classList.remove("streaming");
      renderMarkdown(data.content, answerDiv);
      rawMarkdown += `\n\n---\n\n**Follow-up:** ${elements.followupInput.value || ""}\n\n${data.content}`;

      if (data.thinking) {
        elements.thinkingSection.classList.remove("hidden");
        elements.thinkingContent.textContent += "\n---\n" + data.thinking;
      }

      browser.storage.local.remove(followupId);
      return;
    }

    if (data.status === "error") {
      answerDiv.classList.remove("streaming");
      answerDiv.textContent = `Error: ${data.error}`;
      answerDiv.style.color = "var(--error)";
      browser.storage.local.remove(followupId);
      return;
    }

    await sleep(POLL_INTERVAL);
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function renderMarkdown(md, container) {
  const parsed = new DOMParser().parseFromString(marked.parse(md), "text/html");
  const wasStreaming = container.classList.contains("streaming");
  container.replaceChildren(...parsed.body.childNodes);
  if (wasStreaming) container.classList.add("streaming");
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.loadingContainer.classList.add("hidden");
  elements.errorContainer.classList.remove("hidden");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
