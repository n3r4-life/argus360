# Argus -- Private Intelligence OS in Your Browser (README v3)

- Easy to use!
- Pin to your Toolbar!
- or Right-Click, and select Argus...

**BYOK, Bring your own API key. No subscriptions. No accounts. 100% local, or BYOC, bring your own cloud. BYOP, bring your own paste.**

Argus requires your own API keys from supported AI providers -- cheap, easy, and you stay in full control. Most providers offer free tiers or credits to get started, and a typical page analysis costs less than a penny.

| Provider | Get your key | Free tier |
|----------|-------------|-----------|
| xAI (Grok) | https://console.x.ai | $25/month free API credits |
| Google (Gemini) | https://aistudio.google.com/apikey | Generous free tier |
| OpenAI | https://platform.openai.com/api-keys | Pay-as-you-go (low cost) |
| Anthropic (Claude) | https://console.anthropic.com | $5 free credit on signup |
| Custom (OpenAI-compatible) | Your endpoint | Bring your own |

> **Why API keys instead of a subscription?** You only pay for what you use -- typically fractions of a cent per analysis. Compare that to $20/month ChatGPT Plus or Claude Pro subscriptions. Analyzing 1,000 pages might cost less than a dollar. Run a local model through Ollama and it costs nothing at all. Your keys stay on your machine -- Argus never sees, stores, or transmits them anywhere except directly to the provider you choose.

---

Argus is named after the all-seeing giant of Greek mythology -- a guardian with a hundred eyes, ever-watchful, never forgetting. Whether you just want a quick way past CNN's paywall (via Archive.is auto-redirect), a simple page analyzer, or a full private second brain for serious research -- Argus scales to whatever you need.

---

## Privacy, Security, and Ownership (The Core Philosophy)

- **BYOK (Bring Your Own Key)** -- You control your AI keys. Nothing is routed through Argus.
- **BYOC (Bring Your Own Cloud)** -- Backups go to *your* Google Drive, Dropbox, WebDAV, or S3-compatible storage. Argus has no servers.
- **BYOP (Bring Your Own Paste)** -- Optional export to Gist, Pastebin, PrivateBin, or your own paste host.
- **Zero telemetry** -- no analytics, no tracking, no phone-home.
- **Local-first storage** -- projects, bookmarks, monitors, history, and knowledge graph live in your browser storage.
- **Quick Wipe** -- a single button destroys everything (IndexedDB, OPFS, storage, snapshots, settings) before uninstalling.

This is a private intelligence OS, not a SaaS. Cheaper long-term, more secure, and fully under your control.

---

## What's New in This Build

- **Automations**: Named multi-step workflows with URL triggers, project runs, monitor hooks, and logs.
- **Strict JSON prompting**: Every analysis preset now appends a structured JSON block for consistent extraction and downstream KG use.
- **Bookmarks expanded**: Smarter tagging, foldering, bulk analysis, tech stack enrichment, and cloud snapshot sync.
- **Image Grabber**: New OSINT tool for image extraction, filtering, deduplication, and AI vision search.

---

## Core Analysis

- **5 providers + custom:** xAI (Grok), OpenAI (GPT-4.1), Anthropic (Claude), Google (Gemini), and any OpenAI-compatible endpoint (Ollama, LM Studio, Hugging Face, self-hosted)
- **Fully editable presets:** summary, key points, sentiment, fact-check, entity extraction, critical analysis, contradiction scan, research brief, custom prompts, and more
- **Compare multiple providers side-by-side** in one view
- **Real-time streaming** with markdown rendering + built-in follow-up chat (switch models mid-conversation, keep context)
- **One-click re-analyze** with a different preset or provider
- **PDF content extraction** -- automatically extracts and analyzes text from PDF documents using Mozilla's pdf.js
- **Selection analysis** -- highlight text and analyze just that selection
- **Multi-page analysis** -- analyze multiple open tabs together into a synthesized report

---

## Strict JSON Prompting (Structured Data Enforcement)

Argus now enforces structured JSON output for every analysis (except the `entities` preset which is already pure JSON).

Every response must append a block like:

```
<!--ARGUS_DATA:{ ...json... }:ARGUS_DATA-->
```

This data is parsed, validated, and normalized by `lib/argus-structured.js`, then used for:

- Knowledge graph extraction
- Results UI summaries
- Project and pipeline aggregation

This turns every analysis into *actionable, structured intelligence* -- not just text.

---

## Automations (New)

Argus includes a full automation engine for multi-step workflows. Automations can be triggered manually, by URL patterns, from monitors, or run across project items.

### Trigger Types

- Manual run from the Automate tab or context menu
- URL pattern matching (auto-run on page visits)
- Project toolbar "Run on All" / "Run on Item"
- Monitor hook (run automation on detected page changes)

### Step Types

Supported steps include:

- `analyze` -- run a preset
- `prompt` -- run a custom prompt against page text or previous step output
- `extractEntities` -- entity extraction
- `addToProject` -- save results into a project
- `addToMonitors` -- start monitoring a page
- `runPipeline` -- run a source-aware pipeline
- `paste` -- export to paste services (Gist, Pastebin, PrivateBin)
- `saveToCloud` -- upload results to your cloud providers

Automations make Argus act like a private intelligence workflow engine, not just a one-off analyzer.

---

## Smart Bookmarks (Expanded)

Argus bookmarks are not just URLs; they are structured intelligence records.

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

Extracts, deduplicates, and analyzes all images from a page (or multiple open tabs).

### Sources

- img elements
- picture source images
- CSS background images
- video posters
- Open Graph / Twitter meta images
- favicons and icons
- inline SVG images

### Capabilities

- Normalizes URLs to dedupe CDN variants
- Filters tiny tracking pixels and common ad beacons
- Keeps highest-resolution duplicates
- Type/source stats
- Color analysis and filtering
- AI Vision Search (query what you want to find)
- Multi-tab support with per-tab breakdown

This makes Argus a lightweight reverse-image and visual OSINT collector directly inside the browser.

---

## Projects -- Your Living Knowledge Base

Collect pages, bookmarks, RSS items, monitor snapshots, and notes into Projects. Argus automatically:

- **Extracts and merges entities** across everything
- Maintains a **persistent cross-project knowledge graph** with relationship inference
- Runs **source-aware workflows** on arrival
- **Surfaces trends, anomalies, contradictions, investigative leads**
- **Auto-generates weekly digests**, timeline highlights, and draft report sections
- Lets you build **custom research pipelines**

---

## Full OSINT and Monitoring Suite

- Metadata extraction (Open Graph, JSON-LD, author/date)
- Link mapping (domains, socials, emails, phones)
- Whois / DNS lookup (RDAP + Google DNS)
- Tech stack detection
- Entity heatmaps, timelines, and graphs
- Keyword watchlists with notifications
- Page monitoring with AI change summaries
- RSS feeds with AI summaries

---

## Cloud Backup and Data Sovereignty

Back up your entire Argus workspace to your own cloud storage -- you provide your own credentials, and no data ever flows through Argus infrastructure.

- Google Drive (OAuth2)
- Dropbox (OAuth2)
- WebDAV (Nextcloud, NAS)
- S3-compatible (R2, Wasabi, B2, MinIO, AWS S3)

- Scheduled auto-backups
- One-click Backup Now
- Restore from any provider or local zip
- Quick Wipe to erase everything locally

---

## Project Structure (Key Directories)

```
Argus/
|-- manifest.json              # Extension manifest (Manifest V2)
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

## Quick Start

1. Get an API key (any provider above)
2. Install Argus (Firefox Add-ons or from source)
3. Configure: click Argus icon -> gear -> paste key -> Save
4. Analyze: open any page -> Argus -> choose preset -> Analyze

---

## Privacy

- **API keys are stored locally** in your browser's extension storage
- **No telemetry or analytics**
- **No data collection** -- declared in `manifest.json` under `data_collection_permissions`
- Page content is sent only to the AI provider you select
- **Cloud backup connects only to providers you configure** using your own credentials
- OSINT tools make requests to **rdap.org**, **dns.google**, and **archive.org**
- **Quick Wipe** permanently deletes all local data

---

## License

MIT -- From quick paywall bypass -> daily feed digest -> multi-year investigation brain -- Argus watches, remembers, connects the dots, and works for you.

Like its namesake, Argus sees every angle -- so you don't have to.
