// ──────────────────────────────────────────────
// ArgusDB — IndexedDB tiered storage layer
// Loaded first in background scripts. Provides drop-in replacements
// for browser.storage.local operations on heavy data stores.
// ──────────────────────────────────────────────

const ArgusDB = (() => {
  const DB_NAME = "argus-db";
  const DB_VERSION = 7;

  // ── Store definitions ──
  // Each store: { keyPath, indexes: [{ name, keyPath, options }] }
  const STORES = {
    history:      { keyPath: "id", indexes: [{ name: "timestamp", keyPath: "timestamp" }] },
    bookmarks:    { keyPath: "id", indexes: [{ name: "url", keyPath: "url" }, { name: "savedAt", keyPath: "savedAt" }, { name: "folderId", keyPath: "folderId" }] },
    bookmarkFolders: { keyPath: "id", indexes: [{ name: "parentId", keyPath: "parentId" }, { name: "projectId", keyPath: "projectId" }] },
    projects:     { keyPath: "id", indexes: [{ name: "updatedAt", keyPath: "updatedAt" }] },
    monitors:     { keyPath: "id", indexes: [] },
    snapshots:    { keyPath: "id", indexes: [{ name: "monitorId", keyPath: "monitorId" }, { name: "capturedAt", keyPath: "capturedAt" }] },
    changes:      { keyPath: "id", indexes: [{ name: "monitorId", keyPath: "monitorId" }, { name: "detectedAt", keyPath: "detectedAt" }] },
    feeds:        { keyPath: "id", indexes: [] },
    feedEntries:  { keyPath: "id", indexes: [{ name: "feedId", keyPath: "feedId" }, { name: "pubDate", keyPath: "pubDate" }] },
    watchlist:    { keyPath: "id", indexes: [{ name: "timestamp", keyPath: "timestamp" }] },
    kgNodes:      { keyPath: "id", indexes: [{ name: "type", keyPath: "type" }, { name: "canonicalName", keyPath: "canonicalName" }, { name: "updatedAt", keyPath: "updatedAt" }] },
    kgEdges:      { keyPath: "id", indexes: [{ name: "sourceId", keyPath: "sourceId" }, { name: "targetId", keyPath: "targetId" }, { name: "relationType", keyPath: "relationType" }, { name: "updatedAt", keyPath: "updatedAt" }] },
    chatSessions: { keyPath: "id", indexes: [{ name: "updatedAt", keyPath: "updatedAt" }] },
    drafts:       { keyPath: "id", indexes: [{ name: "updatedAt", keyPath: "updatedAt" }, { name: "projectId", keyPath: "projectId" }] },
    pageTracker:  { keyPath: "id", indexes: [{ name: "url", keyPath: "url" }, { name: "firstVisit", keyPath: "firstVisit" }, { name: "lastVisit", keyPath: "lastVisit" }] },
    sources:      { keyPath: "id", indexes: [{ name: "name", keyPath: "name" }, { name: "updatedAt", keyPath: "updatedAt" }] },
  };

  let _db = null;
  let _dbPromise = null;

  // ── Open / upgrade ──
  function open() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const txn = e.target.transaction;
        for (const [name, cfg] of Object.entries(STORES)) {
          let store;
          if (!db.objectStoreNames.contains(name)) {
            store = db.createObjectStore(name, { keyPath: cfg.keyPath });
          } else {
            store = txn.objectStore(name);
          }
          // Ensure all defined indexes exist (handles upgrades)
          for (const idx of cfg.indexes) {
            if (!store.indexNames.contains(idx.name)) {
              store.createIndex(idx.name, idx.keyPath, idx.options || {});
            }
          }
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => { _dbPromise = null; reject(e.target.error); };
    });
    return _dbPromise;
  }

  // ── Low-level helpers ──
  async function tx(storeName, mode = "readonly") {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txToPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  // ── CRUD operations ──

  async function getAll(storeName) {
    const store = await tx(storeName);
    return reqToPromise(store.getAll());
  }

  async function get(storeName, key) {
    const store = await tx(storeName);
    return reqToPromise(store.get(key));
  }

  async function put(storeName, item) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.put(item));
  }

  async function putMany(storeName, items) {
    const db = await open();
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    return txToPromise(transaction);
  }

  async function remove(storeName, key) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.delete(key));
  }

  async function removeMany(storeName, keys) {
    const db = await open();
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    for (const key of keys) {
      store.delete(key);
    }
    return txToPromise(transaction);
  }

  async function clear(storeName) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.clear());
  }

  async function count(storeName) {
    const store = await tx(storeName);
    return reqToPromise(store.count());
  }

  // ── Index queries ──

  async function getAllByIndex(storeName, indexName, value) {
    const store = await tx(storeName);
    const index = store.index(indexName);
    return reqToPromise(index.getAll(value));
  }

  async function getAllByRange(storeName, indexName, lower, upper) {
    const store = await tx(storeName);
    const index = store.index(indexName);
    const range = IDBKeyRange.bound(lower, upper);
    return reqToPromise(index.getAll(range));
  }

  // Get newest N items by an index (descending)
  async function getNewest(storeName, indexName, limit) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const results = [];
      const req = index.openCursor(null, "prev");
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ── Tiered storage helpers ──

  // Compress an item by stripping full content, keeping only summary
  function compressItem(item, summaryField = "content", maxLen = 500) {
    const compressed = { ...item, _compressed: true };
    if (compressed[summaryField] && compressed[summaryField].length > maxLen) {
      compressed._fullLength = compressed[summaryField].length;
      compressed[summaryField] = compressed[summaryField].slice(0, maxLen) + "\n\n[…truncated]";
    }
    if (compressed.thinking) {
      compressed.thinking = null;
    }
    return compressed;
  }

  // ── Auto-prune engine ──
  // Rules: { store, maxAge?, maxCount?, indexName?, compress? }

  const DEFAULT_PRUNE_RULES = [
    // History: keep 500 entries, compress after 7 days (strip thinking + truncate content to 500 chars)
    { store: "history", maxCount: 500, indexName: "timestamp", compress: true, compressAge: 7 * 24 * 60 * 60 * 1000 },
    // Snapshots: keep last 25 per monitor
    { store: "snapshots", groupBy: "monitorId", maxPerGroup: 25, indexName: "capturedAt" },
    // Changes: keep last 50 per monitor
    { store: "changes", groupBy: "monitorId", maxPerGroup: 50, indexName: "detectedAt" },
    // Feed entries: keep last 200 per feed
    { store: "feedEntries", groupBy: "feedId", maxPerGroup: 200, indexName: "pubDate" },
    // Watchlist matches: cap at 1000
    { store: "watchlist", maxCount: 1000, indexName: "timestamp" },
    // Knowledge graph: cap nodes at 5000, edges at 20000
    { store: "kgNodes", maxCount: 5000, indexName: "updatedAt" },
    { store: "kgEdges", maxCount: 20000, indexName: "updatedAt" },
  ];

  async function runPruneRules(customRules) {
    const rules = customRules || DEFAULT_PRUNE_RULES;
    const stats = { deleted: 0, compressed: 0 };

    for (const rule of rules) {
      try {
        if (rule.groupBy) {
          await _pruneGrouped(rule, stats);
        } else {
          await _pruneFlat(rule, stats);
        }
      } catch (e) {
        console.warn(`[ArgusDB] prune error for ${rule.store}:`, e);
      }
    }
    return stats;
  }

  async function _pruneFlat(rule, stats) {
    const all = await getAll(rule.store);
    if (!all.length) return;

    const idx = rule.indexName || "timestamp";
    all.sort((a, b) => (b[idx] || 0) - (a[idx] || 0));

    // Compress old items
    if (rule.compress && rule.compressAge) {
      const cutoff = Date.now() - rule.compressAge;
      const db = await open();
      const transaction = db.transaction(rule.store, "readwrite");
      const store = transaction.objectStore(rule.store);
      for (const item of all) {
        if (!item._compressed && (item[idx] || 0) < cutoff) {
          store.put(compressItem(item));
          stats.compressed++;
        }
      }
      await txToPromise(transaction);
    }

    // Delete excess
    if (rule.maxCount && all.length > rule.maxCount) {
      const toDelete = all.slice(rule.maxCount);
      await removeMany(rule.store, toDelete.map(i => i[i._keyPath || STORES[rule.store].keyPath]));
      stats.deleted += toDelete.length;
    }
  }

  async function _pruneGrouped(rule, stats) {
    const all = await getAll(rule.store);
    if (!all.length) return;

    const groups = {};
    for (const item of all) {
      const gk = item[rule.groupBy];
      if (!groups[gk]) groups[gk] = [];
      groups[gk].push(item);
    }

    const idx = rule.indexName || "timestamp";
    const keyPath = STORES[rule.store].keyPath;
    const toDelete = [];

    for (const items of Object.values(groups)) {
      items.sort((a, b) => (b[idx] || 0) - (a[idx] || 0));
      if (rule.maxPerGroup && items.length > rule.maxPerGroup) {
        const excess = items.slice(rule.maxPerGroup);
        for (const item of excess) {
          toDelete.push(item[keyPath]);
        }
      }
    }

    if (toDelete.length) {
      // Clean up OPFS binary files when pruning snapshots
      if (rule.store === "snapshots" && typeof OpfsStorage !== "undefined") {
        for (const id of toDelete) {
          try { await OpfsStorage.deleteSnapshot(id); } catch { /* best effort */ }
        }
      }
      await removeMany(rule.store, toDelete);
      stats.deleted += toDelete.length;
    }
  }

  // ── Migration: browser.storage.local → IndexedDB ──

  async function migrateFromStorage() {
    const migrationKey = "_argusdb_migrated";
    const { [migrationKey]: alreadyMigrated } = await browser.storage.local.get({ [migrationKey]: false });
    if (alreadyMigrated) return { skipped: true };

    const stats = { history: 0, bookmarks: 0, projects: 0, monitors: 0, snapshots: 0, changes: 0, feeds: 0, feedEntries: 0, watchlist: 0 };

    try {
      // 1. Analysis history
      const { analysisHistory } = await browser.storage.local.get({ analysisHistory: [] });
      if (analysisHistory.length) {
        await putMany("history", analysisHistory);
        stats.history = analysisHistory.length;
      }

      // 2. Smart bookmarks
      const { smartBookmarks } = await browser.storage.local.get({ smartBookmarks: [] });
      if (smartBookmarks.length) {
        await putMany("bookmarks", smartBookmarks);
        stats.bookmarks = smartBookmarks.length;
      }

      // 3. Projects
      const { argusProjects } = await browser.storage.local.get({ argusProjects: [] });
      if (argusProjects.length) {
        await putMany("projects", argusProjects);
        stats.projects = argusProjects.length;
      }

      // 4. Page monitors
      const { pageMonitors } = await browser.storage.local.get({ pageMonitors: [] });
      if (pageMonitors.length) {
        await putMany("monitors", pageMonitors);
        stats.monitors = pageMonitors.length;

        // 4a. Migrate per-monitor snapshots and history
        for (const mon of pageMonitors) {
          const snapKey = `monitor-snapshots-${mon.id}`;
          const histKey = `monitor-history-${mon.id}`;
          const snapData = await browser.storage.local.get({ [snapKey]: [] });
          const histData = await browser.storage.local.get({ [histKey]: [] });

          const snaps = snapData[snapKey] || [];
          if (snaps.length) {
            // Add monitorId to each snapshot for indexing
            const tagged = snaps.map(s => ({ ...s, monitorId: mon.id }));
            await putMany("snapshots", tagged);
            stats.snapshots += tagged.length;
          }

          const changes = histData[histKey] || [];
          if (changes.length) {
            const tagged = changes.map(c => ({ ...c, monitorId: mon.id }));
            await putMany("changes", tagged);
            stats.changes += tagged.length;
          }
        }
      }

      // 5. RSS feeds
      const { rssFeeds } = await browser.storage.local.get({ rssFeeds: [] });
      if (rssFeeds.length) {
        await putMany("feeds", rssFeeds);
        stats.feeds = rssFeeds.length;

        // 5a. Migrate per-feed entries
        for (const feed of rssFeeds) {
          const entryKey = `feed-entries-${feed.id}`;
          const entryData = await browser.storage.local.get({ [entryKey]: [] });
          const entries = entryData[entryKey] || [];
          if (entries.length) {
            await putMany("feedEntries", entries);
            stats.feedEntries += entries.length;
          }
        }
      }

      // 6. Watchlist matches
      const { watchlistMatches } = await browser.storage.local.get({ watchlistMatches: [] });
      if (watchlistMatches.length) {
        await putMany("watchlist", watchlistMatches);
        stats.watchlist = watchlistMatches.length;
      }

      // Mark migration complete (don't delete old data yet — user can do that manually)
      await browser.storage.local.set({ [migrationKey]: true, _argusdb_migrated_at: Date.now() });

      console.log("[ArgusDB] Migration complete:", stats);
      return stats;

    } catch (e) {
      console.error("[ArgusDB] Migration failed:", e);
      throw e;
    }
  }

  // ── Cleanup: remove migrated data from browser.storage.local ──

  async function purgeOldStorage() {
    const { _argusdb_migrated } = await browser.storage.local.get({ _argusdb_migrated: false });
    if (!_argusdb_migrated) return { error: "Migration not completed yet" };

    const keysToRemove = ["analysisHistory", "smartBookmarks", "argusProjects", "pageMonitors", "rssFeeds", "watchlistMatches"];

    // Also collect per-monitor and per-feed keys
    const all = await browser.storage.local.get(null);
    for (const key of Object.keys(all)) {
      if (key.startsWith("monitor-snapshots-") || key.startsWith("monitor-history-") || key.startsWith("feed-entries-")) {
        keysToRemove.push(key);
      }
    }

    await browser.storage.local.remove(keysToRemove);
    return { purged: keysToRemove.length };
  }

  // ── Storage size estimation ──

  async function estimateSize() {
    const sizes = {};
    for (const name of Object.keys(STORES)) {
      try {
        const all = await getAll(name);
        const json = JSON.stringify(all);
        sizes[name] = { count: all.length, bytes: json.length };
      } catch {
        sizes[name] = { count: 0, bytes: 0 };
      }
    }
    sizes._total = Object.values(sizes).reduce((sum, s) => sum + (s.bytes || 0), 0);
    return sizes;
  }

  // ── High-level convenience methods (drop-in replacements) ──

  const History = {
    async getAll() { return getAll("history"); },
    async getAllSorted() {
      const items = await getAll("history");
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return items;
    },
    async add(entry) {
      const item = { id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now(), ...entry };
      await put("history", item);
      // Enforce max count
      const { maxHistorySize } = await browser.storage.local.get({ maxHistorySize: 200 });
      const all = await this.getAllSorted();
      if (all.length > maxHistorySize) {
        const excess = all.slice(maxHistorySize);
        await removeMany("history", excess.map(i => i.id));
      }
      return item;
    },
    async get(id) { return get("history", id); },
    async update(id, updates) {
      const item = await get("history", id);
      if (!item) return null;
      Object.assign(item, updates);
      await put("history", item);
      return item;
    },
    async remove(id) { return remove("history", id); },
    async removeMany(ids) { return removeMany("history", ids); },
    async clear() { return clear("history"); },
    async search(query) {
      const all = await this.getAllSorted();
      const q = query.toLowerCase();
      return all.filter(i =>
        (i.pageTitle || "").toLowerCase().includes(q) ||
        (i.pageUrl || "").toLowerCase().includes(q) ||
        (i.content || "").toLowerCase().includes(q) ||
        (i.presetLabel || "").toLowerCase().includes(q)
      );
    },
    async purgeOlderThan(days) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const all = await getAll("history");
      const old = all.filter(i => (i.timestamp || 0) < cutoff);
      if (old.length) await removeMany("history", old.map(i => i.id));
      return old.length;
    }
  };

  const Bookmarks = {
    async getAll() { return getAll("bookmarks"); },
    async add(entry) { await put("bookmarks", entry); return entry; },
    async get(id) { return get("bookmarks", id); },
    async getByUrl(url) {
      const all = await getAllByIndex("bookmarks", "url", url);
      return all[0] || null;
    },
    async update(id, updates) {
      const item = await get("bookmarks", id);
      if (!item) return null;
      Object.assign(item, updates);
      await put("bookmarks", item);
      return item;
    },
    async remove(id) { return remove("bookmarks", id); },
    async removeMany(ids) { return removeMany("bookmarks", ids); },
    async clear() { return clear("bookmarks"); },
  };

  const BookmarkFolders = {
    async getAll() { return getAll("bookmarkFolders"); },
    async get(id) { return get("bookmarkFolders", id); },
    async save(folder) { await put("bookmarkFolders", folder); return folder; },
    async remove(id) {
      // Move child bookmarks to parent folder (or root)
      const folder = await get("bookmarkFolders", id);
      const parentId = folder ? (folder.parentId || null) : null;
      const bms = await getAllByIndex("bookmarks", "folderId", id);
      for (const bm of bms) {
        bm.folderId = parentId;
        await put("bookmarks", bm);
      }
      // Re-parent child folders
      const children = await getAllByIndex("bookmarkFolders", "parentId", id);
      for (const child of children) {
        child.parentId = parentId;
        await put("bookmarkFolders", child);
      }
      return remove("bookmarkFolders", id);
    },
    async getByParent(parentId) { return getAllByIndex("bookmarkFolders", "parentId", parentId || ""); },
    async clear() { return clear("bookmarkFolders"); },
  };

  const Projects = {
    async getAll() { return getAll("projects"); },
    async get(id) { return get("projects", id); },
    async save(project) { await put("projects", project); return project; },
    async remove(id) { return remove("projects", id); },
    async clear() { return clear("projects"); },
  };

  const Monitors = {
    async getAll() { return getAll("monitors"); },
    async get(id) { return get("monitors", id); },
    async save(monitor) { await put("monitors", monitor); return monitor; },
    async saveAll(monitors) { return putMany("monitors", monitors); },
    async remove(id) {
      await remove("monitors", id);
      // Also clean up associated snapshots and changes
      const snaps = await getAllByIndex("snapshots", "monitorId", id);
      if (snaps.length) await removeMany("snapshots", snaps.map(s => s.id));
      const chgs = await getAllByIndex("changes", "monitorId", id);
      if (chgs.length) await removeMany("changes", chgs.map(c => c.id));
    },
    async clear() {
      await clear("monitors");
      await clear("snapshots");
      await clear("changes");
    },
  };

  const Snapshots = {
    async getByMonitor(monitorId) {
      const items = await getAllByIndex("snapshots", "monitorId", monitorId);
      items.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
      return items;
    },
    async add(snapshot) { await put("snapshots", snapshot); return snapshot; },
    async remove(id) { return remove("snapshots", id); },
    async clear() { return clear("snapshots"); },
    async pruneForMonitor(monitorId, keepCount = 25) {
      const items = await this.getByMonitor(monitorId);
      if (items.length <= keepCount) return 0;
      const excess = items.slice(keepCount);
      // Delete OPFS binary files (HTML/PNG) for pruned snapshots
      if (typeof OpfsStorage !== "undefined") {
        for (const s of excess) {
          try { await OpfsStorage.deleteSnapshot(s.id); } catch { /* best effort */ }
        }
      }
      await removeMany("snapshots", excess.map(s => s.id));
      return excess.length;
    },
  };

  const Changes = {
    async getAll() {
      const items = await getAll("changes");
      items.sort((a, b) => (b.detectedAt || 0) - (a.detectedAt || 0));
      return items;
    },
    async getByMonitor(monitorId) {
      const items = await getAllByIndex("changes", "monitorId", monitorId);
      items.sort((a, b) => (b.detectedAt || 0) - (a.detectedAt || 0));
      return items;
    },
    async add(change) { await put("changes", change); return change; },
    async clear() { return clear("changes"); },
  };

  const Feeds = {
    async getAll() { return getAll("feeds"); },
    async get(id) { return get("feeds", id); },
    async save(feed) { await put("feeds", feed); return feed; },
    async saveAll(feeds) { return putMany("feeds", feeds); },
    async remove(id) {
      await remove("feeds", id);
      // Clean up entries
      const entries = await getAllByIndex("feedEntries", "feedId", id);
      if (entries.length) await removeMany("feedEntries", entries.map(e => e.id));
    },
    async clear() { await clear("feeds"); await clear("feedEntries"); },
  };

  const FeedEntries = {
    async getByFeed(feedId) {
      return getAllByIndex("feedEntries", "feedId", feedId);
    },
    async saveMany(entries) { return putMany("feedEntries", entries); },
    async update(id, updates) {
      const item = await get("feedEntries", id);
      if (!item) return null;
      Object.assign(item, updates);
      await put("feedEntries", item);
      return item;
    },
    async removeByFeed(feedId) {
      const entries = await getAllByIndex("feedEntries", "feedId", feedId);
      if (entries.length) await removeMany("feedEntries", entries.map(e => e.id));
      return entries.length;
    },
    async clear() { return clear("feedEntries"); },
  };

  const Watchlist = {
    async getAll() { return getAll("watchlist"); },
    async add(entry) { await put("watchlist", entry); return entry; },
    async addMany(entries) { return putMany("watchlist", entries); },
    async clear() { return clear("watchlist"); },
    async prune(maxCount = 1000) {
      const all = await getAll("watchlist");
      if (all.length <= maxCount) return 0;
      all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const excess = all.slice(maxCount);
      await removeMany("watchlist", excess.map(i => i.id));
      return excess.length;
    }
  };

  // ── Knowledge Graph stores ──

  const KGNodes = {
    async getAll() { return getAll("kgNodes"); },
    async get(id) { return get("kgNodes", id); },
    async save(node) { node.updatedAt = Date.now(); await put("kgNodes", node); return node; },
    async saveMany(nodes) { return putMany("kgNodes", nodes); },
    async remove(id) {
      await remove("kgNodes", id);
      // Also remove all edges referencing this node
      const srcEdges = await getAllByIndex("kgEdges", "sourceId", id);
      const tgtEdges = await getAllByIndex("kgEdges", "targetId", id);
      const edgeIds = [...srcEdges, ...tgtEdges].map(e => e.id);
      if (edgeIds.length) await removeMany("kgEdges", edgeIds);
    },
    async getByType(type) { return getAllByIndex("kgNodes", "type", type); },
    async search(query) {
      const all = await getAll("kgNodes");
      const q = query.toLowerCase();
      return all.filter(n =>
        n.canonicalName.toLowerCase().includes(q) ||
        n.displayName.toLowerCase().includes(q) ||
        (n.aliases || []).some(a => a.toLowerCase().includes(q))
      );
    },
    async clear() { return clear("kgNodes"); },
    async count() { return count("kgNodes"); },
  };

  const KGEdges = {
    async getAll() { return getAll("kgEdges"); },
    async get(id) { return get("kgEdges", id); },
    async save(edge) { edge.updatedAt = Date.now(); await put("kgEdges", edge); return edge; },
    async saveMany(edges) { return putMany("kgEdges", edges); },
    async remove(id) { return remove("kgEdges", id); },
    async getByNode(nodeId) {
      const src = await getAllByIndex("kgEdges", "sourceId", nodeId);
      const tgt = await getAllByIndex("kgEdges", "targetId", nodeId);
      // Deduplicate in case sourceId === targetId (self-loops)
      const seen = new Set();
      const result = [];
      for (const e of [...src, ...tgt]) {
        if (!seen.has(e.id)) { seen.add(e.id); result.push(e); }
      }
      return result;
    },
    async getByRelation(type) { return getAllByIndex("kgEdges", "relationType", type); },
    async clear() { return clear("kgEdges"); },
    async count() { return count("kgEdges"); },
  };

  const ChatSessions = {
    async getAll() {
      const items = await getAll("chatSessions");
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return items;
    },
    async get(id) { return get("chatSessions", id); },
    async save(session) { session.updatedAt = Date.now(); await put("chatSessions", session); return session; },
    async remove(id) { return remove("chatSessions", id); },
    async clear() { return clear("chatSessions"); },
  };

  const Drafts = {
    async getAll() {
      const items = await getAll("drafts");
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return items;
    },
    async get(id) { return get("drafts", id); },
    async save(draft) { draft.updatedAt = Date.now(); await put("drafts", draft); return draft; },
    async remove(id) { return remove("drafts", id); },
    async clear() { return clear("drafts"); },
  };

  // ── Page Tracker store ──
  // Tracks every page visit independently of browser history.
  // Each record is a unique URL with visit count, timestamps, and an actions log.

  const PageTracker = {
    async getAll() {
      const items = await getAll("pageTracker");
      items.sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0));
      return items;
    },
    async get(id) { return get("pageTracker", id); },
    async getByUrl(url) {
      const all = await getAllByIndex("pageTracker", "url", url);
      return all[0] || null;
    },
    async trackVisit(url, title, favicon) {
      let entry = await this.getByUrl(url);
      const now = Date.now();
      if (entry) {
        entry.visits++;
        entry.lastVisit = now;
        entry.title = title || entry.title;
        if (favicon) entry.favicon = favicon;
      } else {
        entry = {
          id: `pt-${now}-${Math.random().toString(36).slice(2, 8)}`,
          url,
          title: title || "",
          favicon: favicon || "",
          firstVisit: now,
          lastVisit: now,
          visits: 1,
          actions: [],
        };
      }
      await put("pageTracker", entry);
      return entry;
    },
    async logAction(url, actionType, detail) {
      let entry = await this.getByUrl(url);
      if (!entry) {
        // Page wasn't tracked yet — create entry with 0 visits
        const now = Date.now();
        entry = {
          id: `pt-${now}-${Math.random().toString(36).slice(2, 8)}`,
          url,
          title: detail?.title || "",
          favicon: "",
          firstVisit: now,
          lastVisit: now,
          visits: 0,
          actions: [],
        };
      }
      entry.actions.push({
        type: actionType,
        timestamp: Date.now(),
        detail: detail || null,
      });
      // Cap actions per URL to 500 to avoid unbounded growth
      if (entry.actions.length > 500) {
        entry.actions = entry.actions.slice(-500);
      }
      await put("pageTracker", entry);
      return entry;
    },
    async search(query) {
      const all = await this.getAll();
      const q = query.toLowerCase();
      return all.filter(i =>
        (i.url || "").toLowerCase().includes(q) ||
        (i.title || "").toLowerCase().includes(q) ||
        (i.actions || []).some(a => (a.type || "").toLowerCase().includes(q))
      );
    },
    async remove(id) { return remove("pageTracker", id); },
    async removeMany(ids) { return removeMany("pageTracker", ids); },
    async clear() { return clear("pageTracker"); },
    async count() { return count("pageTracker"); },
  };

  // ── Sources store ──
  // Manually curated directory of people, handles, feeds, addresses — anything watchable or contactable.

  const Sources = {
    async getAll() {
      const items = await getAll("sources");
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return items;
    },
    async get(id) { return get("sources", id); },
    async save(source) {
      source.updatedAt = Date.now();
      if (!source.createdAt) source.createdAt = source.updatedAt;
      await put("sources", source);
      return source;
    },
    async saveMany(sources) { return putMany("sources", sources); },
    async remove(id) { return remove("sources", id); },
    async removeMany(ids) { return removeMany("sources", ids); },
    async clear() { return clear("sources"); },
    async count() { return count("sources"); },
    async search(query) {
      const all = await this.getAll();
      const q = query.toLowerCase();
      return all.filter(s =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.aliases || []).some(a => a.toLowerCase().includes(q)) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (s.location || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q) ||
        (s.addresses || []).some(a =>
          (a.label || "").toLowerCase().includes(q) ||
          (a.value || "").toLowerCase().includes(q)
        )
      );
    },
  };

  // ── Public API ──
  return {
    open,
    // Low-level
    getAll, get, put, putMany, remove, removeMany, clear, count,
    getAllByIndex, getAllByRange, getNewest,
    // Tiered
    compressItem,
    // Prune
    runPruneRules, DEFAULT_PRUNE_RULES,
    // Migration
    migrateFromStorage, purgeOldStorage,
    // Size
    estimateSize,
    // High-level stores
    History, Bookmarks, BookmarkFolders, Projects, Monitors, Snapshots, Changes, Feeds, FeedEntries, Watchlist,
    KGNodes, KGEdges, ChatSessions, Drafts, PageTracker, Sources,
  };
})();
