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

**BYOK** — Bring your own API key. No subscriptions. No accounts. 100% local, or **BYOC** — bring your own cloud. **BYOP** — bring your own paste. Argus is a local-first, open-source intelligence OS for your browser. It analyzes pages, tracks changes, maps entities, and builds a persistent knowledge graph — all under your control, with your keys, your storage, your rules.

---

## What Argus Does

**Analyze** any webpage with AI. **Monitor** pages for changes. **Investigate** with OSINT tools, knowledge graphs, and entity extraction. **Draft** reports with a built-in editor. **Chat** with AI directly. **Connect** to remote shells via the built-in terminal. **Encrypt** your credentials with Vault. **Back up** everything to your own cloud storage. All inside Firefox, all private, all yours.

---

## What Argus Becomes

- Smart bookmark agent
- Page monitor
- RSS fetcher
- Automated script bot
- Redirector for troublesome subscription sites
- Tech stack scanner
- Regex searcher
- Page analyzer — from TLDR summaries to legal breakdowns
- OSINT toolkit when you need it
- Remote terminal for your servers
- Encrypted vault for your credentials

Watch your patterns, watch others' patterns. Argus is the extension that becomes what you need.

---

## Table of Contents

- [AI Providers](#ai-providers)
- [Quick Start](#quick-start)
- [Core Analysis](#core-analysis)
- [Chat](#chat)
- [Workbench](#workbench)
- [Draft Pad](#draft-pad)
- [Smart Bookmarks](#smart-bookmarks)
- [Projects](#projects)
- [Page Monitoring](#page-monitoring)
- [RSS Feed Reader](#rss-feed-reader)
- [Archive & Paywall Bypass](#archive--paywall-bypass)
- [OSINT Tools](#osint-tools)
- [Knowledge Graph](#knowledge-graph)
- [Source-Aware Pipelines](#source-aware-pipelines)
- [Automations](#automations)
- [Terminal](#terminal)
- [Vault Encryption](#vault-encryption)
- [Cloud Backup & Storage](#cloud-backup--storage)
- [Sharing & Export](#sharing--export)
- [Extended AI Features](#extended-ai-features)
- [Resources Hub](#resources-hub)
- [Navigation](#navigation)
- [How-To Guides](#how-to-guides)
- [Configuration Reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)
- [Privacy](#privacy)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Fork It, Make It Yours](#fork-it-make-it-yours)
- [Support Argus](#support-argus)

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

## Quick Start

1. **Get an API key** — click any provider link in Settings, create a free account, generate a key (~2 minutes)
2. **Install Argus** — [Firefox Add-ons](https://addons.mozilla.org) or load from source
3. **Configure** — click the Argus icon → gear icon → paste your API key → Save
4. **Analyze** — navigate to any page, click Argus, choose a preset, hit "Analyze This Page"

### Getting an API Key

You only need **one key** to get started. Most providers offer generous free tiers — many users spend less than $1/month. 

| Provider | Get Your Key | Free Tier |
|----------|-------------|-----------|
| xAI (Grok) | [console.x.ai](https://console.x.ai) | **$25/month FREE** API credits |
| Google (Gemini) | [aistudio.google.com](https://aistudio.google.com/apikey) | Generous free tier |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Pay-as-you-go (low cost) |
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) | **$5 free** credit on signup |
| Custom | Your endpoint | Bring your own |

**How to get a key (takes ~2 minutes):**

1. Click any link above and create a free account
2. Navigate to the API keys section (usually under Settings or API)
3. Click "Create new key" and copy it
4. Open Argus Console → **Providers** tab → paste it in

> **Why your own keys?** Your keys stay on your machine — Argus never sees, stores, or transmits them anywhere except directly to the provider you choose. No accounts, no tracking, no data collection. You're in full control.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G` | Open Argus popup |
| `Ctrl+Shift+S` | Quick summary of current page |
| `Ctrl+Shift+A` | Analyze selected text |

To customize: `about:addons` → Gear icon → **Manage Extension Shortcuts**.

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

## Core Analysis

- **Fully editable presets** — summary, key points, sentiment, fact-check, entity extraction, critical analysis, contradiction scan, research brief, and 20+ more built-in, all fully customizable
- **Compare multiple providers side-by-side** in one view
- **Real-time streaming** with markdown rendering + built-in follow-up chat (switch models mid-conversation, keep full context)
- **One-click re-analyze** with a different preset or provider
- **PDF content extraction** — automatically extracts and analyzes text from PDF documents (local and remote) via Mozilla's pdf.js
- **Selection analysis** — highlight text and analyze just that selection
- **Multi-page analysis** — analyze multiple open tabs together into a synthesized report

### How to Analyze a Page

1. Navigate to any webpage
2. Click the Argus icon in your toolbar (or press `Ctrl+Shift+G`)
3. Select an analysis type from the dropdown (Summary, Fact-Check, etc.)
4. Click **"Analyze This Page"**
5. Results open in a new tab with streaming output

You can override the default provider for any individual analysis using the provider dropdown.

### Follow-Up Questions

After an analysis completes, a follow-up input appears at the bottom of the results page. Type a question and the AI will answer with the full context of the original analysis. You can **switch providers between follow-ups** — for example, get an initial analysis from Grok, then ask Claude for a different perspective.

### Selection Analysis

1. Highlight any text on a page
2. Open Argus — it auto-detects your selection
3. Click **"Analyze Selection"**

Or use `Ctrl+Shift+A` to instantly analyze selected text without opening the popup.

### Compare Providers

Run the same analysis across multiple AI providers side-by-side:

1. Open Argus and click the **Compare** mode button (two columns icon)
2. Check which providers to compare (you need API keys configured for each)
3. Click **"Compare Providers"**
4. Each provider's result opens in its own tab

### Multi-Page Analysis

Analyze content from multiple open tabs together:

1. Open several tabs you want to analyze
2. Open Argus and click the **Multi-Page** mode button (monitor icon)
3. Check/uncheck the tabs to include
4. Click **"Analyze Selected Tabs"**

Selecting the **Research Report** preset automatically activates multi-page mode and produces a structured report with source citations.

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

### Custom Presets

Create your own presets in the Console → **Prompts** tab:

1. Click **"+ New Preset"** and give it a name
2. Optionally set a **Preferred Provider** — this preset will always use that provider
3. Write your system prompt (role/behavior instruction) and user prompt (what to do with the page)
4. The preset appears in the popup dropdown, shown as `Preset Name → Provider` if bound

All custom presets automatically appear in the right-click context menu too.

### Prompt Variables

Use these placeholders in custom presets — they're replaced with actual values at analysis time:

| Variable | Replaced with |
|----------|--------------|
| `{title}` | Page title |
| `{url}` | Page URL |
| `{domain}` | Domain name |
| `{date}` | Current date |
| `{wordcount}` | Word count of page content |

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

### How to Bookmark

- **From the popup:** Click the bookmark icon next to the Analyze button
- **From results:** Click the bookmark icon in the results toolbar after an analysis
- **From context menu:** Right-click any page → Argus → Bookmark with AI Tags

### Analyzing Bookmarks

1. Go to the **Bookmarks** tab in Console
2. Click **"Select"** in the toolbar
3. Check the bookmarks you want to analyze together
4. Click **"Analyze Selected"**
5. A research report is generated with cross-references and source citations

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

### Creating a Project

1. Go to the **Projects** tab and click **"+ New Project"**
2. Give it a name, optional description, and pick a color
3. Click **Save**

### Adding Items

- **From results page:** Click **"Save to Project"** in the toolbar after any analysis
- **From bookmarks:** Click **"+ Project"** on any bookmark card
- **Notes & URLs:** Add freeform notes or URLs directly from the project view

### OSINT Project Tools

Projects include specialized OSINT tools for deeper investigation:

- **Entity Extraction** — batch extract entities across all project items
- **Connection Graph** — force-directed graph of entity relationships with drag/zoom/pan and PNG export
- **Timeline** — chronological event visualization with date range filters and markdown export
- **Investigation Report** — AI-generated structured intelligence brief
- **Dashboard** — at-a-glance widgets with activity charts, entity breakdown, co-occurrence heatmap, trend alerts, and auto-generated digests
- **Skeleton View** — structural overview of everything connected to the project: items, feeds, bookmarks, monitors, entities, and keywords

---

## Page Monitoring

- Monitor any page for content changes with configurable check intervals
- AI-powered change summaries with side-by-side diff comparison
- Full HTML snapshots stored in OPFS (Origin Private File System) with optional screenshots
- Auto-expiry settings (12h to indefinite)
- Snapshot-and-analyze: capture a page and run analysis in one step

### How to Set Up a Monitor

**Quick (from popup):**
1. Navigate to the page you want to monitor
2. Open Argus and click the **eye icon** next to the Analyze button
3. The page is now monitored hourly with AI change summaries

**Advanced (from Console):**
1. Go to the **Monitors** tab
2. Enter a URL and set the check interval (15 min to daily)
3. Add an optional label
4. Toggle **AI Change Analysis** for smart diff summaries
5. Toggle **Auto-open on change** to open the page when changes are detected
6. Set an auto-expiry: 12 hours, 1 day, 3 days, 7 days, 30 days, or indefinite

### Viewing Changes

When a change is detected, you get a browser notification. Click any monitor's **"History"** button to see a timeline of all detected changes with before/after comparisons. Use the **Diff view** tab to compare any two snapshots side-by-side.

---

## RSS Feed Reader

- Subscribe to feeds or paste any page URL — Argus auto-discovers the feed
- AI-summarized entries using your configured provider
- Bridge feeds to page monitors for unified tracking
- Keyword routes: automatically tag, file, or act on entries matching your watchlist
- Dedicated full-page feed reader view

### How to Add a Feed

1. Go to the **Feeds** tab in Console
2. Paste a feed URL — or paste any page URL and Argus will try to auto-discover the feed
3. Set the check interval and optionally enable **AI Summarize** for automatic summaries
4. Enable **Bridge to Page Monitor** to link feed updates to your monitor dashboard

---

## Archive & Paywall Bypass

- **Archive.is / Wayback Machine integration** — auto-redirect paywalled sites, on-demand archive checks from popup or context menu
- Customizable trouble list with 24 common news sites pre-loaded
- Toggle redirect on/off from the popup
- Save pages to archive directly, check archive availability

### How to Set Up

1. Go to Console → **Redirects** tab
2. Toggle **Enable Archive Redirect**
3. Edit the Trouble List — add or remove sites (one per line)
4. Click **Save**

When enabled, navigating to any listed domain instantly redirects through archive.is. A default list of 24 common paywalled sites is included.

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
| Keyword Watchlist | Track keywords across monitors and feeds with regex support and browser notifications |

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

### Managing the Graph

The Knowledge Graph card is on the **OSINT** tab. From there you can:

- **Open Global Graph** — interactive force-directed visualization of all entities and connections
- **Run Inference** — manually trigger inference rules to discover new relationships
- **Pending Merges** — review ambiguous entity matches flagged for human review
- **Clear Graph** — reset the knowledge graph entirely

### Entity Dictionaries

Customize entity classification in Console → **OSINT** tab → **Entity Dictionaries**:

| Dictionary | Purpose |
|-----------|---------|
| Noise Entities | Phrases to always exclude (e.g., "Read More", "Subscribe Now") |
| Known Locations | Multi-word places (e.g., "New York City", "Silicon Valley") |
| Known Organizations | Companies and institutions (e.g., "Federal Reserve", "Reuters") |
| Not-Person Words | Words that never start a person name (e.g., "Download", "Premium") |
| Valid First Names | Real first names across cultures for person detection |

To fix misclassified entities: add entries to the appropriate dictionary, then click **Re-type All Entities**.

---

## Source-Aware Pipelines

Argus detects the type of page you're analyzing and automatically runs a specialized extraction pipeline in the background.

| Source Type | Detection | What It Extracts |
|-------------|-----------|------------------|
| Wikipedia | Wikipedia URLs | Structured profile, infobox data, related entities, categories |
| News Article | Major news domains + byline heuristics | Claims with evidence levels, bias indicators, source quality score |
| Classifieds | Marketplace URLs + price/listing heuristics | Listing data, seller info, scam risk analysis |
| Research | Academic URLs (arxiv, scholar, etc.) | Claims, knowledge coverage, methodology notes |

Pipeline results appear in a collapsible **"Source Insights"** panel below your analysis results. Extracted entities are fed into the Knowledge Graph automatically.

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

### How to Create an Automation

1. Go to Console → **Automation** tab → click **"+ New Automation"**
2. Give it a name (e.g., "News Intel Pipeline")
3. Add **triggers** — URL patterns that auto-fire on page load
4. Add **steps** — each step runs in sequence, passing output forward
5. Click **Save Automation**

### Example: OSINT News Pipeline

```
Name: "OSINT News Pipeline"
Triggers: *://reuters.com/*, *://apnews.com/*

Steps:
1. Analyze (Preset: Summary)
2. Custom Prompt:
   System: "You are an OSINT analyst."
   Prompt: "Given this analysis, extract intelligence
   indicators: named sources, unverified claims,
   geopolitical signals, and follow-up leads."
   Input: Previous step output
3. Extract Entities
4. Add to Project: "News Intel"
   Tags: auto, news, {automationName}
```

---

## Terminal

Built-in terminal emulator for connecting to remote shells via WebSocket. Powered by xterm.js.

> **Important:** Argus Terminal does not create SSH connections on its own. Browsers cannot open raw TCP/SSH sockets — this is a browser security restriction, not an Argus limitation. You need a **WebSocket relay server** running on the target machine (or an intermediary) that bridges WebSocket connections to a shell or SSH session. Without this server component, the terminal has nothing to connect to.

### Supported Protocols

| Protocol | What It Does | Server Requirement |
|----------|-------------|-------------------|
| **ttyd / gotty** | Terminal over WebSocket — simplest setup | Install `ttyd` on your server |
| **Raw WebSocket** | Plain bidirectional WebSocket relay | Run `websockify` or similar bridge |
| **SSH Proxy** | WebSocket-to-SSH proxy (webssh2-compatible) | Deploy `webssh2` on a relay server |

### How to Set Up: ttyd (Recommended)

ttyd is the easiest option — it exposes a shell process over WebSocket with one command.

**1. Install ttyd on your server:**

```bash
# Debian/Ubuntu
sudo apt install ttyd

# macOS
brew install ttyd

# From source or binary
# https://github.com/tsl0922/ttyd
```

**2. Start ttyd:**

```bash
# Basic — exposes bash on port 7681
ttyd -W -p 7681 bash

# SSH to another host through ttyd
ttyd -W -p 7681 ssh user@targethost

# With basic auth protection
ttyd -W -p 7681 -c username:password bash

# With a custom window title
ttyd -W -p 7681 -t titleFixed=myserver bash
```

**3. Connect from Argus:**

1. Open the Terminal page (ribbon nav or popup icon)
2. Open the Connect panel (click the edge tab on the left)
3. Protocol: **ttyd / gotty**
4. URL: `ws://yourserver:7681/ws` (or `wss://` for TLS)
5. Click **Connect**

> **The `-W` flag is important** — it enables writable mode so you can type into the terminal, not just watch output.

### How to Set Up: Raw WebSocket (websockify)

Use this if you want to bridge any TCP service (including SSH) over WebSocket.

```bash
# Install websockify
pip install websockify

# Bridge WebSocket port 2222 to local SSH port 22
websockify 2222 localhost:22
```

Then connect in Argus with protocol **Raw WebSocket**, URL `ws://yourserver:2222`, and fill in the SSH host/username/password fields.

### How to Set Up: SSH Proxy (webssh2)

Use this for a full SSH proxy that handles authentication server-side.

```bash
# Install webssh2
npm install -g webssh2

# Start the proxy
webssh2 --port 2222
```

Then connect in Argus with protocol **SSH Proxy**, URL `ws://yourserver:2222/ssh/host/TARGET`, and provide SSH credentials in the form.

### Why Doesn't It Just Connect?

If you click Connect and nothing happens, it's because there is no WebSocket relay server running at the URL you entered. The terminal needs a server-side component because:

- **Browsers block raw sockets** — JavaScript in a browser cannot open TCP or SSH connections directly. This is a security feature of all modern browsers, not something Argus can work around.
- **WebSocket is the bridge** — a relay server (like ttyd) accepts WebSocket connections from the browser and forwards them to a shell or SSH session on the server side.
- **No relay = no connection** — without installing and starting one of the relay servers above, the terminal has nothing to connect to.

### Terminal Features

- Full xterm.js terminal emulator with 256-color support
- Auto-resize to fit the window
- Clickable URLs in terminal output
- Floating, draggable connect panel (like other Argus panels)
- Saved sessions — save connection details for quick reconnect (credentials are never saved)
- Multiple protocol support with per-protocol setup guides

### Security Note

- Credentials entered in the terminal connect form are held in browser memory only — never saved to disk
- Saved sessions store host/URL/protocol only, never passwords or keys
- For production use, always use `wss://` (WebSocket over TLS) instead of `ws://`
- If you enable Argus Vault, saved session metadata is encrypted at rest

---

## Vault Encryption

Argus Vault adds a passcode/PIN lock screen and AES-256-GCM encryption to protect your sensitive data at rest.

### What It Protects

When Vault is enabled, the following are encrypted whenever Argus is locked (on browser restart, manual lock, or screen lock):

- **AI provider API keys** — your xAI, OpenAI, Anthropic, Google, and custom provider keys
- **Cloud provider credentials** — Google Drive, Dropbox, WebDAV, S3, GitHub tokens and passwords
- **SSH session data** — saved terminal connection details
- **Paste service credentials** — Gist, Pastebin, PrivateBin tokens

Without the correct passcode, this data cannot be read — not by other extensions, not by someone with access to your Firefox profile, and not from a backup file.

### How It Works

- Uses **PBKDF2** (100,000 iterations, SHA-256) to derive an encryption key from your passcode
- Encrypts with **AES-256-GCM** via the Web Crypto API
- The derived key is held in memory only while Argus is unlocked — it is never written to disk
- On browser restart, the key is gone — you must re-enter your passcode
- Encrypted data is stored as `_vault_*` keys in browser storage; plaintext copies are restored on unlock and removed on lock

### How to Set Up Vault

1. Open Console → **Settings** tab → **Security** card
2. Choose your lock type:
   - **4-digit PIN** — fast, good for casual protection
   - **6-digit PIN** — stronger, still quick to enter
   - **Password** — strongest, any length
3. Enter and confirm your passcode
4. Click **Enable Vault**

Your sensitive data is immediately encrypted. A lock screen will appear on all Argus pages whenever the vault is locked.

### Lock Screen

When Vault is enabled and locked:

- All Argus pages (Console, Chat, Workbench, Draft Pad, Terminal, etc.) show a full-screen lock overlay
- The popup shows a compact lock screen
- Enter your PIN or password to unlock — PIN auto-submits on the last digit
- Shake animation on incorrect entry
- Lock screen is injected automatically — no per-page configuration needed

### Managing Vault

From Console → **Settings** → **Security**:

- **Lock Now** — immediately lock and clear sensitive data from memory
- **Change Passcode** — change your PIN/password (must be unlocked first)
- **Remove Vault** — decrypt all data and remove the lock (must be unlocked first)

### Vault + Cloud Backup

When you back up to cloud storage, encrypted `_vault_*` keys are included in the backup. This means:

- Your backup contains encrypted credentials that cannot be read without your passcode
- On restore, the vault config is restored — you enter your passcode to unlock
- This allows you to **wipe your local data**, store it encrypted in the cloud, and **restore it later** with full privacy
- Even if someone accesses your cloud backup, they cannot read your API keys or credentials without the passcode

---

## Cloud Backup & Storage

### Backup Providers
| Provider | Auth | Notes |
|----------|------|-------|
| Google Drive | OAuth2 (your own GCP Client ID) | `drive.file` scope only |
| Dropbox | OAuth2 (your own App Key) | App folder access |
| WebDAV | URL + credentials | Nextcloud, ownCloud, any WebDAV server |
| S3-Compatible | Access Key + Secret | AWS S3, MinIO, Backblaze B2 |
| GitHub Repo | Personal Access Token | Commits individual JSON files for diffable history |

### What Gets Backed Up
Projects, bookmarks, monitors, feeds + entries, analysis history, knowledge graph (nodes + edges), watchlist, automations, and settings. Compressed as `.zip` with manifest. API keys are excluded by default for security (unless encrypted by Vault). Scheduled automatic backups or one-click manual backup.

### How to Set Up Cloud Backup

1. Go to Console → **Providers** tab → **Data Providers** section
2. Select a provider tab (Google Drive, Dropbox, WebDAV, S3, GitHub)
3. Follow the built-in setup guide for that provider
4. Enter your credentials and click **Connect** (or **Test Connection** for WebDAV/S3/GitHub)
5. Go to **Settings** tab → **Backup & Restore**
6. Click **Backup Now** for a one-time backup, or set a schedule (every 6h, 12h, 24h, 48h, or weekly)

### Backup Controls

- **Backup Now** — creates a ZIP and uploads to all connected providers
- **Download Local Backup** — saves the ZIP to your computer (no cloud needed)
- **Restore from File** — restore from a local ZIP backup
- **Restore from Cloud** — select a provider, list available backups, restore any one
- **Auto-backup** — schedule automatic backups on an interval

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

### Extended Thinking (Claude)

Enable in **Settings** tab. Shows Claude's internal reasoning process before the final answer. Set a thinking budget to control how many tokens Claude uses for reasoning (1,000–100,000).

### Multi-Agent Swarm (Grok)

When using xAI's Grok 4.20 Multi-Agent model, Argus dispatches your query to multiple AI agents working in parallel:

| Effort | Agents | Use Case |
|--------|--------|----------|
| Low | 4 agents | Quick responses |
| Medium | 4 agents | Balanced depth |
| High | 16 agents | Deep analysis |
| Extra High | 16 agents | Exhaustive research |

### Advanced Prompts

Every AI prompt across Argus is fully customizable. Open Console → **Prompts** tab → **Advanced Prompts** to edit any prompt's system instruction or user prompt. Groups include Dashboard Reports, Monitors, RSS Feeds, and Source Pipelines. Modified prompts are marked with an asterisk (*) in the dropdown.

---

## Resources Hub

Built-in curated link library with categories including OSINT tools, online IDEs & terminals, PowerShell & Bash consoles, security labs & sandboxes, investigative resources, and more. Shows your current public IP, supports update checking, and is fully customizable with your own links.

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
| Terminal | Remote shell via WebSocket |

Each app opens as a single-instance tab — clicking the nav icon focuses an existing tab rather than opening duplicates. Tabs are drag-reorderable and your order is saved. Badge counts show live data for bookmarks, projects, monitors, feeds, KG entities, and automations.

You can also set all Argus pages as your Firefox homepage tabs.

---

## How-To Guides

### How to Set Up Auto-Analyze

Auto-analyze pages when you visit them:

- **Quick setup:** Navigate to any page, open Argus, click the **Auto** button (lightning bolt). All pages on that domain will be auto-analyzed.
- **Advanced:** Use Console → **Automation** tab to create URL pattern rules with custom presets, providers, and delays.

### How to Share Preset Packs

Custom presets are stored in `browser.storage.local` under the `customPresets` key:

1. Export your presets from the **Prompts** tab using the **Export Presets** button, or use the browser console: `browser.storage.local.get("customPresets")`
2. Save the JSON to a `.json` file (e.g., `argus-presets-osint.json`)
3. Share the file — recipients can import via **Import Presets**

Create specialized packs — OSINT, journalism, research, legal — and share with your team.

### How to Customize Bookmark Tagging

Customize how AI tags your bookmarks in Console → **Prompts** tab → **"Bookmark Tagging Prompt"**. The prompt must instruct the AI to return JSON with `tags`, `category`, `summary`, and `readingTime`.

### How to Use the Dashboard

Each project has an interactive dashboard:

- **Stats Overview** — total items, entities, relationships, and recent changes
- **Activity Chart** — 30-day item collection histogram
- **Entity Breakdown** — visual bars showing entity types
- **Co-occurrence Heatmap** — matrix showing which top entities appear together
- **Trend Alerts** — mention spikes, new entities, and graph growth indicators
- **Auto-Reports** — generate Executive Summary, Knowledge Gaps, Contradictions, Timeline Highlights on demand
- **Scheduled Digests** — set Daily or Weekly digests per project

### How to Wipe Everything Before Uninstalling

Firefox does not automatically clear extension data on uninstall. Before removing Argus:

1. Open Console → **Settings** tab → **Storage Management**
2. Click **"Wipe Everything"**
3. Confirm twice (this is permanent)
4. All data is deleted: IndexedDB stores, OPFS snapshots, browser storage

If you have cloud backups, your data is safe there and can be restored in a new install.

---

## Configuration Reference

### General Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Max Response Tokens | 2048 | Maximum tokens in AI response (256–16,384) |
| Max Input Characters | 100,000 | How much page text to send (1,000–500,000) |
| Temperature | 0.3 | Creativity level (0 = focused, 1 = creative) |
| Extended Thinking | Off | Show Claude's reasoning process (Claude only) |
| Thinking Budget | 10,000 | Tokens for Claude's thinking (1,000–100,000) |
| Reasoning Effort | Medium | Swarm agent count and depth (Grok 4.20 only) |
| Response Language | Auto-detect | Language for AI responses |
| Max History Size | 200 | Number of analysis entries to retain |

---

## Troubleshooting

### "No API key configured"

Go to Console → **Providers** tab and paste your API key for the provider you want to use. For the Custom provider, you need at minimum a Base URL configured.

### "Failed to start analysis"

The page content couldn't be extracted. Some pages (browser internal pages like `about:*` or heavily JavaScript-rendered pages) may not work. Try a different page.

### PDF files not working (file:// permission)

Argus can analyze PDFs from web URLs automatically. For **downloaded/local PDFs** (`file://` URLs), Firefox requires extra permission:

1. Go to **about:addons**
2. Click on **Argus**
3. Go to the **Permissions** tab
4. Enable **"Access your data for all websites"**

### API errors (401, 403, 429)

- **401/403:** Your API key is invalid or expired. Generate a new one from your provider's console.
- **429:** Rate limited. Wait a moment and try again, or switch to a different provider.

### Follow-up says "session expired"

Conversation history clears when Firefox restarts or the extension reloads. Start a new analysis to create a fresh session.

### Monitors not checking

Firefox must be running for monitors to check. Alarms may be delayed if Firefox was recently started.

### Custom provider not working

Verify that the Base URL is correct and supports the `/v1/chat/completions` API format. Check that the model name matches exactly what the endpoint expects.

### Terminal won't connect

The terminal requires a WebSocket relay server running on the target machine. See the [Terminal](#terminal) section for setup instructions. Common issues:

- **No relay server running** — install and start `ttyd`, `websockify`, or `webssh2` on your server
- **Wrong URL** — for ttyd, the URL is typically `ws://host:7681/ws` (note the `/ws` path)
- **Firewall blocking** — ensure the WebSocket port is open
- **Mixed content** — if Argus is loaded over HTTPS (moz-extension://), some browsers block `ws://` connections. Use `wss://` with TLS instead

### Extension shortcuts not working

Another extension may be using the same shortcut. Go to **about:addons** → Gear icon → **Manage Extension Shortcuts** to check for conflicts.

---

## Privacy

- **API keys are stored locally** in your browser's extension storage — never transmitted anywhere except directly to the AI provider you select
- **Optional encryption** — enable Vault to encrypt all credentials with AES-256-GCM, locked behind your PIN or password
- **No telemetry or analytics** — Argus does not phone home, track usage, or report anything to anyone
- **No data collection** — explicitly declared in the extension manifest under `data_collection_permissions`
- **No accounts required** — there is nothing to sign up for because there is no service behind this extension
- **Cloud backup connects only to providers you configure** using your own credentials — Argus has no servers and never sees your backup data
- **Fully auditable** — every line of code is vanilla JavaScript, no obfuscated bundles
- **Wipe Everything** in Settings permanently deletes all local data (IndexedDB, OPFS snapshots, browser storage) — use before uninstalling, as Firefox does not auto-clear extension data

The only network requests Argus makes are to: AI provider APIs you configure, RSS feed URLs you subscribe to, archive redirect URLs, RDAP (rdap.org) for whois lookups, Google DNS (dns.google) for DNS records, the Wayback Machine API (archive.org), OpenStreetMap Nominatim (geocoding), and cloud/paste providers you configure. That's it.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

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
├── ssh/                         # Terminal — WebSocket shell client (xterm.js)
├── shared/                      # Ribbon navigation bar + shared UI + lock screen
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
│   ├── argus-vault.js           # Vault encryption (PBKDF2 + AES-256-GCM)
│   ├── argus-structured.js      # Structured output parsing
│   ├── email-share.js           # Email+ compose with contact picker
│   ├── export-utils.js          # Export helpers
│   ├── intelligence-viewer.js   # Analysis result renderer
│   ├── xterm.js                 # xterm.js terminal emulator (v5.5.0)
│   ├── xterm.css                # xterm.js styles
│   ├── xterm-addon-fit.js       # Terminal auto-resize
│   ├── xterm-addon-web-links.js # Clickable URLs in terminal
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

## Fork It, Make It Yours

Argus is fully open source. Clone it, rename it, rip it apart and build something new — no restrictions.

The entire extension is vanilla JavaScript with zero build dependencies. No frameworks, no bundlers, no transpilers — just open the files and edit.

1. Fork this repo
2. Update `manifest.json` — change the name, description, and `gecko.id`
3. Swap the icons in `icons/` and the watermark
4. Customize presets, add providers, change the UI
5. Submit to [addons.mozilla.org](https://addons.mozilla.org) or distribute the `.zip` directly

> **Why open source matters here:** You're handing this extension your API keys and your browsing content. You *should* be able to see exactly what it does with them. Argus is transparent by design — no obfuscated code, no minified bundles, no hidden network calls. What you see in the repo is exactly what runs in your browser.

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

## About

Argus is named after the all-seeing giant of Greek mythology — a guardian with a hundred eyes, ever-watchful. The peacock eye motif in the icon design ties back to the legend — when Argus Panoptes was slain, Hera placed his hundred eyes on the tail of the peacock as a tribute to her faithful guardian.

---

## License

MIT — From quick paywall bypass → daily feed digest → multi-year investigation brain — Argus watches, remembers, connects the dots, and works for you.

*Like its namesake, Argus sees every angle — so you don't have to.*
