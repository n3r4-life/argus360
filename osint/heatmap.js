(function () {
  'use strict';

  /* ── Constants ── */
  const TYPE_COLORS = {
    person:       '#e94560',
    organization: '#64b5f6',
    location:     '#4caf50',
    date:         '#ffb74d',
    amount:       '#ce93d8',
    other:        '#a0a0b0'
  };

  const CELL_SIZE      = 38;
  const CELL_PAD       = 2;
  const ROW_LABEL_W    = 200;
  const COL_LABEL_H    = 140;
  const TYPE_BADGE_W   = 10;
  const MAX_ENTITIES   = 50;
  const FONT           = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  const FONT_BOLD      = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';

  /* ── State ── */
  let matrix     = null;   // { entities, pages, cells }
  let filtered   = null;   // working copy after filters
  let canvas, ctx;
  let tooltip;
  let hoveredRow = -1;
  let hoveredCol = -1;
  let maxCount   = 1;

  let visibleTypes = new Set(['person', 'organization', 'location', 'date', 'amount', 'other']);
  let minMentions  = 1;
  let sortMode     = 'mentions';

  /* ── Helpers ── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function cellColor(count) {
    if (count === 0) return '#0d1b2a';
    const t = Math.min(count / maxCount, 1);
    // Gradient: dark blue -> accent red
    const r = Math.round(13 + t * (233 - 13));
    const g = Math.round(27 + t * (69 - 27));
    const b = Math.round(42 + t * (96 - 42));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max - 1) + '\u2026' : str;
  }

  /* ── Data Loading ── */
  async function loadData() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');

    if (!projectId) {
      showEmpty();
      return;
    }

    try {
      const response = await browser.runtime.sendMessage({
        action: 'buildHeatmap',
        projectId: projectId
      });

      if (response && response.success && response.matrix) {
        matrix = response.matrix;
        const projName = response.projectName || response.matrix.projectName;
        if (projName) {
          $('#projectBadge').textContent = projName;
        }
        applyFilters();
      } else {
        showEmpty();
      }
    } catch (err) {
      console.error('Failed to load heatmap data:', err);
      showEmpty();
    }
  }

  function showEmpty() {
    $('#emptyState').classList.add('visible');
    canvas.style.display = 'none';
  }

  /* ── Filtering & Sorting ── */
  function applyFilters() {
    if (!matrix || !matrix.entities || matrix.entities.length === 0) {
      showEmpty();
      return;
    }

    // Filter by type and min mentions
    const entityIndices = [];
    for (let i = 0; i < matrix.entities.length; i++) {
      const ent = matrix.entities[i];
      if (!visibleTypes.has(ent.type)) continue;
      if (ent.totalMentions < minMentions) continue;
      entityIndices.push(i);
    }

    // Sort
    if (sortMode === 'mentions') {
      entityIndices.sort((a, b) => matrix.entities[b].totalMentions - matrix.entities[a].totalMentions);
    } else {
      entityIndices.sort((a, b) => matrix.entities[a].name.localeCompare(matrix.entities[b].name));
    }

    // Limit to top N
    const limitedIndices = entityIndices.slice(0, MAX_ENTITIES);

    // Build filtered matrix
    filtered = {
      entities: limitedIndices.map(i => matrix.entities[i]),
      pages: matrix.pages,
      cells: limitedIndices.map(i => matrix.cells[i])
    };

    if (filtered.entities.length === 0 || filtered.pages.length === 0) {
      showEmpty();
      return;
    }

    // Compute max count for color scaling
    maxCount = 1;
    for (const row of filtered.cells) {
      for (const val of row) {
        if (val > maxCount) maxCount = val;
      }
    }

    $('#emptyState').classList.remove('visible');
    canvas.style.display = 'block';

    // Update stats
    $('#statEntities').textContent = filtered.entities.length;
    $('#statPages').textContent = filtered.pages.length;

    render();
  }

  /* ── Rendering ── */
  function render() {
    if (!filtered) return;

    const numRows = filtered.entities.length;
    const numCols = filtered.pages.length;

    const totalW = ROW_LABEL_W + numCols * CELL_SIZE + 20;
    const totalH = COL_LABEL_H + numRows * CELL_SIZE + 20;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalW * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = totalW + 'px';
    canvas.style.height = totalH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, totalW, totalH);

    // Draw column headers (rotated page titles)
    ctx.save();
    ctx.font = FONT;
    ctx.fillStyle = '#a0a0b0';
    ctx.textBaseline = 'bottom';
    for (let c = 0; c < numCols; c++) {
      const x = ROW_LABEL_W + c * CELL_SIZE + CELL_SIZE / 2;
      const y = COL_LABEL_H - 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'left';
      const title = truncate(filtered.pages[c].title || filtered.pages[c].url, 28);
      ctx.fillStyle = (hoveredCol === c) ? '#e8e8e8' : '#a0a0b0';
      ctx.fillText(title, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Draw rows
    for (let r = 0; r < numRows; r++) {
      const ent = filtered.entities[r];
      const y = COL_LABEL_H + r * CELL_SIZE;

      // Row highlight on hover
      if (r === hoveredRow) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, y, totalW, CELL_SIZE);
      }

      // Type badge
      ctx.fillStyle = TYPE_COLORS[ent.type] || TYPE_COLORS.other;
      ctx.fillRect(4, y + CELL_PAD + 2, TYPE_BADGE_W, CELL_SIZE - CELL_PAD * 2 - 4);

      // Entity name label
      ctx.font = (r === hoveredRow) ? FONT_BOLD : FONT;
      ctx.fillStyle = (r === hoveredRow) ? '#e8e8e8' : '#c0c0c0';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        truncate(ent.name, 24),
        ROW_LABEL_W - 8,
        y + CELL_SIZE / 2
      );

      // Cells
      for (let c = 0; c < numCols; c++) {
        const cx = ROW_LABEL_W + c * CELL_SIZE + CELL_PAD;
        const cy = y + CELL_PAD;
        const size = CELL_SIZE - CELL_PAD * 2;
        const count = filtered.cells[r][c] || 0;

        ctx.fillStyle = cellColor(count);
        ctx.fillRect(cx, cy, size, size);

        // Column highlight crosshair
        if (c === hoveredCol) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(cx, cy, size, size);
        }

        // Show count text for non-zero cells if cells are big enough
        if (count > 0 && CELL_SIZE >= 28) {
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = count / maxCount > 0.5 ? '#fff' : '#a0a0b0';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(count, cx + size / 2, cy + size / 2);
        }
      }
    }

    // Draw crosshair lines
    if (hoveredRow >= 0 && hoveredCol >= 0) {
      const hx = ROW_LABEL_W + hoveredCol * CELL_SIZE + CELL_SIZE / 2;
      const hy = COL_LABEL_H + hoveredRow * CELL_SIZE + CELL_SIZE / 2;

      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = 'rgba(233, 69, 96, 0.25)';
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hx, COL_LABEL_H);
      ctx.lineTo(hx, COL_LABEL_H + numRows * CELL_SIZE);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(ROW_LABEL_W, hy);
      ctx.lineTo(ROW_LABEL_W + numCols * CELL_SIZE, hy);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }

  /* ── Canvas Interaction ── */
  function onPointerEvent(clientX, clientY) {
    if (!filtered) return;

    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const col = Math.floor((mx - ROW_LABEL_W) / CELL_SIZE);
    const row = Math.floor((my - COL_LABEL_H) / CELL_SIZE);

    const validCol = col >= 0 && col < filtered.pages.length;
    const validRow = row >= 0 && row < filtered.entities.length;

    const newRow = validRow ? row : -1;
    const newCol = validCol ? col : -1;

    if (newRow !== hoveredRow || newCol !== hoveredCol) {
      hoveredRow = newRow;
      hoveredCol = newCol;
      render();
    }

    // Tooltip
    if (validRow && validCol && mx >= ROW_LABEL_W && my >= COL_LABEL_H) {
      const ent = filtered.entities[row];
      const page = filtered.pages[col];
      const count = filtered.cells[row][col] || 0;

      tooltip.textContent = '';
      const tipEntity = document.createElement('span');
      tipEntity.className = 'tip-entity';
      tipEntity.textContent = ent.name;
      tooltip.appendChild(tipEntity);
      tooltip.appendChild(document.createTextNode(' (' + ent.type + ')'));
      tooltip.appendChild(document.createElement('br'));
      const tipPage = document.createElement('span');
      tipPage.className = 'tip-page';
      tipPage.textContent = page.title || page.url;
      tooltip.appendChild(tipPage);
      tooltip.appendChild(document.createElement('br'));
      tooltip.appendChild(document.createTextNode('Mentions: '));
      const tipCount = document.createElement('span');
      tipCount.className = 'tip-count';
      tipCount.textContent = count;
      tooltip.appendChild(tipCount);
      tooltip.style.display = 'block';

      // Position tooltip
      let tx = clientX + 14;
      let ty = clientY + 14;
      if (tx + 280 > window.innerWidth) tx = clientX - 290;
      if (ty + 80 > window.innerHeight) ty = clientY - 80;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  }

  function onMouseMove(e) {
    onPointerEvent(e.clientX, e.clientY);
  }

  function onTouchStart(e) {
    const touch = e.touches[0];
    if (touch) {
      e.preventDefault();
      onPointerEvent(touch.clientX, touch.clientY);
    }
  }

  function onTouchEnd() {
    hoveredRow = -1;
    hoveredCol = -1;
    tooltip.style.display = 'none';
    if (filtered) render();
  }

  function onMouseLeave() {
    hoveredRow = -1;
    hoveredCol = -1;
    tooltip.style.display = 'none';
    if (filtered) render();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /* ── Export ── */
  function exportPng() {
    if (!filtered) return;
    const link = document.createElement('a');
    link.download = 'entity-heatmap.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function exportCsv() {
    if (!filtered) return;

    const headers = ['Entity', 'Type'];
    for (const page of filtered.pages) {
      headers.push('"' + (page.title || page.url).replace(/"/g, '""') + '"');
    }
    headers.push('Total');

    const rows = [headers.join(',')];
    for (let r = 0; r < filtered.entities.length; r++) {
      const ent = filtered.entities[r];
      const cols = [
        '"' + ent.name.replace(/"/g, '""') + '"',
        ent.type
      ];
      let total = 0;
      for (let c = 0; c < filtered.pages.length; c++) {
        const count = filtered.cells[r][c] || 0;
        cols.push(count);
        total += count;
      }
      cols.push(total);
      rows.push(cols.join(','));
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = 'entity-heatmap.csv';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ── Legend Gradient ── */
  function drawLegend() {
    const el = $('#legendGradient');
    const steps = 20;
    let gradient = 'linear-gradient(to right';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = Math.round(13 + t * (233 - 13));
      const g = Math.round(27 + t * (69 - 27));
      const b = Math.round(42 + t * (96 - 42));
      gradient += `, rgb(${r}, ${g}, ${b})`;
    }
    gradient += ')';
    el.style.background = gradient;
  }

  /* ── Controls ── */
  function setupControls() {
    // Filter pills
    $$('.filter-pill input').forEach(cb => {
      cb.addEventListener('change', () => {
        const type = cb.dataset.type;

        if (type === 'all') {
          const allChecked = cb.checked;
          $$('.filter-pill input').forEach(other => {
            if (other.dataset.type !== 'all') {
              other.checked = allChecked;
              other.parentElement.classList.toggle('active', allChecked);
              if (allChecked) visibleTypes.add(other.dataset.type);
              else visibleTypes.delete(other.dataset.type);
            }
          });
          cb.parentElement.classList.toggle('active', allChecked);
        } else {
          if (cb.checked) visibleTypes.add(type);
          else visibleTypes.delete(type);
          cb.parentElement.classList.toggle('active', cb.checked);

          // Update "All" checkbox
          const allCb = $('[data-type="all"]');
          const allTypes = ['person', 'organization', 'location', 'date', 'amount', 'other'];
          const allOn = allTypes.every(t => visibleTypes.has(t));
          allCb.checked = allOn;
          allCb.parentElement.classList.toggle('active', allOn);
        }

        applyFilters();
      });
    });

    // Min mentions slider
    const slider = $('#minMentions');
    const sliderVal = $('#minMentionsVal');
    slider.addEventListener('input', () => {
      minMentions = parseInt(slider.value, 10);
      sliderVal.textContent = minMentions;
      applyFilters();
    });

    // Sort mode
    $('#sortMode').addEventListener('change', (e) => {
      sortMode = e.target.value;
      applyFilters();
    });

    // Export buttons
    $('#exportPng').addEventListener('click', exportPng);
    $('#exportCsv').addEventListener('click', exportCsv);
  }

  /* ── Resize ── */
  function onResize() {
    if (filtered) render();
  }

  /* ── Init ── */
  function init() {
    canvas = $('#heatmapCanvas');
    ctx = canvas.getContext('2d');
    tooltip = $('#tooltip');

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('resize', onResize);

    drawLegend();
    setupControls();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
