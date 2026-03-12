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
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=token&scope=${encodeURIComponent(scopes)}`;

      const responseUrl = await browser.identity.launchWebAuthFlow({ interactive: true, url: authUrl });
      const hash = new URL(responseUrl).hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const expiresIn = parseInt(params.get("expires_in") || "3600", 10);
      if (!accessToken) throw new Error("No access token received");

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

    async ensureFolder(token) {
      // Find or create "Argus Backups" folder
      const searchResp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='Argus Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const searchData = await searchResp.json();
      if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

      // Create folder
      const createResp = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Argus Backups", mimeType: "application/vnd.google-apps.folder" })
      });
      const folder = await createResp.json();
      return folder.id;
    },

    async upload(blob, filename) {
      const token = await this.getToken();
      const folderId = await this.ensureFolder(token);
      const metadata = { name: filename, parents: [folderId] };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", blob);
      const resp = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form
      });
      if (!resp.ok) throw new Error(`Google Drive upload failed: ${resp.status}`);
      return resp.json();
    },

    async list() {
      const token = await this.getToken();
      const folderId = await this.ensureFolder(token);
      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      return (data.files || []).map(f => ({ name: f.name, size: parseInt(f.size || "0", 10), date: f.createdTime, id: f.id }));
    },

    async download(filename) {
      const token = await this.getToken();
      const files = await this.list();
      const file = files.find(f => f.name === filename);
      if (!file) throw new Error(`File not found: ${filename}`);
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error(`Google Drive download failed: ${resp.status}`);
      return resp.blob();
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

    async upload(blob, filename) {
      const cfg = await getProviderConfig("webdav");
      const resp = await fetch(`${cfg.url}/${filename}`, {
        method: "PUT",
        headers: { ...this._authHeaders(cfg), "Content-Type": "application/zip" },
        body: blob,
      });
      if (!resp.ok) throw new Error(`WebDAV upload failed: ${resp.status}`);
      return { success: true };
    },

    async list() {
      const cfg = await getProviderConfig("webdav");
      const resp = await fetch(cfg.url, {
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
      const resp = await fetch(`${cfg.url}/${filename}`, {
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

  return { google, dropbox, webdav, s3 };
})();
