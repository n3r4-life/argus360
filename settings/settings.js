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
// Unified Profile & Security System
// ──────────────────────────────────────────────

function _profileSetStatus(section, msg, type) {
  const map = {
    create: "profile-create-status",
    login: "profile-login-status",
    unlock: "profile-unlock-status",
    changepin: "profile-change-pin-status",
  };
  const el = document.getElementById(map[section]);
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === "error" ? "var(--error)" : type === "success" ? "var(--success)" : "var(--text-muted)";
}

function _updateRibbonBadge(name) {
  const badge = document.getElementById("ribbon-profile-badge");
  if (badge) {
    badge.textContent = name === "guest" ? "Guest" : name;
    badge.style.color = name === "guest" ? "#5a5a78" : "var(--accent)";
  }
}

async function renderProfileState() {
  const { argusProfiles, argusActiveProfile } = await browser.storage.local.get(["argusProfiles", "argusActiveProfile"]);
  const profiles = argusProfiles || {};
  const active = argusActiveProfile || "guest";
  const namedProfiles = Object.keys(profiles).filter(n => n !== "guest");

  // Update ribbon badge
  _updateRibbonBadge(active);

  // Hide all states
  for (const id of ["profile-guest", "profile-login", "profile-active", "profile-locked"]) {
    document.getElementById(id)?.classList.add("hidden");
  }

  // Update status badge
  const badge = document.getElementById("profile-status-badge");

  if (active === "guest") {
    if (badge) { badge.textContent = "Guest"; badge.style.color = "var(--text-muted)"; }
    if (namedProfiles.length > 0) {
      // Named profiles exist — show login dropdown so user can sign into them
      const sel = document.getElementById("profile-select");
      if (sel) sel.innerHTML = namedProfiles.map(n => `<option value="${n}">${n}</option>`).join("");
      document.getElementById("profile-login")?.classList.remove("hidden");
    } else {
      // No named profiles — show create form
      document.getElementById("profile-guest")?.classList.remove("hidden");
    }
    return;
  }

  // Named profile active — check vault status
  try {
    const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
    if (vaultStatus?.unlocked) {
      if (badge) { badge.textContent = active + " \u00b7 Unlocked"; badge.style.color = "var(--success)"; }
      document.getElementById("profile-active-name").textContent = active;
      document.getElementById("profile-active")?.classList.remove("hidden");
    } else {
      if (badge) { badge.textContent = active + " \u00b7 Locked"; badge.style.color = "var(--error)"; }
      document.getElementById("profile-locked-name").textContent = active;
      document.getElementById("profile-locked")?.classList.remove("hidden");
    }
  } catch {
    // If vault not enabled, treat as unlocked
    if (badge) { badge.textContent = active + " \u00b7 Unlocked"; badge.style.color = "var(--success)"; }
    document.getElementById("profile-active-name").textContent = active;
    document.getElementById("profile-active")?.classList.remove("hidden");
  }
}

function initProfile() {
  // ── PIN type selector updates maxlength on inputs ──
  const typeSelect = document.getElementById("profile-new-type");
  const pinInput = document.getElementById("profile-new-pin");
  const pinConfirm = document.getElementById("profile-new-pin-confirm");
  if (typeSelect && pinInput && pinConfirm) {
    typeSelect.addEventListener("change", () => {
      const type = typeSelect.value;
      const isPassword = type === "password";
      const maxLen = isPassword ? 128 : (type === "pin6" ? 6 : 4);
      pinInput.maxLength = maxLen;
      pinConfirm.maxLength = maxLen;
      pinInput.placeholder = isPassword ? "Enter password" : "Enter PIN";
      pinConfirm.placeholder = isPassword ? "Confirm password" : "Confirm";
      pinInput.inputMode = isPassword ? "text" : "numeric";
      pinConfirm.inputMode = isPassword ? "text" : "numeric";
      pinInput.value = "";
      pinConfirm.value = "";
    });
  }

  // ── Create Profile ──
  document.getElementById("profile-create-btn")?.addEventListener("click", async () => {
    const username = document.getElementById("profile-new-username").value.trim();
    const type = document.getElementById("profile-new-type").value;
    const pin = document.getElementById("profile-new-pin").value;
    const confirm_ = document.getElementById("profile-new-pin-confirm").value;
    if (!username) { _profileSetStatus("create", "Username required", "error"); return; }
    if (!pin) { _profileSetStatus("create", "PIN required", "error"); return; }
    if (type !== "password" && !/^\d+$/.test(pin)) { _profileSetStatus("create", "PIN must be digits only", "error"); return; }
    if (type === "pin4" && pin.length !== 4) { _profileSetStatus("create", "PIN must be 4 digits", "error"); return; }
    if (type === "pin6" && pin.length !== 6) { _profileSetStatus("create", "PIN must be 6 digits", "error"); return; }
    if (type === "password" && pin.length < 4) { _profileSetStatus("create", "Password must be at least 4 characters", "error"); return; }
    if (pin !== confirm_) { _profileSetStatus("create", "PINs don't match", "error"); return; }

    _profileSetStatus("create", "Creating\u2026", "info");
    const resp = await browser.runtime.sendMessage({
      action: "profileCreate", username, passcode: pin, type
    });
    if (resp?.success) {
      _profileSetStatus("create", "Profile created!", "success");
      setTimeout(() => { renderProfileState(); _updateRibbonBadge(username); }, 500);
    } else {
      _profileSetStatus("create", resp?.error || "Failed", "error");
    }
  });

  // ── Sign In ──
  document.getElementById("profile-signin-btn")?.addEventListener("click", async () => {
    const username = document.getElementById("profile-select").value;
    const pin = document.getElementById("profile-login-pin").value;
    if (!pin) { _profileSetStatus("login", "Enter your PIN", "error"); return; }
    _profileSetStatus("login", "Signing in\u2026", "info");
    const resp = await browser.runtime.sendMessage({
      action: "profileSignIn", username, passcode: pin
    });
    if (resp?.success) {
      document.getElementById("profile-login-pin").value = "";
      renderProfileState();
    } else {
      _profileSetStatus("login", resp?.error || "Incorrect PIN", "error");
    }
  });

  // ── Continue as Guest (from login screen) ──
  document.getElementById("profile-guest-btn")?.addEventListener("click", async () => {
    await browser.runtime.sendMessage({ action: "profileSignOut" }); // falls back to guest
    renderProfileState();
  });

  // ── Continue as Guest (from locked screen) ──
  document.getElementById("profile-guest-locked-btn")?.addEventListener("click", async () => {
    await browser.runtime.sendMessage({ action: "profileSignOut" });
    renderProfileState();
  });

  // ── New Profile (from login screen) ──
  document.getElementById("profile-new-btn")?.addEventListener("click", () => {
    document.getElementById("profile-login")?.classList.add("hidden");
    document.getElementById("profile-guest")?.classList.remove("hidden");
  });

  // ── Delete Profile ──
  document.getElementById("profile-delete-btn")?.addEventListener("click", async () => {
    const { argusActiveProfile } = await browser.storage.local.get("argusActiveProfile");
    if (!argusActiveProfile) return;
    if (!confirm(`Delete profile "${argusActiveProfile}"? This permanently removes all encrypted credentials for this profile.`)) return;
    const passcode = prompt(`Enter your PIN/password to confirm deletion of "${argusActiveProfile}":`);
    if (!passcode) return;
    const resp = await browser.runtime.sendMessage({ action: "profileDelete", username: argusActiveProfile, passcode });
    if (resp?.success) {
      renderProfileState();
    } else {
      _profileSetStatus("active", resp?.error || "Delete failed", "var(--error)");
    }
  });

  // ── Sign Out ──
  document.getElementById("profile-signout-btn")?.addEventListener("click", async () => {
    await browser.runtime.sendMessage({ action: "profileSignOut" });
    renderProfileState();
  });

  // ── Lock ──
  document.getElementById("profile-lock-btn")?.addEventListener("click", async () => {
    await browser.runtime.sendMessage({ action: "profileLock" });
    renderProfileState();
  });

  // ── Unlock ──
  document.getElementById("profile-unlock-btn")?.addEventListener("click", async () => {
    const pin = document.getElementById("profile-unlock-pin").value;
    if (!pin) { _profileSetStatus("unlock", "Enter your PIN", "error"); return; }
    const resp = await browser.runtime.sendMessage({
      action: "profileUnlock", passcode: pin
    });
    if (resp?.success) {
      document.getElementById("profile-unlock-pin").value = "";
      renderProfileState();
    } else {
      _profileSetStatus("unlock", resp?.error || "Incorrect PIN", "error");
    }
  });

  // ── Unlock on Enter key ──
  document.getElementById("profile-unlock-pin")?.addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("profile-unlock-btn")?.click();
  });
  document.getElementById("profile-login-pin")?.addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("profile-signin-btn")?.click();
  });

  // ── Switch Profile (from active state) ──
  document.getElementById("profile-switch-btn")?.addEventListener("click", async () => {
    // Lock current profile first
    await browser.runtime.sendMessage({ action: "profileLock" });
    // Show login with profile list
    const { argusProfiles } = await browser.storage.local.get("argusProfiles");
    const namedProfiles = Object.keys(argusProfiles || {}).filter(n => n !== "guest");
    const sel = document.getElementById("profile-select");
    if (sel) sel.innerHTML = namedProfiles.map(n => `<option value="${n}">${n}</option>`).join("");
    for (const id of ["profile-guest", "profile-active", "profile-locked"]) {
      document.getElementById(id)?.classList.add("hidden");
    }
    document.getElementById("profile-login")?.classList.remove("hidden");
  });

  // ── Switch Profile (from locked state) ──
  document.getElementById("profile-switch-locked-btn")?.addEventListener("click", async () => {
    // Show login with profile list (already locked)
    const { argusProfiles } = await browser.storage.local.get("argusProfiles");
    const namedProfiles = Object.keys(argusProfiles || {}).filter(n => n !== "guest");
    const sel = document.getElementById("profile-select");
    if (sel) sel.innerHTML = namedProfiles.map(n => `<option value="${n}">${n}</option>`).join("");
    for (const id of ["profile-guest", "profile-active", "profile-locked"]) {
      document.getElementById(id)?.classList.add("hidden");
    }
    document.getElementById("profile-login")?.classList.remove("hidden");
  });

  // ── Change PIN ──
  document.getElementById("profile-change-pin-btn")?.addEventListener("click", () => {
    document.getElementById("profile-change-pin-form")?.classList.toggle("hidden");
  });

  document.getElementById("profile-change-pin-cancel")?.addEventListener("click", () => {
    document.getElementById("profile-change-pin-form")?.classList.add("hidden");
    document.getElementById("profile-change-new-pin").value = "";
    document.getElementById("profile-change-confirm-pin").value = "";
    _profileSetStatus("changepin", "", "");
  });

  document.getElementById("profile-change-pin-save")?.addEventListener("click", async () => {
    const newPin = document.getElementById("profile-change-new-pin").value;
    const confirmPin = document.getElementById("profile-change-confirm-pin").value;
    if (!newPin) { _profileSetStatus("changepin", "Enter new PIN", "error"); return; }
    if (newPin !== confirmPin) { _profileSetStatus("changepin", "PINs don't match", "error"); return; }
    _profileSetStatus("changepin", "Changing\u2026", "info");
    const resp = await browser.runtime.sendMessage({
      action: "profileChangePIN", passcode: newPin, type: null
    });
    if (resp?.success) {
      _profileSetStatus("changepin", "PIN changed!", "success");
      document.getElementById("profile-change-new-pin").value = "";
      document.getElementById("profile-change-confirm-pin").value = "";
      setTimeout(() => document.getElementById("profile-change-pin-form")?.classList.add("hidden"), 1200);
    } else {
      _profileSetStatus("changepin", resp?.error || "Failed", "error");
    }
  });

  // Initial render
  renderProfileState();
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
// Vault / Security — REMOVED (merged into initProfile above)
// Old initVault() function removed — vault is now managed through
// the unified profile system. Vault backend handlers (vaultGetStatus,
// vaultUnlock, vaultLock, etc.) remain in background.js for backward
// compatibility with ribbon lock screen and credential backup.
// ──────────────────────────────────────────────

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
  initProfile();
  initCloudBackup();
  initHomepageButton();
  initSettingsProjectDropdowns();
});
