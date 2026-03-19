// content-scripts/pdf-extraction.js
// Extracted from background.js lines 1287-1318 (PDF.js viewer text extraction)
// Reads text from Firefox's built-in PDF.js viewer .textLayer spans

(function() {
  var spans = document.querySelectorAll(".textLayer span");
  if (spans.length > 0) {
    var pages = document.querySelectorAll(".page");
    var pageTexts = [];
    pages.forEach(function(page) {
      var layer = page.querySelector(".textLayer");
      if (layer) {
        var pageSpans = layer.querySelectorAll("span");
        var text = Array.from(pageSpans).map(function(s) { return s.textContent; }).join(" ");
        if (text.trim()) pageTexts.push(text.trim());
      }
    });
    return {
      title: document.title || "PDF Document",
      url: window.location.href,
      text: pageTexts.join("\n\n"),
      pages: pageTexts.length
    };
  }
  // Fallback: grab all visible text from the viewer
  return {
    title: document.title || "PDF Document",
    url: window.location.href,
    text: document.body.innerText || "",
    pages: 0
  };
})();
