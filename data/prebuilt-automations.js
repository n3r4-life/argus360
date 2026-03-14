// ──────────────────────────────────────────────
// Pre-built Automation Templates
// Seeded on first install, fully editable/deletable.
// Loaded before background-automations.js.
// ──────────────────────────────────────────────

const PREBUILT_AUTOMATIONS = [

  // 1. News Intel Summary
  {
    id: "prebuilt-news-intel",
    name: "News Intel Summary",
    prebuilt: true,
    enabled: true,
    triggers: {
      urlPatterns: [
        "*://reuters.com/*",
        "*://apnews.com/*",
        "*://bbc.com/*",
        "*://www.reuters.com/*",
        "*://www.apnews.com/*",
        "*://www.bbc.com/*",
      ],
      manual: true,
    },
    steps: [
      { type: "analyze", preset: "summary" },
      {
        type: "prompt",
        system: "You are an intelligence analyst. Be concise and factual.",
        prompt: "Based on the analysis above, extract:\n1. The 5 key claims made in this article\n2. Sources cited and their credibility\n3. Any notable omissions or unanswered questions\n4. One-sentence bottom line assessment",
        inputMode: "previous",
      },
    ],
    cooldownMs: 60000,
    delay: 2000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 2. Deep Research Pipeline
  {
    id: "prebuilt-deep-research",
    name: "Deep Research Pipeline",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      { type: "analyze", preset: "summary" },
      { type: "extractEntities" },
      { type: "runPipeline", pipelineId: "research" },
      {
        type: "prompt",
        system: "You are a research analyst synthesizing multiple data sources.",
        prompt: "Synthesize all findings from the analysis, extracted entities, and research pipeline into a structured brief with: Executive Summary, Key Findings, Entity Map, and Recommended Next Steps.",
        inputMode: "previous",
      },
    ],
    cooldownMs: 0,
    delay: 2000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 3. Sentiment Classifier
  {
    id: "prebuilt-sentiment-classifier",
    name: "Sentiment Classifier",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      {
        type: "classify",
        question: "What is the overall sentiment and tone of this content?",
        inputMode: "page",
        varName: "sentiment",
        categories: [
          { value: "very_positive", label: "Very Positive", description: "Strongly optimistic, celebratory, or enthusiastic" },
          { value: "positive", label: "Positive", description: "Generally favorable, constructive, or hopeful" },
          { value: "neutral", label: "Neutral", description: "Balanced, factual, or objective reporting" },
          { value: "negative", label: "Negative", description: "Critical, pessimistic, or concerning" },
          { value: "very_negative", label: "Very Negative", description: "Alarming, hostile, or deeply critical" },
        ],
        defaultSteps: [],
      },
      {
        type: "prompt",
        system: "You are a media analyst specializing in sentiment and framing analysis.",
        prompt: "The content was classified as: {{vars.sentiment}}.\n\nProvide a detailed sentiment breakdown:\n1. Overall tone and emotional framing\n2. Key phrases that drive the sentiment\n3. Bias indicators (if any)\n4. Audience impact assessment\n5. Sentiment score: -5 (extremely negative) to +5 (extremely positive)",
        inputMode: "page",
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 4. Source Credibility Check
  {
    id: "prebuilt-source-credibility",
    name: "Source Credibility Check",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      { type: "extractEntities" },
      {
        type: "prompt",
        system: "You are a fact-checking analyst with expertise in source evaluation and media literacy.",
        prompt: "Evaluate the credibility of this content:\n\n1. **Source Assessment** — Who published this? What is their track record?\n2. **Claims vs Evidence** — List major claims and rate the evidence supporting each (Strong / Moderate / Weak / None)\n3. **Logical Fallacies** — Identify any logical fallacies or rhetorical tricks\n4. **Bias Indicators** — Political lean, funding sources, conflict of interest\n5. **Cross-Reference** — What claims can be verified from the extracted entities?\n6. **Credibility Score** — Rate 1-10 with justification\n\nBe direct and specific.",
        inputMode: "page",
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 5. Content Watchdog (uses filter + blocklist)
  {
    id: "prebuilt-content-watchdog",
    name: "Content Watchdog",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      {
        type: "filter",
        value: "page.url",
        list: "prebuilt-list-flagged-domains",
        action: "block",
        haltSteps: [
          {
            type: "prompt",
            system: "You are a content safety analyst.",
            prompt: "This URL has been flagged by the blocklist. Analyze why this source may be unreliable and provide a brief risk assessment.",
            inputMode: "page",
          },
        ],
        passSteps: [],
      },
      { type: "analyze", preset: "summary" },
      {
        type: "condition",
        expression: { op: "contains", left: "lastOutput", right: "misinformation" },
        thenSteps: [
          {
            type: "prompt",
            system: "You are a fact-checker.",
            prompt: "Potential misinformation detected in the summary. Identify the specific claims that need verification and explain why they are flagged.",
            inputMode: "previous",
          },
        ],
        elseSteps: [],
      },
    ],
    cooldownMs: 60000,
    delay: 2000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 6. Competitive Intel Classifier
  {
    id: "prebuilt-competitive-intel",
    name: "Competitive Intel Classifier",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      {
        type: "classify",
        question: "What type of competitive intelligence does this content represent?",
        inputMode: "page",
        varName: "intel_type",
        categories: [
          { value: "product_launch", label: "Product Launch", description: "New product or feature announcement" },
          { value: "partnership", label: "Partnership", description: "Strategic alliance, merger, or collaboration" },
          { value: "financial", label: "Financial", description: "Earnings, funding, valuation, or market performance" },
          { value: "legal", label: "Legal/Regulatory", description: "Lawsuits, regulations, compliance, or policy changes" },
          { value: "hiring", label: "Hiring/Talent", description: "Key hires, layoffs, team changes, or recruiting signals" },
          { value: "strategy", label: "Strategy", description: "Market positioning, pivots, or long-term plans" },
        ],
        defaultSteps: [],
      },
      {
        type: "prompt",
        system: "You are a competitive intelligence analyst.",
        prompt: "This content was classified as: {{vars.intel_type}}.\n\nWrite a structured CI brief:\n1. **What happened** — Key facts\n2. **Who is affected** — Companies, markets, stakeholders\n3. **Strategic implications** — What this means for the competitive landscape\n4. **Action items** — Recommended responses or monitoring",
        inputMode: "page",
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 7. Entity Extract & Save
  {
    id: "prebuilt-entity-extract-save",
    name: "Entity Extract & Save",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      { type: "analyze", preset: "summary" },
      { type: "extractEntities" },
      {
        type: "addToProject",
        projectId: "",
        tagsWith: [],
        summaryFrom: "last",
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 8. Auto-Archive to Cloud
  {
    id: "prebuilt-auto-archive",
    name: "Auto-Archive to Cloud",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      { type: "analyze", preset: "summary" },
      {
        type: "prompt",
        system: "You are a librarian cataloging web content for future retrieval.",
        prompt: "Create an archive record with:\n- Title\n- Date captured\n- Source URL\n- Category tags (3-5)\n- Executive summary (2-3 sentences)\n- Key entities mentioned\n- Relevance notes",
        inputMode: "previous",
      },
      {
        type: "saveToCloud",
        inputMode: "previous",
        format: "md",
        providers: ["default"],
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 9. Smart Triage (condition + gate + switch)
  {
    id: "prebuilt-smart-triage",
    name: "Smart Triage Pipeline",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      // Step 1: Classify the content type
      {
        type: "classify",
        question: "What category does this content fall into?",
        inputMode: "page",
        varName: "category",
        categories: [
          { value: "news", label: "News Article", description: "Breaking news, reporting, journalism" },
          { value: "opinion", label: "Opinion/Editorial", description: "Op-eds, commentary, analysis pieces" },
          { value: "research", label: "Research/Academic", description: "Papers, studies, technical reports" },
          { value: "commercial", label: "Commercial/Marketing", description: "Product pages, ads, promotional" },
          { value: "social", label: "Social Media", description: "Posts, threads, discussions" },
        ],
        defaultSteps: [],
      },
      // Step 2: Score relevance
      {
        type: "prompt",
        system: "You are a relevance scoring engine. Respond with ONLY a number from 1 to 10.",
        prompt: "Rate this content's importance and relevance for intelligence analysis on a scale of 1-10. Consider: timeliness, source quality, information density, and actionability. Respond with ONLY the number.",
        inputMode: "page",
      },
      { type: "setVar", varName: "relevance", value: "lastOutput" },
      // Step 3: Condition — high relevance gets deep analysis
      {
        type: "condition",
        expression: { op: "gte", left: "vars.relevance", right: "7" },
        thenSteps: [
          { type: "extractEntities" },
          {
            type: "prompt",
            system: "You are an intelligence analyst producing high-priority briefs.",
            prompt: "HIGH RELEVANCE (score: {{vars.relevance}}, category: {{vars.category}})\n\nProduce a detailed intelligence brief with:\n1. Executive summary\n2. Key entities and relationships\n3. Timeline of events\n4. Strategic implications\n5. Recommended follow-up actions",
            inputMode: "page",
          },
        ],
        elseSteps: [
          {
            type: "prompt",
            system: "You are an analyst producing quick summaries.",
            prompt: "LOW PRIORITY (score: {{vars.relevance}}, category: {{vars.category}})\n\nProvide a brief 3-sentence summary and note if there's anything worth monitoring.",
            inputMode: "page",
          },
        ],
      },
      // Step 4: Switch on category for specialized handling
      {
        type: "switch",
        value: "vars.category",
        cases: [
          {
            match: ["news"],
            steps: [{
              type: "prompt",
              system: "You are a media analyst.",
              prompt: "As a news article, also assess: source reliability, potential bias, and whether claims are independently verifiable.",
              inputMode: "previous",
            }],
          },
          {
            match: ["research"],
            steps: [{
              type: "prompt",
              system: "You are a research analyst.",
              prompt: "As a research piece, also assess: methodology strength, sample size concerns, peer review status, and replicability.",
              inputMode: "previous",
            }],
          },
        ],
        defaultSteps: [],
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 10. Decision Gate Workflow
  {
    id: "prebuilt-decision-gate",
    name: "Analyst Review Gate",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      { type: "analyze", preset: "summary" },
      // Step 2: Gate — analyst decides whether to proceed
      {
        type: "gate",
        gateType: "choice",
        question: "Review the summary above. How should we proceed?",
        varName: "decision",
        options: [
          {
            label: "Deep dive — full entity extraction and research",
            value: "deep",
            steps: [
              { type: "extractEntities" },
              { type: "runPipeline", pipelineId: "research" },
              {
                type: "prompt",
                system: "You are a deep research analyst.",
                prompt: "Compile all findings into a comprehensive research dossier.",
                inputMode: "previous",
              },
            ],
          },
          {
            label: "Quick flag — just tag and save for later",
            value: "flag",
            steps: [
              {
                type: "prompt",
                system: "You are a quick-triage analyst.",
                prompt: "Generate 5 relevant tags for this content and a one-line reason it was flagged for review.",
                inputMode: "previous",
              },
            ],
          },
          {
            label: "Discard — not relevant",
            value: "discard",
            steps: [],
          },
        ],
        thenSteps: [],
        elseSteps: [],
        timeoutMs: 600000,
        timeoutAction: "halt",
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: false,
  },

  // 11. Entity Loop & Filter
  {
    id: "prebuilt-entity-loop-filter",
    name: "Entity Scanner & Filter",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      { type: "extractEntities" },
      // Step 2: Loop over each extracted entity
      {
        type: "loop",
        over: "entities",
        varName: "entity",
        maxIterations: 20,
        delayMs: 500,
        steps: [
          // Filter: check if entity is on the priority sources watchlist
          {
            type: "filter",
            value: "vars.entity",
            list: "prebuilt-list-priority-sources",
            action: "allow",
            passSteps: [
              { type: "setVar", varName: "matchedSources", value: "vars.matchedSources + ', ' + vars.entity" },
            ],
            haltSteps: [],
          },
        ],
      },
      // Step 3: Summarize what was found
      {
        type: "prompt",
        system: "You are an entity analysis specialist.",
        prompt: "From the extracted entities, the following matched our priority sources watchlist: {{vars.matchedSources}}\n\nFor each matched entity, explain:\n1. Why this entity is significant\n2. Its relationship to the content\n3. Any red flags or noteworthy connections",
        inputMode: "page",
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: true,
  },

  // 12. Conditional Alert Pipeline (variables + conditions)
  {
    id: "prebuilt-conditional-alert",
    name: "Keyword Alert Pipeline",
    prebuilt: true,
    enabled: true,
    triggers: { manual: true },
    steps: [
      // Step 1: Check page text against keyword list
      {
        type: "filter",
        value: "page.text",
        list: "prebuilt-list-keywords",
        action: "allow",
        passSteps: [
          { type: "setVar", varName: "triggered", value: "true" },
        ],
        haltSteps: [
          { type: "setVar", varName: "triggered", value: "false" },
        ],
      },
      // Step 2: Condition on whether keywords were found
      {
        type: "condition",
        expression: { op: "eq", left: "vars.triggered", right: "true" },
        thenSteps: [
          {
            type: "classify",
            question: "What is the urgency level of this content based on the alert keywords found?",
            inputMode: "page",
            varName: "urgency",
            categories: [
              { value: "critical", label: "Critical", description: "Requires immediate attention" },
              { value: "high", label: "High", description: "Important, review within hours" },
              { value: "medium", label: "Medium", description: "Worth noting, review when convenient" },
              { value: "low", label: "Low", description: "Informational only" },
            ],
            defaultSteps: [],
          },
          {
            type: "condition",
            expression: { op: "eq", left: "vars.urgency", right: "critical" },
            thenSteps: [
              {
                type: "prompt",
                system: "You are an urgent alert system.",
                prompt: "CRITICAL ALERT triggered.\n\nProvide an immediate action brief:\n1. What happened\n2. Why it's critical\n3. Who needs to know\n4. Recommended immediate actions",
                inputMode: "page",
              },
            ],
            elseSteps: [
              {
                type: "prompt",
                system: "You are a monitoring system.",
                prompt: "Alert level: {{vars.urgency}}\n\nProvide a monitoring note summarizing what triggered the alert and whether it warrants escalation.",
                inputMode: "page",
              },
            ],
          },
        ],
        elseSteps: [],
      },
    ],
    cooldownMs: 0,
    delay: 1000,
    notifyOnComplete: true,
    continueOnError: false,
  },

];

const PREBUILT_LISTS = [

  // Flagged Domains blocklist
  {
    id: "prebuilt-list-flagged-domains",
    name: "Flagged Domains",
    prebuilt: true,
    type: "blocklist",
    description: "Domains to flag or block in filter automations. Replace these examples with your own.",
    items: [
      { value: "example-unreliable.com" },
      { value: "known-disinfo.net" },
      { value: "clickbait-factory.io" },
    ],
  },

  // Priority Sources watchlist
  {
    id: "prebuilt-list-priority-sources",
    name: "Priority Sources",
    prebuilt: true,
    type: "watchlist",
    description: "Trusted and priority news sources for allowlist filters.",
    items: [
      { value: "reuters.com" },
      { value: "apnews.com" },
      { value: "bbc.com" },
      { value: "nytimes.com" },
      { value: "washingtonpost.com" },
      { value: "economist.com" },
    ],
  },

  // Keywords watchlist
  {
    id: "prebuilt-list-keywords",
    name: "Alert Keywords",
    prebuilt: true,
    type: "watchlist",
    description: "Keywords that trigger special processing. Add terms relevant to your monitoring needs.",
    items: [
      { value: "breaking" },
      { value: "exclusive" },
      { value: "urgent" },
      { value: "developing" },
    ],
  },

];
