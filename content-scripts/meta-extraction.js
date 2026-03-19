// content-scripts/meta-extraction.js
// Extracted from background.js lines 6138-6151 (bookmark meta extraction)
// Returns OG, canonical, favicon, author, and publication metadata

(function() {
  var getMeta = function(n) {
    var el = document.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]');
    return el ? el.content : '';
  };
  return {
    description: getMeta('description') || getMeta('og:description'),
    ogImage: getMeta('og:image'),
    ogTitle: getMeta('og:title'),
    ogType: getMeta('og:type'),
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
    favicon: (document.querySelector('link[rel="icon"],link[rel="shortcut icon"]') || {}).href || '',
    author: getMeta('author'),
    publishedTime: getMeta('article:published_time') || getMeta('datePublished')
  };
})();
