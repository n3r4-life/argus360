// content-scripts/page-content.js
// Extracted from background.js lines 1340-1373 (page content + selection extraction)
// Returns title, URL, description, main text content, and current selection

(function() {
  var title = document.title || "";
  var url = window.location.href;
  var meta = document.querySelector('meta[name="description"]');
  var description = meta ? meta.content : "";
  var selection = window.getSelection().toString();

  var candidates = [
    "article", "main", '[role="main"]', '[itemprop="articleBody"]',
    ".article-body", ".article-content", ".article__body", ".article__content",
    ".post-content", ".post-body", ".entry-content",
    ".story-body", ".story-content",
    "#article-body", "#article-content",
    ".content-body", ".page-content"
  ];
  var bestText = "";
  for (var i = 0; i < candidates.length; i++) {
    var el = document.querySelector(candidates[i]);
    if (el) {
      var t = el.innerText || "";
      if (t.length > bestText.length) bestText = t;
    }
  }
  if (bestText.length < 200) bestText = document.body.innerText || "";
  return { title: title, url: url, description: description, text: bestText, selection: selection };
})();
