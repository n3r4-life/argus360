/* ──────────────────────────────────────────────
   shared/cloud-sync.js  —  Reusable cloud push/pull module
   All crypto and transport stays in the background SW.
   Import on any page; calls background via browser.runtime.sendMessage.
   ────────────────────────────────────────────── */

// eslint-disable-next-line no-unused-vars
const CloudSync = (() => {
  "use strict";

  /**
   * Get connected provider status.
   * @returns {Promise<{success, providers:{google,dropbox,webdav,s3,github}}>}
   */
  async function getStatus() {
    try {
      return await browser.runtime.sendMessage({ action: "cloudGetStatus" });
    } catch {
      return { success: false, providers: {} };
    }
  }

  /**
   * Save a chat session as a markdown file to all connected cloud providers.
   * @param {Object} session
   * @param {string} session.title
   * @param {Array<{type:'user'|'ai', text:string}>} session.messages
   * @param {string} [session.conversationId]
   * @param {string} [session.source]  e.g. "argus-home"
   * @returns {Promise<{success, results:[{provider, success, error?}]}>}
   */
  async function saveChat(session) {
    try {
      return await browser.runtime.sendMessage({ action: "cloudSaveChat", session });
    } catch (e) {
      return { success: false, error: e.message, results: [] };
    }
  }

  /**
   * Push arbitrary text/JSON content to a specific provider (or all connected).
   * @param {string} path     - Relative path, e.g. "notes/ideas.md"
   * @param {string} content  - File content as string
   * @param {string} [providerKey]  - "google"|"dropbox"|"webdav"|"s3"|"github"; omit for all
   * @returns {Promise<{success, results?}>}
   */
  async function pushFile(path, content, providerKey) {
    try {
      return await browser.runtime.sendMessage({ action: "cloudPushFile", path, content, providerKey });
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * List saved chat sessions from a provider.
   * @param {string} providerKey
   * @returns {Promise<{success, files:[{name, size, date}]}>}
   */
  async function listSessions(providerKey) {
    try {
      return await browser.runtime.sendMessage({ action: "cloudListSessions", providerKey });
    } catch (e) {
      return { success: false, files: [], error: e.message };
    }
  }

  return { getStatus, saveChat, pushFile, listSessions };
})();
