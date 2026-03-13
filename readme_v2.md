# Argus -- Private Intelligence OS in Your Browser (README v2)

Argus is a local-first Firefox extension for AI-assisted web analysis, OSINT, monitoring, and research workflows. It combines a multi-provider analysis engine, a persistent knowledge graph, smart bookmarks, and automation pipelines, all running in your browser with your own API keys.

This README is a deeper technical overview of how the system works and what has changed in the latest build (automations, stricter JSON prompting, expanded bookmarks, and the image grabber).

---

## What's New in This Build

- **Automations**: A named automation engine with multi-step workflows, URL triggers, project runs, monitor hooks, and logs.
- **Strict JSON prompting**: Every analysis preset now appends a structured JSON block to the response (except the pure-JSON entities preset), and the parser validates and normalizes the data for downstream use.
- **Smart Bookmarks (expanded)**: AI tagging, folders, export, bulk analysis, tech stack enrichment, and cloud snapshot sync.
- **Image Grabber (new OSINT module)**: Extracts, deduplicates, and analyzes images from a page or multiple tabs with filters, color analysis, and AI vision search.

---

## Core Architecture (Deep Overview)

### 1) Extension Runtime and Background Services

Argus is built around a set of background scripts that coordinate analysis, storage, and OSINT tooling:

- `background.js` -- primary event bus, analysis orchestration, streaming, context menu actions, history and knowledge graph integration.
- `background-providers.js` -- provider-specific API calls (OpenAI, Claude, Gemini, Grok, and OpenAI-compatible endpoints), including streaming and vision.
- `background-presets.js` -- analysis preset definitions and the structured JSON schema instructions injected into prompts.
- `background-kg.js` -- knowledge graph extraction, entity matching, and graph storage updates.
- `background-pipelines.js` -- source-aware pipelines (Wikipedia, News, Research, Classifieds) that produce structured outputs.
- `background-osint.js` -- OSINT utilities (metadata extraction, link mapping, tech stack, image grabber, etc.).
- `background-automations.js` -- named automation engine (workflow runner + logging).
- `background-agents.js` -- agentic reporting and digest features.

These scripts run in the background context and communicate with the UI pages through message passing.

### 2) UI Surfaces

Argus exposes multiple pages and panels, each focused on a specific workflow:

- `popup/` -- the quick action panel for instant analysis, bookmarking, monitoring, and shortcuts.
- `results/` -- streaming analysis view, follow-ups, and structured data display.
- `options/` -- the full console (settings, projects, automations, providers, backups, OSINT tools).
- `bookmarks/` -- dedicated smart bookmark management UI.
- `history/` -- analysis history viewer.
- `monitors/` -- page change detection history.
- `feeds/` -- RSS reader and entry analyzer.
- `osint/` -- specialized OSINT tools (graphs, timelines, link maps, image grabber, etc.).

### 3) Storage Model

Argus uses a layered local storage approach:

- **IndexedDB (ArgusDB)** for large datasets: history, bookmarks, projects, monitors, feeds, knowledge graph, and snapshots metadata.
- **OPFS** for binary snapshot storage (page HTML + screenshots).
- **browser.storage.local** for settings, API keys, and smaller config items.

Key stores (see `lib/storage-db.js`):

- `history`, `bookmarks`, `bookmarkFolders`, `projects`, `monitors`, `snapshots`, `changes`, `feeds`, `feedEntries`, `watchlist`, `kgNodes`, `kgEdges`

### 4) Analysis Flow (End-to-End)

1. **Page extraction** (content script or background fetch)
2. **Prompt construction** with presets, user settings, and optional project context
3. **Provider call** via `background-providers.js`
4. **Structured JSON parsing** (see "Strict JSON Prompting" below)
5. **History write** and **knowledge graph update**
6. **UI render** in `results/` with structured data display

---

## Strict JSON Prompting (Structured Data Enforcement)

Argus now enforces structured JSON output for every analysis (except the `entities` preset which is already pure JSON).

### How it works

- Each preset appends a strict JSON schema requirement to the system prompt.
- The model must append a structured block at the end of its response:

```
<!--ARGUS_DATA:{ ...json... }:ARGUS_DATA-->
```

- `lib/argus-structured.js` parses, validates, and normalizes the block.
- Parsed data is stored alongside analysis history and used by:
  - Knowledge graph extraction
  - Results UI summaries
  - Project and pipeline aggregation

### Base Schema

Every response is required to include:

- `entities`: list of real-world entities only
- `confidence`: 0.0 to 1.0
- `topics`: 2 to 5 main themes

Some presets extend this schema with additional fields (e.g., fact-check claims, credibility scores, timelines, etc.).

This stricter structure enables consistent downstream processing, filtering, and aggregation across all analyses.

---

## Automations (New)

Argus includes a full automation engine for multi-step workflows. Automations can be triggered manually, by URL patterns, from monitors, or run across project items.

### Trigger Types

- Manual run from the Automate tab or context menu
- URL pattern matching (auto-run on page visits)
- Project toolbar "Run on All" / "Run on Item"
- Monitor hook (run automation on detected page changes)

### Step Types

Automations execute ordered steps. Supported step types (see `background-automations.js`):

- `analyze` -- run a standard preset (summary, fact-check, etc.)
- `prompt` -- run a custom prompt against page text or the previous step output
- `extractEntities` -- entity extraction using the structured entity preset
- `addToProject` -- store results in a project with tags
- `addToMonitors` -- start monitoring the current page
- `runPipeline` -- run a source-aware pipeline (news, wiki, research, classifieds)
- `paste` -- export to paste services (Gist, Pastebin, PrivateBin)
- `saveToCloud` -- upload results to connected cloud providers (Drive, Dropbox, WebDAV, S3)

### Runtime Controls

- Cooldowns prevent rapid re-triggering on the same URL
- Automation logs track each run (status, steps, errors)
- Optional notifications on completion

Automations make Argus act like a private intelligence "workflow engine" rather than a single-use analyzer.

---

## Smart Bookmarks (Expanded)

Argus bookmarks are not just URLs; they are structured intelligence records.

Key bookmark capabilities:

- **AI tagging and summaries** on save
- **Custom tag prompt** (configure the tagging instructions in Options)
- **Folders and nested organization**
- **Full-text search + tag filtering**
- **Bulk analysis** (select multiple bookmarks and synthesize a report)
- **Tech stack enrichment** (auto-detected after saving)
- **Export** to JSON
- **Cloud sync** of bookmark metadata and snapshots

Bookmarks integrate with projects, the knowledge graph, and automation workflows.

---

## Image Grabber (New OSINT Tool)

The image grabber extracts, deduplicates, and analyzes all images from a page (or multiple open tabs).

### Extraction sources

- `<img>` elements
- `<picture><source>` responsive images
- CSS `background-image`
- Video posters
- Open Graph / Twitter meta images
- Favicons and icons
- Inline SVG images

### Processing logic

- Normalizes URLs to deduplicate CDN variants
- Filters tiny tracking pixels and common ad beacons
- Keeps the highest-resolution version of duplicates
- Tracks type, source, and stats

### UI capabilities (`osint/images.html`)

- Filter by type, size, source, or URL text
- Color analysis and color-based filtering
- Bulk select and compare images side-by-side
- Export image lists
- **AI Vision Search**: run a text query across images and return matches
- Multi-tab support with per-tab breakdown

This makes Argus a lightweight reverse-image and visual OSINT collector directly inside the browser.

---

## Project Structure (Key Directories)

```
Argus/
|-- background.js              # Core logic: API calls, streaming, message handling
|-- background-automations.js  # Automation engine
|-- background-osint.js        # OSINT backend handlers (image grabber, metadata, etc.)
|-- background-presets.js      # Presets + structured JSON schema injection
|-- background-providers.js    # Provider API integrations
|-- background-kg.js           # Knowledge graph engine
|-- background-pipelines.js    # Source-aware pipelines
|-- background-agents.js       # Agentic automation and digests
|-- popup/                     # Browser action popup
|-- results/                   # Analysis results display
|-- options/                   # Full settings / console page
|-- bookmarks/                 # Smart bookmarks UI
|-- history/                   # Analysis history viewer
|-- monitors/                  # Page monitor change history
|-- feeds/                     # RSS feed reader
|-- osint/                     # OSINT tool pages
|-- shared/                    # Shared UI components (nav ribbon)
|-- lib/                       # Storage, providers, structured parsing, PDF, markdown
`-- icons/                     # Extension icons
```

---

## Installation (From Source)

```bash
git clone https://github.com/n3r4-life/argus360.git
cd argus360
```

1. Open Firefox -> `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** -> select `manifest.json`

### Building

```bash
npx web-ext build
npx web-ext run
```

---

## Privacy and Data Ownership

- API keys stay local in extension storage
- No telemetry or analytics
- All analysis data, bookmarks, and history stay in your browser
- Cloud backups only use providers you connect and credentials you supply

---

## License

MIT. Argus is built to be forked, modified, and remixed.
