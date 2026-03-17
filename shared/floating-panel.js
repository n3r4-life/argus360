/**
 * FloatingPanel — shared drag, resize, and z-stacking for .fp panels.
 *
 * Usage:
 *   <script src="../shared/panel-state.js"></script>
 *   <script src="../shared/floating-panel.js"></script>
 *
 *   FloatingPanel.init(panel, pageId);          // drag + resize + state restore
 *   FloatingPanel.init(panel, pageId, { resize: false });  // drag only
 *
 * Panels must use the .fp / .fp-header / .fp-body markup from argus-std.css.
 * The drag handle is always .fp-header. The resize handle (.fp-resize) is
 * auto-created if one doesn't already exist and opts.resize !== false.
 *
 * Z-stacking: clicking/dragging a panel brings it to front. All managed
 * panels share a z-index counter starting at the base z defined in CSS.
 */
const FloatingPanel = (() => {
  'use strict';

  let zCounter = 1000; // high enough to sit above Leaflet (400+) and other UI

  /**
   * Bring a panel to the front of the stack.
   */
  function bringToFront(panel) {
    zCounter++;
    panel.style.zIndex = zCounter;
  }

  /**
   * Make a panel draggable via its .fp-header.
   */
  function _initDrag(panel, pageId) {
    const header = panel.querySelector('.fp-header');
    if (!header) return;

    let dragging = false, startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, input, select, textarea')) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      header.style.cursor = 'grabbing';
      bringToFront(panel);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = (startLeft + dx) + 'px';
      panel.style.top = (startTop + dy) + 'px';
      panel.style.right = 'auto';
      panel.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = '';
      const pid = panel.dataset.panelId;
      if (pid && typeof PanelState !== 'undefined') {
        const rect = panel.getBoundingClientRect();
        PanelState.save(pageId, pid, { left: rect.left, top: rect.top });
      }
    });
  }

  /**
   * Add a resize handle to the panel (or use existing .fp-resize).
   */
  function _initResize(panel, pageId) {
    let handle = panel.querySelector('.fp-resize');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'fp-resize';
      panel.appendChild(handle);
    }

    let resizing = false, startX, startY, startW, startH;

    handle.addEventListener('mousedown', (e) => {
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = panel.offsetWidth;
      startH = panel.offsetHeight;
      bringToFront(panel);
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      panel.style.width = Math.max(220, startW + (e.clientX - startX)) + 'px';
      panel.style.height = Math.max(150, startH + (e.clientY - startY)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      const pid = panel.dataset.panelId;
      if (pid && typeof PanelState !== 'undefined') {
        PanelState.save(pageId, pid, { width: panel.offsetWidth, height: panel.offsetHeight });
      }
    });
  }

  /**
   * Initialise a floating panel: drag, optional resize, state restore, z-stacking.
   *
   * @param {HTMLElement} panel  - The .fp element
   * @param {string}      pageId - PanelState page identifier (e.g. 'satellite')
   * @param {object}      [opts]
   * @param {boolean}     [opts.resize=true]         - Add resize handle
   * @param {boolean}     [opts.restoreState=true]   - Restore saved position/size
   * @param {boolean}     [opts.skipVisibility=false] - Don't restore open/hidden state
   */
  function init(panel, pageId, opts) {
    if (!panel) return;
    opts = Object.assign({ resize: true, restoreState: true, skipVisibility: false }, opts);

    // Z-stacking on any mousedown inside the panel
    panel.addEventListener('mousedown', () => bringToFront(panel));
    bringToFront(panel);

    _initDrag(panel, pageId);

    if (opts.resize) {
      _initResize(panel, pageId);
    }

    if (opts.restoreState && typeof PanelState !== 'undefined') {
      const pid = panel.dataset.panelId;
      if (pid) {
        PanelState.apply(panel, pageId, pid, { skipVisibility: opts.skipVisibility });
      }
    }
  }

  return { init, bringToFront };
})();
