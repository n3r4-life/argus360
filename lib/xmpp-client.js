/* ──────────────────────────────────────────────
   lib/xmpp-client.js  —  XMPP WebSocket client (Phase 2: bidirectional)
   Connects via WebSocket, SASL PLAIN auth, sends/receives <message> stanzas,
   handles presence, auto-reconnect, and event callbacks.
   No full XML parser — string templates + regex response parsing.
   ────────────────────────────────────────────── */

// eslint-disable-next-line no-unused-vars
const XmppClient = (() => {
  "use strict";

  const CONNECT_TIMEOUT = 5000;
  const AUTH_TIMEOUT    = 10000;
  const RECONNECT_BASE  = 2000;   // initial reconnect delay
  const RECONNECT_MAX   = 30000;  // max reconnect delay
  const PING_INTERVAL   = 60000;  // keepalive ping every 60s

  /**
   * Create a managed XMPP connection with event callbacks.
   * @param {Object} opts
   * @param {string} opts.wsUrl     - WebSocket endpoint (wss://...)
   * @param {string} opts.jid       - Full JID (user@domain)
   * @param {string} opts.password
   * @param {boolean} [opts.autoReconnect=true]
   * @param {function} [opts.onMessage]    - (msg: { from, to, body, type, id, timestamp }) => void
   * @param {function} [opts.onPresence]   - (pres: { from, type, show, status }) => void
   * @param {function} [opts.onStatus]     - (status: "connecting"|"connected"|"disconnected"|"error", detail?) => void
   * @returns {XmppConnection}
   */
  function createConnection(opts) {
    const {
      wsUrl, jid, password,
      autoReconnect = true,
      onMessage = () => {},
      onPresence = () => {},
      onStatus = () => {}
    } = opts;

    const [jidLocal, jidDomain] = jid.split("@");
    let ws = null;
    let boundJid = jid;       // full JID with resource after bind
    let connected = false;
    let intentionalClose = false;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let pingTimer = null;

    async function connect() {
      intentionalClose = false;
      onStatus("connecting");

      return new Promise((resolve, reject) => {
        try {
          ws = new WebSocket(wsUrl, "xmpp");
        } catch (e) {
          onStatus("error", "WebSocket creation failed: " + e.message);
          return reject(new Error("WebSocket creation failed: " + e.message));
        }

        let phase = "connecting";
        let authTimer = null;
        let buffer = "";

        const cleanup = () => { clearTimeout(authTimer); };

        const fail = (msg) => {
          cleanup();
          try { ws.close(); } catch (_) { /* */ }
          onStatus("error", msg);
          reject(new Error(msg));
        };

        const connectTimer = setTimeout(() => {
          if (phase === "connecting") fail("Connection timed out (" + CONNECT_TIMEOUT + "ms)");
        }, CONNECT_TIMEOUT);

        ws.onopen = () => {
          clearTimeout(connectTimer);
          phase = "stream";
          ws.send(`<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" to="${escapeXml(jidDomain)}" version="1.0"/>`);
          authTimer = setTimeout(() => {
            if (phase !== "ready") fail("Authentication timed out (" + AUTH_TIMEOUT + "ms)");
          }, AUTH_TIMEOUT);
        };

        ws.onerror = () => {
          clearTimeout(connectTimer);
          if (phase !== "ready") fail("WebSocket error during " + phase);
        };

        ws.onclose = (evt) => {
          clearTimeout(connectTimer);
          cleanup();
          if (phase !== "ready") {
            reject(new Error("Connection closed during " + phase + " (code " + evt.code + ")"));
          }
          _handleDisconnect();
        };

        ws.onmessage = (evt) => {
          const data = typeof evt.data === "string" ? evt.data : "";
          buffer += data;

          if (phase === "stream") {
            if (buffer.includes("</stream:features>") || buffer.includes("<mechanisms")) {
              phase = "auth";
              buffer = "";
              const authStr = btoa("\0" + jidLocal + "\0" + password);
              ws.send(`<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">${authStr}</auth>`);
            }
          } else if (phase === "auth") {
            if (buffer.includes("<success")) {
              phase = "bind";
              buffer = "";
              ws.send(`<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" to="${escapeXml(jidDomain)}" version="1.0"/>`);
            } else if (buffer.includes("<failure")) {
              const reason = extractTagContent(buffer, "text") || "SASL PLAIN authentication failed";
              fail("Auth failed: " + reason);
            }
          } else if (phase === "bind") {
            if (buffer.includes("</stream:features>") || buffer.includes("<bind")) {
              if (!buffer.includes("<bind")) {
                phase = "ready";
                buffer = "";
                cleanup();
                _onReady(resolve);
                return;
              }
              buffer = "";
              const resource = "argus-" + Math.random().toString(36).slice(2, 8);
              ws.send(
                `<iq type="set" id="bind1"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>${escapeXml(resource)}</resource></bind></iq>`
              );
            }
            if (buffer.includes("id=\"bind1\"") && buffer.includes("</iq>")) {
              // Extract bound JID
              const bjid = extractTagContent(buffer, "jid");
              if (bjid) boundJid = bjid;
              phase = "ready";
              buffer = "";
              cleanup();
              _onReady(resolve);
            }
          }
        };
      });
    }

    function _onReady(resolve) {
      connected = true;
      reconnectAttempts = 0;
      onStatus("connected");

      // Send initial presence
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("<presence/>");
      }

      // Install the persistent message handler
      ws.onmessage = _handleStanza;
      ws.onclose = () => _handleDisconnect();
      ws.onerror = () => { /* onclose will fire */ };

      // Start keepalive pings
      _startPing();

      resolve({ success: true, jid: boundJid });
    }

    function _handleStanza(evt) {
      const data = typeof evt.data === "string" ? evt.data : "";

      // Parse inbound <message> stanzas
      const msgMatches = data.matchAll(/<message[^>]*>([\s\S]*?)<\/message>/g);
      for (const m of msgMatches) {
        const full = m[0];
        const from = extractAttr(full, "from");
        const to = extractAttr(full, "to");
        const type = extractAttr(full, "type") || "chat";
        const id = extractAttr(full, "id") || "";
        const body = extractTagContent(full, "body");
        const delay = extractAttr(full, "stamp") || _extractDelayStamp(full);

        if (body) {
          onMessage({
            from: from || "",
            to: to || boundJid,
            body: unescapeXml(body),
            type,
            id,
            timestamp: delay ? new Date(delay).getTime() : Date.now()
          });
        }
      }

      // Parse <presence> stanzas
      const presMatches = data.matchAll(/<presence[^>]*?(?:\/>|>[\s\S]*?<\/presence>)/g);
      for (const m of presMatches) {
        const full = m[0];
        const from = extractAttr(full, "from");
        const type = extractAttr(full, "type") || "available";
        const show = extractTagContent(full, "show") || (type === "unavailable" ? "offline" : "online");
        const status = extractTagContent(full, "status") || "";

        onPresence({
          from: from || "",
          type,
          show,
          status: status ? unescapeXml(status) : ""
        });
      }
    }

    function _handleDisconnect() {
      const wasConnected = connected;
      connected = false;
      _stopPing();

      if (wasConnected) {
        onStatus("disconnected");
      }

      if (!intentionalClose && autoReconnect) {
        const delay = Math.min(RECONNECT_BASE * Math.pow(1.5, reconnectAttempts), RECONNECT_MAX);
        reconnectAttempts++;
        console.log(`[XMPP] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts})`);
        reconnectTimer = setTimeout(() => {
          connect().catch(e => {
            console.warn("[XMPP] Reconnect failed:", e.message);
            // _handleDisconnect will fire again from ws.onclose
          });
        }, delay);
      }
    }

    function _startPing() {
      _stopPing();
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const id = "ping-" + Date.now().toString(36);
          ws.send(`<iq type="get" id="${id}"><ping xmlns="urn:xmpp:ping"/></iq>`);
        }
      }, PING_INTERVAL);
    }

    function _stopPing() {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    }

    // ── Public API ──

    function sendMessage(to, body) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("XMPP WebSocket not connected"));
      }
      const id = "msg-" + Date.now().toString(36);
      const stanza = `<message type="chat" id="${escapeXml(id)}" to="${escapeXml(to)}" from="${escapeXml(boundJid)}"><body>${escapeXml(body)}</body></message>`;
      ws.send(stanza);
      return Promise.resolve({ id, to, chars: body.length });
    }

    function sendPresence(show, statusText) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      let stanza = "<presence>";
      if (show && show !== "online") stanza += `<show>${escapeXml(show)}</show>`;
      if (statusText) stanza += `<status>${escapeXml(statusText)}</status>`;
      stanza += "</presence>";
      ws.send(stanza);
    }

    function requestRoster() {
      if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.resolve([]);
      return new Promise((resolve) => {
        const id = "roster-" + Date.now().toString(36);
        const origHandler = ws.onmessage;
        let rosterBuffer = "";
        const timeout = setTimeout(() => { ws.onmessage = origHandler; resolve([]); }, 5000);

        ws.onmessage = (evt) => {
          const data = typeof evt.data === "string" ? evt.data : "";
          rosterBuffer += data;
          // Also pass through to normal handler
          origHandler(evt);

          if (rosterBuffer.includes(`id="${id}"`) && rosterBuffer.includes("</iq>")) {
            clearTimeout(timeout);
            ws.onmessage = origHandler;
            // Parse roster items
            const items = [];
            const itemMatches = rosterBuffer.matchAll(/<item[^>]*?(?:\/>|>[^<]*<\/item>)/g);
            for (const m of itemMatches) {
              const itemXml = m[0];
              items.push({
                jid: extractAttr(itemXml, "jid") || "",
                name: extractAttr(itemXml, "name") || "",
                subscription: extractAttr(itemXml, "subscription") || "none"
              });
            }
            resolve(items);
          }
        };

        ws.send(`<iq type="get" id="${id}"><query xmlns="jabber:iq:roster"/></iq>`);
      });
    }

    function disconnect() {
      intentionalClose = true;
      clearTimeout(reconnectTimer);
      _stopPing();
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("<presence type=\"unavailable\"/>");
            ws.send('<close xmlns="urn:ietf:params:xml:ns:xmpp-framing"/>');
          }
          ws.close();
        } catch (_) { /* best-effort */ }
        ws = null;
      }
      connected = false;
      onStatus("disconnected");
    }

    function isConnected() {
      return connected && ws && ws.readyState === WebSocket.OPEN;
    }

    function getJid() { return boundJid; }

    return {
      connect,
      sendMessage,
      sendPresence,
      requestRoster,
      disconnect,
      isConnected,
      getJid
    };
  }

  // ── Legacy API (backward-compat with Phase 1 background.js callers) ──

  function connect(wsUrl, jid, password) {
    return new Promise((resolve, reject) => {
      const conn = createConnection({ wsUrl, jid, password, autoReconnect: false });
      conn.connect().then(() => {
        // Return the raw WebSocket-like interface expected by Phase 1
        resolve(conn);
      }).catch(reject);
    });
  }

  function sendMessage(connOrWs, from, to, body) {
    // Phase 2 connection object
    if (connOrWs && typeof connOrWs.sendMessage === "function") {
      return connOrWs.sendMessage(to, body);
    }
    // Legacy Phase 1 raw WebSocket
    if (!connOrWs || connOrWs.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("XMPP WebSocket not connected"));
    }
    const id = "msg-" + Date.now().toString(36);
    const stanza = `<message type="chat" id="${escapeXml(id)}" to="${escapeXml(to)}" from="${escapeXml(from)}"><body>${escapeXml(body)}</body></message>`;
    connOrWs.send(stanza);
    return Promise.resolve({ id, to, chars: body.length });
  }

  function disconnect(connOrWs) {
    if (!connOrWs) return;
    if (typeof connOrWs.disconnect === "function") {
      connOrWs.disconnect();
      return;
    }
    // Legacy raw WebSocket
    try {
      if (connOrWs.readyState === WebSocket.OPEN) {
        connOrWs.send('<close xmlns="urn:ietf:params:xml:ns:xmpp-framing"/>');
      }
      connOrWs.close();
    } catch (_) { /* best-effort */ }
  }

  // ── Helpers ──

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function unescapeXml(str) {
    return String(str)
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  function extractTagContent(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`);
    const m = xml.match(re);
    return m ? m[1] : null;
  }

  function extractAttr(xml, attr) {
    const re = new RegExp(`${attr}=["']([^"']*)["']`);
    const m = xml.match(re);
    return m ? m[1] : null;
  }

  function _extractDelayStamp(xml) {
    // XEP-0203 delayed delivery
    const m = xml.match(/stamp=["']([^"']+)["']/);
    return m ? m[1] : null;
  }

  return { createConnection, connect, sendMessage, disconnect };
})();
