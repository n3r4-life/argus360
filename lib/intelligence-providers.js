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

  async function logActivity(type, label, entityId, category) {
    const { intelActivityLog = [] } = await browser.storage.local.get({ intelActivityLog: [] });
    intelActivityLog.unshift({ type, label, entityId: entityId || null, category: category || null, ts: Date.now() });
    if (intelActivityLog.length > 100) intelActivityLog.length = 100;
    await browser.storage.local.set({ intelActivityLog });
  }

  // ── Provider metadata ──

  const PROVIDER_META = {
    opensanctions: { label: "OpenSanctions",  domain: "compliance", zeroConfig: false },
    csl:           { label: "U.S. CSL",        domain: "compliance", zeroConfig: false },
    eusanctions:   { label: "EU Sanctions",    domain: "compliance", zeroConfig: true },
    pepscreen:     { label: "PEP Screen",      domain: "compliance", zeroConfig: false }, // uses OpenSanctions PEP dataset
    samgov:        { label: "SAM.gov",         domain: "compliance", zeroConfig: false },
    uspto:         { label: "USPTO Patents",   domain: "compliance", zeroConfig: false },
    patentsview:   { label: "PatentsView",     domain: "compliance", zeroConfig: false },
    lensorg:       { label: "Lens.org",        domain: "compliance", zeroConfig: false },
    pqai:          { label: "PQAI",            domain: "compliance", zeroConfig: false },
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
    stadiamaps:    { label: "Stadia Maps",    domain: "satellite",  zeroConfig: false },
    windywebcams:  { label: "Windy Webcams",  domain: "satellite",  zeroConfig: false },
    windyforecast: { label: "Windy Forecast", domain: "satellite",  zeroConfig: false },
    openweathermap:{ label: "OpenWeatherMap", domain: "satellite",  zeroConfig: false },
    fdic:          { label: "FDIC BankFind",  domain: "finance",    zeroConfig: true },
    usaspending:   { label: "USAspending",    domain: "finance",    zeroConfig: true },
    dol:           { label: "DOL",             domain: "finance",    zeroConfig: false },
    yahoo:         { label: "Yahoo Finance",   domain: "finance",    zeroConfig: true },
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
      await logActivity("search", `Sanctions search: ${query}`, null, "screening");
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

  // ─── U.S. Consolidated Screening List (CSL) ───

  const csl = {
    _baseUrl: "https://data.trade.gov/consolidated_screening_list/v1",

    async isConnected() {
      const cfg = await getProviderConfig("csl");
      return !!(cfg.apiKey);
    },

    async connect(apiKey) {
      await saveProviderConfig("csl", { apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("csl");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("csl");
      if (!cfg.apiKey) throw new Error("CSL subscription key required — sign up free at developer.trade.gov");
      const resp = await fetch(`${this._baseUrl}/search?name=test&size=1`, {
        headers: { "subscription-key": cfg.apiKey }
      });
      if (!resp.ok) throw new Error(`CSL connection failed: ${resp.status}`);
      return { success: true };
    },

    async search(query, options = {}) {
      const cfg = await getProviderConfig("csl");
      if (!cfg.apiKey) throw new Error("CSL subscription key required — sign up free at developer.trade.gov");

      const params = new URLSearchParams();
      if (options.fuzzy) {
        params.set("fuzzy_name", query);
      } else {
        params.set("name", query);
      }
      if (options.sources) params.set("sources", options.sources);
      if (options.types) params.set("types", options.types);
      if (options.countries) params.set("countries", options.countries);
      params.set("size", String(options.size || 25));
      params.set("offset", String(options.offset || 0));

      const resp = await fetch(`${this._baseUrl}/search?${params}`, {
        headers: { "subscription-key": cfg.apiKey }
      });
      if (!resp.ok) throw new Error(`CSL search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `CSL search: ${query}`, null, "screening");
      return data;
    },

    async getSources() {
      const cfg = await getProviderConfig("csl");
      if (!cfg.apiKey) throw new Error("CSL subscription key required");
      const resp = await fetch(`${this._baseUrl}/sources`, {
        headers: { "subscription-key": cfg.apiKey }
      });
      if (!resp.ok) throw new Error(`CSL sources failed: ${resp.status}`);
      return resp.json();
    },
  };

  // ─── EU Consolidated Financial Sanctions (XML download + local search) ───

  const eusanctions = {
    _listUrl: "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw",
    _cache: null,
    _cacheTs: 0,
    _CACHE_TTL: 3600000, // 1 hour

    async isConnected() { return true; }, // zero-config — public XML
    async connect() { await saveProviderConfig("eusanctions", { connected: true }); return { success: true }; },
    async disconnect() { await clearProviderConfig("eusanctions"); return { success: true }; },
    async testConnection() {
      const resp = await fetch(this._listUrl, { method: "HEAD" });
      if (!resp.ok) throw new Error("EU Sanctions list unavailable: " + resp.status);
      return { success: true };
    },

    async _loadList() {
      if (this._cache && Date.now() - this._cacheTs < this._CACHE_TTL) return this._cache;
      const resp = await fetch(this._listUrl);
      if (!resp.ok) throw new Error("Failed to fetch EU Sanctions list: " + resp.status);
      const text = await resp.text();
      // Parse XML with regex (no DOMParser in service worker)
      const entities = [];
      const entityRegex = /<sanctionEntity[^>]*logicalId="([^"]*)"[^>]*>([\s\S]*?)<\/sanctionEntity>/g;
      const nameRegex = /wholeName="([^"]*)"/g;
      const typeRegex = /<subjectType[^>]*code="([^"]*)"/;
      const remarkRegex = /<remark>([\s\S]*?)<\/remark>/;
      const progRegex = /<programme>([\s\S]*?)<\/programme>/g;
      let match;
      while ((match = entityRegex.exec(text)) !== null) {
        var id = match[1];
        var body = match[2];
        var names = [];
        let nm;
        var nameRx = /wholeName="([^"]*)"/g;
        while ((nm = nameRx.exec(body)) !== null) names.push(nm[1]);
        var typeMatch = typeRegex.exec(body);
        var remarkMatch = remarkRegex.exec(body);
        var programmes = [];
        let pm;
        var progRx = /<programme>([\s\S]*?)<\/programme>/g;
        while ((pm = progRx.exec(body)) !== null) programmes.push(pm[1].trim());
        entities.push({
          id: id,
          names: names,
          name: names[0] || "Unknown",
          type: typeMatch ? typeMatch[1] : "entity",
          programmes: programmes,
          remark: remarkMatch ? remarkMatch[1].trim() : "",
        });
      }
      this._cache = entities;
      this._cacheTs = Date.now();
      return entities;
    },

    async search(query) {
      const entities = await this._loadList();
      const q = query.toLowerCase();
      const matches = entities.filter(function(e) {
        return e.names.some(function(n) { return n.toLowerCase().includes(q); });
      }).slice(0, 50);
      await logActivity("search", "EU Sanctions search: " + query, null, "screening");
      return { total: matches.length, results: matches };
    },
  };

  // ─── PEP Screen (wrapper around OpenSanctions PEPs dataset) ───

  const pepscreen = {
    async isConnected() { return opensanctions.isConnected(); },
    async connect(apiKey) { return opensanctions.connect(apiKey); },
    async disconnect() { /* shares OpenSanctions key — don't clear */ return { success: true }; },
    async testConnection() { return opensanctions.testConnection(); },
    async search(query) {
      const result = await opensanctions.search(query, "peps");
      await logActivity("search", "PEP screen: " + query, null, "screening");
      return result;
    },
  };

  // ─── SAM.gov Entity API ───

  const samgov = {
    _baseUrl: "https://api.sam.gov/entity-information/v3/entities",

    async isConnected() {
      const cfg = await getProviderConfig("samgov");
      return !!(cfg.apiKey);
    },
    async connect(apiKey) {
      await saveProviderConfig("samgov", { apiKey, connected: true });
      return this.testConnection();
    },
    async disconnect() { await clearProviderConfig("samgov"); return { success: true }; },
    async testConnection() {
      const cfg = await getProviderConfig("samgov");
      if (!cfg.apiKey) throw new Error("SAM.gov API key required — register free at sam.gov/content/entity-information");
      const resp = await fetch(this._baseUrl + "?api_key=" + encodeURIComponent(cfg.apiKey) + "&legalBusinessName=test&registrationStatus=A&purposeOfRegistrationCode=Z2&entityEFTIndicator=&includeSections=entityRegistration&page=0&size=1");
      if (!resp.ok) throw new Error("SAM.gov connection failed: " + resp.status);
      return { success: true };
    },
    async search(query, options = {}) {
      const cfg = await getProviderConfig("samgov");
      if (!cfg.apiKey) throw new Error("SAM.gov API key required — register free at sam.gov");
      const params = new URLSearchParams();
      params.set("api_key", cfg.apiKey);
      params.set("legalBusinessName", query + "*");
      params.set("registrationStatus", "A");
      params.set("includeSections", "entityRegistration,coreData");
      params.set("page", "0");
      params.set("size", String(Math.min(options.size || 10, 10)));
      const resp = await fetch(this._baseUrl + "?" + params);
      if (!resp.ok) {
        var errBody = "";
        try { errBody = await resp.text(); } catch(e) {}
        throw new Error("SAM.gov search failed: " + resp.status + (errBody ? " — " + errBody.substring(0, 200) : ""));
      }
      const data = await resp.json();
      await logActivity("search", "SAM.gov search: " + query, null, "entity");
      return { total: data.totalRecords || 0, results: data.entityData || [] };
    },
  };

  // ─── USPTO Patent Search (PatentCenter Public Search) ───

  const uspto = {
    _baseUrl: "https://developer.uspto.gov/ibd-api/v1/application/publications",

    async isConnected() {
      const cfg = await getProviderConfig("uspto");
      return !!(cfg.apiKey || cfg.connected);
    },
    async connect(apiKey) {
      await saveProviderConfig("uspto", { apiKey: apiKey || "", connected: true });
      return { success: true };
    },
    async disconnect() { await clearProviderConfig("uspto"); return { success: true }; },
    async testConnection() { return { success: true }; },
    async search(query, options = {}) {
      // USPTO published applications search
      const params = new URLSearchParams();
      params.set("searchText", query);
      params.set("start", String(options.offset || 0));
      params.set("rows", String(options.size || 25));
      const resp = await fetch(this._baseUrl + "?" + params);
      if (!resp.ok) throw new Error("USPTO search failed: " + resp.status);
      const data = await resp.json();
      await logActivity("search", "USPTO search: " + query, null, "patent");
      return { total: data.recordTotalQuantity || data.numFound || 0, results: data.results || data.patents || [] };
    },
  };

  // ─── PatentsView API ───

  const patentsview = {
    _baseUrl: "https://search.patentsview.org/api/v1/patent/",

    async isConnected() {
      const cfg = await getProviderConfig("patentsview");
      return !!(cfg.apiKey);
    },
    async connect(apiKey) {
      await saveProviderConfig("patentsview", { apiKey, connected: true });
      return { success: true };
    },
    async disconnect() { await clearProviderConfig("patentsview"); return { success: true }; },
    async testConnection() {
      const cfg = await getProviderConfig("patentsview");
      if (!cfg.apiKey) throw new Error("PatentsView API key required — request free at patentsview.org/apis/keyrequest");
      return { success: true };
    },
    async search(query, options = {}) {
      const cfg = await getProviderConfig("patentsview");
      if (!cfg.apiKey) throw new Error("PatentsView API key required — request free at patentsview.org/apis/keyrequest");
      const body = {
        q: { _text_any: { patent_title: query } },
        f: ["patent_number", "patent_title", "patent_date", "patent_type", "patent_abstract"],
        o: { page: (options.page || 1), per_page: (options.size || 25) },
        s: [{ patent_date: "desc" }]
      };
      const resp = await fetch(this._baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": cfg.apiKey },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error("PatentsView search failed: " + resp.status);
      const data = await resp.json();
      await logActivity("search", "PatentsView search: " + query, null, "patent");
      return { total: data.total_patent_count || 0, results: data.patents || [] };
    },
  };

  // ─── Lens.org Scholarly/Patent API ───

  const lensorg = {
    _baseUrl: "https://api.lens.org/patent/search",

    async isConnected() {
      const cfg = await getProviderConfig("lensorg");
      return !!(cfg.apiKey);
    },
    async connect(apiKey) {
      await saveProviderConfig("lensorg", { apiKey, connected: true });
      return this.testConnection();
    },
    async disconnect() { await clearProviderConfig("lensorg"); return { success: true }; },
    async testConnection() {
      const cfg = await getProviderConfig("lensorg");
      if (!cfg.apiKey) throw new Error("Lens.org API token required — request free academic access at lens.org/lens/user/subscriptions");
      return { success: true };
    },
    async search(query, options = {}) {
      const cfg = await getProviderConfig("lensorg");
      if (!cfg.apiKey) throw new Error("Lens.org API token required");
      const body = {
        query: { match: { lens_id: query } },
        size: options.size || 25,
        from: options.offset || 0
      };
      // Try title search first
      if (!query.match(/^\d{3}-\d{3}-\d{3}/)) {
        body.query = { match: { title: query } };
      }
      const resp = await fetch(this._baseUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + cfg.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error("Lens.org search failed: " + resp.status);
      const data = await resp.json();
      await logActivity("search", "Lens.org search: " + query, null, "patent");
      return { total: data.total || 0, results: data.data || [] };
    },
  };

  // ─── PQAI — AI-powered semantic patent search ───

  const pqai = {
    _baseUrl: "https://api.projectpq.ai",

    async isConnected() {
      const cfg = await getProviderConfig("pqai");
      return !!(cfg.apiKey || cfg.connected);
    },
    async connect(apiKey) {
      await saveProviderConfig("pqai", { apiKey: apiKey || "", connected: true });
      return { success: true };
    },
    async disconnect() { await clearProviderConfig("pqai"); return { success: true }; },
    async testConnection() { return { success: true }; },
    async search(query, options = {}) {
      const cfg = await getProviderConfig("pqai");
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("n", String(options.size || 10));
      if (cfg.apiKey) params.set("token", cfg.apiKey);
      const resp = await fetch(this._baseUrl + "/search/102/?" + params);
      if (!resp.ok) throw new Error("PQAI search failed: " + resp.status);
      const data = await resp.json();
      await logActivity("search", "PQAI search: " + query, null, "patent");
      return { total: data.results?.length || 0, results: data.results || [] };
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
      await logActivity("search", `SEC search: ${name}`, null, "finance");
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
      await logActivity("search", `OpenSky: ${data.states?.length || 0} aircraft`, null, "tracking");
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
      await logActivity("search", `Court search: ${query} (${data.count || 0} results)`, null, "litigation");
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
      await logActivity("search", `OpenCorp: ${query} (${data.results?.total_count || 0} results)`, null, "finance");
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
      await logActivity("search", `GLEIF: ${query} (${data.meta?.pagination?.total || 0} results)`, null, "finance");
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
      await logActivity("search", `GDELT articles: ${query}`, null, "events");
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

  // ─── Stadia Maps (tile provider with API key) ───

  const STADIA_STYLES = {
    'alidade-smooth':       'alidade_smooth',
    'alidade-smooth-dark':  'alidade_smooth_dark',
    'alidade-satellite':    'alidade_satellite',
    'outdoors':             'outdoors',
    'stamen-toner':         'stamen_toner',
    'stamen-terrain':       'stamen_terrain',
    'stamen-watercolor':    'stamen_watercolor',
  };

  const stadiamaps = {
    async isConnected() {
      const cfg = await getProviderConfig("stadiamaps");
      return !!cfg.apiKey;
    },

    async connect(apiKey) {
      if (!apiKey) throw new Error("Stadia Maps requires an API key");
      await saveProviderConfig("stadiamaps", { apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("stadiamaps");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("stadiamaps");
      if (!cfg.apiKey) throw new Error("Stadia Maps API key not configured");
      // Test with a simple tile request
      const resp = await fetch(`https://tiles.stadiamaps.com/tiles/alidade_smooth/0/0/0.png?api_key=${cfg.apiKey}`);
      if (!resp.ok) throw new Error(`Stadia Maps connection failed: ${resp.status}`);
      return { success: true };
    },

    async getApiKey() {
      const cfg = await getProviderConfig("stadiamaps");
      return cfg.apiKey || null;
    },

    getTileUrl(styleId) {
      const style = STADIA_STYLES[styleId] || 'alidade_smooth_dark';
      return `https://tiles.stadiamaps.com/tiles/${style}/{z}/{x}/{y}{r}.png`;
    },

    getStyles() {
      return Object.keys(STADIA_STYLES).map(function(id) {
        return { id: id, label: id.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }) };
      });
    },

    async getStatus() {
      return getProviderConfig("stadiamaps").then(cfg => {
        return { connected: !!cfg.apiKey, styles: Object.keys(STADIA_STYLES).length };
      });
    }
  };

  // ─── Windy Webcams (live webcam database, searchable by bounding box) ───

  const WINDY_WEBCAMS_BASE = "https://api.windy.com/webcams/api/v3";

  const windywebcams = {
    async isConnected() {
      const cfg = await getProviderConfig("windywebcams");
      return !!cfg.apiKey;
    },

    async connect(apiKey) {
      if (!apiKey) throw new Error("Windy Webcams requires an API key");
      await saveProviderConfig("windywebcams", { apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("windywebcams");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("windywebcams");
      if (!cfg.apiKey) throw new Error("Windy Webcams API key not configured — get a free key at windy.com/webcams/api");
      // Test with a minimal bbox (1° box around null island)
      const resp = await fetch(
        `${WINDY_WEBCAMS_BASE}/webcams?lang=en&limit=1&north=1&south=-1&east=1&west=-1&include=location`,
        { headers: { "x-windy-api-key": cfg.apiKey, "Accept": "application/json" } }
      );
      if (!resp.ok) throw new Error(`Windy Webcams API error: ${resp.status}`);
      return { success: true };
    },

    /**
     * Search webcams within a bounding box.
     * @param {number[]} bbox  [west, south, east, north]
     * @param {object}   opts  { limit }
     * @returns {Promise<{success, webcams, total}>}
     */
    async searchByBbox(bbox, opts = {}) {
      const cfg = await getProviderConfig("windywebcams");
      if (!cfg.apiKey) throw new Error("Windy Webcams API key not configured — add it in Settings → Intel Providers → Windy Webcams");
      const [west, south, east, north] = bbox;
      const params = new URLSearchParams({
        lang: "en",
        limit: opts.limit || 50,
        north, south, east, west,
        include: "location,player,images",
      });
      const resp = await fetch(
        `${WINDY_WEBCAMS_BASE}/webcams?${params}`,
        { headers: { "x-windy-api-key": cfg.apiKey, "Accept": "application/json" } }
      );
      if (!resp.ok) throw new Error(`Windy Webcams search failed: ${resp.status}`);
      const data = await resp.json();
      await logActivity("search", `Windy Webcams: ${data.webcams?.length || 0} webcams in bbox`, null);
      return { success: true, webcams: data.webcams || [], total: data.total || 0 };
    },
  };

  // ─── Windy Forecast API (point forecast v2 + map tiles) ───

  const WINDY_FORECAST_BASE = "https://api.windy.com/api/point-forecast/v2";
  const WINDY_TILE_BASE     = "https://tiles.windy.com/tiles/v10.0";

  // Map of our friendly layer names → Windy tile/forecast layer names
  const WINDY_LAYERS = {
    wind:          { tile: "wind",        params: ["wind_u", "wind_v"],          level: "surface" },
    rain:          { tile: "rain",        params: ["past3hprecip"],              level: "surface" },
    temp:          { tile: "temp",        params: ["temp"],                      level: "surface" },
    clouds:        { tile: "clouds",      params: ["lclouds","mclouds","hclouds"], level: "surface" },
    pressure:      { tile: "pressure",    params: ["pressure"],                  level: "surface" },
    gust:          { tile: "gust",        params: ["windGust"],                  level: "surface" },
    snowcover:     { tile: "snowcover",   params: ["snowPrecip"],                level: "surface" },
    waves:         { tile: "waves",       params: ["waves"],                     level: "surface" },
  };

  const windyforecast = {
    async isConnected() {
      const cfg = await getProviderConfig("windyforecast");
      return !!(cfg.tileKey || cfg.forecastKey);
    },

    async connect({ tileKey, forecastKey } = {}) {
      if (!tileKey && !forecastKey) throw new Error("Windy Forecast requires at least one key (tiles or point forecast)");
      await saveProviderConfig("windyforecast", { tileKey: tileKey || "", forecastKey: forecastKey || "", connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("windyforecast");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("windyforecast");
      if (!cfg.tileKey && !cfg.forecastKey) throw new Error("No Windy Forecast keys configured");
      // Test whichever key is present
      if (cfg.forecastKey) {
        const resp = await fetch(WINDY_FORECAST_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: 50.4, lon: 14.3, model: "gfs",
            parameters: ["temp"], levels: ["surface"],
            key: cfg.forecastKey,
          }),
        });
        if (!resp.ok) throw new Error(`Windy Point Forecast API error: ${resp.status}`);
      } else {
        // Tile key — just validate format (can't easily test without fetching a tile)
        if (cfg.tileKey.length < 8) throw new Error("Windy tile key looks invalid");
      }
      return { success: true };
    },

    /** Return a Leaflet-compatible tile URL for a given layer (requires tile key). */
    async getTileUrl(layerId) {
      const cfg = await getProviderConfig("windyforecast");
      if (!cfg.tileKey) throw new Error("Windy map tile key not configured — add it in Settings → Intel Providers → Windy Forecast");
      const layer = WINDY_LAYERS[layerId]?.tile || layerId;
      return `${WINDY_TILE_BASE}/${layer}/{z}/{x}/{y}.png?key=${cfg.tileKey}`;
    },

    getLayers() {
      return Object.keys(WINDY_LAYERS).map(id => ({
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
      }));
    },

    /**
     * Get point forecast for a lat/lon (requires forecast key).
     * @param {number} lat
     * @param {number} lon
     * @param {string} model  gfs | ecmwf | icon | mblue
     */
    async getPointForecast(lat, lon, model = "gfs") {
      const cfg = await getProviderConfig("windyforecast");
      if (!cfg.forecastKey) throw new Error("Windy Point Forecast key not configured — add it in Settings → Intel Providers → Windy Forecast");
      const parameters = ["temp", "wind_u", "wind_v", "windGust", "past3hprecip",
                          "lclouds", "mclouds", "hclouds", "pressure", "humidity"];
      const resp = await fetch(WINDY_FORECAST_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat, lon, model,
          parameters,
          levels: ["surface"],
          key: cfg.forecastKey,
        }),
      });
      if (!resp.ok) throw new Error(`Windy point forecast failed: ${resp.status}`);
      const raw = await resp.json();
      const ts = raw.ts || [];
      const get = (key) => raw[`${key}-surface`] || raw[key] || [];
      const tempK  = get("temp");
      const windU  = get("wind_u");
      const windV  = get("wind_v");
      const gust   = get("windGust");
      const precip = get("past3hprecip");
      const lc     = get("lclouds");
      const mc     = get("mclouds");
      const hc     = get("hclouds");
      const pres   = get("pressure");
      const hum    = get("humidity");
      const hours = ts.map((t, i) => ({
        ts: t,
        tempC: tempK[i] != null ? Math.round((tempK[i] - 273.15) * 10) / 10 : null,
        windMs: windU[i] != null ? Math.round(Math.sqrt(windU[i] ** 2 + (windV[i] || 0) ** 2) * 10) / 10 : null,
        windDir: windU[i] != null ? Math.round((Math.atan2(-windU[i], -(windV[i] || 0)) * 180 / Math.PI + 360) % 360) : null,
        gustMs: gust[i] != null ? Math.round(gust[i] * 10) / 10 : null,
        precip3h: precip[i] != null ? Math.round(precip[i] * 10) / 10 : null,
        cloudPct: lc[i] != null ? Math.round(Math.max(lc[i], mc[i] || 0, hc[i] || 0)) : null,
        pressureHpa: pres[i] != null ? Math.round(pres[i] / 100) : null,
        humidityPct: hum[i] != null ? Math.round(hum[i]) : null,
      }));
      return { model, hours, units: { temp: "°C", wind: "m/s", precip: "mm/3h" } };
    },
  };

  // ─── OpenWeatherMap (tile overlays + current conditions) ───

  const OWM_TILE_BASE = "https://tile.openweathermap.org/map";
  const OWM_API_BASE  = "https://api.openweathermap.org/data/2.5";
  const OWM_LAYERS = {
    precipitation: "precipitation_new",
    wind:          "wind_new",
    temp:          "temp_new",
    clouds:        "clouds_new",
    pressure:      "pressure_new",
  };

  const openweathermap = {
    async isConnected() {
      const cfg = await getProviderConfig("openweathermap");
      return !!cfg.apiKey;
    },

    async connect(apiKey) {
      if (!apiKey) throw new Error("OpenWeatherMap requires an API key");
      await saveProviderConfig("openweathermap", { apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("openweathermap");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("openweathermap");
      if (!cfg.apiKey) throw new Error("OpenWeatherMap API key not configured");
      const resp = await fetch(`${OWM_API_BASE}/weather?lat=0&lon=0&appid=${encodeURIComponent(cfg.apiKey)}`);
      if (!resp.ok) throw new Error(`OpenWeatherMap API error: ${resp.status}`);
      return { success: true };
    },

    /** Return a Leaflet-compatible tile URL for a given layer. */
    async getTileUrl(layerId) {
      const cfg = await getProviderConfig("openweathermap");
      if (!cfg.apiKey) throw new Error("OpenWeatherMap API key not configured");
      const layer = OWM_LAYERS[layerId] || layerId;
      return `${OWM_TILE_BASE}/${layer}/{z}/{x}/{y}.png?appid=${cfg.apiKey}`;
    },

    getLayers() {
      return Object.keys(OWM_LAYERS).map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }));
    },

    /**
     * Get current weather conditions at a lat/lon.
     * Falls back to Open-Meteo (free, no key needed) if no OWM key.
     */
    async getCurrentConditions(lat, lon) {
      const cfg = await getProviderConfig("openweathermap");
      if (cfg.apiKey) {
        const resp = await fetch(
          `${OWM_API_BASE}/weather?lat=${lat}&lon=${lon}&appid=${encodeURIComponent(cfg.apiKey)}&units=metric`
        );
        if (!resp.ok) throw new Error(`OpenWeatherMap weather failed: ${resp.status}`);
        const d = await resp.json();
        return {
          source: "owm",
          temp: d.main?.temp,
          feelsLike: d.main?.feels_like,
          humidity: d.main?.humidity,
          windSpeed: d.wind?.speed,
          windDeg: d.wind?.deg,
          description: d.weather?.[0]?.description,
          icon: d.weather?.[0]?.icon
            ? `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png`
            : null,
          cityName: d.name,
        };
      }
      // Free fallback: Open-Meteo (no key required)
      const resp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,wind_speed_10m,relative_humidity_2m,weather_code&timezone=auto`
      );
      if (!resp.ok) throw new Error(`Open-Meteo request failed: ${resp.status}`);
      const d = await resp.json();
      const c = d.current || {};
      return {
        source: "open-meteo",
        temp: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        windSpeed: c.wind_speed_10m,
        description: _openMeteoWmoDescription(c.weather_code),
      };
    },
  };

  /** Map WMO weather code to short description (Open-Meteo). */
  function _openMeteoWmoDescription(code) {
    const WMO = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Icy fog",
      51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
      61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
      71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
      80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
      95: "Thunderstorm", 96: "Thunderstorm+hail", 99: "Heavy thunderstorm+hail",
    };
    return WMO[code] || `WMO code ${code}`;
  }

  // ─── FDIC BankFind (zero-config, public) ──────────────────────────────
  // Every US bank/institution — name, location, assets, deposits, status.
  // No API key required. Uses wildcard filter on NAME field.
  // Docs: https://api.fdic.gov/banks/docs

  const FDIC_BASE = "https://api.fdic.gov/banks";
  const FDIC_FIELDS = "NAME,CITY,STNAME,STALP,ZIP,ADDRESS,CERT,ACTIVE,ASSET,DEP,NETINC,OFFDOM,CHARTER_CLASS,WEBADDR,LATITUDE,LONGITUDE";

  const fdic = {
    async isConnected() { return true; },
    async connect() { return { success: true }; },
    async disconnect() { return { success: true }; },
    async testConnection() {
      const resp = await fetch(`${FDIC_BASE}/institutions?filters=ACTIVE:1&limit=1`);
      if (!resp.ok) throw new Error(`FDIC API: ${resp.status}`);
      return { success: true };
    },

    async search(query, options = {}) {
      const limit = options.limit || 25;
      const activeOnly = options.activeOnly !== false;
      const filters = `NAME:*${query}*` + (activeOnly ? " AND ACTIVE:1" : "");
      const url = `${FDIC_BASE}/institutions?filters=${encodeURIComponent(filters)}&fields=${FDIC_FIELDS}&limit=${limit}&sort_by=ASSET&sort_order=DESC`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`FDIC BankFind: ${resp.status}`);
      const json = await resp.json();
      await logActivity("search", `FDIC: ${query}`, null, "finance");
      return {
        total: json.meta?.total || 0,
        results: (json.data || []).map(item => item.data || item),
      };
    },

    async getInstitution(cert) {
      const resp = await fetch(`${FDIC_BASE}/institutions?filters=CERT:${cert}&fields=${FDIC_FIELDS}`);
      if (!resp.ok) throw new Error(`FDIC: ${resp.status}`);
      const json = await resp.json();
      return json.data?.[0]?.data || null;
    },

    async getFailures(query) {
      const filters = query ? `INSTNAME:*${query}*` : "";
      const resp = await fetch(`${FDIC_BASE}/failures?filters=${encodeURIComponent(filters)}&limit=25&sort_by=FAILDATE&sort_order=DESC`);
      if (!resp.ok) throw new Error(`FDIC Failures: ${resp.status}`);
      const json = await resp.json();
      return { total: json.meta?.total || 0, results: (json.data || []).map(item => item.data || item) };
    },
  };

  // ─── USAspending.gov (zero-config, public) ────────────────────────────
  // Every US federal contract, grant, loan — recipient, amount, agency, dates.
  // No API key required. POST endpoints.
  // Docs: https://api.usaspending.gov/docs/endpoints

  const USA_BASE = "https://api.usaspending.gov/api/v2";

  const usaspending = {
    async isConnected() { return true; },
    async connect() { return { success: true }; },
    async disconnect() { return { success: true }; },
    async testConnection() {
      const resp = await fetch(`${USA_BASE}/autocomplete/recipient/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_text: "test", limit: 1 }),
      });
      if (!resp.ok) throw new Error(`USAspending API: ${resp.status}`);
      return { success: true };
    },

    async search(query, options = {}) {
      const limit = options.limit || 25;
      // Award types: A=BPA, B=PO, C=Delivery Order, D=Definitive Contract
      const awardTypes = options.awardTypes || ["A", "B", "C", "D"];
      const body = {
        filters: {
          recipient_search_text: [query],
          award_type_codes: awardTypes,
        },
        fields: ["Award ID", "Recipient Name", "Award Amount", "Total Outlays",
                 "Start Date", "End Date", "Awarding Agency", "Awarding Sub Agency",
                 "Award Type", "Description"],
        limit: limit,
        page: options.page || 1,
        sort: options.sort || "Award Amount",
        order: options.order || "desc",
      };
      const resp = await fetch(`${USA_BASE}/search/spending_by_award/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`USAspending: ${resp.status}`);
      const json = await resp.json();
      await logActivity("search", `USAspending: ${query}`, null, "finance");
      return {
        total: json.page_metadata?.hasNext ? "25+" : (json.results?.length || 0),
        results: json.results || [],
      };
    },

    // Sub-source methods — pre-filtered by award type
    async searchContracts(query, options = {}) {
      return this.search(query, { ...options, awardTypes: ["A", "B", "C", "D"] });
    },
    async searchGrants(query, options = {}) {
      return this.search(query, { ...options, awardTypes: ["02", "03", "04", "05"] });
    },
    async searchLoans(query, options = {}) {
      return this.search(query, { ...options, awardTypes: ["07", "08"] });
    },
    async searchDirectPayments(query, options = {}) {
      return this.search(query, { ...options, awardTypes: ["06", "10"] });
    },

    async autocompleteRecipient(query) {
      const resp = await fetch(`${USA_BASE}/autocomplete/recipient/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_text: query, limit: 10 }),
      });
      if (!resp.ok) throw new Error(`USAspending autocomplete: ${resp.status}`);
      const json = await resp.json();
      return json.results || [];
    },
  };

  // ─── DOL Data Portal (API key required) ────────────────────────────────
  // Department of Labor v4 API — WHD, OSHA, MSHA datasets.
  // Auth: X-API-KEY query param. Register at https://dataportal.dol.gov/registration
  // Docs: https://dataportal.dol.gov/user-guide
  // API:  https://apiprod.dol.gov/v4/get/{AGENCY}/{endpoint}/json?X-API-KEY=...&limit=N&filter_object=...

  const DOL_BASE = "https://apiprod.dol.gov/v4";

  /** Shared fetch helper — handles key injection, error text, and JSON parse */
  async function _dolFetch(agency, endpoint, filterObj, key, limit = 25) {
    const url = `${DOL_BASE}/get/${agency}/${endpoint}/json?X-API-KEY=${encodeURIComponent(key)}&limit=${limit}&filter_object=${encodeURIComponent(JSON.stringify(filterObj))}`;
    console.log(`[DOL] ${agency}/${endpoint}`, url.replace(/X-API-KEY=[^&]+/, "X-API-KEY=***"));
    try {
      const resp = await fetch(url);
      console.log(`[DOL] ${agency}/${endpoint} HTTP ${resp.status}`);
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error(`[DOL] ${agency}/${endpoint} ERROR body:`, errText.substring(0, 300));
        throw new Error(`DOL ${agency}/${endpoint}: ${resp.status} — ${errText.substring(0, 100)}`);
      }
      const text = await resp.text();
      console.log(`[DOL] ${agency}/${endpoint} response (${text.length} bytes):`, text.substring(0, 300));
      if (text.includes("API key is either incorrect")) throw new Error("DOL API key is invalid — configure in Settings → Providers → DOL");
      const json = JSON.parse(text);
      const results = Array.isArray(json) ? json : (json.data || json.results || []);
      console.log(`[DOL] ${agency}/${endpoint}: ${results.length} results`);
      return results;
    } catch (e) {
      console.error(`[DOL] ${agency}/${endpoint} FETCH FAILED:`, e.message);
      throw e;
    }
  }

  const dol = {
    async isConnected() {
      const cfg = await getProviderConfig("dol");
      return !!(cfg.apiKey);
    },

    async connect(apiKey) {
      await saveProviderConfig("dol", { apiKey, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("dol");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("dol");
      if (!cfg.apiKey) throw new Error("DOL API key not configured — register at dataportal.dol.gov/registration");
      const resp = await fetch(`${DOL_BASE}/get/MSHA/address_of_records_mines/json?X-API-KEY=${encodeURIComponent(cfg.apiKey)}&limit=1`);
      if (!resp.ok) throw new Error(`DOL API: ${resp.status}`);
      const text = await resp.text();
      if (text.includes("API key is either incorrect")) throw new Error("DOL API key is invalid");
      return { success: true };
    },

    async _apiKey() {
      const cfg = await getProviderConfig("dol");
      if (!cfg.apiKey) throw new Error("DOL API key not configured — add it in Settings → Providers → DOL");
      return cfg.apiKey;
    },

    // ── EBSA: Pension & Benefits enforcement (OCATS) ──
    // All EBSA cases — penalty assessments for ERISA/Form 5500 violations
    async searchEBSA(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { field: "plan_admin", operator: "like", value: `%${q}%` };
      const results = await _dolFetch("EBSA", "ocats", filter, key, limit);
      await logActivity("search", `DOL EBSA: ${query}`, null, "labor");
      return { total: results.length, results };
    },
    // EBSA — delinquent filers only (cases closed with penalty)
    async searchEBSADelinquent(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { "and": [
        { field: "plan_admin", operator: "like", value: `%${q}%` },
        { field: "penalty_amount", operator: "gt", value: "0" },
      ]};
      const results = await _dolFetch("EBSA", "ocats", filter, key, limit);
      await logActivity("search", `DOL EBSA Delinquent: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── WHD: shared helper — searches enforcement with optional act filter ──
    async _searchWHDFiltered(query, actField, label, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const nameFilter = { field: "legal_name", operator: "like", value: `%${q}%` };
      const filter = actField
        ? { "and": [ nameFilter, { field: actField, operator: "gt", value: "0" } ] }
        : nameFilter;
      const results = await _dolFetch("WHD", "enforcement", filter, key, limit);
      await logActivity("search", `DOL WHD ${label}: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // WHD — all enforcement cases (unfiltered)
    async searchWHD(query, options = {}) {
      return this._searchWHDFiltered(query, null, "All", options);
    },
    // WHD — FLSA (wage theft, overtime, minimum wage)
    async searchWHD_FLSA(query, options = {}) {
      return this._searchWHDFiltered(query, "flsa_violtn_cnt", "FLSA", options);
    },
    // WHD — FMLA (family/medical leave)
    async searchWHD_FMLA(query, options = {}) {
      return this._searchWHDFiltered(query, "fmla_violtn_cnt", "FMLA", options);
    },
    // WHD — H1B visa worker violations
    async searchWHD_H1B(query, options = {}) {
      return this._searchWHDFiltered(query, "h1b_violtn_cnt", "H1B", options);
    },
    // WHD — H2A/H2B visa worker violations
    async searchWHD_H2(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { "and": [
        { field: "legal_name", operator: "like", value: `%${q}%` },
        { "or": [
          { field: "h2a_violtn_cnt", operator: "gt", value: "0" },
          { field: "h2b_violtn_cnt", operator: "gt", value: "0" },
        ]}
      ]};
      const results = await _dolFetch("WHD", "enforcement", filter, key, limit);
      await logActivity("search", `DOL WHD H2A/H2B: ${query}`, null, "labor");
      return { total: results.length, results };
    },
    // WHD — Child labor
    async searchWHD_ChildLabor(query, options = {}) {
      return this._searchWHDFiltered(query, "flsa_cl_violtn_cnt", "Child Labor", options);
    },
    // WHD — SCA (Service Contract Act)
    async searchWHD_SCA(query, options = {}) {
      return this._searchWHDFiltered(query, "sca_violtn_cnt", "SCA", options);
    },
    // WHD — MSPA (Migrant/Seasonal worker protection)
    async searchWHD_MSPA(query, options = {}) {
      return this._searchWHDFiltered(query, "mspa_violtn_cnt", "MSPA", options);
    },

    // ── OSHA: Inspection Records ──
    async searchOSHAInspections(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { field: "estab_name", operator: "like", value: `%${q}%` };
      const results = await _dolFetch("OSHA", "inspection", filter, key, limit);
      await logActivity("search", `DOL OSHA Inspections: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── OSHA: Violations (by establishment name — joins via activity_nr internally) ──
    async searchOSHAViolations(query, options = {}) {
      // First get inspections for this company, then fetch violations for those activity_nrs
      const key = await this._apiKey();
      const limit = options.limit || 10;
      const q = query.toUpperCase();
      // Get inspection IDs first
      const inspFilter = { field: "estab_name", operator: "like", value: `%${q}%` };
      const inspections = await _dolFetch("OSHA", "inspection", inspFilter, key, limit);
      if (!inspections.length) return { total: 0, results: [] };
      // Fetch violations for the first few inspections
      const results = [];
      for (let i = 0; i < Math.min(inspections.length, 5); i++) {
        const actNr = inspections[i].activity_nr;
        if (!actNr) continue;
        const vFilter = { field: "activity_nr", operator: "eq", value: String(actNr) };
        const viols = await _dolFetch("OSHA", "violation", vFilter, key, 25);
        viols.forEach(v => { v._estab_name = inspections[i].estab_name; results.push(v); });
        if (i < Math.min(inspections.length, 5) - 1) await new Promise(r => setTimeout(r, 300));
      }
      await logActivity("search", `DOL OSHA Violations: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── OSHA: Accidents ──
    async searchOSHAAccidents(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { field: "estab_name", operator: "like", value: `%${q}%` };
      const results = await _dolFetch("OSHA", "accident", filter, key, limit);
      await logActivity("search", `DOL OSHA Accidents: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── OSHA: Accident Abstracts (narratives) ──
    async searchOSHAAbstracts(query, options = {}) {
      // Abstracts don't have estab_name — need to go through accidents first
      const key = await this._apiKey();
      const limit = options.limit || 10;
      const q = query.toUpperCase();
      const accFilter = { field: "estab_name", operator: "like", value: `%${q}%` };
      const accidents = await _dolFetch("OSHA", "accident", accFilter, key, limit);
      if (!accidents.length) return { total: 0, results: [] };
      const results = [];
      for (let i = 0; i < Math.min(accidents.length, 5); i++) {
        const summNr = accidents[i].summary_nr;
        if (!summNr) continue;
        const aFilter = { field: "summary_nr", operator: "eq", value: String(summNr) };
        const abstracts = await _dolFetch("OSHA", "accident_abstract", aFilter, key, 5);
        abstracts.forEach(a => { a._estab_name = accidents[i].estab_name; results.push(a); });
        if (i < Math.min(accidents.length, 5) - 1) await new Promise(r => setTimeout(r, 300));
      }
      await logActivity("search", `DOL OSHA Abstracts: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── MSHA: Mine Information ──
    async searchMines(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { field: "operator_name", operator: "like", value: `%${q}%` };
      const results = await _dolFetch("MSHA", "address_of_records_mines", filter, key, limit);
      await logActivity("search", `DOL MSHA Mines: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── MSHA: Accident Records ──
    async searchAccidents(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { field: "operator_name", operator: "like", value: `%${q}%` };
      const results = await _dolFetch("MSHA", "accident", filter, key, limit);
      await logActivity("search", `DOL MSHA Accidents: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── MSHA: Violations ──
    async searchMSHAViolations(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { field: "operator_name", operator: "like", value: `%${q}%` };
      const results = await _dolFetch("MSHA", "violation", filter, key, limit);
      await logActivity("search", `DOL MSHA Violations: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── MSHA: Assessed Violations (penalties) ──
    async searchMSHAPenalties(query, options = {}) {
      const key = await this._apiKey();
      const limit = options.limit || 25;
      const q = query.toUpperCase();
      const filter = { field: "operator_name", operator: "like", value: `%${q}%` };
      const results = await _dolFetch("MSHA", "assessed_violations", filter, key, limit);
      await logActivity("search", `DOL MSHA Penalties: ${query}`, null, "labor");
      return { total: results.length, results };
    },

    // ── Unified search: sequential to respect DOL rate limits ──
    async search(query, options = {}) {
      const searches = [
        { fn: () => this.searchWHD(query, options),             label: "whd" },
        { fn: () => this.searchOSHAInspections(query, options), label: "osha_inspection" },
        { fn: () => this.searchMines(query, options),           label: "mines" },
        { fn: () => this.searchAccidents(query, options),       label: "accidents" },
        { fn: () => this.searchMSHAViolations(query, options),  label: "msha_violation" },
      ];

      const results = [];
      for (const s of searches) {
        try {
          const data = await s.fn();
          if (data.results) {
            data.results.forEach(r => { r._dolDataset = s.label; results.push(r); });
          }
        } catch (e) {
          console.warn(`[DOL] ${s.label} skipped:`, e.message);
        }
        // Small delay between requests to avoid 429
        if (searches.indexOf(s) < searches.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
      return { total: results.length, results };
    },
  };

  // ─── Yahoo Finance (zero-config, unofficial) ────────────────────────────
  // OHLCV chart data + real-time quotes. No API key. No CORS issues from extension context.
  // Endpoints:
  //   Chart:  https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1d&range=1mo
  //   Quote:  https://query1.finance.yahoo.com/v7/finance/quote?symbols={TICKER}
  //   Search: https://query1.finance.yahoo.com/v1/finance/search?q={QUERY}

  const yahoo = {
    async isConnected() { return true; },
    async connect() { return { success: true }; },
    async disconnect() { return { success: true }; },
    async testConnection() {
      const resp = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d");
      if (!resp.ok) throw new Error(`Yahoo Finance: ${resp.status}`);
      return { success: true };
    },

    // Search for ticker symbols
    async searchTicker(query) {
      const resp = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`);
      if (!resp.ok) throw new Error(`Yahoo search: ${resp.status}`);
      const json = await resp.json();
      return (json.quotes || []).map(q => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType || "",
        exchange: q.exchDisp || q.exchange || "",
      }));
    },

    // Get real-time quote
    async getQuote(symbol) {
      const resp = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`);
      if (!resp.ok) throw new Error(`Yahoo quote: ${resp.status}`);
      const json = await resp.json();
      const q = json.quoteResponse?.result?.[0];
      if (!q) throw new Error("No quote data for " + symbol);
      return {
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePct: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        marketCap: q.marketCap,
        high: q.regularMarketDayHigh,
        low: q.regularMarketDayLow,
        open: q.regularMarketOpen,
        prevClose: q.regularMarketPreviousClose,
        currency: q.currency || "USD",
        exchange: q.fullExchangeName || q.exchange || "",
        marketState: q.marketState,
      };
    },

    // Get OHLCV chart data
    // ranges: 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max
    // intervals: 1m,2m,5m,15m,30m,60m,90m,1h,1d,5d,1wk,1mo,3mo
    async getChart(symbol, range = "1mo", interval) {
      if (!interval) {
        // Auto-select interval based on range
        const intMap = { "1d": "5m", "5d": "15m", "1mo": "1d", "3mo": "1d", "6mo": "1d", "1y": "1wk", "2y": "1wk", "5y": "1mo", "ytd": "1d", "max": "1mo" };
        interval = intMap[range] || "1d";
      }
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Yahoo chart: ${resp.status}`);
      const json = await resp.json();
      const result = json.chart?.result?.[0];
      if (!result) throw new Error("No chart data for " + symbol);

      const timestamps = result.timestamp || [];
      const ohlcv = result.indicators?.quote?.[0] || {};
      const candles = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (ohlcv.open[i] == null) continue; // skip nulls (market closed)
        candles.push({
          t: timestamps[i] * 1000, // ms
          o: ohlcv.open[i],
          h: ohlcv.high[i],
          l: ohlcv.low[i],
          c: ohlcv.close[i],
          v: ohlcv.volume?.[i] || 0,
        });
      }
      return {
        symbol: result.meta?.symbol || symbol,
        currency: result.meta?.currency || "USD",
        range,
        interval,
        candles,
      };
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
    csl,
    eusanctions,
    pepscreen,
    samgov,
    uspto,
    patentsview,
    lensorg,
    pqai,
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
    stadiamaps,
    windywebcams,
    windyforecast,
    openweathermap,
    fdic,
    usaspending,
    dol,
    yahoo,
  };
})();
