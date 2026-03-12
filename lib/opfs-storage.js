// ──────────────────────────────────────────────
// OPFS Storage Layer — binary blob storage for snapshots
// ──────────────────────────────────────────────
// Stores full HTML and PNG screenshots in the Origin Private File System.
// Metadata stays in IndexedDB (ArgusDB.Snapshots); OPFS holds the heavy files.

const OpfsStorage = (() => {
  "use strict";

  let _root = null;

  async function getRoot() {
    if (_root) return _root;
    _root = await navigator.storage.getDirectory();
    return _root;
  }

  async function getSnapshotDir(snapshotId, create = false) {
    const root = await getRoot();
    let snapDir;
    try {
      snapDir = await root.getDirectoryHandle("snapshots", { create });
    } catch {
      if (!create) return null;
      throw new Error("Failed to create snapshots directory");
    }
    try {
      return await snapDir.getDirectoryHandle(snapshotId, { create });
    } catch {
      if (!create) return null;
      throw new Error(`Failed to access snapshot directory: ${snapshotId}`);
    }
  }

  async function writeFile(dirHandle, filename, data) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  async function readFile(dirHandle, filename) {
    try {
      const fileHandle = await dirHandle.getFileHandle(filename);
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }

  return {
    // Write snapshot files (HTML text + PNG screenshot blob)
    async writeSnapshot(snapshotId, { html, screenshotBlob }) {
      const dir = await getSnapshotDir(snapshotId, true);
      const writes = [];
      if (html) writes.push(writeFile(dir, "page.html", html));
      if (screenshotBlob) writes.push(writeFile(dir, "screenshot.png", screenshotBlob));
      await Promise.all(writes);
      console.log(`[OPFS] Wrote snapshot ${snapshotId}: html=${!!html}, screenshot=${!!screenshotBlob}`);
    },

    // Read screenshot as object URL (caller must revoke when done)
    async readScreenshot(snapshotId) {
      const dir = await getSnapshotDir(snapshotId);
      if (!dir) return null;
      const file = await readFile(dir, "screenshot.png");
      if (!file) return null;
      return URL.createObjectURL(file);
    },

    // Read full HTML as string
    async readHtml(snapshotId) {
      const dir = await getSnapshotDir(snapshotId);
      if (!dir) return null;
      const file = await readFile(dir, "page.html");
      if (!file) return null;
      return await file.text();
    },

    // Delete a snapshot's OPFS directory
    async deleteSnapshot(snapshotId) {
      try {
        const root = await getRoot();
        const snapDir = await root.getDirectoryHandle("snapshots");
        await snapDir.removeEntry(snapshotId, { recursive: true });
      } catch { /* directory may not exist */ }
    },

    // Get total OPFS usage in bytes
    async getUsage() {
      try {
        const root = await getRoot();
        let snapDir;
        try { snapDir = await root.getDirectoryHandle("snapshots"); } catch { return 0; }
        let totalBytes = 0;
        for await (const [name, handle] of snapDir.entries()) {
          if (handle.kind === "directory") {
            for await (const [, fileHandle] of handle.entries()) {
              if (fileHandle.kind === "file") {
                const file = await fileHandle.getFile();
                totalBytes += file.size;
              }
            }
          }
        }
        return totalBytes;
      } catch { return 0; }
    },

    // Delete all OPFS data (snapshots directory)
    async deleteAll() {
      try {
        const root = await getRoot();
        await root.removeEntry("snapshots", { recursive: true });
        console.log("[OPFS] Deleted all snapshot data");
      } catch { /* directory may not exist */ }
    },

    // Request persistent storage (one-time user prompt)
    async requestPersist() {
      if (navigator.storage && navigator.storage.persist) {
        return await navigator.storage.persist();
      }
      return false;
    }
  };
})();
