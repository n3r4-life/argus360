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
    // Group nodes by type for structured context
    const byType = {};
    for (const n of nodes) {
      const t = n.type || "entity";
      if (!byType[t]) byType[t] = [];
      byType[t].push(n);
    }
    let nodeSummary = "";
    for (const [type, items] of Object.entries(byType)) {
      // Sort by mention count descending within each type
      items.sort((a, b) => (b.count || 1) - (a.count || 1));
      nodeSummary += `\n### ${type} (${items.length})\n`;
      nodeSummary += items.map(n =>
        `- ${n.label || n.name} (${n.count || 1} mentions)`
      ).join("\n");
    }
    // Include top connections sorted by weight
    const sortedEdges = [...edges].sort((a, b) => (b.weight || 1) - (a.weight || 1));
    const edgeSummary = sortedEdges.slice(0, 200).map(e =>
      `- ${e.sourceNode?.label || e.source} ↔ ${e.targetNode?.label || e.target} (weight: ${e.weight || 1})`
    ).join("\n");
    ArgusChat.init({
      container: document.getElementById("argus-chat-container"),
      contextType: "Connection Graph",
      contextData: `Complete entity graph for "${data.projectName || "Unknown"}" — ${nodes.length} entities, ${edges.length} connections.\n\n## All Entities${nodeSummary}\n\n## Top Connections (by weight)\n${edgeSummary}`,
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

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered) {
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

    sidebar.classList.add('open');
  }

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
