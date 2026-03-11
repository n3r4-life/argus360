// ──────────────────────────────────────────────
// Core background script — router, context menus, analysis, and feature modules
// Presets & provider config: background-presets.js
// Provider API calls: background-providers.js
// Permission helpers: background-permissions.js
// OSINT tools: background-osint.js
// ──────────────────────────────────────────────

// NOTE: ANALYSIS_PRESETS, PROVIDERS, BROWSER_LANG_MAP, getLanguageInstruction
// are defined in background-presets.js (loaded before this file)

// NOTE: All provider call functions, getProviderSettings, parseSSEStream
// are defined in background-providers.js (loaded before this file)

// ──────────────────────────────────────────────
// In-memory conversation history (keyed by tab ID)
// ──────────────────────────────────────────────
const conversationHistory = new Map();

// Clean up on tab close/navigate
browser.tabs.onRemoved.addListener(tabId => {
  conversationHistory.delete(tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) conversationHistory.delete(tabId);
});

// ──────────────────────────────────────────────
// Auto-analyze cooldown tracker
// ──────────────────────────────────────────────
const autoAnalyzeCooldown = new Map();

// ──────────────────────────────────────────────
// Context menu setup
// ──────────────────────────────────────────────
async function createContextMenus() {
  await browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: "argus-parent",
    title: "Argus",
    contexts: ["page", "frame", "selection"]
  });

  // ── Console & Help ──
  browser.contextMenus.create({
    id: "argus-console",
    parentId: "argus-parent",
    title: "\uD83D\uDDA5\uFE0F Argus Console",
    contexts: ["page", "frame", "selection"]
  });

  browser.contextMenus.create({
    id: "argus-help",
    parentId: "argus-parent",
    title: "\u2753 Help",
    contexts: ["page", "frame", "selection"]
  });

  browser.contextMenus.create({
    id: "argus-sep-console",
    parentId: "argus-parent",
    type: "separator",
    contexts: ["page", "frame", "selection"]
  });

  // ── Quick Actions ──
  browser.contextMenus.create({
    id: "argus-bookmark",
    parentId: "argus-parent",
    title: "\uD83D\uDD16 Bookmark with AI Tags",
    contexts: ["page", "frame"]
  });

  browser.contextMenus.create({
    id: "argus-monitor",
    parentId: "argus-parent",
    title: "\uD83D\uDC41\uFE0F Monitor This Page",
    contexts: ["page", "frame"]
  });

  // ── Redirector submenu ──
  browser.contextMenus.create({
    id: "argus-redirector-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDD00 Redirector",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-redirect",
    parentId: "argus-redirector-parent",
    title: "Redirect via Archive",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-save-archive",
    parentId: "argus-redirector-parent",
    title: "Save to Archive",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-add-trouble-list",
    parentId: "argus-redirector-parent",
    title: "Add Site to Trouble List",
    contexts: ["page", "frame"]
  });

  browser.contextMenus.create({
    id: "argus-add-feed",
    parentId: "argus-parent",
    title: "\uD83D\uDCE1 Subscribe to Feed",
    contexts: ["page", "frame"]
  });

  browser.contextMenus.create({
    id: "argus-open-reader",
    parentId: "argus-parent",
    title: "\uD83D\uDCF0 Open Feed Reader",
    contexts: ["page", "frame"]
  });

  // Add to Project submenu
  const argusProjects = await ArgusDB.Projects.getAll();
  if (argusProjects.length > 0) {
    browser.contextMenus.create({
      id: "argus-project-parent",
      parentId: "argus-parent",
      title: "\uD83D\uDCC1 Add to Project",
      contexts: ["page", "frame"]
    });
    for (const proj of argusProjects) {
      browser.contextMenus.create({
        id: `argus-project-${proj.id}`,
        parentId: "argus-project-parent",
        title: proj.name,
        contexts: ["page", "frame"]
      });
    }
  }

  // ── OSINT Tools ──
  browser.contextMenus.create({
    id: "argus-osint-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDD0D OSINT Tools",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-extract-metadata",
    parentId: "argus-osint-parent",
    title: "Extract Metadata",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-map-links",
    parentId: "argus-osint-parent",
    title: "Map Links",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-whois",
    parentId: "argus-osint-parent",
    title: "Whois / DNS Lookup",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-techstack",
    parentId: "argus-osint-parent",
    title: "Detect Tech Stack",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-osint-sep",
    parentId: "argus-osint-parent",
    type: "separator",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-osint-dashboard",
    parentId: "argus-osint-parent",
    title: "OSINT Dashboard",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-osint-global-graph",
    parentId: "argus-osint-parent",
    title: "Global Knowledge Graph",
    contexts: ["page", "frame"]
  });

  // ── Site Versions submenu ──
  browser.contextMenus.create({
    id: "argus-versions-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDDC3\uFE0F Site Versions",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-check-archive",
    parentId: "argus-versions-parent",
    title: "Check archive.is",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-check-wayback",
    parentId: "argus-versions-parent",
    title: "Check Wayback Machine",
    contexts: ["page", "frame"]
  });

  browser.contextMenus.create({
    id: "argus-separator-actions",
    parentId: "argus-parent",
    type: "separator",
    contexts: ["page", "frame", "selection"]
  });

  // ── Analysis Presets ──
  // Default presets
  for (const [key, preset] of Object.entries(ANALYSIS_PRESETS)) {
    browser.contextMenus.create({
      id: `argus-analyze-${key}`,
      parentId: "argus-parent",
      title: preset.label,
      contexts: ["page", "frame", "selection"]
    });
  }

  // Custom presets
  const { customPresets } = await browser.storage.local.get({ customPresets: {} });
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      browser.contextMenus.create({
        id: `argus-analyze-${key}`,
        parentId: "argus-parent",
        title: preset.label || key,
        contexts: ["page", "frame", "selection"]
      });
    }
  }
}

createContextMenus();

// Rebuild context menus when presets or projects change
browser.storage.onChanged.addListener((changes) => {
  if (changes.customPresets || changes.argusProjects) createContextMenus();
  if (changes.showBadge) updateBadge();
});

// ──────────────────────────────────────────────
// Content extraction from a specific frame
// ──────────────────────────────────────────────
async function extractFrameContent(tabId, frameId) {
  const results = await browser.tabs.executeScript(tabId, {
    frameId: frameId,
    code: `
      (function() {
        const title = document.title || "";
        const url = window.location.href;
        const meta = document.querySelector('meta[name="description"]');
        const description = meta ? meta.content : "";

        // Try multiple selectors and pick the longest result
        const candidates = [
          "article",
          "main",
          '[role="main"]',
          '[itemprop="articleBody"]',
          ".article-body", ".article-content", ".article__body", ".article__content",
          ".post-content", ".post-body", ".entry-content",
          ".story-body", ".story-content",
          "#article-body", "#article-content",
          ".content-body", ".page-content"
        ];
        let bestText = "";
        for (const sel of candidates) {
          const el = document.querySelector(sel);
          if (el) {
            const t = el.innerText || "";
            if (t.length > bestText.length) bestText = t;
          }
        }
        // Fall back to document.body if no candidate found or too short
        if (bestText.length < 200) bestText = document.body.innerText || "";
        return { title, url, description, text: bestText };
      })();
    `
  });

  if (!results || !results[0]) {
    throw new Error("Failed to extract content from the page frame.");
  }

  const { title, url, description, text } = results[0];
  if (!text || text.trim().length < 20) {
    throw new Error("The page frame appears to have no readable text content.");
  }

  return { title, url, description, text };
}

// ──────────────────────────────────────────────
// PDF.js worker setup
// ──────────────────────────────────────────────
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = browser.runtime.getURL("lib/pdf.worker.min.js");
}

function isPdfUrl(url) {
  if (!url) return false;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith(".pdf");
  } catch { return false; }
}

async function extractPdfContent(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
  const contentType = response.headers.get("content-type") || "";

  const arrayBuffer = await response.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    pages.push(strings.join(" "));
  }

  const text = pages.join("\n\n");
  const metadata = await pdf.getMetadata().catch(() => null);
  const title = metadata?.info?.Title || url.split("/").pop().replace(/\.pdf$/i, "") || "PDF Document";
  const description = metadata?.info?.Subject || metadata?.info?.Keywords || "";

  return { title, url, description, text, selection: "", isPdf: true, pdfPages: pdf.numPages };
}

// ──────────────────────────────────────────────
// Content extraction from active tab
// ──────────────────────────────────────────────
async function extractPageContent(tabId) {
  let tab;
  if (tabId) {
    tab = await browser.tabs.get(tabId);
  } else {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) throw new Error("No active tab found.");
    tab = tabs[0];
  }

  if (tab.url && (tab.url.startsWith("about:") ||
                  tab.url.startsWith("moz-extension:") ||
                  tab.url.startsWith("chrome:"))) {
    throw new Error("Cannot analyze browser internal pages.");
  }

  // PDF detection: check URL or content-type header
  // For file:// PDFs, Firefox's built-in viewer renders HTML we can scrape via executeScript
  const looksLikePdf = isPdfUrl(tab.url) || (tab.url && tab.title && tab.title.endsWith(".pdf"));
  if (looksLikePdf && !tab.url.startsWith("file:")) {
    try {
      const pdfResult = await extractPdfContent(tab.url);
      return { ...pdfResult, tabId: tab.id };
    } catch (e) {
      throw new Error(`PDF extraction failed: ${e.message}`);
    }
  }

  // For file:// PDFs, extract from Firefox's built-in PDF.js viewer
  if (looksLikePdf && tab.url.startsWith("file:")) {
    try {
      const pdfViewerResults = await browser.tabs.executeScript(tab.id, {
        code: `
          (function() {
            // Firefox's PDF.js viewer renders text in .textLayer span elements
            const spans = document.querySelectorAll(".textLayer span");
            if (spans.length > 0) {
              const pages = document.querySelectorAll(".page");
              const pageTexts = [];
              pages.forEach(page => {
                const layer = page.querySelector(".textLayer");
                if (layer) {
                  const pageSpans = layer.querySelectorAll("span");
                  const text = Array.from(pageSpans).map(s => s.textContent).join(" ");
                  if (text.trim()) pageTexts.push(text.trim());
                }
              });
              return {
                title: document.title || "PDF Document",
                url: window.location.href,
                text: pageTexts.join("\\n\\n"),
                pages: pageTexts.length
              };
            }
            // Fallback: grab all visible text
            return {
              title: document.title || "PDF Document",
              url: window.location.href,
              text: document.body.innerText || "",
              pages: 0
            };
          })();
        `
      });
      if (pdfViewerResults && pdfViewerResults[0] && pdfViewerResults[0].text.trim().length > 20) {
        const r = pdfViewerResults[0];
        return {
          title: r.title.replace(/ - .+$/, "") || "PDF Document",
          url: r.url, description: "", text: r.text,
          selection: "", isPdf: true, pdfPages: r.pages,
          tabId: tab.id
        };
      }
    } catch (e) {
      throw new Error(`Cannot access file:// PDF. In about:addons → Argus → Permissions, enable "Access your data for all websites", or open the PDF from a web URL instead. (${e.message})`);
    }
  }

  let results;
  try {
    results = await browser.tabs.executeScript(tab.id, {
      code: `
        (function() {
          const title = document.title || "";
          const url = window.location.href;
          const meta = document.querySelector('meta[name="description"]');
          const description = meta ? meta.content : "";
          const selection = window.getSelection().toString();

          // Try multiple selectors and pick the longest result
          const candidates = [
            "article",
            "main",
            '[role="main"]',
            '[itemprop="articleBody"]',
            ".article-body", ".article-content", ".article__body", ".article__content",
            ".post-content", ".post-body", ".entry-content",
            ".story-body", ".story-content",
            "#article-body", "#article-content",
            ".content-body", ".page-content"
          ];
          let bestText = "";
          for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el) {
              const t = el.innerText || "";
              if (t.length > bestText.length) bestText = t;
            }
          }
          // Fall back to document.body if no candidate found or too short
          if (bestText.length < 200) bestText = document.body.innerText || "";
          return { title, url, description, text: bestText, selection };
        })();
      `
    });
  } catch (scriptError) {
    // executeScript fails on PDF viewer or restricted pages — try PDF extraction
    if (tab.url && typeof pdfjsLib !== "undefined") {
      try {
        const pdfResult = await extractPdfContent(tab.url);
        return { ...pdfResult, tabId: tab.id };
      } catch { /* fall through to original error */ }
    }
    throw new Error("Missing host permission for the tab");
  }

  if (!results || !results[0]) throw new Error("Failed to extract page content.");

  const { title, url, description, text, selection } = results[0];
  if (!text || text.trim().length < 20) {
    // Last resort: maybe it's a PDF served without .pdf extension
    if (tab.url && typeof pdfjsLib !== "undefined") {
      try {
        const pdfResult = await extractPdfContent(tab.url);
        return { ...pdfResult, tabId: tab.id };
      } catch { /* not a PDF, throw original error */ }
    }
    throw new Error("Page appears to have no readable text content.");
  }

  return { title, url, description, text, selection, tabId: tab.id };
}

// ──────────────────────────────────────────────
// Selection extraction
// ──────────────────────────────────────────────
async function extractSelection(tabId) {
  const results = await browser.tabs.executeScript(tabId || undefined, {
    code: `window.getSelection().toString();`
  });
  return results && results[0] ? results[0] : "";
}

// ──────────────────────────────────────────────
// Prompt variable resolution
// ──────────────────────────────────────────────
function resolveVariables(template, vars) {
  return template
    .replace(/\{url\}/gi, vars.url || "")
    .replace(/\{domain\}/gi, vars.domain || "")
    .replace(/\{title\}/gi, vars.title || "")
    .replace(/\{date\}/gi, vars.date || "")
    .replace(/\{wordcount\}/gi, String(vars.wordcount || 0));
}

// ──────────────────────────────────────────────
// Text truncation
// ──────────────────────────────────────────────
function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) +
    "\n\n[... Content truncated at " + maxChars.toLocaleString() + " characters ...]";
}

// ──────────────────────────────────────────────
// Build messages array for a provider call
// ──────────────────────────────────────────────
function buildMessages(systemPrompt, userPrompt) {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

async function buildAnalysisPrompts(page, analysisType, customPrompt, settings) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const defaultPreset = ANALYSIS_PRESETS[analysisType];
  const customPreset = settings.customPresets[analysisType];

  const baseSystem = customPreset?.system || defaultPreset?.system || "You are a helpful assistant that analyzes web content.";
  const langInstruction = await getLanguageInstruction();
  const sharelineInstruction = ' At the very end of your response, include a single catchy shareable one-liner (under 180 characters) on its own line prefixed with exactly "SHARELINE:" — this will be hidden from the user and only used for social sharing.';
  const systemPrompt = `Today's date is ${today}. ${baseSystem}${langInstruction}${sharelineInstruction}`;

  const analysisInstruction = customPrompt
    ? customPrompt
    : customPreset?.prompt || defaultPreset?.prompt || "Analyze this webpage content.";

  // Resolve prompt variables
  const vars = {
    url: page.url,
    domain: page.url ? new URL(page.url).hostname : "",
    title: page.title,
    date: today,
    wordcount: page.text ? page.text.split(/\s+/).length : 0
  };

  const resolvedInstruction = resolveVariables(analysisInstruction, vars);
  const resolvedSystem = resolveVariables(systemPrompt, vars);
  const truncatedText = truncateText(page.text, settings.maxInputChars);

  const userPrompt =
    `**Page Title:** ${page.title}\n` +
    `**URL:** ${page.url}\n` +
    (page.description ? `**Description:** ${page.description}\n` : "") +
    `\n---\n\n${resolvedInstruction}\n\n---\n\n${truncatedText}`;

  return { systemPrompt: resolvedSystem, userPrompt };
}

// ──────────────────────────────────────────────
// History management
// ──────────────────────────────────────────────
async function saveToHistory(entry) {
  await ArgusDB.History.add(entry);
  // Extract entities for knowledge graph (non-blocking)
  try {
    if (entry.content && entry.pageUrl) {
      KnowledgeGraph.extractAndUpsert(entry.content, entry.pageUrl, entry.pageTitle, entry.preset);
    }
  } catch (e) { console.warn("[KG] entity extraction failed:", e); }
}

// ──────────────────────────────────────────────
// Streaming port handler
// ──────────────────────────────────────────────
browser.runtime.onConnect.addListener((port) => {
  if (port.name !== "analysis") return;

  port.onMessage.addListener(async (message) => {
    if (message.action === "analyzeStream") {
      await handleAnalyzeStream(port, message);
    } else if (message.action === "followUpStream") {
      await handleFollowUpStream(port, message);
    } else if (message.action === "compareStream") {
      await handleCompareStream(port, message);
    }
  });
});

async function handleAnalyzeStream(port, message) {
  try {
    const settings = await getProviderSettings(message.provider, message.analysisType);
    let page;
    if (message.selectedText) {
      // Selection analysis
      page = {
        title: message.pageTitle || "Selected Text",
        url: message.pageUrl || "",
        description: "",
        text: message.selectedText
      };
    } else if (message.tabIds && message.tabIds.length > 1) {
      // Multi-page analysis
      const pages = [];
      for (const tabId of message.tabIds) {
        try {
          const p = await extractPageContent(tabId);
          pages.push(p);
        } catch (e) {
          pages.push({ title: `Tab ${tabId}`, url: "", text: `[Error: ${e.message}]`, description: "" });
        }
      }
      const isResearch = message.analysisType === "research";
      const label = isResearch ? "Source" : "Page";
      const combined = pages.map((p, i) =>
        `\n\n--- ${label} ${i + 1}: ${p.title} (${p.url}) ---\n\n${truncateText(p.text, Math.floor(settings.maxInputChars / pages.length))}`
      ).join("");
      page = {
        title: isResearch ? `Research: ${pages.length} sources` : `${pages.length} pages analyzed`,
        url: pages[0]?.url || "",
        description: "",
        text: combined,
        _sources: pages.map((p, i) => ({ index: i + 1, title: p.title, url: p.url })),
        _isResearch: isResearch
      };
    } else {
      page = await extractPageContent();
    }

    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, message.analysisType, message.customPrompt, settings);
    const messages = buildMessages(systemPrompt, userPrompt);

    port.postMessage({ type: "start", provider: settings.provider, model: settings.model, pageTitle: page.title });

    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, messages,
      opts,
      (chunk) => { try { port.postMessage({ type: "chunk", text: chunk }); } catch(e) {} },
      (thinking) => { try { port.postMessage({ type: "thinking", text: thinking }); } catch(e) {} }
    );

    // Store conversation history for follow-ups
    const tabId = page.tabId || message.tabId;
    if (tabId) {
      conversationHistory.set(tabId, {
        provider: settings.provider,
        messages: [...messages, { role: "assistant", content: result.content }]
      });
    }

    // Save to history
    const presetLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets[message.analysisType]?.label || message.analysisType;
    await saveToHistory({
      pageTitle: page.title,
      pageUrl: page.url,
      provider: settings.provider,
      model: result.model,
      preset: message.analysisType,
      presetLabel,
      content: result.content,
      thinking: result.thinking,
      usage: result.usage,
      isSelection: !!message.selectedText
    });

    const detectedSource = SourcePipelines.detectSourceType(page.url, page);
    const doneMsg = {
      type: "done",
      model: result.model,
      usage: result.usage,
      provider: settings.provider,
      thinking: result.thinking,
      content: result.content,
      pageTitle: page.title
    };
    if (detectedSource) {
      doneMsg.sourceType = { id: detectedSource.id, label: detectedSource.label, icon: detectedSource.icon };
    }
    port.postMessage(doneMsg);

    // Run specialized pipeline in background (non-blocking enrichment)
    if (detectedSource && !message.selectedText) {
      try {
        const pipelineResult = await SourcePipelines.runPipeline(detectedSource, page, settings);
        try { port.postMessage({ type: "pipelineData", data: pipelineResult }); } catch(e) {}
      } catch (e) { console.warn("[Pipeline] Enrichment failed:", e); }
    }
  } catch (err) {
    try { port.postMessage({ type: "error", error: err.message || "An unexpected error occurred." }); } catch(e) {}
  }
}

async function handleFollowUpStream(port, message) {
  try {
    const tabId = message.tabId;
    const history = conversationHistory.get(tabId);
    if (!history) throw new Error("No conversation history found. Run an analysis first.");

    const settings = await getProviderSettings(history.provider);

    // Append the follow-up question
    history.messages.push({ role: "user", content: message.question });

    port.postMessage({ type: "start", provider: settings.provider, model: settings.model });

    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, history.messages,
      { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking },
      (chunk) => { try { port.postMessage({ type: "chunk", text: chunk }); } catch(e) {} },
      (thinking) => { try { port.postMessage({ type: "thinking", text: thinking }); } catch(e) {} }
    );

    // Update conversation history
    history.messages.push({ role: "assistant", content: result.content });
    conversationHistory.set(tabId, history);

    port.postMessage({
      type: "done",
      model: result.model,
      usage: result.usage,
      provider: settings.provider,
      thinking: result.thinking,
      content: result.content
    });
  } catch (err) {
    try { port.postMessage({ type: "error", error: err.message }); } catch(e) {}
  }
}

async function handleCompareStream(port, message) {
  try {
    const page = await extractPageContent();
    const providers = message.providers || [];

    for (const providerKey of providers) {
      try {
        const settings = await getProviderSettings(providerKey);
        const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
        const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, message.analysisType, message.customPrompt, settings);
        const msgs = buildMessages(systemPrompt, userPrompt);

        port.postMessage({ type: "compareStart", provider: providerKey, model: settings.model });

        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, msgs,
          opts,
          (chunk) => { try { port.postMessage({ type: "compareChunk", provider: providerKey, text: chunk }); } catch(e) {} },
          (thinking) => { try { port.postMessage({ type: "compareThinking", provider: providerKey, text: thinking }); } catch(e) {} }
        );

        port.postMessage({
          type: "compareDone",
          provider: providerKey,
          model: result.model,
          usage: result.usage,
          content: result.content,
          thinking: result.thinking,
          pageTitle: page.title
        });
      } catch (err) {
        port.postMessage({ type: "compareError", provider: providerKey, error: err.message });
      }
    }

    port.postMessage({ type: "compareAllDone", pageTitle: page.title });
  } catch (err) {
    try { port.postMessage({ type: "error", error: err.message }); } catch(e) {}
  }
}

// ──────────────────────────────────────────────
// Message handler (non-streaming fallback + utility messages)
// ──────────────────────────────────────────────
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "analyze") return handleAnalyze(message);
  if (message.action === "getPresets") return handleGetPresets();
  if (message.action === "getProviders") return handleGetProviders();
  if (message.action === "getHistory") return handleGetHistory(message);
  if (message.action === "deleteHistoryItem") return handleDeleteHistoryItem(message);
  if (message.action === "clearHistory") return handleClearHistory();
  if (message.action === "searchHistory") return handleSearchHistory(message);
  if (message.action === "getHistoryForUrl") return handleGetHistoryForUrl(message);
  if (message.action === "getArchiveCheck") {
    const cached = archiveCheckCache.get(message.tabId);
    return Promise.resolve({ success: true, archiveUrl: cached?.archiveUrl || null, checked: !!cached });
  }
  if (message.action === "checkArchiveNow") {
    return (async () => {
      try {
        const checkUrl = `https://archive.is/newest/${message.url}`;
        const resp = await fetch(checkUrl, { method: "HEAD", redirect: "follow" });
        if (resp.ok && resp.url && resp.url !== checkUrl && !resp.url.includes("/newest/")) {
          return { success: true, archiveUrl: resp.url };
        }
        return { success: true, archiveUrl: null };
      } catch (err) { return { success: false, error: err.message }; }
    })();
  }
  if (message.action === "checkWaybackNow") {
    return (async () => {
      try {
        const snapshot = await checkWaybackAvailability(message.url);
        return { success: true, waybackUrl: snapshot ? snapshot.url : null };
      } catch (err) { return { success: false, error: err.message }; }
    })();
  }
  if (message.action === "getSelection") return handleGetSelection(message);
  if (message.action === "getOpenTabs") return handleGetOpenTabs();
  if (message.action === "getConversationState") return handleGetConversationState(message);
  if (message.action === "analyzeInTab") return handleAnalyzeInTab(message);
  if (message.action === "followUp") return handleFollowUp(message);
  if (message.action === "startConversation") return handleStartConversation(message);
  if (message.action === "reAnalyze") return handleReAnalyze(message);
  if (message.action === "bookmarkPage") return handleBookmarkPage(message);
  if (message.action === "getBookmarks") return handleGetBookmarks(message);
  if (message.action === "updateBookmark") return handleUpdateBookmark(message);
  if (message.action === "deleteBookmark") return handleDeleteBookmark(message);
  if (message.action === "exportBookmarks") return handleExportBookmarks();
  if (message.action === "addMonitor") return handleAddMonitor(message);
  if (message.action === "getMonitors") return handleGetMonitors();
  if (message.action === "updateMonitor") return handleUpdateMonitor(message);
  if (message.action === "deleteMonitor") return handleDeleteMonitor(message);
  if (message.action === "getMonitorHistory") return handleGetMonitorHistory(message);
  if (message.action === "getAllMonitorChanges") return handleGetAllMonitorChanges();
  if (message.action === "clearMonitorUnread") return clearMonitorUnread(message.monitorId).then(() => ({ success: true }));
  if (message.action === "getMonitorUnreads") return browser.storage.local.get({ monitorUnreads: {} }).then(r => ({ success: true, unreads: r.monitorUnreads }));
  if (message.action === "getMonitorSnapshots") return handleGetMonitorSnapshots(message);
  if (message.action === "getMonitorStorageUsage") return handleGetMonitorStorageUsage();
  if (message.action === "getArchiveSettings") return browser.storage.local.get({ archiveRedirect: { enabled: false, domains: DEFAULT_ARCHIVE_DOMAINS, providerUrl: "https://archive.is/" } }).then(r => ({ success: true, ...r.archiveRedirect }));
  if (message.action === "saveArchiveSettings") return browser.storage.local.set({ archiveRedirect: { enabled: message.enabled, domains: message.domains, providerUrl: message.providerUrl || "https://archive.is/" } }).then(() => ({ success: true }));
  // RSS Feeds
  if (message.action === "addFeed") return handleAddFeed(message);
  if (message.action === "getFeeds") return handleGetFeeds();
  if (message.action === "getFeedEntries") return handleGetFeedEntries(message);
  if (message.action === "deleteFeed") return handleDeleteFeed(message);
  if (message.action === "deleteAllFeeds") return handleDeleteAllFeeds();
  if (message.action === "updateFeed") return handleUpdateFeed(message);
  if (message.action === "markFeedEntryRead") return handleMarkFeedEntryRead(message);
  if (message.action === "markAllFeedRead") return handleMarkAllFeedRead(message);
  if (message.action === "refreshFeed") return handleRefreshFeed(message);
  if (message.action === "summarizeFeedEntry") return handleSummarizeFeedEntry(message);
  if (message.action === "discoverFeed") return handleDiscoverFeed(message);
  if (message.action === "analyzeBookmarks") return handleAnalyzeBookmarks(message);
  // Projects
  if (message.action === "getProjects") return handleGetProjects(message);
  if (message.action === "createProject") return handleCreateProject(message);
  if (message.action === "updateProject") return handleUpdateProject(message);
  if (message.action === "deleteProject") return handleDeleteProject(message);
  if (message.action === "addProjectItem") return handleAddProjectItem(message);
  if (message.action === "updateProjectItem") return handleUpdateProjectItem(message);
  if (message.action === "removeProjectItem") return handleRemoveProjectItem(message);
  if (message.action === "exportProject") return handleExportProject(message);
  if (message.action === "exportAllProjects") return handleExportAllProjects();
  if (message.action === "importProject") return handleImportProject(message);
  if (message.action === "batchAnalyzeProjectItem") return handleBatchAnalyzeProjectItem(message);
  if (message.action === "batchAnalyzeProject") return handleBatchAnalyzeProject(message);
  if (message.action === "getBatchStatus") return handleGetBatchStatus();
  if (message.action === "cancelBatch") return handleCancelBatch();
  // Knowledge Graph
  if (message.action === "getKGGraph") return KnowledgeGraph.getGraphData(message);
  if (message.action === "getKGStats") return KnowledgeGraph.getStats();
  if (message.action === "searchKGNodes") return ArgusDB.KGNodes.search(message.query);
  if (message.action === "deleteKGNode") return ArgusDB.KGNodes.remove(message.id).then(() => ({ success: true }));
  if (message.action === "deleteKGEdge") return ArgusDB.KGEdges.remove(message.id).then(() => ({ success: true }));
  if (message.action === "mergeKGNodes") return KnowledgeGraph.mergeNodes(message.keepId, message.removeId).then(n => ({ success: true, node: n }));
  if (message.action === "getKGPendingMerges") return KnowledgeGraph.getPendingMerges();
  if (message.action === "resolveKGMerge") return KnowledgeGraph.resolvePendingMerge(message.mergeId, message.accept);
  if (message.action === "runKGInference") return KnowledgeGraph.runInferenceRules();
  if (message.action === "pruneKGNoise") return KnowledgeGraph.pruneNoiseEntities().then(r => ({ success: true, ...r }));
  if (message.action === "clearKG") return ArgusDB.KGNodes.clear().then(() => ArgusDB.KGEdges.clear()).then(() => ({ success: true }));
  // Agentic Automation
  if (message.action === "getDashboardData") return AgentEngine.getDashboardData(message.projectId);
  if (message.action === "generateDigest") return AgentEngine.generateProjectDigest(message.projectId);
  if (message.action === "generateReportSection") return AgentEngine.generateReportSection(message.projectId, message.sectionType);
  if (message.action === "detectTrends") return AgentEngine.detectTrends(message.projectId);
  if (message.action === "getDigests") return AgentEngine.getDigests(message.projectId).then(d => ({ success: true, digests: d }));
  if (message.action === "setDigestSchedule") return AgentEngine.setDigestSchedule(message.projectId, message.schedule);
  if (message.action === "getDigestSchedule") return AgentEngine.getDigestSchedule(message.projectId).then(s => ({ success: true, schedule: s }));
  // OSINT tools are handled by background-osint.js's own message listener
  return false;
});

async function handleGetPresets() {
  const { customPresets } = await browser.storage.local.get({ customPresets: {} });
  const presets = [];

  // Default presets (check if they have a provider override in customPresets)
  for (const [key, val] of Object.entries(ANALYSIS_PRESETS)) {
    presets.push({ key, label: val.label, isCustom: false, provider: customPresets[key]?.provider || "" });
  }

  // User-created custom presets
  for (const [key, val] of Object.entries(customPresets)) {
    if (val.isCustom) {
      presets.push({ key, label: val.label || key, isCustom: true, provider: val.provider || "" });
    }
  }

  return { success: true, presets };
}

function handleGetProviders() {
  return Promise.resolve({
    success: true,
    providers: Object.entries(PROVIDERS).map(([key, val]) => ({
      key, label: val.label, models: val.models, defaultModel: val.defaultModel
    }))
  });
}

async function handleGetHistory(message) {
  const all = await ArgusDB.History.getAllSorted();
  const page = message.page || 0;
  const perPage = message.perPage || 50;
  const start = page * perPage;
  return {
    success: true,
    history: all.slice(start, start + perPage),
    total: all.length
  };
}

async function handleDeleteHistoryItem(message) {
  await ArgusDB.History.remove(message.id);
  return { success: true };
}

async function handleClearHistory() {
  await ArgusDB.History.clear();
  return { success: true };
}

async function handleSearchHistory(message) {
  const filtered = await ArgusDB.History.search(message.query || "");
  return { success: true, history: filtered.slice(0, 100), total: filtered.length };
}

async function handleGetHistoryForUrl(message) {
  const all = await ArgusDB.History.getAllSorted();
  const matches = all.filter(h => h.pageUrl === message.url);
  return { success: true, history: matches.slice(0, 10), total: matches.length };
}

async function handleGetSelection(message) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs.length) return { success: false, selection: "" };
  const selection = await extractSelection(tabs[0].id);
  return { success: true, selection, tabId: tabs[0].id, pageTitle: tabs[0].title, pageUrl: tabs[0].url };
}

async function handleGetOpenTabs() {
  const tabs = await browser.tabs.query({ currentWindow: true });
  const filtered = tabs.filter(t =>
    t.url && !t.url.startsWith("about:") && !t.url.startsWith("moz-extension:") && !t.url.startsWith("chrome:")
  );
  return {
    success: true,
    tabs: filtered.map(t => ({ id: t.id, title: t.title, url: t.url, favIconUrl: t.favIconUrl }))
  };
}

async function handleGetConversationState(message) {
  const tabId = message.tabId;
  const has = conversationHistory.has(tabId);
  return { success: true, hasConversation: has, messageCount: has ? conversationHistory.get(tabId).messages.length : 0 };
}

async function handleAnalyze(message) {
  try {
    const settings = await getProviderSettings(message.provider, message.analysisType);
    const page = await extractPageContent();
    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, message.analysisType, message.customPrompt, settings);
    const messages = buildMessages(systemPrompt, userPrompt);

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      opts
    );

    // Save to history
    const presetLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets[message.analysisType]?.label || message.analysisType;
    await saveToHistory({
      pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
      model: result.model, preset: message.analysisType, presetLabel,
      content: result.content, thinking: result.thinking, usage: result.usage
    });

    return {
      success: true, content: result.content, thinking: result.thinking,
      model: result.model, usage: result.usage, provider: settings.provider, pageTitle: page.title
    };
  } catch (err) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

// ──────────────────────────────────────────────
// Analyze in tab (popup launcher)
// ──────────────────────────────────────────────
async function handleAnalyzeInTab(message) {
  try {
    // Compare mode: open one tab per provider
    if (message.providers && message.providers.length >= 2) {
      return await handleCompareInTab(message);
    }

    const settings = await getProviderSettings(message.provider, message.analysisType);
    let page;

    if (message.selectedText) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      page = {
        title: tab?.title || "Selected Text",
        url: tab?.url || "",
        description: "",
        text: message.selectedText
      };
    } else if (message.tabIds && message.tabIds.length > 1) {
      const pages = [];
      for (const tabId of message.tabIds) {
        try {
          const p = await extractPageContent(tabId);
          pages.push(p);
        } catch (e) {
          pages.push({ title: `Tab ${tabId}`, url: "", text: `[Error: ${e.message}]`, description: "" });
        }
      }
      const isResearch = message.analysisType === "research";
      const label = isResearch ? "Source" : "Page";
      const combined = pages.map((p, i) =>
        `\n\n--- ${label} ${i + 1}: ${p.title} (${p.url}) ---\n\n${truncateText(p.text, Math.floor(settings.maxInputChars / pages.length))}`
      ).join("");
      page = {
        title: isResearch ? `Research: ${pages.length} sources` : `${pages.length} pages analyzed`,
        url: pages[0]?.url || "",
        description: "",
        text: combined,
        _sources: pages.map((p, i) => ({ index: i + 1, title: p.title, url: p.url })),
        _isResearch: isResearch
      };
    } else {
      page = await extractPageContent(message.tabId);
    }

    const presetLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets?.[message.analysisType]?.label || message.analysisType;
    const resultId = `tl-result-${Date.now()}`;

    await browser.storage.local.set({
      [resultId]: {
        status: "loading",
        presetLabel,
        pageTitle: page.title,
        pageUrl: page.url
      }
    });

    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await browser.tabs.create({ url: resultsUrl });

    // Fire-and-forget streaming
    streamAnalysisToStorage(resultId, page, message, settings, presetLabel);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleCompareInTab(message) {
  // Extract page content once, reuse for all providers
  let page;
  if (message.selectedText) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    page = { title: tab?.title || "Selected Text", url: tab?.url || "", description: "", text: message.selectedText };
  } else {
    page = await extractPageContent(message.tabId);
  }

  const totalProviders = message.providers.length;
  for (let pi = 0; pi < totalProviders; pi++) {
    const providerKey = message.providers[pi];
    const settings = await getProviderSettings(providerKey);
    const baseLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets?.[message.analysisType]?.label || message.analysisType;
    const provLabel = PROVIDERS[providerKey]?.label || providerKey;
    const presetLabel = `Compare ${pi + 1}: ${baseLabel} (${provLabel})`;
    const resultId = `tl-result-${Date.now()}-${providerKey}`;

    await browser.storage.local.set({
      [resultId]: { status: "loading", presetLabel, pageTitle: page.title, pageUrl: page.url }
    });

    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await browser.tabs.create({ url: resultsUrl });

    // All providers stream in parallel (fire-and-forget)
    streamAnalysisToStorage(resultId, page, { ...message, provider: providerKey }, settings, presetLabel);
  }

  return { success: true };
}

async function streamAnalysisToStorage(resultId, page, message, settings, presetLabel) {
  try {
    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, message.analysisType, message.customPrompt, settings);
    const messages = buildMessages(systemPrompt, userPrompt);

    let streamedContent = "";
    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, messages,
      opts,
      async (chunk) => {
        streamedContent += chunk;
        await browser.storage.local.set({
          [resultId]: {
            status: "streaming", content: streamedContent,
            model: settings.model, provider: settings.provider,
            presetLabel, pageTitle: page.title, pageUrl: page.url
          }
        });
      },
      null
    );

    // Store conversation history keyed by resultId for follow-ups
    conversationHistory.set(resultId, {
      provider: settings.provider,
      messages: [...messages, { role: "assistant", content: result.content }]
    });

    const resultData = {
      status: "done", content: result.content, thinking: result.thinking,
      model: result.model, usage: result.usage, provider: settings.provider,
      presetLabel, pageTitle: page.title, pageUrl: page.url, resultId
    };
    if (page._isResearch && page._sources) {
      resultData.isResearch = true;
      resultData.sources = page._sources;
    }
    // Detect source type and attach to result
    const detectedSource = SourcePipelines.detectSourceType(page.url, page);
    if (detectedSource) {
      resultData.sourceType = { id: detectedSource.id, label: detectedSource.label, icon: detectedSource.icon };
    }

    await browser.storage.local.set({ [resultId]: resultData });

    await saveToHistory({
      pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
      model: result.model, preset: message.analysisType, presetLabel,
      content: result.content, thinking: result.thinking, usage: result.usage,
      isSelection: !!message.selectedText
    });

    // Run specialized pipeline in background (non-blocking enrichment)
    if (detectedSource && !message.selectedText) {
      try {
        const pipelineResult = await SourcePipelines.runPipeline(detectedSource, page, settings);
        // Store under separate key so results page can pick it up even after consuming main result
        const pipelineKey = `${resultId}-pipeline`;
        await browser.storage.local.set({ [pipelineKey]: pipelineResult });
      } catch (e) { console.warn("[Pipeline] Enrichment failed:", e); }
    }
  } catch (err) {
    await browser.storage.local.set({
      [resultId]: {
        status: "error", error: err.message || "An unexpected error occurred.",
        presetLabel, pageTitle: page.title, pageUrl: page.url
      }
    });
  }
}

async function handleFollowUp(message) {
  try {
    const { resultId, question, provider: providerOverride } = message;
    const history = conversationHistory.get(resultId);
    if (!history) throw new Error("No conversation history found. The analysis session may have expired.");

    const effectiveProvider = providerOverride || history.provider;
    const settings = await getProviderSettings(effectiveProvider);
    history.messages.push({ role: "user", content: question });

    const followupResultId = `${resultId}-followup-${Date.now()}`;

    await browser.storage.local.set({
      [followupResultId]: { status: "loading" }
    });

    // Stream follow-up in background
    (async () => {
      try {
        let streamedContent = "";
        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, history.messages,
          { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking },
          async (chunk) => {
            streamedContent += chunk;
            await browser.storage.local.set({
              [followupResultId]: { status: "streaming", content: streamedContent }
            });
          },
          null
        );

        history.messages.push({ role: "assistant", content: result.content });
        conversationHistory.set(resultId, history);

        await browser.storage.local.set({
          [followupResultId]: {
            status: "done", content: result.content, thinking: result.thinking,
            model: result.model, usage: result.usage, provider: settings.provider
          }
        });
      } catch (err) {
        await browser.storage.local.set({
          [followupResultId]: { status: "error", error: err.message }
        });
      }
    })();

    return { success: true, followupResultId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Start conversation (seed context for chat on any result page)
// ──────────────────────────────────────────────
async function handleStartConversation(message) {
  try {
    const { contextType, contextData, pageUrl, pageTitle, question, provider: providerOverride } = message;
    const settings = await getProviderSettings(providerOverride || null);

    const conversationId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const langInst = await getLanguageInstruction();

    const systemPrompt = `You are Argus, an intelligent analysis assistant. The user is viewing ${contextType} results${pageTitle ? ` for "${pageTitle}"` : ""}${pageUrl ? ` (${pageUrl})` : ""}. Answer questions about the data below. Be concise and insightful.${langInst}

--- ${contextType} Data ---
${contextData}
--- End Data ---`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ];

    const followupResultId = `${conversationId}-followup-${Date.now()}`;
    await browser.storage.local.set({ [followupResultId]: { status: "loading" } });

    // Store conversation history for subsequent follow-ups
    conversationHistory.set(conversationId, { provider: settings.provider, messages: [...messages] });

    // Stream in background
    (async () => {
      try {
        let streamedContent = "";
        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, messages,
          { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking },
          async (chunk) => {
            streamedContent += chunk;
            await browser.storage.local.set({ [followupResultId]: { status: "streaming", content: streamedContent } });
          },
          null
        );

        const history = conversationHistory.get(conversationId);
        if (history) {
          history.messages.push({ role: "assistant", content: result.content });
          conversationHistory.set(conversationId, history);
        }

        await browser.storage.local.set({
          [followupResultId]: {
            status: "done", content: result.content, thinking: result.thinking,
            model: result.model, usage: result.usage, provider: settings.provider
          }
        });
      } catch (err) {
        await browser.storage.local.set({ [followupResultId]: { status: "error", error: err.message } });
      }
    })();

    return { success: true, conversationId, followupResultId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Re-analyze (same page, different preset, same tab)
// ──────────────────────────────────────────────
async function handleReAnalyze(message) {
  try {
    const { pageUrl, analysisType, provider: providerOverride, customPrompt } = message;
    if (!pageUrl) return { success: false, error: "No page URL available for re-analysis." };

    const settings = await getProviderSettings(providerOverride, analysisType);

    // Try to find the original tab by URL and extract content from it
    let page;
    try {
      const tabs = await browser.tabs.query({ url: pageUrl });
      if (tabs.length > 0) {
        page = await extractPageContent(tabs[0].id);
      }
    } catch { /* tab not found or can't inject */ }

    // Fallback: fetch page content by URL
    if (!page || !page.text) {
      const text = await fetchPageText(pageUrl);
      page = { title: message.pageTitle || pageUrl, url: pageUrl, description: "", text };
    }

    const presetLabel = ANALYSIS_PRESETS[analysisType]?.label ||
      settings.customPresets?.[analysisType]?.label || analysisType;
    const reResultId = `reanalyze-${Date.now()}`;

    await browser.storage.local.set({
      [reResultId]: { status: "loading" }
    });

    // Stream in background
    (async () => {
      try {
        const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
        const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, analysisType, customPrompt, settings);
        const messages = buildMessages(systemPrompt, userPrompt);

        let streamedContent = "";
        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, messages, opts,
          async (chunk) => {
            streamedContent += chunk;
            await browser.storage.local.set({
              [reResultId]: { status: "streaming", content: streamedContent, provider: settings.provider, model: settings.model, presetLabel }
            });
          },
          null
        );

        await saveToHistory({
          pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
          model: result.model, preset: analysisType, presetLabel,
          content: result.content, thinking: result.thinking, usage: result.usage
        });

        await browser.storage.local.set({
          [reResultId]: {
            status: "done", content: result.content, thinking: result.thinking,
            model: result.model, usage: result.usage, provider: settings.provider, presetLabel
          }
        });
      } catch (err) {
        await browser.storage.local.set({
          [reResultId]: { status: "error", error: err.message }
        });
      }
    })();

    return { success: true, reResultId, presetLabel };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Context menu click handler
// ──────────────────────────────────────────────
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  // Open Argus Console
  if (info.menuItemId === "argus-console") {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html") });
    return;
  }

  // Open Help tab
  if (info.menuItemId === "argus-help") {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html#help") });
    return;
  }

  // Open OSINT Dashboard
  if (info.menuItemId === "argus-osint-dashboard") {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html#osint") });
    return;
  }

  // Open Global Knowledge Graph
  if (info.menuItemId === "argus-osint-global-graph") {
    browser.tabs.create({ url: browser.runtime.getURL("osint/graph.html?mode=global") });
    return;
  }

  // Open Feed Reader
  if (info.menuItemId === "argus-open-reader") {
    browser.tabs.create({ url: browser.runtime.getURL("feeds/feeds.html") });
    return;
  }

  // Handle bookmark context menu
  if (info.menuItemId === "argus-bookmark") {
    try {
      const page = await extractFrameContent(tab.id, info.frameId);
      const settings = await getProviderSettings().catch(() => null);
      if (settings) {
        const tagData = await aiTagBookmark(page, settings);
        tagData.aiTagged = true;
        await saveBookmark(page, tagData);
      } else {
        await saveBookmark(page, { tags: [], category: "other", summary: page.description || "" });
      }
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Bookmarked: ${page.title}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to bookmark: ${err.message}`
      });
    }
    return;
  }

  // Handle add to project context menu
  if (info.menuItemId.startsWith("argus-project-")) {
    const projectId = info.menuItemId.replace("argus-project-", "");
    try {
      await handleAddProjectItem({
        projectId,
        item: {
          type: "url",
          url: tab.url,
          title: tab.title || tab.url,
          summary: "",
          tags: []
        }
      });
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Added to project: ${tab.title || tab.url}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to add to project: ${err.message}`
      });
    }
    return;
  }

  // Handle monitor context menu
  if (info.menuItemId === "argus-monitor") {
    try {
      const result = await handleAddMonitor({
        url: tab.url,
        title: tab.title || tab.url,
        intervalMinutes: 60,
        aiAnalysis: true,
        autoBookmark: true,
        autoOpen: false,
        analysisPreset: "",
        duration: 0
      });
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: result.success
          ? `Now monitoring: ${tab.title || tab.url}`
          : `Monitor: ${result.error}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to add monitor: ${err.message}`
      });
    }
    return;
  }

  // Handle redirect/archive context menu
  if (info.menuItemId === "argus-redirect") {
    try {
      const providerUrl = archiveProviderUrl || "https://archive.is/";
      await browser.tabs.update(tab.id, { url: providerUrl + tab.url });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to redirect: ${err.message}`
      });
    }
    return;
  }

  // Handle save to archive context menu
  if (info.menuItemId === "argus-save-archive") {
    try {
      const submitUrl = "https://archive.is/?run=1&url=" + encodeURIComponent(tab.url);
      await browser.tabs.create({ url: submitUrl });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to save to archive: ${err.message}`
      });
    }
    return;
  }

  // Handle add site to trouble list
  if (info.menuItemId === "argus-add-trouble-list") {
    try {
      const host = new URL(tab.url).hostname.replace(/^www\./, "");
      const { archiveRedirect } = await browser.storage.local.get({
        archiveRedirect: { enabled: false, domains: DEFAULT_ARCHIVE_DOMAINS, providerUrl: "https://archive.is/" }
      });
      const domains = archiveRedirect.domains || [];
      if (!domains.includes(host)) {
        domains.push(host);
        archiveRedirect.domains = domains;
        await browser.storage.local.set({ archiveRedirect });
      }
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Added ${host} to Trouble List`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to add to Trouble List: ${err.message}`
      });
    }
    return;
  }

  // Handle tech stack detection
  if (info.menuItemId === "argus-techstack") {
    try {
      const resp = await handleDetectTechStack({ tabId: tab.id });
      if (resp && resp.success) {
        const storeKey = `techstack-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { pageUrl: tab.url, pageTitle: tab.title, technologies: resp.technologies } });
        await browser.tabs.create({ url: browser.runtime.getURL(`osint/techstack.html?id=${encodeURIComponent(storeKey)}`) });
      } else {
        safeNotify(null, {
          type: "basic", iconUrl: "icons/icon-96.png",
          title: "Argus — Error",
          message: resp?.error || "Tech stack detection failed"
        });
      }
    } catch (err) {
      safeNotify(null, {
        type: "basic", iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Tech stack detection failed: ${err.message}`
      });
    }
    return;
  }

  // Handle site version checks
  if (info.menuItemId === "argus-check-archive") {
    try {
      const checkUrl = `https://archive.is/newest/${tab.url}`;
      const resp = await fetch(checkUrl, { method: "HEAD", redirect: "follow" });
      if (resp.ok && resp.url && resp.url !== checkUrl && !resp.url.includes("/newest/")) {
        await browser.tabs.create({ url: resp.url });
      } else {
        safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus", message: "No archived version found on archive.is" });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus — Error", message: `Archive check failed: ${err.message}` });
    }
    return;
  }

  if (info.menuItemId === "argus-check-wayback") {
    try {
      const snapshot = await checkWaybackAvailability(tab.url);
      if (snapshot && snapshot.url) {
        await browser.tabs.create({ url: snapshot.url });
      } else {
        safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus", message: "No Wayback Machine snapshot found" });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus — Error", message: `Wayback check failed: ${err.message}` });
    }
    return;
  }

  // Handle subscribe to feed context menu
  if (info.menuItemId === "argus-add-feed") {
    try {
      // Try to detect a feed URL from the page's <link> tags
      const feedResults = await browser.tabs.executeScript(tab.id, {
        code: `
          (function() {
            const link = document.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"], link[type="application/feed+json"]');
            return link ? link.href : null;
          })();
        `
      });
      const detectedFeed = feedResults && feedResults[0];

      // Also try background-side discovery if no <link> found
      let feedUrl = detectedFeed || await discoverFeedUrl(tab.url);

      if (!feedUrl) {
        safeNotify(null, {
          type: "basic",
          iconUrl: "icons/icon-96.png",
          title: "Argus",
          message: "No RSS or Atom feed found on this page."
        });
        return;
      }

      const result = await handleAddFeed({
        url: feedUrl,
        title: tab.title || feedUrl,
        intervalMinutes: 60,
        aiSummarize: false,
        monitorBridge: false
      });
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: result.success
          ? `Subscribed to feed: ${result.feed?.title || tab.title || feedUrl}`
          : `Feed: ${result.error}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to subscribe: ${err.message}`
      });
    }
    return;
  }

  // ── OSINT Tool handlers ──
  if (info.menuItemId === "argus-extract-metadata") {
    try {
      const result = await handleExtractMetadata({ tabId: tab.id });
      if (result.success) {
        const storeKey = `metadata-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { ...result.metadata, pageUrl: tab.url, pageTitle: tab.title } });
        browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?metadata=${encodeURIComponent(storeKey)}`) });
      } else {
        safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus", message: result.error || "Failed to extract metadata." });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus - Error", message: err.message });
    }
    return;
  }

  if (info.menuItemId === "argus-map-links") {
    try {
      const result = await handleExtractLinks({ tabId: tab.id });
      if (result.success) {
        const storeKey = `linkmap-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { pageUrl: tab.url, pageTitle: tab.title, links: result.links, stats: result.stats } });
        browser.tabs.create({ url: browser.runtime.getURL(`osint/link-map.html?id=${encodeURIComponent(storeKey)}`) });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus - Error", message: err.message });
    }
    return;
  }

  if (info.menuItemId === "argus-whois") {
    try {
      const domain = new URL(tab.url).hostname;
      const result = await handleWhoisLookup({ domain });
      if (result.success) {
        const storeKey = `whois-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { ...result, pageUrl: tab.url, pageTitle: tab.title } });
        browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?whois=${encodeURIComponent(storeKey)}`) });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus - Error", message: err.message });
    }
    return;
  }

  if (!info.menuItemId.startsWith("argus-analyze-")) return;

  const presetKey = info.menuItemId.replace("argus-analyze-", "");
  const settings = await getProviderSettings().catch(() => null);
  if (!settings) return;

  const preset = ANALYSIS_PRESETS[presetKey] || settings.customPresets[presetKey];
  if (!preset) return;

  const resultId = `tl-result-${Date.now()}`;

  await browser.storage.local.set({
    [resultId]: {
      status: "loading",
      presetLabel: preset.label || presetKey,
      pageTitle: tab.title || "Untitled Page",
      pageUrl: tab.url || ""
    }
  });

  const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
  await browser.tabs.create({ url: resultsUrl });

  try {
    let page;
    if (info.selectionText) {
      // Use selected text
      page = {
        title: tab.title || "Selected Text",
        url: tab.url || "",
        description: "",
        text: info.selectionText
      };
    } else {
      page = await extractFrameContent(tab.id, info.frameId);
    }

    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, presetKey, null, settings);
    const messages = buildMessages(systemPrompt, userPrompt);

    // Stream to storage for results page
    let streamedContent = "";
    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, messages,
      opts,
      async (chunk) => {
        streamedContent += chunk;
        await browser.storage.local.set({
          [resultId]: {
            status: "streaming",
            content: streamedContent,
            model: settings.model,
            provider: settings.provider,
            presetLabel: preset.label || presetKey,
            pageTitle: page.title,
            pageUrl: page.url
          }
        });
      },
      null
    );

    // Store conversation history keyed by resultId for follow-ups
    conversationHistory.set(resultId, {
      provider: settings.provider,
      messages: [...messages, { role: "assistant", content: result.content }]
    });

    await browser.storage.local.set({
      [resultId]: {
        status: "done",
        content: result.content,
        thinking: result.thinking,
        model: result.model,
        usage: result.usage,
        provider: settings.provider,
        presetLabel: preset.label || presetKey,
        pageTitle: page.title,
        pageUrl: page.url,
        resultId
      }
    });

    // Save to history
    await saveToHistory({
      pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
      model: result.model, preset: presetKey, presetLabel: preset.label || presetKey,
      content: result.content, thinking: result.thinking, usage: result.usage,
      isSelection: !!info.selectionText
    });
  } catch (err) {
    await browser.storage.local.set({
      [resultId]: {
        status: "error",
        error: err.message || "An unexpected error occurred.",
        presetLabel: preset.label || presetKey,
        pageTitle: tab.title || "Untitled Page",
        pageUrl: tab.url || ""
      }
    });
  }
});

// ──────────────────────────────────────────────
// Keyboard shortcuts handler
// ──────────────────────────────────────────────
browser.commands.onCommand.addListener(async (command) => {
  if (command === "quick-summary") {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length) return;
    const tab = tabs[0];

    const resultId = `tl-result-${Date.now()}`;
    await browser.storage.local.set({
      [resultId]: { status: "loading", presetLabel: "Summary", pageTitle: tab.title, pageUrl: tab.url }
    });
    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await browser.tabs.create({ url: resultsUrl });

    try {
      const settings = await getProviderSettings();
      const page = await extractPageContent(tab.id);
      const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
      const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, "summary", null, settings);
      const messages = buildMessages(systemPrompt, userPrompt);

      let streamedContent = "";
      const result = await callProviderStream(
        settings.provider, settings.apiKey, settings.model, messages,
        opts,
        async (chunk) => {
          streamedContent += chunk;
          await browser.storage.local.set({
            [resultId]: { status: "streaming", content: streamedContent, model: settings.model, provider: settings.provider, presetLabel: "Summary", pageTitle: page.title, pageUrl: page.url }
          });
        }
      );

      await browser.storage.local.set({
        [resultId]: { status: "done", content: result.content, model: result.model, usage: result.usage, provider: settings.provider, presetLabel: "Summary", pageTitle: page.title, pageUrl: page.url }
      });

      await saveToHistory({
        pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
        model: result.model, preset: "summary", presetLabel: "Summary",
        content: result.content, usage: result.usage
      });
    } catch (err) {
      await browser.storage.local.set({
        [resultId]: { status: "error", error: err.message, presetLabel: "Summary", pageTitle: tab.title, pageUrl: tab.url }
      });
    }
  }

  if (command === "quick-selection") {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length) return;
    const tab = tabs[0];
    const selection = await extractSelection(tab.id);
    if (!selection || selection.trim().length < 5) return;

    const resultId = `tl-result-${Date.now()}`;
    await browser.storage.local.set({
      [resultId]: { status: "loading", presetLabel: "Selection Analysis", pageTitle: tab.title, pageUrl: tab.url }
    });
    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await browser.tabs.create({ url: resultsUrl });

    try {
      const settings = await getProviderSettings();
      const page = { title: tab.title, url: tab.url, description: "", text: selection };
      const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
      const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, "summary", null, settings);
      const messages = buildMessages(systemPrompt, userPrompt);

      let streamedContent = "";
      const result = await callProviderStream(
        settings.provider, settings.apiKey, settings.model, messages,
        opts,
        async (chunk) => {
          streamedContent += chunk;
          await browser.storage.local.set({
            [resultId]: { status: "streaming", content: streamedContent, model: settings.model, provider: settings.provider, presetLabel: "Selection Analysis", pageTitle: page.title, pageUrl: page.url }
          });
        }
      );

      await browser.storage.local.set({
        [resultId]: { status: "done", content: result.content, model: result.model, usage: result.usage, provider: settings.provider, presetLabel: "Selection Analysis", pageTitle: page.title, pageUrl: page.url }
      });

      await saveToHistory({
        pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
        model: result.model, preset: "summary", presetLabel: "Selection Analysis",
        content: result.content, usage: result.usage, isSelection: true
      });
    } catch (err) {
      await browser.storage.local.set({
        [resultId]: { status: "error", error: err.message, presetLabel: "Selection Analysis", pageTitle: tab.title, pageUrl: tab.url }
      });
    }
  }
});

// ──────────────────────────────────────────────
// Auto-analyze rules
// ──────────────────────────────────────────────
function matchUrlPattern(url, pattern) {
  // Convert glob pattern to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  try {
    return new RegExp(`^${escaped}$`, "i").test(url);
  } catch {
    return false;
  }
}

// Auto-analyze requires optional webNavigation permission
initWebNavigation(async (details) => {
  // Only main frame
  if (details.frameId !== 0) return;

  const { autoAnalyzeRules } = await browser.storage.local.get({ autoAnalyzeRules: [] });
  if (!autoAnalyzeRules.length) return;

  const url = details.url;
  if (!url || url.startsWith("about:") || url.startsWith("moz-extension:")) return;

  // Check cooldown
  const cooldownKey = `${details.tabId}-${url}`;
  const lastRun = autoAnalyzeCooldown.get(cooldownKey);
  if (lastRun && Date.now() - lastRun < 60000) return; // 1 minute cooldown

  for (const rule of autoAnalyzeRules) {
    if (!rule.enabled) continue;
    if (!matchUrlPattern(url, rule.urlPattern)) continue;

    autoAnalyzeCooldown.set(cooldownKey, Date.now());

    // Delay before analyzing
    await new Promise(r => setTimeout(r, rule.delay || 2000));

    const tab = await browser.tabs.get(details.tabId);
    const resultId = `tl-result-${Date.now()}`;
    const presetKey = rule.preset || "summary";
    const preset = ANALYSIS_PRESETS[presetKey];

    await browser.storage.local.set({
      [resultId]: { status: "loading", presetLabel: preset?.label || presetKey, pageTitle: tab.title, pageUrl: tab.url }
    });
    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await browser.tabs.create({ url: resultsUrl });

    try {
      const settings = await getProviderSettings(rule.provider || null);
      const page = await extractPageContent(details.tabId);
      const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
      const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, presetKey, null, settings);
      const messages = buildMessages(systemPrompt, userPrompt);

      let streamedContent = "";
      const result = await callProviderStream(
        settings.provider, settings.apiKey, settings.model, messages,
        opts,
        async (chunk) => {
          streamedContent += chunk;
          await browser.storage.local.set({
            [resultId]: { status: "streaming", content: streamedContent, model: settings.model, provider: settings.provider, presetLabel: preset?.label || presetKey, pageTitle: page.title, pageUrl: page.url }
          });
        }
      );

      await browser.storage.local.set({
        [resultId]: { status: "done", content: result.content, model: result.model, usage: result.usage, provider: settings.provider, presetLabel: preset?.label || presetKey, pageTitle: page.title, pageUrl: page.url }
      });

      await saveToHistory({
        pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
        model: result.model, preset: presetKey, presetLabel: preset?.label || presetKey,
        content: result.content, usage: result.usage, autoAnalyzed: true
      });
    } catch (err) {
      await browser.storage.local.set({
        [resultId]: { status: "error", error: err.message, presetLabel: preset?.label || presetKey, pageTitle: tab.title, pageUrl: tab.url }
      });
    }

    break; // Only first matching rule
  }
});

// ──────────────────────────────────────────────
// Smart Bookmarking
// ──────────────────────────────────────────────
const BOOKMARK_TAG_PROMPT = {
  system: "You are a librarian and information organizer. Respond ONLY with valid JSON, no markdown fences.",
  prompt: `Analyze this webpage and generate smart metadata for bookmarking.

Return JSON with this exact structure:
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "one-word-category",
  "summary": "One sentence summary of the page content.",
  "readingTime": "X min"
}

Rules:
- tags: 3-7 lowercase tags that describe the content. Be specific (e.g., "react-hooks" not just "programming").
- category: A single broad category like "tech", "news", "finance", "science", "health", "politics", "tutorial", "reference", "entertainment", "shopping", "social", "other".
- summary: A concise one-sentence summary (max 150 chars).
- readingTime: Estimated reading time.`
};

async function saveBookmark(pageData, options = {}) {
  // Check for duplicate URL
  const existing = await ArgusDB.Bookmarks.getByUrl(pageData.url);

  const bookmark = {
    id: existing ? existing.id : `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: pageData.url,
    title: pageData.title,
    text: (pageData.text || "").slice(0, 50000), // Store page text for search, capped at 50k
    savedAt: existing ? existing.savedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: options.tags || [],
    category: options.category || "other",
    summary: options.summary || "",
    readingTime: options.readingTime || "",
    notes: options.notes || (existing ? existing.notes : ""),
    aiTagged: !!options.aiTagged
  };

  await ArgusDB.Bookmarks.add(bookmark);

  // Extract entities for knowledge graph (non-blocking)
  try {
    const kgText = (bookmark.summary || "") + "\n" + (bookmark.text || "").slice(0, 5000);
    if (kgText.trim()) KnowledgeGraph.extractAndUpsert(kgText, bookmark.url, bookmark.title, null);
  } catch (e) { console.warn("[KG] bookmark entity extraction failed:", e); }

  return bookmark;
}

async function aiTagBookmark(pageData, settings) {
  const textSnippet = (pageData.text || "").slice(0, 3000);
  const userPrompt = `Title: ${pageData.title}\nURL: ${pageData.url}\n\nContent:\n${textSnippet}`;

  const messages = buildMessages(BOOKMARK_TAG_PROMPT.system, BOOKMARK_TAG_PROMPT.prompt + "\n\n" + userPrompt);

  const result = await callProvider(
    settings.provider, settings.apiKey, settings.model, messages,
    { maxTokens: 500, temperature: 0.3 }
  );

  try {
    // Strip markdown fences if present
    let content = result.content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(content);
  } catch {
    return { tags: [], category: "other", summary: "", readingTime: "" };
  }
}

async function handleBookmarkPage(message) {
  try {
    const tabId = message.tabId;
    let page;
    if (message.pageData) {
      page = message.pageData;
    } else {
      page = await extractPageContent(tabId);
    }

    let tagData = { tags: [], category: "other", summary: "", readingTime: "" };

    // AI tagging if requested (default: true)
    if (message.aiTag !== false) {
      try {
        const settings = await getProviderSettings(message.provider);
        tagData = await aiTagBookmark(page, settings);
        tagData.aiTagged = true;
      } catch (e) {
        // AI tagging failed, save without tags
        tagData = { tags: [], category: "other", summary: page.description || "", readingTime: "" };
      }
    }

    const bookmark = await saveBookmark(page, tagData);
    return { success: true, bookmark };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleGetBookmarks(message) {
  const smartBookmarks = await ArgusDB.Bookmarks.getAll();

  let results = smartBookmarks;

  // Filter by tag
  if (message.tag) {
    results = results.filter(b => b.tags.includes(message.tag));
  }

  // Filter by category
  if (message.category) {
    results = results.filter(b => b.category === message.category);
  }

  // Search
  if (message.query) {
    const q = message.query.toLowerCase();
    results = results.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      b.summary.toLowerCase().includes(q) ||
      b.tags.some(t => t.includes(q)) ||
      (b.notes || "").toLowerCase().includes(q) ||
      (b.text || "").toLowerCase().includes(q)
    );
  }

  // Pagination
  const page = message.page || 0;
  const perPage = message.perPage || 50;
  const start = page * perPage;

  // Get all unique tags and categories for sidebar
  const allTags = {};
  const allCategories = {};
  smartBookmarks.forEach(b => {
    (b.tags || []).forEach(t => { allTags[t] = (allTags[t] || 0) + 1; });
    if (b.category) allCategories[b.category] = (allCategories[b.category] || 0) + 1;
  });

  return {
    success: true,
    bookmarks: results.slice(start, start + perPage),
    total: results.length,
    tags: Object.entries(allTags).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })),
    categories: Object.entries(allCategories).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }))
  };
}

async function handleUpdateBookmark(message) {
  const updates = {};
  if (message.tags !== undefined) updates.tags = message.tags;
  if (message.notes !== undefined) updates.notes = message.notes;
  if (message.category !== undefined) updates.category = message.category;
  updates.updatedAt = new Date().toISOString();

  const bookmark = await ArgusDB.Bookmarks.update(message.id, updates);
  if (!bookmark) return { success: false, error: "Bookmark not found." };
  return { success: true, bookmark };
}

async function handleDeleteBookmark(message) {
  await ArgusDB.Bookmarks.remove(message.id);
  return { success: true };
}

async function handleExportBookmarks() {
  const smartBookmarks = await ArgusDB.Bookmarks.getAll();
  // Strip stored text to reduce export size
  const exportData = smartBookmarks.map(b => {
    const { text, ...rest } = b;
    return rest;
  });
  return { success: true, data: exportData };
}

// ──────────────────────────────────────────────
// Analyze Bookmarks (research synthesis)
// ──────────────────────────────────────────────
async function handleAnalyzeBookmarks(message) {
  try {
    const bookmarks = message.bookmarks || [];
    if (bookmarks.length === 0) return { success: false, error: "No bookmarks selected." };

    const settings = await getProviderSettings();
    const resultId = `tl-result-${Date.now()}`;
    const presetLabel = `Bookmark Research: ${bookmarks.length} sources`;

    await browser.storage.local.set({
      [resultId]: {
        status: "loading",
        presetLabel,
        pageTitle: presetLabel,
        pageUrl: ""
      }
    });

    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await browser.tabs.create({ url: resultsUrl });

    // Build combined text from bookmarks
    const maxPerSource = Math.floor(settings.maxInputChars / bookmarks.length);
    const combined = bookmarks.map((bm, i) =>
      `\n\n--- Source ${i + 1}: ${bm.title} (${bm.url}) ---\n\n${truncateText(bm.text || bm.summary || "(no content)", maxPerSource)}`
    ).join("");

    const sources = bookmarks.map((bm, i) => ({ index: i + 1, title: bm.title, url: bm.url }));

    const page = {
      title: presetLabel,
      url: bookmarks[0]?.url || "",
      description: "",
      text: combined,
      _sources: sources,
      _isResearch: true
    };

    // Use research preset for multi-source synthesis
    streamAnalysisToStorage(resultId, page, { analysisType: "research" }, settings, presetLabel);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Page Monitor / Diff Alerts
// ──────────────────────────────────────────────
const MONITOR_ALARM_PREFIX = "tl-monitor-";

// Track notification → monitor mapping for click handling
const notificationMonitorMap = new Map();

// Notification click handler — opens the monitored page (requires optional notifications permission)
hasPermission("notifications").then(has => { if (has) browser.notifications.onClicked.addListener(async (notificationId) => {
  const monitorId = notificationMonitorMap.get(notificationId);
  if (!monitorId) return;

  notificationMonitorMap.delete(notificationId);

  const monitor = await ArgusDB.Monitors.get(monitorId);
  if (!monitor) return;

  // Auto-open: open the page directly
  browser.tabs.create({ url: monitor.url });

  // Clear unread count for this monitor
  await clearMonitorUnread(monitorId);
}); });

// Badge management for unread monitor changes
async function incrementMonitorBadge(monitorId) {
  const { monitorUnreads } = await browser.storage.local.get({ monitorUnreads: {} });
  monitorUnreads[monitorId] = (monitorUnreads[monitorId] || 0) + 1;
  await browser.storage.local.set({ monitorUnreads });
  await updateBadge();
}

async function clearMonitorUnread(monitorId) {
  const { monitorUnreads } = await browser.storage.local.get({ monitorUnreads: {} });
  if (monitorUnreads[monitorId]) {
    delete monitorUnreads[monitorId];
    await browser.storage.local.set({ monitorUnreads });
    await updateBadge();
  }
}

async function updateBadge() {
  const { monitorUnreads, showBadge } = await browser.storage.local.get({ monitorUnreads: {}, showBadge: true });
  if (showBadge === false) {
    browser.browserAction.setBadgeText({ text: "" });
    return;
  }
  const total = Object.values(monitorUnreads).reduce((sum, n) => sum + n, 0);
  if (total > 0) {
    browser.browserAction.setBadgeText({ text: String(total) });
    browser.browserAction.setBadgeBackgroundColor({ color: "#e94560" });
  } else {
    browser.browserAction.setBadgeText({ text: "" });
  }
}

async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getArchiveUrl(url) {
  // Check if this URL's domain is on the archive redirect list
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (archiveRedirectDomains.some(d => host === d || host.endsWith("." + d))) {
      return (archiveProviderUrl || "https://archive.is/") + url;
    }
  } catch { /* invalid URL */ }
  return null;
}

async function fetchPageText(url) {
  // PDF detection: fetch and extract text via pdf.js
  if (isPdfUrl(url) && typeof pdfjsLib !== "undefined") {
    const pdfResult = await extractPdfContent(url);
    return pdfResult.text;
  }

  // Auto-route through archive provider if domain is on the redirect list
  const archiveUrl = getArchiveUrl(url);
  let fetchUrl = url;
  let isArchive = false;

  if (archiveUrl) {
    try {
      const archiveResp = await fetch(archiveUrl);
      if (archiveResp.ok) {
        fetchUrl = archiveUrl;
        isArchive = true;
        const html = await archiveResp.text();
        const text = extractTextFromHtml(html);
        if (text.length >= 200) return text;
        // If archive returned little content, fall through to direct fetch
      }
    } catch { /* archive fetch failed, fall through to direct */ }
  }

  const response = await fetch(fetchUrl === archiveUrl ? url : fetchUrl);
  const html = await response.text();
  return extractTextFromHtml(html);
}

function extractTextFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Remove scripts, styles, nav, footer
  doc.querySelectorAll("script, style, nav, footer, header, aside").forEach(el => el.remove());
  // Try multiple selectors, pick longest
  const candidates = [
    "article", "main", '[role="main"]', '[itemprop="articleBody"]',
    ".article-body", ".article-content", ".article__body", ".article__content",
    ".post-content", ".post-body", ".entry-content",
    ".story-body", ".story-content", "#article-body", "#article-content",
    ".content-body", ".page-content"
  ];
  let bestText = "";
  for (const sel of candidates) {
    const el = doc.querySelector(sel);
    if (el) {
      const t = el.textContent.replace(/\s+/g, " ").trim();
      if (t.length > bestText.length) bestText = t;
    }
  }
  if (bestText.length < 200) {
    bestText = doc.body ? doc.body.textContent.replace(/\s+/g, " ").trim() : "";
  }
  return bestText;
}

async function handleAddMonitor(message) {
  try {
    const pageMonitors = await ArgusDB.Monitors.getAll();

    // Check for duplicate
    if (pageMonitors.some(m => m.url === message.url)) {
      return { success: false, error: "This URL is already being monitored." };
    }

    // Get initial content hash
    const text = await fetchPageText(message.url);
    const hash = await hashText(text);

    const monitor = {
      id: `mon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: message.url,
      title: message.title || message.url,
      intervalMinutes: message.intervalMinutes || 60,
      enabled: true,
      createdAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      lastHash: hash,
      lastText: text.slice(0, 10000),
      changeCount: 0,
      aiAnalysis: message.aiAnalysis !== false,
      autoOpen: message.autoOpen || false,
      autoBookmark: message.autoBookmark !== false,
      analysisPreset: message.analysisPreset || "",
      duration: message.duration || 0,
      expiresAt: message.duration ? new Date(Date.now() + message.duration * 3600000).toISOString() : null
    };

    await ArgusDB.Monitors.save(monitor);

    // Save initial snapshot for the timeline
    const initialSnapshot = {
      id: `snap-${Date.now()}`,
      monitorId: monitor.id,
      capturedAt: new Date().toISOString(),
      hash,
      text: text.slice(0, 5000),
      isInitial: true
    };
    await ArgusDB.Snapshots.add(initialSnapshot);

    // Auto-bookmark if enabled
    if (monitor.autoBookmark) {
      try {
        const pageData = { url: message.url, title: message.title || message.url, text: text.slice(0, 50000) };
        await saveBookmark(pageData, { tags: ["monitored"], category: "monitored", summary: `Auto-bookmarked — monitored every ${monitor.intervalMinutes}min` });
      } catch { /* bookmark failed, non-critical */ }
    }

    // Set alarm — first fire after the full interval, then repeat
    browser.alarms.create(`${MONITOR_ALARM_PREFIX}${monitor.id}`, {
      delayInMinutes: monitor.intervalMinutes,
      periodInMinutes: monitor.intervalMinutes
    });

    return { success: true, monitor };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleGetMonitors() {
  const pageMonitors = await ArgusDB.Monitors.getAll();
  return { success: true, monitors: pageMonitors };
}

async function handleUpdateMonitor(message) {
  const monitor = await ArgusDB.Monitors.get(message.id);
  if (!monitor) return { success: false, error: "Monitor not found." };

  if (message.intervalMinutes !== undefined) monitor.intervalMinutes = message.intervalMinutes;
  if (message.enabled !== undefined) monitor.enabled = message.enabled;
  if (message.aiAnalysis !== undefined) monitor.aiAnalysis = message.aiAnalysis;
  if (message.autoOpen !== undefined) monitor.autoOpen = message.autoOpen;
  if (message.autoBookmark !== undefined) monitor.autoBookmark = message.autoBookmark;
  if (message.analysisPreset !== undefined) monitor.analysisPreset = message.analysisPreset;
  if (message.duration !== undefined) {
    monitor.duration = message.duration;
    monitor.expiresAt = message.duration ? new Date(Date.now() + message.duration * 3600000).toISOString() : null;
    monitor.expired = false;
  }

  await ArgusDB.Monitors.save(monitor);

  // Update alarm
  const alarmName = `${MONITOR_ALARM_PREFIX}${monitor.id}`;
  await browser.alarms.clear(alarmName);
  if (monitor.enabled) {
    browser.alarms.create(alarmName, {
      delayInMinutes: monitor.intervalMinutes,
      periodInMinutes: monitor.intervalMinutes
    });
  }

  // Sync linked bookmark summary with current monitor settings
  if (monitor.autoBookmark) {
    const bm = await ArgusDB.Bookmarks.getByUrl(monitor.url);
    if (bm) {
      const interval = monitor.intervalMinutes >= 60 ? `${monitor.intervalMinutes / 60}h` : `${monitor.intervalMinutes}min`;
      const presetStr = monitor.analysisPreset ? ` | preset: ${monitor.analysisPreset}` : "";
      bm.summary = monitor.lastChangeSummary
        ? `${monitor.lastChangeSummary.slice(0, 400)} — monitored every ${interval}${presetStr}`
        : `Auto-bookmarked — monitored every ${interval}${presetStr}`;
      bm.updatedAt = new Date().toISOString();
      await ArgusDB.Bookmarks.add(bm);
    }
  }

  return { success: true, monitor };
}

async function handleDeleteMonitor(message) {
  const monitor = await ArgusDB.Monitors.get(message.id);
  if (monitor) {
    await browser.alarms.clear(`${MONITOR_ALARM_PREFIX}${monitor.id}`);
    await clearMonitorUnread(monitor.id);
  }
  // ArgusDB.Monitors.remove also cleans up snapshots and changes
  await ArgusDB.Monitors.remove(message.id);
  return { success: true };
}

async function handleGetMonitorHistory(message) {
  const changes = await ArgusDB.Changes.getByMonitor(message.monitorId);
  return { success: true, history: changes };
}

async function handleGetAllMonitorChanges() {
  const [changes, monitors] = await Promise.all([
    ArgusDB.Changes.getAll(),
    ArgusDB.Monitors.getAll()
  ]);
  const monitorMap = {};
  for (const m of monitors) monitorMap[m.id] = { title: m.title || m.url, url: m.url };
  // Attach monitor info to each change
  for (const c of changes) {
    const m = monitorMap[c.monitorId];
    if (m) { c.monitorTitle = m.title; c.monitorUrl = m.url; }
    else { c.monitorTitle = "Deleted monitor"; c.monitorUrl = ""; }
  }
  return { success: true, changes: changes.slice(0, 500) };
}

async function handleGetMonitorSnapshots(message) {
  const snapshots = await ArgusDB.Snapshots.getByMonitor(message.monitorId);
  return { success: true, snapshots };
}

async function handleGetMonitorStorageUsage() {
  const pageMonitors = await ArgusDB.Monitors.getAll();
  let totalBytes = JSON.stringify(pageMonitors).length;
  const perMonitor = [];

  for (const monitor of pageMonitors) {
    let monitorBytes = JSON.stringify(monitor).length;
    const snapshots = await ArgusDB.Snapshots.getByMonitor(monitor.id);
    const changes = await ArgusDB.Changes.getByMonitor(monitor.id);
    const snapBytes = JSON.stringify(snapshots).length;
    const histBytes = JSON.stringify(changes).length;
    monitorBytes += snapBytes + histBytes;
    totalBytes += snapBytes + histBytes;
    perMonitor.push({
      id: monitor.id,
      title: monitor.title || monitor.url,
      bytes: monitorBytes,
      snapshots: snapshots.length,
      historyEntries: changes.length
    });
  }

  return { success: true, totalBytes, perMonitor };
}

// Alarm handler for periodic page checks
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(MONITOR_ALARM_PREFIX)) return;

  const monitorId = alarm.name.slice(MONITOR_ALARM_PREFIX.length);
  const monitor = await ArgusDB.Monitors.get(monitorId);
  if (!monitor) return;
  if (!monitor.enabled) return;

  // Check if monitor has expired
  if (monitor.expiresAt && new Date(monitor.expiresAt).getTime() <= Date.now()) {
    monitor.enabled = false;
    monitor.expired = true;
    await ArgusDB.Monitors.save(monitor);
    await browser.alarms.clear(alarm.name);
    console.log(`[Monitor] ${monitor.title} expired — auto-stopped`);
    return;
  }

  try {
    const newText = await fetchPageText(monitor.url);
    const newHash = await hashText(newText);
    const now = new Date().toISOString();

    monitor.lastChecked = now;

    // Always save a snapshot for the timeline (even if no change)
    const snapshot = {
      id: `snap-${Date.now()}`,
      monitorId: monitor.id,
      capturedAt: now,
      hash: newHash,
      text: newText.slice(0, 5000),
      changed: newHash !== monitor.lastHash
    };
    await ArgusDB.Snapshots.add(snapshot);
    // Keep last 100 snapshots per monitor
    await ArgusDB.Snapshots.pruneForMonitor(monitor.id, 100);

    if (newHash !== monitor.lastHash) {
      monitor.changeCount++;
      const oldText = monitor.lastText;
      monitor.lastHash = newHash;
      monitor.lastText = newText.slice(0, 10000);

      const changeEntry = {
        id: `chg-${Date.now()}`,
        monitorId: monitor.id,
        detectedAt: now,
        oldHash: monitor.lastHash,
        newHash,
        oldTextSnippet: oldText.slice(0, 5000),
        newTextSnippet: newText.slice(0, 5000),
        aiSummary: null
      };

      // AI diff analysis
      if (monitor.aiAnalysis) {
        try {
          const settings = await getProviderSettings();
          const diffPrompt = `Compare these two versions of a webpage and summarize what changed. Be concise.

OLD VERSION (snippet):
${oldText.slice(0, 3000)}

NEW VERSION (snippet):
${newText.slice(0, 3000)}

Summarize the key differences in 2-4 bullet points.`;

          const langInst = await getLanguageInstruction();
          const messages = buildMessages(
            `You are a change detection analyst. Summarize webpage differences concisely.${langInst}`,
            diffPrompt
          );

          const result = await callProvider(
            settings.provider, settings.apiKey, settings.model, messages,
            { maxTokens: 500, temperature: 0.3 }
          );
          changeEntry.aiSummary = result.content;
        } catch {
          // AI analysis failed, continue without it
        }
      }

      await ArgusDB.Changes.add(changeEntry);

      // Extract entities for knowledge graph (non-blocking)
      try {
        const kgText = (changeEntry.aiSummary || "") + "\n" + (changeEntry.newSnippet || "");
        if (kgText.trim()) KnowledgeGraph.extractAndUpsert(kgText, monitor.url, monitor.title, null);
      } catch (e) { console.warn("[KG] monitor change extraction failed:", e); }

      // Store last change summary on the monitor for quick display
      monitor.lastChangeSummary = changeEntry.aiSummary || `Content changed (${new Date(now).toLocaleString()})`;
      monitor.lastChangeAt = now;

      // Increment badge count
      await incrementMonitorBadge(monitor.id);

      // Send clickable notification
      const notifBody = changeEntry.aiSummary
        ? changeEntry.aiSummary.slice(0, 200)
        : "The page content has changed since the last check. Click to view.";

      const notifId = `monitor-change-${monitor.id}-${Date.now()}`;
      notificationMonitorMap.set(notifId, monitor.id);
      safeNotify(notifId, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: `Page Changed: ${monitor.title}`,
        message: notifBody,
        requireInteraction: true
      });

      // Auto-open the page in a new tab if enabled
      if (monitor.autoOpen) {
        browser.tabs.create({ url: monitor.url, active: false });
      }

      // Update linked bookmark if auto-bookmark is enabled
      if (monitor.autoBookmark) {
        try {
          const pageData = { url: monitor.url, title: monitor.title, text: newText.slice(0, 50000) };
          await saveBookmark(pageData, {
            tags: ["monitored", "updated"],
            category: "monitored",
            summary: changeEntry.aiSummary || `Content changed — ${monitor.changeCount} total changes detected`
          });
        } catch { /* non-critical */ }
      }

      // Scan for watchlist keywords
      try {
        if (typeof scanForWatchwords === "function") {
          await scanForWatchwords(newText, "monitor", monitor.url, monitor.title);
        }
      } catch { /* non-critical */ }

      // Auto-analyze with preset if configured
      if (monitor.analysisPreset) {
        try {
          const settings = await getProviderSettings(null, monitor.analysisPreset);
          const page = { url: monitor.url, title: monitor.title, text: newText.slice(0, settings.maxInputChars || 100000) };
          const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
          const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, monitor.analysisPreset, null, settings);
          const msgs = buildMessages(systemPrompt, userPrompt);
          const result = await callProvider(settings.provider, settings.apiKey, settings.model, msgs, opts);

          // Store the analysis result
          const resultId = `monitor-analysis-${monitor.id}-${Date.now()}`;
          await browser.storage.local.set({
            [resultId]: {
              content: result.content,
              preset: monitor.analysisPreset,
              url: monitor.url,
              title: monitor.title,
              timestamp: now,
              provider: settings.provider
            }
          });

          // Open the result in a tab
          const presetLabel = ANALYSIS_PRESETS[monitor.analysisPreset]?.label || settings.customPresets[monitor.analysisPreset]?.label || monitor.analysisPreset;
          await browser.storage.local.set({
            pendingResult: {
              content: result.content,
              title: `${presetLabel}: ${monitor.title}`,
              url: monitor.url,
              provider: settings.provider,
              preset: monitor.analysisPreset,
              timestamp: now
            }
          });
          browser.tabs.create({ url: browser.runtime.getURL("results/results.html"), active: false });
        } catch (err) {
          console.warn(`[Monitor] Auto-analysis failed for "${monitor.title}":`, err.message);
        }
      }
    } else {
      console.log(`[Monitor] ${monitor.title}: no changes detected`);
    }

    await ArgusDB.Monitors.save(monitor);
  } catch (err) {
    console.warn(`[Monitor] Check failed for "${monitor.title}" (${monitor.url}):`, err.message);

    monitor.lastChecked = new Date().toISOString();
    await ArgusDB.Monitors.save(monitor);
  }
});

// Restore alarms on startup and catch up on any overdue monitors
(async () => {
  const pageMonitors = await ArgusDB.Monitors.getAll();
  const now = Date.now();
  let updated = false;

  for (const monitor of pageMonitors) {
    if (!monitor.enabled) continue;

    // Check if monitor has expired
    if (monitor.expiresAt && new Date(monitor.expiresAt).getTime() <= now) {
      monitor.enabled = false;
      monitor.expired = true;
      updated = true;
      console.log(`[Monitor] ${monitor.title} expired on startup — auto-stopped`);
      continue;
    }

    const alarmName = `${MONITOR_ALARM_PREFIX}${monitor.id}`;

    // Always ensure the periodic alarm exists
    const existing = await browser.alarms.get(alarmName);
    if (!existing) {
      browser.alarms.create(alarmName, {
        delayInMinutes: monitor.intervalMinutes,
        periodInMinutes: monitor.intervalMinutes
      });
    }

    // Check if this monitor is overdue and needs an immediate catch-up check
    const lastCheckedTime = monitor.lastChecked ? new Date(monitor.lastChecked).getTime() : 0;
    const intervalMs = monitor.intervalMinutes * 60 * 1000;
    const overdueBy = now - lastCheckedTime - intervalMs;

    if (overdueBy > 0) {
      console.log(`[Monitor] ${monitor.title} is overdue by ${Math.round(overdueBy / 60000)}min — running catch-up check`);
      try {
        const newText = await fetchPageText(monitor.url);
        const newHash = await hashText(newText);
        const catchupNow = new Date().toISOString();

        monitor.lastChecked = catchupNow;

        // Save snapshot for timeline
        await ArgusDB.Snapshots.add({
          id: `snap-${Date.now()}`,
          monitorId: monitor.id,
          capturedAt: catchupNow,
          hash: newHash,
          text: newText.slice(0, 5000),
          changed: newHash !== monitor.lastHash
        });
        await ArgusDB.Snapshots.pruneForMonitor(monitor.id, 100);

        if (newHash !== monitor.lastHash) {
          monitor.changeCount++;
          const oldText = monitor.lastText;
          monitor.lastHash = newHash;
          monitor.lastText = newText.slice(0, 10000);

          const changeEntry = {
            id: `chg-${Date.now()}`,
            monitorId: monitor.id,
            detectedAt: catchupNow,
            oldHash: monitor.lastHash,
            newHash,
            oldTextSnippet: oldText.slice(0, 5000),
            newTextSnippet: newText.slice(0, 5000),
            aiSummary: null
          };

          if (monitor.aiAnalysis) {
            try {
              const settings = await getProviderSettings();
              const diffPrompt = `Compare these two versions of a webpage and summarize what changed. Be concise.

OLD VERSION (snippet):
${oldText.slice(0, 3000)}

NEW VERSION (snippet):
${newText.slice(0, 3000)}

Summarize the key differences in 2-4 bullet points.`;

              const langInst2 = await getLanguageInstruction();
              const messages = buildMessages(
                `You are a change detection analyst. Summarize webpage differences concisely.${langInst2}`,
                diffPrompt
              );

              const result = await callProvider(
                settings.provider, settings.apiKey, settings.model, messages,
                { maxTokens: 500, temperature: 0.3 }
              );
              changeEntry.aiSummary = result.content;
            } catch {
              // AI analysis failed, continue without it
            }
          }

          await ArgusDB.Changes.add(changeEntry);

          // Extract entities for knowledge graph (non-blocking)
          try {
            const kgText = (changeEntry.aiSummary || "") + "\n" + (changeEntry.newSnippet || "");
            if (kgText.trim()) KnowledgeGraph.extractAndUpsert(kgText, monitor.url, monitor.title, null);
          } catch (e) { console.warn("[KG] monitor catchup extraction failed:", e); }

          monitor.lastChangeSummary = changeEntry.aiSummary || `Content changed (${new Date(catchupNow).toLocaleString()})`;
          monitor.lastChangeAt = catchupNow;

          await incrementMonitorBadge(monitor.id);

          const notifId = `monitor-catchup-${monitor.id}-${Date.now()}`;
          notificationMonitorMap.set(notifId, monitor.id);
          safeNotify(notifId, {
            type: "basic",
            iconUrl: "icons/icon-96.png",
            title: `Page Changed: ${monitor.title}`,
            message: changeEntry.aiSummary
              ? changeEntry.aiSummary.slice(0, 200)
              : "The page content changed while you were away. Click to view.",
            requireInteraction: true
          });

          if (monitor.autoOpen) {
            browser.tabs.create({ url: monitor.url, active: false });
          }
        } else {
          console.log(`[Monitor] ${monitor.title} catch-up check: no changes detected`);
        }

        updated = true;
      } catch (err) {
        console.warn(`[Monitor] Catch-up check failed for ${monitor.title}:`, err.message);
      }
    }
  }

  if (updated) {
    await ArgusDB.Monitors.saveAll(pageMonitors);
  }

  // Restore badge count on startup
  await updateBadge();
})();

// ══════════════════════════════════════════════════════════════
// Archive Redirect — bypass paywalls/annoying sites via archive.is
// ══════════════════════════════════════════════════════════════

const DEFAULT_ARCHIVE_DOMAINS = [
  "cnn.com", "nytimes.com", "washingtonpost.com", "wsj.com",
  "bloomberg.com", "reuters.com", "bbc.com", "theguardian.com",
  "forbes.com", "businessinsider.com", "wired.com", "townhall.com",
  "theatlantic.com", "newyorker.com", "theepochtimes.com",
  "latimes.com", "usatoday.com", "politico.com", "thedailybeast.com",
  "vanityfair.com", "ft.com", "economist.com", "newsweek.com", "time.com"
];

let archiveRedirectEnabled = false;
let archiveRedirectDomains = [];
let archiveProviderUrl = "https://archive.is/";

async function loadArchiveSettings() {
  const { archiveRedirect } = await browser.storage.local.get({
    archiveRedirect: { enabled: false, domains: DEFAULT_ARCHIVE_DOMAINS, providerUrl: "https://archive.is/" }
  });
  archiveRedirectEnabled = archiveRedirect.enabled;
  archiveRedirectDomains = archiveRedirect.domains || [];
  archiveProviderUrl = archiveRedirect.providerUrl || "https://archive.is/";
}

loadArchiveSettings();

// Reload settings when they change
browser.storage.onChanged.addListener((changes) => {
  if (changes.archiveRedirect) {
    const val = changes.archiveRedirect.newValue;
    archiveRedirectEnabled = val.enabled;
    archiveRedirectDomains = val.domains || [];
    archiveProviderUrl = val.providerUrl || "https://archive.is/";
    if (val.enabled) registerArchiveRedirect();
  }
});

// Intercept requests before they load (requires optional webRequest permission)
let archiveWebRequestRegistered = false;

function archiveRedirectHandler(details) {
  if (!archiveRedirectEnabled) return;
  if (details.type !== "main_frame") return;

  try {
    const url = new URL(details.url);
    const host = url.hostname.replace(/^www\./, "");

    // Don't redirect archive/cache sites themselves
    if (host.includes("archive.is") || host.includes("archive.ph") || host.includes("archive.today") || host.includes("webcache.googleusercontent.com")) return;

    const matched = archiveRedirectDomains.some(
      d => host === d || host.endsWith("." + d)
    );

    if (matched) {
      return { redirectUrl: archiveProviderUrl + details.url };
    }
  } catch { /* invalid URL, skip */ }
}

async function registerArchiveRedirect() {
  if (archiveWebRequestRegistered) return;
  const registered = await initWebRequestBlocking(
    archiveRedirectHandler,
    { urls: ["<all_urls>"] },
    ["blocking"]
  );
  if (registered) archiveWebRequestRegistered = true;
}

registerArchiveRedirect();

// ══════════════════════════════════════════════════════════════
// Archive Availability Checker
// ══════════════════════════════════════════════════════════════

// Cache of archive check results: tabId -> { url, archiveUrl, timestamp }
const archiveCheckCache = new Map();

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:") || tab.url.startsWith("chrome:")) return;

  const { archiveCheckMode } = await browser.storage.local.get({ archiveCheckMode: "off" });
  if (archiveCheckMode === "off") return;

  try {
    const host = new URL(tab.url).hostname.replace(/^www\./, "");

    // Skip archive sites themselves
    if (host.includes("archive.is") || host.includes("archive.ph") || host.includes("archive.today")) return;

    // If mode is "redirect-list", only check domains on the redirect list
    if (archiveCheckMode === "redirect-list") {
      const onList = archiveRedirectDomains.some(d => host === d || host.endsWith("." + d));
      if (!onList) return;
    }

    // Don't re-check the same URL for the same tab
    const cached = archiveCheckCache.get(tabId);
    if (cached && cached.url === tab.url && (Date.now() - cached.timestamp) < 300000) return;

    // Lightweight check: fetch archive.is/newest/URL with HEAD/redirect follow
    const checkUrl = `https://archive.is/newest/${tab.url}`;
    const resp = await fetch(checkUrl, { method: "HEAD", redirect: "follow" });

    if (resp.ok && resp.url && resp.url !== checkUrl && !resp.url.includes("/newest/")) {
      // Archive exists — resp.url is the archived snapshot URL
      archiveCheckCache.set(tabId, { url: tab.url, archiveUrl: resp.url, timestamp: Date.now() });
    } else {
      archiveCheckCache.set(tabId, { url: tab.url, archiveUrl: null, timestamp: Date.now() });
    }
  } catch {
    // Network error or archive.is down — silently skip
  }
});

// Clean up cache when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  archiveCheckCache.delete(tabId);
});

// ══════════════════════════════════════════════════════════════
// RSS Feeds — lightweight feed reader + monitor bridge
// ══════════════════════════════════════════════════════════════

const RSS_ALARM_PREFIX = "tl-rss-";

function parseRSSFeed(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const entries = [];
  let feedTitle = "";
  let feedSiteUrl = "";

  // Try RSS 2.0
  const channel = doc.querySelector("channel");
  if (channel) {
    feedTitle = channel.querySelector(":scope > title")?.textContent || "";
    feedSiteUrl = channel.querySelector(":scope > link")?.textContent || "";
    for (const item of channel.querySelectorAll("item")) {
      entries.push({
        id: item.querySelector("guid")?.textContent || item.querySelector("link")?.textContent || `entry-${Date.now()}-${Math.random()}`,
        title: item.querySelector("title")?.textContent || "Untitled",
        link: item.querySelector("link")?.textContent || "",
        description: (item.querySelector("description")?.textContent || "").slice(0, 1000),
        pubDate: item.querySelector("pubDate")?.textContent || "",
        read: false
      });
    }
  }

  // Try Atom
  if (!entries.length) {
    const feed = doc.querySelector("feed");
    if (feed) {
      feedTitle = feed.querySelector(":scope > title")?.textContent || "";
      const siteLink = feed.querySelector(':scope > link[rel="alternate"]') || feed.querySelector(":scope > link");
      feedSiteUrl = siteLink?.getAttribute("href") || "";
      for (const entry of feed.querySelectorAll("entry")) {
        const link = entry.querySelector('link[rel="alternate"]') || entry.querySelector("link");
        entries.push({
          id: entry.querySelector("id")?.textContent || link?.getAttribute("href") || `entry-${Date.now()}-${Math.random()}`,
          title: entry.querySelector("title")?.textContent || "Untitled",
          link: link?.getAttribute("href") || "",
          description: (entry.querySelector("summary")?.textContent || entry.querySelector("content")?.textContent || "").slice(0, 1000),
          pubDate: entry.querySelector("published")?.textContent || entry.querySelector("updated")?.textContent || "",
          read: false
        });
      }
    }
  }

  return { feedTitle, feedSiteUrl, entries };
}

async function discoverFeedUrl(pageUrl) {
  try {
    const resp = await fetch(pageUrl);
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    // Look for <link rel="alternate" type="application/rss+xml"> or atom
    const feedLink = doc.querySelector('link[type="application/rss+xml"]') ||
                     doc.querySelector('link[type="application/atom+xml"]');
    if (feedLink) {
      const href = feedLink.getAttribute("href");
      if (href.startsWith("http")) return href;
      return new URL(href, pageUrl).href;
    }
  } catch { /* feed discovery failed */ }
  return null;
}

async function handleAddFeed(message) {
  try {
    const rssFeeds = await ArgusDB.Feeds.getAll();

    let feedUrl = message.url.trim();

    // If URL doesn't look like a feed, try to discover one
    if (!feedUrl.match(/\.(xml|rss|atom|feed)/i) && !feedUrl.includes("/feed")) {
      const discovered = await discoverFeedUrl(feedUrl);
      if (discovered) feedUrl = discovered;
    }

    // Check for duplicate
    if (rssFeeds.some(f => f.url === feedUrl)) {
      return { success: false, error: "This feed is already subscribed." };
    }

    // Fetch and parse to validate
    const resp = await fetch(feedUrl);
    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    const xmlText = await resp.text();

    // Reject if this is clearly an HTML page, not a feed
    const isHtml = contentType.includes("text/html") && !contentType.includes("xml");
    const looksLikeHtml = xmlText.trimStart().slice(0, 200).toLowerCase().includes("<!doctype html") ||
                          xmlText.trimStart().slice(0, 200).toLowerCase().includes("<html");
    if (isHtml || (looksLikeHtml && !xmlText.includes("<rss") && !xmlText.includes("<feed") && !xmlText.includes("<channel"))) {
      return { success: false, error: "This URL is a webpage, not an RSS/Atom feed." };
    }

    const parsed = parseRSSFeed(xmlText);

    if (!parsed.entries.length) {
      return { success: false, error: "No feed entries found. Check the URL." };
    }

    const feed = {
      id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: feedUrl,
      title: message.title || parsed.feedTitle || feedUrl,
      siteUrl: parsed.feedSiteUrl || "",
      createdAt: new Date().toISOString(),
      lastFetched: new Date().toISOString(),
      checkIntervalMinutes: message.intervalMinutes || 60,
      enabled: true,
      aiSummarize: message.aiSummarize || false,
      monitorBridge: message.monitorBridge || false
    };

    await ArgusDB.Feeds.save(feed);

    // Save initial entries
    const initialEntries = parsed.entries.slice(0, 100).map(e => ({ ...e, feedId: feed.id }));
    await ArgusDB.FeedEntries.saveMany(initialEntries);

    // Set alarm for periodic checks
    browser.alarms.create(`${RSS_ALARM_PREFIX}${feed.id}`, {
      delayInMinutes: feed.checkIntervalMinutes,
      periodInMinutes: feed.checkIntervalMinutes
    });

    return { success: true, feed };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleGetFeeds() {
  const rssFeeds = await ArgusDB.Feeds.getAll();
  // Include unread counts
  const feeds = [];
  for (const feed of rssFeeds) {
    const entries = await ArgusDB.FeedEntries.getByFeed(feed.id);
    feeds.push({ ...feed, unreadCount: entries.filter(e => !e.read).length, totalEntries: entries.length });
  }
  return { success: true, feeds };
}

async function handleGetFeedEntries(message) {
  if (message.feedId) {
    const entries = await ArgusDB.FeedEntries.getByFeed(message.feedId);
    return { success: true, entries };
  }
  // All feeds — combine and sort by date
  const rssFeeds = await ArgusDB.Feeds.getAll();
  let allEntries = [];
  for (const feed of rssFeeds) {
    const entries = await ArgusDB.FeedEntries.getByFeed(feed.id);
    allEntries.push(...entries.map(e => ({ ...e, feedTitle: feed.title })));
  }
  allEntries.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return { success: true, entries: allEntries.slice(0, 200) };
}

async function handleDeleteFeed(message) {
  const feed = await ArgusDB.Feeds.get(message.id);
  if (feed) {
    await browser.alarms.clear(`${RSS_ALARM_PREFIX}${feed.id}`);
  }
  // ArgusDB.Feeds.remove also cleans up entries
  await ArgusDB.Feeds.remove(message.id);
  return { success: true };
}

async function handleDeleteAllFeeds() {
  const rssFeeds = await ArgusDB.Feeds.getAll();
  for (const feed of rssFeeds) {
    await browser.alarms.clear(`${RSS_ALARM_PREFIX}${feed.id}`);
  }
  await ArgusDB.Feeds.clear();
  return { success: true };
}

async function handleUpdateFeed(message) {
  const feed = await ArgusDB.Feeds.get(message.id);
  if (!feed) return { success: false, error: "Feed not found." };

  if (message.enabled !== undefined) feed.enabled = message.enabled;
  if (message.checkIntervalMinutes !== undefined) feed.checkIntervalMinutes = message.checkIntervalMinutes;
  if (message.aiSummarize !== undefined) feed.aiSummarize = message.aiSummarize;
  if (message.title !== undefined) feed.title = message.title;

  await ArgusDB.Feeds.save(feed);

  // Update alarm
  const alarmName = `${RSS_ALARM_PREFIX}${feed.id}`;
  await browser.alarms.clear(alarmName);
  if (feed.enabled) {
    browser.alarms.create(alarmName, {
      delayInMinutes: feed.checkIntervalMinutes,
      periodInMinutes: feed.checkIntervalMinutes
    });
  }

  return { success: true, feed };
}

async function handleMarkFeedEntryRead(message) {
  await ArgusDB.FeedEntries.update(message.entryId, { read: true });
  return { success: true };
}

async function handleMarkAllFeedRead(message) {
  const entries = await ArgusDB.FeedEntries.getByFeed(message.feedId);
  const updated = entries.map(e => ({ ...e, read: true }));
  await ArgusDB.FeedEntries.saveMany(updated);
  return { success: true };
}

async function handleRefreshFeed(message) {
  const feed = await ArgusDB.Feeds.get(message.id);
  if (!feed) return { success: false, error: "Feed not found." };
  const rssFeeds = await ArgusDB.Feeds.getAll();
  await checkFeedForUpdates(feed, rssFeeds);
  return { success: true };
}

async function handleSummarizeFeedEntry(message) {
  try {
    const settings = await getProviderSettings();
    const prompt = `Summarize this article concisely in 2-4 bullet points:

Title: ${message.title}

Content:
${message.content.slice(0, 3000)}`;

    const langInst = await getLanguageInstruction();
    const messages = buildMessages(
      `You are a concise news summarizer. Provide clear, informative bullet-point summaries.${langInst}`,
      prompt
    );

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      { maxTokens: 500, temperature: 0.3 }
    );
    return { success: true, summary: result.content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleDiscoverFeed(message) {
  const feedUrl = await discoverFeedUrl(message.url);
  return { success: true, feedUrl };
}

async function checkFeedForUpdates(feed, allFeeds) {
  try {
    const resp = await fetch(feed.url);
    const xmlText = await resp.text();
    const parsed = parseRSSFeed(xmlText);

    const existingEntries = await ArgusDB.FeedEntries.getByFeed(feed.id);
    const existingIds = new Set(existingEntries.map(e => e.id));

    const newEntries = parsed.entries.filter(e => !existingIds.has(e.id));

    if (newEntries.length > 0) {
      // AI summarize new entries if enabled
      if (feed.aiSummarize) {
        const settings = await getProviderSettings();
        for (const entry of newEntries.slice(0, 5)) {
          try {
            const prompt = `Summarize concisely in 1-2 sentences:\n\nTitle: ${entry.title}\n${entry.description.slice(0, 2000)}`;
            const msgs = buildMessages("You are a concise news summarizer.", prompt);
            const result = await callProvider(settings.provider, settings.apiKey, settings.model, msgs, { maxTokens: 200, temperature: 0.3 });
            entry.aiSummary = result.content;
          } catch { /* non-critical */ }
        }
      }

      // Scan new entries for watchlist keywords
      try {
        if (typeof scanForWatchwords === "function") {
          for (const entry of newEntries) {
            const scanText = (entry.title || "") + " " + (entry.description || "");
            await scanForWatchwords(scanText, "feed", entry.link || feed.url, entry.title || feed.title);
          }
        }
      } catch { /* non-critical */ }

      const newTagged = newEntries.map(e => ({ ...e, feedId: feed.id }));
      await ArgusDB.FeedEntries.saveMany(newTagged);

      // Extract entities for knowledge graph (non-blocking)
      try {
        for (const entry of newTagged.slice(0, 10)) {
          const kgText = (entry.title || "") + "\n" + (entry.aiSummary || entry.description || "");
          if (kgText.trim()) KnowledgeGraph.extractAndUpsert(kgText, entry.link || feed.url, entry.title, null);
        }
      } catch (e) { console.warn("[KG] feed entry extraction failed:", e); }

      // Notification for new entries
      if (newEntries.length > 0) {
        safeNotify(`rss-${feed.id}-${Date.now()}`, {
          type: "basic",
          iconUrl: "icons/icon-96.png",
          title: `${feed.title}: ${newEntries.length} new`,
          message: newEntries.slice(0, 3).map(e => e.title).join(" | ")
        });
      }

      // Monitor bridge — if enabled, create a change entry on the linked monitor
      if (feed.monitorBridge) {
        const pageMonitors = await ArgusDB.Monitors.getAll();
        const linkedMonitor = pageMonitors.find(m => m.url === feed.siteUrl || m.url === feed.url);
        if (linkedMonitor) {
          linkedMonitor.changeCount += newEntries.length;
          linkedMonitor.lastChangeSummary = `${newEntries.length} new RSS entries: ${newEntries.slice(0, 2).map(e => e.title).join(", ")}`;
          linkedMonitor.lastChangeAt = new Date().toISOString();
          await ArgusDB.Monitors.save(linkedMonitor);
        }
      }
    }

    // Update feed metadata
    feed.lastFetched = new Date().toISOString();
    await ArgusDB.Feeds.save(feed);
  } catch (err) {
    console.warn(`[RSS] Failed to check feed "${feed.title}":`, err.message);
  }
}

// RSS alarm handler — hook into existing alarm listener
const origAlarmHandler = browser.alarms.onAlarm.hasListener;
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(RSS_ALARM_PREFIX)) return;

  const feedId = alarm.name.slice(RSS_ALARM_PREFIX.length);
  const feed = await ArgusDB.Feeds.get(feedId);
  if (!feed || !feed.enabled) return;

  const rssFeeds = await ArgusDB.Feeds.getAll();
  await checkFeedForUpdates(feed, rssFeeds);
});

// Knowledge Graph inference alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "kg-inference") return;
  try {
    const stats = await KnowledgeGraph.runInferenceRules();
    if (stats.inferred) console.log("[KG] Periodic inference:", stats.inferred, "new relationships");
  } catch (e) { console.warn("[KG] Periodic inference error:", e); }
});

// Scheduled digest alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "agent-digests") return;
  try {
    const results = await AgentEngine.runScheduledDigests();
    const generated = results.filter(r => r.success).length;
    if (generated) console.log("[Agent] Scheduled digests generated:", generated);
  } catch (e) { console.warn("[Agent] Scheduled digest error:", e); }
});

// Restore RSS alarms on startup
(async () => {
  const rssFeeds = await ArgusDB.Feeds.getAll();
  for (const feed of rssFeeds) {
    if (!feed.enabled) continue;
    const alarmName = `${RSS_ALARM_PREFIX}${feed.id}`;
    const existing = await browser.alarms.get(alarmName);
    if (!existing) {
      browser.alarms.create(alarmName, {
        delayInMinutes: feed.checkIntervalMinutes,
        periodInMinutes: feed.checkIntervalMinutes
      });
    }
  }
})();

// ══════════════════════════════════════════════════════════════
// Projects — organize analyses, bookmarks, and notes
// ══════════════════════════════════════════════════════════════

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function handleGetProjects() {
  const projects = await ArgusDB.Projects.getAll();
  return { success: true, projects };
}

async function handleCreateProject(message) {
  const project = {
    id: genId("proj"),
    name: message.name || "Untitled Project",
    description: message.description || "",
    starred: false,
    color: message.color || "#e94560",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: []
  };
  await ArgusDB.Projects.save(project);
  return { success: true, project };
}

async function handleUpdateProject(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  if (message.name !== undefined) proj.name = message.name;
  if (message.description !== undefined) proj.description = message.description;
  if (message.starred !== undefined) proj.starred = message.starred;
  if (message.color !== undefined) proj.color = message.color;
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  return { success: true, project: proj };
}

async function handleDeleteProject(message) {
  await ArgusDB.Projects.remove(message.projectId);
  return { success: true };
}

async function handleAddProjectItem(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  const item = {
    id: genId("item"),
    type: message.item.type || "note",
    refId: message.item.refId || null,
    url: message.item.url || "",
    title: message.item.title || "",
    summary: (message.item.summary || "").slice(0, 500),
    notes: message.item.notes || "",
    tags: message.item.tags || [],
    addedAt: new Date().toISOString()
  };
  proj.items.unshift(item);
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  return { success: true, item };
}

async function handleUpdateProjectItem(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  const item = proj.items.find(i => i.id === message.itemId);
  if (!item) return { success: false, error: "Item not found" };
  if (message.notes !== undefined) item.notes = message.notes;
  if (message.tags !== undefined) item.tags = message.tags;
  if (message.title !== undefined) item.title = message.title;
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  return { success: true, item };
}

async function handleRemoveProjectItem(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  proj.items = proj.items.filter(i => i.id !== message.itemId);
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  return { success: true };
}

async function handleExportProject(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };

  // Collect related history entries referenced by project items
  const relatedHistory = [];
  const refIds = proj.items.filter(i => i.refId).map(i => i.refId);
  if (refIds.length) {
    const allHistory = await ArgusDB.History.getAllSorted();
    for (const entry of allHistory) {
      if (refIds.includes(entry.id)) relatedHistory.push(entry);
    }
  }

  const bundle = {
    manifest: {
      format: "argusproj",
      version: 1,
      exportedAt: new Date().toISOString(),
      argusVersion: browser.runtime.getManifest().version,
      projectCount: 1,
      historyCount: relatedHistory.length,
    },
    projects: [proj],
    history: relatedHistory,
  };
  return { success: true, bundle };
}

async function handleExportAllProjects() {
  const projects = await ArgusDB.Projects.getAll();
  if (!projects.length) return { success: false, error: "No projects" };

  // Collect all referenced history entries
  const refIds = new Set();
  for (const proj of projects) {
    for (const item of (proj.items || [])) {
      if (item.refId) refIds.add(item.refId);
    }
  }
  const relatedHistory = [];
  if (refIds.size) {
    const allHistory = await ArgusDB.History.getAllSorted();
    for (const entry of allHistory) {
      if (refIds.has(entry.id)) relatedHistory.push(entry);
    }
  }

  const bundle = {
    manifest: {
      format: "argusproj",
      version: 1,
      exportedAt: new Date().toISOString(),
      argusVersion: browser.runtime.getManifest().version,
      projectCount: projects.length,
      historyCount: relatedHistory.length,
    },
    projects,
    history: relatedHistory,
  };
  return { success: true, bundle };
}

async function handleImportProject(message) {
  const { bundle } = message;
  if (!bundle || !bundle.manifest || bundle.manifest.format !== "argusproj") {
    return { success: false, error: "Invalid .argusproj file" };
  }

  let projectsImported = 0;
  let historyImported = 0;

  // Import projects (assign new IDs to avoid collisions)
  const idMap = {};
  for (const proj of (bundle.projects || [])) {
    const oldId = proj.id;
    const newId = genId("proj");
    idMap[oldId] = newId;
    proj.id = newId;
    proj.updatedAt = new Date().toISOString();
    // Remap item IDs
    for (const item of (proj.items || [])) {
      item.id = genId("item");
    }
    await ArgusDB.Projects.save(proj);
    projectsImported++;
  }

  // Import related history entries (new IDs, update project item refIds)
  const historyIdMap = {};
  for (const entry of (bundle.history || [])) {
    const oldId = entry.id;
    const newId = genId("hist");
    historyIdMap[oldId] = newId;
    entry.id = newId;
    await ArgusDB.History.add(entry);
    historyImported++;
  }

  // Update refIds in imported projects to point to new history IDs
  if (Object.keys(historyIdMap).length) {
    for (const oldId of Object.keys(idMap)) {
      const newProjId = idMap[oldId];
      const savedProj = await ArgusDB.Projects.get(newProjId);
      if (!savedProj) continue;
      let changed = false;
      for (const item of (savedProj.items || [])) {
        if (item.refId && historyIdMap[item.refId]) {
          item.refId = historyIdMap[item.refId];
          changed = true;
        }
      }
      if (changed) await ArgusDB.Projects.save(savedProj);
    }
  }

  return { success: true, projectsImported, historyImported };
}

async function handleBatchAnalyzeProjectItem(message) {
  try {
    const { projectId, itemId, presetKey } = message;
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };
    const item = proj.items.find(i => i.id === itemId);
    if (!item || !item.url) return { success: false, error: "Item has no URL" };

    // Check history first — reuse existing analysis if available
    const analysisHistory = await ArgusDB.History.getAllSorted();
    const existingAnalysis = analysisHistory.find(h =>
      h.pageUrl === item.url && h.presetKey === presetKey
    );
    if (existingAnalysis && existingAnalysis.content) {
      item.summary = existingAnalysis.content.slice(0, 500);
      item.analysisContent = existingAnalysis.content;
      item.analysisPreset = presetKey;
      proj.updatedAt = new Date().toISOString();
      await ArgusDB.Projects.save(proj);
      return { success: true, cached: true };
    }

    // Fetch page and analyze
    const text = await fetchPageText(item.url);
    if (!text || text.length < 20) return { success: false, error: "Could not fetch page content" };

    const page = { url: item.url, title: item.title || item.url, description: "", text };
    const settings = await getProviderSettings();
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, presetKey, null, settings);
    const messages = buildMessages(systemPrompt, userPrompt);
    const result = await callProvider(settings.provider, settings.apiKey, settings.model, messages, {
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      reasoningEffort: settings.reasoningEffort,
      extendedThinking: settings.extendedThinking
    });

    // Update project item with analysis
    item.summary = result.content.replace(/\n?SHARELINE:\s*.+$/m, "").slice(0, 500);
    item.analysisContent = result.content.replace(/\n?SHARELINE:\s*.+$/m, "");
    item.analysisPreset = presetKey;
    proj.updatedAt = new Date().toISOString();
    await ArgusDB.Projects.save(proj);

    // Also save to history
    await saveToHistory({
      pageTitle: item.title || item.url,
      pageUrl: item.url,
      presetKey,
      presetLabel: ANALYSIS_PRESETS[presetKey]?.label || presetKey,
      content: result.content,
      thinking: result.thinking || null,
      provider: settings.provider,
      model: settings.model,
      usage: result.usage
    });

    return { success: true, cached: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Background batch analysis for projects
// ──────────────────────────────────────────────
let batchState = { running: false, projectId: null, total: 0, done: 0, current: "", errors: [], cancelled: false };

async function handleBatchAnalyzeProject(message) {
  if (batchState.running) return { success: false, error: "A batch analysis is already running." };

  const { projectId, presetKey, reanalyze } = message;
  const proj = await ArgusDB.Projects.get(projectId);
  if (!proj) return { success: false, error: "Project not found" };

  const targets = reanalyze
    ? proj.items.filter(i => i.url)
    : proj.items.filter(i => i.url && !i.summary);
  if (targets.length === 0) return { success: false, error: "No items to analyze." };

  batchState = { running: true, projectId, total: targets.length, done: 0, current: "", errors: [], cancelled: false };

  // Fire-and-forget — runs in background
  runBatchLoop(targets.map(i => i.id), projectId, presetKey);

  return { success: true, total: targets.length };
}

async function runBatchLoop(itemIds, projectId, presetKey) {
  for (const itemId of itemIds) {
    if (batchState.cancelled) break;

    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) { batchState.errors.push("Project disappeared"); break; }
    const item = proj.items.find(i => i.id === itemId);
    if (!item) { batchState.done++; continue; }

    batchState.current = item.title || item.url;

    try {
      const resp = await handleBatchAnalyzeProjectItem({ projectId, itemId, presetKey });
      if (!resp.success) {
        batchState.errors.push(`${item.title || item.url}: ${resp.error}`);
      }
    } catch (err) {
      batchState.errors.push(`${item.title || item.url}: ${err.message}`);
    }

    batchState.done++;
  }

  batchState.running = false;
  batchState.current = "";
}

function handleGetBatchStatus() {
  return {
    success: true,
    running: batchState.running,
    projectId: batchState.projectId,
    total: batchState.total,
    done: batchState.done,
    current: batchState.current,
    errors: batchState.errors,
    cancelled: batchState.cancelled
  };
}

function handleCancelBatch() {
  if (batchState.running) {
    batchState.cancelled = true;
    return { success: true };
  }
  return { success: false, error: "No batch running." };
}

// ──────────────────────────────────────────────
// Startup: migrate data to IndexedDB, cleanup, and auto-prune
// ──────────────────────────────────────────────
(async function startupInit() {
  try {
    // Migrate existing browser.storage.local data to IndexedDB (one-time)
    await ArgusDB.migrateFromStorage();
  } catch (e) {
    console.warn("[ArgusDB] Migration error (will retry next startup):", e);
  }

  // Clean up stale temporary result keys (these stay in browser.storage.local)
  try {
    const all = await browser.storage.local.get(null);
    const staleKeys = [];
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [key, val] of Object.entries(all)) {
      if (!key.startsWith("tl-result-")) continue;
      if (!val || typeof val !== "object") continue;

      if (val.status === "done" || val.status === "error") {
        staleKeys.push(key);
      } else if (val.timestamp && now - val.timestamp > maxAge) {
        staleKeys.push(key);
      }
    }

    if (staleKeys.length) {
      await browser.storage.local.remove(staleKeys);
    }
  } catch { /* startup cleanup is best-effort */ }

  // Run auto-prune rules on IndexedDB stores
  try {
    const stats = await ArgusDB.runPruneRules();
    if (stats.deleted || stats.compressed) {
      console.log("[ArgusDB] Auto-prune:", stats);
    }
  } catch { /* prune is best-effort */ }

  // Knowledge Graph: backfill from existing history (one-time)
  try {
    await KnowledgeGraph.backfillFromHistory();
  } catch (e) { console.warn("[KG] Backfill error:", e); }

  // Knowledge Graph: prune noisy entities on startup
  try {
    const pruneResult = await KnowledgeGraph.pruneNoiseEntities();
    if (pruneResult.pruned) console.log("[KG] Pruned", pruneResult.pruned, "noisy entities");
  } catch { /* prune is best-effort */ }

  // Knowledge Graph: run inference rules on startup
  try {
    const kgStats = await KnowledgeGraph.runInferenceRules();
    if (kgStats.inferred) console.log("[KG] Inferred", kgStats.inferred, "new relationships");
  } catch { /* inference is best-effort */ }

  // Set up periodic inference alarm (every 30 min)
  browser.alarms.create("kg-inference", { delayInMinutes: 30, periodInMinutes: 30 });

  // Set up scheduled digest alarm (every 6 hours — actual digest generation checks per-project schedule)
  browser.alarms.create("agent-digests", { delayInMinutes: 60, periodInMinutes: 360 });
})();
