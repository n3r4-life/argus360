# Argus — Private Intelligence OS in Your Browser

-Easy to use!
-Pin to your Toolbar!
-or Right-Click, and select Argus...

**BYOK, Bring your own API key. No subscriptions. No accounts. 100% local, or BYOC, bring your own cloud**

Argus requires your own API keys from supported AI providers — cheap, easy, and you stay in full control. Most providers offer free tiers or credits to get started, and a typical page analysis costs less than a penny.

| Provider | Get your key | Free tier |
|----------|-------------|-----------|
| xAI (Grok) | [console.x.ai](https://console.x.ai) | $25/month free API credits |
| Google (Gemini) | [aistudio.google.com](https://aistudio.google.com/apikey) | Generous free tier |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Pay-as-you-go (low cost) |
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) | $5 free credit on signup |
| Custom (OpenAI-compatible) | Your endpoint | Bring your own |

> **Why API keys instead of a subscription?** You only pay for what you use — typically fractions of a cent per analysis. Compare that to $20/month ChatGPT Plus or Claude Pro subscriptions. Analyzing 1,000 pages might cost less than a dollar. Run a local model through Ollama and it costs nothing at all. Your keys stay on your machine — Argus never sees, stores, or transmits them anywhere except directly to the provider you choose.

---

Argus is named after the all-seeing giant of Greek mythology — a guardian with a hundred eyes, ever-watchful, never forgetting. Whether you just want a quick way past CNN's paywall (via Archive.is auto-redirect), a simple page analyzer, or a full private second brain for serious research — Argus scales to whatever you need.

![Firefox](https://img.shields.io/badge/Firefox-142%2B-orange)
![Version](https://img.shields.io/badge/version-360.1.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Core Analysis

- **5 providers + custom:** xAI (Grok), OpenAI (GPT-4.1), Anthropic (Claude), Google (Gemini), and any OpenAI-compatible endpoint (Ollama, LM Studio, Hugging Face, self-hosted)
- **Fully editable presets:** summary, key points, sentiment, fact-check, entity extraction, critical analysis, contradiction scan, research brief, custom prompts, and more
- **Compare multiple providers side-by-side** in one view
- **Real-time streaming** with markdown rendering + built-in follow-up chat (switch models mid-conversation, keep context)
- **One-click re-analyze** with a different preset or provider
- **PDF content extraction** — automatically extracts and analyzes text from PDF documents using Mozilla's pdf.js
- **Selection analysis** — highlight text and analyze just that selection
- **Multi-page analysis** — analyze multiple open tabs together into a synthesized report

### Built-in Analysis Presets

| Preset | What it does |
|--------|-------------|
| **Summary** | Concise overview of the page content |
| **Sentiment Analysis** | Tone, bias, and emotional undertones |
| **Fact-Check** | Identifies claims and assesses verifiability |
| **Key Points** | Structured bullet-point extraction |
| **ELI5** | Explains content in simple, everyday language |
| **Critical Analysis** | Examines arguments, strengths, weaknesses, fallacies |
| **Action Items** | Extracts tasks and next steps as a checklist |
| **Research Report** | Multi-source synthesis with citations and cross-references |
| **Late Night Recap** | Sharp, witty comedic editorial recap |
| **Entity Extraction (OSINT)** | Structured extraction of people, orgs, locations, dates, amounts, contacts as JSON |
| **Source Credibility** | Credibility scoring (1-10) with bias and verification assessment |
| **Person/Org Profile** | Structured intelligence profile from page content |

### Custom Presets & Provider Binding
- Create your own analysis presets with custom system and user prompts
- **Bind presets to specific providers** — e.g., always use Grok for fact-checking, Claude for deep reasoning
- Use template variables: `{title}`, `{url}`, `{domain}`, `{date}`, `{wordcount}`

---

## Projects — Your Living Knowledge Base

Collect pages, bookmarks, RSS items, monitor snapshots, and notes into Projects. Argus automatically:

- **Extracts & merges entities** (people, orgs, locations, dates) across everything
- Maintains a **persistent cross-project knowledge graph** with relationship inference
- Runs **source-aware workflows** on arrival:
  - Wikipedia → infobox profiles + references + controversy flags
  - News articles → claims with evidence levels, bias indicators, source quality scoring
  - Classifieds/marketplace → listing extraction, scam risk analysis, price tracking
  - Research/academic → claims analysis, knowledge coverage, methodology notes
- **Surfaces trends, anomalies, contradictions, investigative leads**
- **Auto-generates weekly digests**, timeline highlights, influence views, and draft report sections
- Lets you build **custom research pipelines** (background runs: extract → profile → verify → append to report)

### Project Dashboard & Auto-Digests
- At-a-glance dashboard with stats, activity charts, entity breakdown, co-occurrence heatmap, and trend alerts
- Auto-report sections on demand: Executive Summary, Knowledge Gaps, Contradictions, Timeline Highlights
- Scheduled digests (daily/weekly) — AI-generated briefings summarizing new items, findings, and suggested next steps

---

## Full OSINT & Monitoring Suite

- **Metadata Extraction** — page meta tags, Open Graph, Twitter Cards, JSON-LD, dates, author, language
- **Link Mapper** — categorize all links (external, internal, social for 14 platforms, emails, phones, files) → grouped by domain + CSV export
- **Whois / DNS Lookup** — RDAP whois + Google DNS records with 24-hour caching
- **Tech Stack Detector** — fingerprints websites by inspecting headers, scripts, meta tags, cookies, and JS globals
- **Connection Graphs** — force-directed canvas visualization of entity relationships across project items
- **Entity Heatmaps** — frequency visualization across sources
- **Timelines** — chronological event extraction with date filters and markdown export
- **Geolocation Mapping** — map entities with geographic references using Leaflet
- **Anomaly Scanner** — AI-powered outlier detection across project data
- **Keyword Watchlists** — track terms across monitors and feeds with instant browser notifications (supports regex)
- **"Discuss with AI" chat** — available on every result and OSINT page, seeded with page context for follow-up questions

### Smart Bookmarks
- Bookmark any page with **AI-generated tags, categories, and summaries**
- Full-text search, tag cloud, and category filtering
- Select multiple bookmarks and synthesize into a research report with footnotes and citations

### Page Monitoring
- Monitor any page for content changes with configurable check intervals
- AI-powered change summaries with side-by-side diff comparison
- Auto-expiry settings (12h to indefinite)

### RSS Feed Reader
- Subscribe to feeds or paste a page URL — Argus auto-discovers the feed
- AI-summarized entries using your configured provider
- Bridge feeds to page monitors for unified tracking

### Archive & Paywall Bypass
- **Archive.is / Wayback Machine integration** — auto-redirect paywalled sites, on-demand archive checks from popup or right-click menu
- Customizable trouble list with 24 common news sites pre-loaded
- Toggle redirect on/off from the popup

---

## Extended AI Features

- **Extended thinking** — Claude native thinking plus best-effort reasoning sections for OpenAI and Grok
- **Multi-agent mode** — Grok 4.20 Swarm with configurable agent count and effort level
- **Provider-specific reasoning controls** — configure effort levels separately per provider
- **Response language** — auto-detects browser locale or set manually

---

## Quick Start

1. **Get an API key** — click any provider link above, create a free account, generate a key (~2 minutes)
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
- **Argus Console** — open the full settings/project dashboard
- **Redirector** submenu — save to archive, redirect through archive, add site to trouble list
- **Site Versions** submenu — check Archive.is and Wayback Machine availability
- **OSINT** submenu — metadata, links, whois, tech stack detection
- **Bookmark with AI Tags** — instant smart bookmark
- Run any built-in or custom analysis preset directly from the menu

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
| Max Response Tokens | 2048 | Maximum tokens in AI response (256-16,384) |
| Max Input Characters | 100,000 | How much page text to send (1,000-500,000) |
| Temperature | 0.3 | Creativity level (0 = focused, 1 = creative) |
| Response Language | Auto-detect | Language for AI responses |

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
├── manifest.json              # Extension manifest (Manifest V2)
├── background.js              # Core logic: API calls, streaming, message handling
├── background-osint.js        # OSINT backend handlers
├── background-presets.js      # Analysis presets and provider definitions
├── background-providers.js    # AI provider API functions (streaming + non-streaming)
├── background-permissions.js  # Optional permission management
├── background-kg.js           # Knowledge Graph engine (entity extraction, fuzzy matching, inference)
├── background-pipelines.js    # Source-aware pipelines (Wikipedia, News, Classifieds, Research)
├── background-agents.js       # Agentic automation (digests, reports, trend detection, dashboard)
├── popup/                     # Browser action popup
├── results/                   # Analysis results display
├── options/                   # Full settings / console page
├── bookmarks/                 # Smart bookmarks
├── history/                   # Analysis history viewer
├── monitors/                  # Page monitor change history
├── feeds/                     # RSS feed reader
├── osint/                     # OSINT tool pages
│   ├── graph.*                # Connection graph (project + global KG)
│   ├── dashboard.*            # Project dashboard with widgets
│   ├── timeline.*             # Event timeline
│   ├── link-map.*             # Link mapping
│   ├── heatmap.*              # Entity heatmap
│   ├── geomap.*               # Geolocation map
│   └── techstack.*            # Tech stack detection
├── shared/                    # Shared UI components (nav ribbon)
├── lib/
│   ├── storage-db.js          # IndexedDB storage (ArgusDB)
│   ├── intelligence-viewer.js # Unified rendering component
│   ├── argus-chat.js          # Reusable "Discuss with AI" chat component
│   ├── pdf.min.js             # Mozilla pdf.js (PDF text extraction)
│   ├── pdf.worker.min.js      # pdf.js web worker
│   ├── marked.min.js          # Markdown rendering
│   ├── purify.min.js          # HTML sanitization (DOMPurify)
│   └── export-utils.js        # Shared export functions
└── icons/                     # Extension icons (16-128px)
```

---

## Privacy

- **API keys are stored locally** in your browser's extension storage — never transmitted anywhere except to the provider you choose
- **No telemetry or analytics** — Argus does not phone home
- **No data collection** — declared in `manifest.json` under `data_collection_permissions`
- Page content is sent only to the AI provider you select for analysis
- OSINT tools make requests to **rdap.org** (whois), **dns.google** (DNS), and **archive.org** (Wayback) — these contain only the domain or URL being looked up, no personal data
- Aggressive compression & pruning defaults keep storage manageable

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
