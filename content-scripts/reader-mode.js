// content-scripts/reader-mode.js
// Extracted from background.js lines 100-149 (reader mode mounting)
// MV3: Use chrome.scripting.executeScript({ files: ['content-scripts/reader-mode.js'] })
// MV2: Currently injected via browser.tabs.executeScript with inline code

(function() {
  if (document.getElementById("__argus_reader_overlay__")) return;

  var CANDIDATES = ["article","[role='article']","main","[role='main']",".post-content",".entry-content",".article-body",".article-content",".story-body",".story-content",".content-body",".page-content","#article-body","#article-content","#post-content","#main-content",".post","#post",".entry","#entry","#content",".content","#main","main"];
  var STRIP = ["script","style","noscript","iframe","form","nav","header","footer","aside","button","[class*='ad-']","[class*='-ad']","[id*='cookie']","[class*='cookie']","[class*='subscribe']","[class*='newsletter']","[class*='popup']","[class*='modal']","[class*='sidebar']","[class*='related']","[class*='recommended']","[class*='share']","[class*='social']"];

  function findBest() {
    var best = null, bestLen = 0;
    for (var i = 0; i < CANDIDATES.length; i++) {
      try {
        var el = document.querySelector(CANDIDATES[i]);
        if (!el) continue;
        var txt = el.innerText || "";
        if (txt.length > bestLen) { best = el; bestLen = txt.length; }
      } catch(e) {}
    }
    return { best: best, bestLen: bestLen };
  }

  function buildOverlay(best) {
    var overlay = document.createElement("div");
    overlay.id = "__argus_reader_overlay__";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;overflow-y:auto;background:#fafaf8;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.75;padding:48px 24px 80px";
    var col = document.createElement("div");
    col.style.cssText = "max-width:680px;margin:0 auto;";
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715 Exit Reader";
    closeBtn.style.cssText = "position:fixed;top:12px;right:16px;z-index:2147483648;padding:5px 12px;background:#e94560;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:sans-serif;font-size:12px;font-weight:600";
    closeBtn.addEventListener("click", function() { overlay.remove(); closeBtn.remove(); });
    var clone = best.cloneNode(true);
    for (var s = 0; s < STRIP.length; s++) {
      try { clone.querySelectorAll(STRIP[s]).forEach(function(e) { e.remove(); }); } catch(e) {}
    }
    clone.style.cssText = "all:unset;display:block;";
    clone.querySelectorAll("*").forEach(function(el) {
      var tag = el.tagName.toLowerCase();
      if (tag === "a") { el.style.cssText = "color:#1a56db"; }
      else if (tag === "img") { el.style.cssText = "max-width:100%;height:auto;display:block;margin:1em 0"; }
      else if (/^h[1-6]$/.test(tag)) { el.style.cssText = "display:block;font-weight:bold;margin:1.2em 0 0.4em;line-height:1.3;color:#111"; el.style.fontSize = {h1:"2em",h2:"1.5em",h3:"1.2em",h4:"1em",h5:"0.9em",h6:"0.85em"}[tag]||"1em"; }
      else if (tag === "p") { el.style.cssText = "display:block;margin:0 0 1em"; }
      else if (tag === "blockquote") { el.style.cssText = "display:block;border-left:3px solid #ccc;padding-left:1em;color:#555;font-style:italic;margin:1em 0"; }
      else if (tag === "pre" || tag === "code") { el.style.cssText = "font-family:monospace;background:#f0f0f0;color:#333;padding:2px 5px;border-radius:3px"; }
      else if (tag === "ul" || tag === "ol") { el.style.cssText = "display:block;margin:0 0 1em;padding-left:1.6em"; }
      else if (tag === "li") { el.style.cssText = "display:list-item;margin-bottom:0.25em"; }
    });
    col.appendChild(clone);
    overlay.appendChild(col);
    document.body.appendChild(overlay);
    document.body.appendChild(closeBtn);
  }

  function tryMount(attempt) {
    if (document.getElementById("__argus_reader_overlay__")) return;
    if (attempt > 25) return;
    var result = findBest();
    if (result.bestLen >= 500) { buildOverlay(result.best); }
    else if (attempt >= 12 && document.body && (document.body.innerText || "").length > 100) { buildOverlay(document.body); }
    else { setTimeout(tryMount, 400, attempt + 1); }
  }

  tryMount(0);
})();
