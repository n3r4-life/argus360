# Argus — Mozilla Add-on Store Listing

> Copy for addons.mozilla.org submission fields.

---

## Add-on Name

Argus — 100 Eyes

---

## Summary (250 characters max)

The internet lies to you. Argus helps you check. AI-powered analysis across Grok, ChatGPT, Claude & Gemini. OSINT tools, knowledge graph, fact-checking. Every API key opens another eye. All data local.

---

## Description (AMO HTML format)

<b>The internet lies to you. Argus helps you check.</b>

Named for Argus Panoptes — the hundred-eyed giant whose eyes never all slept at once — Argus is your personal verification engine. Every API key you configure opens another eye. One watches through Grok. One watches through Claude. One watches corporate registries. One watches court records. The Knowledge Graph connects what all of them see.

A browser extension under 5MB that offers extreme connectability. No accounts. No servers. No telemetry. Your keys, your data, your browser.

<b>Why Argus?</b>

AI-generated text. Deepfake video. Cloned voices. Fake company websites. Fabricated reviews. The average person has no tools to fight this. Meanwhile, every AI provider builds walled gardens — your research in Claude is invisible to Grok. Argus sits underneath all of them, keeping your intelligence unified and provider-agnostic.

<b>Open Your Eyes</b>

Start with one free AI key. That gives you page analysis, fact-checking, and bias detection. Add more keys, open more eyes. 15+ free services supported out of the box.

<ul>
<li><b>5 AI Providers</b> — Grok, ChatGPT, Claude, Gemini, plus any OpenAI-compatible endpoint. Run the same analysis across providers, chain different models together, or pick the best one for each job.</li>
<li><b>16+ Analysis Presets</b> — Summary, Fact-Check, Sentiment, Media Bias, Legal Risk, Competitor Intel, Financial Analysis, and more. Create custom presets bound to specific providers.</li>
<li><b>OSINT Toolkit</b> — Metadata extraction, tech stack detection, Whois/DNS, regex scanning with AI analysis, link mapping, image grabbing across all open tabs.</li>
<li><b>Knowledge Graph</b> — Automatic entity extraction from everything you analyze. People, organizations, locations, dates — connected by co-occurrence and inference rules. Interactive force-directed visualization.</li>
<li><b>Source-Aware Pipelines</b> — Argus detects page types (news, Wikipedia, research, classifieds) and runs specialized extraction automatically. Bias indicators, source quality scores, claim verification.</li>
<li><b>Projects</b> — Organize investigations. Batch entity extraction, connection graphs, timelines, dashboards with AI-generated reports.</li>
<li><b>Smart Bookmarks</b> — AI-generated tags, categories, summaries. Hierarchical folders. Synthesize multiple bookmarks into research reports.</li>
<li><b>AI Chat</b> — Standalone conversational interface. Switch providers mid-conversation. Persistent sessions.</li>
<li><b>Workbench</b> — Drag research items onto a workspace, ask AI to find connections across your data.</li>
<li><b>Draft Pad</b> — Markdown report editor with asset library pulling from your entire research history.</li>
<li><b>Automations</b> — Multi-step workflows with URL triggers. Chain Grok → Claude → Gemini in one pipeline.</li>
<li><b>Page Monitoring</b> — Track changes on any page. AI-powered diff summaries. Keyword alerts.</li>
<li><b>RSS Reader</b> — Subscribe to feeds, auto-route keyword matches to projects.</li>
<li><b>Finance Monitor</b> — Stocks, crypto, forex watchlists. Price alerts. Calendar events.</li>
<li><b>Terminal</b> — WebSocket shell client for your servers.</li>
<li><b>Vault Encryption</b> — AES-256-GCM for all stored credentials. PIN or password lock.</li>
<li><b>Cloud Backup</b> — Google Drive, Dropbox, S3, WebDAV, GitHub. Your storage, your control.</li>
<li><b>Paywall Bypass</b> — Automatic archive.is redirect for configurable site lists.</li>
</ul>

<b>Provider Interoperability — What No Other Tool Does</b>

A Claude analysis and a Grok analysis of the same target end up as sibling items in the same project, their entities merged into the same Knowledge Graph, queryable by whichever model you choose next. Your intelligence stays unified regardless of which provider generated it.

<b>Privacy by design:</b>
<ul>
<li>All data stored locally (IndexedDB + OPFS) — nothing leaves your browser except API calls you initiate</li>
<li>No telemetry, analytics, or tracking — declared in the manifest</li>
<li>No accounts, no sign-up, no servers behind this extension</li>
<li>Fully open source — vanilla JavaScript, every line auditable</li>
<li>Optional Vault encryption for stored credentials</li>
</ul>

<b>100 eyes. Every provider. Under 5MB. Your data.</b>

Open source: <a href="https://github.com/n3r4-life/argus360">github.com/n3r4-life/argus360</a>

---

## Categories

Primary: **Privacy & Security**
Secondary: **Search Tools**

---

## Tags (up to 20)

ai, osint, analysis, privacy, fact-check, grok, chatgpt, claude, gemini, research, bookmarks, knowledge-graph, page-monitor, rss, automation, encryption, open-source, intelligence, multi-provider, verification

---

## Homepage URL

https://github.com/n3r4-life/argus360

---

## Support URL

https://github.com/n3r4-life/argus360/issues

---

## Screenshots (descriptions for capture)

1. **Popup analyzing a page** — Streaming AI response with provider selector and preset dropdown. Caption: *"First eye open. Analyze any page with your choice of AI provider."*

2. **Knowledge Graph** — Full-page force-directed graph with entity nodes, edges, and AI chat panel. Caption: *"The brain. Every analysis, bookmark, and monitored page feeds the Knowledge Graph."*

3. **Multi-provider comparison** — Side-by-side results from different AI providers on the same page. Caption: *"See through multiple eyes. Same page, different models, compared instantly."*

4. **OSINT tools expanded** — Popup showing Recon/Grab/Archive tool drawers. Caption: *"Built-in OSINT toolkit. Metadata, tech stack, whois, regex scanning, image grabbing."*

5. **Projects with dashboard** — Project items, entity extraction results, and dashboard widgets. Caption: *"Organize investigations. AI-generated dashboards, reports, and trend detection."*

6. **Workbench** — Items dragged onto work surface with AI finding cross-references. Caption: *"Deep analysis workspace. Drag research in, ask AI to find what you're missing."*

7. **Settings — Providers** — All five AI provider tabs with connection indicators. Caption: *"Every eye you open. Bring your own keys, stored locally, encrypted by Vault."*

---

## AMO Review Notes

Argus requires user-provided API keys. Without at least one AI provider key, analysis features prompt the user to configure one. The extension makes no network requests on install.

Permissions rationale:
- `<all_urls>` — extract page content for analysis + reach AI provider API endpoints
- `unlimitedStorage` — IndexedDB for knowledge graph, history, projects, page monitor snapshots
- `tabs` / `activeTab` — read current page title/URL for analysis context
- `identity` — OAuth2 for optional Google Drive and Dropbox cloud backup
- `contextMenus` — right-click integration for analysis and OSINT tools
- `alarms` — scheduled monitoring, feed checks, backup intervals

Optional permissions (runtime only):
- `webRequest` / `webRequestBlocking` — archive.is paywall redirect
- `webNavigation` — page monitor and archive detection
- `notifications` — keyword watchlist and monitor change alerts

No minified application code. Vendor libraries (xterm.js, pdf.js, fflate, marked, DOMPurify) are standard published packages. Extension code is vanilla JavaScript with no build step.
