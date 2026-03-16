# Argus Location Intelligence Layer — Proposal

## Summary

Replace the current flat geomap with a multi-layered location intelligence system that stacks physical, wireless, and digital infrastructure data onto a unified spatial view — culminating in an interactive 3D globe that lets the user continuously zoom from abstract knowledge graph down to street-level imagery.

New location data providers (Google Maps Platform, WiGLE, Shodan, Censys) join the existing provider pattern as BYOK integrations. Each one is optional, additive, and gracefully degraded when unconfigured. The current Nominatim + Leaflet + CARTO stack remains the zero-config default.

---

## Problem Statement

The existing geomap is functional but shallow. It geocodes location-type KG entities via Nominatim, plots them as circle markers on a flat Leaflet map with CARTO dark tiles, and lets the user filter by type. That's it.

Three gaps:

1. **Geocoding quality** — Nominatim struggles with partial addresses, business names, and ambiguous location references. "The office on Michigan Ave" returns nothing. Google's geocoder resolves it.

2. **No enrichment at the location** — Once a pin is on the map, there's nothing more to learn. The user sees coordinates and source attributions, but not what's physically or digitally present at that location. No Street View, no business data, no wireless networks, no internet-facing devices.

3. **Flat visualization** — The geomap is disconnected from the KG. Entities live in the force-directed graph OR on the map, never in a unified spatial view. There's no way to see how abstract intelligence relationships map to physical geography.

---

## Design Principles

### BYOK for everything

Every data provider follows the existing pattern: user provides their own API key in the Providers tab, Argus orchestrates. No Argus-operated infrastructure, no shared accounts, no surprise costs.

### Graceful degradation

No Google Maps key? Nominatim geocoding + CARTO tiles (current behavior). No WiGLE key? Wireless layer hidden. No Shodan key? Device layer hidden. Every layer is independently optional. The base experience never breaks.

### Manual enrichment by default

Infrastructure lookups (WiGLE, Shodan, Censys) are triggered by user action, not automated. The user clicks a location and chooses "Scan wireless" or "Scan devices." This matches the semantic index philosophy — the user decides when to spend API calls and what data enters their system.

### Everything feeds the KG

Wireless networks, devices, and places discovered through location enrichment become KG entities with proper types, relationships, and source attribution. They participate in inference rules and appear in the connection graph.

---

## Location Data Providers

### Provider Interface

Each location provider implements:

```javascript
const LocationProviders = {
  google: {
    isConnected() → Promise<bool>,
    connect(config) → Promise<{success}>,
    disconnect() → Promise<{success}>,
    testConnection() → Promise<{success}>,
    geocode(query) → Promise<{lat, lng, formatted_address, place_id}>,
    reverseGeocode(lat, lng) → Promise<{formatted_address, components}>,
    placeDetails(place_id) → Promise<{name, address, phone, website, rating, reviews, hours, photos}>,
    placesNearby(lat, lng, radius, type) → Promise<[{place_id, name, lat, lng, types}]>,
    streetViewMeta(lat, lng) → Promise<{available, pano_id, date}>,
    directions(origin, destination, mode) → Promise<{routes, distance, duration}>,
  },
  wigle: { ... },
  shodan: { ... },
  censys: { ... },
};
```

### Google Maps Platform

**API key scope:** Geocoding API, Places API, Street View Static API, Maps JavaScript API, Directions API.

| Capability | Endpoint | What it gives Argus |
|-----------|----------|-------------------|
| Geocoding | `geocode/json` | Accurate lat/lng from partial addresses, business names, landmarks |
| Reverse Geocoding | `geocode/json` (latlng param) | Structured address components from coordinates |
| Place Details | `place/details/json` | Business name, phone, website, hours, rating, reviews, photos |
| Nearby Search | `place/nearbysearch/json` | Businesses and POIs within radius of a location |
| Street View | `streetview` (static) + JS embed | Street-level imagery for any geocoded address |
| Directions | `directions/json` | Routes, distance, and travel time between entities |
| Maps JS API | JavaScript library | Satellite/terrain/hybrid tiles, smooth camera transitions, native Street View panorama |

**Cost context:** Google gives $200/month free credit on Maps Platform. Geocoding is $5 per 1,000 requests. Place Details is $17 per 1,000. Street View Static is $7 per 1,000. A heavy research session might use 50–100 enrichment calls — well under $1.

**Fallback:** When no Google key is configured, all geocoding goes through Nominatim (existing behavior), tiles use CARTO (existing behavior), Street View and Place Details are simply unavailable.

### WiGLE (Wireless Geographic Logging Engine)

**API:** `https://api.wigle.net/api/v2`
**Auth:** API token (free account, generous rate limits)

| Capability | Endpoint | What it gives Argus |
|-----------|----------|-------------------|
| Network Search | `/network/search` | WiFi networks in a bounding box: SSID, BSSID, encryption, channel, first/last seen |
| Cell Tower Search | `/cell/search` | Cell towers in area: operator, technology (LTE/5G/etc), LAC, CID |
| Bluetooth Search | `/bluetooth/search` | Bluetooth devices in area: name, type, manufacturer |
| Network Detail | `/network/detail` | Full history for a specific BSSID |
| Stats | `/stats/general` | Regional wireless density statistics |

**What this means for OSINT:**

- Query a location → see every WiFi network broadcasting there. SSID naming reveals occupants ("ACME-CORP-5G", "WeWork-Floor3", "FBI-Surveillance-Van").
- First-seen dates tell you when a business moved in. Last-seen dates tell you if they're still there.
- Encryption types indicate security posture: WPA3-Enterprise vs open network.
- Cross-location SSID matching: if "ACME-Guest" appears at two different addresses in the KG, that strengthens the affiliation inference between those locations.
- Cell tower mapping around a location reveals carrier coverage and potentially identifies private cell infrastructure.

### Shodan

**API:** `https://api.shodan.io`
**Auth:** API key (free tier: limited queries, paid: full access)

| Capability | Endpoint | What it gives Argus |
|-----------|----------|-------------------|
| Host Lookup | `/shodan/host/{ip}` | Open ports, services, banners, OS, organization, ASN |
| Search | `/shodan/host/search` | Devices matching query (e.g., org:"Acme Corp" or net:203.0.113.0/24) |
| DNS Resolve | `/dns/resolve` | Domain → IP resolution |
| Reverse DNS | `/dns/reverse` | IP → hostnames |

**What this means for OSINT:**

- An IP address entity in the KG gets enriched with what's running on it: web servers, mail servers, databases, IoT devices.
- Search by organization name to find all their internet-facing infrastructure.
- Cross-reference with location data: the office at 123 Main St has IP range 203.0.113.0/24, which runs an exposed MongoDB on port 27017.

### Censys

**API:** `https://search.censys.io/api/v2`
**Auth:** API ID + Secret

| Capability | Endpoint | What it gives Argus |
|-----------|----------|-------------------|
| Host Search | `/hosts/search` | Internet hosts by query with services, TLS certs, autonomous systems |
| Host View | `/hosts/{ip}` | Detailed view of a specific host |
| Certificate Search | `/certificates/search` | TLS certificates by domain, org, issuer |

**What this means for OSINT:**

- TLS certificate search reveals all domains an organization has certs for — including internal subdomains they might not publicize.
- Certificate transparency logs show when certs were issued — a timeline of infrastructure deployment.
- Combined with Shodan, gives comprehensive internet-facing asset inventory for any entity in the KG.

---

## New KG Entity Types

| Type | Source | Properties |
|------|--------|------------|
| `wireless_network` | WiGLE | ssid, bssid, encryption, channel, firstSeen, lastSeen, signalStrength |
| `cell_tower` | WiGLE | operator, technology, lac, cid, frequency, firstSeen, lastSeen |
| `device` | Shodan/Censys | ip, ports, services, os, organization, asn, hostnames |
| `certificate` | Censys | subject, issuer, validFrom, validTo, domains, serialNumber |
| `place` | Google Places | placeId, name, address, phone, website, rating, types, hours |

### New Relationship Types

| Relation | Meaning | Example |
|----------|---------|---------|
| `broadcast-from` | Wireless network detected at location | "ACME-5G" → broadcast-from → "123 Main St" |
| `serves` | Cell tower covers location | "AT&T Tower 247" → serves → "Downtown Chicago" |
| `hosted-at` | Device is at an IP/location | "nginx/1.24" → hosted-at → "203.0.113.50" |
| `certified-for` | TLS cert covers domain | "DigiCert cert #xyz" → certified-for → "acme.com" |
| `operates` | Organization runs infrastructure | "Acme Corp" → operates → "ACME-5G" |
| `nearby` | Places near a location | "Starbucks #1234" → nearby → "123 Main St" |

### Inference Rules (additions)

- **SSID matching:** If the same SSID appears at two different locations, and one location has an "operates" edge to an organization, infer that organization is also "affiliated-with" the second location. Confidence weighted by SSID specificity (generic SSIDs like "xfinitywifi" excluded).
- **IP-to-org:** If a device at an IP has an organization field from Shodan, and a KG entity matches that org name, create an "operates" edge.
- **Cert-to-org:** If a TLS certificate's subject organization matches a KG entity, create a "certified-for" edge linking the cert to the entity.

---

## Globe Visualization

### The Concept

A continuous zoom from abstract intelligence to physical reality, all in one view:

```
Level 1: KG Globe
  Entities float as nodes on a 3D globe. Location entities are pinned
  to their coordinates. Organizations and people hover nearby, tethered
  by relationship edges. Spin the globe to see your research universe
  mapped spatially.

Level 2: Satellite Map
  Click a location cluster. The globe zooms. Abstract nodes dissolve.
  Map tiles (satellite imagery) load underneath. Non-location entities
  fade to a sidebar overlay. Location-bound entities snap to their
  real positions as map markers.

Level 3: Street Level
  Click a specific marker. If Google Maps key is configured, Street
  View loads in a split panel or takes over the viewport. You're
  looking at the building. The sidebar shows every entity connected
  to this location, every analysis that mentioned it, every project
  it appears in.

Level 4: Infrastructure Overlay
  Toggle layers. Wireless overlay shows WiGLE data — SSIDs floating
  next to the building. Device overlay shows Shodan results — open
  ports, services, banners. The physical and digital merge.
```

### Technical Implementation

**New file:** `osint/globe.html` + `globe.js` + `globe.css`

**Level 1 — Three.js Globe:**

- Three.js sphere with earth texture (NASA Blue Marble — public domain, ~2MB for decent resolution, or CARTO vector tiles rendered to canvas for a stylized look)
- KG nodes positioned by converting lat/lng to 3D coordinates on the sphere surface
- Location entities pinned to their geocoded position. Non-location entities positioned near their strongest "located-in" edge partner, or orbiting at a default altitude if no location association
- Relationship edges rendered as curved lines (great-circle arcs) between nodes on the sphere
- Mouse interaction: drag to rotate, scroll to zoom, click node for details
- Node styling matches existing graph.js: color by type, size by mention count

**Level 2 — Transition to Map:**

When the camera passes a zoom threshold (e.g., equivalent to zoom level ~6), crossfade from Three.js to an embedded map:

- **With Google Maps key:** Google Maps JavaScript API with satellite/terrain tiles, smooth camera animation, native tilt and rotation. The JS API handles the "continuous zoom" feel natively.
- **Without Google Maps key:** Leaflet with CARTO tiles (existing stack). The transition is less cinematic but functional. Snap from globe to flat map at the threshold.

KG nodes become map markers. The sidebar shows the entity list filtered to the visible area. Clicking a marker opens the enrichment panel.

**Level 3 — Street View:**

- **With Google Maps key:** `google.maps.StreetViewPanorama` embedded in a split panel. Auto-orient to face the building at the geocoded address. User can pan/zoom within the panorama.
- **Without Google Maps key:** Panel shows a placeholder with a link to open Google Maps in a new tab for that address.

**Level 4 — Infrastructure Overlays:**

Toggle buttons in the header (matching the existing geomap filter pattern):

```
[📍 Locations] [🏢 Organizations] [📡 Wireless] [🖥 Devices] [📜 Certs] [🏪 Places]
```

Each overlay renders differently on the map:
- **Wireless:** Small icons at approximate location with SSID labels. Click for full WiGLE details.
- **Devices:** Pins at IP-geolocated positions with port/service badges. Click for Shodan detail panel.
- **Certificates:** Linked to their domain's resolved IP location. Shown as document icons.
- **Places:** Google Places markers with rating badges.

### Data Flow

```
User opens Globe → osint/globe.html

background.js: getGraphData() → returns all KG nodes + edges
  ↓
globe.js: position nodes on Three.js sphere
  ↓
User zooms to a region → crossfade to map tiles
  ↓
User clicks a location marker → enrichment panel opens
  ↓
User clicks "Enrich" → manual triggers:
  ├── Google Places: nearby businesses, place details
  ├── Google Street View: panorama for this address
  ├── WiGLE: wireless networks in bounding box
  ├── Shodan: devices at associated IPs
  └── Censys: certificates for associated domains
  ↓
Results display in panel AND upsert to KG as new entities + edges
  ↓
New entities appear on the map immediately (markers added without page reload)
```

---

## User Interface

### Providers Tab — Location Providers Section

New section below "Vector Index" (from semantic index proposal) or below "Data Providers":

```
┌─────────────────────────────────────────────┐
│  Location Intelligence                       │
│                                              │
│  [Google Maps] [WiGLE] [Shodan] [Censys]    │
│                                              │
│  API Key:  [________________________]        │
│                                              │
│  Status: ● Connected                         │
│  [Test Connection]                           │
└─────────────────────────────────────────────┘
```

Google Maps has an additional field for selecting enabled APIs (Geocoding, Places, Street View, Directions) since the user may only have some enabled on their GCP project.

### Globe Page

Accessible from:
- Ribbon navigation (new icon alongside existing KG graph link)
- Project OSINT toolbar (new "Globe" button next to "Geomap")
- KG graph view (new "Switch to Globe" toggle)

### Enrichment Panel

When a location marker is clicked, a slide-out panel shows:

```
┌─────────────────────────────────────────┐
│  📍 123 Main Street, Chicago, IL        │
│  ─────────────────────────────────────  │
│  KG Connections: 7 entities             │
│    Acme Corp (organization)             │
│    John Smith (person)                  │
│    [+5 more]                            │
│                                         │
│  ─── Actions ───────────────────────── │
│  [🏪 Places Nearby]  [📷 Street View]  │
│  [📡 Scan Wireless]  [🖥 Scan Devices] │
│  [📜 Scan Certs]                        │
│                                         │
│  ─── Wireless Networks (14 found) ──── │
│  🔒 ACME-CORP-5G    WPA3   Ch.36       │
│  🔒 ACME-Guest      WPA2   Ch.6        │
│  🔓 xfinitywifi     Open   Ch.1        │
│  [+11 more]                             │
│                                         │
│  ─── Nearby Places ─────────────────── │
│  ⭐ 4.2  Starbucks        0.1mi        │
│  ⭐ 3.8  Subway           0.2mi        │
│  [+8 more]                              │
│                                         │
│  [Save all to KG]  [Export]             │
└─────────────────────────────────────────┘
```

"Save all to KG" upserts every discovered entity (wireless networks, places, devices) as KG nodes with edges connecting them to this location. This is the manual trigger — nothing enters the KG until the user explicitly chooses.

### Street View Panel

When the user clicks "Street View" and a Google Maps key is configured:

```
┌──────────────────────────────────────────────────────┐
│  ┌────────────────────────────┐  📍 123 Main St     │
│  │                            │                      │
│  │    [Street View Panorama]  │  Connected entities: │
│  │                            │  • Acme Corp         │
│  │    ← Pan / Zoom / Rotate → │  • John Smith        │
│  │                            │  • Filed: SEC 10-K   │
│  │                            │                      │
│  └────────────────────────────┘  Wireless:           │
│                                  • ACME-CORP-5G      │
│  Coverage: May 2024              • ACME-Guest         │
│  [Open in Google Maps ↗]                             │
└──────────────────────────────────────────────────────┘
```

---

## Existing Infrastructure Leverage

| New Capability | Existing Subsystem | Integration Type |
|----------------|-------------------|-----------------|
| Google geocoding | `background-osint.js` geocodeLocation() | Drop-in replacement when key present, Nominatim fallback |
| Place details | KG entity enrichment | New properties on existing location/organization nodes |
| Street View | `osint/geomap.js` marker popup | Embed panel triggered from existing marker click handler |
| WiGLE scan | KG entity creation | Same `upsertEntity()` path as all other extraction |
| Shodan lookup | KG entity creation | Same path, new entity types |
| Globe visualization | `osint/graph.js` data loading | Same `getGraphData()` call, different renderer |
| Infrastructure overlays | Geomap filter system | Same checkbox toggle pattern as Location/Organization/IP filters |
| Enrichment results | ArgusDB stores | New entity types use existing KGNodes/KGEdges stores |

---

## New Files

| File | Purpose | Approx Size |
|------|---------|------------|
| `lib/location-providers.js` | Google Maps, WiGLE, Shodan, Censys API implementations | ~500–600 lines |
| `osint/globe.html` | Globe visualization page shell | ~80 lines |
| `osint/globe.js` | Three.js globe renderer, zoom transitions, enrichment panel | ~800–1000 lines |
| `osint/globe.css` | Globe page styles | ~200 lines |

### Modified Files

| File | Change |
|------|--------|
| `background-osint.js` | New message handlers: `locationEnrich`, `wigleScan`, `shodanLookup`, `censysScan`. Updated `geocodeLocation()` to prefer Google when key available. |
| `background-kg.js` | New entity types (`wireless_network`, `cell_tower`, `device`, `certificate`, `place`). New relationship types. New inference rules for SSID matching, IP-to-org, cert-to-org. |
| `lib/storage-db.js` | No schema changes — new entity types use existing `kgNodes` and `kgEdges` stores. Type field distinguishes them. |
| `options/options.html` | Location Intelligence section in Providers tab. |
| `options/options.js` | Location provider tab logic, connection testing, API scope selection for Google. |
| `osint/geomap.js` | Google Maps tile layer option. Street View panel integration. New overlay toggles for wireless/devices/certs. |
| `osint/geomap.html` | Additional filter checkboxes, Street View container div, tile layer toggle. |
| `osint/graph.js` | "Switch to Globe" button. |
| `shared/ribbon.js` | Globe navigation entry. |
| `manifest.json` | No new permissions needed — all provider endpoints are user-configured URLs called via fetch(). |

---

## Implementation Phases

### Phase 1: Google Maps Integration

- Google geocoder as primary when key configured, Nominatim fallback
- Google Maps JS tile layer option in geomap (satellite/terrain/hybrid toggle)
- Street View panel on marker click
- Place Details enrichment: click a location → see nearby businesses, ratings, hours
- Provider UI in Settings

**New code:** ~400 lines (location-providers.js Google section + geomap.js integration)
**Modified files:** 4 (background-osint.js, geomap.js, geomap.html, options)
**Testable milestone:** Click a KG location on the geomap, see Street View of the address and nearby businesses.

### Phase 2: WiGLE + Shodan Integration

- WiGLE provider: scan wireless networks at a location
- Shodan provider: scan internet-facing devices at associated IPs
- Results display in enrichment panel on the geomap
- "Save to KG" action creates new entity types and relationships
- New KG entity types and inference rules

**New code:** ~300 lines (WiGLE + Shodan provider implementations, enrichment panel UI)
**Modified files:** 3 (location-providers.js, background-kg.js, geomap.js)
**Testable milestone:** Click a location, scan wireless, see SSIDs. Click "Save to KG," see wireless_network entities appear in the connection graph.

### Phase 3: Globe Visualization

- Three.js globe with KG nodes mapped to coordinates
- Camera zoom transitions from globe to map tiles
- Crossfade to Google Maps JS (or Leaflet fallback) at threshold
- Entity sidebar synced to visible region
- Click-through to enrichment panel and Street View

**New code:** ~800–1000 lines (globe.html, globe.js, globe.css)
**Modified files:** 3 (ribbon.js for nav, graph.js for toggle, options project toolbar for button)
**Testable milestone:** Open globe, see entities on a 3D sphere, zoom into a city, crossfade to satellite tiles, click a marker, see Street View.

### Phase 4: Censys + Advanced Overlays

- Censys provider: TLS certificate search and host scanning
- Certificate entities in KG with cert-to-org inference
- Full overlay system on globe/geomap: wireless, devices, certs, places as togglable layers
- Enrichment diffing: detect changes since last scan (new networks appeared, devices went offline)

**New code:** ~300 lines
**Modified files:** 3 (location-providers.js, background-kg.js, globe.js/geomap.js)
**Testable milestone:** Full enrichment panel with all four provider layers, all saveable to KG.

### Phase 5: Cross-Location Intelligence

- SSID matching across locations (automated inference rule)
- IP range correlation: if two locations share an ASN or IP block, flag potential relationship
- Distance/route analysis between entity locations (Google Directions)
- "Location profile" report: AI-generated summary of everything known about a location (KG entities + all enrichment data fed as context to configured AI provider)

**New code:** ~200 lines
**Modified files:** 2 (background-kg.js inference rules, background-osint.js for report generation)
**Testable milestone:** KG automatically creates "affiliated-with" edges when matching SSIDs are detected at two locations belonging to different entities.

---

## Total Resource Cost

| Resource | Cost |
|----------|------|
| Total new code | ~2000–2400 lines across all phases |
| New files | 4 (location-providers.js, globe.html, globe.js, globe.css) |
| Modified files | ~10–12 existing files |
| New library dependencies | Zero (Three.js already available; Google Maps JS loaded from CDN only when key configured) |
| New browser permissions | Zero |
| Extension size increase | ~15KB new code + optional earth texture (~2MB if bundled, or loaded from CDN) |
| IndexedDB schema changes | Zero (new entity types use existing KGNodes/KGEdges stores) |
| Performance impact | Globe page uses WebGL — requires GPU. Falls back to flat geomap on systems without WebGL support. Zero impact on other Argus features. |

**Cost Context**
The globe visualization is the largest single component (~1000 lines). For comparison, the existing `osint/graph.js` force-directed graph is ~900 lines. The location providers are lightweight REST wrappers — WiGLE, Shodan, and Censys combined are roughly the same size as one AI provider implementation in `background-providers.js`.

---

## Privacy & Safety

### API key handling

All location provider keys follow the same storage pattern as AI provider keys: `browser.storage.local`, encrypted by Vault when active, excluded from backups by default.

### Data stays local

Enrichment results (wireless networks, devices, certificates, places) are stored in the local KG. They are never sent anywhere unless the user explicitly includes them in a cloud backup, semantic index deployment, or export.

### Rate limiting

Google Maps Platform, WiGLE, Shodan, and Censys all have rate limits. Argus respects them:
- Google: per-API quotas managed by the user's GCP project
- WiGLE: 100 queries/day on free tier. Argus shows remaining quota in the enrichment panel.
- Shodan: 1 query/second on free tier. Argus queues requests.
- Censys: 250 queries/5min on free tier. Argus queues requests.

Scan results are cached locally (same pattern as Nominatim geocode cache). Repeat scans of the same location within 24 hours return cached data by default, with a "Force refresh" option.

### Responsible use notice

The enrichment panel includes a subtle notice: "Data sourced from public databases. Use responsibly and in accordance with each provider's terms of service." This appears once per session, not on every click.

---

## Open Questions

1. **Earth texture for globe** — Bundle a low-res NASA Blue Marble (~2MB), load higher-res from CDN on demand, or use a stylized vector-tile-to-canvas render that matches Argus's dark theme? Recommendation: stylized dark globe by default (matches UI, zero-cost), with satellite texture as a toggle when Google Maps key is present.

2. **Three.js bundle size** — Three.js r128 is already referenced in the artifact/rendering context but may not be bundled in the extension. If it needs to be added, the minified core is ~600KB. Acceptable? Or use a lighter WebGL globe library like Globe.gl (~150KB)? Recommendation: evaluate Globe.gl first — it's purpose-built for this exact use case and much smaller.

3. **WiGLE data density** — In urban areas, WiGLE can return thousands of networks for a single block. How should the UI handle this? Recommendation: default to a 50-meter radius for initial scan with a "Expand radius" option. Show top 20 networks sorted by signal strength, with "Show all" expansion.

4. **Shodan free tier limitations** — Free Shodan accounts have very limited search queries. Should Argus warn the user about remaining query credits before each scan? Recommendation: yes, show a "This will use 1 of your N remaining Shodan credits today" confirmation.

5. **Google Maps JS API loading** — The Maps JS API is loaded from Google's CDN. Should this be lazy-loaded only when the user has a key configured and opens the globe/geomap, or preloaded? Recommendation: lazy-load on first use to avoid unnecessary network requests and tracking for users who don't have a Google key.

6. **Globe as default graph view?** — Should the globe eventually replace the flat force-directed graph as the default KG visualization, or always be an alternative view? Recommendation: alternative view for now. The flat graph is better for pure relationship analysis where geography doesn't matter. The globe is better when spatial context matters. Let the user choose.

7. **IP geolocation accuracy** — Shodan/Censys provide IPs but IP-to-location mapping is notoriously imprecise (often city-level at best). Should the map indicate uncertainty radius for IP-geolocated markers? Recommendation: yes, show a translucent circle around IP-geolocated markers indicating approximate accuracy. Different visual treatment than precisely geocoded addresses.
