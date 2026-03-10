// ──────────────────────────────────────────────
// Analysis presets
// ──────────────────────────────────────────────
const ANALYSIS_PRESETS = {
  summary: {
    label: "Summary",
    system: "You are a precise text analyst.",
    prompt: "Provide a clear, concise summary of the following webpage content in flowing prose paragraphs. Do NOT use bullet points or 'Key Points' sections — that is a separate analysis type. Summarize the full substance of the content: what it covers, the arguments or information presented, and any conclusions. Use markdown formatting for headings only where needed to separate major topics."
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
    label: "ELI5 (Explain Like I'm 5)",
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
    prompt: `Analyze the following sources and produce a structured research report:

## Executive Summary
A concise overview of findings across all sources (2-3 paragraphs).

## Key Findings
Numbered list of the most important findings. Each finding MUST include a source citation like [Source 1] or [Source 2, Source 3].

## Areas of Agreement
Points where multiple sources align or corroborate each other.

## Contradictions & Discrepancies
Points where sources disagree or present conflicting information.

## Gaps in Coverage
Important aspects of the topic that none of the sources adequately address.

## Recommendations
Actionable recommendations based on the synthesized findings.

## Source Assessment
Brief assessment of each source's reliability, bias, and contribution.

Use markdown formatting. Be specific and cite sources throughout.`
  },
  latenight: {
    label: "Late Night Recap",
    system: "You are a sharp-witted comedic editorial writer. Your style is punchy, irreverent, and conversational — like a late-night monologue meets a newspaper column. Use sarcasm, wit, and strong opinions. Never reference your style, influences, or that you're an AI. Just deliver the content.",
    prompt: "Recap the following page content as if you're writing your editorial column. Hit the key points but make it entertaining. Be sharp, punchy, and opinionated. Use markdown formatting."
  }
};

// ──────────────────────────────────────────────
// Language preference
// ──────────────────────────────────────────────
const BROWSER_LANG_MAP = {
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
  it: "Italian", nl: "Dutch", ru: "Russian", ja: "Japanese", ko: "Korean",
  zh: "Chinese", ar: "Arabic", hi: "Hindi", tr: "Turkish", pl: "Polish",
  uk: "Ukrainian", vi: "Vietnamese", th: "Thai", id: "Indonesian", sv: "Swedish",
  cs: "Czech", ro: "Romanian", hu: "Hungarian", el: "Greek", he: "Hebrew",
  fil: "Filipino", tl: "Filipino"
};

async function getLanguageInstruction() {
  const { responseLanguage } = await browser.storage.local.get({ responseLanguage: "auto" });
  if (!responseLanguage || responseLanguage === "" || responseLanguage === "English") return "";
  if (responseLanguage === "auto") {
    const browserLang = (navigator.language || "en").split("-")[0].toLowerCase();
    if (browserLang === "en") return "";
    const langName = BROWSER_LANG_MAP[browserLang];
    if (!langName) return "";
    return ` Respond entirely in ${langName}.`;
  }
  return ` Respond entirely in ${responseLanguage}.`;
}

// ──────────────────────────────────────────────
// Provider definitions
// ──────────────────────────────────────────────
const PROVIDERS = {
  xai: {
    label: "xAI (Grok)",
    models: {
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
    defaultModel: "grok-4-0709"
  },
  openai: {
    label: "OpenAI",
    models: {
      "gpt-4.1": "GPT-4.1",
      "gpt-4.1-mini": "GPT-4.1 Mini",
      "gpt-4.1-nano": "GPT-4.1 Nano",
      "o3": "o3",
      "o3-mini": "o3 Mini",
      "o4-mini": "o4 Mini",
      "gpt-4o": "GPT-4o",
      "gpt-4o-mini": "GPT-4o Mini"
    },
    defaultModel: "gpt-4.1"
  },
  anthropic: {
    label: "Anthropic (Claude)",
    models: {
      "claude-opus-4-6": "Claude Opus 4.6",
      "claude-sonnet-4-6": "Claude Sonnet 4.6",
      "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
      "claude-sonnet-4-5-20250514": "Claude Sonnet 4.5",
      "claude-3-5-haiku-20241022": "Claude 3.5 Haiku"
    },
    defaultModel: "claude-sonnet-4-6"
  },
  gemini: {
    label: "Google (Gemini)",
    models: {
      "gemini-2.5-pro": "Gemini 2.5 Pro",
      "gemini-2.5-flash": "Gemini 2.5 Flash",
      "gemini-2.0-flash": "Gemini 2.0 Flash",
      "gemini-2.0-flash-lite": "Gemini 2.0 Flash Lite"
    },
    defaultModel: "gemini-2.5-flash"
  }
};

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

  browser.contextMenus.create({
    id: "argus-redirect",
    parentId: "argus-parent",
    title: "\uD83D\uDD00 Redirect via Archive",
    contexts: ["page", "frame"]
  });

  browser.contextMenus.create({
    id: "argus-add-feed",
    parentId: "argus-parent",
    title: "\uD83D\uDCE1 Subscribe to Feed",
    contexts: ["page", "frame"]
  });

  // Add to Project submenu
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
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

  const results = await browser.tabs.executeScript(tab.id, {
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

  if (!results || !results[0]) throw new Error("Failed to extract page content.");

  const { title, url, description, text, selection } = results[0];
  if (!text || text.trim().length < 20) {
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
// Provider API calls (non-streaming)
// ──────────────────────────────────────────────
function handleApiError(response, errorBody, providerLabel) {
  if (response.status === 401) throw new Error(`Invalid ${providerLabel} API key. Check your key in settings.`);
  if (response.status === 429) throw new Error("Rate limited. Please wait a moment and try again.");
  if (response.status === 402 || response.status === 403) throw new Error(`Insufficient credits or access denied for ${providerLabel}.`);
  throw new Error(`${providerLabel} API error (${response.status}): ${errorBody}`);
}

function isXaiReasoningModel(model) {
  // Reasoning-capable: grok-3 (not mini), grok-4, grok-4-1-fast-reasoning, 4.20 reasoning
  return /grok-(4|3(?!-mini))/.test(model) && !/(non-reasoning)/.test(model);
}

async function callXai(apiKey, model, messages, opts) {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 2048;
  const reasoningEffort = opts.reasoningEffort || "medium";
  const extThink = opts.extendedThinking;
  const isMultiAgent = model.includes("multi-agent");
  const isResponses = isMultiAgent || model.includes("4.20");

  let url, body;
  if (isResponses) {
    url = "https://api.x.ai/v1/responses";
    body = { model, input: messages, temperature };
    if (maxTokens) body.max_output_tokens = maxTokens;
    if (isMultiAgent || isXaiReasoningModel(model)) {
      body.reasoning = { effort: reasoningEffort };
    }
  } else {
    url = "https://api.x.ai/v1/chat/completions";
    body = { model, messages, temperature, max_tokens: maxTokens };
    // Send reasoning_effort for reasoning-capable models on chat completions
    if (extThink?.enabled && isXaiReasoningModel(model)) {
      body.reasoning_effort = reasoningEffort;
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "xAI");
  const data = await response.json();

  if (isResponses) {
    const text = data.output_text || (data.output && data.output.find(o => o.type === "message")?.content?.[0]?.text);
    if (!text) throw new Error("xAI returned an empty response.");
    // Extract reasoning from responses API output
    let thinking = "";
    if (data.output) {
      for (const block of data.output) {
        if (block.type === "reasoning" && block.summary) {
          for (const s of block.summary) {
            if (s.text) thinking += s.text + "\n";
          }
        }
      }
    }
    return { content: text, thinking: thinking.trim() || null, model: data.model || model, usage: data.usage };
  } else {
    if (!data.choices || data.choices.length === 0) throw new Error("xAI returned an empty response.");
    return { content: data.choices[0].message.content, model: data.model, usage: data.usage };
  }
}

function isOpenaiReasoningModel(model) {
  return typeof model === "string" && /^o\d/i.test(model);
}

function normalizeOpenaiReasoningEffort(effort) {
  if (effort === "low" || effort === "medium" || effort === "high") return effort;
  if (effort === "xhigh") return "high";
  return "medium";
}

function getOpenaiReasoningParams(model, opts) {
  if (!opts?.extendedThinking?.enabled) return {};
  if (!isOpenaiReasoningModel(model)) return {};
  return { reasoning_effort: normalizeOpenaiReasoningEffort(opts.reasoningEffort) };
}

async function callOpenai(apiKey, model, messages, opts) {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 2048;
  const extThink = opts.extendedThinking;
  const isReasoning = isOpenaiReasoningModel(model);
  const reasoningParams = getOpenaiReasoningParams(model, opts);

  const body = { model, messages, max_tokens: maxTokens, ...reasoningParams };
  // o-series models don't support temperature
  if (!isReasoning) body.temperature = temperature;
  // Request reasoning summary for o-series when extended thinking is on
  if (isReasoning && extThink?.enabled) {
    body.reasoning = { effort: normalizeOpenaiReasoningEffort(opts.reasoningEffort), summary: "auto" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "OpenAI");
  const data = await response.json();
  if (!data.choices || data.choices.length === 0) throw new Error("OpenAI returned an empty response.");

  // Extract reasoning summary from o-series responses
  let thinking = "";
  const msg = data.choices[0].message;
  if (msg.reasoning) {
    for (const block of (Array.isArray(msg.reasoning) ? msg.reasoning : [msg.reasoning])) {
      if (block.summary) {
        for (const s of (Array.isArray(block.summary) ? block.summary : [block.summary])) {
          if (typeof s === "string") thinking += s + "\n";
          else if (s?.text) thinking += s.text + "\n";
        }
      }
    }
  }

  return { content: msg.content, thinking: thinking.trim() || null, model: data.model, usage: data.usage };
}

async function callAnthropic(apiKey, model, messages, opts) {
  const maxTokens = opts.maxTokens || 2048;
  const extendedThinking = opts.extendedThinking;

  // Separate system from messages
  const systemMsg = messages.find(m => m.role === "system");
  const nonSystem = messages.filter(m => m.role !== "system");

  const body = {
    model,
    max_tokens: maxTokens,
    system: systemMsg ? systemMsg.content : undefined,
    messages: nonSystem
  };

  // Extended thinking support
  if (extendedThinking && extendedThinking.enabled) {
    body.thinking = {
      type: "enabled",
      budget_tokens: extendedThinking.budgetTokens || 10000
    };
    // Extended thinking requires max_tokens to be higher
    body.max_tokens = Math.max(maxTokens, (extendedThinking.budgetTokens || 10000) + maxTokens);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "Anthropic");
  const data = await response.json();
  if (!data.content || data.content.length === 0) throw new Error("Anthropic returned an empty response.");

  const thinkingBlocks = data.content.filter(b => b.type === "thinking");
  const textBlocks = data.content.filter(b => b.type === "text");
  const text = textBlocks.map(block => block.text || "").join("");
  const thinking = thinkingBlocks.map(b => b.thinking || "").join("\n");

  return {
    content: text,
    thinking: thinking || undefined,
    model: data.model,
    usage: data.usage ? { prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens } : null
  };
}

function isGeminiThinkingModel(model) {
  return /gemini-2\.5/.test(model);
}

async function callGemini(apiKey, model, messages, opts) {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 2048;
  const extThink = opts.extendedThinking;

  const systemMsg = messages.find(m => m.role === "system");
  const nonSystem = messages.filter(m => m.role !== "system");

  // Convert messages to Gemini format
  const contents = nonSystem.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens }
  };
  if (systemMsg) {
    body.system_instruction = { parts: [{ text: systemMsg.content }] };
  }
  // Gemini 2.5 supports native thinking with thinkingConfig
  if (extThink?.enabled && isGeminiThinkingModel(model)) {
    body.generationConfig.thinkingConfig = {
      thinkingBudget: extThink.budgetTokens || 10000
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "Gemini");
  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts) throw new Error("Gemini returned an empty response.");

  // Separate thinking parts from content parts
  let thinking = "";
  let text = "";
  for (const part of candidate.content.parts) {
    if (part.thought) {
      thinking += (part.text || "") + "\n";
    } else {
      text += part.text || "";
    }
  }

  return {
    content: text,
    thinking: thinking.trim() || null,
    model: model,
    usage: data.usageMetadata ? { prompt_tokens: data.usageMetadata.promptTokenCount, completion_tokens: data.usageMetadata.candidatesTokenCount } : null
  };
}

// ──────────────────────────────────────────────
// Streaming API calls
// ──────────────────────────────────────────────
async function parseSSEStream(reader, onChunk, onThinking) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          onChunk(parsed);
        } catch (e) { /* skip malformed */ }
      } else if (line.startsWith("event: ")) {
        // Anthropic SSE events - handled within onChunk
      }
    }
  }
}

async function callXaiStream(apiKey, model, messages, opts, onChunk, onThinking) {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 2048;
  const extThink = opts.extendedThinking;
  const isMultiAgent = model.includes("multi-agent");
  const isResponses = isMultiAgent || model.includes("4.20");

  // Responses API doesn't support streaming in the same way — fall back to non-streaming
  if (isResponses) {
    const result = await callXai(apiKey, model, messages, opts);
    onChunk(result.content);
    if (result.thinking && onThinking) onThinking(result.thinking);
    return result;
  }

  const body = { model, messages, temperature, max_tokens: maxTokens, stream: true };
  if (extThink?.enabled && isXaiReasoningModel(model)) {
    body.reasoning_effort = opts.reasoningEffort || "medium";
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "xAI");

  let fullContent = "";
  let modelName = model;
  await parseSSEStream(response.body.getReader(), (parsed) => {
    if (parsed.model) modelName = parsed.model;
    const delta = parsed.choices?.[0]?.delta?.content;
    if (delta) {
      fullContent += delta;
      onChunk(delta);
    }
  });

  return { content: fullContent, model: modelName, usage: null };
}

async function callOpenaiStream(apiKey, model, messages, opts, onChunk, onThinking) {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 2048;
  const extThink = opts.extendedThinking;
  const isReasoning = isOpenaiReasoningModel(model);
  const reasoningParams = getOpenaiReasoningParams(model, opts);

  const body = { model, messages, max_tokens: maxTokens, stream: true, ...reasoningParams };
  if (!isReasoning) body.temperature = temperature;
  if (isReasoning && extThink?.enabled) {
    body.reasoning = { effort: normalizeOpenaiReasoningEffort(opts.reasoningEffort), summary: "auto" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "OpenAI");

  let fullContent = "";
  let fullThinking = "";
  let modelName = model;
  await parseSSEStream(response.body.getReader(), (parsed) => {
    if (parsed.model) modelName = parsed.model;
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) {
      fullContent += delta.content;
      onChunk(delta.content);
    }
    // Capture reasoning/thinking summary from o-series streaming
    if (delta?.reasoning_content) {
      fullThinking += delta.reasoning_content;
      if (onThinking) onThinking(delta.reasoning_content);
    }
  });

  return { content: fullContent, thinking: fullThinking.trim() || null, model: modelName, usage: null };
}

async function callAnthropicStream(apiKey, model, messages, opts, onChunk, onThinking) {
  const maxTokens = opts.maxTokens || 2048;
  const extendedThinking = opts.extendedThinking;
  const systemMsg = messages.find(m => m.role === "system");
  const nonSystem = messages.filter(m => m.role !== "system");

  const body = {
    model,
    max_tokens: maxTokens,
    system: systemMsg ? systemMsg.content : undefined,
    messages: nonSystem,
    stream: true
  };

  if (extendedThinking && extendedThinking.enabled) {
    body.thinking = { type: "enabled", budget_tokens: extendedThinking.budgetTokens || 10000 };
    body.max_tokens = Math.max(maxTokens, (extendedThinking.budgetTokens || 10000) + maxTokens);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "Anthropic");

  let fullContent = "";
  let fullThinking = "";
  let modelName = model;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "message_start" && parsed.message?.model) {
            modelName = parsed.message.model;
          }
          if (parsed.type === "content_block_start") {
            currentBlockType = parsed.content_block?.type;
          }
          if (parsed.type === "content_block_delta") {
            if (parsed.delta?.type === "thinking_delta" && parsed.delta.thinking) {
              fullThinking += parsed.delta.thinking;
              if (onThinking) onThinking(parsed.delta.thinking);
            } else if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
              fullContent += parsed.delta.text;
              onChunk(parsed.delta.text);
            }
          }
        } catch (e) { /* skip */ }
      }
    }
  }

  return {
    content: fullContent,
    thinking: fullThinking || undefined,
    model: modelName,
    usage: null
  };
}

async function callGeminiStream(apiKey, model, messages, opts, onChunk, onThinking) {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 2048;
  const extThink = opts.extendedThinking;
  const systemMsg = messages.find(m => m.role === "system");
  const nonSystem = messages.filter(m => m.role !== "system");

  const contents = nonSystem.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const body = { contents, generationConfig: { temperature, maxOutputTokens: maxTokens } };
  if (systemMsg) body.system_instruction = { parts: [{ text: systemMsg.content }] };
  if (extThink?.enabled && isGeminiThinkingModel(model)) {
    body.generationConfig.thinkingConfig = { thinkingBudget: extThink.budgetTokens || 10000 };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "Gemini");

  let fullContent = "";
  let fullThinking = "";
  await parseSSEStream(response.body.getReader(), (parsed) => {
    const parts = parsed.candidates?.[0]?.content?.parts;
    if (!parts) return;
    for (const part of parts) {
      if (part.thought && part.text) {
        fullThinking += part.text;
        if (onThinking) onThinking(part.text);
      } else if (part.text) {
        fullContent += part.text;
        onChunk(part.text);
      }
    }
  });

  return { content: fullContent, thinking: fullThinking.trim() || null, model: model, usage: null };
}

// ──────────────────────────────────────────────
// Provider router
// ──────────────────────────────────────────────
async function callProvider(provider, apiKey, model, messages, opts = {}) {
  switch (provider) {
    case "xai": return callXai(apiKey, model, messages, opts);
    case "openai": return callOpenai(apiKey, model, messages, opts);
    case "anthropic": return callAnthropic(apiKey, model, messages, opts);
    case "gemini": return callGemini(apiKey, model, messages, opts);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callProviderStream(provider, apiKey, model, messages, opts, onChunk, onThinking) {
  switch (provider) {
    case "xai": return callXaiStream(apiKey, model, messages, opts, onChunk, onThinking);
    case "openai": return callOpenaiStream(apiKey, model, messages, opts, onChunk, onThinking);
    case "anthropic": return callAnthropicStream(apiKey, model, messages, opts, onChunk, onThinking);
    case "gemini": return callGeminiStream(apiKey, model, messages, opts, onChunk, onThinking);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// ──────────────────────────────────────────────
// Settings helper
// ──────────────────────────────────────────────
async function getProviderSettings(overrideProvider, presetKey) {
  const settings = await browser.storage.local.get({
    defaultProvider: "xai",
    providers: {
      xai: { apiKey: "", model: "grok-4-0709" },
      openai: { apiKey: "", model: "gpt-4.1" },
      anthropic: { apiKey: "", model: "claude-sonnet-4-6" },
      gemini: { apiKey: "", model: "gemini-2.5-flash" }
    },
    maxTokens: 2048,
    maxInputChars: 100000,
    temperature: 0.3,
    reasoningEffort: "medium",
    openaiReasoningEffort: "medium",
    customPresets: {},
    extendedThinking: { enabled: false, budgetTokens: 10000 },
    apiKey: "" // Legacy
  });

  // Legacy migration
  if (settings.apiKey && !settings.providers.xai.apiKey) {
    settings.providers.xai.apiKey = settings.apiKey;
    await browser.storage.local.set({ providers: settings.providers });
  }

  // Check if preset has a bound provider (and no explicit override was given)
  let presetProvider = null;
  if (presetKey && !overrideProvider) {
    const preset = settings.customPresets[presetKey] || ANALYSIS_PRESETS[presetKey];
    if (preset?.provider) presetProvider = preset.provider;
  }

  const provider = overrideProvider || presetProvider || settings.defaultProvider;
  const providerConfig = settings.providers[provider];

  if (!providerConfig || !providerConfig.apiKey) {
    throw new Error(`No API key configured for ${PROVIDERS[provider]?.label || provider}. Open settings to add one.`);
  }

  const effectiveReasoningEffort = provider === "openai"
    ? (settings.openaiReasoningEffort || "medium")
    : (settings.reasoningEffort || "medium");

  return {
    provider,
    apiKey: providerConfig.apiKey,
    model: providerConfig.model,
    maxTokens: settings.maxTokens,
    maxInputChars: settings.maxInputChars,
    temperature: settings.temperature,
    reasoningEffort: effectiveReasoningEffort,
    customPresets: settings.customPresets || {},
    extendedThinking: settings.extendedThinking || { enabled: false, budgetTokens: 10000 }
  };
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
  const { maxHistorySize } = await browser.storage.local.get({ maxHistorySize: 200 });
  const { analysisHistory } = await browser.storage.local.get({ analysisHistory: [] });

  analysisHistory.unshift({
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...entry
  });

  // Cap history
  if (analysisHistory.length > maxHistorySize) {
    analysisHistory.length = maxHistorySize;
  }

  await browser.storage.local.set({ analysisHistory });
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

    port.postMessage({
      type: "done",
      model: result.model,
      usage: result.usage,
      provider: settings.provider,
      thinking: result.thinking,
      content: result.content,
      pageTitle: page.title
    });
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
  if (message.action === "getSelection") return handleGetSelection(message);
  if (message.action === "getOpenTabs") return handleGetOpenTabs();
  if (message.action === "getConversationState") return handleGetConversationState(message);
  if (message.action === "analyzeInTab") return handleAnalyzeInTab(message);
  if (message.action === "followUp") return handleFollowUp(message);
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
  const { analysisHistory } = await browser.storage.local.get({ analysisHistory: [] });
  const page = message.page || 0;
  const perPage = message.perPage || 50;
  const start = page * perPage;
  return {
    success: true,
    history: analysisHistory.slice(start, start + perPage),
    total: analysisHistory.length
  };
}

async function handleDeleteHistoryItem(message) {
  const { analysisHistory } = await browser.storage.local.get({ analysisHistory: [] });
  const filtered = analysisHistory.filter(h => h.id !== message.id);
  await browser.storage.local.set({ analysisHistory: filtered });
  return { success: true };
}

async function handleClearHistory() {
  await browser.storage.local.set({ analysisHistory: [] });
  return { success: true };
}

async function handleSearchHistory(message) {
  const { analysisHistory } = await browser.storage.local.get({ analysisHistory: [] });
  const query = (message.query || "").toLowerCase();
  const filtered = analysisHistory.filter(h =>
    (h.pageTitle || "").toLowerCase().includes(query) ||
    (h.pageUrl || "").toLowerCase().includes(query) ||
    (h.content || "").toLowerCase().includes(query) ||
    (h.presetLabel || "").toLowerCase().includes(query)
  );
  return { success: true, history: filtered.slice(0, 100), total: filtered.length };
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

  for (const providerKey of message.providers) {
    const settings = await getProviderSettings(providerKey);
    const baseLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets?.[message.analysisType]?.label || message.analysisType;
    const presetLabel = `${baseLabel} (${PROVIDERS[providerKey]?.label || providerKey})`;
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
    await browser.storage.local.set({ [resultId]: resultData });

    await saveToHistory({
      pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
      model: result.model, preset: message.analysisType, presetLabel,
      content: result.content, thinking: result.thinking, usage: result.usage,
      isSelection: !!message.selectedText
    });
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
// Context menu click handler
// ──────────────────────────────────────────────
browser.contextMenus.onClicked.addListener(async (info, tab) => {
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
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Bookmarked: ${page.title}`
      });
    } catch (err) {
      browser.notifications.create({
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
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Added to project: ${tab.title || tab.url}`
      });
    } catch (err) {
      browser.notifications.create({
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
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: result.success
          ? `Now monitoring: ${tab.title || tab.url}`
          : `Monitor: ${result.error}`
      });
    } catch (err) {
      browser.notifications.create({
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
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to redirect: ${err.message}`
      });
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
        browser.notifications.create({
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
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: result.success
          ? `Subscribed to feed: ${result.feed?.title || tab.title || feedUrl}`
          : `Feed: ${result.error}`
      });
    } catch (err) {
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to subscribe: ${err.message}`
      });
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

browser.webNavigation.onCompleted.addListener(async (details) => {
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
  const { smartBookmarks } = await browser.storage.local.get({ smartBookmarks: [] });

  // Check for duplicate URL
  const existingIdx = smartBookmarks.findIndex(b => b.url === pageData.url);

  const bookmark = {
    id: existingIdx >= 0 ? smartBookmarks[existingIdx].id : `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: pageData.url,
    title: pageData.title,
    text: (pageData.text || "").slice(0, 50000), // Store page text for search, capped at 50k
    savedAt: existingIdx >= 0 ? smartBookmarks[existingIdx].savedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: options.tags || [],
    category: options.category || "other",
    summary: options.summary || "",
    readingTime: options.readingTime || "",
    notes: options.notes || (existingIdx >= 0 ? smartBookmarks[existingIdx].notes : ""),
    aiTagged: !!options.aiTagged
  };

  if (existingIdx >= 0) {
    smartBookmarks[existingIdx] = bookmark;
  } else {
    smartBookmarks.unshift(bookmark);
  }

  await browser.storage.local.set({ smartBookmarks });
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
  const { smartBookmarks } = await browser.storage.local.get({ smartBookmarks: [] });

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
    b.tags.forEach(t => { allTags[t] = (allTags[t] || 0) + 1; });
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
  const { smartBookmarks } = await browser.storage.local.get({ smartBookmarks: [] });
  const idx = smartBookmarks.findIndex(b => b.id === message.id);
  if (idx < 0) return { success: false, error: "Bookmark not found." };

  if (message.tags !== undefined) smartBookmarks[idx].tags = message.tags;
  if (message.notes !== undefined) smartBookmarks[idx].notes = message.notes;
  if (message.category !== undefined) smartBookmarks[idx].category = message.category;
  smartBookmarks[idx].updatedAt = new Date().toISOString();

  await browser.storage.local.set({ smartBookmarks });
  return { success: true, bookmark: smartBookmarks[idx] };
}

async function handleDeleteBookmark(message) {
  const { smartBookmarks } = await browser.storage.local.get({ smartBookmarks: [] });
  const filtered = smartBookmarks.filter(b => b.id !== message.id);
  await browser.storage.local.set({ smartBookmarks: filtered });
  return { success: true };
}

async function handleExportBookmarks() {
  const { smartBookmarks } = await browser.storage.local.get({ smartBookmarks: [] });
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

// Notification click handler — opens the monitored page
browser.notifications.onClicked.addListener(async (notificationId) => {
  const monitorId = notificationMonitorMap.get(notificationId);
  if (!monitorId) return;

  notificationMonitorMap.delete(notificationId);

  const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
  const monitor = pageMonitors.find(m => m.id === monitorId);
  if (!monitor) return;

  // Auto-open: open the page directly
  browser.tabs.create({ url: monitor.url });

  // Clear unread count for this monitor
  await clearMonitorUnread(monitorId);
});

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

async function fetchPageText(url) {
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Remove scripts, styles, nav, footer
  doc.querySelectorAll("script, style, nav, footer, header, aside").forEach(el => el.remove());
  const article = doc.querySelector("article") || doc.querySelector("main") || doc.querySelector('[role="main"]') || doc.body;
  return article ? article.textContent.replace(/\s+/g, " ").trim() : "";
}

async function handleAddMonitor(message) {
  try {
    const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });

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

    pageMonitors.push(monitor);
    await browser.storage.local.set({ pageMonitors });

    // Save initial snapshot for the timeline
    const snapshotKey = `monitor-snapshots-${monitor.id}`;
    const initialSnapshot = {
      id: `snap-${Date.now()}`,
      capturedAt: new Date().toISOString(),
      hash,
      text: text.slice(0, 5000),
      isInitial: true
    };
    await browser.storage.local.set({ [snapshotKey]: [initialSnapshot] });

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
  const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
  return { success: true, monitors: pageMonitors };
}

async function handleUpdateMonitor(message) {
  const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
  const idx = pageMonitors.findIndex(m => m.id === message.id);
  if (idx < 0) return { success: false, error: "Monitor not found." };

  if (message.intervalMinutes !== undefined) pageMonitors[idx].intervalMinutes = message.intervalMinutes;
  if (message.enabled !== undefined) pageMonitors[idx].enabled = message.enabled;
  if (message.aiAnalysis !== undefined) pageMonitors[idx].aiAnalysis = message.aiAnalysis;
  if (message.autoOpen !== undefined) pageMonitors[idx].autoOpen = message.autoOpen;
  if (message.autoBookmark !== undefined) pageMonitors[idx].autoBookmark = message.autoBookmark;
  if (message.analysisPreset !== undefined) pageMonitors[idx].analysisPreset = message.analysisPreset;
  if (message.duration !== undefined) {
    pageMonitors[idx].duration = message.duration;
    pageMonitors[idx].expiresAt = message.duration ? new Date(Date.now() + message.duration * 3600000).toISOString() : null;
    pageMonitors[idx].expired = false;
  }

  await browser.storage.local.set({ pageMonitors });

  // Update alarm
  const alarmName = `${MONITOR_ALARM_PREFIX}${pageMonitors[idx].id}`;
  await browser.alarms.clear(alarmName);
  if (pageMonitors[idx].enabled) {
    browser.alarms.create(alarmName, {
      delayInMinutes: pageMonitors[idx].intervalMinutes,
      periodInMinutes: pageMonitors[idx].intervalMinutes
    });
  }

  // Sync linked bookmark summary with current monitor settings
  const mon = pageMonitors[idx];
  if (mon.autoBookmark) {
    const { smartBookmarks } = await browser.storage.local.get({ smartBookmarks: [] });
    const bmIdx = smartBookmarks.findIndex(b => b.url === mon.url);
    if (bmIdx >= 0) {
      const interval = mon.intervalMinutes >= 60 ? `${mon.intervalMinutes / 60}h` : `${mon.intervalMinutes}min`;
      const presetStr = mon.analysisPreset ? ` | preset: ${mon.analysisPreset}` : "";
      smartBookmarks[bmIdx].summary = mon.lastChangeSummary
        ? `${mon.lastChangeSummary.slice(0, 200)} — monitored every ${interval}${presetStr}`
        : `Auto-bookmarked — monitored every ${interval}${presetStr}`;
      smartBookmarks[bmIdx].updatedAt = new Date().toISOString();
      await browser.storage.local.set({ smartBookmarks });
    }
  }

  return { success: true, monitor: pageMonitors[idx] };
}

async function handleDeleteMonitor(message) {
  const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
  const monitor = pageMonitors.find(m => m.id === message.id);
  if (monitor) {
    await browser.alarms.clear(`${MONITOR_ALARM_PREFIX}${monitor.id}`);
    // Clean up associated storage
    await browser.storage.local.remove([
      `monitor-history-${monitor.id}`,
      `monitor-snapshots-${monitor.id}`
    ]);
    await clearMonitorUnread(monitor.id);
  }
  const filtered = pageMonitors.filter(m => m.id !== message.id);
  await browser.storage.local.set({ pageMonitors: filtered });
  return { success: true };
}

async function handleGetMonitorHistory(message) {
  const key = `monitor-history-${message.monitorId}`;
  const stored = await browser.storage.local.get({ [key]: [] });
  return { success: true, history: stored[key] };
}

async function handleGetMonitorSnapshots(message) {
  const key = `monitor-snapshots-${message.monitorId}`;
  const stored = await browser.storage.local.get({ [key]: [] });
  return { success: true, snapshots: stored[key] };
}

async function handleGetMonitorStorageUsage() {
  const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
  let totalBytes = JSON.stringify(pageMonitors).length;
  const perMonitor = [];

  for (const monitor of pageMonitors) {
    let monitorBytes = JSON.stringify(monitor).length;
    const snapshotKey = `monitor-snapshots-${monitor.id}`;
    const historyKey = `monitor-history-${monitor.id}`;
    const { [snapshotKey]: snapshots } = await browser.storage.local.get({ [snapshotKey]: [] });
    const { [historyKey]: history } = await browser.storage.local.get({ [historyKey]: [] });
    const snapBytes = JSON.stringify(snapshots).length;
    const histBytes = JSON.stringify(history).length;
    monitorBytes += snapBytes + histBytes;
    totalBytes += snapBytes + histBytes;
    perMonitor.push({
      id: monitor.id,
      title: monitor.title || monitor.url,
      bytes: monitorBytes,
      snapshots: snapshots.length,
      historyEntries: history.length
    });
  }

  return { success: true, totalBytes, perMonitor };
}

// Alarm handler for periodic page checks
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(MONITOR_ALARM_PREFIX)) return;

  const monitorId = alarm.name.slice(MONITOR_ALARM_PREFIX.length);
  const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
  const idx = pageMonitors.findIndex(m => m.id === monitorId);
  if (idx < 0) return;

  const monitor = pageMonitors[idx];
  if (!monitor.enabled) return;

  // Check if monitor has expired
  if (monitor.expiresAt && new Date(monitor.expiresAt).getTime() <= Date.now()) {
    monitor.enabled = false;
    monitor.expired = true;
    pageMonitors[idx] = monitor;
    await browser.storage.local.set({ pageMonitors });
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
    const snapshotKey = `monitor-snapshots-${monitor.id}`;
    const { [snapshotKey]: snapshots } = await browser.storage.local.get({ [snapshotKey]: [] });
    const snapshot = {
      id: `snap-${Date.now()}`,
      capturedAt: now,
      hash: newHash,
      text: newText.slice(0, 5000),
      changed: newHash !== monitor.lastHash
    };
    snapshots.unshift(snapshot);
    // Keep last 100 snapshots per monitor
    if (snapshots.length > 100) snapshots.length = 100;
    await browser.storage.local.set({ [snapshotKey]: snapshots });

    if (newHash !== monitor.lastHash) {
      monitor.changeCount++;
      const oldText = monitor.lastText;
      monitor.lastHash = newHash;
      monitor.lastText = newText.slice(0, 10000);

      // Save change to history
      const historyKey = `monitor-history-${monitor.id}`;
      const { [historyKey]: history } = await browser.storage.local.get({ [historyKey]: [] });

      const changeEntry = {
        id: `chg-${Date.now()}`,
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

      history.unshift(changeEntry);
      if (history.length > 50) history.length = 50;
      await browser.storage.local.set({ [historyKey]: history });

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
      browser.notifications.create(notifId, {
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

    pageMonitors[idx] = monitor;
    await browser.storage.local.set({ pageMonitors });
  } catch (err) {
    console.warn(`[Monitor] Check failed for "${monitor.title}" (${monitor.url}):`, err.message);

    monitor.lastChecked = new Date().toISOString();
    pageMonitors[idx] = monitor;
    await browser.storage.local.set({ pageMonitors });
  }
});

// Restore alarms on startup and catch up on any overdue monitors
(async () => {
  const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
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
        const snapshotKey = `monitor-snapshots-${monitor.id}`;
        const { [snapshotKey]: snapshots } = await browser.storage.local.get({ [snapshotKey]: [] });
        snapshots.unshift({
          id: `snap-${Date.now()}`,
          capturedAt: catchupNow,
          hash: newHash,
          text: newText.slice(0, 5000),
          changed: newHash !== monitor.lastHash
        });
        if (snapshots.length > 100) snapshots.length = 100;
        await browser.storage.local.set({ [snapshotKey]: snapshots });

        if (newHash !== monitor.lastHash) {
          monitor.changeCount++;
          const oldText = monitor.lastText;
          monitor.lastHash = newHash;
          monitor.lastText = newText.slice(0, 10000);

          const historyKey = `monitor-history-${monitor.id}`;
          const { [historyKey]: history } = await browser.storage.local.get({ [historyKey]: [] });

          const changeEntry = {
            id: `chg-${Date.now()}`,
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

          history.unshift(changeEntry);
          if (history.length > 50) history.length = 50;
          await browser.storage.local.set({ [historyKey]: history });

          monitor.lastChangeSummary = changeEntry.aiSummary || `Content changed (${new Date(catchupNow).toLocaleString()})`;
          monitor.lastChangeAt = catchupNow;

          await incrementMonitorBadge(monitor.id);

          const notifId = `monitor-catchup-${monitor.id}-${Date.now()}`;
          notificationMonitorMap.set(notifId, monitor.id);
          browser.notifications.create(notifId, {
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
    await browser.storage.local.set({ pageMonitors });
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
  }
});

// Intercept requests before they load
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
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
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

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
    const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });

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

    rssFeeds.push(feed);
    await browser.storage.local.set({ rssFeeds });

    // Save initial entries
    const entryKey = `feed-entries-${feed.id}`;
    await browser.storage.local.set({ [entryKey]: parsed.entries.slice(0, 100) });

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
  const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
  // Include unread counts
  const feeds = [];
  for (const feed of rssFeeds) {
    const entryKey = `feed-entries-${feed.id}`;
    const { [entryKey]: entries } = await browser.storage.local.get({ [entryKey]: [] });
    feeds.push({ ...feed, unreadCount: entries.filter(e => !e.read).length, totalEntries: entries.length });
  }
  return { success: true, feeds };
}

async function handleGetFeedEntries(message) {
  if (message.feedId) {
    const entryKey = `feed-entries-${message.feedId}`;
    const { [entryKey]: entries } = await browser.storage.local.get({ [entryKey]: [] });
    return { success: true, entries };
  }
  // All feeds — combine and sort by date
  const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
  let allEntries = [];
  for (const feed of rssFeeds) {
    const entryKey = `feed-entries-${feed.id}`;
    const { [entryKey]: entries } = await browser.storage.local.get({ [entryKey]: [] });
    allEntries.push(...entries.map(e => ({ ...e, feedId: feed.id, feedTitle: feed.title })));
  }
  allEntries.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return { success: true, entries: allEntries.slice(0, 200) };
}

async function handleDeleteFeed(message) {
  const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
  const feed = rssFeeds.find(f => f.id === message.id);
  if (feed) {
    await browser.alarms.clear(`${RSS_ALARM_PREFIX}${feed.id}`);
    await browser.storage.local.remove([`feed-entries-${feed.id}`]);
  }
  await browser.storage.local.set({ rssFeeds: rssFeeds.filter(f => f.id !== message.id) });
  return { success: true };
}

async function handleDeleteAllFeeds() {
  const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
  const keysToRemove = rssFeeds.map(f => `feed-entries-${f.id}`);
  for (const feed of rssFeeds) {
    await browser.alarms.clear(`${RSS_ALARM_PREFIX}${feed.id}`);
  }
  if (keysToRemove.length) await browser.storage.local.remove(keysToRemove);
  await browser.storage.local.set({ rssFeeds: [] });
  return { success: true };
}

async function handleUpdateFeed(message) {
  const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
  const idx = rssFeeds.findIndex(f => f.id === message.id);
  if (idx < 0) return { success: false, error: "Feed not found." };

  if (message.enabled !== undefined) rssFeeds[idx].enabled = message.enabled;
  if (message.checkIntervalMinutes !== undefined) rssFeeds[idx].checkIntervalMinutes = message.checkIntervalMinutes;
  if (message.aiSummarize !== undefined) rssFeeds[idx].aiSummarize = message.aiSummarize;
  if (message.title !== undefined) rssFeeds[idx].title = message.title;

  await browser.storage.local.set({ rssFeeds });

  // Update alarm
  const alarmName = `${RSS_ALARM_PREFIX}${rssFeeds[idx].id}`;
  await browser.alarms.clear(alarmName);
  if (rssFeeds[idx].enabled) {
    browser.alarms.create(alarmName, {
      delayInMinutes: rssFeeds[idx].checkIntervalMinutes,
      periodInMinutes: rssFeeds[idx].checkIntervalMinutes
    });
  }

  return { success: true, feed: rssFeeds[idx] };
}

async function handleMarkFeedEntryRead(message) {
  const entryKey = `feed-entries-${message.feedId}`;
  const { [entryKey]: entries } = await browser.storage.local.get({ [entryKey]: [] });
  const entry = entries.find(e => e.id === message.entryId);
  if (entry) entry.read = true;
  await browser.storage.local.set({ [entryKey]: entries });
  return { success: true };
}

async function handleMarkAllFeedRead(message) {
  const entryKey = `feed-entries-${message.feedId}`;
  const { [entryKey]: entries } = await browser.storage.local.get({ [entryKey]: [] });
  entries.forEach(e => { e.read = true; });
  await browser.storage.local.set({ [entryKey]: entries });
  return { success: true };
}

async function handleRefreshFeed(message) {
  const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
  const feed = rssFeeds.find(f => f.id === message.id);
  if (!feed) return { success: false, error: "Feed not found." };
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

    const entryKey = `feed-entries-${feed.id}`;
    const { [entryKey]: existingEntries } = await browser.storage.local.get({ [entryKey]: [] });
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

      const merged = [...newEntries, ...existingEntries].slice(0, 200);
      await browser.storage.local.set({ [entryKey]: merged });

      // Notification for new entries
      if (newEntries.length > 0) {
        browser.notifications.create(`rss-${feed.id}-${Date.now()}`, {
          type: "basic",
          iconUrl: "icons/icon-96.png",
          title: `${feed.title}: ${newEntries.length} new`,
          message: newEntries.slice(0, 3).map(e => e.title).join(" | ")
        });
      }

      // Monitor bridge — if enabled, create a change entry on the linked monitor
      if (feed.monitorBridge) {
        const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
        const linkedMonitor = pageMonitors.find(m => m.url === feed.siteUrl || m.url === feed.url);
        if (linkedMonitor) {
          linkedMonitor.changeCount += newEntries.length;
          linkedMonitor.lastChangeSummary = `${newEntries.length} new RSS entries: ${newEntries.slice(0, 2).map(e => e.title).join(", ")}`;
          linkedMonitor.lastChangeAt = new Date().toISOString();
          await browser.storage.local.set({ pageMonitors });
        }
      }
    }

    // Update feed metadata
    feed.lastFetched = new Date().toISOString();
    const feedIdx = allFeeds.findIndex(f => f.id === feed.id);
    if (feedIdx >= 0) {
      allFeeds[feedIdx] = feed;
      await browser.storage.local.set({ rssFeeds: allFeeds });
    }
  } catch (err) {
    console.warn(`[RSS] Failed to check feed "${feed.title}":`, err.message);
  }
}

// RSS alarm handler — hook into existing alarm listener
const origAlarmHandler = browser.alarms.onAlarm.hasListener;
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(RSS_ALARM_PREFIX)) return;

  const feedId = alarm.name.slice(RSS_ALARM_PREFIX.length);
  const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
  const feed = rssFeeds.find(f => f.id === feedId);
  if (!feed || !feed.enabled) return;

  await checkFeedForUpdates(feed, rssFeeds);
});

// Restore RSS alarms on startup
(async () => {
  const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
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
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
  return { success: true, projects: argusProjects };
}

async function handleCreateProject(message) {
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
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
  argusProjects.unshift(project);
  await browser.storage.local.set({ argusProjects });
  return { success: true, project };
}

async function handleUpdateProject(message) {
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
  const idx = argusProjects.findIndex(p => p.id === message.projectId);
  if (idx === -1) return { success: false, error: "Project not found" };
  const proj = argusProjects[idx];
  if (message.name !== undefined) proj.name = message.name;
  if (message.description !== undefined) proj.description = message.description;
  if (message.starred !== undefined) proj.starred = message.starred;
  if (message.color !== undefined) proj.color = message.color;
  proj.updatedAt = new Date().toISOString();
  await browser.storage.local.set({ argusProjects });
  return { success: true, project: proj };
}

async function handleDeleteProject(message) {
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
  const filtered = argusProjects.filter(p => p.id !== message.projectId);
  await browser.storage.local.set({ argusProjects: filtered });
  return { success: true };
}

async function handleAddProjectItem(message) {
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
  const proj = argusProjects.find(p => p.id === message.projectId);
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
  await browser.storage.local.set({ argusProjects });
  return { success: true, item };
}

async function handleUpdateProjectItem(message) {
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
  const proj = argusProjects.find(p => p.id === message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  const item = proj.items.find(i => i.id === message.itemId);
  if (!item) return { success: false, error: "Item not found" };
  if (message.notes !== undefined) item.notes = message.notes;
  if (message.tags !== undefined) item.tags = message.tags;
  if (message.title !== undefined) item.title = message.title;
  proj.updatedAt = new Date().toISOString();
  await browser.storage.local.set({ argusProjects });
  return { success: true, item };
}

async function handleRemoveProjectItem(message) {
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
  const proj = argusProjects.find(p => p.id === message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  proj.items = proj.items.filter(i => i.id !== message.itemId);
  proj.updatedAt = new Date().toISOString();
  await browser.storage.local.set({ argusProjects });
  return { success: true };
}

async function handleExportProject(message) {
  const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
  const proj = argusProjects.find(p => p.id === message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  return { success: true, project: proj };
}
