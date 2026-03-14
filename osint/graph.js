(function () {
  'use strict';

  /* ---- Constants ---- */
  const TYPE_COLORS = {
    person:       '#e94560',
    organization: '#64b5f6',
    location:     '#4caf50',
    date:         '#ffb74d',
    other:        '#a0a0b0'
  };

  const MIN_NODE_RADIUS = 8;
  const MAX_NODE_RADIUS = 28;
  const REPULSION        = 6000;
  const SPRING_LENGTH    = 120;
  const SPRING_K         = 0.004;
  const CENTER_GRAVITY   = 0.03;
  const DAMPING          = 0.85;
  const VELOCITY_LIMIT   = 8;
  const SIM_STEPS        = 300;       // iterations then stop
  const LABEL_FONT       = '11px -apple-system, BlinkMacSystemFont, sans-serif';

  /* ---- State ---- */
  let nodes = [];
  let edges = [];
  let visibleTypes = new Set(Object.keys(TYPE_COLORS));

  // Project overlay filter
  let allProjects = [];           // [{ id, name, color, urls: Set }]
  let nodeProjectMap = new Map(); // nodeId → Set of projectIds
  let projectFilterActive = false; // false = show everything (no project filtering)
  let visibleProjects = new Set(); // which project IDs are toggled on
  let showUnassigned = true;       // show nodes not in any project
  let defaultProjectId = null;     // user's configured default project

  let canvas, ctx;
  let width, height;

  // Camera (pan & zoom)
  let camera = { x: 0, y: 0, zoom: 1 };

  // Interaction
  let selectedNode = null;
  let hoveredNode  = null;
  let dragNode     = null;
  let dragOffset   = { x: 0, y: 0 };
  let isPanning    = false;
  let panStart     = { x: 0, y: 0 };
  let camStart     = { x: 0, y: 0 };

  // Simulation
  let simStep = 0;
  let animFrame = null;

  /* ---- Helpers ---- */
  function nodeRadius(n) {
    const c = n.count || 1;
    const maxCount = Math.max(...nodes.map(nd => nd.count || 1), 1);
    return MIN_NODE_RADIUS + (MAX_NODE_RADIUS - MIN_NODE_RADIUS) * (c / maxCount);
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - width / 2) / camera.zoom + camera.x,
      y: (sy - height / 2) / camera.zoom + camera.y
    };
  }

  function worldToScreen(wx, wy) {
    return {
      x: (wx - camera.x) * camera.zoom + width / 2,
      y: (wy - camera.y) * camera.zoom + height / 2
    };
  }

  function nodeAtScreen(sx, sy) {
    const w = screenToWorld(sx, sy);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!visibleTypes.has(n.type) || !isNodeVisibleByProject(n)) continue;
      const r = nodeRadius(n);
      const dx = w.x - n.x;
      const dy = w.y - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  const EDGE_COLORS = {
    'mentioned-with':  'rgba(160,160,176,0.3)',
    'affiliated-with': 'rgba(233,69,96,0.5)',
    'located-in':      'rgba(76,175,80,0.5)',
    'invested-in':     'rgba(255,183,77,0.5)',
    'worked-at':       'rgba(100,181,246,0.5)',
  };

  let graphMode = 'project'; // 'project' or 'global'

  // Sources overlay — cross-reference Sources data with KG entities
  let sourcesOverlayActive = false;
  let sourceMatches = new Map();  // nodeId → [{source, reason}]
  const SOURCE_MATCH_COLOR = '#00e5ff'; // cyan ring for matched nodes
  const SOURCE_TYPE_COLORS = {
    person: '#e94560', organization: '#64b5f6', group: '#ab47bc',
    handle: '#26c6da', journalist: '#ffa726', informant: '#66bb6a',
    target: '#ef5350', adversary: '#f44336', scammer: '#ff5722', asset: '#42a5f5',
    service: '#78909c', webservice: '#7e57c2', device: '#8d6e63',
    academic: '#5c6bc0', medical: '#26a69a', legal: '#8d6e63',
    lead: '#ffca28', alias: '#bdbdbd', entity: '#90a4ae',
  };

  /* ---- Data loading ---- */
  function loadData() {
    const params = new URLSearchParams(window.location.search);
    const storeKey = params.get('id');
    const hasProjectContext = storeKey || params.get('project') || defaultProjectId;
    const mode = params.get('mode') || (hasProjectContext ? 'project' : 'global');
    setMode(mode);

    if (mode === 'global') {
      loadGlobalKG();
    } else if (storeKey && typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(storeKey).then(result => {
        if (result[storeKey]) initGraph(result[storeKey]);
        else initGraph(demoData());
      });
    } else {
      // Fallback: try legacy 'graphData' key or demo
      if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.get('graphData').then(result => {
          if (result.graphData) initGraph(result.graphData);
          else loadGlobalKG(); // Default to global KG if no project data
        });
      } else {
        initGraph(demoData());
      }
    }
  }

  function loadGlobalKG(options) {
    if (typeof browser === 'undefined' || !browser.runtime) {
      initGraph(demoData());
      return;
    }
    browser.runtime.sendMessage({ action: 'getKGGraph', ...(options || {}) }).then(resp => {
      if (resp && resp.nodes && resp.nodes.length) {
        initGraph(transformKGData(resp));
      } else {
        initGraph(demoData());
      }
    }).catch(() => initGraph(demoData()));
  }

  function transformKGData(resp) {
    return {
      projectName: 'Global Knowledge Graph',
      nodes: resp.nodes.map(n => ({
        id: n.id,
        label: n.displayName,
        type: n.type,
        count: n.mentionCount || 1,
        pages: (n.sourcePages || []).map(s => s.url),
        aliases: n.aliases || [],
        firstSeen: n.firstSeen,
        attributes: n.attributes || {},
      })),
      edges: resp.edges.map(e => ({
        source: e.sourceId,
        target: e.targetId,
        weight: e.weight || 1,
        relationType: e.relationType || 'mentioned-with',
        pages: (e.sourcePages || []).map(s => s.url),
        inferred: e.inferred || false,
        confidence: e.confidence,
      }))
    };
  }

  // ── Project overlay ──

  async function loadProjects() {
    if (typeof browser === 'undefined' || !browser.runtime) return;
    try {
      const [resp, defResp] = await Promise.all([
        browser.runtime.sendMessage({ action: 'getProjects' }),
        browser.runtime.sendMessage({ action: 'getDefaultProject' })
      ]);
      if (!resp || !resp.success || !resp.projects) return;
      const defaultId = defResp?.defaultProjectId || null;
      defaultProjectId = defaultId;
      allProjects = resp.projects.map(p => ({
        id: p.id,
        name: p.name + (p.id === defaultId ? ' (default)' : ''),
        color: p.color || '#e94560',
        urls: new Set((p.items || []).map(i => i.url).filter(Boolean))
      }));
      // Check for ?project= param or fall back to default project
      const urlParams = new URLSearchParams(window.location.search);
      const filterProjectId = urlParams.get('project') || defaultId;
      if (filterProjectId && allProjects.some(p => p.id === filterProjectId)) {
        visibleProjects = new Set([filterProjectId]);
        showUnassigned = false;
        projectFilterActive = true;
        // Update header to show project name
        const fp = allProjects.find(p => p.id === filterProjectId);
        if (fp) {
          const nameEl = document.getElementById('projectName');
          if (nameEl) nameEl.textContent = fp.name + ' — Entities';
        }
      } else {
        visibleProjects = new Set(allProjects.map(p => p.id));
      }
      // If graph already loaded, rebuild mapping now
      if (nodes.length) {
        buildNodeProjectMap();
        buildProjectPanel();
      }
    } catch (e) {
      console.warn('[Graph] Failed to load projects:', e);
    }
  }

  function buildNodeProjectMap() {
    nodeProjectMap.clear();
    for (const n of nodes) {
      const nodePages = n.pages || [];
      const projIds = new Set();
      for (const p of allProjects) {
        if (nodePages.some(url => p.urls.has(url))) {
          projIds.add(p.id);
        }
      }
      nodeProjectMap.set(n.id, projIds);
    }
  }

  function isNodeVisibleByProject(n) {
    if (!projectFilterActive) return true;
    const projIds = nodeProjectMap.get(n.id);
    if (!projIds || projIds.size === 0) return showUnassigned;
    for (const pid of projIds) {
      if (visibleProjects.has(pid)) return true;
    }
    return false;
  }

  function buildProjectPanel() {
    const body = document.getElementById('projectPanelBody');
    // Clear existing project toggles (keep the "All" toggle)
    const existing = body.querySelectorAll('.project-toggle:not(:first-child)');
    existing.forEach(el => el.remove());

    // Sync the "All (unassigned)" toggle
    const allToggle = document.getElementById('projToggleAll');
    if (allToggle) allToggle.checked = showUnassigned;

    if (!allProjects.length) return;

    for (const proj of allProjects) {
      // Count how many current nodes belong to this project
      let count = 0;
      for (const n of nodes) {
        const pids = nodeProjectMap.get(n.id);
        if (pids && pids.has(proj.id)) count++;
      }

      const isChecked = visibleProjects.has(proj.id);
      const label = document.createElement('label');
      label.className = 'project-toggle';
      label.innerHTML = `<input type="checkbox" data-project="${proj.id}" ${isChecked ? 'checked' : ''}>` +
        `<span class="project-dot" style="background:${proj.color}"></span>` +
        `<span class="project-toggle-label">${proj.name}</span>` +
        `<span class="project-toggle-count">${count}</span>`;
      body.appendChild(label);

      const cb = label.querySelector('input');
      cb.addEventListener('change', () => {
        if (cb.checked) visibleProjects.add(proj.id);
        else visibleProjects.delete(proj.id);
        updateProjectFilterState();
        simStep = Math.max(0, simStep - 60);
      });
    }

  }

  function updateProjectFilterState() {
    // Project filtering is active if any project is toggled off or unassigned is toggled off
    projectFilterActive = !showUnassigned ||
      visibleProjects.size < allProjects.length;
  }

  function setMode(mode) {
    graphMode = mode;
    const btns = document.querySelectorAll('.mode-btn');
    btns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    // Show/hide KG-specific sidebar details
    document.querySelectorAll('.kg-detail').forEach(el => {
      el.classList.toggle('hidden', mode !== 'global');
    });
  }

  function demoData() {
    return {
      projectName: 'Demo Project',
      nodes: [
        { id: '1', label: 'John Smith',   type: 'person',       count: 5, pages: ['https://example.com/article1', 'https://example.com/article2'] },
        { id: '2', label: 'Acme Corp',    type: 'organization', count: 4, pages: ['https://example.com/article1'] },
        { id: '3', label: 'Jane Doe',     type: 'person',       count: 3, pages: ['https://example.com/article2', 'https://example.com/article3'] },
        { id: '4', label: 'New York',     type: 'location',     count: 6, pages: ['https://example.com/article1', 'https://example.com/article2', 'https://example.com/article3'] },
        { id: '5', label: 'Jan 2025',     type: 'date',         count: 2, pages: ['https://example.com/article1'] },
        { id: '6', label: 'Globex Inc',   type: 'organization', count: 2, pages: ['https://example.com/article3'] },
        { id: '7', label: 'Washington DC',type: 'location',     count: 3, pages: ['https://example.com/article2'] },
        { id: '8', label: 'Bob Lee',      type: 'person',       count: 1, pages: ['https://example.com/article3'] }
      ],
      edges: [
        { source: '1', target: '2', weight: 3, pages: ['https://example.com/article1'] },
        { source: '1', target: '4', weight: 4, pages: ['https://example.com/article1', 'https://example.com/article2'] },
        { source: '1', target: '3', weight: 2, pages: ['https://example.com/article2'] },
        { source: '3', target: '4', weight: 2, pages: ['https://example.com/article2'] },
        { source: '2', target: '5', weight: 1, pages: ['https://example.com/article1'] },
        { source: '3', target: '6', weight: 2, pages: ['https://example.com/article3'] },
        { source: '1', target: '7', weight: 1, pages: ['https://example.com/article2'] },
        { source: '8', target: '6', weight: 1, pages: ['https://example.com/article3'] },
        { source: '4', target: '7', weight: 2, pages: ['https://example.com/article2'] }
      ]
    };
  }

  function initGraph(data) {
    if (data.projectName) {
      document.getElementById('projectName').textContent = data.projectName + ' - Connection Graph';
    }

    const nodeMap = {};
    nodes = (data.nodes || []).map(n => {
      const node = {
        ...n,
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400,
        vx: 0,
        vy: 0
      };
      nodeMap[node.id] = node;
      return node;
    });

    edges = (data.edges || []).map(e => ({
      ...e,
      sourceNode: nodeMap[e.source],
      targetNode: nodeMap[e.target]
    })).filter(e => e.sourceNode && e.targetNode);

    simStep = 0;
    // Project map may need rebuilding (if projects loaded before or after graph data)
    if (allProjects.length) {
      buildNodeProjectMap();
      buildProjectPanel();
    }
    runSimulation();

    // Build comprehensive graph context for AI chat
    buildAndInitChat(data);
  }

  function buildGraphSummary() {
    const byType = {};
    for (const n of nodes) {
      const t = n.type || "entity";
      if (!byType[t]) byType[t] = [];
      byType[t].push(n);
    }
    let nodeSummary = "";
    for (const [type, items] of Object.entries(byType)) {
      items.sort((a, b) => (b.count || 1) - (a.count || 1));
      nodeSummary += `\n### ${type} (${items.length})\n`;
      nodeSummary += items.map(n => `- ${n.label || n.name} (${n.count || 1} mentions)`).join("\n");
    }
    const sortedEdges = [...edges].sort((a, b) => (b.weight || 1) - (a.weight || 1));
    const edgeSummary = sortedEdges.slice(0, 200).map(e =>
      `- ${e.sourceNode?.label || e.source} ↔ ${e.targetNode?.label || e.target} (weight: ${e.weight || 1})`
    ).join("\n");
    return { nodeSummary, edgeSummary };
  }

  function buildSourceContext() {
    if (sourceMatches.size === 0) return "";
    let srcCtx = "\n\n## Matched Sources from User's Source Directory\n";
    srcCtx += "The following entities in the graph match entries in the user's personal sources/contacts database. Use this information to enrich your analysis — note locations, aliases, tags, and relationships the user has recorded:\n";
    for (const [nodeId, matches] of sourceMatches) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;
      for (const m of matches) {
        const s = m.source;
        srcCtx += `\n### ${node.label} → Source: "${s.name}" (type: ${s.type}, match: ${m.reason})`;
        if (s.location) srcCtx += `\n  Location: ${s.location}`;
        if (s.aliases && s.aliases.length) srcCtx += `\n  Aliases: ${s.aliases.join(", ")}`;
        if (s.tags && s.tags.length) srcCtx += `\n  Tags: ${s.tags.join(", ")}`;
        if (s.addresses && s.addresses.length) {
          srcCtx += `\n  Addresses: ${s.addresses.map(a => `${a.type || ""}:${a.value}`).join(", ")}`;
        }
        if (s.notes) srcCtx += `\n  Notes: ${s.notes}`;
      }
    }
    return srcCtx;
  }

  async function buildAndInitChat(data) {
    // Eagerly load sources and match against graph nodes
    try {
      const resp = await browser.runtime.sendMessage({ action: 'getSources' });
      const sources = resp?.sources || [];
      if (sources.length) {
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const sourceNameMap = new Map();
        for (const src of sources) {
          const keys = [norm(src.name), ...(src.aliases || []).map(norm)];
          for (const a of (src.addresses || [])) { if (a.value) keys.push(norm(a.value)); }
          for (const k of keys) { if (k.length > 1) sourceNameMap.set(k, src); }
        }
        const sourceLocationMap = new Map();
        for (const src of sources) {
          if (src.location) {
            const parts = src.location.split(/[,;]+/).map(p => norm(p)).filter(p => p.length > 2);
            for (const p of parts) sourceLocationMap.set(p, src);
            sourceLocationMap.set(norm(src.location), src);
          }
        }
        function addMatchEager(nodeId, source, reason) {
          if (!sourceMatches.has(nodeId)) sourceMatches.set(nodeId, []);
          const arr = sourceMatches.get(nodeId);
          if (!arr.some(m => m.source.id === source.id)) arr.push({ source, reason });
        }
        for (const node of nodes) {
          const nodeNorm = norm(node.label);
          if (sourceNameMap.has(nodeNorm)) {
            const src = sourceNameMap.get(nodeNorm);
            const isAddr = (src.addresses || []).some(a => norm(a.value) === nodeNorm);
            addMatchEager(node.id, src, isAddr ? 'address' : 'name');
          }
          for (const alias of (node.aliases || []).map(norm)) {
            if (sourceNameMap.has(alias)) addMatchEager(node.id, sourceNameMap.get(alias), 'alias');
          }
          for (const src of sources) {
            for (const sa of (src.aliases || [])) { if (norm(sa) === nodeNorm) addMatchEager(node.id, src, 'alias'); }
            for (const a of (src.addresses || [])) { if (norm(a.value) === nodeNorm) addMatchEager(node.id, src, 'address'); }
          }
          if (node.type === 'location') {
            if (sourceLocationMap.has(nodeNorm)) addMatchEager(node.id, sourceLocationMap.get(nodeNorm), 'location');
            for (const [locKey, src] of sourceLocationMap) {
              if (nodeNorm.includes(locKey) || locKey.includes(nodeNorm)) addMatchEager(node.id, src, 'location');
            }
          }
        }
      }
    } catch { /* sources unavailable */ }

    const { nodeSummary, edgeSummary } = buildGraphSummary();
    const srcCtx = buildSourceContext();
    ArgusChat.init({
      container: document.getElementById("argus-chat-container"),
      contextType: "Connection Graph",
      contextData: `Complete entity graph for "${data.projectName || "Unknown"}" — ${nodes.length} entities, ${edges.length} connections.\n\n## All Entities${nodeSummary}\n\n## Top Connections (by weight)\n${edgeSummary}${srcCtx}`,
      pageTitle: data.projectName
    });
  }

  /* ---- Physics ---- */
  function simulate() {
    const visible = nodes.filter(n => visibleTypes.has(n.type) && isNodeVisibleByProject(n));

    // Repulsion (all pairs)
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i];
        const b = visible[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Spring attraction along edges
    for (const e of edges) {
      const a = e.sourceNode;
      const b = e.targetNode;
      if (!visibleTypes.has(a.type) || !visibleTypes.has(b.type)) continue;
      if (!isNodeVisibleByProject(a) || !isNodeVisibleByProject(b)) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - SPRING_LENGTH;
      const force = SPRING_K * displacement;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity
    for (const n of visible) {
      n.vx -= n.x * CENTER_GRAVITY;
      n.vy -= n.y * CENTER_GRAVITY;
    }

    // Apply velocity with damping
    for (const n of visible) {
      if (n === dragNode) {
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      // Clamp
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > VELOCITY_LIMIT) {
        n.vx = (n.vx / speed) * VELOCITY_LIMIT;
        n.vy = (n.vy / speed) * VELOCITY_LIMIT;
      }
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  /* ---- Rendering ---- */
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Camera transform
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Edges
    for (const e of edges) {
      const a = e.sourceNode;
      const b = e.targetNode;
      if (!visibleTypes.has(a.type) || !visibleTypes.has(b.type)) continue;
      if (!isNodeVisibleByProject(a) || !isNodeVisibleByProject(b)) continue;

      const isHighlighted = selectedNode && (a === selectedNode || b === selectedNode);
      const lineWidth = Math.max(1, (e.weight || 1) * 1.2);
      const edgeColor = EDGE_COLORS[e.relationType] || 'rgba(160,160,176,0.2)';

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHighlighted ? 'rgba(233,69,96,0.7)' : edgeColor;
      ctx.lineWidth = isHighlighted ? lineWidth + 1 : lineWidth;
      if (e.inferred) ctx.setLineDash([4, 4]);
      ctx.stroke();
      if (e.inferred) ctx.setLineDash([]);
    }

    // Nodes (draw selected last so its label is always on top)
    const sortedNodes = nodes.filter(n => visibleTypes.has(n.type) && isNodeVisibleByProject(n));
    if (selectedNode) {
      const idx = sortedNodes.indexOf(selectedNode);
      if (idx > -1) {
        sortedNodes.splice(idx, 1);
        sortedNodes.push(selectedNode);
      }
    }

    for (const n of sortedNodes) {
      const r = nodeRadius(n);
      const color = TYPE_COLORS[n.type] || TYPE_COLORS.other;
      const isSelected = n === selectedNode;
      const isHovered = n === hoveredNode;
      const isConnected = selectedNode && edges.some(e =>
        (e.sourceNode === selectedNode && e.targetNode === n) ||
        (e.targetNode === selectedNode && e.sourceNode === n)
      );
      const dimmed = selectedNode && !isSelected && !isConnected;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = dimmed ? color + '44' : color;
      ctx.fill();

      // Source match outer ring (drawn before selection ring so it's behind)
      if (sourcesOverlayActive && sourceMatches.has(n.id)) {
        ctx.strokeStyle = SOURCE_MATCH_COLOR;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Second arc for glow effect
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = SOURCE_MATCH_COLOR + '55';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Label — selected/hovered get a background pill for readability
      if (isSelected || isHovered) {
        const labelFont = isSelected ? 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif' : LABEL_FONT;
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelY = n.y + r + 5;
        const textWidth = ctx.measureText(n.label).width;
        const pad = 4;
        ctx.fillStyle = 'rgba(20, 20, 30, 0.85)';
        ctx.beginPath();
        ctx.roundRect(n.x - textWidth / 2 - pad, labelY - 2, textWidth + pad * 2, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(n.label, n.x, labelY);
      } else {
        ctx.font = LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = dimmed ? 'rgba(232,232,232,0.25)' : 'rgba(232,232,232,0.9)';
        ctx.fillText(n.label, n.x, n.y + r + 4);
      }
    }

    ctx.restore();
  }

  function runSimulation() {
    function tick() {
      if (simStep < SIM_STEPS || dragNode) {
        simulate();
        simStep++;
      }
      draw();
      animFrame = requestAnimationFrame(tick);
    }
    if (animFrame) cancelAnimationFrame(animFrame);
    tick();
  }

  /* ---- Sidebar ---- */
  let sidebarCollapsed = false; // when true, clicking nodes won't auto-open sidebar

  function showSidebar(node) {
    if (sidebarCollapsed) return; // user collapsed it, don't auto-open
    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebarTitle').textContent = node.label;
    document.getElementById('detailType').textContent = node.type.charAt(0).toUpperCase() + node.type.slice(1);
    document.getElementById('detailCount').textContent = node.count || 0;

    const connectedEdges = edges.filter(e => e.sourceNode === node || e.targetNode === node);
    document.getElementById('detailConnections').textContent = connectedEdges.length;

    // KG-specific details
    if (graphMode === 'global') {
      if (node.aliases && node.aliases.length > 1) {
        document.getElementById('detailAliases').textContent = node.aliases.join(', ');
        document.getElementById('detailAliasesRow').classList.remove('hidden');
      } else {
        document.getElementById('detailAliasesRow').classList.add('hidden');
      }
      if (node.firstSeen) {
        document.getElementById('detailFirstSeen').textContent = new Date(node.firstSeen).toLocaleDateString();
        document.getElementById('detailFirstSeenRow').classList.remove('hidden');
      }
    }

    // Pages
    const pageList = document.getElementById('detailPages');
    pageList.innerHTML = '';
    (node.pages || []).forEach(p => {
      const li = document.createElement('li');
      li.textContent = p;
      li.title = p;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        if (typeof browser !== 'undefined' && browser.tabs) {
          browser.tabs.create({ url: p });
        } else if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.create({ url: p });
        } else {
          window.open(p, '_blank');
        }
      });
      pageList.appendChild(li);
    });

    // Connected entities
    const edgeList = document.getElementById('detailEdges');
    edgeList.innerHTML = '';
    connectedEdges.forEach(e => {
      const other = e.sourceNode === node ? e.targetNode : e.sourceNode;
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = other.label;
      const weightSpan = document.createElement('span');
      weightSpan.className = 'edge-weight';
      const relLabel = e.relationType && e.relationType !== 'mentioned-with' ? e.relationType + ' ' : '';
      weightSpan.textContent = relLabel + 'w:' + (e.weight || 1);
      li.appendChild(nameSpan);
      li.appendChild(weightSpan);
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        selectedNode = other;
        showSidebar(other);
      });
      edgeList.appendChild(li);
    });

    // Source match info — show all matched sources as vcards
    const srcSection = document.getElementById('detailSourceSection');
    const srcInfo = document.getElementById('detailSourceInfo');
    if (sourcesOverlayActive && sourceMatches.has(node.id)) {
      const matches = sourceMatches.get(node.id);
      srcSection.classList.remove('hidden');
      const heading = srcSection.querySelector('h3');
      if (heading) heading.textContent = matches.length === 1 ? 'Matched Source' : `Matched Sources (${matches.length})`;

      let html = '';
      matches.forEach((m, idx) => {
        const src = m.source;
        const reason = m.reason;
        const reasonLabels = { name: 'Name match', alias: 'Alias match', address: 'Address match', location: 'Location match' };
        const tColor = SOURCE_TYPE_COLORS[src.type] || SOURCE_TYPE_COLORS.entity;
        html += `<div class="src-vcard${matches.length > 1 && idx < matches.length - 1 ? ' src-vcard-border' : ''}" style="border-left:3px solid ${tColor};padding-left:8px;">`;
        html += `<div class="src-vcard-header">`;
        html += `<div class="src-match-name" style="color:${tColor};">${escHtml(src.name)}</div>`;
        html += `<span class="src-match-reason">${reasonLabels[reason] || reason}</span>`;
        html += `</div>`;
        if (src.type) html += `<div class="src-match-type" style="color:${tColor};">${escHtml(src.type)}</div>`;
        if (src.location) html += `<div class="src-match-loc">${escHtml(src.location)}</div>`;
        if (src.aliases?.length) html += `<div class="src-match-aliases">aka ${escHtml(src.aliases.join(', '))}</div>`;
        if (src.addresses?.length) {
          html += '<div class="src-match-addrs">';
          for (const a of src.addresses) {
            const typeLabel = a.type ? a.type.toUpperCase() : '';
            const isUrl = /^https?:\/\//.test(a.value);
            if (isUrl) {
              html += `<a class="src-match-chip src-match-chip-link" href="${escHtml(a.value)}" target="_blank" rel="noopener" title="${escHtml(a.value)}">`;
            } else {
              html += `<span class="src-match-chip" title="${escHtml(a.value)}">`;
            }
            if (typeLabel) html += `<span class="src-chip-type">${escHtml(typeLabel)}</span>`;
            html += escHtml(a.label || a.value);
            html += isUrl ? '</a>' : '</span>';
          }
          html += '</div>';
        }
        if (src.tags?.length) {
          html += '<div class="src-match-tags">';
          for (const t of src.tags) html += `<span class="src-match-tag">${escHtml(t)}</span>`;
          html += '</div>';
        }
        if (src.notes) html += `<div class="src-match-notes">${escHtml(src.notes)}</div>`;
        html += `<button class="src-match-open" data-src-id="${escHtml(src.id)}">Open in Sources</button>`;
        html += '</div>';
      });
      srcInfo.innerHTML = html;
      srcInfo.querySelectorAll('.src-match-open').forEach(btn => {
        btn.addEventListener('click', () => {
          const srcId = btn.dataset.srcId;
          const base = browser.runtime.getURL('options/options.html');
          window.location.href = srcId ? `${base}?highlight=${encodeURIComponent(srcId)}#sources` : `${base}#sources`;
        });
      });
    } else {
      srcSection.classList.add('hidden');
    }

    sidebar.classList.add('open');
  }

  function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function hideSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    sidebarCollapsed = true;
    selectedNode = null;
    PanelState.save("graph", "details", { visible: false });
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) {
      hideSidebar();
    } else {
      sidebarCollapsed = false;
      if (selectedNode) {
        showSidebar(selectedNode);
      }
    }
  }

  /* ---- Event handlers ---- */
  function setupEvents() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);

    document.getElementById('sidebarClose').addEventListener('click', hideSidebar);
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open')) hideSidebar();
      }
    });
    document.getElementById('zoomIn').addEventListener('click', () => zoomBy(1.25));
    document.getElementById('zoomOut').addEventListener('click', () => zoomBy(0.8));
    document.getElementById('zoomReset').addEventListener('click', () => {
      camera = { x: 0, y: 0, zoom: 1 };
    });
    document.getElementById('exportPng').addEventListener('click', exportPng);
    document.getElementById('overlaySourcesBtn').addEventListener('click', toggleSourcesOverlay);

    // Filter checkboxes
    document.querySelectorAll('.filter-checkbox input').forEach(cb => {
      cb.addEventListener('change', () => {
        const type = cb.dataset.type;
        if (cb.checked) visibleTypes.add(type);
        else visibleTypes.delete(type);
        // Restart sim briefly so layout adjusts
        simStep = Math.max(0, simStep - 60);
      });
    });

    // Project panel: tab toggles visibility, panel header is draggable
    const projTab = document.getElementById('projectPanelToggle');
    const projPanel = document.getElementById('projectPanel');

    projTab.addEventListener('click', () => {
      const isOpen = !projPanel.classList.contains('hidden');
      projPanel.classList.toggle('hidden', isOpen);
      PanelState.save("graph", "projects", { visible: !isOpen });
    });
    document.getElementById('projectPanelClose').addEventListener('click', () => {
      projPanel.classList.add('hidden');
      PanelState.save("graph", "projects", { visible: false });
    });

    // Drag project panel by header
    (function setupProjPanelDrag() {
      const header = projPanel.querySelector('.project-panel-header');
      let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.project-panel-close')) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = projPanel.getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;
        projPanel.classList.add('dragging');
        projPanel.style.zIndex = 25;
        projPanel.style.right = 'auto';
        projPanel.style.left = origLeft + 'px';
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.max(0, Math.min(window.innerWidth - 60, origLeft + dx));
        const newTop = Math.max(46, Math.min(window.innerHeight - 60, origTop + dy));
        projPanel.style.left = newLeft + 'px';
        projPanel.style.top = newTop + 'px';
      });
      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        projPanel.classList.remove('dragging');
        projPanel.style.zIndex = '';
        const rect = projPanel.getBoundingClientRect();
        PanelState.save("graph", "projects", { left: rect.left, top: rect.top });
      });
    })();

    // Drag sidebar by header
    (function setupSidebarDrag() {
      const sidebarEl = document.getElementById('sidebar');
      const header = sidebarEl.querySelector('.sidebar-header');
      let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.sidebar-close')) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = sidebarEl.getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;
        sidebarEl.classList.add('dragging');
        sidebarEl.style.zIndex = 25;
        sidebarEl.style.right = 'auto';
        sidebarEl.style.left = origLeft + 'px';
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.max(0, Math.min(window.innerWidth - 60, origLeft + dx));
        const newTop = Math.max(46, Math.min(window.innerHeight - 60, origTop + dy));
        sidebarEl.style.left = newLeft + 'px';
        sidebarEl.style.top = newTop + 'px';
      });
      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        sidebarEl.classList.remove('dragging');
        sidebarEl.style.zIndex = '';
        const rect = sidebarEl.getBoundingClientRect();
        PanelState.save("graph", "details", { left: rect.left, top: rect.top });
      });
    })();

    // Restore saved panel positions
    PanelState.apply(projPanel, "graph", "projects");
    PanelState.apply(document.getElementById('sidebar'), "graph", "details", { skipVisibility: true });

    // Restore sidebarCollapsed from saved state
    PanelState.load("graph", "details").then(state => {
      if (state && state.visible === false) sidebarCollapsed = true;
    });
    document.getElementById('projToggleAll').addEventListener('change', (e) => {
      showUnassigned = e.target.checked;
      updateProjectFilterState();
      simStep = Math.max(0, simStep - 60);
    });

    // Mode toggle (project vs global KG)
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setMode(mode);
        if (mode === 'global') {
          // Reset project filter to show everything
          visibleProjects = new Set(allProjects.map(p => p.id));
          showUnassigned = true;
          projectFilterActive = false;
          buildProjectPanel();
          const nameEl = document.getElementById('projectName');
          if (nameEl) nameEl.textContent = 'Global Knowledge Graph';
          loadGlobalKG();
        } else {
          // Switch to project-scoped view
          const params = new URLSearchParams(window.location.search);
          const storeKey = params.get('id');
          const filterProjId = params.get('project') || defaultProjectId;
          if (filterProjId && allProjects.some(p => p.id === filterProjId)) {
            // Apply project filter from URL param or default project
            visibleProjects = new Set([filterProjId]);
            showUnassigned = false;
            projectFilterActive = true;
            const fp = allProjects.find(p => p.id === filterProjId);
            // Load global KG data but with project filter active
            browser.runtime.sendMessage({ action: 'getKGGraph' }).then(resp => {
              if (resp && resp.nodes && resp.nodes.length) {
                initGraph(transformKGData(resp));
              } else {
                initGraph(demoData());
              }
              // Override name after initGraph sets it
              const nameEl = document.getElementById('projectName');
              if (nameEl) nameEl.textContent = (fp ? fp.name : '') + ' — Entities';
              buildProjectPanel();
            }).catch(() => {});
          } else if (storeKey && typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get(storeKey).then(result => {
              if (result[storeKey]) initGraph(result[storeKey]);
              else initGraph(demoData());
            });
          } else {
            // No specific project — show global with all projects visible
            const nameEl = document.getElementById('projectName');
            if (nameEl) nameEl.textContent = 'Connection Graph';
            loadGlobalKG();
          }
        }
      });
    });

    // Search
    const searchInput = document.getElementById('graphSearch');
    let searchTimeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) { selectedNode = null; hideSidebar(); return; }
        const match = nodes.find(n =>
          n.label.toLowerCase().includes(q) ||
          (n.aliases || []).some(a => a.toLowerCase().includes(q))
        );
        if (match) {
          selectedNode = match;
          showSidebar(match);
          // Center camera on the matched node
          camera.x = match.x;
          camera.y = match.y;
        }
      }, 300);
    });

    window.addEventListener('resize', resizeCanvas);
  }

  function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = nodeAtScreen(sx, sy);

    if (hit) {
      dragNode = hit;
      const w = screenToWorld(sx, sy);
      dragOffset.x = hit.x - w.x;
      dragOffset.y = hit.y - w.y;
      selectedNode = hit;
      showSidebar(hit);
      // Restart sim briefly for nice dragging
      simStep = Math.max(0, simStep - 60);
    } else {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      camStart = { x: camera.x, y: camera.y };
    }
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (dragNode) {
      const w = screenToWorld(sx, sy);
      dragNode.x = w.x + dragOffset.x;
      dragNode.y = w.y + dragOffset.y;
      dragNode.vx = 0;
      dragNode.vy = 0;
    } else if (isPanning) {
      const dx = (e.clientX - panStart.x) / camera.zoom;
      const dy = (e.clientY - panStart.y) / camera.zoom;
      camera.x = camStart.x - dx;
      camera.y = camStart.y - dy;
    } else {
      const prev = hoveredNode;
      hoveredNode = nodeAtScreen(sx, sy);
      if (hoveredNode !== prev) {
        canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
      }
    }
  }

  function onMouseUp() {
    dragNode = null;
    isPanning = false;
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomBy(factor);
  }

  function onDblClick(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = nodeAtScreen(sx, sy);
    if (!hit) {
      hideSidebar();
    }
  }

  function zoomBy(factor) {
    camera.zoom = Math.max(0.1, Math.min(5, camera.zoom * factor));
  }

  function exportPng() {
    const link = document.createElement('a');
    link.download = 'connection-graph.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /* ---- Sources cross-reference overlay ---- */
  async function toggleSourcesOverlay() {
    const btn = document.getElementById('overlaySourcesBtn');
    if (sourcesOverlayActive) {
      // Turn off
      sourcesOverlayActive = false;
      sourceMatches.clear();
      btn.classList.remove('active');
      btn.title = 'Cross-reference Sources with KG entities';
      return;
    }

    // Fetch sources
    let sources = [];
    try {
      const resp = await browser.runtime.sendMessage({ action: 'getSources' });
      sources = resp?.sources || [];
    } catch { /* no sources */ }

    if (!sources.length) {
      btn.title = 'No sources found — add some on the Sources tab';
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 800);
      return;
    }

    // Build lookup structures from sources
    sourceMatches.clear();

    // Normalize for matching
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Build sets of source names, aliases, and address values for fast lookup
    const sourceNameMap = new Map(); // normalized name/alias → source
    for (const src of sources) {
      const keys = [norm(src.name), ...(src.aliases || []).map(norm)];
      // Also include address handles as potential name matches
      for (const a of (src.addresses || [])) {
        if (a.value) keys.push(norm(a.value));
      }
      for (const k of keys) {
        if (k.length > 1) sourceNameMap.set(k, src);
      }
    }

    // Build location lookup
    const sourceLocationMap = new Map(); // normalized location → source
    for (const src of sources) {
      if (src.location) {
        // Split location into parts for partial matching (e.g. "Washington" matches "Washington, DC, US")
        const parts = src.location.split(/[,;]+/).map(p => norm(p)).filter(p => p.length > 2);
        for (const p of parts) sourceLocationMap.set(p, src);
        sourceLocationMap.set(norm(src.location), src);
      }
    }

    // Helper: add a match entry (supports multiple sources per node)
    function addMatch(nodeId, source, reason) {
      if (!sourceMatches.has(nodeId)) sourceMatches.set(nodeId, []);
      const arr = sourceMatches.get(nodeId);
      // Avoid duplicate source entries for the same node
      if (!arr.some(m => m.source.id === source.id)) {
        arr.push({ source, reason });
      }
    }

    // Match against KG nodes
    for (const node of nodes) {
      const nodeNorm = norm(node.label);
      const nodeAliases = (node.aliases || []).map(norm);

      // 1. Name match
      if (sourceNameMap.has(nodeNorm)) {
        const src = sourceNameMap.get(nodeNorm);
        const isAddr = (src.addresses || []).some(a => norm(a.value) === nodeNorm);
        addMatch(node.id, src, isAddr ? 'address' : 'name');
      }

      // 2. Node alias matches
      for (const alias of nodeAliases) {
        if (sourceNameMap.has(alias)) {
          addMatch(node.id, sourceNameMap.get(alias), 'alias');
        }
      }

      // 3. Check all sources for additional name/alias matches against this node
      for (const src of sources) {
        // Source aliases matching node label
        for (const sa of (src.aliases || [])) {
          if (norm(sa) === nodeNorm) addMatch(node.id, src, 'alias');
        }
        // Source addresses matching node label
        for (const a of (src.addresses || [])) {
          if (norm(a.value) === nodeNorm) addMatch(node.id, src, 'address');
        }
      }

      // 4. Location match (only for location-type nodes)
      if (node.type === 'location') {
        if (sourceLocationMap.has(nodeNorm)) {
          addMatch(node.id, sourceLocationMap.get(nodeNorm), 'location');
        }
        for (const [locKey, src] of sourceLocationMap) {
          if (nodeNorm.includes(locKey) || locKey.includes(nodeNorm)) {
            addMatch(node.id, src, 'location');
          }
        }
      }
    }

    sourcesOverlayActive = true;
    btn.classList.add('active');
    // Count unique sources matched
    const uniqueSources = new Set();
    for (const matches of sourceMatches.values()) {
      for (const m of matches) uniqueSources.add(m.source.id);
    }
    btn.title = `${sourceMatches.size} node${sourceMatches.size !== 1 ? 's' : ''} matched across ${uniqueSources.size} source${uniqueSources.size !== 1 ? 's' : ''} — click to turn off`;

    // Re-init chat with enriched source context
    if (sourceMatches.size > 0) {
      const { nodeSummary, edgeSummary } = buildGraphSummary();
      const srcCtx = buildSourceContext();
      ArgusChat.init({
        container: document.getElementById("argus-chat-container"),
        contextType: "Connection Graph",
        contextData: `Complete entity graph for "${data.projectName || "Unknown"}" — ${nodes.length} entities, ${edges.length} connections.\n\n## All Entities${nodeSummary}\n\n## Top Connections (by weight)\n${edgeSummary}${srcCtx}`,
        pageTitle: data.projectName
      });
    }

    // Update sidebar if a matched node is currently selected
    if (selectedNode && sourceMatches.has(selectedNode.id)) {
      showSidebar(selectedNode);
    }
  }

  /* ---- Canvas setup ---- */
  function resizeCanvas() {
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    width = container.clientWidth * dpr;
    height = container.clientHeight * dpr;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Recalculate effective dimensions for coordinate mapping
    width = container.clientWidth;
    height = container.clientHeight;
  }

  /* ---- Asset Library for KG page ---- */
  (function initAssetLibrary() {
    const panel = document.getElementById("kgAssetsPanel");
    const toggle = document.getElementById("kgAssetsToggle");
    const closeBtn = document.getElementById("kgAssetsClose");
    const search = document.getElementById("kgAssetSearch");
    const list = document.getElementById("kgAssetsList");
    const countEl = document.getElementById("kgAssetCount");
    const tabs = document.querySelectorAll(".kg-asset-tab");
    if (!panel || !toggle) return;

    let allAssets = { analyses: [], bookmarks: [], monitors: [], feeds: [], techstack: [], snapshots: [], timeline: [] };
    let activeTab = "analyses";
    let loaded = false;

    toggle.addEventListener("click", () => {
      const open = !panel.classList.contains("hidden");
      panel.classList.toggle("hidden", open);
      if (!loaded) { loaded = true; loadAssets(); }
    });
    closeBtn.addEventListener("click", () => panel.classList.add("hidden"));

    tabs.forEach(t => {
      t.addEventListener("click", () => {
        tabs.forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        activeTab = t.dataset.tab;
        renderAssets();
      });
    });
    search.addEventListener("input", () => renderAssets());

    function getProjectUrls() {
      // Get URLs from the active project(s) — only assets matching these URLs are shown
      if (!projectFilterActive) return null; // global mode = no assets
      const urls = new Set();
      for (const pid of visibleProjects) {
        const proj = allProjects.find(p => p.id === pid);
        if (proj) for (const u of proj.urls) urls.add(u);
      }
      return urls;
    }

    async function loadAssets() {
      const projUrls = getProjectUrls();
      if (!projUrls) {
        // Global mode — no assets
        for (const k of Object.keys(allAssets)) allAssets[k] = [];
        countEl.textContent = "";
        renderAssets();
        return;
      }

      try {
        const [histResp, bkResp, monResp, feedResp, trackerResp] = await Promise.all([
          browser.runtime.sendMessage({ action: "getHistory", page: 0, perPage: 100 }),
          browser.runtime.sendMessage({ action: "getBookmarks" }),
          browser.runtime.sendMessage({ action: "getMonitors" }).catch(() => null),
          browser.runtime.sendMessage({ action: "getFeeds" }).catch(() => null),
          browser.runtime.sendMessage({ action: "getTrackerPages" }).catch(() => null)
        ]);

        // Analyses — filtered to project URLs
        if (histResp?.history) {
          allAssets.analyses = histResp.history.filter(h => h.pageUrl && projUrls.has(h.pageUrl)).map(h => {
            let text = h.content || "";
            text = text.replace(/```(?:json|argus[_-]?structured)?\s*\n?\{[\s\S]*?\}\s*\n?```/gi, "").trim();
            return { id: h.id, title: h.presetLabel || h.title || h.pageUrl || "Analysis", preview: text.slice(0, 150), content: text, url: h.pageUrl, date: h.timestamp };
          });
        }

        // Bookmarks — filtered to project URLs
        if (bkResp?.bookmarks) {
          const projBk = bkResp.bookmarks.filter(b => b.url && projUrls.has(b.url));
          allAssets.bookmarks = projBk.map(b => ({
            id: b.id, title: b.title || b.url, preview: b.url,
            content: `[${b.title || b.url}](${b.url})${b.tldr ? "\n" + b.tldr : b.summary ? "\n" + b.summary : ""}`,
            url: b.url, date: b.savedAt
          }));

          // TechStack — from project bookmarks only
          allAssets.techstack = projBk.filter(b => b.techStack && Object.keys(b.techStack).length).map(b => {
            const ts = b.techStack, techs = [];
            if (ts.generator) techs.push("Generator: " + ts.generator);
            if (ts.server) techs.push("Server: " + ts.server);
            if (ts.poweredBy) techs.push("Powered By: " + ts.poweredBy);
            if (ts.frameworks?.length) techs.push("Frameworks: " + ts.frameworks.join(", "));
            if (ts.cdn?.length) techs.push("CDN: " + ts.cdn.join(", "));
            if (ts.analytics?.length) techs.push("Analytics: " + ts.analytics.join(", "));
            return { id: b.id + "-tech", title: b.title || b.url, preview: techs.slice(0, 2).join(" · "), content: "## TechStack: " + (b.title || b.url) + "\n" + techs.join("\n"), url: b.url, date: b.savedAt };
          });
        }

        // Monitors + Snapshots — filtered to project URLs
        if (monResp?.monitors?.length) {
          const projMon = monResp.monitors.filter(m => m.url && projUrls.has(m.url)).slice(0, 30);
          if (projMon.length) {
            const [changesArr, snapArr] = await Promise.all([
              Promise.all(projMon.map(m =>
                browser.runtime.sendMessage({ action: "getMonitorHistory", monitorId: m.id }).then(r => ({ m, changes: r?.history || [] })).catch(() => ({ m, changes: [] }))
              )),
              Promise.all(projMon.map(m =>
                browser.runtime.sendMessage({ action: "getMonitorSnapshots", monitorId: m.id }).then(r => ({ m, snaps: r?.snapshots || [] })).catch(() => ({ m, snaps: [] }))
              ))
            ]);
            allAssets.monitors = [];
            for (const { m, changes } of changesArr) {
              allAssets.monitors.push({ id: m.id, title: m.title || m.url, preview: (m.changeCount || 0) + " changes", content: "## Monitor: " + (m.title || m.url) + "\n" + m.url + "\nChanges: " + (m.changeCount || 0), url: m.url, date: m.lastChecked });
              for (const c of changes.slice(0, 10)) {
                const body = c.aiSummary || c.newTextSnippet || "";
                allAssets.monitors.push({ id: c.id, title: "Change: " + (m.title || m.url), preview: body.slice(0, 100), content: "## Change: " + (m.title || m.url) + "\n" + (c.detectedAt || "") + "\n\n" + body, url: m.url, date: c.detectedAt });
              }
            }
            allAssets.snapshots = [];
            for (const { m, snaps } of snapArr) {
              for (const s of snaps) {
                allAssets.snapshots.push({ id: s.id, title: (m.title || m.url) + (s.isInitial ? " (initial)" : ""), preview: new Date(s.capturedAt).toLocaleString() + " · " + (s.text || "").length + " chars", content: "## Snapshot: " + (m.title || m.url) + "\n" + s.capturedAt + "\n\n" + (s.text || "").slice(0, 3000), url: m.url, date: s.capturedAt });
              }
            }
          } else {
            allAssets.monitors = [];
            allAssets.snapshots = [];
          }
        }

        // Feeds — filtered to project URLs
        if (feedResp?.feeds?.length) {
          const projFeeds = feedResp.feeds.filter(f => f.url && projUrls.has(f.url)).slice(0, 20);
          if (projFeeds.length) {
            const entryArr = await Promise.all(projFeeds.map(f =>
              browser.runtime.sendMessage({ action: "getFeedEntries", feedId: f.id, limit: 30 }).then(r => ({ f, entries: r?.entries || [] })).catch(() => ({ f, entries: [] }))
            ));
            allAssets.feeds = [];
            for (const { f, entries } of entryArr) {
              for (const e of entries) {
                const body = e.content || e.description || "";
                allAssets.feeds.push({ id: e.id, title: e.title || "Feed Entry", preview: (f.title || f.url) + " · " + body.slice(0, 80), content: "## " + (e.title || "Feed Entry") + "\nSource: " + (f.title || f.url) + "\n" + (e.link || "") + "\n\n" + body, url: e.link || f.url, date: e.pubDate });
              }
            }
          } else {
            allAssets.feeds = [];
          }
        }

        // Timeline — filtered to project URLs
        if (trackerResp?.pages?.length) {
          allAssets.timeline = trackerResp.pages.filter(p => p.url && projUrls.has(p.url)).map(p => {
            const actions = [...new Set((p.actions || []).map(a => a.type).filter(Boolean))];
            return { id: p.id, title: p.title || p.url, preview: (p.visits || 1) + " visits · " + (actions.join(", ") || "visited"), content: "## " + (p.title || p.url) + "\n" + p.url + "\nVisits: " + (p.visits || 1) + "\nActions: " + (actions.join(", ") || "none"), url: p.url, date: p.lastVisit };
          });
        }

        const total = Object.values(allAssets).reduce((s, a) => s + a.length, 0);
        countEl.textContent = total || "";
      } catch (e) { console.warn("[KG Assets]", e); }
      renderAssets();
    }

    function renderAssets() {
      list.replaceChildren();

      // No project selected — show message
      if (!projectFilterActive) {
        const empty = document.createElement("div");
        empty.className = "kg-assets-empty";
        empty.textContent = "Select a project to view assets.";
        list.appendChild(empty);
        return;
      }

      let items = allAssets[activeTab] || [];
      const q = (search.value || "").toLowerCase().trim();
      if (q) items = items.filter(a => (a.title || "").toLowerCase().includes(q) || (a.preview || "").toLowerCase().includes(q));

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "kg-assets-empty";
        empty.textContent = q ? "No matching assets." : "No " + activeTab + " for this project.";
        list.appendChild(empty);
        return;
      }

      for (const asset of items) {
        const row = document.createElement("div");
        row.className = "kg-asset-item";

        const info = document.createElement("div");
        info.className = "kg-asset-info";
        const title = document.createElement("div");
        title.className = "kg-asset-title";
        title.textContent = asset.title;
        const prev = document.createElement("div");
        prev.className = "kg-asset-preview";
        prev.textContent = asset.preview || "";
        info.appendChild(title);
        info.appendChild(prev);
        if (asset.date) {
          const meta = document.createElement("div");
          meta.className = "kg-asset-meta";
          meta.textContent = new Date(asset.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          info.appendChild(meta);
        }

        const insertBtn = document.createElement("button");
        insertBtn.className = "kg-asset-insert";
        insertBtn.textContent = "Insert";
        insertBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          // Paste into AI chat input if available
          const chatInput = document.querySelector(".argus-chat-input");
          if (chatInput) {
            const before = chatInput.value;
            chatInput.value = before + (before ? "\n\n" : "") + asset.content;
            chatInput.focus();
            insertBtn.textContent = "Added";
            setTimeout(() => { insertBtn.textContent = "Insert"; }, 1200);
          }
        });

        // Click row to copy
        row.addEventListener("click", () => {
          navigator.clipboard.writeText(asset.content);
          title.textContent = "Copied!";
          setTimeout(() => { title.textContent = asset.title; }, 1200);
        });

        row.appendChild(info);
        row.appendChild(insertBtn);
        list.appendChild(row);
      }
    }
  })();

  /* ---- Init ---- */
  async function init() {
    canvas = document.getElementById('graphCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    setupEvents();
    await loadProjects(); // fetch projects + default before loading data
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
