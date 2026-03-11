const elements = {
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  providerSelect: document.getElementById("provider-select"),
  apiKey: document.getElementById("api-key"),
  toggleKeyVis: document.getElementById("toggle-key-visibility"),
  modelSelect: document.getElementById("model-select"),
  saveSettings: document.getElementById("save-settings"),
  settingsStatus: document.getElementById("settings-status"),
  analysisType: document.getElementById("analysis-type"),
  analysisProvider: document.getElementById("analysis-provider"),
  customPromptGroup: document.getElementById("custom-prompt-group"),
  customPrompt: document.getElementById("custom-prompt"),
  analyzeBtn: document.getElementById("analyze-btn"),
  btnText: document.querySelector(".btn-text"),
  btnSpinner: document.querySelector(".btn-spinner"),
  errorContainer: document.getElementById("error-container"),
  errorMessage: document.getElementById("error-message"),
  modeSelection: document.getElementById("mode-selection"),
  modeCompare: document.getElementById("mode-compare"),
  modeMultipage: document.getElementById("mode-multipage"),
  comparePanel: document.getElementById("compare-panel"),
  multipagePanel: document.getElementById("multipage-panel"),
  tabList: document.getElementById("tab-list"),
  selectionInfo: document.getElementById("selection-info"),
  selectionTextPreview: document.getElementById("selection-text-preview"),
  monitorBtn: document.getElementById("monitor-btn"),
  modeAuto: document.getElementById("mode-auto"),
  bookmarkBtn: document.getElementById("bookmark-btn"),
};

let providerData = {};
let currentProviders = {};
let activeMode = "normal"; // normal, selection, compare, multipage
let currentTabId = null;
let selectedText = "";

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const provResp = await browser.runtime.sendMessage({ action: "getProviders" });
  if (provResp && provResp.success) {
    provResp.providers.forEach(p => { providerData[p.key] = p; });
  }

  await loadSettings();
  await populatePresets();
  await checkSelection();
  attachEventListeners();
  await checkAutoAnalyzeStatus();
  await checkPreviousAnalysis();
  await checkArchiveAvailability();
  await checkWaybackAvailability();
});

async function loadSettings() {
  const settings = await browser.storage.local.get({
    defaultProvider: "xai",
    providers: {
      xai: { apiKey: "", model: "grok-4-0709" },
      openai: { apiKey: "", model: "gpt-4.1" },
      anthropic: { apiKey: "", model: "claude-sonnet-4-6" },
      gemini: { apiKey: "", model: "gemini-2.5-flash" },
      custom: { apiKey: "", model: "", baseUrl: "" }
    },
    apiKey: ""
  });

  currentProviders = settings.providers;
  if (settings.apiKey && !currentProviders.xai.apiKey) {
    currentProviders.xai.apiKey = settings.apiKey;
  }

  elements.providerSelect.value = settings.defaultProvider;
  loadProviderFields(settings.defaultProvider);

  if (!currentProviders[settings.defaultProvider]?.apiKey) {
    elements.settingsPanel.classList.remove("hidden");
  }

  updateAnalysisProviderOptions();
}

function loadProviderFields(providerKey) {
  const config = currentProviders[providerKey] || {};
  elements.apiKey.value = config.apiKey || "";

  const pd = providerData[providerKey];
  elements.modelSelect.replaceChildren();
  if (pd && pd.models) {
    for (const [modelId, modelLabel] of Object.entries(pd.models)) {
      const opt = document.createElement("option");
      opt.value = modelId;
      opt.textContent = modelLabel;
      elements.modelSelect.appendChild(opt);
    }
  }
  elements.modelSelect.value = config.model || (pd && pd.defaultModel) || "";
}

function updateAnalysisProviderOptions() {
  elements.analysisProvider.querySelectorAll("option").forEach(opt => {
    if (opt.value && currentProviders[opt.value]?.apiKey) {
      if (!opt.textContent.endsWith(" \u2713")) opt.textContent += " \u2713";
    }
  });
}

async function populatePresets() {
  const response = await browser.runtime.sendMessage({ action: "getPresets" });
  if (response && response.success) {
    response.presets.forEach(preset => {
      const option = document.createElement("option");
      option.value = preset.key;
      let label = preset.label;
      if (preset.isCustom) label += " *";
      if (preset.provider) {
        const provNames = { xai: "Grok", openai: "OpenAI", anthropic: "Claude", gemini: "Gemini" };
        label += ` → ${provNames[preset.provider] || preset.provider}`;
      }
      option.textContent = label;
      elements.analysisType.appendChild(option);
    });
  }
  const customOpt = document.createElement("option");
  customOpt.value = "custom";
  customOpt.textContent = "Custom Prompt...";
  elements.analysisType.appendChild(customOpt);
}

async function checkSelection() {
  const resp = await browser.runtime.sendMessage({ action: "getSelection" });
  if (resp && resp.success && resp.selection && resp.selection.trim().length > 5) {
    selectedText = resp.selection;
    currentTabId = resp.tabId;
    elements.selectionTextPreview.textContent = `Selected: "${selectedText.substring(0, 80)}${selectedText.length > 80 ? "..." : ""}"`;
    setMode("selection");
  } else {
    currentTabId = resp?.tabId || null;
  }
}

async function checkAutoAnalyzeStatus() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;
    const url = new URL(tab.url);
    const pattern = `*://${url.hostname}/*`;
    const { autoAnalyzeRules } = await browser.storage.local.get({ autoAnalyzeRules: [] });
    if (autoAnalyzeRules.some(r => r.urlPattern === pattern && r.enabled)) {
      elements.modeAuto.classList.add("active");
      elements.modeAuto.title = `Auto-analyzing ${url.hostname}`;
    }
  } catch { /* ignore */ }
}

async function checkPreviousAnalysis() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;

    const resp = await browser.runtime.sendMessage({ action: "getHistoryForUrl", url: tab.url });
    if (!resp || !resp.success || !resp.history.length) return;

    const prevEl = document.getElementById("prev-analysis");
    const latest = resp.history[0];
    const count = resp.total;
    const timeAgo = getTimeAgo(new Date(latest.timestamp || latest.createdAt));
    const presetLabel = latest.presetLabel || "Analysis";

    prevEl.innerHTML = `
      <span class="prev-dot"></span>
      <span>Previously analyzed${count > 1 ? ` (${count}x)` : ""} — ${presetLabel} ${timeAgo}</span>
      <a id="prev-view-link">View</a>
    `;
    prevEl.classList.remove("hidden");

    document.getElementById("prev-view-link").addEventListener("click", () => {
      // Open the most recent analysis in results page
      const resultId = `prev-view-${Date.now()}`;
      browser.storage.local.set({
        [resultId]: {
          status: "done",
          content: latest.content,
          pageTitle: latest.pageTitle || tab.title,
          pageUrl: latest.pageUrl || tab.url,
          presetLabel: latest.presetLabel || "Analysis",
          provider: latest.provider,
          model: latest.model
        }
      });
      browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`) });
      window.close();
    });
  } catch { /* ignore */ }
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

async function checkArchiveAvailability() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;

    const resp = await browser.runtime.sendMessage({ action: "getArchiveCheck", tabId: tab.id });
    if (!resp || !resp.archiveUrl) return;

    const archiveEl = document.getElementById("archive-available");
    archiveEl.innerHTML = `
      <span class="archive-dot"></span>
      <span>Archived version available</span>
      <a id="archive-view-link">View</a>
    `;
    archiveEl.classList.remove("hidden");

    document.getElementById("archive-view-link").addEventListener("click", () => {
      browser.tabs.create({ url: resp.archiveUrl });
      window.close();
    });
  } catch { /* ignore */ }
}

async function checkWaybackAvailability() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;

    const resp = await browser.runtime.sendMessage({ action: "getWaybackCheck", tabId: tab.id });
    if (!resp || !resp.waybackUrl) return;

    const wbEl = document.getElementById("wayback-available");
    wbEl.innerHTML = `
      <span class="archive-dot" style="background:#ffb74d"></span>
      <span>Wayback Machine snapshot available</span>
      <a id="wayback-view-link">View</a>
    `;
    wbEl.classList.remove("hidden");

    document.getElementById("wayback-view-link").addEventListener("click", () => {
      browser.tabs.create({ url: resp.waybackUrl });
      window.close();
    });
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// Mode management
// ──────────────────────────────────────────────
function setMode(mode) {
  activeMode = mode;

  elements.modeSelection.classList.toggle("active", mode === "selection");
  elements.modeCompare.classList.toggle("active", mode === "compare");
  elements.modeMultipage.classList.toggle("active", mode === "multipage");

  elements.comparePanel.classList.toggle("hidden", mode !== "compare");
  elements.multipagePanel.classList.toggle("hidden", mode !== "multipage");
  elements.selectionInfo.classList.toggle("hidden", mode !== "selection" || !selectedText);

  // Hide provider selector in compare mode (each provider gets its own tab)
  elements.analysisProvider.style.display = mode === "compare" ? "none" : "";

  const texts = {
    normal: "Analyze This Page",
    selection: "Analyze Selection",
    compare: "Compare Providers",
    multipage: "Analyze Selected Tabs"
  };
  elements.btnText.textContent = texts[mode] || "Analyze This Page";

  if (mode === "multipage") loadOpenTabs();
}

async function loadOpenTabs() {
  const resp = await browser.runtime.sendMessage({ action: "getOpenTabs" });
  if (!resp || !resp.success) return;

  elements.tabList.replaceChildren();
  resp.tabs.forEach(tab => {
    const item = document.createElement("label");
    item.className = "tab-picker-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = tab.id;
    cb.checked = true;
    const span = document.createElement("span");
    span.className = "tab-title";
    span.textContent = tab.title || tab.url;
    item.appendChild(cb);
    item.appendChild(span);
    elements.tabList.appendChild(item);
  });
}

// ──────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────
function attachEventListeners() {
  elements.settingsToggle.addEventListener("click", () => {
    elements.settingsPanel.classList.toggle("hidden");
  });

  document.getElementById("open-options").addEventListener("click", () => {
    browser.runtime.openOptionsPage();
    window.close();
  });

  document.getElementById("open-bookmarks").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html#bookmarks") });
    window.close();
  });

  document.getElementById("open-monitors").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html#monitors") });
    window.close();
  });

  document.getElementById("open-projects").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html#projects") });
    window.close();
  });

  document.getElementById("open-feeds").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("feeds/feeds.html") });
    window.close();
  });

  document.getElementById("open-archive").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html#archive") });
    window.close();
  });

  document.getElementById("open-history").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("history/history.html") });
    window.close();
  });

  elements.toggleKeyVis.addEventListener("click", () => {
    elements.apiKey.type = elements.apiKey.type === "password" ? "text" : "password";
  });

  elements.providerSelect.addEventListener("change", () => {
    loadProviderFields(elements.providerSelect.value);
  });

  elements.saveSettings.addEventListener("click", async () => {
    const providerKey = elements.providerSelect.value;
    currentProviders[providerKey] = {
      apiKey: elements.apiKey.value.trim(),
      model: elements.modelSelect.value
    };
    await browser.storage.local.set({ defaultProvider: providerKey, providers: currentProviders });
    updateAnalysisProviderOptions();
    elements.settingsStatus.textContent = "Settings saved.";
    elements.settingsStatus.style.color = "var(--success)";
    setTimeout(() => { elements.settingsStatus.textContent = ""; }, 2000);
  });

  elements.analysisType.addEventListener("change", () => {
    const val = elements.analysisType.value;
    elements.customPromptGroup.classList.toggle("hidden", val !== "custom");
    // Auto-activate multipage mode for research preset
    if (val === "research") {
      setMode("multipage");
    }
  });

  // Mode toggles
  elements.modeSelection.addEventListener("click", () => {
    setMode(activeMode === "selection" ? "normal" : "selection");
  });
  elements.modeCompare.addEventListener("click", () => {
    setMode(activeMode === "compare" ? "normal" : "compare");
  });
  elements.modeMultipage.addEventListener("click", () => {
    setMode(activeMode === "multipage" ? "normal" : "multipage");
  });

  // Auto-analyze this site
  elements.modeAuto.addEventListener("click", async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab || !tab.url) {
        showToast("No active page.", "error");
        return;
      }
      const url = new URL(tab.url);
      const pattern = `*://${url.hostname}/*`;
      const preset = elements.analysisType.value || "summary";
      const provider = elements.analysisProvider.value || "";

      // Load existing rules to check for duplicates
      const { autoAnalyzeRules } = await browser.storage.local.get({ autoAnalyzeRules: [] });
      if (autoAnalyzeRules.some(r => r.urlPattern === pattern)) {
        showToast(`Already auto-analyzing ${url.hostname}`, "error");
        return;
      }

      autoAnalyzeRules.push({
        id: `rule-${Date.now()}`,
        urlPattern: pattern,
        preset,
        provider,
        delay: 2000,
        enabled: true
      });
      await browser.storage.local.set({ autoAnalyzeRules });
      showToast(`Auto-analyzing ${url.hostname}!`, "success");
      elements.modeAuto.classList.add("active");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Analyze
  elements.analyzeBtn.addEventListener("click", runAnalysis);

  // Monitor this page
  elements.monitorBtn.addEventListener("click", async () => {
    if (!currentTabId) {
      showToast("No active page to monitor.", "error");
      return;
    }
    elements.monitorBtn.disabled = true;
    elements.monitorBtn.classList.add("bookmark-btn-saving");
    showToast("Setting up monitor...", "loading");
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      const response = await browser.runtime.sendMessage({
        action: "addMonitor",
        url: tab.url,
        title: tab.title,
        intervalMinutes: 60,
        duration: 72,
        aiAnalysis: true,
        autoBookmark: true
      });
      elements.monitorBtn.classList.remove("bookmark-btn-saving");
      if (response && response.success) {
        const svg = elements.monitorBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", "currentColor");
        elements.monitorBtn.title = "Monitoring!";
        showToast("Monitoring this page hourly!", "success");
        setTimeout(() => window.close(), 1200);
      } else {
        elements.monitorBtn.disabled = false;
        showToast(response?.error || "Failed to set up monitor.", "error");
      }
    } catch (err) {
      elements.monitorBtn.classList.remove("bookmark-btn-saving");
      elements.monitorBtn.disabled = false;
      showToast(err.message, "error");
    }
  });

  // Bookmark
  elements.bookmarkBtn.addEventListener("click", async () => {
    elements.bookmarkBtn.disabled = true;
    elements.bookmarkBtn.classList.add("bookmark-btn-saving");
    showToast("Saving bookmark...", "loading");
    try {
      const response = await browser.runtime.sendMessage({
        action: "bookmarkPage",
        tabId: currentTabId,
        aiTag: true
      });
      if (response && response.success) {
        elements.bookmarkBtn.classList.remove("bookmark-btn-saving");
        const svg = elements.bookmarkBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", "currentColor");
        elements.bookmarkBtn.title = "Bookmarked!";
        showToast("Bookmarked with AI tags!", "success");
        setTimeout(() => window.close(), 1200);
      } else {
        elements.bookmarkBtn.classList.remove("bookmark-btn-saving");
        elements.bookmarkBtn.disabled = false;
        showToast(response?.error || "Failed to bookmark.", "error");
      }
    } catch (err) {
      elements.bookmarkBtn.classList.remove("bookmark-btn-saving");
      elements.bookmarkBtn.disabled = false;
      showToast(err.message, "error");
    }
  });

  // ── OSINT Tool Buttons ──
  document.getElementById("osint-metadata").addEventListener("click", async () => {
    showToast("Extracting metadata...", "loading");
    const resp = await browser.runtime.sendMessage({ action: "extractMetadata", tabId: currentTabId });
    if (resp && resp.success) {
      const storeKey = `metadata-${Date.now()}`;
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      await browser.storage.local.set({ [storeKey]: { ...resp.metadata, pageUrl: tabs[0]?.url, pageTitle: tabs[0]?.title } });
      browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?metadata=${encodeURIComponent(storeKey)}`) });
      window.close();
    } else {
      showToast(resp?.error || "Failed to extract metadata.", "error");
    }
  });

  document.getElementById("osint-links").addEventListener("click", async () => {
    showToast("Mapping links...", "loading");
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const resp = await browser.runtime.sendMessage({ action: "extractLinks", tabId: currentTabId });
    if (resp && resp.success) {
      const storeKey = `linkmap-${Date.now()}`;
      await browser.storage.local.set({ [storeKey]: { pageUrl: tabs[0]?.url, pageTitle: tabs[0]?.title, links: resp.links, stats: resp.stats } });
      browser.tabs.create({ url: browser.runtime.getURL(`osint/link-map.html?id=${encodeURIComponent(storeKey)}`) });
      window.close();
    } else {
      showToast(resp?.error || "Failed to map links.", "error");
    }
  });

  document.getElementById("osint-whois").addEventListener("click", async () => {
    showToast("Looking up domain...", "loading");
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const domain = new URL(tabs[0].url).hostname;
      const resp = await browser.runtime.sendMessage({ action: "whoisLookup", domain });
      if (resp && resp.success) {
        const storeKey = `whois-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { ...resp, pageUrl: tabs[0].url, pageTitle: tabs[0].title } });
        browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?whois=${encodeURIComponent(storeKey)}`) });
        window.close();
      } else {
        showToast(resp?.error || "Whois lookup failed.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("osint-techstack").addEventListener("click", async () => {
    showToast("Detecting tech stack...", "loading");
    const resp = await browser.runtime.sendMessage({ action: "detectTechStack", tabId: currentTabId });
    if (resp && resp.success) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const storeKey = `techstack-${Date.now()}`;
      await browser.storage.local.set({ [storeKey]: { pageUrl: tabs[0]?.url, pageTitle: tabs[0]?.title, technologies: resp.technologies } });
      browser.tabs.create({ url: browser.runtime.getURL(`osint/techstack.html?id=${encodeURIComponent(storeKey)}`) });
      window.close();
    } else {
      showToast(resp?.error || "Tech stack detection failed.", "error");
    }
  });
}

// ──────────────────────────────────────────────
// Toast notifications
// ──────────────────────────────────────────────
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");

  if (type !== "loading") {
    setTimeout(() => toast.classList.add("hidden"), 3000);
  }
}

// ──────────────────────────────────────────────
// Analysis — sends to background, opens results tab(s), closes popup
// ──────────────────────────────────────────────
async function runAnalysis() {
  elements.analyzeBtn.disabled = true;
  elements.btnText.classList.add("hidden");
  elements.btnSpinner.classList.remove("hidden");
  elements.errorContainer.classList.add("hidden");

  const analysisType = elements.analysisType.value;
  const customPrompt = analysisType === "custom" ? elements.customPrompt.value.trim() : null;
  const provider = elements.analysisProvider.value || null;

  if (analysisType === "custom" && !customPrompt) {
    showError("Please enter a custom prompt.");
    resetButton();
    return;
  }

  const message = {
    action: "analyzeInTab",
    analysisType,
    customPrompt,
    provider,
    tabId: currentTabId
  };

  if (activeMode === "selection" && selectedText) {
    message.selectedText = selectedText;
  }

  if (activeMode === "compare") {
    const checked = elements.comparePanel.querySelectorAll("input:checked");
    message.providers = Array.from(checked).map(cb => cb.value);
    if (message.providers.length < 2) {
      showError("Select at least 2 providers to compare.");
      resetButton();
      return;
    }
  }

  if (activeMode === "multipage") {
    const checked = elements.tabList.querySelectorAll("input:checked");
    message.tabIds = Array.from(checked).map(cb => parseInt(cb.value));
    if (!message.tabIds.length) {
      showError("Please select at least one tab.");
      resetButton();
      return;
    }
  }

  try {
    const response = await browser.runtime.sendMessage(message);
    if (response && response.success) {
      window.close();
    } else {
      showError(response?.error || "Failed to start analysis.");
      resetButton();
    }
  } catch (err) {
    showError(err.message || "Failed to start analysis.");
    resetButton();
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorContainer.classList.remove("hidden");
}

function resetButton() {
  elements.analyzeBtn.disabled = false;
  elements.btnText.classList.remove("hidden");
  elements.btnSpinner.classList.add("hidden");
}
