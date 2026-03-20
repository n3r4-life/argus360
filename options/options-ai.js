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
// Default preset dropdown
// ──────────────────────────────────────────────
function populateDefaultPresetDropdown() {
  el.defaultPreset.replaceChildren();
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    el.defaultPreset.appendChild(opt);
  }
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = (preset.label || key) + " *";
      el.defaultPreset.appendChild(opt);
    }
  }
}

// ──────────────────────────────────────────────
// Prompt tabs (default + custom presets)
// ──────────────────────────────────────────────
function buildPromptTabs() {
  el.tabList.replaceChildren();

  // Keep default-preset dropdown in sync
  const curDefault = el.defaultPreset.value;
  populateDefaultPresetDropdown();
  el.defaultPreset.value = curDefault || "summary";

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
// Advanced Prompts Editor
// ──────────────────────────────────────────────

function initAdvancedPrompts() {
  el.advPromptSelect.replaceChildren();
  let lastGroup = "";
  for (const [key, def] of Object.entries(ADVANCED_PROMPT_DEFS)) {
    if (def.group !== lastGroup) {
      const optGroup = document.createElement("optgroup");
      optGroup.label = def.group;
      // Add all items in this group
      for (const [k2, d2] of Object.entries(ADVANCED_PROMPT_DEFS)) {
        if (d2.group !== def.group) continue;
        if (document.querySelector(`#adv-prompt-select option[value="${k2}"]`)) continue;
        const opt = document.createElement("option");
        opt.value = k2;
        opt.textContent = d2.label;
        if (advancedPrompts[k2]) opt.textContent += " *";
        optGroup.appendChild(opt);
      }
      el.advPromptSelect.appendChild(optGroup);
      lastGroup = def.group;
    }
  }
  loadAdvancedPrompt();
}

function loadAdvancedPrompt() {
  const key = el.advPromptSelect.value;
  const def = ADVANCED_PROMPT_DEFS[key];
  if (!def) return;
  const custom = advancedPrompts[key];
  el.advPromptSystem.value = custom?.system ?? def.system;
  el.advPromptUser.value = custom?.prompt ?? def.prompt;
  // Disable user prompt for auto-generated prompts
  const isAutoGen = def.prompt.startsWith("(Auto-generated");
  el.advPromptUser.disabled = isAutoGen;
  el.advPromptUser.style.opacity = isAutoGen ? "0.5" : "1";
}

function saveAdvancedPrompt() {
  const key = el.advPromptSelect.value;
  const def = ADVANCED_PROMPT_DEFS[key];
  if (!def) return;
  const systemVal = el.advPromptSystem.value;
  const promptVal = el.advPromptUser.value;
  // Only store if different from default
  if (systemVal === def.system && promptVal === def.prompt) {
    delete advancedPrompts[key];
  } else {
    advancedPrompts[key] = { system: systemVal, prompt: promptVal };
  }
  // Update the option label to show * for modified
  const opt = el.advPromptSelect.querySelector(`option[value="${key}"]`);
  if (opt) {
    opt.textContent = advancedPrompts[key] ? def.label + " *" : def.label;
  }
  scheduleSave();
}

function resetAdvancedPrompt() {
  const key = el.advPromptSelect.value;
  const def = ADVANCED_PROMPT_DEFS[key];
  if (!def) return;
  delete advancedPrompts[key];
  el.advPromptSystem.value = def.system;
  el.advPromptUser.value = def.prompt;
  const opt = el.advPromptSelect.querySelector(`option[value="${key}"]`);
  if (opt) opt.textContent = def.label;
  el.advPromptStatus.textContent = "Reset to default";
  setTimeout(() => { el.advPromptStatus.textContent = ""; }, 2000);
  scheduleSave();
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

