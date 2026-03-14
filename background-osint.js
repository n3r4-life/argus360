// ══════════════════════════════════════════════════════════════
// OSINT Feature Handlers for Argus
// Loaded alongside background.js — shares the same scope.
// Uses: callProvider, getProviderSettings, buildMessages,
//       fetchPageText, saveToHistory, ANALYSIS_PRESETS, browser.*
// ══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// 1. Page Metadata Extraction
// ──────────────────────────────────────────────

async function handleExtractMetadata(message) {
  try {
    const tabId = message.tabId;

    // PDF fallback: extract metadata from PDF directly
    let tab;
    try {
      tab = await browser.tabs.get(tabId);
    } catch { /* ignore */ }
    if (tab && isPdfUrl(tab.url) && typeof pdfjsLib !== "undefined") {
      try {
        const resp = await fetch(tab.url);
        const buf = await resp.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const info = await pdf.getMetadata().catch(() => null);
        const pdfMeta = info?.info || {};
        return {
          success: true,
          metadata: {
            meta: {
              title: pdfMeta.Title || "",
              author: pdfMeta.Author || "",
              subject: pdfMeta.Subject || "",
              keywords: pdfMeta.Keywords || "",
              creator: pdfMeta.Creator || "",
              producer: pdfMeta.Producer || "",
              creationDate: pdfMeta.CreationDate || "",
              modDate: pdfMeta.ModDate || "",
              "pdf-version": pdf.pdfInfo?.pdfFormatVersion || ""
            },
            og: {},
            twitter: {},
            jsonLd: [],
            links: {},
            author: pdfMeta.Author ? { meta: pdfMeta.Author } : {},
            dates: {
              created: pdfMeta.CreationDate || "",
              modified: pdfMeta.ModDate || ""
            },
            lang: "",
            charset: "",
            _isPdf: true,
            _pdfPages: pdf.numPages
          }
        };
      } catch { /* fall through to normal extraction */ }
    }

    const results = await browser.tabs.executeScript(tabId, {
      code: `(function() {
        // ── Meta tags ──
        const meta = {};
        for (const el of document.querySelectorAll('meta[name], meta[property], meta[http-equiv]')) {
          const key = el.getAttribute('name') || el.getAttribute('property') || el.getAttribute('http-equiv');
          if (key) meta[key.toLowerCase()] = el.getAttribute('content') || '';
        }

        // ── Open Graph ──
        const og = {};
        for (const el of document.querySelectorAll('meta[property^="og:"]')) {
          const key = el.getAttribute('property');
          if (key) og[key] = el.getAttribute('content') || '';
        }

        // ── Twitter Card ──
        const twitter = {};
        for (const el of document.querySelectorAll('meta[name^="twitter:"], meta[property^="twitter:"]')) {
          const key = el.getAttribute('name') || el.getAttribute('property');
          if (key) twitter[key] = el.getAttribute('content') || '';
        }

        // ── JSON-LD ──
        const jsonLd = [];
        for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
          try { jsonLd.push(JSON.parse(el.textContent)); } catch {}
        }

        // ── Link elements ──
        const links = {};
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) links.canonical = canonical.getAttribute('href');
        const alternates = [];
        for (const el of document.querySelectorAll('link[rel="alternate"]')) {
          alternates.push({
            href: el.getAttribute('href') || '',
            type: el.getAttribute('type') || '',
            hreflang: el.getAttribute('hreflang') || ''
          });
        }
        if (alternates.length) links.alternate = alternates;

        // ── Author info ──
        const author = {};
        if (meta.author) author.meta = meta.author;
        const authorLink = document.querySelector('a[rel="author"]');
        if (authorLink) {
          author.link = { text: authorLink.textContent.trim(), href: authorLink.href };
        }
        // Check JSON-LD for author
        for (const ld of jsonLd) {
          const a = ld.author || (Array.isArray(ld['@graph']) && ld['@graph'].find(n => n['@type'] === 'Person'));
          if (a) {
            author.jsonLd = { name: a.name || '', url: a.url || '' };
            break;
          }
        }

        // ── Dates ──
        const dates = {};
        // From meta
        const dateMetas = ['date', 'article:published_time', 'article:modified_time',
          'datePublished', 'dateModified', 'DC.date', 'DC.date.created',
          'pubdate', 'publish_date', 'sailthru.date'];
        for (const dm of dateMetas) {
          if (meta[dm]) dates[dm] = meta[dm];
        }
        // OG dates
        if (og['og:updated_time']) dates['og:updated_time'] = og['og:updated_time'];
        // <time> elements
        const timeEls = document.querySelectorAll('time[datetime]');
        if (timeEls.length > 0) {
          dates.timeElements = Array.from(timeEls).slice(0, 10).map(t => ({
            datetime: t.getAttribute('datetime'),
            text: t.textContent.trim()
          }));
        }
        // JSON-LD dates
        for (const ld of jsonLd) {
          if (ld.datePublished) dates.jsonLdPublished = ld.datePublished;
          if (ld.dateModified) dates.jsonLdModified = ld.dateModified;
          if (ld.dateCreated) dates.jsonLdCreated = ld.dateCreated;
        }

        // ── Language / Charset ──
        const lang = document.documentElement.lang || meta['content-language'] || '';
        const charsetEl = document.querySelector('meta[charset]');
        const charset = charsetEl ? charsetEl.getAttribute('charset') : (meta['content-type'] || '');

        return { meta, og, twitter, jsonLd, links, author, dates, lang, charset };
      })()`
    });

    const metadata = results[0];

    // Auto-save to history for Reports timeline
    try {
      const tabInfo = await browser.tabs.get(message.tabId);
      const m = metadata;
      const lines = [];
      if (m.meta?.title) lines.push(`- **Title**: ${m.meta.title}`);
      if (m.meta?.description) lines.push(`- **Description**: ${m.meta.description}`);
      if (m.meta?.author || m.author?.meta) lines.push(`- **Author**: ${m.meta?.author || m.author?.meta}`);
      if (m.lang) lines.push(`- **Language**: ${m.lang}`);
      if (m.charset) lines.push(`- **Charset**: ${m.charset}`);
      const ogKeys = Object.keys(m.og || {});
      if (ogKeys.length) lines.push(`- **Open Graph**: ${ogKeys.length} tags`);
      const twKeys = Object.keys(m.twitter || {});
      if (twKeys.length) lines.push(`- **Twitter Cards**: ${twKeys.length} tags`);
      if (m.jsonLd?.length) lines.push(`- **JSON-LD**: ${m.jsonLd.length} block${m.jsonLd.length === 1 ? "" : "s"}`);
      const content = `# Metadata Extraction\n\n${lines.join("\n") || "No metadata found."}`;
      await saveToHistory({
        pageTitle: tabInfo.title || "Metadata Extraction",
        pageUrl: tabInfo.url || "",
        content,
        preset: "metadata-extract",
        presetLabel: "Metadata Extraction",
      });
    } catch (e) { console.warn("[Metadata] Failed to save to history:", e); }

    return { success: true, metadata };
  } catch (err) {
    return { success: false, error: err.message || "Failed to extract metadata" };
  }
}


// ──────────────────────────────────────────────
// 2. Link Extraction
// ──────────────────────────────────────────────

async function handleExtractLinks(message) {
  try {
    const tabId = message.tabId;
    const results = await browser.tabs.executeScript(tabId, {
      code: `(function() {
        const pageHost = window.location.hostname.replace(/^www\\./, '');
        const pageOrigin = window.location.origin;

        const socialPatterns = [
          { name: 'twitter', re: /(?:twitter\\.com|x\\.com)\\//i },
          { name: 'linkedin', re: /linkedin\\.com\\//i },
          { name: 'facebook', re: /(?:facebook\\.com|fb\\.com)\\//i },
          { name: 'github', re: /github\\.com\\//i },
          { name: 'youtube', re: /(?:youtube\\.com|youtu\\.be)\\//i },
          { name: 'instagram', re: /instagram\\.com\\//i },
          { name: 'reddit', re: /reddit\\.com\\//i },
          { name: 'tiktok', re: /tiktok\\.com\\//i },
          { name: 'mastodon', re: /mastodon\\.social\\//i },
          { name: 'threads', re: /threads\\.net\\//i },
          { name: 'bluesky', re: /bsky\\.app\\//i },
          { name: 'telegram', re: /t\\.me\\//i },
          { name: 'pinterest', re: /pinterest\\.com\\//i },
          { name: 'discord', re: /discord\\.(?:com|gg)\\//i }
        ];

        const fileExtensions = /\\.(?:pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip|rar|tar|gz|7z|mp3|mp4|avi|mov|wmv|png|jpg|jpeg|gif|svg|webp)$/i;

        const external = [];
        const internal = [];
        const social = [];
        const emails = [];
        const phones = [];
        const files = [];
        const domainCounts = {};
        const seen = new Set();

        for (const a of document.querySelectorAll('a[href]')) {
          const href = a.href;
          if (!href || seen.has(href)) continue;
          seen.add(href);

          const text = a.textContent.trim().slice(0, 200);

          // Mailto
          if (href.startsWith('mailto:')) {
            emails.push({ email: href.replace('mailto:', '').split('?')[0], text, href });
            continue;
          }

          // Tel
          if (href.startsWith('tel:')) {
            phones.push({ phone: href.replace('tel:', ''), text, href });
            continue;
          }

          // Anchor-only links (skip)
          if (href.startsWith('#') || (href.startsWith(pageOrigin) && new URL(href).pathname === window.location.pathname && new URL(href).hash)) {
            continue;
          }

          // Parse URL
          let url;
          try { url = new URL(href); } catch { continue; }

          const linkHost = url.hostname.replace(/^www\\./, '');
          const entry = { url: href, text, title: a.title || '' };

          // File links
          if (fileExtensions.test(url.pathname)) {
            files.push(entry);
          }

          // Social links
          let isSocial = false;
          for (const sp of socialPatterns) {
            if (sp.re.test(href)) {
              social.push({ ...entry, platform: sp.name });
              isSocial = true;
              break;
            }
          }

          if (!isSocial) {
            if (linkHost === pageHost || linkHost.endsWith('.' + pageHost)) {
              internal.push(entry);
            } else {
              external.push(entry);
              domainCounts[linkHost] = (domainCounts[linkHost] || 0) + 1;
            }
          }
        }

        // Stats
        const topDomains = Object.entries(domainCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([domain, count]) => ({ domain, count }));

        return {
          links: { external, internal, social, emails, phones, files },
          stats: {
            totalLinks: seen.size,
            uniqueDomains: Object.keys(domainCounts).length,
            topDomains
          }
        };
      })()`
    });

    const data = results[0];

    // Auto-save to history for Reports timeline
    try {
      const tab = await browser.tabs.get(message.tabId);
      const l = data.links;
      const s = data.stats;
      const lines = [];
      if (l.external?.length) lines.push(`- **External links**: ${l.external.length}`);
      if (l.internal?.length) lines.push(`- **Internal links**: ${l.internal.length}`);
      if (l.social?.length) lines.push(`- **Social links**: ${l.social.length}`);
      if (l.emails?.length) lines.push(`- **Email addresses**: ${l.emails.length}`);
      if (l.phones?.length) lines.push(`- **Phone numbers**: ${l.phones.length}`);
      if (l.files?.length) lines.push(`- **File links**: ${l.files.length}`);
      if (s.topDomains?.length) lines.push(`\n### Top Domains\n${s.topDomains.slice(0, 10).map(d => "- " + d.domain + " (" + d.count + ")").join("\n")}`);
      const content = `# Link Map\n\n**${s.totalLinks} links** across ${s.uniqueDomains} domains\n\n${lines.join("\n")}`;
      await saveToHistory({
        pageTitle: tab.title || "Link Map",
        pageUrl: tab.url || "",
        content,
        preset: "link-map",
        presetLabel: `Link Map (${s.totalLinks} links)`,
      });
    } catch (e) { console.warn("[LinkMap] Failed to save to history:", e); }

    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message || "Failed to extract links" };
  }
}


// ──────────────────────────────────────────────
// 3. Whois / DNS Lookup (RDAP + Google DNS)
// ──────────────────────────────────────────────

// In-memory cache with 24-hour TTL
const whoisCache = new Map();
const WHOIS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function extractDomain(input) {
  // Accept a domain string or a full URL
  try {
    if (input.includes("://")) {
      return new URL(input).hostname.replace(/^www\./, "");
    }
    return input.replace(/^www\./, "").split("/")[0];
  } catch {
    return input;
  }
}

function parseRdapResponse(data) {
  const result = {
    domain: data.ldhName || data.name || "",
    registrar: "",
    created: "",
    updated: "",
    expires: "",
    nameservers: [],
    status: data.status || [],
    registrant: {}
  };

  // Events: registration, expiration, last changed
  if (Array.isArray(data.events)) {
    for (const ev of data.events) {
      switch (ev.eventAction) {
        case "registration": result.created = ev.eventDate; break;
        case "expiration": result.expires = ev.eventDate; break;
        case "last changed": result.updated = ev.eventDate; break;
      }
    }
  }

  // Nameservers
  if (Array.isArray(data.nameservers)) {
    result.nameservers = data.nameservers.map(ns => ns.ldhName || ns.name || "").filter(Boolean);
  }

  // Entities (registrar, registrant, etc.)
  if (Array.isArray(data.entities)) {
    for (const entity of data.entities) {
      const roles = entity.roles || [];
      if (roles.includes("registrar")) {
        // Registrar name from vcardArray or publicIds
        if (entity.vcardArray && Array.isArray(entity.vcardArray[1])) {
          const fnEntry = entity.vcardArray[1].find(v => v[0] === "fn");
          if (fnEntry) result.registrar = fnEntry[3] || "";
        }
        if (!result.registrar && entity.publicIds) {
          result.registrar = entity.publicIds[0]?.identifier || "";
        }
        if (!result.registrar && entity.handle) {
          result.registrar = entity.handle;
        }
      }
      if (roles.includes("registrant")) {
        if (entity.vcardArray && Array.isArray(entity.vcardArray[1])) {
          const vcard = entity.vcardArray[1];
          const fn = vcard.find(v => v[0] === "fn");
          const org = vcard.find(v => v[0] === "org");
          const email = vcard.find(v => v[0] === "email");
          const adr = vcard.find(v => v[0] === "adr");
          result.registrant = {
            name: fn ? fn[3] : "",
            org: org ? org[3] : "",
            email: email ? email[3] : "",
            address: adr ? adr[3] : ""
          };
        }
      }
    }
  }

  return result;
}

async function handleWhoisLookup(message) {
  try {
    const domain = message.domain || extractDomain(message.url || "");
    if (!domain) return { success: false, error: "No domain provided" };

    // Check cache
    const cached = whoisCache.get(domain);
    if (cached && (Date.now() - cached.timestamp) < WHOIS_CACHE_TTL) {
      return { success: true, whois: cached.whois, dns: cached.dns, cached: true };
    }

    // Fetch RDAP and DNS in parallel
    const [rdapResp, dnsA, dnsNS, dnsMX] = await Promise.allSettled([
      fetch(`https://rdap.org/domain/${domain}`),
      fetch(`https://dns.google/resolve?name=${domain}&type=A`),
      fetch(`https://dns.google/resolve?name=${domain}&type=NS`),
      fetch(`https://dns.google/resolve?name=${domain}&type=MX`)
    ]);

    // Parse RDAP
    let whois = { domain, registrar: "", created: "", updated: "", expires: "", nameservers: [], status: [], registrant: {} };
    if (rdapResp.status === "fulfilled" && rdapResp.value.ok) {
      try {
        const rdapData = await rdapResp.value.json();
        whois = parseRdapResponse(rdapData);
      } catch { /* RDAP parse error — use defaults */ }
    }

    // Parse DNS records
    const dns = { a: [], ns: [], mx: [] };

    if (dnsA.status === "fulfilled" && dnsA.value.ok) {
      try {
        const data = await dnsA.value.json();
        if (data.Answer) dns.a = data.Answer.filter(r => r.type === 1).map(r => r.data);
      } catch { /* DNS-A parse error */ }
    }

    if (dnsNS.status === "fulfilled" && dnsNS.value.ok) {
      try {
        const data = await dnsNS.value.json();
        if (data.Answer) dns.ns = data.Answer.filter(r => r.type === 2).map(r => r.data.replace(/\.$/, ""));
      } catch { /* DNS-NS parse error */ }
    }

    if (dnsMX.status === "fulfilled" && dnsMX.value.ok) {
      try {
        const data = await dnsMX.value.json();
        if (data.Answer) {
          dns.mx = data.Answer
            .filter(r => r.type === 15)
            .map(r => {
              const parts = r.data.split(" ");
              return { priority: parseInt(parts[0]) || 0, exchange: (parts[1] || "").replace(/\.$/, "") };
            })
            .sort((a, b) => a.priority - b.priority);
        }
      } catch { /* DNS-MX parse error */ }
    }

    // Cache result
    whoisCache.set(domain, { whois, dns, timestamp: Date.now() });

    // Auto-save to history for Reports timeline (skip cached results)
    try {
      const lines = [];
      if (whois.registrar) lines.push(`- **Registrar**: ${whois.registrar}`);
      if (whois.created) lines.push(`- **Created**: ${whois.created}`);
      if (whois.expires) lines.push(`- **Expires**: ${whois.expires}`);
      if (whois.nameservers?.length) lines.push(`- **Nameservers**: ${whois.nameservers.join(", ")}`);
      if (dns.a?.length) lines.push(`- **A Records**: ${dns.a.join(", ")}`);
      if (dns.ns?.length) lines.push(`- **NS Records**: ${dns.ns.join(", ")}`);
      if (dns.mx?.length) lines.push(`- **MX Records**: ${dns.mx.map(r => r.exchange).join(", ")}`);
      if (whois.registrant?.name) lines.push(`- **Registrant**: ${whois.registrant.name}`);
      if (whois.registrant?.org) lines.push(`- **Organization**: ${whois.registrant.org}`);
      const content = `# Whois / DNS Lookup: ${domain}\n\n${lines.join("\n") || "No WHOIS data found."}`;
      await saveToHistory({
        pageTitle: domain,
        pageUrl: `https://${domain}`,
        content,
        preset: "whois-lookup",
        presetLabel: `Whois: ${domain}`,
      });
    } catch (e) { console.warn("[Whois] Failed to save to history:", e); }

    return { success: true, whois, dns, cached: false };
  } catch (err) {
    return { success: false, error: err.message || "Whois lookup failed" };
  }
}


// ──────────────────────────────────────────────
// 4. Wayback Machine Check
// ──────────────────────────────────────────────

const waybackCheckCache = new Map();

// Check Wayback availability for a given URL
async function checkWaybackAvailability(url) {
  try {
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const resp = await fetch(apiUrl);
    if (!resp.ok) return null;

    const data = await resp.json();
    const snapshot = data?.archived_snapshots?.closest;
    if (snapshot && snapshot.available && snapshot.url) {
      return {
        url: snapshot.url,
        timestamp: snapshot.timestamp || "",
        status: snapshot.status || ""
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Listener: check Wayback on page load (separate from archive.is listener)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:") || tab.url.startsWith("chrome:")) return;

  const { waybackCheckMode } = await browser.storage.local.get({ waybackCheckMode: "off" });
  if (waybackCheckMode === "off") return;

  try {
    const host = new URL(tab.url).hostname.replace(/^www\./, "");

    // Skip archive/wayback sites themselves
    if (host.includes("archive.org") || host.includes("web.archive.org")) return;

    // If mode is "redirect-list", only check domains on the redirect list
    if (waybackCheckMode === "redirect-list") {
      // archiveRedirectDomains is defined in background.js scope
      if (typeof archiveRedirectDomains !== "undefined") {
        const onList = archiveRedirectDomains.some(d => host === d || host.endsWith("." + d));
        if (!onList) return;
      }
    }

    // Don't re-check the same URL for the same tab within 5 minutes
    const cached = waybackCheckCache.get(tabId);
    if (cached && cached.url === tab.url && (Date.now() - cached.timestamp) < 300000) return;

    const snapshot = await checkWaybackAvailability(tab.url);
    waybackCheckCache.set(tabId, {
      url: tab.url,
      waybackUrl: snapshot ? snapshot.url : null,
      waybackTimestamp: snapshot ? snapshot.timestamp : null,
      timestamp: Date.now()
    });
  } catch {
    // Network error or Wayback down — silently skip
  }
});

// Clean up cache when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  waybackCheckCache.delete(tabId);
});

async function handleGetWaybackCheck(message) {
  try {
    const cached = waybackCheckCache.get(message.tabId);
    return {
      success: true,
      waybackUrl: cached?.waybackUrl || null,
      waybackTimestamp: cached?.waybackTimestamp || null,
      checked: !!cached
    };
  } catch (err) {
    return { success: false, error: err.message || "Failed to get Wayback check" };
  }
}


// ──────────────────────────────────────────────
// 5. Keyword Watchlist
// ──────────────────────────────────────────────

async function handleGetWatchlist() {
  try {
    const { argusWatchlist } = await browser.storage.local.get({ argusWatchlist: [] });
    return { success: true, watchlist: argusWatchlist };
  } catch (err) {
    return { success: false, error: err.message || "Failed to get watchlist" };
  }
}

async function handleAddWatchword(message) {
  try {
    const { argusWatchlist } = await browser.storage.local.get({ argusWatchlist: [] });

    const watchword = {
      id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      term: message.term || "",
      caseSensitive: !!message.caseSensitive,
      regex: !!message.regex,
      enabled: true,
      createdAt: new Date().toISOString()
    };

    if (!watchword.term) return { success: false, error: "Term is required" };

    // Validate regex if flagged as regex
    if (watchword.regex) {
      try {
        new RegExp(watchword.term, watchword.caseSensitive ? "" : "i");
      } catch (regexErr) {
        return { success: false, error: `Invalid regex: ${regexErr.message}` };
      }
    }

    argusWatchlist.push(watchword);
    await browser.storage.local.set({ argusWatchlist });
    return { success: true, watchword };
  } catch (err) {
    return { success: false, error: err.message || "Failed to add watchword" };
  }
}

async function handleDeleteWatchword(message) {
  try {
    const { argusWatchlist } = await browser.storage.local.get({ argusWatchlist: [] });
    const filtered = argusWatchlist.filter(w => w.id !== message.id);
    if (filtered.length === argusWatchlist.length) {
      return { success: false, error: "Watchword not found" };
    }
    await browser.storage.local.set({ argusWatchlist: filtered });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || "Failed to delete watchword" };
  }
}

async function handleUpdateWatchword(message) {
  try {
    const { argusWatchlist } = await browser.storage.local.get({ argusWatchlist: [] });
    const idx = argusWatchlist.findIndex(w => w.id === message.id);
    if (idx === -1) return { success: false, error: "Watchword not found" };

    const watchword = argusWatchlist[idx];
    if (message.term !== undefined) watchword.term = message.term;
    if (message.caseSensitive !== undefined) watchword.caseSensitive = message.caseSensitive;
    if (message.regex !== undefined) watchword.regex = message.regex;
    if (message.enabled !== undefined) watchword.enabled = message.enabled;

    // Validate updated regex
    if (watchword.regex) {
      try {
        new RegExp(watchword.term, watchword.caseSensitive ? "" : "i");
      } catch (regexErr) {
        return { success: false, error: `Invalid regex: ${regexErr.message}` };
      }
    }

    argusWatchlist[idx] = watchword;
    await browser.storage.local.set({ argusWatchlist });
    return { success: true, watchword };
  } catch (err) {
    return { success: false, error: err.message || "Failed to update watchword" };
  }
}

// Scan text against all enabled watchwords.
// Used by monitors, feeds, and other handlers.
async function scanForWatchwords(text, sourceType, sourceUrl, sourceTitle) {
  try {
    if (!text) return [];

    const { argusWatchlist } = await browser.storage.local.get({ argusWatchlist: [] });
    const enabledWords = argusWatchlist.filter(w => w.enabled);
    if (enabledWords.length === 0) return [];

    const matches = [];

    for (const watchword of enabledWords) {
      let found = false;
      let matchCount = 0;
      let snippets = [];

      if (watchword.regex) {
        // Regex matching
        try {
          const flags = watchword.caseSensitive ? "g" : "gi";
          const re = new RegExp(watchword.term, flags);
          let m;
          while ((m = re.exec(text)) !== null && matchCount < 10) {
            found = true;
            matchCount++;
            // Extract snippet around match (100 chars before/after)
            const start = Math.max(0, m.index - 100);
            const end = Math.min(text.length, m.index + m[0].length + 100);
            snippets.push(text.slice(start, end).replace(/\s+/g, " "));
          }
        } catch { continue; }
      } else {
        // Plain text matching
        const searchText = watchword.caseSensitive ? text : text.toLowerCase();
        const searchTerm = watchword.caseSensitive ? watchword.term : watchword.term.toLowerCase();
        let idx = 0;

        while ((idx = searchText.indexOf(searchTerm, idx)) !== -1 && matchCount < 10) {
          found = true;
          matchCount++;
          const start = Math.max(0, idx - 100);
          const end = Math.min(text.length, idx + searchTerm.length + 100);
          snippets.push(text.slice(start, end).replace(/\s+/g, " "));
          idx += searchTerm.length;
        }
      }

      if (found) {
        const matchEntry = {
          id: `wmatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          watchwordId: watchword.id,
          term: watchword.term,
          matchCount,
          snippets: snippets.slice(0, 5),
          sourceType: sourceType || "unknown",
          sourceUrl: sourceUrl || "",
          sourceTitle: sourceTitle || "",
          timestamp: new Date().toISOString()
        };
        matches.push(matchEntry);
      }
    }

    // If there are matches, persist them and notify
    if (matches.length > 0) {
      await ArgusDB.Watchlist.addMany(matches);
      await ArgusDB.Watchlist.prune(500);

      // Fire notification
      const terms = matches.map(m => m.term).join(", ");
      safeNotify(`watchlist-${Date.now()}`, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus Watchlist Alert",
        message: `Found: ${terms}\nSource: ${sourceTitle || sourceUrl || sourceType}`
      });
    }

    return matches;
  } catch (err) {
    console.error("scanForWatchwords error:", err);
    return [];
  }
}


// ──────────────────────────────────────────────
// 6. Monitor Diff
// ──────────────────────────────────────────────

// Simple LCS-based diff on arrays of lines.
// Returns array of { type: 'add' | 'remove' | 'same', text: string }
function computeLineDiff(oldLines, newLines) {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  // For very large inputs, cap to prevent excessive memory use
  if (m > 5000 || n > 5000) {
    // Fallback: simple sequential comparison for huge texts
    return computeSimpleDiff(oldLines, newLines);
  }

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build the diff
  const result = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "same", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "add", text: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "remove", text: oldLines[i - 1] });
      i--;
    }
  }

  result.reverse();
  return result;
}

// Fallback for very large texts: walk both arrays and compare sequentially
function computeSimpleDiff(oldLines, newLines) {
  const result = [];
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let oi = 0, ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      result.push({ type: "same", text: oldLines[oi] });
      oi++;
      ni++;
    } else if (oi < oldLines.length && !newSet.has(oldLines[oi])) {
      result.push({ type: "remove", text: oldLines[oi] });
      oi++;
    } else if (ni < newLines.length && !oldSet.has(newLines[ni])) {
      result.push({ type: "add", text: newLines[ni] });
      ni++;
    } else if (oi < oldLines.length) {
      result.push({ type: "remove", text: oldLines[oi] });
      oi++;
    } else {
      result.push({ type: "add", text: newLines[ni] });
      ni++;
    }
  }

  return result;
}

async function handleGetMonitorDiff(message) {
  try {
    const { monitorId, snapshotIndex1, snapshotIndex2 } = message;
    if (!monitorId) return { success: false, error: "monitorId is required" };

    const snapshots = await ArgusDB.Snapshots.getByMonitor(monitorId);

    const idx1 = snapshotIndex1 ?? 0;
    const idx2 = snapshotIndex2 ?? 1;

    if (!snapshots[idx1] || !snapshots[idx2]) {
      return { success: false, error: "One or both snapshot indices are out of range" };
    }

    const oldText = snapshots[idx1].text || "";
    const newText = snapshots[idx2].text || "";

    // Split into lines for diff
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");

    const diff = computeLineDiff(oldLines, newLines);

    return {
      success: true,
      diff,
      snapshot1: { index: idx1, capturedAt: snapshots[idx1].capturedAt },
      snapshot2: { index: idx2, capturedAt: snapshots[idx2].capturedAt }
    };
  } catch (err) {
    return { success: false, error: err.message || "Failed to compute diff" };
  }
}


// ──────────────────────────────────────────────
// 7. Connection Graph Builder
// ──────────────────────────────────────────────

async function handleBuildConnectionGraph(message) {
  try {
    const { projectId } = message;
    if (!projectId) return { success: false, error: "projectId is required" };

    const argusProjects = await ArgusDB.Projects.getAll();
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const analysisHistory = await ArgusDB.History.getAllSorted();

    // Map entity name -> node info
    const nodeMap = new Map();
    // Map "source--target" -> edge info
    const edgeMap = new Map();

    for (const item of project.items) {
      if (!item.url) continue;

      // Find entity extraction results in analysis history for this URL
      const analyses = analysisHistory.filter(h =>
        h.url === item.url && h.entities && Array.isArray(h.entities)
      );

      // Collect all entities from all analyses of this page
      const pageEntities = [];

      for (const analysis of analyses) {
        for (const entity of analysis.entities) {
          const key = `${entity.type || "unknown"}::${entity.name}`;

          if (!nodeMap.has(key)) {
            nodeMap.set(key, {
              id: key,
              label: entity.name,
              type: entity.type || "unknown",
              count: 0,
              pages: []
            });
          }

          const node = nodeMap.get(key);
          node.count++;
          if (!node.pages.includes(item.url)) {
            node.pages.push(item.url);
          }

          pageEntities.push(key);
        }
      }

      // Build co-occurrence edges for entities on the same page
      const uniqueEntities = [...new Set(pageEntities)];
      for (let i = 0; i < uniqueEntities.length; i++) {
        for (let j = i + 1; j < uniqueEntities.length; j++) {
          const source = uniqueEntities[i];
          const target = uniqueEntities[j];
          // Consistent key: alphabetical order
          const edgeKey = source < target ? `${source}||${target}` : `${target}||${source}`;

          if (!edgeMap.has(edgeKey)) {
            edgeMap.set(edgeKey, {
              source: source < target ? source : target,
              target: source < target ? target : source,
              weight: 0,
              pages: []
            });
          }

          const edge = edgeMap.get(edgeKey);
          edge.weight++;
          if (!edge.pages.includes(item.url)) {
            edge.pages.push(item.url);
          }
        }
      }
    }

    return {
      success: true,
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values())
    };
  } catch (err) {
    return { success: false, error: err.message || "Failed to build connection graph" };
  }
}


// ──────────────────────────────────────────────
// 8. Timeline Builder
// ──────────────────────────────────────────────

// Attempt to parse a date string into ISO format; returns null on failure
function tryParseDate(str) {
  if (!str) return null;
  // Handle common formats
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try numeric timestamps
  const num = Number(str);
  if (num > 1e12) {
    const d2 = new Date(num);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }
  return null;
}

async function handleBuildTimeline(message) {
  try {
    const { projectId } = message;
    if (!projectId) return { success: false, error: "projectId is required" };

    const argusProjects = await ArgusDB.Projects.getAll();
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const analysisHistory = await ArgusDB.History.getAllSorted();

    const events = [];

    for (const item of project.items) {
      const itemLabel = item.title || item.url || "Unknown";

      // 1. Check analysis history for this URL
      const analyses = analysisHistory.filter(h => h.url === item.url);

      for (const analysis of analyses) {
        // Entity-extracted dates
        if (analysis.entities && Array.isArray(analysis.entities)) {
          for (const entity of analysis.entities) {
            if (entity.type === "date" || entity.type === "event") {
              const parsed = tryParseDate(entity.value || entity.name);
              if (parsed) {
                events.push({
                  date: parsed,
                  event: entity.name || entity.value || "Date mentioned",
                  source: itemLabel,
                  url: item.url || ""
                });
              }
            }
          }
        }

        // Dates from metadata stored in analysis
        if (analysis.metadata) {
          const md = analysis.metadata;
          const metaDates = {
            "Published": md.datePublished || md["article:published_time"] || md.jsonLdPublished,
            "Modified": md.dateModified || md["article:modified_time"] || md.jsonLdModified
          };
          for (const [label, val] of Object.entries(metaDates)) {
            const parsed = tryParseDate(val);
            if (parsed) {
              events.push({
                date: parsed,
                event: `${label}: ${itemLabel}`,
                source: itemLabel,
                url: item.url || ""
              });
            }
          }
        }
      }

      // 2. Dates from item analysis content (simple heuristic extraction)
      if (item.analysisContent) {
        // Look for ISO dates or common date patterns in the text
        const isoDateRe = /\b(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}[^\s]*)?)\b/g;
        let match;
        const seen = new Set();
        while ((match = isoDateRe.exec(item.analysisContent)) !== null) {
          const parsed = tryParseDate(match[1]);
          if (parsed && !seen.has(parsed)) {
            seen.add(parsed);
            events.push({
              date: parsed,
              event: `Date found in analysis of ${itemLabel}`,
              source: itemLabel,
              url: item.url || ""
            });
          }
        }
      }

      // 3. Item addedAt as a fallback event
      if (item.addedAt) {
        events.push({
          date: item.addedAt,
          event: `Added to project: ${itemLabel}`,
          source: itemLabel,
          url: item.url || ""
        });
      }
    }

    // Sort chronologically
    events.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da - db;
    });

    return { success: true, events };
  } catch (err) {
    return { success: false, error: err.message || "Failed to build timeline" };
  }
}


// ──────────────────────────────────────────────
// 9. Investigation Report Generator
// ──────────────────────────────────────────────

async function handleGenerateReport(message) {
  try {
    const { projectId, sections } = message;
    if (!projectId) return { success: false, error: "projectId is required" };

    const argusProjects = await ArgusDB.Projects.getAll();
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const analysisHistory = await ArgusDB.History.getAllSorted();

    // Gather all data for the project
    const itemSummaries = [];
    for (const item of project.items) {
      const entry = {
        title: item.title || item.url || "Untitled",
        url: item.url || "",
        notes: item.notes || "",
        tags: item.tags || [],
        addedAt: item.addedAt || ""
      };

      // Attach analysis content if available
      if (item.analysisContent) {
        entry.analysis = item.analysisContent.slice(0, 3000);
      }

      // Attach entity info from history
      const relatedAnalyses = analysisHistory.filter(h => h.url === item.url);
      const entities = [];
      for (const analysis of relatedAnalyses) {
        if (analysis.entities && Array.isArray(analysis.entities)) {
          entities.push(...analysis.entities);
        }
      }
      if (entities.length > 0) {
        entry.entities = entities.slice(0, 50);
      }

      itemSummaries.push(entry);
    }

    // Build timeline data
    let timelineData;
    try {
      const tlResult = await handleBuildTimeline({ projectId });
      if (tlResult.success) timelineData = tlResult.events.slice(0, 50);
    } catch { /* timeline optional */ }

    // Build connection graph summary
    let graphData;
    try {
      const graphResult = await handleBuildConnectionGraph({ projectId });
      if (graphResult.success) {
        graphData = {
          nodeCount: graphResult.nodes.length,
          edgeCount: graphResult.edges.length,
          topNodes: graphResult.nodes
            .sort((a, b) => b.count - a.count)
            .slice(0, 20)
            .map(n => ({ label: n.label, type: n.type, count: n.count })),
          strongestEdges: graphResult.edges
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 20)
        };
      }
    } catch { /* graph optional */ }

    // Determine which sections to include
    const allSections = sections || [
      "executive_summary",
      "source_inventory",
      "key_entities",
      "timeline",
      "relationship_analysis",
      "credibility_assessment",
      "open_questions"
    ];

    // Build the mega-prompt
    const systemPrompt = `You are an expert OSINT analyst and investigative researcher. You produce clear, thorough, well-structured investigation reports. Cite sources by their title or URL. Be objective and precise. Flag uncertainty explicitly. Use markdown formatting throughout.`;

    const userPrompt = `Generate a comprehensive investigation report for the project "${project.name}"${project.description ? ` (${project.description})` : ""}.

## Project Data

### Sources (${itemSummaries.length} items)
${itemSummaries.map((item, i) => `
**Source ${i + 1}: ${item.title}**
URL: ${item.url}
Added: ${item.addedAt}
Tags: ${item.tags.join(", ") || "none"}
Notes: ${item.notes || "none"}
${item.analysis ? `Analysis excerpt:\n${item.analysis}` : ""}
${item.entities ? `Entities found: ${item.entities.map(e => `${e.name} (${e.type})`).join(", ")}` : ""}
`).join("\n---\n")}

${timelineData && timelineData.length > 0 ? `### Timeline Events
${timelineData.map(e => `- ${e.date}: ${e.event} [${e.source}]`).join("\n")}` : ""}

${graphData ? `### Entity Network
- ${graphData.nodeCount} unique entities, ${graphData.edgeCount} connections
- Top entities: ${graphData.topNodes.map(n => `${n.label} (${n.type}, mentioned ${n.count}x)`).join(", ")}` : ""}

## Required Report Sections
${allSections.includes("executive_summary") ? "1. **Executive Summary** — High-level overview of the investigation, key findings, and conclusions." : ""}
${allSections.includes("source_inventory") ? "2. **Source Inventory** — Catalog of all sources examined, with brief description and relevance assessment." : ""}
${allSections.includes("key_entities") ? "3. **Key Entities** — People, organizations, locations, and other entities identified across sources, with context." : ""}
${allSections.includes("timeline") ? "4. **Timeline of Events** — Chronological sequence of relevant events extracted from the sources." : ""}
${allSections.includes("relationship_analysis") ? "5. **Relationship Analysis** — Connections between entities, organizations, and events. Note patterns and networks." : ""}
${allSections.includes("credibility_assessment") ? "6. **Credibility Assessment** — Evaluate the reliability of each source. Note potential biases, conflicts of interest, or credibility concerns." : ""}
${allSections.includes("open_questions") ? "7. **Open Questions / Gaps** — Identify what is still unknown, what needs further investigation, and suggested next steps." : ""}

Produce the report now. Be thorough but concise. Use markdown headings, bullets, and bold text for clarity.`;

    // Get provider settings and call the AI
    const settings = await getProviderSettings(message.provider);
    const messages = buildMessages(systemPrompt, userPrompt);

    const result = await callProvider(
      settings.provider,
      settings.apiKey,
      settings.model,
      messages,
      { maxTokens: settings.maxTokens, temperature: settings.temperature }
    );

    if (!result || !result.content) {
      return { success: false, error: "No response from AI provider" };
    }

    // Save to history
    await saveToHistory({
      type: "investigation-report",
      title: `Investigation Report: ${project.name}`,
      url: "",
      provider: settings.provider,
      model: settings.model,
      preset: "investigation-report",
      content: result.content
    });

    return {
      success: true,
      report: result.content,
      provider: settings.provider,
      model: settings.model
    };
  } catch (err) {
    return { success: false, error: err.message || "Failed to generate report" };
  }
}


// ──────────────────────────────────────────────
// 10. Anomaly / Outlier Scan
// ──────────────────────────────────────────────

async function handleAnomalyScan(message) {
  try {
    const { projectId } = message;
    if (!projectId) return { success: false, error: "projectId is required" };

    const argusProjects = await ArgusDB.Projects.getAll();
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };
    if (!project.items || project.items.length === 0) {
      return { success: false, error: "Project has no items to scan" };
    }

    const analysisHistory = await ArgusDB.History.getAllSorted();

    // Gather item data with entity info
    const itemSummaries = [];
    const allDomains = new Set();
    const allEntities = new Map(); // name → { type, sources: Set, count }

    for (const item of project.items) {
      const entry = {
        title: item.title || item.url || "Untitled",
        url: item.url || "",
        tags: item.tags || [],
        notes: item.notes || ""
      };

      if (item.url) {
        try { allDomains.add(new URL(item.url).hostname.replace(/^www\./, "")); } catch {}
      }

      if (item.analysisContent) {
        entry.analysis = item.analysisContent.slice(0, 2000);
      }

      const relatedAnalyses = analysisHistory.filter(h => h.url === item.url);
      const entities = [];
      for (const analysis of relatedAnalyses) {
        if (analysis.entities && Array.isArray(analysis.entities)) {
          entities.push(...analysis.entities);
        }
      }
      if (entities.length > 0) {
        entry.entities = entities.slice(0, 40);
        for (const e of entities) {
          const key = (e.name || "").toLowerCase().trim();
          if (!key) continue;
          if (!allEntities.has(key)) {
            allEntities.set(key, { name: e.name, type: e.type, sources: new Set(), count: 0 });
          }
          const rec = allEntities.get(key);
          rec.count += e.mentions || 1;
          rec.sources.add(item.url || item.title);
        }
      }

      itemSummaries.push(entry);
    }

    // Find entities appearing in only one source
    const singleSourceEntities = [];
    for (const [, rec] of allEntities) {
      if (rec.sources.size === 1) {
        singleSourceEntities.push({ name: rec.name, type: rec.type, count: rec.count, source: [...rec.sources][0] });
      }
    }
    singleSourceEntities.sort((a, b) => b.count - a.count);

    // Optional: get graph data for relationship anomalies
    let graphSummary = "";
    try {
      const graphResult = await handleBuildConnectionGraph({ projectId });
      if (graphResult.success && graphResult.nodes.length > 0) {
        const isolatedNodes = graphResult.nodes.filter(n => {
          return !graphResult.edges.some(e => e.source === n.id || e.target === n.id);
        });
        const topConnected = graphResult.nodes
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map(n => `${n.label} (${n.type}, ${n.count}x)`);
        graphSummary = `\n### Network Summary\n- ${graphResult.nodes.length} entities, ${graphResult.edges.length} connections\n- Top connected: ${topConnected.join(", ")}\n- Isolated entities (no connections): ${isolatedNodes.length > 0 ? isolatedNodes.map(n => n.label).slice(0, 15).join(", ") : "none"}`;
      }
    } catch { /* graph optional */ }

    // Build the prompt
    const systemPrompt = `You are an expert OSINT analyst specializing in anomaly detection, pattern analysis, and investigative intelligence. Your job is to examine a collection of sources and their extracted data, then identify anything unusual, unexpected, or worth investigating further. Be specific, cite sources, and explain WHY something is anomalous. Use markdown formatting.`;

    const userPrompt = `Perform an anomaly and outlier scan on the project "${project.name}"${project.description ? ` (${project.description})` : ""}.

## Project Data

### Sources (${itemSummaries.length} items)
${itemSummaries.map((item, i) => `
**Source ${i + 1}: ${item.title}**
URL: ${item.url}
Tags: ${item.tags.join(", ") || "none"}
Notes: ${item.notes || "none"}
${item.analysis ? `Analysis excerpt:\n${item.analysis}` : ""}
${item.entities ? `Entities: ${item.entities.map(e => `${e.name} (${e.type})`).join(", ")}` : ""}
`).join("\n---\n")}

### Domains Referenced
${[...allDomains].join(", ") || "none"}

### Entities Appearing in Only One Source (potential outliers)
${singleSourceEntities.slice(0, 30).map(e => `- ${e.name} (${e.type}, ${e.count} mentions) — only in: ${e.source}`).join("\n") || "none"}
${graphSummary}

## Your Analysis Should Cover

1. **Data Anomalies** — Entities, claims, or data points that appear in only one source or contradict the pattern of the other sources. New or unfamiliar domains/entities that stand out.

2. **Pattern Breaks** — Sources or entities that don't fit the overall theme. Unexpected connections or missing expected connections.

3. **Temporal Anomalies** — Date references that are out of sequence, unusual timing patterns, or suspicious chronological gaps.

4. **Source Credibility Flags** — Domains or sources that seem inconsistent with the rest of the collection. Any signs of bias clustering or information monoculture.

5. **Entity Behavior** — Entities with unusually high or low mention counts relative to their apparent importance. Entities that appear across many sources vs. isolated ones.

6. **Investigative Leads** — Based on the anomalies found, suggest specific follow-up actions or searches that could resolve the unknowns.

Rate each finding as: 🔴 High (definitely unusual), 🟡 Medium (worth noting), 🟢 Low (minor observation).

Produce your anomaly report now.`;

    const settings = await getProviderSettings(message.provider);
    const messages = buildMessages(systemPrompt, userPrompt);

    const result = await callProvider(
      settings.provider,
      settings.apiKey,
      settings.model,
      messages,
      { maxTokens: settings.maxTokens, temperature: settings.temperature }
    );

    if (!result || !result.content) {
      return { success: false, error: "No response from AI provider" };
    }

    await saveToHistory({
      type: "anomaly-scan",
      title: `Anomaly Scan: ${project.name}`,
      url: "",
      provider: settings.provider,
      model: settings.model,
      preset: "anomaly-scan",
      content: result.content
    });

    return {
      success: true,
      content: result.content,
      provider: settings.provider,
      model: settings.model
    };
  } catch (err) {
    return { success: false, error: err.message || "Failed to run anomaly scan" };
  }
}


// ──────────────────────────────────────────────
// 11. Tech Stack Detector
// ──────────────────────────────────────────────

const TECH_SIGNATURES = {
  // CMS
  meta: [
    { pattern: /wordpress/i, name: "WordPress", category: "CMS" },
    { pattern: /drupal/i, name: "Drupal", category: "CMS" },
    { pattern: /joomla/i, name: "Joomla", category: "CMS" },
    { pattern: /ghost/i, name: "Ghost", category: "CMS" },
    { pattern: /hugo/i, name: "Hugo", category: "CMS" },
    { pattern: /jekyll/i, name: "Jekyll", category: "CMS" },
    { pattern: /typo3/i, name: "TYPO3", category: "CMS" },
    { pattern: /contentful/i, name: "Contentful", category: "CMS" },
    { pattern: /webflow/i, name: "Webflow", category: "CMS" },
    { pattern: /squarespace/i, name: "Squarespace", category: "CMS" },
    { pattern: /wix\.com/i, name: "Wix", category: "CMS" },
    { pattern: /blogger/i, name: "Blogger", category: "CMS" },
    { pattern: /medium/i, name: "Medium", category: "CMS" },
    { pattern: /shopify/i, name: "Shopify", category: "E-commerce" },
  ],
  paths: [
    { pattern: /\/wp-content\//i, name: "WordPress", category: "CMS" },
    { pattern: /\/wp-includes\//i, name: "WordPress", category: "CMS" },
    { pattern: /\/sites\/default\/files/i, name: "Drupal", category: "CMS" },
    { pattern: /\/media\/jui\//i, name: "Joomla", category: "CMS" },
    { pattern: /cdn\.shopify\.com/i, name: "Shopify", category: "E-commerce" },
    { pattern: /static\.squarespace\.com/i, name: "Squarespace", category: "CMS" },
    { pattern: /static\.wixstatic\.com/i, name: "Wix", category: "CMS" },
    { pattern: /\/ghost\//i, name: "Ghost", category: "CMS" },
    // JS Frameworks & Libraries
    { pattern: /react(?:\.production|\.development|dom)/i, name: "React", category: "Framework" },
    { pattern: /vue(?:\.runtime|\.global|\.esm)/i, name: "Vue.js", category: "Framework" },
    { pattern: /angular(?:\.min)?\.js/i, name: "Angular", category: "Framework" },
    { pattern: /svelte/i, name: "Svelte", category: "Framework" },
    { pattern: /next[\/-]/, name: "Next.js", category: "Framework" },
    { pattern: /_next\/static/i, name: "Next.js", category: "Framework" },
    { pattern: /__nuxt/i, name: "Nuxt.js", category: "Framework" },
    { pattern: /gatsby/i, name: "Gatsby", category: "Framework" },
    { pattern: /remix/i, name: "Remix", category: "Framework" },
    { pattern: /astro/i, name: "Astro", category: "Framework" },
    { pattern: /ember(?:\.min)?\.js/i, name: "Ember.js", category: "Framework" },
    { pattern: /backbone(?:\.min)?\.js/i, name: "Backbone.js", category: "JS Library" },
    { pattern: /jquery(?:\.min)?\.js/i, name: "jQuery", category: "JS Library" },
    { pattern: /lodash(?:\.min)?\.js/i, name: "Lodash", category: "JS Library" },
    { pattern: /moment(?:\.min)?\.js/i, name: "Moment.js", category: "JS Library" },
    { pattern: /axios(?:\.min)?\.js/i, name: "Axios", category: "JS Library" },
    { pattern: /d3(?:\.min)?\.js/i, name: "D3.js", category: "JS Library" },
    { pattern: /three(?:\.min)?\.js/i, name: "Three.js", category: "JS Library" },
    { pattern: /gsap/i, name: "GSAP", category: "JS Library" },
    { pattern: /swiper/i, name: "Swiper", category: "JS Library" },
    { pattern: /alpine(?:\.min)?\.js/i, name: "Alpine.js", category: "JS Library" },
    { pattern: /htmx(?:\.min)?\.js/i, name: "htmx", category: "JS Library" },
    { pattern: /turbo/i, name: "Turbo", category: "JS Library" },
    { pattern: /stimulus/i, name: "Stimulus", category: "JS Library" },
    // CSS Frameworks
    { pattern: /bootstrap(?:\.min)?\.(?:css|js)/i, name: "Bootstrap", category: "CSS" },
    { pattern: /tailwind/i, name: "Tailwind CSS", category: "CSS" },
    { pattern: /bulma(?:\.min)?\.css/i, name: "Bulma", category: "CSS" },
    { pattern: /foundation(?:\.min)?\.css/i, name: "Foundation", category: "CSS" },
    { pattern: /materialize(?:\.min)?\.css/i, name: "Materialize", category: "CSS" },
    { pattern: /material[\/-]ui/i, name: "Material UI", category: "CSS" },
    { pattern: /semantic(?:\.min)?\.css/i, name: "Semantic UI", category: "CSS" },
    { pattern: /animate(?:\.min)?\.css/i, name: "Animate.css", category: "CSS" },
    // Analytics
    { pattern: /google-analytics\.com\/analytics/i, name: "Google Analytics", category: "Analytics" },
    { pattern: /googletagmanager\.com/i, name: "Google Tag Manager", category: "Analytics" },
    { pattern: /gtag\/js/i, name: "Google Analytics (gtag)", category: "Analytics" },
    { pattern: /connect\.facebook\.net/i, name: "Facebook Pixel", category: "Analytics" },
    { pattern: /static\.hotjar\.com/i, name: "Hotjar", category: "Analytics" },
    { pattern: /cdn\.mxpnl\.com|api\.mixpanel\.com/i, name: "Mixpanel", category: "Analytics" },
    { pattern: /cdn\.segment\.com|api\.segment\.io/i, name: "Segment", category: "Analytics" },
    { pattern: /plausible\.io/i, name: "Plausible", category: "Analytics" },
    { pattern: /matomo/i, name: "Matomo", category: "Analytics" },
    { pattern: /clarity\.ms/i, name: "Microsoft Clarity", category: "Analytics" },
    { pattern: /amplitude/i, name: "Amplitude", category: "Analytics" },
    { pattern: /heap-\d+\.js|heapanalytics/i, name: "Heap", category: "Analytics" },
    // CDN
    { pattern: /cdnjs\.cloudflare\.com/i, name: "cdnjs", category: "CDN" },
    { pattern: /unpkg\.com/i, name: "unpkg", category: "CDN" },
    { pattern: /cdn\.jsdelivr\.net/i, name: "jsDelivr", category: "CDN" },
    { pattern: /ajax\.googleapis\.com/i, name: "Google CDN", category: "CDN" },
    { pattern: /stackpath\.bootstrapcdn\.com/i, name: "BootstrapCDN", category: "CDN" },
    // Fonts
    { pattern: /fonts\.googleapis\.com/i, name: "Google Fonts", category: "Other" },
    { pattern: /use\.typekit\.net/i, name: "Adobe Fonts (TypeKit)", category: "Other" },
    { pattern: /kit\.fontawesome\.com|fontawesome/i, name: "Font Awesome", category: "Other" },
    // Security
    { pattern: /recaptcha/i, name: "reCAPTCHA", category: "Security" },
    { pattern: /hcaptcha/i, name: "hCaptcha", category: "Security" },
    { pattern: /challenges\.cloudflare\.com/i, name: "Cloudflare Turnstile", category: "Security" },
    // Payments
    { pattern: /js\.stripe\.com/i, name: "Stripe", category: "Other" },
    { pattern: /paypal\.com\/sdk/i, name: "PayPal", category: "Other" },
    // E-commerce
    { pattern: /magento/i, name: "Magento", category: "E-commerce" },
    { pattern: /bigcommerce/i, name: "BigCommerce", category: "E-commerce" },
    { pattern: /woocommerce/i, name: "WooCommerce", category: "E-commerce" },
    // Chat / Support
    { pattern: /widget\.intercom\.io/i, name: "Intercom", category: "Other" },
    { pattern: /embed\.tawk\.to/i, name: "Tawk.to", category: "Other" },
    { pattern: /js\.driftt\.com/i, name: "Drift", category: "Other" },
    { pattern: /crisp\.chat/i, name: "Crisp", category: "Other" },
    { pattern: /livechatinc\.com/i, name: "LiveChat", category: "Other" },
    // Video
    { pattern: /player\.vimeo\.com/i, name: "Vimeo", category: "Other" },
    { pattern: /youtube\.com\/iframe_api/i, name: "YouTube Embed", category: "Other" },
  ],
  globals: [
    { check: "typeof React !== 'undefined'", name: "React", category: "Framework" },
    { check: "typeof Vue !== 'undefined'", name: "Vue.js", category: "Framework" },
    { check: "typeof angular !== 'undefined'", name: "AngularJS", category: "Framework" },
    { check: "typeof ng !== 'undefined' && typeof ng.getComponent === 'function'", name: "Angular", category: "Framework" },
    { check: "typeof jQuery !== 'undefined' || typeof $ === 'function' && $.fn && $.fn.jquery", name: "jQuery", category: "JS Library", version: "typeof jQuery !== 'undefined' ? jQuery.fn.jquery : (typeof $ === 'function' && $.fn ? $.fn.jquery : '')" },
    { check: "typeof _ !== 'undefined' && typeof _.VERSION === 'string'", name: "Lodash/Underscore", category: "JS Library", version: "typeof _ !== 'undefined' ? _.VERSION : ''" },
    { check: "typeof __NEXT_DATA__ !== 'undefined'", name: "Next.js", category: "Framework" },
    { check: "typeof __NUXT__ !== 'undefined'", name: "Nuxt.js", category: "Framework" },
    { check: "typeof Shopify !== 'undefined'", name: "Shopify", category: "E-commerce" },
    { check: "typeof wp !== 'undefined' && typeof wp.customize !== 'undefined'", name: "WordPress", category: "CMS" },
    { check: "typeof Drupal !== 'undefined'", name: "Drupal", category: "CMS" },
    { check: "typeof ga !== 'undefined' || typeof gtag !== 'undefined'", name: "Google Analytics", category: "Analytics" },
    { check: "typeof dataLayer !== 'undefined' && Array.isArray(dataLayer)", name: "Google Tag Manager", category: "Analytics" },
    { check: "typeof fbq !== 'undefined'", name: "Facebook Pixel", category: "Analytics" },
    { check: "typeof Stripe !== 'undefined'", name: "Stripe", category: "Other" },
    { check: "typeof Sentry !== 'undefined'", name: "Sentry", category: "Other" },
    { check: "typeof twemoji !== 'undefined'", name: "Twemoji", category: "Other" },
    { check: "typeof Turbo !== 'undefined'", name: "Turbo", category: "JS Library" },
    { check: "typeof htmx !== 'undefined'", name: "htmx", category: "JS Library" },
    { check: "typeof Alpine !== 'undefined'", name: "Alpine.js", category: "JS Library" },
    { check: "typeof gsap !== 'undefined'", name: "GSAP", category: "JS Library" },
  ],
  headers: [
    { header: "server", patterns: [
      { pattern: /apache/i, name: "Apache", category: "Server" },
      { pattern: /nginx/i, name: "Nginx", category: "Server" },
      { pattern: /microsoft-iis/i, name: "IIS", category: "Server" },
      { pattern: /cloudflare/i, name: "Cloudflare", category: "Server" },
      { pattern: /litespeed/i, name: "LiteSpeed", category: "Server" },
      { pattern: /openresty/i, name: "OpenResty", category: "Server" },
      { pattern: /envoy/i, name: "Envoy", category: "Server" },
      { pattern: /caddy/i, name: "Caddy", category: "Server" },
    ]},
    { header: "x-powered-by", patterns: [
      { pattern: /php/i, name: "PHP", category: "Server" },
      { pattern: /asp\.net/i, name: "ASP.NET", category: "Server" },
      { pattern: /express/i, name: "Express.js", category: "Framework" },
      { pattern: /next\.js/i, name: "Next.js", category: "Framework" },
      { pattern: /nuxt/i, name: "Nuxt.js", category: "Framework" },
      { pattern: /rails/i, name: "Ruby on Rails", category: "Framework" },
      { pattern: /django/i, name: "Django", category: "Framework" },
      { pattern: /flask/i, name: "Flask", category: "Framework" },
      { pattern: /laravel/i, name: "Laravel", category: "Framework" },
    ]},
    { header: "x-generator", patterns: [
      { pattern: /drupal/i, name: "Drupal", category: "CMS" },
      { pattern: /wordpress/i, name: "WordPress", category: "CMS" },
      { pattern: /joomla/i, name: "Joomla", category: "CMS" },
    ]},
  ],
  cookies: [
    { pattern: /PHPSESSID/i, name: "PHP", category: "Server" },
    { pattern: /ASP\.NET_SessionId/i, name: "ASP.NET", category: "Server" },
    { pattern: /JSESSIONID/i, name: "Java (Servlet)", category: "Server" },
    { pattern: /laravel_session/i, name: "Laravel", category: "Framework" },
    { pattern: /rack\.session/i, name: "Ruby/Rack", category: "Framework" },
    { pattern: /connect\.sid/i, name: "Express.js", category: "Framework" },
    { pattern: /_shopify/i, name: "Shopify", category: "E-commerce" },
    { pattern: /wp-settings/i, name: "WordPress", category: "CMS" },
  ]
};

async function handleDetectTechStack(message) {
  try {
    const tabId = message.tabId;
    const detected = new Map(); // name -> tech object (deduplication)

    function addTech(name, category, conf, method, version) {
      const key = name.toLowerCase();
      if (detected.has(key)) {
        const existing = detected.get(key);
        // Upgrade confidence
        const confOrder = { high: 3, medium: 2, low: 1 };
        if ((confOrder[conf] || 0) > (confOrder[existing.confidence] || 0)) {
          existing.confidence = conf;
        }
        if (version && !existing.version) existing.version = version;
        if (!existing.methods.includes(method)) existing.methods.push(method);
      } else {
        detected.set(key, { name, category, confidence: conf, version: version || "", methods: [method] });
      }
    }

    // 1. Inject content script for DOM + JS global detection
    const results = await browser.tabs.executeScript(tabId, {
      code: `(function() {
        const techs = [];

        // Meta generator
        const gen = document.querySelector('meta[name="generator"]');
        if (gen) techs.push({ source: 'meta', value: gen.getAttribute('content') || '' });

        // All script srcs
        const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
        techs.push({ source: 'scripts', value: scripts });

        // All link hrefs (stylesheets, preloads)
        const links = Array.from(document.querySelectorAll('link[href]')).map(l => l.href);
        techs.push({ source: 'links', value: links });

        // HTML comments (first 50)
        const comments = [];
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
        let commentCount = 0;
        while (walker.nextNode() && commentCount < 50) {
          comments.push(walker.currentNode.textContent.trim().slice(0, 200));
          commentCount++;
        }
        techs.push({ source: 'comments', value: comments });

        // JS globals
        const globals = [];
        ${TECH_SIGNATURES.globals.map(g =>
          `try { if (${g.check}) globals.push({ name: ${JSON.stringify(g.name)}, category: ${JSON.stringify(g.category)}, version: ${g.version ? `(function(){ try { return ${g.version}; } catch { return ''; } })()` : "''"} }); } catch {}`
        ).join('\n        ')}

        techs.push({ source: 'globals', value: globals });

        return techs;
      })()`
    });

    const domData = results[0] || [];

    // Process meta generator
    const metaEntry = domData.find(d => d.source === "meta");
    if (metaEntry && metaEntry.value) {
      const genValue = metaEntry.value;
      for (const sig of TECH_SIGNATURES.meta) {
        if (sig.pattern.test(genValue)) {
          const vMatch = genValue.match(/[\d]+(?:\.[\d]+)*/);
          addTech(sig.name, sig.category, "high", "meta", vMatch ? vMatch[0] : "");
        }
      }
    }

    // Process script/link paths
    const scriptEntry = domData.find(d => d.source === "scripts");
    const linkEntry = domData.find(d => d.source === "links");
    const allPaths = [...(scriptEntry?.value || []), ...(linkEntry?.value || [])];

    for (const path of allPaths) {
      for (const sig of TECH_SIGNATURES.paths) {
        if (sig.pattern.test(path)) {
          const vMatch = path.match(/[\/@-]([\d]+(?:\.[\d]+)*)/);
          addTech(sig.name, sig.category, "medium", "path", vMatch ? vMatch[1] : "");
        }
      }
    }

    // Process comments
    const commentEntry = domData.find(d => d.source === "comments");
    if (commentEntry && commentEntry.value) {
      for (const comment of commentEntry.value) {
        for (const sig of TECH_SIGNATURES.meta) {
          if (sig.pattern.test(comment)) {
            addTech(sig.name, sig.category, "low", "comment", "");
          }
        }
      }
    }

    // Process JS globals
    const globalEntry = domData.find(d => d.source === "globals");
    if (globalEntry && globalEntry.value) {
      for (const g of globalEntry.value) {
        addTech(g.name, g.category, "high", "global", g.version || "");
      }
    }

    // 2. Fetch response headers
    try {
      const tab = await browser.tabs.get(tabId);
      if (tab.url && !tab.url.startsWith("about:") && !tab.url.startsWith("moz-extension:")) {
        const resp = await fetch(tab.url, { method: "HEAD", redirect: "follow" });
        const headers = {};
        resp.headers.forEach((val, key) => { headers[key.toLowerCase()] = val; });

        // Match header patterns
        for (const hSpec of TECH_SIGNATURES.headers) {
          const hVal = headers[hSpec.header];
          if (!hVal) continue;
          for (const p of hSpec.patterns) {
            if (p.pattern.test(hVal)) {
              const vMatch = hVal.match(/[\d]+(?:\.[\d]+)*/);
              addTech(p.name, p.category, "high", "header", vMatch ? vMatch[0] : "");
            }
          }
        }

        // Special headers
        if (headers["x-drupal-cache"] !== undefined) addTech("Drupal", "CMS", "high", "header", "");
        if (headers["x-varnish"] !== undefined) addTech("Varnish", "Server", "medium", "header", "");
        if (headers["x-cache"]) {
          if (/cloudfront/i.test(headers["x-cache"])) addTech("AWS CloudFront", "CDN", "high", "header", "");
        }
        if (/cloudflare/i.test(headers["cf-ray"] || headers["server"] || "")) {
          addTech("Cloudflare", "CDN", "high", "header", "");
        }
        if (headers["x-vercel-id"] !== undefined) addTech("Vercel", "Server", "high", "header", "");
        if (headers["x-netlify"] !== undefined || headers["x-nf-request-id"] !== undefined) addTech("Netlify", "Server", "high", "header", "");
        if (headers["x-amz-cf-id"] !== undefined) addTech("AWS CloudFront", "CDN", "high", "header", "");
        if (headers["x-fastly-request-id"] !== undefined) addTech("Fastly", "CDN", "high", "header", "");
        if (headers["x-cdn"] && /akamai/i.test(headers["x-cdn"])) addTech("Akamai", "CDN", "high", "header", "");
        if (headers["x-served-by"] && /cache/i.test(headers["x-served-by"])) addTech("Fastly", "CDN", "low", "header", "");

        // Cookie-based detection
        const cookies = headers["set-cookie"] || "";
        for (const cSig of TECH_SIGNATURES.cookies) {
          if (cSig.pattern.test(cookies)) {
            addTech(cSig.name, cSig.category, "medium", "cookie", "");
          }
        }
      }
    } catch { /* header fetch failed — continue with DOM-only results */ }

    // Build final array
    const technologies = Array.from(detected.values()).map(t => ({
      name: t.name,
      category: t.category,
      version: t.version,
      confidence: t.confidence,
      method: t.methods.join(", ")
    }));

    // Sort: high confidence first, then by category
    const confOrder = { high: 0, medium: 1, low: 2 };
    technologies.sort((a, b) => (confOrder[a.confidence] || 9) - (confOrder[b.confidence] || 9) || a.category.localeCompare(b.category));

    return { success: true, technologies };
  } catch (err) {
    return { success: false, error: err.message || "Tech stack detection failed" };
  }
}


// ──────────────────────────────────────────────
// 11. Entity Mention Heatmap
// ──────────────────────────────────────────────

async function handleBuildHeatmap(message) {
  try {
    const { projectId } = message;
    if (!projectId) return { success: false, error: "projectId is required" };

    const argusProjects = await ArgusDB.Projects.getAll();
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const analysisHistory = await ArgusDB.History.getAllSorted();

    // Collect entity data per page
    const pageMap = new Map(); // url -> { title, url, index }
    const entityMap = new Map(); // "type::name" -> { name, type, totalMentions, pageCounts: Map<url, count> }

    for (const item of project.items) {
      if (!item.url) continue;

      const pageKey = item.url;
      if (!pageMap.has(pageKey)) {
        pageMap.set(pageKey, { title: item.title || item.url, url: item.url });
      }

      // Find entity extraction results for this URL
      const analyses = analysisHistory.filter(h =>
        h.url === item.url && h.entities && Array.isArray(h.entities)
      );

      for (const analysis of analyses) {
        for (const entity of analysis.entities) {
          const key = `${(entity.type || "other").toLowerCase()}::${entity.name}`;

          if (!entityMap.has(key)) {
            entityMap.set(key, {
              name: entity.name,
              type: (entity.type || "other").toLowerCase(),
              totalMentions: 0,
              pageCounts: new Map()
            });
          }

          const entry = entityMap.get(key);
          entry.totalMentions++;
          entry.pageCounts.set(pageKey, (entry.pageCounts.get(pageKey) || 0) + 1);
        }
      }
    }

    // Build matrix
    const pages = Array.from(pageMap.values());
    const entities = Array.from(entityMap.values())
      .sort((a, b) => b.totalMentions - a.totalMentions)
      .slice(0, 100) // Cap at 100 entities
      .map(e => ({ name: e.name, type: e.type, totalMentions: e.totalMentions }));

    const cells = [];
    for (const entityEntry of Array.from(entityMap.values()).sort((a, b) => b.totalMentions - a.totalMentions).slice(0, 100)) {
      const row = [];
      for (const page of pages) {
        row.push(entityEntry.pageCounts.get(page.url) || 0);
      }
      cells.push(row);
    }

    return {
      success: true,
      matrix: { entities, pages, cells },
      projectName: project.name
    };
  } catch (err) {
    return { success: false, error: err.message || "Failed to build heatmap" };
  }
}


// ──────────────────────────────────────────────
// 12. Geolocation Map
// ──────────────────────────────────────────────

const GEOCODE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const GEOCODE_SKIP_WORDS = new Set(["the", "this", "that", "and", "for", "not", "but", "are", "was", "has", "its", "all", "any", "our", "can", "had", "her", "him", "his", "how", "its", "may", "new", "now", "old", "one", "our", "own", "two", "way", "who", "why", "yes"]);

async function geocodeLocation(name) {
  // Skip very short or generic terms
  if (!name || name.length < 3) return null;
  const lower = name.toLowerCase().trim();
  if (GEOCODE_SKIP_WORDS.has(lower)) return null;
  if (/^\d+$/.test(lower)) return null;

  // Check cache
  const { geocodeCache } = await browser.storage.local.get({ geocodeCache: {} });
  const cached = geocodeCache[lower];
  if (cached) {
    if (Date.now() - cached.timestamp < GEOCODE_CACHE_TTL) {
      return cached.lat !== null ? { lat: cached.lat, lng: cached.lng } : null;
    }
  }

  // Rate limit: wait 1 second
  await new Promise(r => setTimeout(r, 1100));

  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`,
      { headers: { "User-Agent": "Argus-Extension/1.0" } }
    );

    if (!resp.ok) return null;
    const data = await resp.json();

    let result = null;
    if (data && data.length > 0) {
      result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }

    // Cache result (including null for "not found")
    geocodeCache[lower] = {
      lat: result ? result.lat : null,
      lng: result ? result.lng : null,
      timestamp: Date.now()
    };
    await browser.storage.local.set({ geocodeCache });

    return result;
  } catch {
    return null;
  }
}

async function handleBuildGeomap(message) {
  try {
    const { projectId } = message;
    if (!projectId) return { success: false, error: "projectId is required" };

    const argusProjects = await ArgusDB.Projects.getAll();
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const analysisHistory = await ArgusDB.History.getAllSorted();

    // Collect location entities
    const locationMap = new Map(); // name -> { name, type, mentions, sources: [{title, url}] }

    const locationTypes = new Set(["location", "city", "country", "address", "place", "geo", "state", "region", "continent"]);

    for (const item of project.items) {
      if (!item.url) continue;

      const analyses = analysisHistory.filter(h =>
        h.url === item.url && h.entities && Array.isArray(h.entities)
      );

      for (const analysis of analyses) {
        for (const entity of analysis.entities) {
          const type = (entity.type || "").toLowerCase();
          if (!locationTypes.has(type)) continue;

          const key = entity.name.toLowerCase().trim();
          if (!locationMap.has(key)) {
            locationMap.set(key, {
              name: entity.name,
              type: type,
              mentions: 0,
              sources: []
            });
          }

          const entry = locationMap.get(key);
          entry.mentions++;
          if (!entry.sources.some(s => s.url === item.url)) {
            entry.sources.push({ title: item.title || item.url, url: item.url });
          }
        }
      }
    }

    // Geocode all locations (with rate limiting built into geocodeLocation)
    const locations = [];
    for (const [, loc] of locationMap) {
      const coords = await geocodeLocation(loc.name);
      if (coords) {
        locations.push({
          name: loc.name,
          type: loc.type,
          lat: coords.lat,
          lng: coords.lng,
          mentions: loc.mentions,
          sources: loc.sources
        });
      }
    }

    return {
      success: true,
      locations,
      projectName: project.name,
      totalEntities: locationMap.size,
      geocoded: locations.length
    };
  } catch (err) {
    return { success: false, error: err.message || "Failed to build geomap" };
  }
}


// ──────────────────────────────────────────────
// Down Detector / Pulse Check
// ──────────────────────────────────────────────

async function handlePulseCheck(message) {
  const urls = message.urls || [];
  if (!urls.length) return { success: false, error: "No URLs to check" };

  const results = await Promise.all(urls.map(async (url) => {
    // Normalize URL
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    try { new URL(target); } catch { return { url: target, status: "invalid", error: "Invalid URL" }; }

    const entry = { url: target, domain: new URL(target).hostname };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const start = performance.now();

      // Try HEAD first (lighter), fall back to GET if HEAD is blocked (405, etc.)
      let resp;
      try {
        resp = await fetch(target, {
          method: "HEAD",
          mode: "no-cors",
          credentials: "omit",
          redirect: "follow",
          signal: controller.signal
        });
      } catch {
        resp = await fetch(target, {
          method: "GET",
          mode: "no-cors",
          credentials: "omit",
          redirect: "follow",
          signal: controller.signal
        });
      }

      const elapsed = Math.round(performance.now() - start);
      clearTimeout(timeout);

      // no-cors gives opaque responses (status 0) — that still means the server responded
      const httpStatus = resp.status || 0;
      const isOpaque = resp.type === "opaque";

      let status;
      if (isOpaque) {
        // Opaque = server responded but CORS blocked details — treat as up
        status = elapsed > 5000 ? "slow" : "up";
      } else if (httpStatus >= 200 && httpStatus < 400) {
        status = elapsed > 5000 ? "slow" : "up";
      } else if (httpStatus >= 500) {
        status = "down";
      } else if (httpStatus >= 400) {
        status = "degraded";
      } else {
        status = "unknown";
      }

      return { ...entry, status, httpStatus, responseTime: elapsed, isOpaque, checkedAt: Date.now() };
    } catch (err) {
      const isTimeout = err.name === "AbortError";
      return {
        ...entry,
        status: isTimeout ? "timeout" : "down",
        error: isTimeout ? "Request timed out (15s)" : err.message,
        checkedAt: Date.now()
      };
    }
  }));

  return { success: true, results };
}

async function handlePulseListGet() {
  const data = await browser.storage.local.get("argus-pulse-list");
  return { success: true, urls: data["argus-pulse-list"] || [] };
}

async function handlePulseListSave(message) {
  await browser.storage.local.set({ "argus-pulse-list": message.urls || [] });
  return { success: true };
}


// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Image Grabber — extract all images from a page
// ──────────────────────────────────────────────

async function handleExtractImages(message) {
  try {
    const tabId = message.tabId;
    const minWidth = message.minWidth || 50;
    const minHeight = message.minHeight || 50;

    const results = await browser.tabs.executeScript(tabId, {
      code: `(function() {
        const seen = new Set();
        const images = [];

        function normalizeUrl(raw) {
          try {
            const u = new URL(raw, location.href);
            u.hash = "";
            // Strip common CDN resize/quality params that create duplicates
            for (const p of ["w","h","width","height","size","resize","quality","q","fit","auto","format","fm","dpr"]) {
              u.searchParams.delete(p);
            }
            return u.href;
          } catch { return null; }
        }

        function addImage(src, alt, w, h, source) {
          if (!src) return;
          // Skip data URIs that are tiny (tracking pixels, spacers)
          if (src.startsWith("data:") && src.length < 500) return;
          // Skip common tracking/ad patterns
          if (/1x1|pixel|spacer|blank\\.gif|beacon/i.test(src)) return;
          const resolved = normalizeUrl(src);
          if (!resolved || seen.has(resolved)) return;
          seen.add(resolved);
          try {
            const url = new URL(resolved);
            images.push({
              src: url.href,
              alt: (alt || "").trim().slice(0, 200),
              width: w || 0,
              height: h || 0,
              source: source,
              filename: decodeURIComponent(url.pathname.split("/").pop() || "image"),
            });
          } catch {}
        }

        // Standard img elements
        document.querySelectorAll("img").forEach(img => {
          const src = img.currentSrc || img.src;
          addImage(src, img.alt, img.naturalWidth || img.width, img.naturalHeight || img.height, "img");
        });

        // Picture > source elements (responsive images)
        document.querySelectorAll("picture source").forEach(source => {
          const srcset = source.srcset;
          if (srcset) {
            srcset.split(",").forEach(s => {
              const url = s.trim().split(/\\s+/)[0];
              addImage(url, "", 0, 0, "picture");
            });
          }
        });

        // CSS background images
        document.querySelectorAll("*").forEach(el => {
          const bg = getComputedStyle(el).backgroundImage;
          if (bg && bg !== "none") {
            const match = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
            if (match) addImage(match[1], "", el.offsetWidth, el.offsetHeight, "css-bg");
          }
        });

        // Video posters
        document.querySelectorAll("video[poster]").forEach(v => {
          addImage(v.poster, "Video poster", v.width, v.height, "video-poster");
        });

        // Open Graph / meta images
        document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:image:url"]').forEach(m => {
          addImage(m.content, "Meta image", 0, 0, "meta");
        });

        // Favicons / icons
        document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(l => {
          addImage(l.href, "Favicon/Icon", 0, 0, "favicon");
        });

        // SVG images (inline)
        document.querySelectorAll("svg image").forEach(img => {
          addImage(img.getAttribute("href") || img.getAttribute("xlink:href"), "", 0, 0, "svg");
        });

        return {
          images: images,
          pageUrl: location.href,
          pageTitle: document.title,
        };
      })();`
    });

    const data = results?.[0];
    if (!data || !data.images) return { success: false, error: "No image data returned" };

    // Deduplicate by base path (strip query strings) — keep the version with largest dimensions
    const byBase = new Map();
    for (const img of data.images) {
      // Filter out images below minimum size if we know dimensions
      if (img.width && img.height && (img.width < minWidth || img.height < minHeight)) continue;
      // Try to determine file type from URL
      const ext = (img.filename.match(/\.(jpe?g|png|gif|webp|svg|avif|bmp|ico|tiff?)$/i) || [])[1] || "";
      img.type = ext.toLowerCase() || (img.src.startsWith("data:") ? (img.src.match(/data:image\/(\w+)/)?.[1] || "unknown") : "unknown");
      // Dedup key: strip all query params to catch CDN variants
      let baseKey;
      try { const u = new URL(img.src); baseKey = u.origin + u.pathname; } catch { baseKey = img.src; }
      const existing = byBase.get(baseKey);
      if (!existing || (img.width * img.height) > (existing.width * existing.height)) {
        byBase.set(baseKey, img);
      }
    }
    const enriched = [...byBase.values()];

    console.log(`[ImageGrabber] Found ${enriched.length} images on ${data.pageUrl}`);

    const stats = {
      total: enriched.length,
      bySource: enriched.reduce((acc, img) => { acc[img.source] = (acc[img.source] || 0) + 1; return acc; }, {}),
      byType: enriched.reduce((acc, img) => { acc[img.type] = (acc[img.type] || 0) + 1; return acc; }, {}),
    };

    // Auto-save to history for Reports timeline
    try {
      const srcLines = Object.entries(stats.bySource).map(([s, n]) => `- ${s}: ${n}`).join("\n");
      const typeLines = Object.entries(stats.byType).map(([t, n]) => `- ${t}: ${n}`).join("\n");
      const imgList = enriched.slice(0, 30).map(img => `- ${img.filename || "image"} (${img.width || "?"}x${img.height || "?"}) — ${img.src.slice(0, 100)}`).join("\n");
      const content = `# Image Scan Results\n\n**${enriched.length} images** found\n\n## By Source\n${srcLines}\n\n## By Type\n${typeLines}\n\n## Images\n${imgList}${enriched.length > 30 ? "\n- ..." : ""}`;
      await saveToHistory({
        pageTitle: data.pageTitle || "Image Scan",
        pageUrl: data.pageUrl || "",
        content,
        preset: "image-scan",
        presetLabel: `Image Scan (${enriched.length} images)`,
      });
    } catch (e) { console.warn("[ImageGrabber] Failed to save to history:", e); }

    return {
      success: true,
      images: enriched,
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle,
      stats
    };
  } catch (e) {
    console.error("[ImageGrabber] Failed:", e);
    return { success: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// Regex Page Scanner — extract patterns from source
// ──────────────────────────────────────────────

async function handleRegexScanPage(message) {
  try {
    const tabId = message.tabId;
    const results = await browser.tabs.executeScript(tabId, {
      code: `(function() {
        const html = document.documentElement.outerHTML;
        const text = document.body.innerText;
        const patterns = {
          emails:      { re: /[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/g, src: html },
          ipv4:        { re: /\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b/g, src: html },
          phones:      { re: /(?:\\+?1[\\-\\s.]?)?\\(?\\d{3}\\)?[\\-\\s.]?\\d{3}[\\-\\s.]?\\d{4}/g, src: text },
          urls:        { re: /https?:\\/\\/[^\\s"'<>\\)\\]}{]+/g, src: html },
          domains:     { re: /\\b(?:[a-zA-Z0-9\\-]+\\.)+(?:com|org|net|gov|edu|io|co|info|biz|me|dev|app|xyz|uk|de|fr|jp|ru|cn|au|ca|nl|se|ch|es|it|br|in|kr|za)\\b/g, src: html },
          hashes_md5:  { re: /\\b[a-fA-F0-9]{32}\\b/g, src: html },
          hashes_sha1: { re: /\\b[a-fA-F0-9]{40}\\b/g, src: html },
          hashes_sha256: { re: /\\b[a-fA-F0-9]{64}\\b/g, src: html },
          btc_addr:    { re: /\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b/g, src: text },
          ssn:         { re: /\\b\\d{3}[\\-\\s]?\\d{2}[\\-\\s]?\\d{4}\\b/g, src: text },
          credit_card: { re: /\\b(?:4\\d{3}|5[1-5]\\d{2}|6011|3[47]\\d{2})[\\-\\s]?\\d{4}[\\-\\s]?\\d{4}[\\-\\s]?\\d{4}\\b/g, src: text },
          jwt:         { re: /eyJ[A-Za-z0-9_\\-]+\\.eyJ[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+/g, src: html },
          api_keys:    { re: /(?:api[_\\-]?key|apikey|token|secret|access[_\\-]?key)[\\s]*[:=][\\s]*["']?([a-zA-Z0-9_\\-]{16,})["']?/gi, src: html },
          aws_keys:    { re: /AKIA[0-9A-Z]{16}/g, src: html },
          base64_blobs:{ re: /[A-Za-z0-9+\\/]{40,}={0,2}/g, src: html },
          social_handles: { re: /@[a-zA-Z0-9_]{1,30}/g, src: text },
        };
        const found = {};
        let totalMatches = 0;
        for (const [name, { re, src }] of Object.entries(patterns)) {
          const matches = [...new Set((src.match(re) || []))];
          if (matches.length > 0) {
            found[name] = matches.slice(0, 200); // cap per category
            totalMatches += matches.length;
          }
        }
        return { found, totalMatches, htmlLength: html.length, textLength: text.length, html, text };
      })();`
    });

    const data = results?.[0];
    if (!data) return { success: false, error: "No data returned from page scan" };

    console.log(`[RegexScan] Found ${data.totalMatches} matches across ${Object.keys(data.found).length} categories`);

    // Auto-save to history for Reports timeline
    try {
      const tab = await browser.tabs.get(message.tabId);
      const cats = Object.entries(data.found);
      const summary = cats.map(([cat, matches]) => `- **${cat.replace(/_/g, " ")}**: ${matches.length} match${matches.length === 1 ? "" : "es"}`).join("\n");
      const details = cats.map(([cat, matches]) => `### ${cat.replace(/_/g, " ")}\n\`\`\`\n${matches.slice(0, 20).join("\n")}${matches.length > 20 ? "\n..." : ""}\n\`\`\``).join("\n\n");
      const content = `# Regex Scan Results\n\n**${data.totalMatches} matches** across ${cats.length} categories\n\n${summary}\n\n${details}`;
      await saveToHistory({
        pageTitle: tab.title || "Regex Scan",
        pageUrl: tab.url || "",
        content,
        preset: "regex-scan",
        presetLabel: `Regex Scan (${data.totalMatches} matches)`,
      });
    } catch (e) { console.warn("[RegexScan] Failed to save to history:", e); }

    return { success: true, ...data };
  } catch (e) {
    console.error("[RegexScan] Failed:", e);
    return { success: false, error: e.message };
  }
}

// Custom regex re-scan — runs a user-supplied pattern on the original tab
async function handleRegexScanCustom(message) {
  try {
    const { pattern, source, url } = message;
    // Find the tab by URL
    const tabs = await browser.tabs.query({ url: url || undefined });
    const tab = tabs?.[0];
    if (!tab) return { success: false, error: "Source tab not found. It may have been closed." };

    const srcVar = source === "text" ? "document.body.innerText" : "document.documentElement.outerHTML";
    const escaped = pattern.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const results = await browser.tabs.executeScript(tab.id, {
      code: `(function() {
        try {
          const re = new RegExp('${escaped}', 'gi');
          const src = ${srcVar};
          const matches = [...new Set((src.match(re) || []))].slice(0, 500);
          return { matches };
        } catch(e) { return { error: e.message }; }
      })();`
    });
    const data = results?.[0];
    if (!data) return { success: false, error: "No response from tab" };
    if (data.error) return { success: false, error: data.error };
    return { success: true, matches: data.matches };
  } catch (e) {
    console.error("[RegexScanCustom] Failed:", e);
    return { success: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// Multi-Tab Image Grabber
// ──────────────────────────────────────────────

async function handleExtractImagesMultiTab(message) {
  try {
    const allTabs = await browser.tabs.query({ currentWindow: true });
    // Filter out extension pages, about: pages, etc.
    let validTabs = allTabs.filter(t =>
      t.url && (t.url.startsWith("http://") || t.url.startsWith("https://"))
    );
    // If specific tab IDs provided, filter to only those
    if (message.tabIds && Array.isArray(message.tabIds) && message.tabIds.length > 0) {
      const idSet = new Set(message.tabIds);
      validTabs = validTabs.filter(t => idSet.has(t.id));
    }

    if (validTabs.length === 0) {
      return { success: false, error: "No web pages open to grab images from." };
    }

    const allImages = [];
    const tabSources = []; // { tabId, url, title, imageCount }
    const globalSeen = new Set();

    for (const tab of validTabs) {
      try {
        const resp = await handleExtractImages({ tabId: tab.id, minWidth: message?.minWidth || 50, minHeight: message?.minHeight || 50 });
        if (resp.success && resp.images.length > 0) {
          let added = 0;
          for (const img of resp.images) {
            // Cross-tab deduplication by URL
            if (globalSeen.has(img.src)) continue;
            globalSeen.add(img.src);
            img.tabUrl = tab.url;
            img.tabTitle = tab.title || tab.url;
            img.tabId = tab.id;
            allImages.push(img);
            added++;
          }
          if (added > 0) {
            tabSources.push({ tabId: tab.id, url: tab.url, title: tab.title || tab.url, imageCount: added });
          }
        }
      } catch (e) {
        console.warn(`[ImageGrabber] Skipped tab ${tab.id} (${tab.url}):`, e.message);
      }
    }

    if (allImages.length === 0) {
      return { success: false, error: "No images found across open tabs." };
    }

    console.log(`[ImageGrabber] Multi-tab: ${allImages.length} images from ${tabSources.length} tabs`);

    return {
      success: true,
      data: {
        images: allImages,
        pageUrl: `${tabSources.length} tabs`,
        pageTitle: `Images from ${tabSources.length} tabs (${allImages.length} total)`,
        multiTab: true,
        tabSources,
        stats: {
          total: allImages.length,
          bySource: allImages.reduce((acc, img) => { acc[img.source] = (acc[img.source] || 0) + 1; return acc; }, {}),
          byType: allImages.reduce((acc, img) => { acc[img.type] = (acc[img.type] || 0) + 1; return acc; }, {}),
        }
      }
    };
  } catch (e) {
    console.error("[ImageGrabber] Multi-tab failed:", e);
    return { success: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// AI Image Search — vision-based filtering
// ──────────────────────────────────────────────

async function handleAiImageSearch(message) {
  const { query, images, provider: providerOverride } = message;
  if (!query || !images || images.length === 0) {
    return { success: false, error: "No query or images provided." };
  }

  try {
    const settings = await getProviderSettings(providerOverride || null);
    const BATCH_SIZE = 4; // images per API call (balance cost vs speed)
    const MAX_IMAGES = 40; // cap to avoid excessive API usage
    const toScan = images.slice(0, MAX_IMAGES);
    const matches = [];

    // Fetch and convert images to base64 in parallel batches
    async function fetchAsBase64(url) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        // Skip very large images (>5MB) to stay within token limits
        if (blob.size > 5 * 1024 * 1024) return null;
        const mimeType = blob.type || "image/jpeg";
        // Only process actual images
        if (!mimeType.startsWith("image/")) return null;
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return { base64: btoa(binary), mimeType };
      } catch { return null; }
    }

    const systemPrompt = `You are an image analysis assistant. You will be shown images and a search query. For each image, determine if it matches the query. Respond ONLY with a JSON array of booleans — one per image, in order. Example: [true, false, true, false]. No explanation, no markdown, just the JSON array.`;

    // Process in batches
    for (let i = 0; i < toScan.length; i += BATCH_SIZE) {
      const batch = toScan.slice(i, i + BATCH_SIZE);
      const imageDataList = [];
      const batchIndices = [];

      // Fetch all images in this batch in parallel
      const fetched = await Promise.all(batch.map(img => fetchAsBase64(img.src)));
      for (let j = 0; j < fetched.length; j++) {
        if (fetched[j]) {
          imageDataList.push(fetched[j]);
          batchIndices.push(i + j);
        }
      }

      if (imageDataList.length === 0) continue;

      const userPrompt = `Search query: "${query}"\n\nI'm showing you ${imageDataList.length} image(s). For each one, does it match or relate to the query "${query}"? Return a JSON array of ${imageDataList.length} booleans.`;

      try {
        const result = await callProviderVision(
          settings.provider, settings.apiKey, settings.model,
          systemPrompt, userPrompt, imageDataList,
          { maxTokens: 256, temperature: 0.1 }
        );

        // Parse the boolean array from the response
        const text = result.content.trim();
        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const bools = JSON.parse(jsonMatch[0]);
          for (let k = 0; k < bools.length; k++) {
            if (bools[k] === true && batchIndices[k] !== undefined) {
              matches.push(batchIndices[k]);
            }
          }
        }
      } catch (e) {
        console.warn(`[AiImageSearch] Batch ${i} failed:`, e.message);
        // Continue with remaining batches
      }

      // Report progress via storage for the UI to poll
      await browser.storage.local.set({
        [`ai-search-progress-${message.searchId}`]: {
          scanned: Math.min(i + BATCH_SIZE, toScan.length),
          total: toScan.length,
          matches: matches.length
        }
      });
    }

    // Clean up progress key
    if (message.searchId) {
      await browser.storage.local.remove(`ai-search-progress-${message.searchId}`);
    }

    console.log(`[AiImageSearch] "${query}" — ${matches.length} matches out of ${toScan.length} images`);
    return { success: true, matchIndices: matches, total: toScan.length };
  } catch (e) {
    console.error("[AiImageSearch] Failed:", e);
    return { success: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// Message handler registration
// ──────────────────────────────────────────────
// Extends the existing browser.runtime.onMessage — MV2 supports
// multiple listeners; the first to return a truthy value wins.

browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.action) {
    // Metadata & Links
    case "extractMetadata":     return handleExtractMetadata(message);
    case "extractLinks":        return handleExtractLinks(message);
    case "extractImages":       return handleExtractImages(message);
    case "extractImagesMultiTab": return handleExtractImagesMultiTab(message);
    case "regexScanPage":       return handleRegexScanPage(message);
    case "regexScanCustom":     return handleRegexScanCustom(message);
    case "aiImageSearch":       return handleAiImageSearch(message);

    // Whois / DNS
    case "whoisLookup":         return handleWhoisLookup(message);

    // Wayback Machine
    case "getWaybackCheck":     return handleGetWaybackCheck(message);

    // Watchlist
    case "getWatchlist":        return handleGetWatchlist();
    case "addWatchword":        return handleAddWatchword(message);
    case "deleteWatchword":     return handleDeleteWatchword(message);
    case "updateWatchword":     return handleUpdateWatchword(message);

    // Monitor Diff
    case "getMonitorDiff":      return handleGetMonitorDiff(message);

    // Connection Graph
    case "buildConnectionGraph": return handleBuildConnectionGraph(message);

    // Timeline
    case "buildTimeline":       return handleBuildTimeline(message);

    // Investigation Report
    case "generateReport":      return handleGenerateReport(message);

    // Tech Stack
    case "detectTechStack":     return handleDetectTechStack(message);

    // Heatmap
    case "buildHeatmap":        return handleBuildHeatmap(message);

    // Geomap
    case "buildGeomap":         return handleBuildGeomap(message);

    // Anomaly Scan
    case "anomalyScan":         return handleAnomalyScan(message);

    // Down Detector / Pulse
    case "pulseCheck":          return handlePulseCheck(message);
    case "pulseListGet":        return handlePulseListGet();
    case "pulseListSave":       return handlePulseListSave(message);
  }

  // Not our message — return undefined so other listeners can handle it
});
