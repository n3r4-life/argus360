// ──────────────────────────────────────────────
// Cloud Providers — Google Drive, Dropbox, WebDAV, S3-compatible
// Each provider: { connect, disconnect, isConnected, upload, list, download, testConnection }
// User provides their own credentials — zero data flows through Argus infrastructure.
// ──────────────────────────────────────────────

const CloudProviders = (() => {
  "use strict";

  const STORAGE_KEY = "argusCloudProviders";

  async function getConfig() {
    const data = await browser.storage.local.get({ [STORAGE_KEY]: {} });
    return data[STORAGE_KEY] || {};
  }

  async function saveConfig(cfg) {
    await browser.storage.local.set({ [STORAGE_KEY]: cfg });
  }

  async function getProviderConfig(key) {
    const cfg = await getConfig();
    return cfg[key] || {};
  }

  async function saveProviderConfig(key, data) {
    const cfg = await getConfig();
    cfg[key] = { ...cfg[key], ...data };
    await saveConfig(cfg);
  }

  async function clearProviderConfig(key) {
    const cfg = await getConfig();
    delete cfg[key];
    await saveConfig(cfg);
  }

  // ─── Google Drive (OAuth2 with user's own Client ID) ───

  const google = {
    async connect(clientId) {
      const redirectUrl = browser.identity.getRedirectURL();
      const scopes = "https://www.googleapis.com/auth/drive.file";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=token&scope=${encodeURIComponent(scopes)}&prompt=consent`;

      console.log("[GDrive] Redirect URI:", redirectUrl);
      console.log("[GDrive] Starting OAuth flow...");

      let responseUrl;
      try {
        responseUrl = await browser.identity.launchWebAuthFlow({ interactive: true, url: authUrl });
      } catch (e) {
        console.error("[GDrive] OAuth flow failed:", e);
        // Extract meaningful error from the exception
        const msg = e.message || String(e);
        if (msg.includes("redirect_uri_mismatch") || msg.includes("redirect")) {
          throw new Error(`Redirect URI mismatch. Add this EXACT URI to your GCP OAuth client's Authorized redirect URIs:\n${redirectUrl}`);
        }
        if (msg.includes("invalid_client")) {
          throw new Error("Invalid Client ID. Check that you copied the full Client ID from GCP Credentials.");
        }
        if (msg.includes("access_denied")) {
          throw new Error("Access denied. Make sure your Google email is listed as a Test User in the OAuth consent screen.");
        }
        if (msg.includes("User cancelled") || msg.includes("user denied") || msg.includes("cancelled")) {
          throw new Error("OAuth flow was cancelled.");
        }
        throw new Error(`Google OAuth error: ${msg}`);
      }

      // Check for error in the response URL (Google may redirect with error params)
      const responseUrlObj = new URL(responseUrl);
      const hashParams = new URLSearchParams(responseUrlObj.hash.substring(1));
      const queryParams = new URLSearchParams(responseUrlObj.search);
      const errorCode = hashParams.get("error") || queryParams.get("error");
      if (errorCode) {
        const errorDesc = hashParams.get("error_description") || queryParams.get("error_description") || errorCode;
        console.error("[GDrive] OAuth returned error:", errorCode, errorDesc);
        throw new Error(`Google OAuth error: ${decodeURIComponent(errorDesc)}`);
      }

      const accessToken = hashParams.get("access_token");
      const expiresIn = parseInt(hashParams.get("expires_in") || "3600", 10);
      if (!accessToken) throw new Error("No access token received from Google. The OAuth flow may have been interrupted.");

      // Get user email for display
      const userResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const userInfo = userResp.ok ? await userResp.json() : {};

      await saveProviderConfig("google", {
        clientId,
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
        userEmail: userInfo.email || "",
        connected: true,
      });
      return { success: true, email: userInfo.email };
    },

    async disconnect() {
      const cfg = await getProviderConfig("google");
      if (cfg.accessToken) {
        try { await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${cfg.accessToken}`); } catch {}
      }
      this._folderCache = {};
      await clearProviderConfig("google");
      return { success: true };
    },

    async isConnected() {
      const cfg = await getProviderConfig("google");
      return !!(cfg.connected && cfg.accessToken);
    },

    async getToken() {
      const cfg = await getProviderConfig("google");
      if (!cfg.accessToken) throw new Error("Not connected to Google Drive");
      // Token refresh not available with implicit flow — user must reconnect
      if (cfg.expiresAt && Date.now() > cfg.expiresAt) throw new Error("Google Drive token expired. Please reconnect.");
      return cfg.accessToken;
    },

    // Cache folder IDs during a sync session to avoid repeated lookups
    _folderCache: {},

    async ensureFolder(token, folderName, parentId) {
      // Default: root-level "Argus" folder
      const name = folderName || "Argus";
      const cacheKey = `${parentId || "root"}/${name}`;
      if (this._folderCache[cacheKey]) return this._folderCache[cacheKey];

      const parentClause = parentId
        ? `'${parentId}' in parents and`
        : "";
      const q = `${parentClause} name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const searchResp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const searchData = await searchResp.json();
      if (searchData.files && searchData.files.length > 0) {
        this._folderCache[cacheKey] = searchData.files[0].id;
        return searchData.files[0].id;
      }

      // Create folder
      const meta = { name, mimeType: "application/vnd.google-apps.folder" };
      if (parentId) meta.parents = [parentId];
      const createResp = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(meta)
      });
      if (!createResp.ok) throw new Error(`Failed to create folder "${name}": ${createResp.status}`);
      const folder = await createResp.json();
      this._folderCache[cacheKey] = folder.id;
      return folder.id;
    },

    // Resolve a path like "argus-snapshots/file.html" → create Argus > argus-snapshots, return folderId
    async ensureFolderPath(token, filePath) {
      const parts = filePath.split("/");
      const fileName = parts.pop(); // last segment is the file name
      // Always start with root "Argus" folder
      let parentId = await this.ensureFolder(token, "Argus", null);
      // Create any subfolder path
      for (const folder of parts) {
        parentId = await this.ensureFolder(token, folder, parentId);
      }
      return { folderId: parentId, fileName };
    },

    async upload(blob, filename) {
      const token = await this.getToken();
      const { folderId, fileName } = await this.ensureFolderPath(token, filename);
      const metadata = { name: fileName, parents: [folderId] };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", blob);
      const resp = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(`Google Drive upload failed: ${resp.status} ${err.error?.message || ""}`);
      }
      console.log(`[GDrive] Uploaded: Argus/${filename}`);
      return resp.json();
    },

    async list() {
      const token = await this.getToken();
      const rootId = await this.ensureFolder(token, "Argus", null);
      // List files recursively under Argus folder
      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${rootId}' in parents and trashed=false`)}&fields=files(id,name,size,createdTime,mimeType)&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      return (data.files || []).map(f => ({ name: f.name, size: parseInt(f.size || "0", 10), date: f.createdTime, id: f.id }));
    },

    async download(filename) {
      const token = await this.getToken();
      // Search by name anywhere under Argus folder tree
      const q = `name='${filename}' and trashed=false`;
      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      const file = (data.files || [])[0];
      if (!file) throw new Error(`File not found: ${filename}`);
      const dlResp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!dlResp.ok) throw new Error(`Google Drive download failed: ${dlResp.status}`);
      return dlResp.blob();
    },
  };

  // ─── Dropbox (OAuth2 PKCE with user's own App Key) ───

  const dropbox = {
    async connect(appKey) {
      // PKCE flow
      const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const redirectUrl = browser.identity.getRedirectURL();
      const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(appKey)}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256&token_access_type=offline`;

      const responseUrl = await browser.identity.launchWebAuthFlow({ interactive: true, url: authUrl });
      const code = new URL(responseUrl).searchParams.get("code");
      if (!code) throw new Error("No authorization code received");

      // Exchange code for token
      const tokenResp = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, grant_type: "authorization_code", client_id: appKey, redirect_uri: redirectUrl, code_verifier: codeVerifier })
      });
      if (!tokenResp.ok) throw new Error(`Token exchange failed: ${tokenResp.status}`);
      const tokenData = await tokenResp.json();

      // Get account info
      const acctResp = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" }, body: "null"
      });
      const acct = acctResp.ok ? await acctResp.json() : {};

      await saveProviderConfig("dropbox", {
        appKey,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in || 14400) * 1000,
        userName: acct.name?.display_name || "",
        connected: true,
      });
      return { success: true, userName: acct.name?.display_name };
    },

    async disconnect() {
      const cfg = await getProviderConfig("dropbox");
      if (cfg.accessToken) {
        try { await fetch("https://api.dropboxapi.com/2/auth/token/revoke", { method: "POST", headers: { Authorization: `Bearer ${cfg.accessToken}` } }); } catch {}
      }
      await clearProviderConfig("dropbox");
      return { success: true };
    },

    async isConnected() {
      const cfg = await getProviderConfig("dropbox");
      return !!(cfg.connected && cfg.accessToken);
    },

    async getToken() {
      let cfg = await getProviderConfig("dropbox");
      if (!cfg.accessToken) throw new Error("Not connected to Dropbox");
      // Refresh if expired
      if (cfg.expiresAt && Date.now() > cfg.expiresAt && cfg.refreshToken && cfg.appKey) {
        const resp = await fetch("https://api.dropboxapi.com/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: cfg.refreshToken, client_id: cfg.appKey })
        });
        if (!resp.ok) throw new Error("Dropbox token refresh failed. Please reconnect.");
        const data = await resp.json();
        await saveProviderConfig("dropbox", { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 14400) * 1000 });
        return data.access_token;
      }
      return cfg.accessToken;
    },

    async upload(blob, filename) {
      const token = await this.getToken();
      const resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({ path: `/Argus/${filename}`, mode: "overwrite", autorename: false }),
        },
        body: blob,
      });
      if (!resp.ok) throw new Error(`Dropbox upload failed: ${resp.status}`);
      return resp.json();
    },

    async list() {
      const token = await this.getToken();
      const resp = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/Argus", recursive: false }),
      });
      if (!resp.ok) {
        if (resp.status === 409) return []; // folder doesn't exist yet
        throw new Error(`Dropbox list failed: ${resp.status}`);
      }
      const data = await resp.json();
      return (data.entries || []).filter(e => e[".tag"] === "file").map(e => ({ name: e.name, size: e.size, date: e.server_modified }));
    },

    async download(filename) {
      const token = await this.getToken();
      const resp = await fetch("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: `/Argus/${filename}` }),
        },
      });
      if (!resp.ok) throw new Error(`Dropbox download failed: ${resp.status}`);
      return resp.blob();
    },
  };

  // ─── WebDAV (generic — Nextcloud, ownCloud, Synology, NAS) ───

  const webdav = {
    async isConnected() {
      const cfg = await getProviderConfig("webdav");
      return !!(cfg.connected && cfg.url);
    },

    async connect(url, username, password) {
      await saveProviderConfig("webdav", { url: url.replace(/\/+$/, ""), username, password, connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("webdav");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("webdav");
      if (!cfg.url) throw new Error("WebDAV URL not configured");
      const resp = await fetch(cfg.url, {
        method: "PROPFIND",
        headers: { ...this._authHeaders(cfg), Depth: "0" },
      });
      if (!resp.ok) throw new Error(`WebDAV connection failed: ${resp.status} ${resp.statusText}`);
      return { success: true };
    },

    _authHeaders(cfg) {
      if (cfg.username && cfg.password) {
        return { Authorization: "Basic " + btoa(`${cfg.username}:${cfg.password}`) };
      }
      return {};
    },

    _basePath(cfg) {
      const base = cfg.url.replace(/\/+$/, "");
      const folder = (cfg.folder || "").replace(/^\/+|\/+$/g, "");
      return folder ? `${base}/${folder}` : base;
    },

    async upload(blob, filename) {
      const cfg = await getProviderConfig("webdav");
      const base = this._basePath(cfg);
      const resp = await fetch(`${base}/${filename}`, {
        method: "PUT",
        headers: { ...this._authHeaders(cfg), "Content-Type": "application/octet-stream" },
        body: blob,
      });
      if (!resp.ok) throw new Error(`WebDAV upload failed: ${resp.status}`);
      return { success: true };
    },

    async list() {
      const cfg = await getProviderConfig("webdav");
      const base = this._basePath(cfg);
      const resp = await fetch(base, {
        method: "PROPFIND",
        headers: { ...this._authHeaders(cfg), Depth: "1", "Content-Type": "application/xml" },
      });
      if (!resp.ok) throw new Error(`WebDAV list failed: ${resp.status}`);
      const text = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "application/xml");
      const responses = doc.querySelectorAll("response");
      const files = [];
      for (const r of responses) {
        const href = r.querySelector("href")?.textContent || "";
        const name = decodeURIComponent(href.split("/").filter(Boolean).pop() || "");
        const size = parseInt(r.querySelector("getcontentlength")?.textContent || "0", 10);
        const date = r.querySelector("getlastmodified")?.textContent || "";
        if (name && name.endsWith(".zip")) files.push({ name, size, date });
      }
      return files;
    },

    async download(filename) {
      const cfg = await getProviderConfig("webdav");
      const base = this._basePath(cfg);
      const resp = await fetch(`${base}/${filename}`, {
        method: "GET",
        headers: this._authHeaders(cfg),
      });
      if (!resp.ok) throw new Error(`WebDAV download failed: ${resp.status}`);
      return resp.blob();
    },
  };

  // ─── S3-compatible (AWS, Backblaze B2, Wasabi, Cloudflare R2, MinIO) ───

  const s3 = {
    async isConnected() {
      const cfg = await getProviderConfig("s3");
      return !!(cfg.connected && cfg.endpoint && cfg.bucket && cfg.accessKey && cfg.secretKey);
    },

    async connect(endpoint, bucket, accessKey, secretKey, region) {
      await saveProviderConfig("s3", { endpoint: endpoint.replace(/\/+$/, ""), bucket, accessKey, secretKey, region: region || "us-east-1", connected: true });
      return this.testConnection();
    },

    async disconnect() {
      await clearProviderConfig("s3");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("s3");
      const resp = await this._signedRequest(cfg, "GET", `?list-type=2&max-keys=1`);
      if (!resp.ok) throw new Error(`S3 connection failed: ${resp.status}`);
      return { success: true };
    },

    // Minimal AWS Signature V4
    async _signedRequest(cfg, method, pathAndQuery, body, contentType) {
      const url = new URL(`${cfg.endpoint}/${cfg.bucket}${pathAndQuery.startsWith("/") || pathAndQuery.startsWith("?") ? "" : "/"}${pathAndQuery}`);
      const now = new Date();
      const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const shortDate = dateStamp.slice(0, 8);
      const region = cfg.region || "us-east-1";
      const service = "s3";
      const scope = `${shortDate}/${region}/${service}/aws4_request`;

      const payloadHash = await this._sha256Hex(body || "");
      const headers = {
        Host: url.host,
        "x-amz-date": dateStamp,
        "x-amz-content-sha256": payloadHash,
      };
      if (contentType) headers["Content-Type"] = contentType;

      const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
      const signedHeaders = signedHeaderKeys.join(";");
      const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k.split("-").map((p,i) => i===0?p:p[0].toUpperCase()+p.slice(1)).join("-")] || headers[k]}\n`).join("");

      // Rebuild canonical headers properly
      const headerMap = {};
      for (const [k, v] of Object.entries(headers)) headerMap[k.toLowerCase()] = v;
      const canonHeaders = signedHeaderKeys.map(k => `${k}:${headerMap[k]}\n`).join("");

      const canonicalRequest = [method, url.pathname, url.search.replace(/^\?/, ""), canonHeaders, signedHeaders, payloadHash].join("\n");
      const stringToSign = ["AWS4-HMAC-SHA256", dateStamp, scope, await this._sha256Hex(canonicalRequest)].join("\n");

      const signingKey = await this._getSignatureKey(cfg.secretKey, shortDate, region, service);
      const signature = await this._hmacHex(signingKey, stringToSign);

      headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      return fetch(url.toString(), { method, headers, body: body || undefined });
    },

    async _sha256Hex(data) {
      const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const hash = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    },

    async _hmac(key, data) {
      const cryptoKey = await crypto.subtle.importKey("raw", typeof key === "string" ? new TextEncoder().encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, typeof data === "string" ? new TextEncoder().encode(data) : data));
    },

    async _hmacHex(key, data) {
      const sig = await this._hmac(key, data);
      return Array.from(sig).map(b => b.toString(16).padStart(2, "0")).join("");
    },

    async _getSignatureKey(secretKey, dateStamp, region, service) {
      let key = await this._hmac("AWS4" + secretKey, dateStamp);
      key = await this._hmac(key, region);
      key = await this._hmac(key, service);
      key = await this._hmac(key, "aws4_request");
      return key;
    },

    async upload(blob, filename) {
      const cfg = await getProviderConfig("s3");
      const body = new Uint8Array(await blob.arrayBuffer());
      const resp = await this._signedRequest(cfg, "PUT", `/argus-backups/${filename}`, body, "application/zip");
      if (!resp.ok) throw new Error(`S3 upload failed: ${resp.status}`);
      return { success: true };
    },

    async list() {
      const cfg = await getProviderConfig("s3");
      const resp = await this._signedRequest(cfg, "GET", `?list-type=2&prefix=argus-backups/`);
      if (!resp.ok) throw new Error(`S3 list failed: ${resp.status}`);
      const text = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "application/xml");
      const contents = doc.querySelectorAll("Contents");
      const files = [];
      for (const c of contents) {
        const key = c.querySelector("Key")?.textContent || "";
        const name = key.split("/").pop();
        const size = parseInt(c.querySelector("Size")?.textContent || "0", 10);
        const date = c.querySelector("LastModified")?.textContent || "";
        if (name) files.push({ name, size, date });
      }
      return files;
    },

    async download(filename) {
      const cfg = await getProviderConfig("s3");
      const resp = await this._signedRequest(cfg, "GET", `/argus-backups/${filename}`);
      if (!resp.ok) throw new Error(`S3 download failed: ${resp.status}`);
      return resp.blob();
    },
  };

  // ─── GitHub (PAT + Contents API) ───

  const github = {
    async connect(pat, repo, branch = "main") {
      if (!pat || !repo) throw new Error("PAT and repo (owner/name) are required");
      // Test connection by fetching repo info
      const resp = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || `GitHub API ${resp.status}`);
      }
      const repoData = await resp.json();
      await saveProviderConfig("github", { pat, repo, branch, repoName: repoData.full_name, connected: true });
      return { success: true, repo: repoData.full_name };
    },

    async disconnect() {
      await clearProviderConfig("github");
      return { success: true };
    },

    async isConnected() {
      const cfg = await getProviderConfig("github");
      return !!(cfg.connected && cfg.pat && cfg.repo);
    },

    async testConnection() {
      const cfg = await getProviderConfig("github");
      if (!cfg.pat || !cfg.repo) throw new Error("Not configured");
      const resp = await fetch(`https://api.github.com/repos/${cfg.repo}`, {
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json" },
      });
      if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
      return { success: true, repo: cfg.repo };
    },

    async upload(blob, filename) {
      const cfg = await getProviderConfig("github");
      if (!cfg.pat || !cfg.repo) throw new Error("GitHub not configured");
      const branch = cfg.branch || "main";
      const path = `argus-backups/${filename}`;
      const content = btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));

      // Check if file already exists (need its SHA to update)
      let sha;
      try {
        const existing = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}?ref=${branch}`, {
          headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json" },
        });
        if (existing.ok) {
          const data = await existing.json();
          sha = data.sha;
        }
      } catch { /* file doesn't exist yet */ }

      const body = { message: `Argus backup: ${filename}`, content, branch };
      if (sha) body.sha = sha;
      const resp = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `Upload failed: ${resp.status}`);
      }
      return { success: true };
    },

    async uploadJson(jsonObj, path) {
      const cfg = await getProviderConfig("github");
      if (!cfg.pat || !cfg.repo) throw new Error("GitHub not configured");
      const branch = cfg.branch || "main";
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(jsonObj, null, 2))));

      let sha;
      try {
        const existing = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}?ref=${branch}`, {
          headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json" },
        });
        if (existing.ok) {
          const data = await existing.json();
          sha = data.sha;
        }
      } catch {}

      const body = { message: `Argus sync: ${path}`, content, branch };
      if (sha) body.sha = sha;
      const resp = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const msg = err.message || `Upload failed: ${resp.status}`;
        if (resp.status === 403 || resp.status === 404) {
          throw new Error(`${msg} — Check PAT has "Contents: Read and write" permission for this repo.`);
        }
        throw new Error(msg);
      }
      return { success: true };
    },

    async list() {
      const cfg = await getProviderConfig("github");
      if (!cfg.pat || !cfg.repo) throw new Error("GitHub not configured");
      const branch = cfg.branch || "main";
      const resp = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/argus-backups?ref=${branch}`, {
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json" },
      });
      if (resp.status === 404) return []; // no backups yet
      if (!resp.ok) throw new Error(`List failed: ${resp.status}`);
      const items = await resp.json();
      return items.filter(i => i.type === "file").map(i => ({ name: i.name, size: i.size, date: "" }));
    },

    async download(filename) {
      const cfg = await getProviderConfig("github");
      if (!cfg.pat || !cfg.repo) throw new Error("GitHub not configured");
      const branch = cfg.branch || "main";
      const resp = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/argus-backups/${filename}?ref=${branch}`, {
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github.raw" },
      });
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      return resp.blob();
    },
  };

  // ─── GitHub Gist (uses same PAT as GitHub repo provider) ───

  const gist = {
    async isConnected() {
      const cfg = await getProviderConfig("gist");
      return !!(cfg.connected && cfg.pat);
    },

    async connect(pat) {
      if (!pat) throw new Error("GitHub PAT is required");
      const resp = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" },
      });
      if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
      const user = await resp.json();
      await saveProviderConfig("gist", { pat, username: user.login, connected: true });
      return { success: true, user: user.login };
    },

    async disconnect() {
      await clearProviderConfig("gist");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("gist");
      if (!cfg.pat) throw new Error("Not configured");
      const resp = await fetch("https://api.github.com/gists?per_page=1", {
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json" },
      });
      if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
      return { success: true, user: cfg.username };
    },

    // Create a secret gist with one or more files
    async createPaste(title, files, isPublic = false) {
      const cfg = await getProviderConfig("gist");
      if (!cfg.pat) throw new Error("Gist not configured");
      const gistFiles = {};
      for (const [name, content] of Object.entries(files)) {
        gistFiles[name] = { content };
      }
      const resp = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ description: title, public: isPublic, files: gistFiles }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `Gist creation failed: ${resp.status}`);
      }
      const data = await resp.json();
      console.log(`[Gist] Created: ${data.html_url}`);
      return { success: true, url: data.html_url, id: data.id };
    },

    // Update an existing gist
    async updatePaste(gistId, files) {
      const cfg = await getProviderConfig("gist");
      if (!cfg.pat) throw new Error("Gist not configured");
      const gistFiles = {};
      for (const [name, content] of Object.entries(files)) {
        gistFiles[name] = { content };
      }
      const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ files: gistFiles }),
      });
      if (!resp.ok) throw new Error(`Gist update failed: ${resp.status}`);
      const data = await resp.json();
      return { success: true, url: data.html_url, id: data.id };
    },

    // List user's gists (Argus-tagged ones)
    async list() {
      const cfg = await getProviderConfig("gist");
      if (!cfg.pat) throw new Error("Gist not configured");
      const resp = await fetch("https://api.github.com/gists?per_page=30", {
        headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/vnd.github+json" },
      });
      if (!resp.ok) throw new Error(`Gist list failed: ${resp.status}`);
      const gists = await resp.json();
      return gists
        .filter(g => g.description && g.description.startsWith("Argus"))
        .map(g => ({ id: g.id, title: g.description, url: g.html_url, date: g.updated_at, files: Object.keys(g.files) }));
    },
  };

  // ─── Pastebin (API key from pastebin.com/doc_api) ───

  const pastebin = {
    async isConnected() {
      const cfg = await getProviderConfig("pastebin");
      return !!(cfg.connected && cfg.apiKey);
    },

    async connect(apiKey, username, password) {
      if (!apiKey) throw new Error("Pastebin API key is required");
      // If username/password provided, get a user session key for private pastes
      let userKey = "";
      if (username && password) {
        const resp = await fetch("https://pastebin.com/api/api_login.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ api_dev_key: apiKey, api_user_name: username, api_user_password: password }),
        });
        if (!resp.ok) throw new Error(`Pastebin login failed: ${resp.status}`);
        const text = await resp.text();
        if (text.startsWith("Bad API request")) throw new Error(text);
        userKey = text;
      }
      await saveProviderConfig("pastebin", { apiKey, userKey, username: username || "", connected: true });
      return { success: true, user: username || "anonymous" };
    },

    async disconnect() {
      await clearProviderConfig("pastebin");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("pastebin");
      if (!cfg.apiKey) throw new Error("Not configured");
      // Test by listing pastes (if user key available) or just validate the key format
      if (cfg.userKey) {
        const resp = await fetch("https://pastebin.com/api/api_post.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ api_dev_key: cfg.apiKey, api_user_key: cfg.userKey, api_option: "list", api_results_limit: "1" }),
        });
        const text = await resp.text();
        if (text.startsWith("Bad API request") && !text.includes("no pastes")) throw new Error(text);
      }
      return { success: true, user: cfg.username || "anonymous" };
    },

    // Create a paste
    // visibility: 0 = public, 1 = unlisted, 2 = private (needs user key)
    async createPaste(title, content, visibility = 1, format = "text", expiry = "N") {
      const cfg = await getProviderConfig("pastebin");
      if (!cfg.apiKey) throw new Error("Pastebin not configured");
      const params = {
        api_dev_key: cfg.apiKey,
        api_option: "paste",
        api_paste_code: content,
        api_paste_name: title,
        api_paste_private: String(visibility),
        api_paste_format: format,
        api_paste_expire_date: expiry, // N=never, 10M, 1H, 1D, 1W, 2W, 1M, 6M, 1Y
      };
      if (cfg.userKey) params.api_user_key = cfg.userKey;
      const resp = await fetch("https://pastebin.com/api/api_post.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      });
      const text = await resp.text();
      if (text.startsWith("Bad API request")) throw new Error(text);
      console.log(`[Pastebin] Created: ${text}`);
      return { success: true, url: text.trim() };
    },

    // List user's pastes (requires user key)
    async list() {
      const cfg = await getProviderConfig("pastebin");
      if (!cfg.apiKey || !cfg.userKey) return [];
      const resp = await fetch("https://pastebin.com/api/api_post.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ api_dev_key: cfg.apiKey, api_user_key: cfg.userKey, api_option: "list", api_results_limit: "50" }),
      });
      const text = await resp.text();
      if (text.startsWith("Bad API request")) return [];
      // Parse XML response
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<root>${text}</root>`, "text/xml");
      const pastes = doc.querySelectorAll("paste");
      return Array.from(pastes).map(p => ({
        key: p.querySelector("paste_key")?.textContent || "",
        title: p.querySelector("paste_title")?.textContent || "",
        url: p.querySelector("paste_url")?.textContent || "",
        date: p.querySelector("paste_date")?.textContent || "",
        size: parseInt(p.querySelector("paste_size")?.textContent || "0", 10),
        visibility: p.querySelector("paste_private")?.textContent || "0",
      }));
    },
  };

  // ─── PrivateBin (self-hosted, zero-knowledge encrypted) ───

  const privatebin = {
    async isConnected() {
      const cfg = await getProviderConfig("privatebin");
      return !!(cfg.connected && cfg.url);
    },

    async connect(url) {
      if (!url) throw new Error("PrivateBin server URL is required");
      const cleanUrl = url.replace(/\/+$/, "");
      // Test connection by fetching the API endpoint
      const resp = await fetch(`${cleanUrl}/?jsonld=paste`, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) throw new Error(`PrivateBin server unreachable: ${resp.status}`);
      await saveProviderConfig("privatebin", { url: cleanUrl, connected: true });
      return { success: true, url: cleanUrl };
    },

    async disconnect() {
      await clearProviderConfig("privatebin");
      return { success: true };
    },

    async testConnection() {
      const cfg = await getProviderConfig("privatebin");
      if (!cfg.url) throw new Error("Not configured");
      const resp = await fetch(`${cfg.url}/?jsonld=paste`, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) throw new Error(`PrivateBin unreachable: ${resp.status}`);
      return { success: true, url: cfg.url };
    },

    // Create an encrypted paste using PrivateBin API v2
    // PrivateBin uses client-side encryption — we encrypt before sending
    async createPaste(content, expiry = "1week", burnAfterReading = false, openDiscussion = false) {
      const cfg = await getProviderConfig("privatebin");
      if (!cfg.url) throw new Error("PrivateBin not configured");

      // Generate random 256-bit key
      const key = crypto.getRandomValues(new Uint8Array(32));
      const iv = crypto.getRandomValues(new Uint8Array(16));
      const salt = crypto.getRandomValues(new Uint8Array(8));
      const iterations = 100000;

      // Derive AES key from the random key using PBKDF2
      const cryptoKey = await crypto.subtle.importKey("raw", key, "PBKDF2", false, ["deriveKey"]);
      const aesKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        cryptoKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );

      // Compress with no compression (PrivateBin expects specific format)
      const plaintext = JSON.stringify({ paste: content });
      const encoded = new TextEncoder().encode(plaintext);

      // AES-GCM encrypt
      const adata = [[btoa(String.fromCharCode(...iv)), btoa(String.fromCharCode(...salt)), iterations, 256, 128, "aes", "gcm", "none"], "plaintext", openDiscussion ? 1 : 0, burnAfterReading ? 1 : 0];
      const adataBytes = new TextEncoder().encode(JSON.stringify(adata));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: adataBytes, tagLength: 128 },
        aesKey,
        encoded
      );

      const ct = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      const body = {
        v: 2,
        adata,
        ct,
        meta: { expire: expiry },
      };

      const resp = await fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "JSONHttpRequest" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error(`PrivateBin paste failed: ${resp.status}`);
      const result = await resp.json();
      if (result.status !== 0) throw new Error(result.message || "PrivateBin paste failed");

      // Build URL with key fragment (never sent to server)
      const keyBase58 = btoa(String.fromCharCode(...key)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const pasteUrl = `${cfg.url}/?${result.id}#${keyBase58}`;

      console.log(`[PrivateBin] Created: ${pasteUrl}`);
      return { success: true, url: pasteUrl, id: result.id, deleteToken: result.deletetoken };
    },
  };

  return { google, dropbox, webdav, s3, github, gist, pastebin, privatebin };
})();
