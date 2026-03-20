# ARGUS — Developer Standards & Reference

Standards, layout rules, page structure, buttons, and data flow patterns. Read this before writing any code.

---

## Popup Window (popup/popup.html)

### Header Bar
| Button | ID | Action |
|--------|----|--------|
| Settings | `settings-toggle` | Toggle API key setup panel |
| RSS | `osint-subscribe` | Show feed subscription menu |
| Archive Redirect | `toggle-redirect` | Toggle archive.is redirect |

### App Navigation (opens console tabs)
| Button | ID | Opens |
|--------|----|-------|
| Projects | `open-projects` | Projects tab |
| Reader | `open-feeds` | Feeds/Reader |
| Reports | `open-history` | Analysis history |
| KG | `open-kg` | Knowledge Graph |
| Workbench | `open-workbench` | Project workbench |
| Publisher | `open-draft` | Draft pad |
| Images | `open-images` | Image grabber |
| Chat | `open-chat` | Chat interface |
| Terminal | `open-terminal` | SSH terminal |
| Console | `popup-console-home` | Full console (long-press = app picker) |

### Analysis Controls
| Button | ID | Action |
|--------|----|--------|
| Analyze | `analyze-btn` | Run AI analysis on current page |
| Mode | `analyze-mode` | full-page / selection / compare / multi-tab |
| Monitor | `monitor-btn` | Add page to change monitors |
| Bookmark | `bookmark-btn` | Bookmark page with AI tags |
| Preset | `analysis-type` | Select analysis instruction preset |
| Provider | `analysis-provider` | Pick AI provider for this run |
| Project Context | `context-project` | Attach project digest to analysis |
| APC Toggle | `context-enabled` | Enable/disable project context |

### Tools Accordion

**Recon:**
| Tool | ID | Sends → |
|------|----|---------|
| Health | `osint-downdetector` | Custom recon check |
| Whois | `osint-whois` | `whoisLookup` → background-osint |
| T-Stack | `osint-techstack` | `detectTechStack` → background-osint |
| Meta | `osint-metadata` | `extractMetadata` → background-osint |
| Regex | `osint-regex` | `regexScanPage` → background-osint |
| Links | `osint-links` | `extractLinks` → opens link-map page |

**Grab:**
| Tool | ID | Sends → |
|------|----|---------|
| Images | `osint-images` | `extractImages` → opens images page |
| All Tabs | `osint-images-all` | `extractImagesMultiTab` → opens images page |
| Screenshot | `osint-screenshot` | Captures visible tab |

**Archive:**
| Tool | ID | Sends → |
|------|----|---------|
| Archive.is | `osint-archive` | `checkArchiveNow` |
| Wayback | `osint-wayback` | `checkWaybackNow` |

### Quick Search Bar
| Element | ID | Action |
|---------|----|--------|
| Category chips | `.search-cat-chip` | Filter: General, Research, Medical, Custom, All |
| Add Custom | `search-cat-add` | Show custom engine form |
| Engine dropdown | `search-engine` | Select search engine |
| Search input | `search-query` | Enter query |
| Go | `search-go` | Execute search |
| Deep Dive | `deep-dive-toggle` | Crawl + synthesize results |
| Multi-Engine | `.me-chip` | Select multiple engines |

### Status Bar
| Element | ID | Purpose |
|---------|----|---------|
| Tracking | `tracking-badge` | Show page visit timeline |
| Incognito | `open-incognito` | Open in private window |
| Forced Private | `incognito-forced` | Domain is on forced-private list |

---

## Link Map (osint/link-map.html)

### Header
| Element | ID | Action |
|---------|----|--------|
| Project dropdown | `project-select` | Set project context for chat |
| Import Bookmarks | `import-bookmarks-btn` | Parse browser bookmark HTML export |
| History | `history-btn` | Open scan history panel |

### Filter Tabs
| Pill | data-filter | Shows |
|------|-------------|-------|
| All | `all` | All links |
| External | `external` | External links |
| Internal | `internal` | Internal links |
| Social | `social` | Social media links |
| Email | `email` | Email addresses |
| Phone | `phone` | Phone numbers |
| Files | `file` | File links |
| Domains | `domains-pill` | Domain breakdown dropdown |
| Folders | `folders-pill` | Toggle folder-grouped view (bookmarks) |

### Actions
| Button | ID | Action |
|--------|----|--------|
| Add to Project | `add-to-project` | Add links to project |
| Export CSV | `export-csv` | Export as CSV |
| X-Ref Sources | `xref-sources-btn` | Cross-reference vs saved sources |
| Collect All | `collect-all-btn` | Add all visible to collector |
| Search | `link-search` | Filter links (regex, exact, OR) |
| Clear | `search-clear` | Clear search |
| Refresh & Compare | `cache-refresh-btn` | Re-scan page, diff against cache |

### Collector Panel (floating)
| Button | ID | Action |
|--------|----|--------|
| Toggle | `collectorTab` | Show/hide collector |
| Clear | `collectorClear` | Empty collector |
| Export | `collectorExport` | Export collected as CSV |
| X-Ref | `collectorXref` | Cross-ref collected items |
| → Monitors | `collectorToMonitors` | Add URLs as monitors |
| → Sources | `collectorToSources` | Create source from collected items (with folder picker) |
| → KG | `collectorToKG` | Create KG entities |

### Folder Group Actions (bookmark imports)
| Button | Class | Action |
|--------|-------|--------|
| + Sources | `.folder-import-btn` | Bulk-import all links in folder as sources |

### Per-Link Actions
Each link item has collect buttons (click = collect, click again = uncollect):
- Collect link → adds to collector
- +Source → creates individual source entry

---

## Image Grabber (osint/images.html)

### Header
| Element | ID | Action |
|---------|----|--------|
| Project dropdown | `project-select` | Set project context |

### Toolbar Actions
| Button | ID | Action |
|--------|----|--------|
| Download | `download-selected` | Download selected images |
| Export URLs | `export-urls` | Export image URLs |
| Cloud Save | `save-to-cloud` | Save to cloud provider |
| Insert to Draft | `insert-to-draft` | Send to Draft Pad |
| Add to Project | `add-to-project` | Add to project |
| Compare | `compare-selected` | Side-by-side comparison |
| Refresh | `refresh-gallery` | Re-grab from tabs |
| Clear | `clear-gallery` | Clear gallery |

### AI Vision Search
| Element | ID | Action |
|---------|----|--------|
| Search input | `ai-search-input` | Describe what to find |
| Search | `ai-search-btn` | Run vision-based search |
| Clear | `ai-search-clear` | Clear results |

### Selection
| Button | ID | Action |
|--------|----|--------|
| Select All | `select-all` | Select all images |
| Deselect | `deselect-all` | Deselect all |
| Show Selected | `show-selected-only` | Filter to selected |

### Preview Actions (per-image)
| Button | ID | Action |
|--------|----|--------|
| Google | `preview-reverse-google` | Reverse image search |
| TinEye | `preview-reverse-tineye` | Reverse image search |
| Yandex | `preview-reverse-yandex` | Reverse image search |
| Insert Draft | `preview-insert-draft` | Insert into Draft Pad |
| Insert Chat | `preview-insert-chat` | Insert into Chat |

---

## Console (options/options.html)

### Main Tab Navigation
| Tab | data-tab | Purpose |
|-----|----------|---------|
| Bookmarks | `bookmarks` | Saved pages with AI tags |
| Projects | `projects` | Investigations & groups |
| Monitors | `monitors` | Watch pages for changes |
| Feeds | `feeds` | RSS subscriptions |
| OSINT | `osint` | Entity extraction tools |
| Automation | `automation` | Auto-processing rules |
| Finance | `finance` | Financial data tools |
| Archive | `archive` | Archive redirect config |
| Tracker | `tracker` | Page change tracking |
| Sources | `sources` | Contact/entity directory |
| Prompts | `prompts` | Custom analysis presets |
| Providers | `providers` | AI API keys & models |
| Resources | `resources` | Curated tool links |
| Settings | `settings` | General config & backup |

### Sources Tab
| Element | ID | Action |
|---------|----|--------|
| Add New | `src-add-new` | Open source editor |
| Import | `src-import` | Upload JSON source file |
| Export | `src-export` | Download sources |
| Search | `src-search` | Filter sources |
| Type filter | `src-filter-type` | Filter by type |
| Tag filter | `src-filter-tag` | Filter by tag |
| Folder filter | `src-filter-folder` | Filter by folder |

**Source Editor:**
| Field | ID | Purpose |
|-------|----|---------|
| Name | `src-name` | Source name |
| Type | `src-type` | person, org, service, etc. |
| Aliases | `src-aliases` | Comma-separated aliases |
| Location | `src-location` | Geographic location |
| Tags | `src-tags` | Comma-separated tags |
| Folder | `src-folder` | Source folder group (with autocomplete) |
| Notes | `src-notes` | Free text notes |
| Addresses | `src-addr-list` | List of handles/URLs/emails/phones |

---

## Background Message Actions (background.js)

### Core
| Action | Purpose | Returns |
|--------|---------|---------|
| `analyze` | Full AI analysis | Stream/result |
| `compareStream` | Multi-provider compare | Stream |
| `followUpStream` | Continue conversation | Stream |
| `bookmarkPage` | Save page + AI tags | Bookmark |
| `addMonitor` | Start watching page | Monitor |
| `deepDiveSearch` | Crawl & synthesize | Stream |

### Sources
| Action | Purpose |
|--------|---------|
| `getSources` | Fetch all sources |
| `saveSource` | Create/update source (includes `folder` field) |
| `deleteSource` | Remove source |
| `importSources` | Batch import |
| `exportSources` | Export file |

### History
| Action | Purpose |
|--------|---------|
| `getHistory` | Fetch analysis history |
| `deleteHistoryItem` | Remove entry |
| `clearHistory` | Delete all |
| `saveLinkMapHistory` | Save link map scan to history |

### Feeds
| Action | Purpose |
|--------|---------|
| `addFeed` | Subscribe |
| `getFeeds` | List feeds |
| `getFeedEntries` | Get entries |
| `deleteFeed` | Unsubscribe |
| `refreshFeed` | Check for new |

### Tab Reuse
- Link Map: queries for existing `link-map.html*` tab, reuses or creates
- Image Grabber: queries for existing `images.html*` tab, reuses or creates

---

## Background OSINT Actions (background-osint.js)

| Action | Purpose |
|--------|---------|
| `extractMetadata` | OG tags, JSON-LD, meta |
| `extractLinks` | Parse all page links |
| `extractImages` | All images (+ direct URL fallback) |
| `extractImagesMultiTab` | Images from multiple tabs |
| `regexScanPage` | Pattern extraction |
| `detectTechStack` | Technology fingerprinting |
| `whoisLookup` | WHOIS/DNS lookup |
| `buildConnectionGraph` | Entity relationship graph |
| `buildTimeline` | Event timeline |
| `generateReport` | Analysis report |
| `anomalyScan` | Pattern anomaly detection |

---

## Data Flow Patterns

### Single Source Add (from any page)
```
User clicks +Source → source object built with folder="" →
  sendMessage("saveSource") → background.js → ArgusDB.Sources.save()
```

### Bulk Folder Import (link-map bookmark import)
```
User imports bookmarks HTML → parseBookmarksHtml() → folder-grouped view →
  Click "+ Sources" on folder header → importFolderToSources(folderName, links) →
  Loops: sendMessage("saveSource") for each link with folder=folderName
```

### Collector → Sources (link-map)
```
Collect items → Click "→ Sources" → overlay with name/type/folder inputs →
  Reads folder from #sourceFolderInput (autocomplete from existing folders) →
  sendMessage("saveSource") with folder field
```

### Analysis Flow
```
Popup analyze-btn → sendMessage("analyze") → background.js →
  AI provider API call → stream response → save to history
```

### Cross-Reference Flow
```
Link Map X-Ref → getSources → match URLs/emails against link data →
  highlight matches → show source badges on matching links
```

---

## Page Layout Rules

### Width
The `<body>` element on every page MUST have `max-width: 1200px; margin: 0 auto`. This constrains the ribbon, strips, tab bar, AND page content to the same 1200px centered column. Set this in the page's CSS file, not on individual elements. Reference: `osint/graph.css` body rule. No exceptions — no full-width pages.

### Navigation
All pages are **app tabs**. Every new page must be registered in `shared/ribbon.js`:
- `APP_TAB_DEFS` — label, icon SVG paths, and path to HTML file
- `ALL_TAB_IDS` — include in the full list so it appears in the tab picker
- `ACTIVE_MAP` — map the URL pathname fragment to the tab ID

Do NOT add pages to `DEFAULT_VISIBLE_TABS` unless they are core functionality. New pages are hidden by default and available via the `⋯` quick-jump menu and `⊞` tab picker. Users choose which tabs to show (max 8 visible at a time).

Do NOT create custom navigation patterns (sub-nav bars, pill-button links, ribbon-icon routing). Everything is a tab. The user configures their own tab layout.

### Strips (AI + Intel)
The AI provider strip and Intel provider strip sit between the Argus ribbon (logo + icon buttons) and the app tab bar. DOM insertion order in `ribbon.js`:
```
ribbon → aiStrip → intelStrip → appBar → page content
```
Both strips use `position: sticky` and stack vertically. The intel strip renders below the AI strip at `top: 68px` (ribbon 46px + AI strip 22px).

### Page Header Bar
Every page MUST have a header bar immediately after the ribbon/tabs, before `<main>`. Pattern:
```html
<header class="page-header">
  <svg class="header-icon" ...>...</svg>
  <h1 class="header-title">Page Name</h1>
  <span class="header-desc">Short description</span>
  <span class="header-spacer"></span>
  <!-- action buttons go here on the right side -->
</header>
<main>...</main>
```
CSS: `display: flex; align-items: center; height: 46px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);`

Reference implementations: `osint/graph.html` (`.graph-header`), `finance/finance.html` (`.fin-header`), `intel/*.html` (`.intel-page-header`). All follow the same pattern: icon + title on left, spacer, actions on right, 46px height, bg-secondary background.

### Buttons
All buttons use `pill-chip` class from `shared/argus-std.css`. No rectangular buttons. No `btn-primary` (except the popup Analyze button which is a special case). The only pink/red accent-colored element is the "Discuss with AI" chat toggle.

### External Links
Any pill-chip or button that opens an external website (target="_blank") MUST include the ↗ arrow character (`\u2197`) at the end of the label text. Example: `FAA Registry ↗`, `FlightAware ↗`, `ADS-B Exchange ↗`. This tells the user they're leaving Argus. Internal navigation buttons do NOT get the arrow.

### Background: Two-Layer Branded Standard

Every page in Argus has two background layers. Both are REQUIRED on every page.

**Layer 1 — Argus Emblem** (`argus-bg.png`):
Automatic via `body::before` in `argus-std.css`. 80vh size, 12% opacity, fixed centered. Any page that imports `argus-std.css` gets this for free. If the page doesn't import `argus-std.css`, add it.

**Layer 2 — Page Watermark SVG**:
Each page gets its own icon rendered at 320px, 7% opacity, fixed centered. The SVG matches the icon in the page's header bar / tab definition. This tells the user which page they're on even at a glance.

**Implementation depends on page type:**

- **Standalone pages** (feeds, chat, ssh, etc.): Insert the SVG directly in the HTML before `<main>`:
  ```html
  <!-- Background watermark -->
  <svg style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;height:320px;opacity:0.07;pointer-events:none;z-index:0;color:#6a6a80;"
       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5">
    <!-- page icon paths here -->
  </svg>
  ```

- **Console tab panels** (bookmarks, projects, monitors, etc.): Injected via JS in `options.js` — the `injectPanelWatermarks()` function maps `data-panel` names to SVG paths. Add new panels to the `WATERMARKS` object.

- **Intel pages**: Use the `.intel-watermark` CSS class on an SVG inside `<main>`.

**Complete watermark icon map:**

| Page | Icon | SVG Paths |
|------|------|-----------|
| Home (console) | House | `M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z` + `9 22 9 12 15 12 15 22` |
| Bookmarks | Bookmark | `M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z` |
| Projects | Folder | `M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z` |
| Monitors | Eye | `M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z` + circle r=3 |
| Feeds | RSS | `M4 11a9 9 0 0 1 9 9` + `M4 4a16 16 0 0 1 16 16` + circle cx=5 cy=19 r=1 |
| OSINT | Search | circle cx=11 cy=11 r=8 + line 21,21 to 16.65,16.65 |
| Automation | Gear | circle r=3 + gear path |
| Redirects | Arrows | polylines + lines (redirect icon) |
| Tracker | Heartbeat | `22 12 18 12 15 21 9 3 6 12 2 12` |
| Sources | People | person group paths |
| Prompts | Chat | `M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z` |
| Providers | Layers | `M12 2L2 7l10 5 10-5` + two more layer paths |
| Resources | Chain | two link arc paths |
| Settings | Pen | `M12 20h9` + pen path |
| Finance | Dollar | `line 12,1 to 12,23` + S-curve path |
| Intel Hub | Shield | `M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z` |
| Compliance | Shield+check | shield path + `M9 12l2 2 4-4` |
| Movement | Airplane | airplane path |
| Events | Clock | circle r=10 + `12 6 12 12 16 14` |
| Satellite | Globe | circle + equator line + meridian path |
| Images | Frame | rect + circle + polyline mountain |
| Link Map | Tree | circles + branching lines |
| Terminal | Chevron | `4 17 10 11 4 5` + line 12,19 to 20,19 |
| Workbench | Monitor | rect + two lines (stand) |
| Chat | Bubble | speech bubble path |
| Trawl Net | Waves | three wavy paths |
| Publisher | Pen | `M12 20h9` + pen path |
| Reports | Document | file path + polyline + two lines |

**Special case — Home panel:** Watermark shifts from `top: 50%` to `top: 40%` when chat mode is active (detected via MutationObserver on `.home-landing.chat-mode`). Smooth 0.3s transition.

**stroke-width:** Always `0.5` for watermarks (thinner than the 16px header icon which uses `2`).

### Floating Panels, Edge Tabs & Side Dock

Every page that needs tool panels follows a **three-layer** pattern. All three layers are built the same way on every page. Do NOT invent page-specific panel systems.

#### Layer 1: Floating Panels (primary)

Each panel is a `.fp` element with `.fp-header` (drag handle + close button) and `.fp-body` (content). Panels start `hidden` and are toggled visible by their edge tab.

```html
<div class="fp my-panel hidden" id="myPanel" data-panel-id="my-panel">
  <div class="fp-header">
    <span class="fp-title">Panel Name</span>
    <button class="fp-close" id="myPanelClose">&times;</button>
  </div>
  <div class="fp-body" style="padding:10px;">
    <!-- panel content -->
  </div>
</div>
```

**Initialization:** Call `FloatingPanel.init(panelElement, 'pageId')` in the page's init function. This adds drag, resize, z-stacking, and position persistence via `PanelState`.

**Required scripts:** `shared/panel-state.js`, `shared/floating-panel.js`.

**Toggle from JS:**
```javascript
document.getElementById('myToggle').addEventListener('click', function() {
  document.getElementById('myPanel').classList.toggle('hidden');
});
document.getElementById('myPanelClose').addEventListener('click', function() {
  this.closest('.fp').classList.add('hidden');
});
```

#### Layer 2: Edge Tabs (launchers)

Edge tabs are fixed buttons on the right edge of the viewport that toggle their associated floating panel.

**CSS class:** `.edge-tab .edge-tab-right` from `shared/argus-std.css`. 28×52px, `position: fixed`, right edge.

**Edge tab stack (right side, top-to-bottom):**
1. **Asset Library** (shared) — always first. Position: `top: 330px` (set in `asset-library.css` via `.asset-lib-toggle { top: 330px !important; }`).
2. **Page-specific tabs** — below Asset Library, **70px apart**. Start at `top: 400px`.

```html
<button class="edge-tab edge-tab-right" id="myToggle" title="My Panel" style="top:400px;">
  <svg width="16" height="16" viewBox="0 0 24 24" ...>...</svg>
</button>
```

**Spacing rule:** Each tab is 52px tall. Use 70px intervals (52px tab + 18px gap). Stack: 400, 470, 540, 610, 680...

**Last tab in the stack** should always be the **Side Dock** toggle (panel-with-divider icon):
```html
<button class="edge-tab edge-tab-right" id="myDockToggle" title="Side Dock" style="top:XXXpx;">
  <svg ...><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
</button>
```

#### Layer 3: Side Dock (optional docking)

The dock is a fixed column on the right side that can pull floating panels into a tabbed view. It is **secondary** to floating panels — panels float first, dock is opt-in.

**Dock column HTML:**
```html
<div class="XXX-dock-column" id="myDockColumn">
  <div class="XXX-dock-tabs" id="myDockTabs">
    <button id="myDockClose" title="Close Dock" style="flex:none; padding:6px 10px; color:var(--text-muted);">▶</button>
    <button class="active" data-dock-tab="panelId1">Tab 1</button>
    <button data-dock-tab="panelId2">Tab 2</button>
  </div>
  <div class="XXX-dock-body" id="myDockBody"></div>
</div>
```

**Dock behavior:**
- Opening the dock moves **hidden** panels into the dock body via `appendChild`. Floating/visible panels stay where they are.
- For panels not in the dock, their dock tab shows a **"Redock"** pill button that pulls the panel back in.
- Close button (▶ arrow) is always on the **left side** of the dock tab bar.
- Dock **overlays** content — does NOT push content left or resize anything.
- When closing the dock, panels move back to their original parent and get re-hidden.
- Docked panels get their `.fp-header` hidden (no duplicate title/close).
- CSS: `position: fixed; right: 0; top: 178px; bottom: 0; width: 360px; display: none/flex;`

**Dock CSS must include:**
```css
body.XXX-dock-open .edge-tab,
body.XXX-dock-open .asset-lib-toggle {
  display: none !important;
}
```

#### Adding panels to a new page — checklist

1. **Include shared scripts** in HTML `<head>`/`<body>`:
   - `shared/panel-state.js`
   - `shared/floating-panel.js`
   - `shared/asset-library.js`
   - `shared/asset-library.css`

2. **Init Asset Library** in the page's init script:
   ```javascript
   AssetLibrary.init({ pageId: 'mypage', tabs: ['source', 'entity'] });
   // tabs array controls which tabs are visible — omit for all tabs
   ```

3. **Create floating panels** (`.fp` elements with `.fp-header` + `.fp-body`) in HTML.

4. **Add edge tabs** with explicit `top` values (start 400px, 70px apart). Last tab = dock toggle.

5. **Init FloatingPanel** for each panel in JS:
   ```javascript
   FloatingPanel.init(document.getElementById('myPanel'), 'mypage');
   ```

6. **Wire toggle/close** handlers for each edge tab → panel pair.

7. **Add dock column** HTML with tab buttons matching panel IDs.

8. **Wire dock JS** — open/close, tab switching, redock pattern.

**Reference implementations:**
- Satellite: `intel/satellite.html` + `intel/satellite.js` (full pattern with map)
- Compliance: `intel/compliance.html` + `intel/compliance.js` (full pattern without map)

---

### Asset Library (Shared)

The Asset Library (`shared/asset-library.js` + `shared/asset-library.css`) provides cross-page collection storage for entities, sources, locations, images, and snippets. It auto-creates its own edge tab and floating panel.

**Tabs inside the panel:** All, Images, Satellite, Locations, Sources, Entities. Pages control which tabs are visible via the `tabs` option in `init()`.

**Initialization:**
```javascript
// Show all tabs (satellite, images pages)
AssetLibrary.init({ pageId: 'satellite' });

// Show only relevant tabs (compliance, finance pages)
AssetLibrary.init({ pageId: 'compliance', tabs: ['source', 'entity'] });
```

**Adding items from any page:**
```javascript
AssetLibrary.add({ type: 'entity', label: 'Name', source: 'provider', data: rawObj, ts: Date.now() });
```

**Types:** `image`, `satellite`, `location`, `source`, `entity`, `snippet`.

Pages should include `+ Asset` buttons on search results to let users collect items into the library for use on Workbench, Publisher, and KG pages.

---

### Intel Provider Pattern

Intelligence pages (compliance, finance, movement, events, satellite) use a shared provider system:

1. **Provider registration:** `lib/intelligence-providers.js` — add to `PROVIDER_META`, implement provider object, export in return block
2. **Background routing:** `background.js` `handleIntelSearch()` — add a `case` for the new provider key
3. **Page init:** Call `IntelDomainShell.init("domain", ["provider1", "provider2"])` in the page's init script
4. **API keys:** Stored in `browser.storage.local` under `argusIntelProviders.{providerKey}.apiKey`
5. **Search from page:** `browser.runtime.sendMessage({ action: "intelSearch", provider: "key", query, options })`

**Provider interface:**
```javascript
const myprovider = {
  async isConnected() { /* check if API key is configured */ },
  async connect(apiKey) { /* save credentials, test connection */ },
  async disconnect() { /* clear credentials */ },
  async testConnection() { /* verify API access */ },
  async search(query, options) { /* provider-specific search */ },
};
```

Use `makeStub(key)` for placeholder providers that only need connect/disconnect.

### Discuss with AI (Chat Toggle)
Fixed to viewport bottom-left, aligned with the 1200px content area. Chat panel opens upward above the toggle. Uses `backdrop-filter: blur(8px)` for the toggle button. This is the ONLY element that uses the accent color prominently.
