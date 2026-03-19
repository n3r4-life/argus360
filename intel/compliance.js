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

  // Update dataset/filter visibility based on provider
  document.getElementById("compProvider").addEventListener("change", function() {
    var provider = this.value;
    var datasetRow = document.getElementById("compDataset").parentNode;
    // Dataset filter only relevant for OpenSanctions
    document.getElementById("compDataset").style.display = provider === "opensanctions" ? "" : "none";
    // Type filter relevant for OpenSanctions + CSL
    document.getElementById("compTypeFilter").style.display = (provider === "opensanctions" || provider === "csl") ? "" : "none";
    // Country filter relevant for CSL
    document.getElementById("compCountryFilter").style.display = provider === "csl" ? "" : "none";
    // Fuzzy toggle relevant for CSL
    document.getElementById("compFuzzyToggle").parentNode.style.display = provider === "csl" ? "" : "none";
    // Update placeholder
    var input = document.getElementById("compSearchInput");
    if (provider === "courtlistener") {
      input.placeholder = "Search case name, opinion, or docket...";
    } else {
      input.placeholder = "Search name, entity, or vessel...";
    }
  });
  // Trigger initial state
  document.getElementById("compProvider").dispatchEvent(new Event("change"));

  async function unifiedSearch() {
    var query = document.getElementById("compSearchInput").value.trim();
    if (!query) return;
    var provider = document.getElementById("compProvider").value;
    lastProvider = provider;

    var btn = document.getElementById("compSearchBtn");
    btn.disabled = true;
    btn.textContent = "Searching...";

    try {
      var results;
      if (provider === "opensanctions") {
        results = await searchOpenSanctions(query);
      } else if (provider === "csl") {
        results = await searchCSL(query);
      } else if (provider === "courtlistener") {
        results = await searchCourtListener(query);
      }
      renderResults(results, provider);
    } catch (e) {
      renderError(e.message, provider);
    }

    btn.disabled = false;
    btn.textContent = "Search";
    refreshChatContext();
  }

  // ── OpenSanctions Search ──

  async function searchOpenSanctions(query) {
    var dataset = document.getElementById("compDataset").value;
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
          sourceUrl: r.referents?.[0] ? "https://opensanctions.org/entities/" + r.referents[0] : "",
          raw: r
        };
      })
    };
  }

  // ── CSL Search ──

  async function searchCSL(query) {
    var fuzzy = document.getElementById("compFuzzyToggle").checked;
    var types = document.getElementById("compTypeFilter").value;
    var countries = document.getElementById("compCountryFilter").value.trim();

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
    countEl.textContent = data.total + " result" + (data.total !== 1 ? "s" : "");

    if (!data.results.length) {
      empty.style.display = "";
      empty.textContent = "No matches found.";
      return;
    }
    empty.style.display = "none";

    var cards = data.results.map(function(r, i) {
      if (provider === "courtlistener") return renderCourtCard(r, i);
      if (provider === "csl") return renderCSLCard(r, i);
      return renderSanctionsCard(r, i);
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

  function wireCardActions(container, provider) {
    // Add to KG
    container.querySelectorAll(".comp-add-kg").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var idx = parseInt(this.dataset.idx);
        var r = searchResults[idx];
        if (!r) return;
        var name, url, title;
        if (provider === "opensanctions") {
          name = (r.properties?.name || [r.caption || "Unknown"])[0];
          url = "opensanctions:" + (r.id || "");
          title = "OpenSanctions — " + name;
        } else if (provider === "csl") {
          name = r.name || "Unknown";
          url = "csl:" + (r.entity_number || r.id || "");
          title = "U.S. CSL — " + name;
        } else if (provider === "courtlistener") {
          name = r.caseName || r.caseNameFull || "Untitled";
          url = r.absolute_url ? "https://www.courtlistener.com" + r.absolute_url : "courtlistener:";
          title = "CourtListener — " + name;
        }
        var self = this;
        browser.runtime.sendMessage({
          action: "extractAndUpsert", text: name, pageUrl: url, pageTitle: title
        }).then(function() {
          self.textContent = "Added!";
          setTimeout(function() { self.textContent = "Add to KG"; }, 2000);
        });
      });
    });

    // Add to Asset Library
    container.querySelectorAll(".comp-add-asset").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var idx = parseInt(this.dataset.idx);
        var r = searchResults[idx];
        if (!r) return;
        var name, assetType;
        if (provider === "opensanctions") {
          name = (r.properties?.name || [r.caption || "Unknown"])[0];
          assetType = "entity";
        } else if (provider === "csl") {
          name = r.name || "Unknown";
          assetType = "entity";
        } else {
          name = r.caseName || r.caseNameFull || "Untitled";
          assetType = "source";
        }
        if (typeof AssetLibrary !== "undefined") {
          AssetLibrary.add({ type: assetType, label: name, source: provider, data: r, ts: Date.now() });
          this.textContent = "Saved!";
          var self = this;
          setTimeout(function() { self.textContent = "+ Asset"; }, 2000);
        }
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

  // ── Side Dock ──

  var _compDockOpen = false;

  document.getElementById("compDockToggle")?.addEventListener("click", function() {
    _compDockOpen = !_compDockOpen;
    document.getElementById("compDockColumn").classList.toggle("open", _compDockOpen);
    document.body.classList.toggle("comp-dock-open", _compDockOpen);
  });

  document.getElementById("compDockClose")?.addEventListener("click", function() {
    _compDockOpen = false;
    document.getElementById("compDockColumn").classList.remove("open");
    document.body.classList.remove("comp-dock-open");
  });

  // Dock tab switching
  document.getElementById("compDockTabs")?.addEventListener("click", function(e) {
    var btn = e.target.closest("[data-dock-tab]");
    if (!btn) return;
    var tabId = btn.dataset.dockTab;
    document.querySelectorAll("#compDockTabs [data-dock-tab]").forEach(function(b) {
      b.classList.toggle("active", b.dataset.dockTab === tabId);
    });
    document.querySelectorAll(".comp-dock-pane").forEach(function(p) {
      p.classList.toggle("active", p.dataset.dockPane === tabId);
    });

    // If Assets tab, dock the Asset Library panel into it
    if (tabId === "compDockAssets") {
      var alPanel = document.getElementById("assetLibPanel");
      var pane = document.querySelector('[data-dock-pane="compDockAssets"]');
      if (alPanel && pane && alPanel.parentNode !== pane) {
        alPanel.classList.remove("hidden");
        alPanel.style.cssText = "position:relative!important;right:auto!important;top:auto!important;bottom:auto!important;left:auto!important;width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;box-shadow:none!important;z-index:auto!important;display:flex;flex-direction:column;";
        var header = alPanel.querySelector(".fp-header");
        if (header) header.style.display = "none";
        pane.innerHTML = "";
        pane.appendChild(alPanel);
      }
    }
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
    var settingsPanel = document.getElementById("compSettingsPanel");
    if (settingsPanel && typeof FloatingPanel !== "undefined") {
      FloatingPanel.init(settingsPanel, "compliance");
    }

    // Check provider status and update dots
    try {
      var statusResp = await browser.runtime.sendMessage({ action: "intelGetStatus" });
      if (statusResp?.providers) {
        document.querySelectorAll(".comp-provider-status").forEach(function(dot) {
          var key = dot.dataset.provider;
          var info = statusResp.providers[key];
          if (info) {
            var color = info.status === "connected" ? "#22c55e" : info.status === "error" ? "#f59e0b" : "#6b7280";
            dot.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + color + ';"></span>';
          }
        });
        // Update provider dropdown — disable unconfigured ones
        var select = document.getElementById("compProvider");
        Array.from(select.options).forEach(function(opt) {
          var info = statusResp.providers[opt.value];
          if (info && info.status !== "connected") {
            opt.textContent = opt.textContent.replace(/ \(.*\)$/, "") + " (no key)";
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
