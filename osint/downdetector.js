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

    card.textContent = "";

    // Status dot
    const dot = document.createElement("div");
    dot.className = `status-dot ${status}`;
    card.appendChild(dot);

    // Site info
    const infoDiv = document.createElement("div");
    infoDiv.className = "site-info";
    const domainDiv = document.createElement("div");
    domainDiv.className = "site-domain";
    domainDiv.textContent = domain;
    if (isSaved) {
      const badge = document.createElement("span");
      badge.className = "saved-badge";
      badge.textContent = "saved";
      domainDiv.appendChild(badge);
    }
    infoDiv.appendChild(domainDiv);
    const urlDiv = document.createElement("div");
    urlDiv.className = "site-url";
    urlDiv.textContent = url;
    infoDiv.appendChild(urlDiv);
    if (result?.error) {
      const errP = document.createElement("p");
      errP.className = "error-text";
      errP.textContent = result.error;
      infoDiv.appendChild(errP);
    }
    card.appendChild(infoDiv);

    // Meta
    const metaDiv = document.createElement("div");
    metaDiv.className = "site-meta";
    if (result?.responseTime != null) {
      const rtDiv = document.createElement("div");
      rtDiv.className = "meta-item";
      const rtVal = document.createElement("span");
      rtVal.className = `meta-value ${result.responseTime < 1000 ? "fast" : result.responseTime < 3000 ? "medium" : "slow"}`;
      rtVal.textContent = result.responseTime + "ms";
      const rtLabel = document.createElement("span");
      rtLabel.className = "meta-label";
      rtLabel.textContent = "Response";
      rtDiv.appendChild(rtVal);
      rtDiv.appendChild(rtLabel);
      metaDiv.appendChild(rtDiv);
    }
    if (result?.httpStatus) {
      const httpDiv = document.createElement("div");
      httpDiv.className = "meta-item";
      const httpVal = document.createElement("span");
      httpVal.className = "meta-value";
      httpVal.textContent = result.httpStatus;
      const httpLabel = document.createElement("span");
      httpLabel.className = "meta-label";
      httpLabel.textContent = "HTTP";
      httpDiv.appendChild(httpVal);
      httpDiv.appendChild(httpLabel);
      metaDiv.appendChild(httpDiv);
    }
    if (result?.isOpaque) {
      const oDiv = document.createElement("div");
      oDiv.className = "meta-item";
      const oLabel = document.createElement("span");
      oLabel.className = "meta-label";
      oLabel.title = "CORS blocked details — status inferred from reachability";
      oLabel.textContent = "opaque";
      oDiv.appendChild(oLabel);
      metaDiv.appendChild(oDiv);
    }
    const statusSpan = document.createElement("span");
    statusSpan.className = `status-label ${status}`;
    statusSpan.textContent = statusText(status);
    metaDiv.appendChild(statusSpan);
    card.appendChild(metaDiv);

    // Actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "site-actions";
    const recheckBtn = document.createElement("button");
    recheckBtn.className = "btn btn-danger";
    recheckBtn.dataset.action = "recheck";
    recheckBtn.dataset.url = key;
    recheckBtn.title = "Re-check this site";
    recheckBtn.textContent = "Recheck";
    actionsDiv.appendChild(recheckBtn);
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-danger";
    toggleBtn.dataset.action = isSaved ? "remove" : "save";
    toggleBtn.dataset.url = key;
    toggleBtn.title = isSaved ? "Remove from watchlist" : "Add to watchlist";
    toggleBtn.textContent = isSaved ? "Remove" : "+ Save";
    actionsDiv.appendChild(toggleBtn);
    card.appendChild(actionsDiv);
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

  init();
})();
