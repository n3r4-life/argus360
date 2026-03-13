<p align="center">
  <img src="icons/icon-128.png" alt="Argus" width="96">
</p>

<h1 align="center">Argus</h1>

<p align="center">
  AI-powered web intelligence for Firefox — analyze, monitor, investigate, report.
</p>

<p align="center">
  Your API keys stay on your machine. No accounts, no servers, no telemetry. Ever.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Firefox-142%2B-orange" alt="Firefox 142+">
  <img src="https://img.shields.io/badge/version-360.2.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/dependencies-zero-brightgreen" alt="Zero Dependencies">
</p>

---

Argus is named after the all-seeing giant of Greek mythology — a guardian with a hundred eyes, ever-watchful, never forgetting. Whether you just want a quick way past CNN's paywall (via Archive.is auto-redirect), a simple page analyzer, or a full private second brain for serious research — Argus scales to whatever you need.

---

## What Argus Does

**Analyze** any webpage with AI. **Monitor** pages for changes. **Investigate** with OSINT tools, knowledge graphs, and entity extraction. **Draft** reports with a built-in editor. **Chat** with AI directly. **Back up** everything to your own cloud storage. All inside Firefox, all private, all yours.

---

## AI Providers

| Provider | Models | Streaming | Extended Thinking |
|----------|--------|-----------|-------------------|
| **xAI (Grok)** | Grok 4, Grok 3, Grok Mini | ✓ | Swarm multi-agent mode |
| **OpenAI** | GPT-4.1, o3, o4-mini | ✓ | Reasoning effort control |
| **Anthropic (Claude)** | Claude 4, Sonnet, Haiku | ✓ | Native extended thinking |
| **Google (Gemini)** | Gemini 2.5 Pro/Flash | ✓ | — |
| **Custom** | Any OpenAI-compatible endpoint | ✓ | — |

Custom endpoint support covers Ollama, LM Studio, Hugging Face, vLLM, and any self-hosted setup. Bring your own keys — Argus never sees, stores, or transmits them anywhere except directly to the provider you choose.

---

## Core Analysis

- **Fully editable presets** — summary, key points, sentiment, fact-check, entity extraction, critical analysis, contradiction scan, research brief, and 20+ more built-in, all fully customizable
- **Compare multiple providers side-by-side** in one view
- **Real-time streaming** with markdown rendering + built-in follow-up chat (switch models mid-conversation, keep full context)
- **One-click re-analyze** with a different preset or provider
- **PDF content extraction** — automatically extracts and analyzes text from PDF documents (local and remote) via Mozilla's pdf.js
- **Selection analysis** — highlight text and analyze just that selection
- **Multi-page analysis** — analyze multiple open tabs together into a synthesized report

### Built-in Analysis Presets

| Preset | What it does |
|--------|-------------|
| Summary | Concise overview of the page content |
| Sentiment Analysis | Tone, bias, and emotional undertones |
| Fact-Check | Identifies claims and assesses verifiability |
| Key Points | Structured bullet-point extraction |
| ELI5 | Explains content in simple, everyday language |
| Critical Analysis | Arguments, strengths, weaknesses, fallacies |
| Action Items | Tasks and next steps as a checklist |
| Research Report | Multi-source synthesis with citations |
| Late Night Recap | Sharp, witty comedic editorial recap |
| Entity Extraction (OSINT) | People, orgs, locations, dates, amounts as JSON |
| Source Credibility | Credibility scoring (1–10) with bias assessment |
| Person/Org Profile | Structured intelligence profile from page content |

Plus contradiction scan, comparative analysis, legal brief, technical deep-dive, and more — over 30 presets total, all fully customizable, with room to add your own.

---

## Chat

Standalone AI chat interface — no page context required. Talk to any configured provider directly from Argus.

- Persistent sessions with full conversation history
- Switch providers mid-conversation
- Send any AI response to the Draft Pad with one click
- Accessible from the context menu, keyboard shortcut, or ribbon nav

---

## Workbench

Project-aware deep-analysis workspace with a chat interface and floating panels.

- Select a project, browse its item tree, drag items onto the work surface
- Chat with AI using the selected items as context — find connections, contradictions, and patterns across your research
- Floating, draggable, resizable panels for the project tree and selected items
- Save results back to the project, copy, export as markdown, or email
- Provider override per session

---

## Draft Pad

Lightweight markdown editor for assembling reports from your research.

- **Asset Library** — floating panel with one-click insertion of analyses, entities, bookmarks, and notes from any project
- **Templates** — OSINT Brief, Legal Summary, Tech Memo, Incident Report, or blank
- **Drafts management** — save, rename, resume, and organize multiple drafts (project-attached or standalone)
- **Live preview** toggle with markdown rendering
- **Export** to .md, .html, or .txt
- **Share** — paste to GitHub Gist / Pastebin / PrivateBin, email, post to X or LinkedIn
- **Auto-save** and word count
- Receives content from Chat, Workbench, Results, History, and Image Grabber via "Send to Draft"

---

## Smart Bookmarks

- AI-generated tags, categories, summaries, and reading time estimates
- Hierarchical folders with drag-and-drop organization
- Full-text search, tag cloud, and category filtering
- Select multiple bookmarks and synthesize into a research report with footnotes

---

## Projects

Group related pages into structured investigations.

- Add URLs, analyses, notes, and bookmarks to a project
- Per-item analysis history with multi-analysis stacking and follow-up conversations
- OSINT toolbar: entity extraction, connection graph, heatmap, geomap, timeline, report generation, anomaly scan, skeleton view
- Automation integration — run multi-step workflows on all project items or a single item
- Import/export as `.argusproj` bundles (includes related history entries)
- Open in Workbench for deep-dive conversational analysis
- Project-level Knowledge Graph and Dashboard

---

## Page Monitoring

- Monitor any page for content changes with configurable check intervals
- AI-powered change summaries with side-by-side diff comparison
- Full HTML snapshots stored in OPFS (Origin Private File System) with optional screenshots
- Auto-expiry settings (12h to indefinite)
- Snapshot-and-analyze: capture a page and run analysis in one step

---

## RSS Feed Reader

- Subscribe to feeds or paste any page URL — Argus auto-discovers the feed
- AI-summarized entries using your configured provider
- Bridge feeds to page monitors for unified tracking
- Keyword routes: automatically tag, file, or act on entries matching your watchlist
- Dedicated full-page feed reader view

---

## Archive & Paywall Bypass

- **Archive.is / Wayback Machine integration** — auto-redirect paywalled sites, on-demand archive checks from popup or context menu
- Customizable trouble list with 24 common news sites pre-loaded
- Toggle redirect on/off from the popup
- Save pages to archive directly, check archive availability

---

## OSINT Tools

| Tool | What it does |
|------|-------------|
| Metadata Extraction | Headers, meta tags, Open Graph, structured data |
| Link Mapping | Internal/external link analysis and visualization |
| Whois / DNS | RDAP lookups (rdap.org) + DNS records (dns.google) |
| Tech Stack Detection | Frameworks, CDNs, analytics, CMS identification |
| Regex Scanner | Pattern scanning with AI-powered threat/entity/summary analysis |
| Image Grabber | Extract, filter, preview, download, and cloud-save all images from a page |
| Connection Graph | Interactive force-directed visualization (project-level and global) |
| Entity Heatmap | Mention frequency visualization across project items |
| Geolocation Map | Plot extracted locations on an interactive map (OpenStreetMap Nominatim) |
| Timeline | Chronological event visualization from extracted dates |
| Project Dashboard | At-a-glance widgets with auto-digests and AI-generated reports |

---

## Knowledge Graph

Argus automatically builds a persistent knowledge graph from every analysis, bookmark, and monitored page.

- Automatic entity extraction (people, organizations, locations, dates) across all content
- Fuzzy matching (Levenshtein distance + token overlap) prevents duplicate entities
- Co-occurrence edges connect entities that appear together
- Inference rules discover implicit relationships (e.g., repeated person + org co-occurrence → affiliated-with)
- Customizable entity dictionaries (~2,500+ built-in entries across noise phrases, known locations, known organizations, not-person words, and valid first names)
- Pending merge queue for ambiguous matches requiring human review
- Project-level and global graph views
- Skeleton view for structural investigation overview

---

## Source-Aware Pipelines

Argus detects the type of page you're analyzing and automatically runs a specialized extraction pipeline in the background.

| Source Type | Detection | What It Extracts |
|-------------|-----------|------------------|
| Wikipedia | Wikipedia URLs | Structured profile, infobox data, related entities, categories |
| News Article | Major news domains + byline heuristics | Claims with evidence levels, bias indicators, source quality score |
| Classifieds | Marketplace URLs + price/listing heuristics | Listing data, seller info, scam risk analysis |
| Research | Academic URLs (arxiv, scholar, etc.) | Claims, knowledge coverage, methodology notes |

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

---

## Cloud Backup & Storage

### Backup Providers
| Provider | Auth | Notes |
|----------|------|-------|
| Google Drive | OAuth2 (your own GCP Client ID) | `drive.file` scope only |
| Dropbox | OAuth2 (your own App Key) | App folder access |
| WebDAV | URL + credentials | Nextcloud, ownCloud, any WebDAV server |
| S3-Compatible | Access Key + Secret | AWS S3, MinIO, Backblaze B2 |
| GitHub Repo | Personal Access Token | Commits to `argus-backups/` in your repo |

### What Gets Backed Up
Projects, bookmarks, monitors, feeds + entries, analysis history, knowledge graph (nodes + edges), watchlist, automations, and settings. Compressed as `.zip` with manifest. Scheduled automatic backups or one-click manual backup.

### Paste / Share Services
| Service | Auth | Use |
|---------|------|-----|
| GitHub Gist | PAT with `gist` scope | Secret gists for sharing exports |
| Pastebin | API Developer Key | Public/unlisted/private pastes |
| PrivateBin | Instance URL | Client-side encrypted, zero-knowledge |

---

## Sharing & Export

- **Email+** — compose with contact picker from results, history, or Draft Pad
- **Social sharing** — X (Twitter), Reddit, LinkedIn one-click sharing
- **Send to Draft** — push content from Chat, Workbench, Results, History, or Image Grabber into the Draft Pad
- **Export formats** — Markdown, HTML, plain text, `.argusproj` bundles
- **Cloud save** — upload files and pages directly to connected providers via context menu

---

## Extended AI Features

- **Extended thinking** — Claude native thinking, plus best-effort reasoning sections for OpenAI and Grok
- **Multi-agent mode** — Grok Swarm with configurable agent count and effort level
- **Provider-specific reasoning controls** — configure effort levels separately per provider
- **Response language** — auto-detects browser locale or set manually
- **Advanced prompts** — fully customizable system/user prompts for every feature (dashboard reports, digests, change detection, feed summarization, workbench analysis, regex analysis, and more)

---

## Resources Hub

Built-in curated link library with categories including OSINT tools, online IDEs & terminals, PowerShell & Bash consoles, security labs & sandboxes, investigative resources, and more. Shows your current public IP, supports update checking, and is fully customizable.

---

## Quick Start

1. **Get an API key** — click any provider link in Settings, create a free account, generate a key (~2 minutes)
2. **Install Argus** — [Firefox Add-ons](https://addons.mozilla.org) or load from source
3. **Configure** — click the Argus icon → gear icon → paste your API key → Save
4. **Analyze** — navigate to any page, click Argus, choose a preset, hit "Analyze This Page"

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G` | Open Argus popup |
| `Ctrl+Shift+S` | Quick summary of current page |
| `Ctrl+Shift+A` | Analyze selected text |

### Context Menu (Right-Click)

Right-click anywhere on a page to access Argus directly:

- **Chat with AI** — open standalone chat, or chat about selected text
- **Workbench** — open project-aware workspace
- **Add to Bookmarks** — file into folders with AI tags
- **Add to Project** — add to any existing project
- **Redirector** — save to archive, redirect through archive, add site to trouble list
- **Site Versions** — check Archive.is and Wayback Machine availability
- **OSINT Tools** — metadata, links, whois, tech stack, regex scan, dashboard, global graph
- **Save to Cloud** — upload linked files or current page to connected providers
- **Run Automations** — execute any configured automation on the current page
- Run any built-in or custom analysis preset directly from the menu

---

## Navigation

Argus includes a shared **ribbon navigation bar** across all full-page views with quick access to:

| App | What it is |
|-----|-----------|
| Console | Full settings, projects, bookmarks, monitors, feeds, OSINT, automations |
| Knowledge Graph | Global interactive entity graph |
| Chat | Standalone AI chat |
| Workbench | Project-aware analysis workspace |
| Reports | Analysis history viewer |
| Draft Pad | Markdown report editor |
| Reader | RSS feed reader |
| Images | Image grabber tool |

Each app opens as a single-instance tab — clicking the nav icon focuses an existing tab rather than opening duplicates. Badge counts show live data for bookmarks, projects, monitors, feeds, KG entities, and automations.

You can also set all Argus pages as your Firefox homepage tabs.

---

## Installation

### From Source (Developer)

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

## Configuration Reference

### General Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Max Response Tokens | 2048 | Maximum tokens in AI response (256–16,384) |
| Max Input Characters | 100,000 | How much page text to send (1,000–500,000) |
| Temperature | 0.3 | Creativity level (0 = focused, 1 = creative) |
| Response Language | Auto-detect | Language for AI responses |
| Max History Size | 200 | Number of analysis entries to retain |

### Prompt Variables

| Variable | Replaced with |
|----------|--------------|
| `{title}` | Page title |
| `{url}` | Page URL |
| `{domain}` | Domain name |
| `{date}` | Current date |
| `{wordcount}` | Word count of page content |

---

## Project Structure

```
Argus/
├── manifest.json                # Extension manifest (Manifest V2)
├── background.js                # Core logic: router, context menus, analysis, features
├── background-osint.js          # OSINT backend handlers
├── background-presets.js        # Analysis presets and provider definitions
├── background-providers.js      # AI provider API functions (streaming + non-streaming)
├── background-permissions.js    # Optional permission management
├── background-kg.js             # Knowledge Graph engine (extraction, fuzzy matching, inference)
├── background-pipelines.js      # Source-aware pipelines (Wikipedia, News, Classifieds, Research)
├── background-agents.js         # Agentic automation (digests, reports, trend detection)
├── background-automations.js    # Multi-step automation engine with triggers
├── popup/                       # Browser action popup
├── results/                     # Analysis results display + sharing
├── options/                     # Full settings / console (all tabs)
├── chat/                        # Standalone AI chat interface
├── workbench/                   # Project-aware conversational workspace
├── reporting/                   # Draft Pad — markdown editor + asset library
├── bookmarks/                   # Smart bookmarks manager
├── history/                     # Analysis history viewer + feed
├── monitors/                    # Page monitor change history
├── feeds/                       # RSS feed reader
├── shared/                      # Ribbon navigation bar + shared UI
├── osint/                       # OSINT tool pages
│   ├── graph.*                  # Connection graph (project + global KG)
│   ├── dashboard.*              # Project dashboard with widgets
│   ├── timeline.*               # Event timeline
│   ├── link-map.*               # Link mapping
│   ├── heatmap.*                # Entity heatmap
│   ├── geomap.*                 # Geolocation map
│   ├── techstack.*              # Tech stack detection
│   └── images.*                 # Image grabber
├── lib/                         # Shared libraries
│   ├── storage-db.js            # IndexedDB abstraction (ArgusDB)
│   ├── opfs-storage.js          # OPFS binary blob storage for snapshots
│   ├── cloud-providers.js       # Google Drive, Dropbox, WebDAV, S3, GitHub, Gist, Pastebin, PrivateBin
│   ├── cloud-backup.js          # Backup/restore with zip compression
│   ├── argus-structured.js      # Structured output parsing
│   ├── email-share.js           # Email+ compose with contact picker
│   ├── export-utils.js          # Export helpers
│   ├── intelligence-viewer.js   # Analysis result renderer
│   ├── pdf.min.js               # Mozilla pdf.js for PDF extraction
│   ├── fflate.min.js            # Compression library for backups
│   ├── marked.min.js            # Markdown rendering
│   └── purify.min.js            # DOMPurify for safe HTML
├── data/
│   ├── resources.json           # Curated link library (OSINT, IDEs, security labs)
│   └── kg-dictionaries.js       # Entity classification dictionaries
└── icons/                       # Extension icons (16–128px)
```

---

## Privacy

- **API keys are stored locally** in your browser's extension storage — never transmitted anywhere except directly to the AI provider you select
- **No telemetry or analytics** — Argus does not phone home, track usage, or report anything to anyone
- **No data collection** — explicitly declared in the extension manifest under `data_collection_permissions`
- **No accounts required** — there is nothing to sign up for because there is no service behind this extension
- **Cloud backup connects only to providers you configure** using your own credentials — Argus has no servers and never sees your backup data
- **Fully auditable** — every line of code is vanilla JavaScript, no obfuscated bundles
- **Wipe Everything** in Settings permanently deletes all local data (IndexedDB, OPFS snapshots, browser storage) — use before uninstalling, as Firefox does not auto-clear extension data

The only network requests Argus makes are to: AI provider APIs you configure, RSS feed URLs you subscribe to, archive redirect URLs, RDAP (rdap.org) for whois lookups, Google DNS (dns.google) for DNS records, the Wayback Machine API (archive.org), OpenStreetMap Nominatim (geocoding), and cloud/paste providers you configure. That's it.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

---

## Fork It, Make It Yours

Argus is fully open source. Clone it, rename it, rip it apart and build something new — no restrictions.

The entire extension is vanilla JavaScript with zero build dependencies. No frameworks, no bundlers, no transpilers — just open the files and edit.

1. Fork this repo
2. Update `manifest.json` — change the name, description, and `gecko.id`
3. Swap the icons in `icons/` and the watermark
4. Customize presets, add providers, change the UI
5. Submit to [addons.mozilla.org](https://addons.mozilla.org) or distribute the `.zip` directly

---

## Support Argus

If Argus saves you time or helps your research, consider supporting development:

- **GitHub Sponsors:** [github.com/sponsors/n3r4-life](https://github.com/sponsors/n3r4-life)
- **Buy Me a Coffee:** [buymeacoffee.com/n3r4.life](https://buymeacoffee.com/n3r4.life)

---

## Contributing

Issues and PRs are welcome. If you build something cool with it, let me know.

**GitHub:** [github.com/n3r4-life/argus360](https://github.com/n3r4-life/argus360)

---

## License

MIT — From quick paywall bypass → daily feed digest → multi-year investigation brain — Argus watches, remembers, connects the dots, and works for you.

*Like its namesake, Argus sees every angle — so you don't have to.*
