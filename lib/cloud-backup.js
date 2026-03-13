// ──────────────────────────────────────────────
// Cloud Backup Engine — create, upload, list, download, restore backups
// Uses fflate for ZIP creation/extraction
// ──────────────────────────────────────────────

const CloudBackup = (() => {
  "use strict";

  const BACKUP_VERSION = 1;

  // Collect all data from ArgusDB stores
  async function gatherAllData() {
    const [projects, bookmarks, bookmarkFolders, monitors, feeds, history, watchlist, kgNodes, kgEdges] = await Promise.all([
      ArgusDB.Projects.getAll(),
      ArgusDB.Bookmarks.getAll(),
      ArgusDB.BookmarkFolders.getAll(),
      ArgusDB.Monitors.getAll(),
      ArgusDB.Feeds.getAll(),
      ArgusDB.History.getAllSorted(),
      ArgusDB.Watchlist.getAll(),
      ArgusDB.KGNodes.getAll(),
      ArgusDB.KGEdges.getAll(),
    ]);

    // Gather feed entries per feed (no global getAll)
    const feedEntries = [];
    for (const feed of feeds) {
      const entries = await ArgusDB.FeedEntries.getByFeed(feed.id);
      feedEntries.push(...entries);
    }

    // Get settings from storage.local (exclude API keys by default)
    const storage = await browser.storage.local.get(null);
    const settings = {};
    const skipPrefixes = ["tl-result-", "techstack-", "metadata-", "linkmap-", "whois-", "result-", "graph-", "report-", "timeline-"];
    const skipKeys = new Set(["providerSettings"]); // API keys
    for (const [k, v] of Object.entries(storage)) {
      if (skipKeys.has(k)) continue;
      if (skipPrefixes.some(p => k.startsWith(p))) continue;
      settings[k] = v;
    }

    return { projects, bookmarks, bookmarkFolders, monitors, feeds, feedEntries, history, watchlist, kgNodes, kgEdges, settings };
  }

  // Create a ZIP backup blob
  async function createBackup() {
    const data = await gatherAllData();
    const now = new Date().toISOString().replace(/[:.]/g, "-");

    const manifest = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      extension: "Argus",
      counts: {
        projects: data.projects.length,
        bookmarks: data.bookmarks.length,
        bookmarkFolders: data.bookmarkFolders.length,
        monitors: data.monitors.length,
        feeds: data.feeds.length,
        feedEntries: data.feedEntries.length,
        history: data.history.length,
        watchlist: data.watchlist.length,
        kgNodes: data.kgNodes.length,
        kgEdges: data.kgEdges.length,
      }
    };

    const enc = new TextEncoder();
    const files = {
      "manifest.json": enc.encode(JSON.stringify(manifest, null, 2)),
      "projects.json": enc.encode(JSON.stringify(data.projects)),
      "bookmarks.json": enc.encode(JSON.stringify(data.bookmarks)),
      "bookmark-folders.json": enc.encode(JSON.stringify(data.bookmarkFolders)),
      "monitors.json": enc.encode(JSON.stringify(data.monitors)),
      "feeds.json": enc.encode(JSON.stringify(data.feeds)),
      "feed-entries.json": enc.encode(JSON.stringify(data.feedEntries)),
      "history.json": enc.encode(JSON.stringify(data.history)),
      "watchlist.json": enc.encode(JSON.stringify(data.watchlist)),
      "kg-nodes.json": enc.encode(JSON.stringify(data.kgNodes)),
      "kg-edges.json": enc.encode(JSON.stringify(data.kgEdges)),
      "settings.json": enc.encode(JSON.stringify(data.settings)),
    };

    const zipped = fflate.zipSync(files, { level: 6 });
    const blob = new Blob([zipped], { type: "application/zip" });
    const filename = `argus-backup-${now}.zip`;
    console.log(`[Backup] Created ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
    return { blob, filename, manifest };
  }

  // Restore from a ZIP backup blob
  async function restoreFromBackup(blob) {
    const buffer = await blob.arrayBuffer();
    const unzipped = fflate.unzipSync(new Uint8Array(buffer));
    const dec = new TextDecoder();

    // Validate manifest
    if (!unzipped["manifest.json"]) throw new Error("Invalid backup: no manifest.json");
    const manifest = JSON.parse(dec.decode(unzipped["manifest.json"]));
    if (manifest.extension !== "Argus") throw new Error("Not an Argus backup");

    const parse = (name) => unzipped[name] ? JSON.parse(dec.decode(unzipped[name])) : [];

    const data = {
      projects: parse("projects.json"),
      bookmarks: parse("bookmarks.json"),
      bookmarkFolders: parse("bookmark-folders.json"),
      monitors: parse("monitors.json"),
      feeds: parse("feeds.json"),
      feedEntries: parse("feed-entries.json"),
      history: parse("history.json"),
      watchlist: parse("watchlist.json"),
      kgNodes: parse("kg-nodes.json"),
      kgEdges: parse("kg-edges.json"),
      settings: unzipped["settings.json"] ? JSON.parse(dec.decode(unzipped["settings.json"])) : {},
    };

    // Clear existing stores
    await Promise.all([
      ArgusDB.History.clear(),
      ArgusDB.Bookmarks.clear(),
      ArgusDB.BookmarkFolders.clear(),
      ArgusDB.Projects.clear(),
      ArgusDB.Monitors.clear(),
      ArgusDB.Feeds.clear(),
      ArgusDB.Changes.clear(),
      ArgusDB.Watchlist.clear(),
      ArgusDB.KGNodes.clear(),
      ArgusDB.KGEdges.clear(),
    ]);

    // Import all data
    const importStore = async (items, addFn) => {
      for (const item of items) await addFn(item);
      return items.length;
    };

    const stats = {};
    stats.projects = await importStore(data.projects, i => ArgusDB.Projects.save(i));
    stats.bookmarks = await importStore(data.bookmarks, i => ArgusDB.Bookmarks.add(i));
    stats.bookmarkFolders = await importStore(data.bookmarkFolders, i => ArgusDB.BookmarkFolders.save(i));
    stats.monitors = await importStore(data.monitors, i => ArgusDB.Monitors.add(i));
    stats.feeds = await importStore(data.feeds, i => ArgusDB.Feeds.add(i));
    if (data.feedEntries.length) {
      await ArgusDB.FeedEntries.saveMany(data.feedEntries);
      stats.feedEntries = data.feedEntries.length;
    } else { stats.feedEntries = 0; }
    stats.history = await importStore(data.history, i => ArgusDB.History.add(i));
    stats.watchlist = await importStore(data.watchlist, i => ArgusDB.Watchlist.add(i));
    stats.kgNodes = await importStore(data.kgNodes, i => ArgusDB.KGNodes.add(i));
    stats.kgEdges = await importStore(data.kgEdges, i => ArgusDB.KGEdges.add(i));

    // Restore settings (merge, don't overwrite provider keys)
    if (data.settings && Object.keys(data.settings).length) {
      await browser.storage.local.set(data.settings);
    }

    console.log("[Backup] Restore complete:", stats);
    return { success: true, stats, manifest };
  }

  // Upload backup to a connected cloud provider
  async function uploadToProvider(providerKey, blob, filename) {
    const provider = CloudProviders[providerKey];
    if (!provider) throw new Error(`Unknown provider: ${providerKey}`);
    if (!await provider.isConnected()) throw new Error(`${providerKey} is not connected`);
    return provider.upload(blob, filename);
  }

  // List backups from a provider
  async function listBackups(providerKey) {
    const provider = CloudProviders[providerKey];
    if (!provider) throw new Error(`Unknown provider: ${providerKey}`);
    if (!await provider.isConnected()) return [];
    const files = await provider.list();
    return files.filter(f => f.name.startsWith("argus-backup-") && f.name.endsWith(".zip"));
  }

  // Download backup from a provider
  async function downloadBackup(providerKey, filename) {
    const provider = CloudProviders[providerKey];
    if (!provider) throw new Error(`Unknown provider: ${providerKey}`);
    return provider.download(filename);
  }

  // Upload to all connected providers
  async function uploadToAll(blob, filename) {
    const results = {};
    for (const key of ["google", "dropbox", "webdav", "s3"]) {
      try {
        const provider = CloudProviders[key];
        if (provider && await provider.isConnected()) {
          await provider.upload(blob, filename);
          results[key] = { success: true, size: blob.size };
          console.log(`[Backup] Uploaded to ${key} (${(blob.size / 1024).toFixed(1)} KB)`);
        }
      } catch (e) {
        results[key] = { success: false, error: e.message };
        console.error(`[Backup] Upload to ${key} failed:`, e);
      }
    }
    return results;
  }

  // ── Bookmark Cloud Sync ──

  // Sync bookmark metadata to GitHub as diffable JSON files
  async function syncBookmarksToGitHub() {
    const github = CloudProviders.github;
    if (!github || !await github.isConnected()) throw new Error("GitHub not connected");

    const [bookmarks, folders] = await Promise.all([
      ArgusDB.Bookmarks.getAll(),
      ArgusDB.BookmarkFolders.getAll(),
    ]);

    // Strip heavy fields (text, full meta) for metadata sync — keep it lean and diffable
    const metaBookmarks = bookmarks.map(b => ({
      id: b.id, url: b.url, title: b.title, tags: b.tags, category: b.category,
      summary: b.summary, tldr: b.tldr, contentType: b.contentType, language: b.language,
      keyFacts: b.keyFacts, techStack: b.techStack, folderId: b.folderId,
      favicon: b.favicon, notes: b.notes, aiTagged: b.aiTagged,
      savedAt: b.savedAt, updatedAt: b.updatedAt,
    }));

    await github.uploadJson(metaBookmarks, "argus-bookmarks/bookmarks.json");
    await github.uploadJson(folders, "argus-bookmarks/folders.json");

    // Also sync a folder-tree index for easy reading
    const index = {
      syncedAt: new Date().toISOString(),
      totalBookmarks: bookmarks.length,
      totalFolders: folders.length,
      folders: folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId, projectId: f.projectId })),
    };
    await github.uploadJson(index, "argus-bookmarks/index.json");

    console.log(`[BookmarkSync] Synced ${bookmarks.length} bookmarks + ${folders.length} folders to GitHub`);
    return { success: true, bookmarks: bookmarks.length, folders: folders.length };
  }

  // Sync a bookmark snapshot (HTML/PDF blob) to connected blob storage providers
  async function syncBookmarkSnapshot(bookmarkId) {
    const bookmark = await ArgusDB.Bookmarks.get(bookmarkId);
    if (!bookmark || !bookmark.snapshotId) throw new Error("No snapshot for this bookmark");

    // Try to get snapshot data from OPFS
    let blob;
    try {
      blob = await OpfsStorage.read(bookmark.snapshotId);
    } catch {
      throw new Error("Snapshot data not found in storage");
    }

    const safeName = (bookmark.title || "snapshot").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const filename = `argus-snapshots/${safeName}-${bookmark.snapshotId}.html`;

    const results = {};
    // Upload to all connected blob providers (not GitHub — snapshots are binary/large)
    for (const key of ["google", "dropbox", "webdav", "s3"]) {
      try {
        const provider = CloudProviders[key];
        if (provider && await provider.isConnected()) {
          await provider.upload(blob, filename);
          results[key] = { success: true };
        }
      } catch (e) {
        results[key] = { success: false, error: e.message };
      }
    }
    console.log(`[BookmarkSync] Snapshot for "${bookmark.title}" synced:`, results);
    return { success: true, results };
  }

  return {
    createBackup,
    restoreFromBackup,
    uploadToProvider,
    listBackups,
    downloadBackup,
    uploadToAll,
    syncBookmarksToGitHub,
    syncBookmarkSnapshot,
  };
})();
