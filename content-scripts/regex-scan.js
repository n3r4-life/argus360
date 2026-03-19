// content-scripts/regex-scan.js
// Extracted from background-osint.js lines 2254-2286 (OSINT regex pattern scanning)
// Scans page for emails, IPs, phones, URLs, hashes, BTC, SSNs, credit cards, JWTs, API keys, etc.

(function() {
  var html = document.documentElement.outerHTML;
  var text = document.body.innerText;
  var patterns = {
    emails:         { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, src: html },
    ipv4:           { re: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, src: html },
    phones:         { re: /(?:\+?1[\-\s.]?)?\(?\d{3}\)?[\-\s.]?\d{3}[\-\s.]?\d{4}/g, src: text },
    urls:           { re: /https?:\/\/[^\s"'<>\)\]}{]+/g, src: html },
    domains:        { re: /\b(?:[a-zA-Z0-9\-]+\.)+(?:com|org|net|gov|edu|io|co|info|biz|me|dev|app|xyz|uk|de|fr|jp|ru|cn|au|ca|nl|se|ch|es|it|br|in|kr|za)\b/g, src: html },
    hashes_md5:     { re: /\b[a-fA-F0-9]{32}\b/g, src: html },
    hashes_sha1:    { re: /\b[a-fA-F0-9]{40}\b/g, src: html },
    hashes_sha256:  { re: /\b[a-fA-F0-9]{64}\b/g, src: html },
    btc_addr:       { re: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g, src: text },
    ssn:            { re: /\b\d{3}[\-\s]?\d{2}[\-\s]?\d{4}\b/g, src: text },
    credit_card:    { re: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[\-\s]?\d{4}[\-\s]?\d{4}[\-\s]?\d{4}\b/g, src: text },
    jwt:            { re: /eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, src: html },
    api_keys:       { re: /(?:api[_\-]?key|apikey|token|secret|access[_\-]?key)[\s]*[:=][\s]*["']?([a-zA-Z0-9_\-]{16,})["']?/gi, src: html },
    aws_keys:       { re: /AKIA[0-9A-Z]{16}/g, src: html },
    base64_blobs:   { re: /[A-Za-z0-9+\/]{40,}={0,2}/g, src: html },
    social_handles: { re: /@[a-zA-Z0-9_]{1,30}/g, src: text }
  };

  var found = {};
  var totalMatches = 0;
  var keys = Object.keys(patterns);
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var re = patterns[name].re;
    var src = patterns[name].src;
    var matches = src.match(re) || [];
    var unique = Array.from(new Set(matches));
    if (unique.length > 0) {
      found[name] = unique.slice(0, 200);
      totalMatches += unique.length;
    }
  }

  return { found: found, totalMatches: totalMatches, htmlLength: html.length, textLength: text.length, html: html, text: text };
})();
