(function () {
  "use strict";

  const urlInput = document.getElementById("url-input");
  const checkBtn = document.getElementById("check-btn");
  const addBtn = document.getElementById("add-btn");
  const checkAllBtn = document.getElementById("check-all-btn");
  const resultsGrid = document.getElementById("results-grid");
  const emptyState = document.getElementById("empty-state");
  const lastCheckedEl = document.getElementById("last-checked");
  const statUp = document.getElementById("stat-up");
  const statSlow = document.getElementById("stat-slow");
  const statDown = document.getElementById("stat-down");
  const statTotal = document.getElementById("stat-total");

  let savedUrls = [];     // Persisted watchlist
  let results = new Map(); // domain/url -> latest result

  // ── Init ──
  async function init() {
    // Load saved watchlist
    const resp = await browser.runtime.sendMessage({ action: "pulseListGet" });
    if (resp?.success && resp.urls?.length) {
      savedUrls = resp.urls;
    }

    // Check if opened with a domain param
    const params = new URLSearchParams(location.search);
    const domain = params.get("domain");

    if (domain) {
      urlInput.value = domain;
    }

    // Render saved URLs as cards (unchecked)
    if (savedUrls.length) {
      emptyState.style.display = "none";
      for (const url of savedUrls) {
        renderCard(url, null, true);
      }
    }

    // If opened with a domain, auto-check it plus the whole list
    if (domain) {
      const allUrls = [domain, ...savedUrls.filter(u => u !== domain)];
      runChecks(allUrls);
    }
  }

  // ── Run checks ──
  async function runChecks(urls) {
    if (!urls.length) return;

    checkBtn.disabled = true;
    checkAllBtn.disabled = true;
    emptyState.style.display = "none";

    // Show checking state for each
    for (const url of urls) {
      const normalized = normalizeUrl(url);
      const domain = getDomain(normalized);
      renderCard(url, { status: "checking", domain, url: normalized }, savedUrls.includes(url));
    }

    try {
      const resp = await browser.runtime.sendMessage({ action: "pulseCheck", urls });
      if (resp?.success) {
        for (const r of resp.results) {
          results.set(r.url, r);
          const isSaved = savedUrls.some(u => normalizeUrl(u) === r.url);
          renderCard(r.domain || r.url, r, isSaved);
        }
        updateStats();
        lastCheckedEl.textContent = `Last checked: ${new Date().toLocaleTimeString()}`;
      }
    } catch (err) {
      console.error("[Pulse] Check failed:", err);
    }

    checkBtn.disabled = false;
    checkAllBtn.disabled = false;
  }

  function normalizeUrl(url) {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u;
  }

  function getDomain(url) {
    try { return new URL(url).hostname; } catch { return url; }
  }

  // ── Render a card ──
  function renderCard(key, result, isSaved) {
    const cardId = `card-${(result?.domain || getDomain(normalizeUrl(key))).replace(/[^a-z0-9]/gi, "-")}`;
    let card = document.getElementById(cardId);

    const status = result?.status || "unknown";
    const domain = result?.domain || getDomain(normalizeUrl(key));
    const url = result?.url || normalizeUrl(key);

    if (!card) {
      card = document.createElement("div");
      card.className = "site-card";
      card.id = cardId;
      resultsGrid.appendChild(card);
    }

    card.className = `site-card${status === "checking" ? " checking" : ""}`;

    const responseTimeHtml = result?.responseTime != null
      ? `<div class="meta-item">
           <span class="meta-value ${result.responseTime < 1000 ? "fast" : result.responseTime < 3000 ? "medium" : "slow"}">${result.responseTime}ms</span>
           <span class="meta-label">Response</span>
         </div>` : "";

    const httpStatusHtml = result?.httpStatus
      ? `<div class="meta-item">
           <span class="meta-value">${result.httpStatus}</span>
           <span class="meta-label">HTTP</span>
         </div>` : "";

    const opaqueNote = result?.isOpaque
      ? `<div class="meta-item"><span class="meta-label" title="CORS blocked details — status inferred from reachability">opaque</span></div>` : "";

    const errorHtml = result?.error
      ? `<p class="error-text">${escapeHtml(result.error)}</p>` : "";

    const savedBadge = isSaved ? `<span class="saved-badge">saved</span>` : "";

    const removeBtn = isSaved
      ? `<button class="btn btn-danger" data-action="remove" data-url="${escapeAttr(key)}" title="Remove from watchlist">Remove</button>`
      : `<button class="btn btn-danger" data-action="save" data-url="${escapeAttr(key)}" title="Add to watchlist">+ Save</button>`;

    const recheckBtn = `<button class="btn btn-danger" data-action="recheck" data-url="${escapeAttr(key)}" title="Re-check this site">Recheck</button>`;

    card.innerHTML = `
      <div class="status-dot ${status}"></div>
      <div class="site-info">
        <div class="site-domain">${escapeHtml(domain)}${savedBadge}</div>
        <div class="site-url">${escapeHtml(url)}</div>
        ${errorHtml}
      </div>
      <div class="site-meta">
        ${responseTimeHtml}
        ${httpStatusHtml}
        ${opaqueNote}
        <span class="status-label ${status}">${statusText(status)}</span>
      </div>
      <div class="site-actions">
        ${recheckBtn}
        ${removeBtn}
      </div>
    `;
  }

  function statusText(s) {
    const map = { up: "UP", down: "DOWN", slow: "SLOW", timeout: "TIMEOUT", degraded: "DEGRADED", checking: "...", unknown: "N/A", invalid: "INVALID" };
    return map[s] || s.toUpperCase();
  }

  function updateStats() {
    let up = 0, slow = 0, down = 0;
    for (const r of results.values()) {
      if (r.status === "up") up++;
      else if (r.status === "slow") slow++;
      else if (r.status === "down" || r.status === "timeout") down++;
    }
    statUp.textContent = up;
    statSlow.textContent = slow;
    statDown.textContent = down;
    statTotal.textContent = results.size;
  }

  // ── Save / remove from watchlist ──
  async function saveUrl(url) {
    const clean = url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (!clean) return;
    if (!savedUrls.includes(clean)) {
      savedUrls.push(clean);
      await browser.runtime.sendMessage({ action: "pulseListSave", urls: savedUrls });
    }
    // Re-render the card with saved badge
    const normalized = normalizeUrl(clean);
    const existing = results.get(normalized);
    renderCard(clean, existing || null, true);
  }

  async function removeUrl(url) {
    savedUrls = savedUrls.filter(u => u !== url);
    await browser.runtime.sendMessage({ action: "pulseListSave", urls: savedUrls });
    // Remove card if no result, otherwise re-render without saved badge
    const normalized = normalizeUrl(url);
    const existing = results.get(normalized);
    const cardId = `card-${getDomain(normalized).replace(/[^a-z0-9]/gi, "-")}`;
    const card = document.getElementById(cardId);
    if (card && !existing) {
      card.remove();
      if (!resultsGrid.querySelector(".site-card")) emptyState.style.display = "";
    } else if (card) {
      renderCard(url, existing, false);
    }
  }

  // ── Event handlers ──
  function handleCheck() {
    const val = urlInput.value.trim();
    if (!val) return;
    runChecks([val]);
  }

  function handleAdd() {
    const val = urlInput.value.trim();
    if (!val) return;
    saveUrl(val);
    urlInput.value = "";
  }

  function handleCheckAll() {
    const inputVal = urlInput.value.trim();
    const urls = [...savedUrls];
    if (inputVal && !urls.includes(inputVal)) urls.unshift(inputVal);
    if (urls.length) runChecks(urls);
  }

  checkBtn.addEventListener("click", handleCheck);
  addBtn.addEventListener("click", handleAdd);
  checkAllBtn.addEventListener("click", handleCheckAll);
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleCheck();
  });

  // Delegated click handler for card buttons
  resultsGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const url = btn.dataset.url;
    if (action === "remove") removeUrl(url);
    else if (action === "save") saveUrl(url);
    else if (action === "recheck") runChecks([url]);
  });

  // ── Helpers ──
  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  init();
})();
