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
    dol: "DOL",
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
    var provider = pill.dataset.provider;
    // Charts pill: first click toggles on/off, subsequent clicks when active open config popup
    if (provider === "charts") {
      if (!pill.classList.contains("active")) {
        // Turn ON with defaults
        pill.classList.add("active");
        _subSourceState.charts.resolve_yahoo = true;
        _subSourceState.charts.mode_candle = true;
        document.getElementById("finChartRangeStrip").style.display = "";
        updatePillLabel("charts");
      } else if (_activePopupProvider === "charts" && !_subSrcPopup.classList.contains("hidden")) {
        // Popup already open — toggle OFF
        hideSubSourcePopup();
        pill.classList.remove("active");
        // Reset all chart sub-sources
        Object.keys(_subSourceState.charts).forEach(function (k) { _subSourceState.charts[k] = false; });
        document.getElementById("finChartRangeStrip").style.display = "none";
        var badge = pill.querySelector(".pill-sub-count");
        if (badge) badge.remove();
        pill.title = "Charts: click to enable";
      } else {
        // Already active — open popup to configure
        showSubSourcePopup(pill, "charts");
      }
      return;
    }
    // Other providers with sub-sources: show popup
    if (SUB_SOURCES[provider]) {
      showSubSourcePopup(pill, provider);
      return;
    }
    pill.classList.toggle("active");
  });

  // ── Chart resolver: maps input → { symbol, companyName, resolver } ──
  async function resolveTickerForChart(query) {
    var state = _subSourceState.charts || {};
    // Determine active resolver
    var resolver = "yahoo"; // default
    if (state.resolve_edgar) resolver = "edgar";
    else if (state.resolve_openfigi) resolver = "openfigi";
    else if (state.resolve_gleif) resolver = "gleif";

    var symbol = query.toUpperCase();
    var companyName = query;

    if (resolver === "yahoo") {
      var resp = await browser.runtime.sendMessage({
        action: "intelSearch", provider: "yahoo", query: query, options: { _method: "searchTicker" }
      });
      if (resp?.success && resp.results?.length) {
        symbol = resp.results[0].symbol;
        companyName = resp.results[0].name || query;
      }
    } else if (resolver === "edgar") {
      var resp = await browser.runtime.sendMessage({
        action: "intelSearch", provider: "secedgar", query: query
      });
      if (resp?.success) {
        var hits = resp.results?.hits?.hits || resp.results?.results || [];
        if (hits.length) {
          var first = hits[0]._source || hits[0];
          companyName = first.entity_name || first.display_names?.[0] || query;
          // EDGAR gives CIK, not ticker — try to extract ticker from display
          symbol = first.tickers?.[0] || query.toUpperCase();
        }
      }
    } else if (resolver === "gleif") {
      var resp = await browser.runtime.sendMessage({
        action: "intelSearch", provider: "gleif", query: query
      });
      if (resp?.success && resp.results?.results?.length) {
        companyName = resp.results.results[0].legalName || query;
        symbol = query.toUpperCase(); // GLEIF doesn't give tickers
      }
    } else if (resolver === "openfigi") {
      // OpenFIGI: POST https://api.openfigi.com/v3/search
      try {
        var figiResp = await fetch("https://api.openfigi.com/v3/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query, exchCode: "US" }),
        });
        if (figiResp.ok) {
          var figiData = await figiResp.json();
          var figiResults = figiData.data || [];
          if (figiResults.length) {
            symbol = figiResults[0].ticker || query.toUpperCase();
            companyName = figiResults[0].name || query;
          }
        }
      } catch (e) { /* fallback to raw query */ }
    }

    return { symbol: symbol, companyName: companyName, resolver: resolver };
  }

  // ── Render chart from resolved ticker ──
  async function renderChartFromResolution(resolved) {
    var state = _subSourceState.charts || {};
    var range = _activeChartRange || "1mo";
    var mode = state.mode_line ? "line" : "candle";

    // Fetch quote
    console.log("[Chart] Fetching quote for", resolved.symbol);
    var quoteResp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "yahoo", query: resolved.symbol, options: { _method: "getQuote" }
    });
    console.log("[Chart] Quote response:", quoteResp?.success, quoteResp?.error);
    if (quoteResp?.success) {
      var q = quoteResp.results;
      var chgClass = q.change >= 0 ? "up" : "down";
      var chgSign = q.change >= 0 ? "+" : "";
      document.getElementById("chartQuoteSummary").innerHTML =
        '<span class="chart-quote-symbol">' + escapeHtml(q.symbol) + '</span>' +
        '<span class="chart-quote-price">' + (q.currency || "$") + ' ' + Number(q.price).toFixed(2) + '</span>' +
        '<span class="chart-quote-change ' + chgClass + '">' + chgSign + Number(q.change).toFixed(2) + ' (' + chgSign + Number(q.changePct).toFixed(2) + '%)</span>' +
        '<span class="chart-quote-detail">Vol: ' + formatChartVol(q.volume) + '</span>' +
        '<span class="chart-quote-detail">H: ' + Number(q.high).toFixed(2) + ' L: ' + Number(q.low).toFixed(2) + '</span>' +
        (q.marketCap ? '<span class="chart-quote-detail">MCap: ' + formatChartVol(q.marketCap) + '</span>' : '') +
        '<span class="chart-quote-detail" style="font-size:9px;color:var(--text-muted);">' + escapeHtml(q.exchange || "") + '</span>';
    }

    // Fetch chart
    console.log("[Chart] Fetching chart for", resolved.symbol, "range:", range);
    var chartResp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "yahoo", query: resolved.symbol, options: { _method: "getChart", range: range }
    });
    console.log("[Chart] Chart response:", chartResp?.success, chartResp?.error, chartResp?.results?.candles?.length, "candles");
    if (chartResp?.success && chartResp.results?.candles?.length) {
      var canvas = document.getElementById("stockChartCanvas");
      if (canvas && typeof StockChart !== "undefined") {
        StockChart.render(canvas, chartResp.results.candles, { mode: mode });
      }
    }
  }

  function formatChartVol(v) {
    if (v == null) return "--";
    if (v >= 1e12) return (v / 1e12).toFixed(1) + "T";
    if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return String(v);
  }

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
    var chartArea = document.getElementById("finChartArea");

    // Clear previous results
    container.querySelectorAll(".fin-result-card, .fin-error, .fin-multi-header").forEach(function (el) { el.remove(); });
    empty.style.display = "none";
    chartArea.style.display = "none";
    sourceEl.textContent = "searching " + providers.length + " provider" + (providers.length !== 1 ? "s" : "") + "...";
    countEl.textContent = "";
    filterEl.style.display = "";
    filterEl.value = "";

    var totalResults = 0;
    var completedProviders = [];
    var searchQuery = query; // may be overridden by chart resolver

    // ── Charts: resolve ticker first, render chart, get company name for other providers ──
    var chartsActive = providers.indexOf("charts") !== -1;
    if (chartsActive) {
      providers = providers.filter(function (p) { return p !== "charts"; });
      try {
        var resolved = await resolveTickerForChart(query);
        if (resolved) {
          searchQuery = resolved.companyName || query;
          // Show chart area FIRST so canvas has dimensions for rendering
          chartArea.style.display = "";
          document.getElementById("chartResolvedInfo").textContent =
            "Resolved: " + resolved.symbol + " — " + (resolved.companyName || query) +
            " (via " + resolved.resolver + ")";
          await renderChartFromResolution(resolved);
        }
      } catch (e) {
        chartArea.style.display = "none";
        container.insertAdjacentHTML("afterbegin",
          '<div class="fin-error">Charts: ' + escapeHtml(e.message) + '</div>');
      }
    }

    // Fan out remaining provider searches with resolved name
    var promises = providers.map(function (prov) {
      return searchProvider(searchQuery, prov).then(function (data) {
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
    // Sub-source providers: search only active sub-sources sequentially (skip charts — handled in unifiedSearch)
    if (SUB_SOURCES[provider] && !SUB_SOURCES[provider]._isCharts) return await searchSubSourceProvider(query, provider);

    if (provider === "secedgar") return await searchSECEdgar(query);
    if (provider === "opencorporates") return await searchOpenCorporates(query);
    if (provider === "gleif") return await searchGLEIF(query);
    if (provider === "fdic") return await searchFDIC(query);
    if (provider === "usaspending") return await searchUSAspending(query);

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

  // ── DOL (WHD + OSHA + MSHA) ──
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

        if (dataset === "whd") {
          var bw = parseFloat(r.flsa_bw_atp_amt || r.FLSA_BW_ATP_AMT || 0);
          return {
            name: r.trade_nm || r.TRADE_NM || "Unknown Employer",
            type: "WHD Case",
            _dolSection: "whd",
            caseId: r.case_id || r.CASE_ID || "",
            backWages: bw ? "$" + bw.toLocaleString() : "",
            employees: r.flsa_ee_atp_cnt || r.FLSA_EE_ATP_CNT || "",
            actViolated: r.act_id || r.ACT_ID || "",
            startDate: r.findings_start_date || r.FINDINGS_START_DATE || "",
            endDate: r.findings_end_date || r.FINDINGS_END_DATE || "",
            naics: r.naic_cd || r.NAIC_CD || "",
            city: r.cty_nm || r.CTY_NM || "",
            state: r.st_cd || r.ST_CD || "",
            sourceUrl: "",
            raw: r,
          };
        }

        if (dataset === "osha_inspection") {
          var pen = parseFloat(r.total_current_penalty || r.TOTAL_CURRENT_PENALTY || r.tot_penl || 0);
          return {
            name: r.estab_name || r.ESTAB_NAME || "Unknown Establishment",
            type: "OSHA Inspection",
            _dolSection: "osha",
            activityNr: r.activity_nr || r.ACTIVITY_NR || "",
            openDate: r.open_date || r.OPEN_DATE || "",
            closeDate: r.close_conf_date || r.CLOSE_CONF_DATE || "",
            penalty: pen ? "$" + pen.toLocaleString() : "",
            violations: r.total_violations || r.nr_in_viol || "",
            inspType: r.insp_type || r.INSP_TYPE || "",
            sic: r.sic_code || r.SIC_CODE || r.sic_cd || "",
            city: r.site_city || r.SITE_CITY || "",
            state: r.site_state || r.SITE_STATE || "",
            sourceUrl: r.activity_nr ? "https://www.osha.gov/pls/imis/establishment.inspection_detail?id=" + (r.activity_nr || r.ACTIVITY_NR) : "",
            raw: r,
          };
        }

        if (dataset === "msha_violation") {
          var vpen = parseFloat(r.proposed_penalty || r.PROPOSED_PENALTY || 0);
          return {
            name: r.operator_name || r.OPERATOR_NAME || "Unknown Operator",
            type: "MSHA Violation",
            _dolSection: "msha_violation",
            violationNo: r.violation_no || r.VIOLATION_NO || "",
            issueDate: r.violation_issue_dt || r.VIOLATION_ISSUE_DT || "",
            penalty: vpen ? "$" + vpen.toLocaleString() : "",
            mineName: r.mine_name || r.MINE_NAME || "",
            mineId: r.mine_id || r.MINE_ID || "",
            sigSub: r.sig_sub || r.SIG_SUB || "",
            sectionOfAct: r.section_of_act || r.SECTION_OF_ACT || "",
            sourceUrl: r.mine_id ? "https://www.msha.gov/mine-data-retrieval-system?mineId=" + (r.mine_id || r.MINE_ID) : "",
            raw: r,
          };
        }

        if (dataset === "mines") {
          return {
            name: r.mine_name || r.MINE_NAME || "Unknown Mine",
            type: "Mine",
            _dolSection: "mines",
            operator: r.operator_name || r.OPERATOR_NAME || "",
            city: r.city || r.CITY || "",
            state: r.state || r.STATE || "",
            mineId: r.mine_id || r.MINE_ID || "",
            mineType: r.mine_type || r.MINE_TYPE || "",
            status: r.mine_status || r.MINE_STATUS || "",
            sourceUrl: r.mine_id ? "https://www.msha.gov/mine-data-retrieval-system?mineId=" + (r.mine_id || r.MINE_ID) : "",
            raw: r,
          };
        }

        // accidents (default fallback)
        return {
          name: r.mine_name || r.MINE_NAME || "Unknown Mine",
          type: "Accident",
          _dolSection: "accidents",
          date: r.accident_date || r.ACCIDENT_DATE || r.cal_yr || "",
          injuryType: r.degree_injury || r.DEGREE_INJURY || "",
          classification: r.classification || r.CLASSIFICATION || "",
          mineId: r.mine_id || r.MINE_ID || "",
          occupation: r.occupation || r.OCCUPATION || "",
          sourceUrl: "",
          raw: r,
        };
      })
    };
  }

  // ── Sub-source provider search (sequential, respects toggle state) ──
  async function searchSubSourceProvider(query, provider) {
    var cfg = SUB_SOURCES[provider];
    var state = _subSourceState[provider];
    if (!cfg || !state) throw new Error(provider + ": no sub-source config");

    var activeSources = cfg.sources.filter(function (s) { return state[s.id]; });
    if (!activeSources.length) throw new Error(provider + ": no sources toggled on");

    var allResults = [];
    for (var i = 0; i < activeSources.length; i++) {
      var src = activeSources[i];
      try {
        var resp = await browser.runtime.sendMessage({
          action: "intelSearch", provider: provider, query: query,
          options: { limit: 25, _subMethod: src.method }
        });
        if (resp?.success && resp.results?.results) {
          resp.results.results.forEach(function (r) {
            r._dolDataset = src.id;
            r._subSourceLabel = src.label;
            allResults.push(r);
          });
        }
      } catch (e) {
        console.warn("[SubSrc] " + provider + "/" + src.id + " failed:", e.message);
      }
      // Rate limit delay between sub-source calls
      if (i < activeSources.length - 1) {
        await new Promise(function (resolve) { setTimeout(resolve, 400); });
      }
    }

    // Parse results through provider-specific mappers
    if (provider === "dol") return searchDOLParseResults(allResults);
    if (provider === "fdic") return parseFDICResults(allResults);
    if (provider === "usaspending") return parseUSAspendingResults(allResults);
    if (provider === "opencorporates") return parseOpenCorporatesResults(allResults);
    return { total: allResults.length, results: allResults };
  }

  function parseFDICResults(results) {
    return { total: results.length, results: results.map(function (r) {
      // Failures have different fields than institutions
      if (r.INSTNAME || r.FAILDATE) {
        return { name: r.INSTNAME || "Unknown", type: "Failed Bank",
          cert: r.CERT || "", city: r.CITYST || "", failDate: r.FAILDATE || "",
          acquirer: r.ACQUIRER || "", fund: r.FUND || "",
          totalDep: r.TOTALDEPOSITS ? "$" + (r.TOTALDEPOSITS / 1000).toLocaleString("en") + "K" : "",
          sourceUrl: r.CERT ? "https://www.fdic.gov/resources/resolutions/bank-failures/failed-bank-list/banksearch.html?cert=" + r.CERT : "",
          raw: r };
      }
      var assets = r.ASSET ? "$" + (r.ASSET / 1000).toLocaleString("en") + "K" : "";
      var deposits = r.DEP ? "$" + (r.DEP / 1000).toLocaleString("en") + "K" : "";
      return { name: r.NAME || "Unknown", type: r.ACTIVE === 1 ? "Active Bank" : "Inactive",
        cert: r.CERT || "", city: r.CITY || "", stateCode: r.STALP || "", state: r.STNAME || "",
        zip: r.ZIP || "", address: r.ADDRESS || "", assets: assets, deposits: deposits,
        charterClass: r.CHARTER_CLASS || "", website: r.WEBADDR || "",
        sourceUrl: r.CERT ? "https://www.fdic.gov/resources/resolutions/bank-failures/failed-bank-list/banksearch.html?cert=" + r.CERT : "",
        raw: r };
    })};
  }

  function parseUSAspendingResults(results) {
    return { total: results.length, results: results.map(function (r) {
      var amount = r["Award Amount"];
      var amountStr = amount ? "$" + Number(amount).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
      return { name: r["Recipient Name"] || "Unknown", type: r["Award Type"] || "Award",
        awardId: r["Award ID"] || "", amount: amountStr, amountRaw: amount,
        startDate: r["Start Date"] || "", endDate: r["End Date"] || "",
        agency: r["Awarding Agency"] || "", subAgency: r["Awarding Sub Agency"] || "",
        description: r["Description"] || "",
        sourceUrl: r.generated_internal_id ? "https://www.usaspending.gov/award/" + r.generated_internal_id : "",
        raw: r };
    })};
  }

  function parseOpenCorporatesResults(results) {
    return { total: results.length, results: results.map(function (r) {
      // Officers have different fields
      if (r.officer) { var o = r.officer; return { name: o.name || "Unknown", type: "Officer",
        position: o.position || "", companyName: o.company?.name || "",
        jurisdiction: o.company?.jurisdiction_code || "", startDate: o.start_date || "",
        sourceUrl: o.opencorporates_url || "", raw: r }; }
      var c = r.company || r;
      return { name: c.name || "Unknown", type: c.company_type || "Company",
        jurisdiction: c.jurisdiction_code || "", companyNumber: c.company_number || "",
        status: c.current_status || "", incorporationDate: c.incorporation_date || "",
        registeredAddress: c.registered_address_in_full || "",
        sourceUrl: c.opencorporates_url || "", raw: r };
    })};
  }

  // Extracted DOL result parser (reused by sub-source search)
  function searchDOLParseResults(results) {
    return {
      total: results.length,
      results: results.map(function (r) {
        var dataset = r._dolDataset || "mines";

        // EBSA — pension enforcement cases
        if (dataset.startsWith("ebsa")) {
          var ebPen = parseFloat(r.penalty_amount || 0);
          return { name: r.plan_admin || "Unknown Administrator", type: r._subSourceLabel || "EBSA Case", _dolSection: "ebsa",
            planName: r.plan_name || "", caseType: r.case_type || "",
            penalty: ebPen ? "$" + ebPen.toLocaleString() : "", ein: r.ein || "",
            planYear: r.plan_year || "", closeDate: r.final_close_date || "",
            closeReason: r.final_close_reason || "",
            state: r.plan_admin_state || "", sourceUrl: "", raw: r };
        }
        // All WHD sub-filters return enforcement records — same shape
        if (dataset.startsWith("whd")) {
          var bw = parseFloat(r.flsa_bw_atp_amt || r.bw_atp_amt || 0);
          var totalViols = parseInt(r.case_violtn_cnt || 0);
          var cmp = parseFloat(r.cmp_assd || 0);
          return { name: r.legal_name || r.trade_nm || "Unknown", type: r._subSourceLabel || "WHD Case", _dolSection: "whd",
            caseId: r.case_id || "", backWages: bw ? "$" + bw.toLocaleString() : "",
            penalty: cmp ? "$" + cmp.toLocaleString() : "",
            employees: r.ee_atp_cnt || r.flsa_ee_atp_cnt || "",
            totalViolations: totalViols || "",
            startDate: r.findings_start_date || "", endDate: r.findings_end_date || "",
            naics: r.naics_code_description || r.naic_cd || "",
            city: r.cty_nm || "", state: r.st_cd || "", sourceUrl: "", raw: r };
        }
        // OSHA inspections
        if (dataset === "osha_insp") {
          var pen = parseFloat(r.total_current_penalty || 0);
          return { name: r.estab_name || "Unknown", type: "OSHA Inspection", _dolSection: "osha",
            activityNr: r.activity_nr || "", openDate: r.open_date || "", penalty: pen ? "$" + pen.toLocaleString() : "",
            violations: r.total_violations || r.nr_in_viol || "", inspType: r.insp_type || "",
            city: r.site_city || "", state: r.site_state || "",
            sourceUrl: r.activity_nr ? "https://www.osha.gov/pls/imis/establishment.inspection_detail?id=" + r.activity_nr : "", raw: r };
        }
        // OSHA violations (detail records)
        if (dataset === "osha_viol") {
          var vPen = parseFloat(r.current_penalty || r.initial_penalty || 0);
          return { name: r._estab_name || "Violation #" + (r.citation_id || ""), type: "OSHA Violation", _dolSection: "osha_viol",
            activityNr: r.activity_nr || "", standard: r.standard || "", description: r.violation_desc || "",
            severity: r.gravity || "", penalty: vPen ? "$" + vPen.toLocaleString() : "",
            violType: r.viol_type || "", sourceUrl: "", raw: r };
        }
        // OSHA accidents
        if (dataset === "osha_acc") {
          return { name: r.estab_name || "Unknown", type: "OSHA Accident", _dolSection: "osha_acc",
            summaryNr: r.summary_nr || "", eventDate: r.event_date || "",
            injuryNature: r.nature_of_inj || "", bodyPart: r.part_of_body || "",
            hospitalized: r.hospitalized || "", amputation: r.amputation || "",
            city: r.site_city || "", state: r.site_state || "", sourceUrl: "", raw: r };
        }
        // OSHA accident abstracts (narratives)
        if (dataset === "osha_abstract") {
          return { name: r._estab_name || "Accident Narrative", type: "OSHA Narrative", _dolSection: "osha_abstract",
            summaryNr: r.summary_nr || "", abstract: r.abstract_text || r.abstract || "",
            sourceUrl: "", raw: r };
        }
        if (dataset === "msha_violations") {
          var vpen = parseFloat(r.proposed_penalty || r.PROPOSED_PENALTY || 0);
          return { name: r.operator_name || r.OPERATOR_NAME || "Unknown", type: "MSHA Violation", _dolSection: "msha_violation",
            violationNo: r.violation_no || "", penalty: vpen ? "$" + vpen.toLocaleString() : "",
            mineName: r.mine_name || "", sigSub: r.sig_sub || "", issueDate: r.violation_issue_dt || "",
            sourceUrl: r.mine_id ? "https://www.msha.gov/mine-data-retrieval-system?mineId=" + r.mine_id : "", raw: r };
        }
        if (dataset === "msha_mines") {
          return { name: r.mine_name || r.MINE_NAME || "Unknown Mine", type: "Mine", _dolSection: "mines",
            operator: r.operator_name || "", city: r.city || "", state: r.state || "",
            mineId: r.mine_id || "", mineType: r.mine_type || "", status: r.mine_status || "",
            sourceUrl: r.mine_id ? "https://www.msha.gov/mine-data-retrieval-system?mineId=" + r.mine_id : "", raw: r };
        }
        // msha_accidents / fallback
        return { name: r.mine_name || r.MINE_NAME || "Unknown Mine", type: "Accident", _dolSection: "accidents",
          date: r.accident_date || r.cal_yr || "", injuryType: r.degree_injury || "",
          classification: r.classification || "", mineId: r.mine_id || "", sourceUrl: "", raw: r };
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
      if (item.type === "Officer") {
        if (item.position) details.push(escapeHtml(item.position));
        if (item.companyName) details.push("at " + escapeHtml(item.companyName));
        if (item.jurisdiction) details.push(escapeHtml(item.jurisdiction));
        if (item.startDate) details.push("Since: " + escapeHtml(item.startDate));
      } else {
        if (item.jurisdiction) details.push("Jurisdiction: " + escapeHtml(item.jurisdiction));
        if (item.companyNumber) details.push("#" + escapeHtml(item.companyNumber));
        if (item.incorporationDate) details.push("Inc: " + escapeHtml(item.incorporationDate));
        if (item.status) details.push("Status: " + escapeHtml(item.status));
      }
    } else if (provider === "gleif") {
      if (item.lei) details.push("LEI: " + escapeHtml(item.lei));
      if (item.status) details.push("Status: " + escapeHtml(item.status));
      if (item.headquarters) details.push(escapeHtml(item.headquarters));
    } else if (provider === "fdic") {
      if (item.type === "Failed Bank") {
        if (item.cert) details.push("CERT: " + escapeHtml(String(item.cert)));
        if (item.failDate) details.push("Failed: " + escapeHtml(item.failDate));
        if (item.acquirer) details.push("Acquirer: " + escapeHtml(item.acquirer));
        if (item.totalDep) details.push("Deposits: " + escapeHtml(item.totalDep));
        if (item.city) details.push(escapeHtml(item.city));
      } else {
        if (item.cert) details.push("CERT: " + escapeHtml(String(item.cert)));
        if (item.assets) details.push("Assets: " + escapeHtml(item.assets));
        if (item.deposits) details.push("Deposits: " + escapeHtml(item.deposits));
        if (item.city && item.stateCode) details.push(escapeHtml(item.city + ", " + item.stateCode + " " + (item.zip || "")));
        if (item.charterClass) details.push("Charter: " + escapeHtml(item.charterClass));
      }
    } else if (provider === "usaspending") {
      if (item.awardId) details.push("Award: " + escapeHtml(item.awardId));
      if (item.amount) details.push(escapeHtml(item.amount));
      if (item.agency) details.push(escapeHtml(item.agency));
      if (item.startDate) details.push(escapeHtml(item.startDate) + (item.endDate ? " → " + escapeHtml(item.endDate) : ""));
    } else if (provider === "dol") {
      var sec = item._dolSection || "";
      if (sec === "ebsa") {
        if (item.planName) details.push(escapeHtml(item.planName));
        if (item.penalty) details.push("Penalty: " + escapeHtml(item.penalty));
        if (item.caseType) details.push(escapeHtml(item.caseType));
        if (item.planYear) details.push("Plan Year: " + escapeHtml(item.planYear));
        if (item.closeDate) details.push("Closed: " + escapeHtml(item.closeDate));
        if (item.state) details.push(escapeHtml(item.state));
      } else if (sec === "whd") {
        if (item.caseId) details.push("Case: " + escapeHtml(String(item.caseId)));
        if (item.backWages) details.push("Back Wages: " + escapeHtml(item.backWages));
        if (item.penalty) details.push("CMP: " + escapeHtml(item.penalty));
        if (item.employees) details.push("Employees: " + escapeHtml(String(item.employees)));
        if (item.totalViolations) details.push("Violations: " + escapeHtml(String(item.totalViolations)));
        if (item.naics) details.push(escapeHtml(String(item.naics)));
        if (item.startDate) details.push(escapeHtml(item.startDate) + (item.endDate ? " → " + escapeHtml(item.endDate) : ""));
        if (item.city && item.state) details.push(escapeHtml(item.city + ", " + item.state));
      } else if (sec === "osha") {
        if (item.activityNr) details.push("Insp: " + escapeHtml(String(item.activityNr)));
        if (item.penalty) details.push("Penalty: " + escapeHtml(item.penalty));
        if (item.violations) details.push("Violations: " + escapeHtml(String(item.violations)));
        if (item.inspType) details.push("Type: " + escapeHtml(item.inspType));
        if (item.openDate) details.push(escapeHtml(item.openDate));
        if (item.city && item.state) details.push(escapeHtml(item.city + ", " + item.state));
      } else if (sec === "osha_viol") {
        if (item.standard) details.push("Std: " + escapeHtml(item.standard));
        if (item.penalty) details.push("Penalty: " + escapeHtml(item.penalty));
        if (item.violType) details.push("Type: " + escapeHtml(item.violType));
        if (item.severity) details.push("Gravity: " + escapeHtml(String(item.severity)));
        if (item.description) details.push(escapeHtml(item.description.substring(0, 80)));
      } else if (sec === "osha_acc") {
        if (item.eventDate) details.push(escapeHtml(item.eventDate));
        if (item.injuryNature) details.push(escapeHtml(item.injuryNature));
        if (item.bodyPart) details.push(escapeHtml(item.bodyPart));
        if (item.hospitalized === "Y") details.push("Hospitalized");
        if (item.amputation === "Y") details.push("Amputation");
        if (item.city && item.state) details.push(escapeHtml(item.city + ", " + item.state));
      } else if (sec === "osha_abstract") {
        if (item.abstract) details.push(escapeHtml(item.abstract.substring(0, 150)) + (item.abstract.length > 150 ? "..." : ""));
      } else if (sec === "msha_violation") {
        if (item.violationNo) details.push("Viol: " + escapeHtml(String(item.violationNo)));
        if (item.penalty) details.push("Penalty: " + escapeHtml(item.penalty));
        if (item.mineName) details.push(escapeHtml(item.mineName));
        if (item.sigSub) details.push("S&S: " + escapeHtml(item.sigSub));
        if (item.issueDate) details.push(escapeHtml(item.issueDate));
      } else {
        // mines + accidents (existing)
        if (item.mineId) details.push("Mine ID: " + escapeHtml(String(item.mineId)));
        if (item.operator) details.push("Operator: " + escapeHtml(item.operator));
        if (item.mineType) details.push(escapeHtml(item.mineType));
        if (item.status) details.push("Status: " + escapeHtml(item.status));
        if (item.city && item.state) details.push(escapeHtml(item.city + ", " + item.state));
        if (item.date) details.push("Date: " + escapeHtml(item.date));
        if (item.injuryType) details.push("Injury: " + escapeHtml(item.injuryType));
        if (item.classification) details.push(escapeHtml(item.classification));
      }
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
      document.querySelectorAll(".fp-sub-tab").forEach(function (t) { if (!t.dataset.dolTab) t.classList.toggle("active", t.dataset.fpSub === target); });
      document.querySelectorAll(".fp-sub-pane").forEach(function (p) { p.classList.toggle("active", p.dataset.fpPane === target); });
    });
  });

  // ── Chart range strip (below provider pills) ──
  var _activeChartRange = "1mo";

  document.querySelectorAll(".chart-range-pill").forEach(function (btn) {
    btn.addEventListener("click", function () {
      _activeChartRange = btn.dataset.range;
      document.querySelectorAll(".chart-range-pill").forEach(function (b) {
        b.classList.toggle("active", b.dataset.range === _activeChartRange);
      });
    });
  });

  // ══════════════════════════════════════
  // SUB-SOURCE TOGGLE SYSTEM
  // ══════════════════════════════════════

  // Config: which providers have sub-sources and what method each calls
  var SUB_SOURCES = {
    charts: {
      label: "Charts",
      _isCharts: true, // special handling — not a search provider, configures the chart
      groups: [
        { key: "resolver",  label: "Ticker lookup via",  radio: true },
        { key: "datasrc",   label: "Chart data via",     radio: true },
        { key: "mode",      label: "Style",              radio: true },
      ],
      sources: [
        // Resolvers — how to map input → ticker + company name
        { id: "resolve_yahoo",    label: "Yahoo",      group: "resolver", title: "Yahoo Finance — broadest ticker coverage" },
        { id: "resolve_edgar",    label: "SEC EDGAR",  group: "resolver", title: "SEC EDGAR — authoritative US company names" },
        { id: "resolve_openfigi", label: "OpenFIGI",   group: "resolver", title: "Bloomberg Open Symbology — ISIN, CUSIP, FIGI" },
        { id: "resolve_gleif",    label: "GLEIF",      group: "resolver", title: "LEI registry — legal entity identifier" },
        { id: "resolve_coingecko",label: "CoinGecko",  group: "resolver", title: "Crypto — tokens, coins, DeFi" },
        // Chart data sources
        { id: "data_yahoo",       label: "Yahoo",        group: "datasrc", title: "Yahoo Finance — free, no key, 15min delay" },
        { id: "data_alphavantage",label: "Alpha Vantage", group: "datasrc", title: "Free key — 25 calls/day" },
        { id: "data_twelvedata",  label: "Twelve Data",  group: "datasrc", title: "Free key — 8/min, 800/day" },
        { id: "data_finnhub",     label: "Finnhub",      group: "datasrc", title: "Free key — 60/min, real-time quotes" },
        { id: "data_polygon",     label: "Polygon",      group: "datasrc", title: "Free key — 5/min" },
        { id: "data_coingecko",   label: "CoinGecko",    group: "datasrc", title: "Crypto OHLCV — free, no key" },
        // Modes
        { id: "mode_candle", label: "Candle", group: "mode", title: "Candlestick chart" },
        { id: "mode_line",   label: "Line",   group: "mode", title: "Line chart with fill" },
      ],
    },
    dol: {
      label: "DOL",
      groups: [
        { key: "ebsa", label: "EBSA — Pension & Benefits" },
        { key: "whd",  label: "WHD — Wage & Hour" },
        { key: "osha", label: "OSHA — Safety" },
        { key: "msha", label: "MSHA — Mining" },
      ],
      sources: [
        // EBSA — finance angle: penalty amounts on plan administrators
        { id: "ebsa_5500",      label: "Form 5500",        group: "ebsa", method: "searchEBSA",           title: "ERISA/Form 5500 enforcement cases — plan admin penalties" },
        { id: "ebsa_delinquent",label: "Delinquent Filers", group: "ebsa", method: "searchEBSADelinquent", title: "Delinquent filers with assessed penalties" },
        // WHD — finance angle: back wages and civil money penalties
        { id: "whd_all",        label: "All Cases",   group: "whd",  method: "searchWHD",           title: "All WHD enforcement cases" },
        { id: "whd_flsa",       label: "FLSA",        group: "whd",  method: "searchWHD_FLSA",      title: "Fair Labor Standards — wage theft, overtime, min wage" },
        { id: "whd_fmla",       label: "FMLA",        group: "whd",  method: "searchWHD_FMLA",      title: "Family & Medical Leave Act violations" },
        { id: "whd_h1b",        label: "H-1B",        group: "whd",  method: "searchWHD_H1B",       title: "H-1B visa worker violations" },
        { id: "whd_h2",         label: "H-2A/H-2B",   group: "whd",  method: "searchWHD_H2",        title: "H-2A/H-2B visa worker exploitation" },
        { id: "whd_child",      label: "Child Labor",  group: "whd",  method: "searchWHD_ChildLabor", title: "FLSA child labor violations" },
        { id: "whd_sca",        label: "SCA",         group: "whd",  method: "searchWHD_SCA",       title: "Service Contract Act — fed service workers" },
        { id: "whd_mspa",       label: "MSPA",        group: "whd",  method: "searchWHD_MSPA",      title: "Migrant & Seasonal worker protection" },
        // OSHA — finance angle: penalty dollar amounts
        { id: "osha_viol",      label: "Violations",   group: "osha", method: "searchOSHAViolations",  title: "Violation penalties — standards cited, $ amounts" },
        { id: "osha_acc",       label: "Accidents",    group: "osha", method: "searchOSHAAccidents",   title: "Accident records — injury, hospitalization" },
        // MSHA — finance angle: penalty dollar amounts
        { id: "msha_violations",label: "Violations",   group: "msha", method: "searchMSHAViolations",  title: "Violations — penalties, S&S flags" },
        { id: "msha_accidents", label: "Accidents",    group: "msha", method: "searchAccidents",       title: "Accident/injury records" },
      ],
    },
    fdic: {
      label: "FDIC",
      sources: [
        { id: "institutions", label: "Institutions", method: "search",      title: "Active bank/institution lookup" },
        { id: "failures",     label: "Failures",     method: "getFailures", title: "Failed banks — closure date, acquirer, assets" },
      ],
    },
    usaspending: {
      label: "USAspending",
      sources: [
        { id: "contracts",       label: "Contracts",       method: "searchContracts",      title: "Federal contracts — procurement, defense, services" },
        { id: "grants",          label: "Grants",          method: "searchGrants",         title: "Federal grants — research, education, health" },
        { id: "loans",           label: "Loans",           method: "searchLoans",          title: "Federal loans — SBA, agriculture, housing" },
        { id: "direct_payments", label: "Direct Payments", method: "searchDirectPayments", title: "Direct payments — subsidies, benefits, transfers" },
      ],
    },
  };

  // State: which sub-sources are active per provider  { dol: { whd: true, osha: false, ... } }
  var _subSourceState = {};
  // Initialize defaults — all off until user chooses
  // Charts is fully off by default (activated on first click with defaults)
  Object.keys(SUB_SOURCES).forEach(function (prov) {
    _subSourceState[prov] = {};
    SUB_SOURCES[prov].sources.forEach(function (s) {
      _subSourceState[prov][s.id] = false;
    });
  });

  // ── Popup: show/hide anchored below a pill ──
  var _activePopupProvider = null;
  var _subSrcPopup = document.getElementById("subSourcePopup");

  function showSubSourcePopup(pill, provider) {
    var cfg = SUB_SOURCES[provider];
    if (!cfg) return;
    if (_activePopupProvider === provider && !_subSrcPopup.classList.contains("hidden")) {
      hideSubSourcePopup();
      return;
    }
    _activePopupProvider = provider;
    var state = _subSourceState[provider];

    var allOn = cfg.sources.every(function (s) { return state[s.id]; });
    var allRadio = cfg.groups && cfg.groups.every(function (g) { return g.radio; });
    var html = '<div class="sub-src-title">' + escapeHtml(cfg.label) + '</div>';
    if (!allRadio) {
      html += '<button class="sub-src-chip sub-src-all' + (allOn ? ' active' : '') + '" data-sub-prov="' + provider + '" title="Toggle all sources" style="margin-bottom:6px;">All</button>';
    }

    if (cfg.groups) {
      cfg.groups.forEach(function (g) {
        var groupSources = cfg.sources.filter(function (s) { return s.group === g.key; });
        html += '<div class="sub-src-group">';
        html += '<div class="sub-src-group-label">' + escapeHtml(g.label) + '</div>';
        html += '<div class="sub-src-grid">';
        groupSources.forEach(function (s) {
          html += '<button class="sub-src-chip' + (state[s.id] ? ' active' : '') + '" data-sub-src="' + s.id + '" data-sub-prov="' + provider + '" title="' + escapeHtml(s.title || '') + '">' + escapeHtml(s.label) + '</button>';
        });
        html += '</div></div>';
      });
    } else {
      html += '<div class="sub-src-grid">';
      cfg.sources.forEach(function (s) {
        html += '<button class="sub-src-chip' + (state[s.id] ? ' active' : '') + '" data-sub-src="' + s.id + '" data-sub-prov="' + provider + '" title="' + escapeHtml(s.title || '') + '">' + escapeHtml(s.label) + '</button>';
      });
      html += '</div>';
    }
    _subSrcPopup.innerHTML = html;
    _subSrcPopup.classList.remove("hidden");

    // Position below the pill
    var rect = pill.getBoundingClientRect();
    var stripRect = pill.closest(".fin-provider-pills")?.getBoundingClientRect() || { left: 0 };
    _subSrcPopup.style.top = (rect.bottom + 4) + "px";
    _subSrcPopup.style.left = Math.max(rect.left, stripRect.left) + "px";
  }

  function hideSubSourcePopup() {
    _subSrcPopup.classList.add("hidden");
    _activePopupProvider = null;
  }

  // Click handler on sub-source chips inside popup
  _subSrcPopup?.addEventListener("click", function (e) {
    var chip = e.target.closest(".sub-src-chip");
    if (!chip) return;
    var prov = chip.dataset.subProv;

    // "All" toggle
    if (chip.classList.contains("sub-src-all")) {
      var cfg = SUB_SOURCES[prov];
      var allOn = cfg.sources.every(function (s) { return _subSourceState[prov][s.id]; });
      var newVal = !allOn;
      cfg.sources.forEach(function (s) { _subSourceState[prov][s.id] = newVal; });
      // Refresh popup chips
      _subSrcPopup.querySelectorAll(".sub-src-chip").forEach(function (c) {
        if (c.classList.contains("sub-src-all")) c.classList.toggle("active", newVal);
        else if (c.dataset.subSrc) c.classList.toggle("active", newVal);
      });
      updatePillLabel(prov);
      updateDockTogglesPane();
      return;
    }

    var srcId = chip.dataset.subSrc;
    var cfg2 = SUB_SOURCES[prov];
    var src = cfg2.sources.find(function (s) { return s.id === srcId; });

    // Radio group: deactivate siblings, force this one on
    var group = src && cfg2.groups && cfg2.groups.find(function (g) { return g.key === src.group; });
    if (group && group.radio) {
      cfg2.sources.forEach(function (s) {
        if (s.group === group.key) {
          _subSourceState[prov][s.id] = (s.id === srcId);
        }
      });
      // Update all chips in popup for this group
      _subSrcPopup.querySelectorAll(".sub-src-chip").forEach(function (c) {
        var cSrc = cfg2.sources.find(function (s) { return s.id === c.dataset.subSrc; });
        if (cSrc && cSrc.group === group.key) {
          c.classList.toggle("active", c.dataset.subSrc === srcId);
        }
      });
    } else {
      _subSourceState[prov][srcId] = !_subSourceState[prov][srcId];
      chip.classList.toggle("active", _subSourceState[prov][srcId]);
    }

    // Sync "All" chip state (skip for all-radio providers)
    var hasNonRadio = cfg2.groups ? cfg2.groups.some(function (g) { return !g.radio; }) : true;
    if (hasNonRadio) {
      var allNow = cfg2.sources.every(function (s) { return _subSourceState[prov][s.id]; });
      var allChip = _subSrcPopup.querySelector(".sub-src-all");
      if (allChip) allChip.classList.toggle("active", allNow);
    }
    updatePillLabel(prov);
    updateDockTogglesPane();
  });

  // Close popup on click outside
  document.addEventListener("click", function (e) {
    if (_activePopupProvider && !_subSrcPopup.contains(e.target) && !e.target.closest(".fin-provider-pill")) {
      hideSubSourcePopup();
    }
  });

  // ── Update pill label with count ──
  function updatePillLabel(provider) {
    var cfg = SUB_SOURCES[provider];
    if (!cfg) return;
    var pill = document.querySelector('.fin-provider-pill[data-provider="' + provider + '"]');
    if (!pill) return;
    var activeNames = [];
    cfg.sources.forEach(function (s) {
      if (_subSourceState[provider][s.id]) activeNames.push(s.label);
    });
    var count = activeNames.length;
    var badge = pill.querySelector(".pill-sub-count");

    // Charts pill: managed by its own click handler, just update badge/title here
    if (cfg._isCharts) {
      if (!pill.classList.contains("active")) {
        if (badge) badge.remove();
        pill.title = "Charts: click to enable";
      } else {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "pill-sub-count";
          pill.appendChild(badge);
        }
        // Show resolver + mode: e.g. "Y·C" (Yahoo, Candle)
        var resolverMap = { resolve_yahoo: "Y", resolve_edgar: "S", resolve_openfigi: "F", resolve_gleif: "G" };
        var modeMap = { mode_candle: "C", mode_line: "L" };
        var rKey = "", mKey = "";
        Object.keys(resolverMap).forEach(function (k) { if (_subSourceState.charts[k]) rKey = resolverMap[k]; });
        Object.keys(modeMap).forEach(function (k) { if (_subSourceState.charts[k]) mKey = modeMap[k]; });
        badge.textContent = (rKey || "Y") + "/" + (mKey || "C");
        pill.title = cfg.label + ": " + activeNames.join(", ");
      }
      return;
    }

    // Normal providers: show count
    if (count > 0) {
      pill.classList.add("active");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "pill-sub-count";
        pill.appendChild(badge);
      }
      badge.textContent = count;
      pill.title = cfg.label + ": " + activeNames.join(", ");
    } else {
      pill.classList.remove("active");
      if (badge) badge.remove();
      pill.title = cfg.label + ": click for options";
    }
  }

  // ── Dock: Search Toggles pane ──
  function buildSearchTogglesPane() {
    var pane = document.createElement("div");
    pane.className = "search-toggles-pane";
    pane.id = "searchTogglesPane";
    var html = '';
    Object.keys(SUB_SOURCES).forEach(function (prov) {
      var cfg = SUB_SOURCES[prov];
      var state = _subSourceState[prov];
      var anyOn = Object.values(state).some(function (v) { return v; });
      html += '<div class="search-toggles-section" data-toggles-prov="' + prov + '">';
      html += '<div class="search-toggles-section-title"><span class="pill-dot ' + (anyOn ? 'on' : '') + '"></span>' + escapeHtml(cfg.label) + '</div>';
      var allOn = cfg.sources.every(function (s) { return state[s.id]; });
      var allRadio = cfg.groups && cfg.groups.every(function (g) { return g.radio; });
      if (!allRadio) {
        html += '<button class="sub-src-chip sub-src-all' + (allOn ? ' active' : '') + '" data-sub-prov="' + prov + '" title="Toggle all sources" style="margin-bottom:4px;">All</button>';
      }
      if (cfg.groups) {
        cfg.groups.forEach(function (g) {
          var groupSources = cfg.sources.filter(function (s) { return s.group === g.key; });
          html += '<div class="sub-src-group">';
          html += '<div class="sub-src-group-label">' + escapeHtml(g.label) + '</div>';
          html += '<div class="search-toggles-chips">';
          groupSources.forEach(function (s) {
            html += '<button class="sub-src-chip' + (state[s.id] ? ' active' : '') + '" data-sub-src="' + s.id + '" data-sub-prov="' + prov + '" title="' + escapeHtml(s.title || '') + '">' + escapeHtml(s.label) + '</button>';
          });
          html += '</div></div>';
        });
      } else {
        html += '<div class="search-toggles-chips">';
        cfg.sources.forEach(function (s) {
          html += '<button class="sub-src-chip' + (state[s.id] ? ' active' : '') + '" data-sub-src="' + s.id + '" data-sub-prov="' + prov + '" title="' + escapeHtml(s.title || '') + '">' + escapeHtml(s.label) + '</button>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    pane.innerHTML = html;

    // Wire clicks in dock pane
    pane.addEventListener("click", function (e) {
      var chip = e.target.closest(".sub-src-chip");
      if (!chip) return;
      var prov = chip.dataset.subProv;
      var section = chip.closest(".search-toggles-section");

      // "All" toggle
      if (chip.classList.contains("sub-src-all")) {
        var cfg2 = SUB_SOURCES[prov];
        var allOn2 = cfg2.sources.every(function (s) { return _subSourceState[prov][s.id]; });
        var newVal = !allOn2;
        cfg2.sources.forEach(function (s) { _subSourceState[prov][s.id] = newVal; });
        if (section) section.querySelectorAll(".sub-src-chip").forEach(function (c) {
          if (c.classList.contains("sub-src-all")) c.classList.toggle("active", newVal);
          else if (c.dataset.subSrc) c.classList.toggle("active", newVal);
        });
        updatePillLabel(prov);
        syncPopupFromDock(prov);
        if (section) { var dot = section.querySelector(".pill-dot"); if (dot) dot.classList.toggle("on", newVal); }
        return;
      }

      var srcId = chip.dataset.subSrc;
      var cfg3 = SUB_SOURCES[prov];
      var src = cfg3.sources.find(function (s) { return s.id === srcId; });
      var group = src && cfg3.groups && cfg3.groups.find(function (g) { return g.key === src.group; });

      if (group && group.radio) {
        cfg3.sources.forEach(function (s) {
          if (s.group === group.key) _subSourceState[prov][s.id] = (s.id === srcId);
        });
        if (section) section.querySelectorAll(".sub-src-chip").forEach(function (c) {
          var cSrc = cfg3.sources.find(function (s) { return s.id === c.dataset.subSrc; });
          if (cSrc && cSrc.group === group.key) c.classList.toggle("active", c.dataset.subSrc === srcId);
        });
      } else {
        _subSourceState[prov][srcId] = !_subSourceState[prov][srcId];
        chip.classList.toggle("active", _subSourceState[prov][srcId]);
        var allNow = cfg3.sources.every(function (s) { return _subSourceState[prov][s.id]; });
        if (section) { var allC = section.querySelector(".sub-src-all"); if (allC) allC.classList.toggle("active", allNow); }
      }

      updatePillLabel(prov);
      syncPopupFromDock(prov);
      if (section) {
        var anyOn = Object.values(_subSourceState[prov]).some(function (v) { return v; });
        var dot = section.querySelector(".pill-dot");
        if (dot) dot.classList.toggle("on", anyOn);
      }
    });

    function syncPopupFromDock(prov) {
      if (_activePopupProvider === prov) {
        var cfg = SUB_SOURCES[prov];
        _subSrcPopup.querySelectorAll(".sub-src-chip").forEach(function (c) {
          if (c.classList.contains("sub-src-all")) {
            c.classList.toggle("active", cfg.sources.every(function (s) { return _subSourceState[prov][s.id]; }));
          } else if (c.dataset.subSrc) {
            c.classList.toggle("active", !!_subSourceState[prov][c.dataset.subSrc]);
          }
        });
      }
    }

    return pane;
  }

  function updateDockTogglesPane() {
    var existing = document.getElementById("searchTogglesPane");
    if (!existing) return;
    // Sync chip states
    Object.keys(SUB_SOURCES).forEach(function (prov) {
      var state = _subSourceState[prov];
      var section = existing.querySelector('[data-toggles-prov="' + prov + '"]');
      if (!section) return;
      var allOn = SUB_SOURCES[prov].sources.every(function (s) { return state[s.id]; });
      section.querySelectorAll(".sub-src-chip").forEach(function (chip) {
        if (chip.classList.contains("sub-src-all")) chip.classList.toggle("active", allOn);
        else chip.classList.toggle("active", !!state[chip.dataset.subSrc]);
      });
      var anyOn = Object.values(state).some(function (v) { return v; });
      var dot = section.querySelector(".pill-dot");
      if (dot) dot.classList.toggle("on", anyOn);
    });
  }

  // Register the toggles pane for the dock system
  // Append search toggles pane to DOM (hidden, dockable)
  var _searchTogglesPane = buildSearchTogglesPane();
  _searchTogglesPane.classList.add("hidden");
  document.body.appendChild(_searchTogglesPane);

  // Initialize pill labels on load
  Object.keys(SUB_SOURCES).forEach(function (prov) { updatePillLabel(prov); });

  function renderDolCard(r, idx, tab) {
    var name = "", type = "", details = [], sourceUrl = "";

    if (tab === "whd") {
      name = r.legal_name || r.trade_nm || r.LEGAL_NAME || r.TRADE_NM || "Unknown";
      type = "WHD Case";
      var bw = parseFloat(r.flsa_bw_atp_amt || r.bw_atp_amt || 0);
      if (r.case_id) details.push("Case: <strong>" + escapeHtml(String(r.case_id)) + "</strong>");
      if (bw) details.push("Back Wages: <strong class='dol-penalty'>$" + bw.toLocaleString() + "</strong>");
      if (r.flsa_ee_atp_cnt || r.ee_atp_cnt) details.push("Employees: " + escapeHtml(String(r.flsa_ee_atp_cnt || r.ee_atp_cnt)));
      if (r.flsa_violtn_cnt || r.case_violtn_cnt) details.push("Violations: " + escapeHtml(String(r.flsa_violtn_cnt || r.case_violtn_cnt)));
      if (r.findings_start_date) details.push(escapeHtml(r.findings_start_date));
      if (r.cty_nm && r.st_cd) details.push(escapeHtml(r.cty_nm + ", " + r.st_cd));
    } else if (tab === "osha") {
      name = r.estab_name || r.ESTAB_NAME || "Unknown";
      type = "OSHA Inspection";
      var pen = parseFloat(r.total_current_penalty || r.TOTAL_CURRENT_PENALTY || 0);
      if (r.activity_nr) details.push("Insp: <strong>" + escapeHtml(String(r.activity_nr)) + "</strong>");
      if (pen) details.push("Penalty: <strong class='dol-penalty'>$" + pen.toLocaleString() + "</strong>");
      if (r.total_violations) details.push("Violations: " + escapeHtml(String(r.total_violations)));
      if (r.insp_type) details.push("Type: " + escapeHtml(r.insp_type));
      if (r.open_date) details.push(escapeHtml(r.open_date));
      if (r.site_city && r.site_state) details.push(escapeHtml(r.site_city + ", " + r.site_state));
      if (r.activity_nr) sourceUrl = "https://www.osha.gov/pls/imis/establishment.inspection_detail?id=" + r.activity_nr;
    } else if (tab === "msha_mines") {
      name = r.mine_name || r.MINE_NAME || "Unknown Mine";
      type = "Mine";
      if (r.operator_name) details.push("Operator: <strong>" + escapeHtml(r.operator_name) + "</strong>");
      if (r.mine_id) details.push("Mine ID: " + escapeHtml(String(r.mine_id)));
      if (r.mine_type) details.push(escapeHtml(r.mine_type));
      if (r.mine_status) details.push("Status: " + escapeHtml(r.mine_status));
      if (r.city && r.state) details.push(escapeHtml(r.city + ", " + r.state));
      if (r.mine_id) sourceUrl = "https://www.msha.gov/mine-data-retrieval-system?mineId=" + r.mine_id;
    } else if (tab === "msha_violations") {
      name = r.operator_name || r.OPERATOR_NAME || "Unknown";
      type = "MSHA Violation";
      var vpen = parseFloat(r.proposed_penalty || r.PROPOSED_PENALTY || 0);
      if (r.violation_no) details.push("Viol: <strong>" + escapeHtml(String(r.violation_no)) + "</strong>");
      if (vpen) details.push("Penalty: <strong class='dol-penalty'>$" + vpen.toLocaleString() + "</strong>");
      if (r.mine_name) details.push(escapeHtml(r.mine_name));
      if (r.sig_sub === "Y") details.push("<span class='dol-ss-flag'>S&amp;S</span>");
      if (r.violation_issue_dt) details.push(escapeHtml(r.violation_issue_dt));
      if (r.mine_id) sourceUrl = "https://www.msha.gov/mine-data-retrieval-system?mineId=" + r.mine_id;
    } else if (tab === "msha_accidents") {
      name = r.mine_name || r.MINE_NAME || "Unknown Mine";
      type = "Accident";
      if (r.accident_date) details.push("Date: " + escapeHtml(r.accident_date));
      if (r.degree_injury) details.push("Injury: " + escapeHtml(r.degree_injury));
      if (r.classification) details.push(escapeHtml(r.classification));
      if (r.occupation) details.push(escapeHtml(r.occupation));
      if (r.mine_id) details.push("Mine ID: " + escapeHtml(String(r.mine_id)));
    }

    return '<div class="dol-result-card">' +
      '<div class="dol-result-header">' +
        '<span class="dol-result-type">' + escapeHtml(type) + '</span>' +
        '<span class="dol-result-name">' + escapeHtml(name) + '</span>' +
      '</div>' +
      (details.length ? '<div class="dol-result-details">' + details.map(function (d) { return '<span class="dol-result-detail">' + d + '</span>'; }).join("") + '</div>' : '') +
      '<div class="dol-result-actions">' +
        '<button class="pill-chip dol-add-asset" data-idx="' + idx + '">+ Asset</button>' +
        '<button class="pill-chip dol-add-kg" data-idx="' + idx + '">+ KG</button>' +
        (sourceUrl ? '<a class="pill-chip" href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener">View &#8599;</a>' : '') +
      '</div>' +
    '</div>';
  }

  // ── Side Dock (compliance pattern) ──
  var _finDockOpen = false;
  var _finDockPanelIds = ['assetLibPanel', 'finMarketsPanel', 'finCorporatePanel', 'finBlockchainPanel', 'searchTogglesPane'];
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
          if (!SUB_SOURCES[provider]) pill.title = _providerLabels[provider] || provider;
        } else {
          dot.style.background = "var(--red)";
          pill.classList.remove("active");
          pill.classList.add("unconfigured");
          pill.style.pointerEvents = "none";
          pill.style.opacity = "0.4";
          if (!SUB_SOURCES[provider]) pill.title = "API key needed — configure in panel";
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
