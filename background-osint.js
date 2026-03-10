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

    return { success: true, metadata: results[0] };
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

    return { success: true, ...results[0] };
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
      const { watchlistMatches } = await browser.storage.local.get({ watchlistMatches: [] });
      watchlistMatches.unshift(...matches);
      // Keep last 500 matches
      if (watchlistMatches.length > 500) watchlistMatches.length = 500;
      await browser.storage.local.set({ watchlistMatches });

      // Fire notification
      const terms = matches.map(m => m.term).join(", ");
      browser.notifications.create(`watchlist-${Date.now()}`, {
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

    const key = `monitor-snapshots-${monitorId}`;
    const stored = await browser.storage.local.get({ [key]: [] });
    const snapshots = stored[key];

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

    const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const { analysisHistory } = await browser.storage.local.get({ analysisHistory: [] });

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

    const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const { analysisHistory } = await browser.storage.local.get({ analysisHistory: [] });

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

    const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
    const project = argusProjects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const { analysisHistory } = await browser.storage.local.get({ analysisHistory: [] });

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
// Message handler registration
// ──────────────────────────────────────────────
// Extends the existing browser.runtime.onMessage — MV2 supports
// multiple listeners; the first to return a truthy value wins.

browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.action) {
    // Metadata & Links
    case "extractMetadata":     return handleExtractMetadata(message);
    case "extractLinks":        return handleExtractLinks(message);

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
  }

  // Not our message — return undefined so other listeners can handle it
});
