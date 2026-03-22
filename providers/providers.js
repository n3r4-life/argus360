// ──────────────────────────────────────────────
// providers.js — standalone Providers page
// Extracted from options-core.js, options-ai.js,
// options-cloud.js, options-providers.js
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Provider constants
// ──────────────────────────────────────────────
const PROVIDER_HINTS = {
  xai: { url: "https://console.x.ai", text: "console.x.ai" },
  openai: { url: "https://platform.openai.com/api-keys", text: "platform.openai.com" },
  anthropic: { url: "https://console.anthropic.com", text: "console.anthropic.com" },
  gemini: { url: "https://aistudio.google.com/apikey", text: "aistudio.google.com" }
};

const PROVIDER_MODELS = {
  xai: {
    "grok-4-0709": "Grok 4",
    "grok-4-1-fast-reasoning": "Grok 4.1 Fast Reasoning",
    "grok-4-1-fast-non-reasoning": "Grok 4.1 Fast Non-Reasoning",
    "grok-4.20-multi-agent-experimental-beta-0304": "Grok 4.20 Multi-Agent (Swarm)",
    "grok-4.20-experimental-beta-0304-reasoning": "Grok 4.20 Reasoning",
    "grok-4.20-experimental-beta-0304-non-reasoning": "Grok 4.20 Non-Reasoning",
    "grok-3": "Grok 3",
    "grok-3-fast": "Grok 3 Fast",
    "grok-3-mini": "Grok 3 Mini",
    "grok-2": "Grok 2"
  },
  openai: {
    "gpt-4.1": "GPT-4.1",
    "gpt-4.1-mini": "GPT-4.1 Mini",
    "gpt-4.1-nano": "GPT-4.1 Nano",
    "o3": "o3",
    "o3-mini": "o3 Mini",
    "o4-mini": "o4 Mini",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini"
  },
  anthropic: {
    "claude-opus-4-6": "Claude Opus 4.6",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "claude-sonnet-4-5-20250514": "Claude Sonnet 4.5",
    "claude-3-5-haiku-20241022": "Claude 3.5 Haiku"
  },
  gemini: {
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-2.0-flash-lite": "Gemini 2.0 Flash Lite"
  },
  custom: {}
};

const DEFAULT_MODELS = {
  xai: "grok-4-0709",
  openai: "gpt-4.1",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-2.5-flash",
  custom: ""
};

// ──────────────────────────────────────────────
// Data Provider defaults
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

// ──────────────────────────────────────────────
// Paste Provider defaults
// ──────────────────────────────────────────────
const PASTE_PROVIDER_KEYS = ["gist", "pastebin", "privatebin"];

const DEFAULT_PASTE_PROVIDERS = {
  gist:       { pat: "", username: "", connected: false },
  pastebin:   { apiKey: "", userKey: "", username: "", connected: false },
  privatebin: { url: "", connected: false },
};

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
let currentProviderKey = "xai";
let currentDataProviderKey = "gdrive";
let currentPasteProviderKey = "gist";
let providers = {};
let dataProviders = {};
let pasteProviders = JSON.parse(JSON.stringify(DEFAULT_PASTE_PROVIDERS));
let saveTimeout = null;

// ──────────────────────────────────────────────
// DOM refs
// ──────────────────────────────────────────────
const el = {
  defaultProvider: document.getElementById("default-provider"),
  providerTabList: document.getElementById("provider-tab-list"),
  providerApiKey: document.getElementById("provider-api-key"),
  toggleKeyVis: document.getElementById("toggle-key-vis"),
  providerModel: document.getElementById("provider-model"),
  providerKeyHint: document.getElementById("provider-key-hint"),
  providerStatus: document.getElementById("provider-status"),
  maxTokens: document.getElementById("max-tokens"),
  maxInputChars: document.getElementById("max-input-chars"),
  temperature: document.getElementById("temperature"),
  tempValue: document.getElementById("temp-value"),
  showBadge: document.getElementById("show-badge"),
  responseLanguage: document.getElementById("response-language"),
  openaiReasoningEffort: document.getElementById("openai-reasoning-effort"),
  openaiReasoningHint: document.getElementById("openai-reasoning-hint"),
  openaiReasoningCard: document.getElementById("openai-reasoning-card"),
  saveIndicator: document.getElementById("save-indicator"),
  extendedThinkingEnabled: document.getElementById("extended-thinking-enabled"),
  thinkingBudget: document.getElementById("thinking-budget"),
  thinkingBudgetHint: document.getElementById("thinking-budget-hint"),
  multiAgentCard: document.getElementById("multi-agent-card"),
};

// ──────────────────────────────────────────────
// Save / Load — provider-scoped only
// ──────────────────────────────────────────────
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveProviderSettings, 400);
}

function flashSaved() {
  el.saveIndicator.classList.remove("hidden");
  setTimeout(() => el.saveIndicator.classList.add("hidden"), 1500);
}

async function saveProviderSettings() {
  await browser.storage.local.set({
    defaultProvider: el.defaultProvider.value,
    providers,
    maxTokens: parseInt(el.maxTokens.value, 10) || 2048,
    maxInputChars: parseInt(el.maxInputChars.value, 10) || 100000,
    temperature: parseFloat(el.temperature.value),
    openaiReasoningEffort: el.openaiReasoningEffort?.value || "medium",
    extendedThinking: {
      enabled: el.extendedThinkingEnabled.checked,
      budgetTokens: parseInt(el.thinkingBudget.value, 10) || 10000
    },
    showBadge: el.showBadge.checked,
    responseLanguage: el.responseLanguage.value,
    dataProviders,
    pasteProviders,
    defaultCloudProvider: document.getElementById("default-cloud-provider")?.value || "all",
    defaultPasteProvider: document.getElementById("default-paste-provider")?.value || "",
    backupEnabled: document.getElementById("backup-enabled")?.checked || false,
    backupInterval: parseInt(document.getElementById("backup-interval")?.value, 10) || 1440,
    backupAllProviders: document.getElementById("backup-all-providers")?.checked !== false
  });
  flashSaved();
}

async function loadProviderSettings() {
  const settings = await browser.storage.local.get({
    defaultProvider: "xai",
    providers: {
      xai: { apiKey: "", model: "grok-4-0709" },
      openai: { apiKey: "", model: "gpt-4.1" },
      anthropic: { apiKey: "", model: "claude-sonnet-4-6" },
      gemini: { apiKey: "", model: "gemini-2.5-flash" },
      custom: { apiKey: "", model: "", baseUrl: "" }
    },
    maxTokens: 2048,
    maxInputChars: 100000,
    temperature: 0.3,
    openaiReasoningEffort: "medium",
    extendedThinking: { enabled: false, budgetTokens: 10000 },
    showBadge: true,
    responseLanguage: "auto",
    apiKey: "",
    dataProviders: DEFAULT_DATA_PROVIDERS,
    pasteProviders: DEFAULT_PASTE_PROVIDERS,
    defaultCloudProvider: "all",
    defaultPasteProvider: "",
    backupEnabled: false,
    backupInterval: 1440,
    backupAllProviders: true
  });

  providers = settings.providers;
  dataProviders = settings.dataProviders || { ...DEFAULT_DATA_PROVIDERS };
  pasteProviders = settings.pasteProviders || { ...DEFAULT_PASTE_PROVIDERS };

  // Load default provider selections
  const defCloudEl = document.getElementById("default-cloud-provider");
  const defPasteEl = document.getElementById("default-paste-provider");
  if (defCloudEl) defCloudEl.value = settings.defaultCloudProvider || "all";
  if (defPasteEl) defPasteEl.value = settings.defaultPasteProvider || "";

  if (settings.apiKey && !providers.xai.apiKey) {
    providers.xai.apiKey = settings.apiKey;
  }

  el.defaultProvider.value = settings.defaultProvider;
  el.maxTokens.value = settings.maxTokens;
  el.maxInputChars.value = settings.maxInputChars;
  el.temperature.value = settings.temperature;
  el.tempValue.textContent = settings.temperature;
  el.showBadge.checked = settings.showBadge !== false;
  el.responseLanguage.value = settings.responseLanguage ?? "auto";
  el.openaiReasoningEffort.value = settings.openaiReasoningEffort || "medium";
  el.extendedThinkingEnabled.checked = settings.extendedThinking.enabled;
  el.thinkingBudget.value = settings.extendedThinking.budgetTokens || 10000;

  updateProviderTabIndicators();
  loadDataProviderFields();
  loadPasteProviderFields();

  // Backup schedule
  const backupEnabledEl = document.getElementById("backup-enabled");
  const backupIntervalEl = document.getElementById("backup-interval");
  const backupAllEl = document.getElementById("backup-all-providers");
  if (backupEnabledEl) backupEnabledEl.checked = settings.backupEnabled || false;
  if (backupIntervalEl) backupIntervalEl.value = settings.backupInterval || 1440;
  if (backupAllEl) backupAllEl.checked = settings.backupAllProviders !== false;
}

// ──────────────────────────────────────────────
// AI Provider tabs (from options-ai.js)
// ──────────────────────────────────────────────
function selectProviderTab(key) {
  currentProviderKey = key;

  el.providerTabList.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.provider === key);
  });

  const config = providers[key] || {};
  el.providerApiKey.value = config.apiKey || "";
  el.providerKeyHint.textContent = "";
  const hint = PROVIDER_HINTS[key];
  if (hint) {
    const a = document.createElement("a");
    a.href = hint.url;
    a.target = "_blank";
    a.textContent = hint.text;
    el.providerKeyHint.appendChild(document.createTextNode("Get your key from "));
    el.providerKeyHint.appendChild(a);
  }

  // Custom provider: show base URL + text model input; hide model dropdown
  const customFields = document.getElementById("custom-provider-fields");
  if (key === "custom") {
    customFields.classList.remove("hidden");
    el.providerModel.parentElement.classList.add("hidden");
    document.getElementById("custom-base-url").value = config.baseUrl || "";
    document.getElementById("custom-model-name").value = config.model || "";
    if (!hint) el.providerKeyHint.textContent = "API key for your OpenAI-compatible endpoint (if required)";
  } else {
    customFields.classList.add("hidden");
    el.providerModel.parentElement.classList.remove("hidden");
  }

  const models = PROVIDER_MODELS[key] || {};
  el.providerModel.replaceChildren();
  for (const [modelId, modelLabel] of Object.entries(models)) {
    const opt = document.createElement("option");
    opt.value = modelId;
    opt.textContent = modelLabel;
    el.providerModel.appendChild(opt);
  }
  el.providerModel.value = config.model || DEFAULT_MODELS[key] || "";
}

function updateProviderTabIndicators() {
  el.providerTabList.querySelectorAll(".tab-btn").forEach(btn => {
    const key = btn.dataset.provider;
    const cfg = providers[key];
    const configured = key === "custom" ? (cfg?.baseUrl && cfg?.model) : cfg?.apiKey;
    if (configured) {
      btn.classList.add("configured");
    } else {
      btn.classList.remove("configured");
    }
  });
}

function saveProviderConfig() {
  if (currentProviderKey === "custom") {
    providers.custom = {
      apiKey: el.providerApiKey.value.trim(),
      model: document.getElementById("custom-model-name").value.trim(),
      baseUrl: document.getElementById("custom-base-url").value.trim()
    };
  } else {
    providers[currentProviderKey] = {
      apiKey: el.providerApiKey.value.trim(),
      model: el.providerModel.value
    };
  }
  updateProviderTabIndicators();
  updateReasoningControls();
  scheduleSave();
}

// ──────────────────────────────────────────────
// Reasoning controls (from options-ai.js)
// ──────────────────────────────────────────────
function updateMultiAgentVisibility() {
  const xaiModel = providers.xai?.model || "";
  const isDefault = el.defaultProvider.value === "xai";
  const isMultiAgent = isDefault && xaiModel.includes("multi-agent");
  if (el.multiAgentCard) el.multiAgentCard.style.display = isMultiAgent ? "" : "none";
}

function isOpenaiReasoningModel(model) {
  return typeof model === "string" && /^o\d/i.test(model);
}

function updateThinkingBudgetState() {
  const isClaudeDefault = el.defaultProvider.value === "anthropic";
  if (el.thinkingBudget) el.thinkingBudget.disabled = !isClaudeDefault;
  if (el.thinkingBudgetHint) {
    el.thinkingBudgetHint.textContent = isClaudeDefault
      ? "Claude native thinking token budget."
      : "Only used when the default provider is Claude.";
  }
}

function updateOpenaiReasoningVisibility() {
  const isOpenaiDefault = el.defaultProvider.value === "openai";
  const openaiModel = providers.openai?.model || "";
  const supportsReasoning = isOpenaiReasoningModel(openaiModel);

  if (el.openaiReasoningCard) el.openaiReasoningCard.style.display = isOpenaiDefault ? "" : "none";
  if (el.openaiReasoningEffort) el.openaiReasoningEffort.disabled = !supportsReasoning;

  if (el.openaiReasoningHint) {
    if (!isOpenaiDefault) {
      el.openaiReasoningHint.textContent = "Available when OpenAI is the default provider.";
    } else if (!supportsReasoning) {
      el.openaiReasoningHint.textContent = "Select an OpenAI o-series model (o3/o3-mini/o4-mini) to use reasoning effort.";
    } else {
      el.openaiReasoningHint.textContent = "Used when Extended Thinking is enabled with OpenAI o-series models.";
    }
  }
}

function updateReasoningControls() {
  updateMultiAgentVisibility();
  updateThinkingBudgetState();
  updateOpenaiReasoningVisibility();
}

// ──────────────────────────────────────────────
// Data Provider tabs (from options-cloud.js)
// ──────────────────────────────────────────────
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

  // Show redirect URI for Google Drive with copy button
  const dpRedirectEl = document.getElementById("dp-gdrive-redirect");
  if (dpRedirectEl) {
    browser.runtime.sendMessage({ action: "cloudGetRedirectURL" }).then(resp => {
      if (resp?.success) {
        dpRedirectEl.innerHTML = `<span style="user-select:all;word-break:break-all;">${resp.url}</span> <button class="pill-chip" style="margin-left:6px;font-size:10px;padding:1px 8px;" title="Copy redirect URI to clipboard">Copy</button>`;
        dpRedirectEl.querySelector("button").addEventListener("click", () => {
          navigator.clipboard.writeText(resp.url);
          dpRedirectEl.querySelector("button").textContent = "Copied!";
          setTimeout(() => { dpRedirectEl.querySelector("button").textContent = "Copy"; }, 2000);
        });
      } else {
        dpRedirectEl.textContent = "Could not get redirect URI: " + (resp?.error || "identity API unavailable");
      }
    }).catch(() => {});
  }

  const d = dataProviders.dropbox || {};
  document.getElementById("dp-dropbox-app-key").value = d.appKey || "";
  updateDpConnectState("dropbox", d);

  const w = dataProviders.webdav || {};
  document.getElementById("dp-webdav-url").value = w.serverUrl || "";
  document.getElementById("dp-webdav-user").value = w.username || "";
  document.getElementById("dp-webdav-pass").value = w.password || "";
  document.getElementById("dp-webdav-folder").value = w.folder || "";
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
    if (resp?.value) document.getElementById("dp-xmpp-password").value = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
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
      dp.folder = document.getElementById("dp-webdav-folder").value.trim().replace(/^\/+|\/+$/g, "");
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

const DP_KEY_MAP = { gdrive: "google", dropbox: "dropbox", webdav: "webdav", s3: "s3", github: "github" };

async function testDataProviderConnection(key) {
  const statusEl = document.getElementById(`dp-${key}-status`);
  statusEl.className = "dp-status";
  statusEl.textContent = "Testing...";
  saveDataProviderField(key);
  const backendKey = DP_KEY_MAP[key] || key;
  try {
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
      statusEl.title = errMsg;
    }
  } catch (err) {
    const errMsg = err.message || "Connection failed";
    statusEl.className = "dp-status error";
    statusEl.textContent = errMsg;
    statusEl.title = errMsg;
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
// Paste Provider tabs (from options-cloud.js)
// ──────────────────────────────────────────────
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
// Default Provider Status
// ──────────────────────────────────────────────
const CLOUD_LABELS = { all: "All connected", google: "Google Drive", dropbox: "Dropbox", webdav: "WebDAV", s3: "S3" };
const PASTE_LABELS = { "": "None", gist: "GitHub Gist", pastebin: "Pastebin", privatebin: "PrivateBin" };

function updateDefaultProviderStatus() {
  const cloudVal = document.getElementById("default-cloud-provider")?.value || "all";
  const pasteVal = document.getElementById("default-paste-provider")?.value || "";

  const statusEl = document.getElementById("default-provider-status");
  if (statusEl) {
    const parts = [];
    const connectedCloud = [];
    const dpMap = { gdrive: "google", dropbox: "dropbox", webdav: "webdav", s3: "s3" };
    for (const [uiKey, backendKey] of Object.entries(dpMap)) {
      if (dataProviders[uiKey]?.connected) connectedCloud.push(CLOUD_LABELS[backendKey]);
    }
    if (connectedCloud.length) {
      parts.push(`Cloud: ${CLOUD_LABELS[cloudVal]} (${connectedCloud.length} connected: ${connectedCloud.join(", ")})`);
    } else {
      parts.push("Cloud: No providers connected");
    }
    const connectedPaste = [];
    for (const k of ["gist", "pastebin", "privatebin"]) {
      if (pasteProviders[k]?.connected) connectedPaste.push(PASTE_LABELS[k]);
    }
    if (connectedPaste.length) {
      parts.push(`Paste: ${PASTE_LABELS[pasteVal] || "None"} (${connectedPaste.length} connected: ${connectedPaste.join(", ")})`);
    } else {
      parts.push("Paste: No services connected");
    }
    statusEl.textContent = parts.join("  \u00B7  ");
  }
}

// ──────────────────────────────────────────────
// Intelligence Providers (from options-providers.js)
// ──────────────────────────────────────────────
function initIntelProviders() {
  const INTEL_PROVIDER_KEYS = ["opensanctions", "csl", "eusanctions", "samgov", "patentsview", "lensorg", "pqai", "secedgar", "courtlistener", "opensky", "adsbexchange", "marinetraffic", "gdelt", "sentinelhub", "opencorporates", "gleif", "blockstream", "broadcastify", "vesselfinder", "flightaware", "wigle", "stadiamaps", "windywebcams", "windyforecast", "openweathermap", "dol", "fec", "propublica990"];

  document.getElementById("intel-provider-tab-list")?.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.iprovider;
      document.getElementById("intel-provider-tab-list").querySelectorAll(".tab-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.iprovider === key);
      });
      for (const k of INTEL_PROVIDER_KEYS) {
        const panel = document.getElementById(`intel-${k}-fields`);
        if (panel) panel.classList.toggle("hidden", k !== key);
      }
    });
  });

  // Intel provider API key auto-save
  for (const key of INTEL_PROVIDER_KEYS) {
    const input = document.getElementById(`intel-${key}-apikey`);
    if (input) {
      input.addEventListener("input", () => {
        browser.runtime.sendMessage({
          action: "intelSaveConfig",
          provider: key,
          config: { apiKey: input.value.trim() }
        }).then(() => {
          browser.runtime.sendMessage({ type: "argusConnectionChanged" }).catch(() => {});
        }).catch(() => {});
      });
    }
  }

  // Intel provider test connection buttons
  for (const key of INTEL_PROVIDER_KEYS) {
    const testBtn = document.getElementById(`intel-${key}-test-btn`);
    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        const statusEl = document.getElementById(`intel-${key}-status`);
        statusEl.className = "dp-status";
        statusEl.textContent = "Testing...";
        try {
          let resp;
          resp = await browser.runtime.sendMessage({ action: "intelSearch", provider: key, query: "test", options: {} });
          if (resp?.success) {
            statusEl.className = "dp-status connected";
            statusEl.textContent = "Connected!";
          } else {
            statusEl.className = "dp-status error";
            statusEl.textContent = resp?.error || "Connection failed";
          }
        } catch (e) {
          statusEl.className = "dp-status error";
          statusEl.textContent = e.message;
        }
      });
    }
  }

  // Load intel provider status on page load
  browser.runtime.sendMessage({ action: "intelGetStatus" }).then(resp => {
    if (!resp?.providers) return;
    for (const [key, info] of Object.entries(resp.providers)) {
      const statusEl = document.getElementById(`intel-${key}-status`);
      if (statusEl) {
        if (info.status === "connected") {
          statusEl.className = "dp-status connected";
          statusEl.textContent = "Connected";
        } else if (info.status === "error") {
          statusEl.className = "dp-status error";
          statusEl.textContent = "Error";
        } else {
          statusEl.className = "dp-status";
          statusEl.textContent = "Not configured";
        }
      }
    }
  }).catch(() => {});

  // Intel provider eye toggles (show/hide password)
  document.querySelectorAll(".intel-eye-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.type = input.type === "password" ? "text" : "password";
    });
  });

  // OpenSky credentials.json file loader
  document.getElementById("intel-opensky-load-json")?.addEventListener("click", () => {
    document.getElementById("intel-opensky-file").click();
  });
  document.getElementById("intel-opensky-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const creds = JSON.parse(text);
      if (creds.clientId) document.getElementById("intel-opensky-clientid").value = creds.clientId;
      if (creds.clientSecret) document.getElementById("intel-opensky-clientsecret").value = creds.clientSecret;
      await browser.runtime.sendMessage({
        action: "intelSaveConfig",
        provider: "opensky",
        config: { clientId: creds.clientId, clientSecret: creds.clientSecret, connected: true }
      });
      document.getElementById("intel-opensky-status").className = "dp-status connected";
      document.getElementById("intel-opensky-status").textContent = "Credentials loaded!";
    } catch (err) {
      document.getElementById("intel-opensky-status").className = "dp-status error";
      document.getElementById("intel-opensky-status").textContent = "Invalid JSON file";
    }
    e.target.value = "";
  });

  // OpenSky manual field save
  for (const fieldId of ["intel-opensky-clientid", "intel-opensky-clientsecret"]) {
    document.getElementById(fieldId)?.addEventListener("input", () => {
      const clientId = document.getElementById("intel-opensky-clientid").value.trim();
      const clientSecret = document.getElementById("intel-opensky-clientsecret").value.trim();
      browser.runtime.sendMessage({
        action: "intelSaveConfig",
        provider: "opensky",
        config: { clientId, clientSecret, connected: !!(clientId && clientSecret) }
      }).catch(() => {});
    });
  }

  // WiGLE two-field save
  for (const fieldId of ["intel-wigle-apiname", "intel-wigle-apikey"]) {
    document.getElementById(fieldId)?.addEventListener("input", () => {
      const apiName = document.getElementById("intel-wigle-apiname").value.trim();
      const apiKey  = document.getElementById("intel-wigle-apikey").value.trim();
      browser.runtime.sendMessage({
        action: "intelSaveConfig",
        provider: "wigle",
        config: { apiName, apiKey, connected: !!(apiName && apiKey) }
      }).then(() => {
        browser.runtime.sendMessage({ type: "argusConnectionChanged" }).catch(() => {});
      }).catch(() => {});
    });
  }

  // Windy Forecast two-field save
  for (const fieldId of ["intel-windyforecast-tilekey", "intel-windyforecast-forecastkey"]) {
    document.getElementById(fieldId)?.addEventListener("input", () => {
      const tileKey     = document.getElementById("intel-windyforecast-tilekey")?.value.trim() || "";
      const forecastKey = document.getElementById("intel-windyforecast-forecastkey")?.value.trim() || "";
      browser.runtime.sendMessage({
        action: "intelSaveConfig",
        provider: "windyforecast",
        config: { tileKey, forecastKey, connected: !!(tileKey || forecastKey) }
      }).catch(() => {});
    });
  }

  // Load Windy Forecast keys on page open
  browser.runtime.sendMessage({ action: "intelGetProviderConfig", provider: "windyforecast" })
    .then(cfg => {
      if (!cfg) return;
      if (cfg.tileKey)     { const el = document.getElementById("intel-windyforecast-tilekey");     if (el) el.value = cfg.tileKey; }
      if (cfg.forecastKey) { const el = document.getElementById("intel-windyforecast-forecastkey"); if (el) el.value = cfg.forecastKey; }
    }).catch(() => {});

  // Satellite defaults
  const SAT_DEFAULTS_KEY = "satDefaults";
  browser.storage.local.get({ [SAT_DEFAULTS_KEY]: {} }).then(d => {
    const cfg = d[SAT_DEFAULTS_KEY] || {};
    if (cfg.location) document.getElementById("sat-default-location").value = cfg.location;
    if (cfg.zoom) document.getElementById("sat-default-zoom").value = cfg.zoom;
    if (cfg.resolution) document.getElementById("sat-default-resolution").value = cfg.resolution;
  }).catch(() => {});

  for (const id of ["sat-default-location", "sat-default-zoom", "sat-default-resolution"]) {
    document.getElementById(id)?.addEventListener("change", () => {
      browser.storage.local.set({
        [SAT_DEFAULTS_KEY]: {
          location: document.getElementById("sat-default-location").value.trim(),
          zoom: parseInt(document.getElementById("sat-default-zoom").value) || 12,
          resolution: parseInt(document.getElementById("sat-default-resolution").value) || 1024,
        }
      });
    });
  }

  // Sentinel Hub credentials.json loader + manual fields
  document.getElementById("intel-sentinelhub-load-json")?.addEventListener("click", () => {
    document.getElementById("intel-sentinelhub-file").click();
  });
  document.getElementById("intel-sentinelhub-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const creds = JSON.parse(text);
      if (creds.clientId || creds.client_id) document.getElementById("intel-sentinelhub-clientid").value = creds.clientId || creds.client_id;
      if (creds.clientSecret || creds.client_secret) document.getElementById("intel-sentinelhub-clientsecret").value = creds.clientSecret || creds.client_secret;
      await browser.runtime.sendMessage({
        action: "intelSaveConfig", provider: "sentinelhub",
        config: { clientId: creds.clientId || creds.client_id, clientSecret: creds.clientSecret || creds.client_secret, connected: true }
      });
      document.getElementById("intel-sentinelhub-status").className = "dp-status connected";
      document.getElementById("intel-sentinelhub-status").textContent = "Credentials loaded!";
    } catch {
      document.getElementById("intel-sentinelhub-status").className = "dp-status error";
      document.getElementById("intel-sentinelhub-status").textContent = "Invalid JSON file";
    }
    e.target.value = "";
  });
  for (const fieldId of ["intel-sentinelhub-clientid", "intel-sentinelhub-clientsecret", "intel-sentinelhub-instanceid"]) {
    document.getElementById(fieldId)?.addEventListener("input", () => {
      const clientId = document.getElementById("intel-sentinelhub-clientid").value.trim();
      const clientSecret = document.getElementById("intel-sentinelhub-clientsecret").value.trim();
      const instanceId = document.getElementById("intel-sentinelhub-instanceid").value.trim();
      browser.runtime.sendMessage({
        action: "intelSaveConfig", provider: "sentinelhub",
        config: { clientId, clientSecret, instanceId, connected: !!(clientId && clientSecret) }
      }).catch(() => {});
    });
  }

  // Load saved intel provider API keys into fields
  browser.storage.local.get({ argusIntelProviders: {} }).then(data => {
    const cfg = data.argusIntelProviders || {};
    for (const key of INTEL_PROVIDER_KEYS) {
      const input = document.getElementById(`intel-${key}-apikey`);
      if (input && cfg[key]?.apiKey) {
        input.value = cfg[key].apiKey;
      }
    }
    // Sentinel Hub uses clientId/clientSecret/instanceId
    if (cfg.sentinelhub?.clientId) {
      const cid = document.getElementById("intel-sentinelhub-clientid");
      if (cid) cid.value = cfg.sentinelhub.clientId;
    }
    if (cfg.sentinelhub?.clientSecret) {
      const cs = document.getElementById("intel-sentinelhub-clientsecret");
      if (cs) cs.value = cfg.sentinelhub.clientSecret;
    }
    if (cfg.sentinelhub?.instanceId) {
      const iid = document.getElementById("intel-sentinelhub-instanceid");
      if (iid) iid.value = cfg.sentinelhub.instanceId;
    }
    // OpenSky uses clientId/clientSecret instead of apiKey
    if (cfg.opensky?.clientId) {
      const cid = document.getElementById("intel-opensky-clientid");
      if (cid) cid.value = cfg.opensky.clientId;
    }
    if (cfg.opensky?.clientSecret) {
      const cs = document.getElementById("intel-opensky-clientsecret");
      if (cs) cs.value = cfg.opensky.clientSecret;
    }
    // WiGLE uses apiName + apiKey
    if (cfg.wigle?.apiName) {
      const an = document.getElementById("intel-wigle-apiname");
      if (an) an.value = cfg.wigle.apiName;
    }
    if (cfg.wigle?.apiKey) {
      const ak = document.getElementById("intel-wigle-apikey");
      if (ak) ak.value = cfg.wigle.apiKey;
    }
  }).catch(() => {});
}

// ──────────────────────────────────────────────
// Cloud/Data/Paste provider event listeners
// (from options-cloud.js initCloudProviderListeners)
// ──────────────────────────────────────────────
function initCloudProviderListeners() {
  // Data provider tabs
  document.getElementById("data-provider-tab-list").querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => selectDataProviderTab(btn.dataset.dprovider));
  });
  // Data provider field inputs — auto-save on change
  for (const id of ["dp-gdrive-client-id", "dp-gdrive-folder", "dp-dropbox-app-key", "dp-webdav-url", "dp-webdav-user", "dp-webdav-pass", "dp-webdav-folder",
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
    const pwField = document.getElementById("dp-xmpp-password");
    if (pwField.value && pwField.value !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
      await browser.runtime.sendMessage({ action: "vaultWriteSensitive", key: "xmpp-password", value: pwField.value });
      pwField.value = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
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
    if (pwField.value && pwField.value !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
      await browser.runtime.sendMessage({ action: "vaultWriteSensitive", key: "xmpp-password", value: pwField.value });
      pwField.value = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
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
  document.getElementById("backup-enabled")?.addEventListener("change", scheduleSave);
  document.getElementById("backup-interval")?.addEventListener("change", scheduleSave);
  document.getElementById("backup-all-providers")?.addEventListener("change", scheduleSave);
  document.getElementById("backup-now")?.addEventListener("click", async () => {
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

// ──────────────────────────────────────────────
// AI provider event listeners
// (from options-features.js attachListeners)
// ──────────────────────────────────────────────
function initAiProviderListeners() {
  el.toggleKeyVis.addEventListener("click", () => {
    el.providerApiKey.type = el.providerApiKey.type === "password" ? "text" : "password";
  });

  el.defaultProvider.addEventListener("change", () => {
    updateReasoningControls();
    scheduleSave();
  });

  el.providerTabList.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => selectProviderTab(btn.dataset.provider));
  });

  el.providerApiKey.addEventListener("input", saveProviderConfig);
  el.providerModel.addEventListener("change", saveProviderConfig);
  document.getElementById("custom-base-url").addEventListener("input", saveProviderConfig);
  document.getElementById("custom-model-name").addEventListener("input", saveProviderConfig);

  el.maxTokens.addEventListener("input", scheduleSave);
  el.maxInputChars.addEventListener("input", scheduleSave);
  el.openaiReasoningEffort.addEventListener("change", scheduleSave);

  el.temperature.addEventListener("input", () => {
    el.tempValue.textContent = el.temperature.value;
    scheduleSave();
  });

  el.extendedThinkingEnabled.addEventListener("change", () => {
    updateReasoningControls();
    scheduleSave();
  });
  el.thinkingBudget.addEventListener("input", scheduleSave);
  el.responseLanguage.addEventListener("change", scheduleSave);
  el.showBadge.addEventListener("change", scheduleSave);
}

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Show warning banner for Guest mode (unencrypted credentials)
  const { argusActiveProfile } = await browser.storage.local.get("argusActiveProfile");
  if (!argusActiveProfile || argusActiveProfile === "guest") {
    const banner = document.createElement("div");
    banner.style.cssText = "background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:10px 16px;margin-bottom:12px;font-size:12px;color:var(--text-primary);";
    banner.innerHTML = 'You\'re using Guest mode \u2014 credentials are stored without encryption. <a href="' + browser.runtime.getURL("settings/settings.html") + '" style="color:var(--accent);">Create a profile</a> to encrypt your API keys.';
    document.querySelector(".settings-container")?.prepend(banner);
  }
  try { await loadProviderSettings(); } catch(e) { console.error("[Providers] loadProviderSettings failed:", e); }
  // Disable AI providers with no API key configured
  try {
    const aiResp = await browser.runtime.sendMessage({ action: "aiGetStatus" });
    const aiSel = document.getElementById("default-provider");
    if (aiSel && aiResp?.providers) {
      for (const opt of aiSel.options) {
        if (opt.value) {
          const info = aiResp.providers[opt.value];
          if (!info || (!info.configured && info.status !== "live")) {
            opt.disabled = true;
            opt.textContent += " (no key)";
          }
        }
      }
    }
  } catch { /* */ }
  // Disable unconnected cloud providers in the default dropdown
  try {
    const cloudResp = await browser.runtime.sendMessage({ action: "cloudGetStatus" });
    const cloudSel = document.getElementById("default-cloud-provider");
    if (cloudSel) {
      for (const opt of cloudSel.options) {
        if (opt.value && opt.value !== "all" && !cloudResp?.providers?.[opt.value]) {
          opt.disabled = true;
          opt.textContent += " (not connected)";
        }
      }
    }
    // Same for paste provider dropdown
    const pasteSel = document.getElementById("default-paste-provider");
    if (pasteSel) {
      const pasteKeyMap = { gist: "github", pastebin: "pastebin", privatebin: "privatebin" };
      for (const opt of pasteSel.options) {
        if (opt.value) {
          const backendKey = pasteKeyMap[opt.value] || opt.value;
          const connected = pasteProviders?.[opt.value]?.connected || cloudResp?.providers?.[backendKey];
          if (!connected) {
            opt.disabled = true;
            opt.textContent += " (not connected)";
          }
        }
      }
    }
  } catch { /* */ }
  try { selectProviderTab("xai"); } catch(e) { console.error("[Providers] selectProviderTab failed:", e); }
  try { selectDataProviderTab("gdrive"); } catch(e) { console.error("[Providers] selectDataProviderTab failed:", e); }
  try { selectPasteProviderTab("gist"); } catch(e) { console.error("[Providers] selectPasteProviderTab failed:", e); }
  try { initAiProviderListeners(); } catch(e) { console.error("[Providers] initAiProviderListeners failed:", e); }
  try { initCloudProviderListeners(); } catch(e) { console.error("[Providers] initCloudProviderListeners failed:", e); }
  try { initIntelProviders(); } catch(e) { console.error("[Providers] initIntelProviders failed:", e); }
  try { updateReasoningControls(); } catch(e) { console.error("[Providers] updateReasoningControls failed:", e); }
  try { initCredentialBackup(); } catch(e) { console.error("[Providers] initCredentialBackup failed:", e); }

  // Disable unconnected destinations in backup dropdowns
  try {
    const credDestSel = document.getElementById("cred-backup-dest");
    const backupDestSel = document.getElementById("backup-dest");
    const cloudResp2 = await browser.runtime.sendMessage({ action: "cloudGetStatus" });
    const destMap = { gdrive: "google", webdav: "webdav", github: "github", s3: "s3" };
    for (const sel of [credDestSel, backupDestSel]) {
      if (!sel) continue;
      for (const opt of sel.options) {
        const backend = destMap[opt.value];
        if (backend && !cloudResp2?.providers?.[backend]) {
          opt.disabled = true;
          opt.textContent += " (not connected)";
        }
      }
    }
  } catch { /* */ }
});

// ── Credential Backup (encrypted with Vault) ──
const CREDENTIAL_KEYS = ["providers", "dataProviders", "pasteProviders", "sshSessions"];

function initCredentialBackup() {
  const statusEl = document.getElementById("cred-backup-status");
  const destSel = document.getElementById("cred-backup-dest");
  const fileInput = document.getElementById("cred-import-file");

  function setStatus(msg, color) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = color || "var(--text-muted)";
    if (msg) setTimeout(() => { statusEl.textContent = ""; }, 4000);
  }

  // Export credentials (encrypted) to local file
  document.getElementById("cred-export")?.addEventListener("click", async () => {
    try {
      const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
      if (!vaultStatus?.enabled || !vaultStatus?.unlocked) {
        setStatus("Vault must be set up and unlocked to export credentials", "var(--error)");
        return;
      }
      setStatus("Encrypting...", "var(--accent)");
      const resp = await browser.runtime.sendMessage({ action: "credentialExport" });
      if (!resp?.success) { setStatus(resp?.error || "Export failed", "var(--error)"); return; }

      if (destSel.value === "local") {
        const blob = new Blob([JSON.stringify(resp.payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `argus-credentials-${new Date().toISOString().slice(0,10)}.argus-cred`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus("Credentials exported (encrypted)", "var(--success)");
      } else {
        // Upload to cloud
        const uploadResp = await browser.runtime.sendMessage({
          action: "credentialCloudBackup",
          provider: destSel.value,
          payload: resp.payload
        });
        setStatus(uploadResp?.success ? "Backed up to " + destSel.value : (uploadResp?.error || "Upload failed"),
          uploadResp?.success ? "var(--success)" : "var(--error)");
      }
    } catch (e) { setStatus("Export failed: " + e.message, "var(--error)"); }
  });

  // Import credentials from local file
  document.getElementById("cred-import")?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
      if (!vaultStatus?.enabled || !vaultStatus?.unlocked) {
        setStatus("Vault must be unlocked to import credentials", "var(--error)");
        return;
      }
      setStatus("Decrypting...", "var(--accent)");
      const text = await file.text();
      const payload = JSON.parse(text);
      const resp = await browser.runtime.sendMessage({ action: "credentialImport", payload });
      setStatus(resp?.success ? "Credentials restored" : (resp?.error || "Import failed"),
        resp?.success ? "var(--success)" : "var(--error)");
      if (resp?.success) setTimeout(() => location.reload(), 1500);
    } catch (e) { setStatus("Import failed: " + e.message, "var(--error)"); }
    fileInput.value = "";
  });

  // Cloud backup
  document.getElementById("cred-cloud-backup")?.addEventListener("click", async () => {
    if (destSel.value === "local") { setStatus("Select a cloud destination", "var(--error)"); return; }
    try {
      const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
      if (!vaultStatus?.enabled || !vaultStatus?.unlocked) {
        setStatus("Vault must be unlocked", "var(--error)"); return;
      }
      setStatus("Encrypting & uploading...", "var(--accent)");
      const exportResp = await browser.runtime.sendMessage({ action: "credentialExport" });
      if (!exportResp?.success) { setStatus(exportResp?.error || "Export failed", "var(--error)"); return; }
      const uploadResp = await browser.runtime.sendMessage({
        action: "credentialCloudBackup", provider: destSel.value, payload: exportResp.payload
      });
      setStatus(uploadResp?.success ? "Backed up to " + destSel.value : (uploadResp?.error || "Upload failed"),
        uploadResp?.success ? "var(--success)" : "var(--error)");
    } catch (e) { setStatus("Backup failed: " + e.message, "var(--error)"); }
  });

  // Cloud restore
  document.getElementById("cred-cloud-restore")?.addEventListener("click", async () => {
    if (destSel.value === "local") { setStatus("Select a cloud source", "var(--error)"); return; }
    try {
      const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
      if (!vaultStatus?.enabled || !vaultStatus?.unlocked) {
        setStatus("Vault must be unlocked", "var(--error)"); return;
      }
      setStatus("Downloading & decrypting...", "var(--accent)");
      const resp = await browser.runtime.sendMessage({ action: "credentialCloudRestore", provider: destSel.value });
      setStatus(resp?.success ? "Credentials restored from " + destSel.value : (resp?.error || "Restore failed"),
        resp?.success ? "var(--success)" : "var(--error)");
      if (resp?.success) setTimeout(() => location.reload(), 1500);
    } catch (e) { setStatus("Restore failed: " + e.message, "var(--error)"); }
  });
}
