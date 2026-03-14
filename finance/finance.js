(async () => {
  "use strict";

  const STORAGE_KEY = "financeMonitor";

  // ── State ──
  let state = {
    watchlist: [],   // { id, type, symbol, name, pinned, price, change, changePct, volume }
    wallets: [],     // { id, chain, address, label, balance, usdValue }
    alerts: [],      // { id, symbol, condition, threshold, enabled, triggered, triggeredAt }
    events: [],      // { id, date, title, description, tag }
    pinned: [],      // IDs of items pinned to ticker tape
  };

  // ── Persistence ──
  async function loadState() {
    try {
      const { [STORAGE_KEY]: saved } = await browser.storage.local.get({ [STORAGE_KEY]: null });
      if (saved) state = { ...state, ...saved };
    } catch { /* first load */ }
  }

  async function saveState() {
    await browser.storage.local.set({ [STORAGE_KEY]: state });
  }

  // ── Ticker Tape ──
  function renderTickerTape() {
    const tape = document.getElementById("tickerTape");
    const addBtn = document.getElementById("tickerAddBtn");
    // Remove existing pills
    tape.querySelectorAll(".fin-ticker-pill").forEach(el => el.remove());

    const pinnedItems = state.watchlist.filter(i => state.pinned.includes(i.id));
    for (const item of pinnedItems) {
      const pill = document.createElement("div");
      pill.className = "fin-ticker-pill";
      pill.title = item.name || item.symbol;

      const typeIcon = getTypeIcon(item.type);
      pill.innerHTML = `
        <span class="fin-ticker-icon">${typeIcon}</span>
        <span class="fin-ticker-symbol">${item.symbol}</span>
        <span class="fin-ticker-price">${formatPrice(item.price)}</span>
        <span class="fin-ticker-change ${changeClass(item.changePct)}">${formatChange(item.changePct)}</span>
      `;
      pill.addEventListener("click", () => scrollToWatchlistItem(item.id));
      tape.insertBefore(pill, addBtn);
    }

    // Also show pinned wallets
    const pinnedWallets = state.wallets.filter(w => state.pinned.includes(w.id));
    for (const w of pinnedWallets) {
      const pill = document.createElement("div");
      pill.className = "fin-ticker-pill";
      pill.title = w.label || w.address;
      pill.innerHTML = `
        <span class="fin-ticker-symbol">${w.chain.toUpperCase()}</span>
        <span class="fin-ticker-price">${formatPrice(w.usdValue)}</span>
      `;
      tape.insertBefore(pill, addBtn);
    }
  }

  // ── Watchlist ──
  function renderWatchlist() {
    const body = document.getElementById("watchlistBody");
    const empty = document.getElementById("watchlistEmpty");
    const badge = document.getElementById("watchlistCount");
    body.innerHTML = "";

    badge.textContent = state.watchlist.length;

    if (!state.watchlist.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    for (const item of state.watchlist) {
      const tr = document.createElement("tr");
      tr.id = `wl-${item.id}`;
      const isPinned = state.pinned.includes(item.id);
      tr.innerHTML = `
        <td><span class="fin-type-badge ${item.type}">${item.type}</span></td>
        <td><strong>${item.symbol}</strong></td>
        <td>${item.name || ""}</td>
        <td class="col-price">${formatPrice(item.price)}</td>
        <td class="col-change">
          <span class="fin-ticker-change ${changeClass(item.changePct)}">${formatChange(item.changePct)}</span>
        </td>
        <td class="col-vol">${item.volume ? formatVolume(item.volume) : "—"}</td>
        <td>
          <button class="fin-pin-btn" data-id="${item.id}" title="${isPinned ? "Unpin from tape" : "Pin to tape"}"
                  style="background:none;border:none;cursor:pointer;color:${isPinned ? "var(--accent)" : "var(--text-muted)"};font-size:14px;">
            ${isPinned ? "&#9733;" : "&#9734;"}
          </button>
          <button class="fin-rm-btn" data-id="${item.id}" title="Remove"
                  style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;margin-left:4px;">
            &times;
          </button>
        </td>
      `;
      body.appendChild(tr);
    }

    // Pin/unpin handlers
    body.querySelectorAll(".fin-pin-btn").forEach(btn => {
      btn.addEventListener("click", () => togglePin(btn.dataset.id));
    });
    body.querySelectorAll(".fin-rm-btn").forEach(btn => {
      btn.addEventListener("click", () => removeWatchlistItem(btn.dataset.id));
    });
  }

  function togglePin(id) {
    const idx = state.pinned.indexOf(id);
    if (idx >= 0) state.pinned.splice(idx, 1);
    else state.pinned.push(id);
    saveState();
    renderWatchlist();
    renderTickerTape();
  }

  function removeWatchlistItem(id) {
    state.watchlist = state.watchlist.filter(i => i.id !== id);
    state.pinned = state.pinned.filter(p => p !== id);
    saveState();
    renderWatchlist();
    renderTickerTape();
  }

  function scrollToWatchlistItem(id) {
    const el = document.getElementById(`wl-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── Wallets ──
  function renderWallets() {
    const container = document.getElementById("walletsList");
    const empty = document.getElementById("walletsEmpty");
    const badge = document.getElementById("walletCount");
    container.innerHTML = "";

    badge.textContent = state.wallets.length;

    if (!state.wallets.length) {
      container.appendChild(empty);
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    for (const w of state.wallets) {
      const div = document.createElement("div");
      div.className = "fin-wallet-item";
      const isPinned = state.pinned.includes(w.id);
      div.innerHTML = `
        <div class="fin-wallet-icon ${w.chain}">${w.chain.slice(0, 2).toUpperCase()}</div>
        <div class="fin-wallet-info">
          <div class="fin-wallet-label">${w.label || w.chain.toUpperCase() + " Wallet"}</div>
          <div class="fin-wallet-addr" title="${w.address}">${w.address}</div>
        </div>
        <div class="fin-wallet-balance">
          <div>${w.balance || "—"} ${w.chain.toUpperCase()}</div>
          <div class="fin-wallet-usd">${w.usdValue ? formatPrice(w.usdValue) : ""}</div>
        </div>
        <button class="fin-pin-btn" data-id="${w.id}" title="${isPinned ? "Unpin" : "Pin"}"
                style="background:none;border:none;cursor:pointer;color:${isPinned ? "var(--accent)" : "var(--text-muted)"};font-size:14px;">
          ${isPinned ? "&#9733;" : "&#9734;"}
        </button>
        <button class="fin-rm-wallet" data-id="${w.id}" title="Remove"
                style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;">
          &times;
        </button>
      `;
      container.appendChild(div);
    }

    container.querySelectorAll(".fin-pin-btn").forEach(btn => {
      btn.addEventListener("click", () => togglePin(btn.dataset.id));
    });
    container.querySelectorAll(".fin-rm-wallet").forEach(btn => {
      btn.addEventListener("click", () => {
        state.wallets = state.wallets.filter(w => w.id !== btn.dataset.id);
        state.pinned = state.pinned.filter(p => p !== btn.dataset.id);
        saveState();
        renderWallets();
        renderTickerTape();
      });
    });
  }

  // ── Alerts ──
  function renderAlerts() {
    const container = document.getElementById("alertsList");
    const empty = document.getElementById("alertsEmpty");
    const badge = document.getElementById("alertCount");
    container.innerHTML = "";

    badge.textContent = state.alerts.length;

    if (!state.alerts.length) {
      container.appendChild(empty);
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    for (const a of state.alerts) {
      const div = document.createElement("div");
      div.className = "fin-alert-item";
      const statusClass = a.triggered ? "triggered" : (a.enabled ? "active" : "inactive");
      div.innerHTML = `
        <div class="fin-alert-dot ${statusClass}"></div>
        <div class="fin-alert-info">
          <div class="fin-alert-condition">
            <strong>${a.symbol}</strong> ${a.condition} ${formatPrice(a.threshold)}
          </div>
          <div class="fin-alert-status">
            ${a.triggered ? "Triggered " + (a.triggeredAt || "") : (a.enabled ? "Active" : "Paused")}
          </div>
        </div>
        <button class="fin-rm-alert" data-id="${a.id}" title="Remove"
                style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;">
          &times;
        </button>
      `;
      container.appendChild(div);
    }

    container.querySelectorAll(".fin-rm-alert").forEach(btn => {
      btn.addEventListener("click", () => {
        state.alerts = state.alerts.filter(a => a.id !== btn.dataset.id);
        saveState();
        renderAlerts();
      });
    });
  }

  // ── Calendar ──
  function renderCalendar() {
    const container = document.getElementById("calendarList");
    const empty = document.getElementById("calendarEmpty");
    container.innerHTML = "";

    if (!state.events.length) {
      container.appendChild(empty);
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    // Sort by date
    const sorted = [...state.events].sort((a, b) => new Date(a.date) - new Date(b.date));
    for (const ev of sorted) {
      const d = new Date(ev.date);
      const div = document.createElement("div");
      div.className = "fin-event-item";
      div.innerHTML = `
        <div class="fin-event-date">
          ${d.toLocaleDateString("en", { month: "short" }).toUpperCase()}
          <span class="day">${d.getDate()}</span>
        </div>
        <div class="fin-event-info">
          <div class="fin-event-title">${ev.title}</div>
          <div class="fin-event-desc">${ev.description || ""}</div>
          ${ev.tag ? `<span class="fin-event-tag">${ev.tag}</span>` : ""}
        </div>
      `;
      container.appendChild(div);
    }
  }

  // ── Sentiment ──
  function renderSentiment() {
    // Placeholder — in a real implementation this would fetch from Fear & Greed API
    const val = document.getElementById("sentimentValue");
    const text = document.getElementById("sentimentText");
    const needle = document.getElementById("sentimentNeedle");

    // Use stored or default
    const score = state.sentimentScore || null;
    if (score !== null) {
      val.textContent = score;
      needle.style.left = score + "%";
      if (score <= 20) text.textContent = "Extreme Fear";
      else if (score <= 40) text.textContent = "Fear";
      else if (score <= 60) text.textContent = "Neutral";
      else if (score <= 80) text.textContent = "Greed";
      else text.textContent = "Extreme Greed";
    } else {
      val.textContent = "--";
      text.textContent = "Add items to see sentiment";
      needle.style.left = "50%";
    }
  }

  // ── Add Modal ──
  const modal = document.getElementById("addModal");
  const addType = document.getElementById("addType");
  const addFields = document.getElementById("addFields");

  function openAddModal(preType) {
    if (preType) addType.value = preType;
    renderAddFields();
    modal.classList.remove("hidden");
  }

  function closeAddModal() {
    modal.classList.add("hidden");
  }

  function renderAddFields() {
    const type = addType.value;
    addFields.innerHTML = "";

    if (type === "wallet") {
      addFields.innerHTML = `
        <div class="fin-form-group">
          <label for="addChain">Blockchain</label>
          <select id="addChain">
            <option value="eth">Ethereum (ETH)</option>
            <option value="btc">Bitcoin (BTC)</option>
            <option value="sol">Solana (SOL)</option>
            <option value="bnb">BNB Chain</option>
            <option value="matic">Polygon (MATIC)</option>
            <option value="arb">Arbitrum</option>
            <option value="avax">Avalanche</option>
          </select>
        </div>
        <div class="fin-form-group">
          <label for="addAddress">Wallet Address</label>
          <input type="text" id="addAddress" placeholder="0x...">
        </div>
        <div class="fin-form-group">
          <label for="addWalletLabel">Label (optional)</label>
          <input type="text" id="addWalletLabel" placeholder="e.g. Whale Wallet #3">
        </div>
      `;
    } else if (type === "alert") {
      addFields.innerHTML = `
        <div class="fin-form-group">
          <label for="addAlertSymbol">Symbol</label>
          <input type="text" id="addAlertSymbol" placeholder="e.g. AAPL, BTC, GOLD">
        </div>
        <div class="fin-form-row">
          <div class="fin-form-group">
            <label for="addAlertCondition">Condition</label>
            <select id="addAlertCondition">
              <option value="above">Price above</option>
              <option value="below">Price below</option>
              <option value="change_above">% Change above</option>
              <option value="change_below">% Change below</option>
            </select>
          </div>
          <div class="fin-form-group">
            <label for="addAlertThreshold">Threshold</label>
            <input type="number" id="addAlertThreshold" placeholder="150.00" step="0.01">
          </div>
        </div>
      `;
    } else {
      // Stock, crypto, commodity, forex, index
      const placeholders = {
        stock: { symbol: "AAPL", name: "Apple Inc." },
        crypto: { symbol: "BTC", name: "Bitcoin" },
        commodity: { symbol: "GOLD", name: "Gold (XAU)" },
        forex: { symbol: "EUR/USD", name: "Euro / US Dollar" },
        index: { symbol: "SPX", name: "S&P 500" },
      };
      const ph = placeholders[type] || { symbol: "TICKER", name: "Name" };
      addFields.innerHTML = `
        <div class="fin-form-row">
          <div class="fin-form-group">
            <label for="addSymbol">Symbol</label>
            <input type="text" id="addSymbol" placeholder="${ph.symbol}">
          </div>
          <div class="fin-form-group">
            <label for="addName">Name</label>
            <input type="text" id="addName" placeholder="${ph.name}">
          </div>
        </div>
        <div class="fin-form-row">
          <div class="fin-form-group">
            <label for="addPrice">Current Price (optional)</label>
            <input type="number" id="addPrice" placeholder="0.00" step="0.01">
          </div>
          <div class="fin-form-group">
            <label>
              <input type="checkbox" id="addPinned" checked> Pin to ticker tape
            </label>
          </div>
        </div>
      `;
    }
  }

  function handleAdd() {
    const type = addType.value;
    const id = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    if (type === "wallet") {
      const chain = document.getElementById("addChain").value;
      const address = document.getElementById("addAddress").value.trim();
      if (!address) { alert("Enter a wallet address."); return; }
      state.wallets.push({
        id, chain, address,
        label: document.getElementById("addWalletLabel").value.trim(),
        balance: null, usdValue: null,
      });
    } else if (type === "alert") {
      const symbol = document.getElementById("addAlertSymbol").value.trim().toUpperCase();
      if (!symbol) { alert("Enter a symbol."); return; }
      state.alerts.push({
        id, symbol,
        condition: document.getElementById("addAlertCondition").value,
        threshold: parseFloat(document.getElementById("addAlertThreshold").value) || 0,
        enabled: true, triggered: false,
      });
    } else {
      const symbol = document.getElementById("addSymbol").value.trim().toUpperCase();
      if (!symbol) { alert("Enter a symbol."); return; }
      const item = {
        id, type, symbol,
        name: document.getElementById("addName").value.trim(),
        price: parseFloat(document.getElementById("addPrice").value) || null,
        change: null, changePct: null, volume: null,
      };
      state.watchlist.push(item);
      if (document.getElementById("addPinned")?.checked) {
        state.pinned.push(id);
      }
    }

    saveState();
    renderAll();
    closeAddModal();
  }

  // ── Helpers ──
  function formatPrice(val) {
    if (val === null || val === undefined) return "—";
    const n = Number(val);
    if (isNaN(n)) return "—";
    if (n >= 1000) return "$" + n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1) return "$" + n.toFixed(2);
    return "$" + n.toFixed(6);
  }

  function formatChange(val) {
    if (val === null || val === undefined) return "—";
    const n = Number(val);
    if (isNaN(n)) return "—";
    const sign = n >= 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }

  function formatVolume(val) {
    if (!val) return "—";
    const n = Number(val);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function changeClass(val) {
    if (val === null || val === undefined) return "flat";
    return Number(val) >= 0 ? "up" : "down";
  }

  function getTypeIcon(type) {
    const icons = {
      stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      crypto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      commodity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h6"/></svg>',
      forex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>',
      index: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="4 14 8 10 12 14 20 6"/></svg>',
    };
    return icons[type] || icons.stock;
  }

  // ── Render All ──
  function renderAll() {
    renderTickerTape();
    renderWatchlist();
    renderWallets();
    renderAlerts();
    renderCalendar();
    renderSentiment();
  }

  // ── Event Listeners ──
  document.getElementById("addItemBtn").addEventListener("click", () => openAddModal());
  document.getElementById("tickerAddBtn").addEventListener("click", () => openAddModal());
  document.getElementById("modalClose").addEventListener("click", closeAddModal);
  document.getElementById("modalCancelBtn").addEventListener("click", closeAddModal);
  document.getElementById("modalSaveBtn").addEventListener("click", handleAdd);
  addType.addEventListener("change", renderAddFields);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAddModal();
  });

  // Header section toggles
  document.getElementById("viewWatchlist").addEventListener("click", () => {
    document.getElementById("watchlistCard").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("viewWallets").addEventListener("click", () => {
    document.getElementById("walletsCard").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("viewAlerts").addEventListener("click", () => {
    document.getElementById("alertsCard").scrollIntoView({ behavior: "smooth" });
  });

  // ── Refresh prices from background ──
  async function refreshPrices() {
    const btn = document.getElementById("refreshBtn");
    btn.textContent = "Refreshing...";
    btn.disabled = true;
    try {
      await browser.runtime.sendMessage({ action: "financeRefreshPrices" });
      // Reload state from storage (background updated it)
      await loadState();
      renderAll();
      updateLastRefreshed();
    } catch (e) {
      console.warn("[Finance] Refresh error:", e.message);
    }
    btn.textContent = "Refresh";
    btn.disabled = false;
  }

  function updateLastRefreshed() {
    const el = document.getElementById("lastRefreshed");
    if (!el) return;
    if (state.lastRefreshed) {
      const d = new Date(state.lastRefreshed);
      const now = new Date();
      const diffMs = now - d;
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) el.textContent = "Updated just now";
      else if (diffMin < 60) el.textContent = `Updated ${diffMin}m ago`;
      else el.textContent = `Updated ${d.toLocaleTimeString()}`;
    } else {
      el.textContent = "Not yet refreshed";
    }
  }

  // Listen for storage changes (background refresh updates prices)
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      const newState = changes[STORAGE_KEY].newValue;
      if (newState) {
        state = { ...state, ...newState };
        renderAll();
        updateLastRefreshed();
      }
    }
  });

  document.getElementById("refreshBtn").addEventListener("click", refreshPrices);

  // ── Init ──
  await loadState();
  renderAll();
  updateLastRefreshed();

  // Auto-refresh on page open (if stale > 2 min)
  if (!state.lastRefreshed || (Date.now() - new Date(state.lastRefreshed).getTime() > 120000)) {
    refreshPrices();
  }

  // Refresh the "Updated X ago" text every 30s
  setInterval(updateLastRefreshed, 30000);

})();
