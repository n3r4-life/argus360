# Console Graduation Notes

Anything noticed but not acted on during graduation.

---

## Phase 1 — Projects

- **Bug: `projCurrentId` undefined** — `projects.js` lines 5218/5222/5225 (original) reference `projCurrentId` which is never declared. Should be `projState.activeProjectId`. Moved as-is.
- **DEFAULT_PRESETS duplication** — `projects.js` includes a minimal `DEFAULT_PRESETS` label map (keys + labels only, no system/prompt content) for the batch preset dropdown. This duplicates data from `options-core.js`. Should be consolidated into a shared constants file when Prompts graduates (Phase 5).
- **Ribbon swappable entry tab system** — The `app-projects` tab in ribbon.js doubles as the "console entry tab" with a swappable system (user can assign it to show Bookmarks, Monitors, etc.). Updated to point to `projects/projects.html` directly. The swappable system still references console hashes for other tabs — will need attention when Bookmarks/Monitors graduate.
- **Monitor project tags** — `options-features.js` had a click handler on project tags in the monitor list that called `projSelectProject()` (now removed). Changed to navigate to projects page. Does not deep-link to the specific project — would need URL param support on the projects page.
- **Project CSS** — `projects.html` imports `../options/options.css` wholesale for `.proj-*` styles. Should extract project CSS into `projects/projects.css` in a cleanup pass.

---

## Phase 2 — Automations

- **DEFAULT_PRESETS duplication** — Same pattern as Projects. `automations.js` includes a minimal label map. Consolidate when Prompts graduates.
- **el proxy pattern** — Created a local `el` object in `automations.js` with automation-relevant DOM refs. Moved code references `el.autoRulesList`, `el.rulePreset`, etc. without changes.
- **scheduleSave replacement** — Replaced with local debounced save that writes only `autoAnalyzeRules` and `feedKeywordRoutes` to storage. The console's `saveAllSettings` also writes these keys. Potential race condition if both pages are open simultaneously — unlikely but worth noting.
- **Feed keyword routes co-located** — `renderFeedRoutes()` and `addFeedRoute()` moved to automations page since the keyword routes UI is on the automation tab. The console's feeds tab had a "jump link" to keyword routes — updated to navigate to automations page.
- **populateRulePresets removed from console** — Was called by prompt preset add/delete handlers. Since the auto-analyze rule preset dropdown no longer exists in the console, the call was removed.
- **Automation CSS** — `automations.html` imports `../options/options.css` wholesale. Should extract automation-specific CSS in a cleanup pass.
- **escapeHtml included locally** — Small utility function copied into automations.js since it's no longer available from core on the new page.

---

## Phase 3a — Sources

- **escapeHtml included locally** — Same as automations.
- **initSourcePicker left in features** — `initSourcePicker` is a reusable dropdown utility used by both Sources (own page) and Feeds (console). Left in `options-features.js` for feeds. Sources page includes its own copy.
- **Sources CSS** — Imports `../options/options.css` wholesale.

---

## Phase 4 — Finance Watchlist

- **Confirmed redundant** — `finance/finance.js` (2,227 lines) already fully covers watchlist, wallets, alerts, events. Console's `finState` system was entirely redundant. Removed ~489 lines.
- **Finance nav button removed** — HTML panel was already gone from Phase 4, nav button cleaned up in Phase 6.

---

## Phase 5 — Prompts

- **Full DEFAULT_PRESETS and ADVANCED_PROMPT_DEFS duplicated** — Unlike Projects/Automations (which only need label maps), Prompts needs the full preset content (system prompts, user prompts). Both 142-line and 100-line constants duplicated in `prompts.js`. Should consolidate into `shared/presets.js` when core no longer needs them.
- **advancedPrompts duplicate declaration** — Extracted core code included `let advancedPrompts = {};` which conflicted with preamble. Fixed by commenting out the duplicate.
- **options-ai.js reduced from 309 → 126 lines** — Only provider tab switching and reasoning controls remain.

---

## Phase 6 — Remaining Migrations

- **Feeds, Tracker, KG/OSINT tabs removed from console** — HTML panels and nav buttons removed. JS code removed from features.js. These config sections were NOT migrated to their destination pages (Reader, Trawl, KG) — that migration needs a separate session that understands each destination page's existing UI.
- **Bookmarks and Monitors still in console** — Per proposal, deferred to Phase 3b (separate redesign session).
- **options-features.js at 3,696 lines** — Above the 500-line target because Bookmarks (~780), Monitors (~400), Resources (~580), Storage Management (~830), and attachListeners (~580) remain. Will reach ~500 after Phase 3b and storage management cleanup.
- **Trawl schedule/duration controls kept** — These are extension Settings, not trawl page UI. Left in features.js under Settings tab.

---

## Summary

| Phase | Page | Lines Extracted |
|---|---|---|
| Phase 0 | shared/options-save.js | 16 (new utility) |
| Phase 1 | projects/projects.js | 1,418 |
| Phase 2 | automations/automations.js | 2,260 |
| Phase 3a | sources/sources.js | 799 |
| Phase 4 | (removed to finance) | 489 removed |
| Phase 5 | prompts/prompts.js | 590 |
| Phase 6 | (removed tabs) | 632 removed |
| **Total** | | **~6,204 lines moved/removed** |

Console `options-features.js`: 9,181 → 3,696 lines
Remaining panels: Home, Providers, Bookmarks, Monitors, Archive, Resources, Settings
