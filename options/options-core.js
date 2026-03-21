// ──────────────────────────────────────────────
// Single-tab navigation — navigate current tab to another Argus page
// ──────────────────────────────────────────────
function focusOrCreatePage(urlPath) {
  window.location.href = browser.runtime.getURL(urlPath);
}

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
let currentDataProviderKey = "gdrive";
let customPresets = {};
let providers = {};
let dataProviders = {};
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
  // Regex Scanner prompts
  "regex.threat": {
    label: "Regex \u2014 Threat Check", group: "Regex Scanner",
    system: "You are a cybersecurity analyst specializing in exposure assessment and data leak detection. Analyze regex scan findings from a web page and produce a structured security assessment. Be direct and actionable.",
    prompt: "(Auto-generated from regex findings. Edit the system prompt to change the analyst persona.)"
  },
  "regex.entities": {
    label: "Regex \u2014 Entity Analysis", group: "Regex Scanner",
    system: "You are an OSINT analyst. Extract and classify entities from regex scan findings into a structured intelligence report. Identify relationships, affiliations, and patterns.",
    prompt: "(Auto-generated from regex findings. Edit the system prompt to change the analyst persona.)"
  },
  "regex.summary": {
    label: "Regex \u2014 Summary", group: "Regex Scanner",
    system: "You are a research assistant producing concise intelligence summaries from automated data extraction results.",
    prompt: "(Auto-generated from regex findings. Edit the system prompt to change the analyst persona.)"
  },
  // Workbench & Chat system prompts (viewable in Advanced Prompts)
  "workbench": {
    label: "Workbench Analysis", group: "Workbench & Chat",
    system: "You are an OSINT research analyst embedded in an investigation workbench called Argus. The user has selected specific items from their project and placed them on a work surface for deep analysis. Your job is to find connections, patterns, contradictions, and actionable insights across the selected data. Be thorough but concise. Reference specific items, entities, and sources by name. When you identify new entities or relationships, call them out explicitly so the user can add them to their knowledge graph. Always consider: who, what, when, where, why, and how. If the data is insufficient to draw a conclusion, say so and suggest what additional data would help.",
    prompt: "(Auto-generated from selected work surface items. Edit only the system prompt to change the analyst persona.)"
  },
  "chat": {
    label: "General Chat", group: "Workbench & Chat",
    system: "(No system prompt \u2014 Chat sends messages directly to the AI with no hidden instructions. This is intentional: Chat is a clean, unbiased conversation space.)",
    prompt: "(No user prompt template \u2014 the user's message is sent as-is.)"
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
  trackMyPages: document.getElementById("track-my-pages"),
  trawlEnabled: document.getElementById("trawl-enabled"),
  trawlScheduleEnabled: document.getElementById("trawl-schedule-enabled"),
  trawlScheduleConfig: document.getElementById("trawl-schedule-config"),
  trawlStartHour: document.getElementById("trawl-start-hour"),
  trawlEndHour: document.getElementById("trawl-end-hour"),
  trawlDayChecks: document.getElementById("trawl-day-checks"),
  trawlDurationEnabled: document.getElementById("trawl-duration-enabled"),
  trawlDurationPreset: document.getElementById("trawl-duration-preset"),
  trawlDurationConfig: document.getElementById("trawl-duration-config"),
  trawlDurationSlider: document.getElementById("trawl-duration-slider"),
  trawlDurationLabel: document.getElementById("trawl-duration-label"),
  incognitoForceEnabled: document.getElementById("incognito-force-enabled"),
  incognitoAddDomain: document.getElementById("incognito-add-domain"),
  incognitoAddBtn: document.getElementById("incognito-add-btn"),
  incognitoSitesList: document.getElementById("incognito-sites-list"),
  responseLanguage: document.getElementById("response-language"),
  openaiReasoningEffort: document.getElementById("openai-reasoning-effort"),
  openaiReasoningHint: document.getElementById("openai-reasoning-hint"),
  openaiReasoningCard: document.getElementById("openai-reasoning-card"),
  saveIndicator: document.getElementById("save-indicator"),
  versionNumber: document.getElementById("version-number"),
  // Extended thinking
  extendedThinkingEnabled: document.getElementById("extended-thinking-enabled"),
  thinkingBudget: document.getElementById("thinking-budget"),
  thinkingBudgetHint: document.getElementById("thinking-budget-hint"),
  // Auto-analyze
  // Bookmark tagging prompt
  // Advanced prompts
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
  monitorAutomation: document.getElementById("monitor-automation"),
  monitorProjectSelect: document.getElementById("monitor-project-select"),
  addMonitor: document.getElementById("add-monitor"),
  monitorStatus: document.getElementById("monitor-status"),
  monitorStorageBar: document.getElementById("monitor-storage-bar"),
  monitorStorageLabel: document.getElementById("monitor-storage-label"),
  monitorStorageFill: document.getElementById("monitor-storage-fill"),
  // RSS Feeds
  // Feed Keyword Routes
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

  try { await loadAllSettings(); } catch(e) { console.error("[Argus init] loadAllSettings failed:", e); }
  try { selectProviderTab("xai"); } catch(e) { console.error("[Argus init] selectProviderTab failed:", e); }
  try { selectDataProviderTab("gdrive"); } catch(e) { console.error("[Argus init] selectDataProviderTab failed:", e); }
  try { renderMonitors(); } catch(e) { console.error("[Argus init] renderMonitors failed:", e); }
  try { attachListeners(); } catch(e) { console.error("[Argus init] attachListeners failed:", e); }
  try { updateReasoningControls(); } catch(e) { console.error("[Argus init] updateReasoningControls failed:", e); }
  try { updateConsoleStatusStrip(); } catch(e) { console.error("[Argus init] updateConsoleStatusStrip failed:", e); }
  try { loadVersion(); } catch(e) { console.error("[Argus init] loadVersion failed:", e); }
  try { initMainTabs(); } catch(e) { console.error("[Argus init] initMainTabs failed:", e); }
  try { initHelpExtLinks(); } catch(e) { console.error("[Argus init] initHelpExtLinks failed:", e); }
  try { initStorageManagement(); } catch(e) { console.error("[Argus init] initStorageManagement failed:", e); }
  try { initCloudBackup(); } catch(e) { console.error("[Argus init] initCloudBackup failed:", e); }
  try { initUserProfile(); } catch(e) { console.error("[Argus init] initUserProfile failed:", e); }

  // Refresh buttons on data tabs
  document.getElementById("bm-refresh")?.addEventListener("click", () => {
    if (bmState.initialized) bmLoadBookmarks();
  });
  document.getElementById("mon-refresh")?.addEventListener("click", () => renderMonitors());

  // Live data refresh — listen for background data changes
  let _refreshDebounce = {};
  browser.runtime.onMessage.addListener((message) => {
    if (message.type !== "argusDataChanged") return;
    const store = message.store;
    if (_refreshDebounce[store]) clearTimeout(_refreshDebounce[store]);
    _refreshDebounce[store] = setTimeout(() => {
      delete _refreshDebounce[store];
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
    bookmarks: 0, projects: 0, monitors: 0, feeds: 0, osint: 0, automation: 0, sources: 0
  };
  try {
    const [bkResp, prResp, moResp, fdResp, kgStats, auResp, srcResp] = await Promise.all([
      browser.runtime.sendMessage({ action: "getBookmarks" }),
      browser.runtime.sendMessage({ action: "getProjects" }),
      browser.runtime.sendMessage({ action: "getMonitors" }),
      browser.runtime.sendMessage({ action: "getFeeds" }),
      browser.runtime.sendMessage({ action: "getKGStats" }).catch(() => null),
      browser.runtime.sendMessage({ action: "getAutomations" }).catch(() => null),
      browser.runtime.sendMessage({ action: "getSources" }).catch(() => null)
    ]);
    if (bkResp && bkResp.total != null) badges.bookmarks = bkResp.total;
    if (prResp && Array.isArray(prResp.projects)) badges.projects = prResp.projects.length;
    if (moResp && Array.isArray(moResp.monitors)) badges.monitors = moResp.monitors.length;
    if (fdResp && Array.isArray(fdResp.feeds)) badges.feeds = fdResp.feeds.length;
    if (kgStats && typeof kgStats.nodeCount === "number") badges.osint = kgStats.nodeCount;
    if (auResp && Array.isArray(auResp.automations)) badges.automation = auResp.automations.length;
    if (srcResp && Array.isArray(srcResp.sources)) badges.sources = srcResp.sources.length;
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
    trackMyPages: false,
    trawlEnabled: false,
    incognitoForceEnabled: false,
    incognitoSites: [],
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

  // Load default project settings
  initSettingsProjectDropdowns();

  if (settings.apiKey && !providers.xai.apiKey) {
    providers.xai.apiKey = settings.apiKey;
  }

  el.defaultProvider.value = settings.defaultProvider;
  el.maxTokens.value = settings.maxTokens;
  el.maxInputChars.value = settings.maxInputChars;
  el.temperature.value = settings.temperature;
  el.tempValue.textContent = settings.temperature;
  el.showBadge.checked = settings.showBadge !== false;
  el.trackMyPages.checked = settings.trackMyPages === true;
  el.trawlEnabled.checked = settings.trawlEnabled === true;
  // Trawl schedule
  loadTrawlScheduleUI();
  // Trawl duration timer
  loadTrawlDurationUI();
  el.incognitoForceEnabled.checked = settings.incognitoForceEnabled === true;
  renderIncognitoSites(settings.incognitoSites || []);
  el.responseLanguage.value = settings.responseLanguage ?? "auto";
  // Graduated tab element - guard against null
  if (el.reasoningEffort) el.reasoningEffort.value = settings.reasoningEffort;
  el.openaiReasoningEffort.value = settings.openaiReasoningEffort || "medium";
  el.extendedThinkingEnabled.checked = settings.extendedThinking.enabled;
  el.thinkingBudget.value = settings.extendedThinking.budgetTokens || 10000;
  el.maxHistory.value = settings.maxHistorySize;
  customPresets = settings.customPresets || {};
  autoAnalyzeRules = settings.autoAnalyzeRules || [];
  feedKeywordRoutes = settings.feedKeywordRoutes || [];
  advancedPrompts = settings.advancedPrompts || {};

  populateDefaultPresetDropdown();
  // Graduated tab element - guard against null
  if (el.defaultPreset) el.defaultPreset.value = settings.defaultPreset || "summary";
  // Graduated tab element - guard against null
  if (el.bookmarkTagPrompt) el.bookmarkTagPrompt.value = settings.bookmarkTagPrompt || DEFAULT_BOOKMARK_TAG_PROMPT;

  updateProviderTabIndicators();
  loadDataProviderFields();
  loadPasteProviderFields();

  // Backup schedule
  document.getElementById("backup-enabled").checked = settings.backupEnabled || false;
  document.getElementById("backup-interval").value = settings.backupInterval || 1440;
  document.getElementById("backup-all-providers").checked = settings.backupAllProviders !== false;
}

// ── Default Provider Status ──

const CLOUD_LABELS = { all: "All connected", google: "Google Drive", dropbox: "Dropbox", webdav: "WebDAV", s3: "S3" };
const PASTE_LABELS = { "": "None", gist: "GitHub Gist", pastebin: "Pastebin", privatebin: "PrivateBin" };

function updateDefaultProviderStatus() {
  const cloudVal = document.getElementById("default-cloud-provider")?.value || "all";
  const pasteVal = document.getElementById("default-paste-provider")?.value || "";

  // Update status indicator on Providers tab
  const statusEl = document.getElementById("default-provider-status");
  if (statusEl) {
    const parts = [];
    // Check which cloud providers are actually connected
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
    // Check paste providers
    const connectedPaste = [];
    for (const k of ["gist", "pastebin", "privatebin"]) {
      if (pasteProviders[k]?.connected) connectedPaste.push(PASTE_LABELS[k]);
    }
    if (connectedPaste.length) {
      parts.push(`Paste: ${PASTE_LABELS[pasteVal] || "None"} (${connectedPaste.length} connected: ${connectedPaste.join(", ")})`);
    } else {
      parts.push("Paste: No services connected");
    }
    statusEl.textContent = parts.join("  ·  ");
  }

  // Update read-only summary on Settings tab
  const settingsBox = document.getElementById("settings-default-providers");
  const settingsCloud = document.getElementById("settings-default-cloud");
  const settingsPaste = document.getElementById("settings-default-paste");
  if (settingsBox && settingsCloud && settingsPaste) {
    settingsBox.style.display = "block";
    settingsCloud.textContent = `Cloud storage: ${CLOUD_LABELS[cloudVal] || cloudVal}`;
    settingsPaste.textContent = `Paste service: ${PASTE_LABELS[pasteVal] || "None"}`;
  }

  // Link to jump to Providers tab defaults section
  const gotoDefaults = document.getElementById("settings-goto-defaults");
  if (gotoDefaults && !gotoDefaults._bound) {
    gotoDefaults._bound = true;
    gotoDefaults.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('.nav-tab[data-tab="providers"]')?.click();
      setTimeout(() => document.getElementById("default-cloud-provider")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    });
  }
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
    defaultPreset: el.defaultPreset?.value || "summary",
    providers,
    maxTokens: parseInt(el.maxTokens.value, 10) || 2048,
    maxInputChars: parseInt(el.maxInputChars.value, 10) || 100000,
    temperature: parseFloat(el.temperature.value),
    reasoningEffort: el.reasoningEffort?.value || "medium",
    openaiReasoningEffort: el.openaiReasoningEffort?.value || "medium",
    customPresets,
    // Graduated tab element - guard against null
    bookmarkTagPrompt: (el.bookmarkTagPrompt?.value || "") !== DEFAULT_BOOKMARK_TAG_PROMPT ? (el.bookmarkTagPrompt?.value || "") : "",
    extendedThinking: {
      enabled: el.extendedThinkingEnabled.checked,
      budgetTokens: parseInt(el.thinkingBudget.value, 10) || 10000
    },
    autoAnalyzeRules,
    feedKeywordRoutes,
    advancedPrompts,
    maxHistorySize: parseInt(el.maxHistory.value, 10) || 200,
    showBadge: el.showBadge.checked,
    trackMyPages: el.trackMyPages.checked,
    trawlEnabled: el.trawlEnabled.checked,
    incognitoForceEnabled: el.incognitoForceEnabled.checked,
    responseLanguage: el.responseLanguage.value,
    dataProviders,
    pasteProviders,
    defaultCloudProvider: document.getElementById("default-cloud-provider")?.value || "all",
    defaultPasteProvider: document.getElementById("default-paste-provider")?.value || "",
    backupEnabled: document.getElementById("backup-enabled").checked,
    backupInterval: parseInt(document.getElementById("backup-interval").value, 10) || 1440,
    backupAllProviders: document.getElementById("backup-all-providers").checked
  });
  flashSaved();
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
// Main tab navigation
// ──────────────────────────────────────────────
function initMainTabs() {
  // Inject sub-header bars into tab panels (matching Workbench/Reports style)
  const panelIcons = {
    home: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    bookmarks: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    projects: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    monitors: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    feeds: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
    osint: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    automation: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    archive: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>',
    prompts: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    providers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    resources: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    settings: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
  };
  const panelTitles = {
    home: "Argus Console", bookmarks: "Bookmarks", projects: "Projects", monitors: "Monitors",
    feeds: "Feeds", osint: "OSINT", automation: "Automation", archive: "Redirects",
    prompts: "Prompts", providers: "Providers", resources: "Resources", settings: "Settings", help: "Help"
  };
  document.querySelectorAll(".tab-panel[data-panel]").forEach(panel => {
    const key = panel.dataset.panel;
    if (!panelIcons[key] || key === "home") return;
    const bar = document.createElement("div");
    bar.className = "panel-subheader";
    bar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${panelIcons[key]}</svg><span class="panel-subheader-title">${panelTitles[key] || key}</span>`;
    panel.insertBefore(bar, panel.firstChild);
  });

  const nav = document.getElementById("main-nav");
  const tabs = nav.querySelectorAll(".nav-tab");
  const panels = document.querySelectorAll(".tab-panel");

  // Restore last active tab from URL hash or sessionStorage
  const hash = window.location.hash.replace("#", "");
  let savedTab = hash || sessionStorage.getItem("argus-activeTab") || "home";

  // Help tab removed — redirect to GitHub README
  if (savedTab === "help" || savedTab.startsWith("help-")) {
    browser.tabs.create({ url: ARGUS_HELP_URL });
    savedTab = "home";
  }

  switchMainTab(savedTab, tabs, panels);

  // Pre-fill automation rule URL from query param (sent by popup)
  const urlParams = new URLSearchParams(window.location.search);
  const prefillRule = urlParams.get("prefillRule");
  if (prefillRule && el.ruleUrl) {
    try {
      const u = new URL(prefillRule);
      // Graduated tab element - guard against null
      if (el.ruleUrl) el.ruleUrl.value = `*${u.hostname}${u.pathname}*`;
    } catch {
      // Graduated tab element - guard against null
      if (el.ruleUrl) el.ruleUrl.value = prefillRule;
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

  const appNavMap = {
    "open-projects-nav": null, // handled separately — navigates to #projects on this page
    "open-kg-nav": "osint/graph.html?mode=global",
    "open-workbench-nav": "workbench/workbench.html",
    "open-history-nav": "history/history.html",
    "open-draft-nav": "reporting/reporting.html",
    "open-reader-nav": "feeds/feeds.html",
    "open-images-nav": "osint/images.html",
    "open-terminal-nav": "ssh/ssh.html"
  };
  for (const [id, path] of Object.entries(appNavMap)) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    if (path) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        focusOrCreatePage(path);
      });
    } else {
      // Console entry tab — switch to whichever section is the entry point
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const { consoleEntryTab } = await browser.storage.local.get({ consoleEntryTab: "home" });
        const navTabs = document.querySelectorAll(".nav-tab[data-tab]");
        const navPanels = document.querySelectorAll(".tab-panel[data-panel]");
        switchMainTab(consoleEntryTab, navTabs, navPanels);
        window.location.hash = consoleEntryTab;
      });
    }
  }

  // Chat nav button → switch to home tab and activate inline chat
  document.getElementById("open-chat-nav")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const navTabs = document.querySelectorAll(".nav-tab[data-tab]");
    const navPanels = document.querySelectorAll(".tab-panel[data-panel]");
    switchMainTab("home", navTabs, navPanels);
    window.location.hash = "home";
    setTimeout(() => {
      const chatBtn = document.getElementById("home-chat-btn");
      const homeLanding = document.querySelector(".home-landing");
      if (chatBtn && homeLanding && !homeLanding.classList.contains("chat-mode")) {
        chatBtn.click();
      }
      document.getElementById("home-chat-input")?.focus();
    }, 80);
  });

  // ── Home Nav Button config ──
  const HOME_NAV_DEST_OPTIONS = [
    { label: "── Tabs ──", value: "", disabled: true },
    { label: "Home",       value: "tab:home" },
    { label: "Bookmarks",  value: "tab:bookmarks" },
    { label: "Projects",   value: "tab:projects" },
    { label: "Sources",    value: "tab:sources" },
    { label: "Prompts",    value: "tab:prompts" },
    { label: "── Pages ──", value: "", disabled: true },
    { label: "Feed Reader",  value: "page:feeds/feeds.html" },
    { label: "Reports",      value: "page:history/history.html" },
    { label: "KG Graph",     value: "page:osint/graph.html?mode=global" },
    { label: "Workbench",    value: "page:workbench/workbench.html" },
    { label: "Publisher",    value: "page:reporting/reporting.html" },
    { label: "Finance",      value: "page:finance/finance.html" },
    { label: "Images",       value: "page:osint/images.html" },
    { label: "Trawl",        value: "page:trawl/trawl.html" },
    { label: "SSH Terminal", value: "page:ssh/ssh.html" },
  ];

  const HOME_NAV_DEFAULTS = [
    { dest: "tab:projects" },
    { dest: "page:feeds/feeds.html" },
    { dest: "tab:prompts" },
  ];

  function buildHomeNavSelects() {
    [1, 2, 3].forEach(i => {
      const sel = document.getElementById(`home-nav-dest-${i}`);
      if (!sel) return;
      sel.innerHTML = HOME_NAV_DEST_OPTIONS.map(o =>
        `<option value="${o.value}"${o.disabled ? " disabled" : ""}>${o.label}</option>`
      ).join("");
    });
  }

  function getDestLabel(dest) {
    return HOME_NAV_DEST_OPTIONS.find(o => o.value === dest)?.label || dest;
  }

  async function loadHomeNavConfig() {
    buildHomeNavSelects();
    const { homeNavBtns } = await browser.storage.local.get({ homeNavBtns: HOME_NAV_DEFAULTS });
    const cfg = (Array.isArray(homeNavBtns) && homeNavBtns.length === 3) ? homeNavBtns : HOME_NAV_DEFAULTS;
    cfg.forEach((btn, idx) => {
      const i = idx + 1;
      const destEl = document.getElementById(`home-nav-dest-${i}`);
      const navBtn = document.getElementById(`home-nav-btn-${i}`);
      if (destEl) destEl.value = btn.dest;
      // Store dest label for chat mode; landing mode always shows fixed category name from HTML
      if (navBtn) navBtn.dataset.chatLabel = getDestLabel(btn.dest);
    });
  }

  function saveHomeNavConfig() {
    const cfg = [1, 2, 3].map(i => ({
      dest: document.getElementById(`home-nav-dest-${i}`)?.value || HOME_NAV_DEFAULTS[i - 1].dest,
    }));
    browser.storage.local.set({ homeNavBtns: cfg });
    // Update chat label cache; if currently in chat mode, refresh visible text too
    const inChatMode = document.querySelector(".home-landing")?.classList.contains("chat-mode");
    cfg.forEach((btn, idx) => {
      const navBtn = document.getElementById(`home-nav-btn-${idx + 1}`);
      if (!navBtn) return;
      navBtn.dataset.chatLabel = getDestLabel(btn.dest);
      if (inChatMode) navBtn.textContent = navBtn.dataset.chatLabel;
    });
  }

  [1, 2, 3].forEach(i => {
    document.getElementById(`home-nav-dest-${i}`)?.addEventListener("change", saveHomeNavConfig);
  });

  loadHomeNavConfig();

  // Console tab label mapping (same as ribbon.js)
  const CONSOLE_ENTRY_LABELS = {
    bookmarks: "Bookmarks", monitors: "Monitors",
    archive: "Redirects", providers: "Providers",
    resources: "Resources", settings: "Settings"
  };

  // Update the console entry tab button label from storage
  (async function updateConsoleEntryLabel() {
    try {
      const { consoleEntryTab } = await browser.storage.local.get({ consoleEntryTab: "home" });
      if (consoleEntryTab && CONSOLE_ENTRY_LABELS[consoleEntryTab]) {
        const btn = document.getElementById("open-projects-nav");
        if (btn) {
          const span = btn.querySelector("span");
          if (span) span.textContent = CONSOLE_ENTRY_LABELS[consoleEntryTab];
          btn.title = CONSOLE_ENTRY_LABELS[consoleEntryTab];
        }
      }
    } catch (e) { /* use default */ }
  })();

  // Listen for live entry tab changes (from ribbon picker)
  window.addEventListener("consoleEntryChanged", (e) => {
    const tabId = e.detail?.tabId;
    if (tabId && CONSOLE_ENTRY_LABELS[tabId]) {
      const btn = document.getElementById("open-projects-nav");
      if (btn) {
        const span = btn.querySelector("span");
        if (span) span.textContent = CONSOLE_ENTRY_LABELS[tabId];
        btn.title = CONSOLE_ENTRY_LABELS[tabId];
      }
    }
  });

  // Console entry picker + app-nav removed — now handled by shared/ribbon.js
  // Wipe icon — quick link to Settings wipe section
  const wipeNavBtn = document.getElementById("wipe-nav");
  if (wipeNavBtn) {
    wipeNavBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tabs = document.querySelectorAll(".nav-tab[data-tab]");
      const panels = document.querySelectorAll(".tab-panel[data-panel]");
      switchMainTab("settings", tabs, panels);
      setTimeout(() => {
        const target = document.getElementById("settings-wipe");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    });
  }

  // Logo click → home tab
  const logoBtn = document.querySelector(".header-left");
  if (logoBtn) {
    logoBtn.style.cursor = "pointer";
    logoBtn.addEventListener("click", () => {
      switchMainTab("home", tabs, panels);
      sessionStorage.setItem("argus-activeTab", "home");
      window.location.hash = "home";
    });
  }

  // Home landing: icon guide + quick link clicks → navigate to that tab or graduated page
  const GRADUATED_PAGES = {
    projects: "projects/projects.html",
    automation: "automations/automations.html",
    sources: "sources/sources.html",
    prompts: "prompts/prompts.html",
    osint: "osint/graph.html",
    feeds: "feeds/feeds.html",
    tracker: "trawl/trawl.html",
    finance: "finance/finance.html",
  };
  document.querySelectorAll("[data-goto]").forEach(el => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      const target = el.dataset.goto;
      if (GRADUATED_PAGES[target]) {
        window.location.href = browser.runtime.getURL(GRADUATED_PAGES[target]);
      } else {
        switchMainTab(target, tabs, panels);
        sessionStorage.setItem("argus-activeTab", target);
        window.location.hash = target;
      }
    });
  });

  // ── Home nav category filter ──
  document.querySelectorAll("[data-nav-cat].search-cat-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.navCat;
      const inChatMode = document.querySelector(".home-landing")?.classList.contains("chat-mode");
      const navTabs = document.querySelectorAll(".nav-tab[data-tab]");
      const navPanels = document.querySelectorAll(".tab-panel[data-panel]");

      if (inChatMode) {
        // Look up stored destination for buttons 1-3
        const catMap = { research: 1, monitoring: 2, config: 3 };
        const btnIdx = catMap[cat];
        if (btnIdx) {
          browser.storage.local.get({ homeNavBtns: HOME_NAV_DEFAULTS }).then(({ homeNavBtns }) => {
            const cfg = (Array.isArray(homeNavBtns) && homeNavBtns.length === 3) ? homeNavBtns : HOME_NAV_DEFAULTS;
            const dest = cfg[btnIdx - 1]?.dest || "";
            if (dest.startsWith("tab:")) {
              const tab = dest.slice(4);
              if (tab === "home") {
                setHomeChatMode(false);
              } else {
                switchMainTab(tab, navTabs, navPanels);
                window.location.hash = tab;
              }
            } else if (dest.startsWith("page:")) {
              focusOrCreatePage(dest.slice(5));
            }
          });
          return;
        }
      } else {
        // In landing mode: filter the icon grid
        document.querySelectorAll("[data-nav-cat].search-cat-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".home-icon-item[data-nav-cat]").forEach(item => {
          item.style.display = (cat === "all" || item.dataset.navCat === cat) ? "" : "none";
        });
      }
    });
  });

  // ── Home search bar ──
  const SEARCH_ENGINES = {
    // Web search
    duckduckgo: "https://duckduckgo.com/?q=",
    startpage:  "https://www.startpage.com/do/dsearch?query=",
    brave:      "https://search.brave.com/search?q=",
    searx:      "https://searxng.org/search?q=",
    mojeek:     "https://www.mojeek.com/search?q=",
    google:     "https://www.google.com/search?q=",
    dogpile:    "https://www.dogpile.com/serp?q=",
    yandex:     "https://yandex.com/search/?text=",
    bing:       "https://www.bing.com/search?q=",
    // Academic / Research
    scholar:    "https://scholar.google.com/scholar?q=",
    semantic:   "https://www.semanticscholar.org/search?q=",
    jstor:      "https://www.jstor.org/action/doBasicSearch?Query=",
    arxiv:      "https://arxiv.org/search/?query=",
    pubmed:     "https://pubmed.ncbi.nlm.nih.gov/?term=",
    core:       "https://core.ac.uk/search?q=",
  };

  const homeSearchGo = document.getElementById("home-search-go");
  const homeSearchQuery = document.getElementById("home-search-query");
  const homeSearchEngine = document.getElementById("home-search-engine");
  const homeDeepDive = document.getElementById("home-deep-dive-toggle");
  const homeDeepPages = document.getElementById("home-deep-dive-pages");

  const homeMultiEngineRow = document.getElementById("home-multi-engine-row");

  // ── Custom search engines (console) ──
  async function loadHomeCustomSearchEngines() {
    const { customSearchEngines: engines } = await browser.storage.local.get({ customSearchEngines: [] });
    homeSearchEngine.querySelectorAll("option[data-cat='custom']").forEach(o => o.remove());
    homeMultiEngineRow.querySelectorAll(".me-chip[data-cat='custom']").forEach(c => c.remove());
    for (const eng of (engines || [])) {
      SEARCH_ENGINES[eng.id] = eng.url;
      const opt = document.createElement("option");
      opt.value = eng.id;
      opt.textContent = eng.name;
      opt.dataset.cat = "custom";
      homeSearchEngine.appendChild(opt);
      const lbl = document.createElement("label");
      lbl.className = "me-chip";
      lbl.dataset.cat = "custom";
      lbl.innerHTML = `<input type="checkbox" value="${eng.id}"> ${eng.name}`;
      lbl.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        if (confirm(`Remove "${eng.name}" from custom engines?`)) {
          const { customSearchEngines: curr } = await browser.storage.local.get({ customSearchEngines: [] });
          await browser.storage.local.set({ customSearchEngines: (curr || []).filter(x => x.id !== eng.id) });
          delete SEARCH_ENGINES[eng.id];
          loadHomeCustomSearchEngines();
        }
      });
      homeMultiEngineRow.appendChild(lbl);
    }
  }

  const homeCustomAddBtn = document.getElementById("home-search-cat-add");
  const homeCustomForm = document.getElementById("home-search-custom-form");
  if (homeCustomAddBtn && homeCustomForm) {
    homeCustomAddBtn.addEventListener("click", () => {
      homeCustomForm.classList.toggle("hidden");
      if (!homeCustomForm.classList.contains("hidden")) document.getElementById("home-search-custom-name").focus();
    });
    document.getElementById("home-search-custom-cancel").addEventListener("click", () => homeCustomForm.classList.add("hidden"));
    document.getElementById("home-search-custom-save").addEventListener("click", async () => {
      const name = document.getElementById("home-search-custom-name").value.trim();
      let url = document.getElementById("home-search-custom-url").value.trim();
      if (!name || !url) return;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      if (!url.includes("{q}")) {
        if (/[=\/]$/.test(url)) url += "{q}";
        else url += (url.includes("?") ? "&q={q}" : "?q={q}");
      }
      const id = "custom_" + name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const { customSearchEngines: curr } = await browser.storage.local.get({ customSearchEngines: [] });
      const engines = curr || [];
      if (engines.some(e => e.id === id)) { alert("Engine with this name already exists"); return; }
      engines.push({ id, name, url });
      await browser.storage.local.set({ customSearchEngines: engines });
      if (document.getElementById("home-search-custom-as-source").checked) {
        const baseUrl = url.replace(/\{q\}.*$/, "").replace(/[?&]$/, "");
        await browser.runtime.sendMessage({
          action: "saveSource",
          source: {
            id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            type: "webservice",
            aliases: [],
            addresses: [{ type: "website", value: baseUrl, label: name + " (search)" }],
            tags: ["search-engine"],
            location: "",
            notes: `Custom search engine. Query pattern: ${url}`,
            folder: "",
          }
        });
      }
      document.getElementById("home-search-custom-name").value = "";
      document.getElementById("home-search-custom-url").value = "";
      homeCustomForm.classList.add("hidden");
      await loadHomeCustomSearchEngines();
      applyHomeSearchCategory("custom");
    });
  }

  loadHomeCustomSearchEngines();

  let homeActiveSearchCat = "general";

  function applyHomeSearchCategory(cat) {
    homeActiveSearchCat = cat;
    document.querySelectorAll(".home-search-bar .search-cat-chip").forEach(c => {
      c.classList.toggle("active", c.dataset.cat === cat);
    });
    const opts = homeSearchEngine.querySelectorAll("option");
    let firstVisible = null;
    opts.forEach(opt => {
      const show = cat === "all" || opt.dataset.cat === cat;
      opt.hidden = !show;
      if (show && !firstVisible) firstVisible = opt;
    });
    const current = homeSearchEngine.querySelector(`option[value="${homeSearchEngine.value}"]`);
    if (current && current.hidden && firstVisible) {
      homeSearchEngine.value = firstVisible.value;
    }
    homeMultiEngineRow.querySelectorAll(".me-chip").forEach(chip => {
      const show = cat === "all" || chip.dataset.cat === cat;
      chip.style.display = show ? "" : "none";
    });
    const placeholders = { general: "Search the web... then analyze it", research: "Search papers...", medical: "Search biomedical literature...", custom: "Search...", all: "Search..." };
    homeSearchQuery.placeholder = placeholders[cat] || "Search...";
  }

  document.querySelectorAll(".home-search-bar .search-cat-chip").forEach(chip => {
    chip.addEventListener("click", () => applyHomeSearchCategory(chip.dataset.cat));
  });

  if (homeDeepDive) {
    homeDeepDive.addEventListener("change", () => {
      const on = homeDeepDive.checked;
      homeDeepPages.classList.toggle("hidden", !on);
      homeMultiEngineRow.classList.toggle("hidden", !on);
      if (on) {
        homeMultiEngineRow.querySelectorAll(".me-chip").forEach(chip => {
          const show = homeActiveSearchCat === "all" || chip.dataset.cat === homeActiveSearchCat;
          chip.style.display = show ? "" : "none";
        });
      }
    });
    homeSearchEngine.addEventListener("change", () => {
      if (homeDeepDive.checked) {
        const cb = homeMultiEngineRow.querySelector(`input[value="${homeSearchEngine.value}"]`);
        if (cb) cb.checked = true;
      }
    });
  }

  function getHomeSelectedEngines() {
    const checked = [...homeMultiEngineRow.querySelectorAll("input[type=checkbox]:checked")].map(cb => cb.value);
    return checked.length > 0 ? checked : [homeSearchEngine.value];
  }

  function executeHomeSearch() {
    const q = homeSearchQuery.value.trim();
    if (!q) return;
    const engine = homeSearchEngine.value;
    const urlPattern = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
    const buildSearchUrl = (pattern, query) => pattern.includes("{q}") ? pattern.replace("{q}", encodeURIComponent(query)) : pattern + encodeURIComponent(query);

    if (homeDeepDive && homeDeepDive.checked) {
      const resultId = `deepdive-${Date.now()}`;
      const pagesToCrawl = parseInt(homeDeepPages.value) || 5;
      const engines = getHomeSelectedEngines();
      const engineNames = engines.map(e => e.charAt(0).toUpperCase() + e.slice(1));
      const diveLabel = `Deep Dive — ${engineNames.join(" + ")}`;
      browser.storage.local.set({
        [resultId]: {
          status: "loading",
          deepDive: true,
          presetLabel: diveLabel,
          pageTitle: `${diveLabel}: ${q}`,
          pageUrl: buildSearchUrl(urlPattern, q),
          progress: { phase: "starting", statusText: "Initializing deep dive search..." }
        }
      });
      const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
      browser.tabs.update({ url: resultsUrl });
      browser.runtime.sendMessage({
        action: "deepDiveSearch",
        query: q,
        rawQuery: q,
        engines,
        engine: engines[0],
        resultId,
        pagesToCrawl
      });
      return;
    }

    browser.tabs.create({ url: buildSearchUrl(urlPattern, q) });
  }

  if (homeSearchGo) homeSearchGo.addEventListener("click", executeHomeSearch);
  if (homeSearchQuery) homeSearchQuery.addEventListener("keydown", (e) => {
    if (e.key === "Enter") executeHomeSearch();
  });

  // ── Scrolling ticker ──
  const ticker = document.getElementById("home-ticker");
  const tickerWrap = ticker ? ticker.closest(".home-ticker-wrap") : null;
  if (ticker) {
    // Duplicate all messages so the scroll loops seamlessly
    const origHTML = ticker.innerHTML;
    ticker.innerHTML = origHTML + origHTML;
    // Set scroll speed: ~6s per message
    const count = ticker.querySelectorAll(".home-ticker-msg").length / 2;
    ticker.style.setProperty("--ticker-duration", `${count * 6}s`);

    // Easter egg: tiny gear icon in ticker corner toggles mode picker
    const eggBtn = document.getElementById("ticker-egg-btn");
    if (eggBtn) {
      eggBtn.addEventListener("click", () => {
        document.getElementById("ticker-mode-picker").classList.toggle("hidden");
      });
    }

    // Restore saved mode (default to typewriter)
    browser.storage.local.get({ tickerMode: "robot" }).then(({ tickerMode }) => {
      applyTickerMode(tickerMode || "robot");
    });

    // Mode buttons
    document.querySelectorAll(".ticker-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        applyTickerMode(mode);
        browser.storage.local.set({ tickerMode: mode });
        document.getElementById("ticker-mode-picker").classList.add("hidden");
      });
    });
  }

  function applyTickerMode(mode) {
    if (!tickerWrap) return;
    const modes = ["vegas", "robot", "silly", "matrix", "retro"];
    modes.forEach(m => tickerWrap.classList.remove(m));
    if (mode !== "default") tickerWrap.classList.add(mode);
    document.querySelectorAll(".ticker-mode-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
  }

  // ── Home inline chat ──
  const homeLanding   = document.querySelector(".home-landing");
  const chatBtn       = document.getElementById("home-chat-btn");
  const chatMessages  = document.getElementById("home-chat-messages");
  const chatInput     = document.getElementById("home-chat-input");
  const chatSend      = document.getElementById("home-chat-send");

  if (chatBtn && homeLanding) {
    let chatConversationId = null;
    let chatSending = false;
    let chatSessionMessages = []; // { type:'user'|'ai', text:string } — used for cloud sync
    let chatExchangeCount = 0;   // increments each time an AI response completes

    const CHAT_SESSION_KEY = "argus-home-chat-session";

    function reattachCopyBtns(container) {
      container.querySelectorAll("pre").forEach(pre => {
        const btn = pre.querySelector(".hc-copy-btn");
        if (!btn) return;
        btn.addEventListener("click", () => {
          const code = pre.querySelector("code");
          navigator.clipboard.writeText(code ? code.textContent : pre.textContent).then(() => {
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = "Copy"; }, 1500);
          });
        });
      });
    }

    function buildHomeChatTranscript() {
      const lines = [];
      chatMessages.querySelectorAll(".hc-msg").forEach(msg => {
        const isUser = msg.classList.contains("hc-msg-user");
        const bubble = msg.querySelector(".hc-bubble:not(.streaming)");
        if (bubble) lines.push((isUser ? "User" : "Assistant") + ": " + bubble.textContent.trim());
      });
      return lines.join("\n\n");
    }

    async function saveHomeChatSession() {
      const msgs = [];
      chatMessages.querySelectorAll(".hc-msg").forEach(msg => {
        const isUser = msg.classList.contains("hc-msg-user");
        const bubble = msg.querySelector(".hc-bubble:not(.streaming)");
        if (bubble) msgs.push({ type: isUser ? "user" : "ai", html: bubble.innerHTML });
      });
      await browser.storage.local.set({ [CHAT_SESSION_KEY]: { conversationId: chatConversationId, messages: msgs } });
    }

    async function restoreHomeChatSession() {
      try {
        const stored = await browser.storage.local.get(CHAT_SESSION_KEY);
        const session = stored[CHAT_SESSION_KEY];
        if (!session?.messages?.length) return;
        chatConversationId = session.conversationId || null;
        for (const msg of session.messages) {
          const wrapper = document.createElement("div");
          wrapper.className = `hc-msg hc-msg-${msg.type}`;
          const bubble = document.createElement("div");
          bubble.className = "hc-bubble";
          bubble.innerHTML = msg.html;
          if (msg.type === "ai") reattachCopyBtns(bubble);
          wrapper.appendChild(bubble);
          chatMessages.appendChild(wrapper);
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } catch (e) {
        console.warn("[Argus] Failed to restore home chat session:", e);
      }
    }

    async function syncHomeChatToCloud(providerOverride) {
      if (!chatSessionMessages.length) return false;
      if (typeof CloudSync === "undefined") return false;
      try {
        const md = chatSessionMessages
          .map(m => `**${m.type === "user" ? "User" : "Assistant"}:** ${m.text}`)
          .join("\n\n");
        const path = `chat/${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
        const result = providerOverride
          ? await CloudSync.pushFile(path, md, providerOverride)
          : await CloudSync.saveChat({
              title: "Argus Chat — " + new Date().toLocaleDateString(),
              source: "argus-home",
              conversationId: chatConversationId,
              messages: chatSessionMessages,
            });
        return result?.success || false;
      } catch { return false; }
    }

    async function autoSyncHomeChatIfEnabled() {
      try {
        const { chatSyncEnabled, chatSyncProvider, chatSyncClearLocal } =
          await browser.storage.local.get({ chatSyncEnabled: false, chatSyncProvider: "all", chatSyncClearLocal: false });
        if (!chatSyncEnabled) return;
        const provider = chatSyncProvider === "all" ? undefined : chatSyncProvider;
        const ok = await syncHomeChatToCloud(provider);
        if (ok && chatSyncClearLocal) {
          chatSessionMessages = [];
          chatConversationId = null;
          chatExchangeCount = 0;
          chatMessages.innerHTML = "";
          browser.storage.local.remove(CHAT_SESSION_KEY);
        }
      } catch { /* silent */ }
    }

    function setHomeChatMode(entering) {
      if (!entering && chatSessionMessages.length) autoSyncHomeChatIfEnabled();
      homeLanding.classList.toggle("chat-mode", entering);
      chatBtn.classList.toggle("active", entering);
      chatBtn.textContent = entering ? "Home" : "Chat";
      // In chat mode show destination labels; in landing mode restore fixed category names
      [1, 2, 3].forEach(i => {
        const btn = document.getElementById(`home-nav-btn-${i}`);
        if (!btn) return;
        if (entering) {
          btn.textContent = btn.dataset.chatLabel || btn.textContent;
        } else {
          const cat = btn.dataset.navCat || "";
          btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        }
      });
      if (entering) chatInput?.focus();
    }

    chatBtn.addEventListener("click", () => {
      setHomeChatMode(!homeLanding.classList.contains("chat-mode"));
    });

    async function sendHomeChatMessage() {
      if (chatSending) return;
      const question = chatInput.value.trim();
      if (!question) return;

      chatSending = true;
      chatSend.disabled = true;
      chatInput.value = "";

      // User bubble
      const userMsg = document.createElement("div");
      userMsg.className = "hc-msg hc-msg-user";
      userMsg.innerHTML = `<div class="hc-bubble">${question.replace(/</g,"&lt;")}</div>`;
      chatMessages.appendChild(userMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      chatSessionMessages.push({ type: "user", text: question });
      saveHomeChatSession();

      // AI bubble (streaming placeholder)
      const aiMsg = document.createElement("div");
      aiMsg.className = "hc-msg hc-msg-ai";
      const aiBubble = document.createElement("div");
      aiBubble.className = "hc-bubble streaming";
      aiBubble.textContent = "Thinking…";
      aiMsg.appendChild(aiBubble);
      chatMessages.appendChild(aiMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      try {
        let response;
        if (!chatConversationId) {
          response = await browser.runtime.sendMessage({
            action: "startConversation",
            contextType: "General",
            contextData: "",
            pageUrl: "",
            pageTitle: "Argus Home",
            question
          });
        } else {
          response = await browser.runtime.sendMessage({
            action: "followUp",
            resultId: chatConversationId,
            question
          });
          // Background SW may have restarted and lost the in-memory conversation — rebuild silently
          if (!response?.success) {
            chatConversationId = null;
            response = await browser.runtime.sendMessage({
              action: "startConversation",
              contextType: "Chat History",
              contextData: buildHomeChatTranscript(),
              pageUrl: "",
              pageTitle: "Argus Home",
              question
            });
          }
        }

        if (!response?.success) {
          aiBubble.classList.remove("streaming");
          aiBubble.textContent = response?.error || "No response from background. Check that an API key is configured on the Providers tab.";
          aiBubble.style.color = "var(--error)";
        } else {
          if (response.conversationId) chatConversationId = response.conversationId;
          const aiContent = await pollHomeChatResult(response.followupResultId, aiBubble);
          if (aiContent != null) {
            chatSessionMessages.push({ type: "ai", text: aiContent });
            chatExchangeCount++;
            aiMsg.appendChild(buildHomeChatActionBar(aiContent));
            chatMessages.scrollTop = chatMessages.scrollHeight;
            // Auto-sync if interval reached
            browser.storage.local.get({ chatSyncEnabled: false, chatSyncInterval: 5 }).then(({ chatSyncEnabled, chatSyncInterval }) => {
              if (chatSyncEnabled && chatSyncInterval > 0 && chatExchangeCount % chatSyncInterval === 0) {
                autoSyncHomeChatIfEnabled();
              }
            });
          }
        }
      } catch (err) {
        aiBubble.classList.remove("streaming");
        aiBubble.textContent = err.message;
        aiBubble.style.color = "var(--error)";
      }

      saveHomeChatSession();
      chatSend.disabled = false;
      chatSending = false;
    }

    function renderHomeChatMd(content, bubble, isStreaming) {
      if (typeof marked === "undefined" || typeof DOMPurify === "undefined") {
        bubble.textContent = isStreaming ? content + "▍" : content;
        return;
      }
      const html = DOMPurify.sanitize(marked.parse(content || ""));
      bubble.innerHTML = html;
      // Add copy buttons to code blocks
      bubble.querySelectorAll("pre").forEach(pre => {
        if (pre.querySelector(".hc-copy-btn")) return;
        const btn = document.createElement("button");
        btn.className = "hc-copy-btn";
        btn.textContent = "Copy";
        btn.addEventListener("click", () => {
          const code = pre.querySelector("code");
          navigator.clipboard.writeText(code ? code.textContent : pre.textContent).then(() => {
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = "Copy"; }, 1500);
          });
        });
        pre.appendChild(btn);
      });
      // Append streaming cursor as a text node after all content
      if (isStreaming) {
        const cursor = document.createTextNode("▍");
        bubble.appendChild(cursor);
      }
    }

    async function pollHomeChatResult(resultId, bubble) {
      const INTERVAL = 300;
      const MAX = 1000;
      for (let i = 0; i < MAX; i++) {
        await new Promise(r => setTimeout(r, INTERVAL));
        try {
          const stored = await browser.storage.local.get(resultId);
          const data = stored[resultId];
          if (!data) continue;

          if (data.status === "streaming" && data.content) {
            renderHomeChatMd(data.content, bubble, true);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            continue;
          }
          if (data.status === "done") {
            bubble.classList.remove("streaming");
            renderHomeChatMd(data.content || "", bubble, false);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            browser.storage.local.remove(resultId);
            return data.content || "";
          }
          if (data.status === "error") {
            bubble.classList.remove("streaming");
            bubble.textContent = data.error || "Error.";
            bubble.style.color = "var(--error)";
            browser.storage.local.remove(resultId);
            return null;
          }
        } catch { /* keep polling */ }
      }
      bubble.classList.remove("streaming");
      bubble.textContent = "Timed out.";
      return null;
    }

    function buildHomeChatActionBar(content) {
      const bar = document.createElement("div");
      bar.className = "argus-chat-actions";
      bar.style.cssText = "margin-top:6px;justify-content:flex-start;";

      // X
      const xBtn = document.createElement("button");
      xBtn.className = "pill-chip";
      xBtn.title = "Share on X";
      xBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
      xBtn.addEventListener("click", () => {
        const snippet = content.slice(0, 250).replace(/\n/g, " ");
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(snippet + (content.length > 250 ? "…" : "") + "\n\nvia Argus")}`, "_blank");
      });
      bar.appendChild(xBtn);

      // Paste (Gist / PrivateBin)
      const pasteBtn = document.createElement("button");
      pasteBtn.className = "pill-chip";
      pasteBtn.title = "Paste to Gist or PrivateBin";
      pasteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Paste`;
      pasteBtn.addEventListener("click", () => {
        const existing = bar.querySelector(".argus-chat-project-picker");
        if (existing) { existing.remove(); return; }
        const picker = document.createElement("div");
        picker.className = "argus-chat-project-picker";
        for (const [key, label] of [["gist", "GitHub Gist"], ["privatebin", "PrivateBin"]]) {
          const opt = document.createElement("button");
          opt.className = "argus-chat-project-option";
          opt.textContent = label;
          opt.addEventListener("click", async () => {
            opt.textContent = "Uploading…";
            try {
              await browser.runtime.sendMessage({ action: "pasteCreate", providerKey: key, title: "Argus Chat", content, files: null });
              opt.textContent = "Done!";
            } catch { opt.textContent = "Error"; }
            setTimeout(() => picker.remove(), 1500);
          });
          picker.appendChild(opt);
        }
        bar.appendChild(picker);
        const dismiss = (e) => { if (!picker.contains(e.target) && e.target !== pasteBtn) { picker.remove(); document.removeEventListener("click", dismiss); } };
        setTimeout(() => document.addEventListener("click", dismiss), 0);
      });
      bar.appendChild(pasteBtn);

      // Text-It
      const textItBtn = document.createElement("button");
      textItBtn.className = "pill-chip";
      textItBtn.title = "Send via Text-It";
      textItBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Text-It`;
      textItBtn.addEventListener("click", () => {
        if (typeof TextIt !== "undefined") TextIt.open(content);
      });
      bar.appendChild(textItBtn);

      // Save to Project
      const projBtn = document.createElement("button");
      projBtn.className = "pill-chip";
      projBtn.title = "Save to project";
      projBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Project`;
      projBtn.addEventListener("click", async () => {
        const existing = bar.querySelector(".hc-proj-picker");
        if (existing) { existing.remove(); return; }
        const resp = await browser.runtime.sendMessage({ action: "getProjects" });
        if (!resp?.success || !resp.projects.length) {
          projBtn.textContent = "No projects";
          setTimeout(() => { projBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Project`; }, 1500);
          return;
        }
        const picker = document.createElement("div");
        picker.className = "argus-chat-project-picker hc-proj-picker";
        for (const proj of resp.projects) {
          const opt = document.createElement("button");
          opt.className = "argus-chat-project-option";
          const dot = document.createElement("span");
          dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${proj.color || "#e94560"};display:inline-block;margin-right:6px;`;
          opt.appendChild(dot);
          opt.appendChild(document.createTextNode(proj.name));
          opt.addEventListener("click", async () => {
            await browser.runtime.sendMessage({
              action: "addProjectItem",
              projectId: proj.id,
              item: { type: "note", title: "Chat — " + new Date().toLocaleDateString(), notes: content, url: "", tags: ["chat"] }
            });
            picker.remove();
            projBtn.textContent = "Saved!";
            setTimeout(() => { projBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Project`; }, 1500);
          });
          picker.appendChild(opt);
        }
        bar.style.position = "relative";
        bar.appendChild(picker);
        const dismiss = (e) => { if (!picker.contains(e.target) && e.target !== projBtn) { picker.remove(); document.removeEventListener("click", dismiss); } };
        setTimeout(() => document.addEventListener("click", dismiss), 0);
      });
      bar.appendChild(projBtn);

      // Sync Convo — saves full conversation to a chosen cloud provider
      const CLOUD_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`;
      const syncBtn = document.createElement("button");
      syncBtn.className = "pill-chip";
      syncBtn.title = "Sync full conversation to cloud";
      syncBtn.innerHTML = `${CLOUD_SVG} Sync Convo`;
      syncBtn.addEventListener("click", async () => {
        const existing = bar.querySelector(".hc-cloud-picker");
        if (existing) { existing.remove(); return; }

        syncBtn.textContent = "…";
        const status = typeof CloudSync !== "undefined" ? await CloudSync.getStatus() : null;
        syncBtn.innerHTML = `${CLOUD_SVG} Sync Convo`;

        const providers = status?.providers || {};
        const connected = Object.entries(providers).filter(([, v]) => v);
        const picker = document.createElement("div");
        picker.className = "argus-chat-project-picker hc-cloud-picker";

        if (!connected.length) {
          const msg = document.createElement("div");
          msg.style.cssText = "padding:6px 10px;font-size:11px;opacity:.7;";
          msg.textContent = "No cloud providers connected. Configure in Settings → Cloud.";
          picker.appendChild(msg);
        } else {
          const LABELS = { google: "Google Drive", dropbox: "Dropbox", webdav: "WebDAV", s3: "S3", github: "GitHub" };
          // "All" option
          const allOpt = document.createElement("button");
          allOpt.className = "argus-chat-project-option";
          allOpt.textContent = "All connected";
          allOpt.addEventListener("click", async () => {
            allOpt.textContent = "Syncing…";
            const ok = await syncHomeChatToCloud();
            allOpt.textContent = ok ? "Synced!" : "Error";
            setTimeout(() => picker.remove(), 1500);
          });
          picker.appendChild(allOpt);
          // Per-provider options
          for (const [key] of connected) {
            const opt = document.createElement("button");
            opt.className = "argus-chat-project-option";
            opt.textContent = LABELS[key] || key;
            opt.addEventListener("click", async () => {
              opt.textContent = "Syncing…";
              const ok = await syncHomeChatToCloud(key);
              opt.textContent = ok ? "Synced!" : "Error";
              setTimeout(() => picker.remove(), 1500);
            });
            picker.appendChild(opt);
          }
        }

        bar.style.position = "relative";
        bar.appendChild(picker);
        const dismiss = (e) => { if (!picker.contains(e.target) && e.target !== syncBtn) { picker.remove(); document.removeEventListener("click", dismiss); } };
        setTimeout(() => document.addEventListener("click", dismiss), 0);
      });
      bar.appendChild(syncBtn);

      return bar;
    }

    chatSend?.addEventListener("click", sendHomeChatMessage);
    chatInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendHomeChatMessage(); }
    });
    // Auto-resize textarea
    chatInput?.addEventListener("input", () => {
      chatInput.style.height = "auto";
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
    });

    restoreHomeChatSession();

    // Auto-sync to cloud on page unload (best-effort)
    window.addEventListener("beforeunload", () => autoSyncHomeChatIfEnabled());
  }
}

const ARGUS_HELP_URL = "https://github.com/n3r4-life/argus360#readme";

function initHelpExtLinks() {
  const openHelp = () => browser.tabs.create({ url: ARGUS_HELP_URL });
  const navHelp = document.getElementById("nav-help-ext");
  if (navHelp) navHelp.addEventListener("click", openHelp);
  const homeHelp = document.getElementById("home-help-ext");
  if (homeHelp) homeHelp.addEventListener("click", openHelp);
}

function switchMainTab(tabName, tabs, panels) {
  // Redirect graduated tabs to their new pages
  const GRADUATED = {
    projects: "projects/projects.html",
    automation: "automations/automations.html",
    sources: "sources/sources.html",
    prompts: "prompts/prompts.html",
    osint: "osint/graph.html",
    feeds: "feeds/feeds.html",
    tracker: "trawl/trawl.html",
    finance: "finance/finance.html",
  };
  if (GRADUATED[tabName]) {
    window.location.href = browser.runtime.getURL(GRADUATED[tabName]);
    return;
  }

  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  panels.forEach(p => p.classList.toggle("active", p.dataset.panel === tabName));

  // Lazy-load bookmarks when tab is first shown
  if (tabName === "bookmarks" && !bmState.initialized) {
    initBookmarks();
  }
}

function handleHashNav(hash, tabs, panels) {
  // Redirect help hashes to GitHub README
  if (hash === "help" || hash.startsWith("help-")) {
    browser.tabs.create({ url: ARGUS_HELP_URL });
    history.replaceState(null, "", "#home");
    return;
  }

  // Redirect graduated tab hashes to their new pages
  const GRADUATED_HASHES = {
    projects: "projects/projects.html",
    automation: "automations/automations.html",
    sources: "sources/sources.html",
    prompts: "prompts/prompts.html",
    osint: "osint/graph.html",
    feeds: "feeds/feeds.html",
    tracker: "trawl/trawl.html",
    finance: "finance/finance.html",
    bookmarks: "bookmarks/bookmarks.html",
    archive: "archive/archive.html",
    monitors: "monitors/monitors.html",
    resources: "resources/resources.html",
    settings: "settings/settings.html",
    providers: "providers/providers.html",
  };
  if (GRADUATED_HASHES[hash]) {
    window.location.href = browser.runtime.getURL(GRADUATED_HASHES[hash]);
    return;
  }

  // Check if hash is a direct tab name (e.g. "settings", "presets")
  const directTab = [...tabs].find(t => t.dataset.tab === hash);
  if (directTab) {
    switchMainTab(hash, tabs, panels);
    sessionStorage.setItem("argus-activeTab", hash);
    return;
  }

  // Sub-anchor: e.g. "settings-wipe" → switch to "settings" tab, scroll to element
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

const AI_STRIP_LABELS = { xai: "xAI", openai: "GPT", anthropic: "Claude", gemini: "Gemini", custom: "Custom" };

let _statusStripTimer = null;
function updateConsoleStatusStrip() {
  clearTimeout(_statusStripTimer);
  _statusStripTimer = setTimeout(() => { _doUpdateConsoleStatusStrip(); }, 80);
}

async function _doUpdateConsoleStatusStrip() {
  const strip = document.getElementById("console-status-strip");
  if (!strip) return;

  const LABELS = { google: "GDrive", dropbox: "Dropbox", webdav: "WebDAV", s3: "S3", github: "GitHub", gist: "Gist", pastebin: "Pastebin", privatebin: "PrivateBin" };
  const pills = [];

  try {
    const resp = await browser.runtime.sendMessage({ action: "cloudGetStatus" });
    for (const [key, connected] of Object.entries(resp?.providers || {})) {
      if (!connected) continue;
      pills.push(`<button class="ribbon-status-pill" data-goto="settings" title="${LABELS[key] || key} connected — click to manage"><span class="ribbon-status-dot"></span>${LABELS[key] || key}</button>`);
    }
  } catch { /* silent */ }

  try {
    const xmpp = await browser.runtime.sendMessage({ action: "xmppGetStatus" });
    if (xmpp?.configured) {
      const label = xmpp.jid ? xmpp.jid.split("@")[0] : "XMPP";
      const dot = xmpp.connected ? "" : " amber";
      const tip = `XMPP ${xmpp.connected ? "live" : "idle"}${xmpp.jid ? " · " + xmpp.jid : ""} — click to manage`;
      pills.push(`<button class="ribbon-status-pill" data-goto="settings" title="${tip}"><span class="ribbon-status-dot${dot}"></span>${label}</button>`);
    }
  } catch { /* silent */ }

  try {
    const pr = await browser.runtime.sendMessage({ action: "profileGetState" });
    if (pr?.profile?.username) {
      const u = pr.profile.username;
      const syncTip = pr.profile.lastSync ? `Last sync ${pr.profile.lastSync.slice(0,10)}` : "Never synced";
      pills.push(`<button class="ribbon-status-pill ribbon-user-pill" data-goto="settings" title="${u} · ${syncTip} — click to manage"><span class="ribbon-status-dot"></span>${u}</button>`);
    }
  } catch { /* silent */ }

  strip.innerHTML = pills.join("");
  strip.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.dataset.goto));
  });
}

// Console AI strip removed — now handled by shared/ribbon.js

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

