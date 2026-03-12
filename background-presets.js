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
  },
  entities: {
    label: "Entity Extraction (OSINT)",
    osint: true,
    system: "You are an OSINT analyst specializing in entity extraction and intelligence gathering. Extract structured data from text. Respond ONLY with valid JSON - no markdown fences, no explanation.",
    prompt: `Extract all identifiable entities from this page content. Return as JSON with this exact structure:
{
  "people": [{ "name": "", "role": "", "context": "" }],
  "organizations": [{ "name": "", "type": "", "context": "" }],
  "locations": [{ "name": "", "type": "city/country/address/region", "context": "" }],
  "dates": [{ "date": "", "event": "", "context": "" }],
  "amounts": [{ "value": "", "currency": "", "context": "" }],
  "contact": [{ "type": "email/phone/social/website", "value": "" }],
  "claims": [{ "claim": "", "attribution": "", "verifiable": true }]
}
Extract entities from the ARTICLE BODY CONTENT only. IGNORE navigation menus, sidebars, headers/footers, "trending now" sections, newsletter signup text, social sharing buttons, ad copy, cookie banners, and other page boilerplate. Only extract entities that are part of the actual article or document content.
For dates, normalize to ISO format where possible. For people, include their role/title if mentioned. For claims, note who made them and whether they are verifiable.`
  },
  credibility: {
    label: "Source Credibility",
    osint: true,
    system: "You are a media literacy and source evaluation expert with deep expertise in journalism standards, propaganda techniques, and information quality assessment.",
    prompt: `Evaluate this page's credibility on a scale of 1-10. Assess each of these dimensions:

## Credibility Score: X/10

### Author & Publication
- Author credentials and expertise
- Publication reputation and editorial standards

### Sourcing Quality
- Are claims attributed to named sources?
- Are primary sources linked or referenced?
- Quality and diversity of citations

### Content Analysis
- Logical consistency and reasoning quality
- Presence of logical fallacies
- Emotional manipulation or loaded language
- Headline accuracy vs content

### Bias Indicators
- Political or ideological lean
- Conflicts of interest
- Selective framing or omission

### Verification Status
- Claims that can be independently verified
- Claims that contradict established consensus
- Red flags or misinformation patterns

Use markdown formatting. Be specific with examples from the text.`
  },
  profile: {
    label: "Person/Org Profile",
    osint: true,
    system: "You are an OSINT research analyst who builds comprehensive profiles from available information.",
    prompt: `Build a structured intelligence profile based on this page content. Extract and organize:

## Profile Summary
One paragraph overview of the subject.

## Key Details
- Full name / Organization name
- Known aliases or alternate names
- Location(s)
- Affiliations and associations
- Online presence (websites, social media)

## Activity & History
Timeline of notable activities, roles, or events mentioned.

## Network & Associations
People, organizations, and entities connected to the subject.

## Notable Statements or Positions
Key quotes, stances, or public positions.

## Assessment
Brief analytical assessment of the subject based on available information.

Use markdown formatting. Only include what is supported by the content.`
  },
  mediabias: {
    label: "Media Bias Breakdown",
    osint: true,
    system: "You are a media literacy analyst specializing in comparative coverage analysis, editorial framing, and source bias detection. You help users understand how different outlets cover the same story.",
    prompt: `Analyze this page's coverage of the underlying news story. Produce a comprehensive breakdown:

## Story Overview
What is this story actually about? Summarize the core facts, stripping away editorial framing.

## Coverage Spectrum
Map every source/outlet mentioned to a bias position (Left, Lean Left, Center, Lean Right, Right). Present as a table with the outlet name, their headline or angle, and bias rating.

## Framing Analysis
How does each side frame this story differently? What language choices, emphasis, and omissions reveal editorial perspective?

## Blind Spots
What important context, perspectives, or facts are missing from the overall coverage? What questions should a reader be asking that no outlet is addressing?

## Source Links
List every article URL found on this page, grouped by bias lean, so the reader can dig deeper into each perspective.

## Deep Research Leads
Based on this coverage analysis, suggest specific topics, claims, or entities that deserve independent verification or deeper investigation. For each, explain what to look for and where.

Use markdown formatting. Be thorough — extract every outlet, link, and data point available on the page.`
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
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    models: {},
    defaultModel: ""
  }
};
