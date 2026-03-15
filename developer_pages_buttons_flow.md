# ARGUS — Pages, Buttons & Data Flow Reference

Developer reference for tracking every page, its buttons, and the to/fro data flows.

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
