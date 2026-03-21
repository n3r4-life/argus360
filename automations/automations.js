// ──────────────────────────────────────────────
// Argus — Automations Page
// Graduated from options console (Round 2)
// ──────────────────────────────────────────────

// Preset labels for auto-analyze rule dropdown (mirrors DEFAULT_PRESETS from options-core.js)
const DEFAULT_PRESETS = {
  summary: { label: "Summary" },
  sentiment: { label: "Sentiment Analysis" },
  factcheck: { label: "Fact-Check" },
  keypoints: { label: "Key Points" },
  eli5: { label: "ELI5" },
  critique: { label: "Critical Analysis" },
  actionitems: { label: "Action Items" },
  research: { label: "Research Report" },
  latenight: { label: "Late Night Recap" },
  entities: { label: "Entity Extraction (OSINT)" },
  credibility: { label: "Source Credibility" },
  profile: { label: "Person/Org Profile" },
  mediabias: { label: "Media Bias Breakdown" },
  competitorintel: { label: "Competitor Intel" },
  financialanalysis: { label: "Financial Analysis" },
  supplychainrisk: { label: "Supply Chain Risk" },
  threatassessment: { label: "Threat Assessment" },
  crisismonitor: { label: "Crisis Monitor" },
  deepfakeflags: { label: "Deepfake / Manipulation Flags" },
  propaganda: { label: "Propaganda Detection" },
  influencermap: { label: "Influencer / Network Map" },
  technicalbreakdown: { label: "Technical Breakdown" },
  timeline: { label: "Timeline Reconstruction" },
  dataextraction: { label: "Data Extraction" },
  legalrisk: { label: "Legal / Regulatory Risk" },
  comparecontrast: { label: "Compare & Contrast" },
  narrativeanalysis: { label: "Narrative Analysis" },
  tldr: { label: "TLDR Briefing" }
};

// Local state (loaded from storage, saved independently)
let customPresets = {};
let autoAnalyzeRules = [];
let feedKeywordRoutes = [];

// Local el proxy for code that references el.xxx
const el = {
  autoRulesList: null,
  ruleUrl: null,
  rulePreset: null,
  ruleProvider: null,
  ruleDelay: null,
  addRule: null,
  feedRouteList: null,
  routeKeywords: null,
  routeProject: null,
  routeFeed: null,
  routeNotify: null,
  addFeedRoute: null,
};

function _initElProxy() {
  el.autoRulesList = document.getElementById("auto-rules-list");
  el.ruleUrl = document.getElementById("rule-url");
  el.rulePreset = document.getElementById("rule-preset");
  el.ruleProvider = document.getElementById("rule-provider");
  el.ruleDelay = document.getElementById("rule-delay");
  el.addRule = document.getElementById("add-rule");
  el.feedRouteList = document.getElementById("feed-route-list");
  el.routeKeywords = document.getElementById("route-keywords");
  el.routeProject = document.getElementById("route-project");
  el.routeFeed = document.getElementById("route-feed");
  el.routeNotify = document.getElementById("route-notify");
  el.addFeedRoute = document.getElementById("add-feed-route");
}

// Local save — replaces scheduleSave() for auto-analyze rules + feed routes
let _saveTimeout = null;
function scheduleSave() {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(async () => {
    await browser.storage.local.set({ autoAnalyzeRules, feedKeywordRoutes });
  }, 400);
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

// ──────────────────────────────────────────────
// Named Automations UI
// ──────────────────────────────────────────────
let automations = [];
let editingAutomation = null; // null = new, object = editing existing
let editorSteps = []; // in-flight step list while editing

async function loadAutomations() {
  const resp = await browser.runtime.sendMessage({ action: "getAutomations" });
  automations = (resp && resp.success) ? resp.automations : [];
  renderAutomationList();
  loadAutomationLog();
}

function renderAutomationList() {
  const list = document.getElementById("automations-list");
  list.replaceChildren();

  if (!automations.length) {
    const p = document.createElement("p");
    p.className = "info-text";
    p.style.margin = "0";
    p.textContent = "No automations created yet.";
    list.appendChild(p);
    return;
  }

  automations.forEach(auto => {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = auto.name || "Untitled";
    if (auto.prebuilt) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Pre-built";
      badge.style.cssText = "margin-left:6px;font-size:10px;opacity:0.7;";
      strong.appendChild(badge);
    }
    const span = document.createElement("span");
    const triggers = (auto.triggers?.urlPatterns || []).length;
    const stepTypes = (auto.steps || []).map(s => s.type).join(" → ");
    span.textContent = `${auto.steps?.length || 0} steps: ${stepTypes}${triggers ? ` | ${triggers} URL pattern${triggers > 1 ? "s" : ""}` : ""}`;
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    // Run button
    const runBtn = document.createElement("button");
    runBtn.className = "btn btn-sm btn-accent";
    runBtn.textContent = "Run";
    runBtn.title = "Run on current tab";
    runBtn.addEventListener("click", async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) { alert("No active tab"); return; }
      runBtn.disabled = true;
      runBtn.textContent = "Running...";
      try {
        const resp = await browser.runtime.sendMessage({ action: "runAutomation", automationId: auto.id, tabId: tab.id });
        runBtn.textContent = resp.success ? "Done!" : "Failed";
        loadAutomationLog();
      } catch (e) {
        runBtn.textContent = "Error";
      }
      setTimeout(() => { runBtn.textContent = "Run"; runBtn.disabled = false; }, 2000);
    });

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openAutomationEditor(auto));

    // Toggle
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle-label small";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = auto.enabled;
    cb.addEventListener("change", async () => {
      auto.enabled = cb.checked;
      await browser.runtime.sendMessage({ action: "saveAutomation", automation: auto });
    });
    const toggleText = document.createElement("span");
    toggleText.textContent = auto.enabled ? "On" : "Off";
    cb.addEventListener("change", () => { toggleText.textContent = cb.checked ? "On" : "Off"; });
    toggleLabel.appendChild(cb);
    toggleLabel.appendChild(toggleText);

    actions.appendChild(runBtn);
    actions.appendChild(editBtn);
    actions.appendChild(toggleLabel);
    div.appendChild(info);
    div.appendChild(actions);
    list.appendChild(div);
  });
}

async function openAutomationEditor(auto) {
  editingAutomation = auto || null;
  editorSteps = auto ? JSON.parse(JSON.stringify(auto.steps || [])) : [];

  const card = document.getElementById("automation-editor-card");
  card.classList.remove("hidden");
  document.getElementById("automation-editor-title").textContent = auto ? `Edit: ${auto.name}` : "New Automation";

  document.getElementById("auto-name").value = auto?.name || "";
  document.getElementById("auto-url-patterns").value = (auto?.triggers?.urlPatterns || []).join("\n");
  document.getElementById("auto-manual").checked = auto?.triggers?.manual !== false;
  document.getElementById("auto-cooldown").value = auto?.cooldownMs || 60000;
  document.getElementById("auto-delay").value = auto?.delay || 2000;
  document.getElementById("auto-notify").checked = auto?.notifyOnComplete !== false;
  document.getElementById("auto-continue-error").checked = !!auto?.continueOnError;
  document.getElementById("auto-delete-btn").classList.toggle("hidden", !auto);

  // Populate project dropdown
  const projSelect = document.getElementById("auto-project-trigger");
  projSelect.replaceChildren();
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "None";
  projSelect.appendChild(noneOpt);
  try {
    const resp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (resp?.success) {
      for (const p of resp.projects) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        projSelect.appendChild(opt);
      }
    }
  } catch { /* ok */ }
  projSelect.value = auto?.triggers?.projectId || "";

  // Populate schedule trigger fields
  const sched = auto?.triggers?.schedule;
  const schedCb = document.getElementById("auto-schedule-enabled");
  const schedOpts = document.getElementById("auto-schedule-options");
  schedCb.checked = !!sched;
  schedOpts.classList.toggle("hidden", !sched);
  if (sched) {
    document.getElementById("auto-schedule-type").value = sched.type || "once";
    document.getElementById("auto-schedule-type").dispatchEvent(new Event("change"));
    if (sched.type === "once" && sched.datetime) {
      document.getElementById("auto-schedule-datetime").value = sched.datetime;
    }
    if (sched.type === "interval") {
      document.getElementById("auto-schedule-interval-ms").value = Math.round((sched.intervalMs || 3600000) / 60000);
    }
    if (sched.type === "daily") {
      document.getElementById("auto-schedule-time").value = sched.time || "09:00";
    }
    if (sched.type === "weekly") {
      document.getElementById("auto-schedule-day").value = sched.day || 1;
      document.getElementById("auto-schedule-weekly-time").value = sched.time || "09:00";
    }
    if (sched.type === "cron") {
      document.querySelectorAll(".cron-hour-cb").forEach(cb => {
        cb.checked = (sched.hours || []).includes(Number(cb.value));
      });
      document.querySelectorAll(".cron-day-cb").forEach(cb => {
        cb.checked = (sched.days || []).includes(Number(cb.value));
      });
    }
    document.getElementById("auto-schedule-url").value = sched.url || "";
  }

  renderEditorSteps();
  card.scrollIntoView({ behavior: "smooth" });
}

let expandedStepIndex = -1; // which step is currently expanded (-1 = none)

function renderEditorSteps() {
  const list = document.getElementById("auto-steps-list");
  list.replaceChildren();
  document.getElementById("auto-step-count").textContent = editorSteps.length ? `(${editorSteps.length})` : "";

  const isLogicType = t => ["condition","filter","switch","classify","gate","loop","setVar"].includes(t);

  editorSteps.forEach((step, i) => {
    const div = document.createElement("div");
    div.className = "auto-step-item";
    if (isLogicType(step.type)) div.setAttribute("data-logic", "true");
    if (i === expandedStepIndex) div.classList.add("expanded");

    // ── Header row (always visible) ──
    const header = document.createElement("div");
    header.className = "auto-step-header";

    const chevron = document.createElement("span");
    chevron.className = "auto-step-chevron";
    chevron.textContent = "\u25B6"; // ▶
    header.appendChild(chevron);

    const num = document.createElement("span");
    num.className = "auto-step-number";
    num.textContent = i + 1;
    header.appendChild(num);

    const label = document.createElement("span");
    label.className = "auto-step-label";
    label.textContent = stepTypeLabel(step.type);
    header.appendChild(label);

    // Brief summary of config (shown when collapsed)
    const summary = document.createElement("span");
    summary.className = "auto-step-summary";
    summary.textContent = getStepSummary(step);
    header.appendChild(summary);

    const btns = document.createElement("div");
    btns.className = "auto-step-btns";
    if (i > 0) {
      const upBtn = document.createElement("button");
      upBtn.className = "btn btn-sm btn-secondary";
      upBtn.textContent = "\u2191";
      upBtn.title = "Move up";
      upBtn.addEventListener("click", (e) => { e.stopPropagation(); [editorSteps[i - 1], editorSteps[i]] = [editorSteps[i], editorSteps[i - 1]]; if (expandedStepIndex === i) expandedStepIndex = i - 1; else if (expandedStepIndex === i - 1) expandedStepIndex = i; renderEditorSteps(); });
      btns.appendChild(upBtn);
    }
    if (i < editorSteps.length - 1) {
      const downBtn = document.createElement("button");
      downBtn.className = "btn btn-sm btn-secondary";
      downBtn.textContent = "\u2193";
      downBtn.title = "Move down";
      downBtn.addEventListener("click", (e) => { e.stopPropagation(); [editorSteps[i], editorSteps[i + 1]] = [editorSteps[i + 1], editorSteps[i]]; if (expandedStepIndex === i) expandedStepIndex = i + 1; else if (expandedStepIndex === i + 1) expandedStepIndex = i; renderEditorSteps(); });
      btns.appendChild(downBtn);
    }
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-sm btn-secondary";
    removeBtn.style.color = "var(--error)";
    removeBtn.textContent = "\u2715";
    removeBtn.title = "Remove step";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editorSteps.splice(i, 1);
      if (expandedStepIndex === i) expandedStepIndex = -1;
      else if (expandedStepIndex > i) expandedStepIndex--;
      renderEditorSteps();
    });
    btns.appendChild(removeBtn);
    header.appendChild(btns);

    // Toggle expand/collapse on header click
    header.addEventListener("click", () => {
      expandedStepIndex = (expandedStepIndex === i) ? -1 : i;
      renderEditorSteps();
    });

    div.appendChild(header);

    // ── Config area (only built when expanded) ──
    const config = document.createElement("div");
    config.className = "auto-step-config";
    if (i === expandedStepIndex) {
      buildStepConfig(step, config, i);
    }
    div.appendChild(config);

    list.appendChild(div);
  });
}

// Generate a one-line summary for a collapsed step
function getStepSummary(step) {
  switch (step.type) {
    case "analyze": return step.preset || "summary";
    case "prompt": return (step.prompt || "").slice(0, 50) || "(no prompt)";
    case "extractEntities": return "KG extraction";
    case "runPipeline": return step.pipelineId || "auto-detect";
    case "addToProject": return step.projectId ? "project linked" : "(no project)";
    case "addToMonitors": return `every ${step.intervalMinutes || 60}m`;
    case "paste": return step.provider || "default provider";
    case "saveToCloud": return step.format || "md";
    case "condition": {
      const e = step.expression || {};
      return `${e.left || "?"} ${e.op || "?"} ${e.right || "?"}`;
    }
    case "filter": return `${step.value || "?"} ${step.action || "block"} via list`;
    case "switch": return `on ${step.value || "?"} (${(step.cases || []).length} cases)`;
    case "classify": return `${(step.categories || []).length} categories`;
    case "gate": return `${step.gateType || "confirm"}: ${(step.question || "").slice(0, 40)}`;
    case "loop": return `over ${step.over || "?"}, max ${step.maxIterations || 50}`;
    case "setVar": return `${step.varName || "?"} = ${step.value || "?"}`;
    default: return "";
  }
}

function getValueOptions(idx) {
  const opts = [
    ["page.text",       "Page text"],
    ["page.title",      "Page title"],
    ["page.url",        "Page URL"],
    ["lastOutput",      "Last step output"],
    ["entities.length", "Entity count"],
  ];
  // Scan earlier steps for setVar / classify to surface their variables
  for (let i = 0; i < idx; i++) {
    const s = editorSteps[i];
    if (s.type === "setVar" && s.varName) {
      opts.push([`vars.${s.varName}`, `Variable: ${s.varName}`]);
    }
    if (s.type === "classify") {
      const name = s.varName || "classification";
      opts.push([`vars.${name}`, `Classify result: ${name}`]);
    }
  }
  opts.push(["_custom", "Custom path…"]);
  return opts;
}

function buildStepConfig(step, container, idx) {
  switch (step.type) {
    case "analyze": {
      const sel = document.createElement("select");
      sel.className = "auto-step-select";
      for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = preset.label;
        sel.appendChild(opt);
      }
      sel.value = step.preset || "summary";
      sel.addEventListener("change", () => { step.preset = sel.value; });
      const lbl = document.createElement("label");
      lbl.textContent = "Preset: ";
      lbl.appendChild(sel);
      container.appendChild(lbl);
      break;
    }
    case "prompt": {
      // System prompt
      const sysLabel = document.createElement("label");
      sysLabel.textContent = "System prompt:";
      const sysArea = document.createElement("textarea");
      sysArea.rows = 2;
      sysArea.className = "auto-step-textarea";
      sysArea.value = step.system || "";
      sysArea.placeholder = "You are a helpful analyst.";
      sysArea.addEventListener("input", () => { step.system = sysArea.value; });
      container.appendChild(sysLabel);
      container.appendChild(sysArea);

      // User prompt
      const usrLabel = document.createElement("label");
      usrLabel.textContent = "Prompt:";
      const usrArea = document.createElement("textarea");
      usrArea.rows = 3;
      usrArea.className = "auto-step-textarea";
      usrArea.value = step.prompt || "";
      usrArea.placeholder = "Analyze the following and extract...";
      usrArea.addEventListener("input", () => { step.prompt = usrArea.value; });
      container.appendChild(usrLabel);
      container.appendChild(usrArea);

      // Input mode
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Input: ";
      const modeSel = document.createElement("select");
      modeSel.className = "auto-step-select";
      const opt1 = document.createElement("option");
      opt1.value = "page";
      opt1.textContent = "Original page content";
      const opt2 = document.createElement("option");
      opt2.value = "previous";
      opt2.textContent = "Previous step output";
      modeSel.appendChild(opt1);
      modeSel.appendChild(opt2);
      modeSel.value = step.inputMode || "page";
      modeSel.addEventListener("change", () => { step.inputMode = modeSel.value; });
      modeLabel.appendChild(modeSel);
      container.appendChild(modeLabel);
      break;
    }
    case "extractEntities": {
      const note = document.createElement("span");
      note.className = "hint";
      note.textContent = "Extracts entities from the page and adds them to the Knowledge Graph.";
      container.appendChild(note);
      break;
    }
    case "runPipeline": {
      const sel = document.createElement("select");
      sel.className = "auto-step-select";
      const autoOpt = document.createElement("option");
      autoOpt.value = "";
      autoOpt.textContent = "Auto-detect";
      sel.appendChild(autoOpt);
      for (const pid of ["wikipedia", "classifieds", "news", "research"]) {
        const opt = document.createElement("option");
        opt.value = pid;
        opt.textContent = pid.charAt(0).toUpperCase() + pid.slice(1);
        sel.appendChild(opt);
      }
      sel.value = step.pipelineId || "";
      sel.addEventListener("change", () => { step.pipelineId = sel.value; });
      const lbl = document.createElement("label");
      lbl.textContent = "Pipeline: ";
      lbl.appendChild(sel);
      container.appendChild(lbl);
      break;
    }
    case "addToMonitors": {
      // Interval
      const intLabel = document.createElement("label");
      intLabel.textContent = "Check interval (min): ";
      const intInput = document.createElement("input");
      intInput.type = "number";
      intInput.className = "auto-step-input";
      intInput.min = 5;
      intInput.max = 1440;
      intInput.value = step.intervalMinutes || 60;
      intInput.addEventListener("input", () => { step.intervalMinutes = parseInt(intInput.value) || 60; });
      intLabel.appendChild(intInput);
      container.appendChild(intLabel);

      // AI analysis toggle
      const aiLabel = document.createElement("label");
      aiLabel.className = "auto-step-checkbox-label";
      const aiCb = document.createElement("input");
      aiCb.type = "checkbox";
      aiCb.checked = step.aiAnalysis !== false;
      aiCb.addEventListener("change", () => { step.aiAnalysis = aiCb.checked; });
      aiLabel.appendChild(aiCb);
      aiLabel.appendChild(document.createTextNode(" AI-analyze changes"));
      container.appendChild(aiLabel);

      // Analysis preset (optional)
      const presetLabel = document.createElement("label");
      presetLabel.textContent = "Analysis preset: ";
      const presetSel = document.createElement("select");
      presetSel.className = "auto-step-select";
      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = "Default (Summary)";
      presetSel.appendChild(noneOpt);
      for (const [key, p] of Object.entries(DEFAULT_PRESETS)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = p.label;
        presetSel.appendChild(opt);
      }
      presetSel.value = step.analysisPreset || "";
      presetSel.addEventListener("change", () => { step.analysisPreset = presetSel.value; });
      presetLabel.appendChild(presetSel);
      container.appendChild(presetLabel);

      // Duration (0 = indefinite)
      const durLabel = document.createElement("label");
      durLabel.textContent = "Duration (hours, 0=forever): ";
      const durInput = document.createElement("input");
      durInput.type = "number";
      durInput.className = "auto-step-input";
      durInput.min = 0;
      durInput.value = step.duration || 0;
      durInput.addEventListener("input", () => { step.duration = parseInt(durInput.value) || 0; });
      durLabel.appendChild(durInput);
      container.appendChild(durLabel);

      const hint = document.createElement("div");
      hint.className = "auto-step-hint";
      hint.textContent = "Adds the page to monitors. Skips silently if already monitored.";
      container.appendChild(hint);
      break;
    }
    case "addToProject": {
      const sel = document.createElement("select");
      sel.className = "auto-step-select";
      // Copy options from the project trigger dropdown
      const projTrigger = document.getElementById("auto-project-trigger");
      for (const opt of projTrigger.options) {
        if (!opt.value) continue; // skip "None"
        const newOpt = document.createElement("option");
        newOpt.value = opt.value;
        newOpt.textContent = opt.textContent;
        sel.appendChild(newOpt);
      }
      sel.value = step.projectId || "";
      sel.addEventListener("change", () => { step.projectId = sel.value; });
      const lbl = document.createElement("label");
      lbl.textContent = "Target project: ";
      lbl.appendChild(sel);
      container.appendChild(lbl);

      // Tags
      const tagLabel = document.createElement("label");
      tagLabel.textContent = "Tags (comma-separated): ";
      const tagInput = document.createElement("input");
      tagInput.type = "text";
      tagInput.className = "auto-step-input";
      tagInput.value = (step.tagsWith || []).join(", ");
      tagInput.placeholder = "auto, intel, {automationName}";
      tagInput.addEventListener("input", () => {
        step.tagsWith = tagInput.value.split(",").map(t => t.trim()).filter(Boolean);
      });
      tagLabel.appendChild(tagInput);
      container.appendChild(tagLabel);

      // Summary source
      const sumLabel = document.createElement("label");
      sumLabel.textContent = "Summary from: ";
      const sumSel = document.createElement("select");
      sumSel.className = "auto-step-select";
      const lastOpt = document.createElement("option");
      lastOpt.value = "last";
      lastOpt.textContent = "Last step output";
      sumSel.appendChild(lastOpt);
      editorSteps.forEach((s, si) => {
        if (si >= idx) return;
        const sOpt = document.createElement("option");
        sOpt.value = si;
        sOpt.textContent = `Step ${si + 1} (${stepTypeLabel(s.type)})`;
        sumSel.appendChild(sOpt);
      });
      sumSel.value = step.summaryFrom ?? "last";
      sumSel.addEventListener("change", () => {
        step.summaryFrom = sumSel.value === "last" ? "last" : parseInt(sumSel.value);
      });
      sumLabel.appendChild(sumSel);
      container.appendChild(sumLabel);
      break;
    }
    case "paste": {
      // Provider selector
      const provLabel = document.createElement("label");
      provLabel.textContent = "Paste provider: ";
      const provSel = document.createElement("select");
      provSel.className = "auto-step-select";
      for (const [val, label] of [["", "Use default"], ["gist", "GitHub Gist"], ["pastebin", "Pastebin"], ["privatebin", "PrivateBin"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        provSel.appendChild(opt);
      }
      provSel.value = step.provider || "";
      provSel.addEventListener("change", () => { step.provider = provSel.value; rebuildPasteOptions(); });
      provLabel.appendChild(provSel);
      container.appendChild(provLabel);

      // Input mode
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Content: ";
      const modeSel = document.createElement("select");
      modeSel.className = "auto-step-select";
      for (const [val, label] of [["previous", "Previous step output"], ["page", "Original page text"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        modeSel.appendChild(opt);
      }
      modeSel.value = step.inputMode || "previous";
      modeSel.addEventListener("change", () => { step.inputMode = modeSel.value; });
      modeLabel.appendChild(modeSel);
      container.appendChild(modeLabel);

      // Title template
      const titleLabel = document.createElement("label");
      titleLabel.textContent = "Title template: ";
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "auto-step-input";
      titleInput.value = step.titleTemplate || "";
      titleInput.placeholder = "Argus — {title}";
      titleInput.addEventListener("input", () => { step.titleTemplate = titleInput.value; });
      titleLabel.appendChild(titleInput);
      container.appendChild(titleLabel);

      // Provider-specific options container
      const provOpts = document.createElement("div");
      provOpts.className = "auto-step-provider-opts";
      container.appendChild(provOpts);

      function rebuildPasteOptions() {
        provOpts.innerHTML = "";
        const p = provSel.value;
        if (!p) {
          const hint = document.createElement("div");
          hint.className = "auto-step-hint";
          hint.textContent = "Will use the default paste provider set on the Providers tab.";
          provOpts.appendChild(hint);
          return;
        }
        if (p === "gist") {
          // Filename
          const fnLabel = document.createElement("label");
          fnLabel.textContent = "Filename: ";
          const fnInput = document.createElement("input");
          fnInput.type = "text";
          fnInput.className = "auto-step-input";
          fnInput.value = step.filename || "argus-export.md";
          fnInput.addEventListener("input", () => { step.filename = fnInput.value; });
          fnLabel.appendChild(fnInput);
          provOpts.appendChild(fnLabel);
          // Public toggle
          const pubLabel = document.createElement("label");
          pubLabel.className = "auto-step-checkbox-label";
          const pubCb = document.createElement("input");
          pubCb.type = "checkbox";
          pubCb.checked = step.isPublic || false;
          pubCb.addEventListener("change", () => { step.isPublic = pubCb.checked; });
          pubLabel.appendChild(pubCb);
          pubLabel.appendChild(document.createTextNode(" Public gist"));
          provOpts.appendChild(pubLabel);
          // Include entities
          const entLabel = document.createElement("label");
          entLabel.className = "auto-step-checkbox-label";
          const entCb = document.createElement("input");
          entCb.type = "checkbox";
          entCb.checked = step.includeEntities || false;
          entCb.addEventListener("change", () => { step.includeEntities = entCb.checked; });
          entLabel.appendChild(entCb);
          entLabel.appendChild(document.createTextNode(" Include entities as separate file"));
          provOpts.appendChild(entLabel);
        } else if (p === "pastebin") {
          // Visibility
          const visLabel = document.createElement("label");
          visLabel.textContent = "Visibility: ";
          const visSel = document.createElement("select");
          visSel.className = "auto-step-select";
          for (const [val, label] of [["1", "Unlisted"], ["0", "Public"], ["2", "Private"]]) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = label;
            visSel.appendChild(opt);
          }
          visSel.value = String(step.visibility ?? 1);
          visSel.addEventListener("change", () => { step.visibility = parseInt(visSel.value); });
          visLabel.appendChild(visSel);
          provOpts.appendChild(visLabel);
          // Format
          const fmtLabel = document.createElement("label");
          fmtLabel.textContent = "Syntax: ";
          const fmtInput = document.createElement("input");
          fmtInput.type = "text";
          fmtInput.className = "auto-step-input";
          fmtInput.value = step.format || "text";
          fmtInput.placeholder = "text, json, markdown, python...";
          fmtInput.addEventListener("input", () => { step.format = fmtInput.value; });
          fmtLabel.appendChild(fmtInput);
          provOpts.appendChild(fmtLabel);
          // Expiry
          const expLabel = document.createElement("label");
          expLabel.textContent = "Expiry: ";
          const expSel = document.createElement("select");
          expSel.className = "auto-step-select";
          for (const [val, label] of [["N", "Never"], ["10M", "10 Minutes"], ["1H", "1 Hour"], ["1D", "1 Day"], ["1W", "1 Week"], ["1M", "1 Month"]]) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = label;
            expSel.appendChild(opt);
          }
          expSel.value = step.expiry || "N";
          expSel.addEventListener("change", () => { step.expiry = expSel.value; });
          expLabel.appendChild(expSel);
          provOpts.appendChild(expLabel);
        } else if (p === "privatebin") {
          // Expiry
          const expLabel = document.createElement("label");
          expLabel.textContent = "Expiry: ";
          const expSel = document.createElement("select");
          expSel.className = "auto-step-select";
          for (const [val, label] of [["5min", "5 Minutes"], ["10min", "10 Minutes"], ["1hour", "1 Hour"], ["1day", "1 Day"], ["1week", "1 Week"], ["1month", "1 Month"], ["never", "Never"]]) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = label;
            expSel.appendChild(opt);
          }
          expSel.value = step.expiry || "1week";
          expSel.addEventListener("change", () => { step.expiry = expSel.value; });
          expLabel.appendChild(expSel);
          provOpts.appendChild(expLabel);
          // Burn after reading
          const burnLabel = document.createElement("label");
          burnLabel.className = "auto-step-checkbox-label";
          const burnCb = document.createElement("input");
          burnCb.type = "checkbox";
          burnCb.checked = step.burnAfterReading || false;
          burnCb.addEventListener("change", () => { step.burnAfterReading = burnCb.checked; });
          burnLabel.appendChild(burnCb);
          burnLabel.appendChild(document.createTextNode(" Burn after reading"));
          provOpts.appendChild(burnLabel);
        }
      }
      rebuildPasteOptions();

      const hint = document.createElement("div");
      hint.className = "auto-step-hint";
      hint.textContent = "Pushes step output to a paste service. Provider must be connected in Providers tab. The paste URL is passed as output to subsequent steps.";
      container.appendChild(hint);
      break;
    }
    case "saveToCloud": {
      // Input mode
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Content: ";
      const modeSel = document.createElement("select");
      modeSel.className = "auto-step-select";
      for (const [val, label] of [["previous", "Previous step output"], ["page", "Original page text"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        modeSel.appendChild(opt);
      }
      modeSel.value = step.inputMode || "previous";
      modeSel.addEventListener("change", () => { step.inputMode = modeSel.value; });
      modeLabel.appendChild(modeSel);
      container.appendChild(modeLabel);

      // File format
      const fmtLabel = document.createElement("label");
      fmtLabel.textContent = "Format: ";
      const fmtSel = document.createElement("select");
      fmtSel.className = "auto-step-select";
      for (const [val, label] of [["md", "Markdown (.md)"], ["json", "JSON (.json)"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        fmtSel.appendChild(opt);
      }
      fmtSel.value = step.format || "md";
      fmtSel.addEventListener("change", () => { step.format = fmtSel.value; });
      fmtLabel.appendChild(fmtSel);
      container.appendChild(fmtLabel);

      // Target providers
      const provLabel = document.createElement("label");
      provLabel.textContent = "Upload to: ";
      const provSel = document.createElement("select");
      provSel.className = "auto-step-select";
      for (const [val, label] of [["default", "Use default"], ["all", "All connected providers"], ["google", "Google Drive only"], ["dropbox", "Dropbox only"], ["webdav", "WebDAV only"], ["s3", "S3 only"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        provSel.appendChild(opt);
      }
      provSel.value = (step.providers && step.providers[0]) || "default";
      provSel.addEventListener("change", () => { step.providers = [provSel.value]; });
      provLabel.appendChild(provSel);
      container.appendChild(provLabel);

      const hint = document.createElement("div");
      hint.className = "auto-step-hint";
      hint.textContent = "Uploads step output as a file to connected cloud storage. Files are saved in the argus-automations/ folder.";
      container.appendChild(hint);
      break;
    }
    // ── Logic Step Configs ──
    case "condition": {
      // Expression builder
      const exprWrap = document.createElement("div");
      exprWrap.className = "auto-logic-expr";

      // Left side (what to check)
      const leftLabel = document.createElement("label");
      leftLabel.textContent = "Check: ";
      const leftSel = document.createElement("select");
      leftSel.className = "auto-step-select";

      // Build value options dynamically — include variables from earlier setVar/classify steps
      const valueOptions = getValueOptions(idx);
      const knownValues = valueOptions.map(o => o[0]);

      for (const [val, label] of valueOptions) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        leftSel.appendChild(opt);
      }
      leftSel.value = knownValues.includes(step.expression?.left) ? step.expression?.left : "_custom";
      const leftCustom = document.createElement("input");
      leftCustom.type = "text"; leftCustom.className = "auto-step-input";
      leftCustom.placeholder = "e.g. stepResults[0].content, vars.myVar";
      leftCustom.value = !knownValues.includes(step.expression?.left) && step.expression?.left !== "_custom" ? (step.expression?.left || "") : "";
      leftCustom.style.display = leftSel.value === "_custom" ? "" : "none";
      leftSel.addEventListener("change", () => {
        leftCustom.style.display = leftSel.value === "_custom" ? "" : "none";
        step.expression.left = leftSel.value === "_custom" ? leftCustom.value : leftSel.value;
      });
      leftCustom.addEventListener("input", () => { step.expression.left = leftCustom.value; });
      leftLabel.appendChild(leftSel);
      exprWrap.appendChild(leftLabel);
      exprWrap.appendChild(leftCustom);

      // Operator
      const opLabel = document.createElement("label");
      opLabel.textContent = "Operator: ";
      const opSel = document.createElement("select");
      opSel.className = "auto-step-select";
      for (const [val, label] of [
        ["contains", "contains"], ["not_contains", "does not contain"],
        ["eq", "equals"], ["neq", "not equals"],
        ["gt", ">"], ["gte", ">="], ["lt", "<"], ["lte", "<="],
        ["matches", "matches regex"], ["not_matches", "does not match regex"],
        ["in_list", "is in list"], ["not_in_list", "is not in list"],
        ["exists", "exists (not empty)"], ["empty", "is empty"],
      ]) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        opSel.appendChild(opt);
      }
      opSel.value = step.expression?.op || "contains";
      opSel.addEventListener("change", () => {
        step.expression.op = opSel.value;
        rightInput.style.display = ["exists","empty"].includes(opSel.value) ? "none" : "";
        listSel.style.display = ["in_list","not_in_list"].includes(opSel.value) ? "" : "none";
        rightInput.style.display = ["in_list","not_in_list","exists","empty"].includes(opSel.value) ? "none" : "";
      });
      opLabel.appendChild(opSel);
      exprWrap.appendChild(opLabel);

      // Right side (value to compare against)
      const rightInput = document.createElement("input");
      rightInput.type = "text"; rightInput.className = "auto-step-input";
      rightInput.placeholder = "Value or keyword to check";
      rightInput.value = step.expression?.right || "";
      rightInput.addEventListener("input", () => { step.expression.right = rightInput.value; });
      rightInput.style.display = ["exists","empty","in_list","not_in_list"].includes(opSel.value) ? "none" : "";

      // List selector (for in_list / not_in_list)
      const listSel = document.createElement("select");
      listSel.className = "auto-step-select";
      listSel.style.display = ["in_list","not_in_list"].includes(opSel.value) ? "" : "none";
      const listNone = document.createElement("option");
      listNone.value = ""; listNone.textContent = "Select a list...";
      listSel.appendChild(listNone);
      // Populate lists async
      browser.runtime.sendMessage({ action: "getLists" }).then(resp => {
        if (!resp?.lists) return;
        for (const l of resp.lists) {
          const opt = document.createElement("option");
          opt.value = l.id; opt.textContent = `${l.name} (${l.type})`;
          listSel.appendChild(opt);
        }
        listSel.value = step.expression?.right || "";
      }).catch(() => {});
      listSel.addEventListener("change", () => { step.expression.right = listSel.value; });

      const rightLabel = document.createElement("label");
      rightLabel.textContent = "Value: ";
      rightLabel.appendChild(rightInput);
      rightLabel.appendChild(listSel);
      exprWrap.appendChild(rightLabel);

      container.appendChild(exprWrap);

      // Then/Else branch info
      const branchHint = document.createElement("div");
      branchHint.className = "auto-step-hint";
      branchHint.innerHTML = "THEN and ELSE branches run nested steps. To add sub-steps, save this automation first, then edit the JSON directly via the <em>Export/Import</em> feature, or use the Classify step for AI-powered branching.";
      container.appendChild(branchHint);
      break;
    }
    case "filter": {
      // What value to check — dynamically includes vars from earlier steps
      const valLabel = document.createElement("label");
      valLabel.textContent = "Check value: ";
      const valSel = document.createElement("select");
      valSel.className = "auto-step-select";

      const filterValOpts = getValueOptions(idx);
      const filterKnownVals = filterValOpts.map(o => o[0]);
      for (const [val, label] of filterValOpts) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        valSel.appendChild(opt);
      }
      valSel.value = filterKnownVals.includes(step.value) ? step.value : "_custom";
      const valCustom = document.createElement("input");
      valCustom.type = "text"; valCustom.className = "auto-step-input";
      valCustom.placeholder = "e.g. vars.myField";
      valCustom.value = !filterKnownVals.includes(step.value) && step.value !== "_custom" ? (step.value || "") : "";
      valCustom.style.display = valSel.value === "_custom" ? "" : "none";
      valSel.addEventListener("change", () => {
        valCustom.style.display = valSel.value === "_custom" ? "" : "none";
        step.value = valSel.value === "_custom" ? valCustom.value : valSel.value;
      });
      valCustom.addEventListener("input", () => { step.value = valCustom.value; });
      valLabel.appendChild(valSel);
      container.appendChild(valLabel);
      container.appendChild(valCustom);

      // List to check against
      const listLabel = document.createElement("label");
      listLabel.textContent = "Against list: ";
      const listSel = document.createElement("select");
      listSel.className = "auto-step-select";
      const noneOpt = document.createElement("option");
      noneOpt.value = ""; noneOpt.textContent = "Select a list...";
      listSel.appendChild(noneOpt);
      browser.runtime.sendMessage({ action: "getLists" }).then(resp => {
        if (!resp?.lists) return;
        for (const l of resp.lists) {
          const opt = document.createElement("option");
          opt.value = l.id; opt.textContent = `${l.name} (${l.type})`;
          listSel.appendChild(opt);
        }
        listSel.value = step.list || "";
      }).catch(() => {});
      listSel.addEventListener("change", () => { step.list = listSel.value; });
      listLabel.appendChild(listSel);
      container.appendChild(listLabel);

      // Action: block or allow
      const actLabel = document.createElement("label");
      actLabel.textContent = "Action: ";
      const actSel = document.createElement("select");
      actSel.className = "auto-step-select";
      for (const [val, label] of [
        ["block", "BLOCK if found in list (halt automation)"],
        ["allow", "ALLOW only if found in list (halt if NOT found)"],
      ]) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        actSel.appendChild(opt);
      }
      actSel.value = step.action || "block";
      actSel.addEventListener("change", () => { step.action = actSel.value; });
      actLabel.appendChild(actSel);
      container.appendChild(actLabel);

      const filterHint = document.createElement("div");
      filterHint.className = "auto-step-hint";
      filterHint.textContent = "Checks if a value exists in a Named List. Use for blocklists (flagged reporters, bad sources) or allowlists (approved domains, tracked tickers).";
      container.appendChild(filterHint);
      break;
    }
    case "switch": {
      // Value to switch on
      const valLabel = document.createElement("label");
      valLabel.textContent = "Switch on: ";
      const valInput = document.createElement("input");
      valInput.type = "text"; valInput.className = "auto-step-input";
      valInput.value = step.value || "lastOutput";
      valInput.placeholder = "e.g. vars.classification, lastOutput, page.url";
      valInput.addEventListener("input", () => { step.value = valInput.value; });
      valLabel.appendChild(valInput);
      container.appendChild(valLabel);

      // Cases display
      const casesDiv = document.createElement("div");
      casesDiv.className = "auto-step-cases";
      const casesLabel = document.createElement("label");
      casesLabel.textContent = "Cases (match patterns):";
      casesDiv.appendChild(casesLabel);

      const casesList = document.createElement("div");
      casesList.className = "auto-step-cases-list";

      function renderSwitchCases() {
        casesList.innerHTML = "";
        (step.cases || []).forEach((c, ci) => {
          const row = document.createElement("div");
          row.className = "auto-step-case-row";
          row.style.cssText = "display:flex;gap:6px;align-items:center;margin:3px 0;";
          const matchInput = document.createElement("input");
          matchInput.type = "text"; matchInput.className = "auto-step-input";
          matchInput.value = Array.isArray(c.match) ? c.match.join(", ") : (c.match || "");
          matchInput.placeholder = "Value(s) to match, comma-separated";
          matchInput.style.flex = "1";
          matchInput.addEventListener("input", () => {
            c.match = matchInput.value.split(",").map(s => s.trim()).filter(Boolean);
          });
          row.appendChild(matchInput);
          const rmBtn = document.createElement("button");
          rmBtn.className = "btn btn-danger btn-sm";
          rmBtn.textContent = "×";
          rmBtn.style.padding = "2px 8px";
          rmBtn.addEventListener("click", () => { step.cases.splice(ci, 1); renderSwitchCases(); });
          row.appendChild(rmBtn);
          casesList.appendChild(row);
        });
      }
      renderSwitchCases();
      casesDiv.appendChild(casesList);

      const addCaseBtn = document.createElement("button");
      addCaseBtn.className = "btn btn-secondary btn-sm";
      addCaseBtn.textContent = "+ Add Case";
      addCaseBtn.style.marginTop = "4px";
      addCaseBtn.addEventListener("click", () => {
        step.cases.push({ match: [], steps: [] });
        renderSwitchCases();
      });
      casesDiv.appendChild(addCaseBtn);
      container.appendChild(casesDiv);

      const switchHint = document.createElement("div");
      switchHint.className = "auto-step-hint";
      switchHint.textContent = "Routes to different branches based on a value. Each case can have nested sub-steps. Use * for wildcard matching.";
      container.appendChild(switchHint);
      break;
    }
    case "classify": {
      // Question / prompt
      const qLabel = document.createElement("label");
      qLabel.textContent = "Classification prompt:";
      const qArea = document.createElement("textarea");
      qArea.rows = 2; qArea.className = "auto-step-textarea";
      qArea.value = step.question || "Classify this content:";
      qArea.addEventListener("input", () => { step.question = qArea.value; });
      container.appendChild(qLabel);
      container.appendChild(qArea);

      // Input mode
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Input: ";
      const modeSel = document.createElement("select");
      modeSel.className = "auto-step-select";
      for (const [val, label] of [["page", "Page content"], ["previous", "Previous step output"]]) {
        const opt = document.createElement("option"); opt.value = val; opt.textContent = label;
        modeSel.appendChild(opt);
      }
      modeSel.value = step.inputMode || "page";
      modeSel.addEventListener("change", () => { step.inputMode = modeSel.value; });
      modeLabel.appendChild(modeSel);
      container.appendChild(modeLabel);

      // Categories
      const catLabel = document.createElement("label");
      catLabel.textContent = "Categories (AI will choose one):";
      container.appendChild(catLabel);

      const catList = document.createElement("div");
      catList.className = "auto-step-categories";

      function renderCategories() {
        catList.innerHTML = "";
        (step.categories || []).forEach((cat, ci) => {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;gap:6px;align-items:center;margin:3px 0;";
          const valIn = document.createElement("input");
          valIn.type = "text"; valIn.className = "auto-step-input"; valIn.style.width = "100px";
          valIn.value = cat.value || ""; valIn.placeholder = "value";
          valIn.addEventListener("input", () => { cat.value = valIn.value; });
          row.appendChild(valIn);
          const descIn = document.createElement("input");
          descIn.type = "text"; descIn.className = "auto-step-input"; descIn.style.flex = "1";
          descIn.value = cat.description || cat.label || ""; descIn.placeholder = "Description for AI";
          descIn.addEventListener("input", () => { cat.description = descIn.value; cat.label = descIn.value; });
          row.appendChild(descIn);
          const rmBtn = document.createElement("button");
          rmBtn.className = "btn btn-danger btn-sm"; rmBtn.textContent = "×";
          rmBtn.style.padding = "2px 8px";
          rmBtn.addEventListener("click", () => { step.categories.splice(ci, 1); renderCategories(); });
          row.appendChild(rmBtn);
          catList.appendChild(row);
        });
      }
      renderCategories();
      container.appendChild(catList);

      const addCatBtn = document.createElement("button");
      addCatBtn.className = "btn btn-secondary btn-sm";
      addCatBtn.textContent = "+ Add Category";
      addCatBtn.style.marginTop = "4px";
      addCatBtn.addEventListener("click", () => {
        step.categories.push({ value: "", label: "", description: "", steps: [] });
        renderCategories();
      });
      container.appendChild(addCatBtn);

      const classifyHint = document.createElement("div");
      classifyHint.className = "auto-step-hint";
      classifyHint.textContent = "Uses AI to classify content into one of your categories, then routes to that category's sub-steps. Great for sentiment analysis, topic routing, or content scoring.";
      container.appendChild(classifyHint);
      break;
    }
    case "gate": {
      // Gate type
      const typeLabel = document.createElement("label");
      typeLabel.textContent = "Gate type: ";
      const typeSel = document.createElement("select");
      typeSel.className = "auto-step-select";
      for (const [val, label] of [
        ["confirm", "Yes / No (confirm)"],
        ["choice", "Multiple Choice"],
        ["input", "Free Text Input"],
      ]) {
        const opt = document.createElement("option"); opt.value = val; opt.textContent = label;
        typeSel.appendChild(opt);
      }
      typeSel.value = step.gateType || "confirm";
      typeSel.addEventListener("change", () => {
        step.gateType = typeSel.value;
        choicesDiv.style.display = typeSel.value === "choice" ? "" : "none";
        varDiv.style.display = typeSel.value === "input" ? "" : "none";
      });
      typeLabel.appendChild(typeSel);
      container.appendChild(typeLabel);

      // Question
      const qLabel = document.createElement("label");
      qLabel.textContent = "Question:";
      const qInput = document.createElement("input");
      qInput.type = "text"; qInput.className = "auto-step-input";
      qInput.value = step.question || "Continue?";
      qInput.addEventListener("input", () => { step.question = qInput.value; });
      qLabel.appendChild(qInput);
      container.appendChild(qLabel);

      // Multiple choice options
      const choicesDiv = document.createElement("div");
      choicesDiv.style.display = step.gateType === "choice" ? "" : "none";
      const choicesLabel = document.createElement("label");
      choicesLabel.textContent = "Options:";
      choicesDiv.appendChild(choicesLabel);

      const choicesList = document.createElement("div");
      function renderChoices() {
        choicesList.innerHTML = "";
        (step.options || []).forEach((opt, oi) => {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;gap:6px;align-items:center;margin:3px 0;";
          const labelIn = document.createElement("input");
          labelIn.type = "text"; labelIn.className = "auto-step-input"; labelIn.style.flex = "1";
          labelIn.value = opt.label || ""; labelIn.placeholder = "Display label";
          labelIn.addEventListener("input", () => { opt.label = labelIn.value; });
          row.appendChild(labelIn);
          const valIn = document.createElement("input");
          valIn.type = "text"; valIn.className = "auto-step-input"; valIn.style.width = "80px";
          valIn.value = opt.value || ""; valIn.placeholder = "value";
          valIn.addEventListener("input", () => { opt.value = valIn.value; });
          row.appendChild(valIn);
          const rmBtn = document.createElement("button");
          rmBtn.className = "btn btn-danger btn-sm"; rmBtn.textContent = "×";
          rmBtn.style.padding = "2px 8px";
          rmBtn.addEventListener("click", () => { step.options.splice(oi, 1); renderChoices(); });
          row.appendChild(rmBtn);
          choicesList.appendChild(row);
        });
      }
      renderChoices();
      choicesDiv.appendChild(choicesList);
      const addChoiceBtn = document.createElement("button");
      addChoiceBtn.className = "btn btn-secondary btn-sm";
      addChoiceBtn.textContent = "+ Add Option";
      addChoiceBtn.addEventListener("click", () => {
        step.options.push({ label: "", value: "", steps: [] });
        renderChoices();
      });
      choicesDiv.appendChild(addChoiceBtn);
      container.appendChild(choicesDiv);

      // Variable name for input type
      const varDiv = document.createElement("div");
      varDiv.style.display = step.gateType === "input" ? "" : "none";
      const varLabel = document.createElement("label");
      varLabel.textContent = "Store answer as variable: ";
      const varInput = document.createElement("input");
      varInput.type = "text"; varInput.className = "auto-step-input";
      varInput.value = step.varName || "gateInput";
      varInput.addEventListener("input", () => { step.varName = varInput.value; });
      varLabel.appendChild(varInput);
      varDiv.appendChild(varLabel);
      container.appendChild(varDiv);

      // Timeout
      const toLabel = document.createElement("label");
      toLabel.textContent = "Timeout (seconds): ";
      const toInput = document.createElement("input");
      toInput.type = "number"; toInput.className = "auto-step-input";
      toInput.min = 10; toInput.max = 86400;
      toInput.value = Math.round((step.timeoutMs || 300000) / 1000);
      toInput.addEventListener("input", () => { step.timeoutMs = (parseInt(toInput.value) || 300) * 1000; });
      toLabel.appendChild(toInput);
      container.appendChild(toLabel);

      const gateHint = document.createElement("div");
      gateHint.className = "auto-step-hint";
      gateHint.textContent = "Pauses the automation and sends a notification. You answer in the Pending Decisions panel. The automation resumes based on your response.";
      container.appendChild(gateHint);
      break;
    }
    case "loop": {
      // Collection to iterate
      const overLabel = document.createElement("label");
      overLabel.textContent = "Iterate over: ";
      const overSel = document.createElement("select");
      overSel.className = "auto-step-select";
      for (const [val, label] of [
        ["entities", "Extracted entities"], ["stepResults", "All step results"],
        ["_custom", "Custom path..."]
      ]) {
        const opt = document.createElement("option"); opt.value = val; opt.textContent = label;
        overSel.appendChild(opt);
      }
      overSel.value = step.over || "entities";
      const overCustom = document.createElement("input");
      overCustom.type = "text"; overCustom.className = "auto-step-input";
      overCustom.placeholder = "e.g. vars.items";
      overCustom.style.display = overSel.value === "_custom" ? "" : "none";
      overSel.addEventListener("change", () => {
        overCustom.style.display = overSel.value === "_custom" ? "" : "none";
        step.over = overSel.value === "_custom" ? overCustom.value : overSel.value;
      });
      overCustom.addEventListener("input", () => { step.over = overCustom.value; });
      overLabel.appendChild(overSel);
      container.appendChild(overLabel);
      container.appendChild(overCustom);

      // Variable name
      const varLabel = document.createElement("label");
      varLabel.textContent = "Item variable name: ";
      const varInput = document.createElement("input");
      varInput.type = "text"; varInput.className = "auto-step-input";
      varInput.value = step.varName || "item";
      varInput.addEventListener("input", () => { step.varName = varInput.value; });
      varLabel.appendChild(varInput);
      container.appendChild(varLabel);

      // Max iterations
      const maxLabel = document.createElement("label");
      maxLabel.textContent = "Max iterations: ";
      const maxInput = document.createElement("input");
      maxInput.type = "number"; maxInput.className = "auto-step-input";
      maxInput.min = 1; maxInput.max = 500; maxInput.value = step.maxIterations || 50;
      maxInput.addEventListener("input", () => { step.maxIterations = parseInt(maxInput.value) || 50; });
      maxLabel.appendChild(maxInput);
      container.appendChild(maxLabel);

      // Delay between iterations
      const delayLabel = document.createElement("label");
      delayLabel.textContent = "Delay between items (ms): ";
      const delayInput = document.createElement("input");
      delayInput.type = "number"; delayInput.className = "auto-step-input";
      delayInput.min = 0; delayInput.max = 30000; delayInput.value = step.delayMs || 1000;
      delayInput.addEventListener("input", () => { step.delayMs = parseInt(delayInput.value) || 0; });
      delayLabel.appendChild(delayInput);
      container.appendChild(delayLabel);

      const loopHint = document.createElement("div");
      loopHint.className = "auto-step-hint";
      loopHint.textContent = "Runs sub-steps for each item in a collection. Each iteration sets vars.[varName] to the current item.";
      container.appendChild(loopHint);
      break;
    }
    case "setVar": {
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Variable name: ";
      const nameInput = document.createElement("input");
      nameInput.type = "text"; nameInput.className = "auto-step-input";
      nameInput.value = step.varName || "";
      nameInput.placeholder = "e.g. author, sentiment, score";
      nameInput.addEventListener("input", () => { step.varName = nameInput.value; });
      nameLabel.appendChild(nameInput);
      container.appendChild(nameLabel);

      const valLabel = document.createElement("label");
      valLabel.textContent = "Value (path or literal): ";
      const valInput = document.createElement("input");
      valInput.type = "text"; valInput.className = "auto-step-input";
      valInput.value = step.value || "";
      valInput.placeholder = 'e.g. page.title, lastOutput, "fixed string"';
      valInput.addEventListener("input", () => { step.value = valInput.value; });
      valLabel.appendChild(valInput);
      container.appendChild(valLabel);

      const setVarHint = document.createElement("div");
      setVarHint.className = "auto-step-hint";
      setVarHint.textContent = "Sets a variable that can be used by downstream Condition, Filter, Switch, and Classify steps. Use quoted strings for literals, or paths like page.title for dynamic values.";
      container.appendChild(setVarHint);
      break;
    }
  }
}

function stepTypeLabel(type) {
  const labels = {
    analyze: "Analyze (Preset)",
    prompt: "Custom Prompt",
    extractEntities: "Extract Entities",
    addToProject: "Save Link to Project",
    addToMonitors: "Add to Monitors",
    runPipeline: "Run Pipeline",
    paste: "Paste to Service",
    saveToCloud: "Save to Cloud",
    condition: "IF / THEN / ELSE",
    filter: "Filter (Check List)",
    "switch": "Switch (Multi-Branch)",
    classify: "Classify (AI Decision)",
    gate: "Gate (Ask User)",
    loop: "Loop (Iterate)",
    setVar: "Set Variable",
  };
  return labels[type] || type;
}

function addEditorStep() {
  const type = document.getElementById("auto-add-step-type").value;
  const step = { type };
  if (type === "analyze") step.preset = "summary";
  if (type === "prompt") { step.system = ""; step.prompt = ""; step.inputMode = "page"; }
  if (type === "runPipeline") step.pipelineId = "";
  if (type === "addToProject") { step.projectId = ""; step.tagsWith = ["automation"]; step.summaryFrom = "last"; }
  if (type === "addToMonitors") { step.intervalMinutes = 60; step.aiAnalysis = true; step.analysisPreset = ""; step.duration = 0; }
  if (type === "paste") { step.provider = ""; step.inputMode = "previous"; step.titleTemplate = ""; step.filename = "argus-export.md"; }
  if (type === "saveToCloud") { step.inputMode = "previous"; step.format = "md"; step.providers = ["default"]; }
  // Logic step defaults
  if (type === "condition") {
    step.expression = { op: "contains", left: "page.text", right: "" };
    step.thenSteps = [];
    step.elseSteps = [];
  }
  if (type === "filter") {
    step.value = "page.title";
    step.list = "";
    step.action = "block";
    step.haltSteps = [];
    step.passSteps = [];
  }
  if (type === "switch") {
    step.value = "lastOutput";
    step.cases = [{ match: [], steps: [] }];
    step.defaultSteps = [];
  }
  if (type === "classify") {
    step.question = "Classify this content:";
    step.categories = [
      { value: "positive", label: "Positive", description: "Positive sentiment or favorable", steps: [] },
      { value: "negative", label: "Negative", description: "Negative sentiment or unfavorable", steps: [] },
      { value: "neutral", label: "Neutral", description: "Neutral or factual", steps: [] },
    ];
    step.defaultSteps = [];
    step.inputMode = "page";
  }
  if (type === "gate") {
    step.gateType = "confirm";
    step.question = "Continue this automation?";
    step.options = [];
    step.thenSteps = [];
    step.elseSteps = [];
    step.timeoutMs = 300000;
    step.timeoutAction = "halt";
  }
  if (type === "loop") {
    step.over = "entities";
    step.varName = "item";
    step.maxIterations = 50;
    step.steps = [];
    step.delayMs = 1000;
  }
  if (type === "setVar") {
    step.varName = "";
    step.value = "";
  }
  editorSteps.push(step);
  expandedStepIndex = editorSteps.length - 1; // auto-expand the new step
  renderEditorSteps();
  // Scroll the new step into view
  setTimeout(() => {
    const items = document.querySelectorAll(".auto-step-item");
    const last = items[items.length - 1];
    if (last) last.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
}

async function saveAutomation() {
  const name = document.getElementById("auto-name").value.trim();
  if (!name) { alert("Enter an automation name."); return; }
  if (!editorSteps.length) { alert("Add at least one step."); return; }

  const urlPatterns = document.getElementById("auto-url-patterns").value
    .split("\n").map(l => l.trim()).filter(Boolean);

  // If URL patterns are specified, request webNavigation
  if (urlPatterns.length) {
    try {
      const has = await browser.permissions.contains({ permissions: ["webNavigation"] });
      if (!has) {
        const granted = await browser.permissions.request({ permissions: ["webNavigation"] });
        if (!granted) {
          alert("URL triggers require the webNavigation permission.");
          return;
        }
        browser.runtime.sendMessage({ action: "initAutoAnalyze" });
      }
    } catch { /* ok */ }
  }

  const auto = editingAutomation ? { ...editingAutomation } : {};
  auto.name = name;
  auto.enabled = editingAutomation ? editingAutomation.enabled : true;
  auto.triggers = {
    urlPatterns,
    manual: document.getElementById("auto-manual").checked,
    projectId: document.getElementById("auto-project-trigger").value || null,
  };

  // Schedule trigger
  if (document.getElementById("auto-schedule-enabled").checked) {
    const schedType = document.getElementById("auto-schedule-type").value;
    const sched = { type: schedType };
    if (schedType === "once") {
      sched.datetime = document.getElementById("auto-schedule-datetime").value;
    } else if (schedType === "interval") {
      sched.intervalMs = (parseInt(document.getElementById("auto-schedule-interval-ms").value) || 60) * 60000;
    } else if (schedType === "daily") {
      sched.time = document.getElementById("auto-schedule-time").value || "09:00";
    } else if (schedType === "weekly") {
      sched.day = parseInt(document.getElementById("auto-schedule-day").value) || 1;
      sched.time = document.getElementById("auto-schedule-weekly-time").value || "09:00";
    } else if (schedType === "cron") {
      sched.hours = [...document.querySelectorAll(".cron-hour-cb:checked")].map(c => Number(c.value));
      sched.days = [...document.querySelectorAll(".cron-day-cb:checked")].map(c => Number(c.value));
    }
    sched.url = document.getElementById("auto-schedule-url").value.trim();
    auto.triggers.schedule = sched;
  } else {
    delete auto.triggers?.schedule;
  }
  auto.steps = editorSteps;
  auto.cooldownMs = parseInt(document.getElementById("auto-cooldown").value) || 60000;
  auto.delay = parseInt(document.getElementById("auto-delay").value) || 2000;
  auto.notifyOnComplete = document.getElementById("auto-notify").checked;
  auto.continueOnError = document.getElementById("auto-continue-error").checked;

  await browser.runtime.sendMessage({ action: "saveAutomation", automation: auto });
  closeAutomationEditor();
  await loadAutomations();
}

async function deleteAutomation() {
  if (!editingAutomation) return;
  if (!confirm(`Delete automation "${editingAutomation.name}"?`)) return;
  await browser.runtime.sendMessage({ action: "deleteAutomation", automationId: editingAutomation.id });
  closeAutomationEditor();
  await loadAutomations();
}

function closeAutomationEditor() {
  document.getElementById("automation-editor-card").classList.add("hidden");
  editingAutomation = null;
  editorSteps = [];
}

async function loadAutomationLog() {
  const resp = await browser.runtime.sendMessage({ action: "getAutomationLog" });
  const logs = (resp?.success ? resp.logs : []).slice(0, 20);
  const list = document.getElementById("automation-log-list");
  list.replaceChildren();

  if (!logs.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No runs yet.";
    list.appendChild(hint);
    return;
  }

  for (const log of logs) {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = log.automationName || log.automationId;
    const span = document.createElement("span");
    const stepsOk = log.steps.filter(s => s.status === "done").length;
    const statusText = log.status === "done" ? `${stepsOk}/${log.steps.length} steps` : log.status;
    const timeAgo = formatTimeAgo(new Date(log.startedAt));
    span.textContent = `${statusText} | ${truncateUrl(log.url)} | ${timeAgo}`;
    info.appendChild(strong);
    info.appendChild(span);

    const badge = document.createElement("span");
    badge.className = `auto-log-badge auto-log-${log.status}`;
    badge.textContent = log.status;

    div.appendChild(info);
    div.appendChild(badge);
    list.appendChild(div);
  }
}

function formatTimeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncateUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + "..." : u.pathname);
  } catch { return url.slice(0, 40); }
}

// ──────────────────────────────────────────────
// Named Lists
// ──────────────────────────────────────────────

let editingList = null;

async function loadNamedLists() {
  const resp = await browser.runtime.sendMessage({ action: "getLists" });
  const lists = resp?.success ? resp.lists : [];
  const container = document.getElementById("named-lists-list");
  container.replaceChildren();

  if (!lists.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No lists yet. Create watchlists, blocklists, or allowlists for automation logic.";
    container.appendChild(hint);
    return;
  }

  for (const list of lists) {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = list.name;
    if (list.prebuilt) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Pre-built";
      badge.style.cssText = "margin-left:6px;font-size:10px;opacity:0.7;";
      strong.appendChild(badge);
    }
    const span = document.createElement("span");
    const itemCount = Array.isArray(list.items) ? list.items.length : 0;
    span.textContent = `${list.type} · ${itemCount} item${itemCount !== 1 ? "s" : ""}${list.description ? " · " + list.description : ""}`;
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openListEditor(list));
    actions.appendChild(editBtn);

    div.appendChild(info);
    div.appendChild(actions);
    container.appendChild(div);
  }
}

function openListEditor(list) {
  editingList = list;
  const card = document.getElementById("list-editor-card");
  card.classList.remove("hidden");
  document.getElementById("list-editor-title").textContent = list ? `Edit List: ${list.name}` : "New List";
  document.getElementById("list-name").value = list?.name || "";
  document.getElementById("list-type").value = list?.type || "blocklist";
  document.getElementById("list-description").value = list?.description || "";
  document.getElementById("list-items").value = list?.items
    ? list.items.map(i => typeof i === "string" ? i : (i.value || "")).join("\n")
    : "";
  document.getElementById("list-delete-btn").classList.toggle("hidden", !list);
  card.scrollIntoView({ behavior: "smooth" });
}

async function saveNamedList() {
  const name = document.getElementById("list-name").value.trim();
  if (!name) { alert("Enter a list name."); return; }

  const itemsText = document.getElementById("list-items").value;
  const items = itemsText.split("\n").map(l => l.trim()).filter(Boolean).map(v => ({ value: v }));

  const list = editingList ? { ...editingList } : {};
  list.name = name;
  list.type = document.getElementById("list-type").value;
  list.description = document.getElementById("list-description").value.trim();
  list.items = items;

  await browser.runtime.sendMessage({ action: "saveList", list });
  closeListEditor();
  await loadNamedLists();
}

async function deleteNamedList() {
  if (!editingList) return;
  if (!confirm(`Delete list "${editingList.name}"?`)) return;
  await browser.runtime.sendMessage({ action: "removeList", listId: editingList.id });
  closeListEditor();
  await loadNamedLists();
}

function closeListEditor() {
  document.getElementById("list-editor-card").classList.add("hidden");
  editingList = null;
}

// ──────────────────────────────────────────────
// Pending Gates (Decision Points)
// ──────────────────────────────────────────────

async function loadPendingGates() {
  const resp = await browser.runtime.sendMessage({ action: "getPendingGates" });
  const gates = resp?.success ? resp.gates : [];
  const container = document.getElementById("pending-gates-list");
  const badge = document.getElementById("gates-count-badge");

  if (badge) {
    badge.textContent = gates.length;
    badge.style.display = gates.length > 0 ? "" : "none";
  }

  container.replaceChildren();

  if (!gates.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No pending decisions. Gate steps in running automations will appear here.";
    container.appendChild(hint);
    return;
  }

  for (const gate of gates) {
    const div = document.createElement("div");
    div.className = "rule-item";
    div.style.flexDirection = "column";
    div.style.gap = "8px";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;width:100%;";
    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = gate.automationName;
    const span = document.createElement("span");
    span.textContent = gate.url ? truncateUrl(gate.url) : "No URL";
    info.appendChild(strong);
    info.appendChild(span);
    header.appendChild(info);

    const timeSpan = document.createElement("span");
    timeSpan.className = "hint";
    timeSpan.textContent = formatTimeAgo(new Date(gate.createdAt));
    header.appendChild(timeSpan);
    div.appendChild(header);

    const question = document.createElement("div");
    question.style.cssText = "font-weight:600;font-size:13px;color:#e8e8e8;";
    question.textContent = gate.question;
    div.appendChild(question);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:6px;";

    if (gate.type === "confirm") {
      const yesBtn = document.createElement("button");
      yesBtn.className = "btn btn-accent btn-sm";
      yesBtn.textContent = "Yes";
      yesBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resolveGate", gateId: gate.id, answer: "yes" });
        loadPendingGates();
      });
      const noBtn = document.createElement("button");
      noBtn.className = "btn btn-secondary btn-sm";
      noBtn.textContent = "No";
      noBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resolveGate", gateId: gate.id, answer: "no" });
        loadPendingGates();
      });
      actions.appendChild(yesBtn);
      actions.appendChild(noBtn);
    } else if (gate.type === "choice") {
      for (const opt of (gate.options || [])) {
        const btn = document.createElement("button");
        btn.className = "btn btn-secondary btn-sm";
        btn.textContent = opt.label || opt.value;
        btn.addEventListener("click", async () => {
          await browser.runtime.sendMessage({ action: "resolveGate", gateId: gate.id, answer: opt.value });
          loadPendingGates();
        });
        actions.appendChild(btn);
      }
    } else if (gate.type === "input") {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Enter your response...";
      input.style.flex = "1";
      actions.appendChild(input);
      const submitBtn = document.createElement("button");
      submitBtn.className = "btn btn-accent btn-sm";
      submitBtn.textContent = "Submit";
      submitBtn.addEventListener("click", async () => {
        if (!input.value.trim()) return;
        await browser.runtime.sendMessage({ action: "resolveGate", gateId: gate.id, answer: input.value.trim() });
        loadPendingGates();
      });
      actions.appendChild(submitBtn);
    }

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "btn btn-danger btn-sm";
    rejectBtn.textContent = "Reject";
    rejectBtn.title = "Reject and halt automation";
    rejectBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "rejectGate", gateId: gate.id });
      loadPendingGates();
    });
    actions.appendChild(rejectBtn);

    div.appendChild(actions);
    container.appendChild(div);
  }
}


// ──────────────────────────────────────────────
// Automation Export / Import
// ──────────────────────────────────────────────

async function exportAutomationsToFile() {
  const status = document.getElementById("automations-io-status");
  try {
    const resp = await browser.runtime.sendMessage({ action: "exportAutomations" });
    if (!resp?.success) { status.textContent = "Export failed"; return; }

    const payload = {
      _type: "argus-automations-export",
      _version: 1,
      exportedAt: new Date().toISOString(),
      automations: resp.automations,
      lists: resp.lists,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `argus-automations-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const count = (resp.automations?.length || 0) + (resp.lists?.length || 0);
    status.textContent = `Exported ${count} items!`;
    status.style.color = "";
  } catch (err) {
    status.textContent = "Export error: " + err.message;
    status.style.color = "var(--error)";
  }
  setTimeout(() => { status.textContent = ""; }, 3000);
}

async function importAutomationsFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById("automations-io-status");

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data._type !== "argus-automations-export") {
      throw new Error("Not a valid Argus automations export file");
    }

    const mode = document.getElementById("import-automations-mode").value;
    if (mode === "replace") {
      if (!confirm("This will REPLACE all existing automations and named lists. Continue?")) return;
    }

    const resp = await browser.runtime.sendMessage({
      action: "importAutomations",
      automations: data.automations || [],
      lists: data.lists || [],
      mode,
    });

    if (resp?.success) {
      status.textContent = `Imported ${resp.imported.automations} automations, ${resp.imported.lists} lists!`;
      status.style.color = "";
      await loadAutomations();
      await loadNamedLists();
    } else {
      status.textContent = "Import failed";
      status.style.color = "var(--error)";
    }
  } catch (err) {
    status.textContent = "Import error: " + err.message;
    status.style.color = "var(--error)";
  }

  event.target.value = "";
  setTimeout(() => { status.textContent = ""; }, 4000);
}

async function seedPrebuiltAutomations() {
  const status = document.getElementById("automations-io-status");
  try {
    await browser.runtime.sendMessage({ action: "seedPrebuiltAutomations" });
    status.textContent = "Pre-built templates restored!";
    status.style.color = "";
    await loadAutomations();
    await loadNamedLists();
  } catch (err) {
    status.textContent = "Seed error: " + err.message;
    status.style.color = "var(--error)";
  }
  setTimeout(() => { status.textContent = ""; }, 3000);
}


async function renderFeedRoutes() {
  el.feedRouteList.replaceChildren();

  // Populate project and feed dropdowns
  const [projResp, feedResp] = await Promise.all([
    browser.runtime.sendMessage({ action: "getProjects" }),
    browser.runtime.sendMessage({ action: "getFeeds" })
  ]);

  const projects = projResp?.projects || [];
  const rssFeeds = feedResp?.feeds || [];

  // Populate project dropdown
  el.routeProject.replaceChildren();
  const defOpt = document.createElement("option");
  defOpt.value = "";
  defOpt.textContent = "Select project...";
  el.routeProject.appendChild(defOpt);
  projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    el.routeProject.appendChild(opt);
  });

  // Populate feed dropdown
  el.routeFeed.replaceChildren();
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All feeds";
  el.routeFeed.appendChild(allOpt);
  rssFeeds.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.title || f.url;
    el.routeFeed.appendChild(opt);
  });

  if (!feedKeywordRoutes.length) {
    const empty = document.createElement("p");
    empty.className = "info-text";
    empty.textContent = "No keyword routes configured.";
    el.feedRouteList.appendChild(empty);
    return;
  }

  feedKeywordRoutes.forEach((route, idx) => {
    const row = document.createElement("div");
    row.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";

    const keywords = document.createElement("strong");
    const kwText = route.keywords.join(", ");
    keywords.textContent = kwText === "*" ? "✱ All stories" : kwText;
    if (kwText === "*") keywords.style.color = "var(--accent)";
    info.appendChild(keywords);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    const proj = projects.find(p => p.id === route.projectId);
    const projName = proj?.name || "Unknown project";
    const projColor = proj?.color || "#a0a0b0";
    const feedName = route.feedId
      ? (rssFeeds.find(f => f.id === route.feedId)?.title || "Specific feed")
      : "All feeds";
    const flags = [];
    if (route.notify) flags.push("notify");
    // Build meta with colored project dot
    const arrow = document.createTextNode(" → ");
    meta.appendChild(arrow);
    const dot = document.createElement("span");
    dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${projColor};margin-right:4px;vertical-align:middle;`;
    meta.appendChild(dot);
    meta.appendChild(document.createTextNode(`${projName} | ${feedName}${flags.length ? " | " + flags.join(", ") : ""}`));
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-sm btn-secondary";
    toggleBtn.textContent = route.enabled !== false ? "Pause" : "Resume";
    toggleBtn.addEventListener("click", () => {
      route.enabled = route.enabled === false ? true : false;
      renderFeedRoutes();
      scheduleSave();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      feedKeywordRoutes.splice(idx, 1);
      renderFeedRoutes();
      scheduleSave();
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);
    if (route.enabled === false) row.style.opacity = "0.5";
    el.feedRouteList.appendChild(row);
  });
}

function addFeedRoute() {
  const keywordsRaw = el.routeKeywords.value.trim();
  const projectId = el.routeProject.value;

  if (!keywordsRaw) return;
  if (!projectId) { alert("Select a target project."); return; }

  const keywords = keywordsRaw.split(",").map(k => k.trim()).filter(Boolean);

  feedKeywordRoutes.push({
    id: `fkr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    keywords,
    projectId,
    feedId: el.routeFeed.value || "",
    notify: el.routeNotify.checked,
    enabled: true
  });

  el.routeKeywords.value = "";
  renderFeedRoutes();
  scheduleSave();

  // Trigger retroactive scan of existing feed entries against the new route
  browser.runtime.sendMessage({ action: "feedRouteRescan" }).then(resp => {
    if (resp?.routed > 0) {
      console.log(`[Routes] Retroactive scan routed ${resp.routed} existing entries`);
    }
  }).catch(() => {});
}



// ──────────────────────────────────────────────
// Init on page load
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  _initElProxy();

  // Load state from storage
  const settings = await browser.storage.local.get({
    customPresets: {},
    autoAnalyzeRules: [],
    feedKeywordRoutes: []
  });
  customPresets = settings.customPresets || {};
  autoAnalyzeRules = settings.autoAnalyzeRules || [];
  feedKeywordRoutes = settings.feedKeywordRoutes || [];

  // Init auto-analyze rules UI
  populateRulePresets();
  renderAutoRules();

  // Automation event listeners (extracted from attachListeners)
  // Add auto-analyze rule
  // Check webNavigation permission at load so we can request it synchronously on click
  let hasWebNav = false;
  browser.permissions.contains({ permissions: ["webNavigation"] }).then(ok => { hasWebNav = ok; });

  el.addRule.addEventListener("click", async () => {
    const urlPattern = el.ruleUrl.value.trim();
    if (!urlPattern) return;

    // Request webNavigation permission — must be first await (direct user gesture)
    if (!hasWebNav) {
      const granted = await browser.permissions.request({ permissions: ["webNavigation"] });
      if (!granted) {
        alert("Automation requires the webNavigation permission to detect page loads.");
        return;
      }
      hasWebNav = true;
      browser.runtime.sendMessage({ action: "initAutoAnalyze" });
    }

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

  // Named Automations
  loadAutomations();
  document.getElementById("new-automation-btn").addEventListener("click", () => openAutomationEditor(null));
  document.getElementById("export-automations-btn").addEventListener("click", exportAutomationsToFile);
  document.getElementById("import-automations-btn").addEventListener("click", () => document.getElementById("import-automations-file").click());
  document.getElementById("import-automations-file").addEventListener("change", importAutomationsFromFile);
  document.getElementById("seed-prebuilt-btn").addEventListener("click", seedPrebuiltAutomations);
  document.getElementById("auto-add-step-btn").addEventListener("click", addEditorStep);
  document.getElementById("auto-save-btn").addEventListener("click", saveAutomation);
  document.getElementById("auto-cancel-btn").addEventListener("click", closeAutomationEditor);
  document.getElementById("auto-delete-btn").addEventListener("click", deleteAutomation);

  // Schedule trigger toggle
  const scheduleEnabled = document.getElementById("auto-schedule-enabled");
  const scheduleOpts = document.getElementById("auto-schedule-options");
  if (scheduleEnabled && scheduleOpts) {
    scheduleEnabled.addEventListener("change", () => {
      scheduleOpts.classList.toggle("hidden", !scheduleEnabled.checked);
    });
    const schedType = document.getElementById("auto-schedule-type");
    if (schedType) {
      schedType.addEventListener("change", () => {
        document.getElementById("auto-schedule-once").classList.toggle("hidden", schedType.value !== "once");
        document.getElementById("auto-schedule-interval").classList.toggle("hidden", schedType.value !== "interval");
        document.getElementById("auto-schedule-daily-opts").classList.toggle("hidden", schedType.value !== "daily");
        document.getElementById("auto-schedule-weekly-opts").classList.toggle("hidden", schedType.value !== "weekly");
        document.getElementById("auto-schedule-cron-opts").classList.toggle("hidden", schedType.value !== "cron");
      });
    }
    // Build cron hour checkboxes
    const cronHours = document.getElementById("auto-schedule-cron-hours");
    if (cronHours) {
      for (let h = 0; h < 24; h++) {
        const lbl = document.createElement("label");
        lbl.style.cssText = "display:flex;align-items:center;gap:2px;cursor:pointer;";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.value = h; cb.className = "cron-hour-cb";
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(String(h).padStart(2, "0")));
        cronHours.appendChild(lbl);
      }
    }
    // Build cron day checkboxes
    const cronDays = document.getElementById("auto-schedule-cron-days");
    if (cronDays) {
      for (const [val, label] of [[0,"Sun"],[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"],[6,"Sat"]]) {
        const lbl = document.createElement("label");
        lbl.style.cssText = "display:flex;align-items:center;gap:2px;cursor:pointer;";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.value = val; cb.className = "cron-day-cb";
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(label));
        cronDays.appendChild(lbl);
      }
    }
  }

  // Named Lists
  loadNamedLists();
  document.getElementById("new-list-btn").addEventListener("click", () => openListEditor(null));
  document.getElementById("list-save-btn").addEventListener("click", saveNamedList);
  document.getElementById("list-cancel-btn").addEventListener("click", closeListEditor);
  document.getElementById("list-delete-btn").addEventListener("click", deleteNamedList);

  // Pending Gates
  loadPendingGates();
  setInterval(loadPendingGates, 15000); // refresh every 15s


  // Feed keyword routes
  renderFeedRoutes();
  el.addFeedRoute.addEventListener("click", addFeedRoute);
});
