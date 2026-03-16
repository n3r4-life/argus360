# Argus

**The provider-agnostic intelligence layer for your browser.**

Argus is a Firefox extension that unifies AI-powered analysis, OSINT tools, and research management across every major AI provider — from a single interface, using your own API keys, with all data stored locally on your device.

Claude has Projects. ChatGPT has memory. Grok has collections. None of them talk to each other. Argus sits underneath all of them. A Claude analysis and a Grok analysis of the same target end up as sibling items in the same project, their entities merged into the same knowledge graph, queryable by whichever model you choose next. Your intelligence stays unified regardless of which provider generated it.

No accounts. No telemetry. No servers. Bring your own keys, keep your own data.

---

## What Argus Becomes

Argus isn't one tool — it's the tool that becomes what you need:

- **Page analyzer** — TLDR summaries to legal risk breakdowns, powered by any provider
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

## Why Provider Interoperability Matters

Every AI provider is building walled gardens. Your research in Claude Projects is invisible to Grok. What you build in ChatGPT's canvas, Gemini doesn't know exists. Your knowledge fragments across however many providers you use.

Argus fixes this:

- **Unified storage** — every analysis, bookmark, entity, and project item lives in one local database regardless of which model produced it
- **Cross-provider workflows** — use Grok's real-time web access for one step, Claude's reasoning for the next, Gemini's massive context window for synthesis — same automation pipeline
- **Provider-agnostic context** — your accumulated intelligence follows you. Switch providers mid-conversation, mid-project, mid-automation without losing anything
- **No vendor lock-in** — every provider is a plugin, not a platform. Add, remove, or swap providers without touching your data
- **GitHub integration** — none of the major AI providers connect your work to version-controlled repositories. Argus does — diffable bookmark metadata, backup commits, and more

This isn't "another browser extension with AI features." It's the interoperability layer that unifies your AI workflow across every model you have access to.

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

Most providers offer generous free tiers. Many users spend less than $1/month.

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

Use these in custom presets — replaced with actual values at analysis time:

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
| Image Grabber | Extract, filter, preview, download, and cloud-save all images from a page (single page or all open tabs) |
| Connection Graph | Interactive force-directed visualization (project-level and global) |
| Entity Heatmap | Mention frequency visualization across project items |
| Geolocation Map | Plot extracted locations on an interactive map (OpenStreetMap) |
| Timeline | Chronological event visualization from extracted dates |
| Project Dashboard | At-a-glance widgets with auto-digests and AI-generated reports |
| Keyword Watchlist | Track keywords across monitors and feeds with regex support and browser notifications |
| Quick Search | Multi-engine search bar with categories: General, Research, Medical, Custom |

All OSINT tools are accessible from the popup, context menu, console, and keyboard shortcuts.

---

## Knowledge Graph

Argus automatically builds a persistent knowledge graph from every analysis, bookmark, and monitored page.

- Automatic entity extraction: people, organizations, locations, dates, events
- Fuzzy matching (Levenshtein distance + token overlap) prevents duplicate entities
- Co-occurrence edges connect entities that appear together
- Inference rules discover implicit relationships (e.g., repeated person + org co-occurrence → "affiliated-with")
- ~2,500+ built-in dictionary entries across noise phrases, known locations, organizations, valid first names
- Pending merge queue for ambiguous matches requiring human review
- Project-level and global graph views with interactive force-directed visualization
- Skeleton view for structural investigation overview
- AI-powered chat within the graph view — ask questions about the entities and relationships you're looking at

### Entity Dictionaries

Customize entity classification in Console → **OSINT** → **Entity Dictionaries**:

| Dictionary | Purpose |
|-----------|---------|
| Noise Entities | Phrases to always exclude ("Read More", "Subscribe Now") |
| Known Locations | Multi-word places ("New York City", "Silicon Valley") |
| Known Organizations | Companies and institutions ("Federal Reserve", "Reuters") |
| Not-Person Words | Words that never start a person name ("Download", "Premium") |
| Valid First Names | Real first names across cultures for person detection |

---

## Source-Aware Pipelines

Argus detects the type of page you're analyzing and automatically runs a specialized extraction pipeline.

| Source Type | Detection | What It Extracts |
|-------------|-----------|------------------|
| Wikipedia | Wikipedia URLs | Structured profile, infobox data, related entities, categories |
| News Article | Major news domains + byline heuristics | Claims with evidence levels, bias indicators, source quality score |
| Classifieds | Marketplace URLs + price/listing heuristics | Listing data, seller info, scam risk analysis |
| Research | Academic URLs (arxiv, scholar, etc.) | Claims, knowledge coverage, methodology notes |

Pipeline results appear in a collapsible "Source Insights" panel below your analysis. Extracted entities feed into the Knowledge Graph automatically.

---

## Projects

Collect URLs, analyses, notes, and entities into organized investigations.

- Add items from analysis results, bookmarks, context menu, or manually
- Per-item notes, tags, and AI-generated summaries
- Batch entity extraction across all project items
- Connection graph and timeline visualization scoped to project data
- Dashboard with auto-digests, trend detection, and AI-generated reports (executive summary, knowledge gaps, investigation report)
- Export as JSON bundle with full history, or import bundles from other Argus installations
- Link automations to specific projects for one-click pipeline execution

---

## Smart Bookmarks

- AI-generated tags, categories, summaries, and reading time estimates
- Hierarchical folders with drag-and-drop organization
- Full-text search, tag cloud, and category filtering
- Select multiple bookmarks and synthesize into a research report with footnotes
- Cloud sync: bookmark metadata to GitHub as diffable JSON, page snapshots to cloud drives

---

## Chat

Standalone AI chat interface — no page context required.

- Persistent sessions with full conversation history
- Switch providers mid-conversation
- Send any response to the Draft Pad with one click
- Accessible from context menu, keyboard shortcut, or ribbon nav

---

## Workbench

Project-aware deep-analysis workspace.

- Select a project, browse its item tree, drag items onto the work surface
- Chat with AI using selected items as context — find connections, contradictions, patterns
- Floating, draggable, resizable panels for the project tree and selected items
- Save results back to the project, copy, export, or email
- Provider override per session

---

## Draft Pad

Markdown editor for assembling reports from your research.

- **Asset Library** — floating panel with one-click insertion of analyses, entities, bookmarks, and notes from any project
- **Templates** — OSINT Brief, Legal Summary, Tech Memo, Incident Report, or blank
- **Drafts management** — save, rename, resume, and organize multiple drafts (project-attached or standalone)
- **Live preview** with markdown rendering
- **Export** to .md, .html, or .txt
- **Share** — GitHub Gist, Pastebin, PrivateBin, email, post to X or LinkedIn
- **Auto-save** and word count

---

## Automations

Multi-step programmable workflows with URL-pattern triggers or manual execution.

### Step Types

- **Analyze** — run any preset on the page
- **Custom Prompt** — chain your own system/user prompt (input from page or previous step)
- **Extract Entities** — feed results into the Knowledge Graph
- **Run Pipeline** — run a source-aware pipeline for structured extraction
- **Add to Project** — route results into a project with custom tags
- **Save to Cloud** — upload results to connected cloud providers
- **Paste to Service** — publish to Gist, Pastebin, or PrivateBin

### Triggers

- **URL patterns** — auto-fire when visiting matching pages (wildcard support)
- **Manual** — run from the automation list or from a project
- **Linked project** — appears in that project's automation toolbar

Steps run in sequence, each passing its output to the next. Chain providers — use Grok for extraction, Claude for analysis, Gemini for synthesis — in a single pipeline.

---

## Page Monitoring

Track changes on any webpage with configurable check intervals.

- Set check frequency: 15 minutes to weekly
- Visual diff highlighting of what changed
- Optional AI-powered change summaries using your configured provider
- Keyword watchlist integration — get notified when specific terms appear
- Snapshot history with OPFS binary storage
- Link monitors to automations for automatic response to changes

---

## RSS Feed Reader

Full-featured feed reader built into the extension.

- Subscribe to any RSS/Atom feed
- Configurable refresh intervals per feed
- Keyword routing: automatically add matching entries to projects (with include/exclude logic)
- Browser notifications on keyword matches
- Read articles in a clean reader view
- Feed detection on pages you visit

---

## Finance Monitor

Track financial instruments with real-time price data.

- Watchlists for stocks, crypto, commodities, forex pairs, and indices
- Price alerts with configurable conditions (above, below, % change)
- Calendar events for earnings, launches, Fed meetings, token unlocks
- Import/export watchlists
- Dedicated full-page view with charts

---

## Terminal

WebSocket-based shell client using xterm.js.

- Connect to any server running a WebSocket relay (ttyd, websockify, webssh2)
- Saved session management
- Full terminal emulation with clickable URLs
- Auto-resize to window

---

## Archive & Paywall Bypass

Automatic archive.is redirect for configurable site lists.

- Default list of 24 common paywalled sites included
- Add or remove sites freely
- Toggle on/off globally
- Wayback Machine lookup from popup or context menu

---

## Vault Encryption

Protect stored credentials with AES-256-GCM encryption.

- Lock with PIN (4 or 6 digit) or password
- Encrypts: AI provider API keys, cloud provider credentials, SSH sessions, paste service credentials
- Auto-lock on browser restart or configurable timeout
- Lock screen blocks access to sensitive features until unlocked
- Vault-encrypted backups: restore on any machine, unlock with your passcode

---

## Cloud Backup & Storage

| Provider | Auth | Notes |
|----------|------|-------|
| Google Drive | OAuth2 (your own GCP Client ID) | `drive.file` scope only |
| Dropbox | OAuth2 (your own App Key) | App folder access |
| WebDAV | URL + credentials | Nextcloud, ownCloud, any WebDAV server |
| S3-Compatible | Access Key + Secret | AWS S3, MinIO, Backblaze B2 |
| GitHub Repo | Personal Access Token | Diffable JSON history |

**What gets backed up:** Projects, bookmarks, monitors, feeds, analysis history, knowledge graph, watchlist, automations, settings. Compressed as `.zip` with manifest. Scheduled automatic backups or one-click manual.

---

## Sharing & Export

- **Email** any analysis, bookmark set, or report with built-in compose
- **GitHub Gist** — public or secret gists from any content
- **Pastebin / PrivateBin** — encrypted paste support with client-side encryption
- **Social** — post summaries to X or LinkedIn
- **Export formats** — Markdown, HTML, CSV, JSON, plain text
- **Project bundles** — export/import complete project archives with history

---

## Extended AI Features

- **Multi-provider comparison** — run the same analysis across multiple providers simultaneously, see results side by side
- **Streaming responses** — real-time token streaming from all providers
- **Extended thinking** — Claude's native thinking, OpenAI's reasoning effort, Grok's swarm mode
- **Vision support** — analyze images with vision-capable models (drag images into chat or analysis)
- **Selection analysis** — highlight text on any page, right-click → analyze just the selection
- **Batch analysis** — run presets across multiple bookmarks or project items
- **PDF extraction** — analyze PDF documents directly (Mozilla pdf.js integration)

---

## Resources Hub

Curated link library organized by category: OSINT tools, online IDEs, security labs, crime data, and more. Add custom categories and links. One-click open from the console.

---

## Navigation

### Three Navigation Layers

1. **Popup** — 4 customizable quick-jump icons from a pool of 22 (10 tool pages + 12 console tabs). Long-press the grid button to configure.
2. **Ribbon** — persistent top bar on all Argus pages with console tab icons. Includes a grid button for swapping the console entry point.
3. **Tool Tab Bar** — up to 8 visible tool pages below the ribbon. Drag to reorder, use the overflow menu for quick-jump, grid button for visibility config.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G` | Open Argus popup |
| `Ctrl+Shift+S` | Quick Summary of current page |
| `Ctrl+Shift+A` | Analyze selected text |

---

## Privacy

- **All data stored locally** — IndexedDB, OPFS, browser.storage.local
- **No telemetry, no analytics, no tracking** — explicitly declared in the manifest
- **No accounts, no servers** — there is nothing to sign up for because there is no service
- **API keys never leave your browser** except to the provider you choose
- **Optional Vault encryption** for all stored credentials
- **Cloud backup to your own storage** — Argus has no servers and never sees your backup data
- **Fully auditable** — vanilla JavaScript, no obfuscated bundles, no minified application code
- **Wipe Everything** permanently deletes all local data — use before uninstalling

The only network requests Argus makes: AI provider APIs you configure, RSS feeds you subscribe to, archive redirect URLs, RDAP/DNS lookups, Wayback Machine API, OpenStreetMap Nominatim geocoding, and cloud/paste providers you configure. That's it.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

---

## Installation

### From Source

```bash
git clone https://github.com/n3r4-life/argus360.git
cd argus360
```

1. Open Firefox → `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on"** → select `manifest.json`

### Building

```bash
npx web-ext build     # Package for distribution
npx web-ext run       # Development with auto-reload
```

---

## Project Structure

```
Argus/
├── manifest.json                # Extension manifest (Manifest V2)
├── background.js                # Core: router, context menus, analysis engine
├── background-osint.js          # OSINT backend handlers
├── background-presets.js        # Analysis presets and provider model definitions
├── background-providers.js      # AI provider APIs (streaming + non-streaming)
├── background-permissions.js    # Optional permission management
├── background-kg.js             # Knowledge Graph engine
├── background-pipelines.js      # Source-aware pipelines
├── background-agents.js         # Agentic automation (digests, reports, trends)
├── background-automations.js    # Multi-step automation engine
├── popup/                       # Browser action popup
├── results/                     # Analysis results display + sharing
├── options/                     # Full settings console (all tabs)
├── chat/                        # Standalone AI chat
├── workbench/                   # Project-aware conversational workspace
├── reporting/                   # Draft Pad — markdown editor + asset library
├── bookmarks/                   # Smart bookmarks manager
├── history/                     # Analysis history viewer
├── monitors/                    # Page monitor change history
├── feeds/                       # RSS feed reader
├── finance/                     # Finance monitor
├── ssh/                         # Terminal (xterm.js WebSocket client)
├── shared/                      # Ribbon nav, shared UI, lock screen
├── osint/                       # OSINT tool pages
│   ├── graph.*                  # Connection graph (project + global KG)
│   ├── dashboard.*              # Project dashboard
│   ├── timeline.*               # Event timeline
│   ├── link-map.*               # Link mapping
│   ├── heatmap.*                # Entity heatmap
│   ├── geomap.*                 # Geolocation map
│   ├── techstack.*              # Tech stack detection
│   └── images.*                 # Image grabber
├── lib/                         # Shared libraries
│   ├── storage-db.js            # IndexedDB abstraction (ArgusDB)
│   ├── opfs-storage.js          # OPFS binary blob storage
│   ├── cloud-providers.js       # Cloud providers (GDrive, Dropbox, WebDAV, S3, GitHub, Gist, Pastebin, PrivateBin)
│   ├── cloud-backup.js          # Backup/restore with zip compression
│   ├── argus-vault.js           # Vault encryption (PBKDF2 + AES-256-GCM)
│   ├── argus-structured.js      # Structured output parsing
│   ├── email-share.js           # Email compose
│   ├── export-utils.js          # Export helpers
│   ├── intelligence-viewer.js   # Analysis result renderer
│   └── [vendor libs]            # xterm.js, pdf.js, fflate, marked, DOMPurify
├── data/
│   ├── resources.json           # Curated link library
│   └── kg-dictionaries.js       # Entity classification dictionaries (~2,500+ entries)
└── icons/                       # Extension icons (16–128px)
```

---

## Fork It, Make It Yours

Argus is fully open source. Clone it, rename it, rip it apart — no restrictions.

The entire extension is vanilla JavaScript with zero build dependencies. No frameworks, no bundlers, no transpilers. Open the files and edit.

1. Fork this repo
2. Update `manifest.json` — change name, description, `gecko.id`
3. Swap icons and watermark
4. Customize presets, add providers, change the UI
5. Submit to [addons.mozilla.org](https://addons.mozilla.org) or distribute the `.zip`

> **Why open source matters here:** You're handing this extension your API keys and browsing content. You should be able to see exactly what it does with them. No obfuscated code, no minified bundles, no hidden network calls. What you see in the repo is exactly what runs in your browser.

---

## Support Argus

If Argus saves you time or makes your workflow better, consider starring the repo or sharing it. Bug reports and feature requests welcome via [GitHub Issues](https://github.com/n3r4-life/argus360/issues).
