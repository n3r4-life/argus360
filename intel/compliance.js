(function () {
  'use strict';

  // ── State ──
  let searchResults = [];
  let matchResults = [];
  let screeningSummary = { flagged: [], clean: 0, adjacent: 0 };
  let lastProvider = 'opensanctions';

  // ── Unified Search ──

  document.getElementById("compSearchBtn").addEventListener("click", () => unifiedSearch());
  document.getElementById("compSearchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") unifiedSearch();
  });

  // Provider pill toggles
  document.getElementById("compProviderPills")?.addEventListener("click", function(e) {
    var pill = e.target.closest(".comp-provider-pill");
    if (!pill) return;
    pill.classList.toggle("active");
  });

  async function unifiedSearch() {
    var query = document.getElementById("compSearchInput").value.trim();
    if (!query) return;

    // Get active providers from pills
    var activePills = document.querySelectorAll(".comp-provider-pill.active");
    var providers = [];
    activePills.forEach(function(p) { providers.push(p.dataset.provider); });
    if (!providers.length) {
      renderError("No providers selected — click the provider pills below the search bar to enable them.", "");
      return;
    }

    lastProvider = providers.length === 1 ? providers[0] : "multiple";

    var btn = document.getElementById("compSearchBtn");
    btn.disabled = true;
    btn.textContent = "Searching...";

    try {
      if (providers.length === 1) {
        var results = await searchSingle(query, providers[0]);
        renderResults(results, providers[0]);
      } else {
        await searchMultipleByPills(query, providers);
      }
    } catch (e) {
      renderError(e.message, providers[0] || "");
    }

    btn.disabled = false;
    btn.textContent = "Search";
    refreshChatContext();
  }

  // ── Single provider search ──

  async function searchSingle(query, provider) {
    if (provider === "opensanctions" || provider === "pepscreen") {
      return await searchOpenSanctions(query, provider === "pepscreen" ? "peps" : undefined);
    } else if (provider === "csl") {
      return await searchCSL(query);
    } else if (provider === "courtlistener") {
      return await searchCourtListener(query);
    } else {
      return await searchGeneric(query, provider);
    }
  }

  // ── Multi-provider search ──

  async function searchMultipleByPills(query, providers) {
    var container = document.getElementById("compResults");
    var empty = document.getElementById("compEmpty");
    var countEl = document.getElementById("compResultsCount");
    var sourceEl = document.getElementById("compResultsSource");
    var filterEl = document.getElementById("compResultsFilter");

    // Clear
    container.querySelectorAll(".comp-result-card, .comp-error, .comp-multi-header").forEach(function(el) { el.remove(); });
    empty.style.display = "none";
    sourceEl.textContent = "searching " + providers.length + " providers...";
    countEl.textContent = "";
    filterEl.style.display = "";
    filterEl.value = "";

    var totalResults = 0;
    var completedProviders = [];

    // Fan out all searches in parallel
    var promises = providers.map(function(prov) {
      return searchSingle(query, prov).then(function(data) {
        return { provider: prov, data: data, error: null };
      }).catch(function(e) {
        return { provider: prov, data: null, error: e.message };
      });
    });

    var results = await Promise.all(promises);

    // Render each provider's results in sections
    results.forEach(function(r) {
      var provLabel = _providerLabels[r.provider] || r.provider;
      if (r.error) {
        // Show error but don't block other results
        var isKeyError = r.error.includes("API key") || r.error.includes("not configured") || r.error.includes("subscription key");
        if (!isKeyError) {
          container.insertAdjacentHTML("beforeend", '<div class="comp-error" data-provider="' + r.provider + '" style="font-size:10px;padding:4px 8px;">' + escapeHtml(provLabel) + ': ' + escapeHtml(r.error) + '</div>');
        }
        return;
      }
      if (!r.data || !r.data.results || !r.data.results.length) return;

      completedProviders.push(r.provider);
      var count = r.data.results.length;
      totalResults += count;

      // Section header
      container.insertAdjacentHTML("beforeend", '<div class="comp-multi-header" data-provider="' + r.provider + '" style="font-size:11px;font-weight:600;color:var(--text-primary);padding:8px 0 4px;border-bottom:1px solid var(--border);margin-top:8px;">' + escapeHtml(provLabel) + ' — ' + count + ' result' + (count !== 1 ? 's' : '') + '</div>');

      // Render cards
      var cards = r.data.results.map(function(item, i) {
        if (r.provider === "courtlistener") return renderCourtCard(item, i);
        if (r.provider === "csl") return renderCSLCard(item, i);
        if (r.provider === "eusanctions") return renderEUCard(item, i);
        if (r.provider === "samgov") return renderSAMCard(item, i);
        if (r.provider === "patentsview" || r.provider === "uspto" || r.provider === "lensorg" || r.provider === "pqai") return renderPatentCard(item, i, provLabel);
        return renderSanctionsCard(item, i);
      }).join("");
      container.insertAdjacentHTML("beforeend", cards);
      wireCardActions(container, r.provider);
    });

    countEl.textContent = totalResults + " result" + (totalResults !== 1 ? "s" : "");
    sourceEl.textContent = "via " + completedProviders.length + " provider" + (completedProviders.length !== 1 ? "s" : "");

    if (totalResults === 0) {
      empty.style.display = "";
      empty.textContent = "No matches found across " + providers.length + " providers.";
    }

    searchResults = []; // mixed results, can't track single array
    refreshChatContext();
  }

  var _providerLabels = {
    opensanctions: "OpenSanctions", csl: "U.S. CSL", eusanctions: "EU Sanctions",
    pepscreen: "PEP Screen", samgov: "SAM.gov", courtlistener: "CourtListener",
    patentsview: "PatentsView", uspto: "USPTO", lensorg: "Lens.org", pqai: "PQAI"
  };

  // ── OpenSanctions Search ──

  async function searchOpenSanctions(query, datasetOverride) {
    var datasetEl = document.getElementById("compDataset");
    var dataset = datasetOverride || (datasetEl ? datasetEl.value : "default");
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "opensanctions", query, options: { dataset }
    });
    if (!resp?.success) throw new Error(resp?.error || "OpenSanctions search failed");
    var raw = resp.results?.results || [];
    searchResults = raw;
    return {
      total: resp.results?.total || raw.length,
      results: raw.map(function(r) {
        var props = r.properties || {};
        return {
          name: (props.name || [r.caption || "Unknown"])[0],
          type: r.schema || "Entity",
          source: (r.datasets || []).join(", "),
          score: r.score,
          country: (props.country || []).join(", "),
          topics: (props.topics || []).join(", "),
          dob: props.birthDate ? props.birthDate[0] : "",
          idNumber: props.idNumber ? props.idNumber[0] : "",
          sourceUrl: r.id ? "https://opensanctions.org/entities/" + r.id : (r.referents?.[0] ? "https://opensanctions.org/entities/" + r.referents[0] : ""),
          raw: r
        };
      })
    };
  }

  // ── CSL Search ──

  async function searchCSL(query) {
    var fuzzy = document.getElementById("compFuzzyToggle").checked;
    var typesEl = document.getElementById("compTypeFilter");
    var countriesEl = document.getElementById("compCountryFilter");
    var types = typesEl ? typesEl.value : "";
    var countries = countriesEl ? countriesEl.value.trim() : "";

    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "csl", query,
      options: { fuzzy: fuzzy, types: types, countries: countries, size: 25 }
    });
    if (!resp?.success) throw new Error(resp?.error || "CSL search failed");
    var data = resp.results || {};
    var raw = data.results || [];
    searchResults = raw;
    return {
      total: data.total || raw.length,
      sourcesUsed: data.sources_used || [],
      results: raw.map(function(r) {
        var docLinks = [];
        if (r.source_information_url) docLinks.push({ label: "Source Info ↗", url: r.source_information_url });
        if (r.source_list_url) docLinks.push({ label: "Source List ↗", url: r.source_list_url });
        if (r.federal_register_notice) docLinks.push({ label: "Fed Register: " + r.federal_register_notice, url: "" });
        return {
          name: r.name || "Unknown",
          altNames: r.alt_names || [],
          type: r.type || "Entity",
          source: r.source || "",
          country: r.country || "",
          programs: r.programs || [],
          addresses: r.addresses || [],
          ids: r.ids || [],
          dob: (r.dates_of_birth || []).join(", "),
          remarks: r.remarks || "",
          title: r.title || "",
          docLinks: docLinks,
          // Vessel fields
          callSign: r.call_sign || "",
          vesselType: r.vessel_type || "",
          vesselFlag: r.vessel_flag || "",
          raw: r
        };
      })
    };
  }

  // ── CourtListener Search ──

  async function searchCourtListener(query) {
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: "courtlistener", query, options: { pageSize: 20 }
    });
    if (!resp?.success) throw new Error(resp?.error || "CourtListener search failed");
    var raw = resp.results?.results || [];
    searchResults = raw;
    return {
      total: resp.results?.count || raw.length,
      results: raw.map(function(r) {
        var url = r.absolute_url ? "https://www.courtlistener.com" + r.absolute_url : "";
        var isPdf = url && url.endsWith(".pdf");
        return {
          name: r.caseName || r.caseNameFull || "Untitled",
          type: "Court Record",
          source: r.court || "",
          date: r.dateFiled || "",
          citations: (r.citation || []).join(", "),
          citeCount: r.citeCount || 0,
          snippet: r.snippet || "",
          url: url,
          isPdf: isPdf,
          raw: r
        };
      })
    };
  }

  // ── Generic Search (EU Sanctions, SAM.gov, Patents) ──

  async function searchGeneric(query, provider) {
    var resp = await browser.runtime.sendMessage({
      action: "intelSearch", provider: provider, query: query, options: {}
    });
    if (!resp?.success) throw new Error(resp?.error || provider + " search failed");
    var data = resp.results || {};
    var raw = data.results || [];
    searchResults = raw;
    return { total: data.total || raw.length, results: raw, provider: provider };
  }

  // ── Result Rendering ──

  function renderResults(data, provider) {
    var container = document.getElementById("compResults");
    var empty = document.getElementById("compEmpty");
    var countEl = document.getElementById("compResultsCount");
    var sourceEl = document.getElementById("compResultsSource");

    // Clear previous
    container.querySelectorAll(".comp-result-card, .comp-error").forEach(function(el) { el.remove(); });

    var providerLabel = provider === "opensanctions" ? "OpenSanctions" :
                        provider === "csl" ? "U.S. CSL" :
                        provider === "courtlistener" ? "CourtListener" : provider;
    sourceEl.textContent = "via " + providerLabel;
    var totalNum = typeof data.total === "number" ? data.total : (data.results ? data.results.length : 0);
    countEl.textContent = totalNum + " result" + (totalNum !== 1 ? "s" : "");

    // Show filter if we have results
    var filterEl = document.getElementById("compResultsFilter");
    if (filterEl) { filterEl.style.display = totalNum > 0 ? "" : "none"; filterEl.value = ""; }

    if (!data.results.length) {
      empty.style.display = "";
      empty.textContent = "No matches found.";
      return;
    }
    empty.style.display = "none";

    var cards = data.results.map(function(r, i) {
      if (provider === "courtlistener") return renderCourtCard(r, i);
      if (provider === "csl") return renderCSLCard(r, i);
      if (provider === "eusanctions") return renderEUCard(r, i);
      if (provider === "samgov") return renderSAMCard(r, i);
      if (provider === "patentsview") return renderPatentCard(r, i, "PatentsView");
      if (provider === "uspto") return renderPatentCard(r, i, "USPTO");
      if (provider === "lensorg") return renderPatentCard(r, i, "Lens.org");
      if (provider === "pqai") return renderPatentCard(r, i, "PQAI");
      if (provider === "opensanctions" || provider === "pepscreen") return renderSanctionsCard(r, i);
      return renderGenericCard(r, i);
    }).join("");

    container.insertAdjacentHTML("beforeend", cards);
    wireCardActions(container, provider);
  }

  function renderSanctionsCard(r, i) {
    var details = [];
    if (r.country) details.push("Country: " + escapeHtml(r.country));
    if (r.topics) details.push("Topics: " + escapeHtml(r.topics));
    if (r.dob) details.push("DOB: " + escapeHtml(r.dob));
    if (r.idNumber) details.push("ID: " + escapeHtml(r.idNumber));
    var score = r.score != null ? Math.round(r.score * 100) + "%" : "";

    return '<div class="comp-result-card" data-idx="' + i + '">' +
      '<div class="comp-result-header">' +
        '<span class="comp-result-badge sanctioned">MATCH</span>' +
        '<span class="comp-result-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="comp-result-schema">' + escapeHtml(r.type) + '</span>' +
        (score ? '<span class="comp-result-score">' + score + '</span>' : '') +
      '</div>' +
      '<div class="comp-result-datasets">' + escapeHtml(r.source) + '</div>' +
      (details.length ? '<div class="comp-result-details">' + details.map(function(d) { return '<span class="comp-result-detail">' + d + '</span>'; }).join("") + '</div>' : '') +
      '<div class="comp-result-actions">' +
        '<button class="pill-chip comp-add-kg" data-idx="' + i + '">Add to KG</button>' +
        '<button class="pill-chip comp-add-asset" data-idx="' + i + '">+ Asset</button>' +
        (r.sourceUrl ? '<a class="pill-chip" href="' + escapeHtml(r.sourceUrl) + '" target="_blank" rel="noopener">View ↗</a>' : '') +
      '</div>' +
    '</div>';
  }

  function renderCSLCard(r, i) {
    var details = [];
    if (r.country) details.push("Country: " + escapeHtml(r.country));
    if (r.programs.length) details.push("Programs: " + escapeHtml(r.programs.join(", ")));
    if (r.dob) details.push("DOB: " + escapeHtml(r.dob));
    if (r.title) details.push("Title: " + escapeHtml(r.title));
    if (r.callSign) details.push("Call Sign: " + escapeHtml(r.callSign));
    if (r.vesselType) details.push("Vessel: " + escapeHtml(r.vesselType) + (r.vesselFlag ? " (" + escapeHtml(r.vesselFlag) + ")" : ""));

    // Alt names
    var altStr = r.altNames.length ? '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">AKA: ' + escapeHtml(r.altNames.slice(0, 5).join(", ")) + (r.altNames.length > 5 ? " +" + (r.altNames.length - 5) + " more" : "") + '</div>' : '';

    // Addresses
    var addrStr = r.addresses.length ? '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + r.addresses.slice(0, 2).map(function(a) {
      return escapeHtml([a.address, a.city, a.state, a.country].filter(Boolean).join(", "));
    }).join("<br>") + '</div>' : '';

    // IDs
    var idStr = r.ids.length ? '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">IDs: ' + r.ids.slice(0, 3).map(function(id) {
      return escapeHtml(id.type + ": " + id.number);
    }).join("; ") + '</div>' : '';

    // Document links (including PDFs)
    var docBtns = r.docLinks.map(function(d) {
      if (!d.url) return '<span class="pill-chip" style="opacity:0.5;font-size:8px;">' + escapeHtml(d.label) + '</span>';
      var isPdf = d.url.endsWith(".pdf");
      if (isPdf) {
        return '<button class="pill-chip comp-view-pdf" data-url="' + escapeAttr(d.url) + '" title="View PDF">' + escapeHtml(d.label) + '</button>';
      }
      return '<a class="pill-chip" href="' + escapeHtml(d.url) + '" target="_blank" rel="noopener">' + escapeHtml(d.label) + '</a>';
    }).join("");

    // Remarks
    var remarkStr = r.remarks ? '<div style="font-size:10px;color:var(--text-secondary);margin-top:4px;font-style:italic;">' + escapeHtml(r.remarks.substring(0, 300)) + (r.remarks.length > 300 ? "..." : "") + '</div>' : '';

    return '<div class="comp-result-card csl" data-idx="' + i + '">' +
      '<div class="comp-result-header">' +
        '<span class="comp-result-badge sanctioned">CSL</span>' +
        '<span class="comp-result-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="comp-result-schema">' + escapeHtml(r.type) + '</span>' +
      '</div>' +
      '<div class="comp-result-datasets">' + escapeHtml(r.source) + '</div>' +
      altStr + addrStr + idStr +
      (details.length ? '<div class="comp-result-details">' + details.map(function(d) { return '<span class="comp-result-detail">' + d + '</span>'; }).join("") + '</div>' : '') +
      remarkStr +
      '<div class="comp-result-actions">' +
        '<button class="pill-chip comp-add-kg" data-idx="' + i + '">Add to KG</button>' +
        '<button class="pill-chip comp-add-asset" data-idx="' + i + '">+ Asset</button>' +
        docBtns +
      '</div>' +
    '</div>';
  }

  function renderCourtCard(r, i) {
    return '<div class="comp-result-card" data-idx="' + i + '">' +
      '<div class="comp-result-header">' +
        '<span class="comp-result-name">' +
          (r.url ? '<a href="' + escapeHtml(r.url) + '" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none;">' + escapeHtml(r.name) + '</a>' : escapeHtml(r.name)) +
        '</span>' +
        (r.citeCount > 0 ? '<span class="comp-result-score">' + r.citeCount + ' cites</span>' : '') +
      '</div>' +
      '<div class="comp-result-datasets">' + escapeHtml(r.source) + (r.date ? " · " + escapeHtml(r.date) : "") + (r.citations ? " · " + escapeHtml(r.citations) : "") + '</div>' +
      (r.snippet ? '<div class="comp-result-details" style="margin-top:4px;font-size:11px;color:var(--text-secondary);">' + r.snippet + '</div>' : '') +
      '<div class="comp-result-actions">' +
        '<button class="pill-chip comp-add-kg" data-idx="' + i + '">Add to KG</button>' +
        '<button class="pill-chip comp-add-asset" data-idx="' + i + '">+ Asset</button>' +
        (r.url && r.isPdf ? '<button class="pill-chip comp-view-pdf" data-url="' + escapeAttr(r.url) + '">View PDF</button>' : '') +
        (r.url && !r.isPdf ? '<a class="pill-chip" href="' + escapeHtml(r.url) + '" target="_blank" rel="noopener">View ↗</a>' : '') +
      '</div>' +
    '</div>';
  }

  function renderEUCard(r, i) {
    var altNames = r.names ? r.names.slice(1, 4).join(", ") : "";
    return '<div class="comp-result-card" data-idx="' + i + '" style="border-left:3px solid #fbbf24;">' +
      '<div class="comp-result-header">' +
        '<span class="comp-result-badge sanctioned">EU</span>' +
        '<span class="comp-result-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="comp-result-schema">' + escapeHtml(r.type) + '</span>' +
      '</div>' +
      (r.programmes.length ? '<div class="comp-result-datasets">' + escapeHtml(r.programmes.join(", ")) + '</div>' : '') +
      (altNames ? '<div style="font-size:10px;color:var(--text-muted);">AKA: ' + escapeHtml(altNames) + '</div>' : '') +
      (r.remark ? '<div style="font-size:10px;color:var(--text-secondary);font-style:italic;margin-top:2px;">' + escapeHtml(r.remark.substring(0, 200)) + '</div>' : '') +
      '<div class="comp-result-actions">' +
        '<button class="pill-chip comp-add-kg" data-idx="' + i + '">Add to KG</button>' +
        '<button class="pill-chip comp-add-asset" data-idx="' + i + '">+ Asset</button>' +
        '<a class="pill-chip" href="https://webgate.ec.europa.eu/fsd/fsf#!/search" target="_blank" rel="noopener">EU List ↗</a>' +
      '</div>' +
    '</div>';
  }

  function renderSAMCard(r, i) {
    var reg = r.entityRegistration || {};
    var core = r.coreData || {};
    var name = reg.legalBusinessName || reg.dbaName || "Unknown";
    var dba = reg.dbaName && reg.dbaName !== name ? reg.dbaName : "";
    var uei = reg.ueiSAM || "";
    var cage = reg.cageCode || "";
    var status = reg.registrationStatus || "";
    var regDate = reg.registrationDate || "";
    var expDate = reg.expirationDate || "";
    var activeDate = reg.activeDate || "";
    var purpose = reg.purposeOfRegistrationDesc || reg.purposeOfRegistrationCode || "";
    var samUrl = uei ? "https://sam.gov/entity/" + encodeURIComponent(uei) : "";

    // Physical address
    var addr = core.physicalAddress || {};
    var addrStr = [addr.addressLine1, addr.addressLine2, addr.city, addr.stateOrProvinceCode, addr.zipCode, addr.countryCode].filter(Boolean).join(", ");

    // Mailing address (if different)
    var mail = core.mailingAddress || {};
    var mailStr = [mail.addressLine1, mail.city, mail.stateOrProvinceCode, mail.zipCode].filter(Boolean).join(", ");
    if (mailStr === addrStr) mailStr = "";

    // Business types
    var bizTypes = core.businessTypes || {};
    var typeList = bizTypes.businessTypeList || [];
    var typeStr = typeList.map(function(t) { return t.businessTypeDescription || t.businessType || ""; }).filter(Boolean).join(", ");

    // NAICS codes
    var naicsList = core.naicsCode ? [core.naicsCode] : [];
    if (core.naicsList) {
      naicsList = core.naicsList.map(function(n) {
        return (n.naicsCode || "") + (n.naicsDescription ? " — " + n.naicsDescription : "");
      });
    }

    // SBA certifications
    var sba = core.sbaBusinessTypeDesc || [];
    var certStr = Array.isArray(sba) ? sba.join(", ") : (sba || "");

    // Build detail rows
    var details = [];
    if (uei) details.push("UEI: " + escapeHtml(uei));
    if (cage) details.push("CAGE: " + escapeHtml(cage));
    if (purpose) details.push("Purpose: " + escapeHtml(purpose));
    if (regDate) details.push("Registered: " + escapeHtml(regDate));
    if (expDate) details.push("Expires: " + escapeHtml(expDate));

    return '<div class="comp-result-card" data-idx="' + i + '" style="border-left:3px solid #10b981;">' +
      '<div class="comp-result-header">' +
        '<span class="comp-result-badge" style="background:#10b981;color:#fff;">SAM</span>' +
        '<span class="comp-result-name">' + escapeHtml(name) + '</span>' +
        '<span class="comp-result-schema">' + escapeHtml(status) + '</span>' +
      '</div>' +
      (dba ? '<div style="font-size:10px;color:var(--text-muted);">DBA: ' + escapeHtml(dba) + '</div>' : '') +
      (details.length ? '<div class="comp-result-details">' + details.map(function(d) { return '<span class="comp-result-detail">' + d + '</span>'; }).join("") + '</div>' : '') +
      (addrStr ? '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">📍 ' + escapeHtml(addrStr) + '</div>' : '') +
      (mailStr ? '<div style="font-size:10px;color:var(--text-muted);">📬 ' + escapeHtml(mailStr) + '</div>' : '') +
      (typeStr ? '<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">Business Types: ' + escapeHtml(typeStr) + '</div>' : '') +
      (naicsList.length ? '<div style="font-size:10px;color:var(--text-secondary);">NAICS: ' + escapeHtml(naicsList.slice(0, 5).join("; ")) + '</div>' : '') +
      (certStr ? '<div style="font-size:10px;color:#22c55e;">SBA: ' + escapeHtml(certStr) + '</div>' : '') +
      '<div class="comp-result-actions">' +
        '<button class="pill-chip comp-add-kg" data-idx="' + i + '">Add to KG</button>' +
        '<button class="pill-chip comp-add-asset" data-idx="' + i + '">+ Asset</button>' +
        (samUrl ? '<a class="pill-chip" href="' + escapeHtml(samUrl) + '" target="_blank" rel="noopener" style="background:var(--accent);color:#fff;font-weight:600;">View on SAM.gov ↗</a>' : '') +
      '</div>' +
    '</div>';
  }

  function renderPatentCard(r, i, source) {
    // Normalize fields across different patent APIs
    var title = r.patent_title || r.inventionTitle || r.title || r.document?.title || "Untitled";
    var date = r.patent_date || r.datePublished || r.date_published || "";
    var number = r.patent_number || r.publicationNumber || r.publication_number || r.doc_number || "";
    var abstract = r.patent_abstract || r.abstract || r.document?.abstract || "";
    var url = r.url || r.lens_url || "";
    if (!url && number) url = "https://patents.google.com/patent/" + number;
    var isPdf = url && url.endsWith(".pdf");

    return '<div class="comp-result-card" data-idx="' + i + '" style="border-left:3px solid #8b5cf6;">' +
      '<div class="comp-result-header">' +
        '<span class="comp-result-badge" style="background:#8b5cf6;color:#fff;">' + escapeHtml(source) + '</span>' +
        '<span class="comp-result-name">' + escapeHtml(title) + '</span>' +
      '</div>' +
      '<div class="comp-result-datasets">' + escapeHtml(number) + (date ? " · " + escapeHtml(date) : "") + '</div>' +
      (abstract ? '<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">' + escapeHtml(abstract.substring(0, 250)) + (abstract.length > 250 ? "..." : "") + '</div>' : '') +
      '<div class="comp-result-actions">' +
        '<button class="pill-chip comp-add-kg" data-idx="' + i + '">Add to KG</button>' +
        '<button class="pill-chip comp-add-asset" data-idx="' + i + '">+ Asset</button>' +
        (url && isPdf ? '<button class="pill-chip comp-view-pdf" data-url="' + escapeAttr(url) + '">View PDF</button>' : '') +
        (url && !isPdf ? '<a class="pill-chip" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">View ↗</a>' : '') +
      '</div>' +
    '</div>';
  }

  function renderGenericCard(r, i) {
    var name = r.name || r.title || r.label || JSON.stringify(r).substring(0, 100);
    return '<div class="comp-result-card" data-idx="' + i + '">' +
      '<div class="comp-result-header">' +
        '<span class="comp-result-name">' + escapeHtml(name) + '</span>' +
      '</div>' +
      '<div class="comp-result-actions">' +
        '<button class="pill-chip comp-add-kg" data-idx="' + i + '">Add to KG</button>' +
        '<button class="pill-chip comp-add-asset" data-idx="' + i + '">+ Asset</button>' +
      '</div>' +
    '</div>';
  }

  function wireCardActions(container, provider) {
    // Add to KG (also adds as asset automatically)
    container.querySelectorAll(".comp-add-kg").forEach(function(btn) {
      if (btn.dataset.alWired) return;
      btn.dataset.alWired = "1";
      var card = btn.closest(".comp-result-card");
      if (!card) return;
      var nameEl = card.querySelector(".comp-result-name");
      var datasetsEl = card.querySelector(".comp-result-datasets");
      var schemaEl = card.querySelector(".comp-result-schema");
      var cardName = nameEl ? nameEl.textContent.trim() : "Unknown";
      var cardDesc = datasetsEl ? datasetsEl.textContent.trim() : "";
      var cardSchema = schemaEl ? schemaEl.textContent.trim() : "";
      var viewLink = card.querySelector("a[target='_blank']");
      var sourceUrl = viewLink ? viewLink.href : "";

      btn.addEventListener("click", function() {
        var self = this;
        var pageUrl = sourceUrl || (provider + ":" + cardName);
        var pageTitle = (_providerLabels[provider] || provider) + " — " + cardName;

        // Add to KG
        browser.runtime.sendMessage({
          action: "extractAndUpsert", text: cardName, pageUrl: pageUrl, pageTitle: pageTitle
        }).then(function() {
          self.textContent = "Added!";
          setTimeout(function() { self.textContent = "Add to KG"; }, 2000);
        });

        // Also add as asset
        if (typeof AssetLibrary !== "undefined") {
          var naturalType = "entity";
          if (provider === "courtlistener") naturalType = "link";
          else if (provider === "patentsview" || provider === "uspto" || provider === "lensorg" || provider === "pqai") naturalType = "link";
          else if (provider === "samgov") naturalType = "organization";
          else if (cardSchema === "Person") naturalType = "person";
          else if (cardSchema === "Company") naturalType = "organization";
          else if (cardSchema === "Vessel") naturalType = "vessel";
          else if (cardSchema === "Individual") naturalType = "person";

          AssetLibrary.add({
            type: naturalType,
            title: cardName,
            description: cardDesc,
            metadata: {
              provider: provider,
              category: provider === "courtlistener" ? "litigation" : provider === "samgov" ? "entity" : "screening",
              searchQuery: document.getElementById("compSearchInput").value.trim(),
              pageUrl: sourceUrl,
              addedVia: "kg",
            },
            sourcePage: "compliance",
          });
        }
      });
    });

    // Add to Asset Library — encode data directly on buttons during rendering
    container.querySelectorAll(".comp-add-asset").forEach(function(btn) {
      if (btn.dataset.alWired) return; // already wired by a previous provider
      btn.dataset.alWired = "1";
      // Find the card this button belongs to and extract its text content for the asset
      var card = btn.closest(".comp-result-card");
      if (!card) return;
      var nameEl = card.querySelector(".comp-result-name");
      var datasetsEl = card.querySelector(".comp-result-datasets");
      var badgeEl = card.querySelector(".comp-result-badge");
      var cardName = nameEl ? nameEl.textContent.trim() : "Unknown";
      var cardDesc = datasetsEl ? datasetsEl.textContent.trim() : "";
      var cardBadge = badgeEl ? badgeEl.textContent.trim() : "";
      // Grab source URL from View link on the card
      var viewLink = card.querySelector("a[target='_blank']");
      var sourceUrl = viewLink ? viewLink.href : "";

      btn.addEventListener("click", function() {
        if (typeof AssetLibrary === "undefined") return;

        // Determine type from provider and badge
        var naturalType = "entity";
        if (provider === "courtlistener") naturalType = "link";
        else if (provider === "patentsview" || provider === "uspto" || provider === "lensorg" || provider === "pqai") naturalType = "link";
        else if (provider === "samgov") naturalType = "organization";
        else if (cardBadge === "CSL" || provider === "csl") {
          var schemaEl = card.querySelector(".comp-result-schema");
          var schemaText = schemaEl ? schemaEl.textContent.trim() : "";
          naturalType = schemaText === "Individual" ? "person" : schemaText === "Vessel" ? "vessel" : "organization";
        } else if (provider === "opensanctions" || provider === "pepscreen") {
          var schEl = card.querySelector(".comp-result-schema");
          var schText = schEl ? schEl.textContent.trim() : "";
          naturalType = schText === "Person" ? "person" : schText === "Company" ? "organization" : schText === "Vessel" ? "vessel" : "entity";
        } else if (provider === "eusanctions") {
          var euSchEl = card.querySelector(".comp-result-schema");
          var euSchText = euSchEl ? euSchEl.textContent.trim().toLowerCase() : "";
          naturalType = euSchText === "person" ? "person" : "organization";
        }

        var category = "screening";
        if (provider === "courtlistener") category = "litigation";
        else if (provider === "samgov") category = "entity";
        else if (provider === "patentsview" || provider === "uspto" || provider === "lensorg" || provider === "pqai") category = "patent";

        var query = document.getElementById("compSearchInput").value.trim();

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
          sourcePage: "compliance",
        });

        var alPanel = document.getElementById("assetLibPanel");
        if (alPanel && alPanel.classList.contains("hidden")) alPanel.classList.remove("hidden");
        this.textContent = "Saved!";
        var self = this;
        setTimeout(function() { self.textContent = "+ Asset"; }, 2000);
      });
    });

    // PDF viewer
    container.querySelectorAll(".comp-view-pdf").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var url = this.dataset.url;
        if (!url) return;
        // Open in a new tab — browser handles PDF rendering
        window.open(url, "_blank", "noopener");
      });
    });
  }

  function renderError(msg, provider) {
    var container = document.getElementById("compResults");
    var empty = document.getElementById("compEmpty");
    container.querySelectorAll(".comp-result-card, .comp-error").forEach(function(el) { el.remove(); });
    empty.style.display = "none";

    var isKeyError = msg.includes("API key") || msg.includes("not configured") || msg.includes("subscription key");
    var html;
    if (isKeyError) {
      if (provider === "csl") {
        html = 'CSL subscription key not configured. <a href="https://developer.trade.gov" target="_blank" style="color:var(--accent);">Sign up free at developer.trade.gov ↗</a>, then add your key in <a href="../options/options.html" style="color:var(--accent);">Settings → Providers</a>.';
      } else if (provider === "courtlistener") {
        html = 'CourtListener API key not configured. <a href="https://www.courtlistener.com/profile/api-token/" target="_blank" style="color:var(--accent);">Get a free token ↗</a>, then add it in <a href="../options/options.html" style="color:var(--accent);">Settings → Providers</a>.';
      } else {
        html = 'OpenSanctions API key not configured. <a href="https://opensanctions.org/api/" target="_blank" style="color:var(--accent);">Get a key ↗</a>, then add it in <a href="../options/options.html" style="color:var(--accent);">Settings → Providers</a>.';
      }
    } else {
      html = "Error: " + escapeHtml(msg);
    }
    container.insertAdjacentHTML("beforeend", '<div class="comp-error">' + html + '</div>');
  }

  // ── Entity Match (OpenSanctions structured) ──

  document.getElementById("compMatchBtn").addEventListener("click", function() { entityMatch(); });

  async function entityMatch() {
    var schema = document.getElementById("compMatchSchema").value;
    var name = document.getElementById("compMatchName").value.trim();
    if (!name) return;

    var country = document.getElementById("compMatchCountry").value.trim();
    var birthDate = document.getElementById("compMatchBirthDate").value.trim();

    var btn = document.getElementById("compMatchBtn");
    btn.disabled = true;
    btn.textContent = "Matching...";

    var entity = { schema: schema, properties: { name: [name] } };
    if (country) entity.properties.country = [country.toUpperCase()];
    if (birthDate) entity.properties.birthDate = [birthDate];

    try {
      var resp = await browser.runtime.sendMessage({
        action: "intelSearch", provider: "opensanctions", query: name, options: { dataset: "default" }
      });

      var matchResp;
      try {
        matchResp = await fetch("https://api.opensanctions.org/match/default", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await browser.storage.local.get({ argusIntelProviders: {} })
              .then(function(d) {
                return d.argusIntelProviders?.opensanctions?.apiKey
                  ? { "Authorization": "ApiKey " + d.argusIntelProviders.opensanctions.apiKey }
                  : {};
              })),
          },
          body: JSON.stringify(entity),
        });
        if (matchResp.ok) {
          var matchData = await matchResp.json();
          matchResults = matchData.responses || matchData.results || [];
        }
      } catch(e) { /* match endpoint may fail */ }

      if (!matchResults.length && resp?.success) {
        matchResults = resp.results?.results || [];
      }
      renderMatchResults(matchResults);
    } catch (e) {
      document.getElementById("compMatchResults").innerHTML =
        '<div class="comp-error">Error: ' + escapeHtml(e.message) + '</div>';
    }

    btn.disabled = false;
    btn.textContent = "Match Entity";
    refreshChatContext();
  }

  function renderMatchResults(results) {
    var container = document.getElementById("compMatchResults");
    var empty = document.getElementById("compMatchEmpty");

    if (!results.length) {
      container.innerHTML = "";
      empty.style.display = "";
      empty.textContent = "No matches found — entity appears clean.";
      return;
    }
    empty.style.display = "none";

    container.innerHTML = results.map(function(r, i) {
      var props = r.properties || {};
      var name = (props.name || [r.caption || "Unknown"])[0];
      var score = r.score != null ? Math.round(r.score * 100) + "%" : "";
      var datasets = (r.datasets || []).join(", ");

      return '<div class="comp-result-card match">' +
        '<div class="comp-result-header">' +
          '<span class="comp-result-badge ' + (r.score > 0.7 ? "sanctioned" : "adjacent") + '">' +
            (r.score > 0.7 ? "HIGH" : "LOW") +
          '</span>' +
          '<span class="comp-result-name">' + escapeHtml(name) + '</span>' +
          (score ? '<span class="comp-result-score">' + score + '</span>' : '') +
        '</div>' +
        '<div class="comp-result-datasets">' + escapeHtml(datasets) + '</div>' +
        '<div class="comp-result-actions">' +
          '<button class="pill-chip comp-match-kg-btn" data-name="' + escapeAttr(name) + '">Add to KG</button>' +
        '</div>' +
      '</div>';
    }).join("");

    container.querySelectorAll(".comp-match-kg-btn").forEach(function(btn) {
      btn.addEventListener("click", async function() {
        await browser.runtime.sendMessage({
          action: "extractAndUpsert",
          text: btn.dataset.name,
          pageUrl: "opensanctions:match",
          pageTitle: "OpenSanctions Match — " + btn.dataset.name
        });
        btn.textContent = "Added!";
        setTimeout(function() { btn.textContent = "Add to KG"; }, 2000);
      });
    });
  }

  // ── Screen All KG Entities ──

  document.getElementById("compScreenAll").addEventListener("click", screenAll);

  async function screenAll() {
    var btn = document.getElementById("compScreenAll");
    var status = document.getElementById("compScreenStatus");

    btn.disabled = true;
    btn.textContent = "Screening...";
    status.textContent = "Running sanctions check on all KG entities...";
    status.className = "comp-screen-status active";

    try {
      var resp = await browser.runtime.sendMessage({ action: "intelScreenAll" });
      if (resp?.success) {
        status.textContent = "Screened " + resp.screened + " — " + resp.flagged + " flagged";
        status.className = resp.flagged > 0 ? "comp-screen-status flagged" : "comp-screen-status clean";
        await browser.storage.local.set({ compLastScreened: Date.now() });
        await loadScreeningSummary();
      } else {
        status.textContent = "Error: " + (resp?.error || "Unknown");
        status.className = "comp-screen-status error";
      }
    } catch (e) {
      status.textContent = "Error: " + e.message;
      status.className = "comp-screen-status error";
    }

    btn.disabled = false;
    btn.textContent = "Screen All KG";
    refreshChatContext();
  }

  async function loadScreeningSummary() {
    try {
      var kgResp = await browser.runtime.sendMessage({ action: "getKGData" });
      var nodes = kgResp?.nodes || [];

      var flagged = nodes.filter(function(n) { return n.sanctioned; });
      var adjacent = nodes.filter(function(n) { return n["sanctions-adjacent"] && !n.sanctioned; });
      var persons = nodes.filter(function(n) { return n.type === "person" || n.type === "organization"; });
      var clean = persons.length - flagged.length - adjacent.length;

      screeningSummary = { flagged: flagged, clean: Math.max(0, clean), adjacent: adjacent.length };

      document.getElementById("compFlaggedCount").textContent = flagged.length;
      document.getElementById("compCleanCount").textContent = Math.max(0, clean);
      document.getElementById("compAdjacentCount").textContent = adjacent.length;

      var list = document.getElementById("compFlaggedList");
      if (flagged.length) {
        list.innerHTML = flagged.map(function(n) {
          return '<div class="comp-flagged-entity"><span class="comp-result-badge sanctioned">FLAGGED</span><span class="comp-flagged-name">' + escapeHtml(n.displayName) + '</span><span class="comp-flagged-type">' + n.type + '</span></div>';
        }).join("");

        if (adjacent.length) {
          list.innerHTML += '<div style="margin-top:8px;"><span class="intel-section-title" style="margin:0;">Sanctions-Adjacent</span></div>';
          list.innerHTML += adjacent.map(function(n) {
            return '<div class="comp-flagged-entity adjacent"><span class="comp-result-badge adjacent">ADJACENT</span><span class="comp-flagged-name">' + escapeHtml(n.displayName) + '</span><span class="comp-flagged-type">' + n.type + '</span></div>';
          }).join("");
        }
      } else {
        list.innerHTML = '<div class="comp-empty">No flagged entities. Run "Screen All KG" to check.</div>';
      }
    } catch (e) {
      console.warn("[Compliance] KG summary error:", e);
    }
  }

  // ── Header badge click → toggle flagged list ──
  document.getElementById("compScreeningBadges")?.addEventListener("click", function() {
    var list = document.getElementById("compFlaggedList");
    if (list) list.style.display = list.style.display === "none" ? "" : "none";
  });

  // ── Results Filter ──

  document.getElementById("compResultsFilter")?.addEventListener("input", function() {
    var filter = this.value.toLowerCase();
    var cards = document.querySelectorAll("#compResults .comp-result-card");
    var headers = document.querySelectorAll("#compResults .comp-multi-header");
    cards.forEach(function(card) {
      var text = card.textContent.toLowerCase();
      card.style.display = text.includes(filter) ? "" : "none";
    });
    // Hide section headers if all their cards are hidden
    headers.forEach(function(header) {
      var prov = header.dataset.provider;
      var next = header.nextElementSibling;
      var anyVisible = false;
      while (next && !next.classList.contains("comp-multi-header")) {
        if (next.classList.contains("comp-result-card") && next.style.display !== "none") anyVisible = true;
        next = next.nextElementSibling;
      }
      header.style.display = anyVisible ? "" : "none";
    });
  });

  // ── Floating Panel Toggles ──

  var _compPanelMap = {
    compScreeningToggle: 'compScreeningPanel',
    compEntitiesToggle: 'compEntitiesPanel',
    compPatentsToggle: 'compPatentsPanel',
    compLitigationToggle: 'compLitigationPanel'
  };

  Object.keys(_compPanelMap).forEach(function(toggleId) {
    document.getElementById(toggleId)?.addEventListener('click', function() {
      document.getElementById(_compPanelMap[toggleId]).classList.toggle('hidden');
    });
  });

  // Close buttons
  ['compScreeningClose', 'compEntitiesClose', 'compPatentsClose', 'compLitigationClose'].forEach(function(id) {
    document.getElementById(id)?.addEventListener('click', function() {
      this.closest('.fp').classList.add('hidden');
    });
  });

  // ── Side Dock (satellite pattern) ──

  var _compDockOpen = false;
  var _compDockPanelIds = ['assetLibPanel', 'compScreeningPanel', 'compEntitiesPanel', 'compPatentsPanel', 'compLitigationPanel'];
  var _compDockParents = {};
  var _compDockedPanels = {};
  var _compActiveDockTab = 'compScreeningPanel';

  document.getElementById("compDockToggle")?.addEventListener("click", function() {
    if (_compDockOpen) {
      _compCloseDock();
    } else {
      _compOpenDock();
    }
  });

  document.getElementById("compDockClose")?.addEventListener("click", function() {
    _compCloseDock();
  });

  function _compOpenDock() {
    _compDockOpen = true;
    document.getElementById("compDockColumn").classList.add("open");
    document.body.classList.add("comp-dock-open");
    var dockBody = document.getElementById("compDockBody");
    _compDockParents = {};
    _compDockedPanels = {};

    _compDockPanelIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      _compDockParents[id] = el.parentNode;
      // Only dock hidden panels — leave floating ones alone
      if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        dockBody.appendChild(el);
        el.style.display = 'none';
        // Override floating styles for docked state
        el.style.cssText = 'display:none;position:relative!important;right:auto!important;top:auto!important;bottom:auto!important;left:auto!important;width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;box-shadow:none!important;z-index:auto!important;';
        var header = el.querySelector('.fp-header');
        if (header) header.style.display = 'none';
        _compDockedPanels[id] = true;
      }
    });
    _compShowDockPanel(_compActiveDockTab);
  }

  function _compCloseDock() {
    _compDockOpen = false;
    document.getElementById("compDockColumn").classList.remove("open");
    document.body.classList.remove("comp-dock-open");

    _compDockPanelIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (_compDockedPanels[id]) {
        el.style.cssText = '';
        el.style.display = '';
        var header = el.querySelector('.fp-header');
        if (header) header.style.display = '';
        var origParent = _compDockParents[id];
        if (origParent) origParent.appendChild(el);
        el.classList.add('hidden');
      }
    });
    var redock = document.getElementById('compDockRedock');
    if (redock) redock.remove();
    _compDockParents = {};
    _compDockedPanels = {};
  }

  function _compShowDockPanel(id) {
    _compActiveDockTab = id;
    var dockBody = document.getElementById("compDockBody");

    _compDockPanelIds.forEach(function(pid) {
      var el = document.getElementById(pid);
      if (el && _compDockedPanels[pid]) {
        el.style.display = pid === id ? '' : 'none';
      }
    });

    var redock = document.getElementById('compDockRedock');
    if (redock) redock.remove();

    if (!_compDockedPanels[id]) {
      var rd = document.createElement('div');
      rd.id = 'compDockRedock';
      rd.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;';
      rd.innerHTML = '<button class="pill-chip" style="font-size:12px;padding:8px 20px;">Redock</button>';
      rd.querySelector('button').addEventListener('click', function() {
        var panel = document.getElementById(id);
        if (!panel) return;
        _compDockParents[id] = _compDockParents[id] || panel.parentNode;
        panel.classList.remove('hidden');
        panel.style.cssText = 'position:relative!important;right:auto!important;top:auto!important;bottom:auto!important;left:auto!important;width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;box-shadow:none!important;z-index:auto!important;';
        var header = panel.querySelector('.fp-header');
        if (header) header.style.display = 'none';
        dockBody.appendChild(panel);
        _compDockedPanels[id] = true;
        rd.remove();
        _compShowDockPanel(id);
      });
      dockBody.appendChild(rd);
    }

    document.querySelectorAll('#compDockTabs [data-dock-tab]').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.dockTab === id);
    });
  }

  document.getElementById('compDockTabs')?.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-dock-tab]');
    if (btn) _compShowDockPanel(btn.dataset.dockTab);
  });

  // ── AI Chat Context ──

  function gatherComplianceContext() {
    var lines = ["Compliance Intelligence Page\n"];

    if (searchResults.length) {
      lines.push("== Search Results (" + searchResults.length + ", via " + lastProvider + ") ==");
      for (var i = 0; i < Math.min(searchResults.length, 15); i++) {
        var r = searchResults[i];
        var name = r.name || r.caption || (r.properties?.name || ["Unknown"])[0];
        lines.push("- " + name);
      }
    }

    if (matchResults.length) {
      lines.push("\n== Entity Match Results (" + matchResults.length + ") ==");
      for (var j = 0; j < Math.min(matchResults.length, 10); j++) {
        var mr = matchResults[j];
        var mname = (mr.properties?.name || [mr.caption || "Unknown"])[0];
        var mscore = mr.score != null ? Math.round(mr.score * 100) + "%" : "";
        lines.push("- " + mname + " " + mscore);
      }
    }

    lines.push("\n== KG Screening Summary ==");
    lines.push("Flagged: " + (screeningSummary.flagged.length || 0));
    lines.push("Clean: " + screeningSummary.clean);
    lines.push("Adjacent: " + screeningSummary.adjacent);

    return lines.join("\n");
  }

  function refreshChatContext() {
    if (typeof ArgusChat !== "undefined") {
      ArgusChat.updateContext(gatherComplianceContext());
    }
  }

  // ── Helpers ──

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  // ── Init ──

  async function init() {
    await loadScreeningSummary();

    // Init floating panels
    if (typeof FloatingPanel !== "undefined") {
      ['compScreeningPanel', 'compEntitiesPanel', 'compPatentsPanel', 'compLitigationPanel'].forEach(function(id) {
        var panel = document.getElementById(id);
        if (panel) FloatingPanel.init(panel, "compliance");
      });
    }

    // Check provider status and update pill dots + dock panel dots
    try {
      var statusResp = await browser.runtime.sendMessage({ action: "intelGetStatus" });
      if (statusResp?.providers) {
        // Update pill dots
        document.querySelectorAll(".comp-provider-pill").forEach(function(pill) {
          var key = pill.dataset.provider;
          var info = statusResp.providers[key];
          if (info) {
            pill.dataset.status = info.status;
          }
        });
        // Update dock panel status dots
        document.querySelectorAll(".comp-provider-status").forEach(function(dot) {
          var key = dot.dataset.provider;
          var info = statusResp.providers[key];
          if (info) {
            var color = info.status === "connected" ? "#22c55e" : info.status === "error" ? "#f59e0b" : "#6b7280";
            dot.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + color + ';"></span>';
          }
        });
      }
    } catch(e) { /* background not ready */ }

    // Init AI chat
    if (typeof ArgusChat !== "undefined") {
      ArgusChat.init({
        container: document.getElementById("argus-chat-container"),
        contextType: "Compliance",
        contextData: gatherComplianceContext(),
        pageUrl: window.location.href,
        pageTitle: "Compliance — Argus Intelligence"
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
