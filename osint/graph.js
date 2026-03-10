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
      if (!visibleTypes.has(n.type)) continue;
      const r = nodeRadius(n);
      const dx = w.x - n.x;
      const dy = w.y - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  /* ---- Data loading ---- */
  function loadData() {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get('graphData').then(result => {
        if (result.graphData) initGraph(result.graphData);
        else initGraph(demoData());
      });
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('graphData', result => {
        if (result.graphData) initGraph(result.graphData);
        else initGraph(demoData());
      });
    } else {
      initGraph(demoData());
    }
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
    runSimulation();
  }

  /* ---- Physics ---- */
  function simulate() {
    const visible = nodes.filter(n => visibleTypes.has(n.type));

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

      const isHighlighted = selectedNode && (a === selectedNode || b === selectedNode);
      const lineWidth = Math.max(1, (e.weight || 1) * 1.2);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHighlighted ? 'rgba(233,69,96,0.7)' : 'rgba(160,160,176,0.2)';
      ctx.lineWidth = isHighlighted ? lineWidth + 1 : lineWidth;
      ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      if (!visibleTypes.has(n.type)) continue;

      const r = nodeRadius(n);
      const color = TYPE_COLORS[n.type] || TYPE_COLORS.other;
      const isSelected = n === selectedNode;
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
      } else if (n === hoveredNode) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Label
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = dimmed ? 'rgba(232,232,232,0.25)' : 'rgba(232,232,232,0.9)';
      ctx.fillText(n.label, n.x, n.y + r + 4);
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
  function showSidebar(node) {
    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebarTitle').textContent = node.label;
    document.getElementById('detailType').textContent = node.type.charAt(0).toUpperCase() + node.type.slice(1);
    document.getElementById('detailCount').textContent = node.count || 0;

    const connectedEdges = edges.filter(e => e.sourceNode === node || e.targetNode === node);
    document.getElementById('detailConnections').textContent = connectedEdges.length;

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
      weightSpan.textContent = 'w:' + (e.weight || 1);
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
    selectedNode = null;
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
  function init() {
    canvas = document.getElementById('graphCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    setupEvents();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
