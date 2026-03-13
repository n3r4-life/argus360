# Argus -- Private Intelligence OS in Your Browser (README v4)

- Easy to use!
- Pin to your Toolbar!
- or Right-Click, and select Argus...

**BYOK, Bring your own API key. No subscriptions. No accounts. 100% local, or BYOC, bring your own cloud. BYOP, bring your own paste.**

Argus is a local-first, open-source intelligence OS for your browser. It analyzes pages, tracks changes, maps entities, and builds a persistent knowledge graph -- all under your control, with your keys, your storage, your rules.
It can be full OSINT, or it can just chat. It scales to whatever you need.

It is a smart bookmark agent, a page monitor, an RSS fetcher, an automated script bot, a redirector for troublesome subscription sites, a tech stack scanner, a regex searcher, a page analyzer, and everything from TLDR to legal breakdowns. Watch your patterns, watch others' patterns. Argus is the extension that becomes what you need.

---

## The Philosophy

- **You own the keys** (BYOK). No subscriptions, no lock-in.
- **You own the data** (BYOC). Backups go to *your* cloud, not ours.
- **You own the workflow** (BYOP + full customization). Prompts, presets, pipelines, and automations are all editable.
- **You own the cost curve**. A few cents per day beats $20/month chat subscriptions.
- **You own the exit**. Quick Wipe nukes everything before uninstalling.

This is a private intelligence OS, not a SaaS.

---

## Core Capabilities (Sales-Window Overview)

- **Multi-provider AI**: Grok, OpenAI, Claude, Gemini, and any OpenAI-compatible endpoint
- **Streaming analysis** with chat-like follow-ups and side-by-side model comparison
- **Structured JSON prompting** on every analysis for reliable extraction and downstream automation
- **Smart bookmarks** with AI tags, folders, bulk analysis, and export
- **Projects + Knowledge Graph** to connect entities, sources, and timelines
- **OSINT toolkit**: metadata, link maps, tech stack, whois/DNS, timelines, maps
- **Monitoring + RSS** with AI change summaries and alerts
- **Cloud backup** to your Drive/Dropbox/WebDAV/S3
- **Quick Wipe** for full local data destruction

---

## New in This Build

- **Automations**: Named multi-step workflows with URL triggers, project runs, monitor hooks, and logs
- **AI Chat**: Standalone multi-turn chat with provider switching and persistent sessions
- **Project Workbench**: A deep-dive workspace to assemble items, analyze selections, and save results back
- **Image Grabber**: Extracts, deduplicates, and analyzes all images on a page or across tabs
- **Strict JSON output**: Every analysis ends with machine-readable structured data

---

## Privacy and Security (Non-Negotiable)

- **No telemetry, no analytics, no tracking**
- API keys are stored locally in extension storage
- Page content is sent only to the provider you choose
- Cloud backup connects only to providers you configure
- OSINT tools query public services (rdap.org, dns.google, archive.org)
- **Quick Wipe** removes IndexedDB, OPFS, and all settings

---

## Why It Is Cheaper Long-Run

- Typical page analysis costs fractions of a cent
- Free tiers exist across major providers
- A $20/month chatbot subscription is a tax; Argus scales with your usage

---

## Everything Is Editable

- Presets and prompts are fully customizable
- Pipelines and automations are user-defined
- Providers and models are swappable at any time
- Export and backup targets are yours

Open source means you can rip it apart, rename it, or build a new tool on top of it.

---

## Support (Optional)

If Argus saves you time or helps your research:

- GitHub Sponsors: `https://github.com/sponsors/n3r4-life`
- Buy Me a Coffee: `https://buymeacoffee.com/n3r4.life`

---

## Quick Start (From Source)

```bash
git clone https://github.com/n3r4-life/argus360.git
cd argus360
```

1. Open Firefox -> `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" -> select manifest.json

---

## License

MIT -- From quick paywall bypass -> daily feed digest -> multi-year investigation brain -- Argus watches, remembers, connects the dots, and works for you.
