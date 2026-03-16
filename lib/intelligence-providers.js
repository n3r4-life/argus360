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
    opensky:       { label: "OpenSky",         domain: "movement",   zeroConfig: false },  // anonymous access works with limits
    adsbexchange:  { label: "ADS-B Exchange",  domain: "movement",   zeroConfig: false },
    marinetraffic: { label: "MarineTraffic",   domain: "movement",   zeroConfig: false },
    gdelt:         { label: "GDELT",           domain: "events",     zeroConfig: true },
    sentinelhub:   { label: "Sentinel Hub",    domain: "satellite",  zeroConfig: false },
    opencorporates:{ label: "OpenCorporates",  domain: "finance",    zeroConfig: false },
    gleif:         { label: "GLEIF",           domain: "finance",    zeroConfig: true },
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

  // ─── OpenSky Network (live — anonymous or authenticated) ───

  const opensky = {
    async isConnected() {
      const cfg = await getProviderConfig("opensky");
      return true; // anonymous access always works (limited)
    },

    async connect(username, password) {
      await saveProviderConfig("opensky", { username, password, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("opensky");
      return { success: true };
    },

    async _headers() {
      const cfg = await getProviderConfig("opensky");
      if (cfg.username && cfg.password) {
        return { Authorization: "Basic " + btoa(`${cfg.username}:${cfg.password}`) };
      }
      return {};
    },

    async testConnection() {
      const headers = await this._headers();
      const resp = await fetch("https://opensky-network.org/api/states/all?lamin=51&lamax=52&lomin=-1&lomax=1", { headers });
      if (!resp.ok) throw new Error(`OpenSky connection failed: ${resp.status}`);
      return { success: true };
    },

    async getLiveStates(options = {}) {
      const headers = await this._headers();
      const params = new URLSearchParams();
      if (options.icao24) params.set("icao24", options.icao24);
      if (options.lamin != null) params.set("lamin", options.lamin);
      if (options.lamax != null) params.set("lamax", options.lamax);
      if (options.lomin != null) params.set("lomin", options.lomin);
      if (options.lomax != null) params.set("lomax", options.lomax);
      const url = `https://opensky-network.org/api/states/all?${params}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`OpenSky states failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `OpenSky: ${data.states?.length || 0} aircraft`, null);
      return data;
    },

    async getFlights(icao24, begin, end) {
      const headers = await this._headers();
      const url = `https://opensky-network.org/api/flights/aircraft?icao24=${encodeURIComponent(icao24)}&begin=${begin}&end=${end}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`OpenSky flights failed: ${resp.status}`);
      return resp.json();
    },

    async getTrack(icao24, time) {
      const headers = await this._headers();
      const url = `https://opensky-network.org/api/tracks/all?icao24=${encodeURIComponent(icao24)}&time=${time || 0}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`OpenSky track failed: ${resp.status}`);
      return resp.json();
    },
  };

  // ─── CourtListener (live — requires API token) ───

  const courtlistener = {
    async isConnected() {
      const cfg = await getProviderConfig("courtlistener");
      return !!(cfg.connected && cfg.apiKey);
    },

    async connect(apiKey) {
      await saveProviderConfig("courtlistener", { apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("courtlistener");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("courtlistener");
      if (!cfg.apiKey) throw new Error("CourtListener API token not configured");
      const resp = await fetch("https://www.courtlistener.com/api/rest/v4/search/?q=test&type=o&page_size=1", {
        headers: { Authorization: `Token ${cfg.apiKey}` },
      });
      if (!resp.ok) throw new Error(`CourtListener connection failed: ${resp.status}`);
      return { success: true };
    },

    async searchOpinions(query, options = {}) {
      const cfg = await getProviderConfig("courtlistener");
      if (!cfg.apiKey) throw new Error("CourtListener API token not configured");
      const params = new URLSearchParams({ q: query, type: "o" });
      if (options.court) params.set("court", options.court);
      if (options.filedAfter) params.set("filed_after", options.filedAfter);
      if (options.filedBefore) params.set("filed_before", options.filedBefore);
      if (options.orderBy) params.set("order_by", options.orderBy);
      params.set("page_size", String(options.pageSize || 20));
      const url = `https://www.courtlistener.com/api/rest/v4/search/?${params}`;
      const resp = await fetch(url, { headers: { Authorization: `Token ${cfg.apiKey}` } });
      if (!resp.ok) throw new Error(`CourtListener search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `Court search: ${query} (${data.count || 0} results)`, null);
      return data;
    },

    async searchDockets(query, options = {}) {
      const cfg = await getProviderConfig("courtlistener");
      if (!cfg.apiKey) throw new Error("CourtListener API token not configured");
      const params = new URLSearchParams({ q: query, type: "r" });
      if (options.court) params.set("court", options.court);
      params.set("page_size", String(options.pageSize || 20));
      const url = `https://www.courtlistener.com/api/rest/v4/search/?${params}`;
      const resp = await fetch(url, { headers: { Authorization: `Token ${cfg.apiKey}` } });
      if (!resp.ok) throw new Error(`CourtListener docket search failed: ${resp.status}`);
      return resp.json();
    },
  };

  // ─── OpenCorporates (live — requires API token) ───

  const opencorporates = {
    async isConnected() {
      const cfg = await getProviderConfig("opencorporates");
      return !!(cfg.connected && cfg.apiKey);
    },

    async connect(apiKey) {
      await saveProviderConfig("opencorporates", { apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("opencorporates");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("opencorporates");
      if (!cfg.apiKey) throw new Error("OpenCorporates API key not configured");
      const resp = await fetch(`https://api.opencorporates.com/v0.4.8/companies/search?q=test&per_page=1&api_token=${cfg.apiKey}`);
      if (!resp.ok) throw new Error(`OpenCorporates connection failed: ${resp.status}`);
      return { success: true };
    },

    async searchCompanies(query, options = {}) {
      const cfg = await getProviderConfig("opencorporates");
      if (!cfg.apiKey) throw new Error("OpenCorporates API key not configured");
      const params = new URLSearchParams({
        q: query,
        per_page: String(options.perPage || 30),
        api_token: cfg.apiKey,
      });
      if (options.jurisdiction) params.set("jurisdiction_code", options.jurisdiction);
      if (options.status) params.set("current_status", options.status);
      const url = `https://api.opencorporates.com/v0.4.8/companies/search?${params}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`OpenCorporates search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `OpenCorp: ${query} (${data.results?.total_count || 0} results)`, null);
      return data;
    },

    async getCompany(jurisdiction, companyNumber) {
      const cfg = await getProviderConfig("opencorporates");
      if (!cfg.apiKey) throw new Error("OpenCorporates API key not configured");
      const url = `https://api.opencorporates.com/v0.4.8/companies/${jurisdiction}/${companyNumber}?api_token=${cfg.apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`OpenCorporates company fetch failed: ${resp.status}`);
      return resp.json();
    },

    async searchOfficers(query, options = {}) {
      const cfg = await getProviderConfig("opencorporates");
      if (!cfg.apiKey) throw new Error("OpenCorporates API key not configured");
      const params = new URLSearchParams({
        q: query,
        api_token: cfg.apiKey,
      });
      if (options.jurisdiction) params.set("jurisdiction_code", options.jurisdiction);
      const url = `https://api.opencorporates.com/v0.4.8/officers/search?${params}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`OpenCorporates officer search failed: ${resp.status}`);
      return resp.json();
    },
  };

  // ─── GLEIF (live — free, no API key) ───

  const gleif = {
    async isConnected() {
      return true; // zero-config
    },

    async connect() {
      await saveProviderConfig("gleif", { connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("gleif");
      return { success: true };
    },

    async testConnection() {
      const resp = await fetch("https://api.gleif.org/api/v1/lei-records?page[size]=1&filter[fulltext]=test");
      if (!resp.ok) throw new Error(`GLEIF connection failed: ${resp.status}`);
      return { success: true };
    },

    async searchByName(query, options = {}) {
      const params = new URLSearchParams({
        "filter[fulltext]": query,
        "page[size]": String(options.pageSize || 20),
      });
      if (options.country) params.set("filter[entity.legalAddress.country]", options.country);
      if (options.status) params.set("filter[entity.status]", options.status);
      const url = `https://api.gleif.org/api/v1/lei-records?${params}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`GLEIF search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `GLEIF: ${query} (${data.meta?.pagination?.total || 0} results)`, null);
      return data;
    },

    async getLei(lei) {
      const resp = await fetch(`https://api.gleif.org/api/v1/lei-records/${lei}`);
      if (!resp.ok) throw new Error(`GLEIF LEI fetch failed: ${resp.status}`);
      return resp.json();
    },

    async getParent(lei) {
      const resp = await fetch(`https://api.gleif.org/api/v1/lei-records/${lei}/direct-parent`);
      if (!resp.ok) throw new Error(`GLEIF parent fetch failed: ${resp.status}`);
      return resp.json();
    },

    async getUltimateParent(lei) {
      const resp = await fetch(`https://api.gleif.org/api/v1/lei-records/${lei}/ultimate-parent`);
      if (!resp.ok) throw new Error(`GLEIF ultimate parent fetch failed: ${resp.status}`);
      return resp.json();
    },
  };

  // ─── Remaining stubs ───

  const adsbexchange   = makeStub("adsbexchange");
  const marinetraffic  = makeStub("marinetraffic");
  // ─── GDELT (live — free, no API key, CORS enabled) ───

  const GDELT_BASE = "https://api.gdeltproject.org/api/v2";

  const gdelt = {
    async isConnected() {
      return true; // zero-config, always available
    },

    async connect() {
      await saveProviderConfig("gdelt", { connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("gdelt");
      return { success: true };
    },

    async testConnection() {
      const resp = await fetch(`${GDELT_BASE}/doc/doc?query=test&mode=ArtList&format=json&maxrecords=1`);
      if (!resp.ok) throw new Error(`GDELT connection failed: ${resp.status}`);
      return { success: true };
    },

    async searchArticles(query, options = {}) {
      const params = new URLSearchParams({
        query,
        mode: "ArtList",
        format: "json",
        maxrecords: String(options.maxRecords || 50),
        sort: options.sort || "DateDesc",
      });
      if (options.timespan) params.set("timespan", options.timespan);
      if (options.startDate) params.set("STARTDATETIME", options.startDate);
      if (options.endDate) params.set("ENDDATETIME", options.endDate);
      if (options.sourceLang) params.set("sourcelang", options.sourceLang);

      const resp = await fetch(`${GDELT_BASE}/doc/doc?${params}`);
      if (!resp.ok) throw new Error(`GDELT article search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `GDELT articles: ${query}`, null);
      return data;
    },

    async getTimelineVolume(query, options = {}) {
      const params = new URLSearchParams({
        query,
        mode: options.raw ? "TimelineVolRaw" : "TimelineVol",
        format: "json",
      });
      if (options.timespan) params.set("timespan", options.timespan);
      if (options.startDate) params.set("STARTDATETIME", options.startDate);
      if (options.endDate) params.set("ENDDATETIME", options.endDate);
      if (options.smooth) params.set("TIMELINESMOOTH", String(options.smooth));

      const resp = await fetch(`${GDELT_BASE}/doc/doc?${params}`);
      if (!resp.ok) throw new Error(`GDELT timeline failed: ${resp.status}`);
      return resp.json();
    },

    async getTimelineTone(query, options = {}) {
      const params = new URLSearchParams({
        query,
        mode: "TimelineTone",
        format: "json",
      });
      if (options.timespan) params.set("timespan", options.timespan);
      if (options.startDate) params.set("STARTDATETIME", options.startDate);
      if (options.endDate) params.set("ENDDATETIME", options.endDate);

      const resp = await fetch(`${GDELT_BASE}/doc/doc?${params}`);
      if (!resp.ok) throw new Error(`GDELT tone timeline failed: ${resp.status}`);
      return resp.json();
    },

    async getTimelineCountry(query, options = {}) {
      const params = new URLSearchParams({
        query,
        mode: "TimelineSourceCountry",
        format: "json",
      });
      if (options.timespan) params.set("timespan", options.timespan);

      const resp = await fetch(`${GDELT_BASE}/doc/doc?${params}`);
      if (!resp.ok) throw new Error(`GDELT country timeline failed: ${resp.status}`);
      return resp.json();
    },

    async getGeo(query, options = {}) {
      const params = new URLSearchParams({
        query,
        mode: options.mode || "PointData",
        format: "GeoJSON",
        maxpoints: String(options.maxPoints || 250),
      });
      if (options.timespan) params.set("timespan", options.timespan);

      const resp = await fetch(`${GDELT_BASE}/geo/geo?${params}`);
      if (!resp.ok) throw new Error(`GDELT geo failed: ${resp.status}`);
      return resp.json();
    },
  };

  const sentinelhub    = makeStub("sentinelhub");
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
