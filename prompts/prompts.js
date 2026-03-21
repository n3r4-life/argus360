// ──────────────────────────────────────────────
// Argus — Prompts Page
// Graduated from options console (Round 2)
// ──────────────────────────────────────────────

// Local state
let currentPresetKey = "summary";
let customPresets = {};
let advancedPrompts = {};

// Local el proxy for prompt DOM elements
const el = {
  defaultPreset: null,
  tabList: null,
  promptProvider: null,
  promptSystem: null,
  promptUser: null,
  resetPrompt: null,
  deletePreset: null,
  addPreset: null,
  promptStatus: null,
  advPromptSelect: null,
  advPromptSystem: null,
  advPromptUser: null,
  advPromptReset: null,
  advPromptStatus: null,
};

function _initElProxy() {
  el.defaultPreset = document.getElementById("default-preset");
  el.tabList = document.getElementById("prompt-tab-list");
  el.promptProvider = document.getElementById("prompt-provider");
  el.promptSystem = document.getElementById("prompt-system");
  el.promptUser = document.getElementById("prompt-user");
  el.resetPrompt = document.getElementById("reset-prompt");
  el.deletePreset = document.getElementById("delete-preset");
  el.addPreset = document.getElementById("add-preset");
  el.promptStatus = document.getElementById("prompt-status");
  el.advPromptSelect = document.getElementById("adv-prompt-select");
  el.advPromptSystem = document.getElementById("adv-prompt-system");
  el.advPromptUser = document.getElementById("adv-prompt-user");
  el.advPromptReset = document.getElementById("adv-prompt-reset");
  el.advPromptStatus = document.getElementById("adv-prompt-status");
}

// Local save — replaces scheduleSave()
let _saveTimeout = null;
function scheduleSave() {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(async () => {
    await browser.storage.local.set({
      customPresets,
      advancedPrompts,
      defaultPreset: el.defaultPreset?.value || "summary"
    });
  }, 400);
}

// Default presets (from options-core.js)
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

// Advanced prompt definitions (from options-core.js)
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

// advancedPrompts declared in preamble

// Prompt functions (from options-ai.js)
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


// ──────────────────────────────────────────────
// Init on page load
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  _initElProxy();

  // Load state from storage
  const settings = await browser.storage.local.get({
    customPresets: {},
    advancedPrompts: {},
    defaultPreset: "summary"
  });
  customPresets = settings.customPresets || {};
  advancedPrompts = settings.advancedPrompts || {};

  buildPromptTabs();
  selectPromptTab("summary");
  populateDefaultPresetDropdown();
  el.defaultPreset.value = settings.defaultPreset || "summary";
  el.defaultPreset.addEventListener("change", scheduleSave);

  // Prompt listeners (extracted from attachListeners)
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
    scheduleSave();
  });

  // Delete custom preset
  el.deletePreset.addEventListener("click", () => {
    if (!customPresets[currentPresetKey]?.isCustom) return;
    if (!confirm(`Delete preset "${customPresets[currentPresetKey].label}"?`)) return;
    delete customPresets[currentPresetKey];
    buildPromptTabs();
    selectPromptTab("summary");
    scheduleSave();
  });


  // Init advanced prompts
  initAdvancedPrompts();
  el.advPromptSelect.addEventListener("change", loadAdvancedPrompt);
  el.advPromptSystem.addEventListener("input", saveAdvancedPrompt);
  el.advPromptUser.addEventListener("input", saveAdvancedPrompt);
  el.advPromptReset.addEventListener("click", resetAdvancedPrompt);
});
