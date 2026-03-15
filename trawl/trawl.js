// ──────────────────────────────────────────────
// Trawl Net — Morning-After Intelligence View
// ──────────────────────────────────────────────
(function () {
  "use strict";

  // ── State ──
  let allEntries = [];       // PageTracker entries with trawlData
  let filtered = [];         // after search + date filter
  let domainClusters = {};   // hostname → { entries, score, bestEntry, favicon }
  let activeView = "table";
  let regexMode = false;
  let sortCol = "score";
  let sortAsc = false;

  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);
  const searchInput = $("trawl-search");
  const searchMode = $("search-mode");
  const searchCount = $("search-count");
  const searchBar = $("search-bar");
  const dateFrom = $("date-from");
  const dateTo = $("date-to");
  const topCards = $("top-cards");
  const viewTable = $("view-table");
  const viewTimeline = $("view-timeline");
  const viewCloud = $("view-cloud");
  const emptyState = $("empty-state");

  // ──────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    await loadData();
    bindEvents();
    initProjectSelector();
    initChat();
  });

  async function loadData() {
    try {
      const resp = await browser.runtime.sendMessage({ action: "getTrackerPages" });
      if (!resp?.success) return;
      allEntries = (resp.pages || []).filter(e => e.trawlData);
      computeScores(allEntries);
      applyFilters();
    } catch (e) {
      console.warn("[Trawl] load error:", e);
    }
  }

  // ──────────────────────────────────────────────
  // Engagement Scoring
  // ──────────────────────────────────────────────
  function computeScores(entries) {
    if (!entries.length) return;

    // Compute page depth per domain
    const depthMap = {};
    for (const e of entries) {
      const host = hostOf(e.url);
      depthMap[host] = (depthMap[host] || 0) + 1;
    }

    const maxDwell = Math.max(...entries.map(e => e.trawlData.dwellTimeMs || 0), 1);
    const maxVisits = Math.max(...entries.map(e => e.visits || 0), 1);
    const maxDepth = Math.max(...Object.values(depthMap), 1);

    for (const e of entries) {
      const td = e.trawlData;
      const dwell = (td.dwellTimeMs || 0) / maxDwell;
      const visits = (e.visits || 0) / maxVisits;
      const depth = (depthMap[hostOf(e.url)] || 0) / maxDepth;
      const scroll = td.scrollDepth || 0;
      const hasAction = (e.actions || []).some(a =>
        /bookmark|analyze|project|monitor|save/i.test(a.type)
      ) ? 1 : 0;

      const raw = dwell * 0.40 + visits * 0.20 + depth * 0.15 + scroll * 0.10 + hasAction * 0.15;
      e._score = Math.round(raw * 100);
    }
  }

  // ──────────────────────────────────────────────
  // Domain Clustering
  // ──────────────────────────────────────────────
  function clusterDomains(entries) {
    const map = {};
    for (const e of entries) {
      const host = hostOf(e.url);
      if (!map[host]) map[host] = { entries: [], score: 0, bestEntry: null, favicon: "" };
      map[host].entries.push(e);
      map[host].score += e._score || 0;
      if (!map[host].bestEntry || (e._score || 0) > (map[host].bestEntry._score || 0)) {
        map[host].bestEntry = e;
      }
      if (e.favicon && !map[host].favicon) map[host].favicon = e.favicon;
    }
    // Normalize cluster scores to 0-100
    const maxCluster = Math.max(...Object.values(map).map(c => c.score), 1);
    for (const c of Object.values(map)) {
      c.normalizedScore = Math.round((c.score / maxCluster) * 100);
    }
    return map;
  }

  // ──────────────────────────────────────────────
  // Filters
  // ──────────────────────────────────────────────
  function applyFilters() {
    let result = [...allEntries];

    // Date filter
    const from = dateFrom.value ? new Date(dateFrom.value).getTime() : 0;
    const to = dateTo.value ? new Date(dateTo.value + "T23:59:59").getTime() : Infinity;
    if (from || to < Infinity) {
      result = result.filter(e => {
        const t = e.lastVisit || e.firstVisit || 0;
        return t >= from && t <= to;
      });
    }

    // Search filter
    const raw = searchInput.value.trim();
    if (raw) {
      if (regexMode) {
        try {
          const re = new RegExp(raw, "i");
          result = result.filter(e => re.test(entrySearchText(e)));
          searchBar.classList.remove("search-error");
        } catch {
          searchBar.classList.add("search-error");
        }
      } else {
        const q = raw.toLowerCase();
        result = result.filter(e => entrySearchText(e).toLowerCase().includes(q));
        searchBar.classList.remove("search-error");
      }
    } else {
      searchBar.classList.remove("search-error");
    }

    filtered = result;
    domainClusters = clusterDomains(filtered);
    searchCount.textContent = filtered.length + " pages";
    updateStats();
    render();
  }

  function entrySearchText(e) {
    const td = e.trawlData;
    return [
      e.url, e.title,
      td.businessName,
      ...(td.emails || []),
      ...(td.phones || []),
      ...(td.addresses || []),
      ...(td.socialLinks || []),
      ...(td.contacts || []).map(c => c.name + " " + c.role + " " + c.email),
      td.meta?.siteName, td.meta?.description, td.meta?.author
    ].filter(Boolean).join(" ");
  }

  // ──────────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────────
  function updateStats() {
    $("stat-pages").textContent = filtered.length;
    const withData = filtered.filter(e => {
      const td = e.trawlData;
      return td.emails?.length || td.phones?.length || td.addresses?.length || td.businessName;
    }).length;
    $("stat-with-data").textContent = withData;
    $("stat-domains").textContent = Object.keys(domainClusters).length;
    const totalContacts = filtered.reduce((sum, e) => {
      const td = e.trawlData;
      return sum + (td.emails?.length || 0) + (td.phones?.length || 0) + (td.contacts?.length || 0);
    }, 0);
    $("stat-contacts").textContent = totalContacts;
    $("stat-top-score").textContent = filtered.length ? Math.max(...filtered.map(e => e._score || 0)) : 0;
  }

  // ──────────────────────────────────────────────
  // Render dispatcher
  // ──────────────────────────────────────────────
  function render() {
    if (!filtered.length) {
      emptyState.classList.remove("hidden");
      topCards.innerHTML = "";
      viewTable.innerHTML = "";
      viewTimeline.innerHTML = "";
      viewCloud.innerHTML = "";
      return;
    }
    emptyState.classList.add("hidden");
    renderTopCards();
    if (activeView === "table") renderTable();
    else if (activeView === "timeline") renderTimeline();
    else if (activeView === "cloud") renderCloud();
  }

  // ──────────────────────────────────────────────
  // Top-3 Cards
  // ──────────────────────────────────────────────
  function renderTopCards() {
    const sorted = Object.entries(domainClusters)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 3);

    topCards.innerHTML = sorted.map(([host, cluster]) => {
      const best = cluster.bestEntry;
      const td = best.trawlData;
      const biz = td.businessName || host;
      const favicon = cluster.favicon ? `<img class="top-card-favicon" src="${esc(cluster.favicon)}" onerror="this.style.display='none'">` : "";
      const emails = (td.emails || []).slice(0, 3).map(e => `<span class="top-card-chip email" title="Click to copy" data-copy="${esc(e)}">${esc(e)}</span>`).join("");
      const phones = (td.phones || []).slice(0, 3).map(p => `<span class="top-card-chip phone" title="Click to copy" data-copy="${esc(p)}">${esc(p)}</span>`).join("");
      const addrs = (td.addresses || []).slice(0, 2).map(a => `<span class="top-card-chip address" title="${esc(a)}">${esc(a.substring(0, 40))}</span>`).join("");
      const pct = cluster.normalizedScore;
      return `<div class="top-card">
        <div class="top-card-header">${favicon}<span class="top-card-domain">${esc(host)}</span></div>
        ${biz !== host ? `<div class="top-card-business">${esc(biz)}</div>` : ""}
        <div class="top-card-contacts">${emails}${phones}${addrs}</div>
        <div class="top-card-score">
          <div class="top-card-score-bar"><div class="top-card-score-fill" style="width:${pct}%"></div></div>
          <span class="top-card-score-val">${pct}</span>
        </div>
        <div class="top-card-actions">
          <button class="pill-chip" data-open="${esc(best.url)}" title="Open page">Open</button>
          <button class="pill-chip" data-analyze="${esc(best.url)}" title="Run full analysis">Analyze</button>
        </div>
      </div>`;
    }).join("");
  }

  // ──────────────────────────────────────────────
  // Table View
  // ──────────────────────────────────────────────
  function renderTable() {
    const sorted = [...filtered].sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case "domain": va = hostOf(a.url); vb = hostOf(b.url); break;
        case "business": va = a.trawlData.businessName || ""; vb = b.trawlData.businessName || ""; break;
        case "emails": va = (a.trawlData.emails || []).length; vb = (b.trawlData.emails || []).length; break;
        case "phones": va = (a.trawlData.phones || []).length; vb = (b.trawlData.phones || []).length; break;
        case "score": va = a._score || 0; vb = b._score || 0; break;
        case "visits": va = a.visits || 0; vb = b.visits || 0; break;
        case "dwell": va = a.trawlData.dwellTimeMs || 0; vb = b.trawlData.dwellTimeMs || 0; break;
        case "last": va = a.lastVisit || 0; vb = b.lastVisit || 0; break;
        default: va = a._score || 0; vb = b._score || 0;
      }
      if (typeof va === "string") { const c = va.localeCompare(vb); return sortAsc ? c : -c; }
      return sortAsc ? va - vb : vb - va;
    });

    const arrow = (col) => sortCol === col ? (sortAsc ? " ▲" : " ▼") : "";
    const cls = (col) => sortCol === col ? " sorted" : "";

    let html = `<div class="trawl-table-wrap"><table class="trawl-table">
      <thead><tr>
        <th class="${cls("domain")}" data-sort="domain">Domain${arrow("domain")}</th>
        <th class="${cls("business")}" data-sort="business">Business${arrow("business")}</th>
        <th class="${cls("emails")}" data-sort="emails">Emails${arrow("emails")}</th>
        <th class="${cls("phones")}" data-sort="phones">Phones${arrow("phones")}</th>
        <th class="${cls("score")}" data-sort="score">Score${arrow("score")}</th>
        <th class="${cls("visits")}" data-sort="visits">Visits${arrow("visits")}</th>
        <th class="${cls("dwell")}" data-sort="dwell">Dwell${arrow("dwell")}</th>
        <th class="${cls("last")}" data-sort="last">Last Visit${arrow("last")}</th>
      </tr></thead><tbody>`;

    for (const e of sorted) {
      const td = e.trawlData;
      const host = hostOf(e.url);
      const favicon = e.favicon ? `<img class="td-favicon" src="${esc(e.favicon)}" onerror="this.style.display='none'">` : "";
      const emailChips = (td.emails || []).slice(0, 3).map(em => `<span class="td-chip email" data-copy="${esc(em)}" title="${esc(em)}">${esc(em)}</span>`).join("");
      const extra = (td.emails || []).length > 3 ? `<span class="td-chip">+${(td.emails.length - 3)}</span>` : "";
      const phoneChips = (td.phones || []).slice(0, 2).map(p => `<span class="td-chip phone" data-copy="${esc(p)}" title="${esc(p)}">${esc(p)}</span>`).join("");
      html += `<tr>
        <td class="td-domain">${favicon}<a href="${esc(e.url)}" target="_blank" title="${esc(e.url)}">${esc(host)}</a></td>
        <td>${esc(td.businessName || "")}</td>
        <td><div class="td-chips">${emailChips}${extra}</div></td>
        <td><div class="td-chips">${phoneChips}</div></td>
        <td class="td-score">${e._score || 0}</td>
        <td class="td-visits">${e.visits || 0}</td>
        <td class="td-dwell">${formatDwell(td.dwellTimeMs)}</td>
        <td class="td-dwell">${formatDate(e.lastVisit)}</td>
      </tr>`;
    }
    html += "</tbody></table></div>";
    viewTable.innerHTML = html;

    // Sort click handlers
    viewTable.querySelectorAll("th[data-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (sortCol === col) sortAsc = !sortAsc;
        else { sortCol = col; sortAsc = false; }
        renderTable();
      });
    });
  }

  // ──────────────────────────────────────────────
  // Timeline View
  // ──────────────────────────────────────────────
  function renderTimeline() {
    const sorted = [...filtered].sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0));
    const maxDwell = Math.max(...sorted.map(e => e.trawlData.dwellTimeMs || 0), 1);

    let html = '<div class="tl-list">';
    for (const e of sorted) {
      const td = e.trawlData;
      const barPct = Math.max(3, Math.round(((td.dwellTimeMs || 0) / maxDwell) * 100));
      const chips = [
        ...(td.emails || []).slice(0, 3).map(em => `<span class="td-chip email" data-copy="${esc(em)}">${esc(em)}</span>`),
        ...(td.phones || []).slice(0, 2).map(p => `<span class="td-chip phone" data-copy="${esc(p)}">${esc(p)}</span>`)
      ].join("");
      const biz = td.businessName ? `<span style="color:var(--accent);font-size:10px;margin-left:6px">${esc(td.businessName)}</span>` : "";

      html += `<div class="tl-entry">
        <span class="tl-time">${formatTime(e.lastVisit)}</span>
        <div class="tl-bar-col"><div class="tl-bar" style="width:${barPct}%" title="${formatDwell(td.dwellTimeMs)} dwell time"></div></div>
        <div class="tl-content">
          <div class="tl-title"><a href="${esc(e.url)}" target="_blank">${esc(e.title || hostOf(e.url))}</a>${biz}</div>
          <div class="tl-url">${esc(e.url)}</div>
          ${chips ? `<div class="tl-data">${chips}</div>` : ""}
        </div>
        <span class="tl-score">${e._score || 0}</span>
      </div>`;
    }
    html += "</div>";
    viewTimeline.innerHTML = html;
  }

  // ──────────────────────────────────────────────
  // Cloud View
  // ──────────────────────────────────────────────
  function renderCloud() {
    const words = [];
    // Collect words: business names, emails, domains
    for (const e of filtered) {
      const td = e.trawlData;
      const score = e._score || 1;
      if (td.businessName) words.push({ text: td.businessName, score, type: "business" });
      for (const em of (td.emails || [])) words.push({ text: em, score: score * 0.7, type: "email" });
      for (const ph of (td.phones || [])) words.push({ text: ph, score: score * 0.5, type: "phone" });
    }
    // Also add domain clusters
    for (const [host, cluster] of Object.entries(domainClusters)) {
      if (!words.some(w => w.text === host)) {
        words.push({ text: host, score: cluster.normalizedScore, type: "domain" });
      }
    }

    // Deduplicate, keep highest score
    const seen = {};
    for (const w of words) {
      if (!seen[w.text] || seen[w.text].score < w.score) seen[w.text] = w;
    }
    const unique = Object.values(seen).sort((a, b) => b.score - a.score).slice(0, 80);
    if (!unique.length) { viewCloud.innerHTML = ""; return; }

    const maxScore = Math.max(...unique.map(w => w.score), 1);
    const W = 800, H = 400;
    const placed = [];
    const colors = { business: "#4a90d9", email: "#26a69a", phone: "#ff9800", domain: "#a0a0b0" };

    let svgContent = "";
    for (const w of unique) {
      const fontSize = 10 + (w.score / maxScore) * 32;
      const color = colors[w.type] || "#a0a0b0";
      const pos = findPosition(w.text, fontSize, placed, W, H);
      if (!pos) continue;
      placed.push(pos);
      svgContent += `<text class="cloud-word" x="${pos.x}" y="${pos.y}" font-size="${fontSize}" fill="${color}" data-copy="${esc(w.text)}" title="${esc(w.text)} (${w.type})">${esc(w.text)}</text>`;
    }

    viewCloud.innerHTML = `<div class="cloud-container"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg></div>`;
  }

  function findPosition(text, fontSize, placed, W, H) {
    const charW = fontSize * 0.55;
    const boxW = text.length * charW;
    const boxH = fontSize * 1.2;
    // Spiral placement from center
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 300; i++) {
      const angle = i * 0.5;
      const r = 4 + i * 1.5;
      const x = cx + r * Math.cos(angle) - boxW / 2;
      const y = cy + r * Math.sin(angle) + boxH / 3;
      if (x < 5 || x + boxW > W - 5 || y < boxH || y > H - 5) continue;
      const collides = placed.some(p =>
        x < p.x + p.w && x + boxW > p.x && y - boxH < p.y && y > p.y - p.h
      );
      if (!collides) return { x, y, w: boxW, h: boxH };
    }
    return null;
  }

  // ──────────────────────────────────────────────
  // Export CSV
  // ──────────────────────────────────────────────
  function exportCSV() {
    const rows = [["URL", "Domain", "Title", "Business", "Emails", "Phones", "Addresses", "Social Links", "Score", "Visits", "Dwell (s)", "Last Visit"]];
    for (const e of filtered) {
      const td = e.trawlData;
      rows.push([
        e.url, hostOf(e.url), e.title || "",
        td.businessName || "",
        (td.emails || []).join("; "),
        (td.phones || []).join("; "),
        (td.addresses || []).join("; "),
        (td.socialLinks || []).join("; "),
        String(e._score || 0),
        String(e.visits || 0),
        String(Math.round((td.dwellTimeMs || 0) / 1000)),
        e.lastVisit ? new Date(e.lastVisit).toISOString() : ""
      ]);
    }
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trawl-net-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Exported " + filtered.length + " entries to CSV");
  }

  // ──────────────────────────────────────────────
  // Copy helpers
  // ──────────────────────────────────────────────
  function copyAllEmails() {
    const emails = new Set();
    filtered.forEach(e => (e.trawlData.emails || []).forEach(em => emails.add(em)));
    if (!emails.size) return showToast("No emails found", "error");
    navigator.clipboard.writeText([...emails].join("\n"));
    showToast("Copied " + emails.size + " emails");
  }

  function copyAllPhones() {
    const phones = new Set();
    filtered.forEach(e => (e.trawlData.phones || []).forEach(p => phones.add(p)));
    if (!phones.size) return showToast("No phones found", "error");
    navigator.clipboard.writeText([...phones].join("\n"));
    showToast("Copied " + phones.size + " phone numbers");
  }

  // ──────────────────────────────────────────────
  // Events
  // ──────────────────────────────────────────────
  function bindEvents() {
    // Search
    searchInput.addEventListener("input", debounce(applyFilters, 200));
    searchMode.addEventListener("click", () => {
      regexMode = !regexMode;
      searchMode.classList.toggle("active", regexMode);
      searchInput.classList.toggle("trawl-search-mono", regexMode);
      searchInput.placeholder = regexMode ? "Regex pattern..." : "Search businesses, emails, phones, domains...";
      document.querySelectorAll(".trawl-search-slash").forEach(s => s.classList.toggle("hidden", !regexMode));
      applyFilters();
    });

    // Date filters
    $("date-today").addEventListener("click", () => setDateRange(0));
    $("date-week").addEventListener("click", () => setDateRange(7));
    $("date-all").addEventListener("click", () => { dateFrom.value = ""; dateTo.value = ""; applyFilters(); });
    dateFrom.addEventListener("change", applyFilters);
    dateTo.addEventListener("change", applyFilters);

    // View tabs
    document.querySelectorAll(".view-tabs .pill-chip[data-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".view-tabs .pill-chip[data-view]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeView = btn.dataset.view;
        viewTable.classList.toggle("hidden", activeView !== "table");
        viewTimeline.classList.toggle("hidden", activeView !== "timeline");
        viewCloud.classList.toggle("hidden", activeView !== "cloud");
        render();
      });
    });

    // Export
    $("export-csv").addEventListener("click", exportCSV);
    $("copy-emails").addEventListener("click", copyAllEmails);
    $("copy-phones").addEventListener("click", copyAllPhones);

    // Phase 3: GeoMap + Save as Project
    $("open-geomap").addEventListener("click", openGeoMap);
    $("save-as-project").addEventListener("click", saveAsProject);

    // Click-to-copy on chips
    document.addEventListener("click", (ev) => {
      const chip = ev.target.closest("[data-copy]");
      if (chip) {
        navigator.clipboard.writeText(chip.dataset.copy);
        showToast("Copied: " + chip.dataset.copy);
      }
      const openBtn = ev.target.closest("[data-open]");
      if (openBtn) browser.tabs.create({ url: openBtn.dataset.open });
      const analyzeBtn = ev.target.closest("[data-analyze]");
      if (analyzeBtn) {
        browser.tabs.create({ url: analyzeBtn.dataset.analyze }).then(tab => {
          // Optionally trigger analysis after page loads
        });
      }
    });
  }

  function setDateRange(days) {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(now - days * 86400000).toISOString().slice(0, 10);
    dateFrom.value = days === 0 ? to : from;
    dateTo.value = to;
    applyFilters();
  }

  // ──────────────────────────────────────────────
  // Project selector
  // ──────────────────────────────────────────────
  async function initProjectSelector() {
    try {
      const resp = await browser.runtime.sendMessage({ action: "getProjects" });
      const sel = $("project-select");
      if (!resp?.projects?.length || !sel) return;
      for (const p of resp.projects) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      }
    } catch {}
  }

  // ──────────────────────────────────────────────
  // Chat integration
  // ──────────────────────────────────────────────
  function initChat() {
    if (typeof ArgusChat === "undefined") return;
    try {
      ArgusChat.init({
        container: document.getElementById("argus-chat-container"),
        contextType: "Trawl Net Session",
        contextData: buildChatContext(),
        pageUrl: window.location.href,
        pageTitle: "Trawl Net Intelligence"
      });
    } catch (e) { console.warn("[Trawl] chat init:", e); }
  }

  function buildChatContext() {
    if (!filtered.length) return "No trawl data collected yet.";
    const top = Object.entries(domainClusters)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 10);
    let ctx = `Trawl session: ${filtered.length} pages, ${Object.keys(domainClusters).length} domains.\n\nTop domains by engagement:\n`;
    for (const [host, cluster] of top) {
      const best = cluster.bestEntry.trawlData;
      ctx += `- ${host} (score: ${cluster.normalizedScore})`;
      if (best.businessName) ctx += ` — ${best.businessName}`;
      if (best.emails?.length) ctx += ` | emails: ${best.emails.slice(0, 3).join(", ")}`;
      if (best.phones?.length) ctx += ` | phones: ${best.phones.slice(0, 2).join(", ")}`;
      ctx += "\n";
    }
    return ctx.slice(0, 4000);
  }

  // ──────────────────────────────────────────────
  // Phase 3: GeoMap from Trawl
  // ──────────────────────────────────────────────
  function openGeoMap() {
    // Count addresses + geo entries to give feedback
    let addrCount = 0;
    for (const e of filtered) {
      if (e.trawlData.geo) addrCount++;
      addrCount += (e.trawlData.addresses || []).length;
    }
    if (!addrCount) return showToast("No addresses or coordinates found in current results", "error");

    // Open geomap with trawl source flag — geomap.js will detect and pull trawl data
    const params = new URLSearchParams({ source: "trawl" });
    if (dateFrom.value) params.set("from", dateFrom.value);
    if (dateTo.value) params.set("to", dateTo.value);
    browser.tabs.create({ url: `../osint/geomap.html?${params}` });
    showToast(`Opening map with ${addrCount} locations`);
  }

  // ──────────────────────────────────────────────
  // Phase 3: Save Session as Project
  // ──────────────────────────────────────────────
  async function saveAsProject() {
    if (!filtered.length) return showToast("No trawl data to save", "error");

    const name = prompt("Project name:", `Trawl Session — ${new Date().toLocaleDateString()}`);
    if (!name) return;

    try {
      const msg = {
        action: "saveTrawlAsProject",
        name,
        from: dateFrom.value || undefined,
        to: dateTo.value || undefined,
      };
      const resp = await browser.runtime.sendMessage(msg);
      if (resp?.success) {
        showToast(`Saved as "${resp.project.name}" (${resp.project.itemCount} items)`);
        // Refresh project selector
        initProjectSelector();
      } else {
        showToast(resp?.error || "Failed to save", "error");
      }
    } catch (e) {
      showToast("Error saving project: " + e.message, "error");
    }
  }

  // ──────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }

  function esc(s) {
    if (!s) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function formatDwell(ms) {
    if (!ms) return "—";
    const s = Math.round(ms / 1000);
    if (s < 60) return s + "s";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m " + (s % 60) + "s";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  }

  function formatDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function formatTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function showToast(msg, type = "success") {
    let toast = document.getElementById("trawl-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "trawl-toast";
      toast.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;color:#fff;z-index:1000;transition:opacity 0.3s;";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = type === "error" ? "var(--error)" : "var(--success, #4caf50)";
    toast.style.opacity = "1";
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = "0"; }, 2500);
  }
})();
