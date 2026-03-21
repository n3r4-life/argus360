// ──────────────────────────────────────────────
// Per-page save utility for graduated pages
// Each graduated page calls createPageSaver() instead of the console's scheduleSave().
// Saves only the keys this page owns, not the full options blob.
// ──────────────────────────────────────────────

function createPageSaver(storageKey, getDataFn, delayMs = 500) {
  let timeout = null;
  return function schedulePagesave() {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      const data = getDataFn();
      await browser.storage.local.set({ [storageKey]: data });
    }, delayMs);
  };
}
