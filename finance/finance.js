(function () {
  "use strict";

  const STORAGE_KEY = "financeMonitor";

  // ── State ──
  let state = {
    watchlist: [],   // { id, type, symbol, name, pinned, price, change, changePct, volume }
    wallets: [],     // { id, chain, address, label, balance, usdValue }
    alerts: [],      // { id, symbol, condition, threshold, enabled, triggered, triggeredAt }
    pinned: [],      // IDs of items pinned to ticker tape
  };
  let corpState = { cik: null, companyName: "", filings: [], officers: [] };
  let chainState = { address: "", chain: "btc", balance: null, txs: [] };

  // ── Provider labels ──
  const _providerLabels = {
    secedgar: "SEC EDGAR", opencorporates: "OpenCorporates", gleif: "GLEIF",
    usaspending: "USAspending", fdic: "FDIC", secenforcement: "SEC Enforcement",
    osha: "OSHA", epaecho: "EPA ECHO", fec: "FEC",
    openpayments: "OpenPayments", propublica990: "ProPublica 990",
    dol: "DOL (MSHA)",
  };
  const _providerBadgeClass = {
    secedgar: "sec", opencorporates: "corp", gleif: "gleif",
    usaspending: "govt", fdic: "govt", secenforcement: "enforce",
    osha: "enforce", epaecho: "enforce", fec: "fec",
    openpayments: "health", propublica990: "nonprofit",
    dol: "enforce",
  };

  // ── Persistence ──
  async function loadState() {
    try {
      const { [STORAGE_KEY]: saved } = await browser.storage.local.get({ [STORAGE_KEY]: null });
      if (saved) state = { ...state, ...saved };
    } catch { /* first load */ }
  }

  async function saveState() {
    await browser.storage.local.set({ [STORAGE_KEY]: state });
  }

  // ══════════════════════════════════════
  // UNIFIED SEARCH
  // ══════════════════════════════════════

  document.getElementById("finSearchBtn").addEventListener("click", () => unifiedSearch());
  document.getElementById("finSearchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") unifiedSearch();
  });

  // Provider pill toggles
  document.getElementById("finProviderPills")?.addEventListener("click", function (e) {
    var pill = e.target.closest(".fin-provider-pill");
    if (!pill) return;
    pill.classList.toggle("active");
  });

  async function unifiedSearch() {
    var query = document.getElementById("finSearchInput").value.trim();
    if (!query) return;

    var activePills = document.querySelectorAll(".fin-provider-pill.active");
    var providers = [];
    activePills.forEach(function (p) { providers.push(p.dataset.provider); });
    if (!providers.length) {
      renderError("No providers selected — click the provider pills to enable them.");
      return;
    }

    var btn = document.getElementById("finSearchBtn");
    btn.disabled = true;
    btn.textContent = "Searching...";
    document.getElementById("finSearchStatus").textContent = "";

    var container = document.getElementById("finResults");
    var empty = document.getElementById("finEmpty");
    var countEl = document.getElementById("finResultsCount");
    var sourceEl = document.getElementById("finResultsSource");
    var filterEl = document.getElementById("finResultsFilter");

    // Clear previous results
    container.querySelectorAll(".fin-result-card, .fin-error, .fin-multi-header").forEach(function (el) { el.remove(); });
    empty.style.display = "none";
    sourceEl.textContent = "searching " + providers.length + " provider" + (providers.length !== 1 ? "s" : "") + "...";
    countEl.textContent = "";
    filterEl.style.display = "";
    filterEl.value = "";

    var totalResults = 0;
    var completedProviders = [];

    // Fan out all searches in parallel
    var promises = providers.map(function (prov) {
      return searchProvider(query, prov).then(function (data) {
        return { provider: prov, data: data, error: null };
      }).catch(function (e) {
        return { provider: prov, data: null, error: e.message };
      });
    });

    var results = await Promise.all(promises);

    // Render each provider's results
    results.forEach(function (r) {
      var provLabel = _providerLabels[r.provider] || r.provider;
      if (r.error) {
        var isKeyError = r.error.includes("API key") || r.error.includes("not configured") || r.error.includes("not implemented");
        if (!isKeyError) {
          container.insertAdjacentHTML("beforeend",
            '<div class="fin-error" data-provider="' + r.provider + '">' + escapeHtml(provLabel) + ': ' + escapeHtml(r.error) + '</div>');
        } else {
          container.insertAdjacentHTML("beforeend",
            '<div class="fin-error" style="opacity:0.6;" data-provider="' + r.provider + '">' + escapeHtml(provLabel) + ': Not yet wired — coming soon.</div>');
        }
        return;
      }
      if (!r.data || !r.data.results || !r.data.results.length) return;

      completedProviders.push(r.provider);
      var count = r.data.results.length;
      totalResults += count;

      // Section header
      container.insertAdjacentHTML("beforeend",
        '<div class="fin-multi-header" data-provider="' + r.provider + '">' + escapeHtml(provLabel) + ' — ' + count + ' result' + (count !== 1 ? 's' : '') + '</div>');

      // Render cards
      var cards = r.data.results.map(function (item, i) {
        return renderResultCard(item, i, r.provider);
      }).join("");
      container.insertAdjacentHTML("beforeend", cards);
      wireCardActions(container, r.provider);
    });

    // Update badges
    countEl.textContent = totalResults + " result" + (totalResults !== 1 ? "s" : "");
    sourceEl.textContent = "via " + completedProviders.length + " provider" + (completedProviders.length !== 1 ? "s" : "");
    document.getElementById("finResultCount").textContent = totalResults;
    document.getElementById("finProviderCount").textContent = completedProviders.length;

    if (totalResults === 0) {
      empty.style.display = "";
      empty.textContent = "No matches found across " + providers.length + " providers.";
    }

    btn.disabled = false;
    btn.textContent = "Search";
    refreshChatContext();
  }

  // ── Results filter ──
  document.getElementById("finResultsFilter")?.addEventListener("input", function () {
    var q = this.value.toLowerCase();
    document.querySelectorAll(".fin-result-card").forEach(function (card) {
      card.style.display = card.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });

  // ══════════════════════════════════════
  // PROVIDER SEARCH DISPATCH
  // ══════════════════════════════════════

  async function searchProvider(query, provider) {
    if (provider === "secedgar") return await searchSECEdgar(query);
    if (provider === "opencorporates") return await searchOpenCorporates(query);
    if (provider === "gleif") return await searchGLEIF(query);
    if (provider === "fdic") return await searchFDIC(query);
    if (provider === "usaspending") return await searchUSAspending(query);
    if (provider === "dol") return await searchDOL(query);

    // Stub providers — will be wired as we add them
    throw new Error("not implemented");
  }

  // ── SEC EDGAR ──
  async function searchSECEdgar(query) {
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "secedgar", query: query, options: {}
    });
    if (!resp?.success) throw new Error(resp?.error || "SEC EDGAR search failed");
    var hits = resp.results?.hits?.hits || [];
    // Deduplicate by CIK — search-index returns filings, not companies
    var seen = {};
    var companies = [];
    hits.forEach(function (h) {
      var src = h._source || {};
      var cik = (src.ciks || [])[0] || "";
      if (!cik || seen[cik]) return;
      seen[cik] = true;
      var displayName = (src.display_names || [])[0] || query;
      // Strip CIK suffix from display name e.g. "Alpha Natural Resources, Inc.  (CIK 0001301063)"
      var name = displayName.replace(/\s*\(CIK\s+\d+\)\s*$/, "").replace(/\s*\(\w+\)\s*$/, "").trim();
      companies.push({
        name: name || query,
        type: "Company",
        cik: cik,
        filings: (src.file_num || []).join(", "),
        sic: (src.sics || [])[0] || "",
        state: (src.biz_states || [])[0] || "",
        location: (src.biz_locations || [])[0] || "",
        sourceUrl: cik ? "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=" + cik + "&type=&dateb=&owner=include&count=40" : "",
        raw: h,
      });
    });
    return { total: companies.length, results: companies };
  }

  // ── OpenCorporates ──
  async function searchOpenCorporates(query) {
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "opencorporates", query: query, options: {}
    });
    if (!resp?.success) throw new Error(resp?.error || "OpenCorporates search failed");
    var companies = resp.results?.results?.companies || [];
    return {
      total: companies.length,
      results: companies.map(function (c) {
        var co = c.company || c;
        return {
          name: co.name || "Unknown",
          type: "Company",
          jurisdiction: co.jurisdiction_code || "",
          companyNumber: co.company_number || "",
          incorporationDate: co.incorporation_date || "",
          status: co.current_status || "",
          registeredAddress: co.registered_address_in_full || "",
          sourceUrl: co.opencorporates_url || "",
          raw: co,
        };
      })
    };
  }

  // ── GLEIF ──
  async function searchGLEIF(query) {
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "gleif", query: query, options: {}
    });
    if (!resp?.success) throw new Error(resp?.error || "GLEIF search failed");
    var records = resp.results?.data || [];
    return {
      total: records.length,
      results: records.map(function (r) {
        var attr = r.attributes || {};
        var entity = attr.entity || {};
        var lei = attr.lei || r.id || "";
        var legalName = entity.legalName?.name || "";
        var hq = entity.headquartersAddress || {};
        var hqStr = [hq.addressLines, hq.city, hq.region, hq.country].flat().filter(Boolean).join(", ");
        return {
          name: legalName || lei,
          type: "LEI Entity",
          lei: lei,
          status: entity.status || attr.registration?.status || "",
          headquarters: hqStr,
          category: entity.category || "",
          sourceUrl: "https://search.gleif.org/#/record/" + lei,
          raw: r,
        };
      })
    };
  }

  // ── FDIC BankFind ──
  async function searchFDIC(query) {
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "fdic", query: query, options: { limit: 25 }
    });
    if (!resp?.success) throw new Error(resp?.error || "FDIC search failed");
    var results = resp.results?.results || [];
    return {
      total: resp.results?.total || results.length,
      results: results.map(function (r) {
        var assets = r.ASSET ? "$" + (r.ASSET / 1000).toLocaleString("en") + "K" : "";
        var deposits = r.DEP ? "$" + (r.DEP / 1000).toLocaleString("en") + "K" : "";
        return {
          name: r.NAME || "Unknown",
          type: r.ACTIVE === 1 ? "Active Bank" : "Inactive",
          cert: r.CERT || "",
          city: r.CITY || "",
          state: r.STNAME || "",
          stateCode: r.STALP || "",
          zip: r.ZIP || "",
          address: r.ADDRESS || "",
          assets: assets,
          assetsRaw: r.ASSET,
          deposits: deposits,
          depositsRaw: r.DEP,
          charterClass: r.CHARTER_CLASS || "",
          website: r.WEBADDR || "",
          lat: r.LATITUDE,
          lon: r.LONGITUDE,
          sourceUrl: r.CERT ? "https://www.fdic.gov/resources/resolutions/bank-failures/failed-bank-list/banksearch.html?cert=" + r.CERT : "",
          raw: r,
        };
      })
    };
  }

  // ── USAspending ──
  async function searchUSAspending(query) {
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "usaspending", query: query, options: { limit: 25 }
    });
    if (!resp?.success) throw new Error(resp?.error || "USAspending search failed");
    var results = resp.results?.results || [];
    return {
      total: resp.results?.total || results.length,
      results: results.map(function (r) {
        var amount = r["Award Amount"];
        var amountStr = amount ? "$" + Number(amount).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
        return {
          name: r["Recipient Name"] || "Unknown",
          type: r["Award Type"] || "Contract",
          awardId: r["Award ID"] || "",
          amount: amountStr,
          amountRaw: amount,
          startDate: r["Start Date"] || "",
          endDate: r["End Date"] || "",
          agency: r["Awarding Agency"] || "",
          subAgency: r["Awarding Sub Agency"] || "",
          description: r["Description"] || "",
          sourceUrl: r.generated_internal_id ? "https://www.usaspending.gov/award/" + r.generated_internal_id : "",
          raw: r,
        };
      })
    };
  }

  // ── DOL (MSHA) ──
  async function searchDOL(query) {
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "dol", query: query, options: { limit: 25 }
    });
    if (!resp?.success) throw new Error(resp?.error || "DOL search failed");
    var results = resp.results?.results || [];
    return {
      total: resp.results?.total || results.length,
      results: results.map(function (r) {
        var dataset = r._dolDataset || "mines";
        if (dataset === "mines") {
          return {
            name: r.mine_name || r.MINE_NAME || "Unknown Mine",
            type: "Mine",
            operator: r.operator_name || r.OPERATOR_NAME || "",
            city: r.city || r.CITY || "",
            state: r.state || r.STATE || "",
            mineId: r.mine_id || r.MINE_ID || "",
            mineType: r.mine_type || r.MINE_TYPE || "",
            status: r.mine_status || r.MINE_STATUS || "",
            sourceUrl: r.mine_id ? "https://www.msha.gov/mine-data-retrieval-system?mineId=" + (r.mine_id || r.MINE_ID) : "",
            raw: r,
          };
        } else {
          return {
            name: r.mine_name || r.MINE_NAME || "Unknown Mine",
            type: "Accident",
            date: r.accident_date || r.ACCIDENT_DATE || r.cal_yr || "",
            injuryType: r.degree_injury || r.DEGREE_INJURY || "",
            classification: r.classification || r.CLASSIFICATION || "",
            mineId: r.mine_id || r.MINE_ID || "",
            occupation: r.occupation || r.OCCUPATION || "",
            sourceUrl: "",
            raw: r,
          };
        }
      })
    };
  }

  // ══════════════════════════════════════
  // RESULT CARD RENDERING
  // ══════════════════════════════════════

  function renderResultCard(item, idx, provider) {
    var badgeClass = _providerBadgeClass[provider] || "";
    var badgeLabel = _providerLabels[provider] || provider;
    var details = [];

    if (provider === "secedgar") {
      if (item.cik) details.push("CIK: " + escapeHtml(item.cik));
      if (item.sic) details.push("SIC: " + escapeHtml(item.sic));
      if (item.location) details.push(escapeHtml(item.location));
      else if (item.state) details.push("State: " + escapeHtml(item.state));
    } else if (provider === "opencorporates") {
      if (item.jurisdiction) details.push("Jurisdiction: " + escapeHtml(item.jurisdiction));
      if (item.companyNumber) details.push("#" + escapeHtml(item.companyNumber));
      if (item.incorporationDate) details.push("Inc: " + escapeHtml(item.incorporationDate));
      if (item.status) details.push("Status: " + escapeHtml(item.status));
    } else if (provider === "gleif") {
      if (item.lei) details.push("LEI: " + escapeHtml(item.lei));
      if (item.status) details.push("Status: " + escapeHtml(item.status));
      if (item.headquarters) details.push(escapeHtml(item.headquarters));
    } else if (provider === "fdic") {
      if (item.cert) details.push("CERT: " + escapeHtml(String(item.cert)));
      if (item.assets) details.push("Assets: " + escapeHtml(item.assets));
      if (item.deposits) details.push("Deposits: " + escapeHtml(item.deposits));
      if (item.city && item.stateCode) details.push(escapeHtml(item.city + ", " + item.stateCode + " " + item.zip));
      if (item.charterClass) details.push("Charter: " + escapeHtml(item.charterClass));
    } else if (provider === "usaspending") {
      if (item.awardId) details.push("Award: " + escapeHtml(item.awardId));
      if (item.amount) details.push(escapeHtml(item.amount));
      if (item.agency) details.push(escapeHtml(item.agency));
      if (item.startDate) details.push(escapeHtml(item.startDate) + (item.endDate ? " → " + escapeHtml(item.endDate) : ""));
    } else if (provider === "dol") {
      if (item.mineId) details.push("Mine ID: " + escapeHtml(String(item.mineId)));
      if (item.operator) details.push("Operator: " + escapeHtml(item.operator));
      if (item.mineType) details.push(escapeHtml(item.mineType));
      if (item.status) details.push("Status: " + escapeHtml(item.status));
      if (item.city && item.state) details.push(escapeHtml(item.city + ", " + item.state));
      if (item.date) details.push("Date: " + escapeHtml(item.date));
      if (item.injuryType) details.push("Injury: " + escapeHtml(item.injuryType));
      if (item.classification) details.push(escapeHtml(item.classification));
    }

    return '<div class="fin-result-card" data-idx="' + idx + '" data-provider="' + provider + '">' +
      '<div class="fin-result-header">' +
        '<span class="fin-result-badge ' + badgeClass + '">' + escapeHtml(badgeLabel) + '</span>' +
        '<span class="fin-result-name">' + escapeHtml(item.name) + '</span>' +
        '<span class="fin-result-schema">' + escapeHtml(item.type || "") + '</span>' +
      '</div>' +
      (details.length ? '<div class="fin-result-details">' + details.map(function (d) { return '<span class="fin-result-detail">' + d + '</span>'; }).join("") + '</div>' : '') +
      (item.registeredAddress ? '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(item.registeredAddress) + '</div>' : '') +
      (item.address && provider === "fdic" && item.website ? '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(item.address) + (item.website ? ' · <a href="http://' + escapeHtml(item.website) + '" target="_blank" rel="noopener" style="color:var(--accent);">' + escapeHtml(item.website) + '</a>' : '') + '</div>' : '') +
      (item.description && provider === "usaspending" ? '<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">' + escapeHtml(item.description.substring(0, 200)) + (item.description.length > 200 ? "..." : "") + '</div>' : '') +
      '<div class="fin-result-actions">' +
        '<button class="pill-chip fin-add-kg" data-idx="' + idx + '">+ KG</button>' +
        '<button class="pill-chip fin-add-asset" data-idx="' + idx + '">+ Asset</button>' +
        (item.sourceUrl ? '<a class="pill-chip" href="' + escapeHtml(item.sourceUrl) + '" target="_blank" rel="noopener">View &#8599;</a>' : '') +
      '</div>' +
    '</div>';
  }

  function wireCardActions(container, provider) {
    // + KG
    container.querySelectorAll(".fin-add-kg").forEach(function (btn) {
      if (btn.dataset.wired) return;
      btn.dataset.wired = "1";
      var card = btn.closest(".fin-result-card");
      if (!card) return;
      var cardName = card.querySelector(".fin-result-name")?.textContent.trim() || "Unknown";
      var viewLink = card.querySelector("a[target='_blank']");
      var sourceUrl = viewLink ? viewLink.href : "";

      btn.addEventListener("click", function () {
        var self = this;
        browser.runtime.sendMessage({
          action: "extractAndUpsert", text: cardName,
          pageUrl: sourceUrl || (provider + ":" + cardName),
          pageTitle: (_providerLabels[provider] || provider) + " — " + cardName
        }).then(function () {
          self.textContent = "Added!";
          setTimeout(function () { self.textContent = "+ KG"; }, 2000);
        });
      });
    });

    // + Asset
    container.querySelectorAll(".fin-add-asset").forEach(function (btn) {
      if (btn.dataset.wired) return;
      btn.dataset.wired = "1";
      var card = btn.closest(".fin-result-card");
      if (!card) return;
      var cardName = card.querySelector(".fin-result-name")?.textContent.trim() || "Unknown";
      var detailsEl = card.querySelector(".fin-result-details");
      var cardDesc = detailsEl ? detailsEl.textContent.trim() : "";
      var badgeEl = card.querySelector(".fin-result-badge");
      var cardBadge = badgeEl ? badgeEl.textContent.trim() : "";
      var viewLink = card.querySelector("a[target='_blank']");
      var sourceUrl = viewLink ? viewLink.href : "";

      btn.addEventListener("click", function () {
        if (typeof AssetLibrary === "undefined") return;

        // Determine natural type from provider
        var naturalType = "organization";
        if (provider === "fec") naturalType = "person";
        if (provider === "openpayments") naturalType = "person";

        var category = "finance";
        if (provider === "osha" || provider === "epaecho") category = "enforcement";
        if (provider === "fec") category = "political";
        if (provider === "usaspending") category = "government";
        if (provider === "propublica990") category = "nonprofit";

        var query = document.getElementById("finSearchInput").value.trim();

        AssetLibrary.add({
          type: naturalType,
          title: cardName,
          description: cardDesc,
          metadata: {
            provider: provider,
            category: category,
            searchQuery: query,
            badge: cardBadge,
            pageUrl: sourceUrl,
          },
          sourcePage: "finance",
        });

        var alPanel = document.getElementById("assetLibPanel");
        if (alPanel && alPanel.classList.contains("hidden")) alPanel.classList.remove("hidden");
        this.textContent = "Saved!";
        var self = this;
        setTimeout(function () { self.textContent = "+ Asset"; }, 2000);
      });
    });
  }

  function renderError(msg) {
    var container = document.getElementById("finResults");
    var empty = document.getElementById("finEmpty");
    container.querySelectorAll(".fin-result-card, .fin-error").forEach(function (el) { el.remove(); });
    empty.style.display = "none";
    container.insertAdjacentHTML("beforeend", '<div class="fin-error">' + escapeHtml(msg) + '</div>');
  }

  // ══════════════════════════════════════
  // FLOATING PANELS
  // ══════════════════════════════════════

  // Panel toggle helper
  function setupPanelToggle(toggleId, panelId, closeId) {
    var toggle = document.getElementById(toggleId);
    var panel = document.getElementById(panelId);
    var close = document.getElementById(closeId);
    if (!toggle || !panel) return;

    toggle.addEventListener("click", function () {
      panel.classList.toggle("hidden");
      if (!panel.classList.contains("hidden") && typeof FloatingPanel !== "undefined") {
        FloatingPanel.init(panel, "finance");
      }
    });
    if (close) close.addEventListener("click", function () { panel.classList.add("hidden"); });
  }

  setupPanelToggle("finMarketsToggle", "finMarketsPanel", "finMarketsClose");
  setupPanelToggle("finCorporateToggle", "finCorporatePanel", "finCorporateClose");
  setupPanelToggle("finBlockchainToggle", "finBlockchainPanel", "finBlockchainClose");

  // ── Markets Panel Sub-tabs ──
  document.querySelectorAll(".fp-sub-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = tab.dataset.fpSub;
      document.querySelectorAll(".fp-sub-tab").forEach(function (t) { t.classList.toggle("active", t.dataset.fpSub === target); });
      document.querySelectorAll(".fp-sub-pane").forEach(function (p) { p.classList.toggle("active", p.dataset.fpPane === target); });
    });
  });

  // ── Side Dock (compliance pattern) ──
  var _finDockOpen = false;
  var _finDockPanelIds = ['assetLibPanel', 'finMarketsPanel', 'finCorporatePanel', 'finBlockchainPanel'];
  var _finDockParents = {};
  var _finDockedPanels = {};
  var _finActiveDockTab = 'finMarketsPanel';

  document.getElementById("finDockToggle")?.addEventListener("click", function () {
    if (_finDockOpen) _finCloseDock();
    else _finOpenDock();
    this.classList.toggle("active", _finDockOpen);
  });
  document.getElementById("finDockClose")?.addEventListener("click", function () {
    _finCloseDock();
  });

  function _finOpenDock() {
    _finDockOpen = true;
    document.getElementById("finDockColumn").classList.add("open");
    document.body.classList.add("fin-dock-open");
    var dockBody = document.getElementById("finDockBody");
    _finDockParents = {};
    _finDockedPanels = {};

    _finDockPanelIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      _finDockParents[id] = el.parentNode;
      // Only dock hidden panels — leave floating ones alone
      if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        dockBody.appendChild(el);
        el.style.display = 'none';
        el.style.cssText = 'display:none;position:relative!important;right:auto!important;top:auto!important;bottom:auto!important;left:auto!important;width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;box-shadow:none!important;z-index:auto!important;';
        var header = el.querySelector('.fp-header');
        if (header) header.style.display = 'none';
        _finDockedPanels[id] = true;
      }
    });
    _finShowDockPanel(_finActiveDockTab);
  }

  function _finCloseDock() {
    _finDockOpen = false;
    document.getElementById("finDockColumn").classList.remove("open");
    document.body.classList.remove("fin-dock-open");

    _finDockPanelIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (_finDockedPanels[id]) {
        el.style.cssText = '';
        el.style.display = '';
        var header = el.querySelector('.fp-header');
        if (header) header.style.display = '';
        var origParent = _finDockParents[id];
        if (origParent) origParent.appendChild(el);
        el.classList.add('hidden');
      }
    });
    _finDockParents = {};
    _finDockedPanels = {};
  }

  function _finShowDockPanel(id) {
    _finActiveDockTab = id;
    var dockBody = document.getElementById("finDockBody");

    _finDockPanelIds.forEach(function (pid) {
      var el = document.getElementById(pid);
      if (el && _finDockedPanels[pid]) {
        el.style.display = pid === id ? '' : 'none';
      }
    });

    // If panel is floating (not docked), show a redock button
    var redock = document.getElementById('finDockRedock');
    if (redock) redock.remove();

    if (!_finDockedPanels[id]) {
      var rd = document.createElement('div');
      rd.id = 'finDockRedock';
      rd.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;';
      rd.innerHTML = '<button class="pill-chip" style="font-size:12px;padding:8px 20px;">Redock</button>';
      rd.querySelector('button').addEventListener('click', function () {
        var panel = document.getElementById(id);
        if (!panel) return;
        _finDockParents[id] = _finDockParents[id] || panel.parentNode;
        panel.classList.remove('hidden');
        panel.style.cssText = 'position:relative!important;right:auto!important;top:auto!important;bottom:auto!important;left:auto!important;width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;box-shadow:none!important;z-index:auto!important;';
        var header = panel.querySelector('.fp-header');
        if (header) header.style.display = 'none';
        dockBody.appendChild(panel);
        _finDockedPanels[id] = true;
        rd.remove();
        _finShowDockPanel(id);
      });
      dockBody.appendChild(rd);
    }

    document.querySelectorAll('#finDockTabs [data-dock-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.dockTab === id);
    });
  }

  document.getElementById('finDockTabs')?.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-dock-tab]');
    if (btn) _finShowDockPanel(btn.dataset.dockTab);
  });

  // ══════════════════════════════════════
  // MARKETS PANEL (Watchlist, Wallets, Alerts)
  // ══════════════════════════════════════


  // ── Watchlist ──
  function renderWatchlist() {
    var body = document.getElementById("watchlistBody");
    var empty = document.getElementById("watchlistEmpty");
    var badge = document.getElementById("fpWatchlistCount");
    body.innerHTML = "";
    badge.textContent = state.watchlist.length;

    if (!state.watchlist.length) { empty.style.display = ""; return; }
    empty.style.display = "none";

    state.watchlist.forEach(function (item) {
      var tr = document.createElement("tr");
      var isPinned = state.pinned.includes(item.id);
      tr.innerHTML =
        '<td><span class="fin-type-badge ' + item.type + '">' + item.type + '</span></td>' +
        '<td><strong>' + item.symbol + '</strong></td>' +
        '<td>' + (item.name || "") + '</td>' +
        '<td class="col-price">' + formatPrice(item.price) + '</td>' +
        '<td>' +
          '<button class="fin-pin-btn" data-id="' + item.id + '" style="background:none;border:none;cursor:pointer;color:' + (isPinned ? "var(--accent)" : "var(--text-muted)") + ';font-size:12px;">' + (isPinned ? "&#9733;" : "&#9734;") + '</button>' +
          '<button class="fin-rm-btn" data-id="' + item.id + '" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:12px;margin-left:2px;">&times;</button>' +
        '</td>';
      body.appendChild(tr);
    });

    body.querySelectorAll(".fin-pin-btn").forEach(function (b) { b.addEventListener("click", function () { togglePin(b.dataset.id); }); });
    body.querySelectorAll(".fin-rm-btn").forEach(function (b) { b.addEventListener("click", function () { removeWatchlistItem(b.dataset.id); }); });
  }

  function togglePin(id) {
    var idx = state.pinned.indexOf(id);
    if (idx >= 0) state.pinned.splice(idx, 1);
    else state.pinned.push(id);
    saveState(); renderWatchlist();  }

  function removeWatchlistItem(id) {
    state.watchlist = state.watchlist.filter(function (i) { return i.id !== id; });
    state.pinned = state.pinned.filter(function (p) { return p !== id; });
    saveState(); renderWatchlist();  }

  // ── Wallets ──
  function renderWallets() {
    var container = document.getElementById("walletsList");
    var empty = document.getElementById("walletsEmpty");
    container.innerHTML = "";
    if (!state.wallets.length) { empty.style.display = ""; return; }
    empty.style.display = "none";

    state.wallets.forEach(function (w) {
      var div = document.createElement("div");
      div.className = "fin-wallet-item";
      div.innerHTML =
        '<div class="fin-wallet-icon ' + w.chain + '">' + w.chain.slice(0, 2).toUpperCase() + '</div>' +
        '<div class="fin-wallet-info">' +
          '<div class="fin-wallet-label">' + (w.label || w.chain.toUpperCase() + " Wallet") + '</div>' +
          '<div class="fin-wallet-addr" title="' + w.address + '">' + w.address + '</div>' +
        '</div>' +
        '<div class="fin-wallet-balance">' + (w.balance || "—") + ' ' + w.chain.toUpperCase() + '</div>' +
        '<button class="fin-rm-wallet" data-id="' + w.id + '" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:12px;">&times;</button>';
      container.appendChild(div);
    });

    container.querySelectorAll(".fin-rm-wallet").forEach(function (b) {
      b.addEventListener("click", function () {
        state.wallets = state.wallets.filter(function (w) { return w.id !== b.dataset.id; });
        state.pinned = state.pinned.filter(function (p) { return p !== b.dataset.id; });
        saveState(); renderWallets();      });
    });
  }

  // ── Alerts ──
  function renderAlerts() {
    var container = document.getElementById("alertsList");
    var empty = document.getElementById("alertsEmpty");
    container.innerHTML = "";
    if (!state.alerts.length) { empty.style.display = ""; return; }
    empty.style.display = "none";

    state.alerts.forEach(function (a) {
      var div = document.createElement("div");
      div.className = "fin-alert-item";
      var statusClass = a.triggered ? "triggered" : (a.enabled ? "active" : "inactive");
      div.innerHTML =
        '<div class="fin-alert-dot ' + statusClass + '"></div>' +
        '<div class="fin-alert-info">' +
          '<div class="fin-alert-condition"><strong>' + a.symbol + '</strong> ' + a.condition + ' ' + formatPrice(a.threshold) + '</div>' +
          '<div class="fin-alert-status">' + (a.triggered ? "Triggered " + (a.triggeredAt || "") : (a.enabled ? "Active" : "Paused")) + '</div>' +
        '</div>' +
        '<button class="fin-rm-alert" data-id="' + a.id + '" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:12px;">&times;</button>';
      container.appendChild(div);
    });

    container.querySelectorAll(".fin-rm-alert").forEach(function (b) {
      b.addEventListener("click", function () {
        state.alerts = state.alerts.filter(function (a) { return a.id !== b.dataset.id; });
        saveState(); renderAlerts();
      });
    });
  }

  // ── Add Modal ──
  var modal = document.getElementById("addModal");
  var addType = document.getElementById("addType");
  var addFields = document.getElementById("addFields");

  function openAddModal(preType) {
    if (preType) addType.value = preType;
    renderAddFields();
    modal.classList.remove("hidden");
  }
  function closeAddModal() { modal.classList.add("hidden"); }

  function renderAddFields() {
    var type = addType.value;
    addFields.innerHTML = "";
    if (type === "wallet") {
      addFields.innerHTML =
        '<div class="fin-form-group"><label>Blockchain</label><select id="addChain"><option value="eth">Ethereum</option><option value="btc">Bitcoin</option></select></div>' +
        '<div class="fin-form-group"><label>Address</label><input type="text" id="addAddress" placeholder="0x..."></div>' +
        '<div class="fin-form-group"><label>Label</label><input type="text" id="addWalletLabel" placeholder="e.g. Whale Wallet #3"></div>';
    } else if (type === "alert") {
      addFields.innerHTML =
        '<div class="fin-form-group"><label>Symbol</label><input type="text" id="addAlertSymbol" placeholder="AAPL, BTC"></div>' +
        '<div class="fin-form-row">' +
          '<div class="fin-form-group"><label>Condition</label><select id="addAlertCondition"><option value="above">Above</option><option value="below">Below</option></select></div>' +
          '<div class="fin-form-group"><label>Threshold</label><input type="number" id="addAlertThreshold" step="0.01"></div>' +
        '</div>';
    } else {
      var ph = { stock: ["AAPL", "Apple Inc."], crypto: ["BTC", "Bitcoin"], commodity: ["GOLD", "Gold"], forex: ["EUR/USD", "Euro/Dollar"], index: ["SPX", "S&P 500"] };
      var p = ph[type] || ["TICKER", "Name"];
      addFields.innerHTML =
        '<div class="fin-form-row">' +
          '<div class="fin-form-group"><label>Symbol</label><input type="text" id="addSymbol" placeholder="' + p[0] + '"></div>' +
          '<div class="fin-form-group"><label>Name</label><input type="text" id="addName" placeholder="' + p[1] + '"></div>' +
        '</div>' +
        '<div class="fin-form-group"><label><input type="checkbox" id="addPinned" checked> Pin to ticker tape</label></div>';
    }
  }

  function handleAdd() {
    var type = addType.value;
    var id = "fin-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);

    if (type === "wallet") {
      var address = document.getElementById("addAddress").value.trim();
      if (!address) return;
      state.wallets.push({ id: id, chain: document.getElementById("addChain").value, address: address, label: document.getElementById("addWalletLabel").value.trim(), balance: null, usdValue: null });
    } else if (type === "alert") {
      var symbol = document.getElementById("addAlertSymbol").value.trim().toUpperCase();
      if (!symbol) return;
      state.alerts.push({ id: id, symbol: symbol, condition: document.getElementById("addAlertCondition").value, threshold: parseFloat(document.getElementById("addAlertThreshold").value) || 0, enabled: true, triggered: false });
    } else {
      var sym = document.getElementById("addSymbol").value.trim().toUpperCase();
      if (!sym) return;
      state.watchlist.push({ id: id, type: type, symbol: sym, name: document.getElementById("addName").value.trim(), price: null, change: null, changePct: null, volume: null });
      if (document.getElementById("addPinned")?.checked) state.pinned.push(id);
    }

    saveState(); renderAll(); closeAddModal();
  }

  document.getElementById("addItemBtn")?.addEventListener("click", function () { openAddModal(); });
  document.getElementById("modalClose")?.addEventListener("click", closeAddModal);
  document.getElementById("modalCancelBtn")?.addEventListener("click", closeAddModal);
  document.getElementById("modalSaveBtn")?.addEventListener("click", handleAdd);
  addType?.addEventListener("change", renderAddFields);
  modal?.addEventListener("click", function (e) { if (e.target === modal) closeAddModal(); });

  // ══════════════════════════════════════
  // CORPORATE PANEL (Deep SEC lookup)
  // ══════════════════════════════════════

  document.getElementById("corpLookupBtn")?.addEventListener("click", corpLookup);
  document.getElementById("corpLookupInput")?.addEventListener("keydown", function (e) { if (e.key === "Enter") corpLookup(); });

  async function corpLookup() {
    var query = document.getElementById("corpLookupInput").value.trim();
    if (!query) return;
    var btn = document.getElementById("corpLookupBtn");
    btn.disabled = true; btn.textContent = "Looking up...";

    try {
      var resp = await browser.runtime.sendMessage({ action: "intelSearch", provider: "secedgar", query: query, options: {} });
      if (resp?.success) {
        var hits = resp.results?.hits?.hits || [];
        if (hits.length > 0) {
          var hit = hits[0];
          var cik = hit._source?.entity_id || hit._id;
          var name = hit._source?.entity_name || query;
          corpState.cik = cik;
          corpState.companyName = name;
          document.getElementById("corpCompanyName").textContent = name;
          document.getElementById("corpCompanyMeta").textContent = "CIK: " + cik;
          document.getElementById("corpCompanyInfo").classList.remove("hidden");
          await corpLoadFilings(cik);
          document.getElementById("corpAddToKg").disabled = false;
          document.getElementById("corpScreenSanctions").disabled = false;
        }
      }
    } catch (e) { console.warn("[Finance Corporate]", e); }

    btn.disabled = false; btn.textContent = "Lookup";
  }

  async function corpLoadFilings(cik) {
    try {
      var padded = String(cik).padStart(10, "0");
      var resp = await fetch("https://data.sec.gov/submissions/CIK" + padded + ".json", {
        headers: { "User-Agent": "Argus/1.0 contact@example.com" }
      });
      if (!resp.ok) return;
      var data = await resp.json();
      var officers = data.officers || [];
      var officersList = document.getElementById("corpOfficersList");

      if (officers.length > 0) {
        corpState.officers = officers;
        officersList.innerHTML = officers.map(function (o) {
          return '<div class="fin-officer-row"><span class="fin-officer-name">' + (o.name || "Unknown") + '</span><span class="fin-officer-title">' + (o.title || "") + '</span></div>';
        }).join("");
        document.getElementById("corpAddOfficersToKg").disabled = false;
      }
    } catch (e) { console.warn("[Finance] Filings error:", e); }
  }

  // Corporate KG actions
  document.getElementById("corpAddToKg")?.addEventListener("click", function () {
    if (!corpState.companyName) return;
    var self = this;
    browser.runtime.sendMessage({
      action: "extractAndUpsert", text: corpState.companyName,
      pageUrl: "sec-edgar:" + corpState.cik, pageTitle: "SEC EDGAR — " + corpState.companyName
    }).then(function () { self.textContent = "Added!"; setTimeout(function () { self.textContent = "+ KG"; }, 2000); });
  });

  document.getElementById("corpAddOfficersToKg")?.addEventListener("click", async function () {
    if (!corpState.officers.length) return;
    var btn = this; btn.disabled = true; btn.textContent = "Adding...";
    for (var o of corpState.officers) {
      await browser.runtime.sendMessage({
        action: "extractAndUpsert", text: o.name + " is an officer of " + corpState.companyName,
        pageUrl: "sec-edgar:" + corpState.cik, pageTitle: "SEC Officers — " + corpState.companyName
      });
    }
    btn.textContent = "Added " + corpState.officers.length + "!";
    setTimeout(function () { btn.textContent = "+ Officers to KG"; btn.disabled = false; }, 2000);
  });

  document.getElementById("corpScreenSanctions")?.addEventListener("click", async function () {
    if (!corpState.companyName) return;
    var btn = this; btn.disabled = true; btn.textContent = "Screening...";
    var resp = await browser.runtime.sendMessage({ action: "intelSearch", provider: "opensanctions", query: corpState.companyName, options: {} });
    var total = resp?.results?.total || 0;
    btn.textContent = total > 0 ? total + " matches" : "Clear";
    setTimeout(function () { btn.textContent = "Screen Sanctions"; btn.disabled = false; }, 3000);
  });

  // ══════════════════════════════════════
  // BLOCKCHAIN PANEL (Wallet lookup)
  // ══════════════════════════════════════

  document.querySelectorAll(".fin-chain-pill").forEach(function (btn) {
    btn.addEventListener("click", function () { btn.classList.toggle("active"); });
  });

  document.getElementById("walletSearchBtn")?.addEventListener("click", chainLookup);
  document.getElementById("walletSearchInput")?.addEventListener("keydown", function (e) { if (e.key === "Enter") chainLookup(); });

  async function chainLookup() {
    var address = document.getElementById("walletSearchInput").value.trim();
    var chain = document.getElementById("chainSelect").value;
    if (!address) return;
    var btn = document.getElementById("walletSearchBtn");
    btn.disabled = true; btn.textContent = "Looking up...";
    chainState.address = address;
    chainState.chain = chain;

    try {
      if (chain === "btc") await chainLookupBtc(address);
      else if (chain === "eth") await chainLookupEth(address);
      document.getElementById("chainAddWalletToKg").disabled = false;
      document.getElementById("chainAddWalletAsset").disabled = false;
    } catch (e) {
      console.warn("[Blockchain]", e);
      document.getElementById("chainWalletEmpty").innerHTML = '<div>Error: ' + e.message + '</div>';
    }
    btn.disabled = false; btn.textContent = "Lookup";
  }

  async function chainLookupBtc(address) {
    var resp = await fetch("https://blockstream.info/api/address/" + address);
    if (!resp.ok) throw new Error("Blockstream: " + resp.status);
    var data = await resp.json();
    var stats = data.chain_stats || {};
    var funded = stats.funded_txo_sum || 0;
    var spent = stats.spent_txo_sum || 0;
    var balance = funded - spent;
    var txCount = (stats.funded_txo_count || 0) + (stats.spent_txo_count || 0);
    chainState.balance = { balance: balance, received: funded, sent: spent, txCount: txCount };

    document.getElementById("chainWalletDetail").classList.remove("hidden");
    document.getElementById("chainWalletEmpty").style.display = "none";
    document.getElementById("chainWalletBalance").textContent = (balance / 1e8).toFixed(8) + " BTC";
    document.getElementById("chainWalletReceived").textContent = (funded / 1e8).toFixed(8) + " BTC";
    document.getElementById("chainWalletSent").textContent = (spent / 1e8).toFixed(8) + " BTC";
    document.getElementById("chainWalletTxCount").textContent = txCount;

    var txResp = await fetch("https://blockstream.info/api/address/" + address + "/txs");
    if (txResp.ok) {
      var txs = await txResp.json();
      chainState.txs = txs.slice(0, 25);
      chainRenderTxs(chainState.txs);
    }
  }

  async function chainLookupEth(address) {
    document.getElementById("chainWalletDetail").classList.remove("hidden");
    document.getElementById("chainWalletEmpty").style.display = "none";
    document.getElementById("chainWalletBalance").textContent = "Etherscan API key required";
    document.getElementById("chainWalletReceived").textContent = "--";
    document.getElementById("chainWalletSent").textContent = "--";
    document.getElementById("chainWalletTxCount").textContent = "--";
  }

  function chainRenderTxs(txs) {
    var list = document.getElementById("chainTxList");
    if (!txs.length) { list.innerHTML = ""; return; }
    list.innerHTML = txs.map(function (tx) {
      var txid = tx.txid || "";
      var short = txid.slice(0, 10) + "..." + txid.slice(-4);
      var date = tx.status?.block_time ? new Date(tx.status.block_time * 1000).toLocaleDateString() : "Pending";
      return '<div style="padding:3px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;">' +
        '<a href="https://blockstream.info/tx/' + txid + '" target="_blank" rel="noopener" style="color:var(--accent);font-family:monospace;">' + short + '</a>' +
        '<span style="color:var(--text-muted);">' + date + '</span></div>';
    }).join("");
  }

  // Blockchain asset actions
  document.getElementById("chainAddWalletToKg")?.addEventListener("click", function () {
    if (!chainState.address) return;
    var self = this;
    browser.runtime.sendMessage({
      action: "extractAndUpsert", text: "Wallet " + chainState.address + " on " + chainState.chain.toUpperCase(),
      pageUrl: "blockchain:" + chainState.chain + ":" + chainState.address, pageTitle: chainState.chain.toUpperCase() + " Wallet"
    }).then(function () { self.textContent = "Added!"; setTimeout(function () { self.textContent = "+ Wallet to KG"; }, 2000); });
  });

  document.getElementById("chainAddWalletAsset")?.addEventListener("click", function () {
    if (!chainState.address || typeof AssetLibrary === "undefined") return;
    var bal = chainState.balance || {};
    AssetLibrary.add({
      type: "address",
      title: chainState.chain.toUpperCase() + " " + chainState.address.slice(0, 12) + "..." + chainState.address.slice(-6),
      description: "Balance: " + (bal.balance != null ? (bal.balance / 1e8).toFixed(8) + " BTC" : "unknown"),
      metadata: {
        provider: "blockstream",
        category: "finance",
        chain: chainState.chain,
        address: chainState.address,
        balance: bal.balance,
        received: bal.received,
        sent: bal.sent,
        txCount: bal.txCount,
        pageUrl: "https://blockstream.info/address/" + chainState.address,
      },
      sourcePage: "finance",
    });
    var alPanel = document.getElementById("assetLibPanel");
    if (alPanel && alPanel.classList.contains("hidden")) alPanel.classList.remove("hidden");
    this.textContent = "Saved!";
    var self = this;
    setTimeout(function () { self.textContent = "+ Asset"; }, 2000);
  });

  // ══════════════════════════════════════
  // REFRESH & PERSISTENCE
  // ══════════════════════════════════════

  async function refreshPrices() {
    var btn = document.getElementById("refreshBtn");
    if (btn) { btn.textContent = "..."; btn.disabled = true; }
    try {
      await browser.runtime.sendMessage({ action: "financeRefreshPrices" });
      await loadState();
      renderAll();
    } catch (e) { console.warn("[Finance] Refresh error:", e.message); }
    if (btn) { btn.textContent = "Refresh"; btn.disabled = false; }
  }

  document.getElementById("refreshBtn")?.addEventListener("click", refreshPrices);

  // Listen for storage changes
  browser.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes[STORAGE_KEY]) {
      var newState = changes[STORAGE_KEY].newValue;
      if (newState) { state = { ...state, ...newState }; renderAll(); }
    }
  });

  // ══════════════════════════════════════
  // AI CHAT CONTEXT
  // ══════════════════════════════════════

  function gatherFinanceContext() {
    var lines = [];
    if (state.watchlist.length) {
      lines.push("== Watchlist ==");
      state.watchlist.forEach(function (i) { lines.push(i.symbol + " (" + i.type + ") — " + (i.name || "") + " | Price: " + (i.price || "?")); });
    }
    if (corpState.companyName) {
      lines.push("\n== Corporate: " + corpState.companyName + " (CIK: " + corpState.cik + ") ==");
      if (corpState.officers.length) lines.push("Officers: " + corpState.officers.map(function (o) { return o.name; }).join(", "));
    }
    if (chainState.address) {
      lines.push("\n== Blockchain: " + chainState.chain.toUpperCase() + " " + chainState.address.slice(0, 16) + "... ==");
      if (chainState.balance) lines.push("Balance: " + chainState.balance.balance + " | Txs: " + chainState.balance.txCount);
    }
    return lines.join("\n");
  }

  function refreshChatContext() {
    if (typeof ArgusChat !== "undefined") ArgusChat.updateContext(gatherFinanceContext());
  }

  function initFinanceChat() {
    if (typeof ArgusChat === "undefined") return;
    ArgusChat.init({
      container: document.getElementById("argus-chat-container"),
      contextType: "Finance", contextData: gatherFinanceContext(),
      pageUrl: window.location.href, pageTitle: "Finance Monitor"
    });
  }

  // ══════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════

  function formatPrice(val) {
    if (val == null) return "—";
    var n = Number(val);
    if (isNaN(n)) return "—";
    if (n >= 1000) return "$" + n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1) return "$" + n.toFixed(2);
    return "$" + n.toFixed(6);
  }

  function formatChange(val) {
    if (val == null) return "—";
    var n = Number(val);
    if (isNaN(n)) return "—";
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
  }

  function changeClass(val) {
    if (val == null) return "flat";
    return Number(val) >= 0 ? "up" : "down";
  }

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  // ── Render All ──
  function renderAll() {
    renderWatchlist();
    renderWallets();
    renderAlerts();
  }

  // ── Provider status check ──
  async function checkProviderStatus() {
    var pills = document.querySelectorAll(".fin-provider-pill");
    for (var pill of pills) {
      var provider = pill.dataset.provider;
      var meta = _providerLabels[provider] ? true : false;
      if (!meta) continue;

      var dot = pill.querySelector(".fin-pill-dot");
      if (!dot) continue;

      // Zero-config providers are always available
      var zeroConfig = ["secedgar", "opencorporates", "gleif", "fdic", "usaspending",
                        "openpayments"].includes(provider);
      if (zeroConfig) {
        dot.style.background = pill.classList.contains("active") ? "var(--green)" : "var(--text-muted)";
        continue;
      }

      // Keyed providers — check if key is configured
      try {
        var cfg = await browser.runtime.sendMessage({ action: "intelGetProviderConfig", provider: provider });
        var hasKey = !!(cfg?.apiKey);
        if (hasKey) {
          dot.style.background = pill.classList.contains("active") ? "var(--green)" : "var(--text-muted)";
          pill.classList.remove("unconfigured");
          pill.style.pointerEvents = "";
          pill.style.opacity = "";
          pill.title = _providerLabels[provider] || provider;
        } else {
          dot.style.background = "var(--red)";
          pill.classList.remove("active");
          pill.classList.add("unconfigured");
          pill.style.pointerEvents = "none";
          pill.style.opacity = "0.4";
          pill.title = "API key needed — configure in panel";
        }
      } catch {
        dot.style.background = "var(--red)";
      }
    }
  }

  // Re-check status when pills are toggled
  document.getElementById("finProviderPills")?.addEventListener("click", function () {
    setTimeout(checkProviderStatus, 50);
  });

  // ── Init ──
  (async function () {
    await loadState();
    renderAll();
    initFinanceChat();
    checkProviderStatus();
  })();

})();
