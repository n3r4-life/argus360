# Options Page Refactor Notes

**Date:** 2026-03-20
**Scope:** Split `options.js` (12,917 lines) into 5 focused files

---

## Files Created

| File | Lines | Contents |
|---|---|---|
| `options-core.js` | 2,441 | Globals, state, `el` cache, `DOMContentLoaded`, `loadAllSettings`, `saveAllSettings`, `scheduleSave`, `flashSaved`, `escapeHtml`, `debounce`, `updateTabBadges`, `updateDefaultProviderStatus`, `initMainTabs`, tab navigation, console status strip, import/export, version |
| `options-ai.js` | 309 | `selectProviderTab`, `updateProviderTabIndicators`, `populateDefaultPresetDropdown`, prompt tabs, `saveProviderConfig`, `savePrompt`, advanced prompts init/load/save/reset, reasoning controls |
| `options-providers.js` | 272 | `initIntelProviders()` — intel provider tab switching, API key save/load, test connection, credential loaders (OpenSky, Sentinel Hub, WiGLE, Windy Forecast), satellite defaults |
| `options-cloud.js` | 729 | `DATA_PROVIDER_KEYS`, data provider tab switching, field load/save, OAuth connect/disconnect, test connection, paste providers, `initCloudBackup`, `refreshCloudStatus`, `initCloudProviderListeners()` |
| `options-features.js` | 9,181 | `initResourcesTab`, auto-analyze rules, automations, named lists, pending gates, `attachListeners` (modified), finance, monitors, feeds, feed routes, archive, bookmarks, projects, watchlist, user profile, storage management, KG management, tracker, incognito sites, sources, trawl controls, plugins, panel watermarks |

---

## Deviations from Proposal

### 1. `attachListeners()` was not mentioned in the proposal
The original `attachListeners()` function (870 lines, called from `DOMContentLoaded`) sets up event listeners for ALL sections. It had to be partially split:
- **Intel provider listeners** (265 lines) extracted into `initIntelProviders()` in `options-providers.js`
- **Cloud/data/paste provider listeners** (97 lines) extracted into `initCloudProviderListeners()` in `options-cloud.js`
- **Remaining `attachListeners()`** (508 lines) stays in `options-features.js` and calls the two extracted functions

This is the only structural change — wrapping extracted blocks in function declarations. No logic was modified.

### 2. Line counts differ from proposal estimates
- `options-ai.js`: 309 lines (proposal estimated ~700). The proposal overestimated because reasoning controls and advanced prompts are thin.
- `options-providers.js`: 272 lines (proposal estimated ~450). Intel provider logic was entirely inline inside `attachListeners`, not standalone functions.
- `options-core.js`: 2,441 lines (proposal estimated ~2000). `initMainTabs` alone is ~1,360 lines of tab navigation + panel setup.

### 3. `updateDefaultProviderStatus` stays in core
The proposal placed it in AI. It's cross-cutting (reads from `dataProviders` and `pasteProviders` state in cloud, updates UI on Providers tab and Settings tab). Kept in core where both AI and cloud can call it.

---

## Noticed But Not Touched

### Section comment mismatch at line 10058
Lines 10058-10060 say "Storage Management" but are immediately followed by "Cloud Backup UI" (10061-10063). The actual `initStorageManagement()` function starts at line 10507. The misleading comment was moved as-is to `options-cloud.js`.

### Plugin section uses top-level imperative code
Lines 12660-12917 (panel watermarks, plugin registry, test buttons) use top-level statements that execute at parse time — `document.querySelector('.settings-grid').appendChild(...)`. These run when `options-features.js` parses, relying on DOM being ready because scripts are at the bottom of `<body>`. This pattern is fragile but was not changed.

### Tracker listeners are top-level
Lines 11654-11698 attach event listeners at top level (not inside a function). They depend on `debounce()` from core being available. This works because core loads first, but is a code smell.

### `let` state variables in cloud.js
`pasteProviders` and `currentPasteProviderKey` are `let` declarations at file scope in `options-cloud.js`. They are accessed from `options-core.js` (in `loadAllSettings` and `saveAllSettings`). This works because `let` at the top level of classic scripts is in the global lexical environment, accessible across script tags. But it's implicit coupling.

### `escHtml` duplicate
`options-features.js` contains `escHtml()` (line 8752 of original) which is a near-duplicate of `escapeHtml()` in core. Not consolidated — move only.

---

## Load Order

```html
<script src="options-core.js"></script>    <!-- Globals, state, el cache, DOMContentLoaded -->
<script src="options-ai.js"></script>       <!-- AI provider functions -->
<script src="options-providers.js"></script> <!-- Intel provider setup -->
<script src="options-cloud.js"></script>    <!-- Cloud/data/paste providers -->
<script src="options-features.js"></script> <!-- All feature UI + attachListeners -->
```

Core loads first. All other files define functions at parse time. `DOMContentLoaded` fires after all 5 scripts are loaded, then calls `loadAllSettings()`, `attachListeners()`, and various init functions from all files.
