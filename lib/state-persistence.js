// lib/state-persistence.js
// MV3 State Persistence Layer
// Provides save/restore for in-memory Maps that are lost when service worker unloads
// Works in both MV2 (no-op save, globals persist) and MV3 (saves to storage.session)
//
// Usage: Call saveSessionState() periodically or after state changes
//        Call restoreSessionState() on service worker wake-up
//
// NOTE: This file is NOT yet wired into background.js.
// Wiring requires changing how conversationHistory, feedDetectionCache, etc.
// are declared — from const to let, and adding save calls after mutations.
// That's a careful refactor of background.js, not an append.

var ArgusStatePersistence = {
    // Registry of state keys and their serializers
    _registry: {},

    // Register a Map or object for persistence
    register: function(key, getter, setter) {
        this._registry[key] = { getter: getter, setter: setter };
    },

    // Save all registered state to storage.session (MV3) or storage.local (MV2 fallback)
    save: async function() {
        var data = {};
        for (var key in this._registry) {
            var value = this._registry[key].getter();
            if (value instanceof Map) {
                data[key] = Array.from(value.entries());
            } else if (value instanceof Set) {
                data[key] = Array.from(value);
            } else {
                data[key] = value;
            }
        }
        try {
            if (browser.storage.session) {
                await browser.storage.session.set({ _argusState: data });
            } else {
                await browser.storage.local.set({ _argusSessionState: data });
            }
        } catch (e) {
            console.warn('[StatePersistence] Save failed:', e.message);
        }
    },

    // Restore all registered state from storage
    restore: async function() {
        try {
            var result;
            if (browser.storage.session) {
                result = await browser.storage.session.get('_argusState');
            } else {
                result = await browser.storage.local.get('_argusSessionState');
            }
            var data = result._argusState || result._argusSessionState;
            if (!data) return;

            for (var key in this._registry) {
                if (data[key] === undefined) continue;
                var setter = this._registry[key].setter;
                var stored = data[key];
                // Reconstruct Maps from entries arrays
                if (Array.isArray(stored) && stored.length > 0 && Array.isArray(stored[0])) {
                    setter(new Map(stored));
                } else if (Array.isArray(stored)) {
                    setter(new Set(stored));
                } else {
                    setter(stored);
                }
            }
            console.log('[StatePersistence] State restored from storage');
        } catch (e) {
            console.warn('[StatePersistence] Restore failed:', e.message);
        }
    }
};
