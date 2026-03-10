// Argus shared ribbon — inject at top of all generated pages
(function() {
  const ribbon = document.createElement("nav");
  ribbon.className = "argus-ribbon";

  // Determine relative path to root from current page
  const depth = window.location.pathname.split("/").filter(Boolean).length - 1;
  const prefix = depth > 1 ? "../".repeat(depth - 1) : "";

  ribbon.innerHTML = `
    <a class="ribbon-brand" id="ribbon-console" title="Open Argus Console">Argus</a>
    <span class="ribbon-sep"></span>
    <button class="ribbon-btn" id="ribbon-bookmarks" title="Smart Bookmarks">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    </button>
    <button class="ribbon-btn" id="ribbon-monitors" title="Page Monitors">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
    <button class="ribbon-btn" id="ribbon-projects" title="Projects">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    </button>
    <button class="ribbon-btn" id="ribbon-feeds" title="RSS Feeds">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
    </button>
    <button class="ribbon-btn" id="ribbon-history" title="Analysis History">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </button>
    <span class="ribbon-spacer"></span>
    <button class="ribbon-btn" id="ribbon-settings" title="Quick Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
  `;

  document.body.insertBefore(ribbon, document.body.firstChild);

  // Wire navigation
  const nav = (hash) => { browser.tabs.create({ url: browser.runtime.getURL("options/options.html" + (hash ? "#" + hash : "")) }); };
  document.getElementById("ribbon-console").addEventListener("click", () => nav(""));
  document.getElementById("ribbon-bookmarks").addEventListener("click", () => nav("bookmarks"));
  document.getElementById("ribbon-monitors").addEventListener("click", () => nav("monitors"));
  document.getElementById("ribbon-projects").addEventListener("click", () => nav("projects"));
  document.getElementById("ribbon-feeds").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("feeds/feeds.html") });
  });
  document.getElementById("ribbon-history").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("history/history.html") });
  });
  document.getElementById("ribbon-settings").addEventListener("click", () => nav("settings"));
})();
