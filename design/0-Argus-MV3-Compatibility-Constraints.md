# ARGUS — MV3 COMPATIBILITY CONSTRAINTS
## Rules every agent must follow to avoid blocking the MV3 migration

- **Date:** 2026-03-20
- **Repository:** github.com/n3r4-life/argus360
- **Status:** Standing rules — apply to every session, every proposal, every code change
- **Context:** Argus is currently MV2. The MV3 migration is a planned future session. These rules prevent new code from creating MV3 blockers that would need to be undone later.

---

## The Four MV3 Blockers In The Current Manifest

These exist today and will be fixed in the MV3 migration session. Do not add more of them:

1. `"manifest_version": 2` → will become `3`
2. `"browser_action"` → will become `"action"`
3. `"background": { "scripts": [...], "persistent": true }` → will become `"background": { "service_worker": "background.js" }`
4. `"web_accessible_resources"` as flat array → will become array of objects with `"resources"` and `"matches"` keys

---

## Rules For All New Code

### 1. Never depend on a persistent background page

The background will become a service worker. Service workers go dormant — they do not stay in memory between events.

**Never write code that assumes:**
- A global variable in `background.js` persists between message calls
- A `setInterval` or `setTimeout` in background will run indefinitely
- An open WebSocket or connection in background stays alive passively

**Always write code that:**
- Reads state from `browser.storage.local` at the start of each operation
- Uses `browser.alarms` for scheduled work (alarms survive service worker dormancy)
- Re-establishes connections on demand rather than assuming they're open

### 2. Never use `browser_action` APIs in new code

Use the generic `browser.action` namespace in new code even though the manifest still says `browser_action`. Firefox supports both. When the manifest flips to MV3, `browser_action` references in JS will break.

**Avoid:** `browser.browserAction.setIcon()`, `browser.browserAction.setBadgeText()`
**Use:** `browser.action.setIcon()`, `browser.action.setBadgeText()`

### 3. Never add to `web_accessible_resources` as a flat string

The current manifest has a flat array. In MV3 it becomes objects. Any new resources added to this list should be noted in `GRADUATION-NOTES.md` or `REFACTOR-NOTES.md` for the MV3 migration session to handle — do not add them inline without noting the format will need to change.

### 4. Never use `XMLHttpRequest` in background scripts

MV3 service workers don't support XHR. All existing background code uses `fetch()` — keep it that way. If you see XHR anywhere, note it but don't fix it in a non-MV3 session.

### 5. Never use `eval()` or dynamic script injection in any new code

MV3 has a strict Content Security Policy that blocks eval and dynamic code execution. This is already avoided in Argus — keep it that way.

### 6. Never use `blocking` webRequest in new code

`webRequestBlocking` is gone in MV3 Chrome (still available in Firefox MV3 but not Chrome). It's in `optional_permissions` today. Don't write new features that depend on it — use `declarativeNetRequest` patterns instead if needed.

---

## What Is Already MV3-Safe

Everything except the four manifest blockers above. Specifically:

- All page HTML/JS (popup, options, finance, satellite, KG, etc.) — MV3 safe
- `browser.runtime.sendMessage` / `browser.storage.local` — MV3 safe
- All intel providers in `lib/intelligence-providers.js` — MV3 safe
- All `fetch()` calls — MV3 safe
- The ribbon, tab bar, shared UI — MV3 safe
- Cloud backup — MV3 safe
- Vault encryption — MV3 safe

The graduation work (moving console tabs to standalone pages) is entirely MV3-safe and actually improves MV3 readiness by reducing background dependency.

---

## When The MV3 Migration Session Runs

That session will:
1. Update `manifest.json` — the four blockers above
2. Convert `background.js` + all background scripts to a single service worker entry point with proper dormancy handling
3. Audit all background global variables for persistence assumptions
4. Fix any `browser.browserAction` references that remain
5. Fix `web_accessible_resources` format
6. Test on Chrome, Edge, and Firefox MV3

Until that session runs — follow the rules above and do not create new blockers.
