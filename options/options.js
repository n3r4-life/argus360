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
  },
  mediabias: {
    label: "Media Bias Breakdown",
    system: "You are a media literacy analyst specializing in comparative coverage analysis, editorial framing, and source bias detection.",
    prompt: "Analyze this page's coverage of the underlying news story. Produce a breakdown: story overview, coverage spectrum (map outlets to bias positions), framing analysis, blind spots, source links, and deep research leads. Use markdown formatting."
  },
  competitorintel: {
    label: "Competitor Intel",
    system: "You are a competitive intelligence analyst with expertise in market positioning, strategic moves, and business signal detection.",
    prompt: "Analyze this page for competitive intelligence signals: company/product overview, strategic signals, strengths & vulnerabilities, market implications, and actionable takeaways. Use markdown formatting."
  },
  financialanalysis: {
    label: "Financial Analysis",
    system: "You are a financial analyst skilled at extracting and interpreting financial data, market signals, and economic indicators from text.",
    prompt: "Extract and analyze all financial information: financial summary, numbers & data table, market signals, comparison context, and red flags. Use markdown formatting."
  },
  supplychainrisk: {
    label: "Supply Chain Risk",
    system: "You are a supply chain risk analyst specializing in identifying vulnerabilities, dependencies, and disruption signals across global supply networks.",
    prompt: "Analyze this page for supply chain intelligence: entities involved, risk signals, dependencies map, disruption indicators, and mitigation considerations. Use markdown formatting."
  },
  threatassessment: {
    label: "Threat Assessment",
    system: "You are a security analyst specializing in threat intelligence, risk assessment, and situational awareness.",
    prompt: "Perform a threat assessment: situation overview, threat actors, risk factors, indicators & warnings, information gaps, and recommended actions. Use markdown formatting."
  },
  crisismonitor: {
    label: "Crisis Monitor",
    system: "You are a crisis monitoring analyst who tracks developing situations, extracts key updates, and provides situational awareness briefings.",
    prompt: "Analyze this page as a developing crisis: situation status, what happened, impact assessment, response actions, key unknowns, next expected developments, and source reliability. Use markdown formatting."
  },
  deepfakeflags: {
    label: "Deepfake / Manipulation Flags",
    system: "You are a digital forensics and media manipulation expert.",
    prompt: "Analyze this page for manipulation and authenticity red flags: content authenticity assessment, red flags detected, source verification, provenance trail, and confidence assessment. Use markdown formatting."
  },
  propaganda: {
    label: "Propaganda Detection",
    system: "You are an expert in propaganda analysis, influence operations, and persuasion techniques.",
    prompt: "Analyze this page for propaganda and persuasion techniques: techniques identified with quotes, target audience, narrative framework, what's missing, and effectiveness assessment. Use markdown formatting."
  },
  influencermap: {
    label: "Influencer / Network Map",
    system: "You are a social network analyst specializing in mapping influence networks and relationship dynamics.",
    prompt: "Map the influence network: key actors, relationship map, power structure, information flow, hidden connections, and network vulnerabilities. Use markdown formatting."
  },
  technicalbreakdown: {
    label: "Technical Breakdown",
    system: "You are a senior technical analyst who breaks down complex technical content for both technical and non-technical audiences.",
    prompt: "Provide a technical breakdown: TL;DR, technical details, how it works, dependencies & requirements, strengths & limitations, practical implications, and related technologies. Use markdown formatting."
  },
  timeline: {
    label: "Timeline Reconstruction",
    system: "You are a chronological analyst who reconstructs timelines from scattered information.",
    prompt: "Reconstruct a detailed timeline: events in chronological order with dates, pre-history, gaps, causal chain, and key turning points. Use markdown formatting."
  },
  dataextraction: {
    label: "Data Extraction",
    system: "You are a data extraction specialist who pulls structured data from unstructured text.",
    prompt: "Extract all structured data: statistics & numbers table, dates & deadlines, named entities, lists & categories, quotes, and URLs & references. Use markdown formatting."
  },
  legalrisk: {
    label: "Legal / Regulatory Risk",
    system: "You are a legal risk analyst who identifies regulatory exposure and compliance concerns.",
    prompt: "Analyze for legal and regulatory risk: jurisdiction, risk areas, compliance concerns, liability exposure, pending litigation, and recommended review areas. This is analysis, not legal advice. Use markdown formatting."
  },
  comparecontrast: {
    label: "Compare & Contrast",
    system: "You are an analytical comparison expert who identifies similarities, differences, and trade-offs.",
    prompt: "Produce a structured comparison: items being compared, comparison matrix table, key similarities, key differences, trade-offs, winner by category, and missing comparisons. Use markdown formatting."
  },
  narrativeanalysis: {
    label: "Narrative Analysis",
    system: "You are a narrative analyst who deconstructs how stories are told — structure, framing, rhetoric, and authorial choices.",
    prompt: "Deconstruct the narrative: narrative summary, structure & framing, rhetorical devices, voice & perspective, audience & intent, subtext, and effectiveness. Use markdown formatting."
  },
  tldr: {
    label: "TLDR Briefing",
    system: "You are an expert at distilling complex content into ultra-concise briefings. Every word counts.",
    prompt: "Give the fastest possible briefing: TLDR (one sentence), Key Facts (3-5 bullets), So What? (one sentence), What's Next? (one sentence). Keep under 150 words."
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
let feedKeywordRoutes = [];
let saveTimeout = null;

// ──────────────────────────────────────────────
// Interval stepper utility
// ──────────────────────────────────────────────
const INTERVAL_STEPS = [
  1, 2, 3, 4, 5, 10, 15, 30, 45,
  60, 75, 90, 180, 360, 720,
  1440, 2160, 2880, 4320,
  10080, 20160, 43200
];

function formatInterval(mins) {
  if (mins >= 43200) return `${Math.round(mins / 43200)}mo`;
  if (mins >= 10080) return `${Math.round(mins / 10080)}w`;
  if (mins >= 1440) return `${(mins / 1440).toFixed(mins % 1440 ? 1 : 0).replace(/\.0$/, "")}d`;
  if (mins >= 60) return `${(mins / 60).toFixed(mins % 60 ? 1 : 0).replace(/\.0$/, "")}h`;
  return `${mins}m`;
}

function nearestStepIndex(mins) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < INTERVAL_STEPS.length; i++) {
    const d = Math.abs(INTERVAL_STEPS[i] - mins);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function initIntervalStepper(containerId, hiddenId, displayId, initialMins) {
  const container = document.getElementById(containerId);
  const hidden = document.getElementById(hiddenId);
  const display = document.getElementById(displayId);
  if (!container || !hidden || !display) return;

  let idx = nearestStepIndex(initialMins || 60);
  hidden.value = INTERVAL_STEPS[idx];
  display.textContent = formatInterval(INTERVAL_STEPS[idx]);

  container.querySelectorAll(".interval-step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = parseInt(btn.dataset.dir);
      idx = Math.max(0, Math.min(INTERVAL_STEPS.length - 1, idx + dir));
      hidden.value = INTERVAL_STEPS[idx];
      display.textContent = formatInterval(INTERVAL_STEPS[idx]);
    });
  });

  return {
    getValue: () => INTERVAL_STEPS[idx],
    setValue: (mins) => {
      idx = nearestStepIndex(mins);
      hidden.value = INTERVAL_STEPS[idx];
      display.textContent = formatInterval(INTERVAL_STEPS[idx]);
    }
  };
}

function createInlineIntervalStepper(currentMins, onChange) {
  const outer = document.createElement("div");
  outer.style.cssText = "display:inline-flex;flex-direction:column;align-items:center;gap:2px;";

  const wrap = document.createElement("div");
  wrap.className = "interval-stepper";
  wrap.title = "Pause & resume for new interval to take effect";

  let idx = nearestStepIndex(currentMins || 60);
  const origIdx = idx;

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "interval-step-btn";
  downBtn.textContent = "\u25BE";

  const display = document.createElement("span");
  display.className = "interval-display";
  display.textContent = formatInterval(INTERVAL_STEPS[idx]);

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "interval-step-btn";
  upBtn.textContent = "\u25B4";

  const hint = document.createElement("span");
  hint.style.cssText = "font-size:10px;color:var(--accent);opacity:0;transition:opacity 0.3s;white-space:nowrap;";
  hint.textContent = "pause & resume to apply";

  function step(dir) {
    idx = Math.max(0, Math.min(INTERVAL_STEPS.length - 1, idx + dir));
    display.textContent = formatInterval(INTERVAL_STEPS[idx]);
    if (onChange) onChange(INTERVAL_STEPS[idx]);
    // Show hint when interval changed from original
    hint.style.opacity = idx !== origIdx ? "1" : "0";
  }

  downBtn.addEventListener("click", () => step(-1));
  upBtn.addEventListener("click", () => step(1));

  wrap.appendChild(downBtn);
  wrap.appendChild(display);
  wrap.appendChild(upBtn);
  outer.appendChild(wrap);
  outer.appendChild(hint);
  return outer;
}

// ──────────────────────────────────────────────
// Bookmark tagging default
// ──────────────────────────────────────────────
const DEFAULT_BOOKMARK_TAG_PROMPT = `Analyze this webpage and generate smart metadata for bookmarking.

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
- readingTime: Estimated reading time.`;

// ──────────────────────────────────────────────
// Advanced prompt definitions (key → { label, group, system, prompt })
// ──────────────────────────────────────────────
const ADVANCED_PROMPT_DEFS = {
  // Dashboard Reports
  "report.executiveSummary": {
    label: "Executive Summary", group: "Dashboard Reports",
    system: "You are an intelligence analyst writing a concise executive summary. Be direct and actionable.",
    prompt: "Write an executive summary for this OSINT project. You have the following data:\n\n**Project:** {projectName}\n**Description:** {projectDescription}\n**Items collected:** {itemCount}\n**Knowledge Graph entities:** {entityCount}\n**Date range:** {dateRange}\n\n**Recent items:**\n{recentItems}\n\n**Top entities from Knowledge Graph:**\n{topEntities}\n\n**Key relationships:**\n{keyRelationships}\n\nWrite a 3-5 paragraph executive summary covering:\n1. Project scope and focus\n2. Key findings and patterns\n3. Notable entities and connections\n4. Recommended next steps\n\nBe specific \u2014 reference actual entities and findings from the data."
  },
  "report.knowledgeGaps": {
    label: "Knowledge Gaps", group: "Dashboard Reports",
    system: "You are a research analyst identifying gaps in intelligence collection.",
    prompt: "Analyze this project's coverage and identify knowledge gaps:\n\n**Project:** {projectName}\n**Items analyzed:** {itemCount}\n**Entities tracked:** {entityCount}\n\n**Current entity coverage by type:**\n{entityCoverage}\n\n**Items with summaries:**\n{itemSummaries}\n\n**Entity connections:**\n{connections}\n\nIdentify:\n## Knowledge Gaps\n- What important topics or entities are mentioned but not well-covered?\n- What relationships are implied but not confirmed?\n- What time periods or geographic areas have sparse coverage?\n\n## Collection Priorities\n- What should be investigated next? (ranked by importance)\n- What sources would fill the biggest gaps?\n\n## Confidence Assessment\n- Which findings are well-supported? Which are speculative?\n\nBe specific \u2014 reference actual data points."
  },
  "report.contradictions": {
    label: "Contradictions & Discrepancies", group: "Dashboard Reports",
    system: "You are a fact-checking analyst looking for inconsistencies and contradictions across sources.",
    prompt: "Examine these project items for contradictions and discrepancies:\n\n**Project:** {projectName}\n\n**Items with content:**\n{itemContents}\n\n**Entity attributes from Knowledge Graph:**\n{entityAttributes}\n\nIdentify:\n## Contradictions Found\n- Claims that directly conflict across sources\n- Dates, numbers, or facts that don't align\n\n## Discrepancies\n- Information that is inconsistent but not directly contradictory\n- Different framings or interpretations of the same events\n\n## Reliability Notes\n- Which sources seem most reliable? Why?\n- Where is corroboration strongest/weakest?\n\nIf no contradictions are found, say so \u2014 don't fabricate issues."
  },
  "report.timelineHighlights": {
    label: "Timeline Highlights", group: "Dashboard Reports",
    system: "You are a chronological analyst constructing timeline narratives from intelligence data.",
    prompt: "Build a timeline of key events from this project's data:\n\n**Project:** {projectName}\n\n**Items with dates/content:**\n{timelineItems}\n\n**Date-type entities from KG:**\n{dateEntities}\n\nCreate:\n## Timeline Highlights\n- List key events chronologically with dates\n- Note the source for each event\n\n## Narrative Arc\n- What story emerges from the chronological ordering?\n- Are there acceleration patterns or pivotal moments?\n\n## Temporal Gaps\n- Where are there missing time periods?\n- What likely happened during gaps?\n\nUse actual dates and events from the data. Format dates consistently."
  },
  // Digest
  "digest": {
    label: "Project Digest", group: "Dashboard Reports",
    system: "You are an intelligence briefing generator. Write a concise daily/weekly digest for an OSINT project. Use markdown formatting.",
    prompt: "(Auto-generated from project data. Edit only the system prompt to change tone/format.)"
  },
  // Change Detection
  "changeDetection": {
    label: "Change Detection Summary", group: "Monitors",
    system: "You are a change detection analyst. Summarize webpage differences concisely.",
    prompt: "(Auto-generated from page diffs. Edit only the system prompt.)"
  },
  // Feed Summarizer
  "feedSummarizer": {
    label: "Feed Entry Summary", group: "RSS Feeds",
    system: "You are a concise news summarizer. Provide clear, informative bullet-point summaries.",
    prompt: "(Auto-generated from feed content. Edit only the system prompt.)"
  },
  // Pipelines
  "pipeline.wikipedia.profile": {
    label: "Wikipedia \u2014 Profile Extraction", group: "Source Pipelines",
    system: "You are a structured data extraction expert. Respond ONLY with valid JSON, no markdown fences, no explanation.",
    prompt: 'Extract a structured profile from this Wikipedia article. Return JSON:\n{\n  "title": "",\n  "type": "person|organization|place|event|concept|other",\n  "summary": "2-3 sentence summary",\n  "infobox": {\n    "born": "", "died": "", "nationality": "", "occupation": "",\n    "founded": "", "headquarters": "", "industry": "",\n    "population": "", "area": "", "coordinates": ""\n  },\n  "key_facts": ["fact1", "fact2"],\n  "categories": ["cat1", "cat2"],\n  "related_entities": [{"name": "", "type": "person|org|place", "relationship": ""}],\n  "controversies": ["if any"],\n  "references_count": 0,\n  "last_edited": ""\n}\nOnly include fields that have actual data.'
  },
  "pipeline.wikipedia.entities": {
    label: "Wikipedia \u2014 Entity Extraction", group: "Source Pipelines",
    system: "You are an OSINT analyst specializing in entity extraction. Respond ONLY with valid JSON.",
    prompt: 'Extract ALL named entities from this Wikipedia content. Return JSON:\n{\n  "people": [{"name": "", "role": "", "context": ""}],\n  "organizations": [{"name": "", "type": "", "context": ""}],\n  "locations": [{"name": "", "type": "", "context": ""}],\n  "dates": [{"date": "", "event": "", "context": ""}]\n}\nBe thorough \u2014 include every entity mentioned.'
  },
  "pipeline.classifieds.extract": {
    label: "Classifieds \u2014 Listing Extraction", group: "Source Pipelines",
    system: "You are a structured data extraction expert for online listings and classifieds. Respond ONLY with valid JSON.",
    prompt: 'Extract structured listing data from this page. Return JSON:\n{\n  "title": "",\n  "price": { "amount": 0, "currency": "USD", "negotiable": false },\n  "condition": "",\n  "location": { "city": "", "state": "", "country": "" },\n  "seller": { "name": "", "type": "individual|business", "rating": "" },\n  "description_summary": "1-2 sentences",\n  "category": "",\n  "images_mentioned": 0,\n  "contact_methods": ["email", "phone", "message"],\n  "red_flags": ["list any scam indicators"],\n  "comparable_value_estimate": "if possible, estimate fair market value"\n}\nOnly include fields with actual data.'
  },
  "pipeline.classifieds.scamCheck": {
    label: "Classifieds \u2014 Scam Check", group: "Source Pipelines",
    system: "You are a fraud detection expert specializing in online marketplace scams.",
    prompt: "Analyze this listing for scam indicators. Score the risk 1-10 and explain:\n\n## Scam Risk Score: X/10\n\n### Red Flags Found\n- List each suspicious element\n\n### Positive Signals\n- List trustworthy indicators\n\n### Recommendation\nOne sentence: safe to proceed, proceed with caution, or avoid.\n\nBe specific about why each indicator is concerning or reassuring."
  },
  "pipeline.news.analyze": {
    label: "News \u2014 Intelligence Analysis", group: "Source Pipelines",
    system: "You are an intelligence analyst specializing in news analysis and source evaluation. Respond ONLY with valid JSON.",
    prompt: 'Analyze this news article. Return JSON:\n{\n  "headline": "",\n  "publication": "",\n  "author": "",\n  "date_published": "",\n  "summary": "2-3 sentence summary",\n  "key_claims": [{"claim": "", "attribution": "", "evidence_level": "strong|moderate|weak|none"}],\n  "entities": {\n    "people": [{"name": "", "role": ""}],\n    "organizations": [{"name": "", "role": ""}],\n    "locations": [{"name": ""}]\n  },\n  "bias_indicators": {\n    "loaded_language": ["examples"],\n    "framing": "",\n    "missing_perspectives": [""],\n    "overall_lean": "left|center-left|center|center-right|right|neutral"\n  },\n  "source_quality": {\n    "named_sources": 0,\n    "anonymous_sources": 0,\n    "primary_documents": 0,\n    "score": "1-10"\n  },\n  "related_stories": ["suggested follow-up topics"]\n}'
  },
  "pipeline.research.analyze": {
    label: "Research \u2014 Claims & Gaps Analysis", group: "Source Pipelines",
    system: "You are a research analyst specializing in academic and investigative content. Respond ONLY with valid JSON.",
    prompt: 'Analyze this research/wiki content for claims and knowledge gaps. Return JSON:\n{\n  "title": "",\n  "topic": "",\n  "summary": "2-3 sentences",\n  "key_claims": [\n    {"claim": "", "evidence": "strong|moderate|weak|none", "verifiable": true, "source_cited": true}\n  ],\n  "knowledge_coverage": {\n    "strong_areas": ["topics well-covered"],\n    "weak_areas": ["topics mentioned but not substantiated"],\n    "gaps": ["important related topics not addressed"]\n  },\n  "entities": {\n    "people": [{"name": "", "role": ""}],\n    "organizations": [{"name": ""}],\n    "concepts": [{"name": "", "definition": ""}]\n  },\n  "methodology_notes": "if applicable",\n  "suggested_followup": ["questions or sources to investigate"]\n}'
  },
};

let advancedPrompts = {}; // user overrides, keyed by prompt ID

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
  defaultPreset: document.getElementById("default-preset"),
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
  // Bookmark tagging prompt
  bookmarkTagPrompt: document.getElementById("bookmark-tag-prompt"),
  resetBookmarkTagPrompt: document.getElementById("reset-bookmark-tag-prompt"),
  bookmarkTagPromptStatus: document.getElementById("bookmark-tag-prompt-status"),
  // Advanced prompts
  advPromptSelect: document.getElementById("adv-prompt-select"),
  advPromptSystem: document.getElementById("adv-prompt-system"),
  advPromptUser: document.getElementById("adv-prompt-user"),
  advPromptReset: document.getElementById("adv-prompt-reset"),
  advPromptStatus: document.getElementById("adv-prompt-status"),
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
  // Feed Keyword Routes
  feedRouteList: document.getElementById("feed-route-list"),
  routeKeywords: document.getElementById("route-keywords"),
  routeProject: document.getElementById("route-project"),
  routeFeed: document.getElementById("route-feed"),
  routeNotify: document.getElementById("route-notify"),
  addFeedRoute: document.getElementById("add-feed-route"),
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
  // Init interval steppers for add-new forms
  initIntervalStepper("monitor-interval-stepper", "monitor-interval", "monitor-interval-display", 60);
  initIntervalStepper("feed-interval-stepper", "feed-interval", "feed-interval-display", 60);

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
  initCloudBackup();

  // Live data refresh — listen for background data changes
  let _refreshDebounce = {};
  browser.runtime.onMessage.addListener((message) => {
    if (message.type !== "argusDataChanged") return;
    const store = message.store;
    if (_refreshDebounce[store]) clearTimeout(_refreshDebounce[store]);
    _refreshDebounce[store] = setTimeout(() => {
      delete _refreshDebounce[store];
      if (store === "projects" && typeof projLoadProjects === "function") projLoadProjects();
      if (store === "feeds" && typeof renderFeeds === "function") renderFeeds();
      if (store === "monitors" && typeof renderMonitors === "function") renderMonitors();
      if (store === "history") { /* history page handles its own refresh */ }
      updateTabBadges();
    }, 500);
  });

  // Resources tab — IP fetch
  initResourcesTab();
  updateTabBadges();
});

// ── Tab Badges ──
async function updateTabBadges() {
  const badges = {
    bookmarks: 0, projects: 0, monitors: 0, feeds: 0, osint: 0, automation: 0
  };
  try {
    const [bkResp, prResp, moResp, fdResp, kgStats, auResp] = await Promise.all([
      browser.runtime.sendMessage({ action: "getBookmarks" }),
      browser.runtime.sendMessage({ action: "getProjects" }),
      browser.runtime.sendMessage({ action: "getMonitors" }),
      browser.runtime.sendMessage({ action: "getFeeds" }),
      browser.runtime.sendMessage({ action: "getKGStats" }).catch(() => null),
      browser.runtime.sendMessage({ action: "getAutomations" }).catch(() => null)
    ]);
    if (bkResp && bkResp.total != null) badges.bookmarks = bkResp.total;
    if (prResp && Array.isArray(prResp.projects)) badges.projects = prResp.projects.length;
    if (moResp && Array.isArray(moResp.monitors)) badges.monitors = moResp.monitors.length;
    if (fdResp && Array.isArray(fdResp.feeds)) badges.feeds = fdResp.feeds.length;
    if (kgStats && typeof kgStats.nodeCount === "number") badges.osint = kgStats.nodeCount;
    if (auResp && Array.isArray(auResp.automations)) badges.automation = auResp.automations.length;
  } catch (e) { console.warn("[Badges] Failed to fetch counts:", e); }

  for (const [tab, count] of Object.entries(badges)) {
    const el = document.getElementById(`badge-${tab}`);
    if (!el) continue;
    if (count > 0) {
      el.textContent = count > 999 ? "999+" : count;
      el.classList.add("visible");
    } else {
      el.textContent = "";
      el.classList.remove("visible");
    }
  }
}

// ── Resources Tab (dynamic from JSON) ──
function initResourcesTab() {
  const ipEl = document.getElementById("res-ip-value");
  const copyBtn = document.getElementById("res-ip-copy");
  const refreshBtn = document.getElementById("res-ip-refresh");
  const grid = document.getElementById("res-grid");
  const versionInfo = document.getElementById("res-version-info");
  const checkUpdatesBtn = document.getElementById("res-check-updates");
  const resetBtn = document.getElementById("res-reset-stock");
  if (!grid) return;

  // ── IP fetch ──
  let cachedIp = null;
  let cacheTime = 0;
  const CACHE_TTL = 5 * 60 * 1000;

  async function fetchIp() {
    if (!ipEl) return;
    if (cachedIp && Date.now() - cacheTime < CACHE_TTL) { ipEl.textContent = cachedIp; return; }
    ipEl.textContent = "checking...";
    try {
      const resp = await fetch("https://ifconfig.me/ip", { cache: "no-store" });
      const ip = (await resp.text()).trim();
      if (ip) { cachedIp = ip; cacheTime = Date.now(); ipEl.textContent = ip; }
      else { ipEl.textContent = "unavailable"; }
    } catch {
      try {
        const resp = await fetch("https://api.ipify.org?format=text", { cache: "no-store" });
        const ip = (await resp.text()).trim();
        cachedIp = ip; cacheTime = Date.now(); ipEl.textContent = ip;
      } catch { ipEl.textContent = "unavailable"; }
    }
  }

  if (copyBtn) copyBtn.addEventListener("click", () => {
    if (cachedIp) {
      navigator.clipboard.writeText(cachedIp);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    }
  });
  if (refreshBtn) refreshBtn.addEventListener("click", () => { cachedIp = null; cacheTime = 0; fetchIp(); });
  fetchIp();

  // ── Icon map for card headers ──
  const ICONS = {
    shield: "\uD83D\uDEE1\uFE0F", archive: "\uD83D\uDCE6", search: "\uD83D\uDD0D", globe: "\uD83C\uDF0D",
    chart: "\uD83D\uDCCA", government: "\uD83C\uDFDB\uFE0F", map: "\uD83D\uDDFA\uFE0F", world: "\uD83C\uDF10",
    trending: "\uD83D\uDCC8", book: "\uD83D\uDCDA", alert: "\uD83D\uDEA8", target: "\uD83C\uDFAF"
  };

  // ── Load resources (cached update > bundled) ──
  async function loadResources() {
    // Check for user-fetched update in storage
    const { resourcesJsonCache } = await browser.storage.local.get({ resourcesJsonCache: null });
    if (resourcesJsonCache && resourcesJsonCache.data) {
      renderGrid(resourcesJsonCache.data);
      if (versionInfo) versionInfo.textContent = `v${resourcesJsonCache.data.version || "?"} (updated ${resourcesJsonCache.data.updated || "?"})`;
      if (resetBtn) resetBtn.style.display = "";
      return;
    }
    // Fall back to bundled JSON
    try {
      const resp = await fetch(browser.runtime.getURL("data/resources.json"));
      const data = await resp.json();
      renderGrid(data);
      if (versionInfo) versionInfo.textContent = `v${data.version || "?"} (bundled)`;
    } catch (err) {
      grid.textContent = "";
      const errEl = document.createElement("p");
      errEl.className = "info-text";
      errEl.textContent = "Failed to load resources: " + err.message;
      grid.appendChild(errEl);
    }
  }

  // ── Render the dashboard grid ──
  function renderGrid(data) {
    grid.textContent = "";
    if (!data.categories || !data.categories.length) {
      const empty = document.createElement("p");
      empty.className = "info-text";
      empty.textContent = "No resource categories found.";
      grid.appendChild(empty);
      return;
    }

    for (const cat of data.categories) {
      const card = document.createElement("div");
      card.className = "res-card";

      // Header
      const header = document.createElement("div");
      header.className = "res-card-header";
      const icon = document.createElement("span");
      icon.className = "res-card-icon";
      icon.textContent = ICONS[cat.icon] || "\uD83D\uDCC1";
      header.appendChild(icon);
      const titleWrap = document.createElement("div");
      const title = document.createElement("h3");
      title.className = "res-card-title";
      title.textContent = cat.title;
      titleWrap.appendChild(title);
      if (cat.description) {
        const desc = document.createElement("p");
        desc.className = "res-card-desc";
        desc.textContent = cat.description;
        titleWrap.appendChild(desc);
      }
      header.appendChild(titleWrap);
      const count = document.createElement("span");
      count.className = "res-card-count";
      count.textContent = cat.links.length;
      count.title = cat.links.length + " links";
      header.appendChild(count);
      card.appendChild(header);

      // Note
      if (cat.note) {
        const note = document.createElement("p");
        note.className = "res-card-note";
        note.textContent = cat.note;
        card.appendChild(note);
      }

      // Links list
      const list = document.createElement("div");
      list.className = "res-card-links";
      for (const link of cat.links) {
        const item = document.createElement("a");
        item.href = link.url;
        item.target = "_blank";
        item.className = "res-link-item";
        const name = document.createElement("span");
        name.className = "res-link-name";
        name.textContent = link.name;
        item.appendChild(name);
        if (link.desc) {
          const desc = document.createElement("span");
          desc.className = "res-link-desc";
          desc.textContent = link.desc;
          item.appendChild(desc);
        }
        list.appendChild(item);
      }
      card.appendChild(list);

      // Master list link (e.g. state portals CSV)
      if (cat.masterList) {
        const ml = document.createElement("a");
        ml.href = cat.masterList;
        ml.target = "_blank";
        ml.className = "res-card-master";
        ml.textContent = "View master data list (CSV)";
        card.appendChild(ml);
      }

      grid.appendChild(card);
    }
  }

  // ── Check for updates (user-initiated fetch from remote JSON) ──
  if (checkUpdatesBtn) checkUpdatesBtn.addEventListener("click", async () => {
    checkUpdatesBtn.disabled = true;
    checkUpdatesBtn.textContent = "Checking...";
    try {
      // Fetch from the Argus GitHub repo — user can configure this URL
      const { resourcesUpdateUrl } = await browser.storage.local.get({
        resourcesUpdateUrl: "https://raw.githubusercontent.com/user/argus-resources/main/resources.json"
      });
      const resp = await fetch(resourcesUpdateUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (!data.categories || !Array.isArray(data.categories)) throw new Error("Invalid format");
      await browser.storage.local.set({ resourcesJsonCache: { data, fetchedAt: Date.now() } });
      renderGrid(data);
      if (versionInfo) versionInfo.textContent = `v${data.version || "?"} (updated ${data.updated || "?"})`;
      if (resetBtn) resetBtn.style.display = "";
      checkUpdatesBtn.textContent = "Updated!";
      setTimeout(() => { checkUpdatesBtn.textContent = "Check for Updates"; checkUpdatesBtn.disabled = false; }, 2000);
    } catch (err) {
      checkUpdatesBtn.textContent = "Update failed";
      console.warn("[Resources] Update check failed:", err);
      setTimeout(() => { checkUpdatesBtn.textContent = "Check for Updates"; checkUpdatesBtn.disabled = false; }, 2000);
    }
  });

  // ── Reset to bundled ──
  if (resetBtn) resetBtn.addEventListener("click", async () => {
    await browser.storage.local.remove("resourcesJsonCache");
    if (resetBtn) resetBtn.style.display = "none";
    loadResources();
  });

  loadResources();

  // ── Custom Sources ──
  const customContainer = document.getElementById("res-custom-sources");
  const customTopContainer = document.getElementById("res-custom-top");
  const customTopLinks = document.getElementById("res-custom-top-links");
  const customUrlInput = document.getElementById("res-custom-url");
  const customLabelInput = document.getElementById("res-custom-label");
  const customDescInput = document.getElementById("res-custom-desc");
  const customAddBtn = document.getElementById("res-custom-add");
  if (!customContainer || !customAddBtn) return;

  // Smooth scroll for "Add more" link
  const addLink = document.getElementById("res-custom-add-link");
  if (addLink) addLink.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("res-custom-add-section")?.scrollIntoView({ behavior: "smooth" });
  });

  async function loadCustomSources() {
    const { resourceCustomSources: sources } = await browser.storage.local.get({ resourceCustomSources: [] });
    renderCustomSources(sources || []);
  }

  async function saveCustomSources(sources) {
    await browser.storage.local.set({ resourceCustomSources: sources });
    renderCustomSources(sources);
  }

  function renderCustomSources(sources) {
    customContainer.textContent = "";

    // Top display card — read-only, same style as JSON-driven resource links
    if (customTopContainer && customTopLinks) {
      customTopLinks.textContent = "";
      if (sources.length) {
        customTopContainer.style.display = "";
        for (const src of sources) {
          const item = document.createElement("a");
          item.href = src.url;
          item.target = "_blank";
          item.className = "res-link-item";
          const name = document.createElement("span");
          name.className = "res-link-name";
          name.textContent = src.label || src.url;
          item.appendChild(name);
          if (src.desc) {
            const desc = document.createElement("span");
            desc.className = "res-link-desc";
            desc.textContent = src.desc;
            item.appendChild(desc);
          }
          customTopLinks.appendChild(item);
        }
      } else {
        customTopContainer.style.display = "none";
      }
    }

    // Bottom management card — editable rows
    if (!sources.length) {
      const empty = document.createElement("span");
      empty.className = "info-text";
      empty.style.fontSize = "12px";
      empty.textContent = "No custom sources added yet.";
      customContainer.appendChild(empty);
      return;
    }
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const row = document.createElement("div");
      row.className = "res-edit-row";

      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "res-edit-field res-edit-label";
      labelInput.value = src.label || "";
      labelInput.placeholder = "Label";

      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.className = "res-edit-field res-edit-url";
      urlInput.value = src.url || "";
      urlInput.placeholder = "URL";

      const descInput = document.createElement("input");
      descInput.type = "text";
      descInput.className = "res-edit-field res-edit-desc";
      descInput.value = src.desc || "";
      descInput.placeholder = "Description";

      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-secondary btn-sm res-edit-btn";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", async () => {
        let newUrl = urlInput.value.trim();
        if (!newUrl) return;
        if (!/^https?:\/\//i.test(newUrl)) newUrl = "https://" + newUrl;
        const { resourceCustomSources: current } = await browser.storage.local.get({ resourceCustomSources: [] });
        const updated = current || [];
        if (updated[i]) {
          updated[i] = { url: newUrl, label: labelInput.value.trim() || new URL(newUrl).hostname, desc: descInput.value.trim() };
          saveBtn.textContent = "Saved!";
          setTimeout(() => { saveBtn.textContent = "Save"; }, 1000);
          await saveCustomSources(updated);
        }
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "btn btn-secondary btn-sm res-edit-btn";
      removeBtn.style.color = "var(--error, #f44336)";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        const { resourceCustomSources: current } = await browser.storage.local.get({ resourceCustomSources: [] });
        const updated = (current || []).filter((_, idx) => idx !== i);
        await saveCustomSources(updated);
      });

      row.appendChild(labelInput);
      row.appendChild(urlInput);
      row.appendChild(descInput);
      row.appendChild(saveBtn);
      row.appendChild(removeBtn);
      customContainer.appendChild(row);
    }
  }

  customAddBtn.addEventListener("click", async () => {
    let url = customUrlInput.value.trim();
    const label = customLabelInput.value.trim();
    const desc = customDescInput ? customDescInput.value.trim() : "";
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const { resourceCustomSources: current } = await browser.storage.local.get({ resourceCustomSources: [] });
    const sources = current || [];
    if (sources.some(s => s.url === url)) return;
    sources.push({ url, label: label || new URL(url).hostname, desc });
    await browser.storage.local.set({ resourceCustomSources: sources });
    customUrlInput.value = "";
    customLabelInput.value = "";
    if (customDescInput) customDescInput.value = "";
    renderCustomSources(sources);
  });

  loadCustomSources();
}

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
    defaultPreset: "summary",
    customPresets: {},
    bookmarkTagPrompt: "",
    extendedThinking: { enabled: false, budgetTokens: 10000 },
    autoAnalyzeRules: [],
    feedKeywordRoutes: [],
    advancedPrompts: {},
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
  feedKeywordRoutes = settings.feedKeywordRoutes || [];
  advancedPrompts = settings.advancedPrompts || {};

  populateDefaultPresetDropdown();
  el.defaultPreset.value = settings.defaultPreset || "summary";
  el.bookmarkTagPrompt.value = settings.bookmarkTagPrompt || DEFAULT_BOOKMARK_TAG_PROMPT;

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
    defaultPreset: el.defaultPreset.value,
    providers,
    maxTokens: parseInt(el.maxTokens.value, 10) || 2048,
    maxInputChars: parseInt(el.maxInputChars.value, 10) || 100000,
    temperature: parseFloat(el.temperature.value),
    reasoningEffort: el.reasoningEffort.value,
    openaiReasoningEffort: el.openaiReasoningEffort.value,
    customPresets,
    bookmarkTagPrompt: el.bookmarkTagPrompt.value !== DEFAULT_BOOKMARK_TAG_PROMPT ? el.bookmarkTagPrompt.value : "",
    extendedThinking: {
      enabled: el.extendedThinkingEnabled.checked,
      budgetTokens: parseInt(el.thinkingBudget.value, 10) || 10000
    },
    autoAnalyzeRules,
    feedKeywordRoutes,
    advancedPrompts,
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

  renderEditorSteps();
  card.scrollIntoView({ behavior: "smooth" });
}

function renderEditorSteps() {
  const list = document.getElementById("auto-steps-list");
  list.replaceChildren();
  document.getElementById("auto-step-count").textContent = editorSteps.length ? `(${editorSteps.length})` : "";

  editorSteps.forEach((step, i) => {
    const div = document.createElement("div");
    div.className = "auto-step-item";

    const header = document.createElement("div");
    header.className = "auto-step-header";
    const label = document.createElement("strong");
    label.textContent = `${i + 1}. ${stepTypeLabel(step.type)}`;
    header.appendChild(label);

    const btns = document.createElement("div");
    btns.className = "auto-step-btns";
    if (i > 0) {
      const upBtn = document.createElement("button");
      upBtn.className = "btn btn-sm btn-secondary";
      upBtn.textContent = "\u2191";
      upBtn.title = "Move up";
      upBtn.addEventListener("click", () => { [editorSteps[i - 1], editorSteps[i]] = [editorSteps[i], editorSteps[i - 1]]; renderEditorSteps(); });
      btns.appendChild(upBtn);
    }
    if (i < editorSteps.length - 1) {
      const downBtn = document.createElement("button");
      downBtn.className = "btn btn-sm btn-secondary";
      downBtn.textContent = "\u2193";
      downBtn.title = "Move down";
      downBtn.addEventListener("click", () => { [editorSteps[i], editorSteps[i + 1]] = [editorSteps[i + 1], editorSteps[i]]; renderEditorSteps(); });
      btns.appendChild(downBtn);
    }
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-sm btn-secondary";
    removeBtn.style.color = "var(--error)";
    removeBtn.textContent = "\u2715";
    removeBtn.title = "Remove step";
    removeBtn.addEventListener("click", () => { editorSteps.splice(i, 1); renderEditorSteps(); });
    btns.appendChild(removeBtn);
    header.appendChild(btns);
    div.appendChild(header);

    // Step-specific config
    const config = document.createElement("div");
    config.className = "auto-step-config";
    buildStepConfig(step, config, i);
    div.appendChild(config);

    list.appendChild(div);
  });
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
  }
}

function stepTypeLabel(type) {
  const labels = {
    analyze: "Analyze (Preset)",
    prompt: "Custom Prompt",
    extractEntities: "Extract Entities",
    addToProject: "Add to Project",
    runPipeline: "Run Pipeline",
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
  editorSteps.push(step);
  renderEditorSteps();
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

  el.defaultPreset.addEventListener("change", scheduleSave);

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

  // Bookmark tagging prompt
  el.bookmarkTagPrompt.addEventListener("input", scheduleSave);
  el.resetBookmarkTagPrompt.addEventListener("click", () => {
    el.bookmarkTagPrompt.value = DEFAULT_BOOKMARK_TAG_PROMPT;
    el.bookmarkTagPromptStatus.textContent = "Reset to default";
    setTimeout(() => { el.bookmarkTagPromptStatus.textContent = ""; }, 2000);
    scheduleSave();
  });

  // Advanced prompts editor
  initAdvancedPrompts();
  el.advPromptSelect.addEventListener("change", loadAdvancedPrompt);
  el.advPromptSystem.addEventListener("input", saveAdvancedPrompt);
  el.advPromptUser.addEventListener("input", saveAdvancedPrompt);
  el.advPromptReset.addEventListener("click", resetAdvancedPrompt);

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
  document.getElementById("auto-add-step-btn").addEventListener("click", addEditorStep);
  document.getElementById("auto-save-btn").addEventListener("click", saveAutomation);
  document.getElementById("auto-cancel-btn").addEventListener("click", closeAutomationEditor);
  document.getElementById("auto-delete-btn").addEventListener("click", deleteAutomation);

  // Monitors
  populateMonitorPresetDropdown();
  el.addMonitor.addEventListener("click", addMonitor);

  // RSS Feeds
  renderFeeds();
  checkDetectedFeeds();
  el.addFeed.addEventListener("click", addFeedHandler);
  el.openFeedReader.addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("feeds/feeds.html") });
  });
  document.getElementById("delete-all-feeds").addEventListener("click", async () => {
    if (!confirm("Delete all feeds and their entries? This cannot be undone.")) return;
    await browser.runtime.sendMessage({ action: "deleteAllFeeds" });
    renderFeeds();
  });

  // Feed Keyword Routes
  renderFeedRoutes();
  el.addFeedRoute.addEventListener("click", addFeedRoute);

  // Jump link: Feeds tab → Keyword Routes on Automate tab
  const feedRouteLink = document.getElementById("feed-route-link");
  if (feedRouteLink) {
    feedRouteLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('[data-tab="automation"]').click();
      setTimeout(() => {
        document.getElementById("feed-route-list")?.closest(".card")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
  }

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

    // Interval stepper
    const intervalStepper = createInlineIntervalStepper(monitor.intervalMinutes, async (newMins) => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        intervalMinutes: newMins
      });
    });

    const historyBtn = document.createElement("button");
    historyBtn.className = "btn btn-sm btn-secondary";
    historyBtn.textContent = "Changes";
    historyBtn.title = "View detected changes and compare snapshots";
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
    actions.appendChild(intervalStepper);
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

    const intervalStepper = createInlineIntervalStepper(feed.checkIntervalMinutes || 60, async (newMins) => {
      await browser.runtime.sendMessage({
        action: "updateFeed", id: feed.id,
        checkIntervalMinutes: newMins
      });
    });

    actions.appendChild(intervalStepper);
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
// Detected feeds picker (from popup multi-feed detection)
// ──────────────────────────────────────────────
async function checkDetectedFeeds() {
  const { _detectedFeeds } = await browser.storage.local.get("_detectedFeeds");
  if (!_detectedFeeds || !_detectedFeeds.length) return;

  // Clear immediately so it doesn't show again on reload
  await browser.storage.local.remove("_detectedFeeds");

  // Get existing feeds to filter out already-subscribed
  const resp = await browser.runtime.sendMessage({ action: "getFeeds" });
  const existingUrls = new Set((resp?.feeds || []).map(f => f.url.replace(/\/+$/, "").toLowerCase()));
  const feeds = _detectedFeeds.filter(f => !existingUrls.has(f.url.replace(/\/+$/, "").toLowerCase()));
  if (!feeds.length) return;

  const picker = document.getElementById("detected-feeds-picker");
  const list = document.getElementById("detected-feeds-list");
  list.replaceChildren();

  feeds.forEach((feed, i) => {
    const row = document.createElement("label");
    row.className = "rule-item";
    row.style.cursor = "pointer";
    row.style.gap = "8px";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.idx = i;
    cb.className = "detected-feed-cb";

    const info = document.createElement("div");
    info.className = "rule-info";
    info.style.minWidth = "0";

    const title = document.createElement("strong");
    title.textContent = feed.title || new URL(feed.url).pathname;
    title.style.wordBreak = "break-all";
    info.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    meta.textContent = feed.url;
    meta.style.wordBreak = "break-all";
    info.appendChild(meta);

    row.append(cb, info);
    list.appendChild(row);
  });

  picker.classList.remove("hidden");

  // Select All
  document.getElementById("detected-feeds-select-all").onclick = () => {
    const cbs = list.querySelectorAll(".detected-feed-cb");
    const allChecked = [...cbs].every(c => c.checked);
    cbs.forEach(c => { c.checked = !allChecked; });
  };

  // Dismiss
  document.getElementById("detected-feeds-dismiss").onclick = () => {
    picker.classList.add("hidden");
  };

  // Subscribe selected
  document.getElementById("detected-feeds-subscribe").onclick = async () => {
    const cbs = list.querySelectorAll(".detected-feed-cb:checked");
    if (!cbs.length) return;

    const btn = document.getElementById("detected-feeds-subscribe");
    btn.disabled = true;
    btn.textContent = `Subscribing (0/${cbs.length})...`;

    let success = 0;
    for (const cb of cbs) {
      const feed = feeds[parseInt(cb.dataset.idx, 10)];
      const resp = await browser.runtime.sendMessage({
        action: "addFeed",
        url: feed.url,
        title: feed.title || "",
        intervalMinutes: 60
      });
      if (resp?.success) {
        success++;
        cb.closest(".rule-item").style.opacity = "0.4";
        cb.disabled = true;
      }
      btn.textContent = `Subscribing (${success}/${cbs.length})...`;
    }

    btn.textContent = `Subscribed ${success} feed${success !== 1 ? "s" : ""}!`;
    btn.style.color = "var(--success)";
    setTimeout(() => {
      picker.classList.add("hidden");
      btn.disabled = false;
      btn.textContent = "Subscribe Selected";
      btn.style.color = "";
    }, 2000);

    renderFeeds();
  };
}

// ──────────────────────────────────────────────
// Feed Keyword Routes
// ──────────────────────────────────────────────

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
    keywords.textContent = route.keywords.join(", ");
    info.appendChild(keywords);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    const projName = projects.find(p => p.id === route.projectId)?.name || "Unknown project";
    const feedName = route.feedId
      ? (rssFeeds.find(f => f.id === route.feedId)?.title || "Specific feed")
      : "All feeds";
    const flags = [];
    if (route.notify) flags.push("notify");
    meta.textContent = ` → ${projName} | ${feedName}${flags.length ? " | " + flags.join(", ") : ""}`;
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

  // Pre-fill automation rule URL from query param (sent by popup)
  const urlParams = new URLSearchParams(window.location.search);
  const prefillRule = urlParams.get("prefillRule");
  if (prefillRule && el.ruleUrl) {
    try {
      const u = new URL(prefillRule);
      el.ruleUrl.value = `*${u.hostname}${u.pathname}*`;
    } catch {
      el.ruleUrl.value = prefillRule;
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      if (tabName) {
        switchMainTab(tabName, tabs, panels);
        sessionStorage.setItem("argus-activeTab", tabName);
        history.replaceState(null, "", `#${tabName}`);
      }
    });
  });

  // Handle hash changes (e.g. from popup quick-nav links)
  window.addEventListener("hashchange", () => {
    const h = window.location.hash.replace("#", "");
    if (h) handleHashNav(h, tabs, panels);
  });

  // Also handle sub-anchors on initial load (e.g. #help-getting-started)
  if (hash && hash.includes("-")) {
    handleHashNav(hash, tabs, panels);
  }

  // History icon button (not a tab — opens history page)
  const histNavBtn = document.getElementById("open-history-nav");
  if (histNavBtn) {
    histNavBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      browser.tabs.create({ url: browser.runtime.getURL("history/history.html") });
    });
  }
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
  // Check for detected feeds when switching to feeds tab
  if (tabName === "feeds") {
    checkDetectedFeeds();
  }
}

function handleHashNav(hash, tabs, panels) {
  // Check if hash is a direct tab name (e.g. "help", "settings", "presets")
  const directTab = [...tabs].find(t => t.dataset.tab === hash);
  if (directTab) {
    switchMainTab(hash, tabs, panels);
    sessionStorage.setItem("argus-activeTab", hash);
    return;
  }

  // Sub-anchor: e.g. "help-getting-started" → switch to "help" tab, scroll to element
  const tabName = hash.split("-")[0];
  const tabMatch = [...tabs].find(t => t.dataset.tab === tabName);
  if (tabMatch) {
    switchMainTab(tabName, tabs, panels);
    sessionStorage.setItem("argus-activeTab", tabName);
    requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  const customizeTagLink = document.getElementById("bm-customize-tagging");
  if (customizeTagLink) {
    customizeTagLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('[data-tab="prompts"]').click();
      setTimeout(() => {
        document.getElementById("bookmark-tag-card").scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
  }

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
  document.getElementById("proj-refresh").addEventListener("click", () => projLoadProjects());
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
  document.getElementById("proj-skeleton").addEventListener("click", projBuildSkeleton);

  projLoadProjects();
  checkRunningBatch();
}

async function checkRunningBatch() {
  try {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (s && s.success && s.running) {
      const runBtn = document.getElementById("proj-batch-run");
      const statusEl = document.getElementById("proj-batch-status");
      const progressEl = document.getElementById("proj-batch-progress");
      const barEl = document.getElementById("proj-batch-bar");
      const pctEl = document.getElementById("proj-batch-pct");
      runBtn.textContent = "Cancel";
      runBtn.onclick = projCancelBatch;
      const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      progressEl.classList.remove("hidden", "proj-batch-done");
      barEl.style.width = pct + "%";
      pctEl.textContent = pct + "%";
      statusEl.textContent = `Analyzing ${s.done + 1} of ${s.total}: ${s.current}`;
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

  // Populate automation toolbar for this project
  projPopulateAutomations(proj.id);

  projRenderItems(proj);
}

async function projPopulateAutomations(projectId) {
  const toolbar = document.getElementById("proj-automation-toolbar");
  const select = document.getElementById("proj-automation-select");
  const statusEl = document.getElementById("proj-automation-status");

  // Get all automations — show ones linked to this project + manual ones
  const resp = await browser.runtime.sendMessage({ action: "getAutomations" });
  const allAutos = (resp?.success ? resp.automations : []).filter(a => a.enabled);
  const relevant = allAutos.filter(a =>
    a.triggers?.manual || a.triggers?.projectId === projectId
  );

  if (!relevant.length) {
    toolbar.classList.add("hidden");
    return;
  }

  toolbar.classList.remove("hidden");
  select.replaceChildren();
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Select automation...";
  select.appendChild(defaultOpt);

  for (const auto of relevant) {
    const opt = document.createElement("option");
    opt.value = auto.id;
    opt.textContent = auto.name + (auto.triggers?.projectId === projectId ? " (linked)" : "");
    select.appendChild(opt);
  }

  // Run on All handler
  const runAllBtn = document.getElementById("proj-automation-run");
  const newRunAllBtn = runAllBtn.cloneNode(true);
  runAllBtn.parentNode.replaceChild(newRunAllBtn, runAllBtn);
  newRunAllBtn.addEventListener("click", async () => {
    const autoId = select.value;
    if (!autoId) { alert("Select an automation first."); return; }
    newRunAllBtn.disabled = true;
    newRunAllBtn.textContent = "Running...";
    statusEl.textContent = "Running automation on all project items...";
    try {
      const result = await browser.runtime.sendMessage({
        action: "runAutomationOnProject", automationId: autoId, projectId
      });
      statusEl.textContent = result.success
        ? `Done: ${result.succeeded}/${result.total} items succeeded.`
        : `Error: ${result.error}`;
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
    }
    newRunAllBtn.textContent = "Run on All";
    newRunAllBtn.disabled = false;
    loadAutomationLog();
  });
}

// Convert entity JSON summary to readable text for project cards
function projSummarizeForCard(text) {
  if (!text) return "";
  const trimmed = text.trim();

  // Try to find and parse JSON (may be raw, in code fences, or with surrounding text)
  let json = null;
  // Direct parse
  try { json = JSON.parse(trimmed); } catch {}
  // Strip code fences
  if (!json) {
    const fenced = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
    try { json = JSON.parse(fenced); } catch {}
  }
  // Find first { to last }
  if (!json) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { json = JSON.parse(trimmed.slice(start, end + 1)); } catch {}
    }
  }

  if (json && (json.people || json.organizations || json.locations || json.claims)) {
    const parts = [];
    if (json.people && json.people.length) {
      parts.push(`People: ${json.people.map(p => p.name).join(", ")}`);
    }
    if (json.organizations && json.organizations.length) {
      parts.push(`Orgs: ${json.organizations.map(o => o.name).join(", ")}`);
    }
    if (json.locations && json.locations.length) {
      parts.push(`Locations: ${json.locations.map(l => l.name).join(", ")}`);
    }
    if (json.claims && json.claims.length) {
      parts.push(`${json.claims.length} claim(s)`);
    }
    if (json.dates && json.dates.length) {
      parts.push(`${json.dates.length} date(s)`);
    }
    if (json.contact && json.contact.length) {
      parts.push(`${json.contact.length} contact(s)`);
    }
    if (parts.length) return parts.join(" | ");
  }

  // Fallback: if it looks like entity JSON but couldn't parse (truncated),
  // extract names via regex
  if (trimmed.startsWith("{") && /"name"\s*:/.test(trimmed)) {
    const names = [];
    const nameRe = /"name"\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = nameRe.exec(trimmed)) !== null) {
      names.push(m[1]);
    }
    if (names.length) {
      return `Entities found: ${names.join(", ")}`;
    }
  }

  // Not entity JSON — return as-is
  return trimmed;
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
    if (item.summary || item.analysisContent) {
      const summDiv = document.createElement("div");
      summDiv.className = "proj-item-summary";
      // Use full analysisContent first — summary may be truncated JSON that can't be parsed
      summDiv.textContent = projSummarizeForCard(item.analysisContent || item.summary).slice(0, 300);
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
    if (item.analysisPreset) {
      // Show the actual preset name (e.g. "Fact-Check", "Summary") instead of generic "analysis" + "analyzed"
      const presetBadge = document.createElement("span");
      presetBadge.className = "proj-type-badge analysis";
      presetBadge.textContent = item.analysisPreset;
      metaDiv.appendChild(presetBadge);
    } else {
      const typeBadge = document.createElement("span");
      typeBadge.className = "proj-type-badge " + item.type;
      typeBadge.textContent = item.type;
      metaDiv.appendChild(typeBadge);
    }
    const dateSpan = document.createElement("span");
    dateSpan.textContent = new Date(item.addedAt).toLocaleDateString();
    metaDiv.appendChild(dateSpan);
    bodyDiv.appendChild(metaDiv);
    card.appendChild(bodyDiv);
    const actionsDiv2 = document.createElement("div");
    actionsDiv2.className = "proj-item-actions";
    if (item.analysisContent || item.refId) {
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
    if (item.url) {
      const autoBtn = document.createElement("button");
      autoBtn.className = "proj-item-auto-btn";
      autoBtn.title = "Run automation on this item";
      autoBtn.textContent = "Automate";
      autoBtn.addEventListener("click", async () => {
        const autoSelect = document.getElementById("proj-automation-select");
        const autoToolbar = document.getElementById("proj-automation-toolbar");
        const autoId = autoSelect?.value;
        if (!autoId) {
          if (autoToolbar?.classList.contains("hidden")) {
            alert("No automations available.\n\nCreate an automation on the Automate tab first, then enable 'Manual trigger' so it appears here.");
          } else {
            alert("Select an automation from the Automations toolbar above, then click this button.");
          }
          return;
        }
        autoBtn.disabled = true;
        autoBtn.textContent = "Running...";
        const statusEl = document.getElementById("proj-automation-status");
        statusEl.textContent = `Running on: ${item.title || item.url}`;
        try {
          const result = await browser.runtime.sendMessage({
            action: "runAutomationOnItem", automationId: autoId, projectId: proj.id,
            url: item.url, title: item.title
          });
          autoBtn.textContent = result.success ? "Done!" : "Failed";
          statusEl.textContent = result.success ? "Automation complete." : `Error: ${result.error}`;
        } catch (e) {
          autoBtn.textContent = "Error";
        }
        setTimeout(() => { autoBtn.textContent = "Automate"; autoBtn.disabled = false; }, 2000);
      });
      actionsDiv2.appendChild(autoBtn);
    }
    actionsDiv2.appendChild(noteBtn);
    actionsDiv2.appendChild(removeBtn);
    card.appendChild(actionsDiv2);

    async function openItemAnalysis() {
      let content = item.analysisContent;
      let preset = item.analysisPreset || "Analysis";

      // Backfill from history if content missing but we have a refId
      if (!content && item.refId) {
        try {
          const resp = await browser.runtime.sendMessage({ action: "getHistoryItem", id: item.refId });
          if (resp?.success && resp.entry?.content) {
            content = resp.entry.content;
            preset = resp.entry.presetLabel || resp.entry.preset || preset;
            // Cache it on the item so we don't fetch again
            item.analysisContent = content;
            item.analysisPreset = preset;
            // Persist the backfill
            await browser.runtime.sendMessage({
              action: "updateProjectItem",
              projectId: proj.id,
              itemId: item.id,
              analysisContent: content,
              analysisPreset: preset
            });
          }
        } catch (e) {
          console.warn("[Argus] Failed to fetch history for project item:", e);
        }
      }

      if (!content) {
        alert("Analysis content not found. The history entry may have been deleted.");
        return;
      }

      const resultId = `proj-view-${Date.now()}`;
      await browser.storage.local.set({
        [resultId]: {
          status: "done",
          content,
          pageTitle: item.title || item.url,
          pageUrl: item.url,
          presetLabel: preset
        }
      });
      browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`) });
    }

    const viewBtn = card.querySelector(".proj-item-view-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", openItemAnalysis);
    }

    // Make the card body clickable to view analysis
    if (item.analysisContent || item.refId) {
      bodyDiv.style.cursor = "pointer";
      bodyDiv.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        openItemAnalysis();
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

  // Check if unanalyzed items exist — use analysisContent (AI output), not summary
  // (summary may be pre-populated from feed descriptions or page excerpts)
  const unsummarized = proj.items.filter(i => i.url && !i.analysisContent);
  const allWithUrl = proj.items.filter(i => i.url);
  let reanalyze = false;

  if (unsummarized.length === 0) {
    if (allWithUrl.length === 0) {
      statusEl.textContent = "No items with URLs to analyze.";
      return;
    }
    if (!confirm(`All ${allWithUrl.length} items have been analyzed. Re-analyze them all?`)) return;
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

  runBtn.textContent = "Cancel";
  runBtn.onclick = projCancelBatch;

  // Show progress bar
  const progressEl = document.getElementById("proj-batch-progress");
  const barEl = document.getElementById("proj-batch-bar");
  const pctEl = document.getElementById("proj-batch-pct");
  progressEl.classList.remove("hidden", "proj-batch-done");
  barEl.style.width = "0%";
  pctEl.textContent = "0%";

  // Poll for progress
  batchPollTimer = setInterval(() => pollBatchStatus(), 1500);
  statusEl.textContent = `Starting batch analysis (${resp.total} items)...`;
}

async function pollBatchStatus() {
  const statusEl = document.getElementById("proj-batch-status");
  const runBtn = document.getElementById("proj-batch-run");
  const progressEl = document.getElementById("proj-batch-progress");
  const barEl = document.getElementById("proj-batch-bar");
  const pctEl = document.getElementById("proj-batch-pct");

  try {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (!s.success) return;

    // Update progress bar
    const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
    barEl.style.width = pct + "%";
    pctEl.textContent = pct + "%";

    if (s.running) {
      statusEl.textContent = `Analyzing ${s.done + 1} of ${s.total}: ${s.current}`;
    } else {
      // Finished
      clearInterval(batchPollTimer);
      batchPollTimer = null;

      // Fill bar to 100%
      barEl.style.width = "100%";
      pctEl.textContent = "100%";
      progressEl.classList.add("proj-batch-done");

      const errCount = s.errors.length;
      if (s.cancelled) {
        statusEl.textContent = `Cancelled after ${s.done} of ${s.total} items.`;
      } else if (errCount > 0) {
        statusEl.textContent = `Complete — analyzed ${s.done} item(s), ${errCount} error(s).`;
      } else {
        statusEl.textContent = `Complete — all ${s.done} item(s) analyzed successfully.`;
      }

      runBtn.textContent = "Run Batch";
      runBtn.onclick = projBatchAnalyze;

      // Refresh project display
      await projLoadProjects();
      projSelectProject(projState.activeProjectId);

      // Hide progress bar after a while, keep status text longer
      setTimeout(() => {
        progressEl.classList.add("hidden");
        progressEl.classList.remove("proj-batch-done");
      }, 8000);
      setTimeout(() => { statusEl.textContent = ""; }, 15000);
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

async function projBuildSkeleton() {
  const panel = document.getElementById("proj-skeleton-panel");
  if (!panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  if (!projState.activeProjectId) return;
  panel.innerHTML = "<p style='color:var(--text-muted);font-size:12px;'>Loading skeleton...</p>";
  panel.classList.remove("hidden");
  const resp = await browser.runtime.sendMessage({ action: "buildProjectSkeleton", projectId: projState.activeProjectId });
  if (!resp || !resp.success) { panel.innerHTML = "<p style='color:var(--error);'>Failed to build skeleton</p>"; return; }
  const s = resp.skeleton;
  const esc = t => (t||"").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const maxShow = 5;
  function renderList(arr, labelFn) {
    if (!arr.length) return "<span style='color:var(--text-muted);'>None</span>";
    const shown = arr.slice(0, maxShow);
    let html = shown.map(x => `<div class="skel-item">${labelFn(x)}</div>`).join("");
    if (arr.length > maxShow) html += `<div class="skel-item" style="color:var(--text-muted);">+${arr.length - maxShow} more...</div>`;
    return html;
  }
  panel.innerHTML = `
    <div class="skel-grid">
      <div class="skel-section">
        <div class="skel-heading">Items (${s.items.total})</div>
        ${renderList(s.items.list, i => `<span class="skel-badge">${esc(i.type)}</span> ${i.url ? `<a href="${esc(i.url)}" target="_blank">${esc(i.title || i.url)}</a>` : esc(i.title || "Note")}`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Feeds (${s.feeds.total})</div>
        ${renderList(s.feeds.list, f => esc(f.title || f.url))}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Bookmarks (${s.bookmarks.total})</div>
        ${renderList(s.bookmarks.list, b => `<a href="${esc(b.url)}" target="_blank">${esc(b.title || b.url)}</a>`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Monitors (${s.monitors.total})</div>
        ${renderList(s.monitors.list, m => esc(m.label || m.url))}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Entities (${s.entities.total})</div>
        ${renderList(s.entities.list, e => `<span class="skel-badge">${esc(e.type)}</span> ${esc(e.label)} <span style="color:var(--text-muted);">(${e.mentions})</span>`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Keywords (${s.keywords.total})</div>
        ${renderList(s.keywords.list, k => `<span style="color:var(--accent);">"${esc(k)}"</span>`)}
      </div>
    </div>
    <div class="skel-footer">Data: ${s.items.total} items &middot; ${s.entities.total} entities &middot; ${s.feeds.total} feeds &middot; ${s.monitors.total} monitors &middot; ${s.bookmarks.total} bookmarks</div>
  `;
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
// ──────────────────────────────────────────────
// Cloud Backup UI
// ──────────────────────────────────────────────

function initCloudBackup() {
  // Provider tab switching
  document.querySelectorAll(".cloud-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".cloud-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".cloud-panel").forEach(p => p.classList.add("hidden"));
      tab.classList.add("active");
      document.querySelector(`[data-cloud-panel="${tab.dataset.cloudTab}"]`).classList.remove("hidden");
    });
  });

  // Show redirect URL for Google (must fetch from background — identity API not available in options page)
  const redirectEl = document.getElementById("cloud-google-redirect");
  if (redirectEl) {
    browser.runtime.sendMessage({ action: "cloudGetRedirectURL" }).then(resp => {
      if (resp?.success) redirectEl.textContent = "Redirect URI (add this to your GCP OAuth client): " + resp.url;
      else redirectEl.textContent = "Could not get redirect URI: " + (resp?.error || "identity API unavailable");
    }).catch(() => {});
  }

  // Connect handlers
  document.getElementById("cloud-google-connect").addEventListener("click", async () => {
    const clientId = document.getElementById("cloud-google-clientid").value.trim();
    if (!clientId) return;
    setCloudStatus("google", "Connecting...");
    const resp = await browser.runtime.sendMessage({ action: "cloudConnect", providerKey: "google", clientId });
    setCloudStatus("google", resp?.success ? `Connected as ${resp.email || ""}` : `Failed: ${resp?.error || "unknown"}`);
    refreshCloudStatus();
  });
  document.getElementById("cloud-google-disconnect").addEventListener("click", async () => {
    await browser.runtime.sendMessage({ action: "cloudDisconnect", providerKey: "google" });
    setCloudStatus("google", "Disconnected");
    refreshCloudStatus();
  });

  document.getElementById("cloud-dropbox-connect").addEventListener("click", async () => {
    const appKey = document.getElementById("cloud-dropbox-appkey").value.trim();
    if (!appKey) return;
    setCloudStatus("dropbox", "Connecting...");
    const resp = await browser.runtime.sendMessage({ action: "cloudConnect", providerKey: "dropbox", appKey });
    setCloudStatus("dropbox", resp?.success ? `Connected as ${resp.userName || ""}` : `Failed: ${resp?.error || "unknown"}`);
    refreshCloudStatus();
  });
  document.getElementById("cloud-dropbox-disconnect").addEventListener("click", async () => {
    await browser.runtime.sendMessage({ action: "cloudDisconnect", providerKey: "dropbox" });
    setCloudStatus("dropbox", "Disconnected");
    refreshCloudStatus();
  });

  document.getElementById("cloud-webdav-connect").addEventListener("click", async () => {
    const url = document.getElementById("cloud-webdav-url").value.trim();
    const username = document.getElementById("cloud-webdav-user").value.trim();
    const password = document.getElementById("cloud-webdav-pass").value;
    if (!url) return;
    setCloudStatus("webdav", "Connecting...");
    const resp = await browser.runtime.sendMessage({ action: "cloudConnect", providerKey: "webdav", url, username, password });
    setCloudStatus("webdav", resp?.success ? "Connected" : `Failed: ${resp?.error || "unknown"}`);
    refreshCloudStatus();
  });
  document.getElementById("cloud-webdav-test").addEventListener("click", async () => {
    setCloudStatus("webdav", "Testing...");
    const resp = await browser.runtime.sendMessage({ action: "cloudTestConnection", providerKey: "webdav" });
    setCloudStatus("webdav", resp?.success ? "Connection OK" : `Failed: ${resp?.error || "unknown"}`);
  });
  document.getElementById("cloud-webdav-disconnect").addEventListener("click", async () => {
    await browser.runtime.sendMessage({ action: "cloudDisconnect", providerKey: "webdav" });
    setCloudStatus("webdav", "Disconnected");
    refreshCloudStatus();
  });

  document.getElementById("cloud-s3-connect").addEventListener("click", async () => {
    const endpoint = document.getElementById("cloud-s3-endpoint").value.trim();
    const bucket = document.getElementById("cloud-s3-bucket").value.trim();
    const accessKey = document.getElementById("cloud-s3-key").value.trim();
    const secretKey = document.getElementById("cloud-s3-secret").value;
    const region = document.getElementById("cloud-s3-region").value.trim();
    if (!endpoint || !bucket || !accessKey || !secretKey) return;
    setCloudStatus("s3", "Connecting...");
    const resp = await browser.runtime.sendMessage({ action: "cloudConnect", providerKey: "s3", endpoint, bucket, accessKey, secretKey, region });
    setCloudStatus("s3", resp?.success ? "Connected" : `Failed: ${resp?.error || "unknown"}`);
    refreshCloudStatus();
  });
  document.getElementById("cloud-s3-test").addEventListener("click", async () => {
    setCloudStatus("s3", "Testing...");
    const resp = await browser.runtime.sendMessage({ action: "cloudTestConnection", providerKey: "s3" });
    setCloudStatus("s3", resp?.success ? "Connection OK" : `Failed: ${resp?.error || "unknown"}`);
  });
  document.getElementById("cloud-s3-disconnect").addEventListener("click", async () => {
    await browser.runtime.sendMessage({ action: "cloudDisconnect", providerKey: "s3" });
    setCloudStatus("s3", "Disconnected");
    refreshCloudStatus();
  });

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
    refreshCloudStatus();
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

  refreshCloudStatus();
}

function setCloudStatus(provider, msg) {
  const el = document.getElementById(`cloud-${provider}-status`);
  if (el) el.textContent = msg;
}

async function refreshCloudStatus() {
  const resp = await browser.runtime.sendMessage({ action: "cloudGetStatus" });
  if (!resp?.success) return;
  const providers = resp.providers || {};
  for (const [key, connected] of Object.entries(providers)) {
    const connectBtn = document.getElementById(`cloud-${key}-connect`);
    const disconnectBtn = document.getElementById(`cloud-${key}-disconnect`);
    if (connectBtn) connectBtn.classList.toggle("hidden", connected);
    if (disconnectBtn) disconnectBtn.classList.toggle("hidden", !connected);
    if (connected) setCloudStatus(key, "Connected");
  }
  // Show restore section if any provider connected
  const anyConnected = Object.values(providers).some(Boolean);
  document.getElementById("cloud-restore-section").classList.toggle("hidden", !anyConnected);
  // Last backup
  if (resp.lastBackup) {
    const d = new Date(resp.lastBackup.date);
    document.getElementById("cloud-last-backup").textContent = `Last backup: ${d.toLocaleString()} (${(resp.lastBackup.size / 1024).toFixed(1)} KB)`;
  }
}

function initStorageManagement() {
  updateStorageUsage();

  document.getElementById("purge-history-btn").addEventListener("click", purgeOldHistory);
  document.getElementById("purge-snapshots-btn").addEventListener("click", purgeMonitorSnapshots);
  document.getElementById("purge-cached-btn").addEventListener("click", purgeAllCachedData);

  // Wipe Everything
  const wipeBtn = document.getElementById("wipe-everything-btn");
  const wipeConfirm = document.getElementById("wipe-confirm");
  wipeBtn.addEventListener("click", () => wipeConfirm.classList.remove("hidden"));
  document.getElementById("wipe-confirm-no").addEventListener("click", () => wipeConfirm.classList.add("hidden"));
  document.getElementById("wipe-confirm-yes").addEventListener("click", async () => {
    wipeBtn.disabled = true;
    wipeConfirm.classList.add("hidden");
    showPurgeStatus("Wiping all data...");
    const resp = await browser.runtime.sendMessage({ action: "wipeEverything" });
    if (resp && resp.success) {
      showPurgeStatus("All Argus data has been permanently deleted.");
      setTimeout(() => location.reload(), 2000);
    } else {
      showPurgeStatus("Wipe failed: " + (resp?.error || "unknown error"));
      wipeBtn.disabled = false;
    }
  });

  // Knowledge Graph
  document.getElementById("kg-open-graph").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("osint/graph.html?mode=global") });
  });
  document.getElementById("kg-run-inference").addEventListener("click", async () => {
    const resp = await browser.runtime.sendMessage({ action: "runKGInference" });
    showKGStatus(resp && resp.inferred ? `Inferred ${resp.inferred} new relationships` : "No new inferences");
  });
  document.getElementById("kg-prune-noise").addEventListener("click", async () => {
    const resp = await browser.runtime.sendMessage({ action: "pruneKGNoise" });
    showKGStatus(resp && resp.pruned ? `Pruned ${resp.pruned} noisy entities` : "No noise found");
    updateKGStats();
  });
  document.getElementById("kg-retype").addEventListener("click", async () => {
    const resp = await browser.runtime.sendMessage({ action: "retypeKGEntities" });
    const parts = [];
    if (resp?.fixed) parts.push(`Re-typed ${resp.fixed}`);
    if (resp?.pruned) parts.push(`pruned ${resp.pruned} noise`);
    showKGStatus(parts.length ? parts.join(", ") : "All entities already correct");
    updateKGStats();
  });
  document.getElementById("kg-clear").addEventListener("click", async () => {
    if (!confirm("Clear the entire knowledge graph? This cannot be undone.")) return;
    await browser.runtime.sendMessage({ action: "clearKG" });
    showKGStatus("Knowledge graph cleared");
    updateKGStats();
  });
  updateKGStats();
  loadPendingMerges();

  // ── Entity Dictionary Editor ──
  {
    let _dictCurrentTab = "noise";
    let _dictData = { noise: [], notPersonFirstWords: [], commonNouns: [], locations: [], orgs: [] };
    const dictLabels = {
      noise: "Noise Phrases", notPersonFirstWords: "Not-Person First Words",
      commonNouns: "Common Nouns (not last names)", locations: "Known Locations", orgs: "Known Organizations"
    };
    const dictItems = document.getElementById("kg-dict-items");
    const dictInput = document.getElementById("kg-dict-input");
    const dictAddBtn = document.getElementById("kg-dict-add");
    const dictStatus = document.getElementById("kg-dict-status");
    const dictStatsEl = document.getElementById("kg-dict-stats");
    const dictReprocess = document.getElementById("kg-dict-reprocess");

    function showDictStatus(msg) {
      if (!dictStatus) return;
      dictStatus.textContent = msg;
      dictStatus.classList.remove("hidden");
      setTimeout(() => dictStatus.classList.add("hidden"), 2500);
    }

    async function loadDictStats() {
      try {
        const stats = await browser.runtime.sendMessage({ action: "getKGDictionaryStats" });
        if (stats && dictStatsEl) {
          const parts = [
            `Noise: ${stats.noise}`, `Not-Person: ${stats.notPersonFirstWords}`,
            `Nouns: ${stats.commonNouns}`, `Locations: ${stats.locations}`,
            `Orgs: ${stats.orgs}`, `First Names: ${stats.validFirstNames}`,
            `Phrases: ${stats.notPersonPhrases}`
          ];
          dictStatsEl.textContent = "Built-in: " + parts.join(" · ");
        }
      } catch (e) { console.warn("[DictUI] Stats error:", e); }
    }

    async function loadDictData() {
      try {
        _dictData = await browser.runtime.sendMessage({ action: "getKGDictionaries" });
        if (!_dictData || typeof _dictData !== "object") {
          _dictData = { noise: [], notPersonFirstWords: [], commonNouns: [], locations: [], orgs: [] };
        }
      } catch (e) { console.warn("[DictUI] Load error:", e); }
      renderDictItems();
    }

    function renderDictItems() {
      if (!dictItems) return;
      const entries = _dictData[_dictCurrentTab] || [];
      dictItems.textContent = "";
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.style.cssText = "font-size:12px;color:var(--text-muted);padding:8px;";
        empty.textContent = `No custom ${dictLabels[_dictCurrentTab] || _dictCurrentTab} entries. Built-in dictionary is still active.`;
        dictItems.appendChild(empty);
        return;
      }
      for (const entry of entries) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--border);font-size:12px;";
        const label = document.createElement("span");
        label.textContent = entry;
        label.style.color = "var(--text-primary)";
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
        removeBtn.title = "Remove";
        removeBtn.style.cssText = "background:none;border:none;color:var(--error);font-size:16px;cursor:pointer;padding:0 4px;line-height:1;";
        removeBtn.addEventListener("click", async () => {
          _dictData[_dictCurrentTab] = _dictData[_dictCurrentTab].filter(e => e !== entry);
          await saveDictData();
          renderDictItems();
        });
        row.appendChild(label);
        row.appendChild(removeBtn);
        dictItems.appendChild(row);
      }
    }

    async function saveDictData() {
      try {
        await browser.runtime.sendMessage({ action: "saveKGDictionaries", dictionaries: _dictData });
        showDictStatus("Saved");
      } catch (e) { showDictStatus("Error saving"); }
    }

    // Tab switching
    document.querySelectorAll(".kg-dict-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".kg-dict-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        _dictCurrentTab = btn.dataset.dict;
        if (dictInput) dictInput.placeholder = `Add ${dictLabels[_dictCurrentTab] || "entry"}...`;
        renderDictItems();
      });
    });

    // Add entry
    if (dictAddBtn && dictInput) {
      const addEntry = async () => {
        const val = dictInput.value.trim().toLowerCase();
        if (!val) return;
        if (!_dictData[_dictCurrentTab]) _dictData[_dictCurrentTab] = [];
        if (_dictData[_dictCurrentTab].includes(val)) {
          showDictStatus("Already exists");
          return;
        }
        _dictData[_dictCurrentTab].push(val);
        _dictData[_dictCurrentTab].sort();
        dictInput.value = "";
        await saveDictData();
        renderDictItems();
      };
      dictAddBtn.addEventListener("click", addEntry);
      dictInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addEntry(); });
    }

    // Re-type all entities with updated dictionaries
    if (dictReprocess) {
      dictReprocess.addEventListener("click", async () => {
        dictReprocess.disabled = true;
        dictReprocess.textContent = "Processing...";
        try {
          const resp = await browser.runtime.sendMessage({ action: "retypeKGEntities" });
          const parts = [];
          if (resp?.fixed) parts.push(`Re-typed ${resp.fixed}`);
          if (resp?.pruned) parts.push(`pruned ${resp.pruned} noise`);
          showDictStatus(parts.length ? parts.join(", ") : "All entities correct");
          updateKGStats();
          updateTabBadges();
        } catch (e) { showDictStatus("Error"); }
        dictReprocess.disabled = false;
        dictReprocess.textContent = "Re-type All Entities";
      });
    }

    loadDictStats();
    loadDictData();
  }

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
