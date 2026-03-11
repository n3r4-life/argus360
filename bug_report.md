# Bug Report

## Findings

1. **High — IndexedDB upgrades don’t create new indexes for existing stores**
   - **Impact:** Users upgrading from older DB versions can hit “index not found” errors when code calls `store.index(...)` for indexes added later. This can break history queries, KG searches, or other indexed reads.
   - **Location:** `lib/storage-db.js:35`
   - **Details:** Index creation is only done inside the `if (!db.objectStoreNames.contains(name))` branch, so existing stores never receive newly added indexes during upgrades.

2. **Medium — Undeclared `currentBlockType` in Anthropic streaming**
   - **Impact:** In strict mode this throws a ReferenceError; otherwise it leaks a global. Either way, streaming can fail or become brittle.
   - **Location:** `background-providers.js:474`
   - **Details:** `currentBlockType = parsed.content_block?.type;` is assigned without a `let/const` declaration.

3. **Medium — KG upsert assumes `aliases` exists**
   - **Impact:** If older or migrated KG nodes lack `aliases`, `existing.aliases.includes(...)` throws and breaks KG updates.
   - **Location:** `background-kg.js:147`
   - **Details:** No guard to ensure `existing.aliases` is an array before use.

4. **Low — Follow-up question lost in exported/serialized logs**
   - **Impact:** Exported markdown doesn’t include the user’s follow-up question, only the answer.
   - **Location:** `results/results.js:545` and `results/results.js:610`
   - **Details:** `elements.followupInput.value` is cleared before `rawMarkdown` is updated, so the stored question is empty.
