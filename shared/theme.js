/*
 * Argus Theme Manager
 * ===================
 * Reads theme preference from browser.storage.local and applies
 * data-theme="light" on <html>.  Default is dark (no attribute).
 *
 * Include early in every page:
 *   <script src="../shared/theme.js"></script>
 */
(function () {
  const STORAGE_KEY = "argusTheme";       // "dark" | "light"
  const HTML = document.documentElement;

  function apply(theme) {
    if (theme === "light") {
      HTML.setAttribute("data-theme", "light");
    } else {
      HTML.removeAttribute("data-theme");
    }
  }

  // Apply immediately from storage (avoid flash)
  if (typeof browser !== "undefined" && browser.storage) {
    browser.storage.local.get({ [STORAGE_KEY]: "dark" }).then(r => apply(r[STORAGE_KEY]));

    // Live-react when another page (or the popup) flips the switch
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        apply(changes[STORAGE_KEY].newValue);
      }
    });
  }
})();
