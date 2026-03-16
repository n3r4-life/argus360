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
let historyId = null;
let analysisProvider = "";
let analysisModel = "";
let shareline = "";
let projectContext = null; // { projectId, projectItemId } if opened from a project
let followupMessages = []; // track conversation for "Save to Project"

// Unified viewer instance
const viewer = IntelligenceViewer.create({
  contentEl: elements.resultContent,
  metaEl: elements.resultMeta,
  thinkingSection: elements.thinkingSection,
  thinkingToggle: elements.thinkingToggle,
  thinkingContent: elements.thinkingContent,
  errorContainer: elements.errorContainer,
  errorMessage: elements.errorMessage,
  loadingContainer: elements.loadingContainer,
  resultsContainer: elements.resultsContainer,
  sourcesPanel: elements.sourcesPanel,
  sourcesList: elements.sourcesList,
  copyBtn: elements.copyResult,
  mdBtn: elements.exportMd,
  htmlBtn: elements.exportHtml,
  txtBtn: elements.exportTxt,
  printBtn: elements.printResult,
});

// Pipeline UI elements
const pipelineEls = {
  badge: document.getElementById("source-type-badge"),
  section: document.getElementById("pipeline-section"),
  toggle: document.getElementById("pipeline-toggle"),
  content: document.getElementById("pipeline-content"),
};

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
    viewer.showError("No result ID provided. This page must be opened by the extension.");
    return;
  }

  pollForResult(resultId);
  // Export/copy/print buttons are wired by the viewer instance

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
    const name = IntelligenceViewer.providerLabel(analysisProvider);
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

  // Email+ with contact picker
  document.getElementById("email-compose").addEventListener("click", () => {
    const attrib = getShareAttrib();
    EmailShare.compose({
      subject: `${pageTitle || "Analysis"} - ${attrib}`,
      body: EmailShare.formatBody({
        summary: getShareSnippet(),
        url: getShareUrl(),
        content: rawMarkdown
      })
    });
  });

  // Text It (SMS via XMPP)
  const textItBtn = document.getElementById("share-textit");
  if (textItBtn) {
    TextIt.isConfigured().then(ok => { if (ok) textItBtn.classList.remove("hidden"); });
    textItBtn.addEventListener("click", () => {
      TextIt.open(rawMarkdown || getShareSnippet());
    });
  }

  // Send to Draft Pad
  document.getElementById("send-to-draft").addEventListener("click", async () => {
    if (!rawMarkdown) return;
    await browser.storage.local.set({ draftPendingInsert: { content: rawMarkdown, source: "analysis", timestamp: Date.now() } });
    const btn = document.getElementById("send-to-draft");
    btn.textContent = "Sent!";
    setTimeout(() => { btn.textContent = "Draft"; }, 1500);
    const draftUrl = browser.runtime.getURL("reporting/reporting.html");
    const tab = await browser.tabs.getCurrent();
    await browser.tabs.update(tab.id, { url: draftUrl });
  });

  // Save to Archive
  document.getElementById("save-archive").addEventListener("click", () => {
    const url = getShareUrl();
    if (!url) return;
    window.open("https://archive.is/?run=1&url=" + encodeURIComponent(url), "_blank");
  });

  // Paste to service
  const pasteBtn = document.getElementById("paste-to-service");
  const pastePicker = document.getElementById("paste-picker");

  pasteBtn.addEventListener("click", async () => {
    if (!rawMarkdown) return;
    const settings = await browser.storage.local.get({ pasteProviders: {}, defaultPasteProvider: "" });
    const pp = settings.pasteProviders || {};
    const connected = [];
    for (const key of ["gist", "pastebin", "privatebin"]) {
      if (pp[key]?.connected) connected.push(key);
    }
    if (!connected.length) {
      pasteBtn.textContent = "No paste service configured";
      setTimeout(() => { pasteBtn.textContent = "Paste"; }, 2000);
      return;
    }
    // If only one connected or a default is set, paste directly
    const defaultKey = settings.defaultPasteProvider;
    if (connected.length === 1 || (defaultKey && connected.includes(defaultKey))) {
      const key = (defaultKey && connected.includes(defaultKey)) ? defaultKey : connected[0];
      await doPaste(key);
      return;
    }
    // Show picker
    pastePicker.innerHTML = "";
    const labels = { gist: "GitHub Gist", pastebin: "Pastebin", privatebin: "PrivateBin" };
    for (const key of connected) {
      const opt = document.createElement("button");
      opt.className = "proj-picker-item";
      opt.textContent = labels[key] || key;
      opt.addEventListener("click", async () => {
        pastePicker.classList.add("hidden");
        await doPaste(key);
      });
      pastePicker.appendChild(opt);
    }
    pastePicker.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!pasteBtn.contains(e.target) && !pastePicker.contains(e.target)) {
      pastePicker.classList.add("hidden");
    }
  });

  async function doPaste(providerKey) {
    pasteBtn.disabled = true;
    pasteBtn.textContent = "Pasting...";
    const title = `${pageTitle || "Argus Analysis"} - ${new Date().toISOString().slice(0, 10)}`;
    const result = await browser.runtime.sendMessage({
      action: "pasteCreate",
      providerKey,
      title,
      content: rawMarkdown,
    });
    if (result?.success && result.url) {
      pasteBtn.textContent = "Pasted!";
      pasteBtn.style.color = "var(--success)";
      window.open(result.url, "_blank");
      // Persist paste URL on the history entry
      if (historyId) {
        browser.runtime.sendMessage({ action: "addHistoryPasteUrl", historyId, service: providerKey, url: result.url });
      }
    } else {
      pasteBtn.textContent = result?.error || "Failed";
      pasteBtn.style.color = "var(--error)";
    }
    setTimeout(() => {
      pasteBtn.textContent = "Paste";
      pasteBtn.style.color = "";
      pasteBtn.disabled = false;
    }, 2000);
  }

  // Save to Project
  const projBtn = document.getElementById("save-to-project");
  const projPicker = document.getElementById("proj-picker");

  projBtn.addEventListener("click", async () => {
    const [resp, defResp] = await Promise.all([
      browser.runtime.sendMessage({ action: "getProjects" }),
      browser.runtime.sendMessage({ action: "getDefaultProject" })
    ]);
    if (!resp || !resp.success) return;
    const defaultId = defResp?.defaultProjectId || null;

    projPicker.innerHTML = "";
    if (resp.projects.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "proj-picker-empty";
      emptyEl.textContent = "No projects yet. Create one in the Console.";
      projPicker.appendChild(emptyEl);
    } else {
      // Show default project first
      const sorted = [...resp.projects].sort((a, b) => (b.id === defaultId ? 1 : 0) - (a.id === defaultId ? 1 : 0));
      for (const proj of sorted) {
        const btn = document.createElement("button");
        btn.className = "proj-picker-item";
        const colorDot = document.createElement("span");
        colorDot.className = "proj-color-dot";
        colorDot.style.cssText = `background:${proj.color || '#e94560'};width:8px;height:8px;border-radius:50%;display:inline-block;`;
        btn.appendChild(colorDot);
        btn.append(" " + proj.name + (proj.id === defaultId ? " (default)" : ""));
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
              summary: rawMarkdown.slice(0, 500),
              analysisContent: rawMarkdown,
              analysisPreset: elements.presetLabel.textContent || ""
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

  // Save conversation thread back to project
  document.getElementById("save-thread-btn").addEventListener("click", async () => {
    if (!projectContext || !followupMessages.length) return;
    const btn = document.getElementById("save-thread-btn");
    const status = document.getElementById("save-thread-status");
    btn.disabled = true;
    status.textContent = "Saving...";
    const resp = await browser.runtime.sendMessage({
      action: "saveConversationToProject",
      projectId: projectContext.projectId,
      itemId: projectContext.projectItemId,
      conversation: followupMessages
    });
    if (resp?.success) {
      status.textContent = "Saved to project!";
      status.style.color = "var(--success)";
      btn.textContent = "Saved ✓";
      // Clear tracked messages so they don't double-save
      followupMessages = [];
    } else {
      status.textContent = resp?.error || "Failed to save";
      status.style.color = "var(--error)";
      btn.disabled = false;
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
      // Deep Dive: show rich progress text and link tracker during crawl phases
      if (data.deepDive && data.progress) {
        elements.loadingText.textContent = data.progress.statusText || "Searching...";
        const linksEl = document.getElementById("loading-links");
        if (linksEl && data.progress.links) {
          linksEl.classList.remove("hidden");
          const statusIcons = { pending: "...", fetching: "\u21bb", fetched: "\u2713", reading: "\u25b6", done: "\u2713\u2713", skip: "\u2717" };
          const statusClass = { pending: "", fetching: "", fetched: "", reading: "reading", done: "done", skip: "skip" };
          linksEl.innerHTML = data.progress.links.map(l =>
            `<div class="ll-item"><span class="ll-num">${l.num}.</span>${l.engine ? `<span class="ll-engine">${l.engine}</span>` : ""}<span class="ll-url" title="${l.url}">${l.title || l.url}</span><span class="ll-status ${statusClass[l.status] || ""}">${statusIcons[l.status] || ""}</span></div>`
          ).join("");
        }
      }
      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "select_sources") {
      // Show source selection UI — only build once
      if (!document.getElementById("ss-continue")) {
        elements.loadingText.textContent = "Select which sources to analyze:";
        const spinner = document.querySelector(".loading-spinner");
        if (spinner) spinner.style.display = "none";
        const linksEl = document.getElementById("loading-links");
        if (linksEl && data.fetchedSources) {
          linksEl.classList.remove("hidden");
          linksEl.innerHTML =
            `<div class="ss-controls">
              <button id="ss-select-all" class="btn btn-secondary btn-small">Select All</button>
              <button id="ss-select-none" class="btn btn-secondary btn-small">Select None</button>
              <span id="ss-count" class="ss-count">${data.fetchedSources.length} selected</span>
              <button id="ss-continue" class="pill-chip" style="margin-left:auto;">Continue</button>
            </div>` +
            data.fetchedSources.map(s =>
              `<label class="ss-item">
                <input type="checkbox" class="ss-check" data-index="${s.index}" checked>
                <span class="ll-num">${s.index}.</span>
                ${s.engine ? `<span class="ll-engine">${s.engine}</span>` : ""}
                <span class="ll-url" title="${s.url}">${s.title || s.url}</span>
                <span class="ss-len">${Math.round(s.textLength / 1000)}k chars</span>
              </label>`
            ).join("");

          const updateCount = () => {
            const checked = linksEl.querySelectorAll(".ss-check:checked").length;
            document.getElementById("ss-count").textContent = `${checked} selected`;
          };

          linksEl.querySelectorAll(".ss-check").forEach(cb => cb.addEventListener("change", updateCount));

          document.getElementById("ss-select-all").addEventListener("click", () => {
            linksEl.querySelectorAll(".ss-check").forEach(cb => { cb.checked = true; });
            updateCount();
          });
          document.getElementById("ss-select-none").addEventListener("click", () => {
            linksEl.querySelectorAll(".ss-check").forEach(cb => { cb.checked = false; });
            updateCount();
          });

          document.getElementById("ss-continue").addEventListener("click", async () => {
            const selected = [...linksEl.querySelectorAll(".ss-check:checked")].map(cb => parseInt(cb.dataset.index));
            if (selected.length === 0) return;
            const key = resultId + "_selection";
            await browser.storage.local.set({ [key]: { selectedIndices: selected } });
            linksEl.innerHTML = "";
            linksEl.classList.add("hidden");
            elements.loadingText.textContent = "Resuming analysis with selected sources...";
            if (spinner) spinner.style.display = "";
          });
        }
      }
      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "streaming") {
      viewer.showLoading(false);
      viewer.showResults(true);
      viewer.setStreaming(true);

      // Strip shareline and structured data block from streaming display
      let streamContent = (data.content || "").replace(/\n?SHARELINE:\s*.+$/m, "");
      streamContent = ArgusStructured.stripBlock(streamContent);
      rawMarkdown = streamContent;
      viewer.setRawMarkdown(rawMarkdown);
      IntelligenceViewer.renderMarkdown(streamContent, elements.resultContent);

      if (data.provider && data.model) {
        viewer.setMetaText(`${IntelligenceViewer.providerLabel(data.provider)} | ${data.model} | Streaming...`);
      }

      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "done") {
      viewer.setStreaming(false);
      showResult(data);
      browser.storage.local.remove(id);
      // Poll for pipeline enrichment data (arrives async after main result)
      if (data.sourceType) {
        pollForPipelineData(id);
      }
      return;
    }

    if (data.status === "error") {
      viewer.showError(data.error);
      browser.storage.local.remove(id);
      return;
    }
  }

  viewer.showError("Analysis timed out. Please try again.");
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
  // Strip structured data block first (before shareline extraction)
  const { prose, data: structuredData } = ArgusStructured.parse(text);
  text = prose;
  const match = text.match(/\n?SHARELINE:\s*(.+)$/m);
  if (match) {
    return { cleaned: text.replace(/\n?SHARELINE:\s*.+$/m, "").trimEnd(), shareline: match[1].trim().replace(/—/g, "-"), structuredData };
  }
  return { cleaned: text, shareline: "", structuredData };
}

function showResult(data) {
  const extracted = extractShareline(data.content);
  shareline = extracted.shareline;
  rawMarkdown = extracted.cleaned;
  pageTitle = data.pageTitle || pageTitle;
  // Store structured data for potential future use (confidence badge, etc.)
  if (extracted.structuredData) {
    data._structuredData = ArgusStructured.normalize(extracted.structuredData);
  }

  viewer.setTitle(pageTitle);
  viewer.setContent(rawMarkdown);

  // Research mode: show sources panel and enhance content
  if (data.isResearch && data.sources) {
    viewer.setSources(data.sources);
    viewer.makeCitationsClickable(data.sources);
    makeCollapsibleSections(elements.resultContent);
  }

  viewer.setThinking(data.thinking);

  if (data.provider) analysisProvider = data.provider;
  if (data.model) analysisModel = data.model;
  if (data.historyId) historyId = data.historyId;

  viewer.setMeta({ provider: data.provider, model: data.model, usage: data.usage });

  // Source type badge
  if (data.sourceType) {
    showSourceBadge(data.sourceType);
  }

  // Pipeline enriched results
  if (data.pipelineData && data.pipelineData.markdown) {
    showPipelineResults(data.pipelineData);
  }

  viewer.showLoading(false);
  viewer.showResults(true);

  // Show follow-up input
  elements.followupContainer.classList.remove("hidden");

  // If opened from a project, enable "Save to Project" for follow-ups
  if (data.projectId && data.projectItemId) {
    projectContext = { projectId: data.projectId, projectItemId: data.projectItemId };
  }

  // Seed conversation history so follow-up questions work on pre-existing analyses
  // (e.g. project item views where no live API call created the history)
  browser.runtime.sendMessage({
    action: "initConversation",
    resultId,
    content: rawMarkdown,
    pageTitle: data.pageTitle,
    pageUrl: data.pageUrl
  }).catch(() => {}); // Non-critical — follow-ups just won't work if this fails
}

function showSourceBadge(sourceType) {
  pipelineEls.badge.textContent = "";
  const iconSpan = document.createElement("span");
  iconSpan.className = "source-icon";
  iconSpan.textContent = sourceType.icon || "";
  pipelineEls.badge.appendChild(iconSpan);
  pipelineEls.badge.append(sourceType.label);
  pipelineEls.badge.classList.remove("hidden");
}

function showPipelineResults(pipelineData) {
  pipelineEls.section.classList.remove("hidden");
  const label = pipelineData.sourceLabel || "Source";
  pipelineEls.toggle.textContent = `Show ${label} Insights`;
  IntelligenceViewer.renderMarkdown(pipelineData.markdown, pipelineEls.content);

  // Add "Research Further" search links if we have structured data with a topic/headline
  const sd = pipelineData.structuredData;
  const searchQuery = sd?.story?.headline || sd?.headline || sd?.title || sd?.topic || pageTitle;
  if (searchQuery) {
    const q = encodeURIComponent(searchQuery);
    const researchDiv = document.createElement("div");
    researchDiv.className = "pipeline-research-links";
    const labelSpan = document.createElement("span");
    labelSpan.className = "research-label";
    labelSpan.textContent = "Research Further:";
    researchDiv.appendChild(labelSpan);
    const engines = [
      ["https://news.google.com/search?q=" + q, "Google News"],
      ["https://duckduckgo.com/?q=" + q + "&iar=news&ia=news", "DuckDuckGo"],
      ["https://www.bing.com/news/search?q=" + q, "Bing News"],
      ["https://ground.news/find?query=" + q, "Ground News"],
      ["https://www.allsides.com/search?search_api_fulltext=" + q, "AllSides"],
    ];
    for (const [href, name] of engines) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.className = "research-link";
      a.textContent = name;
      researchDiv.appendChild(a);
    }
    pipelineEls.content.prepend(researchDiv);
  }

  pipelineEls.toggle.addEventListener("click", () => {
    pipelineEls.content.classList.toggle("hidden");
    const isHidden = pipelineEls.content.classList.contains("hidden");
    pipelineEls.toggle.textContent = isHidden ? `Show ${label} Insights` : `Hide ${label} Insights`;
  });
}

async function pollForPipelineData(resultId) {
  const pipelineKey = `${resultId}-pipeline`;
  for (let i = 0; i < 60; i++) { // ~30 seconds max
    await sleep(500);
    const stored = await browser.storage.local.get(pipelineKey);
    const data = stored[pipelineKey];
    if (data) {
      if (data.markdown) showPipelineResults(data);
      browser.storage.local.remove(pipelineKey);
      return;
    }
  }
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

  // Save question text before clearing the input (needed for rawMarkdown later)
  const savedQuestion = question;
  elements.followupInput.value = "";
  elements.followupSend.disabled = true;

  // Append question to result area
  const questionDiv = document.createElement("div");
  questionDiv.className = "followup-question";
  const strong = document.createElement("strong");
  strong.textContent = providerOverride
    ? `Follow-up (${IntelligenceViewer.providerLabel(providerOverride)}):`
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

  // Track the question for conversation saving
  followupMessages.push({ role: "user", content: savedQuestion });

  // Poll for follow-up result
  const answerContent = await pollForFollowUp(response.followupResultId, answerDiv);
  if (answerContent) {
    followupMessages.push({ role: "assistant", content: answerContent });
    // Show "Save to Project" button if this came from a project
    if (projectContext) {
      document.getElementById("save-to-project-row").classList.remove("hidden");
    }
  }
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
      IntelligenceViewer.renderMarkdown(data.content || "", answerDiv);
      elements.resultContent.scrollTop = elements.resultContent.scrollHeight;
      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "done") {
      IntelligenceViewer.renderMarkdown(data.content, answerDiv);
      rawMarkdown += `\n\n---\n\n**Follow-up:** ${savedQuestion}\n\n${data.content}`;
      viewer.setRawMarkdown(rawMarkdown);

      IntelligenceViewer.finalizeAnswerBlock(answerDiv, data);

      if (data.provider) analysisProvider = data.provider;
      if (data.model) analysisModel = data.model;
      viewer.setMeta({ provider: data.provider, model: data.model, usage: data.usage });

      viewer.appendThinking(data.thinking);

      browser.storage.local.remove(followupId);
      return data.content;
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
      IntelligenceViewer.renderMarkdown(data.content || "", answerDiv);
      elements.resultContent.scrollTop = elements.resultContent.scrollHeight;
      await sleep(POLL_INTERVAL);
      continue;
    }

    if (data.status === "done") {
      IntelligenceViewer.renderMarkdown(data.content, answerDiv);
      rawMarkdown += `\n\n---\n\n**Re-Analysis (${presetLabel}):**\n\n${data.content}`;
      viewer.setRawMarkdown(rawMarkdown);

      IntelligenceViewer.finalizeAnswerBlock(answerDiv, data);
      viewer.appendThinking(data.thinking);

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────
// OSINT: Metadata display
// ──────────────────────────────────────────────
async function displayMetadata(storeKey) {
  const data = (await browser.storage.local.get(storeKey))[storeKey];
  if (!data) { viewer.showError("Metadata not found."); return; }

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
  viewer.setRawMarkdown(rawMarkdown);
  IntelligenceViewer.renderMarkdown(md, elements.resultContent);
  viewer.setMetaText("Extracted from page DOM");

  // Init chat component
  const chatContainer = document.getElementById("argus-chat-container");
  chatContainer.classList.remove("hidden");
  ArgusChat.init({
    container: chatContainer,
    contextType: "Page Metadata",
    contextData: md,
    pageUrl: data.pageUrl,
    pageTitle: data.pageTitle
  });

  // Clean up stored data
  browser.storage.local.remove(storeKey);
}

// ──────────────────────────────────────────────
// OSINT: Whois display
// ──────────────────────────────────────────────
async function displayWhois(storeKey) {
  const data = (await browser.storage.local.get(storeKey))[storeKey];
  if (!data) { viewer.showError("Whois data not found."); return; }

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
  viewer.setRawMarkdown(rawMarkdown);
  IntelligenceViewer.renderMarkdown(md, elements.resultContent);
  viewer.setMetaText("RDAP/DNS lookup");

  // Init chat component
  const chatContainer = document.getElementById("argus-chat-container");
  chatContainer.classList.remove("hidden");
  ArgusChat.init({
    container: chatContainer,
    contextType: "Whois / DNS",
    contextData: md,
    pageUrl: data.pageUrl,
    pageTitle: data.whois?.domain || data.pageTitle
  });

  browser.storage.local.remove(storeKey);
}
