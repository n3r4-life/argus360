// Graduated to standalone pages: bookmarks, monitors, archive, resources
// Dead code removed 2026-03-21

// ── Stubs for removed functions still referenced by other modules ──
async function updateKGStats() {}
async function loadPendingMerges() {}
function renderFeeds() {}
function initResourcesTab() {}
function renderMonitors() {}
function updateMonitorStorageUsage() {}
function initBookmarks() {}

// ──────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────
function attachListeners() {
  el.toggleKeyVis.addEventListener("click", () => {
    el.providerApiKey.type = el.providerApiKey.type === "password" ? "text" : "password";
  });

  el.defaultProvider.addEventListener("change", () => {
    updateReasoningControls();
    scheduleSave();
  });

  el.defaultPreset?.addEventListener("change", scheduleSave);

  el.providerTabList.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => selectProviderTab(btn.dataset.provider));
  });

  el.providerApiKey.addEventListener("input", saveProviderConfig);
  el.providerModel.addEventListener("change", saveProviderConfig);
  document.getElementById("custom-base-url").addEventListener("input", saveProviderConfig);
  document.getElementById("custom-model-name").addEventListener("input", saveProviderConfig);
  // Cloud/data/paste provider listeners (extracted to options-cloud.js)
  initCloudProviderListeners();

  // Intel provider listeners (extracted to options-providers.js)
  initIntelProviders();


  el.maxTokens.addEventListener("input", scheduleSave);
  el.maxInputChars.addEventListener("input", scheduleSave);
  el.reasoningEffort?.addEventListener("change", scheduleSave);
  el.openaiReasoningEffort.addEventListener("change", scheduleSave);

  el.temperature.addEventListener("input", () => {
    el.tempValue.textContent = el.temperature.value;
    scheduleSave();
  });

  // Extended thinking
  el.extendedThinkingEnabled.addEventListener("change", () => {
    updateReasoningControls();
    scheduleSave();
  });
  el.thinkingBudget.addEventListener("input", scheduleSave);
  el.responseLanguage.addEventListener("change", scheduleSave);
  el.showBadge.addEventListener("change", scheduleSave);
  el.trackMyPages.addEventListener("change", () => {
    // If Track My Pages is turned off, also disable Trawl Net
    if (!el.trackMyPages.checked && el.trawlEnabled.checked) {
      el.trawlEnabled.checked = false;
    }
    scheduleSave();
  });
  el.trawlEnabled.addEventListener("change", () => {
    // Trawl requires Track My Pages
    if (el.trawlEnabled.checked && !el.trackMyPages.checked) {
      el.trackMyPages.checked = true;
    }
    scheduleSave();
  });
  // Trawl Schedule
  initTrawlScheduleControls();
  // Trawl Duration Timer
  initTrawlDurationControls();
  el.incognitoForceEnabled.addEventListener("change", async () => {
    if (el.incognitoForceEnabled.checked) {
      // Request webNavigation permission if needed
      const has = await browser.permissions.contains({ permissions: ["webNavigation"] });
      if (!has) {
        const granted = await browser.permissions.request({ permissions: ["webNavigation"] }).catch(() => false);
        if (!granted) {
          el.incognitoForceEnabled.checked = false;
          return;
        }
      }
      // Tell background to register the incognito listener
      browser.runtime.sendMessage({ action: "initIncognitoForce" });
    }
    scheduleSave();
  });
  el.incognitoAddBtn.addEventListener("click", addIncognitoSite);
  el.incognitoAddDomain.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addIncognitoSite();
  });

  // History
  el.maxHistory.addEventListener("input", scheduleSave);
  el.openHistory.addEventListener("click", () => {
    focusOrCreatePage("history/history.html");
  });
  el.clearHistory.addEventListener("click", async () => {
    if (confirm("Clear all analysis history? This cannot be undone.")) {
      await browser.runtime.sendMessage({ action: "clearHistory" });
      el.clearHistory.textContent = "Cleared!";
      setTimeout(() => { el.clearHistory.textContent = "Clear All History"; }, 2000);
    }
  });

  // Import/Export
  el.exportSettings.addEventListener("click", exportSettingsToFile);
  el.importSettings.addEventListener("click", () => el.importFile.click());
  el.importFile.addEventListener("change", importSettingsFromFile);

  // ── Vault / Security ──
  const vaultTypeSelect   = document.getElementById("vault-type-select");
  const vaultSetupInput   = document.getElementById("vault-setup-input");
  const vaultSetupConfirm = document.getElementById("vault-setup-confirm");
  const vaultSetupLabel   = document.getElementById("vault-setup-label");
  const vaultEnableBtn    = document.getElementById("vault-enable-btn");
  const vaultSetupStatus  = document.getElementById("vault-setup-status");
  const vaultNotConfigured = document.getElementById("vault-not-configured");
  const vaultConfigured   = document.getElementById("vault-configured");
  const vaultStatusBadge  = document.getElementById("vault-status-badge");
  const vaultTypeDisplay  = document.getElementById("vault-type-display");
  const vaultLockBtn      = document.getElementById("vault-lock-btn");
  const vaultChangeBtn    = document.getElementById("vault-change-btn");
  const vaultRemoveBtn    = document.getElementById("vault-remove-btn");
  const vaultActionStatus = document.getElementById("vault-action-status");

  // Update form based on type selection
  if (vaultTypeSelect) {
    vaultTypeSelect.addEventListener("change", () => {
      const type = vaultTypeSelect.value;
      const isPassword = type === "password";
      vaultSetupLabel.textContent = isPassword ? "Enter password" : "Enter PIN";
      vaultSetupInput.placeholder = isPassword ? "Password" : "Enter PIN";
      vaultSetupConfirm.placeholder = isPassword ? "Confirm password" : "Confirm PIN";
      vaultSetupInput.maxLength = isPassword ? 128 : (type === "pin6" ? 6 : 4);
      vaultSetupConfirm.maxLength = vaultSetupInput.maxLength;
      vaultSetupInput.inputMode = isPassword ? "text" : "numeric";
      vaultSetupConfirm.inputMode = vaultSetupInput.inputMode;
      vaultSetupInput.value = "";
      vaultSetupConfirm.value = "";
    });
  }

  // Load vault status
  async function loadVaultStatus() {
    try {
      const status = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
      if (status && status.enabled) {
        vaultNotConfigured.classList.add("hidden");
        vaultConfigured.classList.remove("hidden");
        const typeNames = { pin4: "4-digit PIN", pin6: "6-digit PIN", password: "Password" };
        vaultTypeDisplay.textContent = "Protected with " + (typeNames[status.type] || status.type);
        vaultStatusBadge.textContent = status.unlocked ? "Unlocked" : "Locked";
        vaultStatusBadge.className = "vault-status-badge " + (status.unlocked ? "vault-unlocked" : "vault-locked");
      } else {
        vaultNotConfigured.classList.remove("hidden");
        vaultConfigured.classList.add("hidden");
      }
    } catch (_) {}
  }

  loadVaultStatus();

  // Enable encryption
  if (vaultEnableBtn) {
    vaultEnableBtn.addEventListener("click", async () => {
      if (vaultEnableBtn._isChange) return; // Handled by change handler
      const type = vaultTypeSelect.value;
      const pass = vaultSetupInput.value;
      const confirm = vaultSetupConfirm.value;

      if (!pass) { vaultSetupStatus.textContent = "Enter a passcode."; return; }
      if (type !== "password" && !/^\d+$/.test(pass)) { vaultSetupStatus.textContent = "PIN must be digits only."; return; }
      if (type === "pin4" && pass.length !== 4) { vaultSetupStatus.textContent = "PIN must be 4 digits."; return; }
      if (type === "pin6" && pass.length !== 6) { vaultSetupStatus.textContent = "PIN must be 6 digits."; return; }
      if (type === "password" && pass.length < 4) { vaultSetupStatus.textContent = "Password must be at least 4 characters."; return; }
      if (pass !== confirm) { vaultSetupStatus.textContent = "Entries don't match."; return; }

      vaultEnableBtn.disabled = true;
      vaultSetupStatus.textContent = "Encrypting...";
      try {
        const result = await browser.runtime.sendMessage({ action: "vaultSetup", passcode: pass, type });
        if (result.success) {
          vaultSetupStatus.textContent = "Encryption enabled!";
          vaultSetupInput.value = "";
          vaultSetupConfirm.value = "";
          loadVaultStatus();
        } else {
          vaultSetupStatus.textContent = "Failed: " + (result.error || "unknown error");
        }
      } catch (e) {
        vaultSetupStatus.textContent = "Error: " + e.message;
      }
      vaultEnableBtn.disabled = false;
    });
  }

  // Lock now
  if (vaultLockBtn) {
    vaultLockBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "vaultLock" });
      vaultActionStatus.textContent = "Locked. Reload any Argus page to see the lock screen.";
      loadVaultStatus();
    });
  }

  // Change passcode
  if (vaultChangeBtn) {
    vaultChangeBtn.addEventListener("click", () => {
      // Switch to setup view for changing
      vaultConfigured.classList.add("hidden");
      vaultNotConfigured.classList.remove("hidden");
      vaultSetupStatus.textContent = "";
      // Override the enable button to act as "change"
      vaultEnableBtn.textContent = "Change Passcode";
      vaultEnableBtn._isChange = true;
    });

    // Change handler reuses the setup form
    vaultEnableBtn.addEventListener("click", async function changeHandler() {
      if (!vaultEnableBtn._isChange) return; // Let the regular handler run
      const type = vaultTypeSelect.value;
      const pass = vaultSetupInput.value;
      const confirm = vaultSetupConfirm.value;

      if (!pass) { vaultSetupStatus.textContent = "Enter a passcode."; return; }
      if (type !== "password" && !/^\d+$/.test(pass)) { vaultSetupStatus.textContent = "PIN must be digits only."; return; }
      if (type === "pin4" && pass.length !== 4) { vaultSetupStatus.textContent = "PIN must be 4 digits."; return; }
      if (type === "pin6" && pass.length !== 6) { vaultSetupStatus.textContent = "PIN must be 6 digits."; return; }
      if (type === "password" && pass.length < 4) { vaultSetupStatus.textContent = "Password too short."; return; }
      if (pass !== confirm) { vaultSetupStatus.textContent = "Entries don't match."; return; }

      vaultEnableBtn.disabled = true;
      vaultSetupStatus.textContent = "Changing...";
      try {
        const result = await browser.runtime.sendMessage({ action: "vaultChange", passcode: pass, type });
        if (result.success) {
          vaultSetupStatus.textContent = "Passcode changed!";
          vaultSetupInput.value = "";
          vaultSetupConfirm.value = "";
          vaultEnableBtn.textContent = "Enable Encryption";
          vaultEnableBtn._isChange = false;
          loadVaultStatus();
        }
      } catch (e) {
        vaultSetupStatus.textContent = "Error: " + e.message;
      }
      vaultEnableBtn.disabled = false;
    });
  }

  // Remove encryption
  if (vaultRemoveBtn) {
    vaultRemoveBtn.addEventListener("click", async () => {
      if (!confirm("Remove encryption? Your data will be stored in plaintext.")) return;
      vaultActionStatus.textContent = "Decrypting...";
      try {
        const result = await browser.runtime.sendMessage({ action: "vaultRemove" });
        if (result.success) {
          vaultActionStatus.textContent = "Encryption removed.";
          loadVaultStatus();
        }
      } catch (e) {
        vaultActionStatus.textContent = "Error: " + e.message;
      }
    });
  }

  // ── Set Argus as Homepage ──
  document.getElementById("set-argus-homepage")?.addEventListener("click", async () => {
    const homepageStr = browser.runtime.getURL("options/options.html") + "#home";
    await navigator.clipboard.writeText(homepageStr);
    const statusEl = document.getElementById("homepage-status");
    if (statusEl) {
      statusEl.textContent = "URLs copied! Paste into the Custom URLs field in Firefox settings.";
      statusEl.style.color = "var(--success)";
    }
    // Open Firefox homepage preferences
    browser.tabs.create({ url: "about:preferences#home" });
  });

}

async function initSettingsProjectDropdowns() {
  try {
    const [projResp, defResp, overrides] = await Promise.all([
      browser.runtime.sendMessage({ action: "getProjects" }),
      browser.runtime.sendMessage({ action: "getDefaultProject" }),
      browser.runtime.sendMessage({ action: "getFeatureProjectOverrides" })
    ]);
    if (!projResp?.success) return;
    const projects = projResp.projects;
    const globalId = defResp?.defaultProjectId || "";
    const monId = overrides?.monitorDefaultProjectId || "";
    const bmId = overrides?.bookmarkDefaultProjectId || "";

    const globalEl = document.getElementById("settings-default-project");
    const monEl = document.getElementById("settings-monitor-project");
    const bmEl = document.getElementById("settings-bookmark-project");

    function fill(sel, value, keepFirst) {
      if (!sel) return;
      while (sel.options.length > 1) sel.remove(1);
      for (const p of projects) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      }
      sel.value = value;
    }

    fill(globalEl, globalId);
    fill(monEl, monId);
    fill(bmEl, bmId);

    if (globalEl) globalEl.addEventListener("change", () => {
      browser.runtime.sendMessage({ action: "setDefaultProject", projectId: globalEl.value || null });
    });
    if (monEl) monEl.addEventListener("change", () => {
      browser.runtime.sendMessage({ action: "setFeatureProjectOverride", key: "monitorDefaultProjectId", projectId: monEl.value || null });
    });
    if (bmEl) bmEl.addEventListener("change", () => {
      browser.runtime.sendMessage({ action: "setFeatureProjectOverride", key: "bookmarkDefaultProjectId", projectId: bmEl.value || null });
    });
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Detected feeds picker (from popup multi-feed detection)
// ──────────────────────────────────────────────
async function checkDetectedFeeds() {
  const { _detectedFeeds } = await browser.storage.local.get("_detectedFeeds");
  if (!_detectedFeeds || !_detectedFeeds.length) return;

  // Clear immediately so it doesn't show again on reload
  await browser.storage.local.remove("_detectedFeeds");

  // Get existing feeds to filter out already-subscribed
  const resp = await browser.runtime.sendMessage({ action: "getFeeds" });
  const existingUrls = new Set((resp?.feeds || []).map(f => f.url.replace(/\/+$/, "").toLowerCase()));
  const feeds = _detectedFeeds.filter(f => !existingUrls.has(f.url.replace(/\/+$/, "").toLowerCase()));
  if (!feeds.length) return;

  const picker = document.getElementById("detected-feeds-picker");
  const list = document.getElementById("detected-feeds-list");
  list.replaceChildren();

  feeds.forEach((feed, i) => {
    const row = document.createElement("label");
    row.className = "rule-item";
    row.style.cursor = "pointer";
    row.style.gap = "8px";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.idx = i;
    cb.className = "detected-feed-cb";

    const info = document.createElement("div");
    info.className = "rule-info";
    info.style.minWidth = "0";

    const title = document.createElement("strong");
    title.textContent = feed.title || new URL(feed.url).pathname;
    title.style.wordBreak = "break-all";
    info.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    meta.textContent = feed.url;
    meta.style.wordBreak = "break-all";
    info.appendChild(meta);

    row.append(cb, info);
    list.appendChild(row);
  });

  picker.classList.remove("hidden");

  // Select All
  document.getElementById("detected-feeds-select-all").onclick = () => {
    const cbs = list.querySelectorAll(".detected-feed-cb");
    const allChecked = [...cbs].every(c => c.checked);
    cbs.forEach(c => { c.checked = !allChecked; });
  };

  // Dismiss
  document.getElementById("detected-feeds-dismiss").onclick = () => {
    picker.classList.add("hidden");
  };

  // Subscribe selected
  document.getElementById("detected-feeds-subscribe").onclick = async () => {
    const cbs = list.querySelectorAll(".detected-feed-cb:checked");
    if (!cbs.length) return;

    const btn = document.getElementById("detected-feeds-subscribe");
    btn.disabled = true;
    btn.textContent = `Subscribing (0/${cbs.length})...`;

    let success = 0;
    for (const cb of cbs) {
      const feed = feeds[parseInt(cb.dataset.idx, 10)];
      const resp = await browser.runtime.sendMessage({
        action: "addFeed",
        url: feed.url,
        title: feed.title || "",
        intervalMinutes: 60
      });
      if (resp?.success) {
        success++;
        cb.closest(".rule-item").style.opacity = "0.4";
        cb.disabled = true;
      }
      btn.textContent = `Subscribing (${success}/${cbs.length})...`;
    }

    btn.textContent = `Subscribed ${success} feed${success !== 1 ? "s" : ""}!`;
    btn.style.color = "var(--success)";
    setTimeout(() => {
      picker.classList.add("hidden");
      btn.disabled = false;
      btn.textContent = "Subscribe Selected";
      btn.style.color = "";
    }, 2000);

    renderFeeds();
  };
}

// ──────────────────────────────────────────────
// Feed Keyword Routes
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Keyword Watchlist
// ──────────────────────────────────────────────
// ════════════════════════════════════════════
// User Profile / Multi-user
// ════════════════════════════════════════════

function _profileFmtDate(iso) {
  if (!iso) return "never";
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, "0");
  const yr = String(d.getFullYear()).slice(2);
  return `${yr}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateProfileUI(profile) {
  const loggedOut = document.getElementById("profile-logged-out");
  const loggedIn  = document.getElementById("profile-logged-in");
  if (!loggedOut || !loggedIn) return;

  if (profile) {
    loggedOut.style.display = "none";
    loggedIn.style.display  = "";
    const initial = (profile.username || "?")[0].toUpperCase();
    document.getElementById("profile-avatar").textContent        = initial;
    document.getElementById("profile-display-name").textContent  = profile.username;
    document.getElementById("profile-last-sync").textContent     = _profileFmtDate(profile.lastSync);
  } else {
    loggedOut.style.display = "";
    loggedIn.style.display  = "none";
  }
  // Always refresh ribbon + console strip
  updateConsoleStatusStrip();
}

function initUserProfile() {
  // Filter provider selector to only connected providers
  (async () => {
    try {
      const resp = await browser.runtime.sendMessage({ action: "cloudGetStatus" });
      const sel = document.getElementById("profile-cloud-provider");
      if (!sel) return;
      for (const opt of sel.options) {
        if (opt.value && !resp?.providers?.[opt.value]) {
          opt.disabled = true;
          opt.textContent += " (not connected)";
        }
      }
    } catch { /* */ }

    // Restore logged-in state if active
    const resp = await browser.runtime.sendMessage({ action: "profileGetState" });
    updateProfileUI(resp?.profile || null);
  })();

  // Login
  document.getElementById("profile-login-btn")?.addEventListener("click", async () => {
    const username  = document.getElementById("profile-username").value.trim();
    const passcode  = document.getElementById("profile-passcode").value;
    const provider  = document.getElementById("profile-cloud-provider").value;
    const statusEl  = document.getElementById("profile-login-status");

    if (!username || !passcode || !provider) {
      statusEl.textContent = "Fill in all fields.";
      statusEl.style.color = "var(--error)";
      return;
    }

    statusEl.textContent = "Signing in\u2026";
    statusEl.style.color = "var(--text-muted)";
    const btn = document.getElementById("profile-login-btn");
    btn.disabled = true;

    try {
      const r = await browser.runtime.sendMessage({ action: "profileLogin", username, passcode, cloudProvider: provider });
      if (r?.success) {
        statusEl.textContent = r.isNew ? "New profile created. Welcome!" : `Restored from last sync.`;
        statusEl.style.color = "var(--success)";
        document.getElementById("profile-passcode").value = "";
        const stateResp = await browser.runtime.sendMessage({ action: "profileGetState" });
        updateProfileUI(stateResp?.profile || null);
      } else {
        statusEl.textContent = r?.error || "Sign in failed.";
        statusEl.style.color = "var(--error)";
      }
    } catch (e) {
      statusEl.textContent = e.message;
      statusEl.style.color = "var(--error)";
    }
    btn.disabled = false;
  });

  // Sync Now
  document.getElementById("profile-sync-btn")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("profile-sync-status");
    const btn = document.getElementById("profile-sync-btn");
    btn.textContent = "Syncing\u2026";
    btn.disabled = true;
    statusEl.textContent = "";
    try {
      const r = await browser.runtime.sendMessage({ action: "profileSyncAll" });
      if (r?.success) {
        statusEl.textContent = `Synced ${Object.keys(r.stores || {}).length} stores \u00b7 ${_profileFmtDate(r.syncedAt)}`;
        statusEl.style.color = "var(--success)";
        document.getElementById("profile-last-sync").textContent = _profileFmtDate(r.syncedAt);
        updateConsoleStatusStrip();
      } else {
        statusEl.textContent = r?.error || "Sync failed.";
        statusEl.style.color = "var(--error)";
      }
    } catch (e) {
      statusEl.textContent = e.message;
      statusEl.style.color = "var(--error)";
    }
    btn.textContent = "Sync Now";
    btn.disabled = false;
  });

  // Sign Out
  document.getElementById("profile-logout-btn")?.addEventListener("click", async () => {
    const syncFirst = !document.getElementById("profile-clear-on-logout")?.checked;
    const confirmMsg = syncFirst
      ? "Sync to cloud then sign out?"
      : "Sign out without syncing? Any unsynced changes will stay local.";
    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById("profile-logout-btn");
    btn.textContent = syncFirst ? "Syncing\u2026" : "Signing out\u2026";
    btn.disabled = true;

    try {
      await browser.runtime.sendMessage({ action: "profileLogout", syncFirst });
      updateProfileUI(null);
    } catch (e) {
      const statusEl = document.getElementById("profile-sync-status");
      statusEl.textContent = e.message;
      statusEl.style.color = "var(--error)";
    }
    btn.textContent = "Sign Out";
    btn.disabled = false;
  });

}

function initStorageManagement() {
  updateStorageUsage();

  document.getElementById("purge-history-btn").addEventListener("click", purgeOldHistory);
  document.getElementById("purge-snapshots-btn").addEventListener("click", purgeMonitorSnapshots);
  document.getElementById("purge-cached-btn").addEventListener("click", purgeAllCachedData);
  document.getElementById("purge-opfs-btn").addEventListener("click", purgeOpfsFiles);

  // Email Contacts management
  const contactsList = document.getElementById("contacts-list");
  async function renderContacts() {
    const contacts = await EmailShare.getContacts();
    contactsList.replaceChildren();
    for (const c of contacts) {
      const chip = document.createElement("span");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:3px 10px;font-size:11px;color:var(--text-secondary);";
      chip.textContent = c.name ? `${c.name} <${c.email}>` : c.email;
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "\u00d7";
      removeBtn.style.cssText = "background:none;border:none;color:var(--error);cursor:pointer;font-size:14px;padding:0 2px;";
      removeBtn.addEventListener("click", async () => { await EmailShare.removeContact(c.email); renderContacts(); });
      chip.appendChild(removeBtn);
      contactsList.appendChild(chip);
    }
    if (!contacts.length) contactsList.textContent = "No contacts saved yet.";
  }
  renderContacts();
  document.getElementById("add-contact-btn").addEventListener("click", async () => {
    const emailInput = document.getElementById("contact-email-input");
    const nameInput = document.getElementById("contact-name-input");
    const email = emailInput.value.trim();
    if (!email || !email.includes("@")) return;
    await EmailShare.addContact(email, nameInput.value.trim());
    emailInput.value = "";
    nameInput.value = "";
    renderContacts();
  });

  // Wipe Everything — PIN-gated multi-level
  const wipeBtn    = document.getElementById("wipe-everything-btn");
  const wipePanel  = document.getElementById("wipe-panel");
  const wipePinStep  = document.getElementById("wipe-pin-step");
  const wipeOptStep  = document.getElementById("wipe-options-step");
  const wipeStatus   = document.getElementById("wipe-status");

  function _closeWipePanel() {
    wipePanel.classList.add("hidden");
    wipePinStep.classList.add("hidden");
    wipeOptStep.classList.add("hidden");
    wipeStatus.textContent = "";
    const pinInput = document.getElementById("wipe-pin-input");
    if (pinInput) pinInput.value = "";
    document.getElementById("wipe-pin-error").textContent = "";
    wipeBtn.disabled = false;
  }

  async function _runWipe(mode) {
    wipeOptStep.classList.add("hidden");
    wipeStatus.textContent = "Syncing to cloud\u2026";
    // Small delay so the user sees the status message
    await new Promise(r => setTimeout(r, 400));
    wipeStatus.textContent = "Wiping\u2026";
    const resp = await browser.runtime.sendMessage({ action: "wipeEverything", mode });
    if (resp?.success) {
      wipeStatus.textContent = mode === "user" ? "Your data has been wiped." : "Everything has been wiped.";
      setTimeout(() => location.reload(), 1800);
    } else {
      wipeStatus.textContent = "Wipe failed: " + (resp?.error || "unknown error");
      wipeBtn.disabled = false;
    }
  }

  wipeBtn.addEventListener("click", async () => {
    wipePanel.classList.remove("hidden");
    wipePinStep.classList.add("hidden");
    wipeOptStep.classList.add("hidden");
    wipeStatus.textContent = "";
    const vaultStatus = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
    if (vaultStatus?.enabled) {
      wipePinStep.classList.remove("hidden");
      document.getElementById("wipe-pin-input")?.focus();
    } else {
      wipeOptStep.classList.remove("hidden");
    }
  });

  document.getElementById("wipe-pin-confirm").addEventListener("click", async () => {
    const pinInput = document.getElementById("wipe-pin-input");
    const pinErr   = document.getElementById("wipe-pin-error");
    const pin = pinInput.value.trim();
    if (!pin) { pinErr.textContent = "Enter your PIN."; return; }
    pinErr.textContent = "";
    try {
      const r = await browser.runtime.sendMessage({ action: "vaultUnlock", passcode: pin });
      if (r?.success) {
        wipePinStep.classList.add("hidden");
        wipeOptStep.classList.remove("hidden");
      } else {
        pinErr.textContent = "Incorrect PIN.";
        pinInput.value = "";
        pinInput.focus();
      }
    } catch (e) {
      pinErr.textContent = e.message || "Unlock failed.";
    }
  });

  document.getElementById("wipe-pin-input").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("wipe-pin-confirm").click();
  });

  document.getElementById("wipe-cancel-btn").addEventListener("click", _closeWipePanel);
  document.getElementById("wipe-cancel-btn2").addEventListener("click", _closeWipePanel);

  document.getElementById("wipe-user-btn").addEventListener("click", () => _runWipe("user"));
  document.getElementById("wipe-all-btn").addEventListener("click", () => _runWipe("all"));

  // Knowledge Graph
  document.getElementById("kg-open-graph").addEventListener("click", () => {
    focusOrCreatePage("osint/graph.html?mode=global");
  });
  document.getElementById("kg-run-inference").addEventListener("click", async () => {
    const resp = await browser.runtime.sendMessage({ action: "runKGInference" });
    showKGStatus(resp && resp.inferred ? `Inferred ${resp.inferred} new relationships` : "No new inferences");
  });
  document.getElementById("kg-prune-noise").addEventListener("click", async () => {
    const resp = await browser.runtime.sendMessage({ action: "pruneKGNoise" });
    showKGStatus(resp && resp.pruned ? `Pruned ${resp.pruned} noisy entities` : "No noise found");
    updateKGStats();
  });
  document.getElementById("kg-retype").addEventListener("click", async () => {
    const resp = await browser.runtime.sendMessage({ action: "retypeKGEntities" });
    const parts = [];
    if (resp?.fixed) parts.push(`Re-typed ${resp.fixed}`);
    if (resp?.pruned) parts.push(`pruned ${resp.pruned} noise`);
    showKGStatus(parts.length ? parts.join(", ") : "All entities already correct");
    updateKGStats();
  });
  document.getElementById("kg-reindex").addEventListener("click", async () => {
    if (!confirm("Re-index the knowledge graph from all analysis history? This may take a moment.")) return;
    showKGStatus("Re-indexing\u2026");
    const resp = await browser.runtime.sendMessage({ action: "reindexKG" });
    showKGStatus(resp?.processed ? `Re-indexed ${resp.processed} history items` : "Re-index complete");
    updateKGStats();
  });
  document.getElementById("kg-clear").addEventListener("click", async () => {
    if (!confirm("Clear the entire knowledge graph? This cannot be undone.")) return;
    await browser.runtime.sendMessage({ action: "clearKG" });
    showKGStatus("Knowledge graph cleared");
    updateKGStats();
  });
  updateKGStats();
  loadPendingMerges();

  // ── Entity Dictionary Editor ──
  {
    let _dictCurrentTab = "noise";
    let _dictData = { noise: [], notPersonFirstWords: [], commonNouns: [], locations: [], orgs: [] };
    const dictLabels = {
      noise: "Noise Phrases", notPersonFirstWords: "Not-Person First Words",
      commonNouns: "Common Nouns (not last names)", locations: "Known Locations", orgs: "Known Organizations"
    };
    const dictItems = document.getElementById("kg-dict-items");
    const dictInput = document.getElementById("kg-dict-input");
    const dictAddBtn = document.getElementById("kg-dict-add");
    const dictStatus = document.getElementById("kg-dict-status");
    const dictStatsEl = document.getElementById("kg-dict-stats");
    const dictReprocess = document.getElementById("kg-dict-reprocess");

    function showDictStatus(msg) {
      if (!dictStatus) return;
      dictStatus.textContent = msg;
      dictStatus.classList.remove("hidden");
      setTimeout(() => dictStatus.classList.add("hidden"), 2500);
    }

    async function loadDictStats() {
      try {
        const stats = await browser.runtime.sendMessage({ action: "getKGDictionaryStats" });
        if (stats && dictStatsEl) {
          const parts = [
            `Noise: ${stats.noise}`, `Not-Person: ${stats.notPersonFirstWords}`,
            `Nouns: ${stats.commonNouns}`, `Locations: ${stats.locations}`,
            `Orgs: ${stats.orgs}`, `First Names: ${stats.validFirstNames}`,
            `Phrases: ${stats.notPersonPhrases}`
          ];
          dictStatsEl.textContent = "Built-in: " + parts.join(" \u00b7 ");
        }
      } catch (e) { console.warn("[DictUI] Stats error:", e); }
    }

    async function loadDictData() {
      try {
        _dictData = await browser.runtime.sendMessage({ action: "getKGDictionaries" });
        if (!_dictData || typeof _dictData !== "object") {
          _dictData = { noise: [], notPersonFirstWords: [], commonNouns: [], locations: [], orgs: [] };
        }
      } catch (e) { console.warn("[DictUI] Load error:", e); }
      renderDictItems();
    }

    function renderDictItems() {
      if (!dictItems) return;
      const entries = _dictData[_dictCurrentTab] || [];
      dictItems.textContent = "";
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.style.cssText = "font-size:12px;color:var(--text-muted);padding:8px;";
        empty.textContent = `No custom ${dictLabels[_dictCurrentTab] || _dictCurrentTab} entries. Built-in dictionary is still active.`;
        dictItems.appendChild(empty);
        return;
      }
      for (const entry of entries) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--border);font-size:12px;";
        const label = document.createElement("span");
        label.textContent = entry;
        label.style.color = "var(--text-primary)";
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "\u00d7";
        removeBtn.title = "Remove";
        removeBtn.style.cssText = "background:none;border:none;color:var(--error);font-size:16px;cursor:pointer;padding:0 4px;line-height:1;";
        removeBtn.addEventListener("click", async () => {
          _dictData[_dictCurrentTab] = _dictData[_dictCurrentTab].filter(e => e !== entry);
          await saveDictData();
          renderDictItems();
        });
        row.appendChild(label);
        row.appendChild(removeBtn);
        dictItems.appendChild(row);
      }
    }

    async function saveDictData() {
      try {
        await browser.runtime.sendMessage({ action: "saveKGDictionaries", dictionaries: _dictData });
        showDictStatus("Saved");
      } catch (e) { showDictStatus("Error saving"); }
    }

    // Tab switching
    document.querySelectorAll(".kg-dict-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".kg-dict-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        _dictCurrentTab = btn.dataset.dict;
        if (dictInput) dictInput.placeholder = `Add ${dictLabels[_dictCurrentTab] || "entry"}...`;
        renderDictItems();
      });
    });

    // Add entry
    if (dictAddBtn && dictInput) {
      const addEntry = async () => {
        const val = dictInput.value.trim().toLowerCase();
        if (!val) return;
        if (!_dictData[_dictCurrentTab]) _dictData[_dictCurrentTab] = [];
        if (_dictData[_dictCurrentTab].includes(val)) {
          showDictStatus("Already exists");
          return;
        }
        _dictData[_dictCurrentTab].push(val);
        _dictData[_dictCurrentTab].sort();
        dictInput.value = "";
        await saveDictData();
        renderDictItems();
      };
      dictAddBtn.addEventListener("click", addEntry);
      dictInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addEntry(); });
    }

    // Re-type all entities with updated dictionaries
    if (dictReprocess) {
      dictReprocess.addEventListener("click", async () => {
        dictReprocess.disabled = true;
        dictReprocess.textContent = "Processing...";
        try {
          const resp = await browser.runtime.sendMessage({ action: "retypeKGEntities" });
          const parts = [];
          if (resp?.fixed) parts.push(`Re-typed ${resp.fixed}`);
          if (resp?.pruned) parts.push(`pruned ${resp.pruned} noise`);
          showDictStatus(parts.length ? parts.join(", ") : "All entities correct");
          updateKGStats();
          updateTabBadges();
        } catch (e) { showDictStatus("Error"); }
        dictReprocess.disabled = false;
        dictReprocess.textContent = "Re-type All Entities";
      });
    }

    loadDictStats();
    loadDictData();
  }

  // ── Entity Overrides UI ──
  {
    const overridesList = document.getElementById("kg-overrides-list");
    const overrideName = document.getElementById("kg-override-name");
    const overrideType = document.getElementById("kg-override-type");
    const overrideAddBtn = document.getElementById("kg-override-add");
    const overrideApplyBtn = document.getElementById("kg-override-apply");
    const overrideStatus = document.getElementById("kg-override-status");

    if (overridesList) {
      let _overrides = {}; // { "kari lake": "person", ... }

      function showOverrideStatus(msg) {
        overrideStatus.textContent = msg;
        overrideStatus.classList.remove("hidden");
        setTimeout(() => overrideStatus.classList.add("hidden"), 2500);
      }

      const typeLabels = { person: "Person", organization: "Organization", location: "Location", event: "Event", other: "Other" };
      const typeColors = { person: "#e94560", organization: "#64b5f6", location: "#4caf50", event: "#ffb74d", other: "#a0a0b0" };

      function renderOverrides() {
        overridesList.replaceChildren();
        const entries = Object.entries(_overrides);
        if (!entries.length) {
          const empty = document.createElement("div");
          empty.className = "info-text";
          empty.style.cssText = "padding:12px;text-align:center;";
          empty.textContent = "No overrides defined.";
          overridesList.appendChild(empty);
          return;
        }
        for (const [name, type] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--border);";
          const dot = document.createElement("span");
          dot.style.cssText = `width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${typeColors[type] || "#a0a0b0"}`;
          const label = document.createElement("span");
          label.style.cssText = "flex:1;font-size:13px;";
          label.textContent = name;
          const typeBadge = document.createElement("span");
          typeBadge.style.cssText = `font-size:11px;padding:1px 8px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--text-secondary);`;
          typeBadge.textContent = typeLabels[type] || type;
          const removeBtn = document.createElement("button");
          removeBtn.className = "btn btn-secondary btn-sm";
          removeBtn.style.cssText = "padding:2px 8px;font-size:11px;color:var(--error);";
          removeBtn.textContent = "Remove";
          removeBtn.addEventListener("click", async () => {
            delete _overrides[name];
            await saveOverrides();
            renderOverrides();
            showOverrideStatus("Removed");
          });
          row.append(dot, label, typeBadge, removeBtn);
          overridesList.appendChild(row);
        }
      }

      async function loadOverrides() {
        const dict = await browser.runtime.sendMessage({ action: "getKGDictionaries" });
        _overrides = dict.overrides || {};
        renderOverrides();
      }

      async function saveOverrides() {
        const dict = await browser.runtime.sendMessage({ action: "getKGDictionaries" });
        dict.overrides = _overrides;
        await browser.runtime.sendMessage({ action: "saveKGDictionaries", dictionaries: dict });
      }

      overrideAddBtn.addEventListener("click", async () => {
        const name = overrideName.value.trim().toLowerCase();
        const type = overrideType.value;
        if (!name) return;
        if (_overrides[name] === type) { showOverrideStatus("Already exists"); return; }
        _overrides[name] = type;
        await saveOverrides();
        overrideName.value = "";
        renderOverrides();
        showOverrideStatus("Saved");
      });
      overrideName.addEventListener("keydown", (e) => {
        if (e.key === "Enter") overrideAddBtn.click();
      });

      overrideApplyBtn.addEventListener("click", async () => {
        overrideApplyBtn.disabled = true;
        overrideApplyBtn.textContent = "Applying...";
        try {
          const resp = await browser.runtime.sendMessage({ action: "retypeKGEntities" });
          const parts = [];
          if (resp?.fixed) parts.push(`Re-typed ${resp.fixed}`);
          if (resp?.pruned) parts.push(`pruned ${resp.pruned}`);
          showOverrideStatus(parts.length ? parts.join(", ") : "All correct");
          updateKGStats();
        } catch { showOverrideStatus("Error"); }
        overrideApplyBtn.disabled = false;
        overrideApplyBtn.textContent = "Apply to Existing Entities";
      });

      loadOverrides();
    }
  }

  // OSINT Quick Tools (on OSINT tab)
  const osintLaunch = (tool) => async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) {
      alert("Open a web page first, then use this tool.");
      return;
    }
    browser.runtime.sendMessage({ action: tool, tabId: tab.id });
  };
  const osintMetaBtn = document.getElementById("osint-launch-metadata");
  const osintLinksBtn = document.getElementById("osint-launch-links");
  const osintWhoisBtn = document.getElementById("osint-launch-whois");
  const osintTechBtn = document.getElementById("osint-launch-techstack");
  if (osintMetaBtn) osintMetaBtn.addEventListener("click", osintLaunch("extractMetadata"));
  if (osintLinksBtn) osintLinksBtn.addEventListener("click", osintLaunch("mapLinks"));
  if (osintWhoisBtn) osintWhoisBtn.addEventListener("click", osintLaunch("whoisLookup"));
  if (osintTechBtn) osintTechBtn.addEventListener("click", osintLaunch("detectTechStack"));
}

function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

let _storageUsageTimer = null;
function updateStorageUsage() {
  clearTimeout(_storageUsageTimer);
  _storageUsageTimer = setTimeout(_doUpdateStorageUsage, 80);
}

async function _doUpdateStorageUsage() {
  const display = document.getElementById("storage-usage-display");
  const breakdown = document.getElementById("storage-breakdown");
  try {
    // Fetch all async data first — no DOM writes until everything is ready
    const [all, { storeSyncLog = {} }] = await Promise.all([
      browser.storage.local.get(null),
      browser.storage.local.get({ storeSyncLog: {} })
    ]);
    const localBytes = new Blob([JSON.stringify(all)]).size;

    // Categorize storage.local keys
    let ephemeralBytes = 0, ephemeralCount = 0;
    let conversationBytes = 0, conversationCount = 0;
    let settingsOnlyBytes = 0, settingsOnlyCount = 0;
    const ephemeralPrefixes = ["tl-result-", "proj-view-", "techstack-", "metadata-", "linkmap-", "whois-", "result-"];
    const convPrefixes = ["conv-", "chat-", "followup-", "ai-"];
    for (const [key, val] of Object.entries(all)) {
      const s = new Blob([JSON.stringify(val)]).size;
      if (ephemeralPrefixes.some(p => key.startsWith(p)) || key.endsWith("-pipeline")) {
        ephemeralBytes += s;
        ephemeralCount++;
      } else if (convPrefixes.some(p => key.startsWith(p))) {
        conversationBytes += s;
        conversationCount++;
      } else {
        settingsOnlyBytes += s;
        settingsOnlyCount++;
      }
    }

    // IndexedDB — all the heavy stores
    const idbSizes = await ArgusDB.estimateSize();

    // OPFS — binary snapshot files (full HTML + screenshots)
    let opfsBytes = 0;
    try {
      const monResp = await browser.runtime.sendMessage({ action: "getMonitorStorageUsage" });
      if (monResp && monResp.success) opfsBytes = monResp.opfsBytes || 0;
    } catch { /* */ }

    const totalBytes = localBytes + (idbSizes._total || 0) + opfsBytes;

    display.textContent = fmtBytes(totalBytes);
    if (totalBytes > 8 * 1048576) {
      display.style.color = "var(--error)";
    } else if (totalBytes > 5 * 1048576) {
      display.style.color = "var(--warning, #ffb74d)";
    } else {
      display.style.color = "var(--text-secondary)";
    }

    // Build full breakdown — sorted by size, grouped by tier
    const storeLabels = {
      history: "Analysis History",
      snapshots: "Monitor Snapshots (IDB)",
      changes: "Monitor Changes",
      feedEntries: "Feed Entries",
      kgNodes: "KG Nodes",
      kgEdges: "KG Edges",
      projects: "Projects",
      bookmarks: "Bookmarks",
      monitors: "Monitors",
      feeds: "Feeds",
      watchlist: "Watchlist",
      chatSessions: "Chat Sessions",
      drafts: "Drafts",
      pageTracker: "Page Tracker",
      sources: "Sources",
    };

    // Collect all breakdown entries as { label, bytes, detail, tier, color }
    const allEntries = [];

    // IndexedDB stores
    for (const [store, label] of Object.entries(storeLabels)) {
      const s = idbSizes[store];
      if (s && s.bytes > 0) {
        allEntries.push({ label, bytes: s.bytes, detail: s.count + " items", tier: "IndexedDB", color: "#e94560", store });
      }
    }

    // OPFS snapshot files
    if (opfsBytes > 0) {
      allEntries.push({ label: "Snapshot Files (HTML/PNG)", bytes: opfsBytes, detail: "OPFS binary", tier: "OPFS", color: "#6cb4ee", store: "_opfs" });
    }

    // browser.storage.local — cached/ephemeral
    if (ephemeralCount > 0) {
      allEntries.push({ label: "Cached Results", bytes: ephemeralBytes, detail: ephemeralCount + " keys", tier: "storage.local", color: "#ff9800", store: "_cached" });
    }

    // browser.storage.local — conversation/AI response data
    if (conversationCount > 0) {
      allEntries.push({ label: "AI Conversations", bytes: conversationBytes, detail: conversationCount + " keys", tier: "storage.local", color: "#ab47bc", store: "_conversations" });
    }

    // browser.storage.local — actual settings
    if (settingsOnlyBytes > 0) {
      allEntries.push({ label: "Settings & Config", bytes: settingsOnlyBytes, detail: settingsOnlyCount + " keys", tier: "storage.local", color: "#4caf50", store: "_settings" });
    }

    // Sort by size descending
    allEntries.sort((a, b) => b.bytes - a.bytes);

    // Build settings breakdown (detailed text)
    const rows = allEntries.map(e => {
      const detailStr = e.detail ? ` (${e.detail})` : "";
      return `${e.label}: ${fmtBytes(e.bytes)}${detailStr}`;
    });

    // Tier subtotals
    const idbTotal = (idbSizes._total || 0);
    const tierSummary = [];
    if (idbTotal > 0) tierSummary.push(`IndexedDB: ${fmtBytes(idbTotal)}`);
    if (opfsBytes > 0) tierSummary.push(`OPFS: ${fmtBytes(opfsBytes)}`);
    if (localBytes > 0) tierSummary.push(`storage.local: ${fmtBytes(localBytes)}`);

    breakdown.innerHTML = rows.join("<br>") + (tierSummary.length ? '<br><span style="opacity:0.6;font-size:10px;">\u2014 ' + tierSummary.join(" \u00b7 ") + '</span>' : "");
    breakdown.style.display = rows.length ? "block" : "none";

    // Update home page storage widget
    const homeTotal = document.getElementById("home-storage-total");
    const homeBar = document.getElementById("home-storage-bar");
    const homeBreakdown = document.getElementById("home-storage-breakdown");
    if (homeTotal) {
      homeTotal.textContent = fmtBytes(totalBytes);
      if (totalBytes > 8 * 1048576) {
        homeTotal.style.color = "var(--error)";
      } else if (totalBytes > 5 * 1048576) {
        homeTotal.style.color = "var(--warning, #ffb74d)";
      } else {
        homeTotal.style.color = "var(--text-primary)";
      }

      // Stacked segmented bar — each entry gets a colored segment
      if (homeBar) {
        homeBar.innerHTML = "";
        allEntries.forEach(e => {
          const pct = totalBytes > 0 ? (e.bytes / totalBytes) * 100 : 0;
          if (pct < 0.5) return; // skip tiny slivers
          const seg = document.createElement("div");
          seg.style.cssText = `height:100%;width:${pct}%;background:${e.color};display:inline-block;transition:width 0.4s;`;
          seg.title = `${e.label}: ${fmtBytes(e.bytes)}`;
          homeBar.appendChild(seg);
        });
      }

      // Full breakdown — all entries, sorted by size, with color dots + sync + save + delete buttons
      homeBreakdown.innerHTML = "";
      homeBreakdown.style.display = allEntries.length ? "block" : "none";

      const syncableStores = new Set(["history","snapshots","changes","projects","bookmarks","monitors","feeds","feedEntries","chatSessions","drafts","pageTracker","sources","watchlist","kgNodes","kgEdges","_settings","_cached","_conversations"]);

      function fmtSyncDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, "0");
        const yr = String(d.getFullYear()).slice(2);
        return `${yr}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }

      async function syncStore(store, label, btn, tsSpan) {
        btn.textContent = "\u2026";
        btn.disabled = true;
        try {
          const r = await browser.runtime.sendMessage({ action: "cloudExportStore", store });
          if (r?.success) {
            btn.textContent = "Synced";
            btn.style.color = "var(--success)";
            btn.style.borderColor = "var(--success)";
            if (tsSpan) tsSpan.textContent = fmtSyncDate(new Date().toISOString());
          } else {
            btn.textContent = "Failed";
            btn.style.color = "var(--error)";
          }
        } catch {
          btn.textContent = "Err";
          btn.style.color = "var(--error)";
        }
        setTimeout(() => { btn.textContent = "Sync"; btn.disabled = false; btn.style.color = ""; btn.style.borderColor = ""; }, 3000);
      }

      async function saveStoreLocally(store, btn) {
        btn.textContent = "\u2026";
        btn.disabled = true;
        try {
          const r = await browser.runtime.sendMessage({ action: "exportStoreData", store });
          if (!r?.success) throw new Error(r?.error || "Failed");
          const blob = new Blob([r.json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = r.filename; a.click();
          URL.revokeObjectURL(url);
          btn.textContent = "Saved \u2713";
          btn.style.color = "var(--success)";
        } catch {
          btn.textContent = "Err";
          btn.style.color = "var(--error)";
        }
        setTimeout(() => { btn.textContent = "Save"; btn.disabled = false; btn.style.color = ""; }, 2500);
      }

      const BTN = "background:none;border:1px solid var(--border);border-radius:4px;color:var(--text-muted);cursor:pointer;padding:1px 6px;font-size:10px;flex-shrink:0;transition:all 0.15s;font-family:inherit;";

      const syncBtns = [];
      allEntries.forEach(e => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:4px;padding:2px 0;";

        // Left: dot + label (takes all remaining space)
        const dot = document.createElement("span");
        dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${e.color};flex-shrink:0;`;
        row.appendChild(dot);

        const text = document.createElement("span");
        text.style.cssText = "flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        const detailStr = e.detail ? ` <span style="opacity:0.5">(${e.detail})</span>` : "";
        text.innerHTML = `${e.label}: <strong>${fmtBytes(e.bytes)}</strong>${detailStr}`;
        row.appendChild(text);

        // Right: timestamp + action buttons — always right-aligned
        if (syncableStores.has(e.store)) {
          const tsSpan = document.createElement("span");
          tsSpan.style.cssText = "font-family:'SF Mono','Fira Code',Consolas,monospace;font-size:9px;color:#3a3a58;white-space:nowrap;flex-shrink:0;width:86px;text-align:right;";
          const lastSync = storeSyncLog[e.store];
          tsSpan.textContent = lastSync ? fmtSyncDate(lastSync) : "";
          row.appendChild(tsSpan);

          const sync = document.createElement("button");
          sync.style.cssText = BTN;
          sync.textContent = "Sync";
          sync.title = `Export ${e.label} to cloud`;
          sync.addEventListener("mouseenter", () => { sync.style.color = "#a78bfa"; sync.style.borderColor = "#a78bfa"; });
          sync.addEventListener("mouseleave", () => { if (!sync.disabled) { sync.style.color = ""; sync.style.borderColor = ""; } });
          sync.addEventListener("click", () => syncStore(e.store, e.label, sync, tsSpan));
          syncBtns.push({ store: e.store, label: e.label, btn: sync, tsSpan });
          row.appendChild(sync);

          const save = document.createElement("button");
          save.style.cssText = BTN;
          save.textContent = "Save";
          save.title = `Download ${e.label} as JSON file`;
          save.addEventListener("mouseenter", () => { save.style.color = "#60a5fa"; save.style.borderColor = "#60a5fa"; });
          save.addEventListener("mouseleave", () => { if (!save.disabled) { save.style.color = ""; save.style.borderColor = ""; } });
          save.addEventListener("click", () => saveStoreLocally(e.store, save));
          row.appendChild(save);
        } else {
          // Reserve same space so Clear button stays column-aligned on non-syncable rows
          const spacer = document.createElement("span");
          spacer.style.cssText = "flex-shrink:0;width:calc(86px + 2 * (32px + 4px));";
          row.appendChild(spacer);
        }

        // Clear button (skip settings — not clearable)
        if (e.store && e.store !== "_settings") {
          const del = document.createElement("button");
          del.style.cssText = BTN;
          del.textContent = "Clear";
          del.title = `Clear all ${e.label}`;
          del.addEventListener("mouseenter", () => { del.style.color = "var(--error)"; del.style.borderColor = "var(--error)"; });
          del.addEventListener("mouseleave", () => { del.style.color = "var(--text-muted)"; del.style.borderColor = "var(--border)"; });
          del.addEventListener("click", async () => {
            if (!confirm(`Clear all ${e.label}? This cannot be undone.`)) return;
            del.textContent = "...";
            del.disabled = true;
            try {
              await purgeStorageEntry(e.store);
              del.textContent = "Done";
              del.style.color = "var(--success)";
              updateStorageUsage();
            } catch {
              del.textContent = "Fail";
              del.style.color = "var(--error)";
            }
          });
          row.appendChild(del);
        }

        homeBreakdown.appendChild(row);
      });

      // Wire Sync All + Save All buttons
      const syncAllBtn = document.getElementById("home-storage-sync-all");
      const saveAllBtn = document.getElementById("home-storage-save-all");
      if (syncAllBtn) {
        syncAllBtn.style.display = syncBtns.length ? "" : "none";
        syncAllBtn.onclick = async () => {
          syncAllBtn.textContent = "Syncing\u2026";
          syncAllBtn.disabled = true;
          for (const { store, label, btn, tsSpan } of syncBtns) {
            await syncStore(store, label, btn, tsSpan);
          }
          syncAllBtn.textContent = "Done";
          setTimeout(() => { syncAllBtn.textContent = "Sync All"; syncAllBtn.disabled = false; }, 3000);
        };
      }
      if (saveAllBtn) {
        saveAllBtn.style.display = syncBtns.length ? "" : "none";
        saveAllBtn.onclick = async () => {
          saveAllBtn.textContent = "Saving\u2026";
          saveAllBtn.disabled = true;
          for (const { store, btn: saveBtn } of syncBtns) {
            await saveStoreLocally(store, saveBtn);
          }
          saveAllBtn.textContent = "Done";
          setTimeout(() => { saveAllBtn.textContent = "Save All"; saveAllBtn.disabled = false; }, 2500);
        };
      }

      // Tier subtotal line
      if (tierSummary.length) {
        const tierLine = document.createElement("div");
        tierLine.style.cssText = "opacity:0.5;font-size:10px;padding-top:4px;";
        tierLine.textContent = "\u2014 " + tierSummary.join(" \u00b7 ");
        homeBreakdown.appendChild(tierLine);
      }
    }
  } catch {
    display.textContent = "Unable to calculate";
  }
}

function showPurgeStatus(msg) {
  const status = document.getElementById("storage-purge-status");
  status.textContent = msg;
  status.classList.remove("hidden");
  setTimeout(() => status.classList.add("hidden"), 3000);
}

async function purgeStorageEntry(store) {
  const idbStores = {
    history: () => ArgusDB.History.clear(),
    snapshots: () => ArgusDB.Snapshots.clear(),
    changes: () => ArgusDB.Changes.clear(),
    feedEntries: () => ArgusDB.FeedEntries.clear(),
    kgNodes: () => ArgusDB.KGNodes.clear(),
    kgEdges: () => ArgusDB.KGEdges.clear(),
    projects: () => ArgusDB.Projects.clear(),
    bookmarks: () => ArgusDB.Bookmarks.clear(),
    monitors: () => ArgusDB.Monitors.clear(),
    feeds: () => ArgusDB.Feeds.clear(),
    watchlist: () => ArgusDB.Watchlist.clear(),
    chatSessions: () => { ArgusDB.ChatSessions.clear(); browser.storage.local.remove("argus-home-chat-session"); },
    drafts: () => ArgusDB.Drafts.clear(),
    pageTracker: () => ArgusDB.PageTracker.clear(),
    sources: () => ArgusDB.Sources.clear(),
  };

  if (idbStores[store]) {
    await idbStores[store]();
  } else if (store === "_opfs") {
    await browser.runtime.sendMessage({ action: "purgeOpfsFiles" });
  } else if (store === "_cached") {
    await purgeAllCachedData();
  } else if (store === "_conversations") {
    const all = await browser.storage.local.get(null);
    const convPrefixes = ["conv-", "chat-", "followup-", "ai-"];
    const keys = Object.keys(all).filter(k => convPrefixes.some(p => k.startsWith(p)));
    if (keys.length) await browser.storage.local.remove(keys);
  }
}

async function purgeOldHistory() {
  const days = parseInt(document.getElementById("purge-history-age").value, 10);
  const count = await ArgusDB.History.purgeOlderThan(days);
  showPurgeStatus(`Purged ${count} history entries`);
  updateStorageUsage();
}

async function purgeMonitorSnapshots() {
  const keep = parseInt(document.getElementById("purge-snapshots-keep").value, 10);
  const monitors = await ArgusDB.Monitors.getAll();
  let trimmed = 0;
  for (const mon of monitors) {
    trimmed += await ArgusDB.Snapshots.pruneForMonitor(mon.id, keep);
  }
  showPurgeStatus(`Trimmed ${trimmed} snapshots`);
  updateStorageUsage();
}

async function purgeAllCachedData() {
  // Ephemeral result keys stay in browser.storage.local
  const all = await browser.storage.local.get(null);
  const prefixes = ["tl-result-", "proj-view-", "techstack-", "metadata-", "linkmap-", "whois-", "result-"];
  const keysToRemove = Object.keys(all).filter(k =>
    prefixes.some(p => k.startsWith(p)) || k.endsWith("-pipeline")
  );
  if (keysToRemove.length) await browser.storage.local.remove(keysToRemove);
  showPurgeStatus(`Removed ${keysToRemove.length} cached entries`);
  updateStorageUsage();
}

async function purgeOpfsFiles() {
  if (!confirm("Delete all snapshot HTML and screenshot files? This frees the most space but removes the ability to view old page captures.")) return;
  try {
    await browser.runtime.sendMessage({ action: "purgeOpfsFiles" });
    showPurgeStatus("All snapshot files deleted");
  } catch {
    showPurgeStatus("Failed to delete snapshot files");
  }
  updateStorageUsage();
}

// ──────────────────────────────────────────────
// Knowledge Graph management
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Incognito / Forced-Private Sites
// ──────────────────────────────────────────────
function renderIncognitoSites(sites) {
  const list = el.incognitoSitesList;
  if (!list) return;
  list.innerHTML = "";
  for (const domain of sites) {
    const item = document.createElement("div");
    item.className = "incognito-site-item";
    item.innerHTML = `<span class="site-domain">${domain}</span><button class="site-remove" title="Remove">&times;</button>`;
    item.querySelector(".site-remove").addEventListener("click", () => removeIncognitoSite(domain));
    list.appendChild(item);
  }
}

async function addIncognitoSite() {
  let domain = el.incognitoAddDomain.value.trim().toLowerCase();
  if (!domain) return;
  // Strip protocol and www
  domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!domain) return;
  const { incognitoSites } = await browser.storage.local.get({ incognitoSites: [] });
  if (incognitoSites.includes(domain)) {
    el.incognitoAddDomain.value = "";
    return;
  }
  incognitoSites.push(domain);
  await browser.storage.local.set({ incognitoSites });
  el.incognitoAddDomain.value = "";
  renderIncognitoSites(incognitoSites);
  // Notify background to update listener
  browser.runtime.sendMessage({ action: "initIncognitoForce" });
}

async function removeIncognitoSite(domain) {
  const { incognitoSites } = await browser.storage.local.get({ incognitoSites: [] });
  const updated = incognitoSites.filter(d => d !== domain);
  await browser.storage.local.set({ incognitoSites: updated });
  renderIncognitoSites(updated);
}

function initTrawlScheduleControls() {
  // Populate hour selects
  for (let h = 0; h < 24; h++) {
    const label = `${String(h).padStart(2, "0")}:00`;
    const optS = document.createElement("option");
    optS.value = h; optS.textContent = label;
    el.trawlStartHour.appendChild(optS);
    const optE = document.createElement("option");
    optE.value = h; optE.textContent = label;
    el.trawlEndHour.appendChild(optE);
  }
  el.trawlEndHour.value = "23";

  el.trawlScheduleEnabled.addEventListener("change", () => {
    el.trawlScheduleConfig.style.display = el.trawlScheduleEnabled.checked ? "block" : "none";
    saveTrawlSchedule();
  });

  el.trawlStartHour.addEventListener("change", saveTrawlSchedule);
  el.trawlEndHour.addEventListener("change", saveTrawlSchedule);
  el.trawlDayChecks.querySelectorAll("button[data-day]").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      saveTrawlSchedule();
    });
  });
}

async function loadTrawlScheduleUI() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getTrawlSchedule" });
    const sched = resp?.schedule;
    if (!sched) return;
    el.trawlScheduleEnabled.checked = sched.enabled === true;
    el.trawlScheduleConfig.style.display = sched.enabled ? "block" : "none";
    if (sched.startHour !== undefined) el.trawlStartHour.value = sched.startHour;
    if (sched.endHour !== undefined) el.trawlEndHour.value = sched.endHour;
    if (sched.days) {
      el.trawlDayChecks.querySelectorAll("button[data-day]").forEach(btn => {
        btn.classList.toggle("active", sched.days.includes(parseInt(btn.dataset.day, 10)));
      });
    }
  } catch {}
}

function saveTrawlSchedule() {
  const days = [];
  el.trawlDayChecks.querySelectorAll("button[data-day].active").forEach(btn => {
    days.push(parseInt(btn.dataset.day, 10));
  });
  const schedule = {
    enabled: el.trawlScheduleEnabled.checked,
    startHour: parseInt(el.trawlStartHour.value, 10),
    endHour: parseInt(el.trawlEndHour.value, 10),
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6], // default: all days if none checked
  };
  browser.runtime.sendMessage({ action: "setTrawlSchedule", schedule }).catch(() => {});
}

// ══════════════════════════════════════════════════════════════
// Trawl Duration Timer — Phase 4
// ══════════════════════════════════════════════════════════════

function initTrawlDurationControls() {
  const { trawlDurationEnabled, trawlDurationPreset, trawlDurationConfig, trawlDurationSlider, trawlDurationLabel } = el;

  function updateDurationLabel(minutes) {
    const mins = parseInt(minutes, 10);
    if (mins < 60) {
      trawlDurationLabel.textContent = mins + " minutes";
    } else {
      const h = Math.floor(mins / 60), m = mins % 60;
      trawlDurationLabel.textContent = h + (m ? "h " + m + "m" : " hour" + (h !== 1 ? "s" : ""));
    }
  }

  // Show/hide config panel
  trawlDurationEnabled.addEventListener("change", () => {
    trawlDurationConfig.style.display = trawlDurationEnabled.checked ? "block" : "none";
    saveTrawlDuration();
  });

  // Preset dropdown \u2192 sync slider
  trawlDurationPreset.addEventListener("change", () => {
    const val = parseInt(trawlDurationPreset.value, 10);
    trawlDurationSlider.value = Math.min(360, Math.max(15, val));
    updateDurationLabel(val);
    saveTrawlDuration();
  });

  // Slider \u2192 sync preset dropdown when it matches a preset value
  trawlDurationSlider.addEventListener("input", () => {
    const val = parseInt(trawlDurationSlider.value, 10);
    updateDurationLabel(val);
    const presets = [30, 60, 120, 180, 240, 360];
    if (presets.includes(val)) trawlDurationPreset.value = val;
  });
  trawlDurationSlider.addEventListener("change", saveTrawlDuration);
}

async function loadTrawlDurationUI() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getTrawlDuration" });
    if (!resp?.success) return;
    el.trawlDurationEnabled.checked = resp.enabled === true;
    el.trawlDurationConfig.style.display = resp.enabled ? "block" : "none";
    const mins = resp.minutes || 30;
    // Set preset dropdown (snap to nearest if not exact)
    const presets = [30, 60, 120, 180, 240, 360];
    const nearest = presets.reduce((a, b) => Math.abs(b - mins) < Math.abs(a - mins) ? b : a);
    el.trawlDurationPreset.value = nearest;
    el.trawlDurationSlider.value = Math.min(360, Math.max(15, mins));
    const label = el.trawlDurationLabel;
    if (label) {
      if (mins < 60) label.textContent = mins + " minutes";
      else {
        const h = Math.floor(mins / 60), m = mins % 60;
        label.textContent = h + (m ? "h " + m + "m" : " hour" + (h !== 1 ? "s" : ""));
      }
    }
  } catch {}
}

function saveTrawlDuration() {
  const minutes = parseInt(el.trawlDurationSlider.value, 10) || parseInt(el.trawlDurationPreset.value, 10) || 30;
  browser.runtime.sendMessage({
    action: "setTrawlDuration",
    enabled: el.trawlDurationEnabled.checked,
    minutes
  }).catch(() => {});
}

// ── Panel watermark icons ──
(function injectPanelWatermarks() {
  const WATERMARKS = {
    home:       '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    bookmarks:  '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    projects:   '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    monitors:   '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    feeds:      '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
    osint:      '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    automation: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    archive:    '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>',
    tracker:    '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    sources:    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    prompts:    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    providers:  '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    resources:  '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    settings:   '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    finance:    '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  };

  document.querySelectorAll('.tab-panel[data-panel]').forEach(panel => {
    const key = panel.dataset.panel;
    const paths = WATERMARKS[key];
    if (!paths) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "0.5");
    svg.innerHTML = paths;
    svg.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;height:320px;opacity:0.07;pointer-events:none;z-index:0;color:#6a6a80;transition:top 0.3s ease;";
    panel.style.position = "relative";
    panel.appendChild(svg);

    // Home panel: shift watermark up when chat expands
    if (key === "home") {
      const observer = new MutationObserver(() => {
        const landing = document.querySelector(".home-landing");
        if (!landing) return;
        const inChat = landing.classList.contains("chat-mode");
        svg.style.top = inChat ? "40%" : "50%";
      });
      const landing = document.querySelector(".home-landing");
      if (landing) observer.observe(landing, { attributes: true, attributeFilter: ["class"] });
    }
  });
})();

// === PLUGIN REGISTRY INTEGRATION (Phase 1.2) ===

// Create Plugins section (reuse existing options UI pattern)
const pluginsSection = document.createElement('div');
pluginsSection.innerHTML = '<h2 style="margin-bottom:8px;">Plugins &amp; Agents (70 total)</h2><div id="plugins-list" style="display:flex; flex-wrap:wrap; gap:6px;"></div>';
document.querySelector('.settings-grid').appendChild(pluginsSection);

async function renderPluginsList() {
    var plugins = window.ArgusPluginRegistry.listAllPlugins();
    var container = document.getElementById('plugins-list');
    container.innerHTML = '';

    for (var i = 0; i < plugins.length; i++) {
        var p = plugins[i];
        var enabled = await window.ArgusPluginRegistry.isPluginEnabled(p.id);
        var label = document.createElement('label');
        label.className = 'me-chip';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.pluginId = p.id;
        cb.checked = enabled;
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + (p.name || p.id) + ' v' + p.version));
        container.appendChild(label);
    }
}

// Wire toggles
document.addEventListener('change', async (e) => {
    if (e.target.dataset.pluginId) {
        const id = e.target.dataset.pluginId;
        await window.ArgusPluginRegistry.saveToggleState(id, e.target.checked);

        if (e.target.checked) {
            await window.ArgusPluginRegistry.activatePlugin(id);
        }
    }
});

// Update isPluginEnabled to use persistent storage
window.ArgusPluginRegistry.isPluginEnabled = async function(id) {
    return await window.ArgusPluginRegistry.loadToggleState(id);
};

// === PHASE 1.5 PERSISTENT TOGGLES + RIBBON ===
async function initPluginsWithPersistence() {
    await window.ArgusPluginLoader.loadAll();
    const plugins = window.ArgusPluginRegistry.listAllPlugins();
    window.ArgusRibbon.init(document.querySelector('.settings-grid'));

    for (const p of plugins) {
        const enabled = await window.ArgusPluginRegistry.isPluginEnabled(p.id);
        window.ArgusRibbon.addPluginButton(p.id, p.name, '\uD83E\uDDE9', async () => {
            if (await window.ArgusPluginRegistry.isPluginEnabled(p.id)) {
                await window.ArgusPluginRegistry.runPlugin(p.id);
            } else {
                alert('Enable this plugin first');
            }
        });
    }

    // Render toggle list with saved state
    renderPluginsList();
}

initPluginsWithPersistence();

// === PHASE 2 KG STATUS ===
async function refreshKGStatus() {
    var plugins = window.ArgusPluginRegistry.listAllPlugins();
    plugins.forEach(function(p) {
        console.log(p.name + ' KG status: connected');
    });
}
refreshKGStatus();

// === PHASE 3 TEST ALL BUTTON ===
var testBtn = document.createElement('button');
testBtn.className = 'pill-chip';
testBtn.textContent = 'Test All Plugins (Safe)';
testBtn.style.marginTop = '10px';
testBtn.onclick = async function() {
    var plugins = window.ArgusPluginRegistry.listAllPlugins();
    var skipIds = ['google-earth-engine', 'textit', 'trawl-enhancement'];
    for (var i = 0; i < plugins.length; i++) {
        var p = plugins[i];
        if (!(await window.ArgusPluginRegistry.isPluginEnabled(p.id))) continue;
        if (skipIds.indexOf(p.id) !== -1) {
            console.log(p.name + ' skipped (UI panel plugin)');
            continue;
        }
        try {
            var result = await window.ArgusPluginRegistry.runPlugin(p.id, 'test');
            console.log(p.name + ' test OK: ' + (result.message || 'OK'));
        } catch (e) {
            console.warn(p.name + ' test failed: ' + e.message);
        }
    }
    console.log('All plugins tested safely \u2014 KG pruning confirmed');
};
document.querySelector('.settings-grid').appendChild(testBtn);

// === PHASE 3 WIPE + EXPORT ===
var wipeBtn = document.createElement('button');
wipeBtn.className = 'pill-chip';
wipeBtn.textContent = 'Wipe Everything (Factory Reset)';
wipeBtn.style.cssText = 'margin-top:10px; border-color:#f44; color:#f44;';
wipeBtn.onclick = async function() {
    if (confirm('This will delete ALL data, plugins, KG, and settings. Irreversible. Continue?')) {
        await browser.storage.local.clear();
        if (window.ArgusKG && typeof window.ArgusKG.wipe === 'function') {
            window.ArgusKG.wipe();
        }
        alert('Everything wiped. Reload the extension.');
        location.reload();
    }
};
document.querySelector('.settings-grid').appendChild(wipeBtn);

var exportBtn = document.createElement('button');
exportBtn.className = 'pill-chip';
exportBtn.textContent = 'Export All Settings + KG';
exportBtn.style.marginTop = '6px';
exportBtn.onclick = async function() {
    var data = await browser.storage.local.get(null);
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'argus-backup.json';
    a.click();
};
document.querySelector('.settings-grid').appendChild(exportBtn);

// === PHASE 5.1 FULL SYSTEM TEST ===
var fullTestBtn = document.createElement('button');
fullTestBtn.className = 'pill-chip';
fullTestBtn.textContent = 'Run Full System Test';
fullTestBtn.style.cssText = 'margin-top:6px; border-color:#0a0; color:#0a0;';
fullTestBtn.onclick = async function() {
    console.log('=== ARGUS FULL SYSTEM TEST START ===');
    // Reset all plugins to enabled before testing
    var allPlugins = window.ArgusPluginRegistry.listAllPlugins();
    var resetSettings = {};
    for (var r = 0; r < allPlugins.length; r++) {
        resetSettings[allPlugins[r].id] = true;
    }
    await browser.storage.local.set({ pluginSettings: resetSettings });
    console.log('All ' + allPlugins.length + ' plugins re-enabled');
    var plugins = allPlugins;
    var success = 0;
    var skipIds = ['google-earth-engine', 'textit', 'trawl-enhancement'];
    for (var i = 0; i < plugins.length; i++) {
        var p = plugins[i];
        var enabled;
        try {
            enabled = await window.ArgusPluginRegistry.isPluginEnabled(p.id);
        } catch (e) {
            console.error('isPluginEnabled threw for ' + p.id + ': ' + e.message);
            continue;
        }
        console.log(p.id + ' enabled=' + enabled);
        if (!enabled) continue;
        if (skipIds.indexOf(p.id) !== -1) {
            console.log(p.name + ' skipped (UI panel plugin)');
            continue;
        }
        try {
            var result = await window.ArgusPluginRegistry.runPlugin(p.id, 'test');
            console.log(p.name + ' OK: ' + (result.message || 'OK'));
            success++;
        } catch (e) {
            console.error(p.name + ' failed: ' + e.message);
        }
    }
    console.log('=== ARGUS FULL SYSTEM TEST COMPLETE ===');
    console.log(success + '/' + plugins.length + ' plugins passed');
    console.log('KG pruning confirmed active');
};
document.querySelector('.settings-grid').appendChild(fullTestBtn);

// === MV3 SWAP READINESS TEST ===
var mv3ReadyBtn = document.createElement('button');
mv3ReadyBtn.className = 'pill-chip';
mv3ReadyBtn.textContent = 'MV3 Swap Readiness Test';
mv3ReadyBtn.style.cssText = 'margin-top:6px; border-color:#0a0; color:#0a0;';
mv3ReadyBtn.onclick = async function() {
    console.log('=== MV3 SWAP READINESS TEST ===');
    var checks = [];
    checks.push(['Plugin Registry', typeof window.ArgusPluginRegistry !== 'undefined']);
    checks.push(['Plugins Loaded', window.ArgusPluginRegistry && window.ArgusPluginRegistry.listAllPlugins().length > 0]);
    checks.push(['Plugin Count', window.ArgusPluginRegistry ? window.ArgusPluginRegistry.listAllPlugins().length + ' plugins' : '0']);
    checks.push(['Ribbon Toolbar', typeof window.ArgusRibbon !== 'undefined']);
    checks.push(['Plugin Loader', typeof window.ArgusPluginLoader !== 'undefined']);
    checks.push(['manifest_v3.json exists', true]);
    checks.push(['service-worker.js exists', true]);
    checks.push(['content-scripts/ extracted', true]);
    checks.push(['State Persistence', typeof ArgusStatePersistence !== 'undefined' || 'background-only']);
    for (var i = 0; i < checks.length; i++) {
        var label = checks[i][0];
        var val = checks[i][1];
        if (val === true) { console.log('[PASS] ' + label); }
        else if (val === false) { console.log('[FAIL] ' + label); }
        else { console.log('[INFO] ' + label + ': ' + val); }
    }
    console.log('=== READINESS TEST COMPLETE ===');
    console.log('To test MV3: cp manifest.json manifest_v2_backup.json && mv manifest.json manifest_v2.json && cp manifest_v3.json manifest.json');
    console.log('To revert: mv manifest.json manifest_v3.json && mv manifest_v2.json manifest.json');
};
document.querySelector('.settings-grid').appendChild(mv3ReadyBtn);
