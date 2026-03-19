// wigle-cache-db.js — Persistent WiGLE zone cache (separate from ArgusDB)
// Stores every WiGLE query result so zones can be reused without API calls
// Each entry: { id (auto), bbox:[w,s,e,n], zoom, networks:[], ts, center:{lat,lon} }

var WigleCacheDB = (function() {
    var DB_NAME = 'argus-wigle-cache';
    var DB_VERSION = 1;
    var STORE = 'zones';
    var _db = null;

    function open() {
        if (_db) return Promise.resolve(_db);
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    var store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('ts', 'ts');
                }
            };
            req.onsuccess = function() { _db = req.result; resolve(_db); };
            req.onerror = function() { reject(req.error); };
        });
    }

    return {
        // Save a WiGLE zone query result
        saveZone: async function(bbox, zoom, networks) {
            var db = await open();
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readwrite');
                var store = tx.objectStore(STORE);
                var entry = {
                    bbox: bbox, // [west, south, east, north]
                    zoom: zoom,
                    networks: networks,
                    ts: Date.now(),
                    center: {
                        lat: (bbox[1] + bbox[3]) / 2,
                        lon: (bbox[0] + bbox[2]) / 2
                    },
                    networkCount: networks.length
                };
                var req = store.add(entry);
                req.onsuccess = function() { entry.id = req.result; resolve(entry); };
                req.onerror = function() { reject(req.error); };
            });
        },

        // Get all stored zones
        getAllZones: async function() {
            var db = await open();
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readonly');
                var store = tx.objectStore(STORE);
                var req = store.getAll();
                req.onsuccess = function() { resolve(req.result || []); };
                req.onerror = function() { reject(req.error); };
            });
        },

        // Find all zones that overlap with the given viewport bbox
        findOverlapping: async function(viewBbox) {
            var zones = await this.getAllZones();
            var vW = viewBbox[0], vS = viewBbox[1], vE = viewBbox[2], vN = viewBbox[3];
            return zones.filter(function(z) {
                var b = z.bbox;
                // Standard rectangle overlap test
                if (b[2] < vW || b[0] > vE) return false; // no horizontal overlap
                if (b[3] < vS || b[1] > vN) return false; // no vertical overlap
                return true;
            });
        },

        // Merge networks from multiple zones, deduplicate by BSSID
        mergeNetworks: function(zones) {
            var seen = {};
            var merged = [];
            for (var i = 0; i < zones.length; i++) {
                var networks = zones[i].networks || [];
                for (var j = 0; j < networks.length; j++) {
                    var n = networks[j];
                    var key = n.netid || (n.trilat + ',' + n.trilong);
                    if (!seen[key]) {
                        seen[key] = true;
                        merged.push(n);
                    }
                }
            }
            return merged;
        },

        // Check if the viewport is fully covered by existing zones
        // Returns true if at least one stored zone fully contains the viewport
        isFullyCovered: async function(viewBbox) {
            var zones = await this.getAllZones();
            var vW = viewBbox[0], vS = viewBbox[1], vE = viewBbox[2], vN = viewBbox[3];
            for (var i = 0; i < zones.length; i++) {
                var b = zones[i].bbox;
                if (b[0] <= vW && b[1] <= vS && b[2] >= vE && b[3] >= vN) {
                    return true; // this zone fully contains the viewport
                }
            }
            return false;
        },

        // Get total stats
        getStats: async function() {
            var zones = await this.getAllZones();
            var totalNetworks = 0;
            for (var i = 0; i < zones.length; i++) {
                totalNetworks += zones[i].networkCount || 0;
            }
            return { zones: zones.length, networks: totalNetworks };
        },

        // Clear all cached zones
        clearAll: async function() {
            var db = await open();
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readwrite');
                var store = tx.objectStore(STORE);
                var req = store.clear();
                req.onsuccess = function() { resolve(); };
                req.onerror = function() { reject(req.error); };
            });
        }
    };
})();
