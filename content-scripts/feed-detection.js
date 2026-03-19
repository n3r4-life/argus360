// content-scripts/feed-detection.js
// Extracted from background.js lines 471-500 (feed detection)
// Scans <link> tags and <a> tags for RSS/Atom feed URLs

(function() {
  var feeds = [];
  var seen = new Set();

  // Standard <link> tags — match by type OR by rel=alternate with feed-like href
  var links = document.querySelectorAll('link[type="application/rss+xml"], link[type="application/atom+xml"], link[type="application/feed+json"], link[rel="alternate"][href*="feed"], link[rel="alternate"][href*="rss"], link[rel="alternate"][href*=".xml"]');
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    if (l.href && !seen.has(l.href)) {
      seen.add(l.href);
      feeds.push({ url: l.href, title: l.title || "", source: "link" });
    }
  }

  // Scan <a> tags for common feed URL patterns
  var feedRx = /(\/feed\/?$|\/rss\/?$|\/atom\/?$|\.rss$|\.xml$|\/feeds?\/|\/rss\/|feed\.xml|rss\.xml|atom\.xml|index\.rss|\/syndication|feedburner\.com|feeds\.feedburner|google-publisher)/i;
  var anchors = document.querySelectorAll('a[href]');
  for (var j = 0; j < anchors.length; j++) {
    try {
      var href = anchors[j].href;
      if (!href || seen.has(href) || href.startsWith("javascript:")) continue;
      if (feedRx.test(href)) {
        seen.add(href);
        feeds.push({ url: href, title: anchors[j].textContent.trim().slice(0, 80) || "", source: "anchor" });
      }
    } catch(e) {}
  }

  return feeds.length ? feeds : null;
})();
