// content-scripts/osint-metadata.js
// Extracted from background-osint.js lines 60-151 (OSINT metadata extraction)
// Comprehensive extraction: meta tags, OG, Twitter Cards, JSON-LD, links, author, dates

(function() {
  // Meta tags
  var meta = {};
  var metaEls = document.querySelectorAll('meta[name], meta[property], meta[http-equiv]');
  for (var i = 0; i < metaEls.length; i++) {
    var el = metaEls[i];
    var key = el.getAttribute('name') || el.getAttribute('property') || el.getAttribute('http-equiv');
    if (key) meta[key.toLowerCase()] = el.getAttribute('content') || '';
  }

  // Open Graph
  var og = {};
  var ogEls = document.querySelectorAll('meta[property^="og:"]');
  for (var j = 0; j < ogEls.length; j++) {
    var ogKey = ogEls[j].getAttribute('property');
    if (ogKey) og[ogKey] = ogEls[j].getAttribute('content') || '';
  }

  // Twitter Card
  var twitter = {};
  var twEls = document.querySelectorAll('meta[name^="twitter:"], meta[property^="twitter:"]');
  for (var k = 0; k < twEls.length; k++) {
    var twKey = twEls[k].getAttribute('name') || twEls[k].getAttribute('property');
    if (twKey) twitter[twKey] = twEls[k].getAttribute('content') || '';
  }

  // JSON-LD
  var jsonLd = [];
  var ldEls = document.querySelectorAll('script[type="application/ld+json"]');
  for (var l = 0; l < ldEls.length; l++) {
    try { jsonLd.push(JSON.parse(ldEls[l].textContent)); } catch(e) {}
  }

  // Link elements
  var links = {};
  var canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) links.canonical = canonical.getAttribute('href');
  var alternates = [];
  var altEls = document.querySelectorAll('link[rel="alternate"]');
  for (var m = 0; m < altEls.length; m++) {
    alternates.push({
      href: altEls[m].getAttribute('href') || '',
      type: altEls[m].getAttribute('type') || '',
      hreflang: altEls[m].getAttribute('hreflang') || ''
    });
  }
  if (alternates.length) links.alternate = alternates;

  // Author info
  var author = {};
  if (meta.author) author.meta = meta.author;
  var authorLink = document.querySelector('a[rel="author"]');
  if (authorLink) {
    author.link = { text: authorLink.textContent.trim(), href: authorLink.href };
  }
  for (var n = 0; n < jsonLd.length; n++) {
    var a = jsonLd[n].author || (Array.isArray(jsonLd[n]['@graph']) && jsonLd[n]['@graph'].find(function(node) { return node['@type'] === 'Person'; }));
    if (a) {
      author.jsonLd = { name: a.name || '', url: a.url || '' };
      break;
    }
  }

  // Dates
  var dates = {};
  var dateMetas = ['date', 'article:published_time', 'article:modified_time',
    'datepublished', 'datemodified', 'dc.date', 'dc.date.created',
    'pubdate', 'publish_date', 'sailthru.date'];
  for (var d = 0; d < dateMetas.length; d++) {
    if (meta[dateMetas[d]]) dates[dateMetas[d]] = meta[dateMetas[d]];
  }
  if (og['og:updated_time']) dates['og:updated_time'] = og['og:updated_time'];
  var timeEls = document.querySelectorAll('time[datetime]');
  if (timeEls.length > 0) {
    dates.timeElements = Array.from(timeEls).slice(0, 10).map(function(t) {
      return { datetime: t.getAttribute('datetime'), text: t.textContent.trim() };
    });
  }
  for (var p = 0; p < jsonLd.length; p++) {
    if (jsonLd[p].datePublished) dates.jsonLdPublished = jsonLd[p].datePublished;
    if (jsonLd[p].dateModified) dates.jsonLdModified = jsonLd[p].dateModified;
    if (jsonLd[p].dateCreated) dates.jsonLdCreated = jsonLd[p].dateCreated;
  }

  // Language / Charset
  var lang = document.documentElement.lang || meta['content-language'] || '';
  var charsetEl = document.querySelector('meta[charset]');
  var charset = charsetEl ? charsetEl.getAttribute('charset') : (meta['content-type'] || '');

  return { meta: meta, og: og, twitter: twitter, jsonLd: jsonLd, links: links, author: author, dates: dates, lang: lang, charset: charset };
})();
