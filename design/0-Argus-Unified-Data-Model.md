# ARGUS — UNIFIED DATA MODEL
## Everything Is A Source
**Core architecture document — the spine of the entire extension**

- **Date:** 2026-03-20
- **Author:** n3r4-life
- **Repository:** github.com/n3r4-life/argus360
- **Status:** Architecture Reference — not a feature proposal, not a build spec. This is the conceptual model everything else is organized around.

---

## 1. The Four Pillars

Every piece of data in Argus lives in exactly one of these layers, or is in transit between them.

```
SOURCES
  └── have ASSETS
        └── become KG ENTITIES
              └── organized by PROJECTS
```

**Sources** — where did this come from. The provenance layer. Every piece of information has an origin. Sources are that origin.

**Assets** — what was captured. The collection layer. A snapshot, an analysis, a coordinate, an extracted entity. Assets hang off sources.

**KG Entities** — what it means. The truth layer. Verified nodes in the research graph. Assets get promoted to entities when the user decides they're real and meaningful.

**Projects** — what it belongs to. The context layer. A lens over sources, assets, and entities. A project doesn't own data — it organizes it.

---

## 2. Everything Is A Source

A source is any origin point of information. Sources have types. The type determines the capture workflow and the default assets that get created.

### Source Types

| Type | Description | Capture trigger | Default assets created |
|---|---|---|---|
| `bookmark` | User-intentional page capture | Bookmark button click | Snapshot image + AI analysis |
| `trawl` | Passive capture during research session | Page visit during active trawl | URL + title + extracted entities |
| `feed` | RSS/Atom subscription item | Feed poll | Article text + AI summary |
| `monitor` | Watched URL checked for changes | Scheduled check | Diff + change summary |
| `manual` | User typed or pasted a URL/reference | Manual entry | URL + optional note |
| `upload` | User uploaded a file | File drop/select | File asset + optional AI analysis |
| `intel` | Result from an intel provider query | Provider search | Provider response data |
| `kg_import` | Imported from external KG or dataset | Import action | Entities + edges |

### What All Sources Share

Every source regardless of type has:
- `id` — unique identifier
- `url` — origin URL or reference (nullable for uploads)
- `type` — one of the types above
- `capturedAt` — timestamp
- `projectId` — optional project assignment (nullable = stateless)
- `assets[]` — array of asset IDs hanging off this source
- `metadata` — type-specific bag: title, domain, IP, author, language, etc.

---

## 3. Assets

An asset is something captured from or created about a source. Assets are the working material — they get analyzed, compared, annotated, promoted.

### Asset Types

| Type | Description | Created by |
|---|---|---|
| `snapshot` | Screenshot/page capture image | Bookmark workflow, manual capture |
| `analysis` | AI-generated text analysis | Any AI step on a source or asset |
| `image` | Any image — grabbed, uploaded, extracted | Image Grabber, uploads |
| `location` | Coordinate, pin, address | Satellite page, entity extraction |
| `document` | PDF, file, text document | Upload, filing retrieval |
| `entity_extract` | Raw extracted entities before KG promotion | AI analysis, regex scanner |
| `filing` | Regulatory filing (SEC, DOL, etc.) | Intel provider results |
| `media` | Audio, video | Future — audio notes, video capture |

### Asset → Source relationship

Assets belong to a source. A source can have many assets. An asset belongs to exactly one source (its origin). Assets can be referenced by multiple projects but owned by one source.

### Asset → KG promotion

Any asset can be promoted to a KG entity. Promotion is a user action — it means "I have decided this thing is real, meaningful, and worth tracking in my research graph."

Promotion creates a KG entity and links it back to the originating asset and source for full provenance.

---

## 4. The Bookmark Is Just A Source

This is the key insight that collapses the old Bookmarks console tab.

A bookmark is a source with:
- `type: "bookmark"`
- A `snapshot` asset (screenshot of the page at capture time)
- An `analysis` asset (AI-generated TLDR/summary)
- Full metadata extracted from the page at capture time

The "Bookmarks" folder system is just source tagging. The TLDR is just the analysis asset. The bookmark button is just the trigger for the bookmark capture workflow.

There is no separate Bookmarks data model. There is no separate Bookmarks page. There is no separate Bookmarks storage. It is a source type with a specific capture workflow and two default assets.

**The old Bookmarks console tab becomes:** a filtered Sources view where `type = bookmark`.

---

## 5. The Capture Workflows

Each source type has a capture workflow — the sequence of steps that fires when a source of that type is created.

### Bookmark workflow
1. User clicks bookmark button on any page
2. Extension takes a snapshot of the current page (not the URL — the rendered page state at that moment)
3. AI analysis fires on the snapshot — generates TLDR, key facts, extracted entities
4. Source created: `type: bookmark`, `url: currentUrl`, `capturedAt: now`
5. Assets created and linked: `snapshot` image + `analysis` text
6. Lands in Asset Library — stateless until assigned
7. Extracted entities available for KG promotion

### Trawl workflow
1. User starts a trawl session
2. Every page visited during the session generates a source: `type: trawl`
3. Lightweight capture — URL, title, extracted entities, engagement weight
4. No snapshot by default (passive — doesn't interrupt browsing)
5. Morning-after dashboard surfaces high-value trawl sources

### Monitor workflow
1. Scheduled check fires against watched URL
2. Diff computed against last known state
3. If change detected: source created `type: monitor`, diff asset created, alert fired
4. Change history maintained as asset chain on the source

---

## 6. The Asset Library

The Asset Library is not a storage system. It is a view.

It shows assets that are:
- Stateless (not yet assigned to a project or promoted to KG)
- Recently created
- Filtered by type, source, date, project, or search

The AL is the inbox. Things land there. Users process them — assign, promote, discard, or leave stateless.

The AL does not own data. Sources own data. The AL is a window into unprocessed assets.

### AL relationship to Image Grabber

The Image Grabber page is the canvas. Snapshot assets from the AL can be opened in Image Grabber for:
- Annotation and markup
- Overlay with satellite imagery
- Comparison between two snapshots
- Image editing (crop, enhance, export)
- Meme/graphic generation

The AL surfaces the asset. Image Grabber is the tool that works on it.

---

## 7. The KG Is The Master Viewer

The Knowledge Graph is where everything converges. It is the truth layer — nodes are verified entities, edges are verified relationships, and every node and edge traces back to the source and asset that created it.

**The KG doesn't store data. It stores decisions. Everything else is the evidence trail.**

There are three layers of decision in the KG:

```
User decides    → this entity exists         (promotion)
KG decides      → these entities are related (inference)
User decides    → what to look at right now  (view/toggle)
```

### Layer 1 — User promotes an entity

The user looks at an asset and decides: this person, this company, this location — that's real, that's meaningful, give it a node. Promotion is always a deliberate user action. Nothing enters the KG automatically.

### Layer 2 — KG infers connections

Once entities exist, the inference engine looks across all evidence — shared addresses, shared officers, shared phone numbers, co-occurrence in sources, proximity in time — and draws edges between nodes. The user doesn't manually declare connections. The KG finds them and offers them.

The inference engine attaches everything it can find. All inferred edges exist in the graph whether or not they're visible.

### Layer 3 — User controls the view

The default view is filtered. The clutter is hidden. The user toggles which edge types, which entity types, which projects, which date ranges are visible at any moment. The full graph is always there — the view is just a lens over it.

This is why the KG is the master viewer. It holds every decision, every inferred connection, every piece of provenance — and surfaces exactly what the user asks to see, nothing more.

### What gets promoted to KG

- People (person entities extracted from any source)
- Organizations (companies, agencies, groups)
- Locations (coordinates, addresses, places)
- Events (incidents, filings, violations, transactions)
- Documents (filings, reports, articles)
- Assets (when an asset itself is the entity — a specific image, a specific recording)

### Provenance chain

Every KG entity carries:
- `sourceId` — the source it came from
- `assetId` — the specific asset it was promoted from
- `promotedAt` — when the user decided it was real
- `projectId[]` — which projects reference it

Every KG edge carries:
- `type` — what kind of relationship (shared_address, officer_of, co-occurrence, etc.)
- `inferredBy` — which inference rule or provider result produced it
- `strength` — confidence weight (single source = weak, multiple corroborating sources = strong)
- `sourceIds[]` — all sources that contributed evidence for this edge
- `visible` — whether the user has toggled this edge type on or off

No assertions without provenance. No edges without evidence.

---

## 8. Projects

A project is not a container. It is a lens.

A project doesn't own sources, assets, or entities. It references them. The same source can be referenced by multiple projects. The same KG entity can appear in multiple projects.

A project is:
- A name and description
- A set of source references
- A set of KG entity references
- A set of asset references
- A color/label for visual organization
- A default context for new captures (if a project is active, new bookmarks/trawl sources are assigned to it automatically)

The KG viewed through a project filter shows only the nodes and edges relevant to that project. The full KG shows everything.

---

## 9. How The Console Tabs Map To This Model

With this architecture, the old console tabs resolve cleanly:

| Old console tab | What it actually is | Where it lives now |
|---|---|---|
| Bookmarks | Source type `bookmark` + capture workflow | Sources page, filtered view |
| Projects | Project management | Projects page (graduate from console) |
| Sources | Source management | Sources page (graduate from console) |
| Monitors | Source type `monitor` + schedule config | Sources page, monitor sub-tab |
| Feeds | Source type `feed` + subscription config | Reader page |
| Automations | Workflow engine that creates sources/assets | Automations page (graduate from console) |
| Watchlist | Finance-specific project view | Finance page (already migrated) |
| Tracker | Trawl session config | Trawl page |
| Prompts | AI prompt library and builder | Prompts page (graduate from console) |
| OSINT/KG | KG settings and management | KG page |
| Providers | API key management | Console (stays) |
| Settings | Extension settings | Console (stays) |
| Resources | Reference links | Console (stays) |

---

## 10. The Graduation Plan

Based on this model, the console graduation order is:

**Phase 1 — Cleanest wins:**
- Sources page — central to the whole model, should be first-class
- Projects page — already almost there
- Automations page — complex enough, feeds everything

**Phase 2 — Tool pages:**
- Prompts page — standalone creative/research tool

**Phase 3 — Consolidation:**
- Monitors, Bookmarks, Tracker collapse into Sources page as type-filtered views
- Feeds migrate to Reader
- Watchlist confirmed dead in console (lives in Finance)
- KG settings move to KG page

**Console after graduation:**
- Providers tab
- Settings tab
- Resources tab
- Nothing else

Clean. Lean. What it always should have been.

---

## 11. The Unified Search Model

With everything as a source, search becomes unified:

One search bar, one query, searches across:
- Source URLs and titles
- Asset content (AI analysis text, extracted entities)
- KG entity names and properties
- Filtered by: type, project, date range, provider

This is the `argusMatch` utility extended to the full data model — try regex, fall back to literal, search everything.

---

## 12. Summary

```
Every piece of information is a SOURCE
Sources have ASSETS (snapshots, analyses, images, documents, filings)
Assets get promoted to KG ENTITIES — user decides what matters
KG infers EDGES — the graph decides what's connected
User controls the VIEW — toggles determine what's visible
Everything is organized by PROJECTS (lenses, not containers)
The ASSET LIBRARY is the inbox (stateless assets waiting to be processed)
The KG is the master viewer (everything converges here)
Image Grabber is the canvas (assets get worked on here)
The Console is config (providers, settings, resources — nothing else)

The KG doesn't store data. It stores decisions.
Everything else is the evidence trail.
```
