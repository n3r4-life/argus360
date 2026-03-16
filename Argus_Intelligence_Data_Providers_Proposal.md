# Argus Intelligence Data Providers — Proposal

## Summary

Expand Argus's provider ecosystem with 12 new intelligence data sources spanning aviation, maritime, corporate registries, beneficial ownership, financial filings, court records, global events, blockchain analysis, satellite imagery, radio feeds, and sanctions screening. Each provider follows the established BYOK pattern, feeds structured data into the Knowledge Graph, and renders on the globe/geomap/timeline.

These aren't speculative features. Every API listed here is publicly accessible, returns structured data, and maps directly to KG entity types that Argus already manages. The architecture already exists — the KG, the globe, the timeline, the enrichment panel, the provider config UI. This proposal is about connecting new data hoses to existing plumbing.

---

## Design Principles (Same as All Other Proposals)

- **BYOK** — User provides their own API keys. No Argus infrastructure.
- **Graceful degradation** — Every provider is independently optional. Missing key = hidden UI.
- **Manual enrichment** — User triggers lookups. No background scanning unless explicitly configured.
- **Everything feeds the KG** — Results become entities and edges with proper types and source attribution.
- **Provider interface pattern** — Every provider implements `isConnected()`, `connect()`, `disconnect()`, `testConnection()`, plus domain-specific query methods.

---

## Provider Overview

| # | Provider | Domain | API | Auth | Free Tier |
|---|----------|--------|-----|------|-----------|
| 1 | OpenSky Network | Aviation | `opensky-network.org/api` | Optional (anonymous works) | Unlimited (anonymous), higher rate with account |
| 2 | ADS-B Exchange | Aviation | `adsbexchange.com/v2` | API key | RapidAPI plans from free tier |
| 3 | MarineTraffic | Maritime | `services.marinetraffic.com` | API key | Limited free, paid plans |
| 4 | OpenCorporates | Corporate Registry | `api.opencorporates.com/v0.4` | API key | 500 req/month free |
| 5 | GLEIF | Beneficial Ownership | `api.gleif.org/api/v1` | None (fully open) | Unlimited |
| 6 | SEC EDGAR | Financial Filings | `efts.sec.gov/LATEST` | User-Agent header only | Unlimited (10 req/sec) |
| 7 | CourtListener | Court Records | `www.courtlistener.com/api/rest/v4` | API token | Free for non-commercial |
| 8 | GDELT | Global Events | `api.gdeltproject.org/api/v2` | None (fully open) | Unlimited |
| 9 | Blockchain Explorers | Crypto/Finance | Multiple (Blockstream, Etherscan, etc.) | API key (Etherscan), none (Blockstream) | Generous free tiers |
| 10 | Sentinel Hub | Satellite Imagery | `services.sentinel-hub.com/api/v1` | OAuth2 | 30K processing units/month free |
| 11 | Broadcastify/OpenMHZ | Radio/Scanner | `api.broadcastify.com` + OpenMHZ | API key / None | Limited/free |
| 12 | Sanctions Lists | Compliance/Watchlists | OFAC, UN, EU (bulk downloads + APIs) | None | Fully public |

---

## Provider 1: OpenSky Network (Aviation Tracking)

### What It Is

Real-time and historical position data for every aircraft broadcasting ADS-B — commercial flights, private jets, military (when broadcasting), cargo, and general aviation. The most comprehensive open flight tracking data available.

### API Endpoints

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/states/all` | GET | All current aircraft states (lat/lng, altitude, velocity, heading, callsign, origin country) |
| `/states/all?icao24={hex}` | GET | Current state of a specific aircraft by ICAO24 hex code |
| `/flights/aircraft?icao24={hex}&begin={ts}&end={ts}` | GET | Flight history for an aircraft in time range |
| `/flights/arrival?airport={icao}&begin={ts}&end={ts}` | GET | All arrivals at an airport in time range |
| `/flights/departure?airport={icao}&begin={ts}&end={ts}` | GET | All departures from an airport in time range |
| `/tracks/all?icao24={hex}&time={ts}` | GET | Waypoint track for a specific flight |

### Auth

Anonymous access works with lower rate limits (5 seconds between requests). Registered accounts (free) get 1 second rate limits and access to historical data beyond 1 hour.

### KG Integration

**New entity types:**
- `aircraft` — icao24, registration, callsign, owner, operator, model, country
- `airport` — icaoCode, iataCode, name, lat, lng, country
- `flight` — callsign, origin, destination, departureTime, arrivalTime, aircraft

**New relationship types:**
- `registered-to` — aircraft → owner (person or organization)
- `operated-by` — aircraft → operator (organization)
- `flew-to` — aircraft → airport (timestamped)
- `departed-from` — aircraft → airport (timestamped)

### OSINT Value

- Track private/corporate jet movements by tail number or ICAO24 code
- Correlate jet locations with KG entity locations ("their jet was at the same airport as Entity B's headquarters")
- Temporal patterns: regular flight schedules reveal business relationships
- Historical route analysis: where has this aircraft been in the last 90 days?
- Plot flight paths on the globe as arcs connecting origin/destination

### Globe Integration

Aircraft positions render as small plane icons at their current lat/lng/altitude on the Three.js globe. Flight history renders as curved arcs connecting airports. Click an aircraft marker for enrichment panel: owner, operator, recent flights, connected entities.

---

## Provider 2: ADS-B Exchange (Aviation — Extended)

### What It Is

Alternative/complementary aviation data source. ADS-B Exchange is unfiltered — they don't honor military or government blocking requests that filter out some aircraft on other platforms. Accessible via RapidAPI.

### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `/v2/icao/{hex}` | Current state by ICAO24 |
| `/v2/callsign/{callsign}` | Current state by callsign |
| `/v2/reg/{registration}` | Current state by registration number |
| `/v2/lat/{lat}/lon/{lon}/dist/{nm}` | All aircraft within radius of coordinates |
| `/v2/mil` | All military aircraft currently broadcasting |

### Why Both OpenSky and ADS-B Exchange

OpenSky has better historical data and free access. ADS-B Exchange has real-time data without filtering. Together they cover the full spectrum. Argus queries whichever is configured (or both, merging results).

---

## Provider 3: MarineTraffic (Maritime Tracking)

### What It Is

Real-time and historical vessel tracking via AIS (Automatic Identification System). Every commercial vessel over 300 gross tons is required to broadcast AIS.

### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `/exportvessel/v:8/{shipid}` | Single vessel position and details |
| `/exportvessels/v:8/` | Multiple vessels by area, port, or fleet |
| `/portcalls/v:3/{shipid}` | Port call history for a vessel |
| `/vesselhistory/v:3/{shipid}` | Historical positions (track) |
| `/expectedarrivals/v:3/{port}` | Vessels expected at a port |
| `/berths/v:1/{port}` | Berth-level vessel positions |

### Auth

API key required. Free tier is limited. Paid plans start from ~$20/month. AIS data is also available from free sources (AISHub, VesselFinder basic API) that could serve as fallback providers.

### KG Integration

**New entity types:**
- `vessel` — imo, mmsi, name, callsign, flag, type, grossTonnage, owner, operator, builtYear
- `port` — name, unlocode, country, lat, lng

**New relationship types:**
- `owned-by` — vessel → organization/person
- `flagged-in` — vessel → country (location entity)
- `called-at` — vessel → port (timestamped)
- `departed` — vessel → port (timestamped)

### OSINT Value

- Track vessel movements by name, IMO, or MMSI number
- Sanctions evasion detection: vessel turns off transponder ("going dark") in suspicious areas
- Port call patterns reveal trade relationships
- Flag of convenience analysis: vessel owned by Company A (Germany), flagged in Panama, operating in Nigerian waters
- Cross-reference vessel owners with corporate registry data (OpenCorporates)

### Globe Integration

Vessel positions render as ship icons on ocean surfaces. Historical tracks render as lines across the globe. AIS gap detection highlighted in red ("transponder dark from here to here"). Port calls render as markers at port locations.

---

## Provider 4: OpenCorporates (Corporate Registry)

### What It Is

The largest open database of corporate entities: 200+ million companies across 140+ jurisdictions. Registration details, officers, filings, industry codes, and corporate network relationships.

### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `/companies/search?q={name}` | Search companies by name |
| `/companies/{jurisdiction}/{number}` | Company details by registration number |
| `/officers/search?q={name}` | Search officers/directors by name |
| `/companies/{j}/{n}/officers` | Officers of a specific company |
| `/companies/{j}/{n}/filings` | Filing history |
| `/companies/{j}/{n}/network` | Corporate network (parents, subsidiaries) |

### Auth

API key required. 500 requests/month free. Paid plans for higher volume.

### KG Integration

**Enriches existing types:**
- `organization` — adds: jurisdictionCode, registrationNumber, companyType, status, registeredAddress, incorporationDate, dissolutionDate, industryCode
- `person` — adds: officerPositions (director, secretary, etc.), appointmentDate, resignationDate

**New relationship types:**
- `officer-of` — person → organization (with position and dates)
- `subsidiary-of` — organization → parent organization
- `branch-of` — organization → parent organization
- `successor-of` — organization → predecessor organization

### OSINT Value

This is the backbone of corporate investigation. One entity name in the KG triggers a cascade:

1. Search OpenCorporates for the company → get jurisdiction and registration number
2. Pull officers → each becomes a person entity in the KG
3. Pull corporate network → parent companies, subsidiaries, branches all become organization entities
4. Each officer searched again → reveals their other directorships → those companies become entities
5. Registered addresses geocoded → pinned on globe → enriched with location intelligence

A single company name can generate a web of 50+ entities and 200+ edges in one enrichment pass. Visualized on the KG graph or globe, it reveals corporate structures that would take a human investigator days to map manually.

### Inference Rules

- If a person is `officer-of` two organizations, create a "corporate-link" edge between those organizations
- If two organizations share a registered address, create an "affiliated-with" edge
- If a subsidiary's jurisdiction is a known tax haven (Cayman Islands, BVI, Luxembourg, etc.), flag with a "tax-structure" tag

---

## Provider 5: GLEIF (Global Legal Entity Identifier Foundation)

### What It Is

The LEI (Legal Entity Identifier) system. A global registry linking legal entities to their ultimate parent and direct parent companies. Designed specifically to answer "who owns what" after the 2008 financial crisis revealed nobody knew.

### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `/lei-records?filter[entity.names]={name}` | Search by entity name |
| `/lei-records/{lei}` | Full record for a specific LEI |
| `/lei-records/{lei}/direct-parent` | Direct parent entity |
| `/lei-records/{lei}/ultimate-parent` | Ultimate beneficial parent |
| `/lei-records?filter[entity.registeredAddress.country]={code}` | Entities by country |

### Auth

Fully open. No API key required. No rate limits documented (reasonable use expected).

### KG Integration

Enriches `organization` entities with:
- `lei` — the Legal Entity Identifier code
- `entityStatus` — active, inactive, merged
- `registeredAt` — registration authority
- `directParent` — immediate parent entity (with LEI)
- `ultimateParent` — top-level beneficial owner (with LEI)
- `ownershipPercentage` — when available

**New relationship types:**
- `parent-of` — parent org → child org (with ownership percentage when available)
- `ultimately-owns` — ultimate parent → any entity in the chain

### OSINT Value

Combined with OpenCorporates, this answers the fundamental corporate investigation question: who actually controls this entity? Trace ownership chains from shell companies through intermediaries to the ultimate beneficial owner. Each link in the chain is a KG entity with its own address, jurisdiction, and officer list.

---

## Provider 6: SEC EDGAR (US Financial Filings)

### What It Is

Every filing made to the US Securities and Exchange Commission since 1993. 10-K annual reports, 10-Q quarterlies, 8-K material events, insider trading reports (Form 4), institutional holdings (13-F), proxy statements (DEF 14A), and more.

### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `/efts/LATEST/search-index?q={query}` | Full-text search across all filings |
| `/submissions/CIK{cik}.json` | Company info + recent filings by CIK number |
| `/api/xbrl/companyfacts/CIK{cik}.json` | Structured financial data (XBRL parsed) |
| `/cgi-bin/browse-edgar?company={name}&action=getcompany` | Company search |
| Bulk download | Full filing archives (daily, quarterly) |

### Auth

No API key. Requires User-Agent header identifying the requestor (standard practice). Rate limit: 10 requests per second.

### KG Integration

**Enriches existing types:**
- `organization` — adds: cik, sic, fiscalYearEnd, stateOfIncorporation, filingHistory
- `person` — adds: insiderTransactions, compensationData

**New entity types:**
- `filing` — type (10-K, 10-Q, 8-K, etc.), filedAt, periodOfReport, url, size
- `insider_transaction` — type (purchase/sale/grant), shares, pricePerShare, totalValue, date, relationship

**New relationship types:**
- `filed-by` — filing → organization
- `insider-of` — person → organization (with relationship type: director, officer, 10% owner)
- `insider-sold` — person → organization (timestamped, with value)
- `insider-bought` — person → organization (timestamped, with value)
- `institutional-holder` — organization → organization (with share count and value)

### OSINT Value

- Insider trading patterns: is the CEO selling while the company issues positive press releases?
- Institutional holder changes: who's accumulating or dumping shares?
- 8-K material events: executive departures, acquisitions, contract wins/losses — often filed before press releases
- Related-party transactions: disclosed in 10-K footnotes, reveal hidden relationships between entities
- Executive compensation: who earns what, and how (salary vs options vs bonuses)
- Feed financial data to the AI provider for analysis: "Summarize the risk factors from this 10-K"

### Finance Monitor Integration

SEC filings feed directly into the existing Finance Monitor:
- 8-K filings trigger alerts for watchlisted tickers
- Earnings dates from filing schedules populate the calendar
- Insider transaction data shows alongside price charts

### Timeline Integration

Filing dates, insider transactions, and material events all carry timestamps. They appear on the Timeline alongside everything else — page visits, analysis sessions, market events, listening history. "The CFO sold shares on the same day you analyzed their competitor's website" is a correlation that only Argus can surface because only Argus has all these data streams.

---

## Provider 7: CourtListener (Court Records)

### What It Is

Free, open API to millions of US federal and state court opinions, oral arguments, and docket entries. Run by Free Law Project, a nonprofit.

### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `/api/rest/v4/search/?q={query}` | Full-text search across opinions and dockets |
| `/api/rest/v4/dockets/?case_name={name}` | Dockets by case name |
| `/api/rest/v4/dockets/?parties={name}` | Dockets where entity is a party |
| `/api/rest/v4/opinions/{id}` | Full opinion text |
| `/api/rest/v4/people/?name_first={}&name_last={}` | Judge/attorney lookup |
| `/api/rest/v4/recap/` | PACER document archive (if contributed) |

### Auth

API token required. Free for non-commercial use. Rate limited but generous.

### KG Integration

**New entity types:**
- `court_case` — caseNumber, caseName, court, dateArgued, dateFiled, dateTerminated, status, natureOfSuit
- `court` — name, jurisdiction, level (district, circuit, supreme)
- `legal_opinion` — court, dateCreated, citation, precedentialStatus

**New relationship types:**
- `party-to` — person/organization → court_case (as plaintiff, defendant, appellant, etc.)
- `decided-by` — court_case → court
- `judged-by` — court_case → person (judge)
- `cites` — legal_opinion → legal_opinion (citation network)

### OSINT Value

- Litigation history for any entity: is this company a serial litigant? A serial defendant?
- Nature of suits: contract disputes, IP infringement, fraud, employment — patterns reveal organizational character
- Cross-party analysis: who else has been involved in cases with this entity?
- Judge assignment patterns: useful for legal strategy analysis
- Citation networks: which legal precedents are most cited in cases involving your entity?

---

## Provider 8: GDELT (Global Event Database)

### What It Is

GDELT monitors news media worldwide in real-time and categorizes every event by actors, action type, location, tone, and source URL. It's the largest open database of human societal events — billions of records going back to 1979.

### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `/api/v2/doc/doc?query={q}&mode=artlist` | Articles matching query with metadata |
| `/api/v2/doc/doc?query={q}&mode=timelinevol` | Volume of coverage over time |
| `/api/v2/doc/doc?query={q}&mode=timelinetone` | Sentiment/tone over time |
| `/api/v2/doc/doc?query={q}&mode=tonechart` | Tone distribution |
| `/api/v2/geo/geo?query={q}` | Geographic distribution of coverage |
| `/api/v2/tv/tv?query={q}` | TV news mentions (Visual Explorer) |

### Auth

Fully open. No API key. No authentication. No rate limits documented (reasonable use expected).

### KG Integration

**Enriches existing types:**
- `organization` — adds: mediaCoverage (volume, tone trends, geographic spread)
- `person` — same enrichment
- `location` — adds: eventDensity, recentEvents, toneProfile

**New entity types:**
- `global_event` — type (CAMEO code), actors, date, location, sourceUrl, tone, goldsteinScale

**New relationship types:**
- `involved-in` — person/organization → global_event
- `occurred-at` — global_event → location
- `reported-by` — global_event → source URL

### OSINT Value

- Media coverage analysis: how is this entity covered globally? Positive or negative? Increasing or decreasing?
- Event detection: protests, diplomatic meetings, military actions, natural disasters — all geocoded and timestamped
- Tone analysis: sentiment around an entity over time reveals reputation trajectory
- Geographic spread: where in the world is this entity being discussed?
- Source diversity: is coverage coming from diverse media or a single narrative?
- TV news monitoring: who's being mentioned on broadcast news?

### Globe Integration

GDELT's geographic data plots directly on the globe as event markers — colored by tone (green positive, red negative, yellow neutral), sized by coverage volume. The globe becomes a real-time global news map filtered to your entities of interest.

---

## Provider 9: Blockchain Explorers (Crypto Analysis)

### What It Is

Public blockchain data from Bitcoin, Ethereum, and other major chains. Every transaction is permanently recorded and publicly queryable.

### API Endpoints

**Bitcoin — Blockstream.info (no auth required):**
| Endpoint | Returns |
|----------|---------|
| `/api/address/{address}` | Balance, transaction count, total received/sent |
| `/api/address/{address}/txs` | Transaction history |
| `/api/tx/{txid}` | Transaction details (inputs, outputs, fees, confirmations) |
| `/api/block/{hash}` | Block details |

**Ethereum — Etherscan (API key, free tier: 5 calls/sec):**
| Endpoint | Returns |
|----------|---------|
| `/api?module=account&action=balance&address={addr}` | ETH balance |
| `/api?module=account&action=txlist&address={addr}` | Transaction list |
| `/api?module=account&action=tokentx&address={addr}` | ERC-20 token transfers |
| `/api?module=contract&action=getsourcecode&address={addr}` | Smart contract source |

**Multi-chain — Blockchair (limited free, paid plans):**
| Endpoint | Returns |
|----------|---------|
| `/bitcoin/dashboards/address/{addr}` | Bitcoin address dashboard |
| `/ethereum/dashboards/address/{addr}` | Ethereum address dashboard |
| Supports 19+ blockchains | Unified API across chains |

### KG Integration

**New entity types:**
- `wallet` — address, chain, balance, firstSeen, lastSeen, transactionCount, totalReceived, totalSent
- `transaction` — txid, chain, timestamp, value, fee, fromAddress, toAddress, confirmations
- `smart_contract` — address, chain, name, verified, sourceCode

**New relationship types:**
- `sent-to` — wallet → wallet (timestamped, with value)
- `received-from` — wallet → wallet (timestamped, with value)
- `controls` — person/organization → wallet (when attribution is known)
- `deployed` — wallet → smart_contract

### OSINT Value

- Argus already detects crypto addresses during regex scanning. Now those addresses become queryable entities.
- Transaction flow analysis: trace funds across wallets. Visualize as directed graph in the KG.
- Wallet clustering: common-input-ownership heuristic groups wallets controlled by the same entity.
- Smart contract analysis: what does this contract do? Feed source code to AI provider for explanation.
- Temporal correlation: overlay transaction timestamps on the Timeline alongside everything else.
- Whale watching: large movements on watched addresses trigger alerts (integrates with Finance Monitor).

### Finance Monitor Integration

Blockchain data extends the existing Finance Monitor:
- Watch specific wallet addresses for activity
- Large transaction alerts (threshold configurable)
- Balance tracking over time

---

## Provider 10: Sentinel Hub (Satellite Imagery)

### What It Is

ESA's Copernicus program provides free satellite imagery of the entire planet via the Sentinel constellation. Sentinel-2 provides optical imagery at 10m resolution every 5 days. Sentinel-1 provides radar imagery regardless of cloud cover.

### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `/api/v1/process` | Image tiles for bounding box, date, and band configuration |
| `/api/v1/catalog/search` | Search available imagery by area and date range |
| `/api/v1/statistics` | Statistical analysis of imagery (NDVI, cloud cover, etc.) |

### Auth

OAuth2 via Sentinel Hub account. Free tier: 30,000 processing units/month (roughly 300-500 image requests). Paid plans for higher volume.

### KG Integration

**New entity types:**
- `satellite_image` — bbox, captureDate, satellite, resolution, cloudCover, url

**New relationship types:**
- `imaged-at` — satellite_image → location (with date)

### OSINT Value

- Change detection: compare satellite imagery of a location over time. Construction progress, environmental damage, military activity, agricultural changes.
- Facility monitoring: is the factory still operational? Has the parking lot been full or empty?
- Environmental investigation: illegal deforestation, pollution, mining activity — all visible from space.
- Disaster assessment: before/after imagery for natural disasters affecting investigated locations.
- NDVI (vegetation index): detect land use changes that aren't visible in optical imagery.

### Globe Integration

Satellite imagery tiles render directly on the globe/map as an overlay layer. Date slider lets the user scrub through time. Side-by-side comparison mode shows two dates simultaneously. Heat map overlay for change detection (difference between two images highlighted).

### Page Monitor Synergy

The existing page monitor watches web pages for text changes. Satellite imagery adds a physical-world monitor: watch a location for visible changes. Same concept (periodic check, diff detection, alert on change), different domain.

---

## Provider 11: Broadcastify / OpenMHZ (Radio & Scanner Feeds)

### What It Is

Live and archived public safety radio feeds — police, fire, EMS, air traffic control, railroad, marine. Broadcastify is the largest archive. OpenMHZ provides free access to trunked radio system recordings.

### API Endpoints

**Broadcastify:**
| Endpoint | Returns |
|----------|---------|
| `/api/feed/{id}` | Feed metadata (agency, location, frequency) |
| `/api/feeds/geo/{lat}/{lng}/{range}` | Feeds near coordinates |
| `/api/archives/{feedId}/{date}` | Archived audio for a feed on a date |

**OpenMHZ:**
| Endpoint | Returns |
|----------|---------|
| `/api/systems` | Available trunked radio systems |
| `/api/calls?system={id}&talkgroup={tg}` | Recent calls on a talkgroup |
| `/api/calls?system={id}&q={search}` | Search call transcriptions |

### Auth

Broadcastify: API key (premium subscribers). OpenMHZ: no auth for public data.

### KG Integration

**New entity types:**
- `radio_feed` — name, agency, location, frequencies, type (police/fire/ems/aviation)
- `radio_call` — timestamp, duration, talkgroup, transcription (when available), audioUrl

**New relationship types:**
- `broadcasts-from` — radio_feed → location
- `operated-by` — radio_feed → organization (agency)

### OSINT Value

- Situational awareness for locations under investigation: what's happening on emergency frequencies near this address right now?
- Audio archive search: find radio calls mentioning a specific address, person, or incident
- Agency identification: which law enforcement/fire/EMS agencies operate near a location?
- Temporal correlation: radio activity spikes near a location on the same day as a KG event

### Globe Integration

Radio feed coverage areas render as translucent circles on the globe/map. Click to see feed details, listen to live or archived audio (opens in browser audio player or links to Broadcastify/OpenMHZ). Active feeds pulse gently to indicate live audio availability.

### Important Note

Audio playback happens via browser native audio or links to the provider's player — Argus does not need to build a streaming audio client. This keeps it simple and legal.

---

## Provider 12: Sanctions & Watchlists (Compliance Screening)

### What It Is

Publicly maintained lists of sanctioned individuals, entities, and vessels. Required screening for financial compliance, but equally valuable for OSINT investigations.

### Data Sources

| List | Maintained By | Coverage | Format |
|------|-------------|----------|--------|
| OFAC SDN | US Treasury | ~12,000 entries — persons, entities, vessels, aircraft | XML, CSV, JSON (API available) |
| OFAC Consolidated | US Treasury | All OFAC lists merged | XML, CSV |
| UN Security Council | United Nations | ~800 entries | XML |
| EU Consolidated | European Union | ~2,000 entries | XML, CSV |
| UK Sanctions | OFSI / UK Government | ~3,500 entries | CSV, ODS |
| World Bank Debarment | World Bank | ~1,200 entries | HTML (scrapeable), periodic CSV |
| Interpol Red Notices | Interpol | ~7,000 wanted persons | JSON API |
| PEP Lists | Various | Politically Exposed Persons | Varies (OpenSanctions aggregates) |

### Aggregator: OpenSanctions

[OpenSanctions](https://www.opensanctions.org/) aggregates all major sanctions lists plus PEP databases into a single, deduplicated, searchable dataset. Free API with generous rate limits.

| Endpoint | Returns |
|----------|---------|
| `/match/default` (POST) | Fuzzy match entity against all lists |
| `/entities/{id}` | Full entity record with all list appearances |
| `/search/default?q={name}` | Search across all datasets |

### KG Integration

**Enriches existing types:**
- `person` — adds: sanctioned (bool), sanctionLists [], sanctionReasons [], sanctionDates []
- `organization` — same enrichment
- `vessel` — same enrichment (OFAC specifically lists vessels)
- `aircraft` — same enrichment

**New relationship types:**
- `sanctioned-by` — entity → sanctioning authority
- `associated-with` — sanctioned entity → known associate (from sanctions data)

### OSINT Value

This is the compliance layer that turns Argus into a due diligence tool:

- **Automatic screening:** Run every person and organization entity in the KG against sanctions lists. Flag matches. This is a one-click operation: "Screen all entities."
- **Fuzzy matching:** Sanctions databases list name variants, aliases, and transliterations. OpenSanctions handles fuzzy matching natively.
- **Cascade discovery:** A sanctions hit on one entity reveals their listed associates — each of whom becomes a KG entity that can be cross-referenced against everything else.
- **Vessel/aircraft screening:** Cross-reference vessel and aircraft entities (from MarineTraffic/OpenSky) against OFAC's vessel and aircraft lists.
- **Ongoing monitoring:** When new entities are added to the KG (from any source), automatically screen them against sanctions if the user has enabled this.

### Critical UI Element

Sanctions matches need high visibility. A red shield badge appears on any KG entity that matches a sanctions list. The enrichment panel shows which lists matched, the reasons, and the listing date. This badge is visible everywhere the entity appears — graph view, project items, timeline, globe markers.

---

## New KG Entity Types (Consolidated)

| Type | Source Provider(s) | Key Properties |
|------|-------------------|---------------|
| `aircraft` | OpenSky, ADS-B Exchange | icao24, registration, callsign, owner, model, country |
| `airport` | OpenSky | icaoCode, iataCode, name, lat, lng, country |
| `flight` | OpenSky, ADS-B Exchange | callsign, origin, destination, timestamps |
| `vessel` | MarineTraffic | imo, mmsi, name, flag, type, tonnage, owner |
| `port` | MarineTraffic | name, unlocode, country, lat, lng |
| `filing` | SEC EDGAR | type, filedAt, period, url, filer |
| `insider_transaction` | SEC EDGAR | type, shares, price, value, date, relationship |
| `court_case` | CourtListener | caseNumber, caseName, court, dates, status, nature |
| `legal_opinion` | CourtListener | court, date, citation, precedentialStatus |
| `global_event` | GDELT | type, actors, date, location, tone, source |
| `wallet` | Blockchain Explorers | address, chain, balance, firstSeen, txCount |
| `transaction` | Blockchain Explorers | txid, chain, timestamp, value, from, to |
| `smart_contract` | Blockchain Explorers | address, chain, name, verified |
| `satellite_image` | Sentinel Hub | bbox, date, satellite, resolution |
| `radio_feed` | Broadcastify/OpenMHZ | name, agency, location, frequencies |
| `radio_call` | OpenMHZ | timestamp, duration, talkgroup, transcription |

---

## New Relationship Types (Consolidated)

| Relation | Meaning | Between |
|----------|---------|---------|
| `registered-to` | Aircraft ownership | aircraft → person/org |
| `operated-by` | Aircraft/vessel operator | aircraft/vessel → org |
| `flew-to` / `departed-from` | Flight movements | aircraft → airport |
| `called-at` / `departed` | Vessel port calls | vessel → port |
| `flagged-in` | Vessel flag state | vessel → location |
| `officer-of` | Corporate directorship | person → org |
| `subsidiary-of` | Corporate structure | org → parent org |
| `parent-of` / `ultimately-owns` | Beneficial ownership | parent → child org |
| `filed-by` | SEC filing | filing → org |
| `insider-of` | Insider relationship | person → org |
| `insider-sold` / `insider-bought` | Insider trading | person → org |
| `institutional-holder` | Share ownership | org → org |
| `party-to` | Litigation party | person/org → court_case |
| `involved-in` | Event participation | person/org → global_event |
| `occurred-at` | Event location | global_event → location |
| `sent-to` / `received-from` | Crypto transfer | wallet → wallet |
| `controls` | Wallet ownership | person/org → wallet |
| `imaged-at` | Satellite capture | satellite_image → location |
| `broadcasts-from` | Radio coverage | radio_feed → location |
| `sanctioned-by` | Sanctions listing | person/org → authority |

---

## Implementation Phases

### Phase 1: Corporate & Financial Intelligence

**Providers:** OpenCorporates + GLEIF + SEC EDGAR

These three form a complete corporate investigation stack. Given a company name, Argus can now trace ownership, officers, subsidiaries, financial filings, and insider activity.

**New code:** ~600–800 lines (provider implementations + KG entity types)
**Modified files:** 4 (intelligence-providers.js, background-kg.js, options UI, enrichment panel)
**Testable milestone:** Click an organization entity → auto-enrich with corporate registry data, officer list, ownership chain, and recent SEC filings. Officers appear as person entities. Subsidiaries appear as organization entities. All connected by edges.

### Phase 2: Legal & Compliance

**Providers:** CourtListener + Sanctions/OpenSanctions

Legal risk assessment and compliance screening. One-click sanctions screening across all KG entities. Litigation history for any person or organization.

**New code:** ~400–500 lines
**Modified files:** 3 (intelligence-providers.js additions, background-kg.js, enrichment panel)
**Testable milestone:** "Screen all entities" button scans every person/org in KG against sanctions lists. Matches flagged with red badge. Click an entity → see litigation history with case details.

### Phase 3: Aviation & Maritime

**Providers:** OpenSky + ADS-B Exchange + MarineTraffic

Physical movement tracking for aircraft and vessels. Flight paths and port calls on the globe.

**New code:** ~500–600 lines
**Modified files:** 3 (intelligence-providers.js additions, globe.js for rendering, background-kg.js)
**Testable milestone:** Enter a tail number → see flight history plotted as arcs on the globe. Enter a vessel name → see port call history. Cross-reference owner entities with existing KG data.

### Phase 4: Global Events & Media Intelligence

**Providers:** GDELT

Event monitoring, media coverage analysis, and sentiment tracking for any entity. The globe becomes a global news map.

**New code:** ~300–400 lines
**Modified files:** 3 (intelligence-providers.js, globe.js for event markers, timeline integration)
**Testable milestone:** Search an entity name → see global media coverage volume over time, sentiment trends, geographic spread of coverage, and recent event markers on the globe.

### Phase 5: Blockchain Intelligence

**Providers:** Blockstream + Etherscan + Blockchair

Crypto address investigation, transaction tracing, and wallet analysis.

**New code:** ~400–500 lines
**Modified files:** 3 (intelligence-providers.js, background-kg.js, finance monitor integration)
**Testable milestone:** Regex scanner finds a BTC address on a page → click to enrich → see balance, transaction history, and connected wallets visualized as a directed graph in the KG. Large transactions generate Finance Monitor alerts.

### Phase 6: Satellite & Geospatial

**Providers:** Sentinel Hub

Satellite imagery overlay on the globe/geomap. Time-lapse comparison for location monitoring.

**New code:** ~400–500 lines
**Modified files:** 3 (intelligence-providers.js, globe.js for imagery layer, geomap.js)
**Testable milestone:** Click a location on the globe → load satellite imagery → scrub date slider to compare imagery over time. Highlight changes between dates.

### Phase 7: Radio & Situational Awareness

**Providers:** Broadcastify + OpenMHZ

Radio feed discovery and audio archive search for locations under investigation.

**New code:** ~200–300 lines
**Modified files:** 2 (intelligence-providers.js, globe.js/geomap.js for feed markers)
**Testable milestone:** Click a location → see nearby radio feeds → click to listen or search archives.

---

## Total Resource Cost

| Resource | Cost |
|----------|------|
| Total new code | ~2800–3600 lines across all phases |
| New files | 1 primary (lib/intelligence-providers.js) + UI components |
| Modified files | ~8–10 existing files |
| New library dependencies | Zero |
| New browser permissions | Zero |
| Extension size increase | < 40KB (all provider code) |
| IndexedDB schema changes | Zero (all new entity types use existing KGNodes/KGEdges stores) |
| Performance impact | Zero when not actively querying. All lookups are user-triggered. |

---

## Existing Infrastructure Leverage

Every single provider in this proposal feeds data through systems Argus already ships:

| Capability | Existing Subsystem |
|-----------|-------------------|
| Entity storage | ArgusDB KGNodes / KGEdges |
| Relationship inference | background-kg.js inference rules |
| Spatial visualization | Globe (Location Intelligence proposal) / Geomap |
| Temporal visualization | Timeline |
| Financial data display | Finance Monitor |
| AI analysis of results | Any configured AI provider via callProvider() |
| Export / sharing | Export Utils, Paste providers, Email share |
| Project organization | Projects system |
| Keyword alerting | Watchlist |
| Cloud backup | Cloud backup system (includes KG data) |
| Enrichment UI pattern | Geomap enrichment panel (Location Intelligence proposal) |

**No new UI paradigms.** Every provider's results display using existing UI patterns: KG graph nodes, globe markers, timeline events, enrichment panel details, Finance Monitor alerts. The user learns the interaction once and it works for all 12 providers.

---

## Privacy & Safety

### All data is local

Enrichment results from every provider are stored in the local KG. Nothing is shared, uploaded, or transmitted except the queries the user explicitly triggers.

### Responsible use

Some of these tools are powerful investigative instruments. The extension includes:
- A first-run notice for intelligence providers: "These tools access public data sources. Use responsibly, ethically, and in accordance with applicable laws and each provider's terms of service."
- Per-provider TOS links in the settings panel
- Rate limit awareness: remaining quotas displayed where providers expose them

### Sanctions screening disclaimer

The sanctions screening feature is not a substitute for professional compliance screening. A notice in the UI states: "Sanctions screening results are for informational purposes only. Consult a compliance professional for official due diligence requirements."

### No bulk surveillance

Argus enriches entities the user has already collected through their own research. It does not bulk-scan, bulk-scrape, or mass-surveil. Every lookup is on a specific entity the user chose to investigate.

---

## Open Questions

1. **Provider grouping in UI** — Should all 12+ intelligence providers share one settings tab, or should they be grouped? Recommendation: group by domain — "Corporate & Financial" (OpenCorporates, GLEIF, SEC EDGAR), "Movement Tracking" (OpenSky, ADS-B, MarineTraffic), "Events & Media" (GDELT, Broadcastify), "Digital" (Blockchain, Sentinel Hub), "Compliance" (Sanctions). Each group is a subtab within the Intelligence Providers section.

2. **Enrichment automation** — Should users be able to create automations that auto-enrich new KG entities? E.g., "When a new organization entity is created, automatically search OpenCorporates and screen against sanctions." Recommendation: yes, as a Phase 8 feature. New automation step type: "Enrich Entity" with configurable provider and entity type filters.

3. **Data volume** — A single OpenCorporates enrichment pass on a company can generate 50+ new entities. Should Argus show a preview ("This will create approximately 47 new entities and 183 edges. Proceed?") before committing? Recommendation: yes, with an "Always allow for this provider" checkbox.

4. **Stale data** — How long should enrichment results be cached before showing a "data may be stale" indicator? Recommendation: provider-specific. Real-time data (OpenSky, ADS-B): 5 minutes. Corporate data: 30 days. Sanctions: 7 days. Satellite: per-image (immutable). Court records: 30 days.

5. **Composite enrichment** — Should Argus offer a "Full Investigation" button that runs all configured providers on an entity in sequence? E.g., click "Investigate" on an organization → OpenCorporates → GLEIF → SEC EDGAR → CourtListener → Sanctions → GDELT → all results merged into KG. Recommendation: absolutely yes. This is the power move. One click, full dossier.

6. **KG visualization scaling** — With 12 providers potentially feeding hundreds of entities each, the KG graph could become overwhelming. Should the globe/graph default to showing only high-confidence or high-mention entities, with a "Show all" expansion? Recommendation: yes. Default view shows entities with 2+ connections or 2+ mentions. "Show all" reveals the full graph. Filter by source provider.

7. **Free tier viability** — Several providers have limited free tiers. Should Argus track cumulative API usage across providers and warn when approaching limits? Recommendation: yes, a simple usage dashboard in Settings showing requests used / limit for each configured provider. Resets displayed where applicable.
