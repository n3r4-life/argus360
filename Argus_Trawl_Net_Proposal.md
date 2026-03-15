**ARGUS**
FEATURE PROPOSAL

**Trawl Net**
Passive Intelligence Collection During Natural Browsing

Prepared for: Argus Development Team
Date: March 15, 2026
Version: 1.0
Classification: Internal

# **Executive Summary**
Trawl Net is a passive intelligence collection feature for Argus that automatically extracts structured contact data, business information, and metadata from every page a user visits during a research session. The user enables the trawl, browses naturally, and later returns to a consolidated intelligence view that surfaces the most relevant contacts, businesses, and leads weighted by engagement signals.
This proposal covers the concept, architecture, integration with existing Argus subsystems, implementation phasing, and estimated resource cost. The feature requires zero new library dependencies and builds almost entirely on infrastructure Argus already ships.

**Key Takeaway**
The user browses. The net collects. The morning-after view surfaces what matters.
Zero new dependencies. ~500–700 lines of new code. Integrates with Page Tracker, KG, Regex Scanner, GeoMap, and Projects.

# **The Problem**
Research sessions are cognitively expensive. A user investigating vendors, suppliers, contacts, or leads may visit 50–100 pages over several hours. During that session, they encounter hundreds of data points: email addresses, phone numbers, business addresses, contact names, social profiles. Most of this information is seen, mentally noted, and lost. The user remembers impressions (“that vacuum company in Ohio seemed good”) but not specifics (“what was their sales email?”).
Currently in Argus, extracting this data requires active user engagement for each page: running a Regex Scan, triggering Entity Extraction, opening Link Map, or running an OSINT analysis. This is appropriate for focused investigation but creates too much friction for casual research browsing where the user does not yet know which pages will matter.
## **User Story**
*“**I’m researching industrial vacuum suppliers for work. I spend three hours browsing manufacturer sites, reading specs, comparing prices. I go to bed. The next morning I know what I want to buy, but I can’t remember the company’s contact info. I don’t even remember their name — just that their site was blue and I spent a lot of time on it. I want to open Argus and see: here are the sites you spent the most time on last night, here are their email addresses and phone numbers, here’s a visual map of where your attention went.**”*

# **The Solution: Trawl Net**
Trawl Net adds a passive data collection mode to Argus. When enabled, a lightweight content script is silently injected into every page the user visits. The script extracts structured data without any user interaction and stores it alongside existing Page Tracker entries in IndexedDB.
The feature has three components:
## **1. The Net (Passive Extraction Engine)**
A content script that fires on every page load when trawl mode is active. It extracts contact information and business data using three layered strategies, ordered from most structured to least:
**Strategy A: Schema.org / JSON-LD (Highest Quality)**
Most business websites embed structured data for SEO purposes. This data is machine-readable and pre-organized. The content script queries all <script type="application/ld+json"> tags and parses Organization, LocalBusiness, Person, and ContactPoint schemas. This yields business name, address, phone, email, hours, geo-coordinates, and social profiles with near-perfect accuracy.
**Strategy B: Open Graph & Meta Tags**
Standard meta tags provide site name (og:site_name), description, author, and canonical URL. The content script reads these as supplementary signals, particularly useful for sites that lack JSON-LD but still have basic metadata.
**Strategy C: Regex Extraction (Fallback)**
A slim subset of Argus’s existing Regex Scanner patterns runs as the fallback layer. This captures emails, phone numbers, and street addresses from visible page text. The patterns are the same proven regex already in background-osint.js, executed in the content script context.

**Strategy**
**Data Extracted**
**Accuracy**
**Coverage**
JSON-LD / Schema.org
Name, address, phone, email, hours, geo, social
Very High
~40–60% of business sites
Open Graph / Meta
Site name, description, author, canonical URL
High
~80%+ of all sites
Regex Fallback
Emails, phones, street addresses
Moderate
Near-universal

## **2. The Haul (Data Storage & Engagement Scoring)**
Extracted data is stored in the existing Page Tracker IndexedDB object store. Each tracked page entry gains a trawlData field containing the extracted information and engagement metrics.
**Data Model Extension**
PageTracker Entry (existing fields):
url, title, favicon, visits, firstVisit, lastVisit, actions[]

New trawlData field:
{
emails:       ["sales@acme.com", "info@acme.com"],
phones:       ["+1-800-555-0199"],
addresses:    ["1234 Industrial Pkwy, Toledo OH 43612"],
businessName: "Acme Industrial Vacuum Co",
contacts:     [{ name: "John Smith", role: "Sales Manager",
email: "john@acme.com" }],
socialLinks:  ["linkedin.com/company/acme-vacuum"],
geo:          { lat: 41.6528, lng: -83.5379 },
schema:       { type: "LocalBusiness", raw: {...} },
extractedAt:  1710000000000
}
**Engagement Scoring**
Each page receives an engagement score calculated from behavioral signals already available in Page Tracker:
- **Time on site: **Derived from tab activation/deactivation timestamps. Strongest signal of genuine interest.
- **Visit count: **Number of times the user returned to this page or domain during the session.
- **Page depth: **Number of distinct pages visited on the same domain (indicates exploration depth).
- **Scroll depth: **Percentage of page scrolled, tracked by the content script via scroll position relative to document height.
- **Argus interaction: **Whether the user bookmarked, analyzed, or saved the page to a project (indicates explicit interest).

Engagement Score Formula:
score = (timeOnSite * 0.40)
+ (visitCount * 0.20)
+ (pageDepth  * 0.15)
+ (scrollPct  * 0.10)
+ (argusAction? 0.15 : 0)

Normalized to 0–100 across the session.

## **3. The Morning-After View (Intelligence Dashboard)**
A dedicated Argus page (trawl/trawl.html) that presents collected data from a trawl session with engagement-weighted visualization. This is where the user goes when they wake up and want to find that vacuum company.
**Primary View: Weighted Contact Cloud**
A visual word cloud where each element represents a business, contact, or domain from the trawl session. Size is determined by engagement score. Color coding differentiates data types (businesses in blue, emails in teal, phone numbers in amber). Clicking any element expands to show full extracted data for that entity.
**Secondary View: Session Timeline**
A chronological timeline of pages visited during the trawl session with extracted data inline. Wider bars indicate more time spent. Color-coded engagement bands highlight the top sites. This reuses the timeline rendering patterns from osint/timeline.js.
**Tertiary View: Sortable Data Table**
A traditional table view of all extracted contacts and business data, sortable by engagement score, domain, data type, or extraction time. One-click copy for any email, phone, or address. Bulk export to CSV. Filter by data type (show only emails, show only addresses, etc.).
**Intelligence Features**
- **"You probably want this" highlight: **The top 3 sites by engagement score are prominently featured with a summary card showing all extracted contact info.
- **Domain clustering: **Pages from the same domain are grouped and their engagement scores aggregated, so visiting 8 pages on acmevacuum.com shows up as a single strong signal.
- **Quick actions: **Save to project, copy all contacts, open original page, run full Argus analysis, add to monitors.
- **Session management: **Name sessions, compare across sessions, merge session data into a project.

# **Existing Infrastructure Leverage**
Trawl Net is deliberately designed to build on systems Argus already ships. The following table maps each trawl capability to the existing subsystem that provides it.

**Trawl Capability**
**Existing Subsystem**
**Integration Type**
Page visit tracking
Page Tracker (background.js)
Direct extension of existing data model
Email/phone/URL extraction
Regex Scanner (background-osint.js)
Reuse patterns in content script
Link categorization
Link Map (osint/link-map.js)
Same classification logic
Entity extraction
KG Engine (background-kg.js)
Feed trawl entities into global KG
Geo-coordinate mapping
GeoMap (osint/geomap.js)
Display extracted addresses on map
Timeline visualization
Timeline (osint/timeline.js)
Reuse rendering components
Project integration
Projects system
One-click save session as project
Data export
Export Utils (lib/export-utils.js)
CSV/JSON export of trawl data
Toggle/settings UI
Options Console
Settings panel for trawl preferences
Engagement tracking
Tab event listeners (background.js)
Extend existing onActivated/onUpdated

**Architecture Principle**
No new libraries. No new API dependencies. No new permissions beyond what Argus already requests.
The content script, storage model, and UI views are all new code — but they call APIs and reuse patterns that already exist throughout the codebase.

# **Content Script Architecture**
The trawl content script (trawl-collector.js) is injected via browser.tabs.executeScript when a page completes loading and trawl mode is active. It runs once, collects data, and sends results to the background script. It does not persist, does not modify the DOM, and does not affect page performance.
**Extraction Pipeline**
- Parse all <script type="application/ld+json"> elements for structured business data.
- Read Open Graph meta tags and standard meta elements for supplementary signals.
- Run slim regex patterns against document.body.innerText for emails, phones, and street addresses.
- Record scroll depth via window.scrollY / document.body.scrollHeight at collection time.
- Package all extracted data and send to background.js via browser.runtime.sendMessage.
**Performance Constraints**
- **Execution time: **Target < 50ms per page. JSON-LD parsing and regex on body text are both sub-millisecond operations on typical pages.
- **Memory footprint: **Content script is garbage-collected after execution. No persistent listeners or observers.
- **Network impact: **Zero. All extraction is local to the already-loaded DOM. No external API calls.
- **User visibility: **None. No DOM modifications, no visual indicators, no console output in production.

# **Implementation Phases**
## **Phase 1: The Net (Core Passive Extraction)**
Build the content script and storage layer. This is the foundation that everything else depends on.
**Deliverables**
- trawl-collector.js content script with JSON-LD, meta tag, and regex extraction
- Page Tracker data model extension with trawlData field
- Background.js integration: inject content script on page complete when trawl mode enabled
- Settings toggle: Enable/Disable Trawl Net in Console > Settings
- Popup indicator: subtle net icon when trawl mode is active
- Engagement tracking: tab focus time calculation via onActivated/onUpdated listeners
**Acceptance Criteria**
- User enables trawl mode, browses 10 business sites, and sees extracted emails/phones/addresses in Page Tracker entries
- JSON-LD extraction works on sites with schema.org markup (test with Google, Yelp, any local business site)
- Regex fallback catches emails and phones on sites without structured data
- No measurable page load performance impact (< 50ms content script execution)

**Estimate**
**Value**
New files
1 (trawl-collector.js content script)
Modified files
3 (background.js, lib/storage-db.js, options/options.js)
New code
~150–200 lines
New dependencies
0
New permissions
0

## **Phase 2: The Morning-After View**
Build the intelligence dashboard where users review trawl session results.
**Deliverables**
- trawl/trawl.html + trawl.js + trawl.css — new Argus page accessible from ribbon nav
- Engagement scoring engine: calculate weighted scores from time, visits, depth, scroll, actions
- Weighted word/contact cloud: SVG or canvas-based visualization sized by engagement score
- Domain clustering: aggregate pages from same domain into single ranked entries
- "You probably want this" top-3 highlight cards with full contact info
- Sortable data table with column filters (email, phone, address, business name)
- One-click copy for any contact field, bulk export to CSV
- Session selector: view data from today, yesterday, last 7 days, or custom range
**Acceptance Criteria**
- User browses 50 pages with trawl enabled, opens the Trawl Net view next morning, and can identify their top-engagement sites within 5 seconds
- Contact cloud accurately reflects time-weighted engagement (sites with more dwell time appear larger)
- All extracted emails and phone numbers are copyable with one click
- Export produces valid CSV with all trawl data

**Estimate**
**Value**
New files
3 (trawl.html, trawl.js, trawl.css)
Modified files
2 (shared/ribbon nav, manifest.json)
New code
~300–400 lines
New dependencies
0 (word cloud is custom SVG, ~100 lines)

## **Phase 3: System Integration**
Wire trawl data into Argus’s existing intelligence subsystems for maximum compound value.
**Deliverables**
- Knowledge Graph feed: extracted businesses, people, and locations auto-create KG entities with source attribution
- GeoMap integration: addresses with geocoordinates appear on the OSINT map
- Project import: one-click "Save session as project" creates a project with all trawl items as project entries
- Automation hook: new step type "Trawl Extract" that runs extraction on a specific page within an automation pipeline
- Domain exclusion list: user-configurable domains to never trawl (banking, medical, personal sites)
- Incognito integration: respect existing forced-private site list — never trawl sites on the privacy exclusion list
**Acceptance Criteria**
- Trawl session entities appear in the global Knowledge Graph with correct types and source URLs
- Extracted addresses with geo data are plottable in GeoMap
- Saving a trawl session as a project creates a fully functional project with items, entities, and KG connections
- Excluded domains produce zero trawl data

**Estimate**
**Value**
New files
0
Modified files
5–6 (background-kg.js, geomap.js, options.js, background-automations.js, storage-db.js)
New code
~150–200 lines (integration glue)
New dependencies
0

# **Total Resource Cost**
**Resource**
**Cost**
Total new code
~600–800 lines across all phases
New files
4 files (1 content script + 3 view page files)
Modified files
~8–10 existing files
New library dependencies
Zero
New browser permissions
Zero
Extension size increase
< 30KB (all custom code, no libraries)
IndexedDB schema changes
1 new field on existing PageTracker store
Performance impact
< 50ms per page load when active, zero when inactive

**Cost Context**
For comparison, the existing xterm.js terminal library alone is ~300KB.
Trawl Net delivers a major new capability surface at roughly 1/10th the footprint of a single existing library.

# **Privacy & Safety Considerations**
Trawl Net operates within Argus’s existing privacy architecture. All data stays local. No new external connections are made. However, passive collection requires explicit attention to user trust and data hygiene.
**Safeguards**
- **Opt-in only: **Trawl mode is off by default and requires explicit activation. It is never enabled silently.
- **Visual indicator: **A persistent icon in the Argus popup and optionally the toolbar badge signals when trawl mode is active. The user always knows the net is in the water.
- **Domain exclusions: **Integration with the existing Incognito/Forced-Private site list. Domains on this list are never trawled. Users can add banking, medical, and personal sites.
- **Session boundaries: **Trawl data is tagged with session timestamps. Users can clear individual sessions or all trawl data independently of other Argus data.
- **No content storage: **Trawl Net stores extracted contact fields only — not page content, not screenshots, not HTML. This is metadata extraction, not page archiving.
- **Wipe integration: **The existing "Wipe Everything" function in Settings clears all trawl data along with other Argus data stores.
- **PRIVACY.md update: **Trawl Net’s data collection behavior will be documented in the privacy policy with the same transparency standard as all other Argus features.

# **Future Expansion Opportunities**
Once the core trawl infrastructure exists, several high-value extensions become low-cost additions:
- **AI session summarization: **"Summarize my research session" — send the trawl session’s page titles, business names, and extracted data to the configured AI provider for a natural-language session recap.
- **Comparative analysis: **"Compare my top 3 vendors" — pull trawl data from the top-engagement sites and generate a comparison table.
- **Smart alerts: **"You visited 6 pages about X but didn’t save any" — detect research patterns and prompt the user to save before data is lost.
- **Cross-session intelligence: **"You researched this same topic 3 weeks ago" — detect when a new trawl session covers similar domains to a previous one and offer to merge findings.
- **Contact deduplication: **Merge the same email or phone number appearing across multiple sites into a unified contact record with all source attributions.
- **Data view / chart integration: **Feed trawl engagement scores into the upcoming smart chart and data view system for visual analysis of research patterns.

# **Conclusion**
Trawl Net transforms Argus from a tool you actively operate into a tool that passively works for you. The user browses. The net collects. The intelligence surfaces when they need it. It requires zero new dependencies, builds entirely on existing subsystems, and delivers immediate value at each implementation phase.
The feature aligns with Argus’s core philosophy: local-first, privacy-respecting, user-controlled intelligence. It adds a capability that no other browser extension currently offers — passive, structured, engagement-weighted contact intelligence from natural browsing — and it does so at a resource cost that is negligible relative to Argus’s existing footprint.

*End of Proposal*
