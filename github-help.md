<a id="help-top"></a>

# Argus Help

Jump to:
- [Getting Started](#help-getting-started)
- [Basic Usage](#help-basic-usage)
- [Shortcuts](#help-shortcuts)
- [Analysis Modes](#help-analysis-modes)
- [Presets](#help-presets)
- [Bookmarks](#help-bookmarks)
- [Projects](#help-projects)
- [Monitoring](#help-monitoring)
- [RSS Feeds](#help-feeds)
- [Redirects](#help-archive)
- [OSINT Tools](#help-osint)
- [Knowledge Graph](#help-kg)
- [Source Pipelines](#help-pipelines)
- [Dashboard & Digests](#help-dashboard)
- [Provider Features](#help-providers)
- [Exporting](#help-export)
- [Config Reference](#help-config)
- [Privacy](#help-privacy)
- [Troubleshooting](#help-troubleshooting)
- [Open Source](#help-opensource)
- [About](#help-about)

---

<a id="help-getting-started"></a>
## Getting Started

### What is Argus?
Argus is a browser extension that lets you run AI-powered analysis on any webpage using your choice of provider -- xAI (Grok), OpenAI (GPT), Anthropic (Claude), Google (Gemini), or any custom OpenAI-compatible endpoint. Beyond analysis, Argus includes built-in OSINT tools (metadata extraction, link mapping, whois/DNS lookups, Wayback Machine checks), fully customizable prompts, and support for custom providers like Ollama, LM Studio, and vLLM. Results stream in real-time, and you can ask follow-up questions, compare providers, bookmark pages with AI tags, monitor pages for changes, and more. Or clone our repo at https://github.com/n3r4-life/argus360.git and add your own new functionality.

### Step 1: Get an API Key
Argus connects directly to AI providers using **your own API keys**. This means no middleman, no subscription, and you only pay for what you use. Most providers offer generous free tiers -- many users spend less than $1/month.

You only need **one key** to get started. Add more later if you want to compare results across providers.

| Provider | Get Your Key | Free Tier |
| --- | --- | --- |
| xAI (Grok) | https://console.x.ai | $25/month free API credits |
| Google (Gemini) | https://aistudio.google.com/apikey | Generous free tier |
| OpenAI | https://platform.openai.com/api-keys | Pay-as-you-go (low cost) |
| Anthropic (Claude) | https://console.anthropic.com | $5 free credit on signup |
| Custom (OpenAI-compatible) | Your endpoint | Bring your own |

**How to get a key (takes ~2 minutes):**
1. Click any link above and create a free account
2. Navigate to the API keys section (usually under Settings or API)
3. Click "Create new key" and copy it
4. Go to the **Providers** tab in this console and paste it in

**Why your own keys?** Your keys stay on your machine -- Argus never sees, stores, or transmits them anywhere except directly to the provider you choose. No accounts, no tracking, no data collection. You're in full control.

### Step 2: Configure Argus
1. Click the Argus icon in your toolbar (or press <kbd>Ctrl+Shift+G</kbd>)
2. Click the **gear icon** to open Quick Settings
3. Select your provider, paste your API key, choose a model, and click **Save Settings**

For full configuration, use this Console -- the **Providers** tab lets you configure all five built-in providers plus a Custom (OpenAI-compatible) provider, and the **Prompts** tab lets you create custom presets, and the **Settings** tab lets you tweak response parameters.

[Back to top](#help-top)

---

<a id="help-basic-usage"></a>
## Basic Usage

### Analyzing a Page
1. Navigate to any webpage
2. Click the Argus icon in your toolbar (or press <kbd>Ctrl+Shift+G</kbd>)
3. Select an analysis type from the dropdown (Summary, Fact-Check, etc.)
4. Click **"Analyze This Page"**
5. Results open in a new tab with streaming output

You can override the default provider for any individual analysis using the provider dropdown next to the analysis type.

### Follow-Up Questions
After an analysis completes, a follow-up input appears at the bottom of the results page. Type a question and the AI will answer with the full context of the original analysis. You can **switch providers between follow-ups** -- for example, get an initial analysis from Grok, then ask Claude for a different perspective using the provider dropdown next to the input.

### Selection Analysis
1. Highlight any text on a page
2. Open Argus -- it auto-detects your selection
3. Click **"Analyze Selection"**

Or use <kbd>Ctrl+Shift+A</kbd> to instantly analyze selected text without opening the popup.

### Context Menu (Right-Click)
Right-click anywhere on a page to access Argus directly -- no popup needed.
- **Bookmark with AI Tags** -- instant smart bookmark with AI-generated tags, category, and summary
- Run any built-in or custom analysis preset directly (Summary, Fact-Check, Late Night Recap, etc.)

**Selected text:** Highlight text on any page, then right-click -> **Argus** -> choose a preset. Only the selected text is analyzed, not the full page -- perfect for checking a specific quote, claim, or paragraph.

All presets you create automatically appear in the context menu.

### OSINT Quick Tools
The popup also includes quick-access OSINT buttons -- **Metadata**, **Links**, and **Whois** -- that run instantly on the current page without requiring an AI provider.

[Back to top](#help-top)

---

<a id="help-shortcuts"></a>
## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl+Shift+G</kbd> | Open Argus popup |
| <kbd>Ctrl+Shift+S</kbd> | Quick summary of current page |
| <kbd>Ctrl+Shift+A</kbd> | Analyze selected text |

To customize these shortcuts: go to **about:addons** -> Gear icon -> **Manage Extension Shortcuts**.

[Back to top](#help-top)

---

<a id="help-analysis-modes"></a>
## Analysis Modes

### Compare Providers
Run the same analysis across multiple AI providers side-by-side.
1. Open Argus and click the **Compare** mode button (two columns icon)
2. Check which providers to compare (you need API keys configured for each)
3. Click **"Compare Providers"**
4. Each provider's result opens in its own tab

### Multi-Page Analysis
Analyze content from multiple open tabs together in a single request.
1. Open several tabs you want to analyze
2. Open Argus and click the **Multi-Page** mode button (monitor icon)
3. Check/uncheck the tabs you want to include
4. Click **"Analyze Selected Tabs"**

Selecting the **Research Report** preset automatically activates multi-page mode and produces a structured report with source citations.

### Auto-Analyze
Set up rules to automatically analyze pages when you visit them.

**Quick setup:** Navigate to any page, open Argus, and click the **Auto** button (lightning bolt). All pages on that domain will be auto-analyzed.

**Advanced:** Use the **Automation** tab in this console to create URL pattern rules with custom presets, providers, and delays.

[Back to top](#help-top)

---

<a id="help-presets"></a>
## Built-in Analysis Presets

| Preset | What It Does |
| --- | --- |
| **Summary** | Concise overview of the page content |
| **Sentiment Analysis** | Tone, bias, and emotional undertones |
| **Fact-Check** | Identifies claims and assesses verifiability |
| **Key Points** | Structured bullet-point extraction |
| **ELI5** | Explains content in simple, everyday language |
| **Critical Analysis** | Examines arguments, strengths, weaknesses, fallacies |
| **Action Items** | Extracts tasks and next steps as a checklist |
| **Research Report** | Multi-source synthesis with citations and cross-references |
| **Late Night Recap** | Sharp, witty comedic editorial recap of the page content |
| **Entity Extraction (OSINT)** | Structured extraction of people, orgs, locations, dates, amounts, contacts, claims |
| **Source Credibility** | Credibility scoring (1-10) with sourcing, bias, and verification assessment |
| **Person/Org Profile** | Structured intelligence profile from page content |

All presets -- both built-in and custom -- are fully editable. You can modify their system prompts, user prompts, and preferred providers to suit your workflow.

### Custom Presets
Create your own presets in the **Prompts** tab under **Analysis Prompts**.
1. Click **"+ New Preset"** and give it a name
2. Optionally set a **Preferred Provider** -- this preset will always use that provider
3. Write your system prompt (role/behavior instruction) and user prompt (what to do with the page)
4. The preset appears in the popup dropdown, shown as `Preset Name -> Provider` if bound

### Sharing Preset Packs
Custom presets are stored in `browser.storage.local` under the `customPresets` key. To share a pack of presets:
1. Export your presets from the **Prompts** tab using the **Export Presets** button (if available), or use the browser console: `browser.storage.local.get("customPresets")`
2. Save the JSON object to a `.json` file (e.g., `argus-presets-osint.json`)
3. Share the file -- recipients can import it via **Import Presets** or paste the JSON into their storage

Each preset in the JSON has a `label`, `system` (system prompt), `prompt` (user prompt), and optional `provider` (preferred provider key). You can create specialized packs -- e.g., an OSINT pack, a journalism pack, a research pack -- and share them with your team.

### Prompt Variables
Use these placeholders in custom presets -- they're replaced with actual values at analysis time:

| Variable | Replaced With |
| --- | --- |
| `{title}` | Page title |
| `{url}` | Page URL |
| `{domain}` | Domain name |
| `{date}` | Current date |
| `{wordcount}` | Word count of page content |

[Back to top](#help-top)

---

<a id="help-bookmarks"></a>
## Smart Bookmarks

### Bookmarking Pages
Bookmark any page with AI-generated tags, categories, and a summary.
- **From the popup:** Click the bookmark icon next to the Analyze button
- **From results:** Click the bookmark icon in the results toolbar after an analysis
- **From context menu:** Right-click any page -> Argus -> Bookmark with AI Tags

### Managing Bookmarks
Open the **Bookmarks** tab in this console to browse, search, filter, and edit your bookmarks. Use the sidebar to filter by category or tag.

### Analyzing Bookmarks
Synthesize multiple bookmarks into a research report:
1. Go to the **Bookmarks** tab
2. Click **"Select"** in the toolbar
3. Check the bookmarks you want to analyze together
4. Click **"Analyze Selected"**
5. A research report is generated with cross-references and source citations

### Custom Tagging Prompt
You can customize how AI tags your bookmarks in the **Prompts** tab under **"Bookmark Tagging Prompt"**. This lets you tailor tags to your research focus. The prompt must instruct the AI to return JSON with `tags`, `category`, `summary`, and `readingTime`.

**Example -- OSINT & source credibility focus:**
```
Analyze this webpage and generate smart metadata for bookmarking.

Return JSON with this exact structure:
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "one-word-category",
  "summary": "One sentence summary of the page content.",
  "readingTime": "X min"
}

Rules:
- tags: 5-10 lowercase tags. Include:
  - Topic tags (e.g., "surveillance-reform", "supply-chain-attack")
  - Source-type tags (e.g., "primary-source", "opinion", "press-release", "leaked-document")
  - Credibility tags (e.g., "verified", "unverified", "anonymous-sources", "single-source")
  - Bias tags where applicable (e.g., "left-leaning", "right-leaning", "industry-funded")
  - OSINT relevance (e.g., "osint-lead", "pivot-point", "corroborating")
- category: One of "intel", "news", "disinfo", "policy", "legal", "finance", "cyber", "geopolitics", "military", "tech", "reference", "other".
- summary: A concise one-sentence intelligence summary (max 200 chars). Lead with the key finding, not the headline.
- readingTime: Estimated reading time.
```

[Back to top](#help-top)

---

<a id="help-projects"></a>
## Projects

Projects let you organize your research into folders. Collect analyses, bookmarks, notes, and URLs in one place.

### Creating a Project
1. Go to the **Projects** tab and click **"+ New Project"**
2. Give it a name, optional description, and pick a color
3. Click **Save**

### Adding Items
- **From results page:** Click **"Save to Project"** in the toolbar after any analysis
- **From bookmarks:** Click **"+ Project"** on any bookmark card
- **Notes & URLs:** Add freeform notes or URLs directly from the project view

### Managing Projects
Star projects to pin them to the top. Add notes to individual items. Export a single project or all projects as JSON.

### OSINT Project Tools
Projects include specialized OSINT tools for deeper investigation across all collected items:
- **Entity Extraction** -- batch extract entities (people, organizations, locations, dates, amounts) across all project items
- **Connection Graph** -- force-directed graph showing entity relationships across your project, with drag/zoom/pan interaction and PNG export
- **Timeline** -- chronological event timeline assembled from project data, with date range filters and markdown export
- **Investigation Report** -- AI-generated report synthesizing all project data into a structured intelligence brief
- **Dashboard** -- at-a-glance project intelligence with activity charts, entity breakdown, co-occurrence heatmap, trend alerts, and auto-generated digests

Batch analysis runs in the background, so you can navigate away from the project while it processes.

[Back to top](#help-top)

---

<a id="help-monitoring"></a>
## Page Monitoring

Monitor any page for content changes. Argus periodically checks for updates and notifies you when something changes.

### Quick Setup (from popup)
1. Navigate to the page you want to monitor
2. Open Argus and click the **eye icon** next to the Analyze button
3. The page is now monitored hourly with AI change summaries

### Advanced Setup (from console)
1. Go to the **Monitors** tab in this console
2. Enter a URL and set the check interval (15 min to daily)
3. Add an optional label for easy identification
4. Toggle **AI Change Analysis** for smart diff summaries
5. Toggle **Auto-open on change** to open the page when changes are detected
6. Toggle **Auto-bookmark** to save a snapshot when changes occur

### Viewing Changes
When a change is detected, you'll get a browser notification. Click any monitor's **"History"** button to see a timeline of all detected changes with before/after comparisons. Use the **Diff view** tab to compare any two snapshots side-by-side.

### Monitor Duration
Set an auto-expiry so monitors don't run indefinitely. Options: 12 hours, 1 day, 3 days (default for quick-monitor), 7 days, 30 days, or indefinite. Expired monitors auto-stop and show "EXPIRED" in the list.

### Storage
The storage usage bar at the bottom of the Monitors tab shows how much space your monitors are using. Snapshots are automatically capped and kept lightweight to avoid bloating your browser storage.

[Back to top](#help-top)

---

<a id="help-automations"></a>
## Named Automations

Automations are reusable, multi-step analysis workflows. Chain multiple operations into a named script that runs automatically or on demand.

### Creating an Automation
1. Go to the **Automation** tab and click **"+ New Automation"**
2. Give it a name (e.g., "News Intel Pipeline")
3. Add **triggers** -- URL patterns that auto-fire the automation on page load
4. Add **steps** -- each step runs in sequence, passing output forward
5. Click **Save Automation**

### Step Types
- **Analyze (Preset)** -- runs any analysis preset (Summary, OSINT, Technical, etc.) on the page
- **Custom Prompt** -- runs your own system/user prompt. Input can be the original page or the previous step's output, enabling chained re-analysis
- **Extract Entities** -- extracts people, orgs, locations, dates and adds them to the Knowledge Graph
- **Run Pipeline** -- runs a source pipeline (Wikipedia, News, Classifieds, Research) for structured data extraction
- **Add to Project** -- saves the accumulated results to a project with custom tags

### Triggers
- **URL Patterns** -- auto-fires when you visit a matching page (uses * wildcards)
- **Manual** -- run from the automation list or from a project
- **Linked Project** -- appears in that project's automation toolbar

### Project Integration
Automations and projects work bidirectionally:
- **Automations -> Projects:** Use an "Add to Project" step to route results into a project automatically
- **Projects -> Automations:** Select an automation in the project toolbar and run it on all items or a single item. The automation fetches each URL and runs the full step chain.

### Example: OSINT News Pipeline
```
Name: "OSINT News Pipeline"
Triggers: *://reuters.com/*, *://apnews.com/*

Steps:
1. Analyze (Preset: summary)
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

[Back to top](#help-top)

---

<a id="help-feeds"></a>
## RSS Feeds

Subscribe to RSS/Atom feeds for lightweight content monitoring without scraping entire pages.

### Adding Feeds
1. Go to the **Feeds** tab in this console
2. Paste a feed URL -- or paste any page URL and Argus will try to auto-discover the feed
3. Set the check interval and optionally enable **AI Summarize** for automatic summaries of new entries
4. Enable **Bridge to Page Monitor** to link feed updates to your monitor dashboard

### Feed Reader
Click **"Open Feed Reader"** or click **"Open Reader"** on any feed to open the dedicated reading view. Browse entries by feed or see all feeds combined, mark entries as read, and use AI to summarize individual articles.

### Monitor Bridge
When enabled, new RSS entries are reflected as changes on linked page monitors. This is lighter than page scraping and works well for news sites that publish via RSS.

[Back to top](#help-top)

---

<a id="help-archive"></a>
## Archive Redirect

Automatically redirect paywalled or annoying news sites through **archive.is** for clean, ad-free reading.
1. Go to the **Redirects** tab in this console
2. Toggle **Enable Archive Redirect**
3. Edit the Trouble List -- add or remove sites (one per line)
4. Click **Save**

When enabled, navigating to any listed domain will instantly redirect through archive.is. This is off by default. A default list of 24 common paywalled sites is included.

[Back to top](#help-top)

---

<a id="help-osint"></a>
## OSINT Tools

Argus includes a suite of open-source intelligence tools available from the popup, the right-click context menu, the **OSINT** tab in the console, and as project tools.

### Metadata Extraction
Extracts meta tags, Open Graph data, Twitter Cards, JSON-LD structured data, publication dates, and author information from the current page.

### Link Mapping
Categorizes all links on a page -- external, internal, social media, email addresses, phone numbers, and file links -- with summary statistics and CSV export.

### Whois / DNS Lookup
Performs RDAP whois lookups and DNS record queries (via Google DNS) for the current page's domain. View registration details, nameservers, and DNS records without leaving the browser.

### Tech Stack Detection
Identifies website technologies, frameworks, analytics tools, CDNs, and CMS platforms from page headers, scripts, and meta tags.

### Wayback Machine
Automatically checks the Wayback Machine (archive.org) for availability of visited pages. See when a page was last archived and jump directly to the archived version.

### Archive.is Availability
Automatically checks for archived versions of visited pages on archive.is. Quickly access clean, cached copies of articles.

### Keyword Watchlist
Track specific keywords across your monitors and RSS feeds (now on the **OSINT** tab). Supports regular expressions for advanced pattern matching. When a watched keyword is detected, Argus sends a browser notification so you never miss a relevant update.

[Back to top](#help-top)

---

<a id="help-kg"></a>
## Knowledge Graph

Argus automatically builds a persistent knowledge graph from every analysis, bookmark, and monitored page. Entities (people, organizations, locations, dates) are extracted and connected across all your research.

### How It Works
- Entities are extracted automatically whenever you run an analysis, save a bookmark, or get a monitor change notification
- Fuzzy matching (Levenshtein distance + token overlap) prevents duplicate entries for the same entity
- Co-occurrence edges are created between entities that appear together in the same content
- Inference rules run periodically to discover implicit relationships (e.g., person + organization mentioned together 3+ times -> affiliated-with)

### Managing the Graph
The Knowledge Graph card is on the **OSINT** tab. From there you can:
- **Open Global Graph** -- interactive force-directed visualization of all entities and connections
- **Run Inference** -- manually trigger inference rules to discover new relationships
- **Pending Merges** -- review ambiguous entity matches that Argus flagged for human review
- **Clear Graph** -- reset the knowledge graph entirely

Project-level graphs are also available from each project's toolbar (Graph button).

[Back to top](#help-top)

---

<a id="help-pipelines"></a>
## Source-Aware Pipelines

Argus detects the type of page you're analyzing and automatically runs a specialized pipeline to extract structured intelligence. This runs in the background after your main analysis.

### Detected Source Types

| Type | Detection | What It Extracts |
| --- | --- | --- |
| **Wikipedia** | Wikipedia URLs | Structured profile, infobox data, related entities, categories, key facts |
| **News Article** | Major news domains + byline/dateline heuristics | Claims with evidence levels, bias indicators, source quality score, related stories |
| **Classifieds** | Marketplace URLs + price/listing heuristics | Listing data, seller info, scam risk analysis, price tracking over time |
| **Research** | Academic/wiki URLs (arxiv, scholar, etc.) | Claims analysis, knowledge coverage, methodology notes, suggested follow-ups |

Pipeline results appear in a collapsible **"Source Insights"** panel below your analysis results. All extracted entities are fed into the Knowledge Graph automatically.

[Back to top](#help-top)

---

<a id="help-dashboard"></a>
## Dashboard & Digests

Each project has an interactive dashboard providing at-a-glance intelligence about your research progress.

### Dashboard Widgets
- **Stats Overview** -- total items, entities, relationships, and recent changes
- **Activity Chart** -- 30-day item collection histogram
- **Entity Breakdown** -- visual bars showing entity types (people, orgs, locations)
- **Co-occurrence Heatmap** -- matrix showing which top entities appear together
- **Trend Alerts** -- mention spikes, new entities, and graph growth indicators

### Auto-Report Sections
Generate AI-powered report sections on demand from the dashboard:
- **Executive Summary** -- key findings, patterns, and recommended next steps
- **Knowledge Gaps** -- what's missing from your research, prioritized collection targets
- **Contradictions** -- conflicting claims across sources, reliability assessment
- **Timeline Highlights** -- chronological narrative from collected data

### Scheduled Digests
Set a digest schedule (Daily, Weekly, or Disabled) per project. Argus generates AI briefings summarizing new items, key findings, and suggested actions. Digests are checked every 6 hours and generated when the schedule interval has elapsed.

[Back to top](#help-top)

---

<a id="help-advanced-prompts"></a>
## Advanced Prompts

Every AI prompt used across Argus is fully customizable. Open the **Prompts** tab and scroll to **Advanced Prompts** to edit any prompt's system instruction or user prompt.

### How It Works
- Select a prompt from the dropdown (grouped by feature area)
- Edit the **System Prompt** to change the AI's persona/tone
- Edit the **User Prompt** to change what data or instructions are sent
- Click **Save Prompt** to store your override. Click **Reset** to revert to defaults
- Modified prompts are marked with an asterisk (*) in the dropdown

### Prompt Groups
- **Dashboard Reports** -- Executive Summary, Knowledge Gaps, Contradictions, Timeline Highlights, Project Digest
- **Monitors** -- Change Detection Summary (page diff analysis)
- **RSS Feeds** -- Feed Entry Summary (article summarization)
- **Source Pipelines** -- Wikipedia, Classifieds, News, and Research pipeline stages

### Template Variables
Dashboard report prompts support template variables that are filled at runtime with your project's data:
```
{projectName}        -- Project name
{projectDescription} -- Project description
{itemCount}          -- Number of items collected
{entityCount}        -- Number of KG entities
{dateRange}          -- Date range of collected items
{recentItems}        -- Recent project items list
{topEntities}        -- Top entities by mention count
{keyRelationships}   -- Key entity relationships
{entityCoverage}     -- Entity type breakdown
{itemSummaries}      -- Items with summaries
{itemContents}       -- Full analysis content
{connections}        -- Entity connections
{entityAttributes}   -- Entity attribute details
{timelineItems}      -- Timeline data
{dateEntities}       -- Date/event entities
```

### System-Only Prompts
Some prompts (Digest, Change Detection, Feed Summarizer) have auto-generated user prompts built from live data. For these, only the system prompt is editable -- use it to change the AI's tone, focus, or output format.

### Example -- Geopolitical Focus for Executive Summary
Change the system prompt to shift the analysis perspective:
```
You are a geopolitical intelligence analyst specializing in
state actors, alliances, and conflict dynamics. Prioritize
findings related to power structures, territorial disputes,
and diplomatic signals. Use formal intelligence briefing
language. Flag any information that suggests escalation or
de-escalation patterns.
```

### Example -- Financial Focus for News Pipeline
```
You are a financial intelligence analyst. When analyzing
news, prioritize market-moving information, regulatory
changes, M&A activity, and insider trading signals.
Flag SEC-relevant disclosures. Respond ONLY with valid JSON.
```

[Back to top](#help-top)

---

<a id="help-providers"></a>
## Provider-Specific Features

### Extended Thinking (Claude)
When using Anthropic's Claude models, you can enable **Extended Thinking** in the **Settings** tab. This shows Claude's internal reasoning process before the final answer -- useful for complex analysis, fact-checking, or research tasks. Set a thinking budget to control how many tokens Claude uses for reasoning (1,000-100,000).

### Multi-Agent Swarm (Grok 4.20)
When using xAI's Grok 4.20 Multi-Agent model, Argus dispatches your query to multiple AI agents working in parallel. Configure reasoning effort in the **Prompts** tab:
- **Low** -- 4 agents, quick responses
- **Medium** -- 4 agents, balanced depth
- **High** -- 16 agents, deep analysis
- **Extra High** -- 16 agents, exhaustive research

Higher effort means more agents and deeper research, but higher API cost.

### Custom (OpenAI-compatible)
Connect Argus to any OpenAI-compatible endpoint -- including HuggingFace TGI, Ollama, LM Studio, vLLM, LocalAI, and llama.cpp. Configure the **Base URL**, **Model Name**, and an optional **API Key** in the **Providers** tab under the Custom section. Streaming is supported.

[Back to top](#help-top)

---

<a id="help-export"></a>
## Exporting Results

From any results page, use the toolbar buttons to export:
- **Copy Markdown** -- copy the full result to clipboard as Markdown
- **Export .md** -- download as a Markdown file
- **Export .html** -- self-contained HTML with dark theme styling
- **Export .txt** -- plain text with formatting stripped

### Exporting Settings
Use the **Settings** tab to export/import your full Argus configuration (API keys, custom presets, auto-analyze rules, monitors) as a JSON file. Useful for backup or moving to a new machine.

### Exporting Bookmarks
Use the **"Export JSON"** button in the Bookmarks tab to download all your smart bookmarks as a JSON file.

[Back to top](#help-top)

---

<a id="help-config"></a>
## Configuration Reference

| Setting | Default | Description |
| --- | --- | --- |
| Max Response Tokens | 2,048 | Maximum tokens in AI response (256-16,384) |
| Max Input Characters | 100,000 | How much page text to send to the AI (1,000-500,000) |
| Temperature | 0.3 | Creativity level -- 0 = focused and deterministic, 1 = creative and varied |
| Extended Thinking | Off | Show Claude's reasoning process (Claude only) |
| Thinking Budget | 10,000 | Tokens allocated for Claude's thinking (1,000-100,000) |
| Reasoning Effort | Medium | Swarm agent count and depth (Grok 4.20 only) |
| Response Language | Auto-detect | Language for AI responses -- "Auto" uses your browser's locale. Set manually to override. |
| Show Badge Count | On | Show unread monitor change count on the toolbar icon |

[Back to top](#help-top)

---

<a id="help-privacy"></a>
## Privacy & Security

**Nothing is sent to the developer. Ever.** Argus has no server, no backend, no accounts, and no way to collect your data. Everything -- your API keys, bookmarks, monitors, settings, and analysis history -- lives entirely in your browser's local storage and never leaves your machine.

- **API keys are stored locally** in your browser's extension storage -- they are never transmitted anywhere except directly to the AI provider you select for each analysis
- **No telemetry or analytics** -- Argus does not phone home, track usage, or report anything back to anyone
- **No data collection** -- explicitly declared in the extension manifest under `data_collection_permissions`
- **Page content** is sent only to the AI provider you choose, only when you initiate an analysis (or when a monitor/feed triggers one)
- **No accounts required** -- there is nothing to sign up for because there is no service behind this extension
- **Fully auditable** -- Argus is open source. Every line of code is available for you to read, verify, and modify

The only network requests Argus makes are to the AI provider APIs you configure (xAI, OpenAI, Anthropic, Google, or your custom endpoint), RSS feed URLs you subscribe to, archive redirect URLs if you enable that feature, RDAP (rdap.org) for whois lookups, Google DNS (dns.google) for DNS records, and the Wayback Machine API (archive.org) for availability checks. That's it.

[Back to top](#help-top)

---

<a id="help-troubleshooting"></a>
## Troubleshooting

### "No API key configured"
Go to the **Providers** tab and paste your API key for the provider you want to use. Make sure to select the correct provider tab (xAI, OpenAI, Claude, Gemini, or Custom). For the Custom provider, you need at minimum a Base URL configured.

### "Failed to start analysis"
This usually means the page content couldn't be extracted. Some pages (browser internal pages like `about:*` or heavily JavaScript-rendered pages) may not work. Try a different page.

### PDF files not working (file:// permission)
Argus can analyze PDFs opened from web URLs automatically. For **downloaded/local PDFs** (`file://` URLs), Firefox requires extra permission:
1. Go to **about:addons** (or Menu -> Add-ons)
2. Click on **Argus**
3. Go to the **Permissions** tab
4. Enable **"Access your data for all websites"**

This allows Argus to read the PDF text from Firefox's built-in viewer. Alternatively, open the PDF from its original web URL instead of the downloaded copy.

### API errors (401, 403, 429)
- **401/403:** Your API key is invalid or expired. Generate a new one from your provider's console.
- **429:** Rate limited -- you've made too many requests. Wait a moment and try again, or switch to a different provider.

### Follow-up says "session expired"
Conversation history is stored in memory and clears when Firefox restarts or the extension reloads. Start a new analysis to create a fresh session.

### Monitors not checking
Firefox must be running for monitors to check. Alarms may also be delayed if Firefox was recently started. Monitors use Firefox's built-in alarm API which has a minimum interval of ~1 minute.

### Custom provider not working
Verify that the Base URL is correct and that the endpoint supports the `/v1/chat/completions` API format. Check that the model name matches exactly what the endpoint expects. If the endpoint requires authentication, make sure the API key is entered.

### Extension shortcuts not working
Another extension may be using the same shortcut. Go to **about:addons** -> Gear icon -> **Manage Extension Shortcuts** to check for conflicts and reassign.

[Back to top](#help-top)

---

<a id="help-opensource"></a>
## Open Source

Argus is fully open source under the MIT license. The entire extension is vanilla JavaScript with zero dependencies (except `marked.min.js` for Markdown rendering) -- no frameworks, no bundlers, no transpilers. Just open the files and read them.

**Check out the code, report issues, or contribute:**
https://github.com/n3r4-life/argus360

- **Review the code** -- verify for yourself that nothing shady is happening. It's all there in plain JS.
- **Report bugs or request features** -- open an issue on GitHub
- **Fork it and make it yours** -- rename it, swap the icons, add providers, change the UI. No restrictions.
- **Contribute** -- PRs are welcome. If you build something cool with it, let us know.

**Why open source matters here:** You're handing this extension your API keys and your browsing content. You *should* be able to see exactly what it does with them. Argus is transparent by design -- no obfuscated code, no minified bundles, no hidden network calls. What you see in the repo is exactly what runs in your browser.

[Back to top](#help-top)

---

<a id="help-about"></a>
## About Argus

Argus is named after the all-seeing giant of Greek mythology -- a guardian with a hundred eyes, ever-watchful. Like its namesake, Argus watches the web for you, analyzing pages and tracking changes across the sites you care about. The peacock eye motif in the icon design ties back to the legend -- when Argus Panoptes was slain, Hera placed his hundred eyes on the tail of the peacock as a tribute to her faithful guardian.

Version **(filled in extension UI)**  
License: MIT  
Firefox 142+

[Back to top](#help-top)
