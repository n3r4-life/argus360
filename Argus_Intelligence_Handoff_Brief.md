# Argus Intelligence — Agent Handoff Brief

## Purpose of This Document

This is the single source of truth for building out the Intelligence layer of
Argus. Read this first, then the reference docs listed below. Do not begin
coding until you have read all four documents and understand how they relate.

---

## Reference Documents (read in this order)

1. **`Argus_Intelligence_Data_Providers_Proposal.md`**
   The full spec for all 12 intelligence data providers — API endpoints, auth,
   KG entity types, relationship types, OSINT value for each provider.
   This is the "what we're connecting to" document.

2. **`Argus_Intelligence_Skeleton_Build_Proposal.md`**
   What to build first: the provider interface file, background handlers,
   KG entity type registration, provider config UI, ribbon strip.
   This is the "backend foundation" document.

3. **`Argus_Intelligence_Navigation_Proposal.md`**
   Where the data lives in the UI: hub page, domain pages, enrichment panels,
   file structure, ribbon wiring.
   This is the "frontend foundation" document.

4. **This document** — architectural decisions made after those three were
   written that override or clarify anything in them.

---

## Critical Architectural Decisions (these override the other docs)

### Decision 1: Finance vs Intel domain split

The Navigation Proposal originally placed `intel/corporate.html` and
`intel/blockchain.html` as Intel domain pages. **This is wrong.**

Corporate/financial data (OpenCorporates, GLEIF, SEC EDGAR, blockchain
explorers) belongs inside the **Finance page** (`finance/finance.html`),
not in the `intel/` directory. These are financial intelligence tools.

The Finance page currently has a flat layout (just a watchlist). It needs
to be extended with a tab bar. The final Finance tab structure:

| Tab | Providers | Content |
|-----|-----------|---------|
| **Markets** | existing | Existing watchlist, price charts, portfolio — untouched |
| **Corporate** | OpenCorporates, GLEIF, SEC EDGAR | Ownership trees, officer lists, filings timeline, insider transactions |
| **Blockchain** | Blockstream, Etherscan, Blockchair | Wallet lookup, transaction flow graph, balance history |

The Intel Hub and Intel domain pages cover everything else:

| Domain Page | Providers |
|-------------|-----------|
| `intel/compliance.html` | OpenSanctions, CourtListener |
| `intel/movement.html` | OpenSky, ADS-B Exchange, MarineTraffic |
| `intel/events.html` | GDELT |
| `intel/satellite.html` | Sentinel Hub |

Radio (Broadcastify/OpenMHZ) has no dedicated page — it surfaces as a panel
layer on the geomap and on the movement page.

### Decision 2: Finance tab additions are scoped separately

The Finance tab expansion (Corporate + Blockchain tabs) is a separate build
from the Intel skeleton. Do not modify `finance/finance.html` or
`finance/finance.js` as part of this skeleton build. The skeleton build
scopes only to the `intel/` directory, `lib/intelligence-providers.js`,
and the shared files listed below.

The Finance tab expansion is a follow-on task once the skeleton proves out.

### Decision 3: Build order is fixed

Follow this exact sequence. Each step is independently testable before the
next begins:

```
Step 1 → lib/intelligence-providers.js        (provider interface + 2 live + stubs)
Step 2 → background.js handlers               (4 message handlers)
Step 3 → background-kg.js entity types        (INTEL_ENTITY_TYPES + 2 inference rules)
Step 4 → options/options.html + options.js    (Intelligence Providers config section)
Step 5 → intel/ navigation shell              (hub + 4 empty domain page shells)
Step 6 → shared/ribbon.js + argus-std.css     (ribbon icon + intel strip)
Step 7 → osint/geomap.js enrichment hook      (intel buttons in marker popup)
```

Do not skip ahead. Step 5 (pages) depends on Step 1–2 (data) being in place
so the hub status cards can render real provider state on first load.

---

## Codebase Pattern References

Before writing a single line, read these existing files to understand the
patterns you must match:

### Provider interface pattern
**Read:** `lib/cloud-providers.js` lines 1–10 (the comment header) and any
single provider implementation (e.g. the WebDAV provider ~lines 344–420).
Your `lib/intelligence-providers.js` must follow the exact same structure:
- Module-level IIFE returning a `const IntelProviders = (() => { ... })()`
- Per-provider config stored via `getProviderConfig(key)` / `saveProviderConfig(key, data)`
  reading from `browser.storage.local` key `dataProviders`
- Each provider object: `{ isConnected, connect, disconnect, testConnection, ...methods }`

### Background message dispatch pattern
**Read:** `background.js` lines ~1960–2010 (the vault + cloud dispatch block).
Your 4 new handlers go in the same block, same style:
```javascript
if (message.action === "intelGetStatus")    return handleIntelGetStatus();
if (message.action === "intelSearch")       return handleIntelSearch(message.provider, message.query, message.options);
if (message.action === "intelEnrichEntity") return handleIntelEnrichEntity(message.entityId, message.providers);
if (message.action === "intelScreenAll")    return handleIntelScreenAll();
```

### Status handler pattern
**Read:** `background.js` `handleAiGetStatus()` and `handleCloudGetStatus()`.
Your `handleIntelGetStatus()` returns the same shape:
```javascript
{ providers: { opensanctions: { configured, status, label }, ... } }
```

### Page shell pattern
**Read:** `osint/graph.html` (the full file) and `osint/graph.js` lines 1–30.
Every `intel/*.html` page must:
- Include `<script src="../shared/ribbon.js"></script>`
- Include `<link rel="stylesheet" href="../shared/argus-std.css">`
- Call `ArgusRibbon.init()` on DOMContentLoaded
- Use the same dark-theme CSS variables (`var(--bg-primary)`, `var(--text-primary)`, etc.)

### Navigation registration pattern
**Read:** `shared/ribbon.js` lines 184–220 (`APP_TAB_DEFS`, `ALL_TAB_IDS`,
`ACTIVE_MAP`, `DEFAULT_VISIBLE_TABS`).

Add intel pages to `APP_TAB_DEFS` but **not** to `ALL_TAB_IDS` or
`DEFAULT_VISIBLE_TABS`. Intel pages are ribbon-icon-navigated (like OSINT
tools), not app-tab-bar items (like Projects or Chat).

Add a `ribbon-intel` icon using `makeIcon()` exactly like the existing
`ribbon-osint` icon at line 77. Position it immediately after `ribbon-osint`.

Add intel paths to `ACTIVE_MAP`:
```javascript
"/intel/hub":        "ribbon-intel",
"/intel/corporate":  "ribbon-intel",
"/intel/compliance": "ribbon-intel",
"/intel/movement":   "ribbon-intel",
"/intel/events":     "ribbon-intel",
"/intel/blockchain": "ribbon-intel",  // reserved, not built in this phase
"/intel/satellite":  "ribbon-intel",
```

### Options provider config pattern
**Read:** `options/options.html` lines ~531–574 (the `data-provider-tab-list`
and `dp-gdrive-fields` sections) and `options/options.js`
`loadDataProviderFields()` / `saveDataProviderFields()`.
Your Intelligence Providers section in the Providers tab must follow the same
tab-list + hidden fields div pattern. Element IDs:
- `intel-provider-tab-list` — tab pill row
- `intel-{provider}-fields` — each provider config div (hidden/shown by tab)
- `intel-{provider}-status` — status span
- `intel-{provider}-test-btn` — test connection button

### Ribbon strip pattern
**Read:** `shared/ribbon.js` `_doUpdateAiStrip()` and the `.ribbon-ai-strip`
CSS in `shared/argus-std.css`.
Your `_doUpdateIntelStrip()` follows identical structure. The strip div goes
directly after the `ribbon-ai-strip` div in the DOM. CSS class:
`.ribbon-intel-strip` with `top: 68px` (ribbon 46px + AI strip 22px).

---

## The Two Live Provider Implementations

Implement these two fully in Step 1. All others are stubs.

### OpenSanctions
- Base URL: `https://api.opensanctions.org`
- Auth: none required for basic search (API key optional for higher rate limits)
- Methods to implement:
  - `testConnection()` → GET `/healthz` → expect 200
  - `search(query, dataset = "default")` → GET `/search/default?q={query}&limit=10`
  - `match(entity)` → POST `/match/default` with entity object `{ schema, properties }`
- `isConnected()` → always returns `true` (zero-config provider)
- Config stored as: `dataProviders.opensanctions = { apiKey: "" }` (optional key)

### SEC EDGAR
- Base URL: `https://efts.sec.gov` and `https://data.sec.gov`
- Auth: none — but **every fetch must include** `User-Agent: Argus/1.0 contact@example.com`
  (SEC requirement — requests without User-Agent are blocked)
- Methods to implement:
  - `testConnection()` → GET `https://efts.sec.gov/LATEST/search-index?q=test&dateRange=custom&startdt=2024-01-01&enddt=2024-01-02` → expect 200
  - `searchCompany(name)` → GET `https://efts.sec.gov/LATEST/search-index?q={name}&category=form-type&forms=10-K`
  - `getFilings(cik)` → GET `https://data.sec.gov/submissions/CIK{cik_padded}.json`
    (CIK must be zero-padded to 10 digits)
  - `getCompanyFacts(cik)` → GET `https://data.sec.gov/api/xbrl/companyfacts/CIK{cik_padded}.json`
- `isConnected()` → always returns `true` (zero-config provider)
- Config stored as: `dataProviders.secedgar = {}` (no credentials needed)

---

## KG Entity Types to Register

Add this constant to `background-kg.js` (or wherever existing KG entity type
validation lives). These type strings are registered now so the graph renderer
and enrichment panel handle them gracefully as providers are added over time.
No schema changes to IndexedDB — all use existing `KGNodes` / `KGEdges` stores.

```javascript
const INTEL_ENTITY_TYPES = [
  // Phase 1 — live in this build
  "filing",               // SEC EDGAR — annual/quarterly/material filings
  "insider_transaction",  // SEC EDGAR — Form 4 insider buys/sells

  // Registered now, implemented in later phases
  "court_case",           // CourtListener
  "vessel",               // MarineTraffic
  "aircraft",             // OpenSky / ADS-B Exchange
  "airport",              // OpenSky
  "port",                 // MarineTraffic
  "wallet",               // Blockchain explorers
  "transaction",          // Blockchain explorers
  "smart_contract",       // Blockchain explorers
  "global_event",         // GDELT
  "satellite_image",      // Sentinel Hub
  "radio_feed",           // Broadcastify / OpenMHZ
];
```

### Two inference rules to add to `background-kg.js`

**Rule 1 — Sanctions proximity flag:**
After `handleIntelScreenAll()` runs, for every entity that gets a `sanctioned`
flag, check all its connected entities (one hop via KGEdges). If a connected
entity is not itself sanctioned, add a `sanctions-adjacent: true` property and
a `sanction-proximity` edge with `source: "opensanctions-inference"`. This
surfaces associates of sanctioned entities without falsely marking them as
sanctioned.

**Rule 2 — SEC insider cross-reference:**
When an `insider-of` edge is created between a person and an organization,
query all other `insider-of` edges for that same person. For each additional
organization found, create a `corporate-link` edge between the two organizations
with `source: "sec-insider", via: personEntityId`. This automatically maps
shared director/officer relationships as organizational connections.

---

## Intel Hub Page — Minimum Viable Content

`intel/hub.html` must render the following on load with no user interaction:

1. **Provider status grid** — call `intelGetStatus`, render a dot + label for
   each provider. Green = connected, grey = not configured, amber = error.
   OpenSanctions and SEC EDGAR should always be green.

2. **Domain view cards** — 4 cards (Compliance, Movement, Events, Satellite).
   Each card shows provider count, a one-line description, and an "Open →"
   link. If all providers for a domain are unconfigured, show "Setup →"
   linking to `options/options.html#intel-providers` instead.

3. **Recent activity feed** — read from `storage.local` key `intelActivityLog`
   (a rolling array of 100 items). Each item: `{ type, label, entityId, ts }`.
   Show the 10 most recent. If empty, show "No intelligence activity yet."

4. **Quick action buttons:**
   - "Screen All Entities" → sends `intelScreenAll`, shows inline progress
   - "Open KG" → navigates to `osint/graph.html`

The hub page does NOT need charts, complex layouts, or real-time updates on
first build. Static load + the four elements above is sufficient for Phase 0.

---

## Empty Domain Page Shell Requirements

Each of the 4 domain page shells (`intel/compliance.html`,
`intel/movement.html`, `intel/events.html`, `intel/satellite.html`) must:

1. Include the ribbon and load cleanly with no console errors
2. Show the page title and a one-paragraph description of what will go here
3. Show a provider status row for that page's providers (reuse `intelGetStatus`)
4. Show a "Providers not configured" notice with a link to Settings if relevant
   providers have no API key
5. Have a clearly marked `<!-- CONTENT GOES HERE -->` comment block where the
   real implementation will land in later phases

This ensures every page in the navigation is reachable and informative from
day one, without being a dead end.

---

## manifest.json

Check `manifest.json` for a `web_accessible_resources` or `content_scripts`
section. The `intel/` pages must be registered the same way existing pages
like `osint/graph.html` and `finance/finance.html` are registered.

If the manifest uses a catch-all pattern like `"matches": ["<all_urls>"]` for
the extension pages, no changes are needed. Verify before assuming.

---

## What Success Looks Like

When this skeleton build is complete, the following must all work:

- [ ] Ribbon shows the Intel shield icon next to OSINT
- [ ] Clicking Intel icon opens `intel/hub.html`
- [ ] Hub shows green dots for OpenSanctions and SEC EDGAR
- [ ] Hub shows grey dots for all other providers
- [ ] Hub domain cards link to the 4 shell pages; all 4 open without errors
- [ ] Settings → Providers tab has an "Intelligence Providers" section
- [ ] OpenSanctions "Test Connection" button returns success
- [ ] SEC EDGAR "Test Connection" button returns success
- [ ] "Screen All Entities" runs against OpenSanctions and reports a result
- [ ] A KG organization entity can be enriched with SEC filings via `intelEnrichEntity`
- [ ] New `filing` entities appear in the KG graph after enrichment
- [ ] The intel strip renders below the AI strip on all Argus pages
- [ ] No console errors on any page load

---

## What Is Explicitly Out of Scope

Do not build any of the following as part of this skeleton:

- Finance page tab expansion (Corporate + Blockchain tabs) — separate task
- Full implementation of any provider other than OpenSanctions and SEC EDGAR
- The globe visualization — separate Location Intelligence proposal
- The full enrichment panel slide-out — separate proposal
- Automatic enrichment on entity creation
- Usage quota tracking dashboard
- The `intel/blockchain.html` and `intel/corporate.html` domain pages —
  these belong in Finance and are a separate task
