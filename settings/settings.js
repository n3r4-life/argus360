// ──────────────────────────────────────────────
// settings.js — standalone Settings page for Argus
// ──────────────────────────────────────────────

// ── Element cache ──
const el = {
  saveIndicator:        document.getElementById("save-indicator"),
  // Tracking & Trawl
  showBadge:            document.getElementById("show-badge"),
  trackMyPages:         document.getElementById("track-my-pages"),
  trawlEnabled:         document.getElementById("trawl-enabled"),
  trawlScheduleEnabled: document.getElementById("trawl-schedule-enabled"),
  trawlScheduleConfig:  document.getElementById("trawl-schedule-config"),
  trawlStartHour:       document.getElementById("trawl-start-hour"),
  trawlEndHour:         document.getElementById("trawl-end-hour"),
  trawlDayChecks:       document.getElementById("trawl-day-checks"),
  trawlDurationEnabled: document.getElementById("trawl-duration-enabled"),
  trawlDurationPreset:  document.getElementById("trawl-duration-preset"),
  trawlDurationConfig:  document.getElementById("trawl-duration-config"),
  trawlDurationSlider:  document.getElementById("trawl-duration-slider"),
  trawlDurationLabel:   document.getElementById("trawl-duration-label"),
  // Incognito
  incognitoForceEnabled: document.getElementById("incognito-force-enabled"),
  incognitoAddDomain:    document.getElementById("incognito-add-domain"),
  incognitoAddBtn:       document.getElementById("incognito-add-btn"),
  incognitoSitesList:    document.getElementById("incognito-sites-list"),
  // Reports
  maxHistory:   document.getElementById("max-history"),
  openHistory:  document.getElementById("open-history"),
  clearHistory: document.getElementById("clear-history"),
  // Import / Export
  exportSettings:    document.getElementById("export-settings"),
  importSettings:    document.getElementById("import-settings"),
  importFile:        document.getElementById("import-file"),
  importExportStatus: document.getElementById("import-export-status"),
  // Version
  versionNumber: document.getElementById("version-number"),
};

// ──────────────────────────────────────────────
// Settings-specific keys (non-provider)
// ──────────────────────────────────────────────
const SETTINGS_DEFAULTS = {
  maxHistorySize: 200,
  showBadge: true,
  trackMyPages: false,
  trawlEnabled: false,
  incognitoForceEnabled: false,
  incognitoSites: [],
  backupEnabled: false,
  backupInterval: 1440,
  backupAllProviders: true,
  satDefaultLocation: "",
  satDefaultZoom: 12,
  satDefaultResolution: "1024",
  cloudBackupEnabled: false,
  cloudBackupInterval: "24",
  cloudSyncMetadata: true,
  cloudSyncSnapshots: true,
  cloudSyncPdfs: true,
  chatSyncEnabled: false,
  chatSyncProvider: "all",
  chatSyncInterval: "5",
  chatSyncClearLocal: false,
  homeNavDest1: "",
  homeNavDest2: "",
  homeNavDest3: "",
};

// ──────────────────────────────────────────────
// Load settings from storage
// ──────────────────────────────────────────────
async function loadSettings() {
  const settings = await browser.storage.local.get(SETTINGS_DEFAULTS);

  // Tracking & trawl
  if (el.trackMyPages) el.trackMyPages.checked = settings.trackMyPages === true;
  if (el.trawlEnabled) el.trawlEnabled.checked = settings.trawlEnabled === true;
  if (el.incognitoForceEnabled) el.incognitoForceEnabled.checked = settings.incognitoForceEnabled === true;
  renderIncognitoSites(settings.incognitoSites || []);
  if (el.maxHistory) el.maxHistory.value = settings.maxHistorySize;

  // Satellite defaults
  const satLoc = document.getElementById("sat-default-location");
  const satZoom = document.getElementById("sat-default-zoom");
  const satRes = document.getElementById("sat-default-resolution");
  if (satLoc) satLoc.value = settings.satDefaultLocation || "";
  if (satZoom) satZoom.value = settings.satDefaultZoom || 12;
  if (satRes) satRes.value = settings.satDefaultResolution || "1024";

  // Backup
  const cloudBackupEnabled = document.getElementById("cloud-backup-enabled");
  const cloudBackupInterval = document.getElementById("cloud-backup-interval");
  if (cloudBackupEnabled) cloudBackupEnabled.checked = settings.cloudBackupEnabled || false;
  if (cloudBackupInterval) cloudBackupInterval.value = settings.cloudBackupInterval || "24";

  // Cloud sync toggles
  const syncMeta = document.getElementById("cloud-sync-metadata");
  const syncSnap = document.getElementById("cloud-sync-snapshots");
  const syncPdf = document.getElementById("cloud-sync-pdfs");
  if (syncMeta) syncMeta.checked = settings.cloudSyncMetadata !== false;
  if (syncSnap) syncSnap.checked = settings.cloudSyncSnapshots !== false;
  if (syncPdf) syncPdf.checked = settings.cloudSyncPdfs !== false;

  // Chat sync
  const chatSync = document.getElementById("chat-sync-enabled");
  const chatSyncConfig = document.getElementById("chat-sync-config");
  const chatSyncProv = document.getElementById("chat-sync-provider");
  const chatSyncInt = document.getElementById("chat-sync-interval");
  const chatSyncClear = document.getElementById("chat-sync-clear-local");
  if (chatSync) {
    chatSync.checked = settings.chatSyncEnabled || false;
    if (chatSyncConfig) chatSyncConfig.style.display = chatSync.checked ? "flex" : "none";
  }
  if (chatSyncProv) chatSyncProv.value = settings.chatSyncProvider || "all";
  if (chatSyncInt) chatSyncInt.value = settings.chatSyncInterval || "5";
  if (chatSyncClear) chatSyncClear.checked = settings.chatSyncClearLocal || false;

  // Local backup schedule
  const backupEnabled = document.getElementById("backup-enabled");
  const backupInterval = document.getElementById("backup-interval");
  const backupAll = document.getElementById("backup-all-providers");
  if (backupEnabled) backupEnabled.checked = settings.backupEnabled || false;
  if (backupInterval) backupInterval.value = settings.backupInterval || 1440;
  if (backupAll) backupAll.checked = settings.backupAllProviders !== false;

  // Home nav
  loadHomeNavDropdowns(settings);

  // Trawl schedule + duration (via background messages)
  loadTrawlScheduleUI();
  loadTrawlDurationUI();
}

// ──────────────────────────────────────────────
// Save settings to storage (only settings keys)
// ──────────────────────────────────────────────
let saveTimeout = null;

function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveSettings, 400);
}

function flashSaved() {
  if (!el.saveIndicator) return;
  el.saveIndicator.classList.remove("hidden");
  setTimeout(() => el.saveIndicator.classList.add("hidden"), 1500);
}

async function saveSettings() {
  const satLoc = document.getElementById("sat-default-location");
  const satZoom = document.getElementById("sat-default-zoom");
  const satRes = document.getElementById("sat-default-resolution");

  await browser.storage.local.set({
    maxHistorySize: parseInt(el.maxHistory?.value, 10) || 200,
    trackMyPages: el.trackMyPages?.checked || false,
    trawlEnabled: el.trawlEnabled?.checked || false,
    incognitoForceEnabled: el.incognitoForceEnabled?.checked || false,
    // Satellite defaults
    satDefaultLocation: satLoc?.value || "",
    satDefaultZoom: parseInt(satZoom?.value, 10) || 12,
    satDefaultResolution: satRes?.value || "1024",
    // Cloud backup
    cloudBackupEnabled: document.getElementById("cloud-backup-enabled")?.checked || false,
    cloudBackupInterval: document.getElementById("cloud-backup-interval")?.value || "24",
    cloudSyncMetadata: document.getElementById("cloud-sync-metadata")?.checked ?? true,
    cloudSyncSnapshots: document.getElementById("cloud-sync-snapshots")?.checked ?? true,
    cloudSyncPdfs: document.getElementById("cloud-sync-pdfs")?.checked ?? true,
    // Chat sync
    chatSyncEnabled: document.getElementById("chat-sync-enabled")?.checked || false,
    chatSyncProvider: document.getElementById("chat-sync-provider")?.value || "all",
    chatSyncInterval: document.getElementById("chat-sync-interval")?.value || "5",
    chatSyncClearLocal: document.getElementById("chat-sync-clear-local")?.checked || false,
    // Local backup
    backupEnabled: document.getElementById("backup-enabled")?.checked || false,
    backupInterval: parseInt(document.getElementById("backup-interval")?.value, 10) || 1440,
    backupAllProviders: document.getElementById("backup-all-providers")?.checked ?? true,
    // Home nav
    homeNavDest1: document.getElementById("home-nav-dest-1")?.value || "",
    homeNavDest2: document.getElementById("home-nav-dest-2")?.value || "",
    homeNavDest3: document.getElementById("home-nav-dest-3")?.value || "",
  });
  flashSaved();
}

// ──────────────────────────────────────────────
// Incognito / Forced-Private Sites
// ──────────────────────────────────────────────
function renderIncognitoSites(sites) {
  const list = el.incognitoSitesList;
  if (!list) return;
  list.innerHTML = "";
  for (const domain of sites) {
    const item = document.createElement("div");
    item.className = "incognito-site-item";
    item.innerHTML = `<span class="site-domain">${escapeHtml(domain)}</span><button class="site-remove" title="Remove">&times;</button>`;
    item.querySelector(".site-remove").addEventListener("click", () => removeIncognitoSite(domain));
    list.appendChild(item);
  }
}

async function addIncognitoSite() {
  let domain = el.incognitoAddDomain.value.trim().toLowerCase();
  if (!domain) return;
  domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!domain) return;
  const { incognitoSites } = await browser.storage.local.get({ incognitoSites: [] });
  if (incognitoSites.includes(domain)) {
    el.incognitoAddDomain.value = "";
    return;
  }
  incognitoSites.push(domain);
  await browser.storage.local.set({ incognitoSites });
  el.incognitoAddDomain.value = "";
  renderIncognitoSites(incognitoSites);
  browser.runtime.sendMessage({ action: "initIncognitoForce" }).catch(() => {});
}

async function removeIncognitoSite(domain) {
  const { incognitoSites } = await browser.storage.local.get({ incognitoSites: [] });
  const updated = incognitoSites.filter(d => d !== domain);
  await browser.storage.local.set({ incognitoSites: updated });
  renderIncognitoSites(updated);
}

// ──────────────────────────────────────────────
// Trawl Schedule
// ──────────────────────────────────────────────
function initTrawlScheduleControls() {
  for (let h = 0; h < 24; h++) {
    const label = `${String(h).padStart(2, "0")}:00`;
    const optS = document.createElement("option");
    optS.value = h; optS.textContent = label;
    el.trawlStartHour.appendChild(optS);
    const optE = document.createElement("option");
    optE.value = h; optE.textContent = label;
    el.trawlEndHour.appendChild(optE);
  }
  el.trawlEndHour.value = "23";

  el.trawlScheduleEnabled.addEventListener("change", () => {
    el.trawlScheduleConfig.style.display = el.trawlScheduleEnabled.checked ? "block" : "none";
    saveTrawlSchedule();
  });

  el.trawlStartHour.addEventListener("change", saveTrawlSchedule);
  el.trawlEndHour.addEventListener("change", saveTrawlSchedule);
  el.trawlDayChecks.querySelectorAll("button[data-day]").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      saveTrawlSchedule();
    });
  });
}

async function loadTrawlScheduleUI() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getTrawlSchedule" });
    const sched = resp?.schedule;
    if (!sched) return;
    el.trawlScheduleEnabled.checked = sched.enabled === true;
    el.trawlScheduleConfig.style.display = sched.enabled ? "block" : "none";
    if (sched.startHour !== undefined) el.trawlStartHour.value = sched.startHour;
    if (sched.endHour !== undefined) el.trawlEndHour.value = sched.endHour;
    if (sched.days) {
      el.trawlDayChecks.querySelectorAll("button[data-day]").forEach(btn => {
        btn.classList.toggle("active", sched.days.includes(parseInt(btn.dataset.day, 10)));
      });
    }
  } catch { /* */ }
}

function saveTrawlSchedule() {
  const days = [];
  el.trawlDayChecks.querySelectorAll("button[data-day].active").forEach(btn => {
    days.push(parseInt(btn.dataset.day, 10));
  });
  const schedule = {
    enabled: el.trawlScheduleEnabled.checked,
    startHour: parseInt(el.trawlStartHour.value, 10),
    endHour: parseInt(el.trawlEndHour.value, 10),
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
  };
  browser.runtime.sendMessage({ action: "setTrawlSchedule", schedule }).catch(() => {});
}

// ──────────────────────────────────────────────
// Trawl Duration Timer
// ──────────────────────────────────────────────
function initTrawlDurationControls() {
  const { trawlDurationEnabled, trawlDurationPreset, trawlDurationConfig, trawlDurationSlider, trawlDurationLabel } = el;

  function updateDurationLabel(minutes) {
    const mins = parseInt(minutes, 10);
    if (mins < 60) {
      trawlDurationLabel.textContent = mins + " minutes";
    } else {
      const h = Math.floor(mins / 60), m = mins % 60;
      trawlDurationLabel.textContent = h + (m ? "h " + m + "m" : " hour" + (h !== 1 ? "s" : ""));
    }
  }

  trawlDurationEnabled.addEventListener("change", () => {
    trawlDurationConfig.style.display = trawlDurationEnabled.checked ? "block" : "none";
    saveTrawlDuration();
  });

  trawlDurationPreset.addEventListener("change", () => {
    const val = parseInt(trawlDurationPreset.value, 10);
    trawlDurationSlider.value = Math.min(360, Math.max(15, val));
    updateDurationLabel(val);
    saveTrawlDuration();
  });

  trawlDurationSlider.addEventListener("input", () => {
    const val = parseInt(trawlDurationSlider.value, 10);
    updateDurationLabel(val);
    const presets = [30, 60, 120, 180, 240, 360];
    if (presets.includes(val)) trawlDurationPreset.value = val;
  });
  trawlDurationSlider.addEventListener("change", saveTrawlDuration);
}

async function loadTrawlDurationUI() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getTrawlDuration" });
    if (!resp?.success) return;
    el.trawlDurationEnabled.checked = resp.enabled === true;
    el.trawlDurationConfig.style.display = resp.enabled ? "block" : "none";
    const mins = resp.minutes || 30;
    const presets = [30, 60, 120, 180, 240, 360];
    const nearest = presets.reduce((a, b) => Math.abs(b - mins) < Math.abs(a - mins) ? b : a);
    el.trawlDurationPreset.value = nearest;
    el.trawlDurationSlider.value = Math.min(360, Math.max(15, mins));
    const label = el.trawlDurationLabel;
    if (label) {
      if (mins < 60) label.textContent = mins + " minutes";
      else {
        const h = Math.floor(mins / 60), m = mins % 60;
        label.textContent = h + (m ? "h " + m + "m" : " hour" + (h !== 1 ? "s" : ""));
      }
    }
  } catch { /* */ }
}

function saveTrawlDuration() {
  const minutes = parseInt(el.trawlDurationSlider.value, 10) || parseInt(el.trawlDurationPreset.value, 10) || 30;
  browser.runtime.sendMessage({
    action: "setTrawlDuration",
    enabled: el.trawlDurationEnabled.checked,
    minutes
  }).catch(() => {});
}

// ──────────────────────────────────────────────
// User Profile
// ──────────────────────────────────────────────
function _profileFmtDate(iso) {
  if (!iso) return "never";
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, "0");
  const yr = String(d.getFullYear()).slice(2);
  return `${yr}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateProfileUI(profile) {
  const loggedOut = document.getElementById("profile-logged-out");
  const loggedIn  = document.getElementById("profile-logged-in");
  if (!loggedOut || !loggedIn) return;

  if (profile) {
    loggedOut.style.display = "none";
    loggedIn.style.display  = "";
    const initial = (profile.username || "?")[0].toUpperCase();
    document.getElementById("profile-avatar").textContent        = initial;
    document.getElementById("profile-display-name").textContent  = profile.username;
    document.getElementById("profile-last-sync").textContent     = _profileFmtDate(profile.lastSync);
  } else {
    loggedOut.style.display = "";
    loggedIn.style.display  = "none";
  }
}

function initUserProfile() {
  // Filter provider selector to only connected providers
  (async () => {
    try {
      const resp = await browser.runtime.sendMessage({ action: "cloudGetStatus" });
      const sel = document.getElementById("profile-cloud-provider");
      if (!sel) return;
      for (const opt of sel.options) {
        if (opt.value && !resp?.providers?.[opt.value]) {
          opt.disabled = true;
          opt.textContent += " (not connected)";
        }
      }
    } catch { /* */ }

    // Restore logged-in state if active
    const resp = await browser.runtime.sendMessage({ action: "profileGetState" });
    updateProfileUI(resp?.profile || null);
  })();

  // Login
  document.getElementById("profile-login-btn")?.addEventListener("click", async () => {
    const username  = document.getElementById("profile-username").value.trim();
    const passcode  = document.getElementById("profile-passcode").value;
    const provider  = document.getElementById("profile-cloud-provider").value;
    const statusEl  = document.getElementById("profile-login-status");

    if (!username || !passcode || !provider) {
      statusEl.textContent = "Fill in all fields.";
      statusEl.style.color = "var(--error)";
      return;
    }

    statusEl.textContent = "Signing in\u2026";
    statusEl.style.color = "var(--text-muted)";
    const btn = document.getElementById("profile-login-btn");
    btn.disabled = true;

    try {
      const r = await browser.runtime.sendMessage({ action: "profileLogin", username, passcode, cloudProvider: provider });
      if (r?.success) {
        statusEl.textContent = r.isNew ? "New profile created. Welcome!" : "Restored from last sync.";
        statusEl.style.color = "var(--success)";
        document.getElementById("profile-passcode").value = "";
        const stateResp = await browser.runtime.sendMessage({ action: "profileGetState" });
        updateProfileUI(stateResp?.profile || null);
      } else {
        statusEl.textContent = r?.error || "Sign in failed.";
        statusEl.style.color = "var(--error)";
      }
    } catch (e) {
      statusEl.textContent = e.message;
      statusEl.style.color = "var(--error)";
    }
    btn.disabled = false;
  });

  // Sync Now
  document.getElementById("profile-sync-btn")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("profile-sync-status");
    const btn = document.getElementById("profile-sync-btn");
    btn.textContent = "Syncing\u2026";
    btn.disabled = true;
    statusEl.textContent = "";
    try {
      const r = await browser.runtime.sendMessage({ action: "profileSyncAll" });
      if (r?.success) {
        statusEl.textContent = `Synced ${Object.keys(r.stores || {}).length} stores \u00b7 ${_profileFmtDate(r.syncedAt)}`;
        statusEl.style.color = "var(--success)";
        document.getElementById("profile-last-sync").textContent = _profileFmtDate(r.syncedAt);
      } else {
        statusEl.textContent = r?.error || "Sync failed.";
        statusEl.style.color = "var(--error)";
      }
    } catch (e) {
      statusEl.textContent = e.message;
      statusEl.style.color = "var(--error)";
    }
    btn.textContent = "Sync Now";
    btn.disabled = false;
  });

  // Sign Out
  document.getElementById("profile-logout-btn")?.addEventListener("click", async () => {
    const syncFirst = !document.getElementById("profile-clear-on-logout")?.checked;
    const confirmMsg = syncFirst
      ? "Sync to cloud then sign out?"
      : "Sign out without syncing? Any unsynced changes will stay local.";
    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById("profile-logout-btn");
    btn.textContent = syncFirst ? "Syncing\u2026" : "Signing out\u2026";
    btn.disabled = true;

    try {
      await browser.runtime.sendMessage({ action: "profileLogout", syncFirst });
      updateProfileUI(null);
    } catch (e) {
      const statusEl = document.getElementById("profile-sync-status");
      statusEl.textContent = e.message;
      statusEl.style.color = "var(--error)";
    }
    btn.textContent = "Sign Out";
    btn.disabled = false;
  });
}

// ──────────────────────────────────────────────
// Storage Management
// ──────────────────────────────────────────────
function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

let _storageUsageTimer = null;
function updateStorageUsage() {
  clearTimeout(_storageUsageTimer);
  _storageUsageTimer = setTimeout(_doUpdateStorageUsage, 80);
}

async function _doUpdateStorageUsage() {
  const display = document.getElementById("storage-usage-display");
  const breakdown = document.getElementById("storage-breakdown");
  try {
    const [all, { storeSyncLog = {} }] = await Promise.all([
      browser.storage.local.get(null),
      browser.storage.local.get({ storeSyncLog: {} })
    ]);
    const localBytes = new Blob([JSON.stringify(all)]).size;

    let ephemeralBytes = 0, ephemeralCount = 0;
    let conversationBytes = 0, conversationCount = 0;
    let settingsOnlyBytes = 0, settingsOnlyCount = 0;
    const ephemeralPrefixes = ["tl-result-", "proj-view-", "techstack-", "metadata-", "linkmap-", "whois-", "result-"];
    const convPrefixes = ["conv-", "chat-", "followup-", "ai-"];
    for (const [key, val] of Object.entries(all)) {
      const s = new Blob([JSON.stringify(val)]).size;
      if (ephemeralPrefixes.some(p => key.startsWith(p)) || key.endsWith("-pipeline")) {
        ephemeralBytes += s; ephemeralCount++;
      } else if (convPrefixes.some(p => key.startsWith(p))) {
        conversationBytes += s; conversationCount++;
      } else {
        settingsOnlyBytes += s; settingsOnlyCount++;
      }
    }

    // IndexedDB
    let idbSizes = { _total: 0 };
    if (typeof ArgusDB !== "undefined") {
      idbSizes = await ArgusDB.estimateSize();
    }

    // OPFS
    let opfsBytes = 0;
    try {
      const monResp = await browser.runtime.sendMessage({ action: "getMonitorStorageUsage" });
      if (monResp && monResp.success) opfsBytes = monResp.opfsBytes || 0;
    } catch { /* */ }

    const totalBytes = localBytes + (idbSizes._total || 0) + opfsBytes;

    display.textContent = fmtBytes(totalBytes);
    if (totalBytes > 8 * 1048576) {
      display.style.color = "var(--error)";
    } else if (totalBytes > 5 * 1048576) {
      display.style.color = "var(--warning, #ffb74d)";
    } else {
      display.style.color = "var(--text-secondary)";
    }

    // Build breakdown
    const storeLabels = {
      history: "Analysis History", snapshots: "Monitor Snapshots (IDB)",
      changes: "Monitor Changes", feedEntries: "Feed Entries",
      kgNodes: "KG Nodes", kgEdges: "KG Edges",
      projects: "Projects", bookmarks: "Bookmarks",
      monitors: "Monitors", feeds: "Feeds",
      watchlist: "Watchlist", chatSessions: "Chat Sessions",
      drafts: "Drafts", pageTracker: "Page Tracker", sources: "Sources",
    };

    const allEntries = [];
    for (const [store, label] of Object.entries(storeLabels)) {
      const s = idbSizes[store];
      if (s && s.bytes > 0) {
        allEntries.push({ label, bytes: s.bytes, detail: s.count + " items" });
      }
    }
    if (opfsBytes > 0) allEntries.push({ label: "Snapshot Files (HTML/PNG)", bytes: opfsBytes, detail: "OPFS binary" });
    if (ephemeralCount > 0) allEntries.push({ label: "Cached Results", bytes: ephemeralBytes, detail: ephemeralCount + " keys" });
    if (conversationCount > 0) allEntries.push({ label: "AI Conversations", bytes: conversationBytes, detail: conversationCount + " keys" });
    if (settingsOnlyBytes > 0) allEntries.push({ label: "Settings & Config", bytes: settingsOnlyBytes, detail: settingsOnlyCount + " keys" });

    allEntries.sort((a, b) => b.bytes - a.bytes);

    const rows = allEntries.map(e => `${e.label}: ${fmtBytes(e.bytes)} (${e.detail})`);
    if (breakdown && rows.length) {
      breakdown.style.display = "block";
      breakdown.textContent = rows.join("\n");
      breakdown.style.whiteSpace = "pre-line";
    }
  } catch (e) {
    display.textContent = "Error calculating usage";
    console.warn("[Settings] Storage usage error:", e);
  }
}

function showPurgeStatus(msg) {
  const status = document.getElementById("storage-purge-status");
  if (!status) return;
  status.textContent = msg;
  status.classList.remove("hidden");
  setTimeout(() => status.classList.add("hidden"), 3000);
}

async function purgeOldHistory() {
  if (typeof ArgusDB === "undefined") return;
  const days = parseInt(document.getElementById("purge-history-age").value, 10);
  const count = await ArgusDB.History.purgeOlderThan(days);
  showPurgeStatus(`Purged ${count} history entries`);
  updateStorageUsage();
}

async function purgeMonitorSnapshots() {
  if (typeof ArgusDB === "undefined") return;
  const keep = parseInt(document.getElementById("purge-snapshots-keep").value, 10);
  const monitors = await ArgusDB.Monitors.getAll();
  let trimmed = 0;
  for (const mon of monitors) {
    trimmed += await ArgusDB.Snapshots.pruneForMonitor(mon.id, keep);
  }
  showPurgeStatus(`Trimmed ${trimmed} snapshots`);
  updateStorageUsage();
}

async function purgeAllCachedData() {
  const all = await browser.storage.local.get(null);
  const prefixes = ["tl-result-", "proj-view-", "techstack-", "metadata-", "linkmap-", "whois-", "result-"];
  const keysToRemove = Object.keys(all).filter(k =>
    prefixes.some(p => k.startsWith(p)) || k.endsWith("-pipeline")
  );
  if (keysToRemove.length) await browser.storage.local.remove(keysToRemove);
  showPurgeStatus(`Removed ${keysToRemove.length} cached entries`);
  updateStorageUsage();
}

async function purgeOpfsFiles() {
  if (!confirm("Delete all snapshot HTML and screenshot files? This frees the most space but removes the ability to view old page captures.")) return;
  try {
    await browser.runtime.sendMessage({ action: "purgeOpfsFiles" });
    showPurgeStatus("All snapshot files deleted");
  } catch {
    showPurgeStatus("Failed to delete snapshot files");
  }
  updateStorageUsage();
}

function initStorageManagement() {
  updateStorageUsage();

  document.getElementById("purge-history-btn")?.addEventListener("click", purgeOldHistory);
  document.getElementById("purge-snapshots-btn")?.addEventListener("click", purgeMonitorSnapshots);
  document.getElementById("purge-cached-btn")?.addEventListener("click", purgeAllCachedData);
  document.getElementById("purge-opfs-btn")?.addEventListener("click", purgeOpfsFiles);

  // Email Contacts management
  const contactsList = document.getElementById("contacts-list");
  if (contactsList && typeof EmailShare !== "undefined") {
    async function renderContacts() {
      const contacts = await EmailShare.getContacts();
      contactsList.replaceChildren();
      for (const c of contacts) {
        const chip = document.createElement("span");
        chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:3px 10px;font-size:11px;color:var(--text-secondary);";
        chip.textContent = c.name ? `${c.name} <${c.email}>` : c.email;
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "\u00d7";
        removeBtn.style.cssText = "background:none;border:none;color:var(--error);cursor:pointer;font-size:14px;padding:0 2px;";
        removeBtn.addEventListener("click", async () => { await EmailShare.removeContact(c.email); renderContacts(); });
        chip.appendChild(removeBtn);
        contactsList.appendChild(chip);
      }
      if (!contacts.length) contactsList.textContent = "No contacts saved yet.";
    }
    renderContacts();
    document.getElementById("add-contact-btn")?.addEventListener("click", async () => {
      const emailInput = document.getElementById("contact-email-input");
      const nameInput = document.getElementById("contact-name-input");
      const email = emailInput.value.trim();
      if (!email || !email.includes("@")) return;
      await EmailShare.addContact(email, nameInput.value.trim());
      emailInput.value = "";
      nameInput.value = "";
      renderContacts();
    });
  }

  // Wipe Everything — PIN-gated multi-level
  const wipeBtn    = document.getElementById("wipe-everything-btn");
  const wipePanel  = document.getElementById("wipe-panel");
  const wipePinStep  = document.getElementById("wipe-pin-step");
  const wipeOptStep  = document.getElementById("wipe-options-step");
  const wipeStatus   = document.getElementById("wipe-status");

  if (!wipeBtn || !wipePanel) return;

  function _closeWipePanel() {
    wipePanel.classList.add("hidden");
    wipePinStep.classList.add("hidden");
    wipeOptStep.classList.add("hidden");
    wipeStatus.textContent = "";
    const pinInput = document.getElementById("wipe-pin-input");
    if (pinInput) pinInput.value = "";
    document.getElementById("wipe-pin-error").textContent = "";
    wipeBtn.disabled = false;
  }

  async function _runWipe(mode) {
    wipeOptStep.classList.add("hidden");
    wipeStatus.textContent = "Syncing to cloud\u2026";
    await new Promise(r => setTimeout(r, 400));
    wipeStatus.textContent = "Wiping\u2026";
    const resp = await browser.runtime.sendMessage({ action: "wipeEverything", mode });
    if (resp?.success) {
      wipeStatus.textContent = mode === "user" ? "Your data has been wiped." : "Everything has been wiped.";
      setTimeout(() => location.reload(), 1800);
    } else {
      wipeStatus.textContent = "Wipe failed: " + (resp?.error || "unknown error");
      wipeBtn.disabled = false;
    }
  }

  wipeBtn.addEventListener("click", async () => {
    wipePanel.classList.remove("hidden");
    wipePinStep.classList.add("hidden");
    wipeOptStep.classList.add("hidden");
    wipeStatus.textContent = "";
    const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
    if (vaultStatus?.enabled) {
      wipePinStep.classList.remove("hidden");
      document.getElementById("wipe-pin-input")?.focus();
    } else {
      wipeOptStep.classList.remove("hidden");
    }
  });

  document.getElementById("wipe-pin-confirm")?.addEventListener("click", async () => {
    const pinInput = document.getElementById("wipe-pin-input");
    const pinErr   = document.getElementById("wipe-pin-error");
    const pin = pinInput.value.trim();
    if (!pin) { pinErr.textContent = "Enter your PIN."; return; }
    pinErr.textContent = "";
    try {
      const r = await browser.runtime.sendMessage({ action: "vaultUnlock", passcode: pin });
      if (r?.success) {
        wipePinStep.classList.add("hidden");
        wipeOptStep.classList.remove("hidden");
      } else {
        pinErr.textContent = "Incorrect PIN.";
        pinInput.value = "";
        pinInput.focus();
      }
    } catch (e) {
      pinErr.textContent = e.message || "Unlock failed.";
    }
  });

  document.getElementById("wipe-pin-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("wipe-pin-confirm").click();
  });

  document.getElementById("wipe-cancel-btn")?.addEventListener("click", _closeWipePanel);
  document.getElementById("wipe-cancel-btn2")?.addEventListener("click", _closeWipePanel);

  document.getElementById("wipe-user-btn")?.addEventListener("click", () => _runWipe("user"));
  document.getElementById("wipe-all-btn")?.addEventListener("click", () => _runWipe("all"));
}

// ──────────────────────────────────────────────
// Vault / Security
// ──────────────────────────────────────────────
function initVault() {
  const vaultTypeSelect   = document.getElementById("vault-type-select");
  const vaultSetupInput   = document.getElementById("vault-setup-input");
  const vaultSetupConfirm = document.getElementById("vault-setup-confirm");
  const vaultSetupLabel   = document.getElementById("vault-setup-label");
  const vaultEnableBtn    = document.getElementById("vault-enable-btn");
  const vaultSetupStatus  = document.getElementById("vault-setup-status");
  const vaultNotConfigured = document.getElementById("vault-not-configured");
  const vaultConfigured   = document.getElementById("vault-configured");
  const vaultStatusBadge  = document.getElementById("vault-status-badge");
  const vaultTypeDisplay  = document.getElementById("vault-type-display");
  const vaultLockBtn      = document.getElementById("vault-lock-btn");
  const vaultChangeBtn    = document.getElementById("vault-change-btn");
  const vaultRemoveBtn    = document.getElementById("vault-remove-btn");
  const vaultActionStatus = document.getElementById("vault-action-status");

  if (vaultTypeSelect) {
    vaultTypeSelect.addEventListener("change", () => {
      const type = vaultTypeSelect.value;
      const isPassword = type === "password";
      vaultSetupLabel.textContent = isPassword ? "Enter password" : "Enter PIN";
      vaultSetupInput.placeholder = isPassword ? "Password" : "Enter PIN";
      vaultSetupConfirm.placeholder = isPassword ? "Confirm password" : "Confirm PIN";
      vaultSetupInput.maxLength = isPassword ? 128 : (type === "pin6" ? 6 : 4);
      vaultSetupConfirm.maxLength = vaultSetupInput.maxLength;
      vaultSetupInput.inputMode = isPassword ? "text" : "numeric";
      vaultSetupConfirm.inputMode = vaultSetupInput.inputMode;
      vaultSetupInput.value = "";
      vaultSetupConfirm.value = "";
    });
  }

  async function loadVaultStatus() {
    try {
      const status = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
      if (status?.enabled) {
        vaultNotConfigured.classList.add("hidden");
        vaultConfigured.classList.remove("hidden");
        const typeNames = { pin4: "4-digit PIN", pin6: "6-digit PIN", password: "Password" };
        vaultTypeDisplay.textContent = "Protected with " + (typeNames[status.type] || status.type);
        vaultStatusBadge.textContent = status.unlocked ? "Unlocked" : "Locked";
        vaultStatusBadge.className = "vault-status-badge " + (status.unlocked ? "vault-unlocked" : "vault-locked");
      } else {
        vaultNotConfigured.classList.remove("hidden");
        vaultConfigured.classList.add("hidden");
      }
    } catch { /* */ }
  }
  loadVaultStatus();

  if (vaultEnableBtn) {
    vaultEnableBtn.addEventListener("click", async () => {
      if (vaultEnableBtn._isChange) return;
      const type = vaultTypeSelect.value;
      const pass = vaultSetupInput.value;
      const confirm_ = vaultSetupConfirm.value;

      if (!pass) { vaultSetupStatus.textContent = "Enter a passcode."; return; }
      if (type !== "password" && !/^\d+$/.test(pass)) { vaultSetupStatus.textContent = "PIN must be digits only."; return; }
      if (type === "pin4" && pass.length !== 4) { vaultSetupStatus.textContent = "PIN must be 4 digits."; return; }
      if (type === "pin6" && pass.length !== 6) { vaultSetupStatus.textContent = "PIN must be 6 digits."; return; }
      if (type === "password" && pass.length < 4) { vaultSetupStatus.textContent = "Password must be at least 4 characters."; return; }
      if (pass !== confirm_) { vaultSetupStatus.textContent = "Entries don't match."; return; }

      vaultEnableBtn.disabled = true;
      vaultSetupStatus.textContent = "Encrypting...";
      try {
        const result = await browser.runtime.sendMessage({ action: "vaultSetup", passcode: pass, type });
        if (result?.success) {
          vaultSetupStatus.textContent = "Encryption enabled!";
          vaultSetupInput.value = "";
          vaultSetupConfirm.value = "";
          loadVaultStatus();
        } else {
          vaultSetupStatus.textContent = "Failed: " + (result.error || "unknown error");
        }
      } catch (e) {
        vaultSetupStatus.textContent = "Error: " + e.message;
      }
      vaultEnableBtn.disabled = false;
    });
  }

  if (vaultLockBtn) {
    vaultLockBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "vaultLock" });
      vaultActionStatus.textContent = "Locked. Reload any Argus page to see the lock screen.";
      loadVaultStatus();
    });
  }

  if (vaultChangeBtn) {
    vaultChangeBtn.addEventListener("click", () => {
      vaultConfigured.classList.add("hidden");
      vaultNotConfigured.classList.remove("hidden");
      vaultSetupStatus.textContent = "";
      vaultEnableBtn.textContent = "Change Passcode";
      vaultEnableBtn._isChange = true;
    });

    vaultEnableBtn?.addEventListener("click", async function changeHandler() {
      if (!vaultEnableBtn._isChange) return;
      const type = vaultTypeSelect.value;
      const pass = vaultSetupInput.value;
      const confirm_ = vaultSetupConfirm.value;

      if (!pass) { vaultSetupStatus.textContent = "Enter a passcode."; return; }
      if (type !== "password" && !/^\d+$/.test(pass)) { vaultSetupStatus.textContent = "PIN must be digits only."; return; }
      if (type === "pin4" && pass.length !== 4) { vaultSetupStatus.textContent = "PIN must be 4 digits."; return; }
      if (type === "pin6" && pass.length !== 6) { vaultSetupStatus.textContent = "PIN must be 6 digits."; return; }
      if (type === "password" && pass.length < 4) { vaultSetupStatus.textContent = "Password too short."; return; }
      if (pass !== confirm_) { vaultSetupStatus.textContent = "Entries don't match."; return; }

      vaultEnableBtn.disabled = true;
      vaultSetupStatus.textContent = "Changing...";
      try {
        const result = await browser.runtime.sendMessage({ action: "vaultChange", passcode: pass, type });
        if (result?.success) {
          vaultSetupStatus.textContent = "Passcode changed!";
          vaultSetupInput.value = "";
          vaultSetupConfirm.value = "";
          vaultEnableBtn.textContent = "Enable Encryption";
          vaultEnableBtn._isChange = false;
          loadVaultStatus();
        }
      } catch (e) {
        vaultSetupStatus.textContent = "Error: " + e.message;
      }
      vaultEnableBtn.disabled = false;
    });
  }

  if (vaultRemoveBtn) {
    vaultRemoveBtn.addEventListener("click", async () => {
      vaultActionStatus.textContent = "Decrypting...";
      try {
        const result = await browser.runtime.sendMessage({ action: "vaultRemove" });
        if (result?.success) {
          vaultActionStatus.textContent = "Encryption removed.";
          loadVaultStatus();
        }
      } catch (e) {
        vaultActionStatus.textContent = "Error: " + e.message;
      }
    });
  }
}

// ──────────────────────────────────────────────
// Import / Export
// ──────────────────────────────────────────────
async function exportSettingsToFile() {
  const data = await browser.storage.local.get(null);
  const exported = {};
  const keepKeys = [
    "defaultProvider", "providers", "maxTokens", "maxInputChars", "temperature",
    "reasoningEffort", "openaiReasoningEffort", "customPresets", "extendedThinking",
    "autoAnalyzeRules", "maxHistorySize"
  ];
  for (const key of keepKeys) {
    if (data[key] !== undefined) exported[key] = data[key];
  }

  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "argus-settings.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  el.importExportStatus.textContent = "Settings exported!";
  setTimeout(() => { el.importExportStatus.textContent = ""; }, 2000);
}

async function importSettingsFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (typeof data !== "object") throw new Error("Invalid file format");

    await browser.storage.local.set(data);
    el.importExportStatus.textContent = "Settings imported! Reloading...";
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    el.importExportStatus.textContent = "Import failed: " + err.message;
    el.importExportStatus.style.color = "var(--error)";
  }

  el.importFile.value = "";
}

// ──────────────────────────────────────────────
// Default Project dropdowns
// ──────────────────────────────────────────────
async function initSettingsProjectDropdowns() {
  try {
    const [projResp, defResp, overrides] = await Promise.all([
      browser.runtime.sendMessage({ action: "getProjects" }),
      browser.runtime.sendMessage({ action: "getDefaultProject" }),
      browser.runtime.sendMessage({ action: "getFeatureProjectOverrides" })
    ]);
    if (!projResp?.success) return;
    const projects = projResp.projects;
    const globalId = defResp?.defaultProjectId || "";
    const monId = overrides?.monitorDefaultProjectId || "";
    const bmId = overrides?.bookmarkDefaultProjectId || "";

    const globalEl = document.getElementById("settings-default-project");
    const monEl = document.getElementById("settings-monitor-project");
    const bmEl = document.getElementById("settings-bookmark-project");

    function fill(sel, value) {
      if (!sel) return;
      while (sel.options.length > 1) sel.remove(1);
      for (const p of projects) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      }
      sel.value = value;
    }

    fill(globalEl, globalId);
    fill(monEl, monId);
    fill(bmEl, bmId);

    if (globalEl) globalEl.addEventListener("change", () => {
      browser.runtime.sendMessage({ action: "setDefaultProject", projectId: globalEl.value || null });
    });
    if (monEl) monEl.addEventListener("change", () => {
      browser.runtime.sendMessage({ action: "setFeatureProjectOverride", key: "monitorDefaultProjectId", projectId: monEl.value || null });
    });
    if (bmEl) bmEl.addEventListener("change", () => {
      browser.runtime.sendMessage({ action: "setFeatureProjectOverride", key: "bookmarkDefaultProjectId", projectId: bmEl.value || null });
    });
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// Home Nav Button config
// ──────────────────────────────────────────────
const HOME_NAV_PAGES = [
  { value: "", label: "— default —" },
  { value: "options/options.html", label: "Console" },
  { value: "osint/graph.html", label: "Knowledge Graph" },
  { value: "satellite/satellite.html", label: "Satellite" },
  { value: "feeds/feeds.html", label: "Feeds" },
  { value: "sources/sources.html", label: "Sources" },
  { value: "projects/projects.html", label: "Projects" },
  { value: "prompts/prompts.html", label: "Prompts" },
  { value: "automations/automations.html", label: "Automations" },
  { value: "settings/settings.html", label: "Settings" },
];

function loadHomeNavDropdowns(settings) {
  for (let i = 1; i <= 3; i++) {
    const sel = document.getElementById(`home-nav-dest-${i}`);
    if (!sel) continue;
    sel.innerHTML = "";
    for (const pg of HOME_NAV_PAGES) {
      const opt = document.createElement("option");
      opt.value = pg.value;
      opt.textContent = pg.label;
      sel.appendChild(opt);
    }
    sel.value = settings[`homeNavDest${i}`] || "";
    sel.addEventListener("change", scheduleSave);
  }
}

// ──────────────────────────────────────────────
// Cloud Backup actions
// ──────────────────────────────────────────────
function initCloudBackup() {
  // Backup Now
  document.getElementById("cloud-backup-now")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("cloud-backup-status");
    statusEl.textContent = "Backing up\u2026";
    try {
      const r = await browser.runtime.sendMessage({ action: "cloudBackupNow" });
      statusEl.textContent = r?.success ? "Backup complete!" : (r?.error || "Backup failed.");
    } catch (e) {
      statusEl.textContent = "Error: " + e.message;
    }
  });

  // Download Local
  document.getElementById("cloud-backup-local")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("cloud-backup-status");
    statusEl.textContent = "Preparing download\u2026";
    try {
      const r = await browser.runtime.sendMessage({ action: "cloudBackupLocal" });
      if (r?.success && r.dataUrl) {
        const a = document.createElement("a");
        a.href = r.dataUrl;
        a.download = r.filename || "argus-backup.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        statusEl.textContent = "Downloaded!";
      } else {
        statusEl.textContent = r?.error || "Download failed.";
      }
    } catch (e) {
      statusEl.textContent = "Error: " + e.message;
    }
  });

  // Restore from file
  document.getElementById("cloud-restore-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById("cloud-backup-status");
    statusEl.textContent = "Restoring\u2026";
    try {
      const buf = await file.arrayBuffer();
      const r = await browser.runtime.sendMessage({ action: "cloudRestoreFromFile", data: Array.from(new Uint8Array(buf)) });
      statusEl.textContent = r?.success ? "Restored! Reloading\u2026" : (r?.error || "Restore failed.");
      if (r?.success) setTimeout(() => location.reload(), 1500);
    } catch (err) {
      statusEl.textContent = "Error: " + err.message;
    }
  });

  // Chat sync toggle
  document.getElementById("chat-sync-enabled")?.addEventListener("change", () => {
    const config = document.getElementById("chat-sync-config");
    if (config) config.style.display = document.getElementById("chat-sync-enabled").checked ? "flex" : "none";
    scheduleSave();
  });

  // Auto-save for cloud / backup controls
  for (const id of [
    "cloud-backup-enabled", "cloud-backup-interval",
    "cloud-sync-metadata", "cloud-sync-snapshots", "cloud-sync-pdfs",
    "chat-sync-provider", "chat-sync-interval", "chat-sync-clear-local",
    "backup-enabled", "backup-interval", "backup-all-providers"
  ]) {
    document.getElementById(id)?.addEventListener("change", scheduleSave);
  }

  // Backup Now (local)
  document.getElementById("backup-now")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("backup-status");
    statusEl.textContent = "Backing up\u2026";
    try {
      const r = await browser.runtime.sendMessage({ action: "localBackupNow" });
      statusEl.textContent = r?.success ? "Backup complete!" : (r?.error || "Backup failed.");
    } catch (e) {
      statusEl.textContent = "Error: " + e.message;
    }
  });
}

// ──────────────────────────────────────────────
// Set as Homepage
// ──────────────────────────────────────────────
function initHomepageButton() {
  const btn = document.getElementById("set-argus-homepage");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const statusEl = document.getElementById("homepage-status");
    try {
      // Build the list of Argus pages to open as homepage
      const pages = [
        "options/options.html",
        "osint/graph.html?mode=global",
      ];
      const urls = pages.map(p => browser.runtime.getURL(p)).join("|");
      // Copy to clipboard for user to paste
      await navigator.clipboard.writeText(urls);
      if (statusEl) statusEl.textContent = "URLs copied! Paste into browser homepage setting.";
      // Open browser preferences
      browser.tabs.create({ url: "about:preferences#home" });
    } catch (e) {
      if (statusEl) statusEl.textContent = "Could not copy: " + e.message;
    }
  });
}

// ──────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────
function attachListeners() {
  // Tracking toggles
  el.trackMyPages?.addEventListener("change", scheduleSave);
  el.trawlEnabled?.addEventListener("change", scheduleSave);
  el.incognitoForceEnabled?.addEventListener("change", scheduleSave);
  el.maxHistory?.addEventListener("change", scheduleSave);

  // Satellite defaults
  document.getElementById("sat-default-location")?.addEventListener("change", scheduleSave);
  document.getElementById("sat-default-zoom")?.addEventListener("change", scheduleSave);
  document.getElementById("sat-default-resolution")?.addEventListener("change", scheduleSave);

  // Incognito add
  el.incognitoAddBtn?.addEventListener("click", addIncognitoSite);
  el.incognitoAddDomain?.addEventListener("keydown", e => {
    if (e.key === "Enter") addIncognitoSite();
  });

  // Reports
  el.openHistory?.addEventListener("click", () => {
    window.location.href = browser.runtime.getURL("history/history.html");
  });
  el.clearHistory?.addEventListener("click", async () => {
    if (!confirm("Clear all analysis history?")) return;
    if (typeof ArgusDB !== "undefined") {
      await ArgusDB.History.clear();
    }
    await browser.storage.local.remove("analysisHistory");
    alert("History cleared.");
  });

  // Import / Export
  el.exportSettings?.addEventListener("click", exportSettingsToFile);
  el.importSettings?.addEventListener("click", () => el.importFile?.click());
  el.importFile?.addEventListener("change", importSettingsFromFile);
}

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Version
  try {
    const manifest = browser.runtime.getManifest();
    if (el.versionNumber) el.versionNumber.textContent = manifest.version;
  } catch { /* */ }

  // Load settings from storage
  await loadSettings();

  // Wire event listeners
  attachListeners();

  // Init trawl schedule/duration controls
  initTrawlScheduleControls();
  initTrawlDurationControls();

  // Init subsystems
  initStorageManagement();
  initUserProfile();
  initVault();
  initCloudBackup();
  initHomepageButton();
  initSettingsProjectDropdowns();
});
