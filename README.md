# Argus

**Analyze any webpage with AI.** Argus is a Firefox extension that lets you run AI-powered analysis on any page using Grok, ChatGPT, Claude, or Gemini — with streaming responses, follow-up questions, multi-provider comparison, smart bookmarks, page monitoring, and more.

![Firefox](https://img.shields.io/badge/Firefox-142%2B-orange)
![Version](https://img.shields.io/badge/version-360.1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

### Multi-Provider AI Analysis
- **4 providers:** xAI (Grok), OpenAI (GPT-4.1), Anthropic (Claude), Google (Gemini)
- **Streaming responses** — see results as they're generated
- **Follow-up questions** — ask clarifying questions without losing context
- **Provider comparison** — run the same analysis across multiple providers side-by-side

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
| **Late Night Recap** | Sharp, witty comedic editorial recap of the page content |

### Custom Presets & Provider Binding
- Create your own analysis presets with custom system and user prompts
- **Bind presets to specific providers** — e.g., always use Grok for fact-checking, Gemini for visual content analysis, Claude for deep reasoning
- Use template variables: `{title}`, `{url}`, `{domain}`, `{date}`, `{wordcount}`

### Smart Bookmarks
- Bookmark any page with **AI-generated tags, categories, and summaries**
- Full-text search, tag cloud, and category filtering
- **Analyze collected bookmarks** — select multiple bookmarks and synthesize them into a research report with footnotes and source citations

### Projects
- Organize analyses, bookmarks, and notes into **project folders**
- **Star/favorite** projects for quick access
- **Add notes and URLs** directly to any project
- **Save to Project** from any results page or bookmark
- **Export projects** as JSON for backup or sharing
- Color-coded projects with descriptions

### Page Monitoring
- Monitor any page for content changes
- Configurable check intervals (15 min to daily)
- **Monitor duration** — set auto-expiry (12h, 1 day, 3 days, 7 days, 30 days, or indefinite)
- **AI-powered change summaries** — get notified with an explanation of what changed
- Full diff history with side-by-side comparison
- **Storage-aware** — built-in usage indicator, automatic snapshot limits, and lightweight data storage

### RSS Feed Reader
- Built-in **RSS/Atom feed reader** — subscribe to any feed or paste a page URL and Argus auto-discovers the feed
- Configurable check intervals per feed
- **AI-summarized entries** — new articles are summarized automatically using your configured provider
- **Monitor bridge** — link feeds to page monitors so RSS updates show as monitor changes
- Unread counts, mark-as-read, and a dedicated feed reader page

### Archive Redirect
- Automatically redirect paywalled or annoying news sites through **archive.is**
- Manage a customizable domain blocklist (24 common sites pre-loaded)
- Toggle on/off from the **Redirects** tab — off by default

### Auto-Analyze
- Set up rules to automatically analyze pages matching URL patterns
- Configure per-domain with custom presets and providers
- One-click setup from the popup for the current site

### Additional Features
- **Multi-page analysis** — analyze multiple open tabs together
- **Selection analysis** — highlight text and analyze just that selection
- **Extended thinking** — Claude native thinking plus best-effort `REASONING:` sections for OpenAI and Grok
- **Provider-specific reasoning controls** — configure Grok multi-agent effort and OpenAI o-series reasoning effort separately
- **Multi-agent mode** — use Grok 4.20 Swarm with configurable agent count
- **Export results** as Markdown, HTML, or plain text
- **Response language** — auto-detects your browser language or set manually; AI responds in your language
- **Context menu integration** — right-click any page to analyze
- **Keyboard shortcuts** for quick access
- **Analysis history** — searchable log of all past analyses

---

## Installation

### From Source (Developer)

1. Clone the repository:
   ```bash
   git clone https://github.com/n3r4-life/argus360.git
   cd argus360
   ```

2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`

3. Click **"Load Temporary Add-on"** and select the `manifest.json` file

### From Built Package

1. Download the latest `.zip` from releases

2. In Firefox, go to `about:addons` → gear icon → **Install Add-on From File**

3. Select the downloaded `.zip` file

### Building

```bash
npx web-ext build
```

The packaged extension will be in `web-ext-artifacts/`.

For development with auto-reload:
```bash
npx web-ext run
```

---

## Setup

### 1. Get an API Key

Argus connects directly to AI providers using **your own API keys**. This means no middleman, no subscription, and you only pay for what you use. Most providers offer generous free tiers or credits for new accounts — many users spend less than $1/month with normal use.

You only need **one** key to get started. Add more providers later if you want to compare results.

| Provider | Get your key | Free tier |
|----------|-------------|-----------|
| xAI (Grok) | [console.x.ai](https://console.x.ai) | $25/month free API credits |
| Google (Gemini) | [aistudio.google.com](https://aistudio.google.com/apikey) | Generous free tier |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Pay-as-you-go (low cost) |
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) | $5 free credit on signup |

**How to get a key (takes ~2 minutes):**

1. Click any link above and create a free account
2. Navigate to the API keys section (usually under Settings or API)
3. Click "Create new key" and copy it
4. That's it — paste it into Argus and you're ready

> **Why your own keys?** Your keys stay on your machine — Argus never sees, stores, or transmits them anywhere except directly to the provider you choose. No accounts, no tracking, no data collection. You're in full control.

### 2. Configure Argus

1. Click the Argus icon in your toolbar (or press `Ctrl+Shift+G`)
2. Click the **gear icon** to open Quick Settings
3. Select your provider, paste your API key, choose a model, and click **Save Settings**

For full configuration, click the **grid icon** to open the Argus Console where you can:
- Configure multiple providers
- Set default models per provider
- Adjust temperature, token limits, and input size
- Create custom presets with provider bindings
- Set up auto-analyze rules and page monitors

---

## How to Use

### Basic Analysis

1. Navigate to any webpage
2. Click the Argus icon (or `Ctrl+Shift+G`)
3. Select an analysis type from the dropdown
4. Click **"Analyze This Page"**
5. Results open in a new tab with streaming output

### Quick Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G` | Open Argus popup |
| `Ctrl+Shift+S` | Quick summary of current page |
| `Ctrl+Shift+A` | Analyze selected text |

### Selection Analysis

1. Highlight text on any page
2. Open Argus — it auto-detects the selection
3. Click **"Analyze Selection"**

Or use `Ctrl+Shift+A` to instantly analyze selected text.

### Compare Providers

1. Open Argus and click the **Compare** mode button
2. Check which providers to compare (must have API keys configured)
3. Click **"Compare Providers"**
4. Each provider's result opens in its own tab

### Multi-Page Analysis

1. Open several tabs you want to analyze together
2. Open Argus and click the **Multi-Page** mode button
3. Check/uncheck tabs to include
4. Click **"Analyze Selected Tabs"**

Selecting the **Research Report** preset automatically activates multi-page mode and produces a structured report with source citations.

### Analyze Bookmarks

1. Bookmark pages over time using the **bookmark button** (bookmark icon in popup or results page)
2. Open the **Bookmarks page** (bookmark icon in the popup header)
3. Click **"Select"** in the header
4. Check the bookmarks you want to synthesize
5. Click **"Analyze N Bookmarks"**
6. A research report is generated with cross-references and citations

### Custom Presets with Provider Binding

1. Open **Settings** (grid icon in popup)
2. Scroll to **Analysis Prompts**
3. Click **"+ New Preset"** and name it
4. Set the **Preferred Provider** (e.g., Gemini for visual analysis)
5. Write your system prompt and user prompt
6. The preset now always uses that provider — shown as `Preset Name → Provider` in the popup

**Example: "Late Night Recap" preset**

> Want the news delivered with personality? Create a preset that recites page content in a comedic editorial style — sharp, punchy, and opinionated — without naming the style or breaking character. Great for making dry news actually fun to read.

```
System prompt:
You are a sharp-witted comedic editorial writer. Your style is punchy,
irreverent, and conversational — like a late-night monologue meets a
newspaper column. Use sarcasm, wit, and strong opinions. Never reference
your style, influences, or that you're an AI. Just deliver the content.

User prompt:
Recap the following page content as if you're writing your editorial column.
Hit the key points but make it entertaining. Use markdown formatting.
```

You can bind this to any provider and even attach it to a monitored page — so every time the page changes, Argus auto-runs your preset and delivers the update in your preferred style.

### Page Monitoring

**From the popup:**
1. Navigate to the page you want to monitor
2. Click the **eye icon** next to the Analyze button
3. The page is monitored hourly for 3 days (default) with AI change summaries

**From Settings:**
1. Open Settings → **Page Monitors**
2. Enter a URL, set the check interval, duration, and add a label
3. Toggle **AI Change Analysis** for smart diff summaries
4. View change history with before/after comparisons
5. Check the **storage usage bar** to see how much space monitors are using

### Auto-Analyze

**Quick setup from popup:**
1. Navigate to any page on a site you want auto-analyzed
2. Click the **Auto** mode button (lightning bolt)
3. All pages on that domain will be auto-analyzed when visited

**Advanced setup in Settings:**
1. Open Settings → **Auto-Analyze Rules**
2. Enter a URL pattern (e.g., `*://news.ycombinator.com/*`)
3. Choose an analysis type, provider, and delay
4. Toggle rules on/off as needed

### RSS Feeds

1. Open Settings → **Feeds** tab
2. Paste a feed URL (or any page URL — Argus will try to find the feed automatically)
3. Set check interval and optionally enable **AI Summarize** for auto-summaries
4. Enable **Bridge to Page Monitor** to link feed updates to your monitor dashboard
5. Click **Open Feed Reader** for a dedicated reading view with unread counts

### Archive Redirect

1. Open Settings → **Redirects** tab
2. Toggle **Enable Archive Redirect**
3. Edit the domain list (one per line) — add or remove sites as needed
4. Click **Save** — any matching site will redirect through archive.is automatically

### Context Menu (Right-Click)

Right-click anywhere on a page to access Argus directly — no need to open the popup first.

**On any page:**
- **Bookmark with AI Tags** — instant smart bookmark with AI-generated tags, category, and summary
- Run any built-in or custom analysis preset directly from the menu (Summary, Fact-Check, Late Night Recap, etc.)

**On selected text:**
- Highlight any text on a page, then right-click → **Argus** → choose a preset
- Only the selected text is sent for analysis, not the entire page
- Great for analyzing a specific paragraph, quote, or claim without the noise of the full page

All presets — including any custom presets you've created — appear in the context menu automatically.

### Exporting Results

From any results page, use the toolbar to:
- **Copy Markdown** to clipboard
- **Export .md** — download as Markdown
- **Export .html** — self-contained HTML with dark theme
- **Export .txt** — plain text with formatting stripped

---

## Configuration Reference

### General Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Max Response Tokens | 2048 | Maximum tokens in AI response (256–16,384) |
| Max Input Characters | 100,000 | How much page text to send (1,000–500,000) |
| Temperature | 0.3 | Creativity level (0 = focused, 1 = creative) |
| Response Language | Auto-detect | Language for AI responses — auto uses browser locale |

### Extended Thinking (Claude)

Enable to see Claude's reasoning process before the final answer. Set a thinking budget (1,000–100,000 tokens) to control depth.

### Multi-Agent (Grok 4.20 Swarm)

When using Grok's multi-agent model, configure reasoning effort:
- **Low** — 4 agents, quick
- **Medium** — 4 agents, balanced
- **High** — 16 agents, deep
- **Extra High** — 16 agents, exhaustive

### Prompt Variables

Use these in custom presets:

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
├── manifest.json          # Extension manifest (Manifest V2)
├── background.js          # Core logic: API calls, streaming, message handling
├── popup/                 # Browser action popup
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── results/               # Analysis results display page
│   ├── results.html
│   ├── results.js
│   └── results.css
├── options/               # Full settings page
│   ├── options.html
│   ├── options.js
│   └── options.css
├── bookmarks/             # Smart bookmarks page
│   ├── bookmarks.html
│   ├── bookmarks.js
│   └── bookmarks.css
├── history/               # Analysis history viewer
│   ├── history.html
│   ├── history.js
│   └── history.css
├── monitors/              # Page monitor change history
│   ├── monitor-history.html
│   ├── monitor-history.js
│   └── monitor-history.css
├── feeds/                 # RSS feed reader
│   ├── feeds.html
│   ├── feeds.js
│   └── feeds.css
├── lib/
│   ├── marked.min.js      # Markdown rendering
│   └── export-utils.js    # Shared export functions
└── icons/                 # Extension icons (16–128px)
```

---

## Privacy

- **API keys are stored locally** in your browser's extension storage and are never transmitted anywhere except to the provider you configured
- **No telemetry or analytics** — Argus does not phone home
- **No data collection** — declared in `manifest.json` under `data_collection_permissions`
- Page content is sent only to the AI provider you select for analysis

---

## Requirements

- Firefox 142+
- At least one API key from a supported provider

---

## Fork It, Make It Yours

Argus is fully open source. Clone it, rename it, rip it apart and build something new — no restrictions.

```bash
# Clone the repo
git clone https://github.com/n3r4-life/argus360.git
cd argus360

# Load in Firefox for development
# 1. Open about:debugging#/runtime/this-firefox
# 2. Click "Load Temporary Add-on" → select manifest.json

# Run with auto-reload
npx web-ext run

# Build for distribution
npx web-ext build
```

**Want to make your own version?**
1. Fork this repo
2. Update `manifest.json` — change the name, description, and `gecko.id`
3. Swap the icons in `icons/` and the watermark (`argus-bg.png`)
4. Customize presets, add providers, change the UI — it's all plain JS, no build tools needed
5. Submit to [addons.mozilla.org](https://addons.mozilla.org) or distribute the `.zip` directly

The entire extension is vanilla JavaScript with zero dependencies (except `marked.min.js` for Markdown rendering). No frameworks, no bundlers, no transpilers — just open the files and edit.

---

## Contributing

Issues and PRs are welcome. If you build something cool with it, let me know.

---

## License

MIT
