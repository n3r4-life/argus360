// ──────────────────────────────────────────────
// Knowledge Graph Engine
// Persistent cross-project entity & relationship store.
// Loaded after background-osint.js in background scripts.
// ──────────────────────────────────────────────

const KnowledgeGraph = (() => {

  // ── Entity types ──
  const ENTITY_TYPES = ["person", "organization", "location", "date", "event", "other"];

  // ── Relationship types ──
  const RELATION_TYPES = {
    "mentioned-with": { label: "Mentioned with", color: "rgba(160,160,176,0.4)" },
    "affiliated-with": { label: "Affiliated with", color: "rgba(233,69,96,0.5)" },
    "located-in": { label: "Located in", color: "rgba(76,175,80,0.5)" },
    "invested-in": { label: "Invested in", color: "rgba(255,183,77,0.5)" },
    "worked-at": { label: "Worked at", color: "rgba(100,181,246,0.5)" },
  };

  // ── Name normalization ──

  const ORG_SUFFIXES = /\b(Inc\.?|Corp\.?|Corporation|LLC|Ltd\.?|Co\.?|Company|Group|Holdings|Plc|GmbH|SA|AG|LP|LLP)\s*$/i;

  function normalizeName(name) {
    if (!name) return "";
    return name.trim().replace(/\s+/g, " ");
  }

  function canonicalize(name) {
    return normalizeName(name).toLowerCase().replace(ORG_SUFFIXES, "").trim();
  }

  // Simple string hash for deterministic IDs
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function nodeId(type, canonicalName) {
    return `kgn-${type}-${simpleHash(canonicalName)}`;
  }

  function edgeId(sourceId, targetId, relationType) {
    // Consistent ordering so A→B and B→A produce the same edge
    const [a, b] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
    return `kge-${simpleHash(a + relationType + b)}`;
  }

  // ── Fuzzy matching ──

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function tokenOverlap(a, b) {
    const tokA = new Set(a.toLowerCase().split(/\s+/));
    const tokB = new Set(b.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const t of tokA) { if (tokB.has(t)) overlap++; }
    const maxLen = Math.max(tokA.size, tokB.size);
    return maxLen > 0 ? overlap / maxLen : 0;
  }

  // Returns { match: node|null, confidence: 0-1, ambiguous: boolean }
  function fuzzyMatch(name, type, existingNodes) {
    const canon = canonicalize(name);
    if (!canon) return { match: null, confidence: 0, ambiguous: false };

    let bestMatch = null;
    let bestConfidence = 0;

    for (const node of existingNodes) {
      if (node.type !== type) continue;

      // Exact canonical match
      if (canonicalize(node.canonicalName) === canon) {
        return { match: node, confidence: 1.0, ambiguous: false };
      }

      // Check aliases
      for (const alias of (node.aliases || [])) {
        if (canonicalize(alias) === canon) {
          return { match: node, confidence: 0.95, ambiguous: false };
        }
      }

      // Levenshtein distance
      const dist = levenshtein(canon, canonicalize(node.canonicalName));
      const maxLen = Math.max(canon.length, node.canonicalName.length);
      const threshold = maxLen < 10 ? 2 : 3;

      if (dist <= threshold && maxLen > 0) {
        const conf = 1 - (dist / maxLen);
        if (conf > bestConfidence) {
          bestConfidence = conf;
          bestMatch = node;
        }
      }

      // Token overlap
      const overlap = tokenOverlap(name, node.displayName);
      if (overlap >= 0.8 && overlap > bestConfidence) {
        bestConfidence = overlap;
        bestMatch = node;
      }
    }

    if (bestMatch && bestConfidence >= 0.8) {
      return { match: bestMatch, confidence: bestConfidence, ambiguous: false };
    }
    if (bestMatch && bestConfidence >= 0.5) {
      return { match: bestMatch, confidence: bestConfidence, ambiguous: true };
    }
    return { match: null, confidence: 0, ambiguous: false };
  }

  // ── Entity upsert ──

  async function upsertEntity(rawEntity, sourceUrl, sourceTitle) {
    const name = normalizeName(rawEntity.name);
    const type = normalizeType(rawEntity.type);
    if (!name || name.length < 2) return null;

    const canon = canonicalize(name);
    const id = nodeId(type, canon);

    // Try direct ID lookup first (fast path)
    let existing = await ArgusDB.KGNodes.get(id);

    if (existing) {
      // Merge into existing node
      existing.mentionCount = (existing.mentionCount || 0) + 1;
      if (!existing.aliases.includes(name) && name !== existing.displayName) {
        existing.aliases.push(name);
      }
      addSourcePage(existing, sourceUrl, sourceTitle);
      mergeAttributes(existing, rawEntity);
      await ArgusDB.KGNodes.save(existing);
      return existing;
    }

    // Fuzzy match against same-type nodes
    const sameType = await ArgusDB.KGNodes.getByType(type);
    const { match, confidence, ambiguous } = fuzzyMatch(name, type, sameType);

    if (match && !ambiguous) {
      // High-confidence match — merge
      match.mentionCount = (match.mentionCount || 0) + 1;
      if (!match.aliases.includes(name) && name !== match.displayName) {
        match.aliases.push(name);
      }
      addSourcePage(match, sourceUrl, sourceTitle);
      mergeAttributes(match, rawEntity);
      await ArgusDB.KGNodes.save(match);
      return match;
    }

    if (match && ambiguous) {
      // Queue for user confirmation
      await queuePendingMerge(name, type, match, sourceUrl, confidence);
      // Still create a new node — user can merge later
    }

    // Create new node
    const node = {
      id,
      canonicalName: canon,
      displayName: name,
      type,
      aliases: [name],
      attributes: {},
      sourcePages: [],
      mentionCount: 1,
      firstSeen: Date.now(),
      updatedAt: Date.now(),
      mergedFrom: [],
    };
    mergeAttributes(node, rawEntity);
    addSourcePage(node, sourceUrl, sourceTitle);
    await ArgusDB.KGNodes.save(node);
    return node;
  }

  function normalizeType(type) {
    if (!type) return "other";
    const t = type.toLowerCase().trim();
    // Map common variants
    if (t === "person" || t === "people") return "person";
    if (t === "organization" || t === "org" || t === "company") return "organization";
    if (t === "location" || t === "place" || t === "city" || t === "country" || t === "address" || t === "region") return "location";
    if (t === "date" || t === "time") return "date";
    if (t === "event") return "event";
    if (ENTITY_TYPES.includes(t)) return t;
    return "other";
  }

  function addSourcePage(node, url, title) {
    if (!url) return;
    const existing = node.sourcePages.find(s => s.url === url);
    if (existing) {
      existing.lastSeen = Date.now();
    } else {
      node.sourcePages.push({ url, title: title || url, extractedAt: Date.now(), lastSeen: Date.now() });
      // Cap source pages at 50
      if (node.sourcePages.length > 50) {
        node.sourcePages = node.sourcePages.slice(-50);
      }
    }
  }

  function mergeAttributes(node, rawEntity) {
    if (rawEntity.role && !node.attributes.role) node.attributes.role = rawEntity.role;
    if (rawEntity.context) node.attributes.context = rawEntity.context;
    if (rawEntity.value) node.attributes.value = rawEntity.value;
  }

  // ── Edge upsert ──

  async function upsertEdge(sourceNodeId, targetNodeId, relationType, sourceUrl, sourceTitle) {
    const id = edgeId(sourceNodeId, targetNodeId, relationType);
    let existing = await ArgusDB.KGEdges.get(id);

    if (existing) {
      existing.weight = (existing.weight || 0) + 1;
      addEdgeSource(existing, sourceUrl, sourceTitle);
      await ArgusDB.KGEdges.save(existing);
      return existing;
    }

    const [a, b] = sourceNodeId < targetNodeId ? [sourceNodeId, targetNodeId] : [targetNodeId, sourceNodeId];
    const edge = {
      id,
      sourceId: a,
      targetId: b,
      relationType,
      weight: 1,
      confidence: relationType === "mentioned-with" ? 0.5 : 0.7,
      inferred: false,
      inferenceRule: null,
      sourcePages: [],
      firstSeen: Date.now(),
      updatedAt: Date.now(),
    };
    addEdgeSource(edge, sourceUrl, sourceTitle);
    await ArgusDB.KGEdges.save(edge);
    return edge;
  }

  function addEdgeSource(edge, url, title) {
    if (!url) return;
    const existing = edge.sourcePages.find(s => s.url === url);
    if (!existing) {
      edge.sourcePages.push({ url, title: title || url, extractedAt: Date.now() });
      if (edge.sourcePages.length > 30) edge.sourcePages = edge.sourcePages.slice(-30);
    }
  }

  // ── Pending merges ──

  async function queuePendingMerge(newName, type, existingNode, sourceUrl, confidence) {
    const { kgPendingMerges = [] } = await browser.storage.local.get({ kgPendingMerges: [] });
    // Don't duplicate
    const already = kgPendingMerges.find(m =>
      m.newName.toLowerCase() === newName.toLowerCase() && m.existingNodeId === existingNode.id
    );
    if (already) return;

    kgPendingMerges.push({
      id: `merge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      newName,
      type,
      existingNodeId: existingNode.id,
      existingName: existingNode.displayName,
      confidence,
      sourceUrl,
      createdAt: Date.now(),
    });
    // Cap at 50 pending merges
    if (kgPendingMerges.length > 50) kgPendingMerges.splice(0, kgPendingMerges.length - 50);
    await browser.storage.local.set({ kgPendingMerges });
  }

  async function getPendingMerges() {
    const { kgPendingMerges = [] } = await browser.storage.local.get({ kgPendingMerges: [] });
    return kgPendingMerges;
  }

  async function resolvePendingMerge(mergeId, accept) {
    const { kgPendingMerges = [] } = await browser.storage.local.get({ kgPendingMerges: [] });
    const idx = kgPendingMerges.findIndex(m => m.id === mergeId);
    if (idx === -1) return { success: false, error: "Merge not found" };

    const merge = kgPendingMerges[idx];
    kgPendingMerges.splice(idx, 1);
    await browser.storage.local.set({ kgPendingMerges });

    if (accept) {
      // Find the new node by name and merge into existing
      const canon = canonicalize(merge.newName);
      const newId = nodeId(normalizeType(merge.type), canon);
      await mergeNodes(merge.existingNodeId, newId);
    }

    return { success: true };
  }

  // ── Node merge ──

  async function mergeNodes(keepId, removeId) {
    const keep = await ArgusDB.KGNodes.get(keepId);
    const toRemove = await ArgusDB.KGNodes.get(removeId);
    if (!keep || !toRemove) return;

    // Merge aliases
    for (const alias of (toRemove.aliases || [])) {
      if (!keep.aliases.includes(alias)) keep.aliases.push(alias);
    }

    // Merge source pages
    for (const sp of (toRemove.sourcePages || [])) {
      if (!keep.sourcePages.find(s => s.url === sp.url)) {
        keep.sourcePages.push(sp);
      }
    }

    // Merge attributes
    for (const [k, v] of Object.entries(toRemove.attributes || {})) {
      if (!keep.attributes[k]) keep.attributes[k] = v;
    }

    keep.mentionCount = (keep.mentionCount || 0) + (toRemove.mentionCount || 0);
    keep.mergedFrom = [...(keep.mergedFrom || []), removeId, ...(toRemove.mergedFrom || [])];
    keep.firstSeen = Math.min(keep.firstSeen || Date.now(), toRemove.firstSeen || Date.now());

    // Re-point edges from removed node to kept node
    const edges = await ArgusDB.KGEdges.getByNode(removeId);
    for (const edge of edges) {
      const newSourceId = edge.sourceId === removeId ? keepId : edge.sourceId;
      const newTargetId = edge.targetId === removeId ? keepId : edge.targetId;
      // Skip self-loops
      if (newSourceId === newTargetId) {
        await ArgusDB.KGEdges.remove(edge.id);
        continue;
      }
      // Check if equivalent edge already exists
      const newEdgeId = edgeId(newSourceId, newTargetId, edge.relationType);
      const existingEdge = await ArgusDB.KGEdges.get(newEdgeId);
      if (existingEdge) {
        existingEdge.weight = (existingEdge.weight || 0) + (edge.weight || 0);
        for (const sp of (edge.sourcePages || [])) {
          if (!existingEdge.sourcePages.find(s => s.url === sp.url)) {
            existingEdge.sourcePages.push(sp);
          }
        }
        await ArgusDB.KGEdges.save(existingEdge);
        await ArgusDB.KGEdges.remove(edge.id);
      } else {
        // Update edge in place
        await ArgusDB.KGEdges.remove(edge.id);
        edge.id = newEdgeId;
        edge.sourceId = newSourceId < newTargetId ? newSourceId : newTargetId;
        edge.targetId = newSourceId < newTargetId ? newTargetId : newSourceId;
        await ArgusDB.KGEdges.save(edge);
      }
    }

    await ArgusDB.KGNodes.save(keep);
    await ArgusDB.KGNodes.remove(removeId);
    return keep;
  }

  // ── Regex-based entity extraction (fast, no API) ──

  // Common noise phrases from page boilerplate, nav, sidebars, CTAs
  const NOISE_ENTITIES = new Set([
    // Navigation & UI
    "watch live", "read more", "sign up", "log in", "sign in", "subscribe now",
    "click here", "learn more", "get started", "view all", "see more", "show more",
    "load more", "read full", "full story", "breaking news", "latest news",
    "top stories", "trending now", "most popular", "most read", "editors picks",
    "related stories", "related articles", "recommended for you", "you may like",
    "more stories", "more from", "whats new", "just in", "live updates",
    "share this", "print this", "email this", "save article",
    // Social / sharing
    "follow us", "like us", "share on", "tweet this", "send email",
    "facebook share", "twitter share", "copy link",
    // Common section headers
    "table of contents", "about us", "contact us", "privacy policy",
    "terms of service", "terms and conditions", "cookie policy", "cookie settings",
    "advertise with us", "work with us", "careers at", "join our team",
    // Media / video boilerplate
    "skip to content", "skip to main", "skip navigation", "back to top",
    "now playing", "up next", "auto play", "full screen",
    "closed captions", "picture in picture",
    // Newsletter / subscription
    "daily newsletter", "weekly newsletter", "morning newsletter",
    "evening newsletter", "breaking alerts", "news alerts",
    "enter your email", "your email address",
    // Generic actions
    "add comment", "post comment", "leave reply", "report abuse",
    "flag content", "download app", "get app", "open app",
    // Common false-positive multi-word capitalized phrases
    "united states", "read the full", "according to", "in addition to",
    "on the other", "at the same", "for the first", "by the end",
    "save lake michigan", "attention rand paul",
  ]);

  function isNoiseEntity(name) {
    const lower = name.toLowerCase().trim();
    if (NOISE_ENTITIES.has(lower)) return true;
    // Single common words that get through as 2-word with article/preposition
    if (lower.length < 4) return true;
    // Very short "entities" (< 3 chars per word average)
    const words = lower.split(/\s+/);
    const avgLen = lower.replace(/\s+/g, "").length / words.length;
    if (avgLen < 3) return true;
    return false;
  }

  function extractEntitiesRegex(text) {
    if (!text) return [];
    const entities = [];
    const seen = new Set();

    // Capitalized multi-word names (2-4 words, each starting uppercase)
    const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
    let match;
    while ((match = nameRegex.exec(text)) !== null) {
      const name = match[1];
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      // Skip common phrases
      if (/^(The |This |That |These |Those |Some |Many |Most |Last |First |Next |New |Old )/i.test(name)) continue;
      if (name.split(/\s+/).length < 2) continue;
      if (isNoiseEntity(name)) continue;
      seen.add(key);

      // Guess type
      let type = "other";
      if (ORG_SUFFIXES.test(name)) type = "organization";
      else if (/\b(University|Institute|Foundation|Association|Agency|Department|Ministry|Committee|Commission|Bureau|Council|Board)\b/i.test(name)) type = "organization";
      else type = "person"; // Default multi-word capitalized = person

      entities.push({ name, type });
    }

    // Organizations with explicit suffixes anywhere in text
    const orgRegex = /\b([A-Z][\w&.''-]+(?:\s+[A-Z][\w&.''-]+)*\s+(?:Inc\.?|Corp\.?|Corporation|LLC|Ltd\.?|Co\.?|Company|Group|Holdings|Plc|GmbH))\b/gi;
    while ((match = orgRegex.exec(text)) !== null) {
      const name = normalizeName(match[1]);
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        entities.push({ name, type: "organization" });
      }
    }

    return entities;
  }

  // ── Parse entities from AI "entities" preset JSON output ──

  function parseEntitiesPresetOutput(content) {
    if (!content) return [];
    const entities = [];

    try {
      // Try parsing as JSON — the entities preset returns JSON directly
      let data;
      // Strip markdown code fences if present
      const cleaned = content.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      data = JSON.parse(cleaned);

      if (data.people) {
        for (const p of data.people) {
          if (p.name) entities.push({ name: p.name, type: "person", role: p.role, context: p.context });
        }
      }
      if (data.organizations) {
        for (const o of data.organizations) {
          if (o.name) entities.push({ name: o.name, type: "organization", context: o.context });
        }
      }
      if (data.locations) {
        for (const l of data.locations) {
          if (l.name) entities.push({ name: l.name, type: "location", context: l.context });
        }
      }
      if (data.dates) {
        for (const d of data.dates) {
          if (d.event || d.date) entities.push({ name: d.event || d.date, type: "date", value: d.date, context: d.context });
        }
      }
    } catch {
      // Not valid JSON — fall back to regex
      return extractEntitiesRegex(content);
    }

    return entities;
  }

  // ── Main extraction + upsert pipeline ──

  async function extractAndUpsert(content, url, title, preset) {
    if (!content || content.length < 20) return { nodes: 0, edges: 0 };

    // Choose extraction method
    let entities;
    if (preset === "entities") {
      entities = parseEntitiesPresetOutput(content);
    } else {
      entities = extractEntitiesRegex(content);
    }

    // Filter noise from both extraction paths
    entities = entities.filter(e => e.name && !isNoiseEntity(e.name));

    if (!entities.length) return { nodes: 0, edges: 0 };

    // Upsert all entities
    const upsertedNodes = [];
    for (const entity of entities) {
      try {
        const node = await upsertEntity(entity, url, title);
        if (node) upsertedNodes.push(node);
      } catch (e) {
        console.warn("[KG] Failed to upsert entity:", entity.name, e);
      }
    }

    // Create co-occurrence edges (mentioned-with) for entities from same page
    let edgeCount = 0;
    const uniqueNodes = [...new Map(upsertedNodes.map(n => [n.id, n])).values()];
    for (let i = 0; i < uniqueNodes.length && i < 50; i++) {
      for (let j = i + 1; j < uniqueNodes.length && j < 50; j++) {
        try {
          await upsertEdge(uniqueNodes[i].id, uniqueNodes[j].id, "mentioned-with", url, title);
          edgeCount++;
        } catch (e) {
          console.warn("[KG] Failed to upsert edge:", e);
        }
      }
    }

    return { nodes: upsertedNodes.length, edges: edgeCount };
  }

  // ── Inference rules ──

  async function runInferenceRules() {
    const stats = { inferred: 0 };

    try {
      const allEdges = await ArgusDB.KGEdges.getAll();
      const mentionedWith = allEdges.filter(e => e.relationType === "mentioned-with" && e.weight >= 3);

      for (const edge of mentionedWith) {
        const source = await ArgusDB.KGNodes.get(edge.sourceId);
        const target = await ArgusDB.KGNodes.get(edge.targetId);
        if (!source || !target) continue;

        // Person + Organization co-occurrence → affiliated-with
        if (
          (source.type === "person" && target.type === "organization") ||
          (source.type === "organization" && target.type === "person")
        ) {
          const affId = edgeId(edge.sourceId, edge.targetId, "affiliated-with");
          const existing = await ArgusDB.KGEdges.get(affId);
          if (!existing) {
            await ArgusDB.KGEdges.save({
              id: affId,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              relationType: "affiliated-with",
              weight: Math.floor(edge.weight / 3),
              confidence: Math.min(0.4 + edge.weight * 0.05, 0.8),
              inferred: true,
              inferenceRule: "co-occurrence-affiliation",
              sourcePages: edge.sourcePages.slice(0, 5),
              firstSeen: Date.now(),
              updatedAt: Date.now(),
            });
            stats.inferred++;
          }
        }

        // Entity + Location co-occurrence → located-in
        if (
          (source.type !== "location" && target.type === "location") ||
          (source.type === "location" && target.type !== "location")
        ) {
          const locId = edgeId(edge.sourceId, edge.targetId, "located-in");
          const existing = await ArgusDB.KGEdges.get(locId);
          if (!existing && edge.weight >= 2) {
            await ArgusDB.KGEdges.save({
              id: locId,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              relationType: "located-in",
              weight: Math.floor(edge.weight / 2),
              confidence: Math.min(0.3 + edge.weight * 0.05, 0.7),
              inferred: true,
              inferenceRule: "co-occurrence-location",
              sourcePages: edge.sourcePages.slice(0, 5),
              firstSeen: Date.now(),
              updatedAt: Date.now(),
            });
            stats.inferred++;
          }
        }
      }
    } catch (e) {
      console.warn("[KG] Inference error:", e);
    }

    return stats;
  }

  // ── Graph data query ──

  async function getGraphData(options = {}) {
    let nodes = await ArgusDB.KGNodes.getAll();
    let edges = await ArgusDB.KGEdges.getAll();

    // Filter by project if specified
    if (options.projectId) {
      const proj = await ArgusDB.Projects.get(options.projectId);
      if (proj) {
        const projectUrls = new Set((proj.items || []).map(i => i.url).filter(Boolean));
        // Keep nodes that have at least one source page matching a project URL
        nodes = nodes.filter(n =>
          (n.sourcePages || []).some(sp => projectUrls.has(sp.url))
        );
        const nodeIds = new Set(nodes.map(n => n.id));
        // Keep edges where at least one endpoint is in the filtered nodes
        edges = edges.filter(e => nodeIds.has(e.sourceId) || nodeIds.has(e.targetId));
        // Also include cross-project nodes that connect to filtered nodes
        const crossNodeIds = new Set();
        for (const e of edges) {
          if (!nodeIds.has(e.sourceId)) crossNodeIds.add(e.sourceId);
          if (!nodeIds.has(e.targetId)) crossNodeIds.add(e.targetId);
        }
        if (crossNodeIds.size) {
          const allNodes = await ArgusDB.KGNodes.getAll();
          const crossNodes = allNodes.filter(n => crossNodeIds.has(n.id));
          nodes = [...nodes, ...crossNodes];
        }
      }
    }

    // Filter by type
    if (options.nodeTypes && options.nodeTypes.length) {
      const types = new Set(options.nodeTypes);
      nodes = nodes.filter(n => types.has(n.type));
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));
    }

    // Filter by min mentions
    if (options.minMentions && options.minMentions > 1) {
      nodes = nodes.filter(n => (n.mentionCount || 0) >= options.minMentions);
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));
    }

    // Filter inferred edges
    if (options.includeInferred === false) {
      edges = edges.filter(e => !e.inferred);
    }

    return { nodes, edges };
  }

  // ── Stats ──

  async function getStats() {
    const nodeCount = await ArgusDB.KGNodes.count();
    const edgeCount = await ArgusDB.KGEdges.count();

    // Top entities by mention count
    const allNodes = await ArgusDB.KGNodes.getAll();
    allNodes.sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0));
    const topEntities = allNodes.slice(0, 10).map(n => ({
      id: n.id, name: n.displayName, type: n.type, mentions: n.mentionCount,
    }));

    // Type breakdown
    const typeCounts = {};
    for (const n of allNodes) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }

    return { nodeCount, edgeCount, topEntities, typeCounts };
  }

  // ── Backfill from existing history ──

  async function backfillFromHistory() {
    const flag = "_kg_backfill_done";
    const { [flag]: done } = await browser.storage.local.get({ [flag]: false });
    if (done) return { skipped: true };

    const history = await ArgusDB.History.getAllSorted();
    let processed = 0;

    for (const entry of history) {
      if (!entry.content || !entry.pageUrl) continue;
      try {
        await extractAndUpsert(entry.content, entry.pageUrl, entry.pageTitle, entry.preset);
        processed++;
      } catch (e) {
        console.warn("[KG] Backfill error for", entry.pageUrl, e);
      }
    }

    await browser.storage.local.set({ [flag]: true, _kg_backfill_at: Date.now() });
    console.log(`[KG] Backfill complete: processed ${processed} history items`);
    return { processed };
  }

  // ── Prune noisy entities from existing graph ──

  async function pruneNoiseEntities() {
    const allNodes = await ArgusDB.KGNodes.getAll();
    const noiseIds = new Set();
    for (const node of allNodes) {
      if (isNoiseEntity(node.displayName) || isNoiseEntity(node.canonicalName)) {
        noiseIds.add(node.id);
      }
    }
    if (!noiseIds.size) return { pruned: 0 };

    // Remove all noisy nodes
    for (const id of noiseIds) {
      await ArgusDB.KGNodes.remove(id);
    }
    // Remove edges connected to noisy nodes (single pass)
    const allEdges = await ArgusDB.KGEdges.getAll();
    for (const e of allEdges) {
      if (noiseIds.has(e.sourceId) || noiseIds.has(e.targetId)) {
        await ArgusDB.KGEdges.remove(e.id);
      }
    }
    console.log(`[KG] Pruned ${noiseIds.size} noisy entities`);
    return { pruned: noiseIds.size };
  }

  // ── Public API ──
  return {
    ENTITY_TYPES,
    RELATION_TYPES,
    extractAndUpsert,
    upsertEntity,
    upsertEdge,
    mergeNodes,
    fuzzyMatch,
    extractEntitiesRegex,
    parseEntitiesPresetOutput,
    runInferenceRules,
    getGraphData,
    getStats,
    getPendingMerges,
    resolvePendingMerge,
    backfillFromHistory,
    pruneNoiseEntities,
    normalizeName,
    canonicalize,
    nodeId,
  };
})();
