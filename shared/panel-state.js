/**
 * PanelState — persist floating panel position, size, and visibility.
 * Include this script before page-specific JS. Uses browser.storage.local.
 *
 * Storage key format: "panelState:{pageId}:{panelId}"
 * Value shape: { left, top, width, height, visible }
 */
const PanelState = (() => {
  const PREFIX = "panelState:";
  const debounceTimers = {};

  function key(pageId, panelId) {
    return `${PREFIX}${pageId}:${panelId}`;
  }

  /**
   * Save panel state (debounced 300ms). Accepts partial state — merges with existing.
   */
  function save(pageId, panelId, state) {
    const k = key(pageId, panelId);
    clearTimeout(debounceTimers[k]);
    debounceTimers[k] = setTimeout(async () => {
      try {
        const stored = await browser.storage.local.get(k);
        const merged = Object.assign({}, stored[k] || {}, state);
        await browser.storage.local.set({ [k]: merged });
      } catch (e) { /* silent */ }
    }, 300);
  }

  /**
   * Load saved panel state. Returns null if nothing saved.
   */
  async function load(pageId, panelId) {
    try {
      const k = key(pageId, panelId);
      const stored = await browser.storage.local.get(k);
      return stored[k] || null;
    } catch (e) { return null; }
  }

  /**
   * Load saved state and apply it to a panel element.
   * Clamps position to viewport bounds.
   * Options: { skipVisibility: true } to skip restoring open/hidden state.
   * Returns the loaded state or null.
   */
  async function apply(panel, pageId, panelId, opts) {
    const state = await load(pageId, panelId);
    if (!state) return null;

    if (typeof state.left === "number") {
      const maxLeft = window.innerWidth - 60;
      panel.style.left = Math.max(0, Math.min(state.left, maxLeft)) + "px";
      panel.style.right = "auto";
      // Clear transform so CSS centering (e.g. translate(-50%,-50%)) doesn't fight
      panel.style.transform = "none";
    }
    if (typeof state.top === "number") {
      const maxTop = window.innerHeight - 60;
      panel.style.top = Math.max(46, Math.min(state.top, maxTop)) + "px";
    }
    if (typeof state.width === "number") {
      panel.style.width = Math.max(180, state.width) + "px";
    }
    if (typeof state.height === "number") {
      panel.style.height = Math.max(150, state.height) + "px";
    }

    if (!(opts && opts.skipVisibility) && typeof state.visible === "boolean") {
      panel.classList.toggle("hidden", !state.visible);
    }

    return state;
  }

  /**
   * Remove all saved panel states for a page.
   */
  async function clear(pageId) {
    try {
      const all = await browser.storage.local.get(null);
      const prefix = `${PREFIX}${pageId}:`;
      const keysToRemove = Object.keys(all).filter(k => k.startsWith(prefix));
      if (keysToRemove.length) await browser.storage.local.remove(keysToRemove);
    } catch (e) { /* silent */ }
  }

  return { save, load, apply, clear };
})();
