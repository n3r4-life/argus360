// ──────────────────────────────────────────────
// Named Automation Engine
// Reusable multi-step analysis workflows triggered
// by URL patterns, manual runs, or project actions.
// Loaded after background-agents.js in background scripts.
// ──────────────────────────────────────────────

const AutomationEngine = (() => {

  const STORAGE_KEY = "automations";
  const LOG_KEY = "automation-logs";
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
      case "runPipeline": return await stepRunPipeline(step, ctx);
      default: throw new Error(`Unknown step type: ${step.type}`);
    }
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
    STEP_TYPES: ["analyze", "prompt", "extractEntities", "addToProject", "runPipeline"],
  };

})();
