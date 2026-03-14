# Handoff: Sources Integration, Search Categories, KG Graph Enhancements

## What Was Built This Session

### 1. Popup RSS Button → "Add as Source" (pre-existing, verified working)
The RSS button in the popup header (`popup/popup.html:13-24`) shows a 2-option dropdown menu when clicked: **Subscribe as Feed** or **Add as Source**. The "Add as Source" flow sends `saveSource` to background.js, creating a source with `type: "service"` and an RSS address entry. Multi-feed pages save each feed as a separate source via `importSources`. Duplicate detection checks existing source addresses before saving.

### 2. KG Graph Sources Overlay — Full Vcard with Multi-Source Matching

**Changed files:** `osint/graph.js`, `osint/graph.html`, `osint/graph.css`

**Before:** The sources overlay on the KG graph page matched one source per node (first-match-wins) and showed minimal info in the sidebar at the bottom.

**After:**
- `sourceMatches` Map now stores `nodeId → [{source, reason}]` arrays — a node can match **multiple** sources
- Match reasons tracked: `name`, `alias`, `address`, `location`
- Sidebar source section **moved to top** of the detail pane (`graph.html:93-96`)
- Each matched source renders as a full **vcard** with:
  - Color-coded left border and name/type text via `SOURCE_TYPE_COLORS`
  - Match reason badge (e.g. "Name match", "Address match")
  - All addresses with type prefix labels (RSS, EMAIL, etc.), clickable if URL
  - Tags, aliases, location, notes
  - Per-source **"Open in Sources"** button
- Overlay button tooltip shows "3 nodes matched across 2 sources"

**Key code:**
- `graph.js:~100-112`: `SOURCE_TYPE_COLORS` and `sourceMatches` Map
- `graph.js:~645-710`: Sidebar vcard rendering with `matches.forEach()`
- `graph.js:~1060-1140`: Multi-source matching logic with `addMatch()` helper

### 3. "Open in Sources" Deep Link

**Problem:** The URL was `options.html#sources?highlight=id` — query string after hash is ignored.

**Fix:** URL is now `options.html?highlight=${id}#sources` (`graph.js:~703`).

**Handler in options.js (`loadSources()`):**
- Reads `?highlight=` param from URL
- Auto-filters the type dropdown to the target source's type
- Scrolls to the matching card and applies `src-card-highlight` animation (cyan pulse, 2 cycles)
- Cleans URL via `history.replaceState` after highlighting

Source cards now carry `data-src-id` attributes for querySelector targeting.

### 4. Source Types Expanded

Both the filter dropdown (`#src-filter-type`) and editor dropdown (`#src-type`) in `options/options.html` now include:

| Type | Color | Use Case |
|------|-------|----------|
| person | `#e94560` | Named individual |
| organization | `#64b5f6` | Formal org, company, agency |
| group | `#ab47bc` | Informal collective, movement |
| handle | `#26c6da` | Standalone social identity |
| journalist | `#ffa726` | Press contact, reporter |
| informant | `#66bb6a` | Insider, tipster |
| target | `#ef5350` | Subject of investigation |
| adversary | `#f44336` | Known hostile actor |
| scammer | `#ff5722` | Fraud actor (Craigslist, etc.) |
| asset | `#42a5f5` | Controlled/cooperative resource |
| service | `#78909c` | Platform, tool, feed |
| webservice | `#7e57c2` | Web-based service/API |
| device | `#8d6e63` | IP, infrastructure, hardware |
| academic | `#5c6bc0` | Academic institution/journal |
| medical | `#26a69a` | Medical/biomedical source |
| legal | `#8d6e63` | Legal/court source |
| lead | `#ffca28` | Unvetted potential source |
| alias | `#bdbdbd` | Standalone alternate identity |
| entity | `#90a4ae` | Catch-all / other |

Colors defined in two places (keep in sync):
- `options/options.js`: `SOURCE_TYPE_COLORS` (~line 8174)
- `osint/graph.js`: `SOURCE_TYPE_COLORS` (~line 104)

### 5. Color-Coded Source Cards

**Changed files:** `options/options.js` (renderSourcesGrid), `options/options.css`

Each source card header now has:
- Tinted background: `typeColor + '18'` (very subtle)
- Colored bottom border: `typeColor + '55'`
- Avatar circle: `background: typeColor + '22'`, `color: typeColor`
- Type label: `color: typeColor`

This makes types visually distinct at a glance when viewing "All Types".

### 6. Active Feed / Monitored Page Indicators on Source Cards

**In `renderSourcesGrid()` (`options/options.js`):**
- Fetches both feeds (`getFeeds`) and monitors (`getMonitors`) via `Promise.all` at render time
- For each source address:
  - RSS address matching an active feed → green chip with **FEED** tag
  - Any URL matching a monitored page → green chip with **MON** tag
- Card-level badge: "Subscribed Feed", "Monitored Page", or "Subscribed Feed · Monitored Page"

**CSS classes:** `.src-addr-monitored`, `.src-chip-live`, `.src-card-feed-badge`

### 7. Per-Card Custom Links on Resources Tab

**Changed files:** `options/options.js` (renderGrid), `options/options.html`, `options/options.css`

Each resource card now has a `+ Add link` footer button that expands an inline form (URL, Label, Description). User-added links:
- Stored in `resourceCardLinks` storage key: `{ [categoryId]: [{url, label, desc}] }`
- Render at the bottom of the card's link grid with cyan accent (`.res-link-user` class)
- Right-click to remove
- Card header badge count includes user links
- "Your Sources" section renamed to **"My Links"**

**Key code:**
- `options/options.js`: `cardLinksCache`, `loadCardLinks()`, `saveCardLinks()` inside `initResourcesTab()`
- HTML: `#res-custom-top` (My Links), `#res-custom-add-section` (Manage My Links)

### 8. Search Engine Categories + Academic/Research Providers

**Changed files:** `popup/popup.html`, `popup/popup.js`, `popup/popup.css`, `options/options.html`, `options/options.js`, `options/options.css`

**Category pill row** sits above the search input in both popup and console home:
- **General**: DDG, Startpage, Brave, SearX, Mojeek, Google, Dogpile, Yandex, Bing
- **Research**: Google Scholar, Semantic Scholar, JSTOR, arXiv, CORE
- **Medical**: PubMed
- **Custom**: User-added engines
- **All**: Shows everything

**Behavior:**
- Selecting a category filters the dropdown to matching engines (via `data-cat` attributes on `<option>` and `.me-chip` elements)
- Placeholder text updates per category
- Deep dive multi-engine chips filter to show only the active category
- **Check state is preserved across category switches** — you can check DDG under General, switch to Medical, check PubMed, switch to All and see both checked
- Active pill style: **outline** (white text, white border), not filled

**New `SEARCH_ENGINES` entries (both popup/popup.js and options/options.js):**
```javascript
scholar:  "https://scholar.google.com/scholar?q=",
semantic: "https://www.semanticscholar.org/search?q=",
jstor:    "https://www.jstor.org/action/doBasicSearch?Query=",
arxiv:    "https://arxiv.org/search/?query=",
pubmed:   "https://pubmed.ncbi.nlm.nih.gov/?term=",
core:     "https://core.ac.uk/search?q=",
```

### 9. Custom Search Engines

**UI:** Click the `+` circle button next to category pills → inline form appears:
- Name, URL (with `{q}` placeholder), Add button, "Source" checkbox, Cancel
- If URL has no `{q}`, auto-appended intelligently

**Storage:** `customSearchEngines` in `browser.storage.local` — array of `{id, name, url}`
- ID format: `custom_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
- Shared between popup and console (both load from same key)

**Source integration:** If "Source" checkbox is checked (default), also saves as a source:
- Type: `webservice`
- Address: base URL (before `{q}`) with label "Name (search)"
- Tags: `["search-engine"]`
- Notes: full query pattern URL

**Search URL building:** `buildSearchUrl(pattern, query)` — if pattern contains `{q}`, replaces it; otherwise appends query (backward compatible with built-in engines).

**Removal:** Right-click a custom engine chip in deep dive row → confirm → removes from storage and UI.

---

## Key Files Modified

| File | What Changed |
|------|-------------|
| `popup/popup.html` | RSS menu (pre-existing), search category row, custom engine form, multi-engine chips with data-cat |
| `popup/popup.js` | Custom engine CRUD, category filter, buildSearchUrl, SEARCH_ENGINES expanded |
| `popup/popup.css` | Category chips, custom form, add button styles |
| `options/options.html` | Home search bar categories + custom form, source type dropdowns expanded, My Links rename |
| `options/options.js` | Home search categories + custom engines, renderSourcesGrid with feed/monitor cross-ref, SOURCE_TYPE_COLORS, per-card links, source highlight handler |
| `options/options.css` | Home category chips, custom form, source card header colors, highlight animation, per-card add footer, resource link spacing |
| `osint/graph.js` | Multi-source matching, SOURCE_TYPE_COLORS, vcard rendering with colors/reasons, fixed Open in Sources URL |
| `osint/graph.html` | Source section moved to top of sidebar |
| `osint/graph.css` | Vcard styles, type-colored borders/names, reason badges, chip types, clickable URLs |
| `background.js` | No changes (existing saveSource/getSources/getFeeds/getMonitors handlers used) |

## Storage Keys Used

| Key | Type | Purpose |
|-----|------|---------|
| `customSearchEngines` | `[{id, name, url}]` | User-added search engine URL patterns |
| `resourceCardLinks` | `{[catId]: [{url, label, desc}]}` | Per-resource-card custom links |
| `resourceCustomSources` | `[{url, label, desc}]` | General "My Links" entries (renamed from "Your Sources") |

## Data Model Reminder: Source Object
```javascript
{
  id: "src-{timestamp}-{random}",
  name: "Display Name",
  type: "person" | "organization" | ... | "webservice" | "academic" | "medical" | "legal" | "lead" | "scammer" | ...,
  aliases: ["alt1"],
  addresses: [{ type: "rss"|"website"|"email"|..., value: "...", label: "..." }],
  tags: ["search-engine", "priority"],
  location: "City, State",
  notes: "Free text",
  createdAt: timestamp,
  updatedAt: timestamp
}
```
