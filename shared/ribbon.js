// Argus shared ribbon — matches console page-header layout
// Logo + "Argus" on LEFT, console-tab icon buttons on RIGHT
(function() {
  const SVG_NS = "http://www.w3.org/2000/svg";

  function makeSvg(paths) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    for (const [tag, attrs] of paths) {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      svg.appendChild(el);
    }
    return svg;
  }

  function makeIcon(id, title, svgPaths) {
    const btn = document.createElement("button");
    btn.className = "ribbon-icon";
    btn.id = id;
    btn.title = title;
    btn.appendChild(makeSvg(svgPaths));
    return btn;
  }

  // ── Build ribbon (header bar) ──
  const ribbon = document.createElement("nav");
  ribbon.className = "argus-ribbon";

  // Left side: logo + brand
  const left = document.createElement("div");
  left.className = "ribbon-left";

  const logo = document.createElement("img");
  logo.className = "ribbon-logo";
  logo.src = browser.runtime.getURL("icons/icon-32.png");
  logo.alt = "Argus";
  left.appendChild(logo);

  const brand = document.createElement("a");
  brand.className = "ribbon-brand";
  brand.id = "ribbon-console";
  brand.title = "Open Argus Console";
  brand.textContent = "Argus";
  left.appendChild(brand);

  ribbon.appendChild(left);

  // Right side: console-tab icon buttons (same as console page header)
  const icons = document.createElement("nav");
  icons.className = "ribbon-icons";

  icons.appendChild(makeIcon("ribbon-bookmarks", "Bookmarks", [
    ["path", { d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-projects", "Projects", [
    ["path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-monitors", "Monitors", [
    ["path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }],
    ["circle", { cx: "12", cy: "12", r: "3" }]
  ]));
  icons.appendChild(makeIcon("ribbon-feeds", "Feeds", [
    ["path", { d: "M4 11a9 9 0 0 1 9 9" }],
    ["path", { d: "M4 4a16 16 0 0 1 16 16" }],
    ["circle", { cx: "5", cy: "19", r: "1" }]
  ]));
  icons.appendChild(makeIcon("ribbon-osint", "OSINT", [
    ["circle", { cx: "11", cy: "11", r: "8" }],
    ["line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }]
  ]));
  icons.appendChild(makeIcon("ribbon-automate", "Automate", [
    ["circle", { cx: "12", cy: "12", r: "3" }],
    ["path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-redirects", "Redirects", [
    ["polyline", { points: "16 3 21 3 21 8" }],
    ["line", { x1: "4", y1: "20", x2: "21", y2: "3" }],
    ["polyline", { points: "21 16 21 21 16 21" }],
    ["line", { x1: "15", y1: "15", x2: "21", y2: "21" }]
  ]));

  const sep1 = document.createElement("span");
  sep1.className = "ribbon-icon-sep";
  icons.appendChild(sep1);

  icons.appendChild(makeIcon("ribbon-prompts", "Prompts", [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-providers", "Providers", [
    ["path", { d: "M12 2L2 7l10 5 10-5-10-5z" }],
    ["path", { d: "M2 17l10 5 10-5" }],
    ["path", { d: "M2 12l10 5 10-5" }]
  ]));
  icons.appendChild(makeIcon("ribbon-resources", "Resources", [
    ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
    ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }]
  ]));
  icons.appendChild(makeIcon("ribbon-settings", "Settings", [
    ["path", { d: "M12 20h9" }],
    ["path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-help", "Help", [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
    ["line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }]
  ]));

  const sep2 = document.createElement("span");
  sep2.className = "ribbon-icon-sep";
  icons.appendChild(sep2);

  const wipeBtn = document.createElement("button");
  wipeBtn.className = "ribbon-icon ribbon-icon-danger";
  wipeBtn.id = "ribbon-wipe";
  wipeBtn.title = "Wipe all Argus data";
  wipeBtn.appendChild(makeSvg([
    ["polyline", { points: "3 6 5 6 21 6" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
  ]));
  icons.appendChild(wipeBtn);

  ribbon.appendChild(icons);
  document.body.insertBefore(ribbon, document.body.firstChild);

  // ── App launcher tab bar (below ribbon) ──
  const appBar = document.createElement("nav");
  appBar.className = "argus-app-tabs";

  function makeAppTab(id, label, svgPaths) {
    const btn = document.createElement("button");
    btn.className = "app-tab-btn";
    btn.id = id;
    btn.appendChild(makeSvg(svgPaths));
    const span = document.createElement("span");
    span.textContent = label;
    btn.appendChild(span);
    return btn;
  }

  appBar.appendChild(makeAppTab("app-kg", "KG", [
    ["circle", { cx: "6", cy: "6", r: "3" }], ["circle", { cx: "18", cy: "6", r: "3" }],
    ["circle", { cx: "6", cy: "18", r: "3" }], ["circle", { cx: "18", cy: "18", r: "3" }],
    ["line", { x1: "9", y1: "6", x2: "15", y2: "6" }], ["line", { x1: "6", y1: "9", x2: "6", y2: "15" }],
    ["line", { x1: "18", y1: "9", x2: "18", y2: "15" }], ["line", { x1: "9", y1: "18", x2: "15", y2: "18" }]
  ]));
  appBar.appendChild(makeAppTab("app-chat", "Chat", [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }]
  ]));
  appBar.appendChild(makeAppTab("app-workbench", "Workbench", [
    ["rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }],
    ["line", { x1: "8", y1: "21", x2: "16", y2: "21" }],
    ["line", { x1: "12", y1: "17", x2: "12", y2: "21" }]
  ]));
  appBar.appendChild(makeAppTab("app-reports", "Reports", [
    ["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }],
    ["polyline", { points: "14 2 14 8 20 8" }],
    ["line", { x1: "16", y1: "13", x2: "8", y2: "13" }],
    ["line", { x1: "16", y1: "17", x2: "8", y2: "17" }]
  ]));
  appBar.appendChild(makeAppTab("app-reader", "Reader", [
    ["path", { d: "M4 11a9 9 0 0 1 9 9" }],
    ["path", { d: "M4 4a16 16 0 0 1 16 16" }],
    ["circle", { cx: "5", cy: "19", r: "1" }]
  ]));
  ribbon.insertAdjacentElement("afterend", appBar);

  // Highlight the current page's tab
  const loc = window.location.pathname;
  if (loc.includes("/osint/graph")) document.getElementById("app-kg")?.classList.add("active");
  else if (loc.includes("/chat/")) document.getElementById("app-chat")?.classList.add("active");
  else if (loc.includes("/workbench/")) document.getElementById("app-workbench")?.classList.add("active");
  else if (loc.includes("/history/")) document.getElementById("app-reports")?.classList.add("active");
  else if (loc.includes("/feeds/")) document.getElementById("app-reader")?.classList.add("active");

  // ── Focus-or-create helpers (single instance per page) ──
  async function focusOrCreate(urlPath, hash) {
    const fullUrl = browser.runtime.getURL(urlPath);
    const existing = await browser.tabs.query({ url: fullUrl + "*" });
    if (existing.length > 0) {
      const tab = existing[0];
      await browser.tabs.update(tab.id, { active: true, url: hash ? fullUrl + "#" + hash : undefined });
      await browser.windows.update(tab.windowId, { focused: true });
    } else {
      await browser.tabs.create({ url: fullUrl + (hash ? "#" + hash : "") });
    }
  }

  function nav(hash) {
    focusOrCreate("options/options.html", hash);
  }

  // Brand / logo → console home landing
  document.getElementById("ribbon-console").addEventListener("click", () => nav("home"));

  // Console-tab icon buttons → open console at that tab
  document.getElementById("ribbon-bookmarks").addEventListener("click", () => nav("bookmarks"));
  document.getElementById("ribbon-projects").addEventListener("click", () => nav("projects"));
  document.getElementById("ribbon-monitors").addEventListener("click", () => nav("monitors"));
  document.getElementById("ribbon-feeds").addEventListener("click", () => nav("feeds"));
  document.getElementById("ribbon-osint").addEventListener("click", () => nav("osint"));
  document.getElementById("ribbon-automate").addEventListener("click", () => nav("automation"));
  document.getElementById("ribbon-redirects").addEventListener("click", () => nav("archive"));
  document.getElementById("ribbon-prompts").addEventListener("click", () => nav("prompts"));
  document.getElementById("ribbon-providers").addEventListener("click", () => nav("providers"));
  document.getElementById("ribbon-resources").addEventListener("click", () => nav("resources"));
  document.getElementById("ribbon-settings").addEventListener("click", () => nav("settings"));
  document.getElementById("ribbon-help").addEventListener("click", () => nav("help"));

  // Wipe button
  document.getElementById("ribbon-wipe").addEventListener("click", async () => {
    if (!confirm("Wipe ALL Argus data? This permanently deletes all projects, bookmarks, monitors, feeds, history, settings, and API keys. This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? This will erase everything.")) return;
    await browser.runtime.sendMessage({ action: "wipeEverything" });
    alert("All Argus data has been wiped.");
    window.location.reload();
  });

  // App tab navigation — focus existing or create
  document.getElementById("app-kg").addEventListener("click", () => focusOrCreate("osint/graph.html"));
  document.getElementById("app-chat").addEventListener("click", () => focusOrCreate("chat/chat.html"));
  document.getElementById("app-workbench").addEventListener("click", () => focusOrCreate("workbench/workbench.html"));
  document.getElementById("app-reports").addEventListener("click", () => focusOrCreate("history/history.html"));
  document.getElementById("app-reader").addEventListener("click", () => focusOrCreate("feeds/feeds.html"));
})();
