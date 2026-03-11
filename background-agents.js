// ──────────────────────────────────────────────
// Agentic Automation & Active Synthesis
// Provides scheduled digests, trend detection,
// auto-report generation, and pipeline chaining.
// Loaded after background-pipelines.js in background scripts.
// ──────────────────────────────────────────────

const AgentEngine = (() => {

  // ── Report Section Prompts ──

  const REPORT_PROMPTS = {
    executiveSummary: {
      system: "You are an intelligence analyst writing a concise executive summary. Be direct and actionable.",
      prompt: `Write an executive summary for this OSINT project. You have the following data:

**Project:** {projectName}
**Description:** {projectDescription}
**Items collected:** {itemCount}
**Knowledge Graph entities:** {entityCount}
**Date range:** {dateRange}

**Recent items:**
{recentItems}

**Top entities from Knowledge Graph:**
{topEntities}

**Key relationships:**
{keyRelationships}

Write a 3-5 paragraph executive summary covering:
1. Project scope and focus
2. Key findings and patterns
3. Notable entities and connections
4. Recommended next steps

Be specific — reference actual entities and findings from the data.`
    },

    knowledgeGaps: {
      system: "You are a research analyst identifying gaps in intelligence collection.",
      prompt: `Analyze this project's coverage and identify knowledge gaps:

**Project:** {projectName}
**Items analyzed:** {itemCount}
**Entities tracked:** {entityCount}

**Current entity coverage by type:**
{entityCoverage}

**Items with summaries:**
{itemSummaries}

**Entity connections:**
{connections}

Identify:
## Knowledge Gaps
- What important topics or entities are mentioned but not well-covered?
- What relationships are implied but not confirmed?
- What time periods or geographic areas have sparse coverage?

## Collection Priorities
- What should be investigated next? (ranked by importance)
- What sources would fill the biggest gaps?

## Confidence Assessment
- Which findings are well-supported? Which are speculative?

Be specific — reference actual data points.`
    },

    contradictions: {
      system: "You are a fact-checking analyst looking for inconsistencies and contradictions across sources.",
      prompt: `Examine these project items for contradictions and discrepancies:

**Project:** {projectName}

**Items with content:**
{itemContents}

**Entity attributes from Knowledge Graph:**
{entityAttributes}

Identify:
## Contradictions Found
- Claims that directly conflict across sources
- Dates, numbers, or facts that don't align

## Discrepancies
- Information that is inconsistent but not directly contradictory
- Different framings or interpretations of the same events

## Reliability Notes
- Which sources seem most reliable? Why?
- Where is corroboration strongest/weakest?

If no contradictions are found, say so — don't fabricate issues.`
    },

    timelineHighlights: {
      system: "You are a chronological analyst constructing timeline narratives from intelligence data.",
      prompt: `Build a timeline of key events from this project's data:

**Project:** {projectName}

**Items with dates/content:**
{timelineItems}

**Date-type entities from KG:**
{dateEntities}

Create:
## Timeline Highlights
- List key events chronologically with dates
- Note the source for each event

## Narrative Arc
- What story emerges from the chronological ordering?
- Are there acceleration patterns or pivotal moments?

## Temporal Gaps
- Where are there missing time periods?
- What likely happened during gaps?

Use actual dates and events from the data. Format dates consistently.`
    }
  };

  // ── Digest Generation ──

  async function generateProjectDigest(projectId) {
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };

    const settings = await getProviderSettings();

    // Gather project data
    const items = proj.items || [];
    const kgData = await KnowledgeGraph.getGraphData({ projectId });
    const stats = await KnowledgeGraph.getStats();

    // Find items added/updated in the last digest period
    const lastDigest = await getLastDigestTime(projectId);
    const newItems = items.filter(i => new Date(i.addedAt) > lastDigest);

    // Build digest content
    const context = {
      projectName: proj.name,
      totalItems: items.length,
      newItems: newItems.length,
      entityCount: kgData.nodes?.length || 0,
      edgeCount: kgData.edges?.length || 0,
    };

    // Get recent history entries related to project URLs
    const projectUrls = items.map(i => i.url).filter(Boolean);
    const allHistory = await ArgusDB.History.getAllSorted();
    const relatedHistory = allHistory.filter(h =>
      projectUrls.includes(h.pageUrl)
    ).slice(0, 20);

    // Build digest prompt
    const digestPrompt = buildDigestPrompt(proj, items, newItems, kgData, relatedHistory);
    const messages = buildMessages(
      "You are an intelligence briefing generator. Write a concise daily/weekly digest for an OSINT project. Use markdown formatting.",
      digestPrompt
    );

    try {
      const result = await callProvider(
        settings.provider, settings.apiKey, settings.model, messages,
        { maxTokens: 2000, temperature: 0.4 }
      );

      const digest = {
        id: `digest-${projectId}-${Date.now()}`,
        projectId,
        projectName: proj.name,
        content: result.content,
        context,
        generatedAt: new Date().toISOString(),
        provider: settings.provider,
        model: result.model,
      };

      // Store digest
      await saveDigest(digest);
      await setLastDigestTime(projectId);

      return { success: true, digest };
    } catch (e) {
      console.warn("[Agent] Digest generation failed:", e);
      return { success: false, error: e.message };
    }
  }

  function buildDigestPrompt(proj, items, newItems, kgData, history) {
    let prompt = `**Project:** ${proj.name}\n`;
    if (proj.description) prompt += `**Focus:** ${proj.description}\n`;
    prompt += `**Total items:** ${items.length} | **New since last digest:** ${newItems.length}\n`;
    prompt += `**KG entities:** ${kgData.nodes?.length || 0} | **KG relationships:** ${kgData.edges?.length || 0}\n\n`;

    if (newItems.length) {
      prompt += `### New Items\n`;
      for (const item of newItems.slice(0, 15)) {
        prompt += `- **${item.title || "Untitled"}** (${item.type}) — ${item.url || "no URL"}\n`;
        if (item.summary) prompt += `  ${item.summary.slice(0, 200)}\n`;
      }
      prompt += "\n";
    }

    if (kgData.nodes && kgData.nodes.length) {
      prompt += `### Top Entities\n`;
      const sorted = [...kgData.nodes].sort((a, b) => (b.mentions || 0) - (a.mentions || 0));
      for (const node of sorted.slice(0, 15)) {
        prompt += `- **${node.label || node.name}** (${node.type}) — ${node.mentions || 0} mentions\n`;
      }
      prompt += "\n";
    }

    if (kgData.edges && kgData.edges.length) {
      prompt += `### Key Relationships\n`;
      const nodeMap = new Map((kgData.nodes || []).map(n => [n.id, n.label || n.name]));
      for (const edge of kgData.edges.slice(0, 10)) {
        const src = nodeMap.get(edge.source) || edge.source;
        const tgt = nodeMap.get(edge.target) || edge.target;
        prompt += `- ${src} → ${edge.relationType || "related"} → ${tgt} (weight: ${edge.weight || 1})\n`;
      }
      prompt += "\n";
    }

    if (history.length) {
      prompt += `### Recent Analyses\n`;
      for (const h of history.slice(0, 10)) {
        prompt += `- [${h.presetLabel || h.preset}] ${h.pageTitle} (${new Date(h.timestamp).toLocaleDateString()})\n`;
        if (h.content) prompt += `  ${h.content.slice(0, 150).replace(/\n/g, " ")}...\n`;
      }
    }

    prompt += `\n\nWrite a digest briefing with:\n1. **Status Update** — what's new\n2. **Key Findings** — notable patterns or connections\n3. **Alerts** — anything unusual or requiring attention\n4. **Suggested Actions** — what to investigate next\n`;

    return prompt;
  }

  // ── Auto-Report Section Generation ──

  async function generateReportSection(projectId, sectionType) {
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };

    const promptConfig = REPORT_PROMPTS[sectionType];
    if (!promptConfig) return { success: false, error: `Unknown section type: ${sectionType}` };

    const settings = await getProviderSettings();

    // Gather data
    const items = proj.items || [];
    const kgData = await KnowledgeGraph.getGraphData({ projectId });
    const allHistory = await ArgusDB.History.getAllSorted();
    const projectUrls = items.map(i => i.url).filter(Boolean);
    const relatedHistory = allHistory.filter(h => projectUrls.includes(h.pageUrl)).slice(0, 30);

    // Build template variables
    const vars = buildTemplateVars(proj, items, kgData, relatedHistory);
    const filledPrompt = fillTemplate(promptConfig.prompt, vars);

    const messages = buildMessages(promptConfig.system, filledPrompt);

    try {
      const result = await callProvider(
        settings.provider, settings.apiKey, settings.model, messages,
        { maxTokens: 3000, temperature: 0.3 }
      );

      return {
        success: true,
        section: {
          type: sectionType,
          content: result.content,
          generatedAt: new Date().toISOString(),
          provider: settings.provider,
          model: result.model,
        }
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function buildTemplateVars(proj, items, kgData, history) {
    const nodes = kgData.nodes || [];
    const edges = kgData.edges || [];
    const nodeMap = new Map(nodes.map(n => [n.id, n.label || n.name]));

    // Date range
    const dates = items.map(i => new Date(i.addedAt)).filter(d => !isNaN(d));
    const dateRange = dates.length
      ? `${new Date(Math.min(...dates)).toLocaleDateString()} — ${new Date(Math.max(...dates)).toLocaleDateString()}`
      : "N/A";

    // Entity coverage by type
    const typeCounts = {};
    for (const n of nodes) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }
    const entityCoverage = Object.entries(typeCounts)
      .map(([t, c]) => `- ${t}: ${c} entities`)
      .join("\n") || "No entities tracked";

    // Top entities
    const topEntities = [...nodes]
      .sort((a, b) => (b.mentions || 0) - (a.mentions || 0))
      .slice(0, 20)
      .map(n => `- ${n.label || n.name} (${n.type}, ${n.mentions || 0} mentions)`)
      .join("\n") || "None";

    // Key relationships
    const keyRelationships = edges
      .slice(0, 20)
      .map(e => `- ${nodeMap.get(e.source) || "?"} —[${e.relationType || "related"}]→ ${nodeMap.get(e.target) || "?"}`)
      .join("\n") || "None";

    // Recent items
    const recentItems = items.slice(-15).map(i =>
      `- ${i.title || "Untitled"} (${i.type}, added ${i.addedAt})\n  ${(i.summary || "").slice(0, 150)}`
    ).join("\n") || "None";

    // Item contents (for contradiction analysis)
    const itemContents = history.slice(0, 15).map(h =>
      `### ${h.pageTitle} (${h.presetLabel || h.preset})\n${(h.content || "").slice(0, 500)}`
    ).join("\n\n---\n\n") || "No analysis content available";

    // Item summaries
    const itemSummaries = items.filter(i => i.summary).slice(0, 20)
      .map(i => `- **${i.title}**: ${i.summary.slice(0, 200)}`)
      .join("\n") || "None";

    // Connections
    const connections = edges.slice(0, 15)
      .map(e => `${nodeMap.get(e.source) || "?"} ↔ ${nodeMap.get(e.target) || "?"} (${e.relationType})`)
      .join("\n") || "None";

    // Entity attributes
    const entityAttributes = nodes.slice(0, 15)
      .map(n => {
        let attrs = `- **${n.label || n.name}** (${n.type})`;
        if (n.aliases && n.aliases.length) attrs += ` | aliases: ${n.aliases.join(", ")}`;
        if (n.attributes) attrs += ` | ${JSON.stringify(n.attributes)}`;
        return attrs;
      }).join("\n") || "None";

    // Timeline items
    const timelineItems = history.slice(0, 20).map(h =>
      `- [${new Date(h.timestamp).toISOString().split("T")[0]}] ${h.pageTitle}: ${(h.content || "").slice(0, 200)}`
    ).join("\n") || "None";

    // Date entities
    const dateEntities = nodes.filter(n => n.type === "date" || n.type === "event")
      .map(n => `- ${n.label || n.name} (${n.type})`)
      .join("\n") || "None";

    return {
      projectName: proj.name,
      projectDescription: proj.description || "No description",
      itemCount: items.length,
      entityCount: nodes.length,
      dateRange,
      entityCoverage,
      topEntities,
      keyRelationships,
      recentItems,
      itemContents,
      itemSummaries,
      connections,
      entityAttributes,
      timelineItems,
      dateEntities,
    };
  }

  function fillTemplate(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || "N/A");
  }

  // ── Trend Detection ──

  async function detectTrends(projectId) {
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };

    const kgData = await KnowledgeGraph.getGraphData({ projectId });
    const nodes = kgData.nodes || [];
    const edges = kgData.edges || [];

    // Get previous snapshot for comparison
    const snapshotKey = `trend-snapshot-${projectId}`;
    const { [snapshotKey]: prevSnapshot = null } = await browser.storage.local.get({ [snapshotKey]: null });

    // Build current snapshot
    const currentSnapshot = {
      timestamp: Date.now(),
      entityCounts: {},
      totalNodes: nodes.length,
      totalEdges: edges.length,
    };
    for (const node of nodes) {
      currentSnapshot.entityCounts[node.id] = {
        name: node.label || node.name,
        type: node.type,
        mentions: node.mentions || 0,
      };
    }

    const trends = { alerts: [], rising: [], new: [], timestamp: new Date().toISOString() };

    if (prevSnapshot) {
      const prevCounts = prevSnapshot.entityCounts || {};
      const timeDelta = currentSnapshot.timestamp - prevSnapshot.timestamp;
      const daysDelta = Math.max(timeDelta / (1000 * 60 * 60 * 24), 0.1);

      for (const [id, curr] of Object.entries(currentSnapshot.entityCounts)) {
        const prev = prevCounts[id];
        if (!prev) {
          trends.new.push({ name: curr.name, type: curr.type, mentions: curr.mentions });
        } else if (curr.mentions > prev.mentions) {
          const delta = curr.mentions - prev.mentions;
          const rate = delta / daysDelta;
          if (rate >= 3) {
            trends.alerts.push({
              name: curr.name, type: curr.type,
              previousMentions: prev.mentions, currentMentions: curr.mentions,
              delta, rate: Math.round(rate * 10) / 10,
              message: `Mentions of "${curr.name}" spiked ${delta}× (${Math.round(rate)}/day)`,
            });
          } else if (delta >= 2) {
            trends.rising.push({
              name: curr.name, type: curr.type,
              previousMentions: prev.mentions, currentMentions: curr.mentions, delta,
            });
          }
        }
      }

      // Detect graph growth
      const nodeGrowth = currentSnapshot.totalNodes - prevSnapshot.totalNodes;
      const edgeGrowth = currentSnapshot.totalEdges - prevSnapshot.totalEdges;
      if (nodeGrowth >= 10) {
        trends.alerts.push({ message: `${nodeGrowth} new entities added since last check`, type: "growth" });
      }
      if (edgeGrowth >= 15) {
        trends.alerts.push({ message: `${edgeGrowth} new connections discovered`, type: "growth" });
      }
    }

    // Save current snapshot for next comparison
    await browser.storage.local.set({ [snapshotKey]: currentSnapshot });

    return { success: true, trends, projectName: proj.name };
  }

  // ── Dashboard Data (at-a-glance) ──

  async function getDashboardData(projectId) {
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };

    const items = proj.items || [];
    const kgData = await KnowledgeGraph.getGraphData({ projectId });
    const nodes = kgData.nodes || [];
    const edges = kgData.edges || [];

    // Entity type breakdown
    const typeBreakdown = {};
    for (const n of nodes) {
      typeBreakdown[n.type] = (typeBreakdown[n.type] || 0) + 1;
    }

    // Top entities by mentions
    const topEntities = [...nodes]
      .sort((a, b) => (b.mentions || 0) - (a.mentions || 0))
      .slice(0, 10)
      .map(n => ({ name: n.label || n.name, type: n.type, mentions: n.mentions || 0 }));

    // Co-occurrence matrix (top 8 entities)
    const topIds = topEntities.slice(0, 8).map(e => {
      const match = nodes.find(n => (n.label || n.name) === e.name);
      return match ? match.id : null;
    }).filter(Boolean);

    const cooccurrence = [];
    for (let i = 0; i < topIds.length; i++) {
      for (let j = i + 1; j < topIds.length; j++) {
        const edge = edges.find(e =>
          (e.source === topIds[i] && e.target === topIds[j]) ||
          (e.source === topIds[j] && e.target === topIds[i])
        );
        if (edge) {
          const nameA = topEntities.find(e => nodes.find(n => n.id === topIds[i] && (n.label || n.name) === e.name))?.name || "?";
          const nameB = topEntities.find(e => nodes.find(n => n.id === topIds[j] && (n.label || n.name) === e.name))?.name || "?";
          cooccurrence.push({
            entityA: nameA,
            entityB: nameB,
            weight: edge.weight || 1,
            relationType: edge.relationType,
          });
        }
      }
    }

    // Recent graph changes (nodes added in last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentNodes = nodes.filter(n => n.createdAt && n.createdAt > weekAgo)
      .map(n => ({ name: n.label || n.name, type: n.type, addedAt: n.createdAt }));

    // Item activity over time (last 30 days histogram)
    const activityHist = buildActivityHistogram(items);

    // Get latest digest
    const digests = await getDigests(projectId);

    // Get trends
    const trendResult = await detectTrends(projectId);

    return {
      success: true,
      dashboard: {
        project: { id: proj.id, name: proj.name, description: proj.description, color: proj.color },
        stats: {
          totalItems: items.length,
          totalEntities: nodes.length,
          totalRelationships: edges.length,
          itemsByType: countItemTypes(items),
        },
        typeBreakdown,
        topEntities,
        cooccurrence,
        recentChanges: recentNodes.slice(0, 15),
        activityHist,
        latestDigest: digests[0] || null,
        trends: trendResult.success ? trendResult.trends : null,
      }
    };
  }

  function countItemTypes(items) {
    const counts = {};
    for (const i of items) {
      counts[i.type] = (counts[i.type] || 0) + 1;
    }
    return counts;
  }

  function buildActivityHistogram(items) {
    const days = 30;
    const hist = {};
    const now = Date.now();
    for (let d = 0; d < days; d++) {
      const date = new Date(now - d * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      hist[date] = 0;
    }
    for (const item of items) {
      const date = new Date(item.addedAt).toISOString().split("T")[0];
      if (hist[date] !== undefined) hist[date]++;
    }
    return Object.entries(hist)
      .map(([date, count]) => ({ date, count }))
      .reverse();
  }

  // ── Scheduled Digest Runner ──

  async function runScheduledDigests() {
    const projects = await ArgusDB.Projects.getAll();
    const results = [];

    for (const proj of projects) {
      // Only generate digest for projects with enough content
      if (!proj.items || proj.items.length < 3) continue;

      // Check if digest is due
      const lastTime = await getLastDigestTime(proj.id);
      const hoursSinceLast = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);

      // Get schedule setting (default: weekly = 168 hours)
      const schedKey = `digest-schedule-${proj.id}`;
      const { [schedKey]: schedule = "weekly" } = await browser.storage.local.get({ [schedKey]: "weekly" });
      const intervalHours = schedule === "daily" ? 24 : schedule === "weekly" ? 168 : 0;

      if (intervalHours === 0) continue; // disabled
      if (hoursSinceLast < intervalHours) continue; // not due yet

      try {
        const result = await generateProjectDigest(proj.id);
        results.push({ projectId: proj.id, projectName: proj.name, success: result.success });
      } catch (e) {
        results.push({ projectId: proj.id, projectName: proj.name, success: false, error: e.message });
      }
    }

    return results;
  }

  // ── Storage helpers ──

  async function saveDigest(digest) {
    const key = "agent-digests";
    const { [key]: digests = [] } = await browser.storage.local.get({ [key]: [] });
    digests.unshift(digest);
    // Keep last 50 digests across all projects
    if (digests.length > 50) digests.length = 50;
    await browser.storage.local.set({ [key]: digests });
  }

  async function getDigests(projectId) {
    const { "agent-digests": digests = [] } = await browser.storage.local.get({ "agent-digests": [] });
    if (projectId) return digests.filter(d => d.projectId === projectId);
    return digests;
  }

  async function getLastDigestTime(projectId) {
    const key = `digest-last-${projectId}`;
    const { [key]: ts = 0 } = await browser.storage.local.get({ [key]: 0 });
    return new Date(ts);
  }

  async function setLastDigestTime(projectId) {
    const key = `digest-last-${projectId}`;
    await browser.storage.local.set({ [key]: Date.now() });
  }

  async function setDigestSchedule(projectId, schedule) {
    const key = `digest-schedule-${projectId}`;
    await browser.storage.local.set({ [key]: schedule });
    return { success: true };
  }

  async function getDigestSchedule(projectId) {
    const key = `digest-schedule-${projectId}`;
    const { [key]: schedule = "weekly" } = await browser.storage.local.get({ [key]: "weekly" });
    return schedule;
  }

  // ── Public API ──
  return {
    generateProjectDigest,
    generateReportSection,
    detectTrends,
    getDashboardData,
    runScheduledDigests,
    getDigests,
    setDigestSchedule,
    getDigestSchedule,
    REPORT_SECTIONS: ["executiveSummary", "knowledgeGaps", "contradictions", "timelineHighlights"],
  };
})();
