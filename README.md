# Argus — 100 Eyes

**The internet lies to you. Argus helps you check.**

Argus is the hundred-eyed watchman for your browser. Every API key you configure opens another eye. One watches through Grok. One watches through Claude. One watches corporate registries. One watches court records. One watches the skies. The Knowledge Graph connects what all of them see.

Named for Argus Panoptes — the all-seeing giant of Greek mythology whose hundred eyes never all slept at once. Some were always watching.

A Firefox extension. Under 5MB. Every provider. Your data.

No accounts. No telemetry. No servers. Bring your own keys, keep your own data.

---

## Open Your Eyes

Every API key unlocks a new capability. Start with one. Add more as you need them. Each one makes Argus smarter.

| Eye | What It Watches | Free? |
|-----|----------------|-------|
| xAI (Grok) | AI analysis with real-time web access | Free tier |
| OpenAI (ChatGPT) | AI analysis, embeddings, vision | Free tier |
| Anthropic (Claude) | AI analysis with extended thinking | Free tier |
| Google (Gemini) | AI analysis with massive context | Free tier |
| Custom endpoint | Any self-hosted or OpenAI-compatible model | Your infra |
| Google Drive | Cloud backup | Free |
| Dropbox | Cloud backup | Free |
| S3-compatible | Cloud backup (AWS, MinIO, Backblaze B2) | Free tier |
| WebDAV | Cloud backup (Nextcloud, ownCloud) | Free |
| GitHub | Diffable bookmark sync, issue tracking | Free |
| Gist / Pastebin / PrivateBin | One-click sharing and paste | Free |
| OpenStreetMap Nominatim | Geolocation and mapping | Free |
| Wayback Machine | Historical page archives | Free |
| Archive.is | Paywall bypass | Free |
| RDAP / Google DNS | Whois and DNS lookups | Free |
| OpenSanctions | Sanctions, PEP, and watchlist screening | Free |
| SEC EDGAR | Corporate filings, insider transactions | Free |
| GDELT | Global media coverage, sentiment analysis | Free |
| GLEIF | Legal Entity Identifier (LEI) lookup | Free |
| OpenSky Network | Live aircraft positions (ADS-B) | Free tier |
| FlightAware AeroAPI | Flight tracking, history, routes | Free tier |
| hexdb.io | Aircraft registration → ICAO24 hex lookup | Free |
| CourtListener | Court records, case law, dockets | Free |
| OpenCorporates | Global company registry search | Free tier |
| Copernicus / Sentinel Hub | Satellite imagery (Sentinel-2) | Free tier |
| VesselFinder | Live vessel positions, AIS data | Paid |
| FAA Aircraft Registry | N-number to Mode-S code resolution | Free |

That's 25+ eyes from free services alone. Argus doesn't need infrastructure because it plugs into everyone else's.

---

## Why Argus Exists

AI-generated text. Deepfake video. Cloned voices. Fake company websites. Synthetic social media profiles. Fabricated reviews. The average person has no tools to fight this. They scroll and hope their gut instinct holds up.

Every AI provider is also building walled gardens. Your research in Claude Projects is invisible to Grok. What you build in ChatGPT's canvas, Gemini doesn't know exists. Your knowledge fragments across however many providers you use.

Argus fixes both problems.

You see a claim online. Argus analyzes the page across multiple AI models — sentiment, bias, source quality. The regex scanner pulls every email, domain, and link. Whois shows the domain was registered two weeks ago. Tech stack detection reveals a cookie-cutter site with no real infrastructure. The Knowledge Graph already has the company mentioned — and it cross-references everything it knows.

All from clicking one button on one page. No single AI provider gives you that. Argus connects to everything.

---

## What Argus Becomes

Argus isn't one tool — it's the tool that becomes what you need:

- **Page analyzer** — TLDR summaries to legal risk breakdowns, powered by any provider
- **Fact checker** — cross-reference claims against multiple AI models, media coverage, and source quality analysis
- **OSINT toolkit** — metadata extraction, tech stack detection, whois/DNS, regex scanning, link mapping, image grabbing
- **Knowledge graph engine** — automatic entity extraction, relationship inference, cross-project intelligence
- **Smart bookmark agent** — AI-generated tags, categories, summaries, hierarchical folders
- **Page monitor** — track changes on any page with configurable intervals and diff detection
- **RSS reader** — subscribe, filter, route keywords to projects automatically
- **Research workspace** — project-based investigations with AI chat over your collected data
- **Automation engine** — multi-step pipelines with URL triggers, chaining analysis across providers
- **Report builder** — markdown editor with an asset library pulling from your entire research history
- **Finance tracker** — watchlists for stocks, crypto, forex with price alerts and calendar events
- **Remote terminal** — WebSocket shell client for your servers, right inside the extension
- **Encrypted vault** — AES-256-GCM encryption for all stored credentials, locked behind PIN or password
- **Cloud backup** — scheduled or manual backup to Google Drive, Dropbox, S3, WebDAV, or GitHub
- **Paywall bypass** — automatic archive.is redirect for configurable site lists

Watch your patterns, watch others' patterns. Argus is the extension that becomes what you need.

---

## Intelligence Layer

Argus connects to real-world data sources — sanctions lists, corporate filings, court records, aircraft transponders, vessel tracking, satellite imagery, and global media. Each source is a provider. Configure an API key and another eye opens.

### Compliance

Screen people and organizations against global sanctions lists and PEP databases. OpenSanctions covers 30+ datasets including OFAC, UN, EU consolidated lists. Search by name, match entities with confidence scores, screen your entire Knowledge Graph with one click.

CourtListener integration adds litigation search — case law, dockets, and court opinions across US federal and state courts.

Flagged entities get a red SANCTIONED badge in the KG. Connected entities get an amber SANCTIONS-ADJACENT flag. The inference engine automatically maps these relationships.

### Movement — Aviation

Search aircraft by tail number (N707JT), ICAO24 hex code (a2d2cc), or callsign. Argus resolves tail numbers to hex codes via hexdb.io and the FAA Aircraft Registry, then queries OpenSky for live transponder data.

Results show: callsign, ICAO24 hex, country, aircraft category (Heavy/Light/Rotorcraft/UAV), altitude, speed, heading, vertical rate, squawk code, and position — all plotted on a Leaflet map with rotated aircraft icons.

FlightAware AeroAPI adds flight routing (origin → destination), operator, flight status, progress percentage, departure/arrival times, and historical flight data going back to 2011.

The detail panel shows manufacturer, type, owner, and links to FAA Registry ↗, FlightAware ↗, and ADS-B Exchange ↗. Search history persists across sessions. Aircraft can be added to the KG as entities or added to a Movement Watchlist.

### Movement — Maritime

Search vessels by name, 9-digit MMSI, or 7-digit IMO number. VesselFinder API (optional, paid) returns live position, speed, course, destination, ETA, draught, dimensions, and flag state.

Without an API key, Argus provides direct links to MarineTraffic ↗, VesselFinder ↗, and MyShipTracking ↗ for free web-based tracking.

### Events — GDELT

Search any topic across global media. GDELT monitors news sources in 100+ languages. Argus fires three queries in parallel:

- **Article search** — clickable cards with title, source domain, country, language, date
- **Volume timeline** — SVG bar chart showing article counts over time
- **Sentiment timeline** — SVG line chart showing positive/negative tone over time

Results are exportable as CSV. Coverage spikes can be saved to the KG as `global_event` entities.

### Satellite — Copernicus / Sentinel Hub

Browse the planet with 10-meter resolution Sentinel-2 imagery on a Leaflet map.

- **Jump to location** — geocode any address, city, or coordinates via Nominatim
- **Dual date comparison** — pick Date A and Date B, load imagery for both
- **Opacity slider** — Balance mode (A + B = 100%) or Independent mode (A and B each 0-100%)
- **Band selection** — True Color, False Color (vegetation), NDVI, Moisture — independently per image
- **Enhancement filters** — Normal, Invert, B/W, Hi-Contrast, Saturate, Edge Detect, Block — independently per image
- **Dual Overlay mode** — compare two different locations side-by-side on the same viewport
- **Swap A/B** — full swap of images, dates, search inputs, bands, and enhancements
- **Pin collection** — click the map to pin locations with labels and notes, export as CSV or add to KG
- **Resolution control** — 512px (fast), 1024px (default), 2048px (high) — independently per image
- **Settings** — default location, zoom, and resolution configurable in the console Settings tab

Requires OAuth2 client credentials from the Copernicus Data Space Ecosystem dashboard.

### Corporate & Financial Intelligence

The Finance page has three tabs:

- **Markets** — watchlist for stocks, crypto, forex, commodities with live prices (Yahoo Finance), wallet monitoring (Blockstream), price alerts, and market sentiment
- **Corporate** — SEC EDGAR company search with filings table, insider transactions, officers list. Toggle OpenCorporates and GLEIF (LEI) for additional corporate registry data
- **Blockchain** — BTC wallet lookup via Blockstream with balance, transaction history. ETH support via Etherscan (when configured)

### KG Enrichment

Click any entity in the Knowledge Graph and the sidebar shows an Intelligence section with:

- **Sanctions** button — screen against OpenSanctions
- **SEC Filings** button — fetch filings for organizations
- **Enrich All** — run all applicable providers

Results render inline: match scores, dataset sources, filing counts. Sanctioned entities get flagged and the inference engine creates `sanction-proximity` edges to connected entities.

### Intel Strip

The ribbon strip below the AI provider strip shows all connected intelligence providers at a glance, grouped by domain:

```
INTEL ●Sanctions ●SEC ●GLEIF | ●OpenSky ●FlightAware | ●GDELT | ●Sentinel
```

Green dot = connected. One place to see everything. Click any pill to jump to Settings.

---

## Provider Interoperability

This is what no other tool does.

Claude has Projects. ChatGPT has memory. Grok has collections. Gemini has Gems. None of them talk to each other. Argus sits underneath all of them, keeping your intelligence unified and provider-agnostic.

- **Unified storage** — every analysis, bookmark, entity, and project item lives in one local database regardless of which model produced it
- **Cross-provider workflows** — use Grok's real-time web access for one step, Claude's reasoning for the next, Gemini's massive context window for synthesis — same automation pipeline
- **Provider-agnostic context** — your accumulated intelligence follows you. Switch providers mid-conversation, mid-project, mid-automation without losing anything
- **No vendor lock-in** — every provider is a plugin, not a platform. Add, remove, or swap providers without touching your data

---

## Table of Contents

- [AI Providers](#ai-providers)
- [Quick Start](#quick-start)
- [Core Analysis](#core-analysis)
- [OSINT Tools](#osint-tools)
- [Knowledge Graph](#knowledge-graph)
- [Source-Aware Pipelines](#source-aware-pipelines)
- [Projects](#projects)
- [Smart Bookmarks](#smart-bookmarks)
- [Chat](#chat)
- [Workbench](#workbench)
- [Draft Pad](#draft-pad)
- [Automations](#automations)
- [Page Monitoring](#page-monitoring)
- [RSS Feed Reader](#rss-feed-reader)
- [Finance Monitor](#finance-monitor)
- [Terminal](#terminal)
- [Archive & Paywall Bypass](#archive--paywall-bypass)
- [Vault Encryption](#vault-encryption)
- [Cloud Backup & Storage](#cloud-backup--storage)
- [Sharing & Export](#sharing--export)
- [Extended AI Features](#extended-ai-features)
- [Resources Hub](#resources-hub)
- [Navigation](#navigation)
- [Privacy](#privacy)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Fork It, Make It Yours](#fork-it-make-it-yours)
- [Roadmap](#roadmap)

---

## AI Providers

| Provider | Models | Streaming | Extended Thinking |
|----------|--------|-----------|-------------------|
| **xAI (Grok)** | Grok 4, Grok 3, Grok Mini | ✓ | Swarm multi-agent mode |
| **OpenAI** | GPT-4.1, o3, o4-mini | ✓ | Reasoning effort control |
| **Anthropic (Claude)** | Claude 4, Sonnet, Haiku | ✓ | Native extended thinking |
| **Google (Gemini)** | Gemini 2.5 Pro/Flash | ✓ | — |
| **Custom** | Any OpenAI-compatible endpoint | ✓ | — |

Custom endpoint support covers Ollama, LM Studio, Hugging Face, vLLM, and any self-hosted model. Bring your own keys — Argus never sees, stores, or transmits them anywhere except directly to the provider you choose.

---

## Quick Start

1. **Get an API key** — click any provider link in Settings, create an account, generate a key (~2 minutes)
2. **Install Argus** — from [Firefox Add-ons](https://addons.mozilla.org) or load from source
3. **Configure** — click the Argus icon → gear icon → paste your API key → Save
4. **Analyze** — navigate to any page, click Argus, choose a preset, hit Analyze

That's your first eye open. Most providers offer generous free tiers. Many users spend less than $1/month.

---

## Core Analysis

### Built-in Presets

| Preset | What it does |
|--------|-------------|
| Summary | Flowing prose summary of page content |
| Sentiment Analysis | Tone, emotional undertones, bias detection |
| Fact-Check | Claim identification, verifiability assessment |
| Key Points | Structured extraction of main ideas |
| ELI5 | Plain-language explanation for complex content |
| Critical Analysis | Argument strength, logical fallacies, quality assessment |
| Action Items | Actionable tasks and next steps as a checklist |
| Research Report | Multi-source synthesis with citations |
| Data Extraction | Statistics, dates, entities, quotes, URLs |
| Legal / Regulatory Risk | Jurisdiction, compliance concerns, liability exposure |
| Compare & Contrast | Structured comparison matrix with trade-offs |
| Narrative Analysis | Story structure, rhetoric, framing, authorial choices |
| TLDR Briefing | Ultra-concise briefing in under 150 words |
| Media Bias Breakdown | Coverage spectrum, framing analysis, blind spots |
| Competitor Intel | Strategic signals, strengths, vulnerabilities |
| Financial Analysis | Financial figures, market signals, economic indicators |

### Custom Presets

Create your own in Console → **Prompts** tab. Each preset can be bound to a specific provider, so "Legal Risk" always uses Claude while "TLDR" always uses Grok — or leave it on default. Custom presets appear in the popup dropdown and right-click context menu.

### Prompt Variables

| Variable | Replaced with |
|----------|--------------|
| `{title}` | Page title |
| `{url}` | Page URL |
| `{domain}` | Domain name |
| `{date}` | Current date |
| `{wordcount}` | Word count |

---

## OSINT Tools

| Tool | What it does |
|------|-------------|
| Metadata Extraction | Headers, meta tags, Open Graph, JSON-LD structured data |
| Link Mapping | Internal/external link analysis and interactive visualization |
| Whois / DNS | RDAP lookups (rdap.org) + DNS records (dns.google) |
| Tech Stack Detection | Frameworks, CDNs, analytics, CMS identification |
| Regex Scanner | Pattern scanning with AI-powered threat/entity/summary analysis |
| Image Grabber | Extract, filter, preview, download, and cloud-save images (single page or all open tabs) |
| Connection Graph | Interactive force-directed visualization (project-level and global) |
| Entity Heatmap | Mention frequency visualization across project items |
| Geolocation Map | Plot extracted locations on an interactive map (OpenStreetMap) |
| Timeline | Chronological event visualization from extracted dates |
| Project Dashboard | At-a-glance widgets with auto-digests and AI-generated reports |
| Keyword Watchlist | Track keywords across monitors and feeds with regex and notifications |
| Quick Search | Multi-engine search bar: General, Research, Medical, Custom |

---

## Knowledge Graph

Argus automatically builds a persistent knowledge graph from every analysis, bookmark, and monitored page. This is the brain that connects what all the eyes see.

- Automatic entity extraction: people, organizations, locations, dates, events
- Fuzzy matching (Levenshtein distance + token overlap) prevents duplicates
- Co-occurrence edges connect entities that appear together
- Inference rules discover implicit relationships
- ~2,500+ built-in dictionary entries for entity classification
- Pending merge queue for ambiguous matches requiring human review
- Project-level and global graph views with interactive force-directed visualization
- Skeleton view for structural investigation overview
- AI-powered chat within the graph view

### Entity Dictionaries

Customize in Console → **OSINT** → **Entity Dictionaries**: Noise Entities, Known Locations, Known Organizations, Not-Person Words, Valid First Names.

---

## Source-Aware Pipelines

Argus detects page types and runs specialized extraction automatically.

| Source Type | What It Extracts |
|-------------|------------------|
| Wikipedia | Structured profile, infobox data, related entities, categories |
| News Article | Claims with evidence levels, bias indicators, source quality score |
| Classifieds | Listing data, seller info, scam risk analysis |
| Research | Claims, knowledge coverage, methodology notes |

---

## Projects

Collect URLs, analyses, notes, and entities into organized investigations. Batch entity extraction, connection graphs, timelines, dashboards with AI-generated reports. Export/import as `.argusproj` bundles.

---

## Smart Bookmarks

AI-generated tags, categories, summaries, and reading time. Hierarchical folders with drag-and-drop. Full-text search, tag cloud, category filtering. Synthesize multiple bookmarks into research reports with footnotes. Cloud sync to GitHub as diffable JSON.

---

## Chat

Standalone AI chat with persistent sessions. Switch providers mid-conversation. Send any response to Draft Pad.

---

## Workbench

Project-aware deep-analysis workspace. Drag research items onto a work surface, chat with AI about connections and contradictions. Floating, draggable, resizable panels. Provider override per session.

---

## Draft Pad

Markdown editor with asset library, templates (OSINT Brief, Legal Summary, Tech Memo, Incident Report), drafts management, live preview, export to .md/.html/.txt, and sharing to Gist/Pastebin/PrivateBin/email/social.

---

## Automations

Multi-step workflows with URL-pattern triggers. Step types: Analyze, Custom Prompt, Extract Entities, Run Pipeline, Add to Project, Save to Cloud, Paste to Service. Chain providers in a single pipeline.

---

## Page Monitoring

Track changes on any page. 15-minute to weekly intervals. Visual diffs, AI-powered change summaries, keyword alerts, snapshot history, automation integration.

---

## RSS Feed Reader

Subscribe to feeds, keyword routing to projects with include/exclude logic, browser notifications, clean reader view, feed auto-detection.

---

## Finance Monitor

Watchlists for stocks, crypto, commodities, forex, indices. Price alerts, calendar events, import/export, dedicated full-page view.

---

## Terminal

WebSocket shell client (xterm.js). Connect to ttyd, websockify, or webssh2 relays. Saved sessions, full terminal emulation.

---

## Archive & Paywall Bypass

Automatic archive.is redirect for configurable site lists. 24 default paywalled sites. Wayback Machine lookup.

---

## Vault Encryption

AES-256-GCM encryption for all credentials. PIN or password lock. Auto-lock on timeout. Vault-encrypted cloud backups.

---

## Cloud Backup & Storage

Google Drive, Dropbox, S3-compatible, WebDAV, GitHub. Projects, bookmarks, monitors, feeds, history, KG, watchlist, automations, settings. Compressed zip with manifest. Scheduled or manual.

---

## Sharing & Export

Email compose, GitHub Gist, Pastebin, PrivateBin (client-side encryption), X, LinkedIn. Export as Markdown, HTML, CSV, JSON, plain text. Project bundle import/export.

---

## Extended AI Features

Multi-provider comparison, streaming, extended thinking (Claude/OpenAI/Grok), vision support, selection analysis, batch analysis, PDF extraction.

---

## Resources Hub

Curated link library: OSINT tools, network diagnostics, VPN resources, online IDEs, security labs, crime data. Custom categories. One-click open.

---

## Navigation

**Popup** — 4 customizable quick-jump icons. **Ribbon** — persistent top bar. **Tool Tab Bar** — up to 8 visible pages, drag to reorder.

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G` | Open Argus |
| `Ctrl+Shift+S` | Quick Summary |
| `Ctrl+Shift+A` | Analyze selection |

---

## Privacy

All data local. No telemetry. No accounts. No servers. API keys only reach providers you choose. Optional Vault encryption. Fully auditable vanilla JS. Wipe Everything before uninstalling.

See [PRIVACY.md](PRIVACY.md) for the full policy.

---

## Installation

```bash
git clone https://github.com/n3r4-life/argus360.git
cd argus360
```

Firefox → `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`

```bash
npx web-ext build     # Package
npx web-ext run       # Dev with auto-reload
```

---

## Project Structure

```
Argus/
├── manifest.json                # Manifest V2
├── background.js                # Core router and analysis engine
├── background-osint.js          # OSINT handlers
├── background-presets.js        # Presets and model definitions
├── background-providers.js      # AI provider APIs
├── background-permissions.js    # Optional permissions
├── background-kg.js             # Knowledge Graph engine
├── background-pipelines.js      # Source-aware pipelines
├── background-agents.js         # Agentic automation
├── background-automations.js    # Multi-step automation engine
├── popup/                       # Browser action popup
├── results/                     # Analysis results
├── options/                     # Settings console
├── chat/                        # AI chat
├── workbench/                   # Research workspace
├── reporting/                   # Draft Pad
├── bookmarks/                   # Smart bookmarks
├── history/                     # Analysis history
├── monitors/                    # Page monitors
├── feeds/                       # RSS reader
├── finance/                     # Finance monitor
├── ssh/                         # Terminal
├── shared/                      # Ribbon nav, shared UI, lock screen
├── osint/                       # OSINT tools (graph, dashboard, timeline, geomap, etc.)
├── lib/                         # Shared libraries (ArgusDB, cloud, vault, vendor)
├── data/                        # Resources, KG dictionaries
└── icons/                       # Extension icons
```

---

## Fork It, Make It Yours

Fully open source. Vanilla JavaScript, zero build dependencies. No frameworks, no bundlers, no transpilers.

> **Why open source?** You're handing this extension your API keys and browsing content. You should see exactly what it does with them.

---

## Roadmap

**Semantic Index** — Vector database integration. Natural-language queries across your entire research history.

**Location Intelligence** — 3D globe visualization. Street View. Wireless scanning. Device discovery. Every pin is an entity you can investigate.

**Intelligence Data Providers** — Flight tracking. Ship tracking. Corporate registries. Beneficial ownership. SEC filings. Court records. Global events. Blockchain analysis. Satellite imagery. Sanctions screening. Each one is another eye.

**Agentic Investigations** — Give Argus a target and tools. The AI decides what to search next. Human reviews the dossier.

**MV3 & Chromium** — Chrome, Edge, Brave, Opera, Arc. One rewrite, 90%+ of the browser market.

---

## Support Argus

[GitHub Sponsors](https://github.com/sponsors/n3r4-life) · [Buy Me a Coffee](https://buymeacoffee.com/n3r4) · [GitHub Issues](https://github.com/n3r4-life/argus360/issues)

---

*Argus Panoptes. The all-seeing watchman. Some eyes are always open.*
