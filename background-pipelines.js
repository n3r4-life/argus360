// ──────────────────────────────────────────────
// Source-Aware Pipelines
// Detects page types and runs specialized analysis chains.
// Loaded after background-kg.js in background scripts.
// ──────────────────────────────────────────────

const SourcePipelines = (() => {

  // ── Source Type Registry ──
  // Each source type: { id, label, detect(url, page), pipeline(page, settings) }
  // detect() returns true if this pipeline should handle the page.
  // pipeline() runs the specialized analysis chain and returns enriched results.

  const SOURCE_TYPES = [
    {
      id: "wikipedia",
      label: "Wikipedia",
      icon: "W",
      detect(url) {
        return /^https?:\/\/([a-z]{2,3}\.)?wikipedia\.org\/wiki\//i.test(url);
      },
    },
    {
      id: "classifieds",
      label: "Classifieds / Listing",
      icon: "$",
      detect(url, page) {
        // URL-based detection
        if (/craigslist\.org|facebook\.com\/marketplace|ebay\.com\/itm|offerup|mercari|poshmark|depop|etsy\.com\/listing/i.test(url)) return true;
        // Content heuristic: look for price patterns + contact/listing signals
        if (page && page.text) {
          const text = page.text.slice(0, 3000);
          const hasPrice = /\$[\d,]+(?:\.\d{2})?|\bprice[:\s]+[\d,]+/i.test(text);
          const hasListing = /\b(for sale|buy now|add to cart|contact seller|make offer|shipping|condition[:\s])/i.test(text);
          if (hasPrice && hasListing) return true;
        }
        return false;
      },
    },
    {
      id: "news",
      label: "News Article",
      icon: "N",
      detect(url, page) {
        // Major news domains
        if (/reuters\.com|apnews\.com|bbc\.(com|co\.uk)|cnn\.com|nytimes\.com|washingtonpost\.com|theguardian\.com|aljazeera\.com|bloomberg\.com|cnbc\.com|politico\.com|thehill\.com/i.test(url)) return true;
        // Content heuristic: has article-like structure
        if (page && page.text) {
          const text = page.text.slice(0, 2000);
          const hasDateline = /\b(published|updated|posted)\s*(on|:)?\s*\w+\s+\d{1,2}/i.test(text);
          const hasByline = /\b(by|author|written by|reporter)\s*[:\s]?\s*[A-Z]/i.test(text);
          if (hasDateline && hasByline) return true;
        }
        return false;
      },
    },
    {
      id: "research",
      label: "Research / Wiki",
      icon: "R",
      detect(url) {
        // Academic/research/wiki sites
        return /arxiv\.org|scholar\.google|pubmed|doi\.org|ssrn\.com|researchgate\.net|academia\.edu|\.wiki\//i.test(url);
      },
    },
    {
      id: "mediabias",
      label: "Media Bias Aggregator",
      icon: "B",
      detect(url) {
        return /allsides\.com|ground\.news|mediabiasfactcheck\.com|adfontesmedia\.com/i.test(url);
      },
    },
  ];

  // ── Detect source type for a page ──
  function detectSourceType(url, page) {
    for (const source of SOURCE_TYPES) {
      if (source.detect(url, page)) {
        return source;
      }
    }
    return null;
  }

  // ── Pipeline prompts ──

  const PIPELINE_PROMPTS = {
    wikipedia: {
      profile: {
        system: "You are a structured data extraction expert. Respond ONLY with valid JSON, no markdown fences, no explanation.",
        prompt: `Extract a structured profile from this Wikipedia article. Return JSON:
{
  "title": "",
  "type": "person|organization|place|event|concept|other",
  "summary": "2-3 sentence summary",
  "infobox": {
    "born": "", "died": "", "nationality": "", "occupation": "",
    "founded": "", "headquarters": "", "industry": "",
    "population": "", "area": "", "coordinates": ""
  },
  "key_facts": ["fact1", "fact2"],
  "categories": ["cat1", "cat2"],
  "related_entities": [{"name": "", "type": "person|org|place", "relationship": ""}],
  "controversies": ["if any"],
  "references_count": 0,
  "last_edited": ""
}
Only include fields that have actual data. For the infobox, include only fields relevant to this type of article.`
      },
      entities: {
        system: "You are an OSINT analyst specializing in entity extraction. Respond ONLY with valid JSON.",
        prompt: `Extract ALL named entities from this Wikipedia content. Return JSON:
{
  "people": [{"name": "", "role": "", "context": ""}],
  "organizations": [{"name": "", "type": "", "context": ""}],
  "locations": [{"name": "", "type": "", "context": ""}],
  "dates": [{"date": "", "event": "", "context": ""}]
}
Be thorough — include every entity mentioned.`
      }
    },

    classifieds: {
      extract: {
        system: "You are a structured data extraction expert for online listings and classifieds. Respond ONLY with valid JSON.",
        prompt: `Extract structured listing data from this page. Return JSON:
{
  "title": "",
  "price": { "amount": 0, "currency": "USD", "negotiable": false },
  "condition": "",
  "location": { "city": "", "state": "", "country": "" },
  "seller": { "name": "", "type": "individual|business", "rating": "" },
  "description_summary": "1-2 sentences",
  "category": "",
  "images_mentioned": 0,
  "contact_methods": ["email", "phone", "message"],
  "red_flags": ["list any scam indicators"],
  "comparable_value_estimate": "if possible, estimate fair market value"
}
Only include fields with actual data.`
      },
      scamCheck: {
        system: "You are a fraud detection expert specializing in online marketplace scams.",
        prompt: `Analyze this listing for scam indicators. Score the risk 1-10 and explain:

## Scam Risk Score: X/10

### Red Flags Found
- List each suspicious element

### Positive Signals
- List trustworthy indicators

### Recommendation
One sentence: safe to proceed, proceed with caution, or avoid.

Be specific about why each indicator is concerning or reassuring.`
      }
    },

    news: {
      analyze: {
        system: "You are an intelligence analyst specializing in news analysis and source evaluation. Respond ONLY with valid JSON.",
        prompt: `Analyze this news article. Return JSON:
{
  "headline": "",
  "publication": "",
  "author": "",
  "date_published": "",
  "summary": "2-3 sentence summary",
  "key_claims": [{"claim": "", "attribution": "", "evidence_level": "strong|moderate|weak|none"}],
  "entities": {
    "people": [{"name": "", "role": ""}],
    "organizations": [{"name": "", "role": ""}],
    "locations": [{"name": ""}]
  },
  "bias_indicators": {
    "loaded_language": ["examples"],
    "framing": "",
    "missing_perspectives": [""],
    "overall_lean": "left|center-left|center|center-right|right|neutral"
  },
  "source_quality": {
    "named_sources": 0,
    "anonymous_sources": 0,
    "primary_documents": 0,
    "score": "1-10"
  },
  "related_stories": ["suggested follow-up topics"]
}`
      }
    },

    mediabias: {
      coverage: {
        system: "You are a media analysis expert specializing in news coverage patterns, source bias, and narrative framing across outlets. Respond ONLY with valid JSON.",
        prompt: `Analyze this media bias/coverage aggregator page. Extract ALL structured data about the story and its coverage. Return JSON:
{
  "story": {
    "headline": "",
    "topic": "",
    "summary": "2-3 sentence summary of the underlying story"
  },
  "coverage": {
    "total_sources": 0,
    "sources": [
      {
        "outlet": "",
        "headline": "",
        "bias_rating": "left|lean-left|center|lean-right|right|unknown",
        "url": "",
        "stance": "brief description of angle/framing"
      }
    ],
    "breakdown": {
      "left": 0,
      "lean_left": 0,
      "center": 0,
      "lean_right": 0,
      "right": 0
    }
  },
  "narrative_analysis": {
    "left_framing": "how left-leaning outlets frame this story",
    "right_framing": "how right-leaning outlets frame this story",
    "center_framing": "how centrist outlets frame this story",
    "key_disagreements": ["what the outlets disagree about"],
    "common_ground": ["what all sides agree on"],
    "missing_context": ["important context that most coverage omits"]
  },
  "entities": {
    "people": [{"name": "", "role": ""}],
    "organizations": [{"name": "", "role": ""}]
  },
  "suggested_deep_dives": [
    {
      "topic": "",
      "why": "reason this deserves further research",
      "suggested_sources": ["types of sources to check"]
    }
  ]
}
Extract ALL sources listed on the page. For Ground News, capture the blindspot/coverage data. For AllSides, capture the bias ratings and balanced roundup. Include every article link you can find.`
      },
      links: {
        system: "You are a link extraction specialist. Respond ONLY with valid JSON.",
        prompt: `Extract ALL article links and source URLs from this media aggregator page. Return JSON:
{
  "articles": [
    {
      "outlet": "",
      "headline": "",
      "url": "",
      "bias_rating": "left|lean-left|center|lean-right|right|unknown"
    }
  ],
  "related_stories": [
    {
      "title": "",
      "url": ""
    }
  ]
}
Be thorough — capture every external article link on the page.`
      }
    },

    research: {
      analyze: {
        system: "You are a research analyst specializing in academic and investigative content. Respond ONLY with valid JSON.",
        prompt: `Analyze this research/wiki content for claims and knowledge gaps. Return JSON:
{
  "title": "",
  "topic": "",
  "summary": "2-3 sentences",
  "key_claims": [
    {"claim": "", "evidence": "strong|moderate|weak|none", "verifiable": true, "source_cited": true}
  ],
  "knowledge_coverage": {
    "strong_areas": ["topics well-covered"],
    "weak_areas": ["topics mentioned but not substantiated"],
    "gaps": ["important related topics not addressed"]
  },
  "entities": {
    "people": [{"name": "", "role": ""}],
    "organizations": [{"name": ""}],
    "concepts": [{"name": "", "definition": ""}]
  },
  "methodology_notes": "if applicable",
  "suggested_followup": ["questions or sources to investigate"]
}`
      }
    }
  };

  // ── Run a pipeline ──

  async function runPipeline(sourceType, page, settings) {
    const results = {
      sourceType: sourceType.id,
      sourceLabel: sourceType.label,
      stages: [],
      structuredData: null,
      entities: [],
      timestamp: Date.now(),
    };

    try {
      switch (sourceType.id) {
        case "wikipedia":
          await runWikipediaPipeline(page, settings, results);
          break;
        case "classifieds":
          await runClassifiedsPipeline(page, settings, results);
          break;
        case "news":
          await runNewsPipeline(page, settings, results);
          break;
        case "research":
          await runResearchPipeline(page, settings, results);
          break;
        case "mediabias":
          await runMediaBiasPipeline(page, settings, results);
          break;
      }
    } catch (e) {
      results.error = e.message;
      console.warn(`[Pipeline:${sourceType.id}] Error:`, e);
    }

    // Feed entities into Knowledge Graph (non-blocking)
    if (results.entities.length) {
      try {
        KnowledgeGraph.extractAndUpsert(
          results.entities.map(e => e.name).join(", "),
          page.url, page.title, "entities"
        );
        // Also directly upsert structured entities
        for (const entity of results.entities) {
          KnowledgeGraph.upsertEntity(entity, page.url, page.title);
        }
      } catch (e) { console.warn("[Pipeline] KG upsert failed:", e); }
    }

    return results;
  }

  // ── Wikipedia Pipeline ──

  async function runWikipediaPipeline(page, settings, results) {
    // Stage 1: Extract structured profile
    const profilePrompt = await getAdvancedPrompt("pipeline.wikipedia.profile", PIPELINE_PROMPTS.wikipedia.profile);
    const profileResult = await callPipelineAI(page, profilePrompt, settings);
    const profile = parseJSON(profileResult.content);

    if (profile) {
      results.structuredData = profile;
      results.stages.push({ name: "Profile Extraction", status: "done", data: profile });

      // Build entities from profile
      if (profile.related_entities) {
        for (const re of profile.related_entities) {
          results.entities.push({
            name: re.name,
            type: re.type || "other",
            role: re.relationship,
            context: `Related to ${profile.title}`,
          });
        }
      }
      // Add the subject itself
      if (profile.title) {
        results.entities.push({
          name: profile.title,
          type: profile.type || "other",
          context: profile.summary,
        });
      }
    }

    // Stage 2: Entity extraction
    const entityPrompt = await getAdvancedPrompt("pipeline.wikipedia.entities", PIPELINE_PROMPTS.wikipedia.entities);
    const entityResult = await callPipelineAI(page, entityPrompt, settings);
    const entityData = parseJSON(entityResult.content);

    if (entityData) {
      results.stages.push({ name: "Entity Extraction", status: "done" });
      for (const p of (entityData.people || [])) {
        results.entities.push({ name: p.name, type: "person", role: p.role, context: p.context });
      }
      for (const o of (entityData.organizations || [])) {
        results.entities.push({ name: o.name, type: "organization", context: o.context });
      }
      for (const l of (entityData.locations || [])) {
        results.entities.push({ name: l.name, type: "location", context: l.context });
      }
    }

    // Build markdown summary
    results.markdown = formatWikipediaResult(profile, results.entities);
  }

  // ── Classifieds Pipeline ──

  async function runClassifiedsPipeline(page, settings, results) {
    // Stage 1: Extract listing data
    const extractPrompt = await getAdvancedPrompt("pipeline.classifieds.extract", PIPELINE_PROMPTS.classifieds.extract);
    const extractResult = await callPipelineAI(page, extractPrompt, settings);
    const listing = parseJSON(extractResult.content);

    if (listing) {
      results.structuredData = listing;
      results.stages.push({ name: "Listing Extraction", status: "done", data: listing });

      // Track price history
      if (listing.price && listing.price.amount) {
        await trackPriceHistory(page.url, listing.price);
      }

      // Extract entities
      if (listing.seller && listing.seller.name) {
        results.entities.push({ name: listing.seller.name, type: "person", context: "Seller" });
      }
      if (listing.location) {
        const locParts = [listing.location.city, listing.location.state, listing.location.country].filter(Boolean);
        if (locParts.length) {
          results.entities.push({ name: locParts.join(", "), type: "location", context: "Listing location" });
        }
      }
    }

    // Stage 2: Scam check
    const scamPrompt = await getAdvancedPrompt("pipeline.classifieds.scamCheck", PIPELINE_PROMPTS.classifieds.scamCheck);
    const scamResult = await callPipelineAI(page, scamPrompt, settings);
    results.stages.push({ name: "Scam Analysis", status: "done" });

    results.markdown = formatClassifiedsResult(listing, scamResult.content, page.url);
  }

  // ── News Pipeline ──

  async function runNewsPipeline(page, settings, results) {
    const analyzePrompt = await getAdvancedPrompt("pipeline.news.analyze", PIPELINE_PROMPTS.news.analyze);
    const analyzeResult = await callPipelineAI(page, analyzePrompt, settings);
    const analysis = parseJSON(analyzeResult.content);

    if (analysis) {
      results.structuredData = analysis;
      results.stages.push({ name: "News Analysis", status: "done", data: analysis });

      // Extract entities
      if (analysis.entities) {
        for (const p of (analysis.entities.people || [])) {
          results.entities.push({ name: p.name, type: "person", role: p.role });
        }
        for (const o of (analysis.entities.organizations || [])) {
          results.entities.push({ name: o.name, type: "organization", role: o.role });
        }
        for (const l of (analysis.entities.locations || [])) {
          results.entities.push({ name: l.name, type: "location" });
        }
      }
    }

    results.markdown = formatNewsResult(analysis);
  }

  // ── Research Pipeline ──

  async function runResearchPipeline(page, settings, results) {
    const analyzePrompt = await getAdvancedPrompt("pipeline.research.analyze", PIPELINE_PROMPTS.research.analyze);
    const analyzeResult = await callPipelineAI(page, analyzePrompt, settings);
    const analysis = parseJSON(analyzeResult.content);

    if (analysis) {
      results.structuredData = analysis;
      results.stages.push({ name: "Research Analysis", status: "done", data: analysis });

      if (analysis.entities) {
        for (const p of (analysis.entities.people || [])) {
          results.entities.push({ name: p.name, type: "person", role: p.role });
        }
        for (const o of (analysis.entities.organizations || [])) {
          results.entities.push({ name: o.name, type: "organization" });
        }
      }
    }

    results.markdown = formatResearchResult(analysis);
  }

  // ── Media Bias Aggregator Pipeline ──

  async function runMediaBiasPipeline(page, settings, results) {
    // Stage 1: Coverage analysis — extract sources, bias ratings, narrative framing
    const coveragePrompt = await getAdvancedPrompt("pipeline.mediabias.coverage", PIPELINE_PROMPTS.mediabias.coverage);
    const coverageResult = await callPipelineAI(page, coveragePrompt, settings);
    const coverage = parseJSON(coverageResult.content);

    if (coverage) {
      results.structuredData = coverage;
      results.stages.push({ name: "Coverage Analysis", status: "done", data: coverage });

      // Extract entities
      if (coverage.entities) {
        for (const p of (coverage.entities.people || [])) {
          results.entities.push({ name: p.name, type: "person", role: p.role });
        }
        for (const o of (coverage.entities.organizations || [])) {
          results.entities.push({ name: o.name, type: "organization", role: o.role });
        }
      }
      // Also extract outlets as entities for the knowledge graph
      if (coverage.coverage && coverage.coverage.sources) {
        for (const s of coverage.coverage.sources) {
          if (s.outlet) {
            results.entities.push({ name: s.outlet, type: "organization", context: `News outlet — ${s.bias_rating || "unknown"} bias` });
          }
        }
      }
    }

    // Stage 2: Link extraction — get all article URLs for deeper research
    const linksPrompt = await getAdvancedPrompt("pipeline.mediabias.links", PIPELINE_PROMPTS.mediabias.links);
    const linksResult = await callPipelineAI(page, linksPrompt, settings);
    const links = parseJSON(linksResult.content);

    if (links) {
      results.stages.push({ name: "Link Extraction", status: "done", data: links });
      // Merge links into structured data
      if (results.structuredData) {
        results.structuredData._extractedLinks = links;
      }
    }

    results.markdown = formatMediaBiasResult(coverage, links);
  }

  function formatMediaBiasResult(coverage, links) {
    if (!coverage) return "Failed to analyze this media bias page.";

    let md = "";

    // Story header
    if (coverage.story) {
      md += `## ${coverage.story.headline || "Story Analysis"}\n\n`;
      if (coverage.story.topic) md += `**Topic:** ${coverage.story.topic}\n\n`;
      if (coverage.story.summary) md += `${coverage.story.summary}\n\n`;
    }

    // Coverage breakdown
    if (coverage.coverage) {
      const c = coverage.coverage;
      if (c.total_sources) md += `**Total Sources Covering:** ${c.total_sources}\n\n`;

      if (c.breakdown) {
        const b = c.breakdown;
        md += `### Coverage Spectrum\n`;
        md += `| Left | Lean Left | Center | Lean Right | Right |\n`;
        md += `|:----:|:---------:|:------:|:----------:|:-----:|\n`;
        md += `| ${b.left || 0} | ${b.lean_left || 0} | ${b.center || 0} | ${b.lean_right || 0} | ${b.right || 0} |\n\n`;
      }

      // Source table
      if (c.sources && c.sources.length) {
        md += `### Sources\n`;
        md += `| Outlet | Bias | Headline / Angle |\n|--------|------|------------------|\n`;
        for (const s of c.sources) {
          const headline = s.headline || s.stance || "—";
          const link = s.url ? `[${s.outlet}](${s.url})` : s.outlet;
          md += `| ${link} | ${s.bias_rating || "?"} | ${headline} |\n`;
        }
        md += "\n";
      }
    }

    // Narrative analysis
    if (coverage.narrative_analysis) {
      const na = coverage.narrative_analysis;
      md += `### Narrative Framing\n\n`;
      if (na.left_framing) md += `**Left:** ${na.left_framing}\n\n`;
      if (na.center_framing) md += `**Center:** ${na.center_framing}\n\n`;
      if (na.right_framing) md += `**Right:** ${na.right_framing}\n\n`;

      if (na.key_disagreements && na.key_disagreements.length) {
        md += `### Key Disagreements\n`;
        for (const d of na.key_disagreements) md += `- ${d}\n`;
        md += "\n";
      }
      if (na.common_ground && na.common_ground.length) {
        md += `### Common Ground\n`;
        for (const g of na.common_ground) md += `- ${g}\n`;
        md += "\n";
      }
      if (na.missing_context && na.missing_context.length) {
        md += `### Missing Context\n`;
        for (const m of na.missing_context) md += `- ${m}\n`;
        md += "\n";
      }
    }

    // Deep dive suggestions
    if (coverage.suggested_deep_dives && coverage.suggested_deep_dives.length) {
      md += `### Suggested Deep Dives\n`;
      for (const dd of coverage.suggested_deep_dives) {
        md += `- **${dd.topic}** — ${dd.why}`;
        if (dd.suggested_sources && dd.suggested_sources.length) {
          md += ` *(check: ${dd.suggested_sources.join(", ")})*`;
        }
        md += "\n";
      }
      md += "\n";
    }

    // Extracted article links for further research
    if (links && links.articles && links.articles.length) {
      md += `### Article Links (${links.articles.length})\n`;
      for (const a of links.articles) {
        const label = a.headline || a.outlet || a.url;
        const bias = a.bias_rating ? ` [${a.bias_rating}]` : "";
        if (a.url) {
          md += `- [${label}](${a.url})${bias}\n`;
        } else {
          md += `- ${label}${bias}\n`;
        }
      }
      md += "\n";
    }

    if (links && links.related_stories && links.related_stories.length) {
      md += `### Related Stories\n`;
      for (const rs of links.related_stories) {
        if (rs.url) {
          md += `- [${rs.title || rs.url}](${rs.url})\n`;
        } else {
          md += `- ${rs.title}\n`;
        }
      }
    }

    return md;
  }

  // ── AI call helper ──

  async function callPipelineAI(page, promptConfig, settings) {
    const textSnippet = truncateText(page.text || "", settings.maxInputChars || 30000);
    const userPrompt = `**Page Title:** ${page.title}\n**URL:** ${page.url}\n\n---\n\n${promptConfig.prompt}\n\n---\n\n${textSnippet}`;
    const messages = buildMessages(promptConfig.system, userPrompt);

    return await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      { maxTokens: settings.maxTokens || 4000, temperature: 0.3 }
    );
  }

  // ── Price tracking ──

  async function trackPriceHistory(url, price) {
    try {
      const key = `price-history-${url.replace(/[^a-z0-9]/gi, "_").slice(0, 80)}`;
      const { [key]: history = [] } = await browser.storage.local.get({ [key]: [] });
      history.push({
        amount: price.amount,
        currency: price.currency || "USD",
        timestamp: Date.now(),
      });
      // Keep last 50 price points
      if (history.length > 50) history.splice(0, history.length - 50);
      await browser.storage.local.set({ [key]: history });
    } catch { /* non-critical */ }
  }

  async function getPriceHistory(url) {
    const key = `price-history-${url.replace(/[^a-z0-9]/gi, "_").slice(0, 80)}`;
    const { [key]: history = [] } = await browser.storage.local.get({ [key]: [] });
    return history;
  }

  // ── JSON parser with fallback ──

  function parseJSON(content) {
    if (!content) return null;
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      }
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  // ── Markdown formatters ──

  function formatWikipediaResult(profile, entities) {
    if (!profile) return "Failed to extract structured data from this Wikipedia article.";

    let md = `## ${profile.title || "Wikipedia Article"}\n\n`;
    if (profile.type) md += `**Type:** ${profile.type}\n\n`;
    if (profile.summary) md += `${profile.summary}\n\n`;

    // Infobox
    if (profile.infobox) {
      const fields = Object.entries(profile.infobox).filter(([, v]) => v);
      if (fields.length) {
        md += `### Profile\n`;
        md += `| Field | Value |\n|-------|-------|\n`;
        for (const [k, v] of fields) {
          md += `| ${k.replace(/_/g, " ")} | ${v} |\n`;
        }
        md += "\n";
      }
    }

    if (profile.key_facts && profile.key_facts.length) {
      md += `### Key Facts\n`;
      for (const fact of profile.key_facts) md += `- ${fact}\n`;
      md += "\n";
    }

    if (profile.controversies && profile.controversies.length) {
      md += `### Controversies\n`;
      for (const c of profile.controversies) md += `- ${c}\n`;
      md += "\n";
    }

    if (profile.related_entities && profile.related_entities.length) {
      md += `### Related Entities\n`;
      for (const re of profile.related_entities) {
        md += `- **${re.name}** (${re.type || "?"}) — ${re.relationship || ""}\n`;
      }
      md += "\n";
    }

    if (profile.categories && profile.categories.length) {
      md += `### Categories\n${profile.categories.join(", ")}\n\n`;
    }

    if (profile.references_count) {
      md += `*${profile.references_count} references cited*\n`;
    }

    return md;
  }

  function formatClassifiedsResult(listing, scamAnalysis, url) {
    let md = "";

    if (listing) {
      md += `## Listing Analysis\n\n`;
      if (listing.title) md += `**${listing.title}**\n\n`;

      if (listing.price && listing.price.amount) {
        md += `### Price\n`;
        md += `**${listing.price.currency || "$"}${listing.price.amount}**`;
        if (listing.price.negotiable) md += " *(negotiable)*";
        md += "\n\n";
      }

      if (listing.condition) md += `**Condition:** ${listing.condition}\n\n`;

      if (listing.location) {
        const loc = [listing.location.city, listing.location.state, listing.location.country].filter(Boolean).join(", ");
        if (loc) md += `**Location:** ${loc}\n\n`;
      }

      if (listing.description_summary) md += `**Summary:** ${listing.description_summary}\n\n`;

      if (listing.seller) {
        md += `### Seller\n`;
        if (listing.seller.name) md += `- **Name:** ${listing.seller.name}\n`;
        if (listing.seller.type) md += `- **Type:** ${listing.seller.type}\n`;
        if (listing.seller.rating) md += `- **Rating:** ${listing.seller.rating}\n`;
        md += "\n";
      }

      if (listing.comparable_value_estimate) {
        md += `### Value Estimate\n${listing.comparable_value_estimate}\n\n`;
      }

      if (listing.red_flags && listing.red_flags.length) {
        md += `### Red Flags\n`;
        for (const rf of listing.red_flags) md += `- ${rf}\n`;
        md += "\n";
      }
    }

    if (scamAnalysis) {
      md += `---\n\n${scamAnalysis}\n`;
    }

    return md;
  }

  function formatNewsResult(analysis) {
    if (!analysis) return "Failed to analyze this news article.";

    let md = `## ${analysis.headline || "News Analysis"}\n\n`;
    if (analysis.publication) md += `**Publication:** ${analysis.publication}\n`;
    if (analysis.author) md += `**Author:** ${analysis.author}\n`;
    if (analysis.date_published) md += `**Published:** ${analysis.date_published}\n`;
    md += "\n";

    if (analysis.summary) md += `${analysis.summary}\n\n`;

    if (analysis.key_claims && analysis.key_claims.length) {
      md += `### Key Claims\n`;
      md += `| Claim | Attribution | Evidence |\n|-------|-------------|----------|\n`;
      for (const c of analysis.key_claims) {
        md += `| ${c.claim} | ${c.attribution || "—"} | ${c.evidence_level || "?"} |\n`;
      }
      md += "\n";
    }

    if (analysis.bias_indicators) {
      const bi = analysis.bias_indicators;
      md += `### Bias Analysis\n`;
      if (bi.overall_lean) md += `**Overall Lean:** ${bi.overall_lean}\n`;
      if (bi.framing) md += `**Framing:** ${bi.framing}\n`;
      if (bi.loaded_language && bi.loaded_language.length) {
        md += `**Loaded Language:** ${bi.loaded_language.join(", ")}\n`;
      }
      if (bi.missing_perspectives && bi.missing_perspectives.length) {
        md += `**Missing Perspectives:** ${bi.missing_perspectives.join(", ")}\n`;
      }
      md += "\n";
    }

    if (analysis.source_quality) {
      const sq = analysis.source_quality;
      md += `### Source Quality: ${sq.score || "?"}/10\n`;
      md += `- Named sources: ${sq.named_sources || 0}\n`;
      md += `- Anonymous sources: ${sq.anonymous_sources || 0}\n`;
      md += `- Primary documents: ${sq.primary_documents || 0}\n\n`;
    }

    if (analysis.related_stories && analysis.related_stories.length) {
      md += `### Suggested Follow-up\n`;
      for (const s of analysis.related_stories) md += `- ${s}\n`;
    }

    return md;
  }

  function formatResearchResult(analysis) {
    if (!analysis) return "Failed to analyze this research content.";

    let md = `## ${analysis.title || "Research Analysis"}\n\n`;
    if (analysis.topic) md += `**Topic:** ${analysis.topic}\n\n`;
    if (analysis.summary) md += `${analysis.summary}\n\n`;

    if (analysis.key_claims && analysis.key_claims.length) {
      md += `### Claims Analysis\n`;
      md += `| Claim | Evidence | Verifiable | Source Cited |\n|-------|----------|------------|-------------|\n`;
      for (const c of analysis.key_claims) {
        md += `| ${c.claim} | ${c.evidence || "?"} | ${c.verifiable ? "Yes" : "No"} | ${c.source_cited ? "Yes" : "No"} |\n`;
      }
      md += "\n";
    }

    if (analysis.knowledge_coverage) {
      const kc = analysis.knowledge_coverage;
      if (kc.strong_areas && kc.strong_areas.length) {
        md += `### Well-Covered Topics\n`;
        for (const a of kc.strong_areas) md += `- ${a}\n`;
        md += "\n";
      }
      if (kc.weak_areas && kc.weak_areas.length) {
        md += `### Weakly Substantiated\n`;
        for (const a of kc.weak_areas) md += `- ${a}\n`;
        md += "\n";
      }
      if (kc.gaps && kc.gaps.length) {
        md += `### Knowledge Gaps\n`;
        for (const g of kc.gaps) md += `- ${g}\n`;
        md += "\n";
      }
    }

    if (analysis.methodology_notes) {
      md += `### Methodology\n${analysis.methodology_notes}\n\n`;
    }

    if (analysis.suggested_followup && analysis.suggested_followup.length) {
      md += `### Suggested Follow-up\n`;
      for (const s of analysis.suggested_followup) md += `- ${s}\n`;
    }

    return md;
  }

  // ── Public API ──
  return {
    SOURCE_TYPES,
    detectSourceType,
    runPipeline,
    getPriceHistory,
    PIPELINE_PROMPTS,
    parseJSON,
  };
})();
