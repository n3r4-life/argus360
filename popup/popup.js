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
  analyzeMode: document.getElementById("analyze-mode"),
  comparePanel: document.getElementById("compare-panel"),
  multipagePanel: document.getElementById("multipage-panel"),
  tabList: document.getElementById("tab-list"),
  selectionInfo: document.getElementById("selection-info"),
  selectionTextPreview: document.getElementById("selection-text-preview"),
  monitorBtn: document.getElementById("monitor-btn"),
  monitorProject: document.getElementById("monitor-project"),
  defaultBookmarkFolder: document.getElementById("default-bookmark-folder"),
  bookmarkBtn: document.getElementById("bookmark-btn"),
  bookmarkProject: document.getElementById("bookmark-project"),
  contextPanel: document.getElementById("context-panel"),
  contextEnabled: document.getElementById("context-enabled"),
  contextProject: document.getElementById("context-project"),
};

let providerData = {};
let currentProviders = {};
let activeMode = "normal"; // normal, selection, compare, multipage
// Project cascade: popup dropdown > per-feature override > global default > none
let defaultProjectId = null;
let monitorOverrideProjectId = null;
let bookmarkOverrideProjectId = null;
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

  // ── Theme toggle ──
  initThemeToggle();

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
  await checkTrackingStatus();
  await initTrawlBadge();
  await initIncognitoBar();
  await initReaderMode();
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

  // Store default for the analysis provider dropdown
  elements.analysisProvider.dataset.defaultProvider = settings.defaultProvider;
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
  const sel = elements.analysisProvider;
  const defaultProvider = sel.dataset.defaultProvider || "xai";
  const providerLabels = { xai: "Grok", openai: "OpenAI", anthropic: "Claude", gemini: "Gemini", custom: "Custom" };

  sel.replaceChildren();
  for (const [key, label] of Object.entries(providerLabels)) {
    const opt = document.createElement("option");
    opt.value = key;
    const hasKey = !!currentProviders[key]?.apiKey;
    const isDefault = key === defaultProvider;
    let text = label;
    if (hasKey) text += " ✓";
    if (isDefault) text += " ★";
    opt.textContent = text;
    sel.appendChild(opt);
  }
  // Pre-select the default provider
  sel.value = defaultProvider;
}

async function populatePresets() {
  const response = await browser.runtime.sendMessage({ action: "getPresets" });
  const { defaultPreset } = await browser.storage.local.get({ defaultPreset: "summary" });

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
      if (preset.key === defaultPreset) label += " ★";
      option.textContent = label;
      elements.analysisType.appendChild(option);
    });
  }
  const customOpt = document.createElement("option");
  customOpt.value = "custom";
  let customLabel = "Custom Prompt...";
  if (defaultPreset === "custom") customLabel += " ★";
  customOpt.textContent = customLabel;
  elements.analysisType.appendChild(customOpt);

  // Apply user's default preset
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

    // Store global default and load per-feature overrides
    defaultProjectId = defaultId;
    const overrides = await browser.storage.local.get({ monitorDefaultProjectId: null, bookmarkDefaultProjectId: null });
    monitorOverrideProjectId = overrides.monitorDefaultProjectId || null;
    bookmarkOverrideProjectId = overrides.bookmarkDefaultProjectId || null;

    const projects = resp.projects;

    // Helper: populate a project <select> with dual-star indicators
    // ★ gold = global default, ✦ grey = per-feature override
    function populateProjectSelect(sel, overrideId) {
      if (!sel) return;
      sel.replaceChildren();
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "No project";
      sel.appendChild(none);
      for (const proj of projects) {
        const opt = document.createElement("option");
        opt.value = proj.id;
        let label = proj.name;
        if (proj.id === defaultId) label += " ★";       // gold star = global default
        if (proj.id === overrideId) label += " ✦";       // grey star = override
        opt.textContent = label;
        sel.appendChild(opt);
      }
      // Pre-select: override > global default > none
      sel.value = overrideId || defaultId || "";
      // Blue border if override is active
      sel.classList.toggle("override-active", !!overrideId);
      if (overrideId) sel.title = "Per-feature override active (set in console settings)";
    }

    // Monitor project dropdown
    populateProjectSelect(elements.monitorProject, monitorOverrideProjectId);

    // Bookmark project dropdown
    populateProjectSelect(elements.bookmarkProject, bookmarkOverrideProjectId);

    // Populate context project dropdown
    elements.contextProject.replaceChildren();
    for (const proj of projects) {
      const opt = document.createElement("option");
      opt.value = proj.id;
      opt.textContent = proj.name + (proj.id === defaultId ? " ★" : "");
      elements.contextProject.appendChild(opt);
    }

    // Restore saved project selection, fall back to default, always start unchecked
    const { contextualMode } = await browser.storage.local.get({ contextualMode: { enabled: false, projectId: null } });
    elements.contextEnabled.checked = false;
    const savedId = contextualMode.projectId || defaultId;
    if (savedId && elements.contextProject.querySelector(`option[value="${savedId}"]`)) {
      elements.contextProject.value = savedId;
    }

    // Enable/disable context project dropdown based on APC toggle
    const updateContextState = () => {
      elements.contextProject.disabled = !elements.contextEnabled.checked;
    };
    updateContextState();

    // Persist on change
    const saveState = () => {
      updateContextState();
      browser.storage.local.set({
        contextualMode: { enabled: elements.contextEnabled.checked, projectId: elements.contextProject.value }
      });
    };
    elements.contextEnabled.addEventListener("change", saveState);
    elements.contextProject.addEventListener("change", saveState);

    // Show APC pill (projects exist)
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
        osintFeedBtn._feedTitle = feeds[0].title || "";
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

    // Check monitors — if already monitored, light up wrap and show its project
    const monResp = await browser.runtime.sendMessage({ action: "getMonitors" });
    if (monResp?.success) {
      const match = monResp.monitors.find(m => m.url === url);
      if (match) {
        const wrap = elements.monitorBtn.closest(".monitor-btn-wrap");
        if (wrap) wrap.classList.add("wrap-active");
        elements.monitorBtn.title = "Already monitoring this page";
        const svg = elements.monitorBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", "currentColor");
        // Show the project this monitor is attached to
        if (match.projectId && elements.monitorProject) {
          elements.monitorProject.value = match.projectId;
        }
      }
    }

    // Check bookmarks — if already bookmarked, light up wrap and show its project + folder
    const bmResp = await browser.runtime.sendMessage({ action: "getBookmarks" });
    if (bmResp?.success) {
      const match = bmResp.bookmarks.find(b => b.url === url);
      if (match) {
        const wrap = elements.bookmarkBtn.closest(".bookmark-btn-wrap");
        if (wrap) wrap.classList.add("wrap-active");
        elements.bookmarkBtn.title = "Already bookmarked";
        const svg = elements.bookmarkBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", "currentColor");
        // Show the folder this bookmark is filed in
        if (match.folderId && elements.defaultBookmarkFolder) {
          elements.defaultBookmarkFolder.value = match.folderId;
        }
        // Show the project this bookmark is attached to
        if (match.projectId && elements.bookmarkProject) {
          elements.bookmarkProject.value = match.projectId;
        }
      }
    }
  } catch (e) { /* ignore */ }
}

// ──────────────────────────────────────────────
// Short / long press helper
// ──────────────────────────────────────────────
function addShortLongPress(el, onShort, onLong, delay = 900) {
  let timer = null;
  let fired = false;
  const start = () => { fired = false; timer = setTimeout(() => { fired = true; onLong(); }, delay); };
  const end = (e) => {
    clearTimeout(timer);
    timer = null;
    if (!fired) { e.preventDefault(); onShort(); }
  };
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener("mousedown", start);
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("mouseup", end);
  el.addEventListener("touchend", end);
  el.addEventListener("mouseleave", cancel);
  el.addEventListener("touchcancel", cancel);
}

async function checkTrackingStatus() {
  try {
    const { trackMyPages } = await browser.storage.local.get({ trackMyPages: false });
    const badge = document.getElementById("tracking-badge");
    if (!badge) return;
    badge.classList.remove("hidden");
    if (trackMyPages) badge.classList.add("status-track-on");

    const openSettings = () => {
      browser.tabs.create({ url: browser.runtime.getURL("settings/settings.html") });
    };
    const toggleTracker = async () => {
      const cur = await browser.storage.local.get({ trackMyPages: false });
      const newState = !cur.trackMyPages;
      await browser.storage.local.set({ trackMyPages: newState });
      badge.classList.toggle("status-track-on", newState);
      showToast(newState ? "Page tracking enabled" : "Page tracking disabled", newState ? "success" : "loading");
    };
    addShortLongPress(badge, toggleTracker, openSettings);
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// Trawl Net badge — short press = start timer / toggle, long press = settings
// ──────────────────────────────────────────────
async function initTrawlBadge() {
  try {
    const s = await browser.storage.local.get({ trawlEnabled: false, trawlExpireAt: null });
    const badge = document.getElementById("trawl-badge");
    if (!badge) return;
    badge.classList.remove("hidden");
    if (s.trawlEnabled) badge.classList.add("status-trawl-on");

    // Show remaining time if a timer is active
    if (s.trawlExpireAt && s.trawlEnabled) {
      const remainMins = Math.ceil((s.trawlExpireAt - Date.now()) / 60000);
      if (remainMins > 0) {
        const span = badge.querySelector("span");
        if (span) span.textContent = "Trawl " + remainMins + "m";
      }
    }

    const openSettings = () => {
      browser.tabs.create({ url: browser.runtime.getURL("trawl/trawl.html") });
    };

    const toggleTrawl = async () => {
      const cur = await browser.storage.local.get({ trawlEnabled: false, trackMyPages: false, trawlDurationEnabled: false, trawlDurationMinutes: 30, trawlExpireAt: null });
      const newState = !cur.trawlEnabled;

      if (newState) {
        if (cur.trawlDurationEnabled) {
          // Start duration timer via background
          await browser.runtime.sendMessage({ action: "startTrawlTimer", minutes: cur.trawlDurationMinutes });
          badge.classList.add("status-trawl-on");
          const remainMins = cur.trawlDurationMinutes;
          const span = badge.querySelector("span");
          if (span) span.textContent = "Trawl " + remainMins + "m";
          showToast("Trawl started — " + remainMins + " min timer", "success");
        } else {
          // Normal toggle on
          if (!cur.trackMyPages) {
            await browser.storage.local.set({ trawlEnabled: true, trackMyPages: true });
            const trackBadge = document.getElementById("tracking-badge");
            if (trackBadge) { trackBadge.classList.remove("hidden"); trackBadge.classList.add("status-track-on"); }
          } else {
            await browser.storage.local.set({ trawlEnabled: true });
          }
          badge.classList.add("status-trawl-on");
          showToast("Trawl Net enabled — collecting passively", "success");
        }
      } else {
        // Turn off — also clear any running timer
        await browser.runtime.sendMessage({ action: "stopTrawlTimer" });
        badge.classList.remove("status-trawl-on");
        const span = badge.querySelector("span");
        if (span) span.textContent = "Trawl";
        showToast("Trawl Net disabled", "loading");
      }
    };

    addShortLongPress(badge, toggleTrawl, openSettings);
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// Reader Mode — overlay approach (robust across all page layouts)
// ──────────────────────────────────────────────
const READER_OVERLAY_ID = "__argus_reader_overlay__";

// Injected into the page to mount the reader overlay.
// Uses a polling loop so SPAs (Twitter/X, Reddit, etc.) work even when
// content renders after status:complete fires.
const READER_MOUNT_FN = function () {
  if (document.getElementById("__argus_reader_overlay__")) return;

  const CANDIDATES = [
    "article", "[role='article']", "main", "[role='main']",
    ".post-content", ".entry-content", ".article-body", ".article-content",
    ".story-body", ".story-content", ".content-body", ".page-content",
    "#article-body", "#article-content", "#post-content", "#main-content",
    ".post", "#post", ".entry", "#entry", "#content", ".content", "#main", "main"
  ];
  const STRIP_TAGS = [
    "script", "style", "noscript", "iframe", "form",
    "nav", "header", "footer", "aside", "button",
    "[class*='ad-']", "[class*='-ad']", "[id*='cookie']", "[class*='cookie']",
    "[class*='subscribe']", "[class*='newsletter']", "[class*='popup']",
    "[class*='modal']", "[class*='sidebar']", "[class*='related']",
    "[class*='recommended']", "[class*='share']", "[class*='social']"
  ];

  function findBest() {
    let best = null, bestLen = 0;
    for (const sel of CANDIDATES) {
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.innerText || "";
        if (txt.length > bestLen) { best = el; bestLen = txt.length; }
      } catch {}
    }
    return { best, bestLen };
  }

  function buildOverlay(best) {
    const overlay = document.createElement("div");
    overlay.id = "__argus_reader_overlay__";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;overflow-y:auto;background:#fafaf8;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.75;padding:48px 24px 80px";
    const col = document.createElement("div");
    col.style.cssText = "max-width:680px;margin:0 auto;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715 Exit Reader";
    closeBtn.style.cssText = "position:fixed;top:12px;right:16px;z-index:2147483648;padding:5px 12px;background:#e94560;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:sans-serif;font-size:12px;font-weight:600";
    closeBtn.addEventListener("click", () => { overlay.remove(); closeBtn.remove(); });
    const clone = best.cloneNode(true);
    for (const sel of STRIP_TAGS) { try { clone.querySelectorAll(sel).forEach(e => e.remove()); } catch {} }
    clone.style.cssText = "all:unset;display:block;";
    clone.querySelectorAll("*").forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag === "a") { el.style.cssText = "color:#1a56db"; }
      else if (tag === "img") { el.style.cssText = "max-width:100%;height:auto;display:block;margin:1em 0"; }
      else if (/^h[1-6]$/.test(tag)) {
        el.style.cssText = "display:block;font-weight:bold;margin:1.2em 0 0.4em;line-height:1.3;color:#111";
        el.style.fontSize = { h1:"2em", h2:"1.5em", h3:"1.2em", h4:"1em", h5:"0.9em", h6:"0.85em" }[tag] || "1em";
      } else if (tag === "p") { el.style.cssText = "display:block;margin:0 0 1em"; }
      else if (tag === "blockquote") { el.style.cssText = "display:block;border-left:3px solid #ccc;padding-left:1em;color:#555;font-style:italic;margin:1em 0"; }
      else if (tag === "pre" || tag === "code") { el.style.cssText = "font-family:monospace;background:#f0f0f0;color:#333;padding:2px 5px;border-radius:3px"; }
      else if (tag === "ul" || tag === "ol") { el.style.cssText = "display:block;margin:0 0 1em;padding-left:1.6em"; }
      else if (tag === "li") { el.style.cssText = "display:list-item;margin-bottom:0.25em"; }
    });
    col.appendChild(clone);
    overlay.appendChild(col);
    document.body.appendChild(overlay);
    document.body.appendChild(closeBtn);
  }

  // Poll until real content is rendered (handles SPAs like Twitter/X, Reddit)
  // Max 25 attempts × 400ms = 10 seconds
  function tryMount(attempt) {
    if (document.getElementById("__argus_reader_overlay__")) return;
    if (attempt > 25) return;
    const { best, bestLen } = findBest();
    // Require ≥500 chars to consider content ready; fall back to body only after 12 attempts (~5s)
    if (bestLen >= 500) {
      buildOverlay(best);
    } else if (attempt >= 12 && document.body && (document.body.innerText || "").length > 100) {
      buildOverlay(document.body);
    } else {
      setTimeout(tryMount, 400, attempt + 1);
    }
  }

  tryMount(0);
};

// Injected into the page to remove the reader overlay
const READER_UNMOUNT_FN = function () {
  const overlay = document.getElementById("__argus_reader_overlay__");
  if (overlay) {
    if (overlay._closeBtn) overlay._closeBtn.remove();
    overlay.remove();
  }
};

const READER_SKIP_RE = /^(about:|moz-extension:|chrome:|chrome-extension:|file:)/;

async function initReaderMode() {
  const btn = document.getElementById("reader-mode-btn");
  if (!btn) return;

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  let currentDomain = "";
  if (tab?.url && !READER_SKIP_RE.test(tab.url)) {
    try { currentDomain = new URL(tab.url).hostname.replace(/^www\./, ""); } catch {}
  }

  const { readerModeGlobal, readerSites = [] } = await browser.storage.local.get({ readerModeGlobal: false, readerSites: [] });
  const domainLearned = currentDomain && readerSites.some(d => currentDomain === d || currentDomain.endsWith("." + d));

  if (readerModeGlobal) {
    btn.classList.add("reader-active");
    btn.title = "Reader Mode ON (all tabs) \u2014 click to disable";
  } else if (domainLearned) {
    // Domain is on the learned list — show the pill as active (page will already have the overlay from bg auto-inject)
    btn.classList.add("reader-active", "reader-learned");
    btn.title = "Reader Mode auto-on for " + currentDomain + " \u2014 click to disable for this site";
    const span = btn.querySelector("span");
    if (span) span.textContent = "Reader \u2605";
  }

  btn.addEventListener("click", async () => {
    const isActive = btn.classList.contains("reader-active");
    const mountCode = "(" + READER_MOUNT_FN.toString() + ")();";
    const unmountCode = "(" + READER_UNMOUNT_FN.toString() + ")();";

    if (!isActive) {
      // Enable globally
      await browser.storage.local.set({ readerModeGlobal: true });
      btn.classList.add("reader-active");
      btn.classList.remove("reader-learned");
      btn.title = "Reader Mode ON (all tabs) \u2014 click to disable";
      const span = btn.querySelector("span"); if (span) span.textContent = "Reader";
      // Auto-learn current domain
      if (currentDomain) {
        const { readerSites: rs = [] } = await browser.storage.local.get({ readerSites: [] });
        if (!rs.some(d => currentDomain === d || currentDomain.endsWith("." + d))) {
          rs.push(currentDomain);
          await browser.storage.local.set({ readerSites: rs });
        }
      }
      // Inject into every currently open tab
      const allTabs = await browser.tabs.query({});
      for (const t of allTabs) {
        if (!t.url || READER_SKIP_RE.test(t.url)) continue;
        browser.tabs.executeScript(t.id, { code: mountCode }).catch(() => {});
      }
    } else {
      const wasLearned = btn.classList.contains("reader-learned");
      const span = btn.querySelector("span"); if (span) span.textContent = "Reader";
      btn.classList.remove("reader-active", "reader-learned");

      if (wasLearned && currentDomain) {
        // Remove this domain from the learned list
        const { readerSites: rs = [] } = await browser.storage.local.get({ readerSites: [] });
        const updated = rs.filter(d => currentDomain !== d && !currentDomain.endsWith("." + d));
        await browser.storage.local.set({ readerSites: updated });
        btn.title = "Toggle Reader Mode \u2014 applies to all tabs";
        // Remove overlay from current tab only
        if (tab) browser.tabs.executeScript(tab.id, { code: unmountCode }).catch(() => {});
      } else {
        // Disable globally
        await browser.storage.local.set({ readerModeGlobal: false });
        btn.title = "Toggle Reader Mode \u2014 applies to all tabs";
        // Remove from every currently open tab
        const allTabs = await browser.tabs.query({});
        for (const t of allTabs) {
          if (!t.url || READER_SKIP_RE.test(t.url)) continue;
          browser.tabs.executeScript(t.id, { code: unmountCode }).catch(() => {});
        }
      }
    }
  });
}

// ──────────────────────────────────────────────
// Private Window button
// ──────────────────────────────────────────────
async function initIncognitoBar() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const pageUrl = tab?.url || "";
    let pageDomain = "";
    try { pageDomain = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch {}

    const openBtn = document.getElementById("open-incognito");
    if (openBtn) {
      openBtn.addEventListener("click", async () => {
        if (!pageUrl || pageUrl.startsWith("about:") || pageUrl.startsWith("moz-extension:")) {
          showToast("Cannot open this page in a private window", "error");
          return;
        }
        try {
          const resp = await browser.runtime.sendMessage({ action: "openIncognito", url: pageUrl });
          if (resp && resp.success) {
            showToast("Opened in private window", "success");
          } else {
            showToast(resp?.error || "Private window failed — is Argus allowed in private mode?", "error");
          }
        } catch (err) {
          showToast("Private window failed — is Argus allowed in private mode?", "error");
        }
      });
    }

    // Check if current domain is on forced-private list
    const { incognitoSites } = await browser.storage.local.get({ incognitoSites: [] });
    const forced = document.getElementById("incognito-forced");
    if (forced && pageDomain && incognitoSites.some(d => pageDomain === d || pageDomain.endsWith("." + d))) {
      forced.classList.remove("hidden");
    }
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// Mode management
// ──────────────────────────────────────────────
function setMode(mode) {
  activeMode = mode;

  // Sync dropdown
  if (elements.analyzeMode && elements.analyzeMode.value !== mode) {
    elements.analyzeMode.value = mode;
  }

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
// ── Theme toggle (light/dark) ──
function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  const moonIcon = document.getElementById("theme-icon-moon");
  const sunIcon = document.getElementById("theme-icon-sun");
  if (!btn) return;

  function updateIcon(theme) {
    if (theme === "light") {
      moonIcon.style.display = "none";
      sunIcon.style.display = "";
    } else {
      moonIcon.style.display = "";
      sunIcon.style.display = "none";
    }
  }

  // Set initial icon from storage
  browser.storage.local.get({ argusTheme: "dark" }).then(r => updateIcon(r.argusTheme));

  btn.addEventListener("click", async () => {
    const { argusTheme } = await browser.storage.local.get({ argusTheme: "dark" });
    const next = argusTheme === "dark" ? "light" : "dark";
    await browser.storage.local.set({ argusTheme: next });
    updateIcon(next);
    // theme.js handles applying data-theme on <html> via storage listener
  });

  // Keep icon in sync if changed elsewhere
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.argusTheme) {
      updateIcon(changes.argusTheme.newValue);
    }
  });
}

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

  // ── App page navigation map ──
  const APP_NAV = {
    // MFT pages
    "app-projects": { type: "page", path: "projects/projects.html" },
    "app-reader":   { type: "page", path: "feeds/feeds.html" },
    "app-reports":  { type: "page", path: "history/history.html" },
    "app-kg":       { type: "page", path: "osint/graph.html?mode=global" },
    "app-workbench":{ type: "page", path: "workbench/workbench.html" },
    "app-draft":    { type: "page", path: "reporting/reporting.html" },
    "app-images":   { type: "page", path: "osint/images.html" },
    "app-terminal": { type: "page", path: "ssh/ssh.html" },
    "app-finance":  { type: "page", path: "finance/finance.html" },
    "app-trawl":    { type: "page", path: "trawl/trawl.html" },
    "app-results":  { type: "page", path: "results/results.html" },
    // Console tabs
    "con-bookmarks":  { type: "console", hash: "bookmarks" },
    "con-monitors":   { type: "console", hash: "monitors" },
    "con-feeds":      { type: "page", path: "feeds/feeds.html" },
    "con-osint":      { type: "page", path: "osint/graph.html" },
    "con-automate":   { type: "page", path: "automations/automations.html" },
    "con-redirects":  { type: "console", hash: "archive" },
    "con-tracker":    { type: "page", path: "trawl/trawl.html" },
    "con-sources":    { type: "page", path: "sources/sources.html" },
    "con-prompts":    { type: "page", path: "prompts/prompts.html" },
    "con-providers":  { type: "console", hash: "providers" },
    "con-resources":  { type: "console", hash: "resources" },
    "con-settings":   { type: "console", hash: "settings" }
  };

  // Unified data map for popup QJI picker — all choosable items with labels + SVG
  const POPUP_APP_DEFS = {
    // MFT pages
    "app-projects":  { label: "Projects",  svg: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
    "app-reader":    { label: "Reader",    svg: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>' },
    "app-reports":   { label: "Reports",   svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
    "app-kg":        { label: "KG",        svg: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="6" y1="9" x2="6" y2="15"/><line x1="18" y1="9" x2="18" y2="15"/><line x1="9" y1="18" x2="15" y2="18"/>' },
    "app-workbench": { label: "Workbench", svg: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
    "app-draft":     { label: "Publisher", svg: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
    "app-images":    { label: "Images",    svg: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
    "app-terminal":  { label: "Terminal",  svg: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>' },
    "app-finance":   { label: "Finance",   svg: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
    "app-trawl":     { label: "Trawl Net", svg: '<path d="M2 4c4 3 8 3 12 0s8-3 12 0"/><path d="M2 12c4 3 8 3 12 0s8-3 12 0"/><path d="M2 20c4 3 8 3 12 0s8-3 12 0"/>' },
    // Console tabs
    "con-bookmarks": { label: "Bookmarks", svg: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' },
    "con-monitors":  { label: "Monitors",  svg: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
    "con-feeds":     { label: "Feeds",     svg: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>' },
    "con-osint":     { label: "OSINT",     svg: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
    "con-automate":  { label: "Automate",  svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
    "con-redirects": { label: "Redirects", svg: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>' },
    "con-tracker":   { label: "Tracker",   svg: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
    "con-sources":   { label: "Sources",   svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    "con-prompts":   { label: "Prompts",   svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    "con-providers": { label: "Providers", svg: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>' },
    "con-resources": { label: "Resources", svg: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
    "con-settings":  { label: "Settings",  svg: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' }
  };

  // Canonical order for picker display: MFTs first, then console tabs
  const POPUP_ALL_IDS = [
    "app-projects", "app-reader", "app-reports", "app-kg", "app-workbench",
    "app-draft", "app-images", "app-terminal", "app-finance", "app-trawl",
    "con-bookmarks", "con-monitors", "con-feeds", "con-osint", "con-automate",
    "con-redirects", "con-tracker", "con-sources", "con-prompts", "con-providers",
    "con-resources", "con-settings"
  ];

  // Wire up all app icon buttons via delegation on the container
  const popupAppContainer = document.getElementById("popup-app-icons");
  popupAppContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-app-tab]");
    if (!btn) return;
    const id = btn.dataset.appTab;
    const nav = APP_NAV[id];
    if (!nav) return;
    if (nav.type === "console") focusOrCreateConsole(nav.hash);
    else focusOrCreatePage(nav.path);
  });

  // ── Popup QJIs: show 4 user-chosen from ANY page (MFT + console tabs) ──
  const POPUP_DEFAULT_VISIBLE = ["app-projects", "app-reader", "app-reports", "app-chat"];
  const POPUP_MAX_VISIBLE = 4;

  // Seed appBtnMap from existing HTML buttons
  const allAppBtns = [...popupAppContainer.querySelectorAll("[data-app-tab]")];
  const appBtnMap = {};
  for (const btn of allAppBtns) appBtnMap[btn.dataset.appTab] = btn;

  // Create a button element for an app ID (used for console tabs not in HTML)
  function ensureAppBtn(id) {
    if (appBtnMap[id]) return appBtnMap[id];
    const def = POPUP_APP_DEFS[id];
    if (!def) return null;
    const btn = document.createElement("button");
    btn.className = "icon-btn";
    btn.dataset.appTab = id;
    btn.title = def.label;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${def.svg}</svg>`;
    btn.style.display = "none";
    popupAppContainer.appendChild(btn);
    appBtnMap[id] = btn;
    return btn;
  }

  async function applyPopupAppVisibility() {
    const stored = await browser.storage.local.get(["popupVisibleApps"]);
    const visible = Array.isArray(stored.popupVisibleApps) && stored.popupVisibleApps.length > 0
      ? stored.popupVisibleApps : POPUP_DEFAULT_VISIBLE;

    // Ensure buttons exist for all visible items (including console tabs)
    for (const id of visible) ensureAppBtn(id);

    // Hide all, then show + reorder the chosen ones
    for (const btn of Object.values(appBtnMap)) btn.style.display = "none";
    for (const id of visible) {
      const btn = appBtnMap[id];
      if (btn) {
        btn.style.display = "";
        popupAppContainer.appendChild(btn);
      }
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
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });
  consoleHomeBtn.addEventListener("mouseleave", () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });
  consoleHomeBtn.addEventListener("click", () => {
    if (longPressFired) { longPressFired = false; return; }
    focusOrCreateConsole("home");
  });

  // ── App icon picker (long-press console-home to open) ──
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
    const stored = await browser.storage.local.get(["popupVisibleApps"]);
    pickerCurrentVisible = Array.isArray(stored.popupVisibleApps) && stored.popupVisibleApps.length > 0
      ? [...stored.popupVisibleApps] : [...POPUP_DEFAULT_VISIBLE];

    const visibleSet = new Set(pickerCurrentVisible);
    const isFull = pickerCurrentVisible.length >= POPUP_MAX_VISIBLE;

    // Build picker from POPUP_ALL_IDS, grouped by section
    const mftIds = POPUP_ALL_IDS.filter(id => id.startsWith("app-"));
    const conIds = POPUP_ALL_IDS.filter(id => id.startsWith("con-"));

    function renderItems(ids) {
      return ids.map(id => {
        const def = POPUP_APP_DEFS[id];
        if (!def) return "";
        const isActive = visibleSet.has(id);
        const svg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${def.svg}</svg>`;

        let cls = "popup-icon-picker-item";
        if (isActive) cls += " picker-active";
        else if (pickerMode === "removing") cls += " picker-available";
        else if (isFull) cls += " picker-disabled";
        else cls += " picker-available";
        return `<button class="${cls}" data-pick-id="${id}">${svg} ${def.label}</button>`;
      }).join("");
    }

    pickerOverlay.innerHTML = `
      <div class="popup-icon-picker-title">
        ${pickerMode === "removing" ? "Pick replacement" : "Choose shortcuts"}
        <span>${pickerCurrentVisible.length}/${POPUP_MAX_VISIBLE}</span>
      </div>
      <div class="popup-icon-picker-section">Pages</div>
      <div class="popup-icon-picker-grid">${renderItems(mftIds)}</div>
      <div class="popup-icon-picker-section">Console</div>
      <div class="popup-icon-picker-grid">${renderItems(conIds)}</div>`;

    pickerOverlay.querySelectorAll(".popup-icon-picker-item").forEach(item => {
      item.addEventListener("click", async () => {
        const pickId = item.dataset.pickId;
        const isActive = item.classList.contains("picker-active");

        if (isActive) {
          if (pickerCurrentVisible.length <= 1) return;
          pickerCurrentVisible = pickerCurrentVisible.filter(id => id !== pickId);
          pickerMode = "removing";
          await browser.storage.local.set({ popupVisibleApps: pickerCurrentVisible });
          applyPopupAppVisibility();
          renderIconPicker();
        } else if (item.classList.contains("picker-disabled")) {
          return;
        } else {
          if (pickerCurrentVisible.length >= POPUP_MAX_VISIBLE) return;
          pickerCurrentVisible.push(pickId);
          await browser.storage.local.set({ popupVisibleApps: pickerCurrentVisible });
          applyPopupAppVisibility();
          closeIconPicker();
        }
      });
    });
  }

  // Close picker on click outside / Escape
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

  // Mode dropdown (replaces toggle buttons)
  elements.analyzeMode.addEventListener("change", () => {
    setMode(elements.analyzeMode.value);
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
        autoBookmark: true,
        projectId: elements.monitorProject?.value || ""
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
        folderId,
        projectId: elements.bookmarkProject?.value || ""
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

  // ── Tools Accordion ──
  {
    const catBtns = document.querySelectorAll(".tools-cat-btn");
    const drawer = document.getElementById("tools-drawer");
    const accordion = document.querySelector(".tools-accordion");
    let activeCat = null;

    catBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.toolsCat;
        if (activeCat === cat) {
          // toggle off
          btn.classList.remove("active");
          drawer.classList.remove("open");
          drawer.querySelectorAll(".tools-drawer-items").forEach(d => d.classList.remove("visible"));
          activeCat = null;
          return;
        }
        catBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        drawer.querySelectorAll(".tools-drawer-items").forEach(d => d.classList.remove("visible"));
        drawer.querySelector(`.tools-drawer-items[data-tools-cat="${cat}"]`).classList.add("visible");
        drawer.classList.add("open");
        activeCat = cat;
      });
    });

    // Close when mouse leaves the entire accordion area
    if (accordion) {
      accordion.addEventListener("mouseleave", () => {
        if (!activeCat) return;
        catBtns.forEach(b => b.classList.remove("active"));
        drawer.classList.remove("open");
        drawer.querySelectorAll(".tools-drawer-items").forEach(d => d.classList.remove("visible"));
        activeCat = null;
      });
    }
  }

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
    showToast("Checking for cached link map...", "loading");
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const pageUrl = tabs[0]?.url;

    // Check for existing link map in history
    try {
      const cached = await browser.runtime.sendMessage({ action: "getLinkMapForUrl", url: pageUrl });
      if (cached?.found) {
        const storeKey = `linkmap-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { pageUrl: cached.pageUrl, pageTitle: cached.pageTitle, links: cached.linkMapData.links, stats: cached.linkMapData.stats, cached: true, cachedAt: cached.timestamp, historyId: cached.historyId } });
        browser.tabs.create({ url: browser.runtime.getURL(`osint/link-map.html?id=${encodeURIComponent(storeKey)}&mode=cached`) });
        window.close();
        return;
      }
    } catch {}

    // No cached version — extract fresh
    showToast("Mapping links...", "loading");
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
    // Web search
    duckduckgo: "https://duckduckgo.com/?q=",
    startpage:  "https://www.startpage.com/do/dsearch?query=",
    brave:      "https://search.brave.com/search?q=",
    searx:      "https://searxng.org/search?q=",
    mojeek:     "https://www.mojeek.com/search?q=",
    google:     "https://www.google.com/search?q=",
    dogpile:    "https://www.dogpile.com/serp?q=",
    yandex:     "https://yandex.com/search/?text=",
    bing:       "https://www.bing.com/search?q=",
    // Academic / Research
    scholar:    "https://scholar.google.com/scholar?q=",
    semantic:   "https://www.semanticscholar.org/search?q=",
    jstor:      "https://www.jstor.org/action/doBasicSearch?Query=",
    arxiv:      "https://arxiv.org/search/?query=",
    pubmed:     "https://pubmed.ncbi.nlm.nih.gov/?term=",
    core:       "https://core.ac.uk/search?q=",
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

  // ── Custom search engines ──
  const searchEngineSelect = document.getElementById("search-engine");
  const multiEngineRow = document.getElementById("multi-engine-row");

  async function loadCustomSearchEngines() {
    const { customSearchEngines: engines } = await browser.storage.local.get({ customSearchEngines: [] });
    // Remove old custom options/chips
    searchEngineSelect.querySelectorAll("option[data-cat='custom']").forEach(o => o.remove());
    multiEngineRow.querySelectorAll(".me-chip[data-cat='custom']").forEach(c => c.remove());
    for (const eng of (engines || [])) {
      SEARCH_ENGINES[eng.id] = eng.url;
      // Dropdown option
      const opt = document.createElement("option");
      opt.value = eng.id;
      opt.textContent = eng.name;
      opt.dataset.cat = "custom";
      searchEngineSelect.appendChild(opt);
      // Deep dive chip
      const lbl = document.createElement("label");
      lbl.className = "me-chip";
      lbl.dataset.cat = "custom";
      lbl.innerHTML = `<input type="checkbox" value="${eng.id}"> ${eng.name}`;
      // Right-click to remove
      lbl.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        if (confirm(`Remove "${eng.name}" from custom engines?`)) {
          const { customSearchEngines: curr } = await browser.storage.local.get({ customSearchEngines: [] });
          await browser.storage.local.set({ customSearchEngines: (curr || []).filter(e => e.id !== eng.id) });
          delete SEARCH_ENGINES[eng.id];
          loadCustomSearchEngines();
        }
      });
      multiEngineRow.appendChild(lbl);
    }
  }

  // Custom engine add form
  const customAddBtn = document.getElementById("search-cat-add");
  const customForm = document.getElementById("search-custom-form");
  if (customAddBtn && customForm) {
    customAddBtn.addEventListener("click", () => {
      customForm.classList.toggle("hidden");
      if (!customForm.classList.contains("hidden")) {
        document.getElementById("search-custom-name").focus();
      }
    });
    document.getElementById("search-custom-cancel").addEventListener("click", () => {
      customForm.classList.add("hidden");
    });
    document.getElementById("search-custom-save").addEventListener("click", async () => {
      const name = document.getElementById("search-custom-name").value.trim();
      let url = document.getElementById("search-custom-url").value.trim();
      if (!name || !url) return;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      // Auto-detect query placeholder — if no {q}, append it
      if (!url.includes("{q}")) {
        // If URL ends with = or similar, append {q}
        if (/[=\/]$/.test(url)) url += "{q}";
        else url += (url.includes("?") ? "&q={q}" : "?q={q}");
      }
      const id = "custom_" + name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const { customSearchEngines: curr } = await browser.storage.local.get({ customSearchEngines: [] });
      const engines = curr || [];
      if (engines.some(e => e.id === id)) { alert("Engine with this name already exists"); return; }
      engines.push({ id, name, url });
      await browser.storage.local.set({ customSearchEngines: engines });
      // Optionally save as source
      if (document.getElementById("search-custom-as-source").checked) {
        const baseUrl = url.replace(/\{q\}.*$/, "").replace(/[?&]$/, "");
        await browser.runtime.sendMessage({
          action: "saveSource",
          source: {
            id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            type: "webservice",
            aliases: [],
            addresses: [{ type: "website", value: baseUrl, label: name + " (search)" }],
            tags: ["search-engine"],
            location: "",
            notes: `Custom search engine. Query pattern: ${url}`,
            folder: "",
          }
        });
      }
      // Reset form
      document.getElementById("search-custom-name").value = "";
      document.getElementById("search-custom-url").value = "";
      customForm.classList.add("hidden");
      await loadCustomSearchEngines();
      applySearchCategory("custom");
    });
  }

  loadCustomSearchEngines();

  // ── Search category filter ──
  let activeSearchCat = "general";

  function applySearchCategory(cat) {
    activeSearchCat = cat;
    // Update category chips
    document.querySelectorAll(".quick-search-bar .search-cat-chip").forEach(c => {
      c.classList.toggle("active", c.dataset.cat === cat);
    });
    // Filter dropdown options
    const opts = searchEngineSelect.querySelectorAll("option");
    let firstVisible = null;
    opts.forEach(opt => {
      const show = cat === "all" || opt.dataset.cat === cat;
      opt.hidden = !show;
      if (show && !firstVisible) firstVisible = opt;
    });
    // If current selection is hidden, switch to first visible
    const current = searchEngineSelect.querySelector(`option[value="${searchEngineSelect.value}"]`);
    if (current && current.hidden && firstVisible) {
      searchEngineSelect.value = firstVisible.value;
    }
    // Deep dive chips — only toggle visibility, preserve check state
    multiEngineRow.querySelectorAll(".me-chip").forEach(chip => {
      const show = cat === "all" || chip.dataset.cat === cat;
      chip.style.display = show ? "" : "none";
    });
    // Update placeholder
    const placeholders = { general: "Search... then analyze", research: "Search papers...", medical: "Search biomedical literature...", custom: "Search...", all: "Search..." };
    document.getElementById("search-query").placeholder = placeholders[cat] || "Search...";
  }

  document.querySelectorAll(".quick-search-bar .search-cat-chip").forEach(chip => {
    chip.addEventListener("click", () => applySearchCategory(chip.dataset.cat));
  });

  // Deep Dive toggle — show/hide page count selector
  const deepDiveToggle = document.getElementById("deep-dive-toggle");
  const deepDivePages = document.getElementById("deep-dive-pages");
  deepDiveToggle.addEventListener("change", () => {
    const on = deepDiveToggle.checked;
    deepDivePages.classList.toggle("hidden", !on);
    multiEngineRow.classList.toggle("hidden", !on);
    if (on) {
      // Show engines for current category, preserve any existing check state
      multiEngineRow.querySelectorAll(".me-chip").forEach(chip => {
        const show = activeSearchCat === "all" || chip.dataset.cat === activeSearchCat;
        chip.style.display = show ? "" : "none";
      });
    }
  });

  // When main dropdown changes while deep dive is on, check that engine
  document.getElementById("search-engine").addEventListener("change", () => {
    if (deepDiveToggle.checked) {
      const primary = document.getElementById("search-engine").value;
      const cb = multiEngineRow.querySelector(`input[value="${primary}"]`);
      if (cb) cb.checked = true;
    }
  });

  function getSelectedEngines() {
    const checked = [...multiEngineRow.querySelectorAll("input[type=checkbox]:checked")].map(cb => cb.value);
    return checked.length > 0 ? checked : [document.getElementById("search-engine").value];
  }

  function executeSearch() {
    const q = document.getElementById("search-query").value.trim();
    if (!q) return;
    const engine = document.getElementById("search-engine").value;
    const urlPattern = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
    const fullQuery = searchPromptPrefix + q;
    const buildSearchUrl = (pattern, query) => pattern.includes("{q}") ? pattern.replace("{q}", encodeURIComponent(query)) : pattern + encodeURIComponent(query);

    if (deepDiveToggle.checked) {
      // Deep Dive mode — open results page and run AI-powered search synthesis
      const resultId = `deepdive-${Date.now()}`;
      const pagesToCrawl = parseInt(deepDivePages.value) || 5;
      const engines = getSelectedEngines();
      const engineNames = engines.map(e => e.charAt(0).toUpperCase() + e.slice(1));
      const diveLabel = `Deep Dive — ${engineNames.join(" + ")}`;
      browser.storage.local.set({
        [resultId]: {
          status: "loading",
          deepDive: true,
          presetLabel: diveLabel,
          pageTitle: `${diveLabel}: ${q}`,
          pageUrl: buildSearchUrl(urlPattern, fullQuery),
          progress: { phase: "starting", statusText: "Initializing deep dive search..." }
        }
      });
      const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
      navigateArgusTab(resultsUrl);
      browser.runtime.sendMessage({
        action: "deepDiveSearch",
        query: fullQuery,
        rawQuery: q,
        engines,
        engine: engines[0],
        resultId,
        pagesToCrawl
      });
      window.close();
      return;
    }

    browser.tabs.create({ url: buildSearchUrl(urlPattern, fullQuery) });
    window.close();
  }

  document.getElementById("search-go").addEventListener("click", executeSearch);
  document.getElementById("search-query").addEventListener("keydown", (e) => {
    if (e.key === "Enter") executeSearch();
  });

  // Quick subscribe button — shows menu: Subscribe as Feed OR Add as Source
  const feedBtn = document.getElementById("osint-subscribe");
  const feedMenu = document.getElementById("feed-action-menu");

  feedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (feedBtn.classList.contains("feed-subscribed") || feedBtn.classList.contains("feed-source-saved")) return;
    feedMenu.classList.toggle("hidden");
  });

  // Close menu on outside click
  document.addEventListener("click", () => feedMenu.classList.add("hidden"));
  feedMenu.addEventListener("click", (e) => e.stopPropagation());

  // Option 1: Subscribe as Feed
  document.getElementById("feed-action-subscribe").addEventListener("click", async () => {
    feedMenu.classList.add("hidden");
    // Multi-feed — open console picker
    if (feedBtn._multiFeeds) {
      await browser.storage.local.set({ _detectedFeeds: feedBtn._multiFeeds });
      focusOrCreateConsole("feeds");
      return;
    }
    const feedUrl = feedBtn._feedUrl;
    if (!feedUrl) return;
    feedBtn.querySelector("span").textContent = "...";
    const resp = await browser.runtime.sendMessage({ action: "addFeed", url: feedUrl, intervalMinutes: 60 });
    if (resp?.success) {
      feedBtn.querySelector("span").textContent = "✓";
      feedBtn.classList.add("feed-subscribed");
      feedBtn.title = "Subscribed to this feed";
    } else {
      feedBtn.querySelector("span").textContent = resp?.error?.includes("already") ? "✓" : "✗";
      if (resp?.error?.includes("already")) feedBtn.classList.add("feed-subscribed");
      else feedBtn.style.color = "#f44336";
      feedBtn.style.animation = "none";
    }
  });

  // Option 2: Add as Source
  document.getElementById("feed-action-source").addEventListener("click", async () => {
    feedMenu.classList.add("hidden");
    const feeds = feedBtn._multiFeeds || [];
    // Single feed
    if (!feeds.length && feedBtn._feedUrl) {
      feeds.push({ url: feedBtn._feedUrl, title: feedBtn._feedTitle || "" });
    }
    if (!feeds.length) return;
    feedBtn.querySelector("span").textContent = "...";
    // Check existing sources to avoid duplicates
    const existingResp = await browser.runtime.sendMessage({ action: "getSources" });
    const existingUrls = new Set();
    if (existingResp?.success && existingResp.sources) {
      for (const s of existingResp.sources) {
        for (const a of (s.addresses || [])) existingUrls.add(a.value);
      }
    }
    const newFeeds = feeds.filter(f => !existingUrls.has(f.url));
    if (!newFeeds.length) {
      feedBtn.querySelector("span").textContent = "✓";
      feedBtn.classList.add("feed-source-saved");
      feedBtn.title = "Already in sources";
      return;
    }
    const sources = newFeeds.map(f => {
      let hostname = "";
      try { hostname = new URL(f.url).hostname; } catch { /* skip */ }
      return {
        id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.title || hostname || "RSS Source",
        type: "service",
        aliases: [],
        addresses: [{ type: "rss", value: f.url, label: f.title || "" }],
        tags: [],
        location: "",
        notes: "",
        folder: "",
      };
    });
    const resp = sources.length === 1
      ? await browser.runtime.sendMessage({ action: "saveSource", source: sources[0] })
      : await browser.runtime.sendMessage({ action: "importSources", sources });
    if (resp?.success) {
      feedBtn.querySelector("span").textContent = "✓";
      feedBtn.classList.add("feed-source-saved");
      feedBtn.title = sources.length === 1 ? "Saved as source" : `${sources.length} feeds saved as sources`;
    } else {
      feedBtn.querySelector("span").textContent = "✗";
      feedBtn.style.color = "#f44336";
      feedBtn.style.animation = "none";
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
