(function () {
  'use strict';

  // ── State ──
  let sanctionsResults = [];
  let matchResults = [];
  let screeningSummary = { flagged: [], clean: 0, adjacent: 0 };

  // ── Sanctions Search ──

  document.getElementById("compSanctionsBtn").addEventListener("click", () => sanctionsSearch());
  document.getElementById("compSanctionsInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sanctionsSearch();
  });

  async function sanctionsSearch() {
    const query = document.getElementById("compSanctionsInput").value.trim();
    if (!query) return;

    const btn = document.getElementById("compSanctionsBtn");
    const dataset = document.getElementById("compDataset").value;
    btn.disabled = true;
    btn.textContent = "Searching...";

    try {
      const resp = await browser.runtime.sendMessage({
        action: "intelSearch",
        provider: "opensanctions",
        query,
        options: { dataset }
      });

      if (resp?.success && resp.results) {
        sanctionsResults = resp.results.results || [];
        renderSanctionsResults(sanctionsResults, resp.results.total || 0);
      } else {
        renderSanctionsError(resp?.error || "Search failed");
      }
    } catch (e) {
      renderSanctionsError(e.message);
    }

    btn.disabled = false;
    btn.textContent = "Search";
    refreshChatContext();
  }

  function renderSanctionsResults(results, total) {
    const container = document.getElementById("compSanctionsResults");
    const empty = document.getElementById("compSanctionsEmpty");
    const countEl = document.getElementById("compSanctionsCount");

    countEl.textContent = `${total} result${total !== 1 ? "s" : ""}`;

    if (!results.length) {
      container.querySelectorAll(".comp-result-card").forEach(el => el.remove());
      empty.style.display = "";
      empty.textContent = "No sanctions matches found.";
      return;
    }
    empty.style.display = "none";
    container.querySelectorAll(".comp-result-card").forEach(el => el.remove());

    const cards = results.map((r, i) => {
      const props = r.properties || {};
      const name = (props.name || [r.caption || "Unknown"])[0];
      const schema = r.schema || "Entity";
      const datasets = (r.datasets || []).join(", ") || "Unknown dataset";
      const countries = (props.country || []).join(", ");
      const score = r.score != null ? `${Math.round(r.score * 100)}%` : "";
      const topics = (props.topics || []).join(", ");

      const detailParts = [];
      if (countries) detailParts.push(`Country: ${countries}`);
      if (topics) detailParts.push(`Topics: ${topics}`);
      if (props.birthDate) detailParts.push(`DOB: ${props.birthDate[0]}`);
      if (props.idNumber) detailParts.push(`ID: ${props.idNumber[0]}`);

      return `
        <div class="comp-result-card" data-result-idx="${i}">
          <div class="comp-result-header">
            <span class="comp-result-badge sanctioned">MATCH</span>
            <span class="comp-result-name">${escapeHtml(name)}</span>
            <span class="comp-result-schema">${schema}</span>
            ${score ? `<span class="comp-result-score">${score}</span>` : ""}
          </div>
          <div class="comp-result-datasets">${escapeHtml(datasets)}</div>
          ${detailParts.length ? `<div class="comp-result-details">${detailParts.map(d => `<span class="comp-result-detail">${escapeHtml(d)}</span>`).join("")}</div>` : ""}
          <div class="comp-result-actions">
            <button class="pill-chip comp-add-kg-btn" data-idx="${i}">Add to KG</button>
            <button class="pill-chip comp-detail-btn" data-idx="${i}">Details</button>
          </div>
        </div>
      `;
    }).join("");
    container.insertAdjacentHTML("beforeend", cards);

    // Wire action buttons
    container.querySelectorAll(".comp-add-kg-btn").forEach(btn => {
      btn.addEventListener("click", () => addSanctionsToKg(parseInt(btn.dataset.idx)));
    });
    container.querySelectorAll(".comp-detail-btn").forEach(btn => {
      btn.addEventListener("click", () => toggleResultDetail(parseInt(btn.dataset.idx)));
    });
  }

  function renderSanctionsError(msg) {
    const container = document.getElementById("compSanctionsResults");
    const empty = document.getElementById("compSanctionsEmpty");
    empty.style.display = "none";
    container.innerHTML = `<div class="comp-error">Error: ${escapeHtml(msg)}</div>`;
  }

  async function addSanctionsToKg(idx) {
    const r = sanctionsResults[idx];
    if (!r) return;
    const name = (r.properties?.name || [r.caption || "Unknown"])[0];
    const schema = r.schema || "Entity";
    const type = schema === "Person" ? "person" : "organization";

    try {
      await browser.runtime.sendMessage({
        action: "extractAndUpsert",
        text: name,
        pageUrl: `opensanctions:${r.id || ""}`,
        pageTitle: `OpenSanctions — ${name}`
      });

      const btn = document.querySelectorAll(".comp-add-kg-btn")[idx];
      if (btn) { btn.textContent = "Added!"; setTimeout(() => { btn.textContent = "Add to KG"; }, 2000); }
    } catch (e) { console.warn("[Compliance] KG add error:", e); }
  }

  function toggleResultDetail(idx) {
    const card = document.querySelector(`[data-result-idx="${idx}"]`);
    if (!card) return;

    let detail = card.querySelector(".comp-result-expanded");
    if (detail) {
      detail.remove();
      return;
    }

    const r = sanctionsResults[idx];
    if (!r) return;

    const props = r.properties || {};
    const lines = [];
    for (const [key, vals] of Object.entries(props)) {
      if (Array.isArray(vals) && vals.length) {
        lines.push(`<div class="comp-detail-line"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(vals.join(", "))}</div>`);
      }
    }

    detail = document.createElement("div");
    detail.className = "comp-result-expanded";
    detail.innerHTML = lines.join("") || "<em>No additional properties.</em>";
    card.appendChild(detail);
  }

  // ── Entity Match ──

  document.getElementById("compMatchBtn").addEventListener("click", () => entityMatch());

  async function entityMatch() {
    const schema = document.getElementById("compMatchSchema").value;
    const name = document.getElementById("compMatchName").value.trim();
    if (!name) return;

    const country = document.getElementById("compMatchCountry").value.trim();
    const birthDate = document.getElementById("compMatchBirthDate").value.trim();

    const btn = document.getElementById("compMatchBtn");
    btn.disabled = true;
    btn.textContent = "Matching...";

    const entity = {
      schema,
      properties: { name: [name] }
    };
    if (country) entity.properties.country = [country.toUpperCase()];
    if (birthDate) entity.properties.birthDate = [birthDate];

    try {
      const resp = await browser.runtime.sendMessage({
        action: "intelSearch",
        provider: "opensanctions",
        query: name,
        options: { dataset: "default" }
      });

      // Also do a structured match
      let matchResp;
      try {
        matchResp = await fetch("https://api.opensanctions.org/match/default", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await browser.storage.local.get({ argusIntelProviders: {} })
              .then(d => d.argusIntelProviders?.opensanctions?.apiKey
                ? { "Authorization": `ApiKey ${d.argusIntelProviders.opensanctions.apiKey}` }
                : {})),
          },
          body: JSON.stringify(entity),
        });
        if (matchResp.ok) {
          const matchData = await matchResp.json();
          matchResults = matchData.responses || matchData.results || [];
        }
      } catch { /* match endpoint may fail, fall back to search */ }

      // Use search results if match didn't return anything
      if (!matchResults.length && resp?.success) {
        matchResults = resp.results?.results || [];
      }

      renderMatchResults(matchResults);
    } catch (e) {
      document.getElementById("compMatchResults").innerHTML =
        `<div class="comp-error">Error: ${escapeHtml(e.message)}</div>`;
    }

    btn.disabled = false;
    btn.textContent = "Match Entity";
    refreshChatContext();
  }

  function renderMatchResults(results) {
    const container = document.getElementById("compMatchResults");
    const empty = document.getElementById("compMatchEmpty");

    if (!results.length) {
      container.innerHTML = "";
      empty.style.display = "";
      empty.textContent = "No matches found — entity appears clean.";
      return;
    }
    empty.style.display = "none";

    container.innerHTML = results.map((r, i) => {
      const props = r.properties || {};
      const name = (props.name || [r.caption || "Unknown"])[0];
      const score = r.score != null ? `${Math.round(r.score * 100)}%` : "";
      const datasets = (r.datasets || []).join(", ");

      return `
        <div class="comp-result-card match">
          <div class="comp-result-header">
            <span class="comp-result-badge ${r.score > 0.7 ? "sanctioned" : "adjacent"}">
              ${r.score > 0.7 ? "HIGH" : "LOW"}
            </span>
            <span class="comp-result-name">${escapeHtml(name)}</span>
            ${score ? `<span class="comp-result-score">${score}</span>` : ""}
          </div>
          <div class="comp-result-datasets">${escapeHtml(datasets)}</div>
          <div class="comp-result-actions">
            <button class="pill-chip comp-match-kg-btn" data-name="${escapeAttr(name)}">Add to KG</button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".comp-match-kg-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({
          action: "extractAndUpsert",
          text: btn.dataset.name,
          pageUrl: "opensanctions:match",
          pageTitle: `OpenSanctions Match — ${btn.dataset.name}`
        });
        btn.textContent = "Added!";
        setTimeout(() => { btn.textContent = "Add to KG"; }, 2000);
      });
    });
  }

  // ── Screen All KG Entities ──

  document.getElementById("compScreenAll").addEventListener("click", screenAll);

  async function screenAll() {
    const btn = document.getElementById("compScreenAll");
    const status = document.getElementById("compScreenStatus");
    const timestamp = document.getElementById("compScreenTimestamp");

    btn.disabled = true;
    btn.textContent = "Screening...";
    status.textContent = "Running sanctions check on all KG entities...";
    status.className = "comp-screen-status active";

    try {
      const resp = await browser.runtime.sendMessage({ action: "intelScreenAll" });

      if (resp?.success) {
        status.textContent = `Screened ${resp.screened} entities — ${resp.flagged} flagged`;
        status.className = resp.flagged > 0 ? "comp-screen-status flagged" : "comp-screen-status clean";
        timestamp.textContent = `Last screened: ${new Date().toLocaleString()}`;

        // Save timestamp
        await browser.storage.local.set({ compLastScreened: Date.now() });

        // Reload KG summary
        await loadScreeningSummary();
      } else {
        status.textContent = `Error: ${resp?.error || "Unknown"}`;
        status.className = "comp-screen-status error";
      }
    } catch (e) {
      status.textContent = `Error: ${e.message}`;
      status.className = "comp-screen-status error";
    }

    btn.disabled = false;
    btn.textContent = "Screen All KG Entities";
    refreshChatContext();
  }

  async function loadScreeningSummary() {
    try {
      const kgResp = await browser.runtime.sendMessage({ action: "getKGData" });
      const nodes = kgResp?.nodes || [];

      const flagged = nodes.filter(n => n.sanctioned);
      const adjacent = nodes.filter(n => n["sanctions-adjacent"] && !n.sanctioned);
      const persons = nodes.filter(n => n.type === "person" || n.type === "organization");
      const clean = persons.length - flagged.length - adjacent.length;

      screeningSummary = { flagged, clean: Math.max(0, clean), adjacent: adjacent.length };

      document.getElementById("compFlaggedCount").textContent = flagged.length;
      document.getElementById("compCleanCount").textContent = Math.max(0, clean);
      document.getElementById("compAdjacentCount").textContent = adjacent.length;

      // Render flagged entities list
      const list = document.getElementById("compFlaggedList");
      if (flagged.length) {
        list.innerHTML = flagged.map(n => `
          <div class="comp-flagged-entity">
            <span class="comp-result-badge sanctioned">FLAGGED</span>
            <span class="comp-flagged-name">${escapeHtml(n.displayName)}</span>
            <span class="comp-flagged-type">${n.type}</span>
          </div>
        `).join("");

        // Show adjacent entities too
        if (adjacent.length) {
          list.innerHTML += `<div style="margin-top:8px;"><span class="intel-section-title" style="margin:0;">Sanctions-Adjacent Entities</span></div>`;
          list.innerHTML += adjacent.map(n => `
            <div class="comp-flagged-entity adjacent">
              <span class="comp-result-badge adjacent">ADJACENT</span>
              <span class="comp-flagged-name">${escapeHtml(n.displayName)}</span>
              <span class="comp-flagged-type">${n.type}</span>
            </div>
          `).join("");
        }
      } else {
        list.innerHTML = '<div class="comp-empty">No flagged entities. Run "Screen All" to check your KG.</div>';
      }
    } catch (e) {
      console.warn("[Compliance] KG summary error:", e);
    }
  }

  // ── Litigation Search (stub — CourtListener not yet implemented) ──

  document.getElementById("compLitigationBtn").addEventListener("click", () => litigationSearch());
  document.getElementById("compLitigationInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") litigationSearch();
  });

  async function litigationSearch() {
    const query = document.getElementById("compLitigationInput").value.trim();
    if (!query) return;

    const container = document.getElementById("compLitigationResults");
    const empty = document.getElementById("compLitigationEmpty");

    // Clear previous result cards (preserve the empty div — it lives inside the container)
    container.querySelectorAll(".comp-result-card, .comp-error").forEach(el => el.remove());
    empty.style.display = "none";
    document.getElementById("compLitigationCount").textContent = "";

    const btn = document.getElementById("compLitigationBtn");
    try {
      btn.disabled = true;
      btn.textContent = "Searching...";

      const searchResp = await browser.runtime.sendMessage({
        action: "intelSearch", provider: "courtlistener", query, options: { pageSize: 20 }
      });

      btn.disabled = false;
      btn.textContent = "Search";

      if (searchResp?.success && searchResp.results) {
        const results = searchResp.results.results || [];
        const total = searchResp.results.count || 0;
        const countEl = document.getElementById("compLitigationCount");
        countEl.textContent = `${total} result${total !== 1 ? "s" : ""}`;

        if (!results.length) {
          empty.style.display = "";
          empty.textContent = "No court records found.";
        } else {
          empty.style.display = "none";
          const cards = results.map((r, i) => {
            const name = r.caseName || r.caseNameFull || "Untitled";
            const court = r.court || "";
            const date = r.dateFiled || "";
            const citations = (r.citation || []).join(", ");
            const citeCount = r.citeCount || 0;
            const url = r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : "#";
            const snippet = r.snippet || "";

            return `<div class="comp-result-card">
              <div class="comp-result-header">
                <span class="comp-result-name"><a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none;">${escapeHtml(name)}</a></span>
                ${citeCount > 0 ? `<span class="comp-result-score">${citeCount} cites</span>` : ""}
              </div>
              <div class="comp-result-datasets">${escapeHtml(court)} ${date ? "· " + escapeHtml(date) : ""} ${citations ? "· " + escapeHtml(citations) : ""}</div>
              ${snippet ? `<div class="comp-result-details" style="margin-top:4px;font-size:11px;color:var(--text-secondary);">${snippet}</div>` : ""}
              <div class="comp-result-actions">
                <button class="pill-chip comp-lit-kg-btn" data-name="${escapeAttr(name)}" data-url="${escapeAttr(url)}">Add to KG</button>
              </div>
            </div>`;
          }).join("");
          container.insertAdjacentHTML("beforeend", cards);

          container.querySelectorAll(".comp-lit-kg-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
              await browser.runtime.sendMessage({
                action: "extractAndUpsert",
                text: btn.dataset.name,
                pageUrl: btn.dataset.url,
                pageTitle: `CourtListener — ${btn.dataset.name}`
              });
              btn.textContent = "Added!";
              setTimeout(() => { btn.textContent = "Add to KG"; }, 2000);
            });
          });
        }
      } else {
        empty.style.display = "";
        empty.textContent = `Error: ${searchResp?.error || "Search failed"}`;
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Search";
      empty.style.display = "";
      empty.innerHTML = e.message.includes("API key") || e.message.includes("not configured")
        ? `CourtListener API key not configured. <a href="../options/options.html#intel-providers" style="color:var(--accent);">Add your key in Settings ↗</a>`
        : `Error: ${escapeHtml(e.message)}`;
    }
  }

  // ── AI Chat Context ──

  function gatherComplianceContext() {
    const lines = ["Compliance Intelligence Page\n"];

    if (sanctionsResults.length) {
      lines.push(`== Sanctions Search Results (${sanctionsResults.length}) ==`);
      for (const r of sanctionsResults.slice(0, 15)) {
        const name = (r.properties?.name || [r.caption || "Unknown"])[0];
        const datasets = (r.datasets || []).join(", ");
        const score = r.score != null ? `${Math.round(r.score * 100)}%` : "";
        lines.push(`- ${name} | ${datasets} ${score}`);
      }
    }

    if (matchResults.length) {
      lines.push(`\n== Entity Match Results (${matchResults.length}) ==`);
      for (const r of matchResults.slice(0, 10)) {
        const name = (r.properties?.name || [r.caption || "Unknown"])[0];
        const score = r.score != null ? `${Math.round(r.score * 100)}%` : "";
        lines.push(`- ${name} ${score}`);
      }
    }

    lines.push(`\n== KG Screening Summary ==`);
    lines.push(`Flagged: ${screeningSummary.flagged.length || 0}`);
    lines.push(`Clean: ${screeningSummary.clean}`);
    lines.push(`Adjacent: ${screeningSummary.adjacent}`);

    if (screeningSummary.flagged.length) {
      lines.push(`Flagged entities: ${screeningSummary.flagged.map(n => n.displayName).join(", ")}`);
    }

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
    // Load last screened timestamp
    const { compLastScreened } = await browser.storage.local.get({ compLastScreened: null });
    if (compLastScreened) {
      document.getElementById("compScreenTimestamp").textContent =
        `Last screened: ${new Date(compLastScreened).toLocaleString()}`;
    }

    // Load KG screening summary
    await loadScreeningSummary();

    // Update litigation placeholder based on CourtListener config status
    try {
      const statusResp = await browser.runtime.sendMessage({ action: "intelGetStatus" });
      const cl = statusResp?.providers?.courtlistener;
      const litEmpty = document.getElementById("compLitigationEmpty");
      if (litEmpty) {
        if (cl?.configured) {
          litEmpty.textContent = "Search for court cases, opinions, and dockets. Enter a name or case number above.";
        } else {
          litEmpty.innerHTML = `CourtListener API key not configured. Get a free token at <a href="https://www.courtlistener.com/profile/api-token/" target="_blank" style="color:var(--accent);">courtlistener.com ↗</a>, then add it in <a href="../options/options.html" style="color:var(--accent);">Settings → Providers</a>.`;
        }
      }
    } catch { /* background not ready */ }

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
