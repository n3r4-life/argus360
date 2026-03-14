# Agent Handoff — Navigation Restructuring & Popup Redesign

## What Was Completed (Session 2)

### 1. MFT Tab Bar — Split ⋯ into Two Buttons
**Files:** `shared/ribbon.js`, `shared/ribbon.css`

- **`⋯` button** — Now a **quick-jump** menu showing hidden/non-visible MFT tabs. Clicking an item **swaps it into the tab bar** (bumps leftmost non-pinned tab into the hidden list, adds the new one at the end) and navigates to that page. Swaps are **session-only** (ephemeral `sessionVisibleTabs` array, resets on page reload).
- **4-square icon button** — New button next to `⋯` for managing which tabs are the **persisted defaults** (via `appVisibleTabs` in storage). Uses the same 4-square icon pattern as popup long-press picker and console ribbon entry picker.
- Both overlays are mutually exclusive (opening one closes the other).
- QJI-based tab (`app-projects`) is protected/pinned — never bumped by swaps.
- CSS: `.app-tab-config-btn` for 4-square button styling.

### 2. MFTr (Results) Category Established
**Files:** `shared/ribbon.js`, `popup/popup.js`, `popup/popup.html`

- Created conceptual split: **MFT** (tool pages with persistent state) vs **MFTr** (transient results pages).
- `app-results` removed from `ALL_TAB_IDS`, popup picker pool (`POPUP_ALL_IDS`), popup HTML.
- Kept in `APP_TAB_DEFS` and `ACTIVE_MAP` so it still routes/highlights when opened programmatically.
- `RESULT_TAB_IDS` constant documents the pattern for future results-type pages.

### 3. Popup QJI Picker — Expanded to All Pages + Console Tabs
**Files:** `popup/popup.js`, `popup/popup.css`

- Added `POPUP_APP_DEFS` — data-driven map with labels + SVG markup for all choosable items (10 MFT pages + 12 console tabs = 22 total options).
- Added `POPUP_ALL_IDS` — canonical order for picker display.
- Added all console tabs to `APP_NAV` as `con-*` entries (e.g., `con-bookmarks`, `con-osint`, `con-settings`) with `type: "console"` routing.
- Picker now renders two sections: **"Pages"** (MFTs) and **"Console"** (console tabs).
- `ensureAppBtn()` dynamically creates icon buttons for console tabs when selected as one of the 4 QJIs.
- Still limited to 4 visible, same long-press picker UX.
- Added `.popup-icon-picker-section` CSS for section headers.

### 4. Finance Page Width Fix
**File:** `finance/finance.css`

- Added `html { background: var(--bg-primary); }` and `max-width: 1200px; margin: 0 auto;` to body — matching standard used by Terminal, Reader, Publisher, Workbench.

### 5. Draft → Publisher Rename (from session 1, carried forward)
All references updated: tab label in `APP_TAB_DEFS`, popup button title, `reporting/reporting.html` title/header.

---

## Architecture Summary (Current State)

### Navigation Layers
1. **Popup** (browser action) — 4 choosable QJI icons from pool of 22 (10 MFT + 12 console). Long-press 4-square button to configure.
2. **Ribbon** (top bar on all pages) — Console tab icon buttons (Bookmarks, Projects, Monitors, Feeds, OSINT, Automate, Redirects, Tracker, Sources, Prompts, Providers, Resources, Settings, Help, Wipe). Includes 4-square entry tab picker for swappable console entry point.
3. **MFT Tab Bar** (below ribbon) — Up to 8 visible tool pages. `⋯` for quick-jump/swap (session-only), 4-square for visibility config (persisted). Drag to reorder.

### Key Storage Keys
| Key | Type | Purpose |
|-----|------|---------|
| `popupVisibleApps` | `string[]` (max 4) | Which QJIs show in popup (can be `app-*` or `con-*`) |
| `appVisibleTabs` | `string[]` (max 8) | MFT tab bar persisted defaults |
| `appTabOrder` | `string[]` | Full ordering of all MFT tabs |
| `consoleEntryTab` | `string` | Which console tab the QJI-based MFT tab points to |

### Page Types
- **MFT** (tool): `app-projects`, `app-reader`, `app-reports`, `app-kg`, `app-workbench`, `app-draft`, `app-images`, `app-chat`, `app-terminal`, `app-finance`
- **MFTr** (results): `app-results` — navigable but not selectable in any picker
- **Console tabs**: 13 hash-based views within `options/options.html` (bookmarks, projects, monitors, feeds, osint, automation, archive, tracker, sources, prompts, providers, resources, settings)

---

## Pending Work for Next Session

### A. Popup Button Reorganization (Primary Task)

The user wants to reorganize the popup's button layout with three tiers:

1. **Primary actions** (Analyze, Monitor, Bookmark) — stay prominent as-is.

2. **Quick tools** → Restyle to compact `status-chip` size (matching current Tracker/Private buttons):
   - Meta, T-Stack, Whois, Health
   - **New: Translate button** (see translation plan below)
   - These are quick-fire single-action tools, not primary actions

3. **Stateful toggles** → Convert to toggle switch pattern:
   - Reference SVG: `/home/birdman/grok-page-analyzer/interface-ui-toggle-switch.svg` (pill-shaped left/right on/off with small font labels)
   - **Redirect archiving** (currently an on/off color-coded icon button `#toggle-redirect`)
   - **Page tracking** (currently a status chip `#tracking-badge`)
   - **Forced-private mode** (currently a status chip + forced indicator)
   - These have persistent on/off state and should be visually "more discreet"

### B. Icon Confusion Fix
- **Reader** (`app-reader`) and **Feeds** (`con-feeds`) share the same RSS-style icon in the popup picker
- Reader should get a differentiated icon (book/newspaper style) since it's a reading environment, not a raw feed list

### C. Translation Feature (3 Phases)

**Phase 1 (quick win):** Add a "Translate Page" analysis preset that uses whatever AI provider the user already has configured. System prompt: "translate this content to English, preserve formatting." Zero new dependencies. Could be a new OSINT-style button in the popup. The AI providers (Claude, Grok, GPT, Gemini) are all excellent translators.

**Phase 2:** In-page DOM translation via content script. Walk DOM tree, collect text nodes, batch into chunks respecting sentence boundaries, translate via AI provider, replace text in place. Preserves page layout. MutationObserver for dynamic content. ~200-300 lines of content script.

**Phase 3:** Wire into automation/filter system. Domain rules that auto-trigger translation on page load (e.g., `*://*.lemonde.fr/*` → translate to English). Conditional: if detected language ∉ English AND domain not in exclude list → translate. Same URL pattern matching as existing automations.

Key advantage: works with local setups via custom endpoints (Ollama) — true offline private translation that no browser built-in offers.

### D. Other Items from Previous Sessions
- Resources tab implementation
- Cloud providers support
- Backup engine

---

## Key Files to Read First
| File | What's There |
|------|-------------|
| `popup/popup.html` | Full popup structure — header icons, settings, analysis panel, OSINT tools, search bar |
| `popup/popup.js` | All popup logic — QJI picker (`POPUP_APP_DEFS`, `POPUP_ALL_IDS`, `APP_NAV`), OSINT tool handlers, navigation |
| `popup/popup.css` | Popup styling — icon picker, status chips, OSINT button rows |
| `shared/ribbon.js` | Navigation system — ribbon icons, MFT tab bar, quick-jump, tab picker, drag reorder, vault lock |
| `shared/ribbon.css` | Navigation styling — ribbon, app tabs, pickers, manage buttons |
| `interface-ui-toggle-switch.svg` | Reference SVG for toggle switch pattern the user wants |

## Data Model Reminders

### APP_NAV in popup.js (routing map)
```javascript
// MFT pages
"app-projects": { type: "console", hash: "projects" },
"app-reader":   { type: "page", path: "feeds/feeds.html" },
// ... 9 more MFT entries ...
// Console tabs
"con-bookmarks": { type: "console", hash: "bookmarks" },
// ... 11 more console entries ...
```

### POPUP_APP_DEFS in popup.js (picker data)
Each entry has `{ label, svg }` where svg is the inner SVG markup string.
10 MFT pages + 12 console tabs = 22 entries. No `app-results`.

### APP_TAB_DEFS in ribbon.js (MFT tab definitions)
Each entry has `{ label, icon (array of [tag, attrs]), path, hash? }`.
11 entries (includes `app-results` for routing). Only `ALL_TAB_IDS` (10 entries, excluding results) are selectable.
