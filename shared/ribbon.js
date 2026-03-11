// Argus shared ribbon — inject at top of all generated pages
(function() {
  const ribbon = document.createElement("nav");
  ribbon.className = "argus-ribbon";

  // Determine relative path to root from current page
  const depth = window.location.pathname.split("/").filter(Boolean).length - 1;
  const prefix = depth > 1 ? "../".repeat(depth - 1) : "";

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

  function makeBtn(id, title, svgPaths) {
    const btn = document.createElement("button");
    btn.className = "ribbon-btn";
    btn.id = id;
    btn.title = title;
    btn.appendChild(makeSvg(svgPaths));
    return btn;
  }

  const brand = document.createElement("a");
  brand.className = "ribbon-brand";
  brand.id = "ribbon-console";
  brand.title = "Open Argus Console";
  brand.textContent = "Argus";
  ribbon.appendChild(brand);

  const sep = document.createElement("span");
  sep.className = "ribbon-sep";
  ribbon.appendChild(sep);

  ribbon.appendChild(makeBtn("ribbon-bookmarks", "Smart Bookmarks", [
    ["path", { d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" }]
  ]));
  ribbon.appendChild(makeBtn("ribbon-monitors", "Page Monitors", [
    ["path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }],
    ["circle", { cx: "12", cy: "12", r: "3" }]
  ]));
  ribbon.appendChild(makeBtn("ribbon-projects", "Projects", [
    ["path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }]
  ]));
  ribbon.appendChild(makeBtn("ribbon-feeds", "RSS Feeds", [
    ["path", { d: "M4 11a9 9 0 0 1 9 9" }],
    ["path", { d: "M4 4a16 16 0 0 1 16 16" }],
    ["circle", { cx: "5", cy: "19", r: "1" }]
  ]));
  ribbon.appendChild(makeBtn("ribbon-history", "Analysis History", [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["polyline", { points: "12 6 12 12 16 14" }]
  ]));

  const spacer = document.createElement("span");
  spacer.className = "ribbon-spacer";
  ribbon.appendChild(spacer);

  ribbon.appendChild(makeBtn("ribbon-settings", "Console", [
    ["rect", { x: "3", y: "3", width: "7", height: "7" }],
    ["rect", { x: "14", y: "3", width: "7", height: "7" }],
    ["rect", { x: "3", y: "14", width: "7", height: "7" }],
    ["rect", { x: "14", y: "14", width: "7", height: "7" }]
  ]));

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
  document.getElementById("ribbon-settings").addEventListener("click", () => nav(""));
})();
