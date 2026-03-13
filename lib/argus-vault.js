// Argus Vault — PBKDF2 + AES-GCM encryption via Web Crypto API
// Runs in background script context. Holds derived key in memory (cleared on browser restart).
"use strict";

const ArgusVault = (() => {
  const ALGO = "AES-GCM";
  const KEY_LENGTH = 256;
  const PBKDF2_ITERATIONS = 100000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const VERIFY_PLAINTEXT = "argus-vault-ok";

  // In-memory session key — cleared on browser/extension restart
  let _sessionKey = null;
  let _vaultType = null; // "pin4", "pin6", "password"

  // ── Helpers ──

  function toBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  function fromBase64(b64) {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
  }

  async function deriveKey(passcode, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      keyMaterial,
      { name: ALGO, length: KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptWithKey(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGO, iv },
      key,
      enc.encode(plaintext)
    );
    return { iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
  }

  async function decryptWithKey(key, ivB64, ciphertextB64) {
    const iv = fromBase64(ivB64);
    const ciphertext = fromBase64(ciphertextB64);
    const plainBuf = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plainBuf);
  }

  // ── Public API ──

  return {
    // Check if vault is configured (has a passcode set)
    async isEnabled() {
      const { vaultConfig } = await browser.storage.local.get("vaultConfig");
      return !!(vaultConfig && vaultConfig.salt && vaultConfig.verify);
    },

    // Check if vault is currently unlocked (key in memory)
    isUnlocked() {
      return _sessionKey !== null;
    },

    getVaultType() {
      return _vaultType;
    },

    // Get full status
    async getStatus() {
      const enabled = await this.isEnabled();
      return {
        enabled,
        unlocked: _sessionKey !== null,
        type: _vaultType || null
      };
    },

    // Setup a new passcode — encrypts a verification blob
    // type: "pin4", "pin6", "password"
    async setup(passcode, type) {
      if (!passcode || !type) throw new Error("Passcode and type required");

      const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
      const key = await deriveKey(passcode, salt);

      // Create verification blob
      const verify = await encryptWithKey(key, VERIFY_PLAINTEXT);

      // Store config (salt + verification, never the passcode)
      await browser.storage.local.set({
        vaultConfig: {
          type,
          salt: toBase64(salt),
          verify
        }
      });

      // Hold key in memory
      _sessionKey = key;
      _vaultType = type;

      // Encrypt any existing sensitive data
      await this._encryptSensitiveData();

      return { success: true };
    },

    // Attempt to unlock with a passcode
    async unlock(passcode) {
      const { vaultConfig } = await browser.storage.local.get("vaultConfig");
      if (!vaultConfig) throw new Error("Vault not configured");

      const salt = fromBase64(vaultConfig.salt);
      const key = await deriveKey(passcode, salt);

      // Verify by decrypting the verification blob
      try {
        const plain = await decryptWithKey(key, vaultConfig.verify.iv, vaultConfig.verify.ciphertext);
        if (plain !== VERIFY_PLAINTEXT) throw new Error("Mismatch");
      } catch (_) {
        return { success: false, error: "Incorrect passcode" };
      }

      _sessionKey = key;
      _vaultType = vaultConfig.type;

      // Restore plaintext copies so existing code works (encrypted copies stay)
      await this._restorePlaintext();

      return { success: true };
    },

    // Lock — remove plaintext copies, clear key
    async lock() {
      await this._removePlaintext();
      _sessionKey = null;
      return { success: true };
    },

    // On background startup: if vault enabled, remove any leftover plaintext
    async onStartup() {
      const enabled = await this.isEnabled();
      if (enabled) {
        await this._removePlaintext();
      }
    },

    // Change passcode — requires current unlock
    async changePasscode(newPasscode, newType) {
      if (!_sessionKey) throw new Error("Vault must be unlocked first");

      // Decrypt all sensitive data with current key
      const decrypted = await this._decryptSensitiveData();

      // Setup with new passcode (will re-encrypt)
      const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
      const key = await deriveKey(newPasscode, salt);
      const verify = await encryptWithKey(key, VERIFY_PLAINTEXT);

      await browser.storage.local.set({
        vaultConfig: {
          type: newType,
          salt: toBase64(salt),
          verify
        }
      });

      _sessionKey = key;
      _vaultType = newType;

      // Re-encrypt with new key
      await this._encryptSensitiveData();

      return { success: true };
    },

    // Remove vault — decrypts all data, removes config
    async remove() {
      if (!_sessionKey) throw new Error("Vault must be unlocked first");

      // Decrypt everything back to plaintext
      await this._decryptSensitiveData();

      // Remove vault config
      await browser.storage.local.remove("vaultConfig");
      _sessionKey = null;
      _vaultType = null;

      return { success: true };
    },

    // Encrypt a string (for external use, e.g., backup encryption)
    async encrypt(plaintext) {
      if (!_sessionKey) throw new Error("Vault locked");
      return encryptWithKey(_sessionKey, plaintext);
    },

    // Decrypt a string
    async decrypt(ivB64, ciphertextB64) {
      if (!_sessionKey) throw new Error("Vault locked");
      return decryptWithKey(_sessionKey, ivB64, ciphertextB64);
    },

    // ── Internal: encrypt/decrypt sensitive storage fields ──

    // Keys in browser.storage.local that contain sensitive data
    _sensitiveKeys: [
      "providers",       // AI provider API keys
      "dataProviders",   // Cloud provider credentials
      "sshSessions",     // SSH saved sessions (hosts, usernames, relay URLs)
      "pasteProviders",  // Paste service credentials
    ],

    // Encrypt plaintext data into _vault_ keys, remove plaintext
    async _encryptSensitiveData() {
      if (!_sessionKey) return;

      const data = await browser.storage.local.get(this._sensitiveKeys);
      const encrypted = {};

      for (const key of this._sensitiveKeys) {
        if (data[key] === undefined) continue;
        const json = JSON.stringify(data[key]);
        const blob = await encryptWithKey(_sessionKey, json);
        encrypted["_vault_" + key] = blob;
      }

      if (Object.keys(encrypted).length > 0) {
        await browser.storage.local.set(encrypted);
        const toRemove = this._sensitiveKeys.filter(k => data[k] !== undefined);
        if (toRemove.length > 0) await browser.storage.local.remove(toRemove);
      }
    },

    // Decrypt _vault_ keys back to plaintext AND remove encrypted copies (for vault removal)
    async _decryptSensitiveData() {
      if (!_sessionKey) return {};

      const vaultKeys = this._sensitiveKeys.map(k => "_vault_" + k);
      const data = await browser.storage.local.get(vaultKeys);
      const decrypted = {};

      for (const key of this._sensitiveKeys) {
        const blob = data["_vault_" + key];
        if (!blob) continue;
        try {
          const json = await decryptWithKey(_sessionKey, blob.iv, blob.ciphertext);
          decrypted[key] = JSON.parse(json);
        } catch (_) { /* skip corrupted */ }
      }

      if (Object.keys(decrypted).length > 0) {
        await browser.storage.local.set(decrypted);
        await browser.storage.local.remove(vaultKeys.filter(k => data[k]));
      }

      return decrypted;
    },

    // Restore plaintext copies from encrypted (keeps _vault_ keys intact)
    async _restorePlaintext() {
      if (!_sessionKey) return;

      const vaultKeys = this._sensitiveKeys.map(k => "_vault_" + k);
      const data = await browser.storage.local.get(vaultKeys);
      const restored = {};

      for (const key of this._sensitiveKeys) {
        const blob = data["_vault_" + key];
        if (!blob) continue;
        try {
          const json = await decryptWithKey(_sessionKey, blob.iv, blob.ciphertext);
          restored[key] = JSON.parse(json);
        } catch (_) { /* skip */ }
      }

      if (Object.keys(restored).length > 0) {
        await browser.storage.local.set(restored);
      }
    },

    // Remove plaintext copies (encrypted _vault_ copies remain)
    async _removePlaintext() {
      // Only remove if encrypted copies exist
      const vaultKeys = this._sensitiveKeys.map(k => "_vault_" + k);
      const data = await browser.storage.local.get(vaultKeys);
      const toRemove = [];

      for (const key of this._sensitiveKeys) {
        if (data["_vault_" + key]) toRemove.push(key);
      }

      if (toRemove.length > 0) {
        await browser.storage.local.remove(toRemove);
      }
    },

    // Read a sensitive key — returns decrypted value if vault is active, or plaintext if not
    async readSensitive(key) {
      if (!this._sensitiveKeys.includes(key)) {
        const data = await browser.storage.local.get(key);
        return data[key];
      }

      // Check for encrypted version first
      const vaultKey = "_vault_" + key;
      const data = await browser.storage.local.get([key, vaultKey]);

      if (data[vaultKey] && _sessionKey) {
        try {
          const json = await decryptWithKey(_sessionKey, data[vaultKey].iv, data[vaultKey].ciphertext);
          return JSON.parse(json);
        } catch (_) {
          return undefined;
        }
      }

      // Fallback to plaintext
      return data[key];
    },

    // Write a sensitive key — encrypts if vault is active
    async writeSensitive(key, value) {
      if (_sessionKey && this._sensitiveKeys.includes(key)) {
        const json = JSON.stringify(value);
        const blob = await encryptWithKey(_sessionKey, json);
        await browser.storage.local.set({ ["_vault_" + key]: blob });
        await browser.storage.local.remove(key);
      } else {
        await browser.storage.local.set({ [key]: value });
      }
    }
  };
})();
