// ──────────────────────────────────────────────
// Data Provider tabs
// ──────────────────────────────────────────────
const DATA_PROVIDER_KEYS = ["gdrive", "dropbox", "webdav", "s3", "github", "xmpp"];

const DEFAULT_DATA_PROVIDERS = {
  gdrive:  { clientId: "", accessToken: "", refreshToken: "", expiresAt: 0, userEmail: "", connected: false },
  dropbox: { appKey: "", accessToken: "", refreshToken: "", expiresAt: 0, userName: "", connected: false },
  webdav:  { serverUrl: "", username: "", password: "", connected: false },
  s3:      { endpoint: "", bucket: "", accessKey: "", secretKey: "", region: "", connected: false },
  github:  { pat: "", repo: "", branch: "main", connected: false },
  xmpp:    { server: "", jid: "", gateway: "", country: "US", connected: false }
};

function selectDataProviderTab(key) {
  currentDataProviderKey = key;
  const tabList = document.getElementById("data-provider-tab-list");
  tabList.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.dprovider === key);
  });
  for (const k of DATA_PROVIDER_KEYS) {
    const panel = document.getElementById(`dp-${k}-fields`);
    if (panel) panel.classList.toggle("hidden", k !== key);
  }
}

function loadDataProviderFields() {
  const g = dataProviders.gdrive || {};
  document.getElementById("dp-gdrive-client-id").value = g.clientId || "";
  document.getElementById("dp-gdrive-folder").value = g.defaultFolder || "";
  updateDpConnectState("gdrive", g);

  // Show redirect URI for Google Drive (identity API only available in background)
  const dpRedirectEl = document.getElementById("dp-gdrive-redirect");
  if (dpRedirectEl) {
    browser.runtime.sendMessage({ action: "cloudGetRedirectURL" }).then(resp => {
      if (resp?.success) dpRedirectEl.textContent = "Redirect URI (add to your GCP OAuth client): " + resp.url;
      else dpRedirectEl.textContent = "Could not get redirect URI: " + (resp?.error || "identity API unavailable");
    }).catch(() => {});
  }

  const d = dataProviders.dropbox || {};
  document.getElementById("dp-dropbox-app-key").value = d.appKey || "";
  updateDpConnectState("dropbox", d);

  const w = dataProviders.webdav || {};
  document.getElementById("dp-webdav-url").value = w.serverUrl || "";
  document.getElementById("dp-webdav-user").value = w.username || "";
  document.getElementById("dp-webdav-pass").value = w.password || "";
  updateDpConnectState("webdav", w);

  const s = dataProviders.s3 || {};
  document.getElementById("dp-s3-endpoint").value = s.endpoint || "";
  document.getElementById("dp-s3-bucket").value = s.bucket || "";
  document.getElementById("dp-s3-access-key").value = s.accessKey || "";
  document.getElementById("dp-s3-secret-key").value = s.secretKey || "";
  document.getElementById("dp-s3-region").value = s.region || "";
  updateDpConnectState("s3", s);

  const gh = dataProviders.github || {};
  document.getElementById("dp-github-pat").value = gh.pat || "";
  document.getElementById("dp-github-repo").value = gh.repo || "";
  document.getElementById("dp-github-branch").value = gh.branch || "main";
  updateDpConnectState("github", gh);

  const xmpp = dataProviders.xmpp || {};
  document.getElementById("dp-xmpp-server").value = xmpp.server || "";
  document.getElementById("dp-xmpp-jid").value = xmpp.jid || "";
  document.getElementById("dp-xmpp-gateway").value = xmpp.gateway || "";
  document.getElementById("dp-xmpp-country").value = xmpp.country || "US";
  // Load XMPP password from Vault
  browser.runtime.sendMessage({ action: "vaultReadSensitive", key: "xmpp-password" }).then(resp => {
    if (resp?.value) document.getElementById("dp-xmpp-password").value = "••••••••";
  }).catch(() => {});
  updateDpConnectState("xmpp", xmpp);

  updateDataProviderTabIndicators();
}

function updateDpConnectState(key, cfg) {
  const statusEl = document.getElementById(`dp-${key}-status`);
  if (key === "gdrive" || key === "dropbox") {
    const connectBtn = document.getElementById(`dp-${key}-connect`);
    const disconnectBtn = document.getElementById(`dp-${key}-disconnect`);
    if (cfg?.connected) {
      connectBtn.classList.add("hidden");
      disconnectBtn.classList.remove("hidden");
      statusEl.className = "dp-status connected";
      statusEl.textContent = key === "gdrive" ? `Connected (${cfg.userEmail || "Google Drive"})` : `Connected (${cfg.userName || "Dropbox"})`;
    } else {
      connectBtn.classList.remove("hidden");
      disconnectBtn.classList.add("hidden");
      statusEl.className = "dp-status";
      statusEl.textContent = "";
    }
  } else {
    if (cfg?.connected) {
      statusEl.className = "dp-status connected";
      if (key === "webdav") statusEl.textContent = `Connected (${cfg.serverUrl || "WebDAV"})`;
      else if (key === "s3") statusEl.textContent = `Connected (${cfg.bucket || "S3"})`;
      else if (key === "github") statusEl.textContent = `Connected (${cfg.repo || "GitHub"})`;
      else if (key === "xmpp") statusEl.textContent = `Connected (${cfg.jid || "XMPP"})`;
    } else {
      statusEl.className = "dp-status";
      statusEl.textContent = "";
    }
  }
}

function saveDataProviderField(key) {
  if (!dataProviders[key]) dataProviders[key] = { ...DEFAULT_DATA_PROVIDERS[key] };
  const dp = dataProviders[key];
  switch (key) {
    case "gdrive":
      dp.clientId = document.getElementById("dp-gdrive-client-id").value.trim();
      dp.defaultFolder = document.getElementById("dp-gdrive-folder").value.trim();
      break;
    case "dropbox":
      dp.appKey = document.getElementById("dp-dropbox-app-key").value.trim();
      break;
    case "webdav":
      dp.serverUrl = document.getElementById("dp-webdav-url").value.trim();
      dp.username = document.getElementById("dp-webdav-user").value.trim();
      dp.password = document.getElementById("dp-webdav-pass").value.trim();
      break;
    case "s3":
      dp.endpoint = document.getElementById("dp-s3-endpoint").value.trim();
      dp.bucket = document.getElementById("dp-s3-bucket").value.trim();
      dp.accessKey = document.getElementById("dp-s3-access-key").value.trim();
      dp.secretKey = document.getElementById("dp-s3-secret-key").value.trim();
      dp.region = document.getElementById("dp-s3-region").value.trim();
      break;
    case "github":
      dp.pat = document.getElementById("dp-github-pat").value.trim();
      dp.repo = document.getElementById("dp-github-repo").value.trim();
      dp.branch = document.getElementById("dp-github-branch").value.trim() || "main";
      break;
    case "xmpp":
      dp.server = document.getElementById("dp-xmpp-server").value.trim();
      dp.jid = document.getElementById("dp-xmpp-jid").value.trim();
      dp.gateway = document.getElementById("dp-xmpp-gateway").value.trim();
      dp.country = document.getElementById("dp-xmpp-country").value;
      // Password is saved separately to Vault (not in dataProviders)
      break;
  }
  updateDataProviderTabIndicators();
  scheduleSave();
}

function updateDataProviderTabIndicators() {
  const tabList = document.getElementById("data-provider-tab-list");
  tabList.querySelectorAll(".tab-btn").forEach(btn => {
    const key = btn.dataset.dprovider;
    const cfg = dataProviders[key];
    let configured = false;
    if (cfg?.connected) {
      configured = true;
    } else {
      switch (key) {
        case "gdrive": configured = !!cfg?.clientId; break;
        case "dropbox": configured = !!cfg?.appKey; break;
        case "webdav": configured = !!(cfg?.serverUrl && cfg?.username); break;
        case "s3": configured = !!(cfg?.endpoint && cfg?.bucket && cfg?.accessKey); break;
        case "github": configured = !!(cfg?.pat && cfg?.repo); break;
        case "xmpp": configured = !!(cfg?.server && cfg?.jid && cfg?.gateway); break;
      }
    }
    btn.classList.toggle("configured", configured);
  });
}

// Map data provider UI keys to CloudProviders backend keys
const DP_KEY_MAP = { gdrive: "google", dropbox: "dropbox", webdav: "webdav", s3: "s3", github: "github" };

async function testDataProviderConnection(key) {
  const statusEl = document.getElementById(`dp-${key}-status`);
  statusEl.className = "dp-status";
  statusEl.textContent = "Testing...";
  saveDataProviderField(key);
  const backendKey = DP_KEY_MAP[key] || key;
  try {
    // For credential-based providers, connect first then test
    const cfg = dataProviders[key];
    let msg;
    if (key === "webdav") {
      msg = { action: "cloudConnect", providerKey: backendKey, url: cfg.serverUrl, username: cfg.username, password: cfg.password };
    } else if (key === "s3") {
      msg = { action: "cloudConnect", providerKey: backendKey, endpoint: cfg.endpoint, bucket: cfg.bucket, accessKey: cfg.accessKey, secretKey: cfg.secretKey, region: cfg.region };
    } else if (key === "github") {
      msg = { action: "cloudConnect", providerKey: backendKey, pat: cfg.pat, repo: cfg.repo, branch: cfg.branch };
    } else {
      msg = { action: "cloudTestConnection", providerKey: backendKey };
    }
    const result = await browser.runtime.sendMessage(msg);
    if (result?.success) {
      dataProviders[key].connected = true;
      statusEl.className = "dp-status connected";
      statusEl.textContent = result.email || result.user || result.repo || "Connected";
      updateDpConnectState(key, dataProviders[key]);
      updateDataProviderTabIndicators();
      updateDefaultProviderStatus();
      scheduleSave();
    } else {
      statusEl.className = "dp-status error";
      statusEl.textContent = result?.error || "Connection failed";
    }
  } catch (err) {
    statusEl.className = "dp-status error";
    statusEl.textContent = err.message || "Connection failed";
  }
}

async function connectOAuthProvider(key) {
  const statusEl = document.getElementById(`dp-${key}-status`);
  statusEl.className = "dp-status";
  statusEl.textContent = "Connecting...";
  saveDataProviderField(key);
  const backendKey = DP_KEY_MAP[key] || key;
  const cfg = dataProviders[key];
  try {
    const msg = {
      action: "cloudConnect",
      providerKey: backendKey,
      clientId: cfg.clientId,
      appKey: cfg.appKey,
    };
    const result = await browser.runtime.sendMessage(msg);
    if (result?.success) {
      dataProviders[key].connected = true;
      if (result.email) dataProviders[key].userEmail = result.email;
      if (result.user) dataProviders[key].userName = result.user;
      updateDpConnectState(key, dataProviders[key]);
      updateDataProviderTabIndicators();
      updateDefaultProviderStatus();
      scheduleSave();
    } else {
      const errMsg = result?.error || "Connection failed";
      statusEl.className = "dp-status error";
      statusEl.textContent = errMsg;
      statusEl.title = errMsg; // Show full error on hover if truncated
      console.error(`[DataProvider] ${key} connect failed:`, errMsg);
    }
  } catch (err) {
    const errMsg = err.message || "Connection failed";
    statusEl.className = "dp-status error";
    statusEl.textContent = errMsg;
    statusEl.title = errMsg;
    console.error(`[DataProvider] ${key} connect error:`, err);
  }
}

function disconnectDataProvider(key) {
  if (!dataProviders[key]) return;
  const backendKey = DP_KEY_MAP[key] || key;
  browser.runtime.sendMessage({ action: "cloudDisconnect", providerKey: backendKey }).catch(() => {});
  const keep = key === "gdrive" ? { clientId: dataProviders[key].clientId } : key === "dropbox" ? { appKey: dataProviders[key].appKey } : {};
  dataProviders[key] = { ...DEFAULT_DATA_PROVIDERS[key], ...keep };
  updateDpConnectState(key, dataProviders[key]);
  updateDataProviderTabIndicators();
  updateDefaultProviderStatus();
  scheduleSave();
}

// ──────────────────────────────────────────────
// Paste Provider tabs
// ──────────────────────────────────────────────
const PASTE_PROVIDER_KEYS = ["gist", "pastebin", "privatebin"];

const DEFAULT_PASTE_PROVIDERS = {
  gist:       { pat: "", username: "", connected: false },
  pastebin:   { apiKey: "", userKey: "", username: "", connected: false },
  privatebin: { url: "", connected: false },
};

let pasteProviders = JSON.parse(JSON.stringify(DEFAULT_PASTE_PROVIDERS));
let currentPasteProviderKey = "gist";

function selectPasteProviderTab(key) {
  currentPasteProviderKey = key;
  const tabList = document.getElementById("paste-provider-tab-list");
  tabList.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.pprovider === key);
  });
  for (const k of PASTE_PROVIDER_KEYS) {
    const panel = document.getElementById(`pp-${k}-fields`);
    if (panel) panel.classList.toggle("hidden", k !== key);
  }
}

function loadPasteProviderFields() {
  const g = pasteProviders.gist || {};
  document.getElementById("pp-gist-pat").value = g.pat || "";
  updatePpStatus("gist", g);

  const p = pasteProviders.pastebin || {};
  document.getElementById("pp-pastebin-api-key").value = p.apiKey || "";
  document.getElementById("pp-pastebin-user").value = p.username || "";
  document.getElementById("pp-pastebin-pass").value = "";
  updatePpStatus("pastebin", p);

  const pb = pasteProviders.privatebin || {};
  document.getElementById("pp-privatebin-url").value = pb.url || "";
  updatePpStatus("privatebin", pb);

  updatePasteProviderTabIndicators();
}

function updatePpStatus(key, cfg) {
  const statusEl = document.getElementById(`pp-${key}-status`);
  if (cfg?.connected) {
    statusEl.className = "dp-status connected";
    if (key === "gist") statusEl.textContent = `Connected (${cfg.username || "GitHub"})`;
    else if (key === "pastebin") statusEl.textContent = `Connected (${cfg.username || "Pastebin"})`;
    else if (key === "privatebin") statusEl.textContent = `Connected (${cfg.url || "PrivateBin"})`;
  } else {
    statusEl.className = "dp-status";
    statusEl.textContent = "";
  }
}

function savePasteProviderField(key) {
  if (!pasteProviders[key]) pasteProviders[key] = { ...DEFAULT_PASTE_PROVIDERS[key] };
  const pp = pasteProviders[key];
  switch (key) {
    case "gist":
      pp.pat = document.getElementById("pp-gist-pat").value.trim();
      break;
    case "pastebin":
      pp.apiKey = document.getElementById("pp-pastebin-api-key").value.trim();
      pp.username = document.getElementById("pp-pastebin-user").value.trim();
      break;
    case "privatebin":
      pp.url = document.getElementById("pp-privatebin-url").value.trim();
      break;
  }
  updatePasteProviderTabIndicators();
  scheduleSave();
}

function updatePasteProviderTabIndicators() {
  const tabList = document.getElementById("paste-provider-tab-list");
  if (!tabList) return;
  tabList.querySelectorAll(".tab-btn").forEach(btn => {
    const key = btn.dataset.pprovider;
    const cfg = pasteProviders[key];
    let configured = false;
    if (cfg?.connected) {
      configured = true;
    } else {
      switch (key) {
        case "gist": configured = !!cfg?.pat; break;
        case "pastebin": configured = !!cfg?.apiKey; break;
        case "privatebin": configured = !!cfg?.url; break;
      }
    }
    btn.classList.toggle("configured", configured);
  });
}

async function testPasteProviderConnection(key) {
  const statusEl = document.getElementById(`pp-${key}-status`);
  statusEl.className = "dp-status";
  statusEl.textContent = "Testing...";
  savePasteProviderField(key);
  const cfg = pasteProviders[key];
  try {
    let msg;
    if (key === "gist") {
      msg = { action: "cloudConnect", providerKey: "gist", pat: cfg.pat };
    } else if (key === "pastebin") {
      const pass = document.getElementById("pp-pastebin-pass").value.trim();
      msg = { action: "cloudConnect", providerKey: "pastebin", apiKey: cfg.apiKey, username: cfg.username, password: pass };
    } else if (key === "privatebin") {
      msg = { action: "cloudConnect", providerKey: "privatebin", url: cfg.url };
    }
    const result = await browser.runtime.sendMessage(msg);
    if (result?.success) {
      pasteProviders[key].connected = true;
      if (result.user) pasteProviders[key].username = result.user;
      updatePpStatus(key, pasteProviders[key]);
      updatePasteProviderTabIndicators();
      updateDefaultProviderStatus();
      scheduleSave();
    } else {
      statusEl.className = "dp-status error";
      statusEl.textContent = result?.error || "Connection failed";
    }
  } catch (err) {
    statusEl.className = "dp-status error";
    statusEl.textContent = err.message || "Connection failed";
  }
}

// ──────────────────────────────────────────────
// Storage Management
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Cloud Backup UI
// ──────────────────────────────────────────────

function initCloudBackup() {
  // "Go to Providers tab" link
  const gotoProviders = document.getElementById("cloud-goto-providers");
  if (gotoProviders) {
    gotoProviders.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('.nav-tab[data-tab="providers"]')?.click();
    });
  }

  // Settings tab jump links → Providers tab
  document.querySelectorAll("[data-goto-tab]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = el.dataset.gotoTab;
      const anchor = el.dataset.gotoAnchor;
      document.querySelector(`.nav-tab[data-tab="${tab}"]`)?.click();
      if (anchor) {
        setTimeout(() => {
          document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    });
  });

  // Show connected providers summary
  refreshCloudStatus(); updateConsoleStatusStrip();
  // Update default provider info on Settings tab
  updateDefaultProviderStatus();

  // Backup Now
  document.getElementById("cloud-backup-now").addEventListener("click", async () => {
    const statusEl = document.getElementById("cloud-backup-status");
    statusEl.textContent = "Creating backup...";
    const resp = await browser.runtime.sendMessage({ action: "cloudBackupNow" });
    if (resp?.success) {
      const providers = Object.entries(resp.results || {}).filter(([,v]) => v.success).map(([k]) => k);
      statusEl.textContent = providers.length
        ? `Backed up to: ${providers.join(", ")} (${(resp.size / 1024).toFixed(1)} KB)`
        : `Backup created (${(resp.size / 1024).toFixed(1)} KB) but no providers connected`;
      statusEl.style.color = "var(--success)";
    } else {
      statusEl.textContent = "Backup failed: " + (resp?.error || "unknown");
      statusEl.style.color = "var(--error)";
    }
    refreshCloudStatus(); updateConsoleStatusStrip();
  });

  // Download Local Backup
  document.getElementById("cloud-backup-local").addEventListener("click", async () => {
    const statusEl = document.getElementById("cloud-backup-status");
    statusEl.textContent = "Creating local backup...";
    const resp = await browser.runtime.sendMessage({ action: "cloudLocalBackup" });
    if (resp?.success) {
      const binary = atob(resp.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = resp.filename; a.click();
      URL.revokeObjectURL(url);
      statusEl.textContent = `Downloaded ${resp.filename}`;
      statusEl.style.color = "var(--success)";
    } else {
      statusEl.textContent = "Failed: " + (resp?.error || "unknown");
      statusEl.style.color = "var(--error)";
    }
  });

  // Restore from File
  document.getElementById("cloud-restore-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm("This will replace ALL local data with the backup. Continue?")) return;
    const statusEl = document.getElementById("cloud-backup-status");
    statusEl.textContent = "Restoring...";
    const buffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const resp = await browser.runtime.sendMessage({ action: "cloudLocalRestore", data: base64 });
    if (resp?.success) {
      statusEl.textContent = "Restore complete! Reloading...";
      statusEl.style.color = "var(--success)";
      setTimeout(() => location.reload(), 1500);
    } else {
      statusEl.textContent = "Restore failed: " + (resp?.error || "unknown");
      statusEl.style.color = "var(--error)";
    }
  });

  // Cloud Restore
  document.getElementById("cloud-restore-list").addEventListener("click", async () => {
    const provider = document.getElementById("cloud-restore-provider").value;
    if (!provider) return;
    const resp = await browser.runtime.sendMessage({ action: "cloudListBackups", providerKey: provider });
    const select = document.getElementById("cloud-restore-select");
    select.innerHTML = "";
    if (resp?.success && resp.files.length) {
      resp.files.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.name;
        opt.textContent = `${f.name} (${(f.size / 1024).toFixed(1)} KB) — ${f.date || ""}`;
        select.appendChild(opt);
      });
      select.classList.remove("hidden");
      document.getElementById("cloud-restore-go").classList.remove("hidden");
    } else {
      select.classList.add("hidden");
      document.getElementById("cloud-backup-status").textContent = "No backups found on this provider";
    }
  });
  document.getElementById("cloud-restore-go").addEventListener("click", async () => {
    const provider = document.getElementById("cloud-restore-provider").value;
    const filename = document.getElementById("cloud-restore-select").value;
    if (!provider || !filename) return;
    if (!confirm("This will replace ALL local data with the backup. Continue?")) return;
    const statusEl = document.getElementById("cloud-backup-status");
    statusEl.textContent = "Downloading and restoring...";
    const resp = await browser.runtime.sendMessage({ action: "cloudRestore", providerKey: provider, filename });
    if (resp?.success) {
      statusEl.textContent = "Restore complete! Reloading...";
      statusEl.style.color = "var(--success)";
      setTimeout(() => location.reload(), 1500);
    } else {
      statusEl.textContent = "Restore failed: " + (resp?.error || "unknown");
      statusEl.style.color = "var(--error)";
    }
  });

  // Schedule settings
  const enabledCb = document.getElementById("cloud-backup-enabled");
  const intervalSel = document.getElementById("cloud-backup-interval");
  browser.storage.local.get({ cloudBackupEnabled: false, cloudBackupIntervalHours: 24 }).then(data => {
    enabledCb.checked = data.cloudBackupEnabled;
    intervalSel.value = String(data.cloudBackupIntervalHours);
  });
  const saveSchedule = async () => {
    const enabled = enabledCb.checked;
    const hours = parseInt(intervalSel.value, 10);
    await browser.storage.local.set({ cloudBackupEnabled: enabled, cloudBackupIntervalHours: hours });
    // Update alarm in background
    if (enabled) {
      await browser.runtime.sendMessage({ action: "cloudSetSchedule", enabled: true, hours });
    }
  };
  enabledCb.addEventListener("change", saveSchedule);
  intervalSel.addEventListener("change", saveSchedule);

  // Cloud sync toggles
  const syncMetaCb = document.getElementById("cloud-sync-metadata");
  const syncSnapCb = document.getElementById("cloud-sync-snapshots");
  const syncPdfCb = document.getElementById("cloud-sync-pdfs");
  browser.storage.local.get({ cloudSyncMetadata: true, cloudSyncSnapshots: true, cloudSyncPdfs: true }).then(data => {
    syncMetaCb.checked = data.cloudSyncMetadata;
    syncSnapCb.checked = data.cloudSyncSnapshots;
    syncPdfCb.checked = data.cloudSyncPdfs;
  });
  const saveSyncOpts = () => browser.storage.local.set({
    cloudSyncMetadata: syncMetaCb.checked,
    cloudSyncSnapshots: syncSnapCb.checked,
    cloudSyncPdfs: syncPdfCb.checked,
  });
  syncMetaCb.addEventListener("change", saveSyncOpts);
  syncSnapCb.addEventListener("change", saveSyncOpts);
  syncPdfCb.addEventListener("change", saveSyncOpts);

  // Chat session sync settings
  const chatSyncEnabledCb   = document.getElementById("chat-sync-enabled");
  const chatSyncProviderSel = document.getElementById("chat-sync-provider");
  const chatSyncIntervalSel = document.getElementById("chat-sync-interval");
  const chatSyncClearCb     = document.getElementById("chat-sync-clear-local");
  const chatSyncConfigEl    = document.getElementById("chat-sync-config");

  browser.storage.local.get({
    chatSyncEnabled: false, chatSyncProvider: "all", chatSyncInterval: 5, chatSyncClearLocal: false
  }).then(d => {
    chatSyncEnabledCb.checked   = d.chatSyncEnabled;
    chatSyncProviderSel.value   = d.chatSyncProvider;
    chatSyncIntervalSel.value   = String(d.chatSyncInterval);
    chatSyncClearCb.checked     = d.chatSyncClearLocal;
    chatSyncConfigEl.style.display = d.chatSyncEnabled ? "flex" : "none";
  });

  const saveChatSyncSettings = () => browser.storage.local.set({
    chatSyncEnabled:   chatSyncEnabledCb.checked,
    chatSyncProvider:  chatSyncProviderSel.value,
    chatSyncInterval:  parseInt(chatSyncIntervalSel.value, 10),
    chatSyncClearLocal: chatSyncClearCb.checked,
  });

  chatSyncEnabledCb.addEventListener("change", () => {
    chatSyncConfigEl.style.display = chatSyncEnabledCb.checked ? "flex" : "none";
    saveChatSyncSettings();
  });
  chatSyncProviderSel.addEventListener("change", saveChatSyncSettings);
  chatSyncIntervalSel.addEventListener("change", saveChatSyncSettings);
  chatSyncClearCb.addEventListener("change", saveChatSyncSettings);

  refreshCloudStatus(); updateConsoleStatusStrip();
}
async function refreshCloudStatus() {
  const resp = await browser.runtime.sendMessage({ action: "cloudGetStatus" });
  if (!resp?.success) return;
  const providers = resp.providers || {};
  const names = { google: "Google Drive", dropbox: "Dropbox", webdav: "WebDAV", s3: "S3", github: "GitHub" };
  const connected = Object.entries(providers).filter(([, v]) => v).map(([k]) => names[k] || k);
  const summaryEl = document.getElementById("cloud-connected-summary");
  if (summaryEl) {
    summaryEl.textContent = connected.length
      ? "Connected: " + connected.join(", ")
      : "No cloud providers connected. Set up providers on the Providers tab.";
    summaryEl.style.color = connected.length ? "var(--success)" : "var(--text-muted)";
  }
  // Show restore section if any provider connected
  const anyConnected = connected.length > 0;
  const restoreSection = document.getElementById("cloud-restore-section");
  if (restoreSection) restoreSection.classList.toggle("hidden", !anyConnected);
  // Last backup
  if (resp.lastBackup) {
    const d = new Date(resp.lastBackup.date);
    const lastEl = document.getElementById("cloud-last-backup");
    if (lastEl) lastEl.textContent = `Last backup: ${d.toLocaleString()} (${(resp.lastBackup.size / 1024).toFixed(1)} KB)`;
  }
}


// ──────────────────────────────────────────────
// Cloud/Data/Paste provider event listeners
// Extracted from attachListeners() — called during init
// ──────────────────────────────────────────────
function initCloudProviderListeners() {
  // Data provider tabs
  document.getElementById("data-provider-tab-list").querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => selectDataProviderTab(btn.dataset.dprovider));
  });
  // Data provider field inputs — auto-save on change
  for (const id of ["dp-gdrive-client-id", "dp-gdrive-folder", "dp-dropbox-app-key", "dp-webdav-url", "dp-webdav-user", "dp-webdav-pass",
    "dp-s3-endpoint", "dp-s3-bucket", "dp-s3-access-key", "dp-s3-secret-key", "dp-s3-region",
    "dp-github-pat", "dp-github-repo", "dp-github-branch",
    "dp-xmpp-server", "dp-xmpp-jid", "dp-xmpp-gateway", "dp-xmpp-country"]) {
    const input = document.getElementById(id);
    if (input) {
      const key = id.split("-")[1]; // gdrive, dropbox, webdav, s3, github
      input.addEventListener("input", () => saveDataProviderField(key));
    }
  }
  // OAuth connect/disconnect buttons
  document.getElementById("dp-gdrive-connect").addEventListener("click", () => connectOAuthProvider("gdrive"));
  document.getElementById("dp-gdrive-disconnect").addEventListener("click", () => disconnectDataProvider("gdrive"));
  document.getElementById("dp-dropbox-connect").addEventListener("click", () => connectOAuthProvider("dropbox"));
  document.getElementById("dp-dropbox-disconnect").addEventListener("click", () => disconnectDataProvider("dropbox"));
  // Test connection buttons
  document.getElementById("dp-webdav-test").addEventListener("click", () => testDataProviderConnection("webdav"));
  document.getElementById("dp-s3-test").addEventListener("click", () => testDataProviderConnection("s3"));
  document.getElementById("dp-github-test").addEventListener("click", () => testDataProviderConnection("github"));
  // XMPP test + password save
  document.getElementById("dp-xmpp-test").addEventListener("click", async () => {
    const statusEl = document.getElementById("dp-xmpp-status");
    statusEl.className = "dp-status";
    statusEl.textContent = "Testing...";
    saveDataProviderField("xmpp");
    // Save password to Vault if changed
    const pwField = document.getElementById("dp-xmpp-password");
    if (pwField.value && pwField.value !== "••••••••") {
      await browser.runtime.sendMessage({ action: "vaultWriteSensitive", key: "xmpp-password", value: pwField.value });
      pwField.value = "••••••••";
    }
    try {
      const resp = await browser.runtime.sendMessage({ action: "xmppTestConnection" });
      if (resp?.success) {
        statusEl.className = "dp-status connected";
        statusEl.textContent = resp.message || "Connected!";
        dataProviders.xmpp = dataProviders.xmpp || {};
        dataProviders.xmpp.connected = true;
        updateDataProviderTabIndicators();
        scheduleSave();
      } else {
        statusEl.className = "dp-status error";
        statusEl.textContent = resp?.error || "Connection failed";
      }
    } catch (e) {
      statusEl.className = "dp-status error";
      statusEl.textContent = e.message;
    }
  });
  document.getElementById("dp-xmpp-password").addEventListener("change", async () => {
    const pwField = document.getElementById("dp-xmpp-password");
    if (pwField.value && pwField.value !== "••••••••") {
      await browser.runtime.sendMessage({ action: "vaultWriteSensitive", key: "xmpp-password", value: pwField.value });
      pwField.value = "••••••••";
    }
  });
  // Paste provider tabs
  document.getElementById("paste-provider-tab-list").querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => selectPasteProviderTab(btn.dataset.pprovider));
  });
  // Paste provider field inputs — auto-save on change
  for (const id of ["pp-gist-pat", "pp-pastebin-api-key", "pp-pastebin-user", "pp-privatebin-url"]) {
    const input = document.getElementById(id);
    if (input) {
      const key = id.split("-")[1]; // gist, pastebin, privatebin
      input.addEventListener("input", () => savePasteProviderField(key));
    }
  }
  // Paste provider test buttons
  document.getElementById("pp-gist-test").addEventListener("click", () => testPasteProviderConnection("gist"));
  document.getElementById("pp-pastebin-test").addEventListener("click", () => testPasteProviderConnection("pastebin"));
  document.getElementById("pp-privatebin-test").addEventListener("click", () => testPasteProviderConnection("privatebin"));
  // Default provider selectors
  document.getElementById("default-cloud-provider").addEventListener("change", () => { scheduleSave(); updateDefaultProviderStatus(); });
  document.getElementById("default-paste-provider").addEventListener("change", () => { scheduleSave(); updateDefaultProviderStatus(); });
  updateDefaultProviderStatus();
  // Backup schedule
  document.getElementById("backup-enabled").addEventListener("change", scheduleSave);
  document.getElementById("backup-interval").addEventListener("change", scheduleSave);
  document.getElementById("backup-all-providers").addEventListener("change", scheduleSave);
  document.getElementById("backup-now").addEventListener("click", async () => {
    const statusEl = document.getElementById("backup-status");
    statusEl.textContent = "Starting backup...";
    try {
      const result = await browser.runtime.sendMessage({ action: "backupNow" });
      statusEl.className = "dp-status" + (result?.success ? " connected" : " error");
      statusEl.textContent = result?.success ? `Backup complete (${result.message || "done"})` : (result?.error || "Backup failed");
    } catch (err) {
      statusEl.className = "dp-status error";
      statusEl.textContent = err.message || "Backup failed";
    }
  });
}
