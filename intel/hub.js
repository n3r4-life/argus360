(function () {
  'use strict';

  const DOMAIN_PROVIDERS = {
    compliance: ["opensanctions", "courtlistener"],
    movement:   ["opensky", "adsbexchange", "marinetraffic", "broadcastify"],
    events:     ["gdelt"],
    satellite:  ["sentinelhub"],
  };

  // ── Provider status grid ──

  async function loadProviderStatus() {
    try {
      const resp = await browser.runtime.sendMessage({ action: "intelGetStatus" });
      if (!resp?.providers) return;

      const grid = document.getElementById("intel-provider-grid");
      grid.innerHTML = "";

      for (const [key, info] of Object.entries(resp.providers)) {
        const dot = document.createElement("div");
        dot.className = "intel-provider-dot";

        const statusClass = info.status === "connected" ? "green"
          : info.status === "error" ? "amber" : "grey";

        dot.innerHTML = `<span class="intel-dot ${statusClass}"></span><span class="intel-dot-label">${info.label}</span>`;
        grid.appendChild(dot);
      }

      // Update domain cards
      for (const [domain, providerKeys] of Object.entries(DOMAIN_PROVIDERS)) {
        const container = document.getElementById(`domain-${domain}-providers`);
        const link = document.getElementById(`domain-${domain}-link`);
        if (!container) continue;

        let configuredCount = 0;
        container.innerHTML = "";

        for (const pk of providerKeys) {
          const info = resp.providers[pk];
          if (!info) continue;
          if (info.status === "connected") configuredCount++;
          const statusClass = info.status === "connected" ? "green"
            : info.status === "error" ? "amber" : "grey";
          container.innerHTML += `<span class="intel-dot ${statusClass}" title="${info.label}"></span>`;
        }

        container.innerHTML += `<span class="intel-domain-count">${configuredCount}/${providerKeys.length} providers</span>`;

        // If all unconfigured, show "Setup →" instead
        if (configuredCount === 0 && link) {
          link.textContent = "Setup →";
          link.href = "../options/options.html#intel-providers";
        }
      }
    } catch (e) {
      console.warn("[Intel Hub] Failed to load provider status:", e);
    }
  }

  // ── Activity feed ──

  async function loadActivityFeed() {
    try {
      const { intelActivityLog = [] } = await browser.storage.local.get({ intelActivityLog: [] });
      const feed = document.getElementById("intel-activity-feed");

      if (intelActivityLog.length === 0) {
        feed.innerHTML = '<p class="intel-empty">No intelligence activity yet.</p>';
        return;
      }

      const recent = intelActivityLog.slice(0, 10);
      feed.innerHTML = recent.map(item => {
        const time = new Date(item.ts).toLocaleString();
        return `<div class="intel-activity-item">
          <span class="intel-activity-type">${item.type}</span>
          <span class="intel-activity-label">${item.label}</span>
          <span class="intel-activity-time">${time}</span>
        </div>`;
      }).join("");
    } catch (e) {
      console.warn("[Intel Hub] Failed to load activity:", e);
    }
  }

  // ── Quick actions ──

  function initQuickActions() {
    const screenBtn = document.getElementById("intel-screen-all");
    const kgBtn = document.getElementById("intel-open-kg");
    const progress = document.getElementById("intel-screen-progress");

    screenBtn.addEventListener("click", async () => {
      screenBtn.disabled = true;
      screenBtn.textContent = "Screening...";
      progress.classList.remove("hidden");
      progress.textContent = "Running sanctions screening on all entities...";

      try {
        const resp = await browser.runtime.sendMessage({ action: "intelScreenAll" });
        if (resp?.success) {
          progress.textContent = `Done — screened ${resp.screened} entities, ${resp.flagged} flagged.`;
          await loadActivityFeed();
        } else {
          progress.textContent = `Error: ${resp?.error || "Unknown error"}`;
        }
      } catch (e) {
        progress.textContent = `Error: ${e.message}`;
      }

      screenBtn.disabled = false;
      screenBtn.textContent = "Screen All Entities";
    });

    kgBtn.addEventListener("click", () => {
      window.location.href = "../osint/graph.html";
    });
  }

  // ── Init ──

  document.addEventListener("DOMContentLoaded", () => {
    loadProviderStatus();
    loadActivityFeed();
    initQuickActions();

    // AI Chat
    if (typeof ArgusChat !== "undefined") {
      ArgusChat.init({
        container: document.getElementById("argus-chat-container"),
        contextType: "Intelligence Hub",
        contextData: "Intelligence Hub — central dashboard for all intel providers. OpenSanctions and SEC EDGAR are live. Providers: sanctions screening, court records, aviation/maritime tracking, GDELT events, satellite imagery.",
        pageUrl: window.location.href,
        pageTitle: "Intelligence Hub — Argus"
      });
    }
  });
})();
