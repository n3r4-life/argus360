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
  },

  // ── Business & Competitive Intelligence ──

  competitorintel: {
    label: "Competitor Intel",
    system: "You are a competitive intelligence analyst with expertise in market positioning, strategic moves, and business signal detection.",
    prompt: `Analyze this page for competitive intelligence signals. Extract and organize:

## Company/Product Overview
What company, product, or service is this about?

## Strategic Signals
- New product launches, features, or pivots
- Pricing changes or positioning shifts
- Partnership or acquisition signals
- Hiring patterns that reveal strategy
- Market expansion or contraction indicators

## Strengths & Vulnerabilities
What does this reveal about their strengths? Where are potential weaknesses?

## Market Implications
How does this affect the competitive landscape? Who wins, who loses?

## Actionable Takeaways
What should a competitor or investor do with this information?

Use markdown formatting. Be specific — cite exact quotes and data points.`
  },

  financialanalysis: {
    label: "Financial Analysis",
    system: "You are a financial analyst skilled at extracting and interpreting financial data, market signals, and economic indicators from text.",
    prompt: `Extract and analyze all financial information from this page:

## Financial Summary
Key financial figures, metrics, and data points mentioned.

## Numbers & Data
Present all quantitative data in a structured table: metric, value, context, and trend direction (↑↓→) where determinable.

## Market Signals
- Revenue/growth indicators
- Cost or margin signals
- Valuation implications
- Risk factors mentioned or implied

## Comparison Context
How do these numbers compare to industry norms or competitors (if mentioned)?

## Red Flags
Any financial warning signs, unusual patterns, or concerning metrics.

Use markdown formatting. Include exact figures with their sources in the text.`
  },

  supplychainrisk: {
    label: "Supply Chain Risk",
    osint: true,
    system: "You are a supply chain risk analyst specializing in identifying vulnerabilities, dependencies, and disruption signals across global supply networks.",
    prompt: `Analyze this page for supply chain intelligence:

## Entities Involved
Companies, suppliers, manufacturers, logistics providers, and geographic locations mentioned.

## Risk Signals
- Single points of failure or concentration risk
- Geopolitical exposure (sanctions, trade tensions, instability)
- Natural disaster or climate vulnerability
- Regulatory or compliance risks
- Capacity constraints or bottleneck indicators

## Dependencies Map
What dependency relationships are revealed? Who depends on whom?

## Disruption Indicators
Any current or emerging disruption signals? What could cascade?

## Mitigation Considerations
Based on the risks identified, what mitigation strategies are implied or recommended?

Use markdown formatting. Be specific about locations and entity relationships.`
  },

  // ── Security & Threat Analysis ──

  threatassessment: {
    label: "Threat Assessment",
    osint: true,
    system: "You are a security analyst specializing in threat intelligence, risk assessment, and situational awareness. You evaluate information for security implications objectively.",
    prompt: `Perform a threat assessment based on this page's content:

## Situation Overview
What is happening? Summarize the core situation factually.

## Threat Actors
Identify any individuals, groups, or organizations that pose or face threats. Note their capabilities, intent, and history if mentioned.

## Risk Factors
- Likelihood assessment (low/medium/high) with reasoning
- Potential impact and who is affected
- Attack vectors or vulnerability indicators
- Escalation potential

## Indicators & Warnings
Specific signals that the situation is evolving. What should be monitored?

## Information Gaps
What critical information is missing from this report?

## Recommended Actions
Priority-ordered response recommendations.

Use markdown formatting. Remain objective — assess based on available evidence only.`
  },

  crisismonitor: {
    label: "Crisis Monitor",
    system: "You are a crisis monitoring analyst who tracks developing situations, extracts key updates, and provides situational awareness briefings.",
    prompt: `Analyze this page as a developing crisis or incident report:

## Situation Status
Current state: [Developing / Escalating / Stabilizing / Resolved]

## What Happened
Factual timeline of events based on this content. Use timestamps where available.

## Impact Assessment
- Who is affected and how many
- Geographic scope
- Infrastructure or systems affected
- Economic or social impact

## Response Actions
What response actions have been taken or announced?

## Key Unknowns
Critical questions that remain unanswered.

## Next Expected Developments
Based on the trajectory, what should we expect next?

## Sources & Reliability
How reliable is this information? What is confirmed vs. unconfirmed?

Use markdown formatting. Prioritize facts over speculation.`
  },

  // ── Media Forensics & Manipulation ──

  deepfakeflags: {
    label: "Deepfake / Manipulation Flags",
    osint: true,
    system: "You are a digital forensics and media manipulation expert. You analyze content for signs of fabrication, manipulation, synthetic media, coordinated inauthentic behavior, and information operations.",
    prompt: `Analyze this page for manipulation and authenticity red flags:

## Content Authenticity Assessment
Overall authenticity rating: [Likely Authentic / Suspicious / Likely Manipulated / Insufficient Data]

## Red Flags Detected
Check for and report on each:
- Inconsistencies in dates, names, or facts
- Signs of AI-generated text (repetitive phrasing, unnatural transitions, hedging patterns)
- Image/video manipulation indicators if media is described
- Misattributed quotes or out-of-context claims
- Coordinated amplification patterns (same talking points, identical phrasing across sources)
- Emotional manipulation techniques (fear, urgency, outrage bait)
- Missing context that changes the meaning

## Source Verification
- Is the publishing source verifiable?
- Does the author exist and have a track record?
- Are claimed sources real and do they support the claims?

## Provenance Trail
What can be determined about where this content originated?

## Confidence Assessment
How confident is this analysis? What would confirm or refute it?

Use markdown formatting. Be specific about which indicators apply.`
  },

  propaganda: {
    label: "Propaganda Detection",
    osint: true,
    system: "You are an expert in propaganda analysis, influence operations, and persuasion techniques. You identify rhetorical strategies and manipulation tactics objectively without political bias.",
    prompt: `Analyze this page for propaganda and persuasion techniques:

## Techniques Identified
For each technique found, provide: the technique name, a direct quote example, and the intended effect.

Common techniques to check:
- Loaded language / emotional appeals
- Bandwagon / social proof
- Appeal to authority / false authority
- Straw man / misrepresentation
- Whataboutism / deflection
- Cherry-picking / selective evidence
- Repetition / message discipline
- Fear, uncertainty, doubt (FUD)
- Us vs. them framing
- Glittering generalities

## Target Audience
Who is this content designed to persuade? What assumptions does it make about the reader?

## Narrative Framework
What overarching narrative is being constructed? What worldview does it reinforce?

## What's Missing
What counterfactual information or alternative perspectives are deliberately excluded?

## Effectiveness Assessment
How effective is this content likely to be at achieving its persuasive goals?

Use markdown formatting. Remain neutral — analyze the techniques, don't take sides.`
  },

  // ── Network & Social Analysis ──

  influencermap: {
    label: "Influencer / Network Map",
    osint: true,
    system: "You are a social network analyst specializing in mapping influence networks, identifying key actors, and understanding relationship dynamics from open source information.",
    prompt: `Map the influence network revealed by this page's content:

## Key Actors
List every person, organization, and entity mentioned with their role and apparent influence level (high/medium/low).

## Relationship Map
Describe the connections between actors. For each relationship note:
- The two parties
- Nature of relationship (ally, adversary, employer, funder, etc.)
- Evidence from the text

## Power Structure
Who has the most influence? What is the hierarchy or power dynamic?

## Information Flow
How does information or influence flow between these actors? Who amplifies whom?

## Hidden Connections
Any implied but unstated relationships? Shared affiliations, funding sources, or organizational overlap?

## Network Vulnerabilities
Key nodes whose removal would disrupt the network.

Use markdown formatting. Only include relationships supported by the content.`
  },

  // ── Technical & Research ──

  technicalbreakdown: {
    label: "Technical Breakdown",
    system: "You are a senior technical analyst who can break down complex technical content into structured, understandable analysis for both technical and non-technical audiences.",
    prompt: `Provide a technical breakdown of this page's content:

## TL;DR
One paragraph summary for someone in a hurry.

## Technical Details
Break down the core technical concepts, architecture, or methodology described. Use diagrams (ASCII) where helpful.

## How It Works
Step-by-step explanation of the process, system, or technology described.

## Dependencies & Requirements
What technologies, platforms, or prerequisites are involved?

## Strengths & Limitations
Technical advantages and constraints or trade-offs.

## Practical Implications
What does this mean for practitioners? How would someone actually use or implement this?

## Related Technologies
What similar or competing approaches exist?

Use markdown formatting. Include code snippets or technical specifics where relevant.`
  },

  timeline: {
    label: "Timeline Reconstruction",
    osint: true,
    system: "You are a chronological analyst who reconstructs timelines from scattered information. You are meticulous about dates, sequences, and causal chains.",
    prompt: `Reconstruct a detailed timeline from this page's content:

## Timeline
Present events in strict chronological order. For each entry:
- **Date/Time** (exact if available, approximate if not — mark with ~)
- **Event** — what happened
- **Source** — who reported or claimed this
- **Significance** — why this matters to the overall story

## Pre-History
Any referenced historical context or prior events that set the stage.

## Gaps
Time periods where events are missing or unclear. What likely happened in those gaps?

## Causal Chain
How do events connect? What caused what?

## Key Turning Points
Which events most significantly changed the trajectory?

Use markdown formatting. Clearly distinguish confirmed facts from inferences.`
  },

  dataextraction: {
    label: "Data Extraction",
    system: "You are a data extraction specialist who pulls structured data from unstructured text. You find every number, statistic, percentage, date, and quantitative claim.",
    prompt: `Extract all structured data from this page:

## Statistics & Numbers
Present as a markdown table:
| Metric | Value | Context | Source/Attribution |
|--------|-------|---------|-------------------|

Include every number, percentage, dollar amount, count, measurement, and quantitative claim.

## Dates & Deadlines
All dates mentioned with their significance.

## Named Entities
All people, organizations, locations, and products — presented as categorized lists.

## Lists & Categories
Any categorized information, rankings, or structured lists found in the content.

## Quotes
Key direct quotes with attribution.

## URLs & References
All links, citations, and external references.

Use markdown formatting. Be exhaustive — extract everything quantifiable or structured.`
  },

  legalrisk: {
    label: "Legal / Regulatory Risk",
    system: "You are a legal risk analyst who identifies regulatory exposure, compliance concerns, and legal implications in business and policy content. You are not providing legal advice — you are flagging areas that warrant professional legal review.",
    prompt: `Analyze this page for legal and regulatory risk signals:

## Jurisdiction & Regulatory Framework
What legal jurisdictions and regulatory bodies are relevant?

## Risk Areas Identified
For each risk:
- **Category** (privacy, IP, employment, antitrust, securities, environmental, etc.)
- **Description** of the potential issue
- **Severity** (low/medium/high)
- **Evidence** from the text

## Compliance Concerns
Any mentioned or implied regulatory requirements. Are they being met?

## Liability Exposure
Who faces potential liability and for what?

## Pending or Referenced Litigation
Any lawsuits, investigations, or enforcement actions mentioned.

## Recommended Review Areas
What should a legal professional examine more closely?

*Note: This is an analytical summary, not legal advice. Consult qualified counsel for legal decisions.*

Use markdown formatting.`
  },

  comparecontrast: {
    label: "Compare & Contrast",
    system: "You are an analytical comparison expert who identifies similarities, differences, and trade-offs between items, ideas, products, or positions described in content.",
    prompt: `Identify the items being compared on this page and produce a structured comparison:

## Items Being Compared
List the things being compared (products, ideas, approaches, etc.).

## Comparison Matrix
Present a detailed comparison table:
| Dimension | Item A | Item B | ... |
|-----------|--------|--------|-----|

Cover every dimension mentioned in the content.

## Key Similarities
What do they have in common?

## Key Differences
Where do they diverge most significantly?

## Trade-offs
What do you gain or lose with each option?

## Winner by Category
If the content implies recommendations, summarize who wins in which scenarios.

## Missing Comparisons
What important dimensions were NOT compared that a reader should consider?

Use markdown formatting. If only one item is discussed, compare it against the obvious alternatives or industry standards.`
  },

  narrativeanalysis: {
    label: "Narrative Analysis",
    system: "You are a narrative analyst who deconstructs how stories are told — examining structure, framing, rhetoric, and the choices authors make to shape reader perception.",
    prompt: `Deconstruct the narrative structure and rhetorical strategy of this content:

## Narrative Summary
What story is being told? What is the central thesis or argument?

## Structure & Framing
- How is the content organized? (chronological, problem-solution, inverted pyramid, etc.)
- What is foregrounded vs. buried?
- How does the opening frame the reader's expectations?

## Rhetorical Devices
Identify specific techniques: metaphor, anecdote, appeal to emotion, statistical framing, expert authority, etc. Provide quotes.

## Voice & Perspective
Whose perspective dominates? Whose is absent? What point of view is assumed?

## Audience & Intent
Who is the intended audience? What action or belief does this content aim to produce?

## Subtext
What is implied but never stated directly?

## Effectiveness
How well does this content achieve its apparent goals?

Use markdown formatting. Be analytical, not judgmental.`
  },

  tldr: {
    label: "TLDR Briefing",
    system: "You are an expert at distilling complex content into ultra-concise briefings. Every word counts. No filler.",
    prompt: `Give me the fastest possible briefing on this page:

**TLDR:** [One sentence — the single most important takeaway]

**Key Facts:**
- [3-5 bullet points, each one sentence max]

**So What?** [One sentence — why this matters]

**What's Next?** [One sentence — what to watch for or do]

That's it. No extra commentary. Keep the entire response under 150 words.`
  }
};

// ──────────────────────────────────────────────
// Structured response schema
// ──────────────────────────────────────────────
// Every AI response ends with a <!--ARGUS_DATA:{json}:ARGUS_DATA--> block.
// The prose analysis is rendered to the user; the JSON is parsed for KG, filtering, and aggregation.

const ARGUS_STRUCTURED_DELIMITER_START = "<!--ARGUS_DATA:";
const ARGUS_STRUCTURED_DELIMITER_END = ":ARGUS_DATA-->";

// Base schema — every preset includes these fields
const ARGUS_BASE_SCHEMA = {
  entities: [{ name: "string", type: "person|organization|location|date|event|other" }],
  confidence: "number 0.0-1.0 — how confident you are in your analysis",
  topics: ["string — 2-5 main topics/themes covered"]
};

// Per-preset schema extensions (merged with base)
const ARGUS_PRESET_SCHEMAS = {
  sentiment: {
    sentiment: "positive|negative|neutral|mixed",
    sentiment_score: "number -1.0 to 1.0"
  },
  factcheck: {
    claims: [{ claim: "string", verdict: "verified|unverified|false|misleading", evidence: "string" }]
  },
  credibility: {
    credibility_score: "number 1-10",
    bias_direction: "left|lean-left|center|lean-right|right|unclear"
  },
  threatassessment: {
    threat_level: "low|medium|high|critical",
    threat_actors: ["string"]
  },
  crisismonitor: {
    status: "developing|escalating|stabilizing|resolved",
    severity: "low|medium|high|critical"
  },
  deepfakeflags: {
    authenticity: "likely-authentic|suspicious|likely-manipulated|insufficient-data",
    manipulation_indicators: ["string"]
  },
  propaganda: {
    techniques: [{ technique: "string", example: "string" }],
    persuasion_intensity: "low|medium|high"
  },
  legalrisk: {
    risk_areas: [{ category: "string", severity: "low|medium|high" }]
  },
  financialanalysis: {
    financial_metrics: [{ metric: "string", value: "string", trend: "up|down|stable|unknown" }]
  },
  competitorintel: {
    signals: [{ type: "string", description: "string", significance: "low|medium|high" }]
  },
  timeline: {
    events: [{ date: "string", event: "string", significance: "string" }]
  }
};

// Build the system prompt suffix that instructs the AI to append structured data
function buildStructuredDataInstruction(presetKey) {
  // Merge base + preset-specific schema
  const schema = { ...ARGUS_BASE_SCHEMA };
  if (ARGUS_PRESET_SCHEMAS[presetKey]) {
    Object.assign(schema, ARGUS_PRESET_SCHEMAS[presetKey]);
  }

  const schemaStr = JSON.stringify(schema, null, 2);

  return `

IMPORTANT — Structured Data Requirement:
After your complete analysis, you MUST append a structured data block on its own line using this exact format:
${ARGUS_STRUCTURED_DELIMITER_START}{your JSON here}${ARGUS_STRUCTURED_DELIMITER_END}

The JSON must conform to this schema:
${schemaStr}

Rules for the structured data:
- The "entities" array must contain ONLY real-world entities (people, organizations, locations, dates, events) found in the SOURCE CONTENT you analyzed. Do NOT include analytical terms, framework names, section headings, or abstract concepts.
- Each entity needs a "name" (proper noun as it appears) and "type" (one of: person, organization, location, date, event, other).
- "confidence" is your confidence in the overall analysis (0.0-1.0).
- "topics" are 2-5 high-level themes/subjects of the source content.
- This block must be the VERY LAST thing in your response, after all prose analysis.
- Output valid JSON only inside the delimiters — no markdown fences, no extra text.`;
}

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
