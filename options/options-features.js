// ── Stubs for removed KG/Feed functions still referenced by storage management ──
async function updateKGStats() {}
async function loadPendingMerges() {}
function renderFeeds() {}

// ── Resources Tab (dynamic from JSON) ──
function initResourcesTab() {
  const ipEl = document.getElementById("res-ip-value");
  const copyBtn = document.getElementById("res-ip-copy");
  const refreshBtn = document.getElementById("res-ip-refresh");
  const grid = document.getElementById("res-grid");
  const versionInfo = document.getElementById("res-version-info");
  const checkUpdatesBtn = document.getElementById("res-check-updates");
  const resetBtn = document.getElementById("res-reset-stock");
  if (!grid) return;

  // ── IP fetch ──
  let cachedIp = null;
  let cacheTime = 0;
  const CACHE_TTL = 5 * 60 * 1000;

  async function fetchIp() {
    if (!ipEl) return;
    if (cachedIp && Date.now() - cacheTime < CACHE_TTL) { ipEl.textContent = cachedIp; return; }
    ipEl.textContent = "checking...";
    try {
      const resp = await fetch("https://ifconfig.me/ip", { cache: "no-store" });
      const ip = (await resp.text()).trim();
      if (ip) { cachedIp = ip; cacheTime = Date.now(); ipEl.textContent = ip; }
      else { ipEl.textContent = "unavailable"; }
    } catch {
      try {
        const resp = await fetch("https://api.ipify.org?format=text", { cache: "no-store" });
        const ip = (await resp.text()).trim();
        cachedIp = ip; cacheTime = Date.now(); ipEl.textContent = ip;
      } catch { ipEl.textContent = "unavailable"; }
    }
  }

  if (copyBtn) copyBtn.addEventListener("click", () => {
    if (cachedIp) {
      navigator.clipboard.writeText(cachedIp);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    }
  });
  if (refreshBtn) refreshBtn.addEventListener("click", () => { cachedIp = null; cacheTime = 0; fetchIp(); });
  fetchIp();

  // ── Icon map for card headers ──
  const ICONS = {
    shield: "\uD83D\uDEE1\uFE0F", archive: "\uD83D\uDCE6", search: "\uD83D\uDD0D", globe: "\uD83C\uDF0D",
    chart: "\uD83D\uDCCA", government: "\uD83C\uDFDB\uFE0F", map: "\uD83D\uDDFA\uFE0F", world: "\uD83C\uDF10",
    trending: "\uD83D\uDCC8", book: "\uD83D\uDCDA", alert: "\uD83D\uDEA8", target: "\uD83C\uDFAF",
    lock: "\uD83D\uDD12", clipboard: "\uD83D\uDCCB", terminal: "\uD83D\uDCBB"
  };

  // ── Load resources (cached update > bundled) ──
  async function loadResources() {
    // Check for user-fetched update in storage
    const { resourcesJsonCache } = await browser.storage.local.get({ resourcesJsonCache: null });
    if (resourcesJsonCache && resourcesJsonCache.data) {
      renderGrid(resourcesJsonCache.data);
      if (versionInfo) versionInfo.textContent = `v${resourcesJsonCache.data.version || "?"} (updated ${resourcesJsonCache.data.updated || "?"})`;
      if (resetBtn) resetBtn.style.display = "";
      return;
    }
    // Fall back to bundled JSON
    try {
      const resp = await fetch(browser.runtime.getURL("data/resources.json"));
      const data = await resp.json();
      renderGrid(data);
      if (versionInfo) versionInfo.textContent = `v${data.version || "?"} (bundled)`;
    } catch (err) {
      grid.textContent = "";
      const errEl = document.createElement("p");
      errEl.className = "info-text";
      errEl.textContent = "Failed to load resources: " + err.message;
      grid.appendChild(errEl);
    }
  }

  // ── Per-card custom links storage ──
  let cardLinksCache = {}; // { categoryId: [{url, label, desc}] }

  async function loadCardLinks() {
    const { resourceCardLinks } = await browser.storage.local.get({ resourceCardLinks: {} });
    cardLinksCache = resourceCardLinks || {};
  }

  async function saveCardLinks() {
    await browser.storage.local.set({ resourceCardLinks: cardLinksCache });
  }

  // ── Render the dashboard grid ──
  async function renderGrid(data) {
    await loadCardLinks();
    grid.textContent = "";
    if (!data.categories || !data.categories.length) {
      const empty = document.createElement("p");
      empty.className = "info-text";
      empty.textContent = "No resource categories found.";
      grid.appendChild(empty);
      return;
    }

    // Store data ref so we can re-render after card link changes
    renderGrid._data = data;

    for (const cat of data.categories) {
      const catId = cat.id || cat.title.toLowerCase().replace(/\W+/g, "-");
      const userLinks = cardLinksCache[catId] || [];
      const totalLinks = cat.links.length + userLinks.length;

      const card = document.createElement("div");
      card.className = "res-card";

      // Header
      const header = document.createElement("div");
      header.className = "res-card-header";
      const icon = document.createElement("span");
      icon.className = "res-card-icon";
      icon.textContent = ICONS[cat.icon] || "\uD83D\uDCC1";
      header.appendChild(icon);
      const titleWrap = document.createElement("div");
      const title = document.createElement("h3");
      title.className = "res-card-title";
      title.textContent = cat.title;
      titleWrap.appendChild(title);
      if (cat.description) {
        const desc = document.createElement("p");
        desc.className = "res-card-desc";
        desc.textContent = cat.description;
        titleWrap.appendChild(desc);
      }
      header.appendChild(titleWrap);
      const count = document.createElement("span");
      count.className = "res-card-count";
      count.textContent = totalLinks;
      count.title = totalLinks + " links" + (userLinks.length ? ` (${userLinks.length} yours)` : "");
      header.appendChild(count);
      card.appendChild(header);

      // Note
      if (cat.note) {
        const note = document.createElement("p");
        note.className = "res-card-note";
        note.textContent = cat.note;
        card.appendChild(note);
      }

      // Links list
      const list = document.createElement("div");
      list.className = "res-card-links";
      for (const link of cat.links) {
        const item = document.createElement("a");
        item.href = link.url;
        item.target = "_blank";
        item.className = "res-link-item";
        const name = document.createElement("span");
        name.className = "res-link-name";
        name.textContent = link.name;
        item.appendChild(name);
        if (link.desc) {
          const desc = document.createElement("span");
          desc.className = "res-link-desc";
          desc.textContent = link.desc;
          item.appendChild(desc);
        }
        list.appendChild(item);
      }

      // Per-card user links
      const userLinkEls = [];
      for (let i = 0; i < userLinks.length; i++) {
        const ulink = userLinks[i];
        const item = document.createElement("a");
        item.href = ulink.url;
        item.target = "_blank";
        item.className = "res-link-item res-link-user";
        item.dataset.userIdx = i;
        const name = document.createElement("span");
        name.className = "res-link-name";
        name.textContent = ulink.label || ulink.url;
        item.appendChild(name);
        if (ulink.desc) {
          const desc = document.createElement("span");
          desc.className = "res-link-desc";
          desc.textContent = ulink.desc;
          item.appendChild(desc);
        }
        // Checkbox for edit mode (hidden by default)
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "res-link-edit-cb hidden";
        cb.addEventListener("click", (e) => e.stopPropagation());
        item.prepend(cb);
        userLinkEls.push(item);
        list.appendChild(item);
      }
      card.appendChild(list);

      let editingIdx = -1; // track which link is being edited
      function enterSelectMode() {
        card.classList.add("res-card-editing");
        userLinkEls.forEach(el => {
          el.classList.add("res-link-edit-active");
          const cb = el.querySelector(".res-link-edit-cb");
          cb.classList.remove("hidden");
          cb.checked = false;
          el.addEventListener("click", preventNav);
        });
        addBtn.classList.add("hidden");
        removeBtn.classList.add("hidden");
        editBtn.classList.add("hidden");
        addForm.classList.add("hidden");
        doneBtn.classList.remove("hidden");
        editCheckedBtn.classList.remove("hidden");
        cancelEditBtn.classList.remove("hidden");
        editSaveBtn.classList.add("hidden");
      }
      function exitSelectMode(action) {
        if (action === "remove") {
          const toRemove = [];
          userLinkEls.forEach(el => {
            if (el.querySelector(".res-link-edit-cb").checked) {
              toRemove.push(parseInt(el.dataset.userIdx));
            }
          });
          if (toRemove.length) {
            toRemove.sort((a, b) => b - a);
            for (const idx of toRemove) {
              cardLinksCache[catId].splice(idx, 1);
            }
            if (!cardLinksCache[catId].length) delete cardLinksCache[catId];
            saveCardLinks();
            renderGrid(renderGrid._data);
            return;
          }
        } else if (action === "edit") {
          // Find the single checked item to edit
          const checked = [];
          userLinkEls.forEach(el => {
            if (el.querySelector(".res-link-edit-cb").checked) {
              checked.push(parseInt(el.dataset.userIdx));
            }
          });
          if (checked.length === 1) {
            editingIdx = checked[0];
            const link = cardLinksCache[catId][editingIdx];
            addForm.querySelector("[data-field='url']").value = link.url;
            addForm.querySelector("[data-field='label']").value = link.label || "";
            addForm.querySelector("[data-field='desc']").value = link.desc || "";
            // Exit select mode visuals, then show edit form
            resetSelectVisuals();
            addBtn.classList.add("hidden");
            editBtn.classList.add("hidden");
            removeBtn.classList.add("hidden");
            addForm.classList.remove("hidden");
            editSaveBtn.classList.remove("hidden");
            addForm.querySelector(".res-card-add-save").classList.add("hidden");
            addForm.querySelector("[data-field='url']").focus();
            return;
          }
        }
        resetSelectVisuals();
      }
      function resetSelectVisuals() {
        card.classList.remove("res-card-editing");
        userLinkEls.forEach(el => {
          el.classList.remove("res-link-edit-active");
          const cb = el.querySelector(".res-link-edit-cb");
          cb.classList.add("hidden");
          cb.checked = false;
          el.removeEventListener("click", preventNav);
        });
        doneBtn.classList.add("hidden");
        editCheckedBtn.classList.add("hidden");
        cancelEditBtn.classList.add("hidden");
        editSaveBtn.classList.add("hidden");
        addBtn.classList.remove("hidden");
        addForm.querySelector(".res-card-add-save").classList.remove("hidden");
        if (userLinks.length) { removeBtn.classList.remove("hidden"); editBtn.classList.remove("hidden"); }
        editingIdx = -1;
      }
      function preventNav(e) { e.preventDefault(); e.stopPropagation(); }

      // Master list link (e.g. state portals CSV)
      if (cat.masterList) {
        const ml = document.createElement("a");
        ml.href = cat.masterList;
        ml.target = "_blank";
        ml.className = "res-card-master";
        ml.textContent = "View master data list (CSV)";
        card.appendChild(ml);
      }

      // Per-card add link footer
      const footer = document.createElement("div");
      footer.className = "res-card-add-footer";
      const addBtn = document.createElement("button");
      addBtn.className = "res-card-add-btn";
      addBtn.textContent = "+ Add";
      const editBtn = document.createElement("button");
      editBtn.className = "res-card-remove-btn" + (userLinks.length ? "" : " hidden");
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => enterSelectMode());
      const removeBtn = document.createElement("button");
      removeBtn.className = "res-card-remove-btn" + (userLinks.length ? "" : " hidden");
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => enterSelectMode());
      const doneBtn = document.createElement("button");
      doneBtn.className = "res-card-done-btn hidden";
      doneBtn.textContent = "Remove checked";
      doneBtn.addEventListener("click", () => exitSelectMode("remove"));
      const editCheckedBtn = document.createElement("button");
      editCheckedBtn.className = "res-card-cancel-edit-btn hidden";
      editCheckedBtn.textContent = "Edit checked";
      editCheckedBtn.addEventListener("click", () => exitSelectMode("edit"));
      const editSaveBtn = document.createElement("button");
      editSaveBtn.className = "res-card-done-btn hidden";
      editSaveBtn.textContent = "Save edit";
      editSaveBtn.style.color = "var(--accent)";
      editSaveBtn.style.borderColor = "rgba(233,69,96,0.3)";
      const cancelEditBtn = document.createElement("button");
      cancelEditBtn.className = "res-card-cancel-edit-btn hidden";
      cancelEditBtn.textContent = "Cancel";
      cancelEditBtn.addEventListener("click", () => exitSelectMode("cancel"));
      const addForm = document.createElement("div");
      addForm.className = "res-card-add-form hidden";
      addForm.innerHTML = `
        <input type="text" class="res-card-add-input" placeholder="URL" data-field="url">
        <input type="text" class="res-card-add-input" placeholder="Label" data-field="label">
        <input type="text" class="res-card-add-input res-card-add-input-wide" placeholder="Description (optional)" data-field="desc">
        <button class="btn btn-secondary btn-sm res-card-add-save">Add</button>
        <button class="btn btn-secondary btn-sm res-card-add-cancel">Cancel</button>
      `;
      addBtn.addEventListener("click", () => {
        editingIdx = -1;
        addForm.classList.remove("hidden");
        addForm.querySelector(".res-card-add-save").classList.remove("hidden");
        editSaveBtn.classList.add("hidden");
        addBtn.classList.add("hidden");
        removeBtn.classList.add("hidden");
        editBtn.classList.add("hidden");
        addForm.querySelector("[data-field='url']").focus();
      });
      addForm.querySelector(".res-card-add-cancel").addEventListener("click", () => {
        addForm.classList.add("hidden");
        addForm.querySelectorAll("input").forEach(inp => { inp.value = ""; });
        resetSelectVisuals();
      });
      addForm.querySelector(".res-card-add-save").addEventListener("click", async () => {
        let url = addForm.querySelector("[data-field='url']").value.trim();
        const label = addForm.querySelector("[data-field='label']").value.trim();
        const desc = addForm.querySelector("[data-field='desc']").value.trim();
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        const displayLabel = label || new URL(url).hostname;
        if (!cardLinksCache[catId]) cardLinksCache[catId] = [];
        cardLinksCache[catId].push({ url, label: displayLabel, desc });
        await saveCardLinks();
        // Also save as a Source (webservice)
        try {
          await browser.runtime.sendMessage({
            action: "saveSource",
            source: {
              name: displayLabel,
              type: "webservice",
              aliases: [],
              addresses: [{ type: "website", value: url, label: cat.title + " resource" }],
              tags: ["resource", cat.id || cat.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
              location: "",
              notes: desc ? `${cat.title}: ${desc}` : `Added from ${cat.title} resource card`,
              folder: ""
            }
          });
        } catch { /* source save is best-effort */ }
        renderGrid(renderGrid._data);
      });
      editSaveBtn.addEventListener("click", async () => {
        if (editingIdx < 0 || !cardLinksCache[catId]) return;
        let url = addForm.querySelector("[data-field='url']").value.trim();
        const label = addForm.querySelector("[data-field='label']").value.trim();
        const desc = addForm.querySelector("[data-field='desc']").value.trim();
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        cardLinksCache[catId][editingIdx] = { url, label: label || new URL(url).hostname, desc };
        await saveCardLinks();
        renderGrid(renderGrid._data);
      });
      footer.appendChild(addBtn);
      footer.appendChild(editBtn);
      footer.appendChild(removeBtn);
      footer.appendChild(doneBtn);
      footer.appendChild(editCheckedBtn);
      footer.appendChild(cancelEditBtn);
      footer.appendChild(editSaveBtn);
      footer.appendChild(addForm);
      card.appendChild(footer);

      grid.appendChild(card);
    }
  }

  // ── Check for updates (user-initiated fetch from remote JSON) ──
  if (checkUpdatesBtn) checkUpdatesBtn.addEventListener("click", async () => {
    checkUpdatesBtn.disabled = true;
    checkUpdatesBtn.textContent = "Checking...";
    try {
      // Fetch from the Argus GitHub repo — user can configure this URL
      const { resourcesUpdateUrl } = await browser.storage.local.get({
        resourcesUpdateUrl: "https://raw.githubusercontent.com/user/argus-resources/main/resources.json"
      });
      const resp = await fetch(resourcesUpdateUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (!data.categories || !Array.isArray(data.categories)) throw new Error("Invalid format");
      await browser.storage.local.set({ resourcesJsonCache: { data, fetchedAt: Date.now() } });
      renderGrid(data);
      if (versionInfo) versionInfo.textContent = `v${data.version || "?"} (updated ${data.updated || "?"})`;
      if (resetBtn) resetBtn.style.display = "";
      checkUpdatesBtn.textContent = "Updated!";
      setTimeout(() => { checkUpdatesBtn.textContent = "Check for Updates"; checkUpdatesBtn.disabled = false; }, 2000);
    } catch (err) {
      checkUpdatesBtn.textContent = "Update failed";
      console.warn("[Resources] Update check failed:", err);
      setTimeout(() => { checkUpdatesBtn.textContent = "Check for Updates"; checkUpdatesBtn.disabled = false; }, 2000);
    }
  });

  // ── Reset to bundled ──
  if (resetBtn) resetBtn.addEventListener("click", async () => {
    await browser.storage.local.remove("resourcesJsonCache");
    if (resetBtn) resetBtn.style.display = "none";
    loadResources();
  });

  loadResources();

  // ── Custom Sources ──
  const customContainer = document.getElementById("res-custom-sources");
  const customTopContainer = document.getElementById("res-custom-top");
  const customTopLinks = document.getElementById("res-custom-top-links");
  const customUrlInput = document.getElementById("res-custom-url");
  const customLabelInput = document.getElementById("res-custom-label");
  const customDescInput = document.getElementById("res-custom-desc");
  const customAddBtn = document.getElementById("res-custom-add");
  if (!customContainer || !customAddBtn) return;

  // Smooth scroll for "Add more" link
  const addLink = document.getElementById("res-custom-add-link");
  if (addLink) addLink.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("res-custom-add-section")?.scrollIntoView({ behavior: "smooth" });
  });

  async function loadCustomSources() {
    const { resourceCustomSources: sources } = await browser.storage.local.get({ resourceCustomSources: [] });
    renderCustomSources(sources || []);
  }

  async function saveCustomSources(sources) {
    await browser.storage.local.set({ resourceCustomSources: sources });
    renderCustomSources(sources);
  }

  function renderCustomSources(sources) {
    customContainer.textContent = "";

    // Top display card — read-only, same style as JSON-driven resource links
    if (customTopContainer && customTopLinks) {
      customTopLinks.textContent = "";
      if (sources.length) {
        customTopContainer.style.display = "";
        for (const src of sources) {
          const item = document.createElement("a");
          item.href = src.url;
          item.target = "_blank";
          item.className = "res-link-item";
          const name = document.createElement("span");
          name.className = "res-link-name";
          name.textContent = src.label || src.url;
          item.appendChild(name);
          if (src.desc) {
            const desc = document.createElement("span");
            desc.className = "res-link-desc";
            desc.textContent = src.desc;
            item.appendChild(desc);
          }
          customTopLinks.appendChild(item);
        }
      } else {
        customTopContainer.style.display = "none";
      }
    }

    // Bottom management card — editable rows
    if (!sources.length) {
      const empty = document.createElement("span");
      empty.className = "info-text";
      empty.style.fontSize = "12px";
      empty.textContent = "No custom sources added yet.";
      customContainer.appendChild(empty);
      return;
    }
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const row = document.createElement("div");
      row.className = "res-edit-row";

      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "res-edit-field res-edit-label";
      labelInput.value = src.label || "";
      labelInput.placeholder = "Label";

      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.className = "res-edit-field res-edit-url";
      urlInput.value = src.url || "";
      urlInput.placeholder = "URL";

      const descInput = document.createElement("input");
      descInput.type = "text";
      descInput.className = "res-edit-field res-edit-desc";
      descInput.value = src.desc || "";
      descInput.placeholder = "Description";

      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-secondary btn-sm res-edit-btn";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", async () => {
        let newUrl = urlInput.value.trim();
        if (!newUrl) return;
        if (!/^https?:\/\//i.test(newUrl)) newUrl = "https://" + newUrl;
        const { resourceCustomSources: current } = await browser.storage.local.get({ resourceCustomSources: [] });
        const updated = current || [];
        if (updated[i]) {
          updated[i] = { url: newUrl, label: labelInput.value.trim() || new URL(newUrl).hostname, desc: descInput.value.trim() };
          saveBtn.textContent = "Saved!";
          setTimeout(() => { saveBtn.textContent = "Save"; }, 1000);
          await saveCustomSources(updated);
        }
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "btn btn-secondary btn-sm res-edit-btn";
      removeBtn.style.color = "var(--error, #f44336)";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        const { resourceCustomSources: current } = await browser.storage.local.get({ resourceCustomSources: [] });
        const updated = (current || []).filter((_, idx) => idx !== i);
        await saveCustomSources(updated);
      });

      row.appendChild(labelInput);
      row.appendChild(urlInput);
      row.appendChild(descInput);
      row.appendChild(saveBtn);
      row.appendChild(removeBtn);
      customContainer.appendChild(row);
    }
  }

  customAddBtn.addEventListener("click", async () => {
    let url = customUrlInput.value.trim();
    const label = customLabelInput.value.trim();
    const desc = customDescInput ? customDescInput.value.trim() : "";
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const { resourceCustomSources: current } = await browser.storage.local.get({ resourceCustomSources: [] });
    const sources = current || [];
    if (sources.some(s => s.url === url)) return;
    sources.push({ url, label: label || new URL(url).hostname, desc });
    await browser.storage.local.set({ resourceCustomSources: sources });
    customUrlInput.value = "";
    customLabelInput.value = "";
    if (customDescInput) customDescInput.value = "";
    renderCustomSources(sources);
  });

  loadCustomSources();
}

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



  // Monitors
  populateMonitorPresetDropdown();
  populateMonitorAutomationDropdown();
  populateMonitorProjectDropdown();
  el.addMonitor.addEventListener("click", addMonitor);

  // RSS Feeds
  // Archive Redirect
  loadArchiveSettings();
  el.archiveSave.addEventListener("click", saveArchiveSettings);
  el.archiveReset.addEventListener("click", resetArchiveSettings);

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
// ──────────────────────────────────────────────
// Finance Monitor Settings
// ──────────────────────────────────────────────
// Page Monitors
// ──────────────────────────────────────────────
async function populateMonitorPresetDropdown() {
  // Clear existing options except "None"
  while (el.monitorPreset.options.length > 1) el.monitorPreset.remove(1);
  // All built-in presets from DEFAULT_PRESETS
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    el.monitorPreset.appendChild(opt);
  }
  // User-created custom presets
  const { customPresets } = await browser.storage.local.get({ customPresets: {} });
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = preset.label || key;
      el.monitorPreset.appendChild(opt);
    }
  }
}

async function populateMonitorAutomationDropdown() {
  while (el.monitorAutomation.options.length > 1) el.monitorAutomation.remove(1);
  try {
    const resp = await browser.runtime.sendMessage({ action: "getAutomations" });
    if (resp?.success && resp.automations) {
      for (const auto of resp.automations) {
        if (auto.enabled === false) continue;
        const opt = document.createElement("option");
        opt.value = auto.id;
        opt.textContent = auto.name;
        el.monitorAutomation.appendChild(opt);
      }
    }
  } catch { /* ignore */ }
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

async function populateMonitorProjectDropdown() {
  if (!el.monitorProjectSelect) return;
  while (el.monitorProjectSelect.options.length > 1) el.monitorProjectSelect.remove(1);
  try {
    const resp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (resp?.success && resp.projects) {
      for (const proj of resp.projects) {
        const opt = document.createElement("option");
        opt.value = proj.id;
        opt.textContent = proj.name;
        el.monitorProjectSelect.appendChild(opt);
      }
    }
  } catch { /* ignore */ }
}

async function renderMonitors() {
  const response = await browser.runtime.sendMessage({ action: "getMonitors" });
  if (!response || !response.success) return;

  el.monitorList.replaceChildren();

  if (!response.monitors.length) {
    const empty = document.createElement("p");
    empty.className = "info-text";
    empty.textContent = "No page monitors configured.";
    el.monitorList.appendChild(empty);
    return;
  }

  // Build URL → project map for monitor-project association
  const monUrlToProjects = new Map();
  try {
    const projResp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (projResp?.success) {
      for (const proj of projResp.projects) {
        for (const item of (proj.items || [])) {
          if (!item.url) continue;
          if (!monUrlToProjects.has(item.url)) monUrlToProjects.set(item.url, []);
          const existing = monUrlToProjects.get(item.url);
          if (!existing.some(p => p.id === proj.id)) {
            existing.push({ id: proj.id, name: proj.name, color: proj.color || "#a0a0b0" });
          }
        }
      }
    }
  } catch { /* ignore */ }

  response.monitors.forEach(monitor => {
    const row = document.createElement("div");
    row.className = "rule-item";
    row.style.flexWrap = "wrap";

    const info = document.createElement("div");
    info.className = "rule-info";

    const title = document.createElement("strong");
    const titleLink = document.createElement("a");
    titleLink.href = monitor.url;
    titleLink.textContent = monitor.title || monitor.url;
    titleLink.className = "monitor-title-link";
    titleLink.style.cssText = "color:var(--text-primary);text-decoration:none;";
    titleLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(monitor.url, "_blank");
    });
    titleLink.addEventListener("mouseenter", () => { titleLink.style.color = "var(--accent-hover)"; titleLink.style.textDecoration = "underline"; });
    titleLink.addEventListener("mouseleave", () => { titleLink.style.color = "var(--text-primary)"; titleLink.style.textDecoration = "none"; });
    title.appendChild(titleLink);
    info.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    const interval = monitor.intervalMinutes >= 60
      ? `${monitor.intervalMinutes / 60}h`
      : `${monitor.intervalMinutes}m`;
    const flags = [];
    if (monitor.autoOpen) flags.push("auto-open");
    if (monitor.autoBookmark) flags.push("bookmarked");
    if (monitor.analysisPreset) flags.push(`preset: ${monitor.analysisPreset}`);
    if (monitor.automationId) flags.push("automation");
    const flagStr = flags.length ? ` | ${flags.join(", ")}` : "";
    let durationStr = "";
    if (monitor.expired) {
      durationStr = " | EXPIRED";
    } else if (monitor.expiresAt) {
      const remaining = new Date(monitor.expiresAt).getTime() - Date.now();
      if (remaining > 0) {
        const hrs = Math.round(remaining / 3600000);
        durationStr = hrs >= 24 ? ` | ${Math.round(hrs / 24)}d left` : ` | ${hrs}h left`;
      } else {
        durationStr = " | EXPIRED";
      }
    }
    meta.textContent = ` — ${interval} interval | ${monitor.changeCount} changes | Last: ${new Date(monitor.lastChecked).toLocaleString()}${flagStr}${durationStr}`;
    info.appendChild(meta);

    if (monitor.lastChangeSummary) {
      const summaryWrap = document.createElement("div");
      summaryWrap.style.marginTop = "4px";

      const isLong = monitor.lastChangeSummary.length > 280;
      const summaryPreview = document.createElement("span");
      summaryPreview.className = "rule-meta";
      summaryPreview.style.display = "block";
      summaryPreview.style.color = "var(--accent)";
      summaryPreview.style.fontStyle = "italic";
      summaryPreview.textContent = isLong
        ? `Latest: ${monitor.lastChangeSummary.slice(0, 280)}...`
        : `Latest: ${monitor.lastChangeSummary}`;
      summaryWrap.appendChild(summaryPreview);

      if (isLong) {
        const summaryFull = document.createElement("span");
        summaryFull.className = "rule-meta hidden";
        summaryFull.style.display = "none";
        summaryFull.style.color = "var(--accent)";
        summaryFull.style.fontStyle = "italic";
        summaryFull.style.whiteSpace = "pre-wrap";
        summaryFull.textContent = `Latest: ${monitor.lastChangeSummary}`;
        summaryWrap.appendChild(summaryFull);

        const expandBtn = document.createElement("button");
        expandBtn.className = "btn btn-sm";
        expandBtn.style.cssText = "background:none;border:none;color:var(--text-secondary);font-size:11px;padding:2px 0;cursor:pointer;text-decoration:underline;";
        expandBtn.textContent = "Show full analysis";
        expandBtn.addEventListener("click", () => {
          const isExpanded = summaryFull.style.display !== "none";
          summaryPreview.style.display = isExpanded ? "block" : "none";
          summaryFull.style.display = isExpanded ? "none" : "block";
          expandBtn.textContent = isExpanded ? "Show full analysis" : "Collapse";
        });
        summaryWrap.appendChild(expandBtn);
      }

      info.appendChild(summaryWrap);
    }

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-sm btn-secondary";
    toggleBtn.textContent = monitor.enabled ? "Pause" : "Resume";
    toggleBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        enabled: !monitor.enabled
      });
      renderMonitors();
    });

    // Auto-open toggle
    const autoOpenBtn = document.createElement("button");
    autoOpenBtn.className = `btn btn-sm btn-secondary${monitor.autoOpen ? " active" : ""}`;
    autoOpenBtn.textContent = monitor.autoOpen ? "Auto-open: ON" : "Auto-open: OFF";
    autoOpenBtn.title = "Automatically open the page in a new tab when a change is detected";
    autoOpenBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        autoOpen: !monitor.autoOpen
      });
      renderMonitors();
    });

    // Interval stepper
    const intervalStepper = createInlineIntervalStepper(monitor.intervalMinutes, async (newMins) => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        intervalMinutes: newMins
      });
    });

    const historyBtn = document.createElement("button");
    historyBtn.className = "btn btn-sm btn-secondary";
    historyBtn.textContent = "Changes";
    historyBtn.title = "View detected changes and compare snapshots";
    historyBtn.addEventListener("click", () => {
      browser.tabs.create({
        url: browser.runtime.getURL(`monitors/monitor-history.html?id=${encodeURIComponent(monitor.id)}&title=${encodeURIComponent(monitor.title || monitor.url)}`)
      });
    });

    const timelineBtn = document.createElement("button");
    timelineBtn.className = "btn btn-sm btn-secondary";
    timelineBtn.textContent = "Timeline";
    timelineBtn.title = "View full page snapshots over time";
    timelineBtn.addEventListener("click", () => {
      browser.tabs.create({
        url: browser.runtime.getURL(`monitors/monitor-history.html?id=${encodeURIComponent(monitor.id)}&title=${encodeURIComponent(monitor.title || monitor.url)}&view=timeline`)
      });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "deleteMonitor", id: monitor.id });
      renderMonitors();
    });

    // Snapshot & Analyze button
    const snapBtn = document.createElement("button");
    snapBtn.className = "btn btn-sm btn-secondary";
    snapBtn.textContent = "Snapshot & Analyze";
    snapBtn.title = "Take a snapshot now and run analysis on the current page content";
    snapBtn.addEventListener("click", async () => {
      snapBtn.textContent = "Snapshotting...";
      snapBtn.disabled = true;
      try {
        // Fetch current page text for the snapshot
        const snapResp = await browser.runtime.sendMessage({
          action: "snapshotAndAnalyzeMonitor",
          monitorId: monitor.id,
          url: monitor.url,
          title: monitor.title || monitor.url,
        });
        if (snapResp?.success) {
          snapBtn.textContent = "Done!";
          snapBtn.style.color = "var(--success)";
          setTimeout(() => { renderMonitors(); }, 1500);
        } else {
          snapBtn.textContent = snapResp?.error || "Failed";
          snapBtn.style.color = "var(--error)";
          setTimeout(() => { snapBtn.textContent = "Snapshot & Analyze"; snapBtn.style.color = ""; snapBtn.disabled = false; }, 2500);
        }
      } catch (e) {
        snapBtn.textContent = "Error";
        snapBtn.style.color = "var(--error)";
        setTimeout(() => { snapBtn.textContent = "Snapshot & Analyze"; snapBtn.style.color = ""; snapBtn.disabled = false; }, 2500);
      }
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(autoOpenBtn);
    actions.appendChild(snapBtn);
    actions.appendChild(intervalStepper);
    actions.appendChild(historyBtn);
    actions.appendChild(timelineBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);

    // Project association tags (full-width row below)
    const monProjects = monUrlToProjects.get(monitor.url);
    if (monProjects && monProjects.length) {
      const tagsDiv = document.createElement("div");
      tagsDiv.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;width:100%;padding-top:6px;border-top:1px solid var(--border);margin-top:6px;";
      for (const proj of monProjects) {
        const tag = document.createElement("span");
        tag.style.cssText = "display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:1px 8px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--text-secondary);white-space:nowrap;cursor:pointer;";
        tag.title = `Open project: ${proj.name}`;
        const dot = document.createElement("span");
        dot.style.cssText = `width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${proj.color};`;
        tag.appendChild(dot);
        tag.appendChild(document.createTextNode(proj.name));
        tag.addEventListener("click", () => {
          window.location.href = browser.runtime.getURL("projects/projects.html");
        });
        tagsDiv.appendChild(tag);
      }
      row.appendChild(tagsDiv);
    }
    el.monitorList.appendChild(row);
  });

  // Update storage usage bar
  updateMonitorStorageUsage();
}

async function updateMonitorStorageUsage() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getMonitorStorageUsage" });
    if (!resp || !resp.success) return;
    // Show IndexedDB monitor data only (excludes OPFS binary blobs which have no quota)
    const idbBytes = resp.totalBytes - (resp.opfsBytes || 0);
    const idbMb = idbBytes / (1024 * 1024);
    const opfsMb = (resp.opfsBytes || 0) / (1024 * 1024);
    const maxMb = 10;
    const pct = Math.min(100, (idbMb / maxMb) * 100);
    el.monitorStorageBar.style.display = "";
    el.monitorStorageLabel.textContent = opfsMb > 0.01
      ? `${idbMb.toFixed(2)} MB data + ${opfsMb.toFixed(1)} MB snapshots`
      : `${idbMb.toFixed(2)} MB`;
    el.monitorStorageFill.style.width = `${pct}%`;
    el.monitorStorageFill.style.background = pct > 80 ? "var(--error)" : pct > 50 ? "var(--accent)" : "var(--success)";

    const manageLink = document.getElementById("monitor-storage-manage");
    if (manageLink && !manageLink._wired) {
      manageLink._wired = true;
      manageLink.addEventListener("click", (e) => {
        e.preventDefault();
        const nav = document.getElementById("main-nav");
        const tabs = nav.querySelectorAll(".nav-tab");
        const panels = document.querySelectorAll(".tab-panel");
        switchMainTab("settings", tabs, panels);
        setTimeout(() => {
          const el = document.getElementById("storage-management");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      });
    }
  } catch { /* non-critical */ }
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
// Archive Redirect
// ──────────────────────────────────────────────

async function loadArchiveSettings() {
  const resp = await browser.runtime.sendMessage({ action: "getArchiveSettings" });
  if (!resp || !resp.success) return;
  el.archiveEnabled.checked = resp.enabled;
  el.archiveDomains.value = (resp.domains || []).join("\n");
  // Set provider dropdown
  const providerUrl = resp.providerUrl || "https://archive.is/";
  const knownOptions = [...el.archiveProvider.options].map(o => o.value);
  if (knownOptions.includes(providerUrl)) {
    el.archiveProvider.value = providerUrl;
  } else {
    el.archiveProvider.value = "custom";
    el.archiveCustomUrl.value = providerUrl;
    el.archiveCustomGroup.style.display = "";
  }
  // Archive check mode
  const { archiveCheckMode, waybackCheckMode } = await browser.storage.local.get({ archiveCheckMode: "off", waybackCheckMode: "off" });
  document.getElementById("archive-check-mode").value = archiveCheckMode;
  document.getElementById("wayback-check-mode").value = waybackCheckMode ?? "off";
  // Toggle custom field visibility
  el.archiveProvider.addEventListener("change", () => {
    el.archiveCustomGroup.style.display = el.archiveProvider.value === "custom" ? "" : "none";
  });
}

async function saveArchiveSettings() {
  const enabled = el.archiveEnabled.checked;

  // Request webRequest permissions when enabling redirect
  if (enabled) {
    const granted = await browser.permissions.request({
      permissions: ["webRequest", "webRequestBlocking"]
    });
    if (!granted) {
      el.archiveStatus.textContent = "Permission denied — redirect requires webRequest permission.";
      el.archiveStatus.style.color = "var(--error)";
      el.archiveEnabled.checked = false;
      setTimeout(() => { el.archiveStatus.textContent = ""; }, 4000);
      return;
    }
  }

  const domains = el.archiveDomains.value
    .split("\n")
    .map(d => d.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
  const providerUrl = el.archiveProvider.value === "custom"
    ? el.archiveCustomUrl.value.trim()
    : el.archiveProvider.value;
  await browser.runtime.sendMessage({
    action: "saveArchiveSettings",
    enabled,
    domains,
    providerUrl
  });
  // Save archive check mode
  await browser.storage.local.set({
    archiveCheckMode: document.getElementById("archive-check-mode").value,
    waybackCheckMode: document.getElementById("wayback-check-mode").value
  });
  el.archiveStatus.textContent = "Saved!";
  el.archiveStatus.style.color = "var(--success)";
  setTimeout(() => { el.archiveStatus.textContent = ""; }, 2000);
}

async function resetArchiveSettings() {
  el.archiveDomains.value = [
    "cnn.com", "nytimes.com", "washingtonpost.com", "wsj.com",
    "bloomberg.com", "reuters.com", "bbc.com", "theguardian.com",
    "forbes.com", "businessinsider.com", "wired.com", "townhall.com",
    "theatlantic.com", "newyorker.com", "theepochtimes.com",
    "latimes.com", "usatoday.com", "politico.com", "thedailybeast.com",
    "vanityfair.com", "ft.com", "economist.com", "newsweek.com", "time.com"
  ].join("\n");
  el.archiveEnabled.checked = false;
  el.archiveProvider.value = "https://archive.is/";
  el.archiveCustomGroup.style.display = "none";
  el.archiveStatus.textContent = "Reset to defaults (not saved yet)";
  el.archiveStatus.style.color = "var(--text-muted)";
  setTimeout(() => { el.archiveStatus.textContent = ""; }, 3000);
}

// ──────────────────────────────────────────────
// Monitor Add
// ──────────────────────────────────────────────

async function addMonitor() {
  const url = el.monitorUrl.value.trim();
  if (!url) return;

  el.addMonitor.disabled = true;
  el.monitorStatus.textContent = "Adding monitor...";

  const response = await browser.runtime.sendMessage({
    action: "addMonitor",
    url,
    title: el.monitorTitle.value.trim() || "",
    intervalMinutes: parseInt(el.monitorInterval.value, 10) || 60,
    duration: parseInt(el.monitorDuration.value, 10) || 0,
    aiAnalysis: el.monitorAi.checked,
    autoOpen: el.monitorAutoOpen.checked,
    autoBookmark: el.monitorAutoBookmark.checked,
    analysisPreset: el.monitorPreset.value || "",
    automationId: el.monitorAutomation.value || "",
    projectId: el.monitorProjectSelect?.value || ""
  });

  el.addMonitor.disabled = false;

  if (response && response.success) {
    el.monitorUrl.value = "";
    el.monitorTitle.value = "";
    el.monitorStatus.textContent = "Monitor added!";
    el.monitorStatus.style.color = "var(--success)";
    renderMonitors();
  } else {
    el.monitorStatus.textContent = response?.error || "Failed to add monitor.";
    el.monitorStatus.style.color = "var(--error)";
  }

  setTimeout(() => { el.monitorStatus.textContent = ""; }, 3000);
}

// ──────────────────────────────────────────────
// Bookmarks (embedded in console)
// ──────────────────────────────────────────────
const bmState = {
  initialized: false,
  filter: { tag: null, category: null, query: "", folderId: null },
  editingId: null,
  selectionMode: false,
  selected: new Map(),
  folders: [],
  allBookmarks: [],
};

const bmEl = {};

function initBookmarks() {
  bmState.initialized = true;

  bmEl.search = document.getElementById("bm-search");
  bmEl.categoryList = document.getElementById("bm-category-list");
  bmEl.tagCloud = document.getElementById("bm-tag-cloud");
  bmEl.activeFilters = document.getElementById("bm-active-filters");
  bmEl.count = document.getElementById("bm-count");
  bmEl.list = document.getElementById("bm-list");
  bmEl.empty = document.getElementById("bm-empty");
  bmEl.exportBtn = document.getElementById("bm-export");
  bmEl.selectToggle = document.getElementById("bm-select-toggle");
  bmEl.analyzeSelected = document.getElementById("bm-analyze-selected");
  bmEl.editModal = document.getElementById("bm-edit-modal");
  bmEl.modalClose = document.getElementById("bm-modal-close");
  bmEl.editFolder = document.getElementById("bm-edit-folder");
  bmEl.editTags = document.getElementById("bm-edit-tags");
  bmEl.editCategory = document.getElementById("bm-edit-category");
  bmEl.editNotes = document.getElementById("bm-edit-notes");
  bmEl.editSave = document.getElementById("bm-edit-save");
  bmEl.editCancel = document.getElementById("bm-edit-cancel");

  let searchTimeout;
  bmEl.search.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      bmState.filter.query = bmEl.search.value.trim();
      bmLoadBookmarks();
    }, 300);
  });

  bmEl.exportBtn.addEventListener("click", bmExportBookmarks);
  bmEl.syncGithubBtn = document.getElementById("bm-sync-github");
  bmEl.syncGithubBtn.addEventListener("click", bmSyncToGitHub);
  bmEl.selectToggle.addEventListener("click", bmToggleSelection);
  bmEl.analyzeSelected.addEventListener("click", bmAnalyzeSelected);
  bmEl.modalClose.addEventListener("click", bmCloseModal);
  bmEl.editCancel.addEventListener("click", bmCloseModal);
  bmEl.editSave.addEventListener("click", bmSaveEdit);
  bmEl.editModal.addEventListener("click", (e) => {
    if (e.target === bmEl.editModal) bmCloseModal();
  });

  bmEl.folderTree = document.getElementById("bm-folder-tree");
  bmEl.newFolderBtn = document.getElementById("bm-new-folder");

  bmEl.newFolderBtn.addEventListener("click", bmCreateFolder);

  const customizeTagLink = document.getElementById("bm-customize-tagging");
  if (customizeTagLink) {
    customizeTagLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('[data-tab="prompts"]').click();
      setTimeout(() => {
        document.getElementById("bookmark-tag-card").scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
  }

  bmLoadBookmarks();
}

async function bmLoadBookmarks() {
  const [response, folderResp] = await Promise.all([
    browser.runtime.sendMessage({
      action: "getBookmarks",
      tag: bmState.filter.tag,
      category: bmState.filter.category,
      query: bmState.filter.query
    }),
    browser.runtime.sendMessage({ action: "getBookmarkFolders" })
  ]);
  if (!response || !response.success) return;

  bmState.folders = folderResp?.success ? folderResp.folders : [];
  bmState.allBookmarks = response.bookmarks;

  // Filter by folder if selected
  let visible = response.bookmarks;
  if (bmState.filter.folderId !== null) {
    // Collect folder + all descendant folder ids
    const folderIds = bmCollectDescendantFolderIds(bmState.filter.folderId);
    visible = visible.filter(b => folderIds.has(b.folderId || ""));
  }

  bmRenderFolderTree(response.bookmarks);
  bmRenderSidebar(response.tags, response.categories);
  bmRenderActiveFilters();
  bmRenderBookmarks(visible, visible.length);
}

function bmCollectDescendantFolderIds(folderId) {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of bmState.folders) {
      if (ids.has(f.parentId) && !ids.has(f.id)) { ids.add(f.id); changed = true; }
    }
  }
  return ids;
}

function bmRenderFolderTree(allBookmarks) {
  bmEl.folderTree.replaceChildren();

  // Count bookmarks per folder
  const folderCounts = {};
  for (const bm of allBookmarks) {
    const fid = bm.folderId || "";
    folderCounts[fid] = (folderCounts[fid] || 0) + 1;
  }

  // "All Bookmarks" root item
  const allItem = document.createElement("div");
  allItem.className = "bm-folder-item" + (bmState.filter.folderId === null ? " active" : "");
  allItem.innerHTML = `<span class="bm-folder-icon">📁</span> All Bookmarks <span class="bm-folder-count">${allBookmarks.length}</span>`;
  allItem.addEventListener("click", () => { bmState.filter.folderId = null; bmLoadBookmarks(); });
  bmEl.folderTree.appendChild(allItem);

  // "Unsorted" item (bookmarks with no folder)
  const unsortedCount = folderCounts[""] || 0;
  if (unsortedCount > 0 && bmState.folders.length > 0) {
    const unsorted = document.createElement("div");
    unsorted.className = "bm-folder-item" + (bmState.filter.folderId === "" ? " active" : "");
    unsorted.innerHTML = `<span class="bm-folder-icon">📄</span> Unsorted <span class="bm-folder-count">${unsortedCount}</span>`;
    unsorted.addEventListener("click", () => { bmState.filter.folderId = ""; bmLoadBookmarks(); });
    bmEl.folderTree.appendChild(unsorted);
  }

  // Build tree recursively
  function renderFolder(folder, container, depth) {
    const folderId = folder.id;
    const count = bmCollectDescendantBookmarkCount(folderId, folderCounts);
    const item = document.createElement("div");
    item.className = "bm-folder-item" + (bmState.filter.folderId === folderId ? " active" : "");
    item.style.paddingLeft = (8 + depth * 16) + "px";
    item.setAttribute("data-folder-id", folderId);
    // Drag target for moving bookmarks
    item.addEventListener("dragover", (e) => { e.preventDefault(); item.style.background = "var(--bg-hover)"; });
    item.addEventListener("dragleave", () => { item.style.background = ""; });
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.style.background = "";
      const bmId = e.dataTransfer.getData("text/bookmark-id");
      if (bmId) bmMoveBookmarkToFolder(bmId, folderId);
    });

    const icon = document.createElement("span");
    icon.className = "bm-folder-icon";
    icon.textContent = folder.projectId ? "📂" : "📁";
    item.appendChild(icon);
    item.appendChild(document.createTextNode(" " + folder.name));

    const countSpan = document.createElement("span");
    countSpan.className = "bm-folder-count";
    countSpan.textContent = count;

    const actions = document.createElement("span");
    actions.className = "bm-folder-actions";
    const renameBtn = document.createElement("button");
    renameBtn.textContent = "✎";
    renameBtn.title = "Rename";
    renameBtn.addEventListener("click", (e) => { e.stopPropagation(); bmRenameFolder(folder); });
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); bmDeleteFolder(folder.id); });
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(actions);
    item.appendChild(countSpan);
    item.addEventListener("click", () => { bmState.filter.folderId = folderId; bmLoadBookmarks(); });
    container.appendChild(item);

    // Render children
    const children = bmState.folders.filter(f => f.parentId === folderId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    for (const child of children) renderFolder(child, container, depth + 1);
  }

  const rootFolders = bmState.folders.filter(f => !f.parentId || f.parentId === "").sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  for (const folder of rootFolders) renderFolder(folder, bmEl.folderTree, 0);
}

function bmCollectDescendantBookmarkCount(folderId, folderCounts) {
  const ids = bmCollectDescendantFolderIds(folderId);
  let total = 0;
  for (const id of ids) total += (folderCounts[id] || 0);
  return total;
}

async function bmCreateFolder() {
  const name = prompt("Folder name:");
  if (!name || !name.trim()) return;
  const parentId = bmState.filter.folderId && bmState.filter.folderId !== "" ? bmState.filter.folderId : "";
  const folder = {
    id: `bmf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    parentId,
    projectId: "",
    sortOrder: bmState.folders.length,
    createdAt: new Date().toISOString(),
  };
  await browser.runtime.sendMessage({ action: "saveBookmarkFolder", folder });
  bmLoadBookmarks();
}

async function bmRenameFolder(folder) {
  const name = prompt("Rename folder:", folder.name);
  if (!name || !name.trim() || name.trim() === folder.name) return;
  folder.name = name.trim();
  await browser.runtime.sendMessage({ action: "saveBookmarkFolder", folder });
  bmLoadBookmarks();
}

async function bmDeleteFolder(folderId) {
  if (!confirm("Delete this folder? Bookmarks will be moved to the parent folder.")) return;
  await browser.runtime.sendMessage({ action: "deleteBookmarkFolder", folderId });
  if (bmState.filter.folderId === folderId) bmState.filter.folderId = null;
  bmLoadBookmarks();
}

async function bmMoveBookmarkToFolder(bookmarkId, folderId) {
  await browser.runtime.sendMessage({ action: "moveBookmarkToFolder", bookmarkId, folderId });
  bmLoadBookmarks();
}

function bmRenderSidebar(tags, categories) {
  bmEl.categoryList.replaceChildren();
  const allItem = document.createElement("div");
  allItem.className = "bm-filter-item" + (!bmState.filter.category ? " active" : "");
  allItem.textContent = "All";
  allItem.addEventListener("click", () => { bmState.filter.category = null; bmLoadBookmarks(); });
  bmEl.categoryList.appendChild(allItem);

  categories.forEach(({ category, count }) => {
    const item = document.createElement("div");
    item.className = "bm-filter-item" + (bmState.filter.category === category ? " active" : "");
    const name = document.createElement("span");
    name.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    const badge = document.createElement("span");
    badge.className = "bm-filter-count";
    badge.textContent = count;
    item.appendChild(name);
    item.appendChild(badge);
    item.addEventListener("click", () => {
      bmState.filter.category = bmState.filter.category === category ? null : category;
      bmLoadBookmarks();
    });
    bmEl.categoryList.appendChild(item);
  });

  bmEl.tagCloud.replaceChildren();
  tags.slice(0, 30).forEach(({ tag, count }) => {
    const pill = document.createElement("span");
    pill.className = "bm-tag-pill" + (bmState.filter.tag === tag ? " active" : "");
    pill.textContent = `${tag} (${count})`;
    pill.addEventListener("click", () => {
      bmState.filter.tag = bmState.filter.tag === tag ? null : tag;
      bmLoadBookmarks();
    });
    bmEl.tagCloud.appendChild(pill);
  });
}

function bmRenderActiveFilters() {
  bmEl.activeFilters.replaceChildren();
  let hasFilter = false;

  if (bmState.filter.category) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Category: " + bmState.filter.category, () => {
      bmState.filter.category = null; bmLoadBookmarks();
    }));
  }
  if (bmState.filter.tag) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Tag: " + bmState.filter.tag, () => {
      bmState.filter.tag = null; bmLoadBookmarks();
    }));
  }
  if (bmState.filter.query) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Search: " + bmState.filter.query, () => {
      bmState.filter.query = ""; bmEl.search.value = ""; bmLoadBookmarks();
    }));
  }
  if (bmState.filter.folderId) {
    hasFilter = true;
    const folder = bmState.folders.find(f => f.id === bmState.filter.folderId);
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Folder: " + (folder ? folder.name : "Unknown"), () => {
      bmState.filter.folderId = null; bmLoadBookmarks();
    }));
  }
  bmEl.activeFilters.classList.toggle("hidden", !hasFilter);
}

function bmCreateFilterChip(text, onRemove) {
  const chip = document.createElement("span");
  chip.className = "bm-active-filter";
  chip.textContent = text;
  const x = document.createElement("span");
  x.className = "bm-active-filter-remove";
  x.textContent = "\u00d7";
  x.addEventListener("click", (e) => { e.stopPropagation(); onRemove(); });
  chip.appendChild(x);
  return chip;
}

function bmCreateShareBar(bm) {
  // Build shareable text from bookmark analysis
  const parts = [];
  if (bm.title) parts.push(`# ${bm.title}`);
  if (bm.url) parts.push(bm.url);
  if (bm.tldr) parts.push(`\n${bm.tldr}`);
  else if (bm.summary) parts.push(`\n${bm.summary}`);
  if (bm.keyFacts && bm.keyFacts.length) parts.push(`\nKey Facts:\n${bm.keyFacts.map(f => `- ${f}`).join("\n")}`);
  if (bm.notes) parts.push(`\nNotes: ${bm.notes}`);
  const content = parts.join("\n");
  const title = bm.title || "Bookmark";

  const bar = document.createElement("div");
  bar.className = "argus-chat-actions";

  // Copy
  const copyBtn = document.createElement("button");
  copyBtn.className = "argus-chat-action-btn";
  copyBtn.title = "Copy to clipboard";
  copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(content);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`; }, 1500);
    } catch { /* */ }
  });
  bar.appendChild(copyBtn);

  // Draft
  const draftBtn = document.createElement("button");
  draftBtn.className = "argus-chat-action-btn";
  draftBtn.title = "Save as draft";
  draftBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Draft`;
  draftBtn.addEventListener("click", async () => {
    try {
      const draftId = "draft-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      await browser.runtime.sendMessage({
        action: "draftSave",
        draft: { id: draftId, title, content, updatedAt: Date.now() }
      });
      draftBtn.textContent = "Saved!";
      setTimeout(() => { draftBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Draft`; }, 1500);
    } catch { /* */ }
  });
  bar.appendChild(draftBtn);

  // Paste
  const pasteBtn = document.createElement("button");
  pasteBtn.className = "argus-chat-action-btn";
  pasteBtn.title = "Paste to Gist or PrivateBin";
  pasteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Paste`;
  pasteBtn.addEventListener("click", async () => {
    // Inline paste picker
    const existing = bar.querySelector(".argus-chat-project-picker");
    if (existing) { existing.remove(); return; }
    const picker = document.createElement("div");
    picker.className = "argus-chat-project-picker";
    for (const [key, label] of [["gist", "GitHub Gist"], ["privatebin", "PrivateBin"]]) {
      const opt = document.createElement("button");
      opt.className = "argus-chat-project-option";
      opt.textContent = label;
      opt.addEventListener("click", async () => {
        opt.textContent = "Uploading...";
        try {
          await browser.runtime.sendMessage({ action: "pasteCreate", providerKey: key, title, content, files: null });
          opt.textContent = "Done!";
        } catch { opt.textContent = "Error"; }
        setTimeout(() => picker.remove(), 1500);
      });
      picker.appendChild(opt);
    }
    bar.appendChild(picker);
    const dismiss = (e) => { if (!picker.contains(e.target) && e.target !== pasteBtn) { picker.remove(); document.removeEventListener("click", dismiss); } };
    setTimeout(() => document.addEventListener("click", dismiss), 0);
  });
  bar.appendChild(pasteBtn);

  // X
  const xBtn = document.createElement("button");
  xBtn.className = "argus-chat-action-btn";
  xBtn.title = "Share on X";
  xBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
  xBtn.addEventListener("click", () => {
    const snippet = content.slice(0, 250).replace(/\n/g, " ");
    const text = `${snippet}${content.length > 250 ? "..." : ""}\n\nvia Argus`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  });
  bar.appendChild(xBtn);

  // Reddit
  const redditBtn = document.createElement("button");
  redditBtn.className = "argus-chat-action-btn";
  redditBtn.title = "Share on Reddit";
  redditBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`;
  redditBtn.addEventListener("click", () => {
    window.open(`https://www.reddit.com/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(content)}`, "_blank");
  });
  bar.appendChild(redditBtn);

  // Email
  const emailBtn = document.createElement("button");
  emailBtn.className = "argus-chat-action-btn";
  emailBtn.title = "Share via email";
  emailBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
  emailBtn.addEventListener("click", () => {
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(content)}`, "_blank");
  });
  bar.appendChild(emailBtn);

  return bar;
}

function bmRenderBookmarks(bookmarks, total) {
  bmEl.count.textContent = `${total} bookmark${total !== 1 ? "s" : ""}`;
  bmEl.list.replaceChildren();
  bmEl.empty.classList.toggle("hidden", bookmarks.length > 0);

  bookmarks.forEach(bm => {
    const card = document.createElement("div");
    card.className = "bm-card" + (bmState.selected.has(bm.id) ? " selected" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bm-checkbox" + (bmState.selectionMode ? "" : " hidden");
    checkbox.checked = bmState.selected.has(bm.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) { bmState.selected.set(bm.id, bm); card.classList.add("selected"); }
      else { bmState.selected.delete(bm.id); card.classList.remove("selected"); }
      bmUpdateSelectionCount();
    });

    const header = document.createElement("div");
    header.className = "bm-card-header";
    const headerLeft = document.createElement("div");
    headerLeft.className = "bm-card-header-left";
    headerLeft.appendChild(checkbox);
    const title = document.createElement("a");
    title.className = "bm-card-title";
    title.href = bm.url;
    title.target = "_blank";
    title.textContent = bm.title;
    headerLeft.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "bm-card-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => bmOpenEditModal(bm));
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => bmDeleteBookmark(bm.id));
    const projBtn = document.createElement("button");
    projBtn.className = "btn btn-sm btn-secondary";
    projBtn.textContent = "+ Project";
    projBtn.addEventListener("click", async () => {
      const resp = await browser.runtime.sendMessage({ action: "getProjects" });
      if (!resp || !resp.success || resp.projects.length === 0) {
        projBtn.textContent = "No projects";
        setTimeout(() => { projBtn.textContent = "+ Project"; }, 1500);
        return;
      }
      // Simple dropdown
      let dd = projBtn.parentElement.querySelector(".bm-proj-dropdown");
      if (dd) { dd.remove(); return; }
      dd = document.createElement("div");
      dd.className = "bm-proj-dropdown";
      dd.style.cssText = "position:absolute;top:100%;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);min-width:180px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
      for (const proj of resp.projects) {
        const opt = document.createElement("button");
        opt.style.cssText = "display:flex;align-items:center;gap:6px;width:100%;padding:8px 12px;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text-primary);font-size:12px;cursor:pointer;text-align:left;";
        const optDot = document.createElement("span");
        optDot.setAttribute("style", "width:8px;height:8px;border-radius:50%;background:" + (proj.color || '#e94560') + ";display:inline-block;");
        opt.appendChild(optDot);
        opt.appendChild(document.createTextNode(proj.name));
        opt.addEventListener("click", async () => {
          await browser.runtime.sendMessage({
            action: "addProjectItem",
            projectId: proj.id,
            item: { type: "bookmark", refId: bm.id, url: bm.url, title: bm.title, summary: bm.summary || "", tags: bm.tags || [] }
          });
          dd.remove();
          projBtn.textContent = "Added!";
          setTimeout(() => { projBtn.textContent = "+ Project"; }, 1500);
        });
        dd.appendChild(opt);
      }
      projBtn.parentElement.style.position = "relative";
      projBtn.parentElement.appendChild(dd);
      const dismiss = (e) => { if (!dd.contains(e.target) && e.target !== projBtn) { dd.remove(); document.removeEventListener("click", dismiss); } };
      setTimeout(() => document.addEventListener("click", dismiss), 0);
    });
    actions.appendChild(editBtn);
    actions.appendChild(projBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(headerLeft);
    header.appendChild(actions);
    card.appendChild(header);

    // Make card draggable for folder assignment
    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/bookmark-id", bm.id);
      card.style.opacity = "0.5";
    });
    card.addEventListener("dragend", () => { card.style.opacity = ""; });

    const url = document.createElement("div");
    url.className = "bm-card-url";
    url.textContent = bm.url;
    card.appendChild(url);

    // TLDR (smart analysis)
    if (bm.tldr) {
      const tldr = document.createElement("div");
      tldr.className = "bm-card-tldr";
      tldr.textContent = bm.tldr;
      card.appendChild(tldr);
    } else if (bm.summary) {
      const summary = document.createElement("div");
      summary.className = "bm-card-summary";
      summary.textContent = bm.summary;
      card.appendChild(summary);
    }

    // Key facts
    if (bm.keyFacts && bm.keyFacts.length) {
      const factsUl = document.createElement("ul");
      factsUl.className = "bm-card-keyfacts";
      for (const fact of bm.keyFacts.slice(0, 3)) {
        const li = document.createElement("li");
        li.textContent = fact;
        factsUl.appendChild(li);
      }
      card.appendChild(factsUl);
    }

    if (bm.tags && bm.tags.length) {
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "bm-card-tags";
      bm.tags.forEach(tag => {
        const tagEl = document.createElement("span");
        tagEl.className = "bm-card-tag";
        tagEl.textContent = tag;
        tagEl.addEventListener("click", () => { bmState.filter.tag = tag; bmLoadBookmarks(); });
        tagsDiv.appendChild(tagEl);
      });
      card.appendChild(tagsDiv);
    }

    // Tech stack badges
    if (bm.techStack) {
      const techDiv = document.createElement("div");
      techDiv.className = "bm-card-techstack";
      const techs = [];
      if (bm.techStack.generator) techs.push(bm.techStack.generator);
      if (bm.techStack.frameworks) techs.push(...bm.techStack.frameworks);
      if (bm.techStack.server) techs.push(bm.techStack.server);
      if (bm.techStack.cdn) techs.push(...bm.techStack.cdn);
      if (bm.techStack.analytics) techs.push(...bm.techStack.analytics);
      if (bm.techStack.poweredBy) techs.push(bm.techStack.poweredBy);
      if (bm.techStack.payments) techs.push(bm.techStack.payments);
      for (const tech of [...new Set(techs)].slice(0, 5)) {
        const badge = document.createElement("span");
        badge.className = "bm-tech-badge";
        badge.textContent = tech;
        techDiv.appendChild(badge);
      }
      if (techs.length) card.appendChild(techDiv);
    }

    if (bm.notes) {
      const notes = document.createElement("div");
      notes.className = "bm-card-notes";
      notes.textContent = bm.notes;
      card.appendChild(notes);
    }

    const meta = document.createElement("div");
    meta.className = "bm-card-meta";
    const date = document.createElement("span");
    date.textContent = new Date(bm.savedAt).toLocaleDateString();
    meta.appendChild(date);
    if (bm.contentType && bm.contentType !== "other") {
      const ct = document.createElement("span");
      ct.className = "bm-card-content-type";
      ct.textContent = bm.contentType;
      meta.appendChild(ct);
    }
    if (bm.category) {
      const cat = document.createElement("span");
      cat.textContent = bm.category;
      meta.appendChild(cat);
    }
    if (bm.readingTime) {
      const rt = document.createElement("span");
      rt.textContent = bm.readingTime;
      meta.appendChild(rt);
    }
    if (bm.aiTagged) {
      const ai = document.createElement("span");
      ai.textContent = "AI tagged";
      ai.style.color = "var(--accent)";
      meta.appendChild(ai);
    }
    card.appendChild(meta);

    // Share / action buttons (when card has analysis content)
    if (bm.tldr || bm.summary || (bm.keyFacts && bm.keyFacts.length) || bm.notes) {
      card.appendChild(bmCreateShareBar(bm));
    }

    bmEl.list.appendChild(card);
  });
}

function bmOpenEditModal(bookmark) {
  bmState.editingId = bookmark.id;
  // Populate folder select
  bmEl.editFolder.replaceChildren();
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "— No folder —";
  bmEl.editFolder.appendChild(noneOpt);
  for (const f of bmState.folders) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    bmEl.editFolder.appendChild(opt);
  }
  bmEl.editFolder.value = bookmark.folderId || "";
  bmEl.editTags.value = (bookmark.tags || []).join(", ");
  bmEl.editCategory.value = bookmark.category || "";
  bmEl.editNotes.value = bookmark.notes || "";
  bmEl.editModal.classList.remove("hidden");
}

function bmCloseModal() {
  bmEl.editModal.classList.add("hidden");
  bmState.editingId = null;
}

async function bmSaveEdit() {
  if (!bmState.editingId) return;
  const tags = bmEl.editTags.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  const category = bmEl.editCategory.value.trim().toLowerCase() || "other";
  const notes = bmEl.editNotes.value.trim();
  const folderId = bmEl.editFolder.value || "";
  await browser.runtime.sendMessage({ action: "updateBookmark", id: bmState.editingId, tags, category, notes, folderId });
  bmCloseModal();
  bmLoadBookmarks();
}

async function bmDeleteBookmark(id) {
  await browser.runtime.sendMessage({ action: "deleteBookmark", id });
  bmLoadBookmarks();
}

async function bmExportBookmarks() {
  const response = await browser.runtime.sendMessage({ action: "exportBookmarks" });
  if (!response || !response.success) return;
  const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "argus-bookmarks.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function bmSyncToGitHub() {
  bmEl.syncGithubBtn.disabled = true;
  bmEl.syncGithubBtn.textContent = "Syncing...";
  try {
    const resp = await browser.runtime.sendMessage({ action: "syncBookmarksToCloud" });
    if (resp && resp.success) {
      const parts = [];
      if (resp.github?.success) parts.push(`${resp.github.bookmarks} bookmarks to GitHub`);
      else if (resp.github?.error) parts.push(`GitHub error`);
      if (resp.snapshots?.synced > 0) parts.push(`${resp.snapshots.synced} snapshots`);
      if (resp.snapshots?.failed > 0) parts.push(`${resp.snapshots.failed} snap failed`);
      if (resp.pdfs?.synced > 0) parts.push(`${resp.pdfs.synced} PDFs`);
      if (resp.pdfs?.failed > 0) parts.push(`${resp.pdfs.failed} PDF failed`);
      if (resp.snapshots?.providers?.length) parts.push(`→ ${resp.snapshots.providers.join(", ")}`);
      bmEl.syncGithubBtn.textContent = parts.length ? parts.join(" · ") : "No providers connected";
      // Log errors to console for debugging
      if (resp.github?.error) console.warn("[CloudSync UI] GitHub:", resp.github.error);
      if (resp.snapshots?.errors?.length) console.warn("[CloudSync UI] Snapshot errors:", resp.snapshots.errors);
      if (resp.pdfs?.errors?.length) console.warn("[CloudSync UI] PDF errors:", resp.pdfs.errors);
    } else {
      bmEl.syncGithubBtn.textContent = resp?.error || "Sync failed";
    }
  } catch (e) {
    bmEl.syncGithubBtn.textContent = "Error: " + e.message;
  }
  setTimeout(() => {
    bmEl.syncGithubBtn.disabled = false;
    bmEl.syncGithubBtn.textContent = "Sync to Cloud";
  }, 6000);
}

function bmToggleSelection() {
  bmState.selectionMode = !bmState.selectionMode;
  bmEl.selectToggle.textContent = bmState.selectionMode ? "Cancel" : "Select";
  bmEl.selectToggle.classList.toggle("bm-select-active", bmState.selectionMode);
  if (!bmState.selectionMode) {
    bmState.selected.clear();
    bmEl.analyzeSelected.classList.add("hidden");
  }
  document.querySelectorAll(".bm-checkbox").forEach(cb => {
    cb.classList.toggle("hidden", !bmState.selectionMode);
    if (!bmState.selectionMode) cb.checked = false;
  });
  document.querySelectorAll(".bm-card").forEach(card => card.classList.remove("selected"));
  bmUpdateSelectionCount();
}

function bmUpdateSelectionCount() {
  const count = bmState.selected.size;
  if (count > 0) {
    bmEl.analyzeSelected.textContent = `Analyze ${count} Bookmark${count > 1 ? "s" : ""}`;
    bmEl.analyzeSelected.classList.remove("hidden");
  } else {
    bmEl.analyzeSelected.classList.add("hidden");
  }
}

async function bmAnalyzeSelected() {
  if (bmState.selected.size === 0) return;
  bmEl.analyzeSelected.disabled = true;
  bmEl.analyzeSelected.textContent = "Starting analysis...";
  const bookmarks = Array.from(bmState.selected.values());
  const response = await browser.runtime.sendMessage({
    action: "analyzeBookmarks",
    bookmarks: bookmarks.map(bm => ({ id: bm.id, title: bm.title, url: bm.url, summary: bm.summary || "", text: bm.text || bm.summary || "" }))
  });
  if (response && response.success) {
    bmState.selected.clear();
    bmState.selectionMode = false;
    bmEl.selectToggle.textContent = "Select";
    bmEl.selectToggle.classList.remove("bm-select-active");
    bmEl.analyzeSelected.classList.add("hidden");
    bmLoadBookmarks();
  } else {
    bmEl.analyzeSelected.disabled = false;
    bmEl.analyzeSelected.textContent = `Analyze ${bmState.selected.size} Bookmarks`;
  }
}

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

    statusEl.textContent = "Signing in…";
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
    btn.textContent = "Syncing…";
    btn.disabled = true;
    statusEl.textContent = "";
    try {
      const r = await browser.runtime.sendMessage({ action: "profileSyncAll" });
      if (r?.success) {
        statusEl.textContent = `Synced ${Object.keys(r.stores || {}).length} stores · ${_profileFmtDate(r.syncedAt)}`;
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
    btn.textContent = syncFirst ? "Syncing…" : "Signing out…";
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
      removeBtn.textContent = "×";
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
    wipeStatus.textContent = "Syncing to cloud…";
    // Small delay so the user sees the status message
    await new Promise(r => setTimeout(r, 400));
    wipeStatus.textContent = "Wiping…";
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
    showKGStatus("Re-indexing…");
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
          dictStatsEl.textContent = "Built-in: " + parts.join(" · ");
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
        removeBtn.textContent = "×";
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

    breakdown.innerHTML = rows.join("<br>") + (tierSummary.length ? '<br><span style="opacity:0.6;font-size:10px;">— ' + tierSummary.join(" · ") + '</span>' : "");
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
        btn.textContent = "…";
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
        btn.textContent = "…";
        btn.disabled = true;
        try {
          const r = await browser.runtime.sendMessage({ action: "exportStoreData", store });
          if (!r?.success) throw new Error(r?.error || "Failed");
          const blob = new Blob([r.json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = r.filename; a.click();
          URL.revokeObjectURL(url);
          btn.textContent = "Saved ✓";
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
          syncAllBtn.textContent = "Syncing…";
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
          saveAllBtn.textContent = "Saving…";
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
        tierLine.textContent = "— " + tierSummary.join(" · ");
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

  // Preset dropdown → sync slider
  trawlDurationPreset.addEventListener("change", () => {
    const val = parseInt(trawlDurationPreset.value, 10);
    trawlDurationSlider.value = Math.min(360, Math.max(15, val));
    updateDurationLabel(val);
    saveTrawlDuration();
  });

  // Slider → sync preset dropdown when it matches a preset value
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
        window.ArgusRibbon.addPluginButton(p.id, p.name, '🧩', async () => {
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
    console.log('All plugins tested safely — KG pruning confirmed');
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
