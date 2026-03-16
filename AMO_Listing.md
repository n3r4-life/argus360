# Argus — Mozilla Add-on Store Listing

> This document contains the copy for the addons.mozilla.org listing. Sections map to the AMO submission fields.

---

## Add-on Name

Argus

---

## Summary (250 characters max)

AI-powered page analysis, OSINT tools, and research management across Grok, ChatGPT, Claude, and Gemini. Bring your own keys. All data stays local. One extension, every provider, zero lock-in.

---

## Description (AMO supports basic HTML: <b>, <i>, <ul>, <li>, <a>)

<b>Argus is the AI browser tool that works with every provider — not just one.</b>

Use Grok, ChatGPT, Claude, Gemini, or any OpenAI-compatible endpoint. Bring your own API keys. Run the same analysis across providers, chain different models together, or pick the best one for each job. Your research stays unified in one local database regardless of which AI produced it.

No accounts. No telemetry. No servers. Your keys, your data, your browser.

<b>What can Argus do?</b>

<ul>
<li><b>Analyze any page</b> — 16+ built-in presets from quick summaries to legal risk analysis, media bias breakdowns, and competitive intelligence. Create custom presets with prompt variables.</li>
<li><b>OSINT toolkit</b> — Metadata extraction, tech stack detection, Whois/DNS lookups, regex scanning with AI analysis, link mapping, image grabbing, and more.</li>
<li><b>Knowledge Graph</b> — Automatic entity extraction across everything you analyze. People, organizations, locations, dates — connected by co-occurrence and inference rules. Interactive force-directed visualization.</li>
<li><b>Projects</b> — Collect URLs, analyses, notes, and entities into organized investigations. Batch entity extraction, connection graphs, timelines, dashboards with AI-generated reports.</li>
<li><b>Smart Bookmarks</b> — AI-generated tags, categories, summaries, and reading time. Hierarchical folders, full-text search, tag cloud. Synthesize multiple bookmarks into research reports.</li>
<li><b>AI Chat</b> — Standalone conversational interface with persistent sessions. Switch providers mid-conversation.</li>
<li><b>Workbench</b> — Project-aware deep analysis. Drag research items onto a work surface, chat with AI about connections and contradictions across your data.</li>
<li><b>Draft Pad</b> — Markdown report editor with an asset library that pulls from your entire research history. Templates for OSINT briefs, legal summaries, incident reports.</li>
<li><b>Automations</b> — Multi-step workflows with URL-pattern triggers. Chain different providers in one pipeline: Grok for extraction, Claude for reasoning, Gemini for synthesis.</li>
<li><b>Page Monitoring</b> — Track changes on any page. Configurable intervals, visual diffs, AI-powered change summaries, keyword alerts.</li>
<li><b>RSS Reader</b> — Subscribe to feeds, route keyword matches to projects automatically, browser notifications on hits.</li>
<li><b>Finance Monitor</b> — Track stocks, crypto, forex, commodities. Price alerts and calendar events for market-moving dates.</li>
<li><b>Terminal</b> — WebSocket shell client (xterm.js) for connecting to your servers.</li>
<li><b>Vault Encryption</b> — AES-256-GCM encryption for all stored credentials. PIN or password lock with auto-lock on timeout.</li>
<li><b>Cloud Backup</b> — Google Drive, Dropbox, S3, WebDAV, or GitHub. Scheduled or manual. Your storage, your control.</li>
<li><b>Paywall Bypass</b> — Automatic archive.is redirect for configurable site lists.</li>
</ul>

<b>Why Argus?</b>

Every major AI provider is building their own walled garden — Projects, memory, collections, canvases. None of them talk to each other. Argus sits underneath all of them, keeping your intelligence unified and provider-agnostic.

Use one provider or five. Switch anytime. Your research graph, your projects, your bookmarks — they persist and grow regardless of which model you're talking to.

<b>Privacy by design:</b>
<ul>
<li>All data stored locally in your browser (IndexedDB + OPFS)</li>
<li>No telemetry, analytics, or tracking — declared in the manifest</li>
<li>No accounts, no sign-up, no servers behind this extension</li>
<li>API keys only leave your browser to reach the provider you select</li>
<li>Fully open source — vanilla JavaScript, every line auditable</li>
<li>Optional Vault encryption for stored credentials</li>
</ul>

<b>Open source:</b> <a href="https://github.com/n3r4-life/argus360">github.com/n3r4-life/argus360</a>

---

## Categories (AMO taxonomy)

Primary: **Privacy & Security**
Secondary: **Search Tools**

(Alternative options if those don't fit: "Other" or "Web Development" — Argus spans categories but Privacy & Security emphasizes the local-data angle which is the strongest AMO differentiator.)

---

## Tags (AMO allows up to 20)

ai, osint, analysis, privacy, grok, chatgpt, claude, gemini, research, bookmarks, knowledge-graph, page-monitor, rss, automation, encryption, open-source, intelligence, productivity, multi-provider, byok

---

## Homepage URL

https://github.com/n3r4-life/argus360

---

## Support URL

https://github.com/n3r4-life/argus360/issues

---

## License

Open Source (specify in AMO: MIT, GPL, or whichever license the repo uses)

---

## Screenshots (recommended — descriptions for when you capture them)

1. **Popup with analysis running** — Shows the compact popup with provider selector, preset dropdown, and streaming AI response. Caption: "Analyze any page with your choice of AI provider."

2. **Knowledge Graph visualization** — Full-page force-directed graph with entity nodes, relationship edges, and the AI chat panel open. Caption: "Automatic knowledge graph built from every analysis — entities, relationships, and inference."

3. **Console with Projects** — Projects tab showing an investigation with items, entity extraction results, and the dashboard. Caption: "Project-based investigations with AI-generated dashboards and reports."

4. **Multi-provider comparison** — Side-by-side analysis results from different providers on the same page. Caption: "Run the same analysis across Grok, Claude, and GPT — compare results instantly."

5. **OSINT tools in action** — Popup showing the OSINT tool drawer expanded with Recon/Grab/Archive categories. Caption: "Built-in OSINT toolkit: metadata, tech stack, whois, regex scanning, image grabbing."

6. **Workbench** — Project items dragged onto the work surface with the AI chat showing cross-reference analysis. Caption: "Deep analysis workspace — drag research items in, ask AI to find connections."

7. **Settings/Providers** — Provider tab showing all five AI provider configurations with connection indicators. Caption: "Bring your own keys for any combination of providers. All stored locally."

---

## AMO Review Notes (Developer notes for the review team)

Argus requires user-provided API keys to function. Without at least one AI provider key configured, analysis features will prompt the user to add a key in settings. The extension makes no network requests on install — all external connections are user-initiated.

Permissions rationale:
- `<all_urls>` — required to extract page content for analysis and to reach AI provider API endpoints
- `unlimitedStorage` — local IndexedDB storage for knowledge graph, analysis history, projects, and page monitor snapshots
- `tabs` / `activeTab` — read the current page title/URL for analysis context
- `identity` — OAuth2 flow for optional Google Drive and Dropbox cloud backup
- `contextMenus` — right-click menu integration for quick analysis and OSINT tools
- `alarms` — scheduled page monitoring, RSS feed checks, and cloud backup intervals

Optional permissions (requested at runtime only when the user enables the feature):
- `webRequest` / `webRequestBlocking` — archive.is redirect for paywall bypass
- `webNavigation` — page monitor and archive availability detection
- `notifications` — keyword watchlist alerts and monitor change notifications

No minified application code. All vendor libraries (xterm.js, pdf.js, fflate, marked, DOMPurify) are standard published packages. The extension's own code is vanilla JavaScript with no build step — what's in the repo is what runs in the browser.
