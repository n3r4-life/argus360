// ──────────────────────────────────────────────
// Vessel Lookup — VesselFinder API (paid, optional) + external links
// If no API key, provides direct links to MarineTraffic/VesselFinder websites.
// ──────────────────────────────────────────────

const VesselLookup = (() => {
  "use strict";

  // ── VesselFinder API ──
  const VF_BASE = "https://api.vesselfinder.com";

  async function getApiKey() {
    try {
      const { argusIntelProviders = {} } = await browser.storage.local.get({ argusIntelProviders: {} });
      return argusIntelProviders.vesselfinder?.apiKey || null;
    } catch { return null; }
  }

  async function searchVesselFinder(query, field) {
    const key = await getApiKey();
    if (!key) return null;

    try {
      let url;
      if (field === "mmsi") {
        url = `${VF_BASE}/vessels?userkey=${encodeURIComponent(key)}&mmsi=${query}`;
      } else if (field === "imo") {
        url = `${VF_BASE}/vessels?userkey=${encodeURIComponent(key)}&imo=${query}`;
      } else {
        // VesselFinder doesn't support name search directly — return null
        return null;
      }

      const resp = await fetch(url);
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) throw new Error("Invalid VesselFinder API key");
        return null;
      }
      const data = await resp.json();

      if (data?.AIS?.length) {
        return data.AIS.map(v => ({
          mmsi: String(v.MMSI || ""),
          imo: String(v.IMO || ""),
          name: v.SHIPNAME || v.NAME || "",
          callSign: v.CALLSIGN || "",
          lat: v.LATITUDE,
          lon: v.LONGITUDE,
          speed: v.SPEED,
          course: v.COURSE,
          heading: v.HEADING,
          destination: v.DESTINATION || "",
          eta: v.ETA || "",
          draught: v.DRAUGHT,
          navStatus: v.NAVSTAT,
          type: v.SHIPTYPE || v.TYPE_SPECIFIC || "",
          flag: v.FLAG || "",
          length: v.LENGTH,
          width: v.WIDTH,
          timestamp: v.TIMESTAMP,
          source: "vesselfinder",
        }));
      }
    } catch (e) {
      console.warn("[VesselLookup] VesselFinder error:", e.message);
      if (e.message.includes("Invalid")) throw e;
    }
    return null;
  }

  // ── Detect query type ──
  function detectQueryType(query) {
    const q = query.trim();
    if (/^\d{9}$/.test(q)) return "mmsi";
    if (/^\d{7}$/.test(q)) return "imo";
    return "name";
  }

  // ── Generate external tracking links ──
  function getTrackingLinks(query, field, vessel) {
    const links = [];
    const mmsi = vessel?.mmsi || (field === "mmsi" ? query : "");
    const imo = vessel?.imo || (field === "imo" ? query : "");
    const name = vessel?.name || (field === "name" ? query : "");

    if (mmsi) {
      links.push({ label: "MarineTraffic", url: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}` });
      links.push({ label: "VesselFinder", url: `https://www.vesselfinder.com/vessels/details/${mmsi}` });
      links.push({ label: "MyShipTracking", url: `https://www.myshiptracking.com/vessels?mmsi=${mmsi}` });
    } else if (imo) {
      links.push({ label: "MarineTraffic", url: `https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}` });
    }
    if (name) {
      links.push({ label: "VesselFinder Search", url: `https://www.vesselfinder.com/?name=${encodeURIComponent(name)}` });
      if (!mmsi) links.push({ label: "MarineTraffic Search", url: `https://www.marinetraffic.com/en/ais/home/?q=${encodeURIComponent(name)}` });
    }
    return links;
  }

  // ── Combined search ──
  async function search(query) {
    const field = detectQueryType(query);
    let results = null;
    let hasKey = !!(await getApiKey());
    let error = null;

    // Try VesselFinder API if key is configured
    if (hasKey && (field === "mmsi" || field === "imo")) {
      try {
        results = await searchVesselFinder(query, field);
      } catch (e) {
        error = e.message;
      }
    }

    const links = getTrackingLinks(query, field, results?.[0]);

    return {
      query,
      field,
      found: !!(results?.length),
      results: results || [],
      links,
      hasKey,
      error,
    };
  }

  // ── Public API ──
  return {
    search,
    searchVesselFinder,
    detectQueryType,
    getTrackingLinks,
  };
})();
