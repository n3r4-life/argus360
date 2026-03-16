// ──────────────────────────────────────────────
// Intelligence Providers — OpenSanctions, SEC EDGAR, + stubs
// Each provider: { isConnected, connect, disconnect, testConnection, ...methods }
// User provides their own credentials — zero data flows through Argus infrastructure.
// ──────────────────────────────────────────────

const IntelProviders = (() => {
  "use strict";

  const STORAGE_KEY = "argusIntelProviders";

  async function getConfig() {
    const data = await browser.storage.local.get({ [STORAGE_KEY]: {} });
    return data[STORAGE_KEY] || {};
  }

  async function saveConfig(cfg) {
    await browser.storage.local.set({ [STORAGE_KEY]: cfg });
  }

  async function getProviderConfig(key) {
    const cfg = await getConfig();
    return cfg[key] || {};
  }

  async function saveProviderConfig(key, data) {
    const cfg = await getConfig();
    cfg[key] = { ...cfg[key], ...data };
    await saveConfig(cfg);
  }

  async function clearProviderConfig(key) {
    const cfg = await getConfig();
    delete cfg[key];
    await saveConfig(cfg);
  }

  // ── Activity log helper ──

  async function logActivity(type, label, entityId) {
    const { intelActivityLog = [] } = await browser.storage.local.get({ intelActivityLog: [] });
    intelActivityLog.unshift({ type, label, entityId: entityId || null, ts: Date.now() });
    if (intelActivityLog.length > 100) intelActivityLog.length = 100;
    await browser.storage.local.set({ intelActivityLog });
  }

  // ── Provider metadata ──

  const PROVIDER_META = {
    opensanctions: { label: "OpenSanctions",  domain: "compliance", zeroConfig: true },
    secedgar:      { label: "SEC EDGAR",       domain: "finance",    zeroConfig: true },
    courtlistener: { label: "CourtListener",   domain: "compliance", zeroConfig: false },
    opensky:       { label: "OpenSky",         domain: "movement",   zeroConfig: false },
    adsbexchange:  { label: "ADS-B Exchange",  domain: "movement",   zeroConfig: false },
    marinetraffic: { label: "MarineTraffic",   domain: "movement",   zeroConfig: false },
    gdelt:         { label: "GDELT",           domain: "events",     zeroConfig: false },
    sentinelhub:   { label: "Sentinel Hub",    domain: "satellite",  zeroConfig: false },
    opencorporates:{ label: "OpenCorporates",  domain: "finance",    zeroConfig: false },
    gleif:         { label: "GLEIF",           domain: "finance",    zeroConfig: false },
    blockstream:   { label: "Blockstream",     domain: "finance",    zeroConfig: false },
    broadcastify:  { label: "Broadcastify",    domain: "movement",   zeroConfig: false },
  };

  // ─── OpenSanctions (live) ───

  const opensanctions = {
    async isConnected() {
      return true; // zero-config provider
    },

    async connect(apiKey) {
      await saveProviderConfig("opensanctions", { apiKey: apiKey || "", connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("opensanctions");
      return { success: true };
    },

    async testConnection() {
      const resp = await fetch("https://api.opensanctions.org/healthz");
      if (!resp.ok) throw new Error(`OpenSanctions health check failed: ${resp.status}`);
      return { success: true };
    },

    async search(query, dataset = "default") {
      const cfg = await getProviderConfig("opensanctions");
      const headers = {};
      if (cfg.apiKey) headers["Authorization"] = `ApiKey ${cfg.apiKey}`;
      const url = `https://api.opensanctions.org/search/${encodeURIComponent(dataset)}?q=${encodeURIComponent(query)}&limit=10`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`OpenSanctions search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `Sanctions search: ${query}`, null);
      return data;
    },

    async match(entity) {
      const cfg = await getProviderConfig("opensanctions");
      const headers = { "Content-Type": "application/json" };
      if (cfg.apiKey) headers["Authorization"] = `ApiKey ${cfg.apiKey}`;
      const resp = await fetch("https://api.opensanctions.org/match/default", {
        method: "POST",
        headers,
        body: JSON.stringify(entity),
      });
      if (!resp.ok) throw new Error(`OpenSanctions match failed: ${resp.status}`);
      return resp.json();
    },
  };

  // ─── SEC EDGAR (live) ───

  const secedgar = {
    _headers: { "User-Agent": "Argus/1.0 contact@example.com" },

    async isConnected() {
      return true; // zero-config provider
    },

    async connect() {
      await saveProviderConfig("secedgar", { connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("secedgar");
      return { success: true };
    },

    async testConnection() {
      const resp = await fetch(
        "https://efts.sec.gov/LATEST/search-index?q=test&dateRange=custom&startdt=2024-01-01&enddt=2024-01-02",
        { headers: this._headers }
      );
      if (!resp.ok) throw new Error(`SEC EDGAR connection failed: ${resp.status}`);
      return { success: true };
    },

    async searchCompany(name) {
      const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(name)}&category=form-type&forms=10-K`;
      const resp = await fetch(url, { headers: this._headers });
      if (!resp.ok) throw new Error(`SEC EDGAR company search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `SEC search: ${name}`, null);
      return data;
    },

    async getFilings(cik) {
      const padded = String(cik).padStart(10, "0");
      const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
      const resp = await fetch(url, { headers: this._headers });
      if (!resp.ok) throw new Error(`SEC EDGAR filings fetch failed: ${resp.status}`);
      return resp.json();
    },

    async getCompanyFacts(cik) {
      const padded = String(cik).padStart(10, "0");
      const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`;
      const resp = await fetch(url, { headers: this._headers });
      if (!resp.ok) throw new Error(`SEC EDGAR company facts failed: ${resp.status}`);
      return resp.json();
    },
  };

  // ─── Stub provider factory ───

  function makeStub(key) {
    return {
      async isConnected() {
        const cfg = await getProviderConfig(key);
        return !!(cfg.connected && cfg.apiKey);
      },
      async connect(apiKey) {
        await saveProviderConfig(key, { apiKey, connected: true });
        return { success: true };
      },
      async disconnect() {
        await clearProviderConfig(key);
        return { success: true };
      },
      async testConnection() {
        const cfg = await getProviderConfig(key);
        if (!cfg.apiKey) throw new Error(`${PROVIDER_META[key]?.label || key} API key not configured`);
        return { success: false, error: "Not yet implemented" };
      },
    };
  }

  // ─── Stub providers ───

  const courtlistener  = makeStub("courtlistener");
  const opensky        = makeStub("opensky");
  const adsbexchange   = makeStub("adsbexchange");
  const marinetraffic  = makeStub("marinetraffic");
  const gdelt          = makeStub("gdelt");
  const sentinelhub    = makeStub("sentinelhub");
  const opencorporates = makeStub("opencorporates");
  const gleif          = makeStub("gleif");
  const blockstream    = makeStub("blockstream");
  const broadcastify   = makeStub("broadcastify");

  // ── Public API ──

  return {
    PROVIDER_META,
    getProviderConfig,
    saveProviderConfig,
    clearProviderConfig,
    logActivity,
    opensanctions,
    secedgar,
    courtlistener,
    opensky,
    adsbexchange,
    marinetraffic,
    gdelt,
    sentinelhub,
    opencorporates,
    gleif,
    blockstream,
    broadcastify,
  };
})();
