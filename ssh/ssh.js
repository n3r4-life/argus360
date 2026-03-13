// Argus Terminal — Multi-protocol WebSocket terminal
(function () {
  "use strict";

  // ── DOM refs ──
  const form         = document.getElementById("connect-form");
  const fProtocol    = document.getElementById("f-protocol");
  const fUrl         = document.getElementById("f-url");
  const urlLabel     = document.getElementById("url-label");
  const sshFields    = document.getElementById("ssh-fields");
  const fHost        = document.getElementById("f-host");
  const fPort        = document.getElementById("f-port");
  const fUser        = document.getElementById("f-user");
  const fPassword    = document.getElementById("f-password");
  const fKey         = document.getElementById("f-key");
  const fPassphrase  = document.getElementById("f-passphrase");
  const fKeyFile     = document.getElementById("f-key-file");
  const btnConnect   = document.getElementById("btn-connect");
  const btnDisconnect = document.getElementById("btn-disconnect");
  const btnSave      = document.getElementById("btn-save-session");
  const statusEl     = document.getElementById("conn-status");
  const termDiv      = document.getElementById("terminal");
  const placeholder  = document.getElementById("terminal-placeholder");
  const sessionsList = document.getElementById("saved-sessions");
  const sessionCount = document.getElementById("ssh-session-count");
  const panel        = document.getElementById("ssh-panel-connect");
  const panelTab     = document.getElementById("ssh-panel-tab");
  const panelClose   = document.getElementById("ssh-panel-close");
  const panelDrag    = document.getElementById("ssh-panel-drag");
  const guideTtyd    = document.getElementById("guide-ttyd");
  const guideRaw     = document.getElementById("guide-raw");
  const guideProxy   = document.getElementById("guide-proxy");

  // ── State ──
  let term = null;
  let fitAddon = null;
  let ws = null;
  let currentAuth = "password";
  let activeProtocol = null;

  // ════════════════════════════════════════════════
  // Protocol handlers — each implements { connect, send, sendResize, cleanup }
  // ════════════════════════════════════════════════

  const Protocols = {

    // ── ttyd protocol ──
    // Binary frames: first byte = message type
    // Client→Server: 0=input, 1=resize JSON
    // Server→Client: 0=output, 1=setWindowTitle, 2=setPreferences, 3=setReconnect
    ttyd: {
      name: "ttyd",
      connect(url, _opts) {
        return new Promise((resolve, reject) => {
          const protocols = ["tty"];
          ws = new WebSocket(url, protocols);
          ws.binaryType = "arraybuffer";

          ws.onopen = () => {
            // ttyd expects a JSON auth token as first message (or empty for no auth)
            // Send initial terminal size
            const sizeMsg = JSON.stringify({ columns: term.cols, rows: term.rows });
            const buf = new Uint8Array(1 + sizeMsg.length);
            buf[0] = 1; // resize type
            for (let i = 0; i < sizeMsg.length; i++) buf[i + 1] = sizeMsg.charCodeAt(i);
            ws.send(buf.buffer);
            resolve();
          };

          ws.onmessage = (evt) => {
            if (typeof evt.data === "string") {
              // Some ttyd versions send initial JSON config as text
              term.write(evt.data);
              return;
            }
            const data = new Uint8Array(evt.data);
            if (data.length < 1) return;
            const type = data[0];
            const payload = data.slice(1);

            switch (type) {
              case 0: // output
                term.write(payload);
                break;
              case 1: // setWindowTitle
                document.title = new TextDecoder().decode(payload) + " — Argus";
                break;
              case 2: // setPreferences (JSON)
                // Could apply theme/font preferences from server
                break;
            }
          };

          ws.onclose = (evt) => {
            term.writeln(`\r\n\x1b[90m── Connection closed (code: ${evt.code}) ──\x1b[0m`);
            cleanupConnection();
          };

          ws.onerror = () => {
            reject(new Error("WebSocket connection failed"));
          };
        });
      },

      send(data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        // Type 0 = input
        const encoded = new TextEncoder().encode(data);
        const buf = new Uint8Array(1 + encoded.length);
        buf[0] = 0;
        buf.set(encoded, 1);
        ws.send(buf.buffer);
      },

      sendResize(cols, rows) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const json = JSON.stringify({ columns: cols, rows: rows });
        const buf = new Uint8Array(1 + json.length);
        buf[0] = 1;
        for (let i = 0; i < json.length; i++) buf[i + 1] = json.charCodeAt(i);
        ws.send(buf.buffer);
      }
    },

    // ── Raw WebSocket ──
    // Simple bidirectional text/binary — works with websockify, basic proxies
    // Sends optional JSON auth on connect, then raw terminal I/O
    "raw-ws": {
      name: "raw-ws",
      connect(url, opts) {
        return new Promise((resolve, reject) => {
          ws = new WebSocket(url);
          ws.binaryType = "arraybuffer";

          ws.onopen = () => {
            // If SSH credentials provided, send as initial JSON handshake
            if (opts.user) {
              const authMsg = { type: "auth", username: opts.user };
              if (opts.password) authMsg.password = opts.password;
              if (opts.key) { authMsg.key = opts.key; authMsg.passphrase = opts.passphrase; }
              if (opts.host) { authMsg.host = opts.host; authMsg.port = opts.port || 22; }
              ws.send(JSON.stringify(authMsg));
            }
            resolve();
          };

          ws.onmessage = (evt) => {
            if (typeof evt.data === "string") {
              // Check for JSON control messages
              try {
                const msg = JSON.parse(evt.data);
                if (msg.type === "error") {
                  term.writeln(`\r\n\x1b[31mError: ${msg.message}\x1b[0m`);
                  return;
                }
                if (msg.type === "ready") {
                  term.writeln(`\x1b[32mConnected.\x1b[0m\r\n`);
                  return;
                }
                if (msg.type === "data") {
                  term.write(msg.data);
                  return;
                }
              } catch (_) {
                // Not JSON — treat as raw terminal output
              }
              term.write(evt.data);
            } else {
              term.write(new Uint8Array(evt.data));
            }
          };

          ws.onclose = (evt) => {
            term.writeln(`\r\n\x1b[90m── Connection closed (code: ${evt.code}) ──\x1b[0m`);
            cleanupConnection();
          };

          ws.onerror = () => {
            reject(new Error("WebSocket connection failed"));
          };
        });
      },

      send(data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(data);
      },

      sendResize(cols, rows) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    },

    // ── SSH Proxy (webssh2-compatible) ──
    // Connects to a WebSocket SSH proxy that handles the SSH protocol server-side
    // Protocol: JSON messages with type field
    "ssh-proxy": {
      name: "ssh-proxy",
      connect(url, opts) {
        return new Promise((resolve, reject) => {
          ws = new WebSocket(url);
          ws.binaryType = "arraybuffer";

          ws.onopen = () => {
            // Send SSH connection request
            ws.send(JSON.stringify({
              type: "connect",
              host: opts.host || "localhost",
              port: parseInt(opts.port) || 22,
              username: opts.user || "root",
              authType: opts.key ? "publickey" : "password",
              password: opts.password || undefined,
              privateKey: opts.key || undefined,
              passphrase: opts.passphrase || undefined,
              cols: term.cols,
              rows: term.rows
            }));
            resolve();
          };

          ws.onmessage = (evt) => {
            if (typeof evt.data === "string") {
              try {
                const msg = JSON.parse(evt.data);
                switch (msg.type) {
                  case "data":
                    term.write(msg.data);
                    return;
                  case "error":
                    term.writeln(`\r\n\x1b[31m${msg.message || msg.error}\x1b[0m`);
                    return;
                  case "ready":
                  case "connected":
                    term.writeln(`\x1b[32mSSH session established.\x1b[0m\r\n`);
                    return;
                  case "hostkey":
                    // Auto-accept for now (MVP) — could add fingerprint verification UI later
                    ws.send(JSON.stringify({ type: "hostkey-accept" }));
                    return;
                  case "banner":
                    if (msg.message) term.write(msg.message);
                    return;
                }
              } catch (_) {}
              // Raw text fallback
              term.write(evt.data);
            } else {
              term.write(new Uint8Array(evt.data));
            }
          };

          ws.onclose = (evt) => {
            term.writeln(`\r\n\x1b[90m── SSH session ended (code: ${evt.code}) ──\x1b[0m`);
            cleanupConnection();
          };

          ws.onerror = () => {
            reject(new Error("WebSocket connection failed"));
          };
        });
      },

      send(data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "data", data }));
      },

      sendResize(cols, rows) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    }
  };

  // ════════════════════════════════════════════════
  // UI: Protocol switching
  // ════════════════════════════════════════════════

  const protocolConfig = {
    ttyd:       { showSSH: false, urlHint: "ws://yourserver:7681/ws",            urlName: "ttyd URL" },
    "raw-ws":   { showSSH: true,  urlHint: "ws://yourserver:2222",               urlName: "Relay URL" },
    "ssh-proxy":{ showSSH: true,  urlHint: "ws://yourserver:2222/ssh/host/target",urlName: "Proxy URL" }
  };

  function updateProtocolUI() {
    const proto = fProtocol.value;
    const cfg = protocolConfig[proto];
    sshFields.classList.toggle("hidden", !cfg.showSSH);
    fUrl.placeholder = cfg.urlHint;
    urlLabel.textContent = cfg.urlName;
    // Toggle guides
    guideTtyd.classList.toggle("hidden", proto !== "ttyd");
    guideRaw.classList.toggle("hidden", proto !== "raw-ws");
    guideProxy.classList.toggle("hidden", proto !== "ssh-proxy");
  }

  fProtocol.addEventListener("change", updateProtocolUI);
  updateProtocolUI();

  // ════════════════════════════════════════════════
  // Floating panel: toggle, close, drag
  // ════════════════════════════════════════════════

  function togglePanel() {
    panel.classList.toggle("hidden");
    PanelState.save("ssh", "connect", { visible: !panel.classList.contains("hidden") });
  }

  panelTab.addEventListener("click", togglePanel);
  panelClose.addEventListener("click", () => {
    panel.classList.add("hidden");
    PanelState.save("ssh", "connect", { visible: false });
  });

  PanelState.apply(panel, "ssh", "connect");

  (function setupPanelDrag() {
    let dragging = false, offsetX = 0, offsetY = 0;

    panelDrag.addEventListener("mousedown", (e) => {
      if (e.target.closest(".ssh-panel-close")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      panel.classList.add("dragging");
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - 100));
      const y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - 60));
      panel.style.left = x + "px";
      panel.style.top = y + "px";
      panel.style.right = "auto";
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("dragging");
      const rect = panel.getBoundingClientRect();
      PanelState.save("ssh", "connect", { left: rect.left, top: rect.top });
    });
  })();

  // ════════════════════════════════════════════════
  // Auth tab switching + key file upload
  // ════════════════════════════════════════════════

  document.querySelectorAll(".ssh-auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ssh-auth-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentAuth = tab.dataset.auth;
      document.getElementById("auth-password").classList.toggle("hidden", currentAuth !== "password");
      document.getElementById("auth-key").classList.toggle("hidden", currentAuth !== "key");
    });
  });

  fKeyFile.addEventListener("change", () => {
    const file = fKeyFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { fKey.value = reader.result; };
    reader.readAsText(file);
  });

  // ════════════════════════════════════════════════
  // Terminal setup
  // ════════════════════════════════════════════════

  function initTerminal() {
    if (term) { term.dispose(); term = null; }

    term = new window.Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace',
      theme: {
        background: "#0f0f1a",
        foreground: "#c8c8d8",
        cursor: "#e94560",
        cursorAccent: "#0f0f1a",
        selectionBackground: "rgba(233, 69, 96, 0.3)",
        black: "#1a1a2e",
        red: "#e94560",
        green: "#4caf50",
        yellow: "#ffc107",
        blue: "#2196f3",
        magenta: "#9c27b0",
        cyan: "#00bcd4",
        white: "#c8c8d8",
        brightBlack: "#4a4a6a",
        brightRed: "#ff6b81",
        brightGreen: "#69f0ae",
        brightYellow: "#fff176",
        brightBlue: "#64b5f6",
        brightMagenta: "#ce93d8",
        brightCyan: "#4dd0e1",
        brightWhite: "#ffffff"
      },
      allowProposedApi: true
    });

    fitAddon = new window.FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new window.WebLinksAddon.WebLinksAddon());

    term.open(termDiv);
    fitAddon.fit();

    new ResizeObserver(() => { if (fitAddon) fitAddon.fit(); }).observe(termDiv);

    return term;
  }

  // ════════════════════════════════════════════════
  // Connection lifecycle
  // ════════════════════════════════════════════════

  function setStatus(state, text) {
    statusEl.textContent = text || state;
    statusEl.className = "ssh-header-status " + state;
  }

  function showTerminal() {
    placeholder.classList.add("hidden");
    termDiv.classList.add("active");
    if (fitAddon) setTimeout(() => fitAddon.fit(), 50);
  }

  async function doConnect(proto, url, opts) {
    if (ws) disconnect();

    const handler = Protocols[proto];
    if (!handler) return;
    activeProtocol = handler;

    setStatus("connecting", "Connecting…");
    btnConnect.disabled = true;
    btnDisconnect.disabled = false;

    initTerminal();
    showTerminal();

    term.writeln(`\x1b[90m── Argus Terminal ──\x1b[0m`);
    term.writeln(`\x1b[90mProtocol: \x1b[37m${handler.name}\x1b[90m → \x1b[37m${url}\x1b[0m`);
    if (opts.user) term.writeln(`\x1b[90mUser: \x1b[37m${opts.user}${opts.host ? "@" + opts.host : ""}\x1b[0m`);
    term.writeln("");

    try {
      await handler.connect(url, opts);
      setStatus("connected", opts.user ? `${opts.user}@${opts.host || url}` : url.replace(/^wss?:\/\//, ""));
      btnSave.disabled = false;

      // Pipe terminal input through protocol handler
      term.onData(data => handler.send(data));
      term.onResize(({ cols, rows }) => handler.sendResize(cols, rows));

    } catch (err) {
      term.writeln(`\x1b[31mFailed: ${err.message}\x1b[0m`);
      term.writeln(`\x1b[90mCheck that your relay/server is running and accessible.\x1b[0m`);
      cleanupConnection();
    }
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    cleanupConnection();
  }

  function cleanupConnection() {
    ws = null;
    activeProtocol = null;
    setStatus("", "Disconnected");
    btnConnect.disabled = false;
    btnDisconnect.disabled = true;
    btnSave.disabled = true;
  }

  // ════════════════════════════════════════════════
  // Form submit
  // ════════════════════════════════════════════════

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const proto = fProtocol.value;
    const url   = fUrl.value.trim();

    if (!url) { fUrl.focus(); return; }

    const opts = {};
    if (proto !== "ttyd") {
      opts.host = fHost.value.trim();
      opts.port = fPort.value || "22";
      opts.user = fUser.value.trim();
      if (currentAuth === "password") {
        opts.password = fPassword.value;
      } else {
        opts.key = fKey.value;
        opts.passphrase = fPassphrase.value || undefined;
      }
    }

    doConnect(proto, url, opts);
    panel.classList.add("hidden");
  });

  btnDisconnect.addEventListener("click", disconnect);

  // ════════════════════════════════════════════════
  // Saved sessions
  // ════════════════════════════════════════════════

  async function loadSessions() {
    try {
      const { sshSessions } = await browser.storage.local.get("sshSessions");
      renderSessions(sshSessions || []);
    } catch (_) {
      renderSessions([]);
    }
  }

  function renderSessions(sessions) {
    sessionCount.textContent = sessions.length ? `${sessions.length}` : "";
    if (!sessions.length) {
      sessionsList.innerHTML = '<p class="ssh-empty">No saved sessions yet.</p>';
      return;
    }
    sessionsList.innerHTML = "";
    for (const s of sessions) {
      const item = document.createElement("div");
      item.className = "ssh-session-item";
      const label = s.name || (s.user ? `${s.user}@${s.host || ""}` : s.url);
      const badge = s.protocol === "ttyd" ? "ttyd" : s.protocol === "ssh-proxy" ? "proxy" : "raw";
      item.innerHTML = `
        <span class="ssh-session-badge">${esc(badge)}</span>
        <span class="ssh-session-name">${esc(label)}</span>
        <button class="ssh-session-remove" title="Remove">&times;</button>
      `;
      item.querySelector(".ssh-session-remove").addEventListener("click", (ev) => {
        ev.stopPropagation();
        removeSession(s.id);
      });
      item.addEventListener("click", () => fillFromSession(s));
      sessionsList.appendChild(item);
    }
  }

  function fillFromSession(s) {
    fProtocol.value = s.protocol || "ttyd";
    updateProtocolUI();
    fUrl.value = s.url || "";
    fHost.value = s.host || "";
    fPort.value = s.port || "22";
    fUser.value = s.user || "";
    fPassword.value = "";
    fKey.value = "";
    fPassphrase.value = "";
  }

  async function saveCurrentSession() {
    const url = fUrl.value.trim();
    if (!url) return;

    const session = {
      id: Date.now().toString(36),
      protocol: fProtocol.value,
      url,
      host: fHost.value.trim(),
      port: fPort.value || "22",
      user: fUser.value.trim(),
      name: ""
    };
    // Generate display name
    if (session.user && session.host) {
      session.name = `${session.user}@${session.host}`;
    } else {
      session.name = url.replace(/^wss?:\/\//, "").replace(/\/.*$/, "");
    }

    try {
      const { sshSessions } = await browser.storage.local.get("sshSessions");
      const sessions = sshSessions || [];
      const existing = sessions.findIndex(s => s.url === session.url && s.user === session.user);
      if (existing >= 0) sessions[existing] = session;
      else sessions.push(session);
      await browser.storage.local.set({ sshSessions: sessions });
      renderSessions(sessions);
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  }

  async function removeSession(id) {
    try {
      const { sshSessions } = await browser.storage.local.get("sshSessions");
      const sessions = (sshSessions || []).filter(s => s.id !== id);
      await browser.storage.local.set({ sshSessions: sessions });
      renderSessions(sessions);
    } catch (e) {
      console.error("Failed to remove session:", e);
    }
  }

  btnSave.addEventListener("click", saveCurrentSession);

  // ── Utils ──
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Init ──
  loadSessions();
})();
