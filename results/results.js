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
  printResult: document.getElementById("print-result"),
  reanalyzePreset: document.getElementById("reanalyze-preset"),
  reanalyzeProvider: document.getElementById("reanalyze-provider"),
  reanalyzeBtn: document.getElementById("reanalyze-btn"),
};

let rawMarkdown = "";
let pageTitle = "";
let resultId = null;
let analysisProvider = "";
let analysisModel = "";
let shareline = "";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  resultId = params.get("id");
  const metadataKey = params.get("metadata");
  const whoisKey = params.get("whois");

  // OSINT: Metadata display
  if (metadataKey) {
    displayMetadata(metadataKey);
    return;
  }

  // OSINT: Whois display
  if (whoisKey) {
    displayWhois(whoisKey);
    return;
  }

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

  elements.printResult.addEventListener("click", () => {
    window.print();
  });

  // Share buttons
  function getShareSnippet() {
    // Use AI-generated shareline if available
    if (shareline) return shareline;
    // Fallback: strip markdown formatting, headings, bullets, links, labels
    const lines = rawMarkdown.split("\n")
      .map(l => l.replace(/^#{1,6}\s+/g, "").replace(/\*\*|__/g, "").replace(/[*_`>\[\]()!]/g, "").replace(/^[-•]\s+/g, "").trim())
      .filter(l => l.length > 30 && !/^(summary|source|url|article|publication|http)/i.test(l));
    const snippet = lines.slice(0, 2).join(" ").trim();
    const clean = snippet.replace(/—/g, "-");
    return clean.length > 180 ? clean.slice(0, 177) + "..." : clean;
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
      ? `${title}\n\n${getShareSnippet()}\n\n- ${attrib}\n${url}`
      : `${title}\n\n${getShareSnippet()}\n\n- ${attrib}`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank");
  });

  document.getElementById("share-reddit").addEventListener("click", () => {
    const url = getShareUrl();
    const attrib = getShareAttrib();
    const title = `${pageTitle || "Analysis"} - ${attrib}`;
    if (url) {
      window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, "_blank");
    } else {
      window.open(`https://www.reddit.com/submit?selftext=true&title=${encodeURIComponent(title)}&text=${encodeURIComponent(getShareSnippet() + "\n\n- " + attrib)}`, "_blank");
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
    const subject = `${pageTitle || "Analysis"} - ${attrib}`;
    const body = url
      ? `${getShareSnippet()}\n\nSource: ${url}\n\n- ${attrib}`
      : `${getShareSnippet()}\n\n- ${attrib}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  });

  // Save to Archive
  document.getElementById("save-archive").addEventListener("click", () => {
    const url = getShareUrl();
    if (!url) return;
    window.open("https://archive.is/?run=1&url=" + encodeURIComponent(url), "_blank");
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

  // Re-analyze: load presets into dropdown
  loadReanalyzePresets();

  elements.reanalyzeBtn.addEventListener("click", sendReAnalyze);
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

      // Strip shareline from streaming display so it doesn't flash
      const streamContent = (data.content || "").replace(/\n?SHARELINE:\s*.+$/m, "");
      rawMarkdown = streamContent;
      renderMarkdown(streamContent, elements.resultContent);

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

function extractShareline(text) {
  const match = text.match(/\n?SHARELINE:\s*(.+)$/m);
  if (match) {
    return { cleaned: text.replace(/\n?SHARELINE:\s*.+$/m, "").trimEnd(), shareline: match[1].trim().replace(/—/g, "-") };
  }
  return { cleaned: text, shareline: "" };
}

function showResult(data) {
  const extracted = extractShareline(data.content);
  shareline = extracted.shareline;
  rawMarkdown = extracted.cleaned;
  pageTitle = data.pageTitle || pageTitle;

  renderMarkdown(rawMarkdown, elements.resultContent);

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
  const provNames = { xai: "Grok", openai: "OpenAI", anthropic: "Claude", gemini: "Gemini", custom: "Custom" };

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

      // Show per-answer attribution
      if (data.provider || data.model) {
        const attrDiv = document.createElement("div");
        attrDiv.className = "followup-meta";
        const provNames = { xai: "Grok", openai: "OpenAI", anthropic: "Claude", gemini: "Gemini", custom: "Custom" };
        let attrText = provNames[data.provider] || data.provider || "";
        if (data.model) attrText += attrText ? ` (${data.model})` : data.model;
        attrDiv.textContent = attrText;
        answerDiv.appendChild(attrDiv);

        // Update footer if provider changed
        if (data.provider) analysisProvider = data.provider;
        if (data.model) analysisModel = data.model;
        let meta = data.provider || "";
        if (data.model) meta += ` | ${data.model}`;
        if (data.usage) {
          meta += ` | Tokens: ${data.usage.prompt_tokens || "?"} in / ${data.usage.completion_tokens || "?"} out`;
        }
        elements.resultMeta.textContent = meta;
      }

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
// Re-analyze (same page, different preset)
// ──────────────────────────────────────────────
async function loadReanalyzePresets() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getPresets" });
    if (!resp || !resp.presets) return;

    elements.reanalyzePreset.innerHTML = "";
    for (const preset of resp.presets) {
      const opt = document.createElement("option");
      opt.value = preset.key;
      opt.textContent = preset.label + (preset.provider ? ` → ${preset.provider}` : "");
      elements.reanalyzePreset.appendChild(opt);
    }
  } catch { /* presets unavailable */ }
}

async function sendReAnalyze() {
  const preset = elements.reanalyzePreset.value;
  if (!preset) return;

  const pageUrl = elements.pageUrl.href;
  if (!pageUrl || pageUrl === "#") {
    elements.reanalyzeBtn.textContent = "No URL";
    setTimeout(() => { elements.reanalyzeBtn.textContent = "Re-Analyze"; }, 1500);
    return;
  }

  const providerOverride = elements.reanalyzeProvider.value || null;
  const presetLabel = elements.reanalyzePreset.selectedOptions[0]?.textContent || preset;

  elements.reanalyzeBtn.disabled = true;
  elements.reanalyzeBtn.textContent = "Analyzing...";

  // Add a divider and heading to result area
  const divider = document.createElement("hr");
  divider.style.borderColor = "var(--border)";
  divider.style.margin = "24px 0";
  elements.resultContent.appendChild(divider);

  const heading = document.createElement("div");
  heading.className = "followup-question";
  const badge = document.createElement("strong");
  badge.textContent = `Re-Analysis: ${presetLabel}`;
  heading.appendChild(badge);
  elements.resultContent.appendChild(heading);

  const answerDiv = document.createElement("div");
  answerDiv.className = "followup-answer streaming";
  elements.resultContent.appendChild(answerDiv);
  elements.resultContent.scrollTop = elements.resultContent.scrollHeight;

  const response = await browser.runtime.sendMessage({
    action: "reAnalyze",
    pageUrl,
    pageTitle,
    analysisType: preset,
    provider: providerOverride
  });

  if (!response || !response.success) {
    answerDiv.classList.remove("streaming");
    answerDiv.textContent = `Error: ${response?.error || "Re-analysis failed."}`;
    answerDiv.style.color = "var(--error)";
    elements.reanalyzeBtn.disabled = false;
    elements.reanalyzeBtn.textContent = "Re-Analyze";
    return;
  }

  // Poll for result (reuse follow-up poller)
  await pollForReAnalyze(response.reResultId, answerDiv, response.presetLabel);
  elements.reanalyzeBtn.disabled = false;
  elements.reanalyzeBtn.textContent = "Re-Analyze";
}

async function pollForReAnalyze(reId, answerDiv, presetLabel) {
  const POLL_INTERVAL = 300;
  const MAX_POLLS = 1000;

  for (let i = 0; i < MAX_POLLS; i++) {
    const stored = await browser.storage.local.get(reId);
    const data = stored[reId];

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
      rawMarkdown += `\n\n---\n\n**Re-Analysis (${presetLabel}):**\n\n${data.content}`;

      if (data.provider || data.model) {
        const attrDiv = document.createElement("div");
        attrDiv.className = "followup-meta";
        const provNames = { xai: "Grok", openai: "OpenAI", anthropic: "Claude", gemini: "Gemini", custom: "Custom" };
        let attrText = provNames[data.provider] || data.provider || "";
        if (data.model) attrText += attrText ? ` (${data.model})` : data.model;
        attrDiv.textContent = attrText;
        answerDiv.appendChild(attrDiv);
      }

      if (data.thinking) {
        elements.thinkingSection.classList.remove("hidden");
        elements.thinkingContent.textContent += "\n---\n" + data.thinking;
      }

      browser.storage.local.remove(reId);
      return;
    }

    if (data.status === "error") {
      answerDiv.classList.remove("streaming");
      answerDiv.textContent = `Error: ${data.error}`;
      answerDiv.style.color = "var(--error)";
      browser.storage.local.remove(reId);
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

// ──────────────────────────────────────────────
// OSINT: Metadata display
// ──────────────────────────────────────────────
async function displayMetadata(storeKey) {
  const data = (await browser.storage.local.get(storeKey))[storeKey];
  if (!data) { showError("Metadata not found."); return; }

  elements.presetLabel.textContent = "Page Metadata";
  elements.pageTitle.textContent = data.pageTitle || "Unknown";
  if (elements.pageUrl) {
    elements.pageUrl.textContent = data.pageUrl || "";
    elements.pageUrl.href = data.pageUrl || "#";
  }

  elements.loadingContainer.classList.add("hidden");
  elements.resultsContainer.classList.remove("hidden");

  let md = "## Page Metadata\n\n";

  if (data.author) md += `**Author:** ${data.author}\n\n`;
  if (data.lang) md += `**Language:** ${data.lang}\n\n`;
  if (data.charset) md += `**Charset:** ${data.charset}\n\n`;

  if (data.dates && data.dates.length) {
    md += "### Dates\n";
    data.dates.forEach(d => { md += `- **${d.type || "Date"}:** ${d.value}\n`; });
    md += "\n";
  }

  if (data.og && Object.keys(data.og).length) {
    md += "### Open Graph\n";
    for (const [k, v] of Object.entries(data.og)) md += `- **${k}:** ${v}\n`;
    md += "\n";
  }

  if (data.twitter && Object.keys(data.twitter).length) {
    md += "### Twitter Card\n";
    for (const [k, v] of Object.entries(data.twitter)) md += `- **${k}:** ${v}\n`;
    md += "\n";
  }

  if (data.meta && Object.keys(data.meta).length) {
    md += "### Meta Tags\n";
    for (const [k, v] of Object.entries(data.meta)) md += `- **${k}:** ${v}\n`;
    md += "\n";
  }

  if (data.jsonLd && data.jsonLd.length) {
    md += "### JSON-LD / Schema.org\n";
    data.jsonLd.forEach((block, i) => {
      md += `\n**Block ${i + 1}** (${block["@type"] || "Unknown type"}):\n\`\`\`json\n${JSON.stringify(block, null, 2)}\n\`\`\`\n`;
    });
    md += "\n";
  }

  if (data.links && Object.keys(data.links).length) {
    md += "### Link Relations\n";
    for (const [rel, href] of Object.entries(data.links)) md += `- **${rel}:** ${href}\n`;
    md += "\n";
  }

  rawMarkdown = md;
  renderMarkdown(md, elements.resultContent);
  elements.resultMeta.textContent = "Extracted from page DOM";

  // Clean up stored data
  browser.storage.local.remove(storeKey);
}

// ──────────────────────────────────────────────
// OSINT: Whois display
// ──────────────────────────────────────────────
async function displayWhois(storeKey) {
  const data = (await browser.storage.local.get(storeKey))[storeKey];
  if (!data) { showError("Whois data not found."); return; }

  elements.presetLabel.textContent = "Whois / DNS Lookup";
  elements.pageTitle.textContent = data.whois?.domain || data.pageTitle || "Unknown";
  if (elements.pageUrl) {
    elements.pageUrl.textContent = data.pageUrl || "";
    elements.pageUrl.href = data.pageUrl || "#";
  }

  elements.loadingContainer.classList.add("hidden");
  elements.resultsContainer.classList.remove("hidden");

  let md = `## Whois: ${data.whois?.domain || "Unknown"}\n\n`;

  const w = data.whois || {};
  if (w.registrar) md += `**Registrar:** ${w.registrar}\n\n`;
  if (w.created) md += `**Created:** ${w.created}\n\n`;
  if (w.updated) md += `**Updated:** ${w.updated}\n\n`;
  if (w.expires) md += `**Expires:** ${w.expires}\n\n`;
  if (w.status && w.status.length) md += `**Status:** ${w.status.join(", ")}\n\n`;
  if (w.nameservers && w.nameservers.length) {
    md += "### Nameservers\n";
    w.nameservers.forEach(ns => { md += `- ${ns}\n`; });
    md += "\n";
  }
  if (w.registrant) {
    md += "### Registrant\n";
    for (const [k, v] of Object.entries(w.registrant)) {
      if (v) md += `- **${k}:** ${v}\n`;
    }
    md += "\n";
  }

  const dns = data.dns || {};
  if (dns.a && dns.a.length) {
    md += "### DNS A Records\n";
    dns.a.forEach(r => { md += `- ${r}\n`; });
    md += "\n";
  }
  if (dns.ns && dns.ns.length) {
    md += "### DNS NS Records\n";
    dns.ns.forEach(r => { md += `- ${r}\n`; });
    md += "\n";
  }
  if (dns.mx && dns.mx.length) {
    md += "### DNS MX Records\n";
    dns.mx.forEach(r => { md += `- ${r}\n`; });
    md += "\n";
  }

  rawMarkdown = md;
  renderMarkdown(md, elements.resultContent);
  elements.resultMeta.textContent = "RDAP/DNS lookup";

  browser.storage.local.remove(storeKey);
}
