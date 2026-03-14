// ──────────────────────────────────────────────
// Named Automation Engine
// Reusable multi-step analysis workflows triggered
// by URL patterns, manual runs, or project actions.
// Now with conditional logic, decision gates, named
// lists, and smart prompt classifiers.
// Loaded after background-agents.js in background scripts.
// ──────────────────────────────────────────────

const AutomationEngine = (() => {

  const STORAGE_KEY = "automations";
  const LOG_KEY = "automation-logs";
  const LISTS_KEY = "automation-lists";
  const GATES_KEY = "automation-pending-gates";
  const COOLDOWN = new Map(); // "automationId-url" → timestamp

  // ── CRUD ──

  async function getAll() {
    const { [STORAGE_KEY]: list = [] } = await browser.storage.local.get({ [STORAGE_KEY]: [] });
    return list;
  }

  async function getById(id) {
    const list = await getAll();
    return list.find(a => a.id === id) || null;
  }

  async function save(automation) {
    const list = await getAll();
    const idx = list.findIndex(a => a.id === automation.id);
    automation.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      list[idx] = automation;
    } else {
      automation.id = automation.id || `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      automation.createdAt = automation.createdAt || new Date().toISOString();
      list.push(automation);
    }
    await browser.storage.local.set({ [STORAGE_KEY]: list });
    return { success: true, automation };
  }

  async function remove(automationId) {
    const list = await getAll();
    const filtered = list.filter(a => a.id !== automationId);
    await browser.storage.local.set({ [STORAGE_KEY]: filtered });
    return { success: true };
  }

  // ── Named Lists (watchlists, blocklists, allowlists) ──

  async function getLists() {
    const { [LISTS_KEY]: lists = [] } = await browser.storage.local.get({ [LISTS_KEY]: [] });
    return lists;
  }

  async function getListById(listId) {
    const lists = await getLists();
    return lists.find(l => l.id === listId) || null;
  }

  async function getListByName(name) {
    const lists = await getLists();
    return lists.find(l => l.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async function saveList(list) {
    const lists = await getLists();
    const idx = lists.findIndex(l => l.id === list.id);
    list.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      lists[idx] = list;
    } else {
      list.id = list.id || `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      list.createdAt = list.createdAt || new Date().toISOString();
      lists.push(list);
    }
    await browser.storage.local.set({ [LISTS_KEY]: lists });
    return { success: true, list };
  }

  async function removeList(listId) {
    const lists = await getLists();
    await browser.storage.local.set({ [LISTS_KEY]: lists.filter(l => l.id !== listId) });
    return { success: true };
  }

  function listContains(list, value) {
    if (!list || !list.items || !value) return false;
    const needle = String(value).toLowerCase().trim();
    return list.items.some(item => {
      const hay = String(item.value || item).toLowerCase().trim();
      // Exact match or glob match
      if (hay === needle) return true;
      if (hay.includes("*")) {
        const regex = new RegExp("^" + hay.replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
        return regex.test(needle);
      }
      return false;
    });
  }

  // ── Pending Gates (for user-input decision points) ──

  let pendingGates = new Map(); // gateId → { resolve, reject, step, ctx }

  function getPendingGates() {
    const gates = [];
    for (const [id, g] of pendingGates) {
      gates.push({
        id,
        automationId: g.ctx.automationId,
        automationName: g.ctx.automationName,
        question: g.step.question || "Continue?",
        type: g.step.gateType || "confirm",
        options: g.step.options || [],
        url: g.ctx.page?.url || "",
        createdAt: g.createdAt,
      });
    }
    return gates;
  }

  function resolveGate(gateId, answer) {
    const gate = pendingGates.get(gateId);
    if (!gate) return { success: false, error: "Gate not found or expired" };
    gate.resolve(answer);
    pendingGates.delete(gateId);
    return { success: true };
  }

  function rejectGate(gateId) {
    const gate = pendingGates.get(gateId);
    if (!gate) return { success: false, error: "Gate not found" };
    gate.reject(new Error("Gate rejected by user"));
    pendingGates.delete(gateId);
    return { success: true };
  }

  // ── Expression Evaluator ──
  // Evaluates condition expressions against the automation context.
  // Supports: comparisons, list lookups, contains, matches, in, mentions.

  function evaluateExpression(expr, ctx) {
    if (!expr || typeof expr !== "object") return false;

    const op = expr.op || "eq";
    const left = resolveValue(expr.left, ctx);
    const right = resolveValue(expr.right, ctx);

    switch (op) {
      case "eq":  return String(left).toLowerCase() === String(right).toLowerCase();
      case "neq": return String(left).toLowerCase() !== String(right).toLowerCase();
      case "gt":  return Number(left) > Number(right);
      case "gte": return Number(left) >= Number(right);
      case "lt":  return Number(left) < Number(right);
      case "lte": return Number(left) <= Number(right);
      case "contains":
        return String(left).toLowerCase().includes(String(right).toLowerCase());
      case "not_contains":
        return !String(left).toLowerCase().includes(String(right).toLowerCase());
      case "matches":
        try { return new RegExp(String(right), "i").test(String(left)); }
        catch { return false; }
      case "not_matches":
        try { return !new RegExp(String(right), "i").test(String(left)); }
        catch { return true; }
      case "in_list":
        // right is a list name or ID; left is the value to check
        // This is evaluated async, so we use the pre-resolved list from ctx._resolvedLists
        if (ctx._resolvedLists && ctx._resolvedLists[String(right)]) {
          return listContains(ctx._resolvedLists[String(right)], left);
        }
        return false;
      case "not_in_list":
        if (ctx._resolvedLists && ctx._resolvedLists[String(right)]) {
          return !listContains(ctx._resolvedLists[String(right)], left);
        }
        return true;
      case "exists":   return left !== undefined && left !== null && left !== "";
      case "empty":    return left === undefined || left === null || left === "";
      case "and":
        return (Array.isArray(expr.conditions) ? expr.conditions : []).every(c => evaluateExpression(c, ctx));
      case "or":
        return (Array.isArray(expr.conditions) ? expr.conditions : []).some(c => evaluateExpression(c, ctx));
      case "not":
        return !evaluateExpression(expr.condition, ctx);
      default:
        console.warn(`[Automation] Unknown operator: ${op}`);
        return false;
    }
  }

  // Resolve a value reference from the context
  function resolveValue(ref, ctx) {
    if (ref === undefined || ref === null) return "";
    if (typeof ref !== "string") return ref;

    // Literal values (quoted strings or numbers)
    if (/^".*"$/.test(ref) || /^'.*'$/.test(ref)) return ref.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(ref)) return Number(ref);
    if (ref === "true") return true;
    if (ref === "false") return false;

    // Context path resolution
    const parts = ref.split(".");
    let val = ctx;
    for (const part of parts) {
      if (val === undefined || val === null) return "";
      // Array index access: stepResults[0]
      const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrMatch) {
        val = val[arrMatch[1]];
        if (Array.isArray(val)) val = val[Number(arrMatch[2])];
        else return "";
      } else {
        val = val[part];
      }
    }
    return val !== undefined ? val : "";
  }

  // Pre-resolve any list references in an expression tree so we can evaluate sync
  async function preResolveLists(expr, ctx) {
    if (!expr || typeof expr !== "object") return;
    if (!ctx._resolvedLists) ctx._resolvedLists = {};

    if (expr.op === "in_list" || expr.op === "not_in_list") {
      const listRef = String(expr.right);
      if (!ctx._resolvedLists[listRef]) {
        const list = await getListById(listRef) || await getListByName(listRef);
        if (list) ctx._resolvedLists[listRef] = list;
      }
    }
    if (Array.isArray(expr.conditions)) {
      for (const c of expr.conditions) await preResolveLists(c, ctx);
    }
    if (expr.condition) await preResolveLists(expr.condition, ctx);
  }

  // ── URL Pattern Matching ──

  async function matchUrl(url) {
    if (!url || url.startsWith("about:") || url.startsWith("moz-extension:")) return [];
    const list = await getAll();
    return list.filter(a => {
      if (!a.enabled) return false;
      if (!a.triggers || !a.triggers.urlPatterns || !a.triggers.urlPatterns.length) return false;
      return a.triggers.urlPatterns.some(p => matchUrlPattern(url, p));
    });
  }

  // ── Chain Runner ──

  let activeRun = null; // { automationId, cancelled, progress }

  async function run(automationId, opts = {}) {
    const automation = await getById(automationId);
    if (!automation) return { success: false, error: "Automation not found" };
    if (!automation.steps || !automation.steps.length) return { success: false, error: "No steps defined" };

    // Check cooldown
    const cooldownMs = automation.cooldownMs || 60000;
    const url = opts.url || opts.page?.url || "";
    if (url) {
      const ck = `${automationId}-${url}`;
      const last = COOLDOWN.get(ck);
      if (last && Date.now() - last < cooldownMs) {
        return { success: false, error: "Cooldown active" };
      }
      COOLDOWN.set(ck, Date.now());
    }

    // Build initial chain context
    const ctx = {
      page: opts.page || null,
      tabId: opts.tabId || null,
      stepResults: [],
      lastOutput: "",
      entities: [],
      projectItemId: null,
      automationId,
      automationName: automation.name,
      vars: opts.vars || {}, // user-settable variables for logic steps
      _resolvedLists: {},     // cache for list lookups
    };

    // If we have a tabId but no page content, extract it
    if (ctx.tabId && !ctx.page) {
      try {
        ctx.page = await extractPageContent(ctx.tabId);
      } catch (e) {
        return { success: false, error: `Failed to extract page: ${e.message}` };
      }
    }

    // If we have a URL but no page content and no tab, fetch it
    if (!ctx.page && url) {
      try {
        const text = await fetchPageText(url);
        ctx.page = { url, title: opts.title || url, text };
      } catch (e) {
        return { success: false, error: `Failed to fetch page: ${e.message}` };
      }
    }

    if (!ctx.page) {
      return { success: false, error: "No page content available" };
    }

    activeRun = { automationId, cancelled: false, progress: { current: 0, total: automation.steps.length } };

    const logEntry = {
      id: `log-${Date.now()}`,
      automationId,
      automationName: automation.name,
      url: ctx.page.url,
      startedAt: new Date().toISOString(),
      steps: [],
      status: "running",
    };

    try {
      for (let i = 0; i < automation.steps.length; i++) {
        if (activeRun.cancelled) {
          logEntry.status = "cancelled";
          break;
        }

        activeRun.progress.current = i + 1;
        const step = automation.steps[i];
        const stepLog = { index: i, type: step.type, startedAt: new Date().toISOString(), status: "running" };

        try {
          const result = await runStep(step, ctx);
          ctx.stepResults.push(result);
          if (result.content) ctx.lastOutput = result.content;
          if (result.entities) ctx.entities.push(...result.entities);
          if (result.projectItemId) ctx.projectItemId = result.projectItemId;

          stepLog.status = "done";
          stepLog.contentLength = (result.content || "").length;
          if (result.branch) stepLog.branch = result.branch;
          if (result.classification) stepLog.classification = result.classification;
          if (result.switchValue) stepLog.switchValue = result.switchValue;
          if (result.answer) stepLog.answer = result.answer;

          // Handle halt signal from logic steps (filter blocked, gate rejected, etc.)
          if (result._halt) {
            stepLog.halted = true;
            logEntry.status = "halted";
            logEntry.haltReason = result.content || "Halted by logic step";
            logEntry.steps.push(stepLog);
            break;
          }
        } catch (e) {
          stepLog.status = "error";
          stepLog.error = e.message;

          if (!automation.continueOnError) {
            logEntry.status = "error";
            logEntry.error = `Step ${i + 1} (${step.type}) failed: ${e.message}`;
            logEntry.steps.push(stepLog);
            break;
          }
        }

        logEntry.steps.push(stepLog);
      }

      if (logEntry.status === "running") logEntry.status = "done";
    } catch (e) {
      logEntry.status = "error";
      logEntry.error = e.message;
    }

    logEntry.finishedAt = new Date().toISOString();
    activeRun = null;

    // Save log
    await appendLog(logEntry);

    // Notification
    if (automation.notifyOnComplete && logEntry.status === "done") {
      safeNotify(`auto-${automationId}`, {
        type: "basic",
        title: `Automation Complete: ${automation.name}`,
        message: `${logEntry.steps.length} steps completed on ${ctx.page.title || ctx.page.url}`,
        iconUrl: browser.runtime.getURL("icons/icon-48.png"),
      });
    }

    return {
      success: logEntry.status === "done",
      status: logEntry.status,
      automationName: automation.name,
      stepsCompleted: logEntry.steps.filter(s => s.status === "done").length,
      totalSteps: automation.steps.length,
      lastOutput: ctx.lastOutput,
      error: logEntry.error || null,
    };
  }

  // ── Step Executor ──

  async function runStep(step, ctx) {
    switch (step.type) {
      case "analyze": return await stepAnalyze(step, ctx);
      case "prompt": return await stepPrompt(step, ctx);
      case "extractEntities": return await stepExtractEntities(step, ctx);
      case "addToProject": return await stepAddToProject(step, ctx);
      case "addToMonitors": return await stepAddToMonitors(step, ctx);
      case "runPipeline": return await stepRunPipeline(step, ctx);
      case "paste": return await stepPaste(step, ctx);
      case "saveToCloud": return await stepSaveToCloud(step, ctx);
      // ── Logic step types ──
      case "condition": return await stepCondition(step, ctx);
      case "gate": return await stepGate(step, ctx);
      case "switch": return await stepSwitch(step, ctx);
      case "filter": return await stepFilter(step, ctx);
      case "loop": return await stepLoop(step, ctx);
      case "classify": return await stepClassify(step, ctx);
      case "setVar": return stepSetVar(step, ctx);
      default: throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  // ── Logic Steps ──

  // CONDITION: Evaluate an expression, run thenSteps or elseSteps
  async function stepCondition(step, ctx) {
    await preResolveLists(step.expression, ctx);
    const result = evaluateExpression(step.expression, ctx);

    const branch = result ? (step.thenSteps || []) : (step.elseSteps || []);
    const branchName = result ? "then" : "else";

    let branchOutput = "";
    for (const subStep of branch) {
      const subResult = await runStep(subStep, ctx);
      ctx.stepResults.push(subResult);
      if (subResult.content) ctx.lastOutput = subResult.content;
      if (subResult.entities) ctx.entities.push(...subResult.entities);
      if (subResult.projectItemId) ctx.projectItemId = subResult.projectItemId;
      branchOutput = subResult.content || branchOutput;

      // Propagate control signals from nested logic steps
      if (subResult._halt) return { stepType: "condition", content: branchOutput, branch: branchName, _halt: true };
      if (subResult._skip) break;
    }

    return { stepType: "condition", content: branchOutput, branch: branchName, evaluated: result };
  }

  // GATE: Pause execution, ask the user a question, route based on answer
  async function stepGate(step, ctx) {
    const gateId = `gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const gateType = step.gateType || "confirm"; // confirm, choice, input

    // Notify the user there's a pending gate
    safeNotify(`gate-${gateId}`, {
      type: "basic",
      title: `Automation Paused: ${ctx.automationName}`,
      message: step.question || "A decision is required to continue.",
      iconUrl: browser.runtime.getURL("icons/icon-48.png"),
    });

    // Create a promise that waits for user response
    const answer = await new Promise((resolve, reject) => {
      pendingGates.set(gateId, {
        resolve,
        reject,
        step,
        ctx,
        createdAt: new Date().toISOString(),
      });

      // Auto-timeout after configurable duration (default 5 min)
      const timeoutMs = step.timeoutMs || 300000;
      setTimeout(() => {
        if (pendingGates.has(gateId)) {
          pendingGates.delete(gateId);
          if (step.timeoutAction === "continue") {
            resolve(step.timeoutDefault || "timeout");
          } else {
            reject(new Error("Gate timed out — no user response"));
          }
        }
      }, timeoutMs);
    });

    // Route based on answer
    const answerStr = String(answer).toLowerCase().trim();
    let branchSteps = [];

    if (gateType === "confirm") {
      branchSteps = (answerStr === "yes" || answerStr === "true")
        ? (step.thenSteps || [])
        : (step.elseSteps || []);
    } else if (gateType === "choice") {
      // Find the matching option and its branch
      const option = (step.options || []).find(o =>
        String(o.value).toLowerCase() === answerStr || String(o.label).toLowerCase() === answerStr
      );
      branchSteps = option?.steps || step.defaultSteps || [];
    } else if (gateType === "input") {
      // Store the user's input as a variable for downstream use
      if (!ctx.vars) ctx.vars = {};
      ctx.vars[step.varName || "gateInput"] = answer;
      branchSteps = step.thenSteps || [];
    }

    let branchOutput = `Gate answered: ${answer}`;
    for (const subStep of branchSteps) {
      const subResult = await runStep(subStep, ctx);
      ctx.stepResults.push(subResult);
      if (subResult.content) ctx.lastOutput = subResult.content;
      if (subResult.entities) ctx.entities.push(...subResult.entities);
      if (subResult._halt) return { stepType: "gate", content: branchOutput, answer, _halt: true };
      if (subResult._skip) break;
      branchOutput = subResult.content || branchOutput;
    }

    return { stepType: "gate", content: branchOutput, answer, gateId };
  }

  // SWITCH: Multi-branch routing based on a value
  async function stepSwitch(step, ctx) {
    const value = String(resolveValue(step.value, ctx)).toLowerCase().trim();

    // Find matching case
    let matchedSteps = null;
    for (const branch of (step.cases || [])) {
      const patterns = Array.isArray(branch.match) ? branch.match : [branch.match];
      const matched = patterns.some(p => {
        const pat = String(p).toLowerCase().trim();
        if (pat === value) return true;
        if (pat === "*") return true; // wildcard / default
        if (pat.includes("*")) {
          try { return new RegExp("^" + pat.replace(/\*/g, ".*") + "$", "i").test(value); }
          catch { return false; }
        }
        return false;
      });
      if (matched) {
        matchedSteps = branch.steps || [];
        break;
      }
    }

    // Fallback to default
    if (!matchedSteps) matchedSteps = step.defaultSteps || [];

    let branchOutput = "";
    for (const subStep of matchedSteps) {
      const subResult = await runStep(subStep, ctx);
      ctx.stepResults.push(subResult);
      if (subResult.content) ctx.lastOutput = subResult.content;
      if (subResult.entities) ctx.entities.push(...subResult.entities);
      if (subResult._halt) return { stepType: "switch", content: branchOutput, switchValue: value, _halt: true };
      if (subResult._skip) break;
      branchOutput = subResult.content || branchOutput;
    }

    return { stepType: "switch", content: branchOutput, switchValue: value };
  }

  // FILTER: Check a value against a named list, halt or continue
  async function stepFilter(step, ctx) {
    const value = resolveValue(step.value, ctx);
    const listRef = step.list; // list name or ID

    const list = await getListById(listRef) || await getListByName(listRef);
    if (!list) {
      // If list doesn't exist, decide based on step config
      if (step.onMissing === "halt") return { stepType: "filter", content: `List "${listRef}" not found — halted`, _halt: true };
      return { stepType: "filter", content: `List "${listRef}" not found — skipped`, matched: false };
    }

    const matched = listContains(list, value);
    const action = step.action || "block"; // block = halt if in list, allow = halt if NOT in list

    const shouldHalt = (action === "block" && matched) || (action === "allow" && !matched);

    if (shouldHalt) {
      // Run haltSteps if defined (e.g., flag for review, notify, etc.)
      let haltOutput = `Filter: "${value}" ${matched ? "found in" : "not in"} list "${list.name}" — halted`;
      for (const subStep of (step.haltSteps || [])) {
        const subResult = await runStep(subStep, ctx);
        ctx.stepResults.push(subResult);
        if (subResult.content) haltOutput = subResult.content;
      }
      return { stepType: "filter", content: haltOutput, matched, listName: list.name, _halt: true };
    }

    // Run passSteps if defined
    let passOutput = `Filter: "${value}" ${matched ? "found in" : "not in"} list "${list.name}" — passed`;
    for (const subStep of (step.passSteps || [])) {
      const subResult = await runStep(subStep, ctx);
      ctx.stepResults.push(subResult);
      if (subResult.content) passOutput = subResult.content;
    }

    return { stepType: "filter", content: passOutput, matched, listName: list.name };
  }

  // LOOP: Iterate over a collection and run steps for each item
  async function stepLoop(step, ctx) {
    const collection = resolveValue(step.over, ctx);
    const items = Array.isArray(collection) ? collection : [];
    const varName = step.varName || "item";
    const maxIterations = step.maxIterations || 100;

    if (!ctx.vars) ctx.vars = {};
    const outputs = [];

    for (let i = 0; i < Math.min(items.length, maxIterations); i++) {
      ctx.vars[varName] = items[i];
      ctx.vars[varName + "Index"] = i;

      for (const subStep of (step.steps || [])) {
        const subResult = await runStep(subStep, ctx);
        ctx.stepResults.push(subResult);
        if (subResult.content) ctx.lastOutput = subResult.content;
        if (subResult.entities) ctx.entities.push(...subResult.entities);
        if (subResult._halt) return { stepType: "loop", content: outputs.join("\n"), iterations: i + 1, _halt: true };
        if (subResult._skip) break; // skip = break inner loop (next iteration)
      }
      outputs.push(ctx.lastOutput);

      // Pace iterations to avoid hammering APIs
      if (step.delayMs && i < items.length - 1) {
        await new Promise(r => setTimeout(r, step.delayMs));
      }
    }

    return { stepType: "loop", content: outputs.join("\n---\n"), iterations: items.length };
  }

  // CLASSIFY: Use an LLM to classify content into categories, then route
  async function stepClassify(step, ctx) {
    const settings = await getProviderSettings(step.provider || null);
    const inputText = step.inputMode === "previous"
      ? ctx.lastOutput
      : (ctx.page.text || "").slice(0, 30000);

    const categories = step.categories || [];
    const categoryList = categories.map(c => `- "${c.value}": ${c.description || c.label || c.value}`).join("\n");

    const systemPrompt = `You are a classifier. Analyze the given content and classify it into exactly ONE of these categories:\n\n${categoryList}\n\nRespond with ONLY the category value (the quoted word), nothing else. No explanation.`;
    const userPrompt = (step.question || "Classify this content:") + "\n\n---\n\n" + inputText;
    const messages = buildMessages(systemPrompt, userPrompt);

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      { maxTokens: 50, temperature: 0.1 }
    );

    const classification = (result.content || "").trim().replace(/^["']|["']$/g, "").toLowerCase();

    // Find matching category and its branch
    const matched = categories.find(c =>
      classification === String(c.value).toLowerCase() ||
      classification.includes(String(c.value).toLowerCase())
    );

    const branchSteps = matched?.steps || step.defaultSteps || [];
    let branchOutput = `Classified as: ${classification}`;

    for (const subStep of branchSteps) {
      const subResult = await runStep(subStep, ctx);
      ctx.stepResults.push(subResult);
      if (subResult.content) ctx.lastOutput = subResult.content;
      if (subResult.entities) ctx.entities.push(...subResult.entities);
      if (subResult._halt) return { stepType: "classify", content: branchOutput, classification, _halt: true };
      if (subResult._skip) break;
      branchOutput = subResult.content || branchOutput;
    }

    // Store classification as a variable for downstream use
    if (!ctx.vars) ctx.vars = {};
    ctx.vars[step.varName || "classification"] = classification;

    return { stepType: "classify", content: branchOutput, classification, model: result.model };
  }

  // SETVAR: Set a variable in the context for use by downstream steps
  function stepSetVar(step, ctx) {
    if (!ctx.vars) ctx.vars = {};
    const value = resolveValue(step.value, ctx);
    ctx.vars[step.varName || "temp"] = value;
    return { stepType: "setVar", content: `Set ${step.varName} = ${value}` };
  }

  async function stepAnalyze(step, ctx) {
    const settings = await getProviderSettings(step.provider || null);
    const presetKey = step.preset || "summary";
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(ctx.page, presetKey, null, settings);
    const messages = buildMessages(systemPrompt, userPrompt);

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      { maxTokens: settings.maxTokens, temperature: settings.temperature }
    );

    // Save to history
    const preset = ANALYSIS_PRESETS[presetKey];
    await saveToHistory({
      pageTitle: ctx.page.title, pageUrl: ctx.page.url, provider: settings.provider,
      model: result.model, preset: presetKey, presetLabel: preset?.label || presetKey,
      content: result.content, usage: result.usage, autoAnalyzed: true,
      automationName: ctx.automationName,
    });

    return { stepType: "analyze", content: result.content, model: result.model };
  }

  async function stepPrompt(step, ctx) {
    const settings = await getProviderSettings(step.provider || null);
    const inputText = step.inputMode === "previous" ? ctx.lastOutput : (ctx.page.text || "").slice(0, 30000);
    const langInst = await getLanguageInstruction();

    const systemPrompt = (step.system || "You are a helpful analyst.") + langInst;
    const userPrompt = (step.prompt || "") + "\n\n---\n\n" + inputText;
    const messages = buildMessages(systemPrompt, userPrompt);

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      { maxTokens: step.maxTokens || settings.maxTokens, temperature: settings.temperature }
    );

    return { stepType: "prompt", content: result.content, model: result.model };
  }

  async function stepExtractEntities(step, ctx) {
    const settings = await getProviderSettings();
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(ctx.page, "entities", null, settings);
    const messages = buildMessages(systemPrompt, userPrompt);

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      { maxTokens: settings.maxTokens, temperature: 0.2 }
    );

    // Feed into KG
    const entities = [];
    try {
      KnowledgeGraph.extractAndUpsert(result.content, ctx.page.url, ctx.page.title, "entities");
    } catch { /* non-critical */ }

    return { stepType: "extractEntities", content: result.content, entities };
  }

  async function stepAddToProject(step, ctx) {
    if (!step.projectId) throw new Error("addToProject step requires a projectId");

    const summary = step.summaryFrom === "last"
      ? (ctx.lastOutput || "").slice(0, 500)
      : (ctx.stepResults[step.summaryFrom]?.content || "").slice(0, 500);

    const tags = (step.tagsWith || []).map(t =>
      t === "{automationName}" ? ctx.automationName : t
    );
    tags.push("automation");

    const resp = await handleAddProjectItem({
      projectId: step.projectId,
      item: {
        type: "automation",
        url: ctx.page.url || "",
        title: ctx.page.title || "Untitled",
        summary,
        tags,
      },
    });

    return { stepType: "addToProject", content: summary, projectItemId: resp?.itemId || null };
  }

  async function stepAddToMonitors(step, ctx) {
    if (!ctx.page || !ctx.page.url) throw new Error("addToMonitors requires a page URL");

    const resp = await handleAddMonitor({
      url: ctx.page.url,
      title: ctx.page.title || ctx.page.url,
      intervalMinutes: step.intervalMinutes || 60,
      aiAnalysis: step.aiAnalysis !== false,
      analysisPreset: step.analysisPreset || "",
      duration: step.duration || 0,
    });

    if (!resp.success && resp.error && resp.error.includes("already being monitored")) {
      return { stepType: "addToMonitors", content: `Already monitored: ${ctx.page.url}`, skipped: true };
    }
    if (!resp.success) throw new Error(resp.error || "Failed to add monitor");

    return { stepType: "addToMonitors", content: `Monitoring: ${ctx.page.url} (every ${step.intervalMinutes || 60}m)` };
  }

  async function stepRunPipeline(step, ctx) {
    const settings = await getProviderSettings();
    const sourceType = step.pipelineId
      ? SourcePipelines.SOURCE_TYPES.find(s => s.id === step.pipelineId)
      : SourcePipelines.detectSourceType(ctx.page.url, ctx.page);

    if (!sourceType) {
      return { stepType: "runPipeline", content: "No matching pipeline for this page.", entities: [] };
    }

    const pipeResult = await SourcePipelines.runPipeline(sourceType, ctx.page, settings);
    return {
      stepType: "runPipeline",
      content: pipeResult.markdown || JSON.stringify(pipeResult.structuredData || {}),
      entities: pipeResult.entities || [],
    };
  }

  // ── Paste to External Service ──

  async function stepPaste(step, ctx) {
    // Use explicit provider, or fall back to user's default paste provider
    let provider = step.provider;
    if (!provider) {
      const { defaultPasteProvider } = await browser.storage.local.get({ defaultPasteProvider: "" });
      provider = defaultPasteProvider;
    }
    if (!provider) throw new Error("No paste provider selected and no default set. Configure one in Providers → Default Providers.");

    const pp = CloudProviders[provider];
    if (!pp) throw new Error(`Unknown paste provider: ${provider}`);
    if (!await pp.isConnected()) throw new Error(`${provider} is not connected. Configure it in Providers → Paste Providers.`);

    // Determine content to paste
    const content = step.inputMode === "page"
      ? (ctx.page.text || "").slice(0, 100000)
      : (ctx.lastOutput || "");
    if (!content) throw new Error("No content to paste");

    const title = step.titleTemplate
      ? step.titleTemplate.replace("{title}", ctx.page.title || "Untitled").replace("{url}", ctx.page.url || "").replace("{automation}", ctx.automationName || "")
      : `Argus — ${ctx.page.title || ctx.page.url || "Export"}`;

    let result;
    if (provider === "gist") {
      const filename = step.filename || "argus-export.md";
      const files = {};
      files[filename] = content;
      // If entities exist and includeEntities is true, add a second file
      if (step.includeEntities && ctx.entities.length) {
        files["entities.json"] = JSON.stringify(ctx.entities, null, 2);
      }
      result = await pp.createPaste(title, files, step.isPublic || false);
    } else if (provider === "pastebin") {
      const visibility = step.visibility ?? 1; // 0=public, 1=unlisted, 2=private
      const format = step.format || "text";
      const expiry = step.expiry || "N"; // never
      result = await pp.createPaste(title, content, visibility, format, expiry);
    } else if (provider === "privatebin") {
      const expiry = step.expiry || "1week";
      const burn = step.burnAfterReading || false;
      result = await pp.createPaste(content, expiry, burn);
    }

    if (!result || !result.url) throw new Error("Paste creation returned no URL");
    console.log(`[Automation] Pasted to ${provider}: ${result.url}`);
    return { stepType: "paste", content: result.url, pasteUrl: result.url };
  }

  // ── Save to Cloud Storage ──

  async function stepSaveToCloud(step, ctx) {
    const content = step.inputMode === "page"
      ? (ctx.page.text || "").slice(0, 500000)
      : (ctx.lastOutput || "");
    if (!content) throw new Error("No content to save");

    const safeTitle = (ctx.page.title || "export").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = step.format === "json" ? "json" : "md";
    const filename = `argus-automations/${safeTitle}-${timestamp}.${ext}`;
    const blob = new Blob([content], { type: ext === "json" ? "application/json" : "text/markdown" });

    // Determine which providers to upload to — step config, then user default, then all
    let targetProviders = step.providers || [];
    if (!targetProviders.length || targetProviders.includes("default")) {
      const { defaultCloudProvider } = await browser.storage.local.get({ defaultCloudProvider: "all" });
      targetProviders = [defaultCloudProvider || "all"];
    }
    const providerKeys = targetProviders.includes("all")
      ? ["google", "dropbox", "webdav", "s3"]
      : targetProviders;

    const results = {};
    let uploaded = 0;
    for (const key of providerKeys) {
      try {
        const provider = CloudProviders[key];
        if (provider && await provider.isConnected()) {
          await provider.upload(blob, filename);
          results[key] = { success: true };
          uploaded++;
          console.log(`[Automation] Saved to ${key}: ${filename}`);
        }
      } catch (e) {
        results[key] = { success: false, error: e.message };
        console.error(`[Automation] Save to ${key} failed:`, e.message);
      }
    }

    if (uploaded === 0) throw new Error("No cloud providers connected. Configure them in Providers → Data Providers.");

    return {
      stepType: "saveToCloud",
      content: `Saved to ${uploaded} provider(s): ${filename}`,
      cloudResults: results,
    };
  }

  // ── Run on Project Items ──

  async function runOnItem(automationId, projectId, itemUrl, itemTitle) {
    let text;
    try {
      text = await fetchPageText(itemUrl);
    } catch (e) {
      return { success: false, error: `Failed to fetch: ${e.message}` };
    }

    return await run(automationId, {
      page: { url: itemUrl, title: itemTitle || itemUrl, text },
    });
  }

  async function runOnProject(automationId, projectId) {
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };

    const items = (proj.items || []).filter(i => i.url);
    if (!items.length) return { success: false, error: "No items with URLs" };

    const results = [];
    for (const item of items) {
      const r = await run(automationId, {
        url: item.url,
        title: item.title,
      });
      results.push({ url: item.url, title: item.title, ...r });

      // Pace requests
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const succeeded = results.filter(r => r.success).length;
    return {
      success: true,
      total: items.length,
      succeeded,
      failed: items.length - succeeded,
      results,
    };
  }

  // ── Run Status ──

  function getRunStatus() {
    if (!activeRun) return { running: false };
    return {
      running: true,
      automationId: activeRun.automationId,
      progress: activeRun.progress,
    };
  }

  function cancel() {
    if (activeRun) activeRun.cancelled = true;
    return { success: true };
  }

  // ── Logging ──

  async function appendLog(entry) {
    try {
      const { [LOG_KEY]: logs = [] } = await browser.storage.local.get({ [LOG_KEY]: [] });
      logs.unshift(entry);
      if (logs.length > 100) logs.length = 100;
      await browser.storage.local.set({ [LOG_KEY]: logs });
    } catch { /* non-critical */ }
  }

  async function getLog(automationId) {
    const { [LOG_KEY]: logs = [] } = await browser.storage.local.get({ [LOG_KEY]: [] });
    if (automationId) return logs.filter(l => l.automationId === automationId);
    return logs;
  }

  // ── Scheduled Triggers ──
  // Automations can have triggers.schedule with:
  //   { type: "once", datetime: "2026-06-05T10:00:00" }
  //   { type: "interval", intervalMs: 3600000 }
  //   { type: "cron", hours: [9,17], days: [1,2,3,4,5] }  (weekdays at 9am & 5pm)
  //   { type: "daily", time: "09:00" }
  //   { type: "weekly", day: 1, time: "09:00" }

  const SCHEDULE_CHECK_INTERVAL = 60000; // check every minute
  const scheduleLastRun = new Map(); // automationId → timestamp

  async function checkScheduledAutomations() {
    try {
      const list = await getAll();
      const now = new Date();

      for (const auto of list) {
        if (!auto.enabled || !auto.triggers?.schedule) continue;
        const sched = auto.triggers.schedule;
        const lastRun = scheduleLastRun.get(auto.id) || 0;

        let shouldRun = false;

        if (sched.type === "once") {
          const target = new Date(sched.datetime);
          if (now >= target && !scheduleLastRun.has(auto.id)) {
            shouldRun = true;
          }
        } else if (sched.type === "interval") {
          if (now.getTime() - lastRun >= (sched.intervalMs || 3600000)) {
            shouldRun = true;
          }
        } else if (sched.type === "daily") {
          const [h, m] = (sched.time || "09:00").split(":").map(Number);
          if (now.getHours() === h && now.getMinutes() === m && now.getTime() - lastRun > 120000) {
            shouldRun = true;
          }
        } else if (sched.type === "weekly") {
          const [h, m] = (sched.time || "09:00").split(":").map(Number);
          if (now.getDay() === (sched.day || 1) && now.getHours() === h && now.getMinutes() === m && now.getTime() - lastRun > 120000) {
            shouldRun = true;
          }
        } else if (sched.type === "cron") {
          const hours = sched.hours || [];
          const days = sched.days || [0, 1, 2, 3, 4, 5, 6];
          if (hours.includes(now.getHours()) && days.includes(now.getDay()) && now.getMinutes() === 0 && now.getTime() - lastRun > 120000) {
            shouldRun = true;
          }
        }

        if (shouldRun) {
          scheduleLastRun.set(auto.id, now.getTime());
          console.log(`[Automation] Scheduled run: ${auto.name}`);

          // For scheduled runs, use the configured URL or run without page context
          const url = sched.url || auto.triggers?.defaultUrl || "";
          run(auto.id, { url, title: auto.name + " (scheduled)" }).catch(e => {
            console.error(`[Automation] Scheduled run failed: ${auto.name}`, e.message);
          });
        }
      }
    } catch (e) {
      console.error("[Automation] Schedule check error:", e.message);
    }
  }

  // Start the scheduler
  setInterval(checkScheduledAutomations, SCHEDULE_CHECK_INTERVAL);
  // Run once on load after a short delay
  setTimeout(checkScheduledAutomations, 5000);

  // ── Seed pre-built templates ──

  async function seedPrebuilt() {
    if (typeof PREBUILT_AUTOMATIONS === "undefined" || typeof PREBUILT_LISTS === "undefined") {
      console.warn("[Automation] Pre-built data not loaded, skipping seed");
      return;
    }
    const existing = await getAll();
    const existingIds = new Set(existing.map(a => a.id));
    const now = new Date().toISOString();
    let seededAuto = 0, seededList = 0;

    for (const template of PREBUILT_AUTOMATIONS) {
      if (!existingIds.has(template.id)) {
        const auto = { ...template, createdAt: now, updatedAt: now };
        await save(auto);
        seededAuto++;
      }
    }

    const existingLists = await getLists();
    const existingListIds = new Set(existingLists.map(l => l.id));

    for (const template of PREBUILT_LISTS) {
      if (!existingListIds.has(template.id)) {
        const list = { ...template, createdAt: now, updatedAt: now };
        await saveList(list);
        seededList++;
      }
    }

    console.log(`[Automation] Seeded ${seededAuto} automations, ${seededList} lists`);
  }

  // ── Export / Import ──

  async function exportAll() {
    const automations = await getAll();
    const lists = await getLists();
    return { automations, lists };
  }

  async function importAll(data, mode = "merge") {
    const imported = { automations: 0, lists: 0 };

    if (mode === "replace") {
      // Clear existing
      await browser.storage.local.set({ [STORAGE_KEY]: [], [LISTS_KEY]: [] });
    }

    const now = new Date().toISOString();

    // Import automations
    if (Array.isArray(data.automations)) {
      const existing = mode === "replace" ? [] : await getAll();
      const existingIds = new Set(existing.map(a => a.id));

      for (const auto of data.automations) {
        const toSave = { ...auto, updatedAt: now };
        if (!toSave.id || (mode === "merge" && !existingIds.has(toSave.id))) {
          toSave.id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        if (!toSave.createdAt) toSave.createdAt = now;
        await save(toSave);
        imported.automations++;
      }
    }

    // Import lists
    if (Array.isArray(data.lists)) {
      const existing = mode === "replace" ? [] : await getLists();
      const existingIds = new Set(existing.map(l => l.id));

      for (const list of data.lists) {
        const toSave = { ...list, updatedAt: now };
        if (!toSave.id || (mode === "merge" && !existingIds.has(toSave.id))) {
          toSave.id = `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        if (!toSave.createdAt) toSave.createdAt = now;
        await saveList(toSave);
        imported.lists++;
      }
    }

    return { success: true, imported };
  }

  // ── Public API ──

  return {
    getAll,
    getById,
    save,
    remove,
    matchUrl,
    run,
    runOnItem,
    runOnProject,
    getRunStatus,
    cancel,
    getLog,
    // Named Lists
    getLists,
    getListById,
    getListByName,
    saveList,
    removeList,
    // Decision Gates
    getPendingGates,
    resolveGate,
    rejectGate,
    // Expression evaluation (for testing/preview)
    evaluateExpression,
    resolveValue,
    // Import / Export
    exportAll,
    importAll,
    // Seeding
    seedPrebuilt,
    STEP_TYPES: [
      "analyze", "prompt", "extractEntities", "addToProject", "addToMonitors",
      "runPipeline", "paste", "saveToCloud",
      // Logic steps
      "condition", "gate", "switch", "filter", "loop", "classify", "setVar",
    ],
    LOGIC_STEP_TYPES: ["condition", "gate", "switch", "filter", "loop", "classify", "setVar"],
  };

})();

// ── Seed pre-built automations on first install ──
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("[Automation] First install — seeding pre-built automations and lists");
    await AutomationEngine.seedPrebuilt();
  }
});
