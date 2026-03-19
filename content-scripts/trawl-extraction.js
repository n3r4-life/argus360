// content-scripts/trawl-extraction.js
// Extracted from background.js lines 229-292 (trawl data extraction)
// MV3: Use chrome.scripting.executeScript({ files: ['content-scripts/trawl-extraction.js'] })
// MV2: Currently injected via browser.tabs.executeScript with inline code
// Returns data object via last expression (for executeScript result capture)

(function() {
  var data = {
    emails: [], phones: [], addresses: [], businessName: "", contacts: [],
    socialLinks: [], geo: null, schema: null, meta: {}, scrollDepth: 0,
    extractedAt: Date.now()
  };

  // Strategy A: JSON-LD / Schema.org
  try {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var json = JSON.parse(scripts[i].textContent);
        if (Array.isArray(json)) json = json[0];
        var t = json["@type"] || "";
        if (/Organization|LocalBusiness|Person|Store|Restaurant|Hotel|MedicalBusiness|LegalService|FinancialService|RealEstateAgent/i.test(t)) {
          data.schema = { type: t, raw: json };
          data.businessName = json.name || json.legalName || "";
          if (json.telephone) data.phones.push(json.telephone);
          if (json.email) data.emails.push(json.email);
          if (json.sameAs) data.socialLinks.push.apply(data.socialLinks, Array.isArray(json.sameAs) ? json.sameAs : [json.sameAs]);
          if (json.geo) data.geo = { lat: parseFloat(json.geo.latitude), lng: parseFloat(json.geo.longitude) };
          if (json.address) {
            var a = json.address;
            var parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean);
            if (parts.length) data.addresses.push(parts.join(", "));
          }
          if (json.contactPoint) {
            var cps = Array.isArray(json.contactPoint) ? json.contactPoint : [json.contactPoint];
            for (var c = 0; c < cps.length; c++) {
              var cp = cps[c];
              if (cp.email) data.emails.push(cp.email);
              if (cp.telephone) data.phones.push(cp.telephone);
              if (cp.name || cp.email) data.contacts.push({ name: cp.name || "", role: cp.contactType || "", email: cp.email || "" });
            }
          }
        }
        if (/Person/i.test(t) && json.name) {
          data.contacts.push({ name: json.name, role: json.jobTitle || "", email: json.email || "" });
        }
      } catch(e) {}
    }
  } catch(e) {}

  // Strategy B: Open Graph & Meta tags
  try {
    var og = function(n) { var el = document.querySelector('meta[property="'+n+'"]'); return el ? el.content : ""; };
    var mt = function(n) { var el = document.querySelector('meta[name="'+n+'"]'); return el ? el.content : ""; };
    data.meta = {
      siteName: og("og:site_name") || "",
      description: og("og:description") || mt("description") || "",
      author: mt("author") || "",
      canonical: (document.querySelector('link[rel="canonical"]') || {}).href || ""
    };
    if (!data.businessName && data.meta.siteName) data.businessName = data.meta.siteName;
  } catch(e) {}

  // Strategy C: Regex fallback on visible text
  try {
    var text = document.body.innerText || "";
    var emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    var phoneRe = /(?:\+?1[\-\s.]?)?\(?\d{3}\)?[\-\s.]?\d{3}[\-\s.]?\d{4}/g;
    var addrRe = /\d{1,5}\s+\w+(?:\s+\w+){0,3}\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Hwy|Highway|Circle|Cir)\b[.,]?\s*\w+[.,]?\s*[A-Z]{2}\s*\d{5}/gi;
    (text.match(emailRe) || []).forEach(function(e) { data.emails.push(e); });
    (text.match(phoneRe) || []).forEach(function(p) { data.phones.push(p); });
    (text.match(addrRe) || []).forEach(function(a) { data.addresses.push(a); });
  } catch(e) {}

  // Deduplicate
  data.emails = Array.from(new Set(data.emails));
  data.phones = Array.from(new Set(data.phones));
  data.addresses = Array.from(new Set(data.addresses));
  data.socialLinks = Array.from(new Set(data.socialLinks));

  // Scroll depth
  try {
    data.scrollDepth = Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
  } catch(e) {}

  return data;
})();
