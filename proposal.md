# Proposal: Draft + Publish Layer (Argus Reporting Loop)

## Vision
Argus already captures, analyzes, and structures intelligence. This proposal turns it into a full **research -> synthesis -> publish** loop inside the browser. The goal is not a heavy editor, but a focused, private **reporting pad** that makes it easy to assemble evidence into clean output and publish it where the user owns the API.

---

## Phase 1 -- Draft Pad (MVP)
**Goal:** Lightweight editor with fast insertion of analysis/snippets/entities.

**Core UX**
- New page: `reporting/reporting.html`
- Left side floating panel: "Snippets Library"
  - Analysis outputs
  - Entities / key facts
  - Selected bookmarks
  - "Copy / Insert" buttons
- Main panel: Markdown editor with live preview toggle
- Quick actions:
  - Insert selected snippet
  - Export .md / .html / .txt
  - Copy all
  - Save to Project

**Value**
- Keeps the whole writing loop inside Argus
- Eliminates copy/paste chaos
- Feels native to the research workflow

---

## Phase 2 -- Structured "Story Blocks"
**Goal:** Turn Argus outputs into building blocks.

- "Insert as block" (Summary, Key Facts, Entities, Sources)
- Auto-format citations
- "Report template" dropdown (OSINT brief, legal summary, tech memo)

---

## Phase 3 -- Publish Providers (BYOP, but with APIs)
**Goal:** One-click publish for providers with stable APIs.

**Safe Targets**
- Pastebin types already built in
- Blogger (Google API / OAuth2)
- WordPress (REST API)
- Ghost (Admin API)

**Not Stable / Optional**
- Substack (no official write API; email/paste workaround only)

**UI**
- Providers tab: "Publishing Providers"
- Connect, test, set defaults
- "Publish Draft" button in Draft Pad

---

## Phase 4 -- Automation Hooks
**Goal:** Allow automations to push reports.

- Automation step type: "Publish Draft"
- Schedule: daily/weekly digest -> Draft Pad -> publish

---

## Messaging / Product Positioning
- "Argus isn't just analysis -- it's reporting."
- "Use it as a private editor, then ship to the platform you control."
- "No lock-in, no subscriptions, no data leakage."
