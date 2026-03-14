const elements = {
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  quickNavPanel: document.getElementById("quick-nav-panel"),
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
  defaultBookmarkFolder: document.getElementById("default-bookmark-folder"),
  bookmarkBtn: document.getElementById("bookmark-btn"),
  contextPanel: document.getElementById("context-panel"),
  contextEnabled: document.getElementById("context-enabled"),
  contextProject: document.getElementById("context-project"),
};

let providerData = {};
let currentProviders = {};
let activeMode = "normal"; // normal, selection, compare, multipage
let currentTabId = null;
let selectedText = "";

// Find any existing Argus extension tab and navigate it, or create one
async function findArgusTab() {
  const extOrigin = browser.runtime.getURL("");
  const all = await browser.tabs.query({ url: extOrigin + "*" });
  return all.length > 0 ? all[0] : null;
}

async function navigateArgusTab(fullUrl) {
  const existing = await findArgusTab();
  if (existing) {
    await browser.tabs.update(existing.id, { active: true, url: fullUrl });
    await browser.windows.update(existing.windowId, { focused: true });
  } else {
    await browser.tabs.create({ url: fullUrl });
  }
  window.close();
}

async function focusOrCreateConsole(hash) {
  if (!hash) {
    const { consoleEntryTab } = await browser.storage.local.get({ consoleEntryTab: "projects" });
    hash = consoleEntryTab;
  }
  const consoleUrl = browser.runtime.getURL("options/options.html");
  await navigateArgusTab(consoleUrl + (hash ? "#" + hash : ""));
}

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // ── Vault lock check ──
  try {
    const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
    if (vaultStatus && vaultStatus.enabled && !vaultStatus.unlocked) {
      await showPopupLockScreen(vaultStatus);
    }
  } catch (_) { /* vault unavailable — proceed */ }

  const provResp = await browser.runtime.sendMessage({ action: "getProviders" });
  if (provResp && provResp.success) {
    provResp.providers.forEach(p => { providerData[p.key] = p; });
  }

  await loadSettings();
  await populatePresets();
  await checkSelection();
  await initContextPanel();
  attachEventListeners();
  await loadBookmarkFolders();
  await checkPreviousAnalysis();
  await checkArchiveAvailability();
  await checkWaybackAvailability();
  await checkFeedAvailability();
  await checkMonitorBookmarkStatus();
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

  // Apply user's default preset
  const { defaultPreset } = await browser.storage.local.get({ defaultPreset: "summary" });
  if (defaultPreset && elements.analysisType.querySelector(`option[value="${defaultPreset}"]`)) {
    elements.analysisType.value = defaultPreset;
  }
}

async function checkSelection() {
  // Always get the current tab ID, even if selection extraction fails (e.g., on PDF pages)
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) currentTabId = tabs[0].id;
  } catch { /* fallback below */ }

  const resp = await browser.runtime.sendMessage({ action: "getSelection" });
  if (resp && resp.success && resp.selection && resp.selection.trim().length > 5) {
    selectedText = resp.selection;
    currentTabId = resp.tabId || currentTabId;
    elements.selectionTextPreview.textContent = `Selected: "${selectedText.substring(0, 80)}${selectedText.length > 80 ? "..." : ""}"`;
    setMode("selection");
  } else if (resp?.tabId) {
    currentTabId = resp.tabId;
  }
}

async function initContextPanel() {
  try {
    const [resp, defResp] = await Promise.all([
      browser.runtime.sendMessage({ action: "getProjects" }),
      browser.runtime.sendMessage({ action: "getDefaultProject" })
    ]);
    if (!resp || !resp.success || !resp.projects.length) return;
    const defaultId = defResp?.defaultProjectId || null;

    // Populate project dropdown
    elements.contextProject.replaceChildren();
    for (const proj of resp.projects) {
      const opt = document.createElement("option");
      opt.value = proj.id;
      opt.textContent = proj.name + (proj.id === defaultId ? " (default)" : "");
      elements.contextProject.appendChild(opt);
    }

    // Restore saved project selection, fall back to default, always start unchecked
    const { contextualMode } = await browser.storage.local.get({ contextualMode: { enabled: false, projectId: null } });
    elements.contextEnabled.checked = false;
    const savedId = contextualMode.projectId || defaultId;
    if (savedId && elements.contextProject.querySelector(`option[value="${savedId}"]`)) {
      elements.contextProject.value = savedId;
    }

    // Toggle project dropdown visibility based on checkbox
    const updateProjectVisibility = () => {
      elements.contextProject.classList.toggle("hidden", !elements.contextEnabled.checked);
    };
    updateProjectVisibility();

    // Persist on change
    const saveState = () => {
      updateProjectVisibility();
      browser.storage.local.set({
        contextualMode: { enabled: elements.contextEnabled.checked, projectId: elements.contextProject.value }
      });
    };
    elements.contextEnabled.addEventListener("change", saveState);
    elements.contextProject.addEventListener("change", saveState);

    // Show context toggle (projects exist)
    elements.contextPanel.classList.remove("hidden");
  } catch { /* no projects or error — panel stays hidden */ }
}

async function loadBookmarkFolders() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getBookmarkFolders" });
    if (!resp || !resp.success || !resp.folders || !resp.folders.length) return;
    const select = elements.defaultBookmarkFolder;
    // Keep the "Unsorted" default option
    while (select.options.length > 1) select.remove(1);
    for (const folder of resp.folders) {
      const opt = document.createElement("option");
      opt.value = folder.id;
      opt.textContent = "\uD83D\uDCC1 " + folder.name;
      select.appendChild(opt);
    }
    // Restore saved default
    const { defaultBookmarkFolderId } = await browser.storage.local.get({ defaultBookmarkFolderId: "" });
    if (defaultBookmarkFolderId) select.value = defaultBookmarkFolderId;
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

    prevEl.textContent = '';
    const dot = document.createElement("span");
    dot.className = "prev-dot";
    const info = document.createElement("span");
    info.textContent = `Previously analyzed${count > 1 ? ` (${count}x)` : ""} — ${presetLabel} ${timeAgo}`;
    const viewLink = document.createElement("a");
    viewLink.id = "prev-view-link";
    viewLink.textContent = "View";
    prevEl.appendChild(dot);
    prevEl.appendChild(info);
    prevEl.appendChild(viewLink);
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
      navigateArgusTab(browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`));
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
    archiveEl.textContent = "";
    const aDot = document.createElement("span");
    aDot.className = "archive-dot";
    const aText = document.createElement("span");
    aText.textContent = "Archived version available";
    const aLink = document.createElement("a");
    aLink.id = "archive-view-link";
    aLink.textContent = "View";
    aLink.addEventListener("click", () => {
      browser.tabs.create({ url: resp.archiveUrl });
      window.close();
    });
    archiveEl.append(aDot, aText, aLink);
    archiveEl.classList.remove("hidden");
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
    wbEl.textContent = "";
    const wDot = document.createElement("span");
    wDot.className = "archive-dot";
    wDot.style.background = "#ffb74d";
    const wText = document.createElement("span");
    wText.textContent = "Wayback Machine snapshot available";
    const wLink = document.createElement("a");
    wLink.id = "wayback-view-link";
    wLink.textContent = "View";
    wLink.addEventListener("click", () => {
      browser.tabs.create({ url: resp.waybackUrl });
      window.close();
    });
    wbEl.append(wDot, wText, wLink);
    wbEl.classList.remove("hidden");
  } catch { /* ignore */ }
}

async function checkFeedAvailability() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;

    const resp = await browser.runtime.sendMessage({ action: "getFeedDetection", tabId: tab.id });

    const feedEl = document.getElementById("feed-detected");
    const osintFeedBtn = document.getElementById("osint-subscribe");

    // All detected feeds are already subscribed — show quiet "subscribed" state
    if (resp?.allSubscribed) {
      feedEl.textContent = "";
      const dot = document.createElement("span");
      dot.className = "archive-dot";
      dot.style.background = "#4caf50";
      const text = document.createElement("span");
      text.textContent = "RSS feed subscribed";
      text.style.opacity = "0.7";
      feedEl.append(dot, text);
      feedEl.classList.remove("hidden");
      // Show button in subscribed state (no pulse)
      if (osintFeedBtn) {
        osintFeedBtn.classList.remove("hidden");
        osintFeedBtn.classList.add("feed-subscribed");
        osintFeedBtn.title = "Already subscribed to this feed";
        osintFeedBtn.querySelector("span").textContent = "✓";
      }
      return;
    }

    if (!resp?.feeds?.length) return;

    const feeds = resp.feeds;
    feedEl.textContent = "";
    const dot = document.createElement("span");
    dot.className = "archive-dot";
    dot.style.background = "#ff9800";

    const text = document.createElement("span");

    if (feeds.length === 1) {
      // Single feed — show quick subscribe
      text.textContent = `RSS feed available${feeds[0].title ? ": " + feeds[0].title : ""}`;

      const subBtn = document.createElement("a");
      subBtn.textContent = "Subscribe";
      subBtn.style.cursor = "pointer";
      subBtn.addEventListener("click", async () => {
        const subResp = await browser.runtime.sendMessage({ action: "addFeed", url: feeds[0].url, intervalMinutes: 60 });
        if (subResp?.success) {
          subBtn.textContent = "Subscribed!";
          subBtn.style.color = "#4caf50";
          subBtn.style.pointerEvents = "none";
          if (osintFeedBtn) {
            osintFeedBtn.classList.add("feed-subscribed");
            osintFeedBtn.querySelector("span").textContent = "✓";
          }
        } else {
          subBtn.textContent = subResp?.error || "Failed";
          subBtn.style.color = "#f44336";
        }
      });

      feedEl.append(dot, text, subBtn);

      // Header button — quick subscribe for single feed
      if (osintFeedBtn) {
        osintFeedBtn.classList.remove("hidden");
        osintFeedBtn._feedUrl = feeds[0].url;
      }
    } else {
      // Multiple feeds — show count + link to Feeds tab with picker
      text.textContent = `${feeds.length} RSS feeds found`;

      const viewBtn = document.createElement("a");
      viewBtn.textContent = "View all";
      viewBtn.style.cursor = "pointer";
      viewBtn.addEventListener("click", async () => {
        // Store detected feeds so console can show picker
        await browser.storage.local.set({ _detectedFeeds: feeds });
        focusOrCreateConsole("feeds");
      });

      feedEl.append(dot, text, viewBtn);

      // Header button — opens feeds tab with picker
      if (osintFeedBtn) {
        osintFeedBtn.classList.remove("hidden");
        osintFeedBtn._feedUrl = null;
        osintFeedBtn.title = `${feeds.length} RSS feeds found — click to view`;
        osintFeedBtn._multiFeeds = feeds;
      }
    }

    feedEl.classList.remove("hidden");
  } catch (e) { console.error("[Feed-Popup] checkFeedAvailability error:", e); }
}

async function checkMonitorBookmarkStatus() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;
    const url = tab.url;

    // Check monitors
    const monResp = await browser.runtime.sendMessage({ action: "getMonitors" });
    if (monResp?.success && monResp.monitors.some(m => m.url === url)) {
      elements.monitorBtn.classList.add("btn-active-indicator");
      elements.monitorBtn.title = "Already monitoring this page";
      const svg = elements.monitorBtn.querySelector("svg");
      if (svg) svg.setAttribute("fill", "currentColor");
    }

    // Check bookmarks
    const bmResp = await browser.runtime.sendMessage({ action: "getBookmarks" });
    if (bmResp?.success && bmResp.bookmarks.some(b => b.url === url)) {
      elements.bookmarkBtn.classList.add("btn-active-indicator");
      elements.bookmarkBtn.title = "Already bookmarked";
      const svg = elements.bookmarkBtn.querySelector("svg");
      if (svg) svg.setAttribute("fill", "currentColor");
    }
  } catch (e) { /* ignore */ }
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
    normal: "Analyze It",
    selection: "Analyze Selection",
    compare: "Compare Providers",
    multipage: "Analyze Tabs"
  };
  elements.btnText.textContent = texts[mode] || "Analyze It";

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
    const hasAnyKey = Object.values(currentProviders).some(p => p.apiKey);
    if (hasAnyKey) {
      // Toggle quick nav panel, ensure settings panel hidden
      elements.settingsPanel.classList.add("hidden");
      elements.quickNavPanel.classList.toggle("hidden");
    } else {
      // Toggle API setup panel, ensure quick nav hidden
      elements.quickNavPanel.classList.add("hidden");
      elements.settingsPanel.classList.toggle("hidden");
    }
  });

  // Quick nav buttons → open console at specific tab (skip wipe button)
  document.querySelectorAll(".quick-nav-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      focusOrCreateConsole(btn.dataset.tab);
    });
  });

  // Wipe Everything button + modal
  const wipeModal = document.getElementById("wipe-modal");
  document.getElementById("quick-wipe-btn").addEventListener("click", () => {
    wipeModal.classList.remove("hidden");
  });
  document.getElementById("wipe-cancel").addEventListener("click", () => {
    wipeModal.classList.add("hidden");
  });
  document.getElementById("wipe-confirm").addEventListener("click", async () => {
    const btn = document.getElementById("wipe-confirm");
    btn.disabled = true;
    btn.textContent = "Wiping...";
    try {
      await browser.runtime.sendMessage({ action: "wipeEverything" });
      btn.textContent = "Done. Opening extension manager...";
      setTimeout(() => {
        browser.tabs.create({ url: "about:addons" });
        window.close();
      }, 1500);
    } catch (e) {
      btn.textContent = "Failed: " + e.message;
      btn.disabled = false;
    }
  });

  const ARGUS_HELP_URL = "https://github.com/n3r4-life/argus360#readme";
  const ARGUS_HELP_BASE = "https://github.com/n3r4-life/argus360";

  document.getElementById("help-get-key").addEventListener("click", (e) => {
    e.preventDefault();
    browser.tabs.create({ url: ARGUS_HELP_BASE + "#quick-start" });
  });

  document.getElementById("quick-nav-help").addEventListener("click", () => {
    browser.tabs.create({ url: ARGUS_HELP_URL });
  });

  // App icon button handlers — navigate the single Argus tab
  async function focusOrCreatePage(urlPath) {
    const fullUrl = browser.runtime.getURL(urlPath);
    await navigateArgusTab(fullUrl);
  }

  document.getElementById("open-projects").addEventListener("click", () => focusOrCreateConsole("projects"));
  document.getElementById("open-feeds").addEventListener("click", () => focusOrCreatePage("feeds/feeds.html"));
  document.getElementById("open-chat").addEventListener("click", () => focusOrCreatePage("chat/chat.html"));
  document.getElementById("open-workbench").addEventListener("click", () => focusOrCreatePage("workbench/workbench.html"));
  document.getElementById("open-draft").addEventListener("click", () => focusOrCreatePage("reporting/reporting.html"));
  document.getElementById("open-images").addEventListener("click", () => focusOrCreatePage("osint/images.html"));
  document.getElementById("open-terminal").addEventListener("click", () => focusOrCreatePage("ssh/ssh.html"));

  // ── Popup app icons: show only 4 user-chosen, ordered by appTabOrder ──
  const POPUP_DEFAULT_VISIBLE = ["app-projects", "app-reader", "app-reports", "app-chat"];
  const POPUP_MAX_VISIBLE = 4;

  const popupAppContainer = document.getElementById("popup-app-icons");
  const allAppBtns = [...popupAppContainer.querySelectorAll("[data-app-tab]")];
  const appBtnMap = {};
  for (const btn of allAppBtns) appBtnMap[btn.dataset.appTab] = btn;

  async function applyPopupAppVisibility() {
    const stored = await browser.storage.local.get(["popupVisibleApps", "appTabOrder"]);
    const visible = Array.isArray(stored.popupVisibleApps) && stored.popupVisibleApps.length > 0
      ? stored.popupVisibleApps : POPUP_DEFAULT_VISIBLE;
    const order = Array.isArray(stored.appTabOrder) && stored.appTabOrder.length > 0
      ? stored.appTabOrder : null;

    // Build ordered list: visible apps sorted by appTabOrder position
    const visibleSet = new Set(visible);
    let ordered;
    if (order) {
      ordered = order.filter(id => visibleSet.has(id) && appBtnMap[id]);
      // Append any visible apps not in saved order
      for (const id of visible) {
        if (!ordered.includes(id) && appBtnMap[id]) ordered.push(id);
      }
    } else {
      ordered = visible.filter(id => appBtnMap[id]);
    }

    // Hide all, then show + reorder the chosen ones
    for (const btn of allAppBtns) btn.style.display = "none";
    for (const id of ordered) {
      appBtnMap[id].style.display = "";
      popupAppContainer.appendChild(appBtnMap[id]);
    }
  }

  applyPopupAppVisibility();

  // Console Home button — click navigates, long-press opens picker
  const consoleHomeBtn = document.getElementById("popup-console-home");
  const pickerOverlay = document.getElementById("popup-icon-picker");
  let longPressTimer = null;
  let longPressFired = false;

  consoleHomeBtn.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    longPressFired = false;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      longPressFired = true;
      openIconPicker();
    }, 1000);
  });
  consoleHomeBtn.addEventListener("mouseup", () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
  consoleHomeBtn.addEventListener("mouseleave", () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
  consoleHomeBtn.addEventListener("click", () => {
    if (longPressFired) { longPressFired = false; return; } // swallow click after long-press
    focusOrCreateConsole();
  });

  // ── App icon picker ──
  // State: null = browsing, "removing" = user deselected one and can now pick a replacement
  let pickerMode = null;
  let pickerCurrentVisible = [];

  function openIconPicker() {
    if (!pickerOverlay.classList.contains("hidden")) { closeIconPicker(); return; }
    pickerMode = null;
    renderIconPicker();
    pickerOverlay.classList.remove("hidden");
  }

  function closeIconPicker() {
    pickerOverlay.classList.add("hidden");
    pickerOverlay.innerHTML = "";
    pickerMode = null;
  }

  async function renderIconPicker() {
    const stored = await browser.storage.local.get(["popupVisibleApps", "appTabOrder"]);
    pickerCurrentVisible = Array.isArray(stored.popupVisibleApps) && stored.popupVisibleApps.length > 0
      ? [...stored.popupVisibleApps] : [...POPUP_DEFAULT_VISIBLE];
    const order = Array.isArray(stored.appTabOrder) && stored.appTabOrder.length > 0
      ? stored.appTabOrder : null;

    const allIds = order
      ? [...order.filter(id => appBtnMap[id]), ...allAppBtns.map(b => b.dataset.appTab).filter(id => !order.includes(id))]
      : allAppBtns.map(b => b.dataset.appTab);

    const visibleSet = new Set(pickerCurrentVisible);
    const isFull = pickerCurrentVisible.length >= POPUP_MAX_VISIBLE;

    pickerOverlay.innerHTML = `
      <div class="popup-icon-picker-title">
        ${pickerMode === "removing" ? "Pick replacement" : "Choose shortcuts"}
        <span>${pickerCurrentVisible.length}/${POPUP_MAX_VISIBLE}</span>
      </div>
      <div class="popup-icon-picker-grid">
        ${allIds.map(id => {
          const btn = appBtnMap[id];
          if (!btn) return "";
          const isActive = visibleSet.has(id);
          const svg = btn.querySelector("svg").outerHTML;
          const label = btn.title || id.replace("app-", "");

          let cls = "popup-icon-picker-item";
          if (isActive) {
            cls += " picker-active";
          } else if (pickerMode === "removing") {
            cls += " picker-available";
          } else if (isFull) {
            cls += " picker-disabled";
          } else {
            cls += " picker-available";
          }
          return `<button class="${cls}" data-pick-id="${id}">${svg} ${label}</button>`;
        }).join("")}
      </div>`;

    attachPickerHandlers();
  }

  function attachPickerHandlers() {
    pickerOverlay.querySelectorAll(".popup-icon-picker-item").forEach(item => {
      item.addEventListener("click", async () => {
        const pickId = item.dataset.pickId;
        const isActive = item.classList.contains("picker-active");

        if (isActive) {
          // Deselect — grey it out, enter "removing" mode so user can pick replacement
          if (pickerCurrentVisible.length <= 1) return;
          pickerCurrentVisible = pickerCurrentVisible.filter(id => id !== pickId);
          pickerMode = "removing";
          await browser.storage.local.set({ popupVisibleApps: pickerCurrentVisible });
          applyPopupAppVisibility();
          renderIconPicker();
        } else if (item.classList.contains("picker-disabled")) {
          return; // full, can't add
        } else {
          // Select — add it, close picker
          if (pickerCurrentVisible.length >= POPUP_MAX_VISIBLE) return;
          pickerCurrentVisible.push(pickId);
          await browser.storage.local.set({ popupVisibleApps: pickerCurrentVisible });
          applyPopupAppVisibility();
          closeIconPicker();
        }
      });
    });
  }

  // Close picker on click outside
  document.addEventListener("click", (e) => {
    if (!pickerOverlay.classList.contains("hidden") &&
        !pickerOverlay.contains(e.target) &&
        !consoleHomeBtn.contains(e.target)) {
      closeIconPicker();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pickerOverlay.classList.contains("hidden")) {
      closeIconPicker();
    }
  });

  // Archive redirect toggle
  const redirectBtn = document.getElementById("toggle-redirect");
  (async () => {
    const { archiveRedirect } = await browser.storage.local.get({
      archiveRedirect: { enabled: false, domains: [], providerUrl: "https://archive.is/" }
    });
    let redirectEnabled = archiveRedirect.enabled;
    updateRedirectBtn(redirectBtn, redirectEnabled);

    redirectBtn.addEventListener("click", async () => {
      const newState = !redirectEnabled;
      if (newState) {
        const granted = await browser.permissions.request({
          permissions: ["webRequest", "webRequestBlocking"]
        });
        if (!granted) {
          showToast("Permission denied — redirect requires webRequest.", "error");
          return;
        }
      }
      const stored = await browser.storage.local.get({
        archiveRedirect: { enabled: false, domains: [], providerUrl: "https://archive.is/" }
      });
      stored.archiveRedirect.enabled = newState;
      await browser.storage.local.set({ archiveRedirect: stored.archiveRedirect });
      await browser.runtime.sendMessage({
        action: "saveArchiveSettings",
        enabled: newState,
        domains: stored.archiveRedirect.domains,
        providerUrl: stored.archiveRedirect.providerUrl
      });
      redirectEnabled = newState;
      updateRedirectBtn(redirectBtn, redirectEnabled);
      showToast(newState ? "Archive redirect ON" : "Archive redirect OFF");
    });
  })();

  document.getElementById("open-kg").addEventListener("click", () => focusOrCreatePage("osint/graph.html?mode=global"));
  document.getElementById("open-history").addEventListener("click", () => focusOrCreatePage("history/history.html"));

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

    const hasAnyKey = Object.values(currentProviders).some(p => p.apiKey);
    if (hasAnyKey) {
      // Hide settings panel, flash the Argus button to hint it's now a nav button
      elements.settingsPanel.classList.add("hidden");
      elements.settingsToggle.classList.add("btn-flash");
      setTimeout(() => elements.settingsToggle.classList.remove("btn-flash"), 4000);
    } else {
      elements.settingsStatus.textContent = "Settings saved.";
      elements.settingsStatus.style.color = "var(--success)";
      setTimeout(() => { elements.settingsStatus.textContent = ""; }, 2000);
    }
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

  // Default bookmark folder — save choice to storage
  elements.defaultBookmarkFolder.addEventListener("change", async () => {
    const folderId = elements.defaultBookmarkFolder.value;
    await browser.storage.local.set({ defaultBookmarkFolderId: folderId });
    const label = elements.defaultBookmarkFolder.options[elements.defaultBookmarkFolder.selectedIndex].textContent;
    showToast(`Default folder: ${label}`, "success");
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
      const folderId = elements.defaultBookmarkFolder.value || "";
      const response = await browser.runtime.sendMessage({
        action: "bookmarkPage",
        tabId: currentTabId,
        aiTag: true,
        folderId
      });
      if (response && response.success) {
        elements.bookmarkBtn.classList.remove("bookmark-btn-saving");
        const svg = elements.bookmarkBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", "currentColor");
        elements.bookmarkBtn.title = "Bookmarked!";
        showToast("Bookmarked with AI tags!", "success");
        // Navigate to bookmarks tab so user sees the new tile
        setTimeout(() => focusOrCreateConsole("bookmarks"), 800);
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
      navigateArgusTab(browser.runtime.getURL(`results/results.html?metadata=${encodeURIComponent(storeKey)}`));
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
        navigateArgusTab(browser.runtime.getURL(`results/results.html?whois=${encodeURIComponent(storeKey)}`));
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

  document.getElementById("osint-archive").addEventListener("click", async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url || url.startsWith("about:") || url.startsWith("moz-extension:")) { showToast("Cannot check this page.", "error"); return; }
    showToast("Checking archive.is...", "loading");
    const resp = await browser.runtime.sendMessage({ action: "checkArchiveNow", url });
    if (resp?.archiveUrl) {
      browser.tabs.create({ url: resp.archiveUrl });
      window.close();
    } else {
      showToast("No archived version found on archive.is", "error");
    }
  });

  document.getElementById("osint-wayback").addEventListener("click", async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url || url.startsWith("about:") || url.startsWith("moz-extension:")) { showToast("Cannot check this page.", "error"); return; }
    showToast("Checking Wayback Machine...", "loading");
    const resp = await browser.runtime.sendMessage({ action: "checkWaybackNow", url });
    if (resp?.waybackUrl) {
      browser.tabs.create({ url: resp.waybackUrl });
      window.close();
    } else {
      showToast("No Wayback Machine snapshot found", "error");
    }
  });

  // Down Detector / Pulse
  document.getElementById("osint-downdetector").addEventListener("click", async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const domain = (tab?.url && !tab.url.startsWith("about:") && !tab.url.startsWith("moz-extension:"))
      ? new URL(tab.url).hostname : "";
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : "";
    browser.tabs.create({ url: browser.runtime.getURL(`osint/downdetector.html${params}`) });
    window.close();
  });

  // Image Grabber
  document.getElementById("osint-images").addEventListener("click", async () => {
    showToast("Grabbing images...", "loading");
    const resp = await browser.runtime.sendMessage({ action: "extractImages", tabId: currentTabId });
    if (resp && resp.success) {
      const storeKey = `images-${Date.now()}`;
      await browser.storage.local.set({ [storeKey]: { pageUrl: resp.pageUrl, pageTitle: resp.pageTitle, images: resp.images, stats: resp.stats } });
      browser.tabs.create({ url: browser.runtime.getURL(`osint/images.html?id=${encodeURIComponent(storeKey)}`) });
      window.close();
    } else {
      showToast(resp?.error || "Failed to grab images.", "error");
    }
  });

  // Image Grabber — All Tabs
  document.getElementById("osint-images-all").addEventListener("click", async () => {
    showToast("Grabbing images from all tabs...", "loading");
    const resp = await browser.runtime.sendMessage({ action: "extractImagesMultiTab" });
    if (resp && resp.success) {
      const storeKey = `images-${Date.now()}`;
      await browser.storage.local.set({ [storeKey]: resp.data });
      browser.tabs.create({ url: browser.runtime.getURL(`osint/images.html?id=${encodeURIComponent(storeKey)}`) });
      window.close();
    } else {
      showToast(resp?.error || "Failed to grab images from tabs.", "error");
    }
  });

  // Screenshot — capture visible tab
  document.getElementById("osint-screenshot").addEventListener("click", async () => {
    showToast("Capturing screenshot...", "loading");
    try {
      const dataUrl = await browser.tabs.captureVisibleTab(null, { format: "png" });
      const a = document.createElement("a");
      a.href = dataUrl;
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const domain = tabs[0]?.url ? new URL(tabs[0].url).hostname.replace(/^www\./, "") : "page";
      a.download = `argus-screenshot-${domain}-${new Date().toISOString().slice(0,19).replace(/:/g, "-")}.png`;
      a.click();
      showToast("Screenshot saved!", "success");
    } catch (e) {
      showToast(e.message || "Screenshot failed", "error");
    }
  });

  // Regex Search — extract patterns from page source
  document.getElementById("osint-regex").addEventListener("click", async () => {
    showToast("Scanning page source...", "loading");
    try {
      const resp = await browser.runtime.sendMessage({ action: "regexScanPage", tabId: currentTabId });
      if (resp && resp.success) {
        const storeKey = `regex-${Date.now()}`;
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        // Store source separately so custom searches work after tab closes
        const { html, text, ...scanResults } = resp;
        const sourceKey = storeKey + "-source";
        await browser.storage.local.set({
          [storeKey]: { ...scanResults, pageUrl: tabs[0]?.url, pageTitle: tabs[0]?.title, sourceKey },
          [sourceKey]: { html, text }
        });
        navigateArgusTab(browser.runtime.getURL(`osint/regex.html?id=${encodeURIComponent(storeKey)}`));
      } else {
        showToast(resp?.error || "Regex scan failed.", "error");
      }
    } catch (e) {
      showToast(e.message || "Regex scan failed.", "error");
    }
  });

  // ── Quick Search bar ──────────────────────────────
  const SEARCH_ENGINES = {
    duckduckgo: "https://duckduckgo.com/?q=",
    startpage:  "https://www.startpage.com/do/dsearch?query=",
    brave:      "https://search.brave.com/search?q=",
    searx:      "https://searx.org/search?q=",
    mojeek:     "https://www.mojeek.com/search?q=",
    google:     "https://www.google.com/search?q=",
    dogpile:    "https://www.dogpile.com/serp?q=",
    yandex:     "https://yandex.com/search/?text=",
    bing:       "https://www.bing.com/search?q=",
  };

  let searchPromptPrefix = "";

  // Prompt chips
  document.querySelectorAll(".search-prompt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".search-prompt-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const tpl = chip.dataset.prompt;
      // Replace {domain} with current page domain
      searchPromptPrefix = tpl.replace(/\{domain\}/g, currentDomain || "");
      // Focus query input
      document.getElementById("search-query").focus();
    });
  });

  // Get current domain for template substitution
  let currentDomain = "";
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0]?.url) {
      try { currentDomain = new URL(tabs[0].url).hostname; } catch (e) {}
    }
  });

  function executeSearch() {
    const q = document.getElementById("search-query").value.trim();
    if (!q) return;
    const engine = document.getElementById("search-engine").value;
    const baseUrl = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
    const fullQuery = searchPromptPrefix + q;
    browser.tabs.create({ url: baseUrl + encodeURIComponent(fullQuery) });
    window.close();
  }

  document.getElementById("search-go").addEventListener("click", executeSearch);
  document.getElementById("search-query").addEventListener("keydown", (e) => {
    if (e.key === "Enter") executeSearch();
  });

  // Quick subscribe button (shown when feed detected)
  document.getElementById("osint-subscribe").addEventListener("click", async () => {
    const btn = document.getElementById("osint-subscribe");
    if (btn.classList.contains("feed-subscribed")) return;
    // Multi-feed mode — store feeds and open picker
    if (btn._multiFeeds) {
      browser.storage.local.set({ _detectedFeeds: btn._multiFeeds }).then(() => {
        focusOrCreateConsole("feeds");
      });
      return;
    }
    const feedUrl = btn._feedUrl;
    if (!feedUrl) return;
    btn.querySelector("span").textContent = "...";
    const resp = await browser.runtime.sendMessage({ action: "addFeed", url: feedUrl, intervalMinutes: 60 });
    if (resp?.success) {
      btn.querySelector("span").textContent = "✓";
      btn.classList.add("feed-subscribed");
      btn.title = "Already subscribed to this feed";
    } else {
      btn.querySelector("span").textContent = resp?.error?.includes("already") ? "✓" : "✗";
      if (resp?.error?.includes("already")) btn.classList.add("feed-subscribed");
      else btn.style.color = "#f44336";
      btn.style.animation = "none";
    }
  });
}

// ──────────────────────────────────────────────
// Redirect toggle helper
// ──────────────────────────────────────────────
function updateRedirectBtn(btn, enabled) {
  if (enabled) {
    btn.style.color = "var(--accent)";
    btn.style.background = "rgba(233, 69, 96, 0.15)";
    btn.title = "Archive Redirect: ON (click to disable)";
  } else {
    btn.style.color = "";
    btn.style.background = "";
    btn.title = "Archive Redirect: OFF (click to enable)";
  }
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

  // Project context injection
  if (elements.contextEnabled.checked && elements.contextProject.value) {
    message.contextualMode = true;
    message.projectId = elements.contextProject.value;
  }

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

// ── Popup vault lock screen ──
function showPopupLockScreen(status) {
  return new Promise((resolve) => {
    // Hide all content
    document.querySelectorAll("header, section, .prev-analysis, .archive-available, .toast").forEach(el => el.style.display = "none");

    const overlay = document.createElement("div");
    overlay.style.cssText = "padding:32px 20px;text-align:center;";

    const logo = document.createElement("img");
    logo.src = "../icons/icon-48.png";
    logo.style.cssText = "width:40px;height:40px;border-radius:8px;margin-bottom:12px;";
    overlay.appendChild(logo);

    const title = document.createElement("div");
    title.textContent = "Locked";
    title.style.cssText = "font-size:16px;font-weight:700;color:#e8e8e8;margin-bottom:4px;";
    overlay.appendChild(title);

    const sub = document.createElement("div");
    sub.textContent = status.type === "password" ? "Enter password" : "Enter PIN";
    sub.style.cssText = "font-size:12px;color:#6a6a80;margin-bottom:16px;";
    overlay.appendChild(sub);

    const errorEl = document.createElement("div");
    errorEl.style.cssText = "color:#ff5252;font-size:11px;min-height:14px;margin-top:8px;";

    let getValue;

    if (status.type === "password") {
      const pw = document.createElement("input");
      pw.type = "password";
      pw.placeholder = "Password";
      pw.className = "argus-lock-password";
      pw.style.cssText += "max-width:200px;font-size:13px;padding:8px 12px;";
      overlay.appendChild(pw);
      getValue = () => pw.value;
      pw.addEventListener("keydown", e => { if (e.key === "Enter") doUnlock(); });
      setTimeout(() => pw.focus(), 50);
    } else {
      const digits = status.type === "pin6" ? 6 : 4;
      const row = document.createElement("div");
      row.className = "argus-lock-pin-row";
      const inputs = [];
      for (let i = 0; i < digits; i++) {
        const inp = document.createElement("input");
        inp.type = "password";
        inp.inputMode = "numeric";
        inp.maxLength = 1;
        inp.className = "argus-lock-pin-digit";
        inp.style.cssText += "width:36px;height:42px;font-size:18px;";
        inp.addEventListener("input", () => {
          if (inp.value.length === 1) {
            inp.classList.add("filled");
            if (i < digits - 1) inputs[i + 1].focus();
            else doUnlock();
          }
        });
        inp.addEventListener("keydown", e => {
          if (e.key === "Backspace" && !inp.value && i > 0) {
            inputs[i - 1].focus();
            inputs[i - 1].value = "";
            inputs[i - 1].classList.remove("filled");
          }
        });
        inp.addEventListener("paste", (e) => {
          e.preventDefault();
          const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, digits);
          for (let j = 0; j < pasted.length; j++) {
            inputs[j].value = pasted[j];
            inputs[j].classList.add("filled");
          }
          if (pasted.length === digits) doUnlock();
        });
        inputs.push(inp);
        row.appendChild(inp);
      }
      overlay.appendChild(row);
      getValue = () => inputs.map(i => i.value).join("");
      setTimeout(() => inputs[0].focus(), 50);
    }

    const btn = document.createElement("button");
    btn.className = "argus-lock-btn";
    btn.textContent = "Unlock";
    btn.style.cssText += "font-size:12px;padding:8px 24px;";
    btn.addEventListener("click", doUnlock);
    overlay.appendChild(btn);
    overlay.appendChild(errorEl);

    document.body.appendChild(overlay);

    async function doUnlock() {
      const passcode = getValue();
      if (!passcode) return;
      btn.disabled = true;
      errorEl.textContent = "";
      try {
        const result = await browser.runtime.sendMessage({ action: "vaultUnlock", passcode });
        if (result.success) {
          overlay.remove();
          document.querySelectorAll("header, section, .prev-analysis, .archive-available, .toast").forEach(el => el.style.display = "");
          resolve();
        } else {
          errorEl.textContent = result.error || "Incorrect";
          overlay.querySelectorAll(".argus-lock-pin-digit, .argus-lock-password").forEach(i => {
            i.classList.add("error");
            setTimeout(() => i.classList.remove("error"), 500);
          });
          if (status.type !== "password") {
            overlay.querySelectorAll(".argus-lock-pin-digit").forEach(i => { i.value = ""; i.classList.remove("filled"); });
          }
        }
      } catch (e) { errorEl.textContent = e.message; }
      btn.disabled = false;
    }
  });
}
