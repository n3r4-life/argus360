# Argus Intelligence Providers — Skeleton Build Proposal

## Objective

Build the foundational infrastructure that all 12 intelligence data providers
(defined in `Argus_Intelligence_Data_Providers_Proposal.md`) will plug into.
No providers are fully implemented here. The goal is a working, testable skeleton
that proves the pattern end-to-end and allows individual providers to be dropped
in one at a time without architectural changes.

When this skeleton is complete, adding a new intelligence provider is:
1. Add its implementation object to `lib/intelligence-providers.js`
2. Add its config fields to the Providers tab HTML
3. Add its config load/save to `options.js`
Done.

---

## What Gets Built

### 1. `lib/intelligence-providers.js` — Provider Interface + Two Stub Implementations

New file. Follows the exact same pattern as `lib/cloud-providers.js`:

```javascript
// Each provider: { connect, disconnect, isConnected, testConnection, ...domain methods }
const IntelProviders = (() => {

  async function getProviderConfig(key) { ... }   // reads from dataProviders[key]
  async function saveProviderConfig(key, data) { ... }

  return {

    // ── Provider 1: OpenSanctions (no API key — proves zero-auth pattern) ──
    opensanctions: {
      async isConnected() { return true; }, // always available
      async testConnection() { ... },
      async search(query) { ... },          // GET /search/default?q={query}
      async match(entity) { ... },          // POST /match/default
    },

    // ── Provider 2: SEC EDGAR (no API key — proves header-only auth pattern) ──
    secedgar: {
      async isConnected() { return true; }, // always available
      async testConnection() { ... },
      async searchCompany(name) { ... },    // /cgi-bin/browse-edgar?company=...
      async getFilings(cik) { ... },        // /submissions/CIK{cik}.json
      async getCompanyFacts(cik) { ... },   // /api/xbrl/companyfacts/CIK{cik}.json
    },

    // ── Placeholder stubs for all remaining providers ──
    // Each returns { connected: false, error: "Not yet implemented" }
    // so the UI can render them as "Coming Soon" without breaking anything
    opencorporates: _stub("opencorporates"),
    gleif:          _stub("gleif"),
    courtlistener:  _stub("courtlistener"),
    gdelt:          _stub("gdelt"),
    opensky:        _stub("opensky"),
    adsbexchange:   _stub("adsbexchange"),
    marinetraffic:  _stub("marinetraffic"),
    blockchain:     _stub("blockchain"),
    sentinelhub:    _stub("sentinelhub"),
    broadcastify:   _stub("broadcastify"),
  };
})();
```

**Why these two first:**
- OpenSanctions and SEC EDGAR require zero API keys. They prove the pattern
  without any provider setup friction. Every user has access from day one.
- Together they deliver real value immediately: run any KG entity through
  sanctions screening and pull SEC filings in Phase 1 of the full build.

**Estimated size:** ~300 lines including the two implementations and all stubs.

---

### 2. Background Message Handlers — `background.js`

New message dispatch block (analogous to the existing cloud/vault blocks):

```javascript
// ── Intelligence Providers ──
if (message.action === "intelGetStatus")     return handleIntelGetStatus();
if (message.action === "intelSearch")        return handleIntelSearch(message.provider, message.query, message.options);
if (message.action === "intelEnrichEntity")  return handleIntelEnrichEntity(message.entityId, message.providers);
if (message.action === "intelScreenAll")     return handleIntelScreenAll();
```

**Four handlers:**

`handleIntelGetStatus()` — reads `dataProviders` from storage, checks each
IntelProvider's `isConnected()`, returns a status map identical to
`handleAiGetStatus()` and `handleCloudGetStatus()`. Used by the ribbon/console
AI strip to show intelligence provider status indicators.

`handleIntelSearch(provider, query, options)` — calls the named provider's
search method, returns raw results. The frontend decides what to do with them
(display only, or save to KG).

`handleIntelEnrichEntity(entityId, providers)` — fetches the KG entity from
`ArgusDB.KGNodes.get(entityId)`, runs it through each specified provider's
enrichment method (name search, sanctions match, etc.), merges results back
onto the entity via `ArgusDB.KGNodes.save()`, creates new edge entities in
`ArgusDB.KGEdges`, returns a summary of what was added.

`handleIntelScreenAll()` — fetches all person and organization entities from
the KG, batches them through `IntelProviders.opensanctions.match()`, updates
each entity's `sanctioned` / `sanctionLists` properties, returns a summary
count. This is the "one click, screen everything" action.

**Estimated size:** ~120 lines.

---

### 3. New KG Entity Types — `lib/storage-db.js` + `background-kg.js`

No schema changes to IndexedDB — new entity types use the existing `KGNodes`
and `KGEdges` stores. The `type` field on each node distinguishes them.

**What changes in `background-kg.js`:**

Add the new type strings to the entity type registry (wherever existing types
like `"person"`, `"organization"`, `"location"` are defined or validated).

New types for Phase 1 (the two implemented providers):

```javascript
const INTEL_ENTITY_TYPES = [
  "filing",            // SEC EDGAR
  "insider_transaction", // SEC EDGAR
  "court_case",        // CourtListener (stub — registered now, used later)
  "vessel",            // MarineTraffic (stub)
  "aircraft",          // OpenSky (stub)
  "wallet",            // Blockchain (stub)
  "global_event",      // GDELT (stub)
  "satellite_image",   // Sentinel Hub (stub)
  "radio_feed",        // Broadcastify (stub)
];
```

Registering them now means the KG graph renderer, the globe, and the enrichment
panel can handle them gracefully (show a generic node rather than crashing) as
providers are added over time.

**Add two new inference rules to `background-kg.js`:**

- Sanctions hit propagation: if entity A is `sanctioned` and entity B is
  connected to A via any edge, flag entity B with a `sanctions-adjacent` tag
  (not a full sanctions hit — just a proximity alert).
- SEC insider cross-reference: if a person entity has `insider-of` edges to
  two different organizations, create a `corporate-link` edge between those
  organizations with `source: "sec-insider"`.

**Estimated size:** ~80 lines added to existing files.

---

### 4. Intelligence Providers Tab — `options/options.html`

New section in the Providers tab, below the existing Data Providers section.
Follows the exact same tab-list + config-panel pattern already used for AI
providers and Data providers.

```
┌─────────────────────────────────────────────────────────────┐
│  Intelligence Providers                                      │
│                                                              │
│  [Sanctions] [SEC EDGAR] [Corporate] [Legal] [Aviation]     │
│  [Maritime]  [Events]    [Blockchain] [Satellite] [Radio]   │
│                                                              │
│  ── OpenSanctions ─────────────────────────────────────── │
│  No API key required.                                        │
│  Status: ● Connected                                         │
│  [Test Connection]   [Screen All Entities]                   │
│                                                              │
│  ── SEC EDGAR ─────────────────────────────────────────── │
│  No API key required. Rate limit: 10 req/sec.                │
│  Status: ● Connected                                         │
│  [Test Connection]                                           │
│                                                              │
│  ── OpenCorporates ─────────────────────────────────────── │
│  API Key: [________________________]  [Coming Soon]          │
└─────────────────────────────────────────────────────────────┘
```

**Tab pills:** Same `.tab-btn` pattern as AI providers. Active tab shows its
config panel. Stub providers show a "Coming Soon" badge and disabled fields
so the section doesn't look empty.

**"Screen All Entities" button** lives in the OpenSanctions panel. Sends
`intelScreenAll` message. Shows a progress status line while running.

**New HTML element IDs following existing conventions:**
- `intel-provider-tab-list` — the tab pill row
- `intel-{provider}-fields` — each provider's config div
- `intel-{provider}-status` — status text span
- `intel-{provider}-connect` — test/connect button

**Estimated HTML additions:** ~120 lines.

---

### 5. Intelligence Provider Logic — `options/options.js`

New `initIntelProviders()` function, called in the `DOMContentLoaded` init
sequence. Follows the pattern of the existing `initDataProviders()`.

Responsibilities:
- Tab switching for the intelligence provider list
- Load/save API key fields for configured providers (OpenCorporates,
  CourtListener, etc. when they're added)
- Wire "Test Connection" buttons → send `intelGetStatus` → show status
- Wire "Screen All Entities" button → `intelScreenAll` → progress display
- On load: call `intelGetStatus` and render green/grey dots next to each tab pill

**Estimated size:** ~150 lines.

---

### 6. Ribbon + Console Strip Integration

Add intelligence provider dots to the existing AI status sub-strip, or add a
third strip row. Given the number of providers (12 eventual), a dedicated
third row is cleaner.

**`shared/ribbon.js`:** Add `_doUpdateIntelStrip()` — fetches `intelGetStatus`,
renders a thin strip with provider dots. Same structure as `_doUpdateAiStrip()`.
Only shows providers that are configured or always-available (OpenSanctions,
EDGAR).

**`shared/argus-std.css`:** Add `.ribbon-intel-strip` — same height and styling
as `.ribbon-ai-strip`, positioned below it at `top: 68px` (46 + 22).

**Estimated size:** ~60 lines across both files.

---

### 7. Enrichment Panel Hook Point — `osint/geomap.js`

The enrichment panel is defined in the Location Intelligence proposal but the
hook point can be stubbed now. When a KG entity marker is clicked on the
geomap, an "Enrich" section at the bottom of the existing popup shows:

```
── Intelligence ─────────────────────────────────
[Sanctions Check]  [SEC Filings]  [+ more when configured]
```

These buttons send `intelEnrichEntity` messages. Results display inline in
the popup as a collapsible list of what was found and added to the KG.

This is a ~30 line addition to the existing marker popup handler —
not a full enrichment panel redesign.

---

## Files Modified / Created

| File | Change | Est. Lines |
|------|--------|-----------|
| `lib/intelligence-providers.js` | **New** — provider interface + 2 implementations + stubs | ~300 |
| `background.js` | 4 new message handlers + dispatch lines | ~120 |
| `lib/storage-db.js` | Register INTEL_ENTITY_TYPES constant (no schema change) | ~20 |
| `background-kg.js` | New entity type list + 2 inference rules | ~60 |
| `options/options.html` | Intelligence Providers section in Providers tab | ~120 |
| `options/options.js` | `initIntelProviders()` function + init call | ~150 |
| `shared/ribbon.js` | `_doUpdateIntelStrip()` | ~40 |
| `shared/argus-std.css` | `.ribbon-intel-strip` styles | ~20 |
| `osint/geomap.js` | Enrichment hook in marker popup | ~30 |
| `manifest.json` | No changes needed | — |

**Total: ~860 lines across 9 files. No new dependencies. No new permissions.**

---

## What This Skeleton Delivers

After this build, Argus can:

1. **Screen every entity in the KG against global sanctions lists** with one
   button click. OpenSanctions is free and requires no setup.

2. **Pull SEC EDGAR filings** for any organization entity — annual reports,
   insider transactions, material events — with no API key.

3. **Display intelligence provider status** in the ribbon strip alongside
   AI and cloud providers.

4. **Show enrichment actions** on geomap markers so the enrichment panel
   interaction is proven before the full Location Intelligence build.

5. **Accept any future provider** as a drop-in: implement the interface,
   add config fields, done.

---

## What This Skeleton Deliberately Excludes

- Full implementations of OpenCorporates, GLEIF, CourtListener, GDELT,
  OpenSky, ADS-B Exchange, MarineTraffic, Blockchain, Sentinel Hub,
  Broadcastify — those are Phase 1–7 of the full proposal.
- The globe visualization — defined in the Location Intelligence proposal.
- The full enrichment panel slide-out — also in the Location Intelligence
  proposal.
- Automatic enrichment on entity creation — Phase 8 of the full proposal.
- Usage quota tracking dashboard — future work.

---

## Testable Milestones

**Milestone 1 — Provider infrastructure works:**
Open Settings → Providers tab → Intelligence section is visible.
OpenSanctions and SEC EDGAR show green "Connected" dots.
All stub providers show grey "Coming Soon" state without errors.

**Milestone 2 — Sanctions screening works:**
Navigate to Settings → Providers → Intelligence → OpenSanctions.
Click "Screen All Entities."
Any KG entities matching sanctions lists show a red shield badge in the graph.
Console shows count of screened entities and matches found.

**Milestone 3 — EDGAR enrichment works:**
Find an organization entity in the KG (e.g. a company name extracted from a
page analysis).
Click "SEC Filings" in the geomap enrichment hook or from the entity detail
panel.
Recent filings appear as `filing` entities linked to the organization.
An 8-K or insider transaction creates the appropriate KG edges.

**Milestone 4 — Ribbon strip renders:**
Reload any Argus page.
The intelligence strip shows below the AI strip with provider status dots.
Hovering a dot shows the provider name and connection status.

---

## Dependencies on Other Work

- **None blocking.** This skeleton is independent of the Location Intelligence
  proposal (globe, full enrichment panel) and the Semantic Index proposal.
- The geomap enrichment hook (Section 7) requires the geomap to have KG
  entity markers, which it already does.
- The ribbon intel strip requires `ribbon-ai-strip` to already exist as a
  layout reference — which it does.

---

## Suggested Build Order

1. `lib/intelligence-providers.js` — foundation everything else calls into
2. `background.js` handlers — wires the frontend to the providers
3. `lib/storage-db.js` + `background-kg.js` — entity types + inference rules
4. `options/options.html` + `options/options.js` — config UI
5. `shared/ribbon.js` + `shared/argus-std.css` — status strip
6. `osint/geomap.js` — enrichment hook point

Each step is independently testable. Steps 1–3 can be verified in the browser
console before any UI is built.
