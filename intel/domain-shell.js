// Shared initialization for intel domain page shells
const IntelDomainShell = {
  async init(domain, providerKeys) {
    try {
      const resp = await browser.runtime.sendMessage({ action: "intelGetStatus" });
      if (!resp?.providers) return;

      const container = document.getElementById("intel-page-providers");
      const notConfigured = document.getElementById("intel-not-configured");
      if (!container) return;

      let anyConfigured = false;
      container.innerHTML = "";

      for (const key of providerKeys) {
        const info = resp.providers[key];
        if (!info) continue;

        const statusClass = info.status === "connected" ? "green"
          : info.status === "error" ? "amber" : "grey";

        if (info.status === "connected") anyConfigured = true;

        const dot = document.createElement("div");
        dot.className = "intel-provider-dot";
        dot.innerHTML = `<span class="intel-dot ${statusClass}"></span><span class="intel-dot-label">${info.label}</span>`;
        container.appendChild(dot);
      }

      if (!anyConfigured && notConfigured) {
        notConfigured.classList.remove("hidden");
      }
    } catch (e) {
      console.warn(`[Intel ${domain}] Failed to load provider status:`, e);
    }
  }
};
