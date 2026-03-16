// ──────────────────────────────────────────────
// Core background script — router, context menus, analysis, and feature modules
// Presets & provider config: background-presets.js
// Provider API calls: background-providers.js
// Permission helpers: background-permissions.js
const ARGUS_BG_VERSION = "2026-03-12a";
console.log(`[Argus] background.js loaded — version ${ARGUS_BG_VERSION}`);

// Remind users to wipe data before uninstalling (Firefox doesn't auto-clear extension data)
try { browser.runtime.setUninstallURL("about:blank"); } catch(e) { /* optional */ }

// Vault: on startup, remove any leftover plaintext copies of sensitive data
if (typeof ArgusVault !== "undefined") {
  ArgusVault.onStartup().catch(e => console.warn("[Vault] startup cleanup:", e.message));
}
// OSINT tools: background-osint.js
// ──────────────────────────────────────────────

// NOTE: ANALYSIS_PRESETS, PROVIDERS, BROWSER_LANG_MAP, getLanguageInstruction
// are defined in background-presets.js (loaded before this file)

// NOTE: All provider call functions, getProviderSettings, parseSSEStream
// are defined in background-providers.js (loaded before this file)

// ──────────────────────────────────────────────
// In-memory conversation history (keyed by tab ID)
// ──────────────────────────────────────────────
const conversationHistory = new Map();

// Clean up on tab close/navigate
browser.tabs.onRemoved.addListener(tabId => {
  conversationHistory.delete(tabId);
  feedDetectionCache.delete(tabId);
});

// ── RSS/Atom feed detection cache (tabId → { feedUrl, feedTitle }) ──
const feedDetectionCache = new Map();

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    conversationHistory.delete(tabId);
    feedDetectionCache.delete(tabId);
  }
  if (changeInfo.url || changeInfo.status === "complete") updateBrowserActionForTab(tabId);
  // Auto-detect RSS/Atom feeds when page finishes loading
  if (changeInfo.status === "complete") detectFeedOnTab(tabId);
  // Page Tracker: record visit when page finishes loading
  if (changeInfo.status === "complete" && tab?.url) {
    trackPageVisit(tab.url, tab.title, tab.favIconUrl).then(() => {
      trawlCollect(tabId, tab.url);
    });
  }
});

// ──────────────────────────────────────────────
// Page Tracker — independent browsing history
// ──────────────────────────────────────────────
async function trackPageVisit(url, title, favicon) {
  try {
    const { trackMyPages } = await browser.storage.local.get({ trackMyPages: false });
    if (!trackMyPages) return;
    // Skip internal pages
    if (!url || url.startsWith("about:") || url.startsWith("moz-extension:") || url.startsWith("chrome:") || url.startsWith("chrome-extension:")) return;
    await ArgusDB.PageTracker.trackVisit(url, title, favicon);
  } catch (e) { console.warn("[PageTracker] visit error:", e); }
}

async function trackPageAction(url, actionType, detail) {
  try {
    const { trackMyPages } = await browser.storage.local.get({ trackMyPages: false });
    if (!trackMyPages) return;
    if (!url) return;
    await ArgusDB.PageTracker.logAction(url, actionType, detail);
  } catch (e) { console.warn("[PageTracker] action error:", e); }
}

// ──────────────────────────────────────────────
// Trawl Net — passive contact/business extraction
// ──────────────────────────────────────────────
const TRAWL_SKIP_RE = /^(about:|moz-extension:|chrome:|chrome-extension:|file:)/;

// ── Trawl schedule guard ──
// trawlSchedule: { enabled:bool, days:[0-6], startHour:0-23, endHour:0-23 }
async function isTrawlScheduleAllowed() {
  const { trawlSchedule } = await browser.storage.local.get({ trawlSchedule: null });
  if (!trawlSchedule || !trawlSchedule.enabled) return true; // no schedule = always allowed
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const hour = now.getHours();
  if (!trawlSchedule.days.includes(day)) return false;
  const start = trawlSchedule.startHour ?? 0;
  const end = trawlSchedule.endHour ?? 23;
  if (start <= end) return hour >= start && hour <= end;
  // Overnight range (e.g. 22–6)
  return hour >= start || hour <= end;
}

// ── Trawl duration guard ──
// trawlExpireAt: timestamp ms — when the current timed session ends
async function isTrawlDurationAllowed() {
  const { trawlExpireAt } = await browser.storage.local.get({ trawlExpireAt: null });
  if (!trawlExpireAt) return true; // no timer active = always allowed
  if (Date.now() > trawlExpireAt) {
    // Timer expired — auto-disable trawl and clear expiry
    await browser.storage.local.set({ trawlEnabled: false, trawlExpireAt: null });
    return false;
  }
  return true;
}

async function trawlCollect(tabId, url) {
  try {
    if (!url || TRAWL_SKIP_RE.test(url)) return;
    const { trawlEnabled } = await browser.storage.local.get({ trawlEnabled: false });
    if (!trawlEnabled) return;
    // Respect schedule window
    if (!(await isTrawlScheduleAllowed())) return;
    // Respect duration timer — auto-disables when expired
    if (!(await isTrawlDurationAllowed())) return;
    // Check domain exclusion (forced-private list)
    const { incognitoForceEnabled, incognitoSites } = await browser.storage.local.get({ incognitoForceEnabled: false, incognitoSites: [] });
    if (incognitoForceEnabled && incognitoSites.length) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (incognitoSites.some(d => host === d || host.endsWith("." + d))) return;
      } catch {}
    }
    const results = await browser.tabs.executeScript(tabId, {
      code: `(function() {
        const data = { emails:[], phones:[], addresses:[], businessName:"", contacts:[], socialLinks:[], geo:null, schema:null, meta:{}, scrollDepth:0, extractedAt:Date.now() };
        // Strategy A: JSON-LD / Schema.org
        try {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const s of scripts) {
            try {
              let json = JSON.parse(s.textContent);
              if (Array.isArray(json)) json = json[0];
              const t = json["@type"] || "";
              if (/Organization|LocalBusiness|Person|Store|Restaurant|Hotel|MedicalBusiness|LegalService|FinancialService|RealEstateAgent/i.test(t)) {
                data.schema = { type: t, raw: json };
                data.businessName = json.name || json.legalName || "";
                if (json.telephone) data.phones.push(json.telephone);
                if (json.email) data.emails.push(json.email);
                if (json.sameAs) data.socialLinks.push(...(Array.isArray(json.sameAs) ? json.sameAs : [json.sameAs]));
                if (json.geo) data.geo = { lat: parseFloat(json.geo.latitude), lng: parseFloat(json.geo.longitude) };
                if (json.address) {
                  const a = json.address;
                  const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean);
                  if (parts.length) data.addresses.push(parts.join(", "));
                }
                if (json.contactPoint) {
                  const cps = Array.isArray(json.contactPoint) ? json.contactPoint : [json.contactPoint];
                  for (const cp of cps) {
                    if (cp.email) data.emails.push(cp.email);
                    if (cp.telephone) data.phones.push(cp.telephone);
                    if (cp.name || cp.email) data.contacts.push({ name: cp.name || "", role: cp.contactType || "", email: cp.email || "" });
                  }
                }
              }
              if (/Person/i.test(t) && json.name) {
                data.contacts.push({ name: json.name, role: json.jobTitle || "", email: json.email || "" });
              }
            } catch {}
          }
        } catch {}
        // Strategy B: Open Graph & Meta tags
        try {
          const og = (n) => { const el = document.querySelector('meta[property="'+n+'"]'); return el ? el.content : ""; };
          const mt = (n) => { const el = document.querySelector('meta[name="'+n+'"]'); return el ? el.content : ""; };
          data.meta = { siteName: og("og:site_name") || "", description: og("og:description") || mt("description") || "", author: mt("author") || "", canonical: (document.querySelector('link[rel="canonical"]') || {}).href || "" };
          if (!data.businessName && data.meta.siteName) data.businessName = data.meta.siteName;
        } catch {}
        // Strategy C: Regex fallback on visible text
        try {
          const text = document.body.innerText || "";
          const emailRe = /[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/g;
          const phoneRe = /(?:\\+?1[\\-\\s.]?)?\\(?\\d{3}\\)?[\\-\\s.]?\\d{3}[\\-\\s.]?\\d{4}/g;
          const addrRe = /\\d{1,5}\\s+\\w+(?:\\s+\\w+){0,3}\\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Hwy|Highway|Circle|Cir)\\b[.,]?\\s*\\w+[.,]?\\s*[A-Z]{2}\\s*\\d{5}/gi;
          (text.match(emailRe) || []).forEach(e => data.emails.push(e));
          (text.match(phoneRe) || []).forEach(p => data.phones.push(p));
          (text.match(addrRe) || []).forEach(a => data.addresses.push(a));
        } catch {}
        // Deduplicate
        data.emails = [...new Set(data.emails)];
        data.phones = [...new Set(data.phones)];
        data.addresses = [...new Set(data.addresses)];
        data.socialLinks = [...new Set(data.socialLinks)];
        // Scroll depth
        try { data.scrollDepth = Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)); } catch {}
        return data;
      })();`
    });
    const data = results?.[0];
    if (!data) return;
    const hasData = data.emails.length || data.phones.length || data.addresses.length || data.businessName || data.contacts.length || data.socialLinks.length;
    if (!hasData) return;
    // Fetch existing entry to detect new data for automation triggers
    const prevEntry = await ArgusDB.PageTracker.getByUrl(url);
    const prevTD = prevEntry?.trawlData || {};
    await ArgusDB.PageTracker.setTrawlData(url, data);
    console.log(`[Trawl] collected from ${new URL(url).hostname}: ${data.emails.length}e ${data.phones.length}p ${data.addresses.length}a`);

    // ── Phase 3: KG entity feed ──
    trawlFeedKG(url, prevEntry?.title || "", data).catch(() => {});

    // ── Phase 3: Automation triggers ──
    trawlFireAutomationTriggers(url, data, prevTD).catch(() => {});
  } catch (e) {
    // Content script injection may fail on restricted pages — silent
  }
}

// ── Phase 3: Feed trawl-extracted entities into KnowledgeGraph ──
async function trawlFeedKG(url, title, trawlData) {
  if (typeof KnowledgeGraph === "undefined") return;
  const src = url;
  const srcTitle = title || url;

  // Business / Organization
  if (trawlData.businessName) {
    await KnowledgeGraph.upsertEntity(
      { name: trawlData.businessName, type: "organization" },
      src, srcTitle
    );
  }

  // Contacts as Person nodes + affiliated-with edges to business
  for (const c of (trawlData.contacts || [])) {
    if (!c.name) continue;
    const personNode = await KnowledgeGraph.upsertEntity(
      { name: c.name, type: "person", role: c.role || "" },
      src, srcTitle
    );
    // Link person → business
    if (personNode && trawlData.businessName) {
      const bizNode = await KnowledgeGraph.findBestMatch(trawlData.businessName, "organization");
      if (bizNode) {
        await KnowledgeGraph.upsertEdge(personNode.id, bizNode.id, "affiliated-with", src, srcTitle);
      }
    }
  }

  // Addresses as Location nodes + located-in edges to business
  for (const addr of (trawlData.addresses || [])) {
    const locNode = await KnowledgeGraph.upsertEntity(
      { name: addr, type: "location" },
      src, srcTitle
    );
    if (locNode && trawlData.businessName) {
      const bizNode = await KnowledgeGraph.findBestMatch(trawlData.businessName, "organization");
      if (bizNode) {
        await KnowledgeGraph.upsertEdge(bizNode.id, locNode.id, "located-in", src, srcTitle);
      }
    }
  }
}

// ── Phase 3: Fire automation triggers on new trawl data ──
async function trawlFireAutomationTriggers(url, newData, prevData) {
  if (typeof AutomationEngine === "undefined") return;
  const newEmails = (newData.emails || []).filter(e => !(prevData.emails || []).includes(e));
  const newPhones = (newData.phones || []).filter(p => !(prevData.phones || []).includes(p));
  const newBiz = newData.businessName && newData.businessName !== prevData.businessName;

  if (!newEmails.length && !newPhones.length && !newBiz) return;

  const triggerData = {
    url,
    hostname: (() => { try { return new URL(url).hostname; } catch { return url; } })(),
    newEmails,
    newPhones,
    newBusinessName: newBiz ? newData.businessName : null,
    allEmails: newData.emails || [],
    allPhones: newData.phones || [],
    businessName: newData.businessName || "",
  };

  // Fire a synthetic "trawl-data" trigger that automations can match
  try {
    const automations = await AutomationEngine.getAll();
    for (const auto of automations) {
      if (!auto.enabled) continue;
      if (auto.trigger !== "trawl-data") continue;
      // URL pattern filter (if automation specifies one)
      if (auto.urlPattern) {
        try {
          const re = new RegExp(auto.urlPattern, "i");
          if (!re.test(url)) continue;
        } catch { continue; }
      }
      await AutomationEngine.run(auto.id, { url, vars: { triggerSource: "trawl", ...triggerData } });
    }
  } catch (e) {
    console.warn("[Trawl] automation trigger error:", e);
  }
}

// ── Tab dwell-time tracking for Trawl engagement scoring ──
// Tracks actual foreground time per tab. Pauses when browser loses focus
// or user switches to an internal/extension page.
let _trawlActiveTab = { tabId: null, url: null, at: null };

function _trawlFlushDwell() {
  if (_trawlActiveTab.tabId && _trawlActiveTab.at && _trawlActiveTab.url) {
    const ms = Date.now() - _trawlActiveTab.at;
    if (ms > 2000) { // ignore <2s flickers
      ArgusDB.PageTracker.addDwellTime(_trawlActiveTab.url, ms).catch(() => {});
    }
    _trawlActiveTab.at = null; // paused — don't double-count
  }
}

function _trawlStartTracking(tabId) {
  browser.tabs.get(tabId).then(tab => {
    const url = tab?.url || null;
    // Don't track dwell on internal/extension pages
    if (url && TRAWL_SKIP_RE.test(url)) {
      _trawlActiveTab = { tabId, url: null, at: null };
    } else {
      _trawlActiveTab = { tabId, url, at: Date.now() };
    }
  }).catch(() => { _trawlActiveTab = { tabId: null, url: null, at: null }; });
}

browser.tabs.onActivated.addListener(({ tabId }) => {
  _trawlFlushDwell();
  _trawlStartTracking(tabId);
  updateBrowserActionForTab(tabId);
});

// Pause dwell when browser window loses focus (user switches to another app)
browser.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    // Browser lost focus — flush & pause
    _trawlFlushDwell();
  } else {
    // Browser regained focus — resume tracking the active tab
    browser.tabs.query({ active: true, windowId }).then(tabs => {
      if (tabs?.[0]) _trawlStartTracking(tabs[0].id);
    }).catch(() => {});
  }
});

function updateBrowserActionForTab(tabId) {
  browser.tabs.get(tabId).then(tab => {
    if (!tab?.url) return;
    const isInternal = tab.url.startsWith("moz-extension://") ||
                       tab.url.startsWith("about:") ||
                       tab.url.startsWith("chrome:");
    if (isInternal) {
      browser.browserAction.disable(tabId);
      browser.browserAction.setBadgeText({ text: "", tabId });
    } else {
      browser.browserAction.enable(tabId);
    }
  }).catch(() => {});
}

// ──────────────────────────────────────────────
// RSS/Atom feed auto-detection on page load
// ──────────────────────────────────────────────
async function detectFeedOnTab(tabId) {
  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab?.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:") || tab.url.startsWith("chrome:")) return;

    // Phase 1: scan <link> tags and <a> tags in the page DOM
    let results = null;
    try {
      results = await browser.tabs.executeScript(tabId, {
        code: `(function() {
          const feeds = [];
          const seen = new Set();

          // Standard <link> tags — match by type OR by rel=alternate with feed-like href
          const links = document.querySelectorAll('link[type="application/rss+xml"], link[type="application/atom+xml"], link[type="application/feed+json"], link[rel="alternate"][href*="feed"], link[rel="alternate"][href*="rss"], link[rel="alternate"][href*=".xml"]');
          for (const l of links) {
            if (l.href && !seen.has(l.href)) {
              seen.add(l.href);
              feeds.push({ url: l.href, title: l.title || "", source: "link" });
            }
          }

          // Scan <a> tags for common feed URL patterns
          const feedRx = /(\\/feed\\/?$|\\/rss\\/?$|\\/atom\\/?$|\\.rss$|\\.xml$|\\/feeds?\\/|\\/rss\\/|feed\\.xml|rss\\.xml|atom\\.xml|index\\.rss|\\/syndication|feedburner\\.com|feeds\\.feedburner|google-publisher)/i;
          const anchors = document.querySelectorAll('a[href]');
          for (const a of anchors) {
            try {
              const href = a.href;
              if (!href || seen.has(href) || href.startsWith("javascript:")) continue;
              if (feedRx.test(href)) {
                seen.add(href);
                feeds.push({ url: href, title: a.textContent.trim().slice(0, 80) || "", source: "anchor" });
              }
            } catch {}
          }

          return feeds.length ? feeds : null;
        })();`
      });
    } catch (e) {
      console.log("[Feed] Phase 1 script injection failed:", e.message);
    }

    let feeds = results && results[0];
    console.log("[Feed] Phase 1 result:", feeds ? feeds.length + " found" : "none");

    // Phase 2: if nothing found, probe common feed paths on the domain
    if (!feeds || !feeds.length) {
      try {
        const url = new URL(tab.url);
        const origin = url.origin;
        const probePaths = ["/feed", "/feed/", "/rss", "/rss/", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml", "/feeds/posts/default", "/blog/feed"];
        const probed = [];
        for (const path of probePaths) {
          try {
            const probeUrl = origin + path;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const resp = await fetch(probeUrl, {
              method: "GET", redirect: "follow", signal: controller.signal,
              headers: { "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" }
            });
            clearTimeout(timeout);
            if (!resp.ok) continue;
            const ct = resp.headers.get("content-type") || "";
            if (ct.includes("xml") || ct.includes("rss") || ct.includes("atom")) {
              probed.push({ url: probeUrl, title: path.slice(1).replace(/\/$/, ""), source: "probe" });
              console.log("[Feed] Probe hit (content-type):", probeUrl, ct);
              break;
            }
            // Peek at first 500 chars for feed markers
            const text = await resp.text();
            const head = text.slice(0, 500);
            if (head.includes("<rss") || head.includes("<feed") || head.includes("<channel>")) {
              probed.push({ url: probeUrl, title: path.slice(1).replace(/\/$/, ""), source: "probe" });
              console.log("[Feed] Probe hit (body):", probeUrl);
              break;
            }
          } catch {}
        }
        if (probed.length) feeds = probed;
      } catch (e) {
        console.log("[Feed] Phase 2 probe failed:", e.message);
      }
    }
    console.log(`[Feed] Final for tab ${tabId}: ${feeds ? feeds.length + " feed(s)" : "none"}`, feeds || "");

    if (feeds && feeds.length) {
      feedDetectionCache.set(tabId, feeds);
      // Show badge on toolbar icon
      browser.browserAction.setBadgeText({ text: "RSS", tabId });
      browser.browserAction.setBadgeBackgroundColor({ color: "#ff9800", tabId });
    } else {
      feedDetectionCache.delete(tabId);
      browser.browserAction.setBadgeText({ text: "", tabId });
    }
  } catch { /* content script injection may fail on restricted pages */ }
}

// ──────────────────────────────────────────────
// Auto-analyze cooldown tracker
// ──────────────────────────────────────────────
const autoAnalyzeCooldown = new Map();

// ──────────────────────────────────────────────
// Live data refresh — notify open options/history pages of data changes
// ──────────────────────────────────────────────
function notifyDataChanged(store) {
  browser.runtime.sendMessage({ type: "argusDataChanged", store }).catch(() => {});
}

// ──────────────────────────────────────────────
// Context menu setup
// ──────────────────────────────────────────────
async function createContextMenus() {
  await browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: "argus-parent",
    title: "Argus",
    contexts: ["page", "frame", "selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*", "file://*/*", "ftp://*/*"]
  });

  // ── Console, Reader, Reports, Help ──
  browser.contextMenus.create({
    id: "argus-console",
    parentId: "argus-parent",
    title: "\u229E Argus Console",
    contexts: ["page", "frame", "selection"]
  });

  browser.contextMenus.create({
    id: "argus-open-reader",
    parentId: "argus-parent",
    title: "\uD83D\uDCF0 Open Reader",
    contexts: ["page", "frame", "selection"]
  });

  browser.contextMenus.create({
    id: "argus-reports",
    parentId: "argus-parent",
    title: "\uD83D\uDCCA Argus Reports",
    contexts: ["page", "frame", "selection"]
  });

  browser.contextMenus.create({
    id: "argus-help",
    parentId: "argus-parent",
    title: "\u2753 Help",
    contexts: ["page", "frame", "selection"]
  });

  browser.contextMenus.create({
    id: "argus-sep-console",
    parentId: "argus-parent",
    type: "separator",
    contexts: ["page", "frame", "selection"]
  });

  // ── Chat ──
  browser.contextMenus.create({
    id: "argus-chat",
    parentId: "argus-parent",
    title: "\uD83D\uDCAC Chat with AI",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-chat-selection",
    parentId: "argus-parent",
    title: "\uD83D\uDCAC Chat about Selection",
    contexts: ["selection"]
  });

  // ── Workbench ──
  browser.contextMenus.create({
    id: "argus-workbench",
    parentId: "argus-parent",
    title: "\uD83D\uDD27 Workbench",
    contexts: ["page", "frame", "selection"]
  });

  browser.contextMenus.create({
    id: "argus-sep-chat",
    parentId: "argus-parent",
    type: "separator",
    contexts: ["page", "frame", "selection"]
  });

  // ── Quick Actions ──
  // ── Add to Bookmarks submenu ──
  browser.contextMenus.create({
    id: "argus-marks-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDD16 Add to Bookmarks",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-marks-manage",
    parentId: "argus-marks-parent",
    title: "\u2699\uFE0F Manage Bookmarks",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-marks-sep-top",
    parentId: "argus-marks-parent",
    type: "separator",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-bookmark",
    parentId: "argus-marks-parent",
    title: "\uD83D\uDCC4 Unsorted",
    contexts: ["page", "frame"]
  });
  const bmFolders = await ArgusDB.BookmarkFolders.getAll();
  if (bmFolders.length > 0) {
    // Build folder hierarchy — top-level folders first, then children
    const topFolders = bmFolders.filter(f => !f.parentId && f.name !== "Unsorted");
    const childMap = {};
    for (const f of bmFolders) {
      if (f.parentId) {
        if (!childMap[f.parentId]) childMap[f.parentId] = [];
        childMap[f.parentId].push(f);
      }
    }
    function createFolderMenuItems(folders, parentMenuId) {
      for (const folder of folders) {
        const menuId = `argus-marks-folder-${folder.id}`;
        const children = childMap[folder.id] || [];
        if (children.length > 0) {
          browser.contextMenus.create({
            id: menuId,
            parentId: parentMenuId,
            title: "\uD83D\uDCC1 " + folder.name,
            contexts: ["page", "frame"]
          });
          browser.contextMenus.create({
            id: `argus-marks-save-${folder.id}`,
            parentId: menuId,
            title: "\uD83D\uDCCC Bookmark Here",
            contexts: ["page", "frame"]
          });
          browser.contextMenus.create({
            id: `argus-marks-sep-${folder.id}`,
            parentId: menuId,
            type: "separator",
            contexts: ["page", "frame"]
          });
          createFolderMenuItems(children, menuId);
        } else {
          browser.contextMenus.create({
            id: `argus-marks-save-${folder.id}`,
            parentId: parentMenuId,
            title: "\uD83D\uDCC1 " + folder.name,
            contexts: ["page", "frame"]
          });
        }
      }
    }
    createFolderMenuItems(topFolders, "argus-marks-parent");
  }

  browser.contextMenus.create({
    id: "argus-monitor",
    parentId: "argus-parent",
    title: "\uD83D\uDC41\uFE0F Monitor This Page",
    contexts: ["page", "frame"]
  });

  browser.contextMenus.create({
    id: "argus-snapshot",
    parentId: "argus-parent",
    title: "\uD83D\uDCF8 Snapshot This Page",
    contexts: ["page", "frame"]
  });

  browser.contextMenus.create({
    id: "argus-images",
    parentId: "argus-parent",
    title: "\uD83D\uDDBC\uFE0F Grab Images",
    contexts: ["page", "frame"]
  });

  // ── Redirector submenu ──
  browser.contextMenus.create({
    id: "argus-redirector-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDD00 Redirector",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-redirect",
    parentId: "argus-redirector-parent",
    title: "Redirect via Archive",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-save-archive",
    parentId: "argus-redirector-parent",
    title: "Save to Archive",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-add-trouble-list",
    parentId: "argus-redirector-parent",
    title: "Add Site to Trouble List",
    contexts: ["page", "frame"]
  });


  // Save Link to Project submenu
  const argusProjects = await ArgusDB.Projects.getAll();
  if (argusProjects.length > 0) {
    browser.contextMenus.create({
      id: "argus-project-parent",
      parentId: "argus-parent",
      title: "\uD83D\uDCC1 Save Link to Project",
      contexts: ["page", "frame"]
    });
    for (const proj of argusProjects) {
      browser.contextMenus.create({
        id: `argus-project-${proj.id}`,
        parentId: "argus-project-parent",
        title: proj.name,
        contexts: ["page", "frame"]
      });
    }
  }

  // ── OSINT Tools ──
  browser.contextMenus.create({
    id: "argus-osint-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDD0D OSINT Tools",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-extract-metadata",
    parentId: "argus-osint-parent",
    title: "Extract Metadata",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-map-links",
    parentId: "argus-osint-parent",
    title: "Map Links",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-whois",
    parentId: "argus-osint-parent",
    title: "Whois / DNS Lookup",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-techstack",
    parentId: "argus-osint-parent",
    title: "Detect Tech Stack",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-regex-scan",
    parentId: "argus-osint-parent",
    title: "Regex Scan",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-osint-sep",
    parentId: "argus-osint-parent",
    type: "separator",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-osint-dashboard",
    parentId: "argus-osint-parent",
    title: "OSINT Dashboard",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-osint-global-graph",
    parentId: "argus-osint-parent",
    title: "Global Knowledge Graph",
    contexts: ["page", "frame"]
  });

  // ── Run Automations submenu ──
  const allAutomations = await AutomationEngine.getAll();
  const manualAutomations = allAutomations.filter(a => a.enabled !== false && a.triggers?.manual !== false);
  if (manualAutomations.length > 0) {
    browser.contextMenus.create({
      id: "argus-automations-parent",
      parentId: "argus-parent",
      title: "\u26A1 Run Automation",
      contexts: ["page", "frame"]
    });
    for (const auto of manualAutomations) {
      browser.contextMenus.create({
        id: `argus-automation-${auto.id}`,
        parentId: "argus-automations-parent",
        title: auto.name,
        contexts: ["page", "frame"]
      });
    }
  }

  // ── Site Versions submenu ──
  browser.contextMenus.create({
    id: "argus-versions-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDDC3\uFE0F Site Versions",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-check-archive",
    parentId: "argus-versions-parent",
    title: "Check archive.is",
    contexts: ["page", "frame"]
  });
  browser.contextMenus.create({
    id: "argus-check-wayback",
    parentId: "argus-versions-parent",
    title: "Check Wayback Machine",
    contexts: ["page", "frame"]
  });

  browser.contextMenus.create({
    id: "argus-separator-actions",
    parentId: "argus-parent",
    type: "separator",
    contexts: ["page", "frame", "selection"]
  });

  // ── Analysis Presets (submenu) ──
  browser.contextMenus.create({
    id: "argus-analyze-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDCCA Analyze",
    contexts: ["page", "frame", "selection"]
  });

  // Default presets
  for (const [key, preset] of Object.entries(ANALYSIS_PRESETS)) {
    browser.contextMenus.create({
      id: `argus-analyze-${key}`,
      parentId: "argus-analyze-parent",
      title: preset.label,
      contexts: ["page", "frame", "selection"]
    });
  }

  // Custom presets
  const { customPresets } = await browser.storage.local.get({ customPresets: {} });
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      browser.contextMenus.create({
        id: `argus-analyze-${key}`,
        parentId: "argus-analyze-parent",
        title: preset.label || key,
        contexts: ["page", "frame", "selection"]
      });
    }
  }

  // ── Save to Drive (only shown if at least one data provider is connected) ──
  try {
    const cloudKeys = ["google", "dropbox", "webdav", "s3", "github"];
    const connected = [];
    for (const key of cloudKeys) {
      if (CloudProviders[key] && await CloudProviders[key].isConnected()) connected.push(key);
    }
    if (connected.length > 0) {
      browser.contextMenus.create({
        id: "argus-sep-cloud",
        parentId: "argus-parent",
        type: "separator",
        contexts: ["link", "page", "image"]
      });
      browser.contextMenus.create({
        id: "argus-save-to-cloud",
        parentId: "argus-parent",
        title: "\u2601\uFE0F Save to Drive",
        contexts: ["link", "image"]
      });
      browser.contextMenus.create({
        id: "argus-save-page-to-cloud",
        parentId: "argus-parent",
        title: "\u2601\uFE0F Save Page to Drive",
        contexts: ["page"]
      });
    }
  } catch (e) { console.warn("[Argus] Cloud context menu check failed:", e); }

  // ── Add to Sources ──
  browser.contextMenus.create({
    id: "argus-sep-sources",
    parentId: "argus-parent",
    type: "separator",
    contexts: ["page", "link"]
  });
  browser.contextMenus.create({
    id: "argus-sources-parent",
    parentId: "argus-parent",
    title: "\uD83D\uDCCC Add to Sources",
    contexts: ["page", "link"]
  });
  browser.contextMenus.create({
    id: "argus-source-ungrouped",
    parentId: "argus-sources-parent",
    title: "Ungrouped",
    contexts: ["page", "link"]
  });

  // Dynamic folder sub-items from existing sources
  try {
    const allSources = await ArgusDB.Sources.getAll();
    const folders = new Set();
    for (const s of (allSources || [])) { if (s.folder) folders.add(s.folder); }
    if (folders.size > 0) {
      browser.contextMenus.create({
        id: "argus-source-folder-sep",
        parentId: "argus-sources-parent",
        type: "separator",
        contexts: ["page", "link"]
      });
      for (const f of [...folders].sort()) {
        browser.contextMenus.create({
          id: `argus-source-folder-${f}`,
          parentId: "argus-sources-parent",
          title: `📁 ${f}`,
          contexts: ["page", "link"]
        });
      }
    }
  } catch (e) { console.warn("[Argus] Source folders menu failed:", e); }

  // ── Wipe All Data ──
  browser.contextMenus.create({
    id: "argus-sep-wipe",
    parentId: "argus-parent",
    type: "separator",
    contexts: ["page", "frame", "selection"]
  });
  browser.contextMenus.create({
    id: "argus-wipe",
    parentId: "argus-parent",
    title: "\uD83D\uDDD1\uFE0F Wipe All Data",
    contexts: ["page", "frame", "selection"]
  });
}

createContextMenus();

// Rebuild context menus when presets or projects change
browser.storage.onChanged.addListener((changes) => {
  if (changes.customPresets || changes.argusProjects || changes.automations || changes.argusCloudProviders || changes.argusSources) createContextMenus();
  if (changes.showBadge) updateBadge();
});

// ──────────────────────────────────────────────
// Content extraction from a specific frame
// ──────────────────────────────────────────────
async function extractFrameContent(tabId, frameId) {
  const results = await browser.tabs.executeScript(tabId, {
    frameId: frameId,
    code: `
      (function() {
        const title = document.title || "";
        const url = window.location.href;
        const meta = document.querySelector('meta[name="description"]');
        const description = meta ? meta.content : "";

        // Try multiple selectors and pick the longest result
        const candidates = [
          "article",
          "main",
          '[role="main"]',
          '[itemprop="articleBody"]',
          ".article-body", ".article-content", ".article__body", ".article__content",
          ".post-content", ".post-body", ".entry-content",
          ".story-body", ".story-content",
          "#article-body", "#article-content",
          ".content-body", ".page-content"
        ];
        let bestText = "";
        for (const sel of candidates) {
          const el = document.querySelector(sel);
          if (el) {
            const t = el.innerText || "";
            if (t.length > bestText.length) bestText = t;
          }
        }
        // Fall back to document.body if no candidate found or too short
        if (bestText.length < 200) bestText = document.body.innerText || "";
        return { title, url, description, text: bestText };
      })();
    `
  });

  if (!results || !results[0]) {
    throw new Error("Failed to extract content from the page frame.");
  }

  const { title, url, description, text } = results[0];
  if (!text || text.trim().length < 20) {
    throw new Error("The page frame appears to have no readable text content.");
  }

  return { title, url, description, text };
}

// ──────────────────────────────────────────────
// PDF.js worker setup
// ──────────────────────────────────────────────
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = browser.runtime.getURL("lib/pdf.worker.min.js");
}

// Extract a human-readable summary from analysis content (handles entity JSON)
function humanSummaryFromContent(content) {
  if (!content) return "";
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      if (json.people || json.organizations || json.locations || json.claims) {
        const parts = [];
        if (json.people && json.people.length) {
          parts.push(`People: ${json.people.map(p => p.name).join(", ")}`);
        }
        if (json.organizations && json.organizations.length) {
          parts.push(`Orgs: ${json.organizations.map(o => o.name).join(", ")}`);
        }
        if (json.locations && json.locations.length) {
          parts.push(`Locations: ${json.locations.map(l => l.name).join(", ")}`);
        }
        if (json.claims && json.claims.length) {
          parts.push(`${json.claims.length} claim(s)`);
        }
        return parts.join(" | ").slice(0, 500) || trimmed.slice(0, 500);
      }
    } catch { /* not JSON, fall through */ }
  }
  return trimmed.slice(0, 500);
}

function isPdfUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const pathname = decodeURIComponent(u.pathname).toLowerCase();
    // Direct .pdf extension
    if (pathname.endsWith(".pdf")) return true;
    // URL query param containing .pdf (some redirects/viewers)
    if (u.search.toLowerCase().includes(".pdf")) return true;
    return false;
  } catch { return false; }
}

async function extractPdfContent(url) {
  console.log("[Argus PDF] Starting extraction for:", url);

  // Step 1: Fetch the PDF bytes
  let response;
  let arrayBuffer;
  let contentType;

  for (const creds of ["omit", "include"]) {
    try {
      response = await fetch(url, {
        redirect: "follow",
        headers: { "Accept": "application/pdf, */*" },
        credentials: creds,
      });
      if (!response.ok) {
        console.warn(`[Argus PDF] Fetch with credentials=${creds} returned ${response.status}`);
        continue;
      }

      contentType = response.headers.get("content-type") || "";
      arrayBuffer = await response.arrayBuffer();

      // Check if we actually got a PDF
      const firstBytes = new Uint8Array((arrayBuffer || new ArrayBuffer(0)).slice(0, 5));
      const header = String.fromCharCode(...firstBytes);

      if (header.startsWith("%PDF")) {
        console.log(`[Argus PDF] Got PDF (${arrayBuffer.byteLength} bytes) with credentials=${creds}`);
        break; // We have the PDF
      }

      // Got HTML instead of PDF — possibly an age-verify/login gate
      if (contentType.includes("text/html") && response.url !== url) {
        console.warn(`[Argus PDF] Redirected to gate page: ${response.url} — trying to pass gate...`);
        // Visit the gate page (accept cookies), then retry the original URL
        try {
          await fetch(response.url, { credentials: "include" });
          const retry = await fetch(url, {
            redirect: "follow",
            headers: { "Accept": "application/pdf, */*" },
            credentials: "include",
          });
          if (retry.ok) {
            contentType = retry.headers.get("content-type") || "";
            arrayBuffer = await retry.arrayBuffer();
            const retryHeader = String.fromCharCode(...new Uint8Array(arrayBuffer.slice(0, 5)));
            if (retryHeader.startsWith("%PDF")) {
              console.log(`[Argus PDF] Gate bypass worked! Got PDF (${arrayBuffer.byteLength} bytes)`);
              break;
            }
          }
        } catch (gateErr) {
          console.warn("[Argus PDF] Gate bypass failed:", gateErr.message);
        }
      }

      // Not a PDF — clear and try next credential mode
      console.warn(`[Argus PDF] Got ${contentType} (${arrayBuffer?.byteLength || 0} bytes), not PDF, with credentials=${creds}`);
      arrayBuffer = null;
    } catch (fetchErr) {
      console.warn(`[Argus PDF] Fetch with credentials=${creds} failed:`, fetchErr.message);
      if (creds === "include") throw new Error(`PDF fetch network error: ${fetchErr.message}`);
    }
  }

  if (!arrayBuffer || arrayBuffer.byteLength < 100) {
    const finalType = contentType || "unknown";
    const wasRedirect = response && response.url !== url;
    throw new Error(
      wasRedirect
        ? `PDF is behind a gate/login page (redirected to ${new URL(response.url).pathname}). Try: open the PDF in your browser first, then retry.`
        : `PDF fetch failed (got ${finalType} instead of PDF).`
    );
  }

  const firstBytes = new Uint8Array(arrayBuffer.slice(0, 5));
  const header = String.fromCharCode(...firstBytes);
  if (!header.startsWith("%PDF")) {
    throw new Error("Server returned non-PDF content. Try downloading and opening the file locally.");
  }

  console.log("[Argus PDF] Header:", header, "— parsing with pdf.js...");

  // Step 2: Parse with pdf.js
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  } catch (parseErr) {
    throw new Error(`pdf.js parse failed: ${parseErr.message}`);
  }

  console.log("[Argus PDF] Parsed OK, pages:", pdf.numPages);

  // Step 3: Extract text from pages
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      pages.push(strings.join(" "));
    } catch (pageErr) {
      console.warn(`[Argus PDF] Page ${i} extraction failed:`, pageErr.message);
      pages.push(`[Page ${i}: extraction failed]`);
    }
  }

  const text = pages.join("\n\n");
  const metadata = await pdf.getMetadata().catch(() => null);
  const title = metadata?.info?.Title || decodeURIComponent(url.split("/").pop()).replace(/\.pdf$/i, "") || "PDF Document";
  const description = metadata?.info?.Subject || metadata?.info?.Keywords || "";

  console.log("[Argus PDF] Extraction complete,", text.length, "chars from", pdf.numPages, "pages");

  return { title, url, description, text, selection: "", isPdf: true, pdfPages: pdf.numPages };
}

// ──────────────────────────────────────────────
// Content extraction from active tab
// ──────────────────────────────────────────────
async function extractPageContent(tabId) {
  console.log("[Argus] extractPageContent — tabId:", tabId);
  let tab;
  if (tabId) {
    tab = await browser.tabs.get(tabId);
  } else {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) throw new Error("No active tab found.");
    tab = tabs[0];
  }

  console.log("[Argus] tab URL:", tab.url, "title:", tab.title);

  if (tab.url && (tab.url.startsWith("about:") ||
                  tab.url.startsWith("moz-extension:") ||
                  tab.url.startsWith("chrome:"))) {
    throw new Error("Cannot analyze browser internal pages.");
  }

  // PDF detection: check URL, title, or content-type hints
  const looksLikePdf = isPdfUrl(tab.url)
    || (tab.url && tab.title && tab.title.toLowerCase().endsWith(".pdf"))
    || (tab.url && /\.pdf(\?|#|$)/i.test(tab.url))
    || (tab.url && tab.title && /\.pdf\s*(-|$)/i.test(tab.title));

  console.log(`[Argus] looksLikePdf: ${looksLikePdf}, pdfjsLib: ${typeof pdfjsLib !== "undefined"}, url: ${tab.url}`);

  if (looksLikePdf) {
    // Step 1: Try direct fetch with pdf.js (works for most remote PDFs)
    if (!tab.url.startsWith("file:") && typeof pdfjsLib !== "undefined") {
      try {
        const pdfResult = await extractPdfContent(tab.url);
        return { ...pdfResult, tabId: tab.id };
      } catch (e) {
        console.warn("[Argus] Direct PDF fetch failed:", e.message, "URL:", tab.url);
      }
    } else {
      console.warn("[Argus] PDF fetch skipped — file URL:", tab.url.startsWith("file:"), "pdfjsLib:", typeof pdfjsLib);
    }

    // Step 2: Try extracting from Firefox's built-in PDF.js viewer
    // Firefox renders PDFs (both file:// and https://) using its internal PDF.js viewer
    // which puts text in .textLayer span elements
    try {
      const pdfViewerResults = await browser.tabs.executeScript(tab.id, {
        code: `
          (function() {
            // Firefox's PDF.js viewer renders text in .textLayer span elements
            const spans = document.querySelectorAll(".textLayer span");
            if (spans.length > 0) {
              const pages = document.querySelectorAll(".page");
              const pageTexts = [];
              pages.forEach(page => {
                const layer = page.querySelector(".textLayer");
                if (layer) {
                  const pageSpans = layer.querySelectorAll("span");
                  const text = Array.from(pageSpans).map(s => s.textContent).join(" ");
                  if (text.trim()) pageTexts.push(text.trim());
                }
              });
              return {
                title: document.title || "PDF Document",
                url: window.location.href,
                text: pageTexts.join("\\n\\n"),
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
        `
      });
      if (pdfViewerResults && pdfViewerResults[0] && pdfViewerResults[0].text.trim().length > 20) {
        const r = pdfViewerResults[0];
        return {
          title: r.title.replace(/ - .+$/, "") || "PDF Document",
          url: r.url, description: "", text: r.text,
          selection: "", isPdf: true, pdfPages: r.pages,
          tabId: tab.id
        };
      }
    } catch (e) {
      if (tab.url.startsWith("file:")) {
        throw new Error(`Cannot access file:// PDF. In about:addons → Argus → Permissions, enable "Access your data for all websites", or open the PDF from a web URL instead. (${e.message})`);
      }
      console.warn("[Argus] PDF viewer extraction failed:", e.message);
      // Fall through to generic extraction as last resort
    }
  }

  let results;
  try {
    results = await browser.tabs.executeScript(tab.id, {
      code: `
        (function() {
          const title = document.title || "";
          const url = window.location.href;
          const meta = document.querySelector('meta[name="description"]');
          const description = meta ? meta.content : "";
          const selection = window.getSelection().toString();

          // Try multiple selectors and pick the longest result
          const candidates = [
            "article",
            "main",
            '[role="main"]',
            '[itemprop="articleBody"]',
            ".article-body", ".article-content", ".article__body", ".article__content",
            ".post-content", ".post-body", ".entry-content",
            ".story-body", ".story-content",
            "#article-body", "#article-content",
            ".content-body", ".page-content"
          ];
          let bestText = "";
          for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el) {
              const t = el.innerText || "";
              if (t.length > bestText.length) bestText = t;
            }
          }
          // Fall back to document.body if no candidate found or too short
          if (bestText.length < 200) bestText = document.body.innerText || "";
          return { title, url, description, text: bestText, selection };
        })();
      `
    });
  } catch (scriptError) {
    console.log(`[Argus] executeScript FAILED: "${scriptError.message}" — URL: ${tab.url}, looksLikePdf: ${looksLikePdf}`);
    // executeScript fails on PDF viewer or restricted pages — always try PDF extraction
    if (tab.url && !tab.url.startsWith("file:") && typeof pdfjsLib !== "undefined") {
      try {
        const pdfResult = await extractPdfContent(tab.url);
        return { ...pdfResult, tabId: tab.id };
      } catch (pdfErr) {
        console.warn("[Argus] PDF fetch fallback also failed:", pdfErr.message);
      }
    }
    // file:// PDFs need the permission prompt
    if (tab.url && tab.url.startsWith("file:")) {
      throw new Error(`Cannot access file:// PDF. In about:addons → Argus → Permissions, enable "Access your data for all websites", or open the PDF from a web URL instead. (${scriptError.message})`);
    }
    if (looksLikePdf) {
      throw new Error(`Cannot extract this PDF (v${ARGUS_BG_VERSION}). Try downloading the PDF and opening the local file. (fetch failed; script: ${scriptError.message})`);
    }
    throw new Error(`Cannot extract page content (v${ARGUS_BG_VERSION}, url: ${(tab.url || "").substring(0, 80)}, pdf: ${looksLikePdf}). Try refreshing the page and retrying. (${scriptError.message})`);
  }

  if (!results || !results[0]) throw new Error("Failed to extract page content.");

  const { title, url, description, text, selection } = results[0];
  if (!text || text.trim().length < 20) {
    // Last resort: maybe it's a PDF served without .pdf extension
    if (tab.url && typeof pdfjsLib !== "undefined") {
      try {
        const pdfResult = await extractPdfContent(tab.url);
        return { ...pdfResult, tabId: tab.id };
      } catch { /* not a PDF, throw original error */ }
    }
    throw new Error("Page appears to have no readable text content.");
  }

  return { title, url, description, text, selection, tabId: tab.id };
}

// ──────────────────────────────────────────────
// Selection extraction
// ──────────────────────────────────────────────
async function extractSelection(tabId) {
  try {
    const results = await browser.tabs.executeScript(tabId || undefined, {
      code: `window.getSelection().toString();`
    });
    return results && results[0] ? results[0] : "";
  } catch {
    // executeScript fails on PDF viewer and other restricted pages — no selection available
    return "";
  }
}

// ──────────────────────────────────────────────
// Prompt variable resolution
// ──────────────────────────────────────────────
function resolveVariables(template, vars) {
  return template
    .replace(/\{url\}/gi, vars.url || "")
    .replace(/\{domain\}/gi, vars.domain || "")
    .replace(/\{title\}/gi, vars.title || "")
    .replace(/\{date\}/gi, vars.date || "")
    .replace(/\{wordcount\}/gi, String(vars.wordcount || 0));
}

// ──────────────────────────────────────────────
// Text truncation
// ──────────────────────────────────────────────
function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) +
    "\n\n[... Content truncated at " + maxChars.toLocaleString() + " characters ...]";
}

// ──────────────────────────────────────────────
// Build messages array for a provider call
// ──────────────────────────────────────────────
function buildMessages(systemPrompt, userPrompt) {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

// ──────────────────────────────────────────────
// Contextual analysis — gather project context
// ──────────────────────────────────────────────
async function gatherProjectContext(projectId, currentUrl, charBudget) {
  if (!projectId || charBudget < 200) return "";

  const project = await ArgusDB.Projects.get(projectId);
  if (!project || !project.items.length) return "";

  const summaryBudget = Math.floor(charBudget * 0.6);
  const kgBudget = charBudget - summaryBudget;
  const parts = [];

  // Part 1: Project item summaries
  const otherItems = project.items.filter(item => item.url !== currentUrl);
  if (otherItems.length) {
    let summaryText = "";
    for (const item of otherItems) {
      const text = item.summary || item.title || "";
      if (!text) continue;
      const line = `- ${item.title || "Untitled"} (${item.url ? new URL(item.url).hostname : "no url"}): ${text}\n`;
      if (summaryText.length + line.length > summaryBudget) break;
      summaryText += line;
    }
    if (summaryText) {
      parts.push(`Previous Findings (${otherItems.length} items in "${project.name}"):\n${summaryText}`);
    }
  }

  // Part 2: KG entities scoped to this project
  try {
    const graphData = await KnowledgeGraph.getGraphData({ projectId });
    if (graphData && graphData.nodes.length) {
      const sorted = graphData.nodes.sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0));
      const edgeMap = new Map();
      for (const edge of graphData.edges) {
        if (!edgeMap.has(edge.sourceId)) edgeMap.set(edge.sourceId, []);
        if (!edgeMap.has(edge.targetId)) edgeMap.set(edge.targetId, []);
        edgeMap.get(edge.sourceId).push(edge);
        edgeMap.get(edge.targetId).push(edge);
      }

      let kgText = "";
      const nodeNames = new Map(sorted.map(n => [n.id, n.displayName]));
      for (const node of sorted) {
        const edges = edgeMap.get(node.id) || [];
        const connections = edges.slice(0, 3).map(e => {
          const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
          return nodeNames.get(otherId) || "?";
        });
        const connStr = connections.length ? ` -- linked to: ${connections.join(", ")}` : "";
        const line = `- [${node.type}] ${node.displayName} (${node.mentionCount || 1}x)${connStr}\n`;
        if (kgText.length + line.length > kgBudget) break;
        kgText += line;
      }
      if (kgText) {
        parts.push(`Known Entities (Knowledge Graph):\n${kgText}`);
      }
    }
  } catch (e) {
    console.warn("[Argus] KG context gathering failed:", e.message);
  }

  if (!parts.length) return "";
  return `\n--- Prior Project Context ---\n${parts.join("\n")}\n---\n\n`;
}

async function buildAnalysisPrompts(page, analysisType, customPrompt, settings, contextOptions) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const defaultPreset = ANALYSIS_PRESETS[analysisType];
  const customPreset = settings.customPresets[analysisType];

  const baseSystem = customPreset?.system || defaultPreset?.system || "You are a helpful assistant that analyzes web content.";
  const langInstruction = await getLanguageInstruction();
  const sharelineInstruction = ' At the very end of your prose analysis (before any structured data block), include a single catchy shareable one-liner (under 180 characters) on its own line prefixed with exactly "SHARELINE:" — this will be hidden from the user and only used for social sharing.';
  // Append structured data instruction for all presets except 'entities' (which already returns pure JSON)
  const structuredInstruction = analysisType !== "entities" ? buildStructuredDataInstruction(analysisType) : "";
  const systemPrompt = `Today's date is ${today}. ${baseSystem}${langInstruction}${sharelineInstruction}${structuredInstruction}`;

  const analysisInstruction = customPrompt
    ? customPrompt
    : customPreset?.prompt || defaultPreset?.prompt || "Analyze this webpage content.";

  // Resolve prompt variables
  const vars = {
    url: page.url,
    domain: page.url ? new URL(page.url).hostname : "",
    title: page.title,
    date: today,
    wordcount: page.text ? page.text.split(/\s+/).length : 0
  };

  const resolvedInstruction = resolveVariables(analysisInstruction, vars);
  const resolvedSystem = resolveVariables(systemPrompt, vars);

  // Gather project context if enabled
  let contextBlock = "";
  let textBudget = settings.maxInputChars;
  if (contextOptions?.enabled && contextOptions?.projectId) {
    const contextBudget = Math.floor(settings.maxInputChars * 0.2);
    try {
      contextBlock = await gatherProjectContext(contextOptions.projectId, page.url, contextBudget);
      if (contextBlock) {
        textBudget = settings.maxInputChars - contextBlock.length;
        console.log(`[Argus] Context injected: ${contextBlock.length} chars, text budget: ${textBudget}`);
      }
    } catch (e) {
      console.warn("[Argus] Failed to gather project context:", e.message);
    }
  }

  const truncatedText = truncateText(page.text, textBudget);

  const userPrompt =
    `**Page Title:** ${page.title}\n` +
    `**URL:** ${page.url}\n` +
    (page.description ? `**Description:** ${page.description}\n` : "") +
    contextBlock +
    `\n---\n\n${resolvedInstruction}\n\n---\n\n${truncatedText}`;

  return { systemPrompt: resolvedSystem, userPrompt };
}

// ──────────────────────────────────────────────
// History management
// ──────────────────────────────────────────────
async function saveToHistory(entry) {
  const promptText = entry.promptText;
  delete entry.promptText; // don't persist prompt text in history DB

  // Parse structured data block from AI response (if present)
  if (entry.content && ArgusStructured.hasBlock(entry.content)) {
    const { prose, data } = ArgusStructured.parse(entry.content);
    // Strip the SHARELINE from prose (it may now be before the structured block)
    entry.content = prose;
    if (data) {
      entry.structuredData = ArgusStructured.normalize(data);
    }
  }

  const saved = await ArgusDB.History.add(entry);
  entry._historyId = saved.id;
  notifyDataChanged("history");

  // Page Tracker: log the analysis action
  trackPageAction(entry.pageUrl, "analyze", { title: entry.pageTitle, preset: entry.presetLabel || entry.preset });

  // Extract entities for knowledge graph (non-blocking)
  try {
    if (entry.content && entry.pageUrl) {
      // Prefer structured entities if available — no regex needed
      KnowledgeGraph.extractAndUpsert(
        entry.content, entry.pageUrl, entry.pageTitle, entry.preset,
        promptText, entry.structuredData
      );
    }
  } catch (e) { console.warn("[KG] entity extraction failed:", e); }

  // Auto-associate with default project (non-blocking)
  try {
    const { defaultProjectId } = await browser.storage.local.get({ defaultProjectId: null });
    if (defaultProjectId) {
      const proj = await ArgusDB.Projects.get(defaultProjectId);
      if (proj) {
        // Avoid duplicating if same URL + preset already exists
        const isDupe = proj.items.some(i => i.url === entry.pageUrl && i.analysisPreset === (entry.presetLabel || entry.preset));
        if (!isDupe) {
          proj.items.unshift({
            id: genId("item"),
            type: "analysis",
            refId: saved.id?.toString() || null,
            url: entry.pageUrl || "",
            title: entry.pageTitle || "",
            summary: (entry.content || "").slice(0, 500),
            analysisContent: entry.content || "",
            analysisPreset: entry.presetLabel || entry.preset || "",
            notes: "",
            tags: [],
            addedAt: new Date().toISOString()
          });
          proj.updatedAt = new Date().toISOString();
          await ArgusDB.Projects.save(proj);
          notifyDataChanged("projects");
        }
      }
    }
  } catch (e) { console.warn("[DefaultProject] auto-associate failed:", e); }

  return saved;
}

// ──────────────────────────────────────────────
// Streaming port handler
// ──────────────────────────────────────────────
browser.runtime.onConnect.addListener((port) => {
  if (port.name !== "analysis") return;

  port.onMessage.addListener(async (message) => {
    if (message.action === "analyzeStream") {
      await handleAnalyzeStream(port, message);
    } else if (message.action === "followUpStream") {
      await handleFollowUpStream(port, message);
    } else if (message.action === "compareStream") {
      await handleCompareStream(port, message);
    }
  });
});

async function handleAnalyzeStream(port, message) {
  try {
    const settings = await getProviderSettings(message.provider, message.analysisType);
    let page;
    if (message.selectedText) {
      // Selection analysis
      page = {
        title: message.pageTitle || "Selected Text",
        url: message.pageUrl || "",
        description: "",
        text: message.selectedText
      };
    } else if (message.tabIds && message.tabIds.length > 1) {
      // Multi-page analysis
      const pages = [];
      for (const tabId of message.tabIds) {
        try {
          const p = await extractPageContent(tabId);
          pages.push(p);
        } catch (e) {
          pages.push({ title: `Tab ${tabId}`, url: "", text: `[Error: ${e.message}]`, description: "" });
        }
      }
      const isResearch = message.analysisType === "research";
      const label = isResearch ? "Source" : "Page";
      const combined = pages.map((p, i) =>
        `\n\n--- ${label} ${i + 1}: ${p.title} (${p.url}) ---\n\n${truncateText(p.text, Math.floor(settings.maxInputChars / pages.length))}`
      ).join("");
      page = {
        title: isResearch ? `Research: ${pages.length} sources` : `${pages.length} pages analyzed`,
        url: pages[0]?.url || "",
        description: "",
        text: combined,
        _sources: pages.map((p, i) => ({ index: i + 1, title: p.title, url: p.url })),
        _isResearch: isResearch
      };
    } else {
      page = await extractPageContent();
    }

    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
    const contextOptions = message.contextualMode ? { enabled: true, projectId: message.projectId } : null;
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, message.analysisType, message.customPrompt, settings, contextOptions);
    const messages = buildMessages(systemPrompt, userPrompt);

    port.postMessage({ type: "start", provider: settings.provider, model: settings.model, pageTitle: page.title });

    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, messages,
      opts,
      (chunk) => { try { port.postMessage({ type: "chunk", text: chunk }); } catch(e) {} },
      (thinking) => { try { port.postMessage({ type: "thinking", text: thinking }); } catch(e) {} }
    );

    // Store conversation history for follow-ups
    const tabId = page.tabId || message.tabId;
    if (tabId) {
      conversationHistory.set(tabId, {
        provider: settings.provider,
        messages: [...messages, { role: "assistant", content: result.content }]
      });
    }

    // Save to history
    const presetLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets[message.analysisType]?.label || message.analysisType;
    const histEntry = await saveToHistory({
      pageTitle: page.title,
      pageUrl: page.url,
      provider: settings.provider,
      model: result.model,
      preset: message.analysisType,
      presetLabel,
      content: result.content,
      thinking: result.thinking,
      usage: result.usage,
      isSelection: !!message.selectedText,
      promptText: systemPrompt + "\n" + userPrompt
    });

    const detectedSource = SourcePipelines.detectSourceType(page.url, page);
    const doneMsg = {
      type: "done",
      model: result.model,
      usage: result.usage,
      provider: settings.provider,
      thinking: result.thinking,
      content: result.content,
      pageTitle: page.title,
      historyId: histEntry?.id || null
    };
    if (detectedSource) {
      doneMsg.sourceType = { id: detectedSource.id, label: detectedSource.label, icon: detectedSource.icon };
    }
    port.postMessage(doneMsg);

    // Run specialized pipeline in background (non-blocking enrichment)
    if (detectedSource && !message.selectedText) {
      try {
        const pipelineResult = await SourcePipelines.runPipeline(detectedSource, page, settings);
        try { port.postMessage({ type: "pipelineData", data: pipelineResult }); } catch(e) {}
      } catch (e) { console.warn("[Pipeline] Enrichment failed:", e); }
    }
  } catch (err) {
    try { port.postMessage({ type: "error", error: err.message || "An unexpected error occurred." }); } catch(e) {}
  }
}

async function handleFollowUpStream(port, message) {
  try {
    const tabId = message.tabId;
    const history = conversationHistory.get(tabId);
    if (!history) throw new Error("No conversation history found. Run an analysis first.");

    const settings = await getProviderSettings(history.provider);

    // Append the follow-up question
    history.messages.push({ role: "user", content: message.question });

    port.postMessage({ type: "start", provider: settings.provider, model: settings.model });

    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, history.messages,
      { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking },
      (chunk) => { try { port.postMessage({ type: "chunk", text: chunk }); } catch(e) {} },
      (thinking) => { try { port.postMessage({ type: "thinking", text: thinking }); } catch(e) {} }
    );

    // Update conversation history
    history.messages.push({ role: "assistant", content: result.content });
    conversationHistory.set(tabId, history);

    port.postMessage({
      type: "done",
      model: result.model,
      usage: result.usage,
      provider: settings.provider,
      thinking: result.thinking,
      content: result.content
    });
  } catch (err) {
    try { port.postMessage({ type: "error", error: err.message }); } catch(e) {}
  }
}

async function handleCompareStream(port, message) {
  try {
    const page = await extractPageContent();
    const providers = message.providers || [];

    for (const providerKey of providers) {
      try {
        const settings = await getProviderSettings(providerKey);
        const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
        const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, message.analysisType, message.customPrompt, settings);
        const msgs = buildMessages(systemPrompt, userPrompt);

        port.postMessage({ type: "compareStart", provider: providerKey, model: settings.model });

        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, msgs,
          opts,
          (chunk) => { try { port.postMessage({ type: "compareChunk", provider: providerKey, text: chunk }); } catch(e) {} },
          (thinking) => { try { port.postMessage({ type: "compareThinking", provider: providerKey, text: thinking }); } catch(e) {} }
        );

        port.postMessage({
          type: "compareDone",
          provider: providerKey,
          model: result.model,
          usage: result.usage,
          content: result.content,
          thinking: result.thinking,
          pageTitle: page.title
        });
      } catch (err) {
        port.postMessage({ type: "compareError", provider: providerKey, error: err.message });
      }
    }

    port.postMessage({ type: "compareAllDone", pageTitle: page.title });
  } catch (err) {
    try { port.postMessage({ type: "error", error: err.message }); } catch(e) {}
  }
}

// ──────────────────────────────────────────────
// Message handler (non-streaming fallback + utility messages)
// ──────────────────────────────────────────────
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "analyze") return handleAnalyze(message);
  if (message.action === "getPresets") return handleGetPresets();
  if (message.action === "getProviders") return handleGetProviders();
  if (message.action === "getHistory") return handleGetHistory(message);
  if (message.action === "getHistoryItem") return handleGetHistoryItem(message);
  if (message.action === "deleteHistoryItem") return handleDeleteHistoryItem(message);
  if (message.action === "addHistoryPasteUrl") return handleAddHistoryPasteUrl(message);
  if (message.action === "clearHistory") return handleClearHistory();
  if (message.action === "searchHistory") return handleSearchHistory(message);
  if (message.action === "getHistoryForUrl") return handleGetHistoryForUrl(message);
  if (message.action === "getLinkMapForUrl") return handleGetLinkMapForUrl(message);
  if (message.action === "getLinkMapHistory") return handleGetLinkMapHistory();
  if (message.action === "saveLinkMapHistory") return saveToHistory(message.entry).then(() => ({ success: true }));
  if (message.action === "getArchiveCheck") {
    const cached = archiveCheckCache.get(message.tabId);
    return Promise.resolve({ success: true, archiveUrl: cached?.archiveUrl || null, checked: !!cached });
  }
  if (message.action === "checkArchiveNow") {
    return (async () => {
      try {
        const checkUrl = `https://archive.is/newest/${message.url}`;
        const resp = await fetch(checkUrl, { method: "HEAD", redirect: "follow" });
        if (resp.ok && resp.url && resp.url !== checkUrl && !resp.url.includes("/newest/")) {
          return { success: true, archiveUrl: resp.url };
        }
        return { success: true, archiveUrl: null };
      } catch (err) { return { success: false, error: err.message }; }
    })();
  }
  if (message.action === "checkWaybackNow") {
    return (async () => {
      try {
        const snapshot = await checkWaybackAvailability(message.url);
        return { success: true, waybackUrl: snapshot ? snapshot.url : null };
      } catch (err) { return { success: false, error: err.message }; }
    })();
  }
  if (message.action === "getFeedDetection") {
    const feeds = feedDetectionCache.get(message.tabId);
    if (!feeds || !feeds.length) return Promise.resolve({ success: true, feeds: null });
    return (async () => {
      const existingFeeds = await ArgusDB.Feeds.getAll();
      // Normalize URLs for comparison (strip trailing slash, lowercase)
      const norm = u => u.replace(/\/+$/, "").toLowerCase();
      const subscribedUrls = new Set(existingFeeds.map(f => norm(f.url)));
      const available = feeds.filter(f => !subscribedUrls.has(norm(f.url)));
      return { success: true, feeds: available.length ? available : null, allSubscribed: available.length === 0 && feeds.length > 0 };
    })();
  }
  if (message.action === "regexAnalyze") return handleRegexAnalyze(message);
  if (message.action === "getSelection") return handleGetSelection(message);
  if (message.action === "getOpenTabs") return handleGetOpenTabs();
  if (message.action === "getConversationState") return handleGetConversationState(message);
  if (message.action === "analyzeInTab") return handleAnalyzeInTab(message);
  if (message.action === "deepDiveSearch") return handleDeepDiveSearch(message);
  if (message.action === "initConversation") return handleInitConversation(message);
  if (message.action === "followUp") return handleFollowUp(message);
  if (message.action === "startConversation") return handleStartConversation(message);
  if (message.action === "reAnalyze") return handleReAnalyze(message);
  if (message.action === "bookmarkPage") return handleBookmarkPage(message);
  if (message.action === "getBookmarks") return handleGetBookmarks(message);
  if (message.action === "updateBookmark") return handleUpdateBookmark(message);
  if (message.action === "deleteBookmark") return handleDeleteBookmark(message);
  if (message.action === "exportBookmarks") return handleExportBookmarks();
  // Bookmark folders
  if (message.action === "getBookmarkFolders") return ArgusDB.BookmarkFolders.getAll().then(f => ({ success: true, folders: f }));
  if (message.action === "saveBookmarkFolder") return ArgusDB.BookmarkFolders.save(message.folder).then(f => { createContextMenus(); return { success: true, folder: f }; });
  if (message.action === "deleteBookmarkFolder") return ArgusDB.BookmarkFolders.remove(message.folderId).then(() => { createContextMenus(); return { success: true }; });
  if (message.action === "moveBookmarkToFolder") return ArgusDB.Bookmarks.update(message.bookmarkId, { folderId: message.folderId || "" }).then(b => ({ success: true, bookmark: b }));
  if (message.action === "assignFolderToProject") return handleAssignFolderToProject(message);
  if (message.action === "addMonitor") return handleAddMonitor(message);
  if (message.action === "getMonitors") return handleGetMonitors();
  if (message.action === "updateMonitor") return handleUpdateMonitor(message);
  if (message.action === "deleteMonitor") return handleDeleteMonitor(message);
  if (message.action === "getMonitorHistory") return handleGetMonitorHistory(message);
  if (message.action === "getAllMonitorChanges") return handleGetAllMonitorChanges();
  if (message.action === "clearAllMonitorChanges") {
    return ArgusDB.Changes.clear().then(async () => {
      const monitors = await ArgusDB.Monitors.getAll();
      for (const m of monitors) {
        m.changeCount = 0;
        m.lastChangeSummary = "";
        m.lastChangeAt = null;
        await ArgusDB.Monitors.save(m);
      }
      return { success: true };
    });
  }
  if (message.action === "clearMonitorUnread") return clearMonitorUnread(message.monitorId).then(() => ({ success: true }));
  if (message.action === "getMonitorUnreads") return browser.storage.local.get({ monitorUnreads: {} }).then(r => ({ success: true, unreads: r.monitorUnreads }));
  if (message.action === "getMonitorSnapshots") return handleGetMonitorSnapshots(message);
  if (message.action === "getMonitorDiff") return handleGetMonitorDiff(message);
  if (message.action === "getMonitorStorageUsage") return handleGetMonitorStorageUsage();
  if (message.action === "purgeOpfsFiles") return (typeof OpfsStorage !== "undefined" ? OpfsStorage.deleteAll() : Promise.resolve()).then(() => ({ success: true }));
  if (message.action === "snapshotPage") return handleSnapshotPage(message);
  if (message.action === "snapshotAndAnalyzeMonitor") return handleSnapshotAndAnalyze(message);
  if (message.action === "getSnapshotScreenshot") return handleGetSnapshotScreenshot(message);
  if (message.action === "getSnapshotHtml") return handleGetSnapshotHtml(message);
  if (message.action === "getArchiveSettings") return browser.storage.local.get({ archiveRedirect: { enabled: false, domains: DEFAULT_ARCHIVE_DOMAINS, providerUrl: "https://archive.is/" } }).then(r => ({ success: true, ...r.archiveRedirect }));
  if (message.action === "saveArchiveSettings") return browser.storage.local.set({ archiveRedirect: { enabled: message.enabled, domains: message.domains, providerUrl: message.providerUrl || "https://archive.is/" } }).then(() => ({ success: true }));
  // Re-init auto-analyze after permission grant
  if (message.action === "initAutoAnalyze") {
    if (!autoAnalyzeRegistered) {
      return initWebNavigation(autoAnalyzeCallback).then(ok => {
        autoAnalyzeRegistered = ok;
        return { success: ok };
      });
    }
    return Promise.resolve({ success: true });
  }
  // RSS Feeds
  if (message.action === "addFeed") return handleAddFeed(message);
  if (message.action === "getFeeds") return handleGetFeeds();
  if (message.action === "getFeedEntries") return handleGetFeedEntries(message);
  if (message.action === "deleteFeed") return handleDeleteFeed(message);
  if (message.action === "deleteAllFeeds") return handleDeleteAllFeeds();
  if (message.action === "updateFeed") return handleUpdateFeed(message);
  if (message.action === "markFeedEntryRead") return handleMarkFeedEntryRead(message);
  if (message.action === "markAllFeedRead") return handleMarkAllFeedRead(message);
  if (message.action === "refreshFeed") return handleRefreshFeed(message);
  if (message.action === "summarizeFeedEntry") return handleSummarizeFeedEntry(message);
  if (message.action === "discoverFeed") return handleDiscoverFeed(message);
  if (message.action === "feedRouteRescan") return handleFeedRouteRescan();
  if (message.action === "analyzeBookmarks") return handleAnalyzeBookmarks(message);
  // Page Tracker
  // Sources
  if (message.action === "getSources") return ArgusDB.Sources.getAll().then(sources => ({ success: true, sources }));
  if (message.action === "saveSource") return ArgusDB.Sources.save(message.source).then(source => ({ success: true, source }));
  if (message.action === "deleteSource") return ArgusDB.Sources.remove(message.sourceId).then(() => ({ success: true }));
  if (message.action === "importSources") return ArgusDB.Sources.saveMany(message.sources).then(() => ({ success: true }));
  if (message.action === "exportSources") return ArgusDB.Sources.getAll().then(sources => ({ success: true, sources }));
  if (message.action === "getTrackerPages") return ArgusDB.PageTracker.getAll().then(pages => ({ success: true, pages }));
  if (message.action === "searchTrackerPages") return ArgusDB.PageTracker.search(message.query).then(pages => ({ success: true, pages }));
  if (message.action === "deleteTrackerPage") return ArgusDB.PageTracker.remove(message.id).then(() => ({ success: true }));
  if (message.action === "clearTracker") return ArgusDB.PageTracker.clear().then(() => ({ success: true }));
  // Trawl Net
  if (message.action === "getTrawlStatus") return browser.storage.local.get({ trawlEnabled: false }).then(s => ({ success: true, enabled: s.trawlEnabled }));
  if (message.action === "setTrawlEnabled") return browser.storage.local.set({ trawlEnabled: message.enabled }).then(() => ({ success: true }));
  // Trawl Schedule
  if (message.action === "getTrawlSchedule") return browser.storage.local.get({ trawlSchedule: null }).then(s => ({ success: true, schedule: s.trawlSchedule }));
  if (message.action === "setTrawlSchedule") return browser.storage.local.set({ trawlSchedule: message.schedule }).then(() => ({ success: true }));
  // Trawl Duration Timer
  if (message.action === "getTrawlDuration") return browser.storage.local.get({ trawlDurationEnabled: false, trawlDurationMinutes: 30, trawlExpireAt: null }).then(s => ({ success: true, enabled: s.trawlDurationEnabled, minutes: s.trawlDurationMinutes, expireAt: s.trawlExpireAt }));
  if (message.action === "setTrawlDuration") return browser.storage.local.set({ trawlDurationEnabled: message.enabled, trawlDurationMinutes: message.minutes }).then(() => ({ success: true }));
  if (message.action === "startTrawlTimer") {
    return (async () => {
      const mins = message.minutes || (await browser.storage.local.get({ trawlDurationMinutes: 30 })).trawlDurationMinutes;
      const expireAt = Date.now() + mins * 60 * 1000;
      await browser.storage.local.set({ trawlEnabled: true, trackMyPages: true, trawlExpireAt: expireAt });
      browser.alarms.create("trawl-duration-expire", { when: expireAt });
      return { success: true, expireAt };
    })();
  }
  if (message.action === "stopTrawlTimer") {
    browser.alarms.clear("trawl-duration-expire");
    return browser.storage.local.set({ trawlEnabled: false, trawlExpireAt: null }).then(() => ({ success: true }));
  }
  if (message.action === "getTrawlTimerStatus") {
    return browser.storage.local.get({ trawlExpireAt: null, trawlEnabled: false }).then(s => {
      const remainingMs = s.trawlExpireAt ? Math.max(0, s.trawlExpireAt - Date.now()) : null;
      return { success: true, active: !!(s.trawlExpireAt && s.trawlEnabled), expireAt: s.trawlExpireAt, remainingMs };
    });
  }
  // Trawl → GeoMap
  if (message.action === "buildGeomapFromTrawl") return handleBuildGeomapFromTrawl(message);
  // Trawl → Save session as project
  if (message.action === "saveTrawlAsProject") return handleSaveTrawlAsProject(message);
  // Projects
  if (message.action === "getProjects") return handleGetProjects(message);
  if (message.action === "getDefaultProject") return browser.storage.local.get({ defaultProjectId: null }).then(s => ({ defaultProjectId: s.defaultProjectId }));
  if (message.action === "setDefaultProject") return browser.storage.local.set({ defaultProjectId: message.projectId }).then(() => ({ success: true }));
  if (message.action === "getFeatureProjectOverrides") return browser.storage.local.get({ monitorDefaultProjectId: null, bookmarkDefaultProjectId: null });
  if (message.action === "setFeatureProjectOverride") return browser.storage.local.set({ [message.key]: message.projectId || null }).then(() => ({ success: true }));
  if (message.action === "createProject") return handleCreateProject(message);
  if (message.action === "updateProject") return handleUpdateProject(message);
  if (message.action === "deleteProject") return handleDeleteProject(message);
  if (message.action === "addProjectItem") return handleAddProjectItem(message);
  if (message.action === "updateProjectItem") return handleUpdateProjectItem(message);
  if (message.action === "removeProjectItem") return handleRemoveProjectItem(message);
  if (message.action === "unRejectProjectUrl") return handleUnRejectProjectUrl(message);
  if (message.action === "exportProject") return handleExportProject(message);
  if (message.action === "exportAllProjects") return handleExportAllProjects();
  if (message.action === "importProject") return handleImportProject(message);
  if (message.action === "batchAnalyzeProjectItem") return handleBatchAnalyzeProjectItem(message);
  if (message.action === "batchAnalyzeProject") return handleBatchAnalyzeProject(message);
  if (message.action === "getBatchStatus") return handleGetBatchStatus();
  if (message.action === "cancelBatch") return handleCancelBatch();
  if (message.action === "saveConversationToProject") return handleSaveConversationToProject(message);
  // Knowledge Graph
  if (message.action === "getKGGraph") return KnowledgeGraph.getGraphData(message);
  if (message.action === "getKGStats") return KnowledgeGraph.getStats();
  if (message.action === "searchKGNodes") return ArgusDB.KGNodes.search(message.query);
  if (message.action === "deleteKGNode") return ArgusDB.KGNodes.remove(message.id).then(() => ({ success: true }));
  if (message.action === "deleteKGEdge") return ArgusDB.KGEdges.remove(message.id).then(() => ({ success: true }));
  if (message.action === "mergeKGNodes") return KnowledgeGraph.mergeNodes(message.keepId, message.removeId).then(n => ({ success: true, node: n }));
  if (message.action === "getKGPendingMerges") return KnowledgeGraph.getPendingMerges();
  if (message.action === "resolveKGMerge") return KnowledgeGraph.resolvePendingMerge(message.mergeId, message.accept);
  if (message.action === "runKGInference") return KnowledgeGraph.runInferenceRules();
  if (message.action === "pruneKGNoise") return KnowledgeGraph.pruneNoiseEntities().then(r => ({ success: true, ...r }));
  if (message.action === "retypeKGEntities") return KnowledgeGraph.retypeEntities().then(r => ({ success: true, ...r }));
  if (message.action === "clearKG") return ArgusDB.KGNodes.clear().then(() => ArgusDB.KGEdges.clear()).then(() => browser.storage.local.remove("_kg_backfill_done")).then(() => ({ success: true }));
  if (message.action === "reindexKG") return browser.storage.local.remove(["_kg_backfill_done", "_kg_backfill_at"]).then(() => KnowledgeGraph.backfillFromHistory()).then(r => ({ success: true, ...r }));
  if (message.action === "extractAndUpsert") {
    const { text, pageUrl, pageTitle } = message;
    return KnowledgeGraph.extractAndUpsert(text, pageUrl, pageTitle, null)
      .then(r => ({ success: true, ...(r || {}) }))
      .catch(e => ({ success: false, error: e.message }));
  }
  // ── Vault (encryption / passcode lock) ──
  if (message.action === "vaultGetStatus") return ArgusVault.getStatus();
  if (message.action === "vaultSetup") return ArgusVault.setup(message.passcode, message.type);
  if (message.action === "vaultUnlock") return ArgusVault.unlock(message.passcode);
  if (message.action === "vaultLock") return Promise.resolve(ArgusVault.lock());
  if (message.action === "vaultChange") return ArgusVault.changePasscode(message.passcode, message.type);
  if (message.action === "vaultRemove") return ArgusVault.remove();
  if (message.action === "vaultEncrypt") return ArgusVault.encrypt(message.plaintext);
  if (message.action === "vaultDecrypt") return ArgusVault.decrypt(message.iv, message.ciphertext);
  if (message.action === "vaultReadSensitive") return ArgusVault.readSensitive(message.key).then(v => ({ value: v }));
  if (message.action === "vaultWriteSensitive") return ArgusVault.writeSensitive(message.key, message.value).then(() => ({ success: true }));
  // ── Incognito / Forced-Private Sites ──
  if (message.action === "openIncognito") {
    return (async () => {
      try {
        await browser.windows.create({ url: message.url, incognito: true });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })();
  }
  if (message.action === "initIncognitoForce") {
    return initIncognitoForce().then(ok => ({ success: ok }));
  }
  if (message.action === "wipeEverything") return handleWipeEverything();
  if (message.action === "buildProjectSkeleton") return handleBuildProjectSkeleton(message.projectId);
  // Cloud Backup
  if (message.action === "cloudCreateBackup") return CloudBackup.createBackup().then(r => ({ success: true, filename: r.filename, size: r.blob.size, manifest: r.manifest }));
  if (message.action === "cloudBackupNow") return handleCloudBackupNow();
  if (message.action === "cloudRestore") return handleCloudRestore(message.providerKey, message.filename);
  if (message.action === "cloudListBackups") return CloudBackup.listBackups(message.providerKey).then(f => ({ success: true, files: f })).catch(e => ({ success: false, error: e.message }));
  if (message.action === "cloudConnect") return handleCloudConnect(message);
  if (message.action === "cloudDisconnect") return CloudProviders[message.providerKey]?.disconnect() || Promise.resolve({ success: false });
  if (message.action === "cloudTestConnection") return CloudProviders[message.providerKey]?.testConnection().catch(e => ({ success: false, error: e.message }));
  if (message.action === "cloudGetStatus") return handleCloudGetStatus();
  if (message.action === "cloudSaveChat") return handleCloudSaveChat(message.session);
  if (message.action === "cloudPushFile") return handleCloudPushFile(message.path, message.content, message.providerKey);
  if (message.action === "cloudListSessions") return handleCloudListSessions(message.providerKey);
  if (message.action === "cloudLocalBackup") return handleCloudLocalBackup();
  if (message.action === "cloudLocalRestore") return handleCloudLocalRestore(message.data);
  if (message.action === "cloudGetRedirectURL") {
    try { return Promise.resolve({ success: true, url: browser.identity.getRedirectURL() }); }
    catch (e) { return Promise.resolve({ success: false, error: e.message }); }
  }
  if (message.action === "cloudSetSchedule") {
    if (message.enabled) {
      browser.alarms.create("argus-cloud-backup", { delayInMinutes: message.hours * 60, periodInMinutes: message.hours * 60 });
    } else {
      browser.alarms.clear("argus-cloud-backup");
    }
    return Promise.resolve({ success: true });
  }
  // Bookmark Cloud Sync
  if (message.action === "syncBookmarksToGitHub") return CloudBackup.syncBookmarksToGitHub().catch(e => ({ success: false, error: e.message }));
  if (message.action === "syncBookmarkSnapshot") return CloudBackup.syncBookmarkSnapshot(message.bookmarkId).catch(e => ({ success: false, error: e.message }));
  if (message.action === "syncBookmarksToCloud") return CloudBackup.syncBookmarksToCloud().catch(e => ({ success: false, error: e.message }));
  // XMPP / Text It
  if (message.action === "xmppGetStatus") return handleXmppGetStatus();
  if (message.action === "xmppGetConfig") return handleXmppGetConfig();
  if (message.action === "xmppTestConnection") return handleXmppTestConnection();
  if (message.action === "xmppSend") return handleXmppSend(message);
  if (message.action === "xmppDisconnect") return handleXmppDisconnect();
  if (message.action === "xmppChatConnect") return handleXmppChatConnect();
  if (message.action === "xmppChatSend") return handleXmppChatSend(message);
  if (message.action === "xmppChatPoll") return handleXmppChatPoll();
  if (message.action === "xmppGetRoster") return handleXmppGetRoster();
  if (message.action === "sourcesGetSmsContacts") return handleSourcesGetSmsContacts();
  if (message.action === "sourcesSaveContact") return handleSourcesSaveContact(message);
  // Paste providers
  if (message.action === "pasteCreate") return handlePasteCreate(message);
  if (message.action === "pasteList") return CloudProviders[message.providerKey]?.list().catch(e => ({ success: false, error: e.message })) || Promise.resolve([]);
  // KG Dictionaries
  if (message.action === "getKGDictionaries") return KnowledgeGraph.getUserDictionaries();
  if (message.action === "saveKGDictionaries") return KnowledgeGraph.saveUserDictionaries(message.dictionaries);
  if (message.action === "getKGDictionaryStats") return KnowledgeGraph.getBuiltinDictionaryStats();
  // Agentic Automation
  if (message.action === "getDashboardData") return AgentEngine.getDashboardData(message.projectId);
  if (message.action === "generateDigest") return AgentEngine.generateProjectDigest(message.projectId);
  if (message.action === "generateReportSection") return AgentEngine.generateReportSection(message.projectId, message.sectionType);
  if (message.action === "getCachedReport") return AgentEngine.getCachedReport(message.projectId, message.sectionType).then(s => ({ success: true, section: s }));
  if (message.action === "detectTrends") return AgentEngine.detectTrends(message.projectId);
  if (message.action === "getDigests") return AgentEngine.getDigests(message.projectId).then(d => ({ success: true, digests: d }));
  if (message.action === "setDigestSchedule") return AgentEngine.setDigestSchedule(message.projectId, message.schedule);
  if (message.action === "getDigestSchedule") return AgentEngine.getDigestSchedule(message.projectId).then(s => ({ success: true, schedule: s }));
  // Automations
  if (message.action === "getAutomations") return AutomationEngine.getAll().then(a => ({ success: true, automations: a }));
  if (message.action === "saveAutomation") return AutomationEngine.save(message.automation);
  if (message.action === "deleteAutomation") return AutomationEngine.remove(message.automationId);
  if (message.action === "runAutomation") return AutomationEngine.run(message.automationId, { tabId: message.tabId, url: message.url, title: message.title });
  if (message.action === "runAutomationOnItem") return AutomationEngine.runOnItem(message.automationId, message.projectId, message.url, message.title);
  if (message.action === "runAutomationOnProject") return AutomationEngine.runOnProject(message.automationId, message.projectId);
  if (message.action === "getAutomationStatus") return Promise.resolve(AutomationEngine.getRunStatus());
  if (message.action === "cancelAutomation") return Promise.resolve(AutomationEngine.cancel());
  if (message.action === "getAutomationLog") return AutomationEngine.getLog(message.automationId).then(l => ({ success: true, logs: l }));
  // ── Named Lists ──
  if (message.action === "getLists") return AutomationEngine.getLists().then(l => ({ success: true, lists: l }));
  if (message.action === "getListById") return AutomationEngine.getListById(message.listId).then(l => ({ success: true, list: l }));
  if (message.action === "saveList") return AutomationEngine.saveList(message.list);
  if (message.action === "removeList") return AutomationEngine.removeList(message.listId);
  // ── Export / Import ──
  if (message.action === "exportAutomations") return AutomationEngine.exportAll().then(d => ({ success: true, ...d }));
  if (message.action === "importAutomations") return AutomationEngine.importAll({ automations: message.automations, lists: message.lists }, message.mode);
  if (message.action === "seedPrebuiltAutomations") return AutomationEngine.seedPrebuilt().then(() => ({ success: true }));
  // ── Finance Data ──
  if (message.action === "financeRefreshPrices") return financeRefreshPrices();
  if (message.action === "financeGetState") return browser.storage.local.get({ financeMonitor: null }).then(d => ({ success: true, state: d.financeMonitor }));
  // ── Decision Gates ──
  if (message.action === "getPendingGates") return Promise.resolve({ success: true, gates: AutomationEngine.getPendingGates() });
  if (message.action === "resolveGate") return Promise.resolve(AutomationEngine.resolveGate(message.gateId, message.answer));
  if (message.action === "rejectGate") return Promise.resolve(AutomationEngine.rejectGate(message.gateId));
  // ── Chat ──
  if (message.action === "chatGetSessions") return handleChatGetSessions();
  if (message.action === "chatGetSession") return handleChatGetSession(message.sessionId);
  if (message.action === "chatDeleteSession") return handleChatDeleteSession(message.sessionId);
  if (message.action === "chatSendMessage") return handleChatSendMessage(message);
  // ── Drafts ──
  if (message.action === "draftGetAll") return handleDraftGetAll();
  if (message.action === "draftGet") return handleDraftGet(message.draftId);
  if (message.action === "draftSave") return handleDraftSave(message.draft);
  if (message.action === "draftDelete") return handleDraftDelete(message.draftId);
  if (message.action === "draftSummarize") return handleDraftSummarize(message);
  if (message.action === "draftAiTool") return handleDraftAiTool(message);
  // ── Workbench ──
  if (message.action === "workbenchGetData") return handleWorkbenchGetData(message.projectId);
  if (message.action === "workbenchAnalyze") return handleWorkbenchAnalyze(message);
  // OSINT tools are handled by background-osint.js's own message listener
  return false;
});

async function handleGetPresets() {
  const { customPresets } = await browser.storage.local.get({ customPresets: {} });
  const presets = [];

  // Default presets (check if they have a provider override in customPresets)
  for (const [key, val] of Object.entries(ANALYSIS_PRESETS)) {
    presets.push({ key, label: val.label, isCustom: false, provider: customPresets[key]?.provider || "" });
  }

  // User-created custom presets
  for (const [key, val] of Object.entries(customPresets)) {
    if (val.isCustom) {
      presets.push({ key, label: val.label || key, isCustom: true, provider: val.provider || "" });
    }
  }

  return { success: true, presets };
}

function handleGetProviders() {
  return Promise.resolve({
    success: true,
    providers: Object.entries(PROVIDERS).map(([key, val]) => ({
      key, label: val.label, models: val.models, defaultModel: val.defaultModel
    }))
  });
}

async function handleGetHistory(message) {
  const all = await ArgusDB.History.getAllSorted();
  const page = message.page || 0;
  const perPage = message.perPage || 50;
  const start = page * perPage;
  return {
    success: true,
    history: all.slice(start, start + perPage),
    total: all.length
  };
}

async function handleGetHistoryItem(message) {
  const all = await ArgusDB.History.getAllSorted();
  const entry = all.find(e => e.id === message.id);
  if (!entry) return { success: false, error: "History entry not found" };
  return { success: true, entry };
}

async function handleDeleteHistoryItem(message) {
  await ArgusDB.History.remove(message.id);
  notifyDataChanged("history");
  return { success: true };
}

async function handleAddHistoryPasteUrl(message) {
  const { historyId, service, url } = message;
  if (!historyId || !url) return { success: false, error: "Missing historyId or url" };
  const item = await ArgusDB.History.get(historyId);
  if (!item) return { success: false, error: "History item not found" };
  if (!item.pasteUrls) item.pasteUrls = [];
  const pasteEntry = { service: service || "unknown", url, date: Date.now() };
  item.pasteUrls.push(pasteEntry);
  await ArgusDB.History.update(historyId, { pasteUrls: item.pasteUrls });

  // Also update any project items that reference this history entry
  try {
    const projects = await ArgusDB.Projects.getAll();
    for (const proj of projects) {
      let changed = false;
      for (const pi of (proj.items || [])) {
        if (pi.refId === historyId) {
          if (!pi.pasteUrls) pi.pasteUrls = [];
          pi.pasteUrls.push(pasteEntry);
          changed = true;
        }
      }
      if (changed) await ArgusDB.Projects.update(proj.id, { items: proj.items });
    }
  } catch (e) { console.warn("[Paste] Failed to update project items:", e); }

  notifyDataChanged("history");
  return { success: true, pasteUrls: item.pasteUrls };
}

async function handleClearHistory() {
  await ArgusDB.History.clear();
  notifyDataChanged("history");
  return { success: true };
}

async function handleWipeEverything() {
  console.log("[Argus] Wiping all data...");
  try {
    // Clear all IndexedDB stores
    await Promise.all([
      ArgusDB.History.clear(),
      ArgusDB.Bookmarks.clear(),
      ArgusDB.Projects.clear(),
      ArgusDB.Monitors.clear(),
      ArgusDB.Feeds.clear(), // also clears feedEntries
      ArgusDB.Changes.clear(),
      ArgusDB.Watchlist.clear(),
      ArgusDB.KGNodes.clear(),
      ArgusDB.KGEdges.clear(),
      ArgusDB.Drafts.clear(),
      ArgusDB.PageTracker.clear(),
    ]);
    // Clear OPFS snapshots
    await OpfsStorage.deleteAll();
    // Clear all browser.storage.local
    await browser.storage.local.clear();
    console.log("[Argus] All data wiped successfully");
    return { success: true };
  } catch (e) {
    console.error("[Argus] Wipe failed:", e);
    return { success: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// Chat handlers
// ──────────────────────────────────────────────
async function handleChatGetSessions() {
  const sessions = await ArgusDB.ChatSessions.getAll();
  // Return lightweight list (no full messages)
  return { success: true, sessions: sessions.map(s => ({ id: s.id, title: s.title, preview: s.preview, provider: s.provider, updatedAt: s.updatedAt, messageCount: (s.messages || []).length })) };
}

async function handleChatGetSession(sessionId) {
  const session = await ArgusDB.ChatSessions.get(sessionId);
  if (!session) return { success: false, error: "Session not found" };
  return { success: true, session };
}

async function handleChatDeleteSession(sessionId) {
  await ArgusDB.ChatSessions.remove(sessionId);
  return { success: true };
}

async function handleChatSendMessage(message) {
  try {
    const { sessionId, text, provider: providerOverride } = message;
    const settings = await getProviderSettings(providerOverride || "");

    // Load or create session
    let session;
    if (sessionId) {
      session = await ArgusDB.ChatSessions.get(sessionId);
    }
    if (!session) {
      session = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: text.slice(0, 60) + (text.length > 60 ? "..." : ""),
        messages: [],
        provider: settings.provider,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    // Add user message
    session.messages.push({ role: "user", content: text, timestamp: Date.now() });
    session.provider = settings.provider;

    // Build messages array for API
    const systemPrompt = {
      role: "system",
      content: "You are a helpful assistant in Argus Chat. Continue the conversation naturally. Do not comment on the conversation history, context, or the fact that you're resuming a prior thread — just answer the user's question directly."
    };
    const apiMessages = [systemPrompt, ...session.messages.map(m => ({ role: m.role, content: m.content }))];

    // Create stream ID for storage polling
    const streamId = `chat-stream-${Date.now()}`;
    await browser.storage.local.set({ [streamId]: { status: "loading" } });

    // Save session immediately so UI can reference it
    await ArgusDB.ChatSessions.save(session);

    // Stream in background (non-blocking)
    (async () => {
      try {
        const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
        let streamedContent = "";
        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, apiMessages, opts,
          async (chunk) => {
            streamedContent += chunk;
            await browser.storage.local.set({ [streamId]: { status: "streaming", content: streamedContent, model: settings.model, provider: settings.provider } });
          },
          null
        );

        // Save assistant message to session (with provider/model for attribution)
        session.messages.push({ role: "assistant", content: result.content, timestamp: Date.now(), provider: settings.provider, model: result.model || settings.model });
        session.preview = result.content.slice(0, 120);
        // Auto-title from first exchange
        if (session.messages.filter(m => m.role === "user").length === 1 && session.title === session.messages[0].content.slice(0, 60) + (session.messages[0].content.length > 60 ? "..." : "")) {
          // Keep the auto-title from user's first message — it's good enough
        }
        await ArgusDB.ChatSessions.save(session);

        await browser.storage.local.set({
          [streamId]: { status: "done", content: result.content, model: result.model, provider: settings.provider, usage: result.usage }
        });
      } catch (err) {
        await browser.storage.local.set({ [streamId]: { status: "error", error: err.message } });
      }
    })();

    return { success: true, sessionId: session.id, streamId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Draft handlers
// ──────────────────────────────────────────────
async function handleDraftGetAll() {
  const drafts = await ArgusDB.Drafts.getAll();
  return { success: true, drafts: drafts.map(d => ({ id: d.id, title: d.title, content: d.content, projectId: d.projectId, updatedAt: d.updatedAt })) };
}

async function handleDraftGet(draftId) {
  const draft = await ArgusDB.Drafts.get(draftId);
  if (!draft) return { success: false, error: "Draft not found" };
  return { success: true, draft };
}

async function handleDraftSave(draft) {
  if (!draft || !draft.id) return { success: false, error: "Invalid draft" };
  const existing = await ArgusDB.Drafts.get(draft.id);
  if (existing) {
    draft.createdAt = existing.createdAt;
  } else {
    draft.createdAt = draft.createdAt || Date.now();
  }
  await ArgusDB.Drafts.save(draft);
  notifyDataChanged("drafts");
  return { success: true, draftId: draft.id };
}

async function handleDraftDelete(draftId) {
  await ArgusDB.Drafts.remove(draftId);
  notifyDataChanged("drafts");
  return { success: true };
}

async function handleDraftSummarize(message) {
  try {
    const { content, charLimit, platform, provider: providerOverride } = message;
    if (!content?.trim()) return { success: false, error: "No content to summarize." };

    const settings = await getProviderSettings(providerOverride || "");
    const limit = charLimit || 280;
    const platformHint = platform || "social media";

    const systemPrompt = `You are a concise social media copywriter. Summarize the given content into a ${platformHint} post. Hard limit: ${limit} characters. Output ONLY the post text — no quotes, no preamble, no commentary. Make it punchy and engaging.`;
    const userPrompt = content.slice(0, 6000);
    const messages = [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }];

    const result = await callProvider(settings.provider, settings.apiKey, settings.model, messages, { maxTokens: 300 });
    // Enforce character limit on the result
    let summary = (result.content || "").trim();
    if (summary.length > limit) summary = summary.slice(0, limit - 1) + "…";
    return { success: true, summary, provider: settings.provider, model: result.model };
  } catch (err) {
    return { success: false, error: err.message || "Summarize failed." };
  }
}

const DRAFT_AI_TOOLS = {
  spellcheck: {
    system: "You are a meticulous proofreader. Fix all spelling, grammar, and punctuation errors in the text. Preserve the original tone, style, and markdown formatting exactly. Output ONLY the corrected text — no commentary, no explanations, no preamble.",
    maxTokens: 4000
  },
  grammar: {
    system: "You are an expert copy editor. Fix grammar, syntax, punctuation, and awkward phrasing. Improve sentence structure where needed but preserve the author's voice and markdown formatting. Output ONLY the improved text — no commentary.",
    maxTokens: 4000
  },
  rewrite: {
    system: "You are a skilled editor. Rewrite the text to be clearer, more concise, and more professional while preserving the core meaning and all factual content. Maintain markdown formatting. Output ONLY the rewritten text — no commentary.",
    maxTokens: 4000
  },
  simplify: {
    system: "You are a plain-language expert. Rewrite the text at an 8th-grade reading level. Use short sentences, common words, and active voice. Preserve all factual content and markdown formatting. Output ONLY the simplified text — no commentary.",
    maxTokens: 4000
  },
  expand: {
    system: "You are a thorough writer. Expand the text with additional detail, examples, and context where appropriate. Fill in gaps, elaborate on key points, and make the writing more comprehensive. Preserve markdown formatting. Output ONLY the expanded text — no commentary.",
    maxTokens: 6000
  },
  tone_formal: {
    system: "You are a professional editor. Rewrite the text in a formal, professional tone suitable for business or academic use. Remove colloquialisms, slang, and casual language. Preserve all factual content and markdown formatting. Output ONLY the rewritten text.",
    maxTokens: 4000
  },
  tone_casual: {
    system: "You are a friendly writer. Rewrite the text in a casual, conversational tone. Use contractions, shorter sentences, and a warm voice. Preserve all factual content and markdown formatting. Output ONLY the rewritten text.",
    maxTokens: 4000
  },
  verify: {
    system: "You are a fact-checker and research analyst. Review the text and identify any claims, statistics, names, dates, or facts that appear incorrect, unsupported, or suspicious. For each issue found, explain what seems wrong and suggest a correction if possible. If everything checks out, say so briefly. Format your response as a numbered list of findings in markdown.",
    maxTokens: 3000
  },
  lint: {
    system: "You are a writing quality analyst. Review the text for: 1) Structural issues (poor flow, missing transitions, weak intro/conclusion), 2) Clarity problems (ambiguous statements, jargon without definition, passive voice overuse), 3) Redundancy (repeated ideas, filler words, unnecessary qualifiers), 4) Consistency issues (tone shifts, tense changes, formatting inconsistencies). Provide a concise numbered list of issues with specific suggestions. Be direct and actionable.",
    maxTokens: 3000
  },
  headlines: {
    system: "You are a headline writer and SEO specialist. Generate 5 alternative titles/headlines for the given content. Each should take a different angle: one factual, one provocative, one question-based, one SEO-optimized, one creative. Format as a numbered markdown list with a brief note on the approach for each.",
    maxTokens: 1000
  },
  tldr: {
    system: "You are a summarization expert. Produce a TL;DR of the text in 2-3 sentences that captures the essential points. Then provide 3-5 bullet points of key takeaways. Use markdown formatting. Output ONLY the summary — no preamble.",
    maxTokens: 1000
  },
  translate: {
    system: "You are a professional translator. Translate the text into the target language specified by the user. Preserve meaning, tone, and markdown formatting. If no target language is specified, translate to English. Output ONLY the translation — no commentary.",
    maxTokens: 4000
  },
  citations: {
    system: "You are a research assistant. Review the text and identify every claim, statistic, or factual assertion that should have a citation. For each, suggest what type of source would be appropriate (academic paper, news article, official report, etc.) and provide a suggested search query to find it. Format as a numbered markdown list.",
    maxTokens: 2000
  },
  outline: {
    system: "You are a structural editor. Analyze the text and produce a clean markdown outline showing the logical structure. Identify sections, subsections, key arguments, and supporting points. Suggest any structural improvements (reordering, missing sections, better grouping). Output the outline in markdown heading/bullet format.",
    maxTokens: 2000
  }
};

async function handleDraftAiTool(message) {
  try {
    const { tool, content, extra, provider: providerOverride } = message;
    if (!content?.trim()) return { success: false, error: "No content provided." };

    const toolDef = DRAFT_AI_TOOLS[tool];
    if (!toolDef) return { success: false, error: `Unknown tool: ${tool}` };

    const settings = await getProviderSettings(providerOverride || "");
    let systemPrompt = toolDef.system;
    // Allow extra context (e.g. target language for translate)
    const userContent = extra ? `${extra}\n\n---\n\n${content.slice(0, 8000)}` : content.slice(0, 8000);
    const messages = [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }];

    const langInst = await getLanguageInstruction();
    if (langInst && tool !== "translate") {
      messages[0].content += "\n\n" + langInst;
    }

    const result = await callProvider(settings.provider, settings.apiKey, settings.model, messages, { maxTokens: toolDef.maxTokens || 4000 });
    return { success: true, result: (result.content || "").trim(), provider: settings.provider, model: result.model, tool };
  } catch (err) {
    return { success: false, error: err.message || "AI tool failed." };
  }
}

// ──────────────────────────────────────────────
// Workbench handlers
// ──────────────────────────────────────────────
async function handleWorkbenchGetData(projectId) {
  try {
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };

    // Gather all related data
    const items = proj.items || [];

    // KG entities scoped to this project's URLs
    const urls = new Set(items.filter(i => i.url).map(i => i.url));
    let entities = [];
    let edges = [];
    try {
      const graphData = await KnowledgeGraph.getGraphData({ projectId });
      if (graphData) {
        entities = graphData.nodes || [];
        edges = graphData.edges || [];
      }
    } catch (e) { /* KG may not have data */ }

    // Feeds routed to this project
    const allFeeds = await ArgusDB.Feeds.getAll();
    const routedFeeds = [];
    for (const feed of allFeeds) {
      if (feed.routeToProject === projectId) {
        const entries = await ArgusDB.FeedEntries.getByFeed(feed.id);
        routedFeeds.push({ id: feed.id, title: feed.title, url: feed.url, entryCount: entries.length, entries: entries.slice(0, 20) });
      }
    }

    // Monitors watching project URLs
    const allMonitors = await ArgusDB.Monitors.getAll();
    const relatedMonitors = allMonitors.filter(m => urls.has(m.url));

    // Bookmarks matching project URLs
    const allBookmarks = await ArgusDB.Bookmarks.getAll();
    const relatedBookmarks = allBookmarks.filter(b => urls.has(b.url));

    // History entries linked to this project (via refId)
    const refIds = new Set(items.filter(i => i.refId).map(i => i.refId));
    let relatedHistory = [];
    if (refIds.size > 0) {
      const allHistory = await ArgusDB.History.getAll();
      relatedHistory = allHistory.filter(h => refIds.has(h.id)).slice(0, 50);
    }

    return {
      success: true,
      project: { id: proj.id, name: proj.name, color: proj.color, description: proj.description },
      items,
      entities,
      edges,
      feeds: routedFeeds,
      monitors: relatedMonitors,
      bookmarks: relatedBookmarks,
      history: relatedHistory
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleWorkbenchAnalyze(message) {
  try {
    const { projectId, selectedItems, prompt, provider: providerOverride } = message;
    const settings = await getProviderSettings(providerOverride || "");

    // Resolve workbench system prompt (allow user override via Advanced Prompts)
    const advOverrides = (await browser.storage.local.get({ advancedPrompts: {} })).advancedPrompts;
    const wbSystemDefault = "You are an OSINT research analyst embedded in an investigation workbench called Argus. The user has selected specific items from their project and placed them on a work surface for deep analysis. Your job is to find connections, patterns, contradictions, and actionable insights across the selected data. Be thorough but concise. Reference specific items, entities, and sources by name. When you identify new entities or relationships, call them out explicitly so the user can add them to their knowledge graph. Always consider: who, what, when, where, why, and how. If the data is insufficient to draw a conclusion, say so and suggest what additional data would help.";
    const systemPrompt = advOverrides["workbench"]?.system || wbSystemDefault;

    // Build context from selected items
    let contextBlock = "";
    for (const item of (selectedItems || [])) {
      const header = `[${(item.type || "item").toUpperCase()}] ${item.title || "Untitled"}`;
      const content = item.analysisContent || item.summary || item.content || "";
      const url = item.url ? ` (${item.url})` : "";
      contextBlock += `\n--- ${header}${url} ---\n${content.slice(0, 3000)}\n`;
    }

    // Add project context summary if available
    let projectContext = "";
    if (projectId) {
      try {
        const projCtx = await gatherProjectContext(projectId, "", Math.floor(settings.maxInputChars * 0.15));
        if (projCtx) projectContext = projCtx;
      } catch (e) { /* non-critical */ }
    }

    const userPrompt = `${prompt || "Analyze the following items and identify key patterns, connections, and insights."}\n${projectContext}\n${contextBlock}`;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const streamId = `wb-stream-${Date.now()}`;
    await browser.storage.local.set({ [streamId]: { status: "loading" } });

    // Stream in background
    (async () => {
      try {
        const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
        let streamedContent = "";
        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, apiMessages, opts,
          async (chunk) => {
            streamedContent += chunk;
            await browser.storage.local.set({ [streamId]: { status: "streaming", content: streamedContent, model: settings.model, provider: settings.provider } });
          },
          null
        );
        await browser.storage.local.set({
          [streamId]: { status: "done", content: result.content, thinking: result.thinking, model: result.model, provider: settings.provider, usage: result.usage }
        });

        // Save to history
        await saveToHistory({
          pageTitle: `Workbench: ${selectedItems.length} items`,
          pageUrl: "",
          provider: settings.provider,
          model: result.model,
          preset: "workbench",
          presetLabel: "Workbench Analysis",
          content: result.content,
          thinking: result.thinking,
          usage: result.usage,
          promptText: systemPrompt + "\n" + userPrompt
        });
      } catch (err) {
        await browser.storage.local.set({ [streamId]: { status: "error", error: err.message } });
      }
    })();

    return { success: true, streamId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleBuildProjectSkeleton(projectId) {
  try {
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };
    const items = proj.items || [];
    const itemUrls = new Set(items.filter(i => i.url).map(i => i.url));

    // Gather cross-store data in parallel
    const [allBookmarks, allMonitors, allFeeds, allNodes, allDrafts, storageData] = await Promise.all([
      ArgusDB.Bookmarks.getAll(),
      ArgusDB.Monitors.getAll(),
      ArgusDB.Feeds.getAll(),
      ArgusDB.KGNodes.getAll(),
      ArgusDB.Drafts.getAll(),
      browser.storage.local.get({ feedKeywordRoutes: [] }),
    ]);

    // Bookmarks matching project URLs
    const matchedBookmarks = allBookmarks.filter(b => itemUrls.has(b.url));

    // Monitors matching project URLs
    const matchedMonitors = allMonitors.filter(m => itemUrls.has(m.url));

    // Feeds routed to this project via keyword routes
    const routes = (storageData.feedKeywordRoutes || []).filter(r => r.projectId === projectId);
    const routedFeedIds = new Set(routes.map(r => r.feedId).filter(Boolean));
    const routedKeywords = [...new Set(routes.flatMap(r => r.keywords || []))];
    const matchedFeeds = routedFeedIds.size > 0
      ? allFeeds.filter(f => routedFeedIds.has(f.id))
      : (routes.length > 0 ? allFeeds : []); // routes with no feedId = all feeds

    // KG entities from project item URLs
    const matchedEntities = allNodes.filter(n => n.sourceUrl && itemUrls.has(n.sourceUrl));
    // Sort by mention count descending
    matchedEntities.sort((a, b) => (b.mentions || 1) - (a.mentions || 1));

    // Drafts attached to this project
    const matchedDrafts = allDrafts.filter(d => d.projectId === projectId);
    matchedDrafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return {
      success: true,
      skeleton: {
        items: { total: items.length, list: items.slice(0, 10).map(i => ({ type: i.type, title: i.title, url: i.url })) },
        feeds: { total: matchedFeeds.length, list: matchedFeeds.slice(0, 10).map(f => ({ title: f.title, url: f.url })) },
        bookmarks: { total: matchedBookmarks.length, list: matchedBookmarks.slice(0, 10).map(b => ({ title: b.title, url: b.url })) },
        monitors: { total: matchedMonitors.length, list: matchedMonitors.slice(0, 10).map(m => ({ label: m.label, url: m.url })) },
        entities: { total: matchedEntities.length, list: matchedEntities.slice(0, 10).map(e => ({ label: e.label, type: e.type, mentions: e.mentions || 1 })) },
        keywords: { total: routedKeywords.length, list: routedKeywords.slice(0, 10) },
        drafts: { total: matchedDrafts.length, list: matchedDrafts.slice(0, 10).map(d => ({ id: d.id, title: d.title || "Untitled", words: d.content ? d.content.trim().split(/\s+/).length : 0 })) },
      }
    };
  } catch (e) {
    console.error("[Argus] Skeleton failed:", e);
    return { success: false, error: e.message };
  }
}

// ── Save to Drive (context menu) ──

async function handleSaveToCloud(url, tab) {
  try {
    // Determine filename from URL
    const urlObj = new URL(url);
    let filename = urlObj.pathname.split("/").filter(Boolean).pop() || "page";
    if (!filename.includes(".")) filename += ".html";

    // Fetch the resource
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const blob = await resp.blob();

    // Upload to all connected providers
    const cloudKeys = ["google", "dropbox", "webdav", "s3", "github"];
    const results = [];
    for (const key of cloudKeys) {
      if (!CloudProviders[key] || !await CloudProviders[key].isConnected()) continue;
      try {
        await CloudProviders[key].upload(blob, `Argus Saved Files/${filename}`);
        results.push({ provider: key, success: true });
      } catch (e) {
        results.push({ provider: key, success: false, error: e.message });
      }
    }

    const ok = results.filter(r => r.success).map(r => r.provider);
    const msg = ok.length > 0
      ? `Saved ${filename} to ${ok.join(", ")}`
      : "Failed to save to any provider";

    // Show notification
    browser.notifications.create(`argus-cloud-save-${Date.now()}`, {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-48.png"),
      title: "Argus — Save to Drive",
      message: msg
    });

    console.log("[Argus] Save to cloud:", msg, results);
  } catch (e) {
    console.error("[Argus] Save to cloud failed:", e);
    browser.notifications.create(`argus-cloud-save-err-${Date.now()}`, {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-48.png"),
      title: "Argus — Save to Drive",
      message: `Failed: ${e.message}`
    });
  }
}

// ── Cloud Backup Handlers ──

async function handleCloudBackupNow() {
  try {
    const { blob, filename, manifest } = await CloudBackup.createBackup();
    const results = await CloudBackup.uploadToAll(blob, filename);
    // Log backup timestamp
    const { cloudBackupLog = [] } = await browser.storage.local.get({ cloudBackupLog: [] });
    cloudBackupLog.unshift({ date: new Date().toISOString(), filename, size: blob.size, results });
    if (cloudBackupLog.length > 20) cloudBackupLog.length = 20;
    await browser.storage.local.set({ cloudBackupLog });
    return { success: true, filename, size: blob.size, results, manifest };
  } catch (e) {
    console.error("[Argus] Backup failed:", e);
    return { success: false, error: e.message };
  }
}

// ── Cloud Chat Sync Handlers ──

function _buildChatMarkdown(session) {
  const ts = new Date().toISOString();
  const lines = [
    "---",
    `title: "${(session.title || "Argus Chat").replace(/"/g, "'")}"`,
    `source: ${session.source || "argus"}`,
    `conversationId: ${session.conversationId || ""}`,
    `exported: ${ts}`,
    "---",
    "",
  ];
  for (const msg of (session.messages || [])) {
    lines.push(`**${msg.type === "user" ? "User" : "Assistant"}:** ${msg.text}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function handleCloudSaveChat(session) {
  const md = _buildChatMarkdown(session);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `chat/${ts}.md`;
  const blob = new Blob([md], { type: "text/markdown" });

  const keys = ["google", "dropbox", "webdav", "s3", "github"];
  const results = [];
  for (const key of keys) {
    const provider = CloudProviders[key];
    if (!provider || !await provider.isConnected()) continue;
    try {
      await provider.upload(blob, filename);
      results.push({ provider: key, success: true });
    } catch (e) {
      results.push({ provider: key, success: false, error: e.message });
    }
  }
  return { success: results.some(r => r.success), results };
}

async function handleCloudPushFile(path, content, providerKey) {
  const blob = new Blob([content], { type: "text/plain" });
  if (providerKey) {
    const provider = CloudProviders[providerKey];
    if (!provider) return { success: false, error: `Unknown provider: ${providerKey}` };
    try {
      await provider.upload(blob, path);
      return { success: true, provider: providerKey };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  const keys = ["google", "dropbox", "webdav", "s3", "github"];
  const results = [];
  for (const key of keys) {
    const provider = CloudProviders[key];
    if (!provider || !await provider.isConnected()) continue;
    try {
      await provider.upload(blob, path);
      results.push({ provider: key, success: true });
    } catch (e) {
      results.push({ provider: key, success: false, error: e.message });
    }
  }
  return { success: results.some(r => r.success), results };
}

async function handleCloudListSessions(providerKey) {
  try {
    const provider = CloudProviders[providerKey];
    if (!provider) return { success: false, files: [], error: `Unknown provider: ${providerKey}` };
    const all = await provider.list();
    const sessions = all.filter(f => f.name && (f.name.endsWith(".md") || f.name.includes("chat")));
    return { success: true, files: sessions };
  } catch (e) {
    return { success: false, files: [], error: e.message };
  }
}

async function handleCloudRestore(providerKey, filename) {
  try {
    const blob = await CloudBackup.downloadBackup(providerKey, filename);
    const result = await CloudBackup.restoreFromBackup(blob);
    return result;
  } catch (e) {
    console.error("[Argus] Restore failed:", e);
    return { success: false, error: e.message };
  }
}

async function handleCloudConnect(message) {
  try {
    const key = message.providerKey;
    console.log(`[Cloud] Connecting to ${key}...`);
    let result;
    if (key === "google") result = await CloudProviders.google.connect(message.clientId);
    else if (key === "dropbox") result = await CloudProviders.dropbox.connect(message.appKey);
    else if (key === "webdav") result = await CloudProviders.webdav.connect(message.url, message.username, message.password);
    else if (key === "s3") result = await CloudProviders.s3.connect(message.endpoint, message.bucket, message.accessKey, message.secretKey, message.region);
    else if (key === "github") result = await CloudProviders.github.connect(message.pat, message.repo, message.branch);
    else if (key === "gist") result = await CloudProviders.gist.connect(message.pat);
    else if (key === "pastebin") result = await CloudProviders.pastebin.connect(message.apiKey, message.username, message.password);
    else if (key === "privatebin") result = await CloudProviders.privatebin.connect(message.url);
    else return { success: false, error: "Unknown provider" };
    console.log(`[Cloud] ${key} connect result:`, result);
    return result;
  } catch (e) {
    console.error(`[Cloud] Connect failed:`, e);
    return { success: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// XMPP / Text It handlers
// ──────────────────────────────────────────────
let _xmppWs = null;
let _xmppAuth = false;

async function getXmppConfig() {
  const { dataProviders } = await browser.storage.local.get({ dataProviders: {} });
  const xmpp = dataProviders.xmpp || {};
  let password = null;
  try {
    const resp = await ArgusVault.readSensitive("xmpp-password");
    password = resp || null;
  } catch { /* vault locked or not set */ }
  return {
    server: xmpp.server || "",
    jid: xmpp.jid || "",
    password,
    gateway: xmpp.gateway || "",
    country: xmpp.country || "US",
    configured: !!(xmpp.server && xmpp.jid && xmpp.gateway)
  };
}

async function handleXmppGetStatus() {
  const cfg = await getXmppConfig();
  return {
    configured: cfg.configured,
    jid: cfg.jid || "",
    connected: !!(_xmppWs && _xmppWs.readyState === WebSocket.OPEN && _xmppAuth)
  };
}

async function handleXmppTestConnection() {
  try {
    // Disconnect any existing connection
    handleXmppDisconnect();
    const cfg = await getXmppConfig();
    if (!cfg.server || !cfg.jid) return { success: false, error: "XMPP server and JID are required" };
    if (!cfg.password) return { success: false, error: "XMPP password not set (check Vault)" };
    _xmppWs = await XmppClient.connect(cfg.server, cfg.jid, cfg.password);
    _xmppAuth = true;
    // Attach reconnect/cleanup listeners
    _xmppWs.onclose = () => { _xmppAuth = false; _xmppWs = null; };
    _xmppWs.onerror = () => { _xmppAuth = false; };
    return { success: true, message: "Connected and authenticated to " + cfg.jid.split("@")[1] };
  } catch (e) {
    _xmppAuth = false;
    _xmppWs = null;
    return { success: false, error: e.message };
  }
}

async function handleXmppSend(message) {
  const { to, body } = message;
  if (!to || !body) return { success: false, error: "Missing recipient or body" };
  try {
    const cfg = await getXmppConfig();
    if (!cfg.configured) return { success: false, error: "XMPP not configured — set up in Settings → Data Providers" };
    if (!cfg.password) return { success: false, error: "XMPP password not available — check Vault" };

    // Prefer Phase 2 persistent connection if available
    if (_xmppConn && _xmppConn.isConnected()) {
      // Use managed connection — fall through to send below
    } else if (!_xmppWs || (typeof _xmppWs.isConnected === "function" ? !_xmppWs.isConnected() : _xmppWs.readyState !== WebSocket.OPEN) || !_xmppAuth) {
      _xmppWs = await XmppClient.connect(cfg.server, cfg.jid, cfg.password);
      _xmppAuth = true;
      if (_xmppWs.onclose !== undefined && typeof _xmppWs.isConnected !== "function") {
        _xmppWs.onclose = () => { _xmppAuth = false; _xmppWs = null; };
        _xmppWs.onerror = () => { _xmppAuth = false; };
      }
    }

    // Format JID and prepare message
    const jid = XmppSms.formatJid(to, cfg.gateway, cfg.country);
    const prepared = XmppSms.prepareMessage(body);

    // If message needs paste-and-link, try to paste first
    let finalBody = prepared.body;
    if (XmppSms.needsPasteLink(body)) {
      try {
        const pasteResp = await handlePasteCreate({
          providerKey: "privatebin",
          title: "Argus SMS Content",
          content: body
        });
        if (pasteResp?.success && pasteResp?.url) {
          const withLink = XmppSms.prepareMessage(body, pasteResp.url);
          finalBody = withLink.body;
        }
      } catch { /* fallback to truncated */ }
    }

    // Send — use Phase 2 connection if available, else legacy
    const conn = (_xmppConn && _xmppConn.isConnected()) ? _xmppConn : _xmppWs;
    await XmppClient.sendMessage(conn, cfg.jid, jid, finalBody);

    // Update Sources lastUsed
    try { await _updateSourceLastUsed(to); } catch { /* non-critical */ }

    console.log(`[XMPP] Sent SMS to ${jid} (${finalBody.length} chars)`);
    return { success: true, to: jid, chars: finalBody.length };
  } catch (e) {
    console.error("[XMPP] Send failed:", e);
    return { success: false, error: e.message };
  }
}

function handleXmppDisconnect() {
  if (_xmppWs) {
    XmppClient.disconnect(_xmppWs);
    _xmppWs = null;
    _xmppAuth = false;
  }
  return Promise.resolve({ success: true });
}

async function handleSourcesGetSmsContacts() {
  try {
    const all = await ArgusDB.Sources.getAll();
    const contacts = all.filter(s =>
      (s.tags || []).some(t => t.toLowerCase() === "sms") ||
      (s.addresses || []).some(a => {
        const label = (a.label || "").toLowerCase();
        return label === "phone" || label === "sms" || label === "mobile" || label === "tel";
      })
    );
    return { success: true, contacts };
  } catch (e) {
    return { success: false, contacts: [], error: e.message };
  }
}

async function handleSourcesSaveContact(message) {
  try {
    const { name, phone, tags } = message;
    const source = {
      id: "src-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || phone,
      aliases: [],
      tags: tags || ["sms"],
      location: "",
      notes: "Added via Text It",
      addresses: [{ label: "Phone", value: phone, lastUsed: Date.now() }]
    };
    await ArgusDB.Sources.save(source);
    return { success: true, id: source.id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function _updateSourceLastUsed(phone) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const all = await ArgusDB.Sources.getAll();
  for (const s of all) {
    if (!s.addresses) continue;
    let updated = false;
    for (const a of s.addresses) {
      if (a.value && a.value.replace(/[^\d+]/g, "") === cleaned) {
        a.lastUsed = Date.now();
        updated = true;
      }
    }
    if (updated) await ArgusDB.Sources.save(s);
  }
}

// ── Phase 2: XMPP Chat (bidirectional) ──
let _xmppConn = null;            // XmppClient.createConnection() instance
let _xmppInbox = [];             // buffered inbound messages for polling
let _xmppPresenceUpdates = [];   // buffered presence updates
let _xmppLastStatus = null;      // last connection status change

async function handleXmppGetConfig() {
  const cfg = await getXmppConfig();
  return { server: cfg.server, jid: cfg.jid, gateway: cfg.gateway, country: cfg.country, configured: cfg.configured };
}

async function handleXmppChatConnect() {
  try {
    // Disconnect existing connection
    if (_xmppConn) {
      _xmppConn.disconnect();
      _xmppConn = null;
    }
    // Also clean up Phase 1 connection
    if (_xmppWs) {
      XmppClient.disconnect(_xmppWs);
      _xmppWs = null;
      _xmppAuth = false;
    }

    const cfg = await getXmppConfig();
    if (!cfg.server || !cfg.jid) return { success: false, error: "XMPP server and JID are required" };
    if (!cfg.password) return { success: false, error: "XMPP password not set (check Vault)" };

    _xmppConn = XmppClient.createConnection({
      wsUrl: cfg.server,
      jid: cfg.jid,
      password: cfg.password,
      autoReconnect: true,

      onMessage: (msg) => {
        console.log("[XMPP] Inbound:", msg.from, msg.body?.slice(0, 50));
        _xmppInbox.push(msg);

        // Fire automation triggers for inbound messages
        _fireXmppAutomationTrigger(msg);
      },

      onPresence: (pres) => {
        _xmppPresenceUpdates.push(pres);
      },

      onStatus: (status, detail) => {
        console.log("[XMPP] Status:", status, detail || "");
        _xmppLastStatus = status;
        // Keep Phase 1 state in sync
        if (status === "connected") {
          _xmppAuth = true;
          _xmppWs = _xmppConn; // allow Phase 1 callers to use Phase 2 connection
        } else if (status === "disconnected" || status === "error") {
          _xmppAuth = false;
        }
      }
    });

    const result = await _xmppConn.connect();
    return { success: true, jid: result.jid };
  } catch (e) {
    console.error("[XMPP] Chat connect failed:", e);
    return { success: false, error: e.message };
  }
}

async function handleXmppChatSend(message) {
  const { to, body } = message;
  if (!to || !body) return { success: false, error: "Missing recipient or body" };
  if (!_xmppConn || !_xmppConn.isConnected()) {
    return { success: false, error: "XMPP not connected — click Connect first" };
  }
  try {
    const result = await _xmppConn.sendMessage(to, body);
    // Update Sources lastUsed
    try { await _updateSourceLastUsed(to); } catch { /* non-critical */ }
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function handleXmppChatPoll() {
  // Drain buffered messages and presence updates
  const messages = _xmppInbox.splice(0);
  const presenceUpdates = _xmppPresenceUpdates.splice(0);
  const statusUpdate = _xmppLastStatus;
  _xmppLastStatus = null; // consumed

  return Promise.resolve({
    messages,
    presenceUpdates,
    statusUpdate
  });
}

async function handleXmppGetRoster() {
  if (!_xmppConn || !_xmppConn.isConnected()) {
    return { success: false, items: [], error: "Not connected" };
  }
  try {
    const items = await _xmppConn.requestRoster();
    return { success: true, items };
  } catch (e) {
    return { success: false, items: [], error: e.message };
  }
}

async function _fireXmppAutomationTrigger(msg) {
  // Check for automations with xmpp-message trigger
  if (typeof AutomationEngine === "undefined") return;
  try {
    const automations = await AutomationEngine.getAll();
    for (const a of automations) {
      if (!a.enabled) continue;
      if (!a.triggers?.xmppMessage) continue;

      // Check filter: match specific JID pattern or "*" for all
      const filter = a.triggers.xmppMessage;
      if (filter !== "*" && !msg.from.includes(filter)) continue;

      console.log(`[XMPP] Firing automation "${a.name}" for message from ${msg.from}`);
      AutomationEngine.run(a.id, {
        vars: {
          triggerSource: "xmpp-message",
          xmppFrom: msg.from,
          xmppBody: msg.body,
          xmppTimestamp: msg.timestamp
        },
        page: {
          url: "",
          title: `XMPP message from ${msg.from}`,
          text: msg.body
        }
      }).catch(e => console.warn("[XMPP] Automation run error:", e));
    }
  } catch (e) {
    console.warn("[XMPP] Automation trigger error:", e);
  }
}

async function handlePasteCreate(message) {
  try {
    const key = message.providerKey; // gist, pastebin, privatebin
    const title = message.title || "Argus Export";
    const content = message.content || "";
    const files = message.files || null; // for gist: { "file.json": "content" }
    let result;
    if (key === "gist") {
      result = await CloudProviders.gist.createPaste(title, files || { "argus-export.md": content }, message.isPublic || false);
    } else if (key === "pastebin") {
      result = await CloudProviders.pastebin.createPaste(title, content, message.visibility ?? 1, message.format || "text", message.expiry || "N");
    } else if (key === "privatebin") {
      result = await CloudProviders.privatebin.createPaste(content, message.expiry || "1week", message.burn || false);
    } else {
      return { success: false, error: "Unknown paste provider" };
    }
    console.log(`[Paste] Created on ${key}:`, result.url);
    return result;
  } catch (e) {
    console.error("[Paste] Create failed:", e);
    return { success: false, error: e.message };
  }
}

async function handleCloudGetStatus() {
  const [gConn, dConn, wConn, sConn, ghConn] = await Promise.all([
    CloudProviders.google.isConnected(),
    CloudProviders.dropbox.isConnected(),
    CloudProviders.webdav.isConnected(),
    CloudProviders.s3.isConnected(),
    CloudProviders.github.isConnected(),
  ]);
  const { cloudBackupLog = [] } = await browser.storage.local.get({ cloudBackupLog: [] });
  return {
    success: true,
    providers: { google: gConn, dropbox: dConn, webdav: wConn, s3: sConn, github: ghConn },
    lastBackup: cloudBackupLog[0] || null,
  };
}

async function handleCloudLocalBackup() {
  try {
    const { blob, filename, manifest } = await CloudBackup.createBackup();
    // Convert to base64 for transfer through message passing
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { success: true, filename, base64, manifest };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleCloudLocalRestore(base64Data) {
  try {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/zip" });
    return CloudBackup.restoreFromBackup(blob);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleSearchHistory(message) {
  const filtered = await ArgusDB.History.search(message.query || "");
  return { success: true, history: filtered.slice(0, 100), total: filtered.length };
}

async function handleGetHistoryForUrl(message) {
  const all = await ArgusDB.History.getAllSorted();
  const matches = all.filter(h => h.pageUrl === message.url);
  return { success: true, history: matches.slice(0, 10), total: matches.length };
}

async function handleGetLinkMapForUrl(message) {
  const all = await ArgusDB.History.getAllSorted();
  const match = all.find(h => h.pageUrl === message.url && h.preset === "link-map" && h.linkMapData);
  if (match) {
    return { success: true, found: true, historyId: match.id, timestamp: match.timestamp, linkMapData: match.linkMapData, pageTitle: match.pageTitle, pageUrl: match.pageUrl };
  }
  return { success: true, found: false };
}

async function handleGetLinkMapHistory() {
  const all = await ArgusDB.History.getAllSorted();
  const entries = all
    .filter(h => h.preset === "link-map" && h.linkMapData)
    .map(h => ({
      id: h.id,
      pageUrl: h.pageUrl,
      pageTitle: h.pageTitle,
      timestamp: h.timestamp,
      totalLinks: h.linkMapData.stats?.totalLinks || 0,
      uniqueDomains: h.linkMapData.stats?.uniqueDomains || 0
    }));
  return { success: true, entries };
}

async function handleGetSelection(message) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs.length) return { success: false, selection: "" };
  const selection = await extractSelection(tabs[0].id);
  return { success: true, selection, tabId: tabs[0].id, pageTitle: tabs[0].title, pageUrl: tabs[0].url };
}

async function handleGetOpenTabs() {
  const tabs = await browser.tabs.query({ currentWindow: true });
  const filtered = tabs.filter(t =>
    t.url && !t.url.startsWith("about:") && !t.url.startsWith("moz-extension:") && !t.url.startsWith("chrome:")
  );
  return {
    success: true,
    tabs: filtered.map(t => ({ id: t.id, title: t.title, url: t.url, favIconUrl: t.favIconUrl }))
  };
}

async function handleGetConversationState(message) {
  const tabId = message.tabId;
  const has = conversationHistory.has(tabId);
  return { success: true, hasConversation: has, messageCount: has ? conversationHistory.get(tabId).messages.length : 0 };
}

async function handleAnalyze(message) {
  try {
    const settings = await getProviderSettings(message.provider, message.analysisType);
    const page = await extractPageContent();
    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, message.analysisType, message.customPrompt, settings);
    const messages = buildMessages(systemPrompt, userPrompt);

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      opts
    );

    // Save to history
    const presetLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets[message.analysisType]?.label || message.analysisType;
    await saveToHistory({
      pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
      model: result.model, preset: message.analysisType, presetLabel,
      content: result.content, thinking: result.thinking, usage: result.usage,
      promptText: systemPrompt + "\n" + userPrompt
    });

    return {
      success: true, content: result.content, thinking: result.thinking,
      model: result.model, usage: result.usage, provider: settings.provider, pageTitle: page.title
    };
  } catch (err) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

// ──────────────────────────────────────────────
// Regex scan AI analysis
// ──────────────────────────────────────────────
async function handleRegexAnalyze(message) {
  try {
    const settings = await getProviderSettings(message.provider);
    const { found, pageUrl, analysisMode } = message;

    // Build a concise summary of findings for the prompt
    const findingSections = [];
    for (const [cat, matches] of Object.entries(found)) {
      // Limit each category to 30 items to stay within token limits
      const limited = matches.slice(0, 30);
      const extra = matches.length > 30 ? ` (+${matches.length - 30} more)` : "";
      findingSections.push(`### ${cat} (${matches.length}${extra})\n${limited.join("\n")}`);
    }
    const findingsText = findingSections.join("\n\n");

    // Check for user overrides via Advanced Prompts
    const advOverrides = (await browser.storage.local.get({ advancedPrompts: {} })).advancedPrompts;

    const defaultPrompts = {
      threat: {
        system: "You are a cybersecurity analyst specializing in exposure assessment and data leak detection. Analyze regex scan findings from a web page and produce a structured security assessment. Be direct and actionable.",
        user: `Analyze these patterns extracted from ${pageUrl || "a web page"} for security exposure:\n\n${findingsText}\n\nProvide:\n1. **Severity** — Overall risk rating (Critical/High/Medium/Low/Info)\n2. **Exposed Secrets** — Any API keys, tokens, credentials, or sensitive data found (with risk explanation)\n3. **PII Exposure** — Emails, phone numbers, SSNs, credit cards — who/what is exposed\n4. **Infrastructure Leaks** — IPs, internal domains, AWS keys, server details that shouldn't be public\n5. **Actionable Findings** — Specific items that need immediate attention, ordered by severity\n6. **Context** — Whether findings are likely intentional (e.g. contact info) vs accidental leaks\n\nBe concise. Flag only genuinely concerning items, not routine public information.`
      },
      entities: {
        system: "You are an OSINT analyst. Extract and classify entities from regex scan findings into a structured intelligence report. Identify relationships, affiliations, and patterns.",
        user: `Classify and analyze these patterns extracted from ${pageUrl || "a web page"}:\n\n${findingsText}\n\nProvide:\n1. **People** — Names, emails, social handles that map to individuals. Group aliases belonging to the same person.\n2. **Organizations** — Companies, domains, services identified. Note affiliations.\n3. **Infrastructure** — IPs, domains, servers, cloud services. Map relationships (which IPs belong to which orgs).\n4. **Digital Assets** — Crypto addresses, API endpoints, tokens. Note which service they belong to.\n5. **Key Relationships** — Connections between entities (e.g. "email X uses domain Y, hosted on IP Z")\n6. **Intelligence Gaps** — What's missing, what would be worth investigating further.\n\nBe analytical. Focus on connections and patterns, not just listing items.`
      },
      summary: {
        system: "You are a research assistant producing concise intelligence summaries from automated data extraction results.",
        user: `Summarize these regex scan findings from ${pageUrl || "a web page"}:\n\n${findingsText}\n\nProvide:\n1. **Page Profile** — What kind of page this likely is based on the patterns found\n2. **Key Findings** — The most noteworthy discoveries, prioritized by intelligence value\n3. **Data Landscape** — What types of data this page contains/references and their significance\n4. **Notable Patterns** — Anything unusual, interesting, or worth investigating further\n5. **OSINT Value** — Rate the page's intelligence value (High/Medium/Low) with reasoning\n\nKeep it tight — 200 words max for the summary, then list key items.`
      }
    };

    const mode = analysisMode || "threat";
    const defaultPrompt = defaultPrompts[mode] || defaultPrompts.threat;
    // Apply user override for system prompt if customized via Advanced Prompts
    const advKey = `regex.${mode}`;
    const prompt = {
      system: advOverrides[advKey]?.system || defaultPrompt.system,
      user: defaultPrompt.user
    };
    const messages = buildMessages(prompt.system, prompt.user);
    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages, opts
    );

    // Save to history so it appears in Reports → Regex Scans tab
    const modeLabels = { threat: "Regex: Threat Check", entities: "Regex: Entities", summary: "Regex: Summary" };
    try {
      await saveToHistory({
        pageTitle: pageUrl ? new URL(pageUrl).hostname : "Regex Scan",
        pageUrl: pageUrl || "",
        content: result.content,
        thinking: result.thinking,
        provider: settings.provider,
        model: result.model,
        preset: "regex-" + mode,
        presetLabel: modeLabels[mode] || "Regex Analysis",
        usage: result.usage,
      });
    } catch (e) { console.warn("[RegexAnalyze] Failed to save to history:", e); }

    return {
      success: true, content: result.content, thinking: result.thinking,
      model: result.model, usage: result.usage, provider: settings.provider
    };
  } catch (err) {
    return { success: false, error: err.message || "AI analysis failed." };
  }
}

// ──────────────────────────────────────────────
// Analyze in tab (popup launcher)
// ──────────────────────────────────────────────
async function handleAnalyzeInTab(message) {
  try {
    // Compare mode: open one tab per provider
    if (message.providers && message.providers.length >= 2) {
      return await handleCompareInTab(message);
    }

    const settings = await getProviderSettings(message.provider, message.analysisType);
    let page;

    if (message.selectedText) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      page = {
        title: tab?.title || "Selected Text",
        url: tab?.url || "",
        description: "",
        text: message.selectedText
      };
    } else if (message.tabIds && message.tabIds.length > 1) {
      const pages = [];
      for (const tabId of message.tabIds) {
        try {
          const p = await extractPageContent(tabId);
          pages.push(p);
        } catch (e) {
          pages.push({ title: `Tab ${tabId}`, url: "", text: `[Error: ${e.message}]`, description: "" });
        }
      }
      const isResearch = message.analysisType === "research";
      const label = isResearch ? "Source" : "Page";
      const combined = pages.map((p, i) =>
        `\n\n--- ${label} ${i + 1}: ${p.title} (${p.url}) ---\n\n${truncateText(p.text, Math.floor(settings.maxInputChars / pages.length))}`
      ).join("");
      page = {
        title: isResearch ? `Research: ${pages.length} sources` : `${pages.length} pages analyzed`,
        url: pages[0]?.url || "",
        description: "",
        text: combined,
        _sources: pages.map((p, i) => ({ index: i + 1, title: p.title, url: p.url })),
        _isResearch: isResearch
      };
    } else {
      page = await extractPageContent(message.tabId);
    }

    const presetLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets?.[message.analysisType]?.label || message.analysisType;
    const resultId = `tl-result-${Date.now()}`;

    await browser.storage.local.set({
      [resultId]: {
        status: "loading",
        presetLabel,
        pageTitle: page.title,
        pageUrl: page.url
      }
    });

    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await openArgusPage(resultsUrl);

    // Fire-and-forget streaming
    streamAnalysisToStorage(resultId, page, message, settings, presetLabel);

    return { success: true };
  } catch (err) {
    console.error("[Argus AnalyzeInTab] Error:", err.message, err.stack);
    return { success: false, error: `[AnalyzeInTab] ${err.message}` };
  }
}

async function handleCompareInTab(message) {
  // Extract page content once, reuse for all providers
  let page;
  if (message.selectedText) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    page = { title: tab?.title || "Selected Text", url: tab?.url || "", description: "", text: message.selectedText };
  } else {
    page = await extractPageContent(message.tabId);
  }

  const totalProviders = message.providers.length;
  for (let pi = 0; pi < totalProviders; pi++) {
    const providerKey = message.providers[pi];
    const settings = await getProviderSettings(providerKey);
    const baseLabel = ANALYSIS_PRESETS[message.analysisType]?.label ||
      settings.customPresets?.[message.analysisType]?.label || message.analysisType;
    const provLabel = PROVIDERS[providerKey]?.label || providerKey;
    const presetLabel = `Compare ${pi + 1}: ${baseLabel} (${provLabel})`;
    const resultId = `tl-result-${Date.now()}-${providerKey}`;

    await browser.storage.local.set({
      [resultId]: { status: "loading", presetLabel, pageTitle: page.title, pageUrl: page.url }
    });

    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await browser.tabs.create({ url: resultsUrl });

    // All providers stream in parallel (fire-and-forget)
    streamAnalysisToStorage(resultId, page, { ...message, provider: providerKey }, settings, presetLabel);
  }

  return { success: true };
}

async function streamAnalysisToStorage(resultId, page, message, settings, presetLabel) {
  try {
    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
    const contextOptions = message.contextualMode ? { enabled: true, projectId: message.projectId } : null;
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, message.analysisType, message.customPrompt, settings, contextOptions);
    const messages = buildMessages(systemPrompt, userPrompt);

    let streamedContent = "";
    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, messages,
      opts,
      async (chunk) => {
        streamedContent += chunk;
        await browser.storage.local.set({
          [resultId]: {
            status: "streaming", content: streamedContent,
            model: settings.model, provider: settings.provider,
            presetLabel, pageTitle: page.title, pageUrl: page.url
          }
        });
      },
      null
    );

    // Store conversation history keyed by resultId for follow-ups
    conversationHistory.set(resultId, {
      provider: settings.provider,
      messages: [...messages, { role: "assistant", content: result.content }]
    });

    const resultData = {
      status: "done", content: result.content, thinking: result.thinking,
      model: result.model, usage: result.usage, provider: settings.provider,
      presetLabel, pageTitle: page.title, pageUrl: page.url, resultId
    };
    if (page._isResearch && page._sources) {
      resultData.isResearch = true;
      resultData.sources = page._sources;
    }
    // Detect source type and attach to result
    const detectedSource = SourcePipelines.detectSourceType(page.url, page);
    if (detectedSource) {
      resultData.sourceType = { id: detectedSource.id, label: detectedSource.label, icon: detectedSource.icon };
    }

    await browser.storage.local.set({ [resultId]: resultData });

    const histEntry = await saveToHistory({
      pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
      model: result.model, preset: message.analysisType, presetLabel,
      content: result.content, thinking: result.thinking, usage: result.usage,
      isSelection: !!message.selectedText,
      promptText: systemPrompt + "\n" + userPrompt
    });
    // Attach historyId to result so results page can reference it for paste URLs etc.
    if (histEntry?.id) {
      const rd = await browser.storage.local.get(resultId);
      if (rd[resultId]) {
        rd[resultId].historyId = histEntry.id;
        await browser.storage.local.set(rd);
      }
    }

    // Run specialized pipeline in background (non-blocking enrichment)
    if (detectedSource && !message.selectedText) {
      try {
        const pipelineResult = await SourcePipelines.runPipeline(detectedSource, page, settings);
        // Store under separate key so results page can pick it up even after consuming main result
        const pipelineKey = `${resultId}-pipeline`;
        await browser.storage.local.set({ [pipelineKey]: pipelineResult });
      } catch (e) { console.warn("[Pipeline] Enrichment failed:", e); }
    }
  } catch (err) {
    console.error("[Argus Stream] Error:", err.message, err.stack);
    await browser.storage.local.set({
      [resultId]: {
        status: "error", error: `[Stream] ${err.message}` || "An unexpected error occurred.",
        presetLabel, pageTitle: page.title, pageUrl: page.url
      }
    });
  }
}

// ──────────────────────────────────────────────
// Deep Dive Search
// ──────────────────────────────────────────────
const DEEP_DIVE_ENGINES = {
  duckduckgo: { base: "https://html.duckduckgo.com/html/?q=", page: (url, p) => url + `&s=${(p - 1) * 30}` },
  google:     { base: "https://www.google.com/search?q=", page: (url, p) => url + `&start=${(p - 1) * 10}` },
  bing:       { base: "https://www.bing.com/search?q=", page: (url, p) => url + `&first=${(p - 1) * 10 + 1}` },
  startpage:  { base: "https://www.startpage.com/do/dsearch?query=", page: (url, p) => url + `&page=${p}` },
  brave:      { base: "https://search.brave.com/search?q=", page: (url, p) => url + `&offset=${(p - 1) * 10}` },
  searx:      { base: "https://searxng.org/search?q=", page: (url, p) => url + `&pageno=${p}` },
  mojeek:     { base: "https://www.mojeek.com/search?q=", page: (url, p) => url + `&s=${(p - 1) * 10 + 1}` },
  dogpile:    { base: "https://www.dogpile.com/serp?q=", page: (url, p) => url + `&page=${p}` },
  yandex:     { base: "https://yandex.com/search/?text=", page: (url, p) => url + `&p=${p - 1}` },
};

async function handleDeepDiveSearch(message) {
  const { query, rawQuery, engine, engines, resultId, pagesToCrawl } = message;
  const engineList = engines || [engine];
  // Fire-and-forget — run the deep dive pipeline in background
  runDeepDive(resultId, query, rawQuery, engineList, pagesToCrawl);
  return { success: true };
}

function waitForSourceSelection(resultId) {
  return new Promise((resolve) => {
    const key = resultId + "_selection";
    const check = async () => {
      const data = (await browser.storage.local.get(key))[key];
      if (data) {
        await browser.storage.local.remove(key);
        resolve(data.selectedIndices); // array of index numbers, or null for "all"
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

async function runDeepDive(resultId, query, rawQuery, engines, pagesToCrawl) {
  const engineNames = engines.map(e => e.charAt(0).toUpperCase() + e.slice(1));
  const diveLabel = `Deep Dive — ${engineNames.join(" + ")}`;
  const primaryConfig = DEEP_DIVE_ENGINES[engines[0]] || DEEP_DIVE_ENGINES.duckduckgo;
  const baseSearchUrl = primaryConfig.base + encodeURIComponent(query);

  async function updateProgress(progress, extra = {}) {
    const current = (await browser.storage.local.get(resultId))[resultId] || {};
    await browser.storage.local.set({
      [resultId]: {
        ...current,
        status: "loading",
        deepDive: true,
        presetLabel: diveLabel,
        pageTitle: `${diveLabel}: ${rawQuery}`,
        pageUrl: baseSearchUrl,
        progress,
        ...extra
      }
    });
  }

  try {
    // Phase 1: Fetch search engine result pages and extract links (multi-engine)
    const allLinks = []; // { url, engine }
    const seenUrls = new Set();

    for (const eng of engines) {
      const engLabel = eng.charAt(0).toUpperCase() + eng.slice(1);
      const engConfig = DEEP_DIVE_ENGINES[eng] || DEEP_DIVE_ENGINES.duckduckgo;
      const engBaseUrl = engConfig.base + encodeURIComponent(query);

      for (let page = 1; page <= pagesToCrawl; page++) {
        await updateProgress({
          phase: "fetching_results",
          currentPage: page,
          totalPages: pagesToCrawl,
          linksFound: allLinks.length,
          statusText: `Searching ${engLabel} — page ${page} of ${pagesToCrawl}...`
        });

        const searchUrl = page === 1 ? engBaseUrl : engConfig.page(engBaseUrl, page);
        try {
          const resp = await fetch(searchUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0" }
          });
          if (!resp.ok) continue;
          const html = await resp.text();
          const links = extractSearchResultLinks(html, eng);
          for (const url of links) {
            if (!seenUrls.has(url)) {
              seenUrls.add(url);
              allLinks.push({ url, engine: engLabel });
            }
          }
        } catch (e) {
          console.warn(`[DeepDive] Failed to fetch ${engLabel} page ${page}:`, e.message);
        }
      }
    }

    // Cap at 100 results
    const uniqueEntries = allLinks.slice(0, 100);
    const uniqueLinks = uniqueEntries.map(e => e.url);

    if (uniqueLinks.length === 0) {
      await browser.storage.local.set({
        [resultId]: {
          status: "error",
          deepDive: true,
          presetLabel: diveLabel,
          pageTitle: `${diveLabel}: ${rawQuery}`,
          pageUrl: baseSearchUrl,
          error: `No search results could be extracted from ${engineNames.join(", ")}. The search engine(s) may require JavaScript or block automated requests. Try different engines.`
        }
      });
      return;
    }

    // Build link tracker for progress display (with engine attribution)
    const linkTracker = uniqueEntries.map((entry, i) => ({ num: i + 1, url: entry.url, engine: entry.engine, status: "pending" }));

    await updateProgress({
      phase: "fetching_content",
      statusText: `Found ${uniqueLinks.length} links across ${engineNames.join(" + ")}. Fetching page content...`,
      links: linkTracker
    });

    // Phase 2: Fetch content from result links
    const pageContents = [];
    const maxContentPerPage = 4000; // characters per page
    const concurrentFetches = 3;

    for (let i = 0; i < uniqueLinks.length; i += concurrentFetches) {
      const batch = uniqueLinks.slice(i, i + concurrentFetches);
      // Mark batch as fetching
      for (let b = 0; b < batch.length; b++) linkTracker[i + b].status = "fetching";

      const batchPromises = batch.map(async (url, batchIdx) => {
        const idx = i + batchIdx;
        try {
          const resp = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0" },
            signal: AbortSignal.timeout(10000)
          });
          if (!resp.ok) { linkTracker[idx].status = "skip"; return null; }
          const contentType = resp.headers.get("content-type") || "";
          if (!contentType.includes("text/html")) { linkTracker[idx].status = "skip"; return null; }
          const html = await resp.text();
          const { text, title } = extractReadableContent(html);
          if (text.length < 50) { linkTracker[idx].status = "skip"; return null; }
          linkTracker[idx].status = "fetched";
          linkTracker[idx].title = title || url;
          return { index: idx + 1, url, text: text.substring(0, maxContentPerPage), title: title || url, engine: uniqueEntries[idx].engine };
        } catch {
          linkTracker[idx].status = "skip";
          return null;
        }
      });

      const results = await Promise.all(batchPromises);
      for (const r of results) if (r) pageContents.push(r);

      await updateProgress({
        phase: "fetching_content",
        statusText: `Fetching content: ${Math.min(i + concurrentFetches, uniqueLinks.length)}/${uniqueLinks.length} pages (${pageContents.length} with content)...`,
        links: linkTracker
      });
    }

    if (pageContents.length === 0) {
      await browser.storage.local.set({
        [resultId]: {
          status: "error",
          deepDive: true,
          presetLabel: diveLabel,
          pageTitle: `${diveLabel}: ${rawQuery}`,
          pageUrl: baseSearchUrl,
          error: "Could not extract readable content from any search results. Sites may be blocking automated access."
        }
      });
      return;
    }

    // Pause: let user select which sources to send to AI
    await browser.storage.local.set({
      [resultId]: {
        status: "select_sources",
        deepDive: true,
        presetLabel: diveLabel,
        pageTitle: `${diveLabel}: ${rawQuery}`,
        pageUrl: baseSearchUrl,
        fetchedSources: pageContents.map(p => ({ index: p.index, url: p.url, title: p.title, textLength: p.text.length, engine: p.engine })),
        links: linkTracker
      }
    });

    // Wait for user selection
    const selectedIndices = await waitForSourceSelection(resultId);

    // Filter to selected sources
    const selectedContents = selectedIndices
      ? pageContents.filter(p => selectedIndices.includes(p.index))
      : pageContents; // if null, use all (auto-continue)

    if (selectedContents.length === 0) {
      await browser.storage.local.set({
        [resultId]: {
          status: "error",
          deepDive: true,
          presetLabel: diveLabel,
          pageTitle: `${diveLabel}: ${rawQuery}`,
          pageUrl: baseSearchUrl,
          error: "No sources were selected for analysis."
        }
      });
      return;
    }

    // Update tracker for selected vs skipped
    const selectedSet = new Set(selectedContents.map(p => p.index));
    for (const lt of linkTracker) {
      if (lt.status === "fetched" && !selectedSet.has(lt.num)) lt.status = "skip";
    }

    // Phase 3: Per-source AI extraction — force the AI to actually read each source
    const settings = await getProviderSettings();
    const extractionPrompt = `You are extracting key information from a single web page relevant to a search query. Return ONLY the important facts, claims, data points, and quotes from this source that are relevant to the query. Be specific and factual. If the page has nothing relevant, say "No relevant content." Keep your response under 300 words.`;

    const sourceSummaries = [];
    const extractBatchSize = 3;

    for (let i = 0; i < selectedContents.length; i += extractBatchSize) {
      const batch = selectedContents.slice(i, i + extractBatchSize);

      // Mark current batch as reading
      for (const p of batch) linkTracker[p.index - 1].status = "reading";

      await updateProgress({
        phase: "reading_sources",
        statusText: `AI is reading source ${i + 1} of ${selectedContents.length}...`,
        links: linkTracker
      });

      const batchResults = await Promise.all(batch.map(async (p) => {
        try {
          const msgs = buildMessages(extractionPrompt, `Search query: "${rawQuery}"\n\nSource URL: ${p.url}\nSource title: ${p.title}\n\nPage content:\n${p.text}`);
          const r = await callProviderStream(
            settings.provider, settings.apiKey, settings.model, msgs,
            { maxTokens: 1024, temperature: 0.3 },
            null, null
          );
          linkTracker[p.index - 1].status = "done";
          return { ...p, summary: r.content || "No relevant content." };
        } catch (e) {
          console.warn(`[DeepDive] Extraction failed for source ${p.index}:`, e.message);
          linkTracker[p.index - 1].status = "done";
          return { ...p, summary: "Extraction failed." };
        }
      }));

      for (const r of batchResults) sourceSummaries.push(r);

      await updateProgress({
        phase: "reading_sources",
        statusText: `AI read ${Math.min(i + extractBatchSize, selectedContents.length)} of ${selectedContents.length} sources...`,
        links: linkTracker
      });
    }

    // Filter out empty/irrelevant sources
    const usefulSources = sourceSummaries.filter(s =>
      s.summary && !s.summary.toLowerCase().includes("no relevant content") && !s.summary.toLowerCase().includes("extraction failed")
    );

    if (usefulSources.length === 0) {
      await browser.storage.local.set({
        [resultId]: {
          status: "error",
          deepDive: true,
          presetLabel: diveLabel,
          pageTitle: `${diveLabel}: ${rawQuery}`,
          pageUrl: baseSearchUrl,
          error: "None of the search results contained relevant content for this query."
        }
      });
      return;
    }

    // Phase 4: Synthesis with mandatory footnotes
    await updateProgress({
      phase: "synthesizing",
      pagesWithContent: usefulSources.length,
      statusText: `Synthesizing ${usefulSources.length} sources with AI...`
    });

    const sourceSections = usefulSources.map((p, i) =>
      `--- [${i + 1}] ${p.title} (${p.url}) [via ${p.engine || "Unknown"}] ---\n${p.summary}`
    ).join("\n\n");

    // Renumber sources sequentially for the synthesis
    const sourceMap = usefulSources.map((p, i) => ({ num: i + 1, title: p.title, url: p.url, engine: p.engine || "Unknown" }));

    const footnoteBlock = sourceMap.map(s => `- **[${s.num}]** [${s.title}](${s.url}) *(via ${s.engine})*`).join("\n");

    const systemPrompt = `You are a deep research analyst. You have been given AI-extracted summaries from ${usefulSources.length} web sources. Each source has already been individually analyzed. Your job is to synthesize them into a comprehensive research brief.

CRITICAL RULES:
- You MUST cite sources using footnote markers like [1], [2], etc. throughout your text
- Every factual claim must have at least one citation
- Different sources may corroborate or contradict each other — note both

Structure your response as:
1. **Executive Summary** — 2-3 sentence overview
2. **Key Findings** — Main discoveries organized by theme, with citations [N]
3. **Detailed Analysis** — Deeper examination with citations [N]
4. **Contradictions & Gaps** — Where sources disagree or where information is missing
5. **Further Research Suggestions** — Related queries that might yield more insight

After your analysis, add this exact section:

---
## Sources
${footnoteBlock}`;

    const userPrompt = `Search query: "${rawQuery}"
Search engines: ${engineNames.join(", ")}
Pages crawled: ${pagesToCrawl}
Sources with relevant content: ${usefulSources.length} of ${uniqueLinks.length} result links

Here are the extracted insights from each source:

${sourceSections}

Provide a comprehensive deep-dive research synthesis with proper footnote citations.`;

    const messages = buildMessages(systemPrompt, userPrompt);
    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };

    let streamedContent = "";
    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, messages,
      opts,
      async (chunk) => {
        streamedContent += chunk;
        await browser.storage.local.set({
          [resultId]: {
            status: "streaming",
            deepDive: true,
            content: streamedContent,
            model: settings.model,
            provider: settings.provider,
            presetLabel: diveLabel,
            pageTitle: `${diveLabel}: ${rawQuery}`,
            pageUrl: baseSearchUrl,
            progress: {
              phase: "streaming",
              pagesWithContent: usefulSources.length,
              statusText: "AI is synthesizing results..."
            }
          }
        });
      },
      null
    );

    // Build source list for results page
    const sources = sourceMap.map(s => ({
      index: s.num,
      title: s.title,
      url: s.url,
      engine: s.engine
    }));

    // Done
    const resultData = {
      status: "done",
      deepDive: true,
      content: result.content,
      thinking: result.thinking,
      model: result.model,
      usage: result.usage,
      provider: settings.provider,
      presetLabel: diveLabel,
      pageTitle: `${diveLabel}: ${rawQuery}`,
      pageUrl: baseSearchUrl,
      isResearch: true,
      sources,
      resultId
    };
    await browser.storage.local.set({ [resultId]: resultData });

    // Save to history
    await saveToHistory({
      pageTitle: `${diveLabel}: ${rawQuery}`,
      pageUrl: baseSearchUrl,
      provider: settings.provider,
      model: result.model,
      preset: "deep-dive",
      presetLabel: diveLabel,
      content: result.content,
      thinking: result.thinking,
      usage: result.usage,
      promptText: systemPrompt + "\n" + userPrompt
    });

  } catch (err) {
    console.error("[DeepDive] Error:", err.message, err.stack);
    await browser.storage.local.set({
      [resultId]: {
        status: "error",
        deepDive: true,
        presetLabel: diveLabel,
        pageTitle: `${diveLabel}: ${rawQuery}`,
        pageUrl: baseSearchUrl,
        error: `Deep dive failed: ${err.message}`
      }
    });
  }
}

function extractSearchResultLinks(html, engine) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const links = [];
  const seen = new Set();

  // Engine-specific selectors
  const selectors = {
    duckduckgo: "a.result__a, a.result__snippet",
    google: "div.g a[href], div.tF2Cxc a[href]",
    bing: "li.b_algo a[href], .b_title a[href]",
    startpage: ".w-gl__result a[href], .result a[href]",
    brave: "a.result-header[href], .snippet a[href]",
    dogpile: ".web-bing__result a[href], .web__result a[href]",
    yandex: "a.OrganicTitle-Link, .organic__url a",
    searx: "article a[href], .result a[href]",
    mojeek: ".results-standard a[href]",
  };

  // Try engine-specific selectors first
  const engineSelector = selectors[engine];
  if (engineSelector) {
    doc.querySelectorAll(engineSelector).forEach(a => {
      const href = a.href || a.getAttribute("href");
      if (href) links.push(href);
    });
  }

  // Fallback: grab all external-looking links
  if (links.length === 0) {
    doc.querySelectorAll("a[href]").forEach(a => {
      const href = a.href || a.getAttribute("href");
      if (href) links.push(href);
    });
  }

  // Filter and clean
  const blockedDomains = [
    // Search engines
    "duckduckgo.com", "google.com", "bing.com", "startpage.com",
    "brave.com", "dogpile.com", "yandex.com", "yandex.ru",
    "searx.org", "searxng.org", "mojeek.com",
    // Google subdomains
    "accounts.google", "support.google", "maps.google", "play.google",
    // Search engine parent companies / meta pages
    "system1.com", "infospace.com", "blucora.com",
    // Common junk
    "about.com", "w3.org", "schema.org", "creativecommons.org",
    "facebook.com", "twitter.com", "instagram.com", "tiktok.com",
    "pinterest.com", "linkedin.com",
    // YouTube (often just video embeds, no extractable text)
    "youtube.com", "youtu.be",
  ];

  for (const raw of links) {
    let url = raw;

    // DuckDuckGo wraps URLs in redirects
    if (url.includes("//duckduckgo.com/l/?uddg=")) {
      try { url = decodeURIComponent(new URL(url).searchParams.get("uddg") || url); } catch {}
    }
    // Google wraps URLs in /url?q= redirects
    if (url.includes("/url?") && url.includes("q=")) {
      try { url = decodeURIComponent(new URL(url, "https://www.google.com").searchParams.get("q") || url); } catch {}
    }
    // Dogpile/System1 wraps URLs in redirect URLs
    if (url.includes("dogpile.com/click") || url.includes("system1.com")) {
      try {
        const dpu = new URL(url, "https://www.dogpile.com");
        const ru = dpu.searchParams.get("ru") || dpu.searchParams.get("u") || dpu.searchParams.get("url");
        if (ru) url = decodeURIComponent(ru);
      } catch {}
    }

    try {
      const parsed = new URL(url, "https://example.com");
      if (!["http:", "https:"].includes(parsed.protocol)) continue;
      const host = parsed.hostname.toLowerCase();
      if (blockedDomains.some(d => host.includes(d))) continue;
      if (host.includes("javascript:")) continue;
      // Skip very short paths that are likely homepages/landing pages
      if (parsed.pathname === "/" && !parsed.search) continue;
      const clean = parsed.origin + parsed.pathname + parsed.search;
      if (!seen.has(clean)) {
        seen.add(clean);
      }
    } catch { continue; }
  }

  return [...seen];
}

function extractReadableContent(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim() || "";
  // Remove script, style, nav, footer, header elements
  doc.querySelectorAll("script, style, nav, footer, header, aside, iframe, noscript, svg, form").forEach(el => el.remove());
  // Get text content
  const text = (doc.body?.textContent || "")
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  return { text, title };
}

// Initialize conversation history for pre-existing analyses (e.g. project item views)
// so that follow-up questions work even when no live API call created the history.
async function handleInitConversation(message) {
  const { resultId, content, pageTitle, pageUrl } = message;
  if (conversationHistory.has(resultId)) return { success: true, existing: true };

  const settings = await getProviderSettings(null);
  const langInst = await getLanguageInstruction();

  const systemPrompt = `You are Argus, an intelligent analysis assistant. The user is reviewing a previous analysis${pageTitle ? ` of "${pageTitle}"` : ""}${pageUrl ? ` (${pageUrl})` : ""}. Answer follow-up questions about the analysis below. Be concise and insightful.${langInst}

--- Previous Analysis ---
${content}
--- End Analysis ---`;

  conversationHistory.set(resultId, {
    provider: settings.provider,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "assistant", content: content }
    ]
  });
  return { success: true };
}

// ──────────────────────────────────────────────
// Build multimodal user content (text + images) for vision-capable providers
// ──────────────────────────────────────────────
async function buildMultimodalUserContent(question, imageUrls, provider) {
  if (!imageUrls || !imageUrls.length) return question;

  const prov = (provider || "").toLowerCase();

  // Custom providers — text-only fallback
  if (prov === "custom") {
    const urlList = imageUrls.map((u, i) => `[Image ${i + 1}]: ${u}`).join("\n");
    return `${question}\n\n${urlList}`;
  }

  // Helper: fetch image as base64
  async function fetchImageBase64(url) {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { b64: btoa(binary), mime: blob.type || "image/jpeg" };
  }

  // Anthropic needs base64 with {type: "image", source: {type: "base64"}}
  if (prov === "anthropic") {
    const parts = [{ type: "text", text: question }];
    for (const url of imageUrls.slice(0, 5)) {
      try {
        const { b64, mime } = await fetchImageBase64(url);
        parts.push({
          type: "image",
          source: { type: "base64", media_type: mime, data: b64 }
        });
      } catch (e) {
        parts.push({ type: "text", text: `[Image failed to load: ${url}]` });
      }
    }
    return parts;
  }

  // Gemini needs base64 with inline_data format
  if (prov === "gemini") {
    const parts = [{ type: "text", text: question }];
    for (const url of imageUrls.slice(0, 5)) {
      try {
        const { b64, mime } = await fetchImageBase64(url);
        parts.push({
          type: "inline_data",
          inline_data: { mime_type: mime, data: b64 }
        });
      } catch (e) {
        parts.push({ type: "text", text: `[Image failed to load: ${url}]` });
      }
    }
    return parts;
  }

  // OpenAI, Grok — image_url format (natively supported)
  const parts = [{ type: "text", text: question }];
  for (const url of imageUrls.slice(0, 5)) {
    parts.push({
      type: "image_url",
      image_url: { url, detail: "low" }
    });
  }
  return parts;
}

async function handleFollowUp(message) {
  try {
    const { resultId, question, imageUrls, provider: providerOverride } = message;
    const history = conversationHistory.get(resultId);
    if (!history) throw new Error("No conversation history found. The analysis session may have expired.");

    const effectiveProvider = providerOverride || history.provider;
    const settings = await getProviderSettings(effectiveProvider);

    const userContent = await buildMultimodalUserContent(question, imageUrls, settings.provider);
    history.messages.push({ role: "user", content: userContent });

    const followupResultId = `${resultId}-followup-${Date.now()}`;

    await browser.storage.local.set({
      [followupResultId]: { status: "loading" }
    });

    // Stream follow-up in background
    (async () => {
      try {
        let streamedContent = "";
        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, history.messages,
          { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking },
          async (chunk) => {
            streamedContent += chunk;
            await browser.storage.local.set({
              [followupResultId]: { status: "streaming", content: streamedContent }
            });
          },
          null
        );

        history.messages.push({ role: "assistant", content: result.content });
        conversationHistory.set(resultId, history);

        await browser.storage.local.set({
          [followupResultId]: {
            status: "done", content: result.content, thinking: result.thinking,
            model: result.model, usage: result.usage, provider: settings.provider
          }
        });
      } catch (err) {
        await browser.storage.local.set({
          [followupResultId]: { status: "error", error: err.message }
        });
      }
    })();

    return { success: true, followupResultId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Start conversation (seed context for chat on any result page)
// ──────────────────────────────────────────────
async function handleStartConversation(message) {
  try {
    const { contextType, contextData, pageUrl, pageTitle, question, imageUrls, provider: providerOverride } = message;
    const settings = await getProviderSettings(providerOverride || null);

    const conversationId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const langInst = await getLanguageInstruction();

    const systemPrompt = `You are Argus, an intelligent analysis assistant. The user is viewing ${contextType} results${pageTitle ? ` for "${pageTitle}"` : ""}${pageUrl ? ` (${pageUrl})` : ""}. Answer questions about the data below. Be concise and insightful.${langInst}

--- ${contextType} Data ---
${contextData}
--- End Data ---`;

    // Build user message — multimodal if images are attached
    const userContent = await buildMultimodalUserContent(question, imageUrls, settings.provider);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ];

    const followupResultId = `${conversationId}-followup-${Date.now()}`;
    await browser.storage.local.set({ [followupResultId]: { status: "loading" } });

    // Store conversation history for subsequent follow-ups
    conversationHistory.set(conversationId, { provider: settings.provider, messages: [...messages] });

    // Stream in background
    (async () => {
      try {
        let streamedContent = "";
        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, messages,
          { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking },
          async (chunk) => {
            streamedContent += chunk;
            await browser.storage.local.set({ [followupResultId]: { status: "streaming", content: streamedContent } });
          },
          null
        );

        const history = conversationHistory.get(conversationId);
        if (history) {
          history.messages.push({ role: "assistant", content: result.content });
          conversationHistory.set(conversationId, history);
        }

        await browser.storage.local.set({
          [followupResultId]: {
            status: "done", content: result.content, thinking: result.thinking,
            model: result.model, usage: result.usage, provider: settings.provider
          }
        });
      } catch (err) {
        await browser.storage.local.set({ [followupResultId]: { status: "error", error: err.message } });
      }
    })();

    return { success: true, conversationId, followupResultId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Re-analyze (same page, different preset, same tab)
// ──────────────────────────────────────────────
async function handleReAnalyze(message) {
  try {
    const { pageUrl, analysisType, provider: providerOverride, customPrompt } = message;
    if (!pageUrl) return { success: false, error: "No page URL available for re-analysis." };

    const settings = await getProviderSettings(providerOverride, analysisType);

    // Try to find the original tab by URL and extract content from it
    let page;
    try {
      const tabs = await browser.tabs.query({ url: pageUrl });
      if (tabs.length > 0) {
        page = await extractPageContent(tabs[0].id);
      }
    } catch { /* tab not found or can't inject */ }

    // Fallback: fetch page content by URL
    if (!page || !page.text) {
      const text = await fetchPageText(pageUrl);
      page = { title: message.pageTitle || pageUrl, url: pageUrl, description: "", text };
    }

    const presetLabel = ANALYSIS_PRESETS[analysisType]?.label ||
      settings.customPresets?.[analysisType]?.label || analysisType;
    const reResultId = `reanalyze-${Date.now()}`;

    await browser.storage.local.set({
      [reResultId]: { status: "loading" }
    });

    // Stream in background
    (async () => {
      try {
        const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
        const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, analysisType, customPrompt, settings);
        const messages = buildMessages(systemPrompt, userPrompt);

        let streamedContent = "";
        const result = await callProviderStream(
          settings.provider, settings.apiKey, settings.model, messages, opts,
          async (chunk) => {
            streamedContent += chunk;
            await browser.storage.local.set({
              [reResultId]: { status: "streaming", content: streamedContent, provider: settings.provider, model: settings.model, presetLabel }
            });
          },
          null
        );

        await saveToHistory({
          pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
          model: result.model, preset: analysisType, presetLabel,
          content: result.content, thinking: result.thinking, usage: result.usage
        });

        await browser.storage.local.set({
          [reResultId]: {
            status: "done", content: result.content, thinking: result.thinking,
            model: result.model, usage: result.usage, provider: settings.provider, presetLabel
          }
        });
      } catch (err) {
        await browser.storage.local.set({
          [reResultId]: { status: "error", error: err.message }
        });
      }
    })();

    return { success: true, reResultId, presetLabel };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Per-page tab navigation — reuse the tab already showing this page, or open a new one
// ──────────────────────────────────────────────
async function openArgusPage(url) {
  // Strip query/hash to match on the page path only
  const pagePath = url.split("?")[0].split("#")[0];
  const existing = await browser.tabs.query({ url: pagePath + "*" });
  if (existing.length > 0) {
    await browser.tabs.update(existing[0].id, { active: true, url });
    await browser.windows.update(existing[0].windowId, { focused: true });
  } else {
    await browser.tabs.create({ url });
  }
}

// ──────────────────────────────────────────────
// Context menu click handler
// ──────────────────────────────────────────────
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  // Chat with AI
  if (info.menuItemId === "argus-chat") {
    openArgusPage(browser.runtime.getURL("chat/chat.html"));
    return;
  }
  if (info.menuItemId === "argus-chat-selection") {
    const text = (info.selectionText || "").trim();
    if (text) {
      openArgusPage(browser.runtime.getURL(`chat/chat.html?msg=${encodeURIComponent(text)}`));
    } else {
      openArgusPage(browser.runtime.getURL("chat/chat.html"));
    }
    return;
  }

  // Workbench
  if (info.menuItemId === "argus-workbench") {
    openArgusPage(browser.runtime.getURL("workbench/workbench.html"));
    return;
  }

  // Open Argus Console
  if (info.menuItemId === "argus-console") {
    openArgusPage(browser.runtime.getURL("options/options.html"));
    return;
  }

  // Save to Drive — fetch file and upload to all connected cloud providers
  if (info.menuItemId === "argus-save-to-cloud") {
    const url = info.linkUrl || info.srcUrl;
    if (url) handleSaveToCloud(url, tab);
    return;
  }
  if (info.menuItemId === "argus-save-page-to-cloud") {
    if (tab && tab.url) handleSaveToCloud(tab.url, tab);
    return;
  }

  // Add to Sources (right-click → page or link)
  if (info.menuItemId === "argus-source-ungrouped" || info.menuItemId.startsWith("argus-source-folder-")) {
    const folder = info.menuItemId === "argus-source-ungrouped"
      ? ""
      : info.menuItemId.replace("argus-source-folder-", "");
    const url = info.linkUrl || (tab && tab.url) || "";
    if (!url || url.startsWith("about:") || url.startsWith("moz-extension:") || url.startsWith("chrome:")) return;
    let name = "";
    try { name = new URL(url).hostname.replace(/^www\./, ""); } catch { name = url.slice(0, 80); }
    // If it's the page itself (not a link), use the tab title
    if (!info.linkUrl && tab?.title) name = tab.title.slice(0, 120);

    const source = {
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: "entity",
      aliases: [],
      addresses: [{ type: "website", value: url, label: "" }],
      tags: ["context-menu"],
      location: "",
      notes: "",
      folder,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await ArgusDB.Sources.save(source);
      // Rebuild menus so new folder shows up
      createContextMenus();
    } catch (e) { console.warn("[Argus] Failed to save source from context menu:", e); }
    return;
  }

  // Wipe All Data — opens console Settings tab scrolled to wipe section
  if (info.menuItemId === "argus-wipe") {
    openArgusPage(browser.runtime.getURL("options/options.html#settings-wipe"));
    return;
  }

  // Open Help (GitHub README)
  if (info.menuItemId === "argus-help") {
    browser.tabs.create({ url: "https://github.com/n3r4-life/argus360#readme" });
    return;
  }

  // Open OSINT Dashboard
  if (info.menuItemId === "argus-osint-dashboard") {
    openArgusPage(browser.runtime.getURL("options/options.html#osint"));
    return;
  }

  // Open Global Knowledge Graph
  if (info.menuItemId === "argus-osint-global-graph") {
    openArgusPage(browser.runtime.getURL("osint/graph.html?mode=global"));
    return;
  }

  // Open Feed Reader
  if (info.menuItemId === "argus-open-reader") {
    openArgusPage(browser.runtime.getURL("feeds/feeds.html"));
    return;
  }

  // Open Reports
  if (info.menuItemId === "argus-reports") {
    openArgusPage(browser.runtime.getURL("history/history.html"));
    return;
  }

  // Run automation from context menu
  if (info.menuItemId.startsWith("argus-automation-")) {
    const automationId = info.menuItemId.replace("argus-automation-", "");
    try {
      const result = await AutomationEngine.run(automationId, { tabId: tab.id });
      if (result.success) {
        safeNotify(null, {
          type: "basic",
          iconUrl: "icons/icon-96.png",
          title: "Automation Complete",
          message: `${result.automationName || "Automation"} finished on ${tab.title || tab.url}`
        });
      } else {
        safeNotify(null, {
          type: "basic",
          iconUrl: "icons/icon-96.png",
          title: "Automation Failed",
          message: result.error || "Unknown error"
        });
      }
    } catch (e) {
      console.error("[Automation] Context menu run failed:", e);
    }
    return;
  }

  // Handle bookmark context menu
  if (info.menuItemId === "argus-bookmark") {
    try {
      const page = await extractFrameContent(tab.id, info.frameId);
      const settings = await getProviderSettings().catch(() => null);
      if (settings) {
        const tagData = await aiTagBookmark(page, settings);
        tagData.aiTagged = true;
        await saveBookmark(page, tagData);
      } else {
        await saveBookmark(page, { tags: [], category: "other", summary: page.description || "" });
      }
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Bookmarked: ${page.title}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to bookmark: ${err.message}`
      });
    }
    return;
  }

  // Handle ArgusMarks — bookmark to folder
  if (info.menuItemId.startsWith("argus-marks-save-")) {
    const folderId = info.menuItemId.replace("argus-marks-save-", "");
    try {
      const page = await extractFrameContent(tab.id, info.frameId);
      const settings = await getProviderSettings().catch(() => null);
      const tagData = settings
        ? Object.assign(await aiTagBookmark(page, settings), { aiTagged: true })
        : { tags: [], category: "other", summary: page.description || "" };
      tagData.folderId = folderId;
      await saveBookmark(page, tagData);
      const folder = await ArgusDB.BookmarkFolders.get(folderId);
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Bookmarked to ${folder ? folder.name : "folder"}: ${page.title}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to bookmark: ${err.message}`
      });
    }
    return;
  }

  // Handle ArgusMarks — manage bookmarks
  if (info.menuItemId === "argus-marks-manage") {
    browser.tabs.create({ url: browser.runtime.getURL("options/options.html#bookmarks") });
    return;
  }

  // Handle add to project context menu
  if (info.menuItemId.startsWith("argus-project-")) {
    const projectId = info.menuItemId.replace("argus-project-", "");
    try {
      await handleAddProjectItem({
        projectId,
        item: {
          type: "url",
          url: tab.url,
          title: tab.title || tab.url,
          summary: "",
          tags: []
        }
      });
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Saved link to project: ${tab.title || tab.url}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to add to project: ${err.message}`
      });
    }
    return;
  }

  // Handle monitor context menu
  if (info.menuItemId === "argus-monitor") {
    try {
      const result = await handleAddMonitor({
        url: tab.url,
        title: tab.title || tab.url,
        intervalMinutes: 60,
        aiAnalysis: true,
        autoBookmark: true,
        autoOpen: false,
        analysisPreset: "",
        duration: 0
      });
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: result.success
          ? `Now monitoring: ${tab.title || tab.url}`
          : `Monitor: ${result.error}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to add monitor: ${err.message}`
      });
    }
    return;
  }

  // Handle snapshot context menu
  if (info.menuItemId === "argus-snapshot") {
    try {
      const result = await handleSnapshotPage({ tabId: tab.id, url: tab.url, title: tab.title });
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: result.success
          ? `Snapshot saved: ${tab.title || tab.url}`
          : `Snapshot failed: ${result.error}`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Snapshot failed: ${err.message}`
      });
    }
    return;
  }

  // Handle image grabber context menu
  if (info.menuItemId === "argus-images") {
    try {
      const resp = await handleExtractImages({ tabId: tab.id });
      if (resp.success) {
        const storeKey = `images-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { pageUrl: resp.pageUrl, pageTitle: resp.pageTitle, images: resp.images, stats: resp.stats } });
        const targetUrl = browser.runtime.getURL(`osint/images.html?id=${encodeURIComponent(storeKey)}`);
        const existing = (await browser.tabs.query({ url: browser.runtime.getURL('osint/images.html*') }))[0];
        if (existing) {
          browser.tabs.update(existing.id, { url: targetUrl, active: true });
        } else {
          browser.tabs.create({ url: targetUrl });
        }
      } else {
        safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus", message: `Image grab failed: ${resp.error}` });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus — Error", message: `Image grab failed: ${err.message}` });
    }
    return;
  }

  // Handle redirect/archive context menu
  if (info.menuItemId === "argus-redirect") {
    try {
      const providerUrl = archiveProviderUrl || "https://archive.is/";
      await browser.tabs.update(tab.id, { url: providerUrl + tab.url });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to redirect: ${err.message}`
      });
    }
    return;
  }

  // Handle save to archive context menu
  if (info.menuItemId === "argus-save-archive") {
    try {
      const submitUrl = "https://archive.is/?run=1&url=" + encodeURIComponent(tab.url);
      await browser.tabs.create({ url: submitUrl });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to save to archive: ${err.message}`
      });
    }
    return;
  }

  // Handle add site to trouble list
  if (info.menuItemId === "argus-add-trouble-list") {
    try {
      const host = new URL(tab.url).hostname.replace(/^www\./, "");
      const { archiveRedirect } = await browser.storage.local.get({
        archiveRedirect: { enabled: false, domains: DEFAULT_ARCHIVE_DOMAINS, providerUrl: "https://archive.is/" }
      });
      const domains = archiveRedirect.domains || [];
      if (!domains.includes(host)) {
        domains.push(host);
        archiveRedirect.domains = domains;
        await browser.storage.local.set({ archiveRedirect });
      }
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus",
        message: `Added ${host} to Trouble List`
      });
    } catch (err) {
      safeNotify(null, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Failed to add to Trouble List: ${err.message}`
      });
    }
    return;
  }

  // Handle tech stack detection
  if (info.menuItemId === "argus-techstack") {
    try {
      const resp = await handleDetectTechStack({ tabId: tab.id });
      if (resp && resp.success) {
        const storeKey = `techstack-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { pageUrl: tab.url, pageTitle: tab.title, technologies: resp.technologies } });
        await browser.tabs.create({ url: browser.runtime.getURL(`osint/techstack.html?id=${encodeURIComponent(storeKey)}`) });
      } else {
        safeNotify(null, {
          type: "basic", iconUrl: "icons/icon-96.png",
          title: "Argus — Error",
          message: resp?.error || "Tech stack detection failed"
        });
      }
    } catch (err) {
      safeNotify(null, {
        type: "basic", iconUrl: "icons/icon-96.png",
        title: "Argus — Error",
        message: `Tech stack detection failed: ${err.message}`
      });
    }
    return;
  }

  // Handle regex scan from context menu
  if (info.menuItemId === "argus-regex-scan") {
    try {
      const resp = await handleRegexScanPage({ tabId: tab.id });
      if (resp && resp.success) {
        const storeKey = `regex-${Date.now()}`;
        const { html, text, ...scanResults } = resp;
        const sourceKey = storeKey + "-source";
        await browser.storage.local.set({
          [storeKey]: { ...scanResults, pageUrl: tab.url, pageTitle: tab.title, sourceKey },
          [sourceKey]: { html, text }
        });
        await openArgusPage(browser.runtime.getURL(`osint/regex.html?id=${encodeURIComponent(storeKey)}`));
      } else {
        safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus", message: resp?.error || "Regex scan failed" });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus — Error", message: `Regex scan failed: ${err.message}` });
    }
    return;
  }

  // Handle site version checks
  if (info.menuItemId === "argus-check-archive") {
    try {
      const checkUrl = `https://archive.is/newest/${tab.url}`;
      const resp = await fetch(checkUrl, { method: "HEAD", redirect: "follow" });
      if (resp.ok && resp.url && resp.url !== checkUrl && !resp.url.includes("/newest/")) {
        await browser.tabs.create({ url: resp.url });
      } else {
        safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus", message: "No archived version found on archive.is" });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus — Error", message: `Archive check failed: ${err.message}` });
    }
    return;
  }

  if (info.menuItemId === "argus-check-wayback") {
    try {
      const snapshot = await checkWaybackAvailability(tab.url);
      if (snapshot && snapshot.url) {
        await browser.tabs.create({ url: snapshot.url });
      } else {
        safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus", message: "No Wayback Machine snapshot found" });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus — Error", message: `Wayback check failed: ${err.message}` });
    }
    return;
  }


  // ── OSINT Tool handlers ──
  if (info.menuItemId === "argus-extract-metadata") {
    try {
      const result = await handleExtractMetadata({ tabId: tab.id });
      if (result.success) {
        const storeKey = `metadata-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { ...result.metadata, pageUrl: tab.url, pageTitle: tab.title } });
        openArgusPage(browser.runtime.getURL(`results/results.html?metadata=${encodeURIComponent(storeKey)}`));
      } else {
        safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus", message: result.error || "Failed to extract metadata." });
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus - Error", message: err.message });
    }
    return;
  }

  if (info.menuItemId === "argus-map-links") {
    try {
      const result = await handleExtractLinks({ tabId: tab.id });
      if (result.success) {
        const storeKey = `linkmap-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { pageUrl: tab.url, pageTitle: tab.title, links: result.links, stats: result.stats } });
        const targetUrl = browser.runtime.getURL(`osint/link-map.html?id=${encodeURIComponent(storeKey)}`);
        const existing = (await browser.tabs.query({ url: browser.runtime.getURL('osint/link-map.html*') }))[0];
        if (existing) {
          browser.tabs.update(existing.id, { url: targetUrl, active: true });
        } else {
          browser.tabs.create({ url: targetUrl });
        }
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus - Error", message: err.message });
    }
    return;
  }

  if (info.menuItemId === "argus-whois") {
    try {
      const domain = new URL(tab.url).hostname;
      const result = await handleWhoisLookup({ domain });
      if (result.success) {
        const storeKey = `whois-${Date.now()}`;
        await browser.storage.local.set({ [storeKey]: { ...result, pageUrl: tab.url, pageTitle: tab.title } });
        openArgusPage(browser.runtime.getURL(`results/results.html?whois=${encodeURIComponent(storeKey)}`));
      }
    } catch (err) {
      safeNotify(null, { type: "basic", iconUrl: "icons/icon-96.png", title: "Argus - Error", message: err.message });
    }
    return;
  }

  if (!info.menuItemId.startsWith("argus-analyze-")) return;

  const presetKey = info.menuItemId.replace("argus-analyze-", "");
  const settings = await getProviderSettings().catch(() => null);
  if (!settings) return;

  const preset = ANALYSIS_PRESETS[presetKey] || settings.customPresets[presetKey];
  if (!preset) return;

  const resultId = `tl-result-${Date.now()}`;

  await browser.storage.local.set({
    [resultId]: {
      status: "loading",
      presetLabel: preset.label || presetKey,
      pageTitle: tab.title || "Untitled Page",
      pageUrl: tab.url || ""
    }
  });

  const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
  await openArgusPage(resultsUrl);

  try {
    let page;
    if (info.selectionText) {
      // Use selected text
      page = {
        title: tab.title || "Selected Text",
        url: tab.url || "",
        description: "",
        text: info.selectionText
      };
    } else {
      // Try frame extraction first; if it fails on a PDF, use extractPageContent which has PDF fallbacks
      try {
        page = await extractFrameContent(tab.id, info.frameId);
      } catch (frameErr) {
        console.warn("[Argus] Frame extraction failed, trying page extraction:", frameErr.message);
        page = await extractPageContent(tab.id);
      }
    }

    const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, presetKey, null, settings);
    const messages = buildMessages(systemPrompt, userPrompt);

    // Stream to storage for results page
    let streamedContent = "";
    const result = await callProviderStream(
      settings.provider, settings.apiKey, settings.model, messages,
      opts,
      async (chunk) => {
        streamedContent += chunk;
        await browser.storage.local.set({
          [resultId]: {
            status: "streaming",
            content: streamedContent,
            model: settings.model,
            provider: settings.provider,
            presetLabel: preset.label || presetKey,
            pageTitle: page.title,
            pageUrl: page.url
          }
        });
      },
      null
    );

    // Store conversation history keyed by resultId for follow-ups
    conversationHistory.set(resultId, {
      provider: settings.provider,
      messages: [...messages, { role: "assistant", content: result.content }]
    });

    await browser.storage.local.set({
      [resultId]: {
        status: "done",
        content: result.content,
        thinking: result.thinking,
        model: result.model,
        usage: result.usage,
        provider: settings.provider,
        presetLabel: preset.label || presetKey,
        pageTitle: page.title,
        pageUrl: page.url,
        resultId
      }
    });

    // Save to history
    await saveToHistory({
      pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
      model: result.model, preset: presetKey, presetLabel: preset.label || presetKey,
      content: result.content, thinking: result.thinking, usage: result.usage,
      isSelection: !!info.selectionText
    });
  } catch (err) {
    console.error("[Argus contextMenu] Error:", err.message, err.stack);
    await browser.storage.local.set({
      [resultId]: {
        status: "error",
        error: `[ContextMenu] ${err.message}` || "An unexpected error occurred.",
        presetLabel: preset.label || presetKey,
        pageTitle: tab.title || "Untitled Page",
        pageUrl: tab.url || ""
      }
    });
  }
});

// ──────────────────────────────────────────────
// Keyboard shortcuts handler
// ──────────────────────────────────────────────
browser.commands.onCommand.addListener(async (command) => {
  if (command === "quick-summary") {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length) return;
    const tab = tabs[0];

    const resultId = `tl-result-${Date.now()}`;
    await browser.storage.local.set({
      [resultId]: { status: "loading", presetLabel: "Summary", pageTitle: tab.title, pageUrl: tab.url }
    });
    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await openArgusPage(resultsUrl);

    try {
      const settings = await getProviderSettings();
      const page = await extractPageContent(tab.id);
      const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
      const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, "summary", null, settings);
      const messages = buildMessages(systemPrompt, userPrompt);

      let streamedContent = "";
      const result = await callProviderStream(
        settings.provider, settings.apiKey, settings.model, messages,
        opts,
        async (chunk) => {
          streamedContent += chunk;
          await browser.storage.local.set({
            [resultId]: { status: "streaming", content: streamedContent, model: settings.model, provider: settings.provider, presetLabel: "Summary", pageTitle: page.title, pageUrl: page.url }
          });
        }
      );

      await browser.storage.local.set({
        [resultId]: { status: "done", content: result.content, model: result.model, usage: result.usage, provider: settings.provider, presetLabel: "Summary", pageTitle: page.title, pageUrl: page.url }
      });

      await saveToHistory({
        pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
        model: result.model, preset: "summary", presetLabel: "Summary",
        content: result.content, usage: result.usage
      });
    } catch (err) {
      await browser.storage.local.set({
        [resultId]: { status: "error", error: err.message, presetLabel: "Summary", pageTitle: tab.title, pageUrl: tab.url }
      });
    }
  }

  if (command === "quick-selection") {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length) return;
    const tab = tabs[0];
    const selection = await extractSelection(tab.id);
    if (!selection || selection.trim().length < 5) return;

    const resultId = `tl-result-${Date.now()}`;
    await browser.storage.local.set({
      [resultId]: { status: "loading", presetLabel: "Selection Analysis", pageTitle: tab.title, pageUrl: tab.url }
    });
    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await openArgusPage(resultsUrl);

    try {
      const settings = await getProviderSettings();
      const page = { title: tab.title, url: tab.url, description: "", text: selection };
      const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
      const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, "summary", null, settings);
      const messages = buildMessages(systemPrompt, userPrompt);

      let streamedContent = "";
      const result = await callProviderStream(
        settings.provider, settings.apiKey, settings.model, messages,
        opts,
        async (chunk) => {
          streamedContent += chunk;
          await browser.storage.local.set({
            [resultId]: { status: "streaming", content: streamedContent, model: settings.model, provider: settings.provider, presetLabel: "Selection Analysis", pageTitle: page.title, pageUrl: page.url }
          });
        }
      );

      await browser.storage.local.set({
        [resultId]: { status: "done", content: result.content, model: result.model, usage: result.usage, provider: settings.provider, presetLabel: "Selection Analysis", pageTitle: page.title, pageUrl: page.url }
      });

      await saveToHistory({
        pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
        model: result.model, preset: "summary", presetLabel: "Selection Analysis",
        content: result.content, usage: result.usage, isSelection: true
      });
    } catch (err) {
      await browser.storage.local.set({
        [resultId]: { status: "error", error: err.message, presetLabel: "Selection Analysis", pageTitle: tab.title, pageUrl: tab.url }
      });
    }
  }
});

// ──────────────────────────────────────────────
// Auto-analyze rules
// ──────────────────────────────────────────────
function matchUrlPattern(url, pattern) {
  // Convert glob pattern to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  try {
    return new RegExp(`^${escaped}$`, "i").test(url);
  } catch {
    return false;
  }
}

// Auto-analyze requires optional webNavigation permission
let autoAnalyzeRegistered = false;
const autoAnalyzeCallback = async (details) => {
  // Only main frame
  if (details.frameId !== 0) return;

  const { autoAnalyzeRules } = await browser.storage.local.get({ autoAnalyzeRules: [] });
  if (!autoAnalyzeRules.length) return;

  const url = details.url;
  if (!url || url.startsWith("about:") || url.startsWith("moz-extension:")) return;

  // Check cooldown
  const cooldownKey = `${details.tabId}-${url}`;
  const lastRun = autoAnalyzeCooldown.get(cooldownKey);
  if (lastRun && Date.now() - lastRun < 60000) return; // 1 minute cooldown

  for (const rule of autoAnalyzeRules) {
    if (!rule.enabled) continue;
    if (!matchUrlPattern(url, rule.urlPattern)) continue;

    autoAnalyzeCooldown.set(cooldownKey, Date.now());

    // Delay before analyzing
    await new Promise(r => setTimeout(r, rule.delay || 2000));

    const tab = await browser.tabs.get(details.tabId);
    const resultId = `tl-result-${Date.now()}`;
    const presetKey = rule.preset || "summary";
    const preset = ANALYSIS_PRESETS[presetKey];

    await browser.storage.local.set({
      [resultId]: { status: "loading", presetLabel: preset?.label || presetKey, pageTitle: tab.title, pageUrl: tab.url }
    });
    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await openArgusPage(resultsUrl);

    try {
      const settings = await getProviderSettings(rule.provider || null);
      const page = await extractPageContent(details.tabId);
      const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
      const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, presetKey, null, settings);
      const messages = buildMessages(systemPrompt, userPrompt);

      let streamedContent = "";
      const result = await callProviderStream(
        settings.provider, settings.apiKey, settings.model, messages,
        opts,
        async (chunk) => {
          streamedContent += chunk;
          await browser.storage.local.set({
            [resultId]: { status: "streaming", content: streamedContent, model: settings.model, provider: settings.provider, presetLabel: preset?.label || presetKey, pageTitle: page.title, pageUrl: page.url }
          });
        }
      );

      await browser.storage.local.set({
        [resultId]: { status: "done", content: result.content, model: result.model, usage: result.usage, provider: settings.provider, presetLabel: preset?.label || presetKey, pageTitle: page.title, pageUrl: page.url }
      });

      await saveToHistory({
        pageTitle: page.title, pageUrl: page.url, provider: settings.provider,
        model: result.model, preset: presetKey, presetLabel: preset?.label || presetKey,
        content: result.content, usage: result.usage, autoAnalyzed: true
      });
    } catch (err) {
      console.error("[Argus AutoAnalyze] Error:", err.message, err.stack);
      await browser.storage.local.set({
        [resultId]: { status: "error", error: `[AutoAnalyze] ${err.message}`, presetLabel: preset?.label || presetKey, pageTitle: tab.title, pageUrl: tab.url }
      });
    }

    break; // Only first matching rule
  }

  // Also check named automations
  try {
    const matchingAutos = await AutomationEngine.matchUrl(url);
    for (const auto of matchingAutos) {
      const delay = auto.delay || 2000;
      await new Promise(r => setTimeout(r, delay));
      AutomationEngine.run(auto.id, { tabId: details.tabId }).catch(e =>
        console.warn(`[Automation] ${auto.name} failed:`, e)
      );
    }
  } catch (e) {
    console.warn("[Automation] URL trigger check failed:", e);
  }
};
initWebNavigation(autoAnalyzeCallback).then(ok => { autoAnalyzeRegistered = ok; });

// ──────────────────────────────────────────────
// Forced-Private / Incognito Sites
// ──────────────────────────────────────────────
let incognitoForceRegistered = false;

const incognitoForceCallback = async (details) => {
  // Only main frame navigations
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!url || url.startsWith("about:") || url.startsWith("moz-extension:") || url.startsWith("chrome:")) return;

  // Check if feature is enabled
  const { incognitoForceEnabled, incognitoSites } = await browser.storage.local.get({
    incognitoForceEnabled: false,
    incognitoSites: []
  });
  if (!incognitoForceEnabled || !incognitoSites.length) return;

  // Check if already in a private window — don't redirect again
  try {
    const win = await browser.windows.get(details.windowId || (await browser.tabs.get(details.tabId)).windowId);
    if (win.incognito) return;
  } catch { return; }

  // Match domain
  let hostname = "";
  try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch { return; }

  const isForced = incognitoSites.some(d => hostname === d || hostname.endsWith("." + d));
  if (!isForced) return;

  // Open in private window and close the original tab
  try {
    await browser.windows.create({ url, incognito: true });
    // Close the tab that triggered this navigation (go back or close)
    await browser.tabs.remove(details.tabId);
    console.log(`[Argus] Forced private window for: ${hostname}`);
  } catch (err) {
    console.warn("[Argus] Could not force private window:", err.message);
  }
};

async function initIncognitoForce() {
  if (incognitoForceRegistered) return true;
  if (await hasPermission("webNavigation")) {
    browser.webNavigation.onBeforeNavigate.addListener(incognitoForceCallback);
    incognitoForceRegistered = true;
    console.log("[Argus] Incognito force listener registered");
    return true;
  }
  return false;
}

// Auto-register on startup if enabled
(async () => {
  const { incognitoForceEnabled } = await browser.storage.local.get({ incognitoForceEnabled: false });
  if (incognitoForceEnabled) initIncognitoForce();
})();

// ──────────────────────────────────────────────
// Smart Bookmarking
// ──────────────────────────────────────────────
const BOOKMARK_TAG_PROMPT = {
  system: "You are a librarian, intelligence analyst, and information organizer. Respond ONLY with valid JSON, no markdown fences.",
  prompt: `Analyze this webpage and generate a comprehensive smart bookmark snapshot.

Return JSON with this exact structure:
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "one-word-category",
  "summary": "One sentence summary of the page content.",
  "tldr": "2-3 sentence TLDR covering the key facts, who/what/when/where.",
  "readingTime": "X min",
  "contentType": "article|blog|documentation|forum|social|video|product|tool|dataset|government|academic|other",
  "language": "en",
  "keyFacts": ["fact 1", "fact 2", "fact 3"]
}

Rules:
- tags: 3-7 lowercase tags that describe the content. Be specific (e.g., "react-hooks" not just "programming").
- category: A single broad category like "tech", "news", "finance", "science", "health", "politics", "tutorial", "reference", "entertainment", "shopping", "social", "other".
- summary: A concise one-sentence summary (max 150 chars).
- tldr: 2-3 sentences covering the essential facts. Who is involved, what happened, when, key numbers.
- keyFacts: 2-5 brief factual bullet points extracted from the content.
- contentType: What kind of page this is.
- language: ISO 639-1 language code of the content.`
};

async function saveBookmark(pageData, options = {}) {
  // Check for duplicate URL
  const existing = await ArgusDB.Bookmarks.getByUrl(pageData.url);

  const bookmark = {
    id: existing ? existing.id : `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: pageData.url,
    title: pageData.title,
    text: (pageData.text || "").slice(0, 50000),
    savedAt: existing ? existing.savedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: options.tags || [],
    category: options.category || "other",
    summary: options.summary || "",
    readingTime: options.readingTime || "",
    notes: options.notes || (existing ? existing.notes : ""),
    aiTagged: !!options.aiTagged,
    // Smart bookmark fields
    folderId: options.folderId || (existing ? existing.folderId : "") || "",
    projectId: options.projectId || (existing ? existing.projectId : "") || "",
    tldr: options.tldr || "",
    contentType: options.contentType || "",
    language: options.language || "",
    keyFacts: options.keyFacts || [],
    // Tech stack & meta (populated async after save)
    techStack: existing ? existing.techStack : null,
    meta: options.meta || (existing ? existing.meta : null),
    snapshotId: existing ? existing.snapshotId : null,
    favicon: pageData.favicon || (existing ? existing.favicon : "") || "",
  };

  await ArgusDB.Bookmarks.add(bookmark);

  // Extract entities for knowledge graph (non-blocking)
  try {
    const kgText = (bookmark.summary || "") + "\n" + (bookmark.text || "").slice(0, 5000);
    if (kgText.trim()) KnowledgeGraph.extractAndUpsert(kgText, bookmark.url, bookmark.title, null);
  } catch (e) { console.warn("[KG] bookmark entity extraction failed:", e); }

  return bookmark;
}

async function aiTagBookmark(pageData, settings) {
  const textSnippet = (pageData.text || "").slice(0, 3000);
  const userPrompt = `Title: ${pageData.title}\nURL: ${pageData.url}\n\nContent:\n${textSnippet}`;

  // Use custom prompt if set, otherwise fall back to default
  const { bookmarkTagPrompt: customPrompt } = await browser.storage.local.get({ bookmarkTagPrompt: "" });
  const promptText = customPrompt || BOOKMARK_TAG_PROMPT.prompt;
  const messages = buildMessages(BOOKMARK_TAG_PROMPT.system, promptText + "\n\n" + userPrompt);

  const result = await callProvider(
    settings.provider, settings.apiKey, settings.model, messages,
    { maxTokens: 500, temperature: 0.3 }
  );

  try {
    // Strip markdown fences if present
    let content = result.content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(content);
    return {
      tags: parsed.tags || [],
      category: parsed.category || "other",
      summary: parsed.summary || "",
      readingTime: parsed.readingTime || "",
      tldr: parsed.tldr || "",
      contentType: parsed.contentType || "",
      language: parsed.language || "",
      keyFacts: parsed.keyFacts || [],
    };
  } catch {
    return { tags: [], category: "other", summary: "", readingTime: "", tldr: "", contentType: "", language: "", keyFacts: [] };
  }
}

async function handleBookmarkPage(message) {
  try {
    const tabId = message.tabId;
    let page;
    if (message.pageData) {
      page = message.pageData;
    } else {
      page = await extractPageContent(tabId);
    }

    // Extract page meta from content script (favicon, description, og tags, canonical)
    let pageMeta = null;
    try {
      const metaResults = await browser.tabs.executeScript(tabId, {
        code: `(function() {
          const getMeta = (n) => { const el = document.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]'); return el ? el.content : ''; };
          return {
            description: getMeta('description') || getMeta('og:description'),
            ogImage: getMeta('og:image'),
            ogTitle: getMeta('og:title'),
            ogType: getMeta('og:type'),
            canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
            favicon: (document.querySelector('link[rel="icon"],link[rel="shortcut icon"]') || {}).href || '',
            author: getMeta('author'),
            publishedTime: getMeta('article:published_time') || getMeta('datePublished'),
          };
        })()`
      });
      pageMeta = metaResults?.[0] || null;
    } catch { /* content script injection failed — ok for some pages */ }

    if (pageMeta) {
      page.favicon = pageMeta.favicon || page.favicon || "";
    }

    let tagData = { tags: [], category: "other", summary: "", readingTime: "", tldr: "", contentType: "", language: "", keyFacts: [] };

    // AI tagging if requested (default: true)
    if (message.aiTag !== false) {
      try {
        const settings = await getProviderSettings(message.provider);
        tagData = await aiTagBookmark(page, settings);
        tagData.aiTagged = true;
      } catch (e) {
        tagData = { tags: [], category: "other", summary: page.description || "", readingTime: "", tldr: "", contentType: "", language: "", keyFacts: [] };
      }
    }

    // Save with folder and project assignment if provided
    if (message.folderId) tagData.folderId = message.folderId;
    if (message.projectId) tagData.projectId = message.projectId;
    tagData.meta = pageMeta;

    const bookmark = await saveBookmark(page, tagData);

    // Save link to project if attached
    if (message.projectId) {
      try {
        await handleAddProjectItem({
          projectId: message.projectId,
          item: {
            type: "bookmark",
            url: page.url,
            title: page.title || page.url,
            summary: (tagData.summary || tagData.tldr || "").slice(0, 500),
            tags: ["bookmark", ...(tagData.tags || [])]
          }
        });
      } catch { /* non-critical */ }
    }

    // Page Tracker: log bookmark action
    trackPageAction(page.url, "bookmark", { title: page.title });

    // Fire tech stack detection in the background (non-blocking)
    if (tabId) {
      bookmarkDetectTechStack(tabId, bookmark.id).catch(e =>
        console.warn("[Bookmark] tech stack detection failed:", e.message)
      );
    }

    return { success: true, bookmark };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Non-blocking: detect tech stack and update bookmark
async function bookmarkDetectTechStack(tabId, bookmarkId) {
  try {
    const results = await browser.tabs.executeScript(tabId, {
      code: `(function() {
        const techs = [];
        const gen = document.querySelector('meta[name="generator"]');
        if (gen) techs.push({ source: 'meta', value: gen.getAttribute('content') || '' });
        const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
        techs.push({ source: 'scripts', value: scripts });
        const links = Array.from(document.querySelectorAll('link[href]')).map(l => l.href);
        techs.push({ source: 'links', value: links });
        // JS globals — quick check for common frameworks
        const globals = [];
        try { if (window.React || document.querySelector('[data-reactroot]')) globals.push('React'); } catch {}
        try { if (window.Vue || document.querySelector('[data-v-]')) globals.push('Vue'); } catch {}
        try { if (window.angular || document.querySelector('[ng-app]')) globals.push('Angular'); } catch {}
        try { if (window.jQuery || window.$?.fn?.jquery) globals.push('jQuery ' + (window.$?.fn?.jquery || '')); } catch {}
        try { if (window.__NEXT_DATA__) globals.push('Next.js'); } catch {}
        try { if (window.__NUXT__) globals.push('Nuxt.js'); } catch {}
        try { if (window.Shopify) globals.push('Shopify'); } catch {}
        try { if (document.querySelector('meta[name="generator"][content*="WordPress"]') || document.querySelector('link[href*="wp-content"]')) globals.push('WordPress'); } catch {}
        try { if (document.querySelector('link[href*="drupal"]')) globals.push('Drupal'); } catch {}
        techs.push({ source: 'globals', value: globals });
        return techs;
      })()`
    });
    if (!results?.[0]) return;

    const techs = results[0];
    const stack = {};
    // Parse meta generator
    const metaGen = techs.find(t => t.source === 'meta');
    if (metaGen?.value) stack.generator = metaGen.value;
    // Parse detected frameworks
    const globalsEntry = techs.find(t => t.source === 'globals');
    if (globalsEntry?.value?.length) stack.frameworks = globalsEntry.value;
    // Parse script sources for CDN/analytics patterns
    const scriptEntry = techs.find(t => t.source === 'scripts');
    if (scriptEntry?.value?.length) {
      const cdns = [];
      const analytics = [];
      for (const src of scriptEntry.value) {
        if (/google-analytics|googletagmanager|gtag/i.test(src)) analytics.push("Google Analytics");
        if (/cloudflare/i.test(src)) cdns.push("Cloudflare");
        if (/facebook.*pixel|fbevents/i.test(src)) analytics.push("Facebook Pixel");
        if (/hotjar/i.test(src)) analytics.push("Hotjar");
        if (/stripe\.js/i.test(src)) stack.payments = "Stripe";
      }
      if (cdns.length) stack.cdn = [...new Set(cdns)];
      if (analytics.length) stack.analytics = [...new Set(analytics)];
    }

    // Fetch server headers
    try {
      const resp = await fetch(techs.find(t => t.source === 'scripts')?.value?.[0] ? new URL(techs.find(t => t.source === 'scripts').value[0]).origin : "", { method: "HEAD", redirect: "follow" });
      const server = resp.headers.get("server");
      const powered = resp.headers.get("x-powered-by");
      if (server) stack.server = server;
      if (powered) stack.poweredBy = powered;
    } catch { /* header fetch failed */ }

    if (Object.keys(stack).length) {
      await ArgusDB.Bookmarks.update(bookmarkId, { techStack: stack });
    }
  } catch (e) {
    console.warn("[Bookmark] tech stack enrichment error:", e);
  }
}

async function handleGetBookmarks(message) {
  const smartBookmarks = await ArgusDB.Bookmarks.getAll();

  let results = smartBookmarks;

  // Filter by tag
  if (message.tag) {
    results = results.filter(b => b.tags.includes(message.tag));
  }

  // Filter by category
  if (message.category) {
    results = results.filter(b => b.category === message.category);
  }

  // Search
  if (message.query) {
    const q = message.query.toLowerCase();
    results = results.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      b.summary.toLowerCase().includes(q) ||
      b.tags.some(t => t.includes(q)) ||
      (b.notes || "").toLowerCase().includes(q) ||
      (b.text || "").toLowerCase().includes(q)
    );
  }

  // Pagination
  const page = message.page || 0;
  const perPage = message.perPage || 50;
  const start = page * perPage;

  // Get all unique tags and categories for sidebar
  const allTags = {};
  const allCategories = {};
  smartBookmarks.forEach(b => {
    (b.tags || []).forEach(t => { allTags[t] = (allTags[t] || 0) + 1; });
    if (b.category) allCategories[b.category] = (allCategories[b.category] || 0) + 1;
  });

  return {
    success: true,
    bookmarks: results.slice(start, start + perPage),
    total: results.length,
    tags: Object.entries(allTags).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })),
    categories: Object.entries(allCategories).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }))
  };
}

async function handleUpdateBookmark(message) {
  const updates = {};
  if (message.tags !== undefined) updates.tags = message.tags;
  if (message.notes !== undefined) updates.notes = message.notes;
  if (message.category !== undefined) updates.category = message.category;
  if (message.folderId !== undefined) updates.folderId = message.folderId;
  updates.updatedAt = new Date().toISOString();

  const bookmark = await ArgusDB.Bookmarks.update(message.id, updates);
  if (!bookmark) return { success: false, error: "Bookmark not found." };
  return { success: true, bookmark };
}

async function handleDeleteBookmark(message) {
  await ArgusDB.Bookmarks.remove(message.id);
  return { success: true };
}

async function handleExportBookmarks() {
  const smartBookmarks = await ArgusDB.Bookmarks.getAll();
  // Strip stored text to reduce export size
  const exportData = smartBookmarks.map(b => {
    const { text, ...rest } = b;
    return rest;
  });
  return { success: true, data: exportData };
}

// ──────────────────────────────────────────────
// Bookmark Folder → Project Assignment
// ──────────────────────────────────────────────
async function handleAssignFolderToProject(message) {
  const { folderId, projectId } = message;
  if (!folderId) return { success: false, error: "No folder specified" };

  // Update folder's projectId
  const folder = await ArgusDB.BookmarkFolders.get(folderId);
  if (!folder) return { success: false, error: "Folder not found" };
  folder.projectId = projectId || "";
  await ArgusDB.BookmarkFolders.save(folder);

  if (!projectId) return { success: true }; // unassigned

  // Add all bookmarks in this folder (and sub-folders) as project items
  const project = await ArgusDB.Projects.get(projectId);
  if (!project) return { success: false, error: "Project not found" };

  const allFolders = await ArgusDB.BookmarkFolders.getAll();
  // Collect folder and all descendants
  const folderIds = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of allFolders) {
      if (folderIds.has(f.parentId) && !folderIds.has(f.id)) {
        folderIds.add(f.id);
        changed = true;
      }
    }
  }

  const allBookmarks = await ArgusDB.Bookmarks.getAll();
  const folderBookmarks = allBookmarks.filter(b => folderIds.has(b.folderId));

  if (!project.items) project.items = [];
  const existingUrls = new Set(project.items.map(i => i.url));

  for (const bm of folderBookmarks) {
    if (existingUrls.has(bm.url)) continue;
    project.items.push({
      url: bm.url,
      title: bm.title,
      type: "bookmark",
      addedAt: Date.now(),
      summary: bm.tldr || bm.summary || "",
      notes: bm.notes || "",
      refId: bm.id,
    });
  }

  project.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(project);
  return { success: true, addedCount: folderBookmarks.filter(b => !existingUrls.has(b.url)).length };
}

// ──────────────────────────────────────────────
// Analyze Bookmarks (research synthesis)
// ──────────────────────────────────────────────
async function handleAnalyzeBookmarks(message) {
  try {
    const bookmarks = message.bookmarks || [];
    if (bookmarks.length === 0) return { success: false, error: "No bookmarks selected." };

    const settings = await getProviderSettings();
    const resultId = `tl-result-${Date.now()}`;
    const presetLabel = `Bookmark Research: ${bookmarks.length} sources`;

    await browser.storage.local.set({
      [resultId]: {
        status: "loading",
        presetLabel,
        pageTitle: presetLabel,
        pageUrl: ""
      }
    });

    const resultsUrl = browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`);
    await openArgusPage(resultsUrl);

    // Build combined text from bookmarks
    const maxPerSource = Math.floor(settings.maxInputChars / bookmarks.length);
    const combined = bookmarks.map((bm, i) =>
      `\n\n--- Source ${i + 1}: ${bm.title} (${bm.url}) ---\n\n${truncateText(bm.text || bm.summary || "(no content)", maxPerSource)}`
    ).join("");

    const sources = bookmarks.map((bm, i) => ({ index: i + 1, title: bm.title, url: bm.url }));

    const page = {
      title: presetLabel,
      url: bookmarks[0]?.url || "",
      description: "",
      text: combined,
      _sources: sources,
      _isResearch: true
    };

    // Use research preset for multi-source synthesis
    streamAnalysisToStorage(resultId, page, { analysisType: "research" }, settings, presetLabel);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Page Monitor / Diff Alerts
// ──────────────────────────────────────────────
const MONITOR_ALARM_PREFIX = "tl-monitor-";

// Track notification → monitor mapping for click handling
const notificationMonitorMap = new Map();

// Notification click handler — opens the monitored page (requires optional notifications permission)
hasPermission("notifications").then(has => { if (has) browser.notifications.onClicked.addListener(async (notificationId) => {
  const monitorId = notificationMonitorMap.get(notificationId);
  if (!monitorId) return;

  notificationMonitorMap.delete(notificationId);

  const monitor = await ArgusDB.Monitors.get(monitorId);
  if (!monitor) return;

  // Auto-open: open the page directly
  browser.tabs.create({ url: monitor.url });

  // Clear unread count for this monitor
  await clearMonitorUnread(monitorId);
}); });

// Badge management for unread monitor changes
async function incrementMonitorBadge(monitorId) {
  const { monitorUnreads } = await browser.storage.local.get({ monitorUnreads: {} });
  monitorUnreads[monitorId] = (monitorUnreads[monitorId] || 0) + 1;
  await browser.storage.local.set({ monitorUnreads });
  await updateBadge();
}

async function clearMonitorUnread(monitorId) {
  const { monitorUnreads } = await browser.storage.local.get({ monitorUnreads: {} });
  if (monitorUnreads[monitorId]) {
    delete monitorUnreads[monitorId];
    await browser.storage.local.set({ monitorUnreads });
    await updateBadge();
  }
}

async function updateBadge() {
  const { monitorUnreads, showBadge } = await browser.storage.local.get({ monitorUnreads: {}, showBadge: true });
  if (showBadge === false) {
    browser.browserAction.setBadgeText({ text: "" });
    return;
  }
  const total = Object.values(monitorUnreads).reduce((sum, n) => sum + n, 0);
  if (total > 0) {
    browser.browserAction.setBadgeText({ text: String(total) });
    browser.browserAction.setBadgeBackgroundColor({ color: "#e94560" });
  } else {
    browser.browserAction.setBadgeText({ text: "" });
  }
}

async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getArchiveUrl(url) {
  // Check if this URL's domain is on the archive redirect list
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (archiveRedirectDomains.some(d => host === d || host.endsWith("." + d))) {
      return (archiveProviderUrl || "https://archive.is/") + url;
    }
  } catch { /* invalid URL */ }
  return null;
}

async function fetchPageText(url) {
  // PDF detection: fetch and extract text via pdf.js
  if (isPdfUrl(url) && typeof pdfjsLib !== "undefined") {
    const pdfResult = await extractPdfContent(url);
    return pdfResult.text;
  }

  // Auto-route through archive provider if domain is on the redirect list
  const archiveUrl = getArchiveUrl(url);
  let fetchUrl = url;
  let isArchive = false;

  if (archiveUrl) {
    try {
      const archiveResp = await fetch(archiveUrl);
      if (archiveResp.ok) {
        fetchUrl = archiveUrl;
        isArchive = true;
        const html = await archiveResp.text();
        const text = extractTextFromHtml(html);
        if (text.length >= 200) return text;
        // If archive returned little content, fall through to direct fetch
      }
    } catch { /* archive fetch failed, fall through to direct */ }
  }

  const response = await fetch(fetchUrl === archiveUrl ? url : fetchUrl);
  const html = await response.text();
  let text = extractTextFromHtml(html);

  // If content is too thin, check for JS/meta redirects and follow them
  if (text.length < 50) {
    const redirectUrl = extractRedirectUrl(html, url);
    if (redirectUrl && redirectUrl !== url) {
      console.log(`[Fetch] Thin content (${text.length} chars), following redirect → ${redirectUrl}`);
      try {
        const redirResp = await fetch(redirectUrl);
        if (redirResp.ok) {
          const redirHtml = await redirResp.text();
          const redirText = extractTextFromHtml(redirHtml);
          if (redirText.length > text.length) text = redirText;
        }
      } catch { /* redirect fetch failed */ }
    }
  }

  return text;
}

// Extract redirect URL from JS redirects, meta refresh, or canonical links
function extractRedirectUrl(html, baseUrl) {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    // Meta refresh: <meta http-equiv="refresh" content="0;url=...">
    const metaRefresh = doc.querySelector('meta[http-equiv="refresh"]');
    if (metaRefresh) {
      const match = metaRefresh.content.match(/url\s*=\s*['"]?([^'";\s]+)/i);
      if (match) return new URL(match[1], baseUrl).href;
    }
    // Canonical link (sometimes points to the real page)
    const canonical = doc.querySelector('link[rel="canonical"]');
    if (canonical?.href && canonical.href !== baseUrl) {
      return new URL(canonical.getAttribute("href"), baseUrl).href;
    }
    // JS redirects: window.location = "...", window.location.href = "...", location.replace("...")
    const scripts = doc.querySelectorAll("script");
    for (const s of scripts) {
      const text = s.textContent || "";
      const jsMatch = text.match(/(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/) ||
                       text.match(/location\.replace\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (jsMatch) return new URL(jsMatch[1], baseUrl).href;
    }
  } catch { /* parsing failed */ }
  return null;
}

function extractTextFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Remove scripts, styles, nav, footer
  doc.querySelectorAll("script, style, nav, footer, header, aside").forEach(el => el.remove());
  // Try multiple selectors, pick longest
  const candidates = [
    "article", "main", '[role="main"]', '[itemprop="articleBody"]',
    ".article-body", ".article-content", ".article__body", ".article__content",
    ".post-content", ".post-body", ".entry-content",
    ".story-body", ".story-content", "#article-body", "#article-content",
    ".content-body", ".page-content"
  ];
  let bestText = "";
  for (const sel of candidates) {
    const el = doc.querySelector(sel);
    if (el) {
      const t = el.textContent.replace(/\s+/g, " ").trim();
      if (t.length > bestText.length) bestText = t;
    }
  }
  if (bestText.length < 200) {
    bestText = doc.body ? doc.body.textContent.replace(/\s+/g, " ").trim() : "";
  }
  return bestText;
}

// Manual page snapshot — captures screenshot + full HTML via OPFS
async function handleSnapshotPage(message) {
  try {
    const { tabId, url, title } = message;

    // Capture screenshot of visible tab
    let screenshotBlob = null;
    try {
      const dataUrl = await browser.tabs.captureVisibleTab(null, { format: "png" });
      const resp = await fetch(dataUrl);
      screenshotBlob = await resp.blob();
    } catch (e) {
      console.warn("[Snapshot] Screenshot capture failed:", e.message);
    }

    // Fetch page HTML
    let html = null;
    try {
      const resp = await fetch(url);
      html = await resp.text();
    } catch (e) {
      console.warn("[Snapshot] HTML fetch failed:", e.message);
    }

    // Extract text for metadata
    const text = html ? extractTextFromHtml(html) : "";
    const hash = await hashText(text);

    // Create snapshot metadata in IndexedDB
    const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const snapshot = {
      id: snapshotId,
      monitorId: "manual",
      capturedAt: new Date().toISOString(),
      hash,
      text: text.slice(0, 5000),
      changed: false,
      isInitial: false,
      url: url,
      title: title || url,
      hasScreenshot: !!screenshotBlob,
      hasFullHtml: !!html,
      manual: true
    };
    await ArgusDB.Snapshots.add(snapshot);

    // Write binary files to OPFS
    if (typeof OpfsStorage !== "undefined" && (html || screenshotBlob)) {
      await OpfsStorage.writeSnapshot(snapshotId, { html, screenshotBlob });
    }

    // Page Tracker: log snapshot action
    trackPageAction(url, "snapshot", { title });

    return { success: true, snapshotId };
  } catch (err) {
    console.error("[Snapshot] Failed:", err);
    return { success: false, error: err.message };
  }
}

// Snapshot a monitored page and run analysis on the snapshot text
async function handleSnapshotAndAnalyze(message) {
  const { monitorId, url, title } = message;
  try {
    // Fetch current page content
    const text = await fetchPageText(url);
    const hash = await hashText(text);

    // Save snapshot
    const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const snapshot = {
      id: snapshotId,
      monitorId: monitorId || "manual",
      capturedAt: new Date().toISOString(),
      hash,
      text: text.slice(0, 5000),
      changed: false,
      isInitial: false,
      url,
      title: title || url,
      hasScreenshot: false,
      hasFullHtml: true,
      manual: true,
    };
    await ArgusDB.Snapshots.add(snapshot);

    // Store full HTML in OPFS
    if (typeof OpfsStorage !== "undefined") {
      await OpfsStorage.writeSnapshot(snapshotId, { html: text, screenshotBlob: null });
    }

    // Run analysis on the snapshot text
    const settings = await getProviderSettings();
    const page = { url, title: title || url, text: text.slice(0, 30000) };
    const presetKey = "summary";
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, presetKey, null, settings);
    const messages = buildMessages(systemPrompt, userPrompt);
    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      { maxTokens: settings.maxTokens, temperature: settings.temperature }
    );

    // Save analysis to history
    await saveToHistory({
      pageTitle: title || url,
      pageUrl: url,
      provider: settings.provider,
      model: result.model,
      preset: presetKey,
      presetLabel: "Summary",
      content: result.content,
      usage: result.usage,
      autoAnalyzed: false,
      snapshotId,
    });

    console.log(`[Snapshot] Captured and analyzed: ${url} (snapshot: ${snapshotId})`);
    return { success: true, snapshotId, analysisPreview: result.content.slice(0, 200) };
  } catch (err) {
    console.error("[Snapshot+Analyze] Failed:", err);
    return { success: false, error: err.message };
  }
}

async function handleAddMonitor(message) {
  try {
    const pageMonitors = await ArgusDB.Monitors.getAll();

    // Check for duplicate
    if (pageMonitors.some(m => m.url === message.url)) {
      return { success: false, error: "This URL is already being monitored." };
    }

    // Get initial content hash
    const text = await fetchPageText(message.url);
    const hash = await hashText(text);

    const monitor = {
      id: `mon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: message.url,
      title: message.title || message.url,
      intervalMinutes: message.intervalMinutes || 60,
      enabled: message.enabled !== false,
      createdAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      lastHash: hash,
      lastText: text.slice(0, 10000),
      changeCount: 0,
      aiAnalysis: message.aiAnalysis !== false,
      autoOpen: message.autoOpen || false,
      autoBookmark: message.autoBookmark !== false,
      analysisPreset: message.analysisPreset || "",
      automationId: message.automationId || "",
      projectId: message.projectId || "",
      duration: message.duration || 0,
      expiresAt: message.duration ? new Date(Date.now() + message.duration * 3600000).toISOString() : null
    };

    await ArgusDB.Monitors.save(monitor);

    // Save initial snapshot for the timeline
    const initialSnapshot = {
      id: `snap-${Date.now()}`,
      monitorId: monitor.id,
      capturedAt: new Date().toISOString(),
      hash,
      text: text.slice(0, 5000),
      isInitial: true
    };
    await ArgusDB.Snapshots.add(initialSnapshot);

    // Auto-bookmark if enabled
    if (monitor.autoBookmark) {
      try {
        const pageData = { url: message.url, title: message.title || message.url, text: text.slice(0, 50000) };
        await saveBookmark(pageData, { tags: ["monitored"], category: "monitored", summary: `Auto-bookmarked — monitored every ${monitor.intervalMinutes}min` });
      } catch { /* bookmark failed, non-critical */ }
    }

    // Save initial link to project if attached
    if (monitor.projectId) {
      try {
        await handleAddProjectItem({
          projectId: monitor.projectId,
          item: {
            type: "monitor-link",
            url: monitor.url,
            title: monitor.title,
            summary: `Monitoring every ${monitor.intervalMinutes}min`,
            tags: ["monitor"]
          }
        });
      } catch { /* non-critical */ }
    }

    // Set alarm — first fire after the full interval, then repeat
    browser.alarms.create(`${MONITOR_ALARM_PREFIX}${monitor.id}`, {
      delayInMinutes: monitor.intervalMinutes,
      periodInMinutes: monitor.intervalMinutes
    });

    notifyDataChanged("monitors");
    // Page Tracker: log monitor action
    trackPageAction(message.url, "monitor", { title: message.title });
    return { success: true, monitor };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleGetMonitors() {
  const pageMonitors = await ArgusDB.Monitors.getAll();
  return { success: true, monitors: pageMonitors };
}

async function handleUpdateMonitor(message) {
  const monitor = await ArgusDB.Monitors.get(message.id);
  if (!monitor) return { success: false, error: "Monitor not found." };

  if (message.intervalMinutes !== undefined) monitor.intervalMinutes = message.intervalMinutes;
  if (message.enabled !== undefined) monitor.enabled = message.enabled;
  if (message.aiAnalysis !== undefined) monitor.aiAnalysis = message.aiAnalysis;
  if (message.autoOpen !== undefined) monitor.autoOpen = message.autoOpen;
  if (message.autoBookmark !== undefined) monitor.autoBookmark = message.autoBookmark;
  if (message.analysisPreset !== undefined) monitor.analysisPreset = message.analysisPreset;
  if (message.duration !== undefined) {
    monitor.duration = message.duration;
    monitor.expiresAt = message.duration ? new Date(Date.now() + message.duration * 3600000).toISOString() : null;
    monitor.expired = false;
  }

  await ArgusDB.Monitors.save(monitor);

  // Update alarm
  const alarmName = `${MONITOR_ALARM_PREFIX}${monitor.id}`;
  await browser.alarms.clear(alarmName);
  if (monitor.enabled) {
    browser.alarms.create(alarmName, {
      delayInMinutes: monitor.intervalMinutes,
      periodInMinutes: monitor.intervalMinutes
    });
  }

  // Sync linked bookmark summary with current monitor settings
  if (monitor.autoBookmark) {
    const bm = await ArgusDB.Bookmarks.getByUrl(monitor.url);
    if (bm) {
      const interval = monitor.intervalMinutes >= 60 ? `${monitor.intervalMinutes / 60}h` : `${monitor.intervalMinutes}min`;
      const presetStr = monitor.analysisPreset ? ` | preset: ${monitor.analysisPreset}` : "";
      bm.summary = monitor.lastChangeSummary
        ? `${monitor.lastChangeSummary.slice(0, 400)} — monitored every ${interval}${presetStr}`
        : `Auto-bookmarked — monitored every ${interval}${presetStr}`;
      bm.updatedAt = new Date().toISOString();
      await ArgusDB.Bookmarks.add(bm);
    }
  }

  return { success: true, monitor };
}

async function handleDeleteMonitor(message) {
  const monitor = await ArgusDB.Monitors.get(message.id);
  if (monitor) {
    await browser.alarms.clear(`${MONITOR_ALARM_PREFIX}${monitor.id}`);
    await clearMonitorUnread(monitor.id);
  }
  // ArgusDB.Monitors.remove also cleans up snapshots and changes
  await ArgusDB.Monitors.remove(message.id);
  notifyDataChanged("monitors");
  return { success: true };
}

async function handleGetMonitorHistory(message) {
  const changes = await ArgusDB.Changes.getByMonitor(message.monitorId);
  return { success: true, history: changes };
}

async function handleGetAllMonitorChanges() {
  const [changes, monitors] = await Promise.all([
    ArgusDB.Changes.getAll(),
    ArgusDB.Monitors.getAll()
  ]);
  const monitorMap = {};
  for (const m of monitors) monitorMap[m.id] = { title: m.title || m.url, url: m.url };
  // Attach monitor info to each change
  for (const c of changes) {
    const m = monitorMap[c.monitorId];
    if (m) { c.monitorTitle = m.title; c.monitorUrl = m.url; }
    else { c.monitorTitle = "Deleted monitor"; c.monitorUrl = ""; }
  }
  return { success: true, changes: changes.slice(0, 500) };
}

async function handleGetMonitorSnapshots(message) {
  const snapshots = await ArgusDB.Snapshots.getByMonitor(message.monitorId);
  return { success: true, snapshots };
}



async function handleGetMonitorStorageUsage() {
  const pageMonitors = await ArgusDB.Monitors.getAll();
  let totalBytes = JSON.stringify(pageMonitors).length;
  const perMonitor = [];

  for (const monitor of pageMonitors) {
    let monitorBytes = JSON.stringify(monitor).length;
    const snapshots = await ArgusDB.Snapshots.getByMonitor(monitor.id);
    const changes = await ArgusDB.Changes.getByMonitor(monitor.id);
    const snapBytes = JSON.stringify(snapshots).length;
    const histBytes = JSON.stringify(changes).length;
    monitorBytes += snapBytes + histBytes;
    totalBytes += snapBytes + histBytes;
    perMonitor.push({
      id: monitor.id,
      title: monitor.title || monitor.url,
      bytes: monitorBytes,
      snapshots: snapshots.length,
      historyEntries: changes.length
    });
  }

  // Include OPFS usage if available
  let opfsBytes = 0;
  if (typeof OpfsStorage !== "undefined") {
    try { opfsBytes = await OpfsStorage.getUsage(); } catch { /* */ }
  }
  totalBytes += opfsBytes;

  return { success: true, totalBytes, opfsBytes, perMonitor };
}

// OPFS snapshot retrieval handlers
async function handleGetSnapshotScreenshot(message) {
  if (typeof OpfsStorage === "undefined") return { success: false, error: "OPFS not available" };
  const url = await OpfsStorage.readScreenshot(message.snapshotId);
  return url ? { success: true, url } : { success: false, error: "Screenshot not found" };
}

async function handleGetSnapshotHtml(message) {
  if (typeof OpfsStorage === "undefined") return { success: false, error: "OPFS not available" };
  const html = await OpfsStorage.readHtml(message.snapshotId);
  return html ? { success: true, html } : { success: false, error: "HTML not found" };
}

// Alarm handler for periodic page checks
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(MONITOR_ALARM_PREFIX)) return;

  const monitorId = alarm.name.slice(MONITOR_ALARM_PREFIX.length);
  const monitor = await ArgusDB.Monitors.get(monitorId);
  if (!monitor) return;
  if (!monitor.enabled) return;

  // Check if monitor has expired
  if (monitor.expiresAt && new Date(monitor.expiresAt).getTime() <= Date.now()) {
    monitor.enabled = false;
    monitor.expired = true;
    await ArgusDB.Monitors.save(monitor);
    await browser.alarms.clear(alarm.name);
    console.log(`[Monitor] ${monitor.title} expired — auto-stopped`);
    return;
  }

  try {
    const newText = await fetchPageText(monitor.url);
    const newHash = await hashText(newText);
    const now = new Date().toISOString();

    monitor.lastChecked = now;

    // Always save a snapshot for the timeline (even if no change)
    const changed = newHash !== monitor.lastHash;
    const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const snapshot = {
      id: snapshotId,
      monitorId: monitor.id,
      capturedAt: now,
      hash: newHash,
      text: newText.slice(0, 5000),
      changed,
      hasScreenshot: false,
      hasFullHtml: false
    };

    // On change: archive full HTML to OPFS
    if (changed && typeof OpfsStorage !== "undefined") {
      try {
        const resp = await fetch(monitor.url);
        const fullHtml = await resp.text();
        await OpfsStorage.writeSnapshot(snapshotId, { html: fullHtml, screenshotBlob: null });
        snapshot.hasFullHtml = true;
        console.log(`[Monitor] Archived HTML for ${monitor.title} → OPFS (${snapshotId})`);
      } catch (e) { console.warn("[Monitor] OPFS archive failed:", e.message); }
    }

    await ArgusDB.Snapshots.add(snapshot);
    // Keep last 100 snapshots per monitor
    await ArgusDB.Snapshots.pruneForMonitor(monitor.id, 100);

    if (changed) {
      monitor.changeCount++;
      const oldText = monitor.lastText;
      monitor.lastHash = newHash;
      monitor.lastText = newText.slice(0, 10000);

      const changeEntry = {
        id: `chg-${Date.now()}`,
        monitorId: monitor.id,
        detectedAt: now,
        oldHash: monitor.lastHash,
        newHash,
        oldTextSnippet: oldText.slice(0, 5000),
        newTextSnippet: newText.slice(0, 5000),
        aiSummary: null
      };

      // AI diff analysis
      if (monitor.aiAnalysis) {
        try {
          const settings = await getProviderSettings();
          const diffPrompt = `Compare these two versions of a webpage and summarize what changed. Be concise.

OLD VERSION (snippet):
${oldText.slice(0, 3000)}

NEW VERSION (snippet):
${newText.slice(0, 3000)}

Summarize the key differences in 2-4 bullet points.`;

          const langInst = await getLanguageInstruction();
          const cdDefaults = { system: "You are a change detection analyst. Summarize webpage differences concisely.", prompt: "" };
          const cdCustom = await getAdvancedPrompt("changeDetection", cdDefaults);
          const messages = buildMessages(
            `${cdCustom.system}${langInst}`,
            diffPrompt
          );

          const result = await callProvider(
            settings.provider, settings.apiKey, settings.model, messages,
            { maxTokens: 500, temperature: 0.3 }
          );
          changeEntry.aiSummary = result.content;
        } catch {
          // AI analysis failed, continue without it
        }
      }

      await ArgusDB.Changes.add(changeEntry);

      // Extract entities for knowledge graph (non-blocking)
      try {
        const kgText = (changeEntry.aiSummary || "") + "\n" + (changeEntry.newSnippet || "");
        if (kgText.trim()) KnowledgeGraph.extractAndUpsert(kgText, monitor.url, monitor.title, null);
      } catch (e) { console.warn("[KG] monitor change extraction failed:", e); }

      // Store last change summary on the monitor for quick display
      monitor.lastChangeSummary = changeEntry.aiSummary || `Content changed (${new Date(now).toLocaleString()})`;
      monitor.lastChangeAt = now;

      // Increment badge count
      await incrementMonitorBadge(monitor.id);

      // Send clickable notification
      const notifBody = changeEntry.aiSummary
        ? changeEntry.aiSummary.slice(0, 200)
        : "The page content has changed since the last check. Click to view.";

      const notifId = `monitor-change-${monitor.id}-${Date.now()}`;
      notificationMonitorMap.set(notifId, monitor.id);
      safeNotify(notifId, {
        type: "basic",
        iconUrl: "icons/icon-96.png",
        title: `Page Changed: ${monitor.title}`,
        message: notifBody,
        requireInteraction: true
      });

      // Auto-open the page in a new tab if enabled
      if (monitor.autoOpen) {
        browser.tabs.create({ url: monitor.url, active: false });
      }

      // Update linked bookmark if auto-bookmark is enabled
      if (monitor.autoBookmark) {
        try {
          const pageData = { url: monitor.url, title: monitor.title, text: newText.slice(0, 50000) };
          await saveBookmark(pageData, {
            tags: ["monitored", "updated"],
            category: "monitored",
            summary: changeEntry.aiSummary || `Content changed — ${monitor.changeCount} total changes detected`
          });
        } catch { /* non-critical */ }
      }

      // Scan for watchlist keywords
      try {
        if (typeof scanForWatchwords === "function") {
          await scanForWatchwords(newText, "monitor", monitor.url, monitor.title);
        }
      } catch { /* non-critical */ }

      // Auto-analyze with preset if configured
      if (monitor.analysisPreset) {
        try {
          const settings = await getProviderSettings(null, monitor.analysisPreset);
          const page = { url: monitor.url, title: monitor.title, text: newText.slice(0, settings.maxInputChars || 100000) };
          const opts = { maxTokens: settings.maxTokens, temperature: settings.temperature, reasoningEffort: settings.reasoningEffort, extendedThinking: settings.extendedThinking };
          const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, monitor.analysisPreset, null, settings);
          const msgs = buildMessages(systemPrompt, userPrompt);
          const result = await callProvider(settings.provider, settings.apiKey, settings.model, msgs, opts);

          // Store the analysis result
          const resultId = `monitor-analysis-${monitor.id}-${Date.now()}`;
          await browser.storage.local.set({
            [resultId]: {
              content: result.content,
              preset: monitor.analysisPreset,
              url: monitor.url,
              title: monitor.title,
              timestamp: now,
              provider: settings.provider
            }
          });

          // Open the result in a tab
          const presetLabel = ANALYSIS_PRESETS[monitor.analysisPreset]?.label || settings.customPresets[monitor.analysisPreset]?.label || monitor.analysisPreset;
          await browser.storage.local.set({
            pendingResult: {
              content: result.content,
              title: `${presetLabel}: ${monitor.title}`,
              url: monitor.url,
              provider: settings.provider,
              preset: monitor.analysisPreset,
              timestamp: now
            }
          });
          browser.tabs.create({ url: browser.runtime.getURL("results/results.html"), active: false });
        } catch (err) {
          console.warn(`[Monitor] Auto-analysis failed for "${monitor.title}":`, err.message);
        }
      }

      // Run automation if configured
      if (monitor.automationId) {
        try {
          const autoResult = await AutomationEngine.run(monitor.automationId, {
            url: monitor.url,
            title: monitor.title,
            text: newText.slice(0, 50000),
            trigger: "monitor-change",
            monitorId: monitor.id,
          });
          if (autoResult.success) {
            console.log(`[Monitor] Automation "${autoResult.automationName}" ran for "${monitor.title}"`);
          }
        } catch (err) {
          console.warn(`[Monitor] Automation failed for "${monitor.title}":`, err.message);
        }
      }

      // Route change to linked project
      if (monitor.projectId) {
        try {
          await handleAddProjectItem({
            projectId: monitor.projectId,
            item: {
              type: "monitor-change",
              url: monitor.url,
              title: monitor.title,
              summary: (changeEntry.aiSummary || `Content changed (${new Date(now).toLocaleString()})`).slice(0, 500),
              analysisContent: changeEntry.aiSummary || "",
              tags: ["monitor", "change-detected"]
            }
          });
          console.log(`[Monitor] Routed change to project for "${monitor.title}"`);
        } catch (err) {
          console.warn(`[Monitor] Project routing failed for "${monitor.title}":`, err.message);
        }
      }
    } else {
      console.log(`[Monitor] ${monitor.title}: no changes detected`);
    }

    await ArgusDB.Monitors.save(monitor);
  } catch (err) {
    console.warn(`[Monitor] Check failed for "${monitor.title}" (${monitor.url}):`, err.message);

    monitor.lastChecked = new Date().toISOString();
    await ArgusDB.Monitors.save(monitor);
  }
});

// Restore alarms on startup and catch up on any overdue monitors
(async () => {
  const pageMonitors = await ArgusDB.Monitors.getAll();
  const now = Date.now();
  let updated = false;

  for (const monitor of pageMonitors) {
    if (!monitor.enabled) continue;

    // Check if monitor has expired
    if (monitor.expiresAt && new Date(monitor.expiresAt).getTime() <= now) {
      monitor.enabled = false;
      monitor.expired = true;
      updated = true;
      console.log(`[Monitor] ${monitor.title} expired on startup — auto-stopped`);
      continue;
    }

    const alarmName = `${MONITOR_ALARM_PREFIX}${monitor.id}`;

    // Always ensure the periodic alarm exists
    const existing = await browser.alarms.get(alarmName);
    if (!existing) {
      browser.alarms.create(alarmName, {
        delayInMinutes: monitor.intervalMinutes,
        periodInMinutes: monitor.intervalMinutes
      });
    }

    // Check if this monitor is overdue and needs an immediate catch-up check
    const lastCheckedTime = monitor.lastChecked ? new Date(monitor.lastChecked).getTime() : 0;
    const intervalMs = monitor.intervalMinutes * 60 * 1000;
    const overdueBy = now - lastCheckedTime - intervalMs;

    if (overdueBy > 0) {
      console.log(`[Monitor] ${monitor.title} is overdue by ${Math.round(overdueBy / 60000)}min — running catch-up check`);
      try {
        const newText = await fetchPageText(monitor.url);
        const newHash = await hashText(newText);
        const catchupNow = new Date().toISOString();

        monitor.lastChecked = catchupNow;

        // Save snapshot for timeline
        await ArgusDB.Snapshots.add({
          id: `snap-${Date.now()}`,
          monitorId: monitor.id,
          capturedAt: catchupNow,
          hash: newHash,
          text: newText.slice(0, 5000),
          changed: newHash !== monitor.lastHash
        });
        await ArgusDB.Snapshots.pruneForMonitor(monitor.id, 100);

        if (newHash !== monitor.lastHash) {
          monitor.changeCount++;
          const oldText = monitor.lastText;
          monitor.lastHash = newHash;
          monitor.lastText = newText.slice(0, 10000);

          const changeEntry = {
            id: `chg-${Date.now()}`,
            monitorId: monitor.id,
            detectedAt: catchupNow,
            oldHash: monitor.lastHash,
            newHash,
            oldTextSnippet: oldText.slice(0, 5000),
            newTextSnippet: newText.slice(0, 5000),
            aiSummary: null
          };

          if (monitor.aiAnalysis) {
            try {
              const settings = await getProviderSettings();
              const diffPrompt = `Compare these two versions of a webpage and summarize what changed. Be concise.

OLD VERSION (snippet):
${oldText.slice(0, 3000)}

NEW VERSION (snippet):
${newText.slice(0, 3000)}

Summarize the key differences in 2-4 bullet points.`;

              const langInst2 = await getLanguageInstruction();
              const cdDefaults2 = { system: "You are a change detection analyst. Summarize webpage differences concisely.", prompt: "" };
              const cdCustom2 = await getAdvancedPrompt("changeDetection", cdDefaults2);
              const messages = buildMessages(
                `${cdCustom2.system}${langInst2}`,
                diffPrompt
              );

              const result = await callProvider(
                settings.provider, settings.apiKey, settings.model, messages,
                { maxTokens: 500, temperature: 0.3 }
              );
              changeEntry.aiSummary = result.content;
            } catch {
              // AI analysis failed, continue without it
            }
          }

          await ArgusDB.Changes.add(changeEntry);

          // Extract entities for knowledge graph (non-blocking)
          try {
            const kgText = (changeEntry.aiSummary || "") + "\n" + (changeEntry.newSnippet || "");
            if (kgText.trim()) KnowledgeGraph.extractAndUpsert(kgText, monitor.url, monitor.title, null);
          } catch (e) { console.warn("[KG] monitor catchup extraction failed:", e); }

          monitor.lastChangeSummary = changeEntry.aiSummary || `Content changed (${new Date(catchupNow).toLocaleString()})`;
          monitor.lastChangeAt = catchupNow;

          await incrementMonitorBadge(monitor.id);

          const notifId = `monitor-catchup-${monitor.id}-${Date.now()}`;
          notificationMonitorMap.set(notifId, monitor.id);
          safeNotify(notifId, {
            type: "basic",
            iconUrl: "icons/icon-96.png",
            title: `Page Changed: ${monitor.title}`,
            message: changeEntry.aiSummary
              ? changeEntry.aiSummary.slice(0, 200)
              : "The page content changed while you were away. Click to view.",
            requireInteraction: true
          });

          if (monitor.autoOpen) {
            browser.tabs.create({ url: monitor.url, active: false });
          }
        } else {
          console.log(`[Monitor] ${monitor.title} catch-up check: no changes detected`);
        }

        updated = true;
      } catch (err) {
        console.warn(`[Monitor] Catch-up check failed for ${monitor.title}:`, err.message);
      }
    }
  }

  if (updated) {
    await ArgusDB.Monitors.saveAll(pageMonitors);
  }

  // Restore badge count on startup
  await updateBadge();
})();

// ══════════════════════════════════════════════════════════════
// Archive Redirect — bypass paywalls/annoying sites via archive.is
// ══════════════════════════════════════════════════════════════

const DEFAULT_ARCHIVE_DOMAINS = [
  "cnn.com", "nytimes.com", "washingtonpost.com", "wsj.com",
  "bloomberg.com", "reuters.com", "bbc.com", "theguardian.com",
  "forbes.com", "businessinsider.com", "wired.com", "townhall.com",
  "theatlantic.com", "newyorker.com", "theepochtimes.com",
  "latimes.com", "usatoday.com", "politico.com", "thedailybeast.com",
  "vanityfair.com", "ft.com", "economist.com", "newsweek.com", "time.com"
];

let archiveRedirectEnabled = false;
let archiveRedirectDomains = [];
let archiveProviderUrl = "https://archive.is/";

async function loadArchiveSettings() {
  const { archiveRedirect } = await browser.storage.local.get({
    archiveRedirect: { enabled: false, domains: DEFAULT_ARCHIVE_DOMAINS, providerUrl: "https://archive.is/" }
  });
  archiveRedirectEnabled = archiveRedirect.enabled;
  archiveRedirectDomains = archiveRedirect.domains || [];
  archiveProviderUrl = archiveRedirect.providerUrl || "https://archive.is/";
}

loadArchiveSettings();

// Reload settings when they change
browser.storage.onChanged.addListener((changes) => {
  if (changes.archiveRedirect) {
    const val = changes.archiveRedirect.newValue;
    archiveRedirectEnabled = val.enabled;
    archiveRedirectDomains = val.domains || [];
    archiveProviderUrl = val.providerUrl || "https://archive.is/";
    if (val.enabled) registerArchiveRedirect();
  }
});

// Intercept requests before they load (requires optional webRequest permission)
let archiveWebRequestRegistered = false;

function archiveRedirectHandler(details) {
  if (!archiveRedirectEnabled) return;
  if (details.type !== "main_frame") return;

  try {
    const url = new URL(details.url);
    const host = url.hostname.replace(/^www\./, "");

    // Don't redirect archive/cache sites themselves
    if (host.includes("archive.is") || host.includes("archive.ph") || host.includes("archive.today") || host.includes("webcache.googleusercontent.com")) return;

    const matched = archiveRedirectDomains.some(
      d => host === d || host.endsWith("." + d)
    );

    if (matched) {
      return { redirectUrl: archiveProviderUrl + details.url };
    }
  } catch { /* invalid URL, skip */ }
}

async function registerArchiveRedirect() {
  if (archiveWebRequestRegistered) return;
  const registered = await initWebRequestBlocking(
    archiveRedirectHandler,
    { urls: ["<all_urls>"] },
    ["blocking"]
  );
  if (registered) archiveWebRequestRegistered = true;
}

registerArchiveRedirect();

// ══════════════════════════════════════════════════════════════
// Archive Availability Checker
// ══════════════════════════════════════════════════════════════

// Cache of archive check results: tabId -> { url, archiveUrl, timestamp }
const archiveCheckCache = new Map();

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:") || tab.url.startsWith("chrome:")) return;

  const { archiveCheckMode } = await browser.storage.local.get({ archiveCheckMode: "off" });
  if (archiveCheckMode === "off") return;

  try {
    const host = new URL(tab.url).hostname.replace(/^www\./, "");

    // Skip archive sites themselves
    if (host.includes("archive.is") || host.includes("archive.ph") || host.includes("archive.today")) return;

    // If mode is "redirect-list", only check domains on the redirect list
    if (archiveCheckMode === "redirect-list") {
      const onList = archiveRedirectDomains.some(d => host === d || host.endsWith("." + d));
      if (!onList) return;
    }

    // Don't re-check the same URL for the same tab
    const cached = archiveCheckCache.get(tabId);
    if (cached && cached.url === tab.url && (Date.now() - cached.timestamp) < 300000) return;

    // Lightweight check: fetch archive.is/newest/URL with HEAD/redirect follow
    const checkUrl = `https://archive.is/newest/${tab.url}`;
    const resp = await fetch(checkUrl, { method: "HEAD", redirect: "follow" });

    if (resp.ok && resp.url && resp.url !== checkUrl && !resp.url.includes("/newest/")) {
      // Archive exists — resp.url is the archived snapshot URL
      archiveCheckCache.set(tabId, { url: tab.url, archiveUrl: resp.url, timestamp: Date.now() });
    } else {
      archiveCheckCache.set(tabId, { url: tab.url, archiveUrl: null, timestamp: Date.now() });
    }
  } catch {
    // Network error or archive.is down — silently skip
  }
});

// Clean up cache when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  archiveCheckCache.delete(tabId);
});

// ══════════════════════════════════════════════════════════════
// RSS Feeds — lightweight feed reader + monitor bridge
// ══════════════════════════════════════════════════════════════

const RSS_ALARM_PREFIX = "tl-rss-";

function parseRSSFeed(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const entries = [];
  let feedTitle = "";
  let feedSiteUrl = "";

  // Try RSS 2.0
  const channel = doc.querySelector("channel");
  if (channel) {
    feedTitle = channel.querySelector(":scope > title")?.textContent || "";
    feedSiteUrl = channel.querySelector(":scope > link")?.textContent || "";
    for (const item of channel.querySelectorAll("item")) {
      entries.push({
        id: item.querySelector("guid")?.textContent || item.querySelector("link")?.textContent || `entry-${Date.now()}-${Math.random()}`,
        title: item.querySelector("title")?.textContent || "Untitled",
        link: item.querySelector("link")?.textContent || "",
        description: (item.querySelector("description")?.textContent || "").slice(0, 1000),
        pubDate: item.querySelector("pubDate")?.textContent || "",
        read: false
      });
    }
  }

  // Try Atom
  if (!entries.length) {
    const feed = doc.querySelector("feed");
    if (feed) {
      feedTitle = feed.querySelector(":scope > title")?.textContent || "";
      const siteLink = feed.querySelector(':scope > link[rel="alternate"]') || feed.querySelector(":scope > link");
      feedSiteUrl = siteLink?.getAttribute("href") || "";
      for (const entry of feed.querySelectorAll("entry")) {
        const link = entry.querySelector('link[rel="alternate"]') || entry.querySelector("link");
        entries.push({
          id: entry.querySelector("id")?.textContent || link?.getAttribute("href") || `entry-${Date.now()}-${Math.random()}`,
          title: entry.querySelector("title")?.textContent || "Untitled",
          link: link?.getAttribute("href") || "",
          description: (entry.querySelector("summary")?.textContent || entry.querySelector("content")?.textContent || "").slice(0, 1000),
          pubDate: entry.querySelector("published")?.textContent || entry.querySelector("updated")?.textContent || "",
          read: false
        });
      }
    }
  }

  return { feedTitle, feedSiteUrl, entries };
}

async function discoverFeedUrl(pageUrl) {
  try {
    const resp = await fetch(pageUrl);
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    // Look for <link rel="alternate" type="application/rss+xml"> or atom
    const feedLink = doc.querySelector('link[type="application/rss+xml"]') ||
                     doc.querySelector('link[type="application/atom+xml"]');
    if (feedLink) {
      const href = feedLink.getAttribute("href");
      if (href.startsWith("http")) return href;
      return new URL(href, pageUrl).href;
    }
  } catch { /* feed discovery failed */ }
  return null;
}

async function handleAddFeed(message) {
  try {
    const rssFeeds = await ArgusDB.Feeds.getAll();

    let feedUrl = message.url.trim();

    // If URL doesn't look like a feed, try to discover one
    if (!feedUrl.match(/\.(xml|rss|atom|feed)/i) && !feedUrl.includes("/feed")) {
      const discovered = await discoverFeedUrl(feedUrl);
      if (discovered) feedUrl = discovered;
    }

    // Check for duplicate
    if (rssFeeds.some(f => f.url === feedUrl)) {
      return { success: false, error: "This feed is already subscribed." };
    }

    // Fetch and parse to validate
    const resp = await fetch(feedUrl);
    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    const xmlText = await resp.text();

    // Reject if this is clearly an HTML page, not a feed
    const isHtml = contentType.includes("text/html") && !contentType.includes("xml");
    const looksLikeHtml = xmlText.trimStart().slice(0, 200).toLowerCase().includes("<!doctype html") ||
                          xmlText.trimStart().slice(0, 200).toLowerCase().includes("<html");
    if (isHtml || (looksLikeHtml && !xmlText.includes("<rss") && !xmlText.includes("<feed") && !xmlText.includes("<channel"))) {
      return { success: false, error: "This URL is a webpage, not an RSS/Atom feed." };
    }

    const parsed = parseRSSFeed(xmlText);

    if (!parsed.entries.length) {
      return { success: false, error: "No feed entries found. Check the URL." };
    }

    const feed = {
      id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: feedUrl,
      title: message.title || parsed.feedTitle || feedUrl,
      siteUrl: parsed.feedSiteUrl || "",
      createdAt: new Date().toISOString(),
      lastFetched: new Date().toISOString(),
      checkIntervalMinutes: message.intervalMinutes || 60,
      enabled: true,
      aiSummarize: message.aiSummarize || false,
      monitorBridge: message.monitorBridge || false
    };

    await ArgusDB.Feeds.save(feed);

    // Save initial entries
    const initialEntries = parsed.entries.slice(0, 100).map(e => ({ ...e, feedId: feed.id }));
    await ArgusDB.FeedEntries.saveMany(initialEntries);

    // Set alarm for periodic checks
    browser.alarms.create(`${RSS_ALARM_PREFIX}${feed.id}`, {
      delayInMinutes: feed.checkIntervalMinutes,
      periodInMinutes: feed.checkIntervalMinutes
    });

    notifyDataChanged("feeds");
    // Page Tracker: log feed action
    trackPageAction(feedUrl, "feed", { title: feed.title });
    return { success: true, feed };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleGetFeeds() {
  const rssFeeds = await ArgusDB.Feeds.getAll();
  // Include unread counts
  const feeds = [];
  for (const feed of rssFeeds) {
    const entries = await ArgusDB.FeedEntries.getByFeed(feed.id);
    feeds.push({ ...feed, unreadCount: entries.filter(e => !e.read).length, totalEntries: entries.length });
  }
  return { success: true, feeds };
}

async function handleGetFeedEntries(message) {
  if (message.feedId) {
    const entries = await ArgusDB.FeedEntries.getByFeed(message.feedId);
    return { success: true, entries };
  }
  // All feeds — combine and sort by date
  const rssFeeds = await ArgusDB.Feeds.getAll();
  let allEntries = [];
  for (const feed of rssFeeds) {
    const entries = await ArgusDB.FeedEntries.getByFeed(feed.id);
    allEntries.push(...entries.map(e => ({ ...e, feedTitle: feed.title })));
  }
  allEntries.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return { success: true, entries: allEntries.slice(0, 200) };
}

async function handleDeleteFeed(message) {
  const feed = await ArgusDB.Feeds.get(message.id);
  if (feed) {
    await browser.alarms.clear(`${RSS_ALARM_PREFIX}${feed.id}`);
  }
  // ArgusDB.Feeds.remove also cleans up entries
  await ArgusDB.Feeds.remove(message.id);
  return { success: true };
}

async function handleDeleteAllFeeds() {
  const rssFeeds = await ArgusDB.Feeds.getAll();
  for (const feed of rssFeeds) {
    await browser.alarms.clear(`${RSS_ALARM_PREFIX}${feed.id}`);
  }
  await ArgusDB.Feeds.clear();
  return { success: true };
}

async function handleUpdateFeed(message) {
  const feed = await ArgusDB.Feeds.get(message.id);
  if (!feed) return { success: false, error: "Feed not found." };

  if (message.enabled !== undefined) feed.enabled = message.enabled;
  if (message.checkIntervalMinutes !== undefined) feed.checkIntervalMinutes = message.checkIntervalMinutes;
  if (message.aiSummarize !== undefined) feed.aiSummarize = message.aiSummarize;
  if (message.title !== undefined) feed.title = message.title;

  await ArgusDB.Feeds.save(feed);

  // Update alarm
  const alarmName = `${RSS_ALARM_PREFIX}${feed.id}`;
  await browser.alarms.clear(alarmName);
  if (feed.enabled) {
    browser.alarms.create(alarmName, {
      delayInMinutes: feed.checkIntervalMinutes,
      periodInMinutes: feed.checkIntervalMinutes
    });
  }

  return { success: true, feed };
}

async function handleMarkFeedEntryRead(message) {
  await ArgusDB.FeedEntries.update(message.entryId, { read: true });
  return { success: true };
}

async function handleMarkAllFeedRead(message) {
  const entries = await ArgusDB.FeedEntries.getByFeed(message.feedId);
  const updated = entries.map(e => ({ ...e, read: true }));
  await ArgusDB.FeedEntries.saveMany(updated);
  return { success: true };
}

async function handleRefreshFeed(message) {
  const feed = await ArgusDB.Feeds.get(message.id);
  if (!feed) return { success: false, error: "Feed not found." };
  const rssFeeds = await ArgusDB.Feeds.getAll();
  await checkFeedForUpdates(feed, rssFeeds);
  return { success: true };
}

async function handleSummarizeFeedEntry(message) {
  try {
    const settings = await getProviderSettings();
    const prompt = `Summarize this article concisely in 2-4 bullet points:

Title: ${message.title}

Content:
${message.content.slice(0, 3000)}`;

    const langInst = await getLanguageInstruction();
    const fsDefaults = { system: "You are a concise news summarizer. Provide clear, informative bullet-point summaries.", prompt: "" };
    const fsCustom = await getAdvancedPrompt("feedSummarizer", fsDefaults);
    const messages = buildMessages(
      `${fsCustom.system}${langInst}`,
      prompt
    );

    const result = await callProvider(
      settings.provider, settings.apiKey, settings.model, messages,
      { maxTokens: 500, temperature: 0.3 }
    );
    return { success: true, summary: result.content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleDiscoverFeed(message) {
  const feedUrl = await discoverFeedUrl(message.url);
  return { success: true, feedUrl };
}

// Shared keyword route matching — works on any set of feed entries
async function applyKeywordRoutes(entries, feedId, notify) {
  if (!entries.length) return;
  const { feedKeywordRoutes: routes } = await browser.storage.local.get({ feedKeywordRoutes: [] });
  console.log(`[Routes] Checking ${entries.length} entries against ${(routes || []).length} total routes (feedId: ${feedId})`);
  const activeRoutes = (routes || []).filter(r => r.enabled !== false && (!r.feedId || r.feedId === feedId));
  if (!activeRoutes.length) { console.log("[Routes] No active routes match this feedId"); return; }
  console.log(`[Routes] ${activeRoutes.length} active routes:`, activeRoutes.map(r => ({ keywords: r.keywords, feedId: r.feedId, projectId: r.projectId })));

  let matched = false;
  for (const entry of entries) {
    const scanText = ((entry.title || "") + " " + (entry.description || "")).toLowerCase();
    for (const route of activeRoutes) {
      // Skip if already routed to this project
      if (entry.routedTo && entry.routedTo.includes(route.projectId)) continue;

      // Split keywords into include and exclude (prefixed with !)
      const includeKws = route.keywords.filter(kw => !kw.startsWith("!"));
      const excludeKws = route.keywords.filter(kw => kw.startsWith("!")).map(kw => kw.slice(1));

      const testKw = (kw, text) => {
        const rxMatch = kw.match(/^\/(.+)\/([gimsuy]*)$/);
        if (rxMatch) {
          try { return new RegExp(rxMatch[1], rxMatch[2]).test(text); } catch { return false; }
        }
        return text.includes(kw.toLowerCase());
      };

      // Check excludes first — if any exclusion keyword matches, skip this entry
      const excluded = excludeKws.some(kw => testKw(kw, scanText));
      if (excluded) {
        if (entries.indexOf(entry) < 3) console.log(`[Routes] Excluded "${entry.title?.slice(0, 60)}" by !keyword`);
        continue;
      }

      // Wildcard "*" matches everything (associate entire feed with project)
      const hasWildcard = includeKws.includes("*");
      const matchedKws = hasWildcard ? ["*"] : includeKws.filter(kw => testKw(kw, scanText));
      if (!matchedKws.length && entries.indexOf(entry) < 3) {
        console.log(`[Routes] No match for "${entry.title?.slice(0, 60)}" against [${includeKws.join(", ")}]`);
      }
      if (matchedKws.length > 0) {
        // Mark entry as routed
        entry.routedTo = entry.routedTo || [];
        entry.routedTo.push(route.projectId);
        entry.routeKeywords = entry.routeKeywords || [];
        entry.routeKeywords.push(...matchedKws);
        matched = true;
        // Add to project (dedup by URL, respect rejected list)
        const proj = await ArgusDB.Projects.get(route.projectId);
        if (proj && !proj.items.some(i => i.url === entry.link)
            && !(proj.rejectedUrls && proj.rejectedUrls.includes(entry.link))) {
          await handleAddProjectItem({
            projectId: route.projectId,
            item: {
              type: "feed",
              url: entry.link || "",
              title: entry.title || "Feed Entry",
              summary: (entry.description || "").slice(0, 500),
              tags: ["feed", "auto-routed", ...matchedKws.slice(0, 3).map(k => k.replace(/^\/|\/[gimsuy]*$/g, ""))]
            }
          });
          console.log(`[RSS] Routed "${entry.title}" → project ${proj.name} (keywords: ${matchedKws.join(", ")})`);
        }
        // Notify if enabled
        if (notify && route.notify) {
          const projName = proj?.name || "project";
          safeNotify(`fkr-${entry.id}-${Date.now()}`, {
            type: "basic",
            iconUrl: "icons/icon-96.png",
            title: `Feed match → ${projName}`,
            message: entry.title || "New matching entry"
          });
        }
      }
    }
  }
  // Re-save entries with route metadata
  if (matched) {
    await ArgusDB.FeedEntries.saveMany(entries);
    notifyDataChanged("projects");
  }
}

// Rescan ALL existing feed entries against keyword routes (called when a route is added/updated)
async function handleFeedRouteRescan() {
  try {
    const allFeeds = await ArgusDB.Feeds.getAll();
    let totalRouted = 0;
    for (const feed of allFeeds) {
      const entries = await ArgusDB.FeedEntries.getByFeed(feed.id);
      const unrouted = entries.filter(e => !e.routedTo || e.routedTo.length === 0);
      if (unrouted.length > 0) {
        const before = unrouted.filter(e => e.routedTo?.length > 0).length;
        await applyKeywordRoutes(unrouted, feed.id, false);
        const after = unrouted.filter(e => e.routedTo?.length > 0).length;
        totalRouted += (after - before);
      }
    }
    console.log(`[RSS] Route rescan complete: ${totalRouted} entries routed`);
    return { success: true, routed: totalRouted };
  } catch (e) {
    console.warn("[RSS] Route rescan failed:", e);
    return { success: false, error: e.message };
  }
}

async function checkFeedForUpdates(feed, allFeeds) {
  try {
    const resp = await fetch(feed.url);
    const xmlText = await resp.text();
    const parsed = parseRSSFeed(xmlText);

    const existingEntries = await ArgusDB.FeedEntries.getByFeed(feed.id);
    const existingIds = new Set(existingEntries.map(e => e.id));

    const newEntries = parsed.entries.filter(e => !existingIds.has(e.id));
    console.log(`[RSS] Feed "${feed.title}": ${parsed.entries.length} total, ${existingEntries.length} existing, ${newEntries.length} new`);

    if (newEntries.length > 0) {
      // AI summarize new entries if enabled
      if (feed.aiSummarize) {
        const settings = await getProviderSettings();
        for (const entry of newEntries.slice(0, 5)) {
          try {
            const prompt = `Summarize concisely in 1-2 sentences:\n\nTitle: ${entry.title}\n${entry.description.slice(0, 2000)}`;
            const autoFsDefaults = { system: "You are a concise news summarizer.", prompt: "" };
            const autoFsCustom = await getAdvancedPrompt("feedSummarizer", autoFsDefaults);
            const msgs = buildMessages(autoFsCustom.system, prompt);
            const result = await callProvider(settings.provider, settings.apiKey, settings.model, msgs, { maxTokens: 200, temperature: 0.3 });
            entry.aiSummary = result.content;
          } catch { /* non-critical */ }
        }
      }

      // Scan new entries for watchlist keywords
      try {
        if (typeof scanForWatchwords === "function") {
          for (const entry of newEntries) {
            const scanText = (entry.title || "") + " " + (entry.description || "");
            await scanForWatchwords(scanText, "feed", entry.link || feed.url, entry.title || feed.title);
          }
        }
      } catch { /* non-critical */ }

      const newTagged = newEntries.map(e => ({ ...e, feedId: feed.id }));
      await ArgusDB.FeedEntries.saveMany(newTagged);

      // Extract entities for knowledge graph (non-blocking)
      try {
        for (const entry of newTagged.slice(0, 10)) {
          const kgText = (entry.title || "") + "\n" + (entry.aiSummary || entry.description || "");
          if (kgText.trim()) KnowledgeGraph.extractAndUpsert(kgText, entry.link || feed.url, entry.title, null);
        }
      } catch (e) { console.warn("[KG] feed entry extraction failed:", e); }

      // Keyword route matching — auto-add to projects (new entries)
      try {
        await applyKeywordRoutes(newTagged, feed.id, true);
      } catch (e) { console.warn("[RSS] Keyword route matching failed:", e); }

      // Notification for new entries
      if (newEntries.length > 0) {
        safeNotify(`rss-${feed.id}-${Date.now()}`, {
          type: "basic",
          iconUrl: "icons/icon-96.png",
          title: `${feed.title}: ${newEntries.length} new`,
          message: newEntries.slice(0, 3).map(e => e.title).join(" | ")
        });
      }

      // Monitor bridge — if enabled, create a change entry on the linked monitor
      if (feed.monitorBridge) {
        const pageMonitors = await ArgusDB.Monitors.getAll();
        const linkedMonitor = pageMonitors.find(m => m.url === feed.siteUrl || m.url === feed.url);
        if (linkedMonitor) {
          linkedMonitor.changeCount += newEntries.length;
          linkedMonitor.lastChangeSummary = `${newEntries.length} new RSS entries: ${newEntries.slice(0, 2).map(e => e.title).join(", ")}`;
          linkedMonitor.lastChangeAt = new Date().toISOString();
          await ArgusDB.Monitors.save(linkedMonitor);
        }
      }
    }

    // Scan existing unrouted entries against keyword routes on EVERY check (not just when new entries arrive)
    try {
      const allEntries = await ArgusDB.FeedEntries.getByFeed(feed.id);
      const unrouted = allEntries.filter(e => !e.routedTo || e.routedTo.length === 0);
      if (unrouted.length > 0) {
        await applyKeywordRoutes(unrouted, feed.id, false);
      }
    } catch (e) { console.warn("[RSS] Retroactive keyword route scan failed:", e); }

    // Update feed metadata
    feed.lastFetched = new Date().toISOString();
    await ArgusDB.Feeds.save(feed);
  } catch (err) {
    console.warn(`[RSS] Failed to check feed "${feed.title}":`, err.message);
  }
}

// RSS alarm handler — hook into existing alarm listener
const origAlarmHandler = browser.alarms.onAlarm.hasListener;
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(RSS_ALARM_PREFIX)) return;

  const feedId = alarm.name.slice(RSS_ALARM_PREFIX.length);
  const feed = await ArgusDB.Feeds.get(feedId);
  if (!feed || !feed.enabled) return;

  const rssFeeds = await ArgusDB.Feeds.getAll();
  await checkFeedForUpdates(feed, rssFeeds);
});

// Knowledge Graph inference alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "trawl-duration-expire") return;
  await browser.storage.local.set({ trawlEnabled: false, trawlExpireAt: null });
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "kg-inference") return;
  try {
    const stats = await KnowledgeGraph.runInferenceRules();
    if (stats.inferred) console.log("[KG] Periodic inference:", stats.inferred, "new relationships");
  } catch (e) { console.warn("[KG] Periodic inference error:", e); }
});

// Cloud backup alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "argus-cloud-backup") return;
  try {
    const { cloudBackupEnabled } = await browser.storage.local.get({ cloudBackupEnabled: false });
    if (!cloudBackupEnabled) return;
    const result = await handleCloudBackupNow();
    if (result.success) console.log(`[Backup] Scheduled backup complete: ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`);
    else console.warn("[Backup] Scheduled backup failed:", result.error);
  } catch (e) { console.warn("[Backup] Scheduled backup error:", e); }
});

// Scheduled digest alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "agent-digests") return;
  try {
    const results = await AgentEngine.runScheduledDigests();
    const generated = results.filter(r => r.success).length;
    if (generated) console.log("[Agent] Scheduled digests generated:", generated);
  } catch (e) { console.warn("[Agent] Scheduled digest error:", e); }
});

// ──────────────────────────────────────────────
// Finance Price Fetcher
// ──────────────────────────────────────────────

// Yahoo Finance symbol mapping
const YAHOO_TYPE_MAP = {
  stock: (s) => s,                         // AAPL → AAPL
  index: (s) => s.startsWith("^") ? s : `^${s}`, // SPX → ^SPX
  forex: (s) => s.replace("/", "") + "=X", // EUR/USD → EURUSD=X
  commodity: (s) => {
    const map = { GOLD: "GC=F", SILVER: "SI=F", OIL: "CL=F", "CRUDE OIL": "CL=F", "BRENT": "BZ=F",
      PLATINUM: "PL=F", PALLADIUM: "PA=F", COPPER: "HG=F", "NATURAL GAS": "NG=F", WHEAT: "ZW=F", CORN: "ZC=F" };
    return map[s.toUpperCase()] || s + "=F";
  },
};

// CoinGecko ID mapping for common cryptos
const COINGECKO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano", DOT: "polkadot",
  DOGE: "dogecoin", SHIB: "shiba-inu", AVAX: "avalanche-2", MATIC: "matic-network",
  LINK: "chainlink", UNI: "uniswap", ATOM: "cosmos", XRP: "ripple", LTC: "litecoin",
  BNB: "binancecoin", NEAR: "near", APT: "aptos", ARB: "arbitrum", OP: "optimism",
  FIL: "filecoin", AAVE: "aave", MKR: "maker", CRV: "curve-dao-token", LDO: "lido-dao",
  RENDER: "render-token", FET: "fetch-ai", INJ: "injective-protocol", TIA: "celestia",
  SEI: "sei-network", SUI: "sui", PEPE: "pepe", WIF: "dogwifcoin", BONK: "bonk",
  RUNE: "thorchain", ALGO: "algorand", XLM: "stellar", VET: "vechain", HBAR: "hedera-hashgraph",
  ICP: "internet-computer", SAND: "the-sandbox", MANA: "decentraland", AXS: "axie-infinity",
};

async function financeRefreshPrices() {
  const FIN_KEY = "financeMonitor";
  const { [FIN_KEY]: state } = await browser.storage.local.get({ [FIN_KEY]: null });
  if (!state || !state.watchlist?.length) return { success: true, updated: 0 };

  let updated = 0;

  // Split items by type
  const cryptoItems = state.watchlist.filter(i => i.type === "crypto");
  const yahooItems = state.watchlist.filter(i => i.type !== "crypto");

  // ── Fetch crypto from CoinGecko ──
  if (cryptoItems.length) {
    try {
      const ids = cryptoItems.map(i => {
        const mapped = COINGECKO_IDS[i.symbol.toUpperCase()];
        return mapped || i.symbol.toLowerCase();
      }).filter(Boolean);

      if (ids.length) {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          for (const item of cryptoItems) {
            const cgId = COINGECKO_IDS[item.symbol.toUpperCase()] || item.symbol.toLowerCase();
            const quote = data[cgId];
            if (quote) {
              item.price = quote.usd;
              item.changePct = quote.usd_24h_change != null ? parseFloat(quote.usd_24h_change.toFixed(2)) : null;
              item.volume = quote.usd_24h_vol || null;
              item.lastUpdated = new Date().toISOString();
              updated++;
            }
          }
        }
      }
    } catch (e) { console.warn("[Finance] CoinGecko fetch error:", e.message); }
  }

  // ── Fetch stocks/indices/forex/commodities from Yahoo Finance ──
  if (yahooItems.length) {
    // Batch into groups of 10
    const batches = [];
    for (let i = 0; i < yahooItems.length; i += 10) {
      batches.push(yahooItems.slice(i, i + 10));
    }

    for (const batch of batches) {
      try {
        const symbols = batch.map(item => {
          const mapper = YAHOO_TYPE_MAP[item.type];
          return mapper ? mapper(item.symbol) : item.symbol;
        });

        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
        const resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });

        if (resp.ok) {
          const data = await resp.json();
          const quotes = data?.quoteResponse?.result || [];

          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            const sym = symbols[j];
            const quote = quotes.find(q =>
              q.symbol === sym ||
              q.symbol === item.symbol ||
              q.symbol.toUpperCase() === sym.toUpperCase()
            );
            if (quote) {
              item.price = quote.regularMarketPrice || null;
              item.change = quote.regularMarketChange != null ? parseFloat(quote.regularMarketChange.toFixed(2)) : null;
              item.changePct = quote.regularMarketChangePercent != null ? parseFloat(quote.regularMarketChangePercent.toFixed(2)) : null;
              item.volume = quote.regularMarketVolume || null;
              if (!item.name && quote.shortName) item.name = quote.shortName;
              item.lastUpdated = new Date().toISOString();
              updated++;
            }
          }
        }
      } catch (e) { console.warn("[Finance] Yahoo fetch error:", e.message); }
    }
  }

  // ── Check price alerts ──
  if (state.alerts?.length) {
    for (const alert of state.alerts) {
      if (!alert.enabled || alert.triggered) continue;
      const item = state.watchlist.find(i => i.symbol.toUpperCase() === alert.symbol.toUpperCase());
      if (!item || item.price == null) continue;

      let triggered = false;
      switch (alert.condition) {
        case "above": triggered = item.price >= alert.threshold; break;
        case "below": triggered = item.price <= alert.threshold; break;
        case "change_above": triggered = Math.abs(item.changePct || 0) >= alert.threshold; break;
        case "change_below": triggered = Math.abs(item.changePct || 0) <= alert.threshold; break;
      }
      if (triggered) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        // Send browser notification if available
        try {
          const has = await browser.permissions.contains({ permissions: ["notifications"] });
          if (has) {
            browser.notifications.create(`fin-alert-${alert.id}`, {
              type: "basic",
              iconUrl: "icons/icon-96.png",
              title: `Price Alert: ${alert.symbol}`,
              message: `${alert.symbol} ${alert.condition === "above" ? "reached" : "dropped to"} $${item.price} (threshold: ${alert.threshold})`,
            });
          }
        } catch { /* notifications optional */ }
      }
    }
  }

  // Save updated state
  state.lastRefreshed = new Date().toISOString();
  await browser.storage.local.set({ [FIN_KEY]: state });
  console.log(`[Finance] Refreshed ${updated} prices`);
  return { success: true, updated };
}

// Finance alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "finance-price-refresh") return;
  try {
    await financeRefreshPrices();
  } catch (e) { console.warn("[Finance] Price refresh error:", e.message); }
});

// Restore RSS alarms on startup
(async () => {
  const rssFeeds = await ArgusDB.Feeds.getAll();
  for (const feed of rssFeeds) {
    if (!feed.enabled) continue;
    const alarmName = `${RSS_ALARM_PREFIX}${feed.id}`;
    const existing = await browser.alarms.get(alarmName);
    if (!existing) {
      browser.alarms.create(alarmName, {
        delayInMinutes: feed.checkIntervalMinutes,
        periodInMinutes: feed.checkIntervalMinutes
      });
    }
  }
})();

// ══════════════════════════════════════════════════════════════
// Projects — organize analyses, bookmarks, and notes
// ══════════════════════════════════════════════════════════════

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function handleGetProjects() {
  const projects = await ArgusDB.Projects.getAll();
  return { success: true, projects };
}

async function _pushProjectToCloud(project) {
  try {
    const provider = CloudProviders[project.cloudProvider];
    if (!provider || !await provider.isConnected()) return;
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    await provider.upload(blob, `projects/${project.id}.json`);
    console.log(`[Argus] Project "${project.name}" synced to ${project.cloudProvider}`);
  } catch (e) {
    console.warn(`[Argus] Project cloud sync failed for "${project.name}":`, e.message);
  }
}

async function handleCreateProject(message) {
  const project = {
    id: genId("proj"),
    name: message.name || "Untitled Project",
    description: message.description || "",
    starred: false,
    color: message.color || "#e94560",
    cloudProvider: message.cloudProvider || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: []
  };
  await ArgusDB.Projects.save(project);
  if (project.cloudProvider) _pushProjectToCloud(project);
  createContextMenus(); // Rebuild so new project appears in right-click menu
  notifyDataChanged("projects");
  return { success: true, project };
}

async function handleUpdateProject(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  if (message.name !== undefined) proj.name = message.name;
  if (message.description !== undefined) proj.description = message.description;
  if (message.starred !== undefined) proj.starred = message.starred;
  if (message.color !== undefined) proj.color = message.color;
  if (message.cloudProvider !== undefined) proj.cloudProvider = message.cloudProvider || null;
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  if (proj.cloudProvider) _pushProjectToCloud(proj);
  createContextMenus(); // Rebuild so renamed project updates in right-click menu
  notifyDataChanged("projects");
  return { success: true, project: proj };
}

async function handleDeleteProject(message) {
  await ArgusDB.Projects.remove(message.projectId);
  createContextMenus(); // Rebuild so deleted project is removed from right-click menu
  notifyDataChanged("projects");
  return { success: true };
}

async function handleAddProjectItem(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  const item = {
    id: genId("item"),
    type: message.item.type || "note",
    refId: message.item.refId || null,
    url: message.item.url || "",
    title: message.item.title || "",
    summary: (message.item.summary || "").slice(0, 500),
    analysisContent: message.item.analysisContent || "",
    analysisPreset: message.item.analysisPreset || "",
    notes: message.item.notes || "",
    tags: message.item.tags || [],
    addedAt: new Date().toISOString()
  };
  proj.items.unshift(item);
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  if (proj.cloudProvider) _pushProjectToCloud(proj);
  notifyDataChanged("projects");
  return { success: true, item };
}

async function handleUpdateProjectItem(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  const item = proj.items.find(i => i.id === message.itemId);
  if (!item) return { success: false, error: "Item not found" };
  if (message.notes !== undefined) item.notes = message.notes;
  if (message.tags !== undefined) item.tags = message.tags;
  if (message.title !== undefined) item.title = message.title;
  if (message.analysisContent !== undefined) item.analysisContent = message.analysisContent;
  if (message.analysisPreset !== undefined) item.analysisPreset = message.analysisPreset;
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  if (proj.cloudProvider) _pushProjectToCloud(proj);
  return { success: true, item };
}

async function handleRemoveProjectItem(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  // If reject flag set, add URL to project's rejected list so routing won't re-add it
  if (message.reject) {
    const item = proj.items.find(i => i.id === message.itemId);
    if (item && item.url) {
      proj.rejectedUrls = proj.rejectedUrls || [];
      if (!proj.rejectedUrls.includes(item.url)) {
        proj.rejectedUrls.push(item.url);
        console.log(`[Projects] Rejected URL from "${proj.name}": ${item.url}`);
      }
    }
  }
  proj.items = proj.items.filter(i => i.id !== message.itemId);
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  notifyDataChanged("projects");
  return { success: true };
}

async function handleUnRejectProjectUrl(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };
  proj.rejectedUrls = (proj.rejectedUrls || []).filter(u => u !== message.url);
  proj.updatedAt = new Date().toISOString();
  await ArgusDB.Projects.save(proj);
  notifyDataChanged("projects");
  return { success: true };
}

async function handleExportProject(message) {
  const proj = await ArgusDB.Projects.get(message.projectId);
  if (!proj) return { success: false, error: "Project not found" };

  // Collect related history entries referenced by project items
  const relatedHistory = [];
  const historyMap = new Map();
  const refIds = proj.items.filter(i => i.refId).map(i => i.refId);
  if (refIds.length) {
    const allHistory = await ArgusDB.History.getAllSorted();
    for (const entry of allHistory) {
      if (refIds.includes(entry.id)) {
        relatedHistory.push(entry);
        historyMap.set(entry.id, entry);
      }
    }
  }

  // Backfill analysisContent from history for items that lack it
  for (const item of proj.items) {
    if (!item.analysisContent && item.refId && historyMap.has(item.refId)) {
      const entry = historyMap.get(item.refId);
      item.analysisContent = entry.content || "";
      item.analysisPreset = item.analysisPreset || entry.presetLabel || entry.preset || "";
    }
  }

  const bundle = {
    manifest: {
      format: "argusproj",
      version: 1,
      exportedAt: new Date().toISOString(),
      argusVersion: browser.runtime.getManifest().version,
      projectCount: 1,
      historyCount: relatedHistory.length,
    },
    projects: [proj],
    history: relatedHistory,
  };
  return { success: true, bundle };
}

async function handleExportAllProjects() {
  const projects = await ArgusDB.Projects.getAll();
  if (!projects.length) return { success: false, error: "No projects" };

  // Collect all referenced history entries
  const refIds = new Set();
  for (const proj of projects) {
    for (const item of (proj.items || [])) {
      if (item.refId) refIds.add(item.refId);
    }
  }
  const relatedHistory = [];
  const historyMap = new Map();
  if (refIds.size) {
    const allHistory = await ArgusDB.History.getAllSorted();
    for (const entry of allHistory) {
      if (refIds.has(entry.id)) {
        relatedHistory.push(entry);
        historyMap.set(entry.id, entry);
      }
    }
  }

  // Backfill analysisContent from history for items that lack it
  for (const proj of projects) {
    for (const item of (proj.items || [])) {
      if (!item.analysisContent && item.refId && historyMap.has(item.refId)) {
        const entry = historyMap.get(item.refId);
        item.analysisContent = entry.content || "";
        item.analysisPreset = item.analysisPreset || entry.presetLabel || entry.preset || "";
      }
    }
  }

  const bundle = {
    manifest: {
      format: "argusproj",
      version: 1,
      exportedAt: new Date().toISOString(),
      argusVersion: browser.runtime.getManifest().version,
      projectCount: projects.length,
      historyCount: relatedHistory.length,
    },
    projects,
    history: relatedHistory,
  };
  return { success: true, bundle };
}

async function handleImportProject(message) {
  const { bundle } = message;
  if (!bundle || !bundle.manifest || bundle.manifest.format !== "argusproj") {
    return { success: false, error: "Invalid .argusproj file" };
  }

  let projectsImported = 0;
  let historyImported = 0;

  // Import projects (assign new IDs to avoid collisions)
  const idMap = {};
  for (const proj of (bundle.projects || [])) {
    const oldId = proj.id;
    const newId = genId("proj");
    idMap[oldId] = newId;
    proj.id = newId;
    proj.updatedAt = new Date().toISOString();
    // Remap item IDs
    for (const item of (proj.items || [])) {
      item.id = genId("item");
    }
    await ArgusDB.Projects.save(proj);
    projectsImported++;
  }

  // Import related history entries (new IDs, update project item refIds)
  const historyIdMap = {};
  for (const entry of (bundle.history || [])) {
    const oldId = entry.id;
    const newId = genId("hist");
    historyIdMap[oldId] = newId;
    entry.id = newId;
    await ArgusDB.History.add(entry);
    historyImported++;
  }

  // Update refIds in imported projects to point to new history IDs
  if (Object.keys(historyIdMap).length) {
    for (const oldId of Object.keys(idMap)) {
      const newProjId = idMap[oldId];
      const savedProj = await ArgusDB.Projects.get(newProjId);
      if (!savedProj) continue;
      let changed = false;
      for (const item of (savedProj.items || [])) {
        if (item.refId && historyIdMap[item.refId]) {
          item.refId = historyIdMap[item.refId];
          changed = true;
        }
      }
      if (changed) await ArgusDB.Projects.save(savedProj);
    }
  }

  return { success: true, projectsImported, historyImported };
}

async function handleBatchAnalyzeProjectItem(message) {
  try {
    const { projectId, itemId, presetKey } = message;
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };
    const item = proj.items.find(i => i.id === itemId);
    if (!item || !item.url) return { success: false, error: "Item has no URL" };

    // Initialize analyses array if not present (backward compat)
    if (!item.analyses) {
      item.analyses = [];
      // Migrate existing single analysis into the array
      if (item.analysisContent) {
        item.analyses.push({
          preset: item.analysisPreset || "unknown",
          presetLabel: ANALYSIS_PRESETS[item.analysisPreset]?.label || item.analysisPreset || "Analysis",
          content: item.analysisContent,
          summary: item.summary || "",
          timestamp: item.addedAt || new Date().toISOString()
        });
      }
    }

    // Check history first — reuse existing analysis if available
    // But only if this preset hasn't already been run on this item
    const alreadyHasPreset = item.analyses.some(a => a.preset === presetKey);
    if (!alreadyHasPreset) {
      const analysisHistory = await ArgusDB.History.getAllSorted();
      const existingAnalysis = analysisHistory.find(h =>
        h.pageUrl === item.url && h.presetKey === presetKey
      );
      if (existingAnalysis && existingAnalysis.content) {
        const cleanContent = existingAnalysis.content.replace(/\n?SHARELINE:\s*.+$/m, "");
        item.analyses.push({
          preset: presetKey,
          presetLabel: ANALYSIS_PRESETS[presetKey]?.label || presetKey,
          content: cleanContent,
          summary: humanSummaryFromContent(cleanContent),
          timestamp: new Date().toISOString()
        });
        // Update top-level fields for backward compat
        item.analysisContent = cleanContent;
        item.analysisPreset = presetKey;
        item.summary = humanSummaryFromContent(cleanContent);
        proj.updatedAt = new Date().toISOString();
        await ArgusDB.Projects.save(proj);
        return { success: true, cached: true };
      }
    }

    // Fetch page and analyze
    const text = await fetchPageText(item.url);
    console.log(`[Batch] fetchPageText for "${item.url}": ${text ? text.length + " chars" : "null"}`, text ? text.slice(0, 200) : "");
    if (!text || text.length < 20) return { success: false, error: "Could not fetch page content" };

    const page = { url: item.url, title: item.title || item.url, description: "", text };
    const settings = await getProviderSettings();
    const { systemPrompt, userPrompt } = await buildAnalysisPrompts(page, presetKey, null, settings);
    const messages = buildMessages(systemPrompt, userPrompt);
    const result = await callProvider(settings.provider, settings.apiKey, settings.model, messages, {
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      reasoningEffort: settings.reasoningEffort,
      extendedThinking: settings.extendedThinking
    });

    // Strip shareline and structured data block from content for display
    let cleanContent = result.content.replace(/\n?SHARELINE:\s*.+$/m, "");
    let structuredData = null;
    if (ArgusStructured.hasBlock(cleanContent)) {
      const parsed = ArgusStructured.parse(cleanContent);
      cleanContent = parsed.prose;
      if (parsed.data) structuredData = ArgusStructured.normalize(parsed.data);
    }

    // Stack the new analysis
    const analysisEntry = {
      preset: presetKey,
      presetLabel: ANALYSIS_PRESETS[presetKey]?.label || presetKey,
      content: cleanContent,
      summary: humanSummaryFromContent(cleanContent),
      timestamp: new Date().toISOString()
    };
    if (structuredData) analysisEntry.structuredData = structuredData;
    item.analyses.push(analysisEntry);

    // Update top-level fields for backward compat (latest analysis)
    item.analysisContent = cleanContent;
    item.analysisPreset = presetKey;
    item.summary = humanSummaryFromContent(cleanContent);
    proj.updatedAt = new Date().toISOString();
    await ArgusDB.Projects.save(proj);

    // Also save to history
    await saveToHistory({
      pageTitle: item.title || item.url,
      pageUrl: item.url,
      presetKey,
      presetLabel: ANALYSIS_PRESETS[presetKey]?.label || presetKey,
      content: result.content,
      thinking: result.thinking || null,
      provider: settings.provider,
      model: settings.model,
      usage: result.usage,
      promptText: systemPrompt + "\n" + userPrompt
    });

    return { success: true, cached: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Save follow-up conversation thread to a project item
// ──────────────────────────────────────────────
async function handleSaveConversationToProject(message) {
  try {
    const { projectId, itemId, conversation } = message;
    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) return { success: false, error: "Project not found" };
    const item = proj.items.find(i => i.id === itemId);
    if (!item) return { success: false, error: "Item not found" };

    if (!item.conversations) item.conversations = [];
    item.conversations.push({
      id: genId("conv"),
      messages: conversation, // array of { role, content }
      timestamp: new Date().toISOString()
    });

    proj.updatedAt = new Date().toISOString();
    await ArgusDB.Projects.save(proj);
    notifyDataChanged("projects");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Background batch analysis for projects
// ──────────────────────────────────────────────
let batchState = { running: false, projectId: null, total: 0, done: 0, current: "", errors: [], cancelled: false };

async function handleBatchAnalyzeProject(message) {
  if (batchState.running) return { success: false, error: "A batch analysis is already running." };

  const { projectId, presetKey, reanalyze } = message;
  const proj = await ArgusDB.Projects.get(projectId);
  if (!proj) return { success: false, error: "Project not found" };

  const targets = reanalyze
    ? proj.items.filter(i => i.url)
    : proj.items.filter(i => i.url && !i.analysisContent);

  console.log(`[Batch] Starting: ${targets.length} items, preset=${presetKey}, reanalyze=${reanalyze}`);
  console.log(`[Batch] Total project items: ${proj.items.length}, with URL: ${proj.items.filter(i => i.url).length}, unanalyzed: ${proj.items.filter(i => i.url && !i.analysisContent).length}`);

  if (targets.length === 0) return { success: false, error: "No items to analyze." };

  batchState = { running: true, projectId, total: targets.length, done: 0, current: "", errors: [], cancelled: false };

  // Fire-and-forget — runs in background
  runBatchLoop(targets.map(i => i.id), projectId, presetKey);

  return { success: true, total: targets.length };
}

async function runBatchLoop(itemIds, projectId, presetKey) {
  const ITEM_TIMEOUT = 60000; // 60s max per item

  for (const itemId of itemIds) {
    if (batchState.cancelled) break;

    const proj = await ArgusDB.Projects.get(projectId);
    if (!proj) { batchState.errors.push("Project disappeared"); break; }
    const item = proj.items.find(i => i.id === itemId);
    if (!item) { batchState.done++; continue; }

    batchState.current = item.title || item.url;

    try {
      console.log(`[Batch] Analyzing ${batchState.done + 1}/${batchState.total}: ${item.title || item.url}`);
      const resp = await Promise.race([
        handleBatchAnalyzeProjectItem({ projectId, itemId, presetKey }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out after 60s")), ITEM_TIMEOUT))
      ]);
      if (!resp.success) {
        console.warn(`[Batch] Failed: ${item.title || item.url} — ${resp.error}`);
        batchState.errors.push(`${item.title || item.url}: ${resp.error}`);
      } else {
        console.log(`[Batch] Done: ${item.title || item.url} (cached=${resp.cached})`);
      }
    } catch (err) {
      console.error(`[Batch] Error: ${item.title || item.url} — ${err.message}`);
      batchState.errors.push(`${item.title || item.url}: ${err.message}`);
    }

    batchState.done++;

    // Brief pause between items to avoid rate limits
    if (!batchState.cancelled) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  batchState.running = false;
  batchState.current = "";
}

function handleGetBatchStatus() {
  return {
    success: true,
    running: batchState.running,
    projectId: batchState.projectId,
    total: batchState.total,
    done: batchState.done,
    current: batchState.current,
    errors: batchState.errors,
    cancelled: batchState.cancelled
  };
}

function handleCancelBatch() {
  if (batchState.running) {
    batchState.cancelled = true;
    return { success: true };
  }
  return { success: false, error: "No batch running." };
}

// ══════════════════════════════════════════════════════════════
// Trawl Phase 3 — GeoMap from Trawl & Save Session as Project
// ══════════════════════════════════════════════════════════════

async function handleBuildGeomapFromTrawl(message) {
  try {
    const pages = await ArgusDB.PageTracker.getAll();
    const trawled = pages.filter(p => p.trawlData);

    // Apply optional date range filter
    let filtered = trawled;
    if (message.from || message.to) {
      const from = message.from ? new Date(message.from).getTime() : 0;
      const to = message.to ? new Date(message.to + "T23:59:59").getTime() : Infinity;
      filtered = trawled.filter(p => {
        const t = p.lastVisit || p.firstVisit || 0;
        return t >= from && t <= to;
      });
    }

    const locations = [];
    for (const p of filtered) {
      const td = p.trawlData;
      const host = (() => { try { return new URL(p.url).hostname.replace(/^www\./, ""); } catch { return p.url; } })();

      // Direct geo coordinates from Schema.org
      if (td.geo?.lat && td.geo?.lng) {
        locations.push({
          name: td.businessName || host,
          lat: td.geo.lat,
          lng: td.geo.lng,
          type: "organization",
          mentions: 1,
          sources: [{ title: p.title || host, url: p.url }],
        });
      }

      // Addresses (will need geocoding on the frontend/geomap side)
      for (const addr of (td.addresses || [])) {
        locations.push({
          name: addr,
          lat: null,
          lng: null,
          type: "address",
          mentions: 1,
          sources: [{ title: p.title || host, url: p.url }],
          needsGeocode: true,
        });
      }
    }

    // Deduplicate by name
    const deduped = new Map();
    for (const loc of locations) {
      const key = loc.name.toLowerCase().trim();
      if (deduped.has(key)) {
        const existing = deduped.get(key);
        existing.mentions += loc.mentions;
        existing.sources.push(...loc.sources);
        if (loc.lat && !existing.lat) { existing.lat = loc.lat; existing.lng = loc.lng; }
      } else {
        deduped.set(key, loc);
      }
    }

    return { success: true, locations: [...deduped.values()] };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleSaveTrawlAsProject(message) {
  try {
    const pages = await ArgusDB.PageTracker.getAll();
    let trawled = pages.filter(p => p.trawlData);

    // Apply optional date range
    if (message.from || message.to) {
      const from = message.from ? new Date(message.from).getTime() : 0;
      const to = message.to ? new Date(message.to + "T23:59:59").getTime() : Infinity;
      trawled = trawled.filter(p => {
        const t = p.lastVisit || p.firstVisit || 0;
        return t >= from && t <= to;
      });
    }

    if (!trawled.length) return { success: false, error: "No trawl data to save" };

    const projectName = message.name || `Trawl Session — ${new Date().toLocaleDateString()}`;
    const project = {
      id: genId("proj"),
      name: projectName,
      description: message.description || `Auto-created from Trawl Net session. ${trawled.length} pages with extracted data.`,
      starred: false,
      color: "#26a69a",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: trawled.map(p => {
        const td = p.trawlData;
        return {
          id: genId("item"),
          url: p.url,
          title: p.title || p.url,
          addedAt: new Date().toISOString(),
          notes: [
            td.businessName ? `Business: ${td.businessName}` : "",
            td.emails?.length ? `Emails: ${td.emails.join(", ")}` : "",
            td.phones?.length ? `Phones: ${td.phones.join(", ")}` : "",
            td.addresses?.length ? `Addresses: ${td.addresses.join("; ")}` : "",
          ].filter(Boolean).join("\n"),
        };
      }),
    };

    await ArgusDB.Projects.save(project);
    createContextMenus();
    notifyDataChanged("projects");
    return { success: true, project: { id: project.id, name: project.name, itemCount: project.items.length } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// Startup: migrate data to IndexedDB, cleanup, and auto-prune
// ──────────────────────────────────────────────
(async function startupInit() {
  try {
    // Migrate existing browser.storage.local data to IndexedDB (one-time)
    await ArgusDB.migrateFromStorage();
  } catch (e) {
    console.warn("[ArgusDB] Migration error (will retry next startup):", e);
  }

  // Seed default bookmark folders on first run (if none exist)
  try {
    const existing = await ArgusDB.BookmarkFolders.getAll();
    if (!existing || existing.length === 0) {
      const defaultFolders = [
        "Unsorted", "Tech", "News", "Sports", "Science",
        "Finance", "Entertainment", "Politics", "Security", "Research"
      ];
      for (let i = 0; i < defaultFolders.length; i++) {
        await ArgusDB.BookmarkFolders.save({
          id: `bmf-seed-${i}`,
          name: defaultFolders[i],
          parentId: "",
          projectId: "",
          sortOrder: i,
          createdAt: new Date().toISOString()
        });
      }
      console.log("[Argus] Seeded default bookmark folders");
    }
  } catch (e) {
    console.warn("[Argus] Failed to seed bookmark folders:", e);
  }

  // Clean up stale temporary keys from browser.storage.local
  try {
    const all = await browser.storage.local.get(null);
    const staleKeys = [];
    const now = Date.now();
    const MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours

    for (const [key, val] of Object.entries(all)) {
      // Ephemeral result entries — purge completed, errored, or old stuck ones
      if (key.startsWith("tl-result-") || key.startsWith("proj-view-")) {
        if (!val || typeof val !== "object") { staleKeys.push(key); continue; }
        if (val.status === "done" || val.status === "error") { staleKeys.push(key); continue; }
        // Extract timestamp from key for stuck streaming/loading entries
        const tsMatch = key.match(/(\d{13})/);
        if (tsMatch && now - Number(tsMatch[1]) > MAX_AGE) { staleKeys.push(key); continue; }
        continue;
      }
      // Pipeline enrichment data, OSINT tool results — always ephemeral
      if (key.endsWith("-pipeline") || key.startsWith("techstack-") ||
          key.startsWith("metadata-") || key.startsWith("linkmap-") ||
          key.startsWith("whois-") || key.startsWith("result-")) {
        staleKeys.push(key);
      }
    }

    if (staleKeys.length) {
      await browser.storage.local.remove(staleKeys);
      console.log(`[Startup] Purged ${staleKeys.length} stale temporary keys`);
    }
  } catch { /* startup cleanup is best-effort */ }

  // Run auto-prune rules on IndexedDB stores
  try {
    const stats = await ArgusDB.runPruneRules();
    if (stats.deleted || stats.compressed) {
      console.log("[ArgusDB] Auto-prune:", stats);
    }
  } catch { /* prune is best-effort */ }

  // Knowledge Graph: backfill from existing history (one-time)
  try {
    await KnowledgeGraph.backfillFromHistory();
  } catch (e) { console.warn("[KG] Backfill error:", e); }

  // Knowledge Graph: prune noisy entities on startup
  try {
    const pruneResult = await KnowledgeGraph.pruneNoiseEntities();
    if (pruneResult.pruned) console.log("[KG] Pruned", pruneResult.pruned, "noisy entities");
  } catch { /* prune is best-effort */ }

  // Knowledge Graph: run inference rules on startup
  try {
    const kgStats = await KnowledgeGraph.runInferenceRules();
    if (kgStats.inferred) console.log("[KG] Inferred", kgStats.inferred, "new relationships");
  } catch { /* inference is best-effort */ }

  // Set up periodic inference alarm (every 30 min)
  browser.alarms.create("kg-inference", { delayInMinutes: 30, periodInMinutes: 30 });

  // Set up scheduled digest alarm (every 6 hours — actual digest generation checks per-project schedule)
  browser.alarms.create("agent-digests", { delayInMinutes: 60, periodInMinutes: 360 });

  // Set up cloud backup alarm if enabled
  const { cloudBackupEnabled, cloudBackupIntervalHours } = await browser.storage.local.get({ cloudBackupEnabled: false, cloudBackupIntervalHours: 24 });
  if (cloudBackupEnabled) {
    browser.alarms.create("argus-cloud-backup", { delayInMinutes: cloudBackupIntervalHours * 60, periodInMinutes: cloudBackupIntervalHours * 60 });
    console.log(`[Backup] Scheduled backup alarm set: every ${cloudBackupIntervalHours}h`);
  }

  // Finance price refresh alarm (every 5 min)
  browser.alarms.create("finance-price-refresh", { delayInMinutes: 1, periodInMinutes: 5 });
})();
