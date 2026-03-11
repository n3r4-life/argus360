// ──────────────────────────────────────────────
// Default presets (mirrors background.js)
// ──────────────────────────────────────────────
const DEFAULT_PRESETS = {
  summary: {
    label: "Summary",
    system: "You are a precise text analyst.",
    prompt: "Provide a clear, concise summary of the following webpage content. Use markdown formatting. Focus on the main points and key information."
  },
  sentiment: {
    label: "Sentiment Analysis",
    system: "You are a sentiment analysis expert.",
    prompt: "Analyze the sentiment and tone of the following webpage content. Identify the overall sentiment (positive/negative/neutral), emotional undertones, and any bias. Use markdown formatting."
  },
  factcheck: {
    label: "Fact-Check",
    system: "You are a careful fact-checker. Be measured and specific about what can and cannot be verified.",
    prompt: "Review the following webpage content for factual claims. Identify key claims, assess their verifiability, and flag any that appear questionable, misleading, or unsubstantiated. Use markdown formatting."
  },
  keypoints: {
    label: "Key Points",
    system: "You are a skilled information extractor.",
    prompt: "Extract the key points from the following webpage content as a structured bulleted list. Group related points under clear headings. Use markdown formatting."
  },
  eli5: {
    label: "ELI5",
    system: "You explain complex topics in simple terms that a 5-year-old could understand. Use analogies and everyday language.",
    prompt: "Explain the content of this webpage in very simple terms. Avoid jargon. Use short sentences and relatable analogies. Use markdown formatting."
  },
  critique: {
    label: "Critical Analysis",
    system: "You are a thoughtful critical analyst.",
    prompt: "Provide a critical analysis of this webpage content. Examine the arguments made, identify strengths and weaknesses, note any logical fallacies, and assess the overall quality of the content. Use markdown formatting."
  },
  actionitems: {
    label: "Action Items",
    system: "You extract actionable tasks and next steps from text.",
    prompt: "Extract all actionable items, recommendations, and next steps from this webpage content. Present them as a clear checklist. Use markdown formatting."
  },
  research: {
    label: "Research Report",
    system: "You are a research analyst who synthesizes information from multiple sources into comprehensive, well-structured reports. Always cite sources by their number (e.g., [Source 1], [Source 2]).",
    prompt: "Analyze the following sources and produce a structured research report with an executive summary, key findings with source citations, areas of agreement, contradictions, gaps in coverage, recommendations, and source assessment. Use markdown formatting. Be specific and cite sources throughout."
  },
  latenight: {
    label: "Late Night Recap",
    system: "You are a sharp-witted comedic editorial writer. Your style is punchy, irreverent, and conversational — like a late-night monologue meets a newspaper column. Use sarcasm, wit, and strong opinions. Never reference your style, influences, or that you're an AI. Just deliver the content.",
    prompt: "Recap the following page content as if you're writing your editorial column. Hit the key points but make it entertaining. Be sharp, punchy, and opinionated. Use markdown formatting."
  },
  entities: {
    label: "Entity Extraction (OSINT)",
    system: "You are an OSINT analyst specializing in entity extraction and intelligence gathering. Extract structured data from text. Respond ONLY with valid JSON - no markdown fences, no explanation.",
    prompt: "Extract all identifiable entities from this page content. Return as JSON with people, organizations, locations, dates, amounts, contact info, and claims. Include every entity you can find."
  },
  credibility: {
    label: "Source Credibility",
    system: "You are a media literacy and source evaluation expert with deep expertise in journalism standards, propaganda techniques, and information quality assessment.",
    prompt: "Evaluate this page's credibility on a scale of 1-10. Assess author & publication, sourcing quality, content analysis, bias indicators, and verification status. Use markdown formatting."
  },
  profile: {
    label: "Person/Org Profile",
    system: "You are an OSINT research analyst who builds comprehensive profiles from available information.",
    prompt: "Build a structured intelligence profile based on this page content. Include profile summary, key details, activity & history, network & associations, notable statements, and assessment. Use markdown formatting."
  }
};

// Provider key hints
const PROVIDER_HINTS = {
  xai: { url: "https://console.x.ai", text: "console.x.ai" },
  openai: { url: "https://platform.openai.com/api-keys", text: "platform.openai.com" },
  anthropic: { url: "https://console.anthropic.com", text: "console.anthropic.com" },
  gemini: { url: "https://aistudio.google.com/apikey", text: "aistudio.google.com" }
};

// Provider model lists (mirrors background.js PROVIDERS)
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
// State
// ──────────────────────────────────────────────
let currentPresetKey = "summary";
let currentProviderKey = "xai";
let customPresets = {};
let providers = {};
let autoAnalyzeRules = [];
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
  reasoningEffort: document.getElementById("reasoning-effort"),
  openaiReasoningEffort: document.getElementById("openai-reasoning-effort"),
  openaiReasoningHint: document.getElementById("openai-reasoning-hint"),
  openaiReasoningCard: document.getElementById("openai-reasoning-card"),
  multiAgentCard: document.getElementById("multi-agent-card"),
  tabList: document.getElementById("prompt-tab-list"),
  promptProvider: document.getElementById("prompt-provider"),
  promptSystem: document.getElementById("prompt-system"),
  promptUser: document.getElementById("prompt-user"),
  resetPrompt: document.getElementById("reset-prompt"),
  deletePreset: document.getElementById("delete-preset"),
  addPreset: document.getElementById("add-preset"),
  promptStatus: document.getElementById("prompt-status"),
  saveIndicator: document.getElementById("save-indicator"),
  versionNumber: document.getElementById("version-number"),
  // Extended thinking
  extendedThinkingEnabled: document.getElementById("extended-thinking-enabled"),
  thinkingBudget: document.getElementById("thinking-budget"),
  thinkingBudgetHint: document.getElementById("thinking-budget-hint"),
  // Auto-analyze
  autoRulesList: document.getElementById("auto-rules-list"),
  ruleUrl: document.getElementById("rule-url"),
  rulePreset: document.getElementById("rule-preset"),
  ruleProvider: document.getElementById("rule-provider"),
  ruleDelay: document.getElementById("rule-delay"),
  addRule: document.getElementById("add-rule"),
  // Import/Export
  exportSettings: document.getElementById("export-settings"),
  importSettings: document.getElementById("import-settings"),
  importFile: document.getElementById("import-file"),
  importExportStatus: document.getElementById("import-export-status"),
  // History
  maxHistory: document.getElementById("max-history"),
  openHistory: document.getElementById("open-history"),
  clearHistory: document.getElementById("clear-history"),
  // Monitors
  monitorList: document.getElementById("monitor-list"),
  monitorUrl: document.getElementById("monitor-url"),
  monitorInterval: document.getElementById("monitor-interval"),
  monitorTitle: document.getElementById("monitor-title"),
  monitorAi: document.getElementById("monitor-ai"),
  monitorAutoOpen: document.getElementById("monitor-auto-open"),
  monitorAutoBookmark: document.getElementById("monitor-auto-bookmark"),
  monitorDuration: document.getElementById("monitor-duration"),
  monitorPreset: document.getElementById("monitor-preset"),
  addMonitor: document.getElementById("add-monitor"),
  monitorStatus: document.getElementById("monitor-status"),
  monitorStorageBar: document.getElementById("monitor-storage-bar"),
  monitorStorageLabel: document.getElementById("monitor-storage-label"),
  monitorStorageFill: document.getElementById("monitor-storage-fill"),
  // RSS Feeds
  feedList: document.getElementById("feed-list"),
  feedUrl: document.getElementById("feed-url"),
  feedInterval: document.getElementById("feed-interval"),
  feedTitle: document.getElementById("feed-title"),
  feedAiSummarize: document.getElementById("feed-ai-summarize"),
  feedMonitorBridge: document.getElementById("feed-monitor-bridge"),
  addFeed: document.getElementById("add-feed"),
  openFeedReader: document.getElementById("open-feed-reader"),
  feedStatus: document.getElementById("feed-status"),
  // Archive Redirect
  archiveEnabled: document.getElementById("archive-enabled"),
  archiveProvider: document.getElementById("archive-provider"),
  archiveCustomGroup: document.getElementById("archive-custom-group"),
  archiveCustomUrl: document.getElementById("archive-custom-url"),
  archiveDomains: document.getElementById("archive-domains"),
  archiveSave: document.getElementById("archive-save"),
  archiveReset: document.getElementById("archive-reset"),
  archiveStatus: document.getElementById("archive-status"),
};

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadAllSettings();
  buildPromptTabs();
  selectPromptTab("summary");
  selectProviderTab("xai");
  populateRulePresets();
  renderAutoRules();
  renderMonitors();
  attachListeners();
  updateReasoningControls();
  loadVersion();
  initMainTabs();
  initHelpBackToTop();
  initWatchlist();
  initStorageManagement();
});

function loadVersion() {
  const manifest = browser.runtime.getManifest();
  el.versionNumber.textContent = manifest.version;
  const helpVer = document.getElementById("help-version-number");
  if (helpVer) helpVer.textContent = manifest.version;
}

async function loadAllSettings() {
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
    reasoningEffort: "medium",
    openaiReasoningEffort: "medium",
    customPresets: {},
    extendedThinking: { enabled: false, budgetTokens: 10000 },
    autoAnalyzeRules: [],
    maxHistorySize: 200,
    showBadge: true,
    responseLanguage: "auto",
    apiKey: ""
  });

  providers = settings.providers;

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
  el.reasoningEffort.value = settings.reasoningEffort;
  el.openaiReasoningEffort.value = settings.openaiReasoningEffort || "medium";
  el.extendedThinkingEnabled.checked = settings.extendedThinking.enabled;
  el.thinkingBudget.value = settings.extendedThinking.budgetTokens || 10000;
  el.maxHistory.value = settings.maxHistorySize;
  customPresets = settings.customPresets || {};
  autoAnalyzeRules = settings.autoAnalyzeRules || [];

  updateProviderTabIndicators();
}

// ──────────────────────────────────────────────
// Provider tabs
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

// ──────────────────────────────────────────────
// Prompt tabs (default + custom presets)
// ──────────────────────────────────────────────
function buildPromptTabs() {
  el.tabList.replaceChildren();

  // Default presets
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    addPromptTab(key, preset.label, false);
  }

  // Custom presets (user-created)
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      addPromptTab(key, preset.label || key, true);
    }
  }
}

function addPromptTab(key, label, isCustom) {
  const btn = document.createElement("button");
  btn.className = "tab-btn";
  btn.dataset.key = key;
  btn.textContent = label;
  if (isCustom) btn.classList.add("custom");
  if (customPresets[key] && !customPresets[key].isCustom) btn.classList.add("modified");
  btn.addEventListener("click", () => selectPromptTab(key));
  el.tabList.appendChild(btn);
}

function selectPromptTab(key) {
  currentPresetKey = key;
  el.tabList.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.key === key);
  });

  const custom = customPresets[key];
  const defaults = DEFAULT_PRESETS[key];
  const isCustomPreset = custom && custom.isCustom;

  el.promptProvider.value = custom?.provider ?? "";
  el.promptSystem.value = custom?.system ?? defaults?.system ?? "";
  el.promptUser.value = custom?.prompt ?? defaults?.prompt ?? "";

  // Show delete button for custom presets, reset for defaults
  el.deletePreset.classList.toggle("hidden", !isCustomPreset);
  el.resetPrompt.classList.toggle("hidden", isCustomPreset);
}

function isPresetModified(key) {
  const custom = customPresets[key];
  if (!custom) return false;
  if (custom.isCustom) return false;
  const defaults = DEFAULT_PRESETS[key];
  return custom.system !== defaults.system || custom.prompt !== defaults.prompt || !!custom.provider;
}

// ──────────────────────────────────────────────
// Auto-save
// ──────────────────────────────────────────────
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveAllSettings, 400);
}

function flashSaved() {
  el.saveIndicator.classList.remove("hidden");
  setTimeout(() => el.saveIndicator.classList.add("hidden"), 1500);
}

async function saveAllSettings() {
  await browser.storage.local.set({
    defaultProvider: el.defaultProvider.value,
    providers,
    maxTokens: parseInt(el.maxTokens.value, 10) || 2048,
    maxInputChars: parseInt(el.maxInputChars.value, 10) || 100000,
    temperature: parseFloat(el.temperature.value),
    reasoningEffort: el.reasoningEffort.value,
    openaiReasoningEffort: el.openaiReasoningEffort.value,
    customPresets,
    extendedThinking: {
      enabled: el.extendedThinkingEnabled.checked,
      budgetTokens: parseInt(el.thinkingBudget.value, 10) || 10000
    },
    autoAnalyzeRules,
    maxHistorySize: parseInt(el.maxHistory.value, 10) || 200,
    showBadge: el.showBadge.checked,
    responseLanguage: el.responseLanguage.value
  });
  flashSaved();
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

function savePrompt() {
  const system = el.promptSystem.value.trim();
  const prompt = el.promptUser.value.trim();
  const provider = el.promptProvider.value || "";
  const defaults = DEFAULT_PRESETS[currentPresetKey];
  const existing = customPresets[currentPresetKey];

  if (existing && existing.isCustom) {
    // Custom preset — always save
    customPresets[currentPresetKey] = { ...existing, system, prompt, provider };
  } else if (defaults) {
    // Default preset — only save if modified
    const isModified = system !== defaults.system || prompt !== defaults.prompt || provider;
    if (!isModified) {
      delete customPresets[currentPresetKey];
    } else {
      customPresets[currentPresetKey] = { system, prompt, provider };
    }
  }

  const tab = el.tabList.querySelector(`[data-key="${currentPresetKey}"]`);
  if (tab && !customPresets[currentPresetKey]?.isCustom) {
    tab.classList.toggle("modified", isPresetModified(currentPresetKey));
  }
  scheduleSave();
}

// ──────────────────────────────────────────────
// Auto-analyze rules
// ──────────────────────────────────────────────
function populateRulePresets() {
  el.rulePreset.replaceChildren();
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    el.rulePreset.appendChild(opt);
  }
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = preset.label || key;
      el.rulePreset.appendChild(opt);
    }
  }
}

function renderAutoRules() {
  el.autoRulesList.replaceChildren();
  if (!autoAnalyzeRules.length) {
    const p = document.createElement("p");
    p.className = "info-text";
    p.style.margin = "0";
    p.textContent = "No rules configured.";
    el.autoRulesList.appendChild(p);
    return;
  }

  autoAnalyzeRules.forEach((rule, index) => {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = rule.urlPattern;
    const span = document.createElement("span");
    span.textContent = `${DEFAULT_PRESETS[rule.preset]?.label || rule.preset} | ${rule.provider || "Default"} | ${rule.delay}ms`;
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle-label small";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = rule.enabled;
    cb.dataset.ruleToggle = index;
    const toggleText = document.createElement("span");
    toggleText.textContent = rule.enabled ? "On" : "Off";
    toggleLabel.appendChild(cb);
    toggleLabel.appendChild(toggleText);

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-sm btn-secondary";
    delBtn.dataset.ruleDelete = index;
    delBtn.style.color = "var(--error)";
    delBtn.textContent = "Delete";

    actions.appendChild(toggleLabel);
    actions.appendChild(delBtn);
    div.appendChild(info);
    div.appendChild(actions);
    el.autoRulesList.appendChild(div);
  });

  // Attach toggle/delete handlers
  el.autoRulesList.querySelectorAll("[data-rule-toggle]").forEach(cb => {
    cb.addEventListener("change", () => {
      const idx = parseInt(cb.dataset.ruleToggle);
      autoAnalyzeRules[idx].enabled = cb.checked;
      cb.nextElementSibling.textContent = cb.checked ? "On" : "Off";
      scheduleSave();
    });
  });
  el.autoRulesList.querySelectorAll("[data-rule-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      autoAnalyzeRules.splice(parseInt(btn.dataset.ruleDelete), 1);
      renderAutoRules();
      scheduleSave();
    });
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────
function attachListeners() {
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
  el.reasoningEffort.addEventListener("change", scheduleSave);
  el.openaiReasoningEffort.addEventListener("change", scheduleSave);

  el.temperature.addEventListener("input", () => {
    el.tempValue.textContent = el.temperature.value;
    scheduleSave();
  });

  // Extended thinking
  el.extendedThinkingEnabled.addEventListener("change", () => {
    updateReasoningControls();
    scheduleSave();
  });
  el.thinkingBudget.addEventListener("input", scheduleSave);
  el.responseLanguage.addEventListener("change", scheduleSave);
  el.showBadge.addEventListener("change", scheduleSave);

  // History
  el.maxHistory.addEventListener("input", scheduleSave);
  el.openHistory.addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("history/history.html") });
  });
  el.clearHistory.addEventListener("click", async () => {
    if (confirm("Clear all analysis history? This cannot be undone.")) {
      await browser.runtime.sendMessage({ action: "clearHistory" });
      el.clearHistory.textContent = "Cleared!";
      setTimeout(() => { el.clearHistory.textContent = "Clear All History"; }, 2000);
    }
  });

  // Prompt editing
  el.promptProvider.addEventListener("change", savePrompt);
  el.promptSystem.addEventListener("input", savePrompt);
  el.promptUser.addEventListener("input", savePrompt);

  el.resetPrompt.addEventListener("click", () => {
    const defaults = DEFAULT_PRESETS[currentPresetKey];
    if (!defaults) return;
    el.promptProvider.value = "";
    el.promptSystem.value = defaults.system;
    el.promptUser.value = defaults.prompt;
    delete customPresets[currentPresetKey];
    const tab = el.tabList.querySelector(`[data-key="${currentPresetKey}"]`);
    if (tab) tab.classList.remove("modified");
    el.promptStatus.textContent = "Reset to default";
    setTimeout(() => { el.promptStatus.textContent = ""; }, 2000);
    scheduleSave();
  });

  // Add custom preset
  el.addPreset.addEventListener("click", () => {
    const name = prompt("Enter a name for your new preset:");
    if (!name || !name.trim()) return;
    const key = "custom_" + Date.now();
    customPresets[key] = {
      isCustom: true,
      label: name.trim(),
      provider: "",
      system: "You are a helpful assistant.",
      prompt: "Analyze the following webpage content. Use markdown formatting."
    };
    buildPromptTabs();
    selectPromptTab(key);
    populateRulePresets();
    scheduleSave();
  });

  // Delete custom preset
  el.deletePreset.addEventListener("click", () => {
    if (!customPresets[currentPresetKey]?.isCustom) return;
    if (!confirm(`Delete preset "${customPresets[currentPresetKey].label}"?`)) return;
    delete customPresets[currentPresetKey];
    buildPromptTabs();
    selectPromptTab("summary");
    populateRulePresets();
    scheduleSave();
  });

  // Add auto-analyze rule
  el.addRule.addEventListener("click", () => {
    const urlPattern = el.ruleUrl.value.trim();
    if (!urlPattern) return;
    autoAnalyzeRules.push({
      id: "rule-" + Date.now(),
      enabled: true,
      urlPattern,
      preset: el.rulePreset.value,
      provider: el.ruleProvider.value,
      delay: parseInt(el.ruleDelay.value, 10) || 2000
    });
    el.ruleUrl.value = "";
    renderAutoRules();
    scheduleSave();
  });

  // Monitors
  populateMonitorPresetDropdown();
  el.addMonitor.addEventListener("click", addMonitor);

  // RSS Feeds
  renderFeeds();
  el.addFeed.addEventListener("click", addFeedHandler);
  el.openFeedReader.addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("feeds/feeds.html") });
  });
  document.getElementById("delete-all-feeds").addEventListener("click", async () => {
    if (!confirm("Delete all feeds and their entries? This cannot be undone.")) return;
    await browser.runtime.sendMessage({ action: "deleteAllFeeds" });
    renderFeeds();
  });

  // Archive Redirect
  loadArchiveSettings();
  el.archiveSave.addEventListener("click", saveArchiveSettings);
  el.archiveReset.addEventListener("click", resetArchiveSettings);

  // Import/Export
  el.exportSettings.addEventListener("click", exportSettingsToFile);
  el.importSettings.addEventListener("click", () => el.importFile.click());
  el.importFile.addEventListener("change", importSettingsFromFile);

}

// ──────────────────────────────────────────────
// Import / Export
// ──────────────────────────────────────────────
async function exportSettingsToFile() {
  const data = await browser.storage.local.get(null);
  // Remove transient keys
  const exported = {};
  const keepKeys = [
    "defaultProvider", "providers", "maxTokens", "maxInputChars", "temperature",
    "reasoningEffort", "openaiReasoningEffort", "customPresets", "extendedThinking", "autoAnalyzeRules", "maxHistorySize"
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

    // Basic validation
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
// Page Monitors
// ──────────────────────────────────────────────
async function populateMonitorPresetDropdown() {
  // Clear existing options except "None"
  while (el.monitorPreset.options.length > 1) el.monitorPreset.remove(1);
  // All built-in presets from DEFAULT_PRESETS
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    el.monitorPreset.appendChild(opt);
  }
  // User-created custom presets
  const { customPresets } = await browser.storage.local.get({ customPresets: {} });
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = preset.label || key;
      el.monitorPreset.appendChild(opt);
    }
  }
}

async function renderMonitors() {
  const response = await browser.runtime.sendMessage({ action: "getMonitors" });
  if (!response || !response.success) return;

  el.monitorList.replaceChildren();

  if (!response.monitors.length) {
    const empty = document.createElement("p");
    empty.className = "info-text";
    empty.textContent = "No page monitors configured.";
    el.monitorList.appendChild(empty);
    return;
  }

  response.monitors.forEach(monitor => {
    const row = document.createElement("div");
    row.className = "rule-item";
    row.style.flexWrap = "wrap";

    const info = document.createElement("div");
    info.className = "rule-info";

    const title = document.createElement("strong");
    title.textContent = monitor.title || monitor.url;
    info.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    const interval = monitor.intervalMinutes >= 60
      ? `${monitor.intervalMinutes / 60}h`
      : `${monitor.intervalMinutes}m`;
    const flags = [];
    if (monitor.autoOpen) flags.push("auto-open");
    if (monitor.autoBookmark) flags.push("bookmarked");
    if (monitor.analysisPreset) flags.push(`preset: ${monitor.analysisPreset}`);
    const flagStr = flags.length ? ` | ${flags.join(", ")}` : "";
    let durationStr = "";
    if (monitor.expired) {
      durationStr = " | EXPIRED";
    } else if (monitor.expiresAt) {
      const remaining = new Date(monitor.expiresAt).getTime() - Date.now();
      if (remaining > 0) {
        const hrs = Math.round(remaining / 3600000);
        durationStr = hrs >= 24 ? ` | ${Math.round(hrs / 24)}d left` : ` | ${hrs}h left`;
      } else {
        durationStr = " | EXPIRED";
      }
    }
    meta.textContent = ` — ${interval} interval | ${monitor.changeCount} changes | Last: ${new Date(monitor.lastChecked).toLocaleString()}${flagStr}${durationStr}`;
    info.appendChild(meta);

    if (monitor.lastChangeSummary) {
      const summaryWrap = document.createElement("div");
      summaryWrap.style.marginTop = "4px";

      const isLong = monitor.lastChangeSummary.length > 280;
      const summaryPreview = document.createElement("span");
      summaryPreview.className = "rule-meta";
      summaryPreview.style.display = "block";
      summaryPreview.style.color = "var(--accent)";
      summaryPreview.style.fontStyle = "italic";
      summaryPreview.textContent = isLong
        ? `Latest: ${monitor.lastChangeSummary.slice(0, 280)}...`
        : `Latest: ${monitor.lastChangeSummary}`;
      summaryWrap.appendChild(summaryPreview);

      if (isLong) {
        const summaryFull = document.createElement("span");
        summaryFull.className = "rule-meta hidden";
        summaryFull.style.display = "none";
        summaryFull.style.color = "var(--accent)";
        summaryFull.style.fontStyle = "italic";
        summaryFull.style.whiteSpace = "pre-wrap";
        summaryFull.textContent = `Latest: ${monitor.lastChangeSummary}`;
        summaryWrap.appendChild(summaryFull);

        const expandBtn = document.createElement("button");
        expandBtn.className = "btn btn-sm";
        expandBtn.style.cssText = "background:none;border:none;color:var(--text-secondary);font-size:11px;padding:2px 0;cursor:pointer;text-decoration:underline;";
        expandBtn.textContent = "Show full analysis";
        expandBtn.addEventListener("click", () => {
          const isExpanded = summaryFull.style.display !== "none";
          summaryPreview.style.display = isExpanded ? "block" : "none";
          summaryFull.style.display = isExpanded ? "none" : "block";
          expandBtn.textContent = isExpanded ? "Show full analysis" : "Collapse";
        });
        summaryWrap.appendChild(expandBtn);
      }

      info.appendChild(summaryWrap);
    }

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-sm btn-secondary";
    toggleBtn.textContent = monitor.enabled ? "Pause" : "Resume";
    toggleBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        enabled: !monitor.enabled
      });
      renderMonitors();
    });

    // Auto-open toggle
    const autoOpenBtn = document.createElement("button");
    autoOpenBtn.className = `btn btn-sm btn-secondary${monitor.autoOpen ? " active" : ""}`;
    autoOpenBtn.textContent = monitor.autoOpen ? "Auto-open: ON" : "Auto-open: OFF";
    autoOpenBtn.title = "Automatically open the page in a new tab when a change is detected";
    autoOpenBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        autoOpen: !monitor.autoOpen
      });
      renderMonitors();
    });

    // Interval selector
    const intervalSelect = document.createElement("select");
    intervalSelect.className = "btn btn-sm btn-secondary";
    intervalSelect.style.cursor = "pointer";
    intervalSelect.style.width = "auto";
    intervalSelect.style.minWidth = "0";
    intervalSelect.style.maxWidth = "70px";
    [1, 3, 5, 10, 15, 30, 60, 360, 720, 1440, 2160, 2880, 4320].forEach(mins => {
      const opt = document.createElement("option");
      opt.value = mins;
      opt.textContent = mins >= 1440 ? `${mins / 1440}d` : mins >= 60 ? `${mins / 60}h` : `${mins}m`;
      if (mins === monitor.intervalMinutes) opt.selected = true;
      intervalSelect.appendChild(opt);
    });
    intervalSelect.addEventListener("change", async () => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        intervalMinutes: parseInt(intervalSelect.value, 10)
      });
      renderMonitors();
    });

    const historyBtn = document.createElement("button");
    historyBtn.className = "btn btn-sm btn-secondary";
    historyBtn.textContent = "History";
    historyBtn.addEventListener("click", () => {
      browser.tabs.create({
        url: browser.runtime.getURL(`monitors/monitor-history.html?id=${encodeURIComponent(monitor.id)}&title=${encodeURIComponent(monitor.title || monitor.url)}`)
      });
    });

    const timelineBtn = document.createElement("button");
    timelineBtn.className = "btn btn-sm btn-secondary";
    timelineBtn.textContent = "Timeline";
    timelineBtn.title = "View full page snapshots over time";
    timelineBtn.addEventListener("click", () => {
      browser.tabs.create({
        url: browser.runtime.getURL(`monitors/monitor-history.html?id=${encodeURIComponent(monitor.id)}&title=${encodeURIComponent(monitor.title || monitor.url)}&view=timeline`)
      });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "deleteMonitor", id: monitor.id });
      renderMonitors();
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(autoOpenBtn);
    actions.appendChild(intervalSelect);
    actions.appendChild(historyBtn);
    actions.appendChild(timelineBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);
    el.monitorList.appendChild(row);
  });

  // Update storage usage bar
  updateMonitorStorageUsage();
}

async function updateMonitorStorageUsage() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getMonitorStorageUsage" });
    if (!resp || !resp.success) return;
    const mb = resp.totalBytes / (1024 * 1024);
    const maxMb = 10; // reasonable threshold for warning
    const pct = Math.min(100, (mb / maxMb) * 100);
    el.monitorStorageBar.style.display = "";
    el.monitorStorageLabel.textContent = `${mb.toFixed(2)} MB`;
    el.monitorStorageFill.style.width = `${pct}%`;
    el.monitorStorageFill.style.background = pct > 80 ? "var(--error)" : pct > 50 ? "var(--accent)" : "var(--success)";
  } catch { /* non-critical */ }
}

// ──────────────────────────────────────────────
// RSS Feeds
// ──────────────────────────────────────────────

async function renderFeeds() {
  const resp = await browser.runtime.sendMessage({ action: "getFeeds" });
  if (!resp || !resp.success) return;

  el.feedList.replaceChildren();

  if (!resp.feeds.length) {
    const empty = document.createElement("p");
    empty.className = "info-text";
    empty.textContent = "No RSS feeds subscribed.";
    el.feedList.appendChild(empty);
    return;
  }

  resp.feeds.forEach(feed => {
    const row = document.createElement("div");
    row.className = "rule-item";
    row.style.flexWrap = "wrap";

    const info = document.createElement("div");
    info.className = "rule-info";

    const title = document.createElement("strong");
    title.textContent = feed.title || feed.url;
    info.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    const interval = feed.checkIntervalMinutes >= 60
      ? `${feed.checkIntervalMinutes / 60}h`
      : `${feed.checkIntervalMinutes}m`;
    const flags = [];
    if (feed.aiSummarize) flags.push("AI summaries");
    if (feed.monitorBridge) flags.push("monitor bridge");
    const flagStr = flags.length ? ` | ${flags.join(", ")}` : "";
    meta.textContent = ` — ${interval} interval | ${feed.unreadCount} unread / ${feed.totalEntries} total | Last: ${new Date(feed.lastFetched).toLocaleString()}${flagStr}`;
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-sm btn-secondary";
    toggleBtn.textContent = feed.enabled ? "Pause" : "Resume";
    toggleBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "updateFeed", id: feed.id, enabled: !feed.enabled });
      renderFeeds();
    });

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "btn btn-sm btn-secondary";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "...";
      await browser.runtime.sendMessage({ action: "refreshFeed", id: feed.id });
      renderFeeds();
    });

    const readBtn = document.createElement("button");
    readBtn.className = "btn btn-sm btn-secondary";
    readBtn.textContent = "Open Reader";
    readBtn.addEventListener("click", () => {
      browser.tabs.create({ url: browser.runtime.getURL(`feeds/feeds.html?feedId=${encodeURIComponent(feed.id)}`) });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "deleteFeed", id: feed.id });
      renderFeeds();
    });

    const intervalSelect = document.createElement("select");
    intervalSelect.className = "btn btn-sm btn-secondary";
    intervalSelect.style.cssText = "padding:4px 6px;font-size:11px;cursor:pointer;";
    intervalSelect.title = "Change check interval";
    for (const [val, label] of [["1","1m"],["3","3m"],["5","5m"],["10","10m"],["15","15m"],["30","30m"],["60","1h"],["360","6h"],["720","12h"],["1440","1d"],["2160","36h"],["2880","2d"],["4320","3d"]]) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      if (parseInt(val) === feed.checkIntervalMinutes) opt.selected = true;
      intervalSelect.appendChild(opt);
    }
    intervalSelect.addEventListener("change", async () => {
      await browser.runtime.sendMessage({
        action: "updateFeed", id: feed.id,
        checkIntervalMinutes: parseInt(intervalSelect.value)
      });
      renderFeeds();
    });

    actions.appendChild(intervalSelect);
    actions.appendChild(toggleBtn);
    actions.appendChild(refreshBtn);
    actions.appendChild(readBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);
    el.feedList.appendChild(row);
  });
}

async function addFeedHandler() {
  const url = el.feedUrl.value.trim();
  if (!url) return;

  el.addFeed.disabled = true;
  el.feedStatus.textContent = "Discovering feed...";
  el.feedStatus.style.color = "var(--text-muted)";

  const resp = await browser.runtime.sendMessage({
    action: "addFeed",
    url,
    title: el.feedTitle.value.trim() || "",
    intervalMinutes: parseInt(el.feedInterval.value, 10) || 60,
    aiSummarize: el.feedAiSummarize.checked,
    monitorBridge: el.feedMonitorBridge.checked
  });

  el.addFeed.disabled = false;

  if (resp && resp.success) {
    el.feedUrl.value = "";
    el.feedTitle.value = "";
    el.feedStatus.textContent = `Subscribed to "${resp.feed.title}"!`;
    el.feedStatus.style.color = "var(--success)";
    renderFeeds();
  } else {
    el.feedStatus.textContent = resp?.error || "Failed to add feed.";
    el.feedStatus.style.color = "var(--error)";
  }

  setTimeout(() => { el.feedStatus.textContent = ""; }, 3000);
}

// ──────────────────────────────────────────────
// Archive Redirect
// ──────────────────────────────────────────────

async function loadArchiveSettings() {
  const resp = await browser.runtime.sendMessage({ action: "getArchiveSettings" });
  if (!resp || !resp.success) return;
  el.archiveEnabled.checked = resp.enabled;
  el.archiveDomains.value = (resp.domains || []).join("\n");
  // Set provider dropdown
  const providerUrl = resp.providerUrl || "https://archive.is/";
  const knownOptions = [...el.archiveProvider.options].map(o => o.value);
  if (knownOptions.includes(providerUrl)) {
    el.archiveProvider.value = providerUrl;
  } else {
    el.archiveProvider.value = "custom";
    el.archiveCustomUrl.value = providerUrl;
    el.archiveCustomGroup.style.display = "";
  }
  // Archive check mode
  const { archiveCheckMode, waybackCheckMode } = await browser.storage.local.get({ archiveCheckMode: "off", waybackCheckMode: "off" });
  document.getElementById("archive-check-mode").value = archiveCheckMode;
  document.getElementById("wayback-check-mode").value = waybackCheckMode ?? "off";
  // Toggle custom field visibility
  el.archiveProvider.addEventListener("change", () => {
    el.archiveCustomGroup.style.display = el.archiveProvider.value === "custom" ? "" : "none";
  });
}

async function saveArchiveSettings() {
  const enabled = el.archiveEnabled.checked;

  // Request webRequest permissions when enabling redirect
  if (enabled) {
    const granted = await browser.permissions.request({
      permissions: ["webRequest", "webRequestBlocking"]
    });
    if (!granted) {
      el.archiveStatus.textContent = "Permission denied — redirect requires webRequest permission.";
      el.archiveStatus.style.color = "var(--error)";
      el.archiveEnabled.checked = false;
      setTimeout(() => { el.archiveStatus.textContent = ""; }, 4000);
      return;
    }
  }

  const domains = el.archiveDomains.value
    .split("\n")
    .map(d => d.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
  const providerUrl = el.archiveProvider.value === "custom"
    ? el.archiveCustomUrl.value.trim()
    : el.archiveProvider.value;
  await browser.runtime.sendMessage({
    action: "saveArchiveSettings",
    enabled,
    domains,
    providerUrl
  });
  // Save archive check mode
  await browser.storage.local.set({
    archiveCheckMode: document.getElementById("archive-check-mode").value,
    waybackCheckMode: document.getElementById("wayback-check-mode").value
  });
  el.archiveStatus.textContent = "Saved!";
  el.archiveStatus.style.color = "var(--success)";
  setTimeout(() => { el.archiveStatus.textContent = ""; }, 2000);
}

async function resetArchiveSettings() {
  el.archiveDomains.value = [
    "cnn.com", "nytimes.com", "washingtonpost.com", "wsj.com",
    "bloomberg.com", "reuters.com", "bbc.com", "theguardian.com",
    "forbes.com", "businessinsider.com", "wired.com", "townhall.com",
    "theatlantic.com", "newyorker.com", "theepochtimes.com",
    "latimes.com", "usatoday.com", "politico.com", "thedailybeast.com",
    "vanityfair.com", "ft.com", "economist.com", "newsweek.com", "time.com"
  ].join("\n");
  el.archiveEnabled.checked = false;
  el.archiveProvider.value = "https://archive.is/";
  el.archiveCustomGroup.style.display = "none";
  el.archiveStatus.textContent = "Reset to defaults (not saved yet)";
  el.archiveStatus.style.color = "var(--text-muted)";
  setTimeout(() => { el.archiveStatus.textContent = ""; }, 3000);
}

// ──────────────────────────────────────────────
// Monitor Add
// ──────────────────────────────────────────────

async function addMonitor() {
  const url = el.monitorUrl.value.trim();
  if (!url) return;

  el.addMonitor.disabled = true;
  el.monitorStatus.textContent = "Adding monitor...";

  const response = await browser.runtime.sendMessage({
    action: "addMonitor",
    url,
    title: el.monitorTitle.value.trim() || "",
    intervalMinutes: parseInt(el.monitorInterval.value, 10) || 60,
    duration: parseInt(el.monitorDuration.value, 10) || 0,
    aiAnalysis: el.monitorAi.checked,
    autoOpen: el.monitorAutoOpen.checked,
    autoBookmark: el.monitorAutoBookmark.checked,
    analysisPreset: el.monitorPreset.value || ""
  });

  el.addMonitor.disabled = false;

  if (response && response.success) {
    el.monitorUrl.value = "";
    el.monitorTitle.value = "";
    el.monitorStatus.textContent = "Monitor added!";
    el.monitorStatus.style.color = "var(--success)";
    renderMonitors();
  } else {
    el.monitorStatus.textContent = response?.error || "Failed to add monitor.";
    el.monitorStatus.style.color = "var(--error)";
  }

  setTimeout(() => { el.monitorStatus.textContent = ""; }, 3000);
}

function updateMultiAgentVisibility() {
  const xaiModel = providers.xai?.model || "";
  const isDefault = el.defaultProvider.value === "xai";
  const isMultiAgent = isDefault && xaiModel.includes("multi-agent");
  el.multiAgentCard.style.display = isMultiAgent ? "" : "none";
}

function isOpenaiReasoningModel(model) {
  return typeof model === "string" && /^o\d/i.test(model);
}

function updateThinkingBudgetState() {
  const isClaudeDefault = el.defaultProvider.value === "anthropic";
  el.thinkingBudget.disabled = !isClaudeDefault;
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

  el.openaiReasoningCard.style.display = isOpenaiDefault ? "" : "none";
  el.openaiReasoningEffort.disabled = !supportsReasoning;

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
// Main tab navigation
// ──────────────────────────────────────────────
function initMainTabs() {
  const nav = document.getElementById("main-nav");
  const tabs = nav.querySelectorAll(".nav-tab");
  const panels = document.querySelectorAll(".tab-panel");

  // Restore last active tab from URL hash or sessionStorage
  const hash = window.location.hash.replace("#", "");
  const savedTab = hash || sessionStorage.getItem("argus-activeTab") || "bookmarks";

  switchMainTab(savedTab, tabs, panels);

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      switchMainTab(tabName, tabs, panels);
      sessionStorage.setItem("argus-activeTab", tabName);
      history.replaceState(null, "", `#${tabName}`);
    });
  });
}

function initHelpBackToTop() {
  document.querySelectorAll('[data-panel="help"] section[id^="help-"]').forEach(section => {
    const link = document.createElement("a");
    link.href = "#help-top";
    link.className = "help-back-top";
    link.textContent = "Back to top";
    section.querySelector(".card-body").appendChild(link);
  });
}

function switchMainTab(tabName, tabs, panels) {
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  panels.forEach(p => p.classList.toggle("active", p.dataset.panel === tabName));

  // Lazy-load bookmarks when tab is first shown
  if (tabName === "bookmarks" && !bmState.initialized) {
    initBookmarks();
  }
  if (tabName === "projects" && !projState.initialized) {
    initProjects();
  }
}

// ──────────────────────────────────────────────
// Bookmarks (embedded in console)
// ──────────────────────────────────────────────
const bmState = {
  initialized: false,
  filter: { tag: null, category: null, query: "" },
  editingId: null,
  selectionMode: false,
  selected: new Map()
};

const bmEl = {};

function initBookmarks() {
  bmState.initialized = true;

  bmEl.search = document.getElementById("bm-search");
  bmEl.categoryList = document.getElementById("bm-category-list");
  bmEl.tagCloud = document.getElementById("bm-tag-cloud");
  bmEl.activeFilters = document.getElementById("bm-active-filters");
  bmEl.count = document.getElementById("bm-count");
  bmEl.list = document.getElementById("bm-list");
  bmEl.empty = document.getElementById("bm-empty");
  bmEl.exportBtn = document.getElementById("bm-export");
  bmEl.selectToggle = document.getElementById("bm-select-toggle");
  bmEl.analyzeSelected = document.getElementById("bm-analyze-selected");
  bmEl.editModal = document.getElementById("bm-edit-modal");
  bmEl.modalClose = document.getElementById("bm-modal-close");
  bmEl.editTags = document.getElementById("bm-edit-tags");
  bmEl.editCategory = document.getElementById("bm-edit-category");
  bmEl.editNotes = document.getElementById("bm-edit-notes");
  bmEl.editSave = document.getElementById("bm-edit-save");
  bmEl.editCancel = document.getElementById("bm-edit-cancel");

  let searchTimeout;
  bmEl.search.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      bmState.filter.query = bmEl.search.value.trim();
      bmLoadBookmarks();
    }, 300);
  });

  bmEl.exportBtn.addEventListener("click", bmExportBookmarks);
  bmEl.selectToggle.addEventListener("click", bmToggleSelection);
  bmEl.analyzeSelected.addEventListener("click", bmAnalyzeSelected);
  bmEl.modalClose.addEventListener("click", bmCloseModal);
  bmEl.editCancel.addEventListener("click", bmCloseModal);
  bmEl.editSave.addEventListener("click", bmSaveEdit);
  bmEl.editModal.addEventListener("click", (e) => {
    if (e.target === bmEl.editModal) bmCloseModal();
  });

  bmLoadBookmarks();
}

async function bmLoadBookmarks() {
  const response = await browser.runtime.sendMessage({
    action: "getBookmarks",
    tag: bmState.filter.tag,
    category: bmState.filter.category,
    query: bmState.filter.query
  });
  if (!response || !response.success) return;

  bmRenderSidebar(response.tags, response.categories);
  bmRenderActiveFilters();
  bmRenderBookmarks(response.bookmarks, response.total);
}

function bmRenderSidebar(tags, categories) {
  bmEl.categoryList.replaceChildren();
  const allItem = document.createElement("div");
  allItem.className = "bm-filter-item" + (!bmState.filter.category ? " active" : "");
  allItem.textContent = "All";
  allItem.addEventListener("click", () => { bmState.filter.category = null; bmLoadBookmarks(); });
  bmEl.categoryList.appendChild(allItem);

  categories.forEach(({ category, count }) => {
    const item = document.createElement("div");
    item.className = "bm-filter-item" + (bmState.filter.category === category ? " active" : "");
    const name = document.createElement("span");
    name.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    const badge = document.createElement("span");
    badge.className = "bm-filter-count";
    badge.textContent = count;
    item.appendChild(name);
    item.appendChild(badge);
    item.addEventListener("click", () => {
      bmState.filter.category = bmState.filter.category === category ? null : category;
      bmLoadBookmarks();
    });
    bmEl.categoryList.appendChild(item);
  });

  bmEl.tagCloud.replaceChildren();
  tags.slice(0, 30).forEach(({ tag, count }) => {
    const pill = document.createElement("span");
    pill.className = "bm-tag-pill" + (bmState.filter.tag === tag ? " active" : "");
    pill.textContent = `${tag} (${count})`;
    pill.addEventListener("click", () => {
      bmState.filter.tag = bmState.filter.tag === tag ? null : tag;
      bmLoadBookmarks();
    });
    bmEl.tagCloud.appendChild(pill);
  });
}

function bmRenderActiveFilters() {
  bmEl.activeFilters.replaceChildren();
  let hasFilter = false;

  if (bmState.filter.category) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Category: " + bmState.filter.category, () => {
      bmState.filter.category = null; bmLoadBookmarks();
    }));
  }
  if (bmState.filter.tag) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Tag: " + bmState.filter.tag, () => {
      bmState.filter.tag = null; bmLoadBookmarks();
    }));
  }
  if (bmState.filter.query) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Search: " + bmState.filter.query, () => {
      bmState.filter.query = ""; bmEl.search.value = ""; bmLoadBookmarks();
    }));
  }
  bmEl.activeFilters.classList.toggle("hidden", !hasFilter);
}

function bmCreateFilterChip(text, onRemove) {
  const chip = document.createElement("span");
  chip.className = "bm-active-filter";
  chip.textContent = text;
  const x = document.createElement("span");
  x.className = "bm-active-filter-remove";
  x.textContent = "\u00d7";
  x.addEventListener("click", (e) => { e.stopPropagation(); onRemove(); });
  chip.appendChild(x);
  return chip;
}

function bmRenderBookmarks(bookmarks, total) {
  bmEl.count.textContent = `${total} bookmark${total !== 1 ? "s" : ""}`;
  bmEl.list.replaceChildren();
  bmEl.empty.classList.toggle("hidden", bookmarks.length > 0);

  bookmarks.forEach(bm => {
    const card = document.createElement("div");
    card.className = "bm-card" + (bmState.selected.has(bm.id) ? " selected" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bm-checkbox" + (bmState.selectionMode ? "" : " hidden");
    checkbox.checked = bmState.selected.has(bm.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) { bmState.selected.set(bm.id, bm); card.classList.add("selected"); }
      else { bmState.selected.delete(bm.id); card.classList.remove("selected"); }
      bmUpdateSelectionCount();
    });

    const header = document.createElement("div");
    header.className = "bm-card-header";
    const headerLeft = document.createElement("div");
    headerLeft.className = "bm-card-header-left";
    headerLeft.appendChild(checkbox);
    const title = document.createElement("a");
    title.className = "bm-card-title";
    title.href = bm.url;
    title.target = "_blank";
    title.textContent = bm.title;
    headerLeft.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "bm-card-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => bmOpenEditModal(bm));
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => bmDeleteBookmark(bm.id));
    const projBtn = document.createElement("button");
    projBtn.className = "btn btn-sm btn-secondary";
    projBtn.textContent = "+ Project";
    projBtn.addEventListener("click", async () => {
      const resp = await browser.runtime.sendMessage({ action: "getProjects" });
      if (!resp || !resp.success || resp.projects.length === 0) {
        projBtn.textContent = "No projects";
        setTimeout(() => { projBtn.textContent = "+ Project"; }, 1500);
        return;
      }
      // Simple dropdown
      let dd = projBtn.parentElement.querySelector(".bm-proj-dropdown");
      if (dd) { dd.remove(); return; }
      dd = document.createElement("div");
      dd.className = "bm-proj-dropdown";
      dd.style.cssText = "position:absolute;top:100%;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);min-width:180px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
      for (const proj of resp.projects) {
        const opt = document.createElement("button");
        opt.style.cssText = "display:flex;align-items:center;gap:6px;width:100%;padding:8px 12px;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text-primary);font-size:12px;cursor:pointer;text-align:left;";
        const optDot = document.createElement("span");
        optDot.setAttribute("style", "width:8px;height:8px;border-radius:50%;background:" + (proj.color || '#e94560') + ";display:inline-block;");
        opt.appendChild(optDot);
        opt.appendChild(document.createTextNode(proj.name));
        opt.addEventListener("click", async () => {
          await browser.runtime.sendMessage({
            action: "addProjectItem",
            projectId: proj.id,
            item: { type: "bookmark", refId: bm.id, url: bm.url, title: bm.title, summary: bm.summary || "", tags: bm.tags || [] }
          });
          dd.remove();
          projBtn.textContent = "Added!";
          setTimeout(() => { projBtn.textContent = "+ Project"; }, 1500);
        });
        dd.appendChild(opt);
      }
      projBtn.parentElement.style.position = "relative";
      projBtn.parentElement.appendChild(dd);
      const dismiss = (e) => { if (!dd.contains(e.target) && e.target !== projBtn) { dd.remove(); document.removeEventListener("click", dismiss); } };
      setTimeout(() => document.addEventListener("click", dismiss), 0);
    });
    actions.appendChild(editBtn);
    actions.appendChild(projBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(headerLeft);
    header.appendChild(actions);
    card.appendChild(header);

    const url = document.createElement("div");
    url.className = "bm-card-url";
    url.textContent = bm.url;
    card.appendChild(url);

    if (bm.summary) {
      const summary = document.createElement("div");
      summary.className = "bm-card-summary";
      summary.textContent = bm.summary;
      card.appendChild(summary);
    }

    if (bm.tags && bm.tags.length) {
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "bm-card-tags";
      bm.tags.forEach(tag => {
        const tagEl = document.createElement("span");
        tagEl.className = "bm-card-tag";
        tagEl.textContent = tag;
        tagEl.addEventListener("click", () => { bmState.filter.tag = tag; bmLoadBookmarks(); });
        tagsDiv.appendChild(tagEl);
      });
      card.appendChild(tagsDiv);
    }

    if (bm.notes) {
      const notes = document.createElement("div");
      notes.className = "bm-card-notes";
      notes.textContent = bm.notes;
      card.appendChild(notes);
    }

    const meta = document.createElement("div");
    meta.className = "bm-card-meta";
    const date = document.createElement("span");
    date.textContent = new Date(bm.savedAt).toLocaleDateString();
    meta.appendChild(date);
    if (bm.category) {
      const cat = document.createElement("span");
      cat.textContent = bm.category;
      meta.appendChild(cat);
    }
    if (bm.readingTime) {
      const rt = document.createElement("span");
      rt.textContent = bm.readingTime;
      meta.appendChild(rt);
    }
    if (bm.aiTagged) {
      const ai = document.createElement("span");
      ai.textContent = "AI tagged";
      ai.style.color = "var(--accent)";
      meta.appendChild(ai);
    }
    card.appendChild(meta);
    bmEl.list.appendChild(card);
  });
}

function bmOpenEditModal(bookmark) {
  bmState.editingId = bookmark.id;
  bmEl.editTags.value = (bookmark.tags || []).join(", ");
  bmEl.editCategory.value = bookmark.category || "";
  bmEl.editNotes.value = bookmark.notes || "";
  bmEl.editModal.classList.remove("hidden");
}

function bmCloseModal() {
  bmEl.editModal.classList.add("hidden");
  bmState.editingId = null;
}

async function bmSaveEdit() {
  if (!bmState.editingId) return;
  const tags = bmEl.editTags.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  const category = bmEl.editCategory.value.trim().toLowerCase() || "other";
  const notes = bmEl.editNotes.value.trim();
  await browser.runtime.sendMessage({ action: "updateBookmark", id: bmState.editingId, tags, category, notes });
  bmCloseModal();
  bmLoadBookmarks();
}

async function bmDeleteBookmark(id) {
  await browser.runtime.sendMessage({ action: "deleteBookmark", id });
  bmLoadBookmarks();
}

async function bmExportBookmarks() {
  const response = await browser.runtime.sendMessage({ action: "exportBookmarks" });
  if (!response || !response.success) return;
  const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "argus-bookmarks.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bmToggleSelection() {
  bmState.selectionMode = !bmState.selectionMode;
  bmEl.selectToggle.textContent = bmState.selectionMode ? "Cancel" : "Select";
  bmEl.selectToggle.classList.toggle("bm-select-active", bmState.selectionMode);
  if (!bmState.selectionMode) {
    bmState.selected.clear();
    bmEl.analyzeSelected.classList.add("hidden");
  }
  document.querySelectorAll(".bm-checkbox").forEach(cb => {
    cb.classList.toggle("hidden", !bmState.selectionMode);
    if (!bmState.selectionMode) cb.checked = false;
  });
  document.querySelectorAll(".bm-card").forEach(card => card.classList.remove("selected"));
  bmUpdateSelectionCount();
}

function bmUpdateSelectionCount() {
  const count = bmState.selected.size;
  if (count > 0) {
    bmEl.analyzeSelected.textContent = `Analyze ${count} Bookmark${count > 1 ? "s" : ""}`;
    bmEl.analyzeSelected.classList.remove("hidden");
  } else {
    bmEl.analyzeSelected.classList.add("hidden");
  }
}

async function bmAnalyzeSelected() {
  if (bmState.selected.size === 0) return;
  bmEl.analyzeSelected.disabled = true;
  bmEl.analyzeSelected.textContent = "Starting analysis...";
  const bookmarks = Array.from(bmState.selected.values());
  const response = await browser.runtime.sendMessage({
    action: "analyzeBookmarks",
    bookmarks: bookmarks.map(bm => ({ id: bm.id, title: bm.title, url: bm.url, summary: bm.summary || "", text: bm.text || bm.summary || "" }))
  });
  if (response && response.success) {
    bmState.selected.clear();
    bmState.selectionMode = false;
    bmEl.selectToggle.textContent = "Select";
    bmEl.selectToggle.classList.remove("bm-select-active");
    bmEl.analyzeSelected.classList.add("hidden");
    bmLoadBookmarks();
  } else {
    bmEl.analyzeSelected.disabled = false;
    bmEl.analyzeSelected.textContent = `Analyze ${bmState.selected.size} Bookmarks`;
  }
}

// ──────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────
const projState = {
  initialized: false,
  projects: [],
  activeProjectId: null,
  editingProjectId: null,
  editingItemId: null,
  query: ""
};

const projEl = {};

function initProjects() {
  projState.initialized = true;
  projEl.search = document.getElementById("proj-search");
  projEl.sidebar = document.getElementById("proj-list");
  projEl.main = document.getElementById("proj-main");
  projEl.empty = document.getElementById("proj-empty");
  projEl.detail = document.getElementById("proj-detail");
  projEl.detailHeader = document.getElementById("proj-detail-header");
  projEl.itemsList = document.getElementById("proj-items-list");
  projEl.modal = document.getElementById("proj-modal");
  projEl.modalTitle = document.getElementById("proj-modal-title");
  projEl.modalName = document.getElementById("proj-modal-name");
  projEl.modalDesc = document.getElementById("proj-modal-desc");
  projEl.modalColor = document.getElementById("proj-modal-color");
  projEl.itemModal = document.getElementById("proj-item-modal");
  projEl.itemNotes = document.getElementById("proj-item-notes");

  document.getElementById("proj-new").addEventListener("click", () => projOpenModal());
  document.getElementById("proj-import").addEventListener("click", projImport);
  document.getElementById("proj-export-all").addEventListener("click", projExportAll);
  document.getElementById("proj-add-note").addEventListener("click", () => projAddItem("note"));
  document.getElementById("proj-add-url").addEventListener("click", () => projAddItem("url"));
  document.getElementById("proj-export").addEventListener("click", () => projExportOne(projState.activeProjectId));
  document.getElementById("proj-modal-save").addEventListener("click", projSaveModal);
  document.getElementById("proj-modal-cancel").addEventListener("click", () => projEl.modal.classList.add("hidden"));
  document.getElementById("proj-item-save").addEventListener("click", projSaveItemNotes);
  document.getElementById("proj-item-cancel").addEventListener("click", () => projEl.itemModal.classList.add("hidden"));

  // Batch analysis — populate preset dropdown
  const batchSelect = document.getElementById("proj-batch-preset");
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    batchSelect.appendChild(opt);
  }
  document.getElementById("proj-batch-run").addEventListener("click", projBatchAnalyze);

  projEl.search.addEventListener("input", () => {
    projState.query = projEl.search.value.trim().toLowerCase();
    projRenderSidebar();
  });

  // OSINT project tool buttons
  document.getElementById("proj-entity-extract").addEventListener("click", projRunEntityExtraction);
  document.getElementById("proj-connection-graph").addEventListener("click", projOpenConnectionGraph);
  document.getElementById("proj-heatmap").addEventListener("click", projOpenHeatmap);
  document.getElementById("proj-geomap").addEventListener("click", projOpenGeomap);
  document.getElementById("proj-timeline").addEventListener("click", projOpenTimeline);
  document.getElementById("proj-report").addEventListener("click", projGenerateReport);
  document.getElementById("proj-anomaly").addEventListener("click", projAnomalyScan);
  document.getElementById("proj-dashboard").addEventListener("click", projOpenDashboard);

  projLoadProjects();
  checkRunningBatch();
}

async function checkRunningBatch() {
  try {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (s && s.success && s.running) {
      const runBtn = document.getElementById("proj-batch-run");
      const statusEl = document.getElementById("proj-batch-status");
      runBtn.textContent = "Cancel";
      runBtn.onclick = projCancelBatch;
      statusEl.textContent = `Analyzing ${s.done + 1} of ${s.total}: ${s.current}...`;
      batchPollTimer = setInterval(() => pollBatchStatus(), 1500);
    }
  } catch { /* ignore */ }
}

async function projLoadProjects() {
  const resp = await browser.runtime.sendMessage({ action: "getProjects" });
  if (resp && resp.success) {
    projState.projects = resp.projects;
    projRenderSidebar();
    if (projState.activeProjectId) {
      const still = projState.projects.find(p => p.id === projState.activeProjectId);
      if (still) projSelectProject(still.id);
      else projShowEmpty();
    }
  }
}

function projRenderSidebar() {
  let projects = projState.projects;
  if (projState.query) {
    projects = projects.filter(p =>
      p.name.toLowerCase().includes(projState.query) ||
      (p.description || "").toLowerCase().includes(projState.query)
    );
  }
  // Starred first
  projects.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));

  if (projects.length === 0) {
    projEl.sidebar.innerHTML = "";
    const emptyP = document.createElement("p");
    emptyP.className = "info-text";
    emptyP.setAttribute("style", "padding:16px;text-align:center;");
    emptyP.textContent = projState.query ? "No matching projects." : 'No projects yet. Click "+ New Project" to get started.';
    projEl.sidebar.appendChild(emptyP);
    return;
  }

  projEl.sidebar.innerHTML = "";
  for (const proj of projects) {
    const item = document.createElement("div");
    item.className = "proj-list-item" + (proj.id === projState.activeProjectId ? " active" : "");
    const dotSpan = document.createElement("span");
    dotSpan.className = "proj-color-dot";
    dotSpan.setAttribute("style", "background:" + (proj.color || '#e94560'));
    const nameSpan = document.createElement("span");
    nameSpan.className = "proj-list-name";
    nameSpan.textContent = proj.name;
    const countSpan = document.createElement("span");
    countSpan.className = "proj-list-count";
    countSpan.textContent = proj.items.length;
    const starBtn = document.createElement("button");
    starBtn.className = "proj-star-btn" + (proj.starred ? " starred" : "");
    starBtn.dataset.id = proj.id;
    starBtn.title = "Star";
    starBtn.textContent = proj.starred ? '\u2605' : '\u2606';
    item.appendChild(dotSpan);
    item.appendChild(nameSpan);
    item.appendChild(countSpan);
    item.appendChild(starBtn);
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("proj-star-btn")) return;
      projSelectProject(proj.id);
    });
    starBtn.addEventListener("click", () => projToggleStar(proj.id));
    projEl.sidebar.appendChild(item);
  }
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function projShowEmpty() {
  projState.activeProjectId = null;
  projEl.empty.classList.remove("hidden");
  projEl.detail.classList.add("hidden");
}

function projSelectProject(id) {
  projState.activeProjectId = id;
  projEl.empty.classList.add("hidden");
  projEl.detail.classList.remove("hidden");
  projRenderSidebar();
  projRenderDetail();
}

function projRenderDetail() {
  const proj = projState.projects.find(p => p.id === projState.activeProjectId);
  if (!proj) return projShowEmpty();

  projEl.detailHeader.innerHTML = "";
  const titleDiv = document.createElement("div");
  titleDiv.className = "proj-detail-title";
  const detDot = document.createElement("span");
  detDot.className = "proj-color-dot";
  detDot.setAttribute("style", "background:" + (proj.color || '#e94560') + ";width:14px;height:14px;");
  const detH3 = document.createElement("h3");
  detH3.textContent = proj.name;
  const detStarBtn = document.createElement("button");
  detStarBtn.className = "proj-star-btn" + (proj.starred ? " starred" : "");
  detStarBtn.id = "proj-detail-star";
  detStarBtn.title = "Star";
  detStarBtn.textContent = proj.starred ? '\u2605' : '\u2606';
  titleDiv.appendChild(detDot);
  titleDiv.appendChild(detH3);
  titleDiv.appendChild(detStarBtn);
  projEl.detailHeader.appendChild(titleDiv);
  if (proj.description) {
    const descP = document.createElement("p");
    descP.className = "proj-detail-desc";
    descP.textContent = proj.description;
    projEl.detailHeader.appendChild(descP);
  }
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "proj-detail-actions";
  const editBtn2 = document.createElement("button");
  editBtn2.className = "btn btn-secondary btn-sm";
  editBtn2.id = "proj-edit-btn";
  editBtn2.textContent = "Edit";
  const deleteBtn2 = document.createElement("button");
  deleteBtn2.className = "btn btn-secondary btn-sm";
  deleteBtn2.id = "proj-delete-btn";
  deleteBtn2.textContent = "Delete";
  const metaSpan = document.createElement("span");
  metaSpan.setAttribute("style", "font-size:11px;color:var(--text-muted);margin-left:auto;");
  metaSpan.textContent = proj.items.length + " items \u00B7 Updated " + new Date(proj.updatedAt).toLocaleDateString();
  actionsDiv.appendChild(editBtn2);
  actionsDiv.appendChild(deleteBtn2);
  actionsDiv.appendChild(metaSpan);
  projEl.detailHeader.appendChild(actionsDiv);

  document.getElementById("proj-detail-star").addEventListener("click", () => projToggleStar(proj.id));
  document.getElementById("proj-edit-btn").addEventListener("click", () => projOpenModal(proj));
  document.getElementById("proj-delete-btn").addEventListener("click", () => projDelete(proj.id));

  projRenderItems(proj);
}

function projRenderItems(proj) {
  if (proj.items.length === 0) {
    projEl.itemsList.textContent = "";
    const noItems = document.createElement("p");
    noItems.className = "info-text";
    noItems.style.cssText = "text-align:center;padding:32px;";
    noItems.textContent = "No items in this project yet. Add analyses from results pages, bookmarks, notes, or URLs.";
    projEl.itemsList.appendChild(noItems);
    return;
  }

  projEl.itemsList.innerHTML = "";
  for (const item of proj.items) {
    const card = document.createElement("div");
    card.className = "proj-item-card";
    const bodyDiv = document.createElement("div");
    bodyDiv.className = "proj-item-body";
    const titleDiv2 = document.createElement("div");
    titleDiv2.className = "proj-item-title";
    if (item.url) {
      const titleLink = document.createElement("a");
      titleLink.href = item.url;
      titleLink.target = "_blank";
      titleLink.textContent = item.title || item.url;
      titleDiv2.appendChild(titleLink);
    } else {
      titleDiv2.textContent = item.title || "Untitled";
    }
    bodyDiv.appendChild(titleDiv2);
    if (item.url) {
      const urlDiv = document.createElement("div");
      urlDiv.className = "proj-item-url";
      urlDiv.textContent = item.url;
      bodyDiv.appendChild(urlDiv);
    }
    if (item.summary) {
      const summDiv = document.createElement("div");
      summDiv.className = "proj-item-summary";
      summDiv.textContent = item.summary.slice(0, 200);
      bodyDiv.appendChild(summDiv);
    }
    if (item.notes) {
      const notesDiv = document.createElement("div");
      notesDiv.className = "proj-item-notes";
      notesDiv.textContent = item.notes;
      bodyDiv.appendChild(notesDiv);
    }
    const metaDiv = document.createElement("div");
    metaDiv.className = "proj-item-meta";
    const typeBadge = document.createElement("span");
    typeBadge.className = "proj-type-badge " + item.type;
    typeBadge.textContent = item.type;
    metaDiv.appendChild(typeBadge);
    if (item.analysisPreset) {
      const analyzedSpan = document.createElement("span");
      analyzedSpan.className = "proj-type-badge analysis";
      analyzedSpan.title = "Analyzed with " + item.analysisPreset;
      analyzedSpan.textContent = "analyzed";
      metaDiv.appendChild(analyzedSpan);
    }
    const dateSpan = document.createElement("span");
    dateSpan.textContent = new Date(item.addedAt).toLocaleDateString();
    metaDiv.appendChild(dateSpan);
    bodyDiv.appendChild(metaDiv);
    card.appendChild(bodyDiv);
    const actionsDiv2 = document.createElement("div");
    actionsDiv2.className = "proj-item-actions";
    if (item.analysisContent) {
      const viewBtn2 = document.createElement("button");
      viewBtn2.className = "proj-item-view-btn";
      viewBtn2.title = "View analysis";
      viewBtn2.textContent = "View";
      actionsDiv2.appendChild(viewBtn2);
    }
    const noteBtn = document.createElement("button");
    noteBtn.className = "proj-item-note-btn";
    noteBtn.title = "Edit notes";
    noteBtn.textContent = "Notes";
    const removeBtn = document.createElement("button");
    removeBtn.className = "proj-item-remove-btn";
    removeBtn.title = "Remove from project";
    removeBtn.textContent = "Remove";
    actionsDiv2.appendChild(noteBtn);
    actionsDiv2.appendChild(removeBtn);
    card.appendChild(actionsDiv2);

    const viewBtn = card.querySelector(".proj-item-view-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", () => {
        // Open analysis in a results-like view
        const resultId = `proj-view-${Date.now()}`;
        browser.storage.local.set({
          [resultId]: {
            status: "done",
            content: item.analysisContent,
            pageTitle: item.title || item.url,
            pageUrl: item.url,
            presetLabel: item.analysisPreset || "Analysis"
          }
        });
        browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`) });
      });
    }

    card.querySelector(".proj-item-note-btn").addEventListener("click", () => {
      projState.editingItemId = item.id;
      projEl.itemNotes.value = item.notes || "";
      projEl.itemModal.classList.remove("hidden");
      projEl.itemNotes.focus();
    });

    card.querySelector(".proj-item-remove-btn").addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "removeProjectItem", projectId: proj.id, itemId: item.id });
      await projLoadProjects();
      projSelectProject(proj.id);
    });

    projEl.itemsList.appendChild(card);
  }
}

function projOpenModal(existing) {
  projState.editingProjectId = existing ? existing.id : null;
  projEl.modalTitle.textContent = existing ? "Edit Project" : "New Project";
  projEl.modalName.value = existing ? existing.name : "";
  projEl.modalDesc.value = existing ? (existing.description || "") : "";
  projEl.modalColor.value = existing ? (existing.color || "#e94560") : "#e94560";
  projEl.modal.classList.remove("hidden");
  projEl.modalName.focus();
}

async function projSaveModal() {
  const name = projEl.modalName.value.trim();
  if (!name) return;

  if (projState.editingProjectId) {
    await browser.runtime.sendMessage({
      action: "updateProject",
      projectId: projState.editingProjectId,
      name,
      description: projEl.modalDesc.value.trim(),
      color: projEl.modalColor.value
    });
  } else {
    const resp = await browser.runtime.sendMessage({
      action: "createProject",
      name,
      description: projEl.modalDesc.value.trim(),
      color: projEl.modalColor.value
    });
    if (resp && resp.success) {
      projState.activeProjectId = resp.project.id;
    }
  }

  projEl.modal.classList.add("hidden");
  await projLoadProjects();
  if (projState.activeProjectId) projSelectProject(projState.activeProjectId);
}

async function projSaveItemNotes() {
  if (!projState.activeProjectId || !projState.editingItemId) return;
  await browser.runtime.sendMessage({
    action: "updateProjectItem",
    projectId: projState.activeProjectId,
    itemId: projState.editingItemId,
    notes: projEl.itemNotes.value
  });
  projEl.itemModal.classList.add("hidden");
  await projLoadProjects();
  projSelectProject(projState.activeProjectId);
}

async function projToggleStar(id) {
  const proj = projState.projects.find(p => p.id === id);
  if (!proj) return;
  await browser.runtime.sendMessage({ action: "updateProject", projectId: id, starred: !proj.starred });
  await projLoadProjects();
  if (projState.activeProjectId) projSelectProject(projState.activeProjectId);
}

async function projDelete(id) {
  if (!confirm("Delete this project and all its items?")) return;
  await browser.runtime.sendMessage({ action: "deleteProject", projectId: id });
  projState.activeProjectId = null;
  await projLoadProjects();
  projShowEmpty();
}

async function projAddItem(type) {
  if (!projState.activeProjectId) return;
  const title = type === "note" ? "New Note" : "";
  const item = { type, title, notes: "", url: "" };

  if (type === "url") {
    let url = (prompt("Enter a URL:") || "").trim();
    if (!url) return;
    // Auto-prepend https:// if no protocol
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    item.url = url;
    item.title = url;
  }

  await browser.runtime.sendMessage({
    action: "addProjectItem",
    projectId: projState.activeProjectId,
    item
  });
  await projLoadProjects();
  projSelectProject(projState.activeProjectId);

  // Auto-open notes editor for new notes
  if (type === "note") {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    if (proj && proj.items.length > 0) {
      const newItem = proj.items[0];
      projState.editingItemId = newItem.id;
      projEl.itemNotes.value = "";
      projEl.itemModal.classList.remove("hidden");
      projEl.itemNotes.focus();
    }
  }
}

function downloadBundle(bundle, filename) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function projExportOne(id) {
  const resp = await browser.runtime.sendMessage({ action: "exportProject", projectId: id });
  if (!resp || !resp.success) return;
  const name = (resp.bundle.projects[0].name || "project").replace(/[^a-z0-9]/gi, "_");
  downloadBundle(resp.bundle, `${name}.argusproj`);
}

async function projExportAll() {
  const resp = await browser.runtime.sendMessage({ action: "exportAllProjects" });
  if (!resp || !resp.success) return;
  downloadBundle(resp.bundle, "argus-projects.argusproj");
}

function projImport() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".argusproj,.json";
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let bundle = JSON.parse(text);

      // Support importing old-format single project JSON
      if (!bundle.manifest && bundle.id && bundle.items) {
        bundle = {
          manifest: { format: "argusproj", version: 1, exportedAt: new Date().toISOString(), projectCount: 1, historyCount: 0 },
          projects: [bundle],
          history: [],
        };
      }
      // Support importing old-format array of projects
      if (Array.isArray(bundle)) {
        bundle = {
          manifest: { format: "argusproj", version: 1, exportedAt: new Date().toISOString(), projectCount: bundle.length, historyCount: 0 },
          projects: bundle,
          history: [],
        };
      }

      const resp = await browser.runtime.sendMessage({ action: "importProject", bundle });
      if (resp && resp.success) {
        alert(`Imported ${resp.projectsImported} project(s) and ${resp.historyImported} history item(s).`);
        projLoadList();
      } else {
        alert("Import failed: " + (resp ? resp.error : "Unknown error"));
      }
    } catch (e) {
      alert("Failed to read file: " + e.message);
    }
  });
  input.click();
}

let batchPollTimer = null;

async function projBatchAnalyze() {
  const presetKey = document.getElementById("proj-batch-preset").value;
  if (!presetKey || !projState.activeProjectId) return;

  const proj = projState.projects.find(p => p.id === projState.activeProjectId);
  if (!proj) return;

  const statusEl = document.getElementById("proj-batch-status");
  const runBtn = document.getElementById("proj-batch-run");

  // Check if unsummarized items exist; if not, offer re-analyze
  const unsummarized = proj.items.filter(i => i.url && !i.summary);
  const allWithUrl = proj.items.filter(i => i.url);
  let reanalyze = false;

  if (unsummarized.length === 0) {
    if (allWithUrl.length === 0) {
      statusEl.textContent = "No items with URLs to analyze.";
      return;
    }
    if (!confirm(`All ${allWithUrl.length} items already have summaries. Re-analyze them all?`)) return;
    reanalyze = true;
  }

  // Kick off in background
  const resp = await browser.runtime.sendMessage({
    action: "batchAnalyzeProject",
    projectId: proj.id,
    presetKey,
    reanalyze
  });

  if (!resp.success) {
    statusEl.textContent = resp.error;
    return;
  }

  runBtn.disabled = true;
  runBtn.textContent = "Cancel";
  runBtn.disabled = false;
  runBtn.onclick = projCancelBatch;

  // Poll for progress
  batchPollTimer = setInterval(() => pollBatchStatus(), 1500);
  statusEl.textContent = `Starting batch analysis (${resp.total} items)...`;
}

async function pollBatchStatus() {
  const statusEl = document.getElementById("proj-batch-status");
  const runBtn = document.getElementById("proj-batch-run");

  try {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (!s.success) return;

    if (s.running) {
      statusEl.textContent = `Analyzing ${s.done + 1} of ${s.total}: ${s.current}...`;
    } else {
      // Finished
      clearInterval(batchPollTimer);
      batchPollTimer = null;

      const errCount = s.errors.length;
      if (s.cancelled) {
        statusEl.textContent = `Cancelled after ${s.done} of ${s.total} items.`;
      } else if (errCount > 0) {
        statusEl.textContent = `Done - analyzed ${s.done} item(s), ${errCount} error(s).`;
      } else {
        statusEl.textContent = `Done - analyzed ${s.done} item(s).`;
      }

      runBtn.textContent = "Run Batch";
      runBtn.onclick = projBatchAnalyze;

      // Refresh project display
      await projLoadProjects();
      projSelectProject(projState.activeProjectId);
      setTimeout(() => { statusEl.textContent = ""; }, 5000);
    }
  } catch { /* ignore */ }
}

async function projCancelBatch() {
  await browser.runtime.sendMessage({ action: "cancelBatch" });
  document.getElementById("proj-batch-status").textContent = "Cancelling...";
}

// ──────────────────────────────────────────────
// OSINT Project Tools
// ──────────────────────────────────────────────
async function projRunEntityExtraction() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Running entity extraction on all project items...";

  // Use batch analyze with entities preset
  const resp = await browser.runtime.sendMessage({
    action: "batchAnalyzeProject",
    projectId: projState.activeProjectId,
    presetKey: "entities",
    reanalyze: true
  });

  if (!resp.success) {
    statusEl.textContent = resp.error;
    return;
  }

  // Poll for completion
  const pollId = setInterval(async () => {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (s.running) {
      statusEl.textContent = `Extracting entities: ${s.done}/${s.total} - ${s.current}...`;
    } else {
      clearInterval(pollId);
      statusEl.textContent = `Entity extraction complete (${s.done} items).`;
      await projLoadProjects();
      projSelectProject(projState.activeProjectId);
      setTimeout(() => { statusEl.textContent = ""; }, 5000);
    }
  }, 1500);
}

async function projOpenConnectionGraph() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Building connection graph...";

  const resp = await browser.runtime.sendMessage({
    action: "buildConnectionGraph",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    const storeKey = `graph-${Date.now()}`;
    await browser.storage.local.set({ [storeKey]: { projectName: proj?.name || "Project", nodes: resp.nodes, edges: resp.edges } });
    browser.tabs.create({ url: browser.runtime.getURL(`osint/graph.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "No entity data found. Run entity extraction first.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

async function projOpenTimeline() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Building timeline...";

  const resp = await browser.runtime.sendMessage({
    action: "buildTimeline",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    const storeKey = `timeline-${Date.now()}`;
    await browser.storage.local.set({ [storeKey]: { projectName: proj?.name || "Project", events: resp.events } });
    browser.tabs.create({ url: browser.runtime.getURL(`osint/timeline.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "No date data found. Run entity extraction first.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

function projOpenHeatmap() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/heatmap.html?project=${encodeURIComponent(projState.activeProjectId)}`) });
}

function projOpenGeomap() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/geomap.html?project=${encodeURIComponent(projState.activeProjectId)}`) });
}

function projOpenDashboard() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/dashboard.html?projectId=${encodeURIComponent(projState.activeProjectId)}`) });
}

async function projGenerateReport() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Generating investigation report (this may take a minute)...";

  const resp = await browser.runtime.sendMessage({
    action: "generateReport",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    // Open in results page
    const storeKey = `report-${Date.now()}`;
    await browser.storage.local.set({
      [storeKey]: {
        status: "done",
        content: resp.content,
        pageTitle: resp.title || "Investigation Report",
        pageUrl: "",
        presetLabel: "Investigation Report",
        provider: resp.provider,
        model: resp.model
      }
    });
    browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "Failed to generate report.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

async function projAnomalyScan() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Running anomaly scan (this may take a minute)...";

  const resp = await browser.runtime.sendMessage({
    action: "anomalyScan",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const storeKey = `anomaly-${Date.now()}`;
    await browser.storage.local.set({
      [storeKey]: {
        status: "done",
        content: resp.content,
        pageTitle: "Anomaly Scan",
        pageUrl: "",
        presetLabel: "Anomaly Scan",
        provider: resp.provider,
        model: resp.model
      }
    });
    browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "Failed to run anomaly scan.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

// ──────────────────────────────────────────────
// Keyword Watchlist
// ──────────────────────────────────────────────
async function initWatchlist() {
  document.getElementById("add-watchword").addEventListener("click", addWatchword);
  await loadWatchlist();
  await loadWatchlistMatches();
}

async function loadWatchlist() {
  const resp = await browser.runtime.sendMessage({ action: "getWatchlist" });
  const list = document.getElementById("watchlist-items");
  list.innerHTML = "";
  if (!resp || !resp.success || !resp.watchlist.length) {
    const noKw = document.createElement("p");
    noKw.className = "info-text";
    noKw.style.cssText = "padding:8px 0;";
    noKw.textContent = "No keywords tracked yet.";
    list.appendChild(noKw);
    return;
  }
  for (const w of resp.watchlist) {
    const div = document.createElement("div");
    div.className = "rule-item";
    const ruleInfo = document.createElement("div");
    ruleInfo.className = "rule-info";
    const ruleLabel = document.createElement("span");
    ruleLabel.className = "rule-label";
    ruleLabel.textContent = w.term;
    const ruleMeta = document.createElement("span");
    ruleMeta.className = "rule-meta";
    ruleMeta.textContent = (w.caseSensitive ? "Case sensitive" : "Case insensitive") + (w.regex ? " | Regex" : "") + " | " + (w.matchCount || 0) + " matches";
    ruleInfo.appendChild(ruleLabel);
    ruleInfo.appendChild(ruleMeta);
    const ruleActions = document.createElement("div");
    ruleActions.className = "rule-actions";
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle-label";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    if (w.enabled) toggleInput.checked = true;
    toggleInput.dataset.id = w.id;
    toggleInput.className = "watchword-toggle";
    const activeSpan = document.createElement("span");
    activeSpan.textContent = "Active";
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(activeSpan);
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-secondary btn-sm watchword-delete";
    delBtn.dataset.id = w.id;
    delBtn.textContent = "Delete";
    ruleActions.appendChild(toggleLabel);
    ruleActions.appendChild(delBtn);
    div.appendChild(ruleInfo);
    div.appendChild(ruleActions);
    list.appendChild(div);
  }

  list.querySelectorAll(".watchword-toggle").forEach(cb => {
    cb.addEventListener("change", async () => {
      await browser.runtime.sendMessage({ action: "updateWatchword", id: cb.dataset.id, enabled: cb.checked });
    });
  });

  list.querySelectorAll(".watchword-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "deleteWatchword", id: btn.dataset.id });
      await loadWatchlist();
    });
  });
}

async function addWatchword() {
  const termInput = document.getElementById("watchword-term");
  const term = termInput.value.trim();
  if (!term) return;
  const caseSensitive = document.getElementById("watchword-case").checked;
  const regex = document.getElementById("watchword-regex").checked;

  // Validate regex if enabled
  if (regex) {
    try { new RegExp(term); } catch (e) {
      document.getElementById("watchlist-status").textContent = "Invalid regex: " + e.message;
      return;
    }
  }

  await browser.runtime.sendMessage({ action: "addWatchword", term, caseSensitive, regex });
  termInput.value = "";
  document.getElementById("watchword-case").checked = false;
  document.getElementById("watchword-regex").checked = false;
  await loadWatchlist();
}

async function loadWatchlistMatches() {
  const { watchlistMatches } = await browser.storage.local.get({ watchlistMatches: [] });
  const container = document.getElementById("watchlist-matches");
  if (!watchlistMatches.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = "";
  const matchesH4 = document.createElement("h4");
  matchesH4.setAttribute("style", "font-size:13px;color:var(--text-secondary);margin-bottom:8px;");
  matchesH4.textContent = "Recent Matches";
  container.appendChild(matchesH4);
  const recent = watchlistMatches.slice(-20).reverse();
  for (const m of recent) {
    const div = document.createElement("div");
    div.className = "rule-item";
    const matchInfo = document.createElement("div");
    matchInfo.className = "rule-info";
    const matchLabel = document.createElement("span");
    matchLabel.className = "rule-label";
    matchLabel.textContent = '"' + m.term + '" found in ' + m.sourceType;
    const matchMeta = document.createElement("span");
    matchMeta.className = "rule-meta";
    matchMeta.textContent = (m.sourceTitle || m.sourceUrl) + " - " + new Date(m.matchedAt).toLocaleString();
    matchInfo.appendChild(matchLabel);
    matchInfo.appendChild(matchMeta);
    div.appendChild(matchInfo);
    container.appendChild(div);
  }
}

// ──────────────────────────────────────────────
// Storage Management
// ──────────────────────────────────────────────
function initStorageManagement() {
  updateStorageUsage();

  document.getElementById("purge-history-btn").addEventListener("click", purgeOldHistory);
  document.getElementById("purge-snapshots-btn").addEventListener("click", purgeMonitorSnapshots);
  document.getElementById("purge-cached-btn").addEventListener("click", purgeAllCachedData);

  // Knowledge Graph
  document.getElementById("kg-open-graph").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("osint/graph.html?mode=global") });
  });
  document.getElementById("kg-run-inference").addEventListener("click", async () => {
    const resp = await browser.runtime.sendMessage({ action: "runKGInference" });
    showKGStatus(resp && resp.inferred ? `Inferred ${resp.inferred} new relationships` : "No new inferences");
  });
  document.getElementById("kg-clear").addEventListener("click", async () => {
    if (!confirm("Clear the entire knowledge graph? This cannot be undone.")) return;
    await browser.runtime.sendMessage({ action: "clearKG" });
    showKGStatus("Knowledge graph cleared");
    updateKGStats();
  });
  updateKGStats();
  loadPendingMerges();

  // OSINT Quick Tools (on OSINT tab)
  const osintLaunch = (tool) => async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) {
      alert("Open a web page first, then use this tool.");
      return;
    }
    browser.runtime.sendMessage({ action: tool, tabId: tab.id });
  };
  const osintMetaBtn = document.getElementById("osint-launch-metadata");
  const osintLinksBtn = document.getElementById("osint-launch-links");
  const osintWhoisBtn = document.getElementById("osint-launch-whois");
  const osintTechBtn = document.getElementById("osint-launch-techstack");
  if (osintMetaBtn) osintMetaBtn.addEventListener("click", osintLaunch("extractMetadata"));
  if (osintLinksBtn) osintLinksBtn.addEventListener("click", osintLaunch("mapLinks"));
  if (osintWhoisBtn) osintWhoisBtn.addEventListener("click", osintLaunch("whoisLookup"));
  if (osintTechBtn) osintTechBtn.addEventListener("click", osintLaunch("detectTechStack"));
}

async function updateStorageUsage() {
  const display = document.getElementById("storage-usage-display");
  try {
    // Combine browser.storage.local (settings/ephemeral) + IndexedDB (heavy data)
    const all = await browser.storage.local.get(null);
    const localBytes = new Blob([JSON.stringify(all)]).size;
    const idbSizes = await ArgusDB.estimateSize();
    const totalBytes = localBytes + (idbSizes._total || 0);
    if (totalBytes < 1024) display.textContent = totalBytes + " B";
    else if (totalBytes < 1048576) display.textContent = (totalBytes / 1024).toFixed(1) + " KB";
    else display.textContent = (totalBytes / 1048576).toFixed(1) + " MB";
  } catch {
    display.textContent = "Unable to calculate";
  }
}

function showPurgeStatus(msg) {
  const status = document.getElementById("storage-purge-status");
  status.textContent = msg;
  status.classList.remove("hidden");
  setTimeout(() => status.classList.add("hidden"), 3000);
}

async function purgeOldHistory() {
  const days = parseInt(document.getElementById("purge-history-age").value, 10);
  const count = await ArgusDB.History.purgeOlderThan(days);
  showPurgeStatus(`Purged ${count} history entries`);
  updateStorageUsage();
}

async function purgeMonitorSnapshots() {
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
  // Ephemeral result keys stay in browser.storage.local
  const all = await browser.storage.local.get(null);
  const prefixes = ["tl-result-", "techstack-", "metadata-", "linkmap-", "whois-", "result-"];
  const keysToRemove = Object.keys(all).filter(k => prefixes.some(p => k.startsWith(p)));
  if (keysToRemove.length) await browser.storage.local.remove(keysToRemove);
  showPurgeStatus(`Removed ${keysToRemove.length} cached entries`);
  updateStorageUsage();
}

// ──────────────────────────────────────────────
// Knowledge Graph management
// ──────────────────────────────────────────────

function showKGStatus(msg) {
  const status = document.getElementById("kg-status");
  status.textContent = msg;
  status.classList.remove("hidden");
  setTimeout(() => status.classList.add("hidden"), 3000);
}

async function updateKGStats() {
  const display = document.getElementById("kg-stats-display");
  try {
    const stats = await browser.runtime.sendMessage({ action: "getKGStats" });
    if (stats && typeof stats.nodeCount === "number") {
      const parts = [`${stats.nodeCount} entities`, `${stats.edgeCount} connections`];
      if (stats.typeCounts) {
        const types = Object.entries(stats.typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([t, c]) => `${c} ${t}s`);
        if (types.length) parts.push(types.join(", "));
      }
      display.textContent = parts.join(" | ");
    } else {
      display.textContent = "No data yet";
    }
  } catch {
    display.textContent = "Unable to load";
  }
}

async function loadPendingMerges() {
  try {
    const merges = await browser.runtime.sendMessage({ action: "getKGPendingMerges" });
    const container = document.getElementById("kg-pending-merges");
    const list = document.getElementById("kg-merge-list");
    if (!merges || !merges.length) {
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    list.replaceChildren();

    for (const merge of merges) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;";

      const text = document.createElement("span");
      text.style.flex = "1";
      text.textContent = `"${merge.newName}" \u2192 "${merge.existingName}"? (${Math.round(merge.confidence * 100)}%)`;
      row.appendChild(text);

      const acceptBtn = document.createElement("button");
      acceptBtn.className = "btn btn-secondary";
      acceptBtn.style.cssText = "padding:2px 8px;font-size:11px;color:var(--success);";
      acceptBtn.textContent = "Merge";
      acceptBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resolveKGMerge", mergeId: merge.id, accept: true });
        row.remove();
        updateKGStats();
        if (!list.children.length) container.classList.add("hidden");
      });
      row.appendChild(acceptBtn);

      const dismissBtn = document.createElement("button");
      dismissBtn.className = "btn btn-secondary";
      dismissBtn.style.cssText = "padding:2px 8px;font-size:11px;";
      dismissBtn.textContent = "Dismiss";
      dismissBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resolveKGMerge", mergeId: merge.id, accept: false });
        row.remove();
        if (!list.children.length) container.classList.add("hidden");
      });
      row.appendChild(dismissBtn);

      list.appendChild(row);
    }
  } catch { /* non-critical */ }
}
