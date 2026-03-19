// content-scripts/image-scraping.js
// Extracted from background-osint.js lines 2085-2187 (image collection)
// Collects images from img, picture, CSS backgrounds, video posters, meta, favicons, SVGs

(function() {
  var seen = new Set();
  var images = [];

  function normalizeUrl(raw) {
    try {
      var u = new URL(raw, location.href);
      u.hash = "";
      var stripParams = ["w","h","width","height","size","resize","quality","q","fit","auto","format","fm","dpr"];
      for (var i = 0; i < stripParams.length; i++) u.searchParams.delete(stripParams[i]);
      return u.href;
    } catch(e) { return null; }
  }

  function addImage(src, alt, w, h, source) {
    if (!src) return;
    if (src.startsWith("data:") && src.length < 500) return;
    if (/1x1|pixel|spacer|blank\.gif|beacon/i.test(src)) return;
    var resolved = normalizeUrl(src);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    try {
      var url = new URL(resolved);
      images.push({
        src: url.href,
        alt: (alt || "").trim().slice(0, 200),
        width: w || 0, height: h || 0,
        source: source,
        filename: decodeURIComponent(url.pathname.split("/").pop() || "image")
      });
    } catch(e) {}
  }

  // img elements
  document.querySelectorAll("img").forEach(function(img) {
    addImage(img.currentSrc || img.src, img.alt, img.naturalWidth || img.width, img.naturalHeight || img.height, "img");
  });

  // picture > source (responsive)
  document.querySelectorAll("picture source").forEach(function(source) {
    var srcset = source.srcset;
    if (srcset) {
      srcset.split(",").forEach(function(s) {
        var url = s.trim().split(/\s+/)[0];
        addImage(url, "", 0, 0, "picture");
      });
    }
  });

  // CSS background images
  document.querySelectorAll("*").forEach(function(el) {
    var bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") {
      var match = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (match) addImage(match[1], "", el.offsetWidth, el.offsetHeight, "css-bg");
    }
  });

  // Video posters
  document.querySelectorAll("video[poster]").forEach(function(v) {
    addImage(v.poster, "Video poster", v.width, v.height, "video-poster");
  });

  // Meta/OG images
  document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:image:url"]').forEach(function(m) {
    addImage(m.content, "Meta image", 0, 0, "meta");
  });

  // Favicons
  document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(function(l) {
    addImage(l.href, "Favicon/Icon", 0, 0, "favicon");
  });

  // SVG images
  document.querySelectorAll("svg image").forEach(function(img) {
    addImage(img.getAttribute("href") || img.getAttribute("xlink:href"), "", 0, 0, "svg");
  });

  // Direct image file fallback
  if (images.length === 0) {
    var pageExt = location.pathname.match(/\.(jpe?g|png|gif|webp|svg|avif|bmp|ico|tiff?)$/i);
    if (pageExt) {
      var rootSvg = document.querySelector("svg");
      var w = rootSvg ? (rootSvg.getAttribute("width") || 0) : 0;
      var h = rootSvg ? (rootSvg.getAttribute("height") || 0) : 0;
      addImage(location.href, document.title || "Direct image", parseInt(w) || 0, parseInt(h) || 0, "direct");
    }
  }

  return { images: images, pageUrl: location.href, pageTitle: document.title };
})();
