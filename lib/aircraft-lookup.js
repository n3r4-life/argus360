// ──────────────────────────────────────────────
// Aircraft Lookup — tail number → ICAO24 hex via hexdb.io + enrichment
// No API key required. Works standalone for any page.
// ──────────────────────────────────────────────

const AircraftLookup = (() => {
  "use strict";

  // ── Registration → ICAO24 hex ──
  // Try hexdb.io first, fall back to FAA registry scrape
  async function regToHex(tailNumber) {
    const clean = tailNumber.toUpperCase().replace(/[^A-Z0-9-]/g, "");

    // Try hexdb.io first (fast, JSON)
    try {
      const resp = await fetch(`https://hexdb.io/reg-hex?reg=${encodeURIComponent(clean)}`);
      if (resp.ok) {
        const hex = (await resp.text()).trim().toLowerCase();
        if (hex && /^[0-9a-f]{6}$/.test(hex)) return { hex, source: "hexdb" };
      }
    } catch { /* silent */ }

    // Fall back to FAA registry (US N-numbers only, HTML scrape)
    if (clean.startsWith("N")) {
      try {
        const nNum = clean.slice(1); // FAA wants it without the N
        const resp = await fetch(`https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(nNum)}`);
        if (resp.ok) {
          const html = await resp.text();
          // Extract Mode S Code (hex) from the HTML table
          const modeMatch = html.match(/Mode\s*S\s*Code(?:\s*\(base\s*16\))?[^<]*<[^>]*>[^<]*<[^>]*>\s*([0-9A-Fa-f]{6,8})/i);
          if (modeMatch) {
            const hex = modeMatch[1].trim().toLowerCase().slice(-6);
            return { hex, source: "faa" };
          }
          // Try alternate pattern
          const altMatch = html.match(/ModeS[^:]*:\s*([0-9A-Fa-f]{6,8})/i) ||
                           html.match(/data-label="Mode S[^"]*"[^>]*>[^<]*<[^>]*>\s*([0-9A-Fa-f]{6,8})/i);
          if (altMatch) {
            const hex = altMatch[1].trim().toLowerCase().slice(-6);
            return { hex, source: "faa" };
          }
        }
      } catch { /* FAA may block or timeout */ }
    }

    return null;
  }

  // ── Aircraft metadata from hexdb.io ──
  async function getAircraftInfo(hex) {
    try {
      const resp = await fetch(`https://hexdb.io/api/v1/aircraft/${hex.toLowerCase()}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return {
        icao24: hex.toLowerCase(),
        registration: data.Registration || "",
        manufacturer: data.Manufacturer || data.ManufacturerName || "",
        type: data.Type || data.ICAOTypeCode || "",
        model: data.TypeDesignator || "",
        owner: data.RegisteredOwners || "",
        operator: data.OperatorFlagCode || "",
      };
    } catch {
      return null;
    }
  }

  // ── Scrape aircraft details from FAA HTML (fallback enrichment) ──
  async function getFaaInfo(tailNumber) {
    try {
      const nNum = tailNumber.toUpperCase().replace(/^N/, "");
      const resp = await fetch(`https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(nNum)}`);
      if (!resp.ok) return null;
      const html = await resp.text();

      function extract(label) {
        const re = new RegExp(label + '[^<]*<[^>]*>[^<]*<[^>]*>\\s*([^<]+)', 'i');
        const m = html.match(re);
        return m ? m[1].trim() : "";
      }

      return {
        registration: "N" + nNum,
        manufacturer: extract("Manufacturer Name") || extract("MFR"),
        model: extract("Model"),
        type: extract("Type Aircraft"),
        owner: extract("Name") || "",
        serialNumber: extract("Serial Number"),
        year: extract("Year Manufacturer") || extract("Year MFR"),
      };
    } catch {
      return null;
    }
  }

  // ── Combined: tail number → hex + full info ──
  async function lookupByTailNumber(tailNumber) {
    const hexResult = await regToHex(tailNumber);
    if (!hexResult) return { found: false, query: tailNumber };

    // Try hexdb.io enrichment first, fall back to FAA scrape
    let info = await getAircraftInfo(hexResult.hex);
    if (!info || (!info.manufacturer && !info.owner)) {
      const faaInfo = await getFaaInfo(tailNumber);
      if (faaInfo) {
        info = { ...info, ...faaInfo, icao24: hexResult.hex };
      }
    }

    return {
      found: true,
      query: tailNumber,
      hex: hexResult.hex,
      source: hexResult.source,
      info: info || { icao24: hexResult.hex, registration: tailNumber },
    };
  }

  // ── Combined: hex → full info ──
  async function lookupByHex(hex) {
    const info = await getAircraftInfo(hex);
    return {
      found: !!info,
      query: hex,
      hex: hex.toLowerCase(),
      info: info || { icao24: hex.toLowerCase() },
    };
  }

  // ── Public API ──
  return {
    regToHex,
    getAircraftInfo,
    lookupByTailNumber,
    lookupByHex,
  };
})();
