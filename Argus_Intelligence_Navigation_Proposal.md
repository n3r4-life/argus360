# Argus Intelligence — Navigation & Information Architecture Proposal

## The Problem

The Intelligence Data Providers proposal defines 12 data sources covering
aviation, maritime, corporate registries, financial filings, court records,
global events, blockchain, satellite imagery, radio, and sanctions screening.

Each provider produces data. That data needs somewhere to live as a working
surface — not just as KG nodes, and not crammed into sidebars on existing pages.

The settings side is straightforward: more provider config sections in the
Providers tab. The question this proposal answers is:

**Where does the user go to actually work with intelligence data?
What does the entry point look like, and how do the pieces connect?**

---

## Design Principle: Three Tiers, One Data Layer

All intelligence data — regardless of which page surfaced it — ends up in the
same place: the KG (`ArgusDB.KGNodes` / `ArgusDB.KGEdges`). The KG is the
shared data layer. The intel pages are operational views on top of it.

**Tier 1 — The Intel Hub**
Entry point. Status overview. Cross-domain actions. Jump pad.

**Tier 2 — Domain Pages**
Dedicated pages for data classes that need their own visualization.
Each is a full-viewport experience, not a panel.

**Tier 3 — Enrichment Panels**
Entity-level intel that surfaces in context on existing pages.
You don't navigate to it — it comes to you when you click something.

---

## Tier 1: The Intel Hub (`intel/hub.html`)

### Ribbon Entry

A new `ribbon-intel` icon is added to the existing ribbon icon row in
`shared/ribbon.js`, positioned after the existing `ribbon-osint` entry.

```
[Bookmarks] [Projects] [Monitors] [Feeds] [OSINT] [Intel] [Automate] …
```

The icon: a shield with a cross-hair center (distinct from OSINT's graph icon).
The badge count: total sanctions hits across all KG entities (zero = no badge,
any hits = red number badge).

### Hub Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ARGUS RIBBON                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Intelligence                                                │
│                                                              │
│  ── Provider Status ──────────────────────────────────────  │
│  ● OpenSanctions   ● SEC EDGAR    ○ OpenCorporates          │
│  ○ CourtListener   ○ GLEIF        ○ GDELT                   │
│  ○ OpenSky         ○ MarineTraffic ○ Etherscan              │
│  ○ Sentinel Hub    ○ Broadcastify                           │
│                                                              │
│  ── Quick Actions ────────────────────────────────────────  │
│  [Screen All Entities]  [Full Investigation ▾]              │
│  [Run EDGAR Scan]       [Export Intel Report]               │
│                                                              │
│  ── Recent Activity ──────────────────────────────────────  │
│  🔴 Sanctions hit: Acme Holdings Ltd  — 2 hours ago         │
│  📄 SEC 8-K filed: NovaTech Corp     — 4 hours ago          │
│  ✈  Aircraft N12345 departed KLAX   — yesterday             │
│  🚢 Vessel "Pacific Star" went dark  — 2 days ago           │
│                                                              │
│  ── Domain Views ─────────────────────────────────────────  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Corporate   │  │  Compliance  │  │  Movement    │      │
│  │  & Financial │  │  & Legal     │  │  Tracking    │      │
│  │              │  │              │  │              │      │
│  │  4 providers │  │  2 providers │  │  3 providers │      │
│  │  [Open →]    │  │  [Open →]    │  │  [Open →]    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Media &     │  │  Blockchain  │  │  Geospatial  │      │
│  │  Events      │  │              │  │  & Radio     │      │
│  │  GDELT       │  │  3 providers │  │  2 providers │      │
│  │  [Open →]    │  │  [Open →]    │  │  [Open →]    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The domain view cards link to their respective domain pages. Cards for domains
with no configured providers show a "Setup →" link to the Providers tab instead
of "Open →".

The Recent Activity feed is a lightweight local log written by background
handlers each time an intel event fires (sanctions hit, new filing detected,
vessel went dark, etc.). Stored as a rolling 100-item log in `storage.local`.

---

## Tier 2: Domain Pages

Each domain page lives in a new `intel/` directory parallel to `osint/`.
Every page follows the same shell: Argus ribbon + AI strip + intel strip +
page-specific content. Every page is its own `.html` + `.js` + `.css` triple
exactly like the `osint/` pages.

### `intel/corporate.html` — Corporate & Financial

**Providers:** OpenCorporates, GLEIF, SEC EDGAR, CourtListener

**What it does:**
The primary investigation workspace for entity research. Given a company name
or person name, this page assembles everything: who owns it, who runs it, what
they've filed, who they've been sued by.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Search: company or person name…] [Investigate]           │
├───────────────────────────────────────────────────────────  │
│  SIDEBAR                    │  MAIN PANEL                   │
│                             │                               │
│  Entity Tree                │  [Overview] [Filings]         │
│  ├─ Acme Holdings Ltd       │  [Officers] [Ownership]       │
│  │  ├─ Acme US LLC          │  [Litigation] [Insider]       │
│  │  ├─ Acme Panama SA       │                               │
│  │  └─ Acme BVI Ltd         │  Tab content renders here     │
│  └─ [expand]                │  — corporate tree diagram     │
│                             │  — filing timeline            │
│  Connected Persons          │  — officer table              │
│  • John Smith (Director)    │  — insider transaction chart  │
│  • Jane Doe (Secretary)     │  — litigation docket list     │
│                             │                               │
│  [Save all to KG]           │                               │
└─────────────────────────────────────────────────────────────┘
```

The sidebar entity tree is a collapsible hierarchy built from OpenCorporates
network + GLEIF parent/child chains. The main panel tabs are content views
on the selected entity. Clicking any entity in the tree loads its details.

"Save all to KG" upserts everything currently shown (the full tree and all
discovered persons) as KG nodes and edges. This is the manual trigger — nothing
enters the KG until the user decides.

---

### `intel/compliance.html` — Compliance & Legal

**Providers:** OpenSanctions, CourtListener

**What it does:**
The due diligence workspace. Shows the sanctions screening status of every KG
entity and the litigation history of any person or organization.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Screen All Entities]  Last screened: 26-03-15 14:22       │
├────────────────────────────┬────────────────────────────────┤
│  SANCTIONS RESULTS         │  LITIGATION LOOKUP             │
│                            │                                │
│  🔴 Acme Holdings Ltd      │  [Search: name or case no…]   │
│     OFAC SDN — listed 2022 │                                │
│     [View details]         │  Results appear here:          │
│                            │  Case name, court, dates,      │
│  🔴 Viktor Petrov          │  nature of suit, parties       │
│     UN SC + EU Cons.       │                                │
│     [View details]         │  [Add to KG]                   │
│                            │                                │
│  ✅ 847 entities clean     │                                │
│                            │                                │
│  [Export hits report]      │                                │
└────────────────────────────┴────────────────────────────────┘
```

Sanctions hits show the red shield badge. Clicking "View details" expands the
full listing entry — which lists, what reasons, what aliases, associated persons.

The litigation panel is a search interface on CourtListener. Results can be
added to the KG or just reviewed in place.

---

### `intel/movement.html` — Movement Tracking

**Providers:** OpenSky, ADS-B Exchange, MarineTraffic

**What it does:**
Live and historical position tracking for aircraft and vessels. This page IS
a map — it's the geomap's sibling, purpose-built for tracking instead of
general OSINT.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [✈ Aviation] [🚢 Maritime]    [Search: tail / IMO / name…] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  MAP (Leaflet / Google Maps)                                 │
│                                                              │
│  Aviation mode: aircraft icons at current position           │
│  Maritime mode: vessel icons at current AIS position         │
│                                                              │
│  Click any marker → detail sidebar:                          │
│  ┌─────────────────────────────────┐                        │
│  │  ✈ N12345 — Gulfstream G650     │                        │
│  │  Owner: Redacted LLC            │                        │
│  │  Operator: Charter Air          │                        │
│  │  From: KLAX → To: KJFK          │                        │
│  │  Altitude: 41,000ft  Speed: 520 │                        │
│  │                                 │                        │
│  │  [Flight History] [Owner → KG]  │                        │
│  │  [Watch this aircraft]          │                        │
│  └─────────────────────────────────┘                        │
│                                                              │
│  History mode: arcs on map connecting origin/destination    │
│  Date range picker for historical queries                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

"Watch this aircraft/vessel" adds it to a watchlist that alerts when it moves.
This reuses the existing Watchlist/Monitor infrastructure.

---

### `intel/events.html` — Media & Global Events

**Providers:** GDELT

**What it does:**
Media coverage analysis and global event monitoring for entities of interest.
Chart-heavy and map-heavy — a dashboard view.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Entity or topic search…]  [Date range ▾]  [Search]       │
├─────────────────────────────────────────────────────────────┤
│  ── Coverage Volume ─────────────────────────────────────   │
│  [Line chart: article volume over time]                     │
│                                                             │
│  ── Sentiment Trend ─────────────────────────────────────   │
│  [Line chart: tone score over time — positive/negative]     │
│                                                             │
│  ── Geographic Coverage ─────────────────────────────────   │
│  [Mini map: heat overlay showing where topic is covered]    │
│                                                             │
│  ── Recent Articles ──────────────────────────────────────  │
│  • Title — Source — Date — Tone score                       │
│  • Title — Source — Date — Tone score                       │
│  [Load more]                                                │
│                                                             │
│  [Add coverage spike as KG event]  [Export]                 │
└─────────────────────────────────────────────────────────────┘
```

Coverage spikes can be saved to the KG as `global_event` entities. Those
entities then appear on the Globe (from the Location Intelligence proposal)
as event markers on the dates they spiked.

---

### `intel/blockchain.html` — Blockchain Intelligence

**Providers:** Blockstream, Etherscan, Blockchair

**What it does:**
Wallet and transaction investigation. The visualization here is a directed
graph — different from the KG graph in that it's specifically for following
money flows between addresses.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Chain: BTC ▾]  [Address or txid…]  [Lookup]              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TRANSACTION FLOW GRAPH (directed, force-layout)            │
│                                                              │
│  Nodes = wallets (size = balance)                           │
│  Edges = transactions (thickness = value, direction = flow) │
│                                                              │
│  Click a wallet node:                                       │
│  ┌─────────────────────────┐                               │
│  │  1A2B3C…xyz             │                               │
│  │  Balance: 2.47 BTC      │                               │
│  │  Txs: 847               │                               │
│  │  First seen: 2021-03-12 │                               │
│  │  [Expand]  [→ KG]       │                               │
│  └─────────────────────────┘                               │
│                                                             │
│  "Expand" loads the wallet's transaction partners and       │
│  adds them to the graph                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

This graph is separate from the main KG because blockchain graphs can expand
to thousands of nodes quickly when tracing funds. The user controls expansion
manually. "→ KG" promotes selected nodes to the main KG.

---

### `intel/satellite.html` — Satellite & Geospatial

**Providers:** Sentinel Hub

**What it does:**
Imagery comparison for locations under investigation. Before/after analysis,
change detection, time-lapse.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Search: address or KG location entity]  [Load]           │
├─────────────────────────────────────────────────────────────┤
│  Date A: [2024-01-15 ▾]    Date B: [2026-03-10 ▾]         │
├────────────────────────────┬────────────────────────────────┤
│  IMAGE A                   │  IMAGE B                       │
│                            │                                │
│  [Satellite tile viewer]   │  [Satellite tile viewer]       │
│                            │                                │
│  2024-01-15                │  2026-03-10                    │
│  Cloud cover: 12%          │  Cloud cover: 3%               │
│                            │                                │
├────────────────────────────┴────────────────────────────────┤
│  [Change Detection: ON]  Diff overlay renders between dates │
│  [Save comparison to KG location]  [Export images]         │
└─────────────────────────────────────────────────────────────┘
```

Radio/scanner (Broadcastify + OpenMHZ) does not get its own page. It surfaces
as a layer on the existing geomap and on the Movement Tracking page — a set of
coverage circles and a "Listen / Search Archives" panel in the location
enrichment sidebar.

---

## Tier 3: Enrichment Panels

These are not pages. They surface contextually on existing pages when the user
clicks something that has intel relevance.

### On the KG Graph (`osint/graph.html`)

Entity node click → existing detail sidebar gets a new "Intelligence" section:

```
── Intelligence ─────────────────────────────
[Sanctions]  [EDGAR]  [Corporate]  [Litigation]
[Aviation]   [Blockchain]
(grayed out if provider not configured)

Recent findings:
• Sanctions: clean ✅
• Last EDGAR filing: 10-Q, 2026-02-14
```

Buttons send `intelEnrichEntity` and display results inline.
"View full detail" opens the relevant domain page pre-loaded with this entity.

### On the Geomap (`osint/geomap.html`)

Location marker click → existing popup gets intel actions added at the bottom:

```
── Intelligence at this location ─────────
[Sanctions Check]  [Corporate Search]
[Scan Wireless]    [Scan Devices]    (from Location Intel proposal)
```

### On Project Items

Each project item row gets a context menu item: "Investigate" which opens
the Corporate page pre-searched with that item's title/domain.

---

## Navigation Wiring in `shared/ribbon.js`

New entry in the `APP_PAGES` map (the existing object that drives the
entry picker and ribbon icon navigation):

```javascript
"app-intel-hub":       { label: "Intel Hub",    path: "intel/hub.html" },
"app-intel-corporate": { label: "Corporate",    path: "intel/corporate.html" },
"app-intel-compliance":{ label: "Compliance",   path: "intel/compliance.html" },
"app-intel-movement":  { label: "Movement",     path: "intel/movement.html" },
"app-intel-events":    { label: "Events",       path: "intel/events.html" },
"app-intel-blockchain":{ label: "Blockchain",   path: "intel/blockchain.html" },
"app-intel-satellite": { label: "Satellite",    path: "intel/satellite.html" },
```

The ribbon icon (`ribbon-intel`) navigates to `intel/hub.html`. The hub page
then provides the sub-navigation to each domain page. Domain pages are also
accessible directly from the entry picker overlay (the existing "all apps"
grid).

The ribbon icon gets a badge counter: total unacknowledged intelligence alerts
(sanctions hits + anomaly flags). Same pattern as existing ribbon badge counts.

---

## Settings Entry Points

The existing Providers tab in `options/options.html` gains an
"Intelligence Providers" section (defined in the Skeleton Build Proposal).

The existing Settings tab gains a new "Intelligence" subsection with:
- Default enrichment providers (which providers run on "Full Investigation")
- Alert thresholds (sanctions: always alert; EDGAR: alert on 8-K only / all)
- Activity log retention (how many items to keep in the hub recent activity feed)
- "Screen on entity creation" toggle (off by default)

A quick-jump pill in the Settings tab pill bar links to the Intelligence
Providers section in the Providers tab — same pattern as the existing
"Cloud Folder" pill that jumps to the GDrive folder setting.

---

## File Structure

```
intel/
  hub.html          ← Intel Hub landing page
  hub.js
  hub.css
  corporate.html    ← Corporate & Financial
  corporate.js
  corporate.css
  compliance.html   ← Compliance & Legal (Sanctions + Courts)
  compliance.js
  compliance.css
  movement.html     ← Aviation & Maritime tracking
  movement.js
  movement.css
  events.html       ← GDELT media & global events
  events.js
  events.css
  blockchain.html   ← Crypto wallet & transaction analysis
  blockchain.js
  blockchain.css
  satellite.html    ← Satellite imagery comparison
  satellite.js
  satellite.css
```

All 7 pages follow the same shell (`shared/ribbon.js` included,
`shared/argus-std.css` for styling), so the ribbon, AI strip, and intel strip
appear consistently on every page.

---

## Implementation Phases

### Phase 0 — Navigation Shell (build this before any providers)

Build the `intel/` file structure and the hub page with empty domain cards.
Wire the ribbon icon. Register all `APP_PAGES` entries. Add intel strip to
ribbon.

**Result:** The Intel section exists in the ribbon. The hub page opens. All
domain page links exist (pages are empty shells). Users can see the navigation
works before any data flows.

**Files:** `intel/hub.html/js/css`, `shared/ribbon.js` (ribbon icon + pages),
`shared/argus-std.css` (intel strip styles). ~250 lines.

### Phase 1 — Compliance Page (first real data)

Implement `intel/compliance.html` backed by OpenSanctions and CourtListener.
Both providers are free/open. The "Screen All Entities" button works.
Sanctions hits show red badges in the KG graph and compliance page list.

This is the first time a user navigates to an intel domain page and sees
real data. Proves the full Tier 1 → Tier 2 → KG flow.

### Phase 2 — Corporate Page

`intel/corporate.html` backed by OpenCorporates + GLEIF + SEC EDGAR.
The corporate investigation workflow. Entity tree + filings timeline.

### Phase 3 — Movement Page

`intel/movement.html`. Aviation and maritime on a shared map.
Reuses the existing Leaflet map stack from `osint/geomap.js`.

### Phase 4 — Events Page

`intel/events.html`. GDELT charts and globe heat map.
No API key, immediately available.

### Phase 5 — Blockchain + Satellite Pages

`intel/blockchain.html` and `intel/satellite.html`.
Lower priority — more niche use cases than corporate/compliance.

---

## Total Build Cost for Navigation Shell (Phase 0 only)

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `intel/hub.html` | Hub page markup | ~80 |
| `intel/hub.js` | Provider status, activity feed, card wiring | ~150 |
| `intel/hub.css` | Hub-specific styles | ~80 |
| `intel/corporate.html` | Empty shell | ~30 |
| `intel/compliance.html` | Empty shell | ~30 |
| `intel/movement.html` | Empty shell | ~30 |
| `intel/events.html` | Empty shell | ~30 |
| `intel/blockchain.html` | Empty shell | ~30 |
| `intel/satellite.html` | Empty shell | ~30 |
| `shared/ribbon.js` | `ribbon-intel` icon + `APP_PAGES` entries | ~25 |
| `shared/argus-std.css` | Intel strip + hub card styles | ~40 |

**Total Phase 0: ~550 lines. No backend changes. No new providers needed.**

The hub page runs on `intelGetStatus` (from the skeleton build) and
`storage.local` for the activity log. Everything else is navigation scaffolding.
Phase 0 can be built before or in parallel with the Skeleton Build.
