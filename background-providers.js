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

// ──────────────────────────────────────────────
// Custom OpenAI-compatible provider
// ──────────────────────────────────────────────
async function getCustomProviderConfig() {
  const { providers } = await browser.storage.local.get({ providers: {} });
  const cfg = providers.custom || {};
  if (!cfg.baseUrl) throw new Error("Custom provider: no Base URL configured. Set it in Settings → AI Providers → Custom.");
  // Ensure baseUrl ends without trailing slash
  const baseUrl = cfg.baseUrl.replace(/\/+$/, "");
  const model = cfg.model || "default";
  return { baseUrl, model, apiKey: cfg.apiKey };
}

async function callCustom(apiKey, model, messages, opts) {
  const cfg = await getCustomProviderConfig();
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 2048;
  const body = { model: cfg.model, messages, max_tokens: maxTokens, temperature };

  const response = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "Custom");
  const data = await response.json();
  if (!data.choices || data.choices.length === 0) throw new Error("Custom provider returned an empty response.");
  return { content: data.choices[0].message.content, thinking: null, model: data.model || cfg.model, usage: data.usage };
}

async function callCustomStream(apiKey, model, messages, opts, onChunk, onThinking) {
  const cfg = await getCustomProviderConfig();
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 2048;
  const body = { model: cfg.model, messages, max_tokens: maxTokens, temperature, stream: true };

  const response = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!response.ok) handleApiError(response, await response.text(), "Custom");

  let fullContent = "";
  let modelName = cfg.model;
  await parseSSEStream(response.body.getReader(), (parsed) => {
    if (parsed.model) modelName = parsed.model;
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) {
      fullContent += delta.content;
      onChunk(delta.content);
    }
  });

  return { content: fullContent, thinking: null, model: modelName, usage: null };
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
  let currentBlockType = null;
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

  const contents = nonSystem.map(m => {
    let parts;
    if (Array.isArray(m.content)) {
      // Multimodal content — convert to Gemini parts format
      parts = m.content.map(block => {
        if (block.type === "text") return { text: block.text };
        if (block.type === "inline_data" && block.inline_data) {
          return { inline_data: block.inline_data };
        }
        if (block.type === "image_url" && block.image_url?.url) {
          return { text: `[Image: ${block.image_url.url}]` };
        }
        return { text: typeof block === "string" ? block : JSON.stringify(block) };
      });
    } else {
      parts = [{ text: m.content }];
    }
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });

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
// Vision API calls (image + text prompts)
// ──────────────────────────────────────────────

/**
 * Build a vision message with images for the appropriate provider format.
 * @param {string} provider - "xai", "openai", "anthropic", "gemini", "custom"
 * @param {string} systemPrompt - System instruction
 * @param {string} userPrompt - User text prompt
 * @param {Array<{base64: string, mimeType: string}>} imageDataList - Images as base64
 * @returns {Object} { messages, geminiContents, geminiSystem } formatted for the provider
 */
function buildVisionMessages(provider, systemPrompt, userPrompt, imageDataList) {
  if (provider === "anthropic") {
    // Anthropic: content array with image blocks
    const userContent = [];
    for (const img of imageDataList) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.base64 }
      });
    }
    userContent.push({ type: "text", text: userPrompt });
    return {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    };
  }

  if (provider === "gemini") {
    // Gemini: parts array with inline_data
    const parts = [];
    for (const img of imageDataList) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
    }
    parts.push({ text: userPrompt });
    return {
      geminiContents: [{ role: "user", parts }],
      geminiSystem: systemPrompt
    };
  }

  // OpenAI / xAI / Custom: content array with image_url blocks
  const userContent = [];
  for (const img of imageDataList) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "low" }
    });
  }
  userContent.push({ type: "text", text: userPrompt });
  return {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ]
  };
}

/**
 * Call any provider with vision (image) content.
 * @param {string} provider
 * @param {string} apiKey
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {Array<{base64: string, mimeType: string}>} imageDataList
 * @param {Object} opts - { maxTokens, temperature }
 * @returns {Promise<{content: string, model: string}>}
 */
async function callProviderVision(provider, apiKey, model, systemPrompt, userPrompt, imageDataList, opts = {}) {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens || 1024;

  if (provider === "gemini") {
    const { geminiContents, geminiSystem } = buildVisionMessages(provider, systemPrompt, userPrompt, imageDataList);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: geminiContents,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    };
    if (geminiSystem) body.system_instruction = { parts: [{ text: geminiSystem }] };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) handleApiError(response, await response.text(), "Gemini");
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    return { content: text, model };
  }

  if (provider === "anthropic") {
    const { messages } = buildVisionMessages(provider, systemPrompt, userPrompt, imageDataList);
    const systemMsg = messages.find(m => m.role === "system");
    const nonSystem = messages.filter(m => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        system: systemMsg?.content,
        messages: nonSystem
      })
    });
    if (!response.ok) handleApiError(response, await response.text(), "Anthropic");
    const data = await response.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    return { content: text, model: data.model || model };
  }

  // xAI, OpenAI, Custom — all use OpenAI-compatible format
  const { messages } = buildVisionMessages(provider, systemPrompt, userPrompt, imageDataList);
  let url, headers;
  if (provider === "custom") {
    const cfg = await getCustomProviderConfig();
    url = `${cfg.baseUrl}/v1/chat/completions`;
    headers = { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.apiKey}` };
    model = cfg.model;
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
  } else {
    // xAI
    url = "https://api.x.ai/v1/chat/completions";
    headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
  });
  if (!response.ok) handleApiError(response, await response.text(), provider === "custom" ? "Custom" : provider === "openai" ? "OpenAI" : "xAI");
  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content || "", model: data.model || model };
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
    case "custom": return callCustom(apiKey, model, messages, opts);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callProviderStream(provider, apiKey, model, messages, opts, onChunk, onThinking) {
  switch (provider) {
    case "xai": return callXaiStream(apiKey, model, messages, opts, onChunk, onThinking);
    case "openai": return callOpenaiStream(apiKey, model, messages, opts, onChunk, onThinking);
    case "anthropic": return callAnthropicStream(apiKey, model, messages, opts, onChunk, onThinking);
    case "gemini": return callGeminiStream(apiKey, model, messages, opts, onChunk, onThinking);
    case "custom": return callCustomStream(apiKey, model, messages, opts, onChunk, onThinking);
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
    throw new Error(`No API key configured for ${PROVIDERS[provider]?.label || provider}. Open Argus Settings to add one.`);
  }

  return {
    provider,
    apiKey: providerConfig.apiKey,
    model: providerConfig.model || PROVIDERS[provider]?.defaultModel || "",
    maxTokens: settings.maxTokens,
    maxInputChars: settings.maxInputChars,
    temperature: settings.temperature,
    reasoningEffort: provider === "openai" ? (settings.openaiReasoningEffort || settings.reasoningEffort) : settings.reasoningEffort,
    customPresets: settings.customPresets,
    extendedThinking: settings.extendedThinking
  };
}
