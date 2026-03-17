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
    opensanctions: { label: "OpenSanctions",  domain: "compliance", zeroConfig: false },
    secedgar:      { label: "SEC EDGAR",       domain: "finance",    zeroConfig: true },
    courtlistener: { label: "CourtListener",   domain: "compliance", zeroConfig: false },
    opensky:       { label: "OpenSky",         domain: "movement",   zeroConfig: false },  // anonymous access works with limits
    adsbexchange:  { label: "ADS-B Exchange",  domain: "movement",   zeroConfig: false },
    marinetraffic: { label: "MarineTraffic",   domain: "movement",   zeroConfig: false },
    gdelt:         { label: "GDELT",           domain: "events",     zeroConfig: true },
    sentinelhub:   { label: "Sentinel Hub",    domain: "satellite",  zeroConfig: false },  // Copernicus Data Space OAuth2
    opencorporates:{ label: "OpenCorporates",  domain: "finance",    zeroConfig: false },
    gleif:         { label: "GLEIF",           domain: "finance",    zeroConfig: true },
    blockstream:   { label: "Blockstream",     domain: "finance",    zeroConfig: false },
    broadcastify:  { label: "Broadcastify",    domain: "movement",   zeroConfig: false },
    flightaware:   { label: "FlightAware",    domain: "movement",   zeroConfig: false },
    vesselfinder:  { label: "VesselFinder",   domain: "movement",   zeroConfig: false },
    wigle:         { label: "WiGLE",           domain: "satellite",  zeroConfig: false },
  };

  // ─── OpenSanctions (live) ───

  const opensanctions = {
    async isConnected() {
      const cfg = await getProviderConfig("opensanctions");
      return !!(cfg.apiKey);
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
      if (!cfg.apiKey) throw new Error("OpenSanctions API key required — get a free key at opensanctions.org/api/");
      const headers = { "Authorization": `ApiKey ${cfg.apiKey}` };
      const url = `https://api.opensanctions.org/search/${encodeURIComponent(dataset)}?q=${encodeURIComponent(query)}&limit=10`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`OpenSanctions search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `Sanctions search: ${query}`, null);
      return data;
    },

    async match(entity) {
      const cfg = await getProviderConfig("opensanctions");
      if (!cfg.apiKey) throw new Error("OpenSanctions API key required — get a free key at opensanctions.org/api/");
      const headers = { "Content-Type": "application/json", "Authorization": `ApiKey ${cfg.apiKey}` };
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
      const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(name)}%22`;
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
        return !!(cfg.apiKey || cfg.connected);
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

    async _getToken() {
      const cfg = await getProviderConfig("opensky");
      if (!cfg.clientId || !cfg.clientSecret) return null;

      // Check cached token
      if (cfg._token && cfg._tokenExpires && Date.now() < cfg._tokenExpires) {
        return cfg._token;
      }

      // Exchange client credentials for bearer token
      const resp = await fetch("https://opensky-network.org/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=client_credentials&client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}`,
      });
      if (!resp.ok) throw new Error(`OpenSky OAuth failed: ${resp.status}`);
      const data = await resp.json();
      // Cache token (expires in ~30 min, we cache for 25 min)
      await saveProviderConfig("opensky", {
        _token: data.access_token,
        _tokenExpires: Date.now() + (data.expires_in ? (data.expires_in - 300) * 1000 : 25 * 60 * 1000),
      });
      return data.access_token;
    },

    async _headers() {
      try {
        const token = await this._getToken();
        if (token) return { Authorization: `Bearer ${token}` };
      } catch { /* fall back to anonymous */ }
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
      return !!(cfg.apiKey || cfg.connected);
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
      return !!(cfg.apiKey || cfg.connected);
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
  // Note: VesselFinder is handled via vessel-lookup.js, not as an intel provider
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

  // ─── FlightAware AeroAPI (live — requires API key) ───

  const FA_BASE = "https://aeroapi.flightaware.com/aeroapi";

  const flightaware = {
    async isConnected() {
      const cfg = await getProviderConfig("flightaware");
      return !!(cfg.apiKey || cfg.connected);
    },

    async connect(apiKey) {
      await saveProviderConfig("flightaware", { apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("flightaware");
      return { success: true };
    },

    async _headers() {
      const cfg = await getProviderConfig("flightaware");
      if (!cfg.apiKey) throw new Error("FlightAware API key not configured");
      return { "x-apikey": cfg.apiKey, "Accept": "application/json" };
    },

    async testConnection() {
      const headers = await this._headers();
      const resp = await fetch(`${FA_BASE}/airports/KJFK`, { headers });
      if (!resp.ok) throw new Error(`FlightAware connection failed: ${resp.status}`);
      return { success: true };
    },

    async searchFlights(ident, options = {}) {
      const headers = await this._headers();
      const params = new URLSearchParams();
      if (options.identType) params.set("ident_type", options.identType);
      if (options.start) params.set("start", options.start);
      if (options.end) params.set("end", options.end);
      const qs = params.toString() ? `?${params}` : "";
      const resp = await fetch(`${FA_BASE}/flights/${encodeURIComponent(ident)}${qs}`, { headers });
      if (!resp.ok) throw new Error(`FlightAware search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `FlightAware: ${ident} (${data.flights?.length || 0} flights)`, null);
      return data;
    },

    async getFlightTrack(faFlightId) {
      const headers = await this._headers();
      const resp = await fetch(`${FA_BASE}/flights/${encodeURIComponent(faFlightId)}/track`, { headers });
      if (!resp.ok) throw new Error(`FlightAware track failed: ${resp.status}`);
      return resp.json();
    },

    async getFlightPosition(faFlightId) {
      const headers = await this._headers();
      const resp = await fetch(`${FA_BASE}/flights/${encodeURIComponent(faFlightId)}/position`, { headers });
      if (!resp.ok) throw new Error(`FlightAware position failed: ${resp.status}`);
      return resp.json();
    },

    async getLastFlight(registration) {
      const headers = await this._headers();
      const resp = await fetch(`${FA_BASE}/history/aircraft/${encodeURIComponent(registration)}/last_flight`, { headers });
      if (!resp.ok) throw new Error(`FlightAware last flight failed: ${resp.status}`);
      return resp.json();
    },

    async getAirportFlights(airportCode, type = "departures") {
      const headers = await this._headers();
      const resp = await fetch(`${FA_BASE}/airports/${encodeURIComponent(airportCode)}/flights/${type}`, { headers });
      if (!resp.ok) throw new Error(`FlightAware airport flights failed: ${resp.status}`);
      return resp.json();
    },
  };

  // ─── Sentinel Hub / Copernicus Data Space (live — OAuth2 client credentials) ───

  const SH_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
  const SH_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";
  const SH_CATALOG_URL = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";

  const sentinelhub = {
    async isConnected() {
      const cfg = await getProviderConfig("sentinelhub");
      return !!(cfg.clientId && cfg.clientSecret);
    },

    async connect(clientId, clientSecret, instanceId) {
      await saveProviderConfig("sentinelhub", { clientId, clientSecret, instanceId, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("sentinelhub");
      return { success: true };
    },

    async _getToken() {
      const cfg = await getProviderConfig("sentinelhub");
      if (!cfg.clientId || !cfg.clientSecret) throw new Error("Sentinel Hub credentials not configured");

      // Check cached token
      if (cfg._token && cfg._tokenExpires && Date.now() < cfg._tokenExpires) {
        return cfg._token;
      }

      const resp = await fetch(SH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=client_credentials&client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}`,
      });
      if (!resp.ok) throw new Error(`Sentinel Hub OAuth failed: ${resp.status}`);
      const data = await resp.json();

      await saveProviderConfig("sentinelhub", {
        _token: data.access_token,
        _tokenExpires: Date.now() + ((data.expires_in || 3600) - 300) * 1000,
      });
      return data.access_token;
    },

    async testConnection() {
      await this._getToken(); // will throw if creds are bad
      return { success: true };
    },

    async getImage(bbox, dateFrom, dateTo, options = {}) {
      const token = await this._getToken();
      const width = options.width || 512;
      const height = options.height || 512;
      const maxCC = options.maxCloudCoverage || 30;
      const evalscript = options.evalscript || EVALSCRIPTS.trueColor;

      const body = {
        input: {
          bounds: {
            bbox,
            properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
          },
          data: [{
            type: "sentinel-2-l2a",
            dataFilter: {
              timeRange: { from: dateFrom, to: dateTo },
              maxCloudCoverage: maxCC,
            },
          }],
        },
        output: {
          width,
          height,
          responses: [{ identifier: "default", format: { type: "image/png" } }],
        },
        evalscript,
      };

      const resp = await fetch(SH_PROCESS_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`Sentinel Hub image request failed: ${resp.status}`);
      const blob = await resp.blob();
      await logActivity("search", `Satellite image: ${dateFrom.slice(0, 10)}`, null);
      // Convert blob to data URL (base64) so it can cross context boundaries
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    },

    /**
     * Search the Sentinel-2 Catalog for available scenes.
     * Returns an array of scenes sorted by date (newest first), each with:
     *   { id, datetime, cloudCover, satellite, bbox, dateFrom, dateTo }
     *
     * dateFrom/dateTo are tight 1-minute windows around the exact acquisition
     * so they can be fed directly to getImage() for a guaranteed 1:1 match.
     */
    async searchCatalog(bbox, dateFrom, dateTo, options = {}) {
      const token = await this._getToken();
      const maxCC = options.maxCloudCoverage ?? 100;
      const limit = options.limit || 20;

      const body = {
        bbox,
        datetime: `${dateFrom}/${dateTo}`,
        collections: ["sentinel-2-l2a"],
        limit,
        // No server-side filter — eo:cloud_cover colon breaks CQL2 text parsing.
        // Filter client-side below.
      };

      const resp = await fetch(SH_CATALOG_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`Sentinel Hub catalog search failed: ${resp.status}`);
      const data = await resp.json();

      // Parse STAC features into a clean list, filter by cloud cover client-side
      return (data.features || [])
        .filter(f => (f.properties['eo:cloud_cover'] ?? 0) <= maxCC)
        .map(f => {
          const dt = new Date(f.properties.datetime);
          const from = new Date(dt.getTime() - 30000);
          const to   = new Date(dt.getTime() + 30000);
          return {
            id: f.id,
            datetime: f.properties.datetime,
            date: f.properties.datetime.slice(0, 10),
            time: f.properties.datetime.slice(11, 19),
            cloudCover: f.properties['eo:cloud_cover'] ?? null,
            satellite: f.properties['platform'] || 'Sentinel-2',
            bbox: f.bbox,
            dateFrom: from.toISOString(),
            dateTo:   to.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    },

    getWmsUrl() {
      return getProviderConfig("sentinelhub").then(cfg => {
        if (!cfg.instanceId) return null;
        return `https://sh.dataspace.copernicus.eu/ogc/wms/${cfg.instanceId}`;
      });
    },
  };

  const EVALSCRIPTS = {
    trueColor: `//VERSION=3
function setup(){return{input:["B02","B03","B04"],output:{bands:3}}}
function evaluatePixel(s){return[2.5*s.B04,2.5*s.B03,2.5*s.B02]}`,
    falseColor: `//VERSION=3
function setup(){return{input:["B03","B04","B08"],output:{bands:3}}}
function evaluatePixel(s){return[2.5*s.B08,2.5*s.B04,2.5*s.B03]}`,
    ndvi: `//VERSION=3
function setup(){return{input:["B04","B08"],output:{bands:3}}}
function evaluatePixel(s){var v=(s.B08-s.B04)/(s.B08+s.B04);return v<0?[1,0,0]:v<0.3?[1,0.5+v,0]:[0,0.5+v*0.5,0]}`,
    moisture: `//VERSION=3
function setup(){return{input:["B8A","B11"],output:{bands:3}}}
function evaluatePixel(s){var v=(s.B8A-s.B11)/(s.B8A+s.B11);return v<0?[0.8,0.2,0]:v<0.3?[1,1,0]:[0,0.3+v*0.7,1]}`,
  };
  const blockstream    = makeStub("blockstream");

  // ─── Broadcastify / RadioReference SOAP API ──────────────────────────────
  // Premium RadioReference subscription ($29.99/yr) provides a service key
  // that unlocks the SOAP API. Feeds searched by lat/lon → county → feed list.

  const RR_SOAP_URL = "https://api.radioreference.com/soap2/";

  const FEED_STYLE_LABELS = {
    1: "Police/Law", 2: "Fire",    3: "EMS",       4: "Aviation",
    5: "Military",   6: "Rail",    7: "Business",  8: "Federal",
    9: "Weather",   10: "Ham Radio", 11: "Marine", 12: "Transportation",
  };

  const broadcastify = {
    async isConnected() {
      const cfg = await getProviderConfig("broadcastify");
      return !!(cfg.apiKey);
    },

    async connect(apiKey) {
      await saveProviderConfig("broadcastify", { apiKey, connected: false });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("broadcastify");
      return { success: true };
    },

    async _serviceKey() {
      const cfg = await getProviderConfig("broadcastify");
      if (!cfg.apiKey) throw new Error(
        "RadioReference service key not configured — add it in Settings → Intel Providers → Broadcastify"
      );
      return cfg.apiKey;
    },

    _buildEnvelope(method, params) {
      const paramXml = Object.entries(params).map(([k, v]) => {
        const xsiType = typeof v === "number" ? "xsd:float" : "xsd:string";
        return `<${k} xsi:type="${xsiType}">${v}</${k}>`;
      }).join("\n          ");
      return `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.radioreference.com/webapi/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><SOAP-ENV:Body><ns1:${method}>${paramXml}</ns1:${method}></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
    },

    async _soapCall(method, params) {
      const body = this._buildEnvelope(method, params);
      const resp = await fetch(RR_SOAP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": `"http://www.radioreference.com/webapi/${method}"`,
        },
        body,
      });
      if (!resp.ok) throw new Error(`RadioReference API error: ${resp.status}`);
      return resp.text();
    },

    _parseKVMap(itemEl) {
      const obj = {};
      itemEl.querySelectorAll(":scope > item").forEach(kv => {
        const key = kv.querySelector(":scope > key")?.textContent?.trim();
        const val = kv.querySelector(":scope > value")?.textContent?.trim();
        if (key !== undefined) {
          obj[key] = (val !== "" && !isNaN(val)) ? Number(val) : (val ?? "");
        }
      });
      return obj;
    },

    _parseSoapResponse(xml, asArray) {
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const fault = doc.querySelector("faultstring");
      if (fault) throw new Error(`RadioReference: ${fault.textContent.trim()}`);
      const returnEl = doc.querySelector("return");
      if (!returnEl) throw new Error("RadioReference: empty response");
      if (asArray) {
        return Array.from(returnEl.querySelectorAll(":scope > item")).map(item =>
          this._parseKVMap(item)
        );
      }
      return this._parseKVMap(returnEl);
    },

    async testConnection() {
      const serviceKey = await this._serviceKey();
      // Reverse-geocode a known US point (NYC) to validate the service key
      const xml = await this._soapCall("getCountyByLatsLons", {
        lat: 40.7128, lon: -74.006, serviceKey,
      });
      const county = this._parseSoapResponse(xml, false);
      if (!county?.ctid) throw new Error("RadioReference auth failed — check your service key");
      await saveProviderConfig("broadcastify", { apiKey: serviceKey, connected: true });
      return { success: true, county: county.name || "unknown" };
    },

    async searchByBbox(bbox, opts = {}) {
      const [west, south, east, north] = bbox;
      const lat = (south + north) / 2;
      const lon = (west + east) / 2;
      const serviceKey = await this._serviceKey();

      // Step 1: find the county for the map center
      const cxml = await this._soapCall("getCountyByLatsLons", { lat, lon, serviceKey });
      const county = this._parseSoapResponse(cxml, false);
      if (!county?.ctid) throw new Error(
        "Could not find a RadioReference county for this location. " +
        "Broadcastify SOAP API covers US/Canada only."
      );

      // Step 2: get all feeds for that county
      const fxml = await this._soapCall("getFeedsByCounty", { ctid: county.ctid, serviceKey });
      const feeds = this._parseSoapResponse(fxml, true);

      await logActivity("search",
        `Broadcastify: ${feeds.length} feeds in ${county.name || "unknown"} County`, null
      );
      return { success: true, feeds, county };
    },

    async searchByQuery(query, opts = {}) {
      throw new Error(
        "Broadcastify feed search by name is not supported. " +
        "Use the Radio overlay on the satellite or geomap pages to find feeds by location."
      );
    },
  };

  const vesselfinder   = makeStub("vesselfinder");

  // ─── WiGLE (WiFi/wireless network geolocation database) ───

  const WIGLE_BASE = "https://api.wigle.net/api/v2";

  const wigle = {
    async isConnected() {
      const cfg = await getProviderConfig("wigle");
      return !!(cfg.apiName && cfg.apiKey);
    },

    async connect(apiName, apiKey) {
      if (!apiName || !apiKey) throw new Error("WiGLE requires API Name and API Token");
      await saveProviderConfig("wigle", { apiName, apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("wigle");
      return { success: true };
    },

    async _authHeader() {
      const cfg = await getProviderConfig("wigle");
      if (!cfg.apiName || !cfg.apiKey) throw new Error("WiGLE credentials not configured — add API Name and Token in Settings → Intel Providers → WiGLE");
      const encoded = btoa(`${cfg.apiName}:${cfg.apiKey}`);
      return { "Authorization": `Basic ${encoded}`, "Accept": "application/json" };
    },

    async testConnection() {
      const headers = await this._authHeader();
      const resp = await fetch(`${WIGLE_BASE}/profile`, { headers });
      if (!resp.ok) throw new Error(`WiGLE connection failed: ${resp.status}`);
      const data = await resp.json();
      if (!data.success) throw new Error("WiGLE auth rejected — check API Name and Token");
      return { success: true, username: data.userid };
    },

    /**
     * Search WiFi/BT networks within a bounding box.
     * @param {number[]} bbox  [west, south, east, north]
     * @param {object}   opts  { resultsPerPage, onlymine, type }
     * @returns {Promise<{success,results,totalResults}>}
     */
    async searchByBbox(bbox, opts = {}) {
      const [west, south, east, north] = bbox;
      const headers = await this._authHeader();
      const params = new URLSearchParams({
        latrange1: south,
        latrange2: north,
        longrange1: west,
        longrange2: east,
        resultsPerPage: opts.resultsPerPage || 100,
        onlymine: opts.onlymine ? "true" : "false",
      });
      if (opts.type) params.set("type", opts.type); // "WIFI", "BT", "GSM", "CDMA", "LTE"
      const resp = await fetch(`${WIGLE_BASE}/network/search?${params}`, { headers });
      if (!resp.ok) throw new Error(`WiGLE search failed: ${resp.status}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || "WiGLE search failed");
      await logActivity("search", `WiGLE: ${data.results?.length || 0} networks in bbox`, null);
      return data;
    },

    async searchByQuery(query, opts = {}) {
      const headers = await this._authHeader();
      const params = new URLSearchParams({
        ssid: query,
        resultsPerPage: opts.resultsPerPage || 100,
        onlymine: "false",
      });
      const resp = await fetch(`${WIGLE_BASE}/network/search?${params}`, { headers });
      if (!resp.ok) throw new Error(`WiGLE SSID search failed: ${resp.status}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || "WiGLE SSID search failed");
      await logActivity("search", `WiGLE SSID: ${query} (${data.results?.length || 0} results)`, null);
      return data;
    },
  };

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
    flightaware,
    vesselfinder,
    wigle,
  };
})();
