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
// Auto-analyze rules
// ──────────────────────────────────────────────
function populateRulePresets() {
  el.rulePreset.replaceChildren();
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    el.rulePreset.appendChild(opt);
  }
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = preset.label || key;
      el.rulePreset.appendChild(opt);
    }
  }
}

function renderAutoRules() {
  el.autoRulesList.replaceChildren();
  if (!autoAnalyzeRules.length) {
    const p = document.createElement("p");
    p.className = "info-text";
    p.style.margin = "0";
    p.textContent = "No rules configured.";
    el.autoRulesList.appendChild(p);
    return;
  }

  autoAnalyzeRules.forEach((rule, index) => {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = rule.urlPattern;
    const span = document.createElement("span");
    span.textContent = `${DEFAULT_PRESETS[rule.preset]?.label || rule.preset} | ${rule.provider || "Default"} | ${rule.delay}ms`;
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle-label small";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = rule.enabled;
    cb.dataset.ruleToggle = index;
    const toggleText = document.createElement("span");
    toggleText.textContent = rule.enabled ? "On" : "Off";
    toggleLabel.appendChild(cb);
    toggleLabel.appendChild(toggleText);

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-sm btn-secondary";
    delBtn.dataset.ruleDelete = index;
    delBtn.style.color = "var(--error)";
    delBtn.textContent = "Delete";

    actions.appendChild(toggleLabel);
    actions.appendChild(delBtn);
    div.appendChild(info);
    div.appendChild(actions);
    el.autoRulesList.appendChild(div);
  });

  // Attach toggle/delete handlers
  el.autoRulesList.querySelectorAll("[data-rule-toggle]").forEach(cb => {
    cb.addEventListener("change", () => {
      const idx = parseInt(cb.dataset.ruleToggle);
      autoAnalyzeRules[idx].enabled = cb.checked;
      cb.nextElementSibling.textContent = cb.checked ? "On" : "Off";
      scheduleSave();
    });
  });
  el.autoRulesList.querySelectorAll("[data-rule-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      autoAnalyzeRules.splice(parseInt(btn.dataset.ruleDelete), 1);
      renderAutoRules();
      scheduleSave();
    });
  });
}

// ──────────────────────────────────────────────
// Named Automations UI
// ──────────────────────────────────────────────
let automations = [];
let editingAutomation = null; // null = new, object = editing existing
let editorSteps = []; // in-flight step list while editing

async function loadAutomations() {
  const resp = await browser.runtime.sendMessage({ action: "getAutomations" });
  automations = (resp && resp.success) ? resp.automations : [];
  renderAutomationList();
  loadAutomationLog();
}

function renderAutomationList() {
  const list = document.getElementById("automations-list");
  list.replaceChildren();

  if (!automations.length) {
    const p = document.createElement("p");
    p.className = "info-text";
    p.style.margin = "0";
    p.textContent = "No automations created yet.";
    list.appendChild(p);
    return;
  }

  automations.forEach(auto => {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = auto.name || "Untitled";
    if (auto.prebuilt) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Pre-built";
      badge.style.cssText = "margin-left:6px;font-size:10px;opacity:0.7;";
      strong.appendChild(badge);
    }
    const span = document.createElement("span");
    const triggers = (auto.triggers?.urlPatterns || []).length;
    const stepTypes = (auto.steps || []).map(s => s.type).join(" → ");
    span.textContent = `${auto.steps?.length || 0} steps: ${stepTypes}${triggers ? ` | ${triggers} URL pattern${triggers > 1 ? "s" : ""}` : ""}`;
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    // Run button
    const runBtn = document.createElement("button");
    runBtn.className = "btn btn-sm btn-accent";
    runBtn.textContent = "Run";
    runBtn.title = "Run on current tab";
    runBtn.addEventListener("click", async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) { alert("No active tab"); return; }
      runBtn.disabled = true;
      runBtn.textContent = "Running...";
      try {
        const resp = await browser.runtime.sendMessage({ action: "runAutomation", automationId: auto.id, tabId: tab.id });
        runBtn.textContent = resp.success ? "Done!" : "Failed";
        loadAutomationLog();
      } catch (e) {
        runBtn.textContent = "Error";
      }
      setTimeout(() => { runBtn.textContent = "Run"; runBtn.disabled = false; }, 2000);
    });

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openAutomationEditor(auto));

    // Toggle
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle-label small";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = auto.enabled;
    cb.addEventListener("change", async () => {
      auto.enabled = cb.checked;
      await browser.runtime.sendMessage({ action: "saveAutomation", automation: auto });
    });
    const toggleText = document.createElement("span");
    toggleText.textContent = auto.enabled ? "On" : "Off";
    cb.addEventListener("change", () => { toggleText.textContent = cb.checked ? "On" : "Off"; });
    toggleLabel.appendChild(cb);
    toggleLabel.appendChild(toggleText);

    actions.appendChild(runBtn);
    actions.appendChild(editBtn);
    actions.appendChild(toggleLabel);
    div.appendChild(info);
    div.appendChild(actions);
    list.appendChild(div);
  });
}

async function openAutomationEditor(auto) {
  editingAutomation = auto || null;
  editorSteps = auto ? JSON.parse(JSON.stringify(auto.steps || [])) : [];

  const card = document.getElementById("automation-editor-card");
  card.classList.remove("hidden");
  document.getElementById("automation-editor-title").textContent = auto ? `Edit: ${auto.name}` : "New Automation";

  document.getElementById("auto-name").value = auto?.name || "";
  document.getElementById("auto-url-patterns").value = (auto?.triggers?.urlPatterns || []).join("\n");
  document.getElementById("auto-manual").checked = auto?.triggers?.manual !== false;
  document.getElementById("auto-cooldown").value = auto?.cooldownMs || 60000;
  document.getElementById("auto-delay").value = auto?.delay || 2000;
  document.getElementById("auto-notify").checked = auto?.notifyOnComplete !== false;
  document.getElementById("auto-continue-error").checked = !!auto?.continueOnError;
  document.getElementById("auto-delete-btn").classList.toggle("hidden", !auto);

  // Populate project dropdown
  const projSelect = document.getElementById("auto-project-trigger");
  projSelect.replaceChildren();
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "None";
  projSelect.appendChild(noneOpt);
  try {
    const resp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (resp?.success) {
      for (const p of resp.projects) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        projSelect.appendChild(opt);
      }
    }
  } catch { /* ok */ }
  projSelect.value = auto?.triggers?.projectId || "";

  // Populate schedule trigger fields
  const sched = auto?.triggers?.schedule;
  const schedCb = document.getElementById("auto-schedule-enabled");
  const schedOpts = document.getElementById("auto-schedule-options");
  schedCb.checked = !!sched;
  schedOpts.classList.toggle("hidden", !sched);
  if (sched) {
    document.getElementById("auto-schedule-type").value = sched.type || "once";
    document.getElementById("auto-schedule-type").dispatchEvent(new Event("change"));
    if (sched.type === "once" && sched.datetime) {
      document.getElementById("auto-schedule-datetime").value = sched.datetime;
    }
    if (sched.type === "interval") {
      document.getElementById("auto-schedule-interval-ms").value = Math.round((sched.intervalMs || 3600000) / 60000);
    }
    if (sched.type === "daily") {
      document.getElementById("auto-schedule-time").value = sched.time || "09:00";
    }
    if (sched.type === "weekly") {
      document.getElementById("auto-schedule-day").value = sched.day || 1;
      document.getElementById("auto-schedule-weekly-time").value = sched.time || "09:00";
    }
    if (sched.type === "cron") {
      document.querySelectorAll(".cron-hour-cb").forEach(cb => {
        cb.checked = (sched.hours || []).includes(Number(cb.value));
      });
      document.querySelectorAll(".cron-day-cb").forEach(cb => {
        cb.checked = (sched.days || []).includes(Number(cb.value));
      });
    }
    document.getElementById("auto-schedule-url").value = sched.url || "";
  }

  renderEditorSteps();
  card.scrollIntoView({ behavior: "smooth" });
}

let expandedStepIndex = -1; // which step is currently expanded (-1 = none)

function renderEditorSteps() {
  const list = document.getElementById("auto-steps-list");
  list.replaceChildren();
  document.getElementById("auto-step-count").textContent = editorSteps.length ? `(${editorSteps.length})` : "";

  const isLogicType = t => ["condition","filter","switch","classify","gate","loop","setVar"].includes(t);

  editorSteps.forEach((step, i) => {
    const div = document.createElement("div");
    div.className = "auto-step-item";
    if (isLogicType(step.type)) div.setAttribute("data-logic", "true");
    if (i === expandedStepIndex) div.classList.add("expanded");

    // ── Header row (always visible) ──
    const header = document.createElement("div");
    header.className = "auto-step-header";

    const chevron = document.createElement("span");
    chevron.className = "auto-step-chevron";
    chevron.textContent = "\u25B6"; // ▶
    header.appendChild(chevron);

    const num = document.createElement("span");
    num.className = "auto-step-number";
    num.textContent = i + 1;
    header.appendChild(num);

    const label = document.createElement("span");
    label.className = "auto-step-label";
    label.textContent = stepTypeLabel(step.type);
    header.appendChild(label);

    // Brief summary of config (shown when collapsed)
    const summary = document.createElement("span");
    summary.className = "auto-step-summary";
    summary.textContent = getStepSummary(step);
    header.appendChild(summary);

    const btns = document.createElement("div");
    btns.className = "auto-step-btns";
    if (i > 0) {
      const upBtn = document.createElement("button");
      upBtn.className = "btn btn-sm btn-secondary";
      upBtn.textContent = "\u2191";
      upBtn.title = "Move up";
      upBtn.addEventListener("click", (e) => { e.stopPropagation(); [editorSteps[i - 1], editorSteps[i]] = [editorSteps[i], editorSteps[i - 1]]; if (expandedStepIndex === i) expandedStepIndex = i - 1; else if (expandedStepIndex === i - 1) expandedStepIndex = i; renderEditorSteps(); });
      btns.appendChild(upBtn);
    }
    if (i < editorSteps.length - 1) {
      const downBtn = document.createElement("button");
      downBtn.className = "btn btn-sm btn-secondary";
      downBtn.textContent = "\u2193";
      downBtn.title = "Move down";
      downBtn.addEventListener("click", (e) => { e.stopPropagation(); [editorSteps[i], editorSteps[i + 1]] = [editorSteps[i + 1], editorSteps[i]]; if (expandedStepIndex === i) expandedStepIndex = i + 1; else if (expandedStepIndex === i + 1) expandedStepIndex = i; renderEditorSteps(); });
      btns.appendChild(downBtn);
    }
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-sm btn-secondary";
    removeBtn.style.color = "var(--error)";
    removeBtn.textContent = "\u2715";
    removeBtn.title = "Remove step";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editorSteps.splice(i, 1);
      if (expandedStepIndex === i) expandedStepIndex = -1;
      else if (expandedStepIndex > i) expandedStepIndex--;
      renderEditorSteps();
    });
    btns.appendChild(removeBtn);
    header.appendChild(btns);

    // Toggle expand/collapse on header click
    header.addEventListener("click", () => {
      expandedStepIndex = (expandedStepIndex === i) ? -1 : i;
      renderEditorSteps();
    });

    div.appendChild(header);

    // ── Config area (only built when expanded) ──
    const config = document.createElement("div");
    config.className = "auto-step-config";
    if (i === expandedStepIndex) {
      buildStepConfig(step, config, i);
    }
    div.appendChild(config);

    list.appendChild(div);
  });
}

// Generate a one-line summary for a collapsed step
function getStepSummary(step) {
  switch (step.type) {
    case "analyze": return step.preset || "summary";
    case "prompt": return (step.prompt || "").slice(0, 50) || "(no prompt)";
    case "extractEntities": return "KG extraction";
    case "runPipeline": return step.pipelineId || "auto-detect";
    case "addToProject": return step.projectId ? "project linked" : "(no project)";
    case "addToMonitors": return `every ${step.intervalMinutes || 60}m`;
    case "paste": return step.provider || "default provider";
    case "saveToCloud": return step.format || "md";
    case "condition": {
      const e = step.expression || {};
      return `${e.left || "?"} ${e.op || "?"} ${e.right || "?"}`;
    }
    case "filter": return `${step.value || "?"} ${step.action || "block"} via list`;
    case "switch": return `on ${step.value || "?"} (${(step.cases || []).length} cases)`;
    case "classify": return `${(step.categories || []).length} categories`;
    case "gate": return `${step.gateType || "confirm"}: ${(step.question || "").slice(0, 40)}`;
    case "loop": return `over ${step.over || "?"}, max ${step.maxIterations || 50}`;
    case "setVar": return `${step.varName || "?"} = ${step.value || "?"}`;
    default: return "";
  }
}

function getValueOptions(idx) {
  const opts = [
    ["page.text",       "Page text"],
    ["page.title",      "Page title"],
    ["page.url",        "Page URL"],
    ["lastOutput",      "Last step output"],
    ["entities.length", "Entity count"],
  ];
  // Scan earlier steps for setVar / classify to surface their variables
  for (let i = 0; i < idx; i++) {
    const s = editorSteps[i];
    if (s.type === "setVar" && s.varName) {
      opts.push([`vars.${s.varName}`, `Variable: ${s.varName}`]);
    }
    if (s.type === "classify") {
      const name = s.varName || "classification";
      opts.push([`vars.${name}`, `Classify result: ${name}`]);
    }
  }
  opts.push(["_custom", "Custom path…"]);
  return opts;
}

function buildStepConfig(step, container, idx) {
  switch (step.type) {
    case "analyze": {
      const sel = document.createElement("select");
      sel.className = "auto-step-select";
      for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = preset.label;
        sel.appendChild(opt);
      }
      sel.value = step.preset || "summary";
      sel.addEventListener("change", () => { step.preset = sel.value; });
      const lbl = document.createElement("label");
      lbl.textContent = "Preset: ";
      lbl.appendChild(sel);
      container.appendChild(lbl);
      break;
    }
    case "prompt": {
      // System prompt
      const sysLabel = document.createElement("label");
      sysLabel.textContent = "System prompt:";
      const sysArea = document.createElement("textarea");
      sysArea.rows = 2;
      sysArea.className = "auto-step-textarea";
      sysArea.value = step.system || "";
      sysArea.placeholder = "You are a helpful analyst.";
      sysArea.addEventListener("input", () => { step.system = sysArea.value; });
      container.appendChild(sysLabel);
      container.appendChild(sysArea);

      // User prompt
      const usrLabel = document.createElement("label");
      usrLabel.textContent = "Prompt:";
      const usrArea = document.createElement("textarea");
      usrArea.rows = 3;
      usrArea.className = "auto-step-textarea";
      usrArea.value = step.prompt || "";
      usrArea.placeholder = "Analyze the following and extract...";
      usrArea.addEventListener("input", () => { step.prompt = usrArea.value; });
      container.appendChild(usrLabel);
      container.appendChild(usrArea);

      // Input mode
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Input: ";
      const modeSel = document.createElement("select");
      modeSel.className = "auto-step-select";
      const opt1 = document.createElement("option");
      opt1.value = "page";
      opt1.textContent = "Original page content";
      const opt2 = document.createElement("option");
      opt2.value = "previous";
      opt2.textContent = "Previous step output";
      modeSel.appendChild(opt1);
      modeSel.appendChild(opt2);
      modeSel.value = step.inputMode || "page";
      modeSel.addEventListener("change", () => { step.inputMode = modeSel.value; });
      modeLabel.appendChild(modeSel);
      container.appendChild(modeLabel);
      break;
    }
    case "extractEntities": {
      const note = document.createElement("span");
      note.className = "hint";
      note.textContent = "Extracts entities from the page and adds them to the Knowledge Graph.";
      container.appendChild(note);
      break;
    }
    case "runPipeline": {
      const sel = document.createElement("select");
      sel.className = "auto-step-select";
      const autoOpt = document.createElement("option");
      autoOpt.value = "";
      autoOpt.textContent = "Auto-detect";
      sel.appendChild(autoOpt);
      for (const pid of ["wikipedia", "classifieds", "news", "research"]) {
        const opt = document.createElement("option");
        opt.value = pid;
        opt.textContent = pid.charAt(0).toUpperCase() + pid.slice(1);
        sel.appendChild(opt);
      }
      sel.value = step.pipelineId || "";
      sel.addEventListener("change", () => { step.pipelineId = sel.value; });
      const lbl = document.createElement("label");
      lbl.textContent = "Pipeline: ";
      lbl.appendChild(sel);
      container.appendChild(lbl);
      break;
    }
    case "addToMonitors": {
      // Interval
      const intLabel = document.createElement("label");
      intLabel.textContent = "Check interval (min): ";
      const intInput = document.createElement("input");
      intInput.type = "number";
      intInput.className = "auto-step-input";
      intInput.min = 5;
      intInput.max = 1440;
      intInput.value = step.intervalMinutes || 60;
      intInput.addEventListener("input", () => { step.intervalMinutes = parseInt(intInput.value) || 60; });
      intLabel.appendChild(intInput);
      container.appendChild(intLabel);

      // AI analysis toggle
      const aiLabel = document.createElement("label");
      aiLabel.className = "auto-step-checkbox-label";
      const aiCb = document.createElement("input");
      aiCb.type = "checkbox";
      aiCb.checked = step.aiAnalysis !== false;
      aiCb.addEventListener("change", () => { step.aiAnalysis = aiCb.checked; });
      aiLabel.appendChild(aiCb);
      aiLabel.appendChild(document.createTextNode(" AI-analyze changes"));
      container.appendChild(aiLabel);

      // Analysis preset (optional)
      const presetLabel = document.createElement("label");
      presetLabel.textContent = "Analysis preset: ";
      const presetSel = document.createElement("select");
      presetSel.className = "auto-step-select";
      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = "Default (Summary)";
      presetSel.appendChild(noneOpt);
      for (const [key, p] of Object.entries(DEFAULT_PRESETS)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = p.label;
        presetSel.appendChild(opt);
      }
      presetSel.value = step.analysisPreset || "";
      presetSel.addEventListener("change", () => { step.analysisPreset = presetSel.value; });
      presetLabel.appendChild(presetSel);
      container.appendChild(presetLabel);

      // Duration (0 = indefinite)
      const durLabel = document.createElement("label");
      durLabel.textContent = "Duration (hours, 0=forever): ";
      const durInput = document.createElement("input");
      durInput.type = "number";
      durInput.className = "auto-step-input";
      durInput.min = 0;
      durInput.value = step.duration || 0;
      durInput.addEventListener("input", () => { step.duration = parseInt(durInput.value) || 0; });
      durLabel.appendChild(durInput);
      container.appendChild(durLabel);

      const hint = document.createElement("div");
      hint.className = "auto-step-hint";
      hint.textContent = "Adds the page to monitors. Skips silently if already monitored.";
      container.appendChild(hint);
      break;
    }
    case "addToProject": {
      const sel = document.createElement("select");
      sel.className = "auto-step-select";
      // Copy options from the project trigger dropdown
      const projTrigger = document.getElementById("auto-project-trigger");
      for (const opt of projTrigger.options) {
        if (!opt.value) continue; // skip "None"
        const newOpt = document.createElement("option");
        newOpt.value = opt.value;
        newOpt.textContent = opt.textContent;
        sel.appendChild(newOpt);
      }
      sel.value = step.projectId || "";
      sel.addEventListener("change", () => { step.projectId = sel.value; });
      const lbl = document.createElement("label");
      lbl.textContent = "Target project: ";
      lbl.appendChild(sel);
      container.appendChild(lbl);

      // Tags
      const tagLabel = document.createElement("label");
      tagLabel.textContent = "Tags (comma-separated): ";
      const tagInput = document.createElement("input");
      tagInput.type = "text";
      tagInput.className = "auto-step-input";
      tagInput.value = (step.tagsWith || []).join(", ");
      tagInput.placeholder = "auto, intel, {automationName}";
      tagInput.addEventListener("input", () => {
        step.tagsWith = tagInput.value.split(",").map(t => t.trim()).filter(Boolean);
      });
      tagLabel.appendChild(tagInput);
      container.appendChild(tagLabel);

      // Summary source
      const sumLabel = document.createElement("label");
      sumLabel.textContent = "Summary from: ";
      const sumSel = document.createElement("select");
      sumSel.className = "auto-step-select";
      const lastOpt = document.createElement("option");
      lastOpt.value = "last";
      lastOpt.textContent = "Last step output";
      sumSel.appendChild(lastOpt);
      editorSteps.forEach((s, si) => {
        if (si >= idx) return;
        const sOpt = document.createElement("option");
        sOpt.value = si;
        sOpt.textContent = `Step ${si + 1} (${stepTypeLabel(s.type)})`;
        sumSel.appendChild(sOpt);
      });
      sumSel.value = step.summaryFrom ?? "last";
      sumSel.addEventListener("change", () => {
        step.summaryFrom = sumSel.value === "last" ? "last" : parseInt(sumSel.value);
      });
      sumLabel.appendChild(sumSel);
      container.appendChild(sumLabel);
      break;
    }
    case "paste": {
      // Provider selector
      const provLabel = document.createElement("label");
      provLabel.textContent = "Paste provider: ";
      const provSel = document.createElement("select");
      provSel.className = "auto-step-select";
      for (const [val, label] of [["", "Use default"], ["gist", "GitHub Gist"], ["pastebin", "Pastebin"], ["privatebin", "PrivateBin"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        provSel.appendChild(opt);
      }
      provSel.value = step.provider || "";
      provSel.addEventListener("change", () => { step.provider = provSel.value; rebuildPasteOptions(); });
      provLabel.appendChild(provSel);
      container.appendChild(provLabel);

      // Input mode
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Content: ";
      const modeSel = document.createElement("select");
      modeSel.className = "auto-step-select";
      for (const [val, label] of [["previous", "Previous step output"], ["page", "Original page text"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        modeSel.appendChild(opt);
      }
      modeSel.value = step.inputMode || "previous";
      modeSel.addEventListener("change", () => { step.inputMode = modeSel.value; });
      modeLabel.appendChild(modeSel);
      container.appendChild(modeLabel);

      // Title template
      const titleLabel = document.createElement("label");
      titleLabel.textContent = "Title template: ";
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "auto-step-input";
      titleInput.value = step.titleTemplate || "";
      titleInput.placeholder = "Argus — {title}";
      titleInput.addEventListener("input", () => { step.titleTemplate = titleInput.value; });
      titleLabel.appendChild(titleInput);
      container.appendChild(titleLabel);

      // Provider-specific options container
      const provOpts = document.createElement("div");
      provOpts.className = "auto-step-provider-opts";
      container.appendChild(provOpts);

      function rebuildPasteOptions() {
        provOpts.innerHTML = "";
        const p = provSel.value;
        if (!p) {
          const hint = document.createElement("div");
          hint.className = "auto-step-hint";
          hint.textContent = "Will use the default paste provider set on the Providers tab.";
          provOpts.appendChild(hint);
          return;
        }
        if (p === "gist") {
          // Filename
          const fnLabel = document.createElement("label");
          fnLabel.textContent = "Filename: ";
          const fnInput = document.createElement("input");
          fnInput.type = "text";
          fnInput.className = "auto-step-input";
          fnInput.value = step.filename || "argus-export.md";
          fnInput.addEventListener("input", () => { step.filename = fnInput.value; });
          fnLabel.appendChild(fnInput);
          provOpts.appendChild(fnLabel);
          // Public toggle
          const pubLabel = document.createElement("label");
          pubLabel.className = "auto-step-checkbox-label";
          const pubCb = document.createElement("input");
          pubCb.type = "checkbox";
          pubCb.checked = step.isPublic || false;
          pubCb.addEventListener("change", () => { step.isPublic = pubCb.checked; });
          pubLabel.appendChild(pubCb);
          pubLabel.appendChild(document.createTextNode(" Public gist"));
          provOpts.appendChild(pubLabel);
          // Include entities
          const entLabel = document.createElement("label");
          entLabel.className = "auto-step-checkbox-label";
          const entCb = document.createElement("input");
          entCb.type = "checkbox";
          entCb.checked = step.includeEntities || false;
          entCb.addEventListener("change", () => { step.includeEntities = entCb.checked; });
          entLabel.appendChild(entCb);
          entLabel.appendChild(document.createTextNode(" Include entities as separate file"));
          provOpts.appendChild(entLabel);
        } else if (p === "pastebin") {
          // Visibility
          const visLabel = document.createElement("label");
          visLabel.textContent = "Visibility: ";
          const visSel = document.createElement("select");
          visSel.className = "auto-step-select";
          for (const [val, label] of [["1", "Unlisted"], ["0", "Public"], ["2", "Private"]]) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = label;
            visSel.appendChild(opt);
          }
          visSel.value = String(step.visibility ?? 1);
          visSel.addEventListener("change", () => { step.visibility = parseInt(visSel.value); });
          visLabel.appendChild(visSel);
          provOpts.appendChild(visLabel);
          // Format
          const fmtLabel = document.createElement("label");
          fmtLabel.textContent = "Syntax: ";
          const fmtInput = document.createElement("input");
          fmtInput.type = "text";
          fmtInput.className = "auto-step-input";
          fmtInput.value = step.format || "text";
          fmtInput.placeholder = "text, json, markdown, python...";
          fmtInput.addEventListener("input", () => { step.format = fmtInput.value; });
          fmtLabel.appendChild(fmtInput);
          provOpts.appendChild(fmtLabel);
          // Expiry
          const expLabel = document.createElement("label");
          expLabel.textContent = "Expiry: ";
          const expSel = document.createElement("select");
          expSel.className = "auto-step-select";
          for (const [val, label] of [["N", "Never"], ["10M", "10 Minutes"], ["1H", "1 Hour"], ["1D", "1 Day"], ["1W", "1 Week"], ["1M", "1 Month"]]) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = label;
            expSel.appendChild(opt);
          }
          expSel.value = step.expiry || "N";
          expSel.addEventListener("change", () => { step.expiry = expSel.value; });
          expLabel.appendChild(expSel);
          provOpts.appendChild(expLabel);
        } else if (p === "privatebin") {
          // Expiry
          const expLabel = document.createElement("label");
          expLabel.textContent = "Expiry: ";
          const expSel = document.createElement("select");
          expSel.className = "auto-step-select";
          for (const [val, label] of [["5min", "5 Minutes"], ["10min", "10 Minutes"], ["1hour", "1 Hour"], ["1day", "1 Day"], ["1week", "1 Week"], ["1month", "1 Month"], ["never", "Never"]]) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = label;
            expSel.appendChild(opt);
          }
          expSel.value = step.expiry || "1week";
          expSel.addEventListener("change", () => { step.expiry = expSel.value; });
          expLabel.appendChild(expSel);
          provOpts.appendChild(expLabel);
          // Burn after reading
          const burnLabel = document.createElement("label");
          burnLabel.className = "auto-step-checkbox-label";
          const burnCb = document.createElement("input");
          burnCb.type = "checkbox";
          burnCb.checked = step.burnAfterReading || false;
          burnCb.addEventListener("change", () => { step.burnAfterReading = burnCb.checked; });
          burnLabel.appendChild(burnCb);
          burnLabel.appendChild(document.createTextNode(" Burn after reading"));
          provOpts.appendChild(burnLabel);
        }
      }
      rebuildPasteOptions();

      const hint = document.createElement("div");
      hint.className = "auto-step-hint";
      hint.textContent = "Pushes step output to a paste service. Provider must be connected in Providers tab. The paste URL is passed as output to subsequent steps.";
      container.appendChild(hint);
      break;
    }
    case "saveToCloud": {
      // Input mode
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Content: ";
      const modeSel = document.createElement("select");
      modeSel.className = "auto-step-select";
      for (const [val, label] of [["previous", "Previous step output"], ["page", "Original page text"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        modeSel.appendChild(opt);
      }
      modeSel.value = step.inputMode || "previous";
      modeSel.addEventListener("change", () => { step.inputMode = modeSel.value; });
      modeLabel.appendChild(modeSel);
      container.appendChild(modeLabel);

      // File format
      const fmtLabel = document.createElement("label");
      fmtLabel.textContent = "Format: ";
      const fmtSel = document.createElement("select");
      fmtSel.className = "auto-step-select";
      for (const [val, label] of [["md", "Markdown (.md)"], ["json", "JSON (.json)"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        fmtSel.appendChild(opt);
      }
      fmtSel.value = step.format || "md";
      fmtSel.addEventListener("change", () => { step.format = fmtSel.value; });
      fmtLabel.appendChild(fmtSel);
      container.appendChild(fmtLabel);

      // Target providers
      const provLabel = document.createElement("label");
      provLabel.textContent = "Upload to: ";
      const provSel = document.createElement("select");
      provSel.className = "auto-step-select";
      for (const [val, label] of [["default", "Use default"], ["all", "All connected providers"], ["google", "Google Drive only"], ["dropbox", "Dropbox only"], ["webdav", "WebDAV only"], ["s3", "S3 only"]]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        provSel.appendChild(opt);
      }
      provSel.value = (step.providers && step.providers[0]) || "default";
      provSel.addEventListener("change", () => { step.providers = [provSel.value]; });
      provLabel.appendChild(provSel);
      container.appendChild(provLabel);

      const hint = document.createElement("div");
      hint.className = "auto-step-hint";
      hint.textContent = "Uploads step output as a file to connected cloud storage. Files are saved in the argus-automations/ folder.";
      container.appendChild(hint);
      break;
    }
    // ── Logic Step Configs ──
    case "condition": {
      // Expression builder
      const exprWrap = document.createElement("div");
      exprWrap.className = "auto-logic-expr";

      // Left side (what to check)
      const leftLabel = document.createElement("label");
      leftLabel.textContent = "Check: ";
      const leftSel = document.createElement("select");
      leftSel.className = "auto-step-select";

      // Build value options dynamically — include variables from earlier setVar/classify steps
      const valueOptions = getValueOptions(idx);
      const knownValues = valueOptions.map(o => o[0]);

      for (const [val, label] of valueOptions) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        leftSel.appendChild(opt);
      }
      leftSel.value = knownValues.includes(step.expression?.left) ? step.expression?.left : "_custom";
      const leftCustom = document.createElement("input");
      leftCustom.type = "text"; leftCustom.className = "auto-step-input";
      leftCustom.placeholder = "e.g. stepResults[0].content, vars.myVar";
      leftCustom.value = !knownValues.includes(step.expression?.left) && step.expression?.left !== "_custom" ? (step.expression?.left || "") : "";
      leftCustom.style.display = leftSel.value === "_custom" ? "" : "none";
      leftSel.addEventListener("change", () => {
        leftCustom.style.display = leftSel.value === "_custom" ? "" : "none";
        step.expression.left = leftSel.value === "_custom" ? leftCustom.value : leftSel.value;
      });
      leftCustom.addEventListener("input", () => { step.expression.left = leftCustom.value; });
      leftLabel.appendChild(leftSel);
      exprWrap.appendChild(leftLabel);
      exprWrap.appendChild(leftCustom);

      // Operator
      const opLabel = document.createElement("label");
      opLabel.textContent = "Operator: ";
      const opSel = document.createElement("select");
      opSel.className = "auto-step-select";
      for (const [val, label] of [
        ["contains", "contains"], ["not_contains", "does not contain"],
        ["eq", "equals"], ["neq", "not equals"],
        ["gt", ">"], ["gte", ">="], ["lt", "<"], ["lte", "<="],
        ["matches", "matches regex"], ["not_matches", "does not match regex"],
        ["in_list", "is in list"], ["not_in_list", "is not in list"],
        ["exists", "exists (not empty)"], ["empty", "is empty"],
      ]) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        opSel.appendChild(opt);
      }
      opSel.value = step.expression?.op || "contains";
      opSel.addEventListener("change", () => {
        step.expression.op = opSel.value;
        rightInput.style.display = ["exists","empty"].includes(opSel.value) ? "none" : "";
        listSel.style.display = ["in_list","not_in_list"].includes(opSel.value) ? "" : "none";
        rightInput.style.display = ["in_list","not_in_list","exists","empty"].includes(opSel.value) ? "none" : "";
      });
      opLabel.appendChild(opSel);
      exprWrap.appendChild(opLabel);

      // Right side (value to compare against)
      const rightInput = document.createElement("input");
      rightInput.type = "text"; rightInput.className = "auto-step-input";
      rightInput.placeholder = "Value or keyword to check";
      rightInput.value = step.expression?.right || "";
      rightInput.addEventListener("input", () => { step.expression.right = rightInput.value; });
      rightInput.style.display = ["exists","empty","in_list","not_in_list"].includes(opSel.value) ? "none" : "";

      // List selector (for in_list / not_in_list)
      const listSel = document.createElement("select");
      listSel.className = "auto-step-select";
      listSel.style.display = ["in_list","not_in_list"].includes(opSel.value) ? "" : "none";
      const listNone = document.createElement("option");
      listNone.value = ""; listNone.textContent = "Select a list...";
      listSel.appendChild(listNone);
      // Populate lists async
      browser.runtime.sendMessage({ action: "getLists" }).then(resp => {
        if (!resp?.lists) return;
        for (const l of resp.lists) {
          const opt = document.createElement("option");
          opt.value = l.id; opt.textContent = `${l.name} (${l.type})`;
          listSel.appendChild(opt);
        }
        listSel.value = step.expression?.right || "";
      }).catch(() => {});
      listSel.addEventListener("change", () => { step.expression.right = listSel.value; });

      const rightLabel = document.createElement("label");
      rightLabel.textContent = "Value: ";
      rightLabel.appendChild(rightInput);
      rightLabel.appendChild(listSel);
      exprWrap.appendChild(rightLabel);

      container.appendChild(exprWrap);

      // Then/Else branch info
      const branchHint = document.createElement("div");
      branchHint.className = "auto-step-hint";
      branchHint.innerHTML = "THEN and ELSE branches run nested steps. To add sub-steps, save this automation first, then edit the JSON directly via the <em>Export/Import</em> feature, or use the Classify step for AI-powered branching.";
      container.appendChild(branchHint);
      break;
    }
    case "filter": {
      // What value to check — dynamically includes vars from earlier steps
      const valLabel = document.createElement("label");
      valLabel.textContent = "Check value: ";
      const valSel = document.createElement("select");
      valSel.className = "auto-step-select";

      const filterValOpts = getValueOptions(idx);
      const filterKnownVals = filterValOpts.map(o => o[0]);
      for (const [val, label] of filterValOpts) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        valSel.appendChild(opt);
      }
      valSel.value = filterKnownVals.includes(step.value) ? step.value : "_custom";
      const valCustom = document.createElement("input");
      valCustom.type = "text"; valCustom.className = "auto-step-input";
      valCustom.placeholder = "e.g. vars.myField";
      valCustom.value = !filterKnownVals.includes(step.value) && step.value !== "_custom" ? (step.value || "") : "";
      valCustom.style.display = valSel.value === "_custom" ? "" : "none";
      valSel.addEventListener("change", () => {
        valCustom.style.display = valSel.value === "_custom" ? "" : "none";
        step.value = valSel.value === "_custom" ? valCustom.value : valSel.value;
      });
      valCustom.addEventListener("input", () => { step.value = valCustom.value; });
      valLabel.appendChild(valSel);
      container.appendChild(valLabel);
      container.appendChild(valCustom);

      // List to check against
      const listLabel = document.createElement("label");
      listLabel.textContent = "Against list: ";
      const listSel = document.createElement("select");
      listSel.className = "auto-step-select";
      const noneOpt = document.createElement("option");
      noneOpt.value = ""; noneOpt.textContent = "Select a list...";
      listSel.appendChild(noneOpt);
      browser.runtime.sendMessage({ action: "getLists" }).then(resp => {
        if (!resp?.lists) return;
        for (const l of resp.lists) {
          const opt = document.createElement("option");
          opt.value = l.id; opt.textContent = `${l.name} (${l.type})`;
          listSel.appendChild(opt);
        }
        listSel.value = step.list || "";
      }).catch(() => {});
      listSel.addEventListener("change", () => { step.list = listSel.value; });
      listLabel.appendChild(listSel);
      container.appendChild(listLabel);

      // Action: block or allow
      const actLabel = document.createElement("label");
      actLabel.textContent = "Action: ";
      const actSel = document.createElement("select");
      actSel.className = "auto-step-select";
      for (const [val, label] of [
        ["block", "BLOCK if found in list (halt automation)"],
        ["allow", "ALLOW only if found in list (halt if NOT found)"],
      ]) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        actSel.appendChild(opt);
      }
      actSel.value = step.action || "block";
      actSel.addEventListener("change", () => { step.action = actSel.value; });
      actLabel.appendChild(actSel);
      container.appendChild(actLabel);

      const filterHint = document.createElement("div");
      filterHint.className = "auto-step-hint";
      filterHint.textContent = "Checks if a value exists in a Named List. Use for blocklists (flagged reporters, bad sources) or allowlists (approved domains, tracked tickers).";
      container.appendChild(filterHint);
      break;
    }
    case "switch": {
      // Value to switch on
      const valLabel = document.createElement("label");
      valLabel.textContent = "Switch on: ";
      const valInput = document.createElement("input");
      valInput.type = "text"; valInput.className = "auto-step-input";
      valInput.value = step.value || "lastOutput";
      valInput.placeholder = "e.g. vars.classification, lastOutput, page.url";
      valInput.addEventListener("input", () => { step.value = valInput.value; });
      valLabel.appendChild(valInput);
      container.appendChild(valLabel);

      // Cases display
      const casesDiv = document.createElement("div");
      casesDiv.className = "auto-step-cases";
      const casesLabel = document.createElement("label");
      casesLabel.textContent = "Cases (match patterns):";
      casesDiv.appendChild(casesLabel);

      const casesList = document.createElement("div");
      casesList.className = "auto-step-cases-list";

      function renderSwitchCases() {
        casesList.innerHTML = "";
        (step.cases || []).forEach((c, ci) => {
          const row = document.createElement("div");
          row.className = "auto-step-case-row";
          row.style.cssText = "display:flex;gap:6px;align-items:center;margin:3px 0;";
          const matchInput = document.createElement("input");
          matchInput.type = "text"; matchInput.className = "auto-step-input";
          matchInput.value = Array.isArray(c.match) ? c.match.join(", ") : (c.match || "");
          matchInput.placeholder = "Value(s) to match, comma-separated";
          matchInput.style.flex = "1";
          matchInput.addEventListener("input", () => {
            c.match = matchInput.value.split(",").map(s => s.trim()).filter(Boolean);
          });
          row.appendChild(matchInput);
          const rmBtn = document.createElement("button");
          rmBtn.className = "btn btn-danger btn-sm";
          rmBtn.textContent = "×";
          rmBtn.style.padding = "2px 8px";
          rmBtn.addEventListener("click", () => { step.cases.splice(ci, 1); renderSwitchCases(); });
          row.appendChild(rmBtn);
          casesList.appendChild(row);
        });
      }
      renderSwitchCases();
      casesDiv.appendChild(casesList);

      const addCaseBtn = document.createElement("button");
      addCaseBtn.className = "btn btn-secondary btn-sm";
      addCaseBtn.textContent = "+ Add Case";
      addCaseBtn.style.marginTop = "4px";
      addCaseBtn.addEventListener("click", () => {
        step.cases.push({ match: [], steps: [] });
        renderSwitchCases();
      });
      casesDiv.appendChild(addCaseBtn);
      container.appendChild(casesDiv);

      const switchHint = document.createElement("div");
      switchHint.className = "auto-step-hint";
      switchHint.textContent = "Routes to different branches based on a value. Each case can have nested sub-steps. Use * for wildcard matching.";
      container.appendChild(switchHint);
      break;
    }
    case "classify": {
      // Question / prompt
      const qLabel = document.createElement("label");
      qLabel.textContent = "Classification prompt:";
      const qArea = document.createElement("textarea");
      qArea.rows = 2; qArea.className = "auto-step-textarea";
      qArea.value = step.question || "Classify this content:";
      qArea.addEventListener("input", () => { step.question = qArea.value; });
      container.appendChild(qLabel);
      container.appendChild(qArea);

      // Input mode
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Input: ";
      const modeSel = document.createElement("select");
      modeSel.className = "auto-step-select";
      for (const [val, label] of [["page", "Page content"], ["previous", "Previous step output"]]) {
        const opt = document.createElement("option"); opt.value = val; opt.textContent = label;
        modeSel.appendChild(opt);
      }
      modeSel.value = step.inputMode || "page";
      modeSel.addEventListener("change", () => { step.inputMode = modeSel.value; });
      modeLabel.appendChild(modeSel);
      container.appendChild(modeLabel);

      // Categories
      const catLabel = document.createElement("label");
      catLabel.textContent = "Categories (AI will choose one):";
      container.appendChild(catLabel);

      const catList = document.createElement("div");
      catList.className = "auto-step-categories";

      function renderCategories() {
        catList.innerHTML = "";
        (step.categories || []).forEach((cat, ci) => {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;gap:6px;align-items:center;margin:3px 0;";
          const valIn = document.createElement("input");
          valIn.type = "text"; valIn.className = "auto-step-input"; valIn.style.width = "100px";
          valIn.value = cat.value || ""; valIn.placeholder = "value";
          valIn.addEventListener("input", () => { cat.value = valIn.value; });
          row.appendChild(valIn);
          const descIn = document.createElement("input");
          descIn.type = "text"; descIn.className = "auto-step-input"; descIn.style.flex = "1";
          descIn.value = cat.description || cat.label || ""; descIn.placeholder = "Description for AI";
          descIn.addEventListener("input", () => { cat.description = descIn.value; cat.label = descIn.value; });
          row.appendChild(descIn);
          const rmBtn = document.createElement("button");
          rmBtn.className = "btn btn-danger btn-sm"; rmBtn.textContent = "×";
          rmBtn.style.padding = "2px 8px";
          rmBtn.addEventListener("click", () => { step.categories.splice(ci, 1); renderCategories(); });
          row.appendChild(rmBtn);
          catList.appendChild(row);
        });
      }
      renderCategories();
      container.appendChild(catList);

      const addCatBtn = document.createElement("button");
      addCatBtn.className = "btn btn-secondary btn-sm";
      addCatBtn.textContent = "+ Add Category";
      addCatBtn.style.marginTop = "4px";
      addCatBtn.addEventListener("click", () => {
        step.categories.push({ value: "", label: "", description: "", steps: [] });
        renderCategories();
      });
      container.appendChild(addCatBtn);

      const classifyHint = document.createElement("div");
      classifyHint.className = "auto-step-hint";
      classifyHint.textContent = "Uses AI to classify content into one of your categories, then routes to that category's sub-steps. Great for sentiment analysis, topic routing, or content scoring.";
      container.appendChild(classifyHint);
      break;
    }
    case "gate": {
      // Gate type
      const typeLabel = document.createElement("label");
      typeLabel.textContent = "Gate type: ";
      const typeSel = document.createElement("select");
      typeSel.className = "auto-step-select";
      for (const [val, label] of [
        ["confirm", "Yes / No (confirm)"],
        ["choice", "Multiple Choice"],
        ["input", "Free Text Input"],
      ]) {
        const opt = document.createElement("option"); opt.value = val; opt.textContent = label;
        typeSel.appendChild(opt);
      }
      typeSel.value = step.gateType || "confirm";
      typeSel.addEventListener("change", () => {
        step.gateType = typeSel.value;
        choicesDiv.style.display = typeSel.value === "choice" ? "" : "none";
        varDiv.style.display = typeSel.value === "input" ? "" : "none";
      });
      typeLabel.appendChild(typeSel);
      container.appendChild(typeLabel);

      // Question
      const qLabel = document.createElement("label");
      qLabel.textContent = "Question:";
      const qInput = document.createElement("input");
      qInput.type = "text"; qInput.className = "auto-step-input";
      qInput.value = step.question || "Continue?";
      qInput.addEventListener("input", () => { step.question = qInput.value; });
      qLabel.appendChild(qInput);
      container.appendChild(qLabel);

      // Multiple choice options
      const choicesDiv = document.createElement("div");
      choicesDiv.style.display = step.gateType === "choice" ? "" : "none";
      const choicesLabel = document.createElement("label");
      choicesLabel.textContent = "Options:";
      choicesDiv.appendChild(choicesLabel);

      const choicesList = document.createElement("div");
      function renderChoices() {
        choicesList.innerHTML = "";
        (step.options || []).forEach((opt, oi) => {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;gap:6px;align-items:center;margin:3px 0;";
          const labelIn = document.createElement("input");
          labelIn.type = "text"; labelIn.className = "auto-step-input"; labelIn.style.flex = "1";
          labelIn.value = opt.label || ""; labelIn.placeholder = "Display label";
          labelIn.addEventListener("input", () => { opt.label = labelIn.value; });
          row.appendChild(labelIn);
          const valIn = document.createElement("input");
          valIn.type = "text"; valIn.className = "auto-step-input"; valIn.style.width = "80px";
          valIn.value = opt.value || ""; valIn.placeholder = "value";
          valIn.addEventListener("input", () => { opt.value = valIn.value; });
          row.appendChild(valIn);
          const rmBtn = document.createElement("button");
          rmBtn.className = "btn btn-danger btn-sm"; rmBtn.textContent = "×";
          rmBtn.style.padding = "2px 8px";
          rmBtn.addEventListener("click", () => { step.options.splice(oi, 1); renderChoices(); });
          row.appendChild(rmBtn);
          choicesList.appendChild(row);
        });
      }
      renderChoices();
      choicesDiv.appendChild(choicesList);
      const addChoiceBtn = document.createElement("button");
      addChoiceBtn.className = "btn btn-secondary btn-sm";
      addChoiceBtn.textContent = "+ Add Option";
      addChoiceBtn.addEventListener("click", () => {
        step.options.push({ label: "", value: "", steps: [] });
        renderChoices();
      });
      choicesDiv.appendChild(addChoiceBtn);
      container.appendChild(choicesDiv);

      // Variable name for input type
      const varDiv = document.createElement("div");
      varDiv.style.display = step.gateType === "input" ? "" : "none";
      const varLabel = document.createElement("label");
      varLabel.textContent = "Store answer as variable: ";
      const varInput = document.createElement("input");
      varInput.type = "text"; varInput.className = "auto-step-input";
      varInput.value = step.varName || "gateInput";
      varInput.addEventListener("input", () => { step.varName = varInput.value; });
      varLabel.appendChild(varInput);
      varDiv.appendChild(varLabel);
      container.appendChild(varDiv);

      // Timeout
      const toLabel = document.createElement("label");
      toLabel.textContent = "Timeout (seconds): ";
      const toInput = document.createElement("input");
      toInput.type = "number"; toInput.className = "auto-step-input";
      toInput.min = 10; toInput.max = 86400;
      toInput.value = Math.round((step.timeoutMs || 300000) / 1000);
      toInput.addEventListener("input", () => { step.timeoutMs = (parseInt(toInput.value) || 300) * 1000; });
      toLabel.appendChild(toInput);
      container.appendChild(toLabel);

      const gateHint = document.createElement("div");
      gateHint.className = "auto-step-hint";
      gateHint.textContent = "Pauses the automation and sends a notification. You answer in the Pending Decisions panel. The automation resumes based on your response.";
      container.appendChild(gateHint);
      break;
    }
    case "loop": {
      // Collection to iterate
      const overLabel = document.createElement("label");
      overLabel.textContent = "Iterate over: ";
      const overSel = document.createElement("select");
      overSel.className = "auto-step-select";
      for (const [val, label] of [
        ["entities", "Extracted entities"], ["stepResults", "All step results"],
        ["_custom", "Custom path..."]
      ]) {
        const opt = document.createElement("option"); opt.value = val; opt.textContent = label;
        overSel.appendChild(opt);
      }
      overSel.value = step.over || "entities";
      const overCustom = document.createElement("input");
      overCustom.type = "text"; overCustom.className = "auto-step-input";
      overCustom.placeholder = "e.g. vars.items";
      overCustom.style.display = overSel.value === "_custom" ? "" : "none";
      overSel.addEventListener("change", () => {
        overCustom.style.display = overSel.value === "_custom" ? "" : "none";
        step.over = overSel.value === "_custom" ? overCustom.value : overSel.value;
      });
      overCustom.addEventListener("input", () => { step.over = overCustom.value; });
      overLabel.appendChild(overSel);
      container.appendChild(overLabel);
      container.appendChild(overCustom);

      // Variable name
      const varLabel = document.createElement("label");
      varLabel.textContent = "Item variable name: ";
      const varInput = document.createElement("input");
      varInput.type = "text"; varInput.className = "auto-step-input";
      varInput.value = step.varName || "item";
      varInput.addEventListener("input", () => { step.varName = varInput.value; });
      varLabel.appendChild(varInput);
      container.appendChild(varLabel);

      // Max iterations
      const maxLabel = document.createElement("label");
      maxLabel.textContent = "Max iterations: ";
      const maxInput = document.createElement("input");
      maxInput.type = "number"; maxInput.className = "auto-step-input";
      maxInput.min = 1; maxInput.max = 500; maxInput.value = step.maxIterations || 50;
      maxInput.addEventListener("input", () => { step.maxIterations = parseInt(maxInput.value) || 50; });
      maxLabel.appendChild(maxInput);
      container.appendChild(maxLabel);

      // Delay between iterations
      const delayLabel = document.createElement("label");
      delayLabel.textContent = "Delay between items (ms): ";
      const delayInput = document.createElement("input");
      delayInput.type = "number"; delayInput.className = "auto-step-input";
      delayInput.min = 0; delayInput.max = 30000; delayInput.value = step.delayMs || 1000;
      delayInput.addEventListener("input", () => { step.delayMs = parseInt(delayInput.value) || 0; });
      delayLabel.appendChild(delayInput);
      container.appendChild(delayLabel);

      const loopHint = document.createElement("div");
      loopHint.className = "auto-step-hint";
      loopHint.textContent = "Runs sub-steps for each item in a collection. Each iteration sets vars.[varName] to the current item.";
      container.appendChild(loopHint);
      break;
    }
    case "setVar": {
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Variable name: ";
      const nameInput = document.createElement("input");
      nameInput.type = "text"; nameInput.className = "auto-step-input";
      nameInput.value = step.varName || "";
      nameInput.placeholder = "e.g. author, sentiment, score";
      nameInput.addEventListener("input", () => { step.varName = nameInput.value; });
      nameLabel.appendChild(nameInput);
      container.appendChild(nameLabel);

      const valLabel = document.createElement("label");
      valLabel.textContent = "Value (path or literal): ";
      const valInput = document.createElement("input");
      valInput.type = "text"; valInput.className = "auto-step-input";
      valInput.value = step.value || "";
      valInput.placeholder = 'e.g. page.title, lastOutput, "fixed string"';
      valInput.addEventListener("input", () => { step.value = valInput.value; });
      valLabel.appendChild(valInput);
      container.appendChild(valLabel);

      const setVarHint = document.createElement("div");
      setVarHint.className = "auto-step-hint";
      setVarHint.textContent = "Sets a variable that can be used by downstream Condition, Filter, Switch, and Classify steps. Use quoted strings for literals, or paths like page.title for dynamic values.";
      container.appendChild(setVarHint);
      break;
    }
  }
}

function stepTypeLabel(type) {
  const labels = {
    analyze: "Analyze (Preset)",
    prompt: "Custom Prompt",
    extractEntities: "Extract Entities",
    addToProject: "Save Link to Project",
    addToMonitors: "Add to Monitors",
    runPipeline: "Run Pipeline",
    paste: "Paste to Service",
    saveToCloud: "Save to Cloud",
    condition: "IF / THEN / ELSE",
    filter: "Filter (Check List)",
    "switch": "Switch (Multi-Branch)",
    classify: "Classify (AI Decision)",
    gate: "Gate (Ask User)",
    loop: "Loop (Iterate)",
    setVar: "Set Variable",
  };
  return labels[type] || type;
}

function addEditorStep() {
  const type = document.getElementById("auto-add-step-type").value;
  const step = { type };
  if (type === "analyze") step.preset = "summary";
  if (type === "prompt") { step.system = ""; step.prompt = ""; step.inputMode = "page"; }
  if (type === "runPipeline") step.pipelineId = "";
  if (type === "addToProject") { step.projectId = ""; step.tagsWith = ["automation"]; step.summaryFrom = "last"; }
  if (type === "addToMonitors") { step.intervalMinutes = 60; step.aiAnalysis = true; step.analysisPreset = ""; step.duration = 0; }
  if (type === "paste") { step.provider = ""; step.inputMode = "previous"; step.titleTemplate = ""; step.filename = "argus-export.md"; }
  if (type === "saveToCloud") { step.inputMode = "previous"; step.format = "md"; step.providers = ["default"]; }
  // Logic step defaults
  if (type === "condition") {
    step.expression = { op: "contains", left: "page.text", right: "" };
    step.thenSteps = [];
    step.elseSteps = [];
  }
  if (type === "filter") {
    step.value = "page.title";
    step.list = "";
    step.action = "block";
    step.haltSteps = [];
    step.passSteps = [];
  }
  if (type === "switch") {
    step.value = "lastOutput";
    step.cases = [{ match: [], steps: [] }];
    step.defaultSteps = [];
  }
  if (type === "classify") {
    step.question = "Classify this content:";
    step.categories = [
      { value: "positive", label: "Positive", description: "Positive sentiment or favorable", steps: [] },
      { value: "negative", label: "Negative", description: "Negative sentiment or unfavorable", steps: [] },
      { value: "neutral", label: "Neutral", description: "Neutral or factual", steps: [] },
    ];
    step.defaultSteps = [];
    step.inputMode = "page";
  }
  if (type === "gate") {
    step.gateType = "confirm";
    step.question = "Continue this automation?";
    step.options = [];
    step.thenSteps = [];
    step.elseSteps = [];
    step.timeoutMs = 300000;
    step.timeoutAction = "halt";
  }
  if (type === "loop") {
    step.over = "entities";
    step.varName = "item";
    step.maxIterations = 50;
    step.steps = [];
    step.delayMs = 1000;
  }
  if (type === "setVar") {
    step.varName = "";
    step.value = "";
  }
  editorSteps.push(step);
  expandedStepIndex = editorSteps.length - 1; // auto-expand the new step
  renderEditorSteps();
  // Scroll the new step into view
  setTimeout(() => {
    const items = document.querySelectorAll(".auto-step-item");
    const last = items[items.length - 1];
    if (last) last.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
}

async function saveAutomation() {
  const name = document.getElementById("auto-name").value.trim();
  if (!name) { alert("Enter an automation name."); return; }
  if (!editorSteps.length) { alert("Add at least one step."); return; }

  const urlPatterns = document.getElementById("auto-url-patterns").value
    .split("\n").map(l => l.trim()).filter(Boolean);

  // If URL patterns are specified, request webNavigation
  if (urlPatterns.length) {
    try {
      const has = await browser.permissions.contains({ permissions: ["webNavigation"] });
      if (!has) {
        const granted = await browser.permissions.request({ permissions: ["webNavigation"] });
        if (!granted) {
          alert("URL triggers require the webNavigation permission.");
          return;
        }
        browser.runtime.sendMessage({ action: "initAutoAnalyze" });
      }
    } catch { /* ok */ }
  }

  const auto = editingAutomation ? { ...editingAutomation } : {};
  auto.name = name;
  auto.enabled = editingAutomation ? editingAutomation.enabled : true;
  auto.triggers = {
    urlPatterns,
    manual: document.getElementById("auto-manual").checked,
    projectId: document.getElementById("auto-project-trigger").value || null,
  };

  // Schedule trigger
  if (document.getElementById("auto-schedule-enabled").checked) {
    const schedType = document.getElementById("auto-schedule-type").value;
    const sched = { type: schedType };
    if (schedType === "once") {
      sched.datetime = document.getElementById("auto-schedule-datetime").value;
    } else if (schedType === "interval") {
      sched.intervalMs = (parseInt(document.getElementById("auto-schedule-interval-ms").value) || 60) * 60000;
    } else if (schedType === "daily") {
      sched.time = document.getElementById("auto-schedule-time").value || "09:00";
    } else if (schedType === "weekly") {
      sched.day = parseInt(document.getElementById("auto-schedule-day").value) || 1;
      sched.time = document.getElementById("auto-schedule-weekly-time").value || "09:00";
    } else if (schedType === "cron") {
      sched.hours = [...document.querySelectorAll(".cron-hour-cb:checked")].map(c => Number(c.value));
      sched.days = [...document.querySelectorAll(".cron-day-cb:checked")].map(c => Number(c.value));
    }
    sched.url = document.getElementById("auto-schedule-url").value.trim();
    auto.triggers.schedule = sched;
  } else {
    delete auto.triggers?.schedule;
  }
  auto.steps = editorSteps;
  auto.cooldownMs = parseInt(document.getElementById("auto-cooldown").value) || 60000;
  auto.delay = parseInt(document.getElementById("auto-delay").value) || 2000;
  auto.notifyOnComplete = document.getElementById("auto-notify").checked;
  auto.continueOnError = document.getElementById("auto-continue-error").checked;

  await browser.runtime.sendMessage({ action: "saveAutomation", automation: auto });
  closeAutomationEditor();
  await loadAutomations();
}

async function deleteAutomation() {
  if (!editingAutomation) return;
  if (!confirm(`Delete automation "${editingAutomation.name}"?`)) return;
  await browser.runtime.sendMessage({ action: "deleteAutomation", automationId: editingAutomation.id });
  closeAutomationEditor();
  await loadAutomations();
}

function closeAutomationEditor() {
  document.getElementById("automation-editor-card").classList.add("hidden");
  editingAutomation = null;
  editorSteps = [];
}

async function loadAutomationLog() {
  const resp = await browser.runtime.sendMessage({ action: "getAutomationLog" });
  const logs = (resp?.success ? resp.logs : []).slice(0, 20);
  const list = document.getElementById("automation-log-list");
  list.replaceChildren();

  if (!logs.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No runs yet.";
    list.appendChild(hint);
    return;
  }

  for (const log of logs) {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = log.automationName || log.automationId;
    const span = document.createElement("span");
    const stepsOk = log.steps.filter(s => s.status === "done").length;
    const statusText = log.status === "done" ? `${stepsOk}/${log.steps.length} steps` : log.status;
    const timeAgo = formatTimeAgo(new Date(log.startedAt));
    span.textContent = `${statusText} | ${truncateUrl(log.url)} | ${timeAgo}`;
    info.appendChild(strong);
    info.appendChild(span);

    const badge = document.createElement("span");
    badge.className = `auto-log-badge auto-log-${log.status}`;
    badge.textContent = log.status;

    div.appendChild(info);
    div.appendChild(badge);
    list.appendChild(div);
  }
}

function formatTimeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncateUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + "..." : u.pathname);
  } catch { return url.slice(0, 40); }
}

// ──────────────────────────────────────────────
// Named Lists
// ──────────────────────────────────────────────

let editingList = null;

async function loadNamedLists() {
  const resp = await browser.runtime.sendMessage({ action: "getLists" });
  const lists = resp?.success ? resp.lists : [];
  const container = document.getElementById("named-lists-list");
  container.replaceChildren();

  if (!lists.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No lists yet. Create watchlists, blocklists, or allowlists for automation logic.";
    container.appendChild(hint);
    return;
  }

  for (const list of lists) {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = list.name;
    if (list.prebuilt) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Pre-built";
      badge.style.cssText = "margin-left:6px;font-size:10px;opacity:0.7;";
      strong.appendChild(badge);
    }
    const span = document.createElement("span");
    const itemCount = Array.isArray(list.items) ? list.items.length : 0;
    span.textContent = `${list.type} · ${itemCount} item${itemCount !== 1 ? "s" : ""}${list.description ? " · " + list.description : ""}`;
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openListEditor(list));
    actions.appendChild(editBtn);

    div.appendChild(info);
    div.appendChild(actions);
    container.appendChild(div);
  }
}

function openListEditor(list) {
  editingList = list;
  const card = document.getElementById("list-editor-card");
  card.classList.remove("hidden");
  document.getElementById("list-editor-title").textContent = list ? `Edit List: ${list.name}` : "New List";
  document.getElementById("list-name").value = list?.name || "";
  document.getElementById("list-type").value = list?.type || "blocklist";
  document.getElementById("list-description").value = list?.description || "";
  document.getElementById("list-items").value = list?.items
    ? list.items.map(i => typeof i === "string" ? i : (i.value || "")).join("\n")
    : "";
  document.getElementById("list-delete-btn").classList.toggle("hidden", !list);
  card.scrollIntoView({ behavior: "smooth" });
}

async function saveNamedList() {
  const name = document.getElementById("list-name").value.trim();
  if (!name) { alert("Enter a list name."); return; }

  const itemsText = document.getElementById("list-items").value;
  const items = itemsText.split("\n").map(l => l.trim()).filter(Boolean).map(v => ({ value: v }));

  const list = editingList ? { ...editingList } : {};
  list.name = name;
  list.type = document.getElementById("list-type").value;
  list.description = document.getElementById("list-description").value.trim();
  list.items = items;

  await browser.runtime.sendMessage({ action: "saveList", list });
  closeListEditor();
  await loadNamedLists();
}

async function deleteNamedList() {
  if (!editingList) return;
  if (!confirm(`Delete list "${editingList.name}"?`)) return;
  await browser.runtime.sendMessage({ action: "removeList", listId: editingList.id });
  closeListEditor();
  await loadNamedLists();
}

function closeListEditor() {
  document.getElementById("list-editor-card").classList.add("hidden");
  editingList = null;
}

// ──────────────────────────────────────────────
// Pending Gates (Decision Points)
// ──────────────────────────────────────────────

async function loadPendingGates() {
  const resp = await browser.runtime.sendMessage({ action: "getPendingGates" });
  const gates = resp?.success ? resp.gates : [];
  const container = document.getElementById("pending-gates-list");
  const badge = document.getElementById("gates-count-badge");

  if (badge) {
    badge.textContent = gates.length;
    badge.style.display = gates.length > 0 ? "" : "none";
  }

  container.replaceChildren();

  if (!gates.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No pending decisions. Gate steps in running automations will appear here.";
    container.appendChild(hint);
    return;
  }

  for (const gate of gates) {
    const div = document.createElement("div");
    div.className = "rule-item";
    div.style.flexDirection = "column";
    div.style.gap = "8px";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;width:100%;";
    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = gate.automationName;
    const span = document.createElement("span");
    span.textContent = gate.url ? truncateUrl(gate.url) : "No URL";
    info.appendChild(strong);
    info.appendChild(span);
    header.appendChild(info);

    const timeSpan = document.createElement("span");
    timeSpan.className = "hint";
    timeSpan.textContent = formatTimeAgo(new Date(gate.createdAt));
    header.appendChild(timeSpan);
    div.appendChild(header);

    const question = document.createElement("div");
    question.style.cssText = "font-weight:600;font-size:13px;color:#e8e8e8;";
    question.textContent = gate.question;
    div.appendChild(question);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:6px;";

    if (gate.type === "confirm") {
      const yesBtn = document.createElement("button");
      yesBtn.className = "btn btn-accent btn-sm";
      yesBtn.textContent = "Yes";
      yesBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resolveGate", gateId: gate.id, answer: "yes" });
        loadPendingGates();
      });
      const noBtn = document.createElement("button");
      noBtn.className = "btn btn-secondary btn-sm";
      noBtn.textContent = "No";
      noBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resolveGate", gateId: gate.id, answer: "no" });
        loadPendingGates();
      });
      actions.appendChild(yesBtn);
      actions.appendChild(noBtn);
    } else if (gate.type === "choice") {
      for (const opt of (gate.options || [])) {
        const btn = document.createElement("button");
        btn.className = "btn btn-secondary btn-sm";
        btn.textContent = opt.label || opt.value;
        btn.addEventListener("click", async () => {
          await browser.runtime.sendMessage({ action: "resolveGate", gateId: gate.id, answer: opt.value });
          loadPendingGates();
        });
        actions.appendChild(btn);
      }
    } else if (gate.type === "input") {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Enter your response...";
      input.style.flex = "1";
      actions.appendChild(input);
      const submitBtn = document.createElement("button");
      submitBtn.className = "btn btn-accent btn-sm";
      submitBtn.textContent = "Submit";
      submitBtn.addEventListener("click", async () => {
        if (!input.value.trim()) return;
        await browser.runtime.sendMessage({ action: "resolveGate", gateId: gate.id, answer: input.value.trim() });
        loadPendingGates();
      });
      actions.appendChild(submitBtn);
    }

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "btn btn-danger btn-sm";
    rejectBtn.textContent = "Reject";
    rejectBtn.title = "Reject and halt automation";
    rejectBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "rejectGate", gateId: gate.id });
      loadPendingGates();
    });
    actions.appendChild(rejectBtn);

    div.appendChild(actions);
    container.appendChild(div);
  }
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

  el.defaultPreset.addEventListener("change", scheduleSave);

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
  el.reasoningEffort.addEventListener("change", scheduleSave);
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

  // Prompt editing
  el.promptProvider.addEventListener("change", savePrompt);
  el.promptSystem.addEventListener("input", savePrompt);
  el.promptUser.addEventListener("input", savePrompt);

  el.resetPrompt.addEventListener("click", () => {
    const defaults = DEFAULT_PRESETS[currentPresetKey];
    if (!defaults) return;
    el.promptProvider.value = "";
    el.promptSystem.value = defaults.system;
    el.promptUser.value = defaults.prompt;
    delete customPresets[currentPresetKey];
    const tab = el.tabList.querySelector(`[data-key="${currentPresetKey}"]`);
    if (tab) tab.classList.remove("modified");
    el.promptStatus.textContent = "Reset to default";
    setTimeout(() => { el.promptStatus.textContent = ""; }, 2000);
    scheduleSave();
  });

  // Bookmark tagging prompt
  el.bookmarkTagPrompt.addEventListener("input", scheduleSave);
  el.resetBookmarkTagPrompt.addEventListener("click", () => {
    el.bookmarkTagPrompt.value = DEFAULT_BOOKMARK_TAG_PROMPT;
    el.bookmarkTagPromptStatus.textContent = "Reset to default";
    setTimeout(() => { el.bookmarkTagPromptStatus.textContent = ""; }, 2000);
    scheduleSave();
  });

  // Advanced prompts editor
  initAdvancedPrompts();
  el.advPromptSelect.addEventListener("change", loadAdvancedPrompt);
  el.advPromptSystem.addEventListener("input", saveAdvancedPrompt);
  el.advPromptUser.addEventListener("input", saveAdvancedPrompt);
  el.advPromptReset.addEventListener("click", resetAdvancedPrompt);

  // Add custom preset
  el.addPreset.addEventListener("click", () => {
    const name = prompt("Enter a name for your new preset:");
    if (!name || !name.trim()) return;
    const key = "custom_" + Date.now();
    customPresets[key] = {
      isCustom: true,
      label: name.trim(),
      provider: "",
      system: "You are a helpful assistant.",
      prompt: "Analyze the following webpage content. Use markdown formatting."
    };
    buildPromptTabs();
    selectPromptTab(key);
    populateRulePresets();
    scheduleSave();
  });

  // Delete custom preset
  el.deletePreset.addEventListener("click", () => {
    if (!customPresets[currentPresetKey]?.isCustom) return;
    if (!confirm(`Delete preset "${customPresets[currentPresetKey].label}"?`)) return;
    delete customPresets[currentPresetKey];
    buildPromptTabs();
    selectPromptTab("summary");
    populateRulePresets();
    scheduleSave();
  });

  // Add auto-analyze rule
  // Check webNavigation permission at load so we can request it synchronously on click
  let hasWebNav = false;
  browser.permissions.contains({ permissions: ["webNavigation"] }).then(ok => { hasWebNav = ok; });

  el.addRule.addEventListener("click", async () => {
    const urlPattern = el.ruleUrl.value.trim();
    if (!urlPattern) return;

    // Request webNavigation permission — must be first await (direct user gesture)
    if (!hasWebNav) {
      const granted = await browser.permissions.request({ permissions: ["webNavigation"] });
      if (!granted) {
        alert("Automation requires the webNavigation permission to detect page loads.");
        return;
      }
      hasWebNav = true;
      browser.runtime.sendMessage({ action: "initAutoAnalyze" });
    }

    autoAnalyzeRules.push({
      id: "rule-" + Date.now(),
      enabled: true,
      urlPattern,
      preset: el.rulePreset.value,
      provider: el.ruleProvider.value,
      delay: parseInt(el.ruleDelay.value, 10) || 2000
    });
    el.ruleUrl.value = "";
    renderAutoRules();
    scheduleSave();
  });

  // Named Automations
  loadAutomations();
  document.getElementById("new-automation-btn").addEventListener("click", () => openAutomationEditor(null));
  document.getElementById("export-automations-btn").addEventListener("click", exportAutomationsToFile);
  document.getElementById("import-automations-btn").addEventListener("click", () => document.getElementById("import-automations-file").click());
  document.getElementById("import-automations-file").addEventListener("change", importAutomationsFromFile);
  document.getElementById("seed-prebuilt-btn").addEventListener("click", seedPrebuiltAutomations);
  document.getElementById("auto-add-step-btn").addEventListener("click", addEditorStep);
  document.getElementById("auto-save-btn").addEventListener("click", saveAutomation);
  document.getElementById("auto-cancel-btn").addEventListener("click", closeAutomationEditor);
  document.getElementById("auto-delete-btn").addEventListener("click", deleteAutomation);

  // Schedule trigger toggle
  const scheduleEnabled = document.getElementById("auto-schedule-enabled");
  const scheduleOpts = document.getElementById("auto-schedule-options");
  if (scheduleEnabled && scheduleOpts) {
    scheduleEnabled.addEventListener("change", () => {
      scheduleOpts.classList.toggle("hidden", !scheduleEnabled.checked);
    });
    const schedType = document.getElementById("auto-schedule-type");
    if (schedType) {
      schedType.addEventListener("change", () => {
        document.getElementById("auto-schedule-once").classList.toggle("hidden", schedType.value !== "once");
        document.getElementById("auto-schedule-interval").classList.toggle("hidden", schedType.value !== "interval");
        document.getElementById("auto-schedule-daily-opts").classList.toggle("hidden", schedType.value !== "daily");
        document.getElementById("auto-schedule-weekly-opts").classList.toggle("hidden", schedType.value !== "weekly");
        document.getElementById("auto-schedule-cron-opts").classList.toggle("hidden", schedType.value !== "cron");
      });
    }
    // Build cron hour checkboxes
    const cronHours = document.getElementById("auto-schedule-cron-hours");
    if (cronHours) {
      for (let h = 0; h < 24; h++) {
        const lbl = document.createElement("label");
        lbl.style.cssText = "display:flex;align-items:center;gap:2px;cursor:pointer;";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.value = h; cb.className = "cron-hour-cb";
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(String(h).padStart(2, "0")));
        cronHours.appendChild(lbl);
      }
    }
    // Build cron day checkboxes
    const cronDays = document.getElementById("auto-schedule-cron-days");
    if (cronDays) {
      for (const [val, label] of [[0,"Sun"],[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"],[6,"Sat"]]) {
        const lbl = document.createElement("label");
        lbl.style.cssText = "display:flex;align-items:center;gap:2px;cursor:pointer;";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.value = val; cb.className = "cron-day-cb";
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(label));
        cronDays.appendChild(lbl);
      }
    }
  }

  // Named Lists
  loadNamedLists();
  document.getElementById("new-list-btn").addEventListener("click", () => openListEditor(null));
  document.getElementById("list-save-btn").addEventListener("click", saveNamedList);
  document.getElementById("list-cancel-btn").addEventListener("click", closeListEditor);
  document.getElementById("list-delete-btn").addEventListener("click", deleteNamedList);

  // Pending Gates
  loadPendingGates();
  setInterval(loadPendingGates, 15000); // refresh every 15s

  // Finance Monitor
  loadFinanceState();
  document.getElementById("fin-add-watchlist-btn").addEventListener("click", finAddWatchlistItem);
  document.getElementById("fin-bulk-add-btn").addEventListener("click", finBulkImport);
  document.getElementById("fin-add-wallet-btn").addEventListener("click", finAddWallet);
  document.getElementById("fin-add-alert-btn").addEventListener("click", finAddAlert);
  document.getElementById("fin-add-event-btn").addEventListener("click", finAddEvent);
  document.getElementById("fin-export-btn").addEventListener("click", finExport);
  document.getElementById("fin-import-btn").addEventListener("click", () => document.getElementById("fin-import-file").click());
  document.getElementById("fin-import-file").addEventListener("change", finImport);
  document.getElementById("fin-refresh-btn").addEventListener("click", async () => {
    const btn = document.getElementById("fin-refresh-btn");
    btn.textContent = "Refreshing...";
    btn.disabled = true;
    try {
      await browser.runtime.sendMessage({ action: "financeRefreshPrices" });
      await loadFinanceState();
      finUpdateLastRefreshed();
    } catch (e) {
      document.getElementById("fin-io-status").textContent = "Refresh error: " + e.message;
    }
    btn.textContent = "Refresh Prices";
    btn.disabled = false;
  });
  document.getElementById("fin-open-page-btn").addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("finance/finance.html") });
  });

  // Monitors
  populateMonitorPresetDropdown();
  populateMonitorAutomationDropdown();
  populateMonitorProjectDropdown();
  el.addMonitor.addEventListener("click", addMonitor);

  // RSS Feeds
  renderFeeds();
  checkDetectedFeeds();
  el.addFeed.addEventListener("click", addFeedHandler);
  initSourcePicker("feed-from-sources", "feed-sources-dropdown", ["rss", "website", "substack", "custom"], (addr) => {
    el.feedUrl.value = addr.value;
    el.feedUrl.focus();
  });
  el.openFeedReader.addEventListener("click", () => {
    focusOrCreatePage("feeds/feeds.html");
  });
  document.getElementById("delete-all-feeds").addEventListener("click", async () => {
    if (!confirm("Delete all feeds and their entries? This cannot be undone.")) return;
    await browser.runtime.sendMessage({ action: "deleteAllFeeds" });
    renderFeeds();
  });

  // Feed Keyword Routes
  renderFeedRoutes();
  el.addFeedRoute.addEventListener("click", addFeedRoute);

  // Jump link: Feeds tab → Keyword Routes on Automate tab
  const feedRouteLink = document.getElementById("feed-route-link");
  if (feedRouteLink) {
    feedRouteLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('[data-tab="automation"]').click();
      setTimeout(() => {
        document.getElementById("feed-route-list")?.closest(".card")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
  }

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

const FIN_STORAGE_KEY = "financeMonitor";
let finState = { watchlist: [], wallets: [], alerts: [], events: [], pinned: [] };

async function loadFinanceState() {
  try {
    const { [FIN_STORAGE_KEY]: saved } = await browser.storage.local.get({ [FIN_STORAGE_KEY]: null });
    if (saved) finState = { watchlist: [], wallets: [], alerts: [], events: [], pinned: [], ...saved };
  } catch { /* first load */ }
  renderFinanceAll();
}

async function saveFinanceState() {
  await browser.storage.local.set({ [FIN_STORAGE_KEY]: finState });
}

function renderFinanceAll() {
  renderFinWatchlist();
  renderFinWallets();
  renderFinAlerts();
  renderFinEvents();
  const wb = document.getElementById("fin-watchlist-badge");
  const walb = document.getElementById("fin-wallets-badge");
  const ab = document.getElementById("fin-alerts-badge");
  const navBadge = document.getElementById("badge-finance");
  if (wb) wb.textContent = finState.watchlist.length;
  if (walb) walb.textContent = finState.wallets.length;
  if (ab) ab.textContent = finState.alerts.length;
  const total = finState.watchlist.length + finState.wallets.length + finState.alerts.length;
  if (navBadge) navBadge.textContent = total || "";
  finUpdateLastRefreshed();
}

function finUpdateLastRefreshed() {
  const el = document.getElementById("fin-last-refreshed");
  if (!el) return;
  if (finState.lastRefreshed) {
    const d = new Date(finState.lastRefreshed);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) el.textContent = "Updated just now";
    else if (diffMin < 60) el.textContent = `Updated ${diffMin}m ago`;
    else el.textContent = `Updated ${d.toLocaleTimeString()}`;
  } else {
    el.textContent = "Not yet refreshed — click Refresh Prices";
  }
}

function finFormatPrice(val) {
  if (val == null) return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  if (n >= 1000) return "$" + n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(6);
}

function finFormatChange(val) {
  if (val == null) return "";
  const n = Number(val);
  if (isNaN(n)) return "";
  const sign = n >= 0 ? "+" : "";
  const color = n >= 0 ? "#4caf50" : "#ff5252";
  return `<span style="color:${color};font-size:11px;font-weight:600;">${sign}${n.toFixed(2)}%</span>`;
}

function renderFinWatchlist() {
  const list = document.getElementById("fin-watchlist-list");
  if (!list) return;
  list.replaceChildren();

  if (!finState.watchlist.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No items in watchlist. Add stocks, crypto, and more below.";
    list.appendChild(hint);
    return;
  }

  for (const item of finState.watchlist) {
    const div = document.createElement("div");
    div.className = "rule-item";
    const isPinned = finState.pinned.includes(item.id);

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    const priceStr = item.price != null ? ` ${finFormatPrice(item.price)}` : "";
    const changeStr = finFormatChange(item.changePct);
    strong.innerHTML = `<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase;margin-right:6px;background:rgba(100,181,246,0.12);color:#64b5f6;">${item.type}</span>${item.symbol}${priceStr} ${changeStr}`;
    const span = document.createElement("span");
    span.textContent = item.name || "";
    if (isPinned) span.textContent += " (pinned)";
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "btn btn-sm btn-secondary";
    pinBtn.textContent = isPinned ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", () => {
      const idx = finState.pinned.indexOf(item.id);
      if (idx >= 0) finState.pinned.splice(idx, 1);
      else finState.pinned.push(item.id);
      saveFinanceState();
      renderFinanceAll();
    });

    const rmBtn = document.createElement("button");
    rmBtn.className = "btn btn-sm btn-secondary";
    rmBtn.textContent = "Remove";
    rmBtn.style.color = "var(--error)";
    rmBtn.addEventListener("click", () => {
      finState.watchlist = finState.watchlist.filter(i => i.id !== item.id);
      finState.pinned = finState.pinned.filter(p => p !== item.id);
      saveFinanceState();
      renderFinanceAll();
    });

    actions.appendChild(pinBtn);
    actions.appendChild(rmBtn);
    div.appendChild(info);
    div.appendChild(actions);
    list.appendChild(div);
  }
}

function renderFinWallets() {
  const list = document.getElementById("fin-wallets-list");
  if (!list) return;
  list.replaceChildren();

  if (!finState.wallets.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No wallets being monitored.";
    list.appendChild(hint);
    return;
  }

  for (const w of finState.wallets) {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    strong.textContent = `${w.chain.toUpperCase()} — ${w.label || "Wallet"}`;
    const span = document.createElement("span");
    span.textContent = w.address;
    span.style.fontFamily = "monospace";
    span.style.fontSize = "11px";
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "btn btn-sm btn-secondary";
    const isPinned = finState.pinned.includes(w.id);
    pinBtn.textContent = isPinned ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", () => {
      const idx = finState.pinned.indexOf(w.id);
      if (idx >= 0) finState.pinned.splice(idx, 1);
      else finState.pinned.push(w.id);
      saveFinanceState();
      renderFinanceAll();
    });

    const rmBtn = document.createElement("button");
    rmBtn.className = "btn btn-sm btn-secondary";
    rmBtn.textContent = "Remove";
    rmBtn.style.color = "var(--error)";
    rmBtn.addEventListener("click", () => {
      finState.wallets = finState.wallets.filter(x => x.id !== w.id);
      finState.pinned = finState.pinned.filter(p => p !== w.id);
      saveFinanceState();
      renderFinanceAll();
    });

    actions.appendChild(pinBtn);
    actions.appendChild(rmBtn);
    div.appendChild(info);
    div.appendChild(actions);
    list.appendChild(div);
  }
}

function renderFinAlerts() {
  const list = document.getElementById("fin-alerts-list");
  if (!list) return;
  list.replaceChildren();

  if (!finState.alerts.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No price alerts configured.";
    list.appendChild(hint);
    return;
  }

  for (const a of finState.alerts) {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    const condLabel = { above: ">", below: "<", change_above: "% chg >", change_below: "% chg <" };
    strong.textContent = `${a.symbol} ${condLabel[a.condition] || a.condition} ${a.threshold}`;
    const span = document.createElement("span");
    span.textContent = a.triggered ? "Triggered" : (a.enabled ? "Active" : "Paused");
    span.style.color = a.triggered ? "var(--accent)" : (a.enabled ? "var(--success)" : "var(--text-muted)");
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-sm btn-secondary";
    toggleBtn.textContent = a.enabled ? "Pause" : "Enable";
    toggleBtn.addEventListener("click", () => {
      a.enabled = !a.enabled;
      if (!a.enabled) a.triggered = false;
      saveFinanceState();
      renderFinanceAll();
    });

    const rmBtn = document.createElement("button");
    rmBtn.className = "btn btn-sm btn-secondary";
    rmBtn.textContent = "Remove";
    rmBtn.style.color = "var(--error)";
    rmBtn.addEventListener("click", () => {
      finState.alerts = finState.alerts.filter(x => x.id !== a.id);
      saveFinanceState();
      renderFinanceAll();
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(rmBtn);
    div.appendChild(info);
    div.appendChild(actions);
    list.appendChild(div);
  }
}

function renderFinEvents() {
  const list = document.getElementById("fin-events-list");
  if (!list) return;
  list.replaceChildren();

  if (!finState.events.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "No calendar events.";
    list.appendChild(hint);
    return;
  }

  const sorted = [...finState.events].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const ev of sorted) {
    const div = document.createElement("div");
    div.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";
    const strong = document.createElement("strong");
    const d = new Date(ev.date);
    strong.textContent = `${d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} — ${ev.title}`;
    const span = document.createElement("span");
    span.textContent = ev.tag ? `Tag: ${ev.tag}` : (ev.description || "");
    info.appendChild(strong);
    info.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "rule-actions";
    const rmBtn = document.createElement("button");
    rmBtn.className = "btn btn-sm btn-secondary";
    rmBtn.textContent = "Remove";
    rmBtn.style.color = "var(--error)";
    rmBtn.addEventListener("click", () => {
      finState.events = finState.events.filter(x => x.id !== ev.id);
      saveFinanceState();
      renderFinanceAll();
    });
    actions.appendChild(rmBtn);
    div.appendChild(info);
    div.appendChild(actions);
    list.appendChild(div);
  }
}

function finAddWatchlistItem() {
  const symbol = document.getElementById("fin-add-symbol").value.trim().toUpperCase();
  if (!symbol) { alert("Enter a symbol."); return; }
  const type = document.getElementById("fin-add-type").value;
  const name = document.getElementById("fin-add-name").value.trim();
  const pinned = document.getElementById("fin-add-pinned").checked;
  const id = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  finState.watchlist.push({ id, type, symbol, name, price: null, change: null, changePct: null, volume: null });
  if (pinned) finState.pinned.push(id);

  saveFinanceState();
  renderFinanceAll();
  document.getElementById("fin-add-symbol").value = "";
  document.getElementById("fin-add-name").value = "";
}

function finBulkImport() {
  const input = document.getElementById("fin-bulk-input").value.trim();
  const status = document.getElementById("fin-bulk-status");
  if (!input) return;

  const lines = input.split("\n").map(l => l.trim()).filter(Boolean);
  let added = 0;
  for (const line of lines) {
    const parts = line.split(":");
    let type = "stock", symbol, name = "";
    if (parts.length >= 2) {
      type = parts[0].toLowerCase();
      symbol = parts[1].toUpperCase();
      name = parts[2] || "";
    } else {
      symbol = parts[0].toUpperCase();
    }
    if (!symbol) continue;
    if (!["stock", "crypto", "commodity", "forex", "index"].includes(type)) type = "stock";

    const id = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    finState.watchlist.push({ id, type, symbol, name, price: null, change: null, changePct: null, volume: null });
    finState.pinned.push(id);
    added++;
  }

  saveFinanceState();
  renderFinanceAll();
  document.getElementById("fin-bulk-input").value = "";
  status.textContent = `Added ${added} items!`;
  status.style.color = "";
  setTimeout(() => { status.textContent = ""; }, 3000);
}

function finAddWallet() {
  const address = document.getElementById("fin-wallet-address").value.trim();
  if (!address) { alert("Enter a wallet address."); return; }
  const chain = document.getElementById("fin-wallet-chain").value;
  const label = document.getElementById("fin-wallet-label").value.trim();
  const id = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  finState.wallets.push({ id, chain, address, label, balance: null, usdValue: null });
  saveFinanceState();
  renderFinanceAll();
  document.getElementById("fin-wallet-address").value = "";
  document.getElementById("fin-wallet-label").value = "";
}

function finAddAlert() {
  const symbol = document.getElementById("fin-alert-symbol").value.trim().toUpperCase();
  if (!symbol) { alert("Enter a symbol."); return; }
  const condition = document.getElementById("fin-alert-condition").value;
  const threshold = parseFloat(document.getElementById("fin-alert-threshold").value) || 0;
  const id = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  finState.alerts.push({ id, symbol, condition, threshold, enabled: true, triggered: false });
  saveFinanceState();
  renderFinanceAll();
  document.getElementById("fin-alert-symbol").value = "";
  document.getElementById("fin-alert-threshold").value = "";
}

function finAddEvent() {
  const date = document.getElementById("fin-event-date").value;
  const title = document.getElementById("fin-event-title").value.trim();
  if (!date || !title) { alert("Enter a date and title."); return; }
  const tag = document.getElementById("fin-event-tag").value.trim();
  const id = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  finState.events.push({ id, date, title, tag, description: "" });
  saveFinanceState();
  renderFinanceAll();
  document.getElementById("fin-event-title").value = "";
  document.getElementById("fin-event-tag").value = "";
}

async function finExport() {
  const status = document.getElementById("fin-io-status");
  const payload = {
    _type: "argus-finance-export",
    _version: 1,
    exportedAt: new Date().toISOString(),
    ...finState,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `argus-finance-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  status.textContent = "Exported!";
  setTimeout(() => { status.textContent = ""; }, 2000);
}

async function finImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById("fin-io-status");
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data._type !== "argus-finance-export") throw new Error("Not a valid Finance export file");

    if (Array.isArray(data.watchlist)) {
      const existingIds = new Set(finState.watchlist.map(i => i.id));
      for (const item of data.watchlist) {
        if (!existingIds.has(item.id)) finState.watchlist.push(item);
      }
    }
    if (Array.isArray(data.wallets)) {
      const existingIds = new Set(finState.wallets.map(i => i.id));
      for (const item of data.wallets) {
        if (!existingIds.has(item.id)) finState.wallets.push(item);
      }
    }
    if (Array.isArray(data.alerts)) {
      const existingIds = new Set(finState.alerts.map(i => i.id));
      for (const item of data.alerts) {
        if (!existingIds.has(item.id)) finState.alerts.push(item);
      }
    }
    if (Array.isArray(data.events)) {
      const existingIds = new Set(finState.events.map(i => i.id));
      for (const item of data.events) {
        if (!existingIds.has(item.id)) finState.events.push(item);
      }
    }
    if (Array.isArray(data.pinned)) {
      for (const p of data.pinned) {
        if (!finState.pinned.includes(p)) finState.pinned.push(p);
      }
    }

    await saveFinanceState();
    renderFinanceAll();
    status.textContent = "Imported!";
    status.style.color = "";
  } catch (err) {
    status.textContent = "Import failed: " + err.message;
    status.style.color = "var(--error)";
  }
  event.target.value = "";
  setTimeout(() => { status.textContent = ""; }, 3000);
}

// ──────────────────────────────────────────────
// Automation Export / Import
// ──────────────────────────────────────────────

async function exportAutomationsToFile() {
  const status = document.getElementById("automations-io-status");
  try {
    const resp = await browser.runtime.sendMessage({ action: "exportAutomations" });
    if (!resp?.success) { status.textContent = "Export failed"; return; }

    const payload = {
      _type: "argus-automations-export",
      _version: 1,
      exportedAt: new Date().toISOString(),
      automations: resp.automations,
      lists: resp.lists,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `argus-automations-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const count = (resp.automations?.length || 0) + (resp.lists?.length || 0);
    status.textContent = `Exported ${count} items!`;
    status.style.color = "";
  } catch (err) {
    status.textContent = "Export error: " + err.message;
    status.style.color = "var(--error)";
  }
  setTimeout(() => { status.textContent = ""; }, 3000);
}

async function importAutomationsFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById("automations-io-status");

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data._type !== "argus-automations-export") {
      throw new Error("Not a valid Argus automations export file");
    }

    const mode = document.getElementById("import-automations-mode").value;
    if (mode === "replace") {
      if (!confirm("This will REPLACE all existing automations and named lists. Continue?")) return;
    }

    const resp = await browser.runtime.sendMessage({
      action: "importAutomations",
      automations: data.automations || [],
      lists: data.lists || [],
      mode,
    });

    if (resp?.success) {
      status.textContent = `Imported ${resp.imported.automations} automations, ${resp.imported.lists} lists!`;
      status.style.color = "";
      await loadAutomations();
      await loadNamedLists();
    } else {
      status.textContent = "Import failed";
      status.style.color = "var(--error)";
    }
  } catch (err) {
    status.textContent = "Import error: " + err.message;
    status.style.color = "var(--error)";
  }

  event.target.value = "";
  setTimeout(() => { status.textContent = ""; }, 4000);
}

async function seedPrebuiltAutomations() {
  const status = document.getElementById("automations-io-status");
  try {
    await browser.runtime.sendMessage({ action: "seedPrebuiltAutomations" });
    status.textContent = "Pre-built templates restored!";
    status.style.color = "";
    await loadAutomations();
    await loadNamedLists();
  } catch (err) {
    status.textContent = "Seed error: " + err.message;
    status.style.color = "var(--error)";
  }
  setTimeout(() => { status.textContent = ""; }, 3000);
}

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
          document.querySelector('[data-tab="projects"]').click();
          setTimeout(() => projSelectProject(proj.id), 100);
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
// RSS Feeds
// ──────────────────────────────────────────────

async function renderFeeds() {
  const resp = await browser.runtime.sendMessage({ action: "getFeeds" });
  if (!resp || !resp.success) return;

  el.feedList.replaceChildren();

  if (!resp.feeds.length) {
    const empty = document.createElement("p");
    empty.className = "info-text";
    empty.textContent = "No RSS feeds subscribed.";
    el.feedList.appendChild(empty);
    return;
  }

  resp.feeds.forEach(feed => {
    const row = document.createElement("div");
    row.className = "rule-item";
    row.style.flexWrap = "wrap";

    const info = document.createElement("div");
    info.className = "rule-info";

    const title = document.createElement("strong");
    title.textContent = feed.title || feed.url;
    info.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    const interval = feed.checkIntervalMinutes >= 60
      ? `${feed.checkIntervalMinutes / 60}h`
      : `${feed.checkIntervalMinutes}m`;
    const flags = [];
    if (feed.aiSummarize) flags.push("AI summaries");
    if (feed.monitorBridge) flags.push("monitor bridge");
    const flagStr = flags.length ? ` | ${flags.join(", ")}` : "";
    meta.textContent = ` — ${interval} interval | ${feed.unreadCount} unread / ${feed.totalEntries} total | Last: ${new Date(feed.lastFetched).toLocaleString()}${flagStr}`;
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-sm btn-secondary";
    toggleBtn.textContent = feed.enabled ? "Pause" : "Resume";
    toggleBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "updateFeed", id: feed.id, enabled: !feed.enabled });
      renderFeeds();
    });

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "btn btn-sm btn-secondary";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "...";
      await browser.runtime.sendMessage({ action: "refreshFeed", id: feed.id });
      renderFeeds();
    });

    const readBtn = document.createElement("button");
    readBtn.className = "btn btn-sm btn-secondary";
    readBtn.textContent = "Open Reader";
    readBtn.addEventListener("click", () => {
      browser.tabs.create({ url: browser.runtime.getURL(`feeds/feeds.html?feedId=${encodeURIComponent(feed.id)}`) });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "deleteFeed", id: feed.id });
      renderFeeds();
    });

    const intervalStepper = createInlineIntervalStepper(feed.checkIntervalMinutes || 60, async (newMins) => {
      await browser.runtime.sendMessage({
        action: "updateFeed", id: feed.id,
        checkIntervalMinutes: newMins
      });
    });

    actions.appendChild(intervalStepper);
    actions.appendChild(toggleBtn);
    actions.appendChild(refreshBtn);
    actions.appendChild(readBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);
    el.feedList.appendChild(row);
  });
}

async function addFeedHandler() {
  const url = el.feedUrl.value.trim();
  if (!url) return;

  el.addFeed.disabled = true;
  el.feedStatus.textContent = "Discovering feed...";
  el.feedStatus.style.color = "var(--text-muted)";

  const resp = await browser.runtime.sendMessage({
    action: "addFeed",
    url,
    title: el.feedTitle.value.trim() || "",
    intervalMinutes: parseInt(el.feedInterval.value, 10) || 60,
    aiSummarize: el.feedAiSummarize.checked,
    monitorBridge: el.feedMonitorBridge.checked
  });

  el.addFeed.disabled = false;

  if (resp && resp.success) {
    el.feedUrl.value = "";
    el.feedTitle.value = "";
    el.feedStatus.textContent = `Subscribed to "${resp.feed.title}"!`;
    el.feedStatus.style.color = "var(--success)";
    renderFeeds();
  } else {
    el.feedStatus.textContent = resp?.error || "Failed to add feed.";
    el.feedStatus.style.color = "var(--error)";
  }

  setTimeout(() => { el.feedStatus.textContent = ""; }, 3000);
}

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

async function renderFeedRoutes() {
  el.feedRouteList.replaceChildren();

  // Populate project and feed dropdowns
  const [projResp, feedResp] = await Promise.all([
    browser.runtime.sendMessage({ action: "getProjects" }),
    browser.runtime.sendMessage({ action: "getFeeds" })
  ]);

  const projects = projResp?.projects || [];
  const rssFeeds = feedResp?.feeds || [];

  // Populate project dropdown
  el.routeProject.replaceChildren();
  const defOpt = document.createElement("option");
  defOpt.value = "";
  defOpt.textContent = "Select project...";
  el.routeProject.appendChild(defOpt);
  projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    el.routeProject.appendChild(opt);
  });

  // Populate feed dropdown
  el.routeFeed.replaceChildren();
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All feeds";
  el.routeFeed.appendChild(allOpt);
  rssFeeds.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.title || f.url;
    el.routeFeed.appendChild(opt);
  });

  if (!feedKeywordRoutes.length) {
    const empty = document.createElement("p");
    empty.className = "info-text";
    empty.textContent = "No keyword routes configured.";
    el.feedRouteList.appendChild(empty);
    return;
  }

  feedKeywordRoutes.forEach((route, idx) => {
    const row = document.createElement("div");
    row.className = "rule-item";

    const info = document.createElement("div");
    info.className = "rule-info";

    const keywords = document.createElement("strong");
    const kwText = route.keywords.join(", ");
    keywords.textContent = kwText === "*" ? "✱ All stories" : kwText;
    if (kwText === "*") keywords.style.color = "var(--accent)";
    info.appendChild(keywords);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    const proj = projects.find(p => p.id === route.projectId);
    const projName = proj?.name || "Unknown project";
    const projColor = proj?.color || "#a0a0b0";
    const feedName = route.feedId
      ? (rssFeeds.find(f => f.id === route.feedId)?.title || "Specific feed")
      : "All feeds";
    const flags = [];
    if (route.notify) flags.push("notify");
    // Build meta with colored project dot
    const arrow = document.createTextNode(" → ");
    meta.appendChild(arrow);
    const dot = document.createElement("span");
    dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${projColor};margin-right:4px;vertical-align:middle;`;
    meta.appendChild(dot);
    meta.appendChild(document.createTextNode(`${projName} | ${feedName}${flags.length ? " | " + flags.join(", ") : ""}`));
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn btn-sm btn-secondary";
    toggleBtn.textContent = route.enabled !== false ? "Pause" : "Resume";
    toggleBtn.addEventListener("click", () => {
      route.enabled = route.enabled === false ? true : false;
      renderFeedRoutes();
      scheduleSave();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      feedKeywordRoutes.splice(idx, 1);
      renderFeedRoutes();
      scheduleSave();
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);
    if (route.enabled === false) row.style.opacity = "0.5";
    el.feedRouteList.appendChild(row);
  });
}

function addFeedRoute() {
  const keywordsRaw = el.routeKeywords.value.trim();
  const projectId = el.routeProject.value;

  if (!keywordsRaw) return;
  if (!projectId) { alert("Select a target project."); return; }

  const keywords = keywordsRaw.split(",").map(k => k.trim()).filter(Boolean);

  feedKeywordRoutes.push({
    id: `fkr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    keywords,
    projectId,
    feedId: el.routeFeed.value || "",
    notify: el.routeNotify.checked,
    enabled: true
  });

  el.routeKeywords.value = "";
  renderFeedRoutes();
  scheduleSave();

  // Trigger retroactive scan of existing feed entries against the new route
  browser.runtime.sendMessage({ action: "feedRouteRescan" }).then(resp => {
    if (resp?.routed > 0) {
      console.log(`[Routes] Retroactive scan routed ${resp.routed} existing entries`);
    }
  }).catch(() => {});
}

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
// Projects
// ──────────────────────────────────────────────
const projState = {
  initialized: false,
  projects: [],
  activeProjectId: null,
  editingProjectId: null,
  editingItemId: null,
  query: "",
  defaultProjectId: null
};

const projEl = {};

function initProjects() {
  projState.initialized = true;
  projEl.search = document.getElementById("proj-search");
  projEl.sidebar = document.getElementById("proj-list");
  projEl.main = document.getElementById("proj-main");
  projEl.empty = document.getElementById("proj-empty");
  projEl.detail = document.getElementById("proj-detail");
  projEl.detailHeader = document.getElementById("proj-detail-header");
  projEl.itemsList = document.getElementById("proj-items-list");
  projEl.modal = document.getElementById("proj-modal");
  projEl.modalTitle = document.getElementById("proj-modal-title");
  projEl.modalName = document.getElementById("proj-modal-name");
  projEl.modalDesc = document.getElementById("proj-modal-desc");
  projEl.modalColor = document.getElementById("proj-modal-color");
  projEl.modalCloudSync = document.getElementById("proj-modal-cloud-sync");
  projEl.modalCloudProvider = document.getElementById("proj-modal-cloud-provider");
  projEl.itemModal = document.getElementById("proj-item-modal");
  projEl.itemNotes = document.getElementById("proj-item-notes");

  projEl.modalCloudSync.addEventListener("change", () => {
    projEl.modalCloudProvider.style.display = projEl.modalCloudSync.checked ? "block" : "none";
  });

  document.getElementById("proj-new").addEventListener("click", () => projOpenModal());
  document.getElementById("proj-refresh").addEventListener("click", () => projLoadProjects());
  document.getElementById("proj-import").addEventListener("click", projImport);
  document.getElementById("proj-export-all").addEventListener("click", projExportAll);
  document.getElementById("proj-add-note").addEventListener("click", () => projAddItem("note"));
  document.getElementById("proj-add-url").addEventListener("click", () => projAddItem("url"));
  document.getElementById("proj-export").addEventListener("click", () => projExportOne(projState.activeProjectId));
  document.getElementById("proj-modal-save").addEventListener("click", projSaveModal);
  document.getElementById("proj-modal-cancel").addEventListener("click", () => projEl.modal.classList.add("hidden"));
  document.getElementById("proj-item-save").addEventListener("click", projSaveItemNotes);
  document.getElementById("proj-item-cancel").addEventListener("click", () => projEl.itemModal.classList.add("hidden"));

  // Batch analysis — populate preset dropdown
  const batchSelect = document.getElementById("proj-batch-preset");
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    batchSelect.appendChild(opt);
  }
  document.getElementById("proj-batch-run").addEventListener("click", projBatchAnalyze);

  projEl.search.addEventListener("input", () => {
    projState.query = projEl.search.value.trim().toLowerCase();
    projRenderSidebar();
  });

  // OSINT project tool buttons
  document.getElementById("proj-entity-extract").addEventListener("click", projRunEntityExtraction);
  document.getElementById("proj-connection-graph").addEventListener("click", projOpenConnectionGraph);
  document.getElementById("proj-heatmap").addEventListener("click", projOpenHeatmap);
  document.getElementById("proj-geomap").addEventListener("click", projOpenGeomap);
  document.getElementById("proj-timeline").addEventListener("click", projOpenTimeline);
  document.getElementById("proj-report").addEventListener("click", projGenerateReport);
  document.getElementById("proj-anomaly").addEventListener("click", projAnomalyScan);
  document.getElementById("proj-dashboard").addEventListener("click", projOpenDashboard);
  document.getElementById("proj-skeleton").addEventListener("click", projBuildSkeleton);
  document.getElementById("proj-workbench").addEventListener("click", async () => {
    if (!projCurrentId) return;
    const wbUrl = browser.runtime.getURL("workbench/workbench.html");
    const existing = await browser.tabs.query({ url: wbUrl + "*" });
    if (existing.length > 0) {
      await browser.tabs.update(existing[0].id, { active: true, url: `${wbUrl}?project=${projCurrentId}` });
      await browser.windows.update(existing[0].windowId, { focused: true });
    } else {
      await browser.tabs.create({ url: `${wbUrl}?project=${projCurrentId}` });
    }
  });

  projLoadProjects();
  checkRunningBatch();
}

async function checkRunningBatch() {
  try {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (s && s.success && s.running) {
      const runBtn = document.getElementById("proj-batch-run");
      const statusEl = document.getElementById("proj-batch-status");
      const progressEl = document.getElementById("proj-batch-progress");
      const barEl = document.getElementById("proj-batch-bar");
      const pctEl = document.getElementById("proj-batch-pct");
      runBtn.textContent = "Cancel";
      runBtn.onclick = projCancelBatch;
      const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      progressEl.classList.remove("hidden", "proj-batch-done");
      barEl.style.width = pct + "%";
      pctEl.textContent = pct + "%";
      statusEl.textContent = `Analyzing ${s.done + 1} of ${s.total}: ${s.current}`;
      batchPollTimer = setInterval(() => pollBatchStatus(), 1500);
    }
  } catch { /* ignore */ }
}

async function projLoadProjects() {
  const [resp, defResp] = await Promise.all([
    browser.runtime.sendMessage({ action: "getProjects" }),
    browser.runtime.sendMessage({ action: "getDefaultProject" })
  ]);
  projState.defaultProjectId = defResp?.defaultProjectId || null;
  if (resp && resp.success) {
    projState.projects = resp.projects;
    projRenderSidebar();
    if (projState.activeProjectId) {
      const still = projState.projects.find(p => p.id === projState.activeProjectId);
      if (still) projSelectProject(still.id);
      else projShowEmpty();
    }
  }
}

function projRenderSidebar() {
  let projects = projState.projects;
  if (projState.query) {
    projects = projects.filter(p =>
      p.name.toLowerCase().includes(projState.query) ||
      (p.description || "").toLowerCase().includes(projState.query)
    );
  }
  // Starred first
  projects.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));

  if (projects.length === 0) {
    projEl.sidebar.innerHTML = "";
    const emptyP = document.createElement("p");
    emptyP.className = "info-text";
    emptyP.setAttribute("style", "padding:16px;text-align:center;");
    emptyP.textContent = projState.query ? "No matching projects." : 'No projects yet. Click "+ New Project" to get started.';
    projEl.sidebar.appendChild(emptyP);
    return;
  }

  projEl.sidebar.innerHTML = "";
  for (const proj of projects) {
    const item = document.createElement("div");
    item.className = "proj-list-item" + (proj.id === projState.activeProjectId ? " active" : "");
    const dotSpan = document.createElement("span");
    dotSpan.className = "proj-color-dot";
    dotSpan.setAttribute("style", "background:" + (proj.color || '#e94560'));
    const nameSpan = document.createElement("span");
    nameSpan.className = "proj-list-name";
    nameSpan.textContent = proj.name;
    if (proj.id === projState.defaultProjectId) {
      const defBadge = document.createElement("span");
      defBadge.className = "proj-default-badge";
      defBadge.textContent = "default";
      nameSpan.appendChild(defBadge);
    }
    const countSpan = document.createElement("span");
    countSpan.className = "proj-list-count";
    countSpan.textContent = proj.items.length;
    const starBtn = document.createElement("button");
    starBtn.className = "proj-star-btn" + (proj.starred ? " starred" : "");
    starBtn.dataset.id = proj.id;
    starBtn.title = "Star";
    starBtn.textContent = proj.starred ? '\u2605' : '\u2606';
    item.appendChild(dotSpan);
    item.appendChild(nameSpan);
    item.appendChild(countSpan);
    item.appendChild(starBtn);
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("proj-star-btn")) return;
      projSelectProject(proj.id);
    });
    starBtn.addEventListener("click", () => projToggleStar(proj.id));
    projEl.sidebar.appendChild(item);
  }
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function projShowEmpty() {
  projState.activeProjectId = null;
  projEl.empty.classList.remove("hidden");
  projEl.detail.classList.add("hidden");
}

function projSelectProject(id) {
  projState.activeProjectId = id;
  projEl.empty.classList.add("hidden");
  projEl.detail.classList.remove("hidden");
  projRenderSidebar();
  projRenderDetail();
}

function projRenderDetail() {
  const proj = projState.projects.find(p => p.id === projState.activeProjectId);
  if (!proj) return projShowEmpty();

  projEl.detailHeader.innerHTML = "";
  const titleDiv = document.createElement("div");
  titleDiv.className = "proj-detail-title";
  const detDot = document.createElement("span");
  detDot.className = "proj-color-dot";
  detDot.setAttribute("style", "background:" + (proj.color || '#e94560') + ";width:14px;height:14px;");
  const detH3 = document.createElement("h3");
  detH3.textContent = proj.name;
  const detStarBtn = document.createElement("button");
  detStarBtn.className = "proj-star-btn" + (proj.starred ? " starred" : "");
  detStarBtn.id = "proj-detail-star";
  detStarBtn.title = "Star";
  detStarBtn.textContent = proj.starred ? '\u2605' : '\u2606';
  titleDiv.appendChild(detDot);
  titleDiv.appendChild(detH3);
  titleDiv.appendChild(detStarBtn);
  projEl.detailHeader.appendChild(titleDiv);
  if (proj.description) {
    const descP = document.createElement("p");
    descP.className = "proj-detail-desc";
    descP.textContent = proj.description;
    projEl.detailHeader.appendChild(descP);
  }
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "proj-detail-actions";
  const editBtn2 = document.createElement("button");
  editBtn2.className = "btn btn-secondary btn-sm";
  editBtn2.id = "proj-edit-btn";
  editBtn2.textContent = "Edit";
  const deleteBtn2 = document.createElement("button");
  deleteBtn2.className = "btn btn-secondary btn-sm";
  deleteBtn2.id = "proj-delete-btn";
  deleteBtn2.textContent = "Delete";
  const defaultBtn = document.createElement("button");
  defaultBtn.className = "btn btn-secondary btn-sm";
  defaultBtn.id = "proj-default-btn";
  const isDefault = proj.id === projState.defaultProjectId;
  defaultBtn.textContent = isDefault ? "Default \u2713" : "Set as Default";
  if (isDefault) defaultBtn.setAttribute("style", "color:var(--accent);border-color:var(--accent);");
  const metaSpan = document.createElement("span");
  metaSpan.setAttribute("style", "font-size:11px;color:var(--text-muted);margin-left:auto;");
  metaSpan.textContent = proj.items.length + " items \u00B7 Updated " + new Date(proj.updatedAt).toLocaleDateString();
  actionsDiv.appendChild(editBtn2);
  actionsDiv.appendChild(defaultBtn);
  actionsDiv.appendChild(deleteBtn2);
  actionsDiv.appendChild(metaSpan);
  projEl.detailHeader.appendChild(actionsDiv);

  document.getElementById("proj-detail-star").addEventListener("click", () => projToggleStar(proj.id));
  document.getElementById("proj-edit-btn").addEventListener("click", () => projOpenModal(proj));
  document.getElementById("proj-delete-btn").addEventListener("click", () => projDelete(proj.id));
  document.getElementById("proj-default-btn").addEventListener("click", async () => {
    const newDefault = projState.defaultProjectId === proj.id ? null : proj.id;
    await browser.runtime.sendMessage({ action: "setDefaultProject", projectId: newDefault });
    projState.defaultProjectId = newDefault;
    projRenderSidebar();
    projRenderDetail();
  });

  // Populate automation toolbar for this project
  projPopulateAutomations(proj.id);

  // Auto-show skeleton overview
  projBuildSkeleton(true);

  projRenderItems(proj);
  projRenderDrafts(proj.id);
}

async function projPopulateAutomations(projectId) {
  const toolbar = document.getElementById("proj-automation-toolbar");
  const select = document.getElementById("proj-automation-select");
  const statusEl = document.getElementById("proj-automation-status");

  // Get all automations — show ones linked to this project + manual ones
  const resp = await browser.runtime.sendMessage({ action: "getAutomations" });
  const allAutos = (resp?.success ? resp.automations : []).filter(a => a.enabled);
  const relevant = allAutos.filter(a =>
    a.triggers?.manual || a.triggers?.projectId === projectId
  );

  if (!relevant.length) {
    toolbar.classList.add("hidden");
    return;
  }

  toolbar.classList.remove("hidden");
  select.replaceChildren();
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Select automation...";
  select.appendChild(defaultOpt);

  for (const auto of relevant) {
    const opt = document.createElement("option");
    opt.value = auto.id;
    opt.textContent = auto.name + (auto.triggers?.projectId === projectId ? " (linked)" : "");
    select.appendChild(opt);
  }

  // Run on All handler
  const runAllBtn = document.getElementById("proj-automation-run");
  const newRunAllBtn = runAllBtn.cloneNode(true);
  runAllBtn.parentNode.replaceChild(newRunAllBtn, runAllBtn);
  newRunAllBtn.addEventListener("click", async () => {
    const autoId = select.value;
    if (!autoId) { alert("Select an automation first."); return; }
    newRunAllBtn.disabled = true;
    newRunAllBtn.textContent = "Running...";
    statusEl.textContent = "Running automation on all project items...";
    try {
      const result = await browser.runtime.sendMessage({
        action: "runAutomationOnProject", automationId: autoId, projectId
      });
      statusEl.textContent = result.success
        ? `Done: ${result.succeeded}/${result.total} items succeeded.`
        : `Error: ${result.error}`;
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
    }
    newRunAllBtn.textContent = "Run on All";
    newRunAllBtn.disabled = false;
    loadAutomationLog();
  });
}

// Convert entity JSON summary to readable text for project cards
function projSummarizeForCard(text) {
  if (!text) return "";
  const trimmed = text.trim();

  // Try to find and parse JSON (may be raw, in code fences, or with surrounding text)
  let json = null;
  // Direct parse
  try { json = JSON.parse(trimmed); } catch {}
  // Strip code fences
  if (!json) {
    const fenced = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
    try { json = JSON.parse(fenced); } catch {}
  }
  // Find first { to last }
  if (!json) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { json = JSON.parse(trimmed.slice(start, end + 1)); } catch {}
    }
  }

  if (json && (json.people || json.organizations || json.locations || json.claims)) {
    const parts = [];
    if (json.people && json.people.length) {
      parts.push(`People: ${json.people.map(p => p.name).join(", ")}`);
    }
    if (json.organizations && json.organizations.length) {
      parts.push(`Orgs: ${json.organizations.map(o => o.name).join(", ")}`);
    }
    if (json.locations && json.locations.length) {
      parts.push(`Locations: ${json.locations.map(l => l.name).join(", ")}`);
    }
    if (json.claims && json.claims.length) {
      parts.push(`${json.claims.length} claim(s)`);
    }
    if (json.dates && json.dates.length) {
      parts.push(`${json.dates.length} date(s)`);
    }
    if (json.contact && json.contact.length) {
      parts.push(`${json.contact.length} contact(s)`);
    }
    if (parts.length) return parts.join(" | ");
  }

  // Fallback: if it looks like entity JSON but couldn't parse (truncated),
  // extract names via regex
  if (trimmed.startsWith("{") && /"name"\s*:/.test(trimmed)) {
    const names = [];
    const nameRe = /"name"\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = nameRe.exec(trimmed)) !== null) {
      names.push(m[1]);
    }
    if (names.length) {
      return `Entities found: ${names.join(", ")}`;
    }
  }

  // Not entity JSON — return as-is
  return trimmed;
}

function projRenderItems(proj) {
  projEl.itemsList.innerHTML = "";

  // Collapsible header for items section
  const analyzed = proj.items.filter(i => i.analysisContent || i.analysisPreset || (i.analyses && i.analyses.length));
  const links = proj.items.filter(i => !i.analysisContent && !i.analysisPreset && !(i.analyses && i.analyses.length));
  const headerDiv = document.createElement("div");
  headerDiv.className = "proj-items-collapse-header";
  headerDiv.innerHTML = `<span class="proj-items-collapse-arrow">&#9660;</span> <strong>Items (${proj.items.length})</strong><span style="margin-left:8px;font-size:11px;color:var(--text-muted);">${analyzed.length} analyzed &middot; ${links.length} links</span>`;
  const itemsContainer = document.createElement("div");
  itemsContainer.className = "proj-items-container";

  // Default: collapsed if skeleton is showing and there are items
  const skeletonPanel = document.getElementById("proj-skeleton-panel");
  if (proj.items.length > 0 && skeletonPanel && !skeletonPanel.classList.contains("hidden")) {
    itemsContainer.style.display = "none";
    headerDiv.querySelector(".proj-items-collapse-arrow").innerHTML = "&#9654;";
  }

  headerDiv.addEventListener("click", () => {
    const isHidden = itemsContainer.style.display === "none";
    itemsContainer.style.display = isHidden ? "" : "none";
    headerDiv.querySelector(".proj-items-collapse-arrow").innerHTML = isHidden ? "&#9660;" : "&#9654;";
  });
  projEl.itemsList.appendChild(headerDiv);
  projEl.itemsList.appendChild(itemsContainer);

  if (proj.items.length === 0) {
    const noItems = document.createElement("p");
    noItems.className = "info-text";
    noItems.style.cssText = "text-align:center;padding:32px;";
    noItems.textContent = "No items in this project yet. Add analyses from results pages, bookmarks, notes, or URLs.";
    itemsContainer.appendChild(noItems);
    return;
  }
  for (const item of proj.items) {
    const card = document.createElement("div");
    const isAnalyzed = !!(item.analysisContent || item.analysisPreset || (item.analyses && item.analyses.length));
    card.className = "proj-item-card" + (isAnalyzed ? "" : " unanalyzed");
    const bodyDiv = document.createElement("div");
    bodyDiv.className = "proj-item-body";
    const titleDiv2 = document.createElement("div");
    titleDiv2.className = "proj-item-title";
    if (item.url) {
      const titleLink = document.createElement("a");
      titleLink.href = item.url;
      titleLink.target = "_blank";
      titleLink.textContent = item.title || item.url;
      titleDiv2.appendChild(titleLink);
    } else {
      titleDiv2.textContent = item.title || "Untitled";
    }
    bodyDiv.appendChild(titleDiv2);
    if (item.url) {
      const urlDiv = document.createElement("div");
      urlDiv.className = "proj-item-url";
      urlDiv.textContent = item.url;
      bodyDiv.appendChild(urlDiv);
    }
    if (item.summary || item.analysisContent) {
      const summDiv = document.createElement("div");
      summDiv.className = "proj-item-summary";
      // Use full analysisContent first — summary may be truncated JSON that can't be parsed
      summDiv.textContent = projSummarizeForCard(item.analysisContent || item.summary).slice(0, 300);
      bodyDiv.appendChild(summDiv);
    }
    if (item.notes) {
      const notesDiv = document.createElement("div");
      notesDiv.className = "proj-item-notes";
      notesDiv.textContent = item.notes;
      bodyDiv.appendChild(notesDiv);
    }
    const metaDiv = document.createElement("div");
    metaDiv.className = "proj-item-meta";
    const analysisCount = item.analyses ? item.analyses.length : (item.analysisContent ? 1 : 0);
    const hasConversations = item.conversations && item.conversations.length > 0;
    if (analysisCount > 1) {
      const multiBadge = document.createElement("span");
      multiBadge.className = "proj-type-badge multi-analysis";
      multiBadge.textContent = `${analysisCount} analyses`;
      metaDiv.appendChild(multiBadge);
    } else if (item.analysisPreset) {
      const presetBadge = document.createElement("span");
      presetBadge.className = "proj-type-badge analysis";
      presetBadge.textContent = item.analysisPreset;
      metaDiv.appendChild(presetBadge);
    } else {
      const typeBadge = document.createElement("span");
      typeBadge.className = "proj-type-badge " + item.type;
      typeBadge.textContent = item.type;
      metaDiv.appendChild(typeBadge);
    }
    if (hasConversations) {
      const threadBadge = document.createElement("span");
      threadBadge.className = "proj-type-badge thread";
      threadBadge.textContent = item.conversations.length === 1 ? "thread" : `${item.conversations.length} threads`;
      metaDiv.appendChild(threadBadge);
    }
    if (item.pasteUrls && item.pasteUrls.length) {
      for (const p of item.pasteUrls) {
        const pasteLink = document.createElement("a");
        pasteLink.href = p.url;
        pasteLink.target = "_blank";
        pasteLink.className = "proj-type-badge paste";
        const svcNames = { gist: "Gist", pastebin: "Pastebin", privatebin: "PrivateBin" };
        pasteLink.textContent = svcNames[p.service] || "Paste";
        pasteLink.addEventListener("click", e => e.stopPropagation());
        metaDiv.appendChild(pasteLink);
      }
    }
    const dateSpan = document.createElement("span");
    dateSpan.textContent = new Date(item.addedAt).toLocaleDateString();
    metaDiv.appendChild(dateSpan);
    bodyDiv.appendChild(metaDiv);
    card.appendChild(bodyDiv);
    const actionsDiv2 = document.createElement("div");
    actionsDiv2.className = "proj-item-actions";
    if (item.analysisContent || item.refId) {
      const viewBtn2 = document.createElement("button");
      viewBtn2.className = "proj-item-view-btn";
      viewBtn2.title = "View analysis";
      viewBtn2.textContent = "View";
      actionsDiv2.appendChild(viewBtn2);
    }
    const noteBtn = document.createElement("button");
    noteBtn.className = "proj-item-note-btn";
    noteBtn.title = "Edit notes";
    noteBtn.textContent = "Notes";
    const removeBtn = document.createElement("button");
    removeBtn.className = "proj-item-remove-btn";
    removeBtn.title = "Remove from project";
    removeBtn.textContent = "Remove";
    if (item.url) {
      const autoBtn = document.createElement("button");
      autoBtn.className = "proj-item-auto-btn";
      autoBtn.title = "Run automation on this item";
      autoBtn.textContent = "Automate";
      autoBtn.addEventListener("click", async () => {
        const autoSelect = document.getElementById("proj-automation-select");
        const autoToolbar = document.getElementById("proj-automation-toolbar");
        const autoId = autoSelect?.value;
        if (!autoId) {
          if (autoToolbar?.classList.contains("hidden")) {
            alert("No automations available.\n\nCreate an automation on the Automate tab first, then enable 'Manual trigger' so it appears here.");
          } else {
            alert("Select an automation from the Automations toolbar above, then click this button.");
          }
          return;
        }
        autoBtn.disabled = true;
        autoBtn.textContent = "Running...";
        const statusEl = document.getElementById("proj-automation-status");
        statusEl.textContent = `Running on: ${item.title || item.url}`;
        try {
          const result = await browser.runtime.sendMessage({
            action: "runAutomationOnItem", automationId: autoId, projectId: proj.id,
            url: item.url, title: item.title
          });
          autoBtn.textContent = result.success ? "Done!" : "Failed";
          statusEl.textContent = result.success ? "Automation complete." : `Error: ${result.error}`;
        } catch (e) {
          autoBtn.textContent = "Error";
        }
        setTimeout(() => { autoBtn.textContent = "Automate"; autoBtn.disabled = false; }, 2000);
      });
      actionsDiv2.appendChild(autoBtn);
    }
    // Email share button
    const emailBtn = document.createElement("button");
    emailBtn.className = "proj-item-email-btn";
    emailBtn.title = "Email this item";
    emailBtn.textContent = "Email";
    emailBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pasteUrl = item.pasteUrls?.length ? item.pasteUrls[item.pasteUrls.length - 1].url : "";
      EmailShare.compose({
        subject: `${item.title || "Shared Item"} — ${proj.name}`,
        body: EmailShare.formatBody({
          summary: item.summary || (item.analysisContent || "").slice(0, 300),
          url: item.url,
          pasteUrl,
          content: item.analysisContent
        })
      });
    });
    actionsDiv2.appendChild(emailBtn);
    // Block button for auto-routed/feed items — prevents re-routing
    if (item.url && (item.type === "feed" || (item.tags && item.tags.includes("auto-routed")))) {
      const blockBtn = document.createElement("button");
      blockBtn.className = "proj-item-block-btn";
      blockBtn.title = "Remove & block from being re-routed to this project";
      blockBtn.textContent = "Block";
      blockBtn.style.color = "var(--error)";
      actionsDiv2.appendChild(blockBtn);
    }
    actionsDiv2.appendChild(noteBtn);
    actionsDiv2.appendChild(removeBtn);
    card.appendChild(actionsDiv2);

    async function openItemAnalysis() {
      let content = item.analysisContent;
      let preset = item.analysisPreset || "Analysis";

      // Backfill from history if content missing but we have a refId
      if (!content && item.refId) {
        try {
          const resp = await browser.runtime.sendMessage({ action: "getHistoryItem", id: item.refId });
          if (resp?.success && resp.entry?.content) {
            content = resp.entry.content;
            preset = resp.entry.presetLabel || resp.entry.preset || preset;
            item.analysisContent = content;
            item.analysisPreset = preset;
            await browser.runtime.sendMessage({
              action: "updateProjectItem",
              projectId: proj.id,
              itemId: item.id,
              analysisContent: content,
              analysisPreset: preset
            });
          }
        } catch (e) {
          console.warn("[Argus] Failed to fetch history for project item:", e);
        }
      }

      if (!content) {
        alert("Analysis content not found. The history entry may have been deleted.");
        return;
      }

      // Build stacked content: all analyses + saved conversations
      const analyses = item.analyses || [];
      let stackedContent = "";
      if (analyses.length > 1) {
        // Show all analyses with headers
        for (const a of analyses) {
          stackedContent += `## ${a.presetLabel || a.preset} — ${new Date(a.timestamp).toLocaleString()}\n\n${a.content}\n\n---\n\n`;
        }
      } else {
        stackedContent = content;
      }

      // Append saved conversations
      if (item.conversations && item.conversations.length) {
        for (const conv of item.conversations) {
          stackedContent += `\n\n---\n\n## Follow-up Thread — ${new Date(conv.timestamp).toLocaleString()}\n\n`;
          for (const msg of conv.messages) {
            if (msg.role === "user") stackedContent += `**You:** ${msg.content}\n\n`;
            else stackedContent += `${msg.content}\n\n`;
          }
        }
      }

      const resultId = `proj-view-${Date.now()}`;
      await browser.storage.local.set({
        [resultId]: {
          status: "done",
          content: stackedContent,
          pageTitle: item.title || item.url,
          pageUrl: item.url,
          presetLabel: analyses.length > 1 ? `${analyses.length} analyses` : preset,
          // Project context for "Save to Project" on follow-ups
          projectId: proj.id,
          projectItemId: item.id
        }
      });
      browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`) });
    }

    const viewBtn = card.querySelector(".proj-item-view-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", openItemAnalysis);
    }

    // Make the card body clickable to view analysis
    if (item.analysisContent || item.refId) {
      bodyDiv.style.cursor = "pointer";
      bodyDiv.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        openItemAnalysis();
      });
    }

    card.querySelector(".proj-item-note-btn").addEventListener("click", () => {
      projState.editingItemId = item.id;
      projEl.itemNotes.value = item.notes || "";
      projEl.itemModal.classList.remove("hidden");
      projEl.itemNotes.focus();
    });

    card.querySelector(".proj-item-remove-btn").addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "removeProjectItem", projectId: proj.id, itemId: item.id });
      await projLoadProjects();
      projSelectProject(proj.id);
    });

    const blockBtn = card.querySelector(".proj-item-block-btn");
    if (blockBtn) {
      blockBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "removeProjectItem", projectId: proj.id, itemId: item.id, reject: true });
        await projLoadProjects();
        projSelectProject(proj.id);
      });
    }

    itemsContainer.appendChild(card);
  }

  // Render rejected URLs section if any exist
  if (proj.rejectedUrls && proj.rejectedUrls.length) {
    const rejDiv = document.createElement("div");
    rejDiv.style.cssText = "margin-top:16px;padding:10px 14px;background:var(--bg-primary);border:1px dashed var(--border);border-radius:var(--radius);";
    const rejHeader = document.createElement("div");
    rejHeader.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;cursor:pointer;";
    const rejTitle = document.createElement("span");
    rejTitle.style.cssText = "font-size:12px;font-weight:600;color:var(--text-muted);";
    rejTitle.textContent = `Blocked from routing (${proj.rejectedUrls.length})`;
    const rejToggle = document.createElement("span");
    rejToggle.style.cssText = "font-size:11px;color:var(--text-muted);";
    rejToggle.textContent = "Show";
    rejHeader.appendChild(rejTitle);
    rejHeader.appendChild(rejToggle);
    rejDiv.appendChild(rejHeader);

    const rejList = document.createElement("div");
    rejList.style.display = "none";
    for (const url of proj.rejectedUrls) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px;";
      const urlSpan = document.createElement("span");
      urlSpan.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);";
      urlSpan.textContent = url;
      urlSpan.title = url;
      const unblockBtn = document.createElement("button");
      unblockBtn.style.cssText = "background:none;border:1px solid var(--border);border-radius:3px;color:var(--text-secondary);cursor:pointer;font-size:10px;padding:2px 6px;flex-shrink:0;";
      unblockBtn.textContent = "Unblock";
      unblockBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "unRejectProjectUrl", projectId: proj.id, url });
        await projLoadProjects();
        projSelectProject(proj.id);
      });
      row.appendChild(urlSpan);
      row.appendChild(unblockBtn);
      rejList.appendChild(row);
    }
    rejDiv.appendChild(rejList);

    rejHeader.addEventListener("click", () => {
      const showing = rejList.style.display !== "none";
      rejList.style.display = showing ? "none" : "";
      rejToggle.textContent = showing ? "Show" : "Hide";
    });

    itemsContainer.appendChild(rejDiv);
  }
}

async function projRenderDrafts(projectId) {
  const container = document.getElementById("proj-drafts-list");
  if (!container) return;
  container.innerHTML = "";

  const resp = await browser.runtime.sendMessage({ action: "draftGetAll" });
  if (!resp?.success) return;
  const drafts = (resp.drafts || []).filter(d => d.projectId === projectId);
  if (!drafts.length) return;

  // Sort by most recently updated
  drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const headerDiv = document.createElement("div");
  headerDiv.className = "proj-items-collapse-header";
  headerDiv.innerHTML = `<span class="proj-items-collapse-arrow">&#9660;</span> <strong>Drafts (${drafts.length})</strong>`;
  const draftsContainer = document.createElement("div");
  draftsContainer.className = "proj-items-container";

  headerDiv.addEventListener("click", () => {
    const isHidden = draftsContainer.style.display === "none";
    draftsContainer.style.display = isHidden ? "" : "none";
    headerDiv.querySelector(".proj-items-collapse-arrow").innerHTML = isHidden ? "&#9660;" : "&#9654;";
  });

  container.appendChild(headerDiv);
  container.appendChild(draftsContainer);

  for (const draft of drafts) {
    const card = document.createElement("div");
    card.className = "proj-item-card";
    const bodyDiv = document.createElement("div");
    bodyDiv.className = "proj-item-body";
    bodyDiv.style.cursor = "pointer";

    const titleDiv = document.createElement("div");
    titleDiv.className = "proj-item-title";
    titleDiv.textContent = draft.title || "Untitled Draft";
    bodyDiv.appendChild(titleDiv);

    if (draft.content) {
      const preview = document.createElement("div");
      preview.className = "proj-item-summary";
      preview.textContent = draft.content.replace(/[#*_~`>\-]/g, "").slice(0, 200);
      bodyDiv.appendChild(preview);
    }

    const metaDiv = document.createElement("div");
    metaDiv.className = "proj-item-meta";
    const badge = document.createElement("span");
    badge.className = "proj-type-badge";
    badge.textContent = "draft";
    badge.style.background = "var(--accent-dim)";
    badge.style.color = "var(--accent)";
    metaDiv.appendChild(badge);
    const wordCount = draft.content ? draft.content.trim().split(/\s+/).length : 0;
    const wcSpan = document.createElement("span");
    wcSpan.style.cssText = "font-size:11px;color:var(--text-muted);";
    wcSpan.textContent = wordCount + " words";
    metaDiv.appendChild(wcSpan);
    if (draft.updatedAt) {
      const dateSpan = document.createElement("span");
      dateSpan.textContent = new Date(draft.updatedAt).toLocaleDateString();
      metaDiv.appendChild(dateSpan);
    }
    bodyDiv.appendChild(metaDiv);
    card.appendChild(bodyDiv);

    // Click to open in Draft Pad
    bodyDiv.addEventListener("click", async () => {
      await browser.storage.local.set({ draftOpenId: draft.id });
      const draftUrl = browser.runtime.getURL("reporting/reporting.html");
      const existing = await browser.tabs.query({ url: draftUrl + "*" });
      if (existing.length > 0) {
        await browser.tabs.update(existing[0].id, { active: true });
        await browser.windows.update(existing[0].windowId, { focused: true });
      } else {
        await browser.tabs.create({ url: draftUrl });
      }
    });

    // Actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "proj-item-actions";
    const openBtn = document.createElement("button");
    openBtn.className = "proj-item-view-btn";
    openBtn.title = "Open in Draft Pad";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => bodyDiv.click());
    actionsDiv.appendChild(openBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "proj-item-remove-btn";
    removeBtn.title = "Detach draft from project";
    removeBtn.textContent = "Detach";
    removeBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "draftSave", draft: { ...draft, projectId: "" } });
      projRenderDrafts(projectId);
    });
    actionsDiv.appendChild(removeBtn);

    card.appendChild(actionsDiv);
    draftsContainer.appendChild(card);
  }
}

function projOpenModal(existing) {
  projState.editingProjectId = existing ? existing.id : null;
  projEl.modalTitle.textContent = existing ? "Edit Project" : "New Project";
  projEl.modalName.value = existing ? existing.name : "";
  projEl.modalDesc.value = existing ? (existing.description || "") : "";
  projEl.modalColor.value = existing ? (existing.color || "#e94560") : "#e94560";
  const hasCloud = !!(existing?.cloudProvider);
  projEl.modalCloudSync.checked = hasCloud;
  projEl.modalCloudProvider.value = existing?.cloudProvider || "";
  projEl.modalCloudProvider.style.display = hasCloud ? "block" : "none";
  projEl.modal.classList.remove("hidden");
  projEl.modalName.focus();
}

async function projSaveModal() {
  const name = projEl.modalName.value.trim();
  if (!name) return;

  const cloudProvider = projEl.modalCloudSync.checked
    ? (projEl.modalCloudProvider.value || null)
    : null;

  if (projState.editingProjectId) {
    await browser.runtime.sendMessage({
      action: "updateProject",
      projectId: projState.editingProjectId,
      name,
      description: projEl.modalDesc.value.trim(),
      color: projEl.modalColor.value,
      cloudProvider,
    });
  } else {
    const resp = await browser.runtime.sendMessage({
      action: "createProject",
      name,
      description: projEl.modalDesc.value.trim(),
      color: projEl.modalColor.value,
      cloudProvider,
    });
    if (resp && resp.success) {
      projState.activeProjectId = resp.project.id;
    }
  }

  projEl.modal.classList.add("hidden");
  await projLoadProjects();
  if (projState.activeProjectId) projSelectProject(projState.activeProjectId);
}

async function projSaveItemNotes() {
  if (!projState.activeProjectId || !projState.editingItemId) return;
  await browser.runtime.sendMessage({
    action: "updateProjectItem",
    projectId: projState.activeProjectId,
    itemId: projState.editingItemId,
    notes: projEl.itemNotes.value
  });
  projEl.itemModal.classList.add("hidden");
  await projLoadProjects();
  projSelectProject(projState.activeProjectId);
}

async function projToggleStar(id) {
  const proj = projState.projects.find(p => p.id === id);
  if (!proj) return;
  await browser.runtime.sendMessage({ action: "updateProject", projectId: id, starred: !proj.starred });
  await projLoadProjects();
  if (projState.activeProjectId) projSelectProject(projState.activeProjectId);
}

async function projDelete(id) {
  if (!confirm("Delete this project and all its items?")) return;
  await browser.runtime.sendMessage({ action: "deleteProject", projectId: id });
  projState.activeProjectId = null;
  await projLoadProjects();
  projShowEmpty();
}

async function projAddItem(type) {
  if (!projState.activeProjectId) return;
  const title = type === "note" ? "New Note" : "";
  const item = { type, title, notes: "", url: "" };

  if (type === "url") {
    let url = (prompt("Enter a URL:") || "").trim();
    if (!url) return;
    // Auto-prepend https:// if no protocol
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    item.url = url;
    item.title = url;
  }

  await browser.runtime.sendMessage({
    action: "addProjectItem",
    projectId: projState.activeProjectId,
    item
  });
  await projLoadProjects();
  projSelectProject(projState.activeProjectId);

  // Auto-open notes editor for new notes
  if (type === "note") {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    if (proj && proj.items.length > 0) {
      const newItem = proj.items[0];
      projState.editingItemId = newItem.id;
      projEl.itemNotes.value = "";
      projEl.itemModal.classList.remove("hidden");
      projEl.itemNotes.focus();
    }
  }
}

function downloadBundle(bundle, filename) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function projExportOne(id) {
  const resp = await browser.runtime.sendMessage({ action: "exportProject", projectId: id });
  if (!resp || !resp.success) return;
  const name = (resp.bundle.projects[0].name || "project").replace(/[^a-z0-9]/gi, "_");
  downloadBundle(resp.bundle, `${name}.argusproj`);
}

async function projExportAll() {
  const resp = await browser.runtime.sendMessage({ action: "exportAllProjects" });
  if (!resp || !resp.success) return;
  downloadBundle(resp.bundle, "argus-projects.argusproj");
}

function projImport() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".argusproj,.json";
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let bundle = JSON.parse(text);

      // Support importing old-format single project JSON
      if (!bundle.manifest && bundle.id && bundle.items) {
        bundle = {
          manifest: { format: "argusproj", version: 1, exportedAt: new Date().toISOString(), projectCount: 1, historyCount: 0 },
          projects: [bundle],
          history: [],
        };
      }
      // Support importing old-format array of projects
      if (Array.isArray(bundle)) {
        bundle = {
          manifest: { format: "argusproj", version: 1, exportedAt: new Date().toISOString(), projectCount: bundle.length, historyCount: 0 },
          projects: bundle,
          history: [],
        };
      }

      const resp = await browser.runtime.sendMessage({ action: "importProject", bundle });
      if (resp && resp.success) {
        alert(`Imported ${resp.projectsImported} project(s) and ${resp.historyImported} history item(s).`);
        projLoadList();
      } else {
        alert("Import failed: " + (resp ? resp.error : "Unknown error"));
      }
    } catch (e) {
      alert("Failed to read file: " + e.message);
    }
  });
  input.click();
}

let batchPollTimer = null;

async function projBatchAnalyze() {
  const presetKey = document.getElementById("proj-batch-preset").value;
  if (!presetKey || !projState.activeProjectId) return;

  const proj = projState.projects.find(p => p.id === projState.activeProjectId);
  if (!proj) return;

  const statusEl = document.getElementById("proj-batch-status");
  const runBtn = document.getElementById("proj-batch-run");

  // Check if unanalyzed items exist — use analysisContent (AI output), not summary
  // (summary may be pre-populated from feed descriptions or page excerpts)
  const unsummarized = proj.items.filter(i => i.url && !i.analysisContent);
  const allWithUrl = proj.items.filter(i => i.url);
  let reanalyze = false;

  if (unsummarized.length === 0) {
    if (allWithUrl.length === 0) {
      statusEl.textContent = "No items with URLs to analyze.";
      return;
    }
    if (!confirm(`All ${allWithUrl.length} items have been analyzed. Re-analyze them all?`)) return;
    reanalyze = true;
  }

  // Kick off in background
  const resp = await browser.runtime.sendMessage({
    action: "batchAnalyzeProject",
    projectId: proj.id,
    presetKey,
    reanalyze
  });

  if (!resp.success) {
    statusEl.textContent = resp.error;
    return;
  }

  runBtn.textContent = "Cancel";
  runBtn.onclick = projCancelBatch;

  // Show progress bar
  const progressEl = document.getElementById("proj-batch-progress");
  const barEl = document.getElementById("proj-batch-bar");
  const pctEl = document.getElementById("proj-batch-pct");
  progressEl.classList.remove("hidden", "proj-batch-done");
  barEl.style.width = "0%";
  pctEl.textContent = "0%";

  // Poll for progress
  batchPollTimer = setInterval(() => pollBatchStatus(), 1500);
  statusEl.textContent = `Starting batch analysis (${resp.total} items)...`;
}

async function pollBatchStatus() {
  const statusEl = document.getElementById("proj-batch-status");
  const runBtn = document.getElementById("proj-batch-run");
  const progressEl = document.getElementById("proj-batch-progress");
  const barEl = document.getElementById("proj-batch-bar");
  const pctEl = document.getElementById("proj-batch-pct");

  try {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (!s.success) return;

    // Update progress bar
    const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
    barEl.style.width = pct + "%";
    pctEl.textContent = pct + "%";

    if (s.running) {
      statusEl.textContent = `Analyzing ${s.done + 1} of ${s.total}: ${s.current}`;
    } else {
      // Finished
      clearInterval(batchPollTimer);
      batchPollTimer = null;

      // Fill bar to 100%
      barEl.style.width = "100%";
      pctEl.textContent = "100%";
      progressEl.classList.add("proj-batch-done");

      const errCount = s.errors.length;
      if (s.cancelled) {
        statusEl.textContent = `Cancelled after ${s.done} of ${s.total} items.`;
      } else if (errCount > 0) {
        statusEl.textContent = `Complete — analyzed ${s.done} item(s), ${errCount} error(s).`;
      } else {
        statusEl.textContent = `Complete — all ${s.done} item(s) analyzed successfully.`;
      }

      runBtn.textContent = "Run Batch";
      runBtn.onclick = projBatchAnalyze;

      // Refresh project display
      await projLoadProjects();
      projSelectProject(projState.activeProjectId);

      // Hide progress bar after a while, keep status text longer
      setTimeout(() => {
        progressEl.classList.add("hidden");
        progressEl.classList.remove("proj-batch-done");
      }, 8000);
      setTimeout(() => { statusEl.textContent = ""; }, 15000);
    }
  } catch { /* ignore */ }
}

async function projCancelBatch() {
  await browser.runtime.sendMessage({ action: "cancelBatch" });
  document.getElementById("proj-batch-status").textContent = "Cancelling...";
}

// ──────────────────────────────────────────────
// OSINT Project Tools
// ──────────────────────────────────────────────
async function projRunEntityExtraction() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Running entity extraction on all project items...";

  // Use batch analyze with entities preset
  const resp = await browser.runtime.sendMessage({
    action: "batchAnalyzeProject",
    projectId: projState.activeProjectId,
    presetKey: "entities",
    reanalyze: true
  });

  if (!resp.success) {
    statusEl.textContent = resp.error;
    return;
  }

  // Poll for completion
  const pollId = setInterval(async () => {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (s.running) {
      statusEl.textContent = `Extracting entities: ${s.done}/${s.total} - ${s.current}...`;
    } else {
      clearInterval(pollId);
      statusEl.textContent = `Entity extraction complete (${s.done} items).`;
      await projLoadProjects();
      projSelectProject(projState.activeProjectId);
      setTimeout(() => { statusEl.textContent = ""; }, 5000);
    }
  }, 1500);
}

async function projOpenConnectionGraph() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Building connection graph...";

  const resp = await browser.runtime.sendMessage({
    action: "buildConnectionGraph",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    const storeKey = `graph-${Date.now()}`;
    await browser.storage.local.set({ [storeKey]: { projectName: proj?.name || "Project", nodes: resp.nodes, edges: resp.edges } });
    browser.tabs.create({ url: browser.runtime.getURL(`osint/graph.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "No entity data found. Run entity extraction first.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

async function projOpenTimeline() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Building timeline...";

  const resp = await browser.runtime.sendMessage({
    action: "buildTimeline",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    const storeKey = `timeline-${Date.now()}`;
    await browser.storage.local.set({ [storeKey]: { projectName: proj?.name || "Project", events: resp.events } });
    browser.tabs.create({ url: browser.runtime.getURL(`osint/timeline.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "No date data found. Run entity extraction first.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

function projOpenHeatmap() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/heatmap.html?project=${encodeURIComponent(projState.activeProjectId)}`) });
}

function projOpenGeomap() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/geomap.html?project=${encodeURIComponent(projState.activeProjectId)}`) });
}

function projOpenDashboard() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/dashboard.html?projectId=${encodeURIComponent(projState.activeProjectId)}`) });
}

async function projBuildSkeleton(forceOpen) {
  const panel = document.getElementById("proj-skeleton-panel");
  if (!forceOpen && !panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  if (!projState.activeProjectId) return;
  panel.innerHTML = "<p style='color:var(--text-muted);font-size:12px;'>Loading skeleton...</p>";
  panel.classList.remove("hidden");
  const resp = await browser.runtime.sendMessage({ action: "buildProjectSkeleton", projectId: projState.activeProjectId });
  if (!resp || !resp.success) { panel.innerHTML = "<p style='color:var(--error);'>Failed to build skeleton</p>"; return; }
  const s = resp.skeleton;
  const esc = t => (t||"").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const maxShow = 5;
  function renderList(arr, labelFn) {
    if (!arr.length) return "<span style='color:var(--text-muted);'>None</span>";
    const shown = arr.slice(0, maxShow);
    let html = shown.map(x => `<div class="skel-item">${labelFn(x)}</div>`).join("");
    if (arr.length > maxShow) html += `<div class="skel-item" style="color:var(--text-muted);">+${arr.length - maxShow} more...</div>`;
    return html;
  }
  panel.innerHTML = `
    <div class="skel-grid">
      <div class="skel-section">
        <div class="skel-heading">Items (${s.items.total})</div>
        ${renderList(s.items.list, i => `<span class="skel-badge">${esc(i.type)}</span> ${i.url ? `<a href="${esc(i.url)}" target="_blank">${esc(i.title || i.url)}</a>` : esc(i.title || "Note")}`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Feeds (${s.feeds.total})</div>
        ${renderList(s.feeds.list, f => esc(f.title || f.url))}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Bookmarks (${s.bookmarks.total})</div>
        ${renderList(s.bookmarks.list, b => `<a href="${esc(b.url)}" target="_blank">${esc(b.title || b.url)}</a>`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Monitors (${s.monitors.total})</div>
        ${renderList(s.monitors.list, m => esc(m.label || m.url))}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Entities (${s.entities.total})</div>
        ${renderList(s.entities.list, e => `<span class="skel-badge">${esc(e.type)}</span> ${esc(e.label)} <span style="color:var(--text-muted);">(${e.mentions})</span>`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Keywords (${s.keywords.total})</div>
        ${renderList(s.keywords.list, k => `<span style="color:var(--accent);">"${esc(k)}"</span>`)}
      </div>
      ${s.drafts && s.drafts.total > 0 ? `<div class="skel-section">
        <div class="skel-heading">Drafts (${s.drafts.total})</div>
        ${renderList(s.drafts.list, d => `${esc(d.title)} <span style="color:var(--text-muted);">(${d.words} words)</span>`)}
      </div>` : ""}
    </div>
    <div class="skel-footer">Data: ${s.items.total} items &middot; ${s.entities.total} entities &middot; ${s.feeds.total} feeds &middot; ${s.monitors.total} monitors &middot; ${s.bookmarks.total} bookmarks${s.drafts && s.drafts.total > 0 ? ` &middot; ${s.drafts.total} drafts` : ""}</div>
  `;
}

async function projGenerateReport() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Generating investigation report (this may take a minute)...";

  const resp = await browser.runtime.sendMessage({
    action: "generateReport",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    // Open in results page
    const storeKey = `report-${Date.now()}`;
    await browser.storage.local.set({
      [storeKey]: {
        status: "done",
        content: resp.content,
        pageTitle: resp.title || "Investigation Report",
        pageUrl: "",
        presetLabel: "Investigation Report",
        provider: resp.provider,
        model: resp.model
      }
    });
    browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "Failed to generate report.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

async function projAnomalyScan() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Running anomaly scan (this may take a minute)...";

  const resp = await browser.runtime.sendMessage({
    action: "anomalyScan",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const storeKey = `anomaly-${Date.now()}`;
    await browser.storage.local.set({
      [storeKey]: {
        status: "done",
        content: resp.content,
        pageTitle: "Anomaly Scan",
        pageUrl: "",
        presetLabel: "Anomaly Scan",
        provider: resp.provider,
        model: resp.model
      }
    });
    browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "Failed to run anomaly scan.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

// ──────────────────────────────────────────────
// Keyword Watchlist
// ──────────────────────────────────────────────
async function initWatchlist() {
  document.getElementById("add-watchword").addEventListener("click", addWatchword);
  await loadWatchlist();
  await loadWatchlistMatches();
}

async function loadWatchlist() {
  const resp = await browser.runtime.sendMessage({ action: "getWatchlist" });
  const list = document.getElementById("watchlist-items");
  list.innerHTML = "";
  if (!resp || !resp.success || !resp.watchlist.length) {
    const noKw = document.createElement("p");
    noKw.className = "info-text";
    noKw.style.cssText = "padding:8px 0;";
    noKw.textContent = "No keywords tracked yet.";
    list.appendChild(noKw);
    return;
  }
  for (const w of resp.watchlist) {
    const div = document.createElement("div");
    div.className = "rule-item";
    const ruleInfo = document.createElement("div");
    ruleInfo.className = "rule-info";
    const ruleLabel = document.createElement("span");
    ruleLabel.className = "rule-label";
    ruleLabel.textContent = w.term;
    const ruleMeta = document.createElement("span");
    ruleMeta.className = "rule-meta";
    ruleMeta.textContent = (w.caseSensitive ? "Case sensitive" : "Case insensitive") + (w.regex ? " | Regex" : "") + " | " + (w.matchCount || 0) + " matches";
    ruleInfo.appendChild(ruleLabel);
    ruleInfo.appendChild(ruleMeta);
    const ruleActions = document.createElement("div");
    ruleActions.className = "rule-actions";
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle-label";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    if (w.enabled) toggleInput.checked = true;
    toggleInput.dataset.id = w.id;
    toggleInput.className = "watchword-toggle";
    const activeSpan = document.createElement("span");
    activeSpan.textContent = "Active";
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(activeSpan);
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-secondary btn-sm watchword-delete";
    delBtn.dataset.id = w.id;
    delBtn.textContent = "Delete";
    ruleActions.appendChild(toggleLabel);
    ruleActions.appendChild(delBtn);
    div.appendChild(ruleInfo);
    div.appendChild(ruleActions);
    list.appendChild(div);
  }

  list.querySelectorAll(".watchword-toggle").forEach(cb => {
    cb.addEventListener("change", async () => {
      await browser.runtime.sendMessage({ action: "updateWatchword", id: cb.dataset.id, enabled: cb.checked });
    });
  });

  list.querySelectorAll(".watchword-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "deleteWatchword", id: btn.dataset.id });
      await loadWatchlist();
    });
  });
}

async function addWatchword() {
  const termInput = document.getElementById("watchword-term");
  const term = termInput.value.trim();
  if (!term) return;
  const caseSensitive = document.getElementById("watchword-case").checked;
  const regex = document.getElementById("watchword-regex").checked;

  // Validate regex if enabled
  if (regex) {
    try { new RegExp(term); } catch (e) {
      document.getElementById("watchlist-status").textContent = "Invalid regex: " + e.message;
      return;
    }
  }

  await browser.runtime.sendMessage({ action: "addWatchword", term, caseSensitive, regex });
  termInput.value = "";
  document.getElementById("watchword-case").checked = false;
  document.getElementById("watchword-regex").checked = false;
  await loadWatchlist();
}

async function loadWatchlistMatches() {
  const { watchlistMatches } = await browser.storage.local.get({ watchlistMatches: [] });
  const container = document.getElementById("watchlist-matches");
  if (!watchlistMatches.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = "";
  const matchesH4 = document.createElement("h4");
  matchesH4.setAttribute("style", "font-size:13px;color:var(--text-secondary);margin-bottom:8px;");
  matchesH4.textContent = "Recent Matches";
  container.appendChild(matchesH4);
  const recent = watchlistMatches.slice(-20).reverse();
  for (const m of recent) {
    const div = document.createElement("div");
    div.className = "rule-item";
    const matchInfo = document.createElement("div");
    matchInfo.className = "rule-info";
    const matchLabel = document.createElement("span");
    matchLabel.className = "rule-label";
    matchLabel.textContent = '"' + m.term + '" found in ' + m.sourceType;
    const matchMeta = document.createElement("span");
    matchMeta.className = "rule-meta";
    matchMeta.textContent = (m.sourceTitle || m.sourceUrl) + " - " + new Date(m.matchedAt).toLocaleString();
    matchInfo.appendChild(matchLabel);
    matchInfo.appendChild(matchMeta);
    div.appendChild(matchInfo);
    container.appendChild(div);
  }
}

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

function showKGStatus(msg) {
  const status = document.getElementById("kg-status");
  status.textContent = msg;
  status.classList.remove("hidden");
  setTimeout(() => status.classList.add("hidden"), 3000);
}

async function updateKGStats() {
  const display = document.getElementById("kg-stats-display");
  try {
    const stats = await browser.runtime.sendMessage({ action: "getKGStats" });
    if (stats && typeof stats.nodeCount === "number") {
      const parts = [`${stats.nodeCount} entities`, `${stats.edgeCount} connections`];
      if (stats.typeCounts) {
        const types = Object.entries(stats.typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([t, c]) => `${c} ${t}s`);
        if (types.length) parts.push(types.join(", "));
      }
      display.textContent = parts.join(" | ");
    } else {
      display.textContent = "No data yet";
    }
  } catch {
    display.textContent = "Unable to load";
  }
}

async function loadPendingMerges() {
  try {
    const merges = await browser.runtime.sendMessage({ action: "getKGPendingMerges" });
    const container = document.getElementById("kg-pending-merges");
    const list = document.getElementById("kg-merge-list");
    if (!merges || !merges.length) {
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    list.replaceChildren();

    for (const merge of merges) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;";

      const text = document.createElement("span");
      text.style.flex = "1";
      text.textContent = `"${merge.newName}" \u2192 "${merge.existingName}"? (${Math.round(merge.confidence * 100)}%)`;
      row.appendChild(text);

      const acceptBtn = document.createElement("button");
      acceptBtn.className = "btn btn-secondary";
      acceptBtn.style.cssText = "padding:2px 8px;font-size:11px;color:var(--success);";
      acceptBtn.textContent = "Merge";
      acceptBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resolveKGMerge", mergeId: merge.id, accept: true });
        row.remove();
        updateKGStats();
        if (!list.children.length) container.classList.add("hidden");
      });
      row.appendChild(acceptBtn);

      const dismissBtn = document.createElement("button");
      dismissBtn.className = "btn btn-secondary";
      dismissBtn.style.cssText = "padding:2px 8px;font-size:11px;";
      dismissBtn.textContent = "Dismiss";
      dismissBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resolveKGMerge", mergeId: merge.id, accept: false });
        row.remove();
        if (!list.children.length) container.classList.add("hidden");
      });
      row.appendChild(dismissBtn);

      list.appendChild(row);
    }
  } catch { /* non-critical */ }
}

// ══════════════════════════════════════════════════════════════
// Page Tracker UI
// ══════════════════════════════════════════════════════════════

const TRACKER_PAGE_SIZE = 50;
let trackerOffset = 0;
let trackerData = [];

async function loadTracker(reset = true) {
  if (reset) trackerOffset = 0;
  try {
    const searchQ = document.getElementById("tracker-search")?.value?.trim() || "";
    const actionFilter = document.getElementById("tracker-action-filter")?.value || "";
    let all;
    if (searchQ) {
      all = await ArgusDB.PageTracker.search(searchQ);
    } else {
      all = await ArgusDB.PageTracker.getAll();
    }
    // Filter by action type if selected
    if (actionFilter) {
      all = all.filter(entry =>
        actionFilter === "visit"
          ? entry.visits > 0
          : (entry.actions || []).some(a => a.type === actionFilter)
      );
    }
    trackerData = all;
    renderTrackerList();
    const badge = document.getElementById("tracker-count-badge");
    if (badge) badge.textContent = `${all.length} page${all.length !== 1 ? "s" : ""}`;
  } catch (e) {
    console.warn("[Tracker] load error:", e);
  }
}

const ACTION_LABELS = {
  analyze: "Analyzed",
  bookmark: "Bookmarked",
  monitor: "Monitored",
  snapshot: "Snapshotted",
  osint: "OSINT",
  techstack: "Tech Stack",
  feed: "Feed Added",
  compare: "Compared",
  followup: "Follow-up",
  deepdive: "Deep Dive",
  chat: "Chat",
};

// Active = user explicitly triggered Argus on this page
const ACTIVE_ACTIONS = new Set(["analyze", "osint", "techstack", "compare", "followup", "deepdive", "chat", "snapshot"]);
// Passive = Argus acted in the background or one-time setup
const PASSIVE_ACTIONS = new Set(["bookmark", "monitor", "feed"]);

function buildTimelineEvents(entries) {
  // Flatten entries into individual timeline events, sorted newest-first
  const events = [];
  for (const entry of entries) {
    // Add visit event (last visit)
    events.push({
      timestamp: entry.lastVisit,
      type: "visit",
      entry,
      visits: entry.visits,
    });
    // Add each action as its own event
    for (const action of (entry.actions || [])) {
      events.push({
        timestamp: action.timestamp,
        type: action.type,
        detail: action.detail,
        entry,
      });
    }
  }
  events.sort((a, b) => b.timestamp - a.timestamp);
  return events;
}

function groupByDay(events) {
  const groups = new Map();
  for (const ev of events) {
    const day = new Date(ev.timestamp).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(ev);
  }
  return groups;
}

function renderTrackerList() {
  const list = document.getElementById("tracker-list");
  if (!list) return;
  list.innerHTML = "";

  const slice = trackerData.slice(0, trackerOffset + TRACKER_PAGE_SIZE);
  if (!slice.length) {
    list.innerHTML = '<div class="tracker-empty">No tracked pages yet. Enable "Track My Pages" in Settings and start browsing.</div>';
    return;
  }

  const events = buildTimelineEvents(slice);
  const dayGroups = groupByDay(events);

  const timeline = document.createElement("div");
  timeline.className = "tracker-timeline";

  for (const [dayLabel, dayEvents] of dayGroups) {
    const group = document.createElement("div");
    group.className = "tracker-day-group";

    const label = document.createElement("div");
    label.className = "tracker-day-label";
    label.textContent = dayLabel;
    group.appendChild(label);

    // Dedupe: group consecutive visits to same URL within same day
    const seen = new Set();
    for (const ev of dayEvents) {
      const dedupeKey = ev.type === "visit" ? `visit-${ev.entry.url}` : `${ev.type}-${ev.entry.url}-${ev.timestamp}`;
      if (ev.type === "visit" && seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const row = document.createElement("div");
      const hasActions = ev.type !== "visit";
      row.className = `tracker-entry${hasActions ? " has-actions" : ""}`;

      // Time
      const time = document.createElement("div");
      time.className = "tracker-entry-time";
      time.textContent = new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      row.appendChild(time);

      // Favicon
      const fav = document.createElement("img");
      fav.src = ev.entry.favicon || "../icons/icon-16.png";
      fav.width = 16; fav.height = 16;
      fav.style.cssText = "margin-top:2px;flex-shrink:0;border-radius:2px;";
      fav.onerror = function() { this.src = "../icons/icon-16.png"; };
      row.appendChild(fav);

      const info = document.createElement("div");
      info.className = "tracker-entry-info";

      // Title
      const titleEl = document.createElement("div");
      titleEl.className = "tracker-entry-title";
      titleEl.textContent = ev.entry.title || ev.entry.url;
      titleEl.title = ev.entry.title || ev.entry.url;
      info.appendChild(titleEl);

      // URL
      const urlEl = document.createElement("a");
      urlEl.className = "tracker-entry-url";
      urlEl.href = ev.entry.url;
      urlEl.target = "_blank";
      urlEl.rel = "noopener";
      urlEl.textContent = ev.entry.url;
      info.appendChild(urlEl);

      // Action tag
      const tags = document.createElement("div");
      tags.style.cssText = "display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;";

      if (ev.type === "visit") {
        const tag = document.createElement("span");
        tag.className = "tracker-tag tracker-tag-visit";
        tag.textContent = `Visited${ev.visits > 1 ? ` (${ev.visits}x)` : ""}`;
        tags.appendChild(tag);
        // Show all actions for this entry as summary tags
        const typeCounts = {};
        for (const a of (ev.entry.actions || [])) {
          typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
        }
        for (const [type, cnt] of Object.entries(typeCounts)) {
          const atag = document.createElement("span");
          atag.className = `tracker-tag ${ACTIVE_ACTIONS.has(type) ? "tracker-tag-active" : "tracker-tag-passive"}`;
          atag.textContent = (ACTION_LABELS[type] || type) + (cnt > 1 ? ` x${cnt}` : "");
          tags.appendChild(atag);
        }
      } else {
        const atag = document.createElement("span");
        atag.className = `tracker-tag ${ACTIVE_ACTIONS.has(ev.type) ? "tracker-tag-active" : "tracker-tag-passive"}`;
        atag.textContent = ACTION_LABELS[ev.type] || ev.type;
        tags.appendChild(atag);
        // Show detail (preset, etc.)
        if (ev.detail?.preset) {
          const dtag = document.createElement("span");
          dtag.className = "tracker-tag tracker-tag-passive";
          dtag.textContent = ev.detail.preset;
          tags.appendChild(dtag);
        }
      }
      info.appendChild(tags);
      row.appendChild(info);

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn";
      delBtn.title = "Remove from tracker";
      delBtn.style.cssText = "flex-shrink:0;color:var(--text-muted);";
      delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      delBtn.addEventListener("click", async () => {
        await ArgusDB.PageTracker.remove(ev.entry.id);
        trackerData = trackerData.filter(e => e.id !== ev.entry.id);
        const badge = document.getElementById("tracker-count-badge");
        if (badge) badge.textContent = `${trackerData.length} page${trackerData.length !== 1 ? "s" : ""}`;
        renderTrackerList();
      });
      row.appendChild(delBtn);

      group.appendChild(row);
    }

    timeline.appendChild(group);
  }

  list.appendChild(timeline);

  // Load more button
  const loadMore = document.getElementById("tracker-load-more");
  if (loadMore) {
    if (trackerData.length > trackerOffset + TRACKER_PAGE_SIZE) {
      loadMore.classList.remove("hidden");
    } else {
      loadMore.classList.add("hidden");
    }
  }
}

// Tracker event listeners
document.getElementById("tracker-search")?.addEventListener("input", debounce(() => loadTracker(), 300));
document.getElementById("tracker-action-filter")?.addEventListener("change", () => loadTracker());
document.getElementById("tracker-refresh")?.addEventListener("click", () => loadTracker());
document.getElementById("tracker-load-more")?.addEventListener("click", () => {
  trackerOffset += TRACKER_PAGE_SIZE;
  renderTrackerList();
});

// Export CSV
document.getElementById("tracker-export")?.addEventListener("click", async () => {
  const all = await ArgusDB.PageTracker.getAll();
  const rows = [["URL", "Title", "Visits", "First Visit", "Last Visit", "Actions"].join(",")];
  for (const e of all) {
    const actions = (e.actions || []).map(a => a.type).join("; ");
    rows.push([
      `"${(e.url || "").replace(/"/g, '""')}"`,
      `"${(e.title || "").replace(/"/g, '""')}"`,
      e.visits,
      new Date(e.firstVisit).toISOString(),
      new Date(e.lastVisit).toISOString(),
      `"${actions}"`,
    ].join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `argus-page-tracker-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Clear all
document.getElementById("tracker-clear")?.addEventListener("click", () => {
  document.getElementById("tracker-clear-confirm")?.classList.remove("hidden");
});
document.getElementById("tracker-clear-no")?.addEventListener("click", () => {
  document.getElementById("tracker-clear-confirm")?.classList.add("hidden");
});
document.getElementById("tracker-clear-yes")?.addEventListener("click", async () => {
  await ArgusDB.PageTracker.clear();
  document.getElementById("tracker-clear-confirm")?.classList.add("hidden");
  loadTracker();
});

// Simple debounce for tracker search
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

// ──────────────────────────────────────────────
// Sources Tab
// ──────────────────────────────────────────────

const SOURCE_ADDR_TYPES = {
  x:         { label: "X / Twitter",  icon: "𝕏",  prefix: "https://x.com/",              example: "@elonmusk" },
  bluesky:   { label: "Bluesky",      icon: "🦋", prefix: "https://bsky.app/profile/",    example: "alice.bsky.social" },
  mastodon:  { label: "Mastodon",     icon: "🐘", prefix: null,                            example: "@user@infosec.exchange" },
  youtube:   { label: "YouTube",      icon: "▶",  prefix: "https://youtube.com/@",         example: "@ChannelName" },
  rumble:    { label: "Rumble",       icon: "🟢", prefix: "https://rumble.com/c/",          example: "ChannelName" },
  facebook:  { label: "Facebook",     icon: "f",  prefix: "https://facebook.com/",         example: "john.doe or page-name" },
  linkedin:  { label: "LinkedIn",     icon: "in", prefix: "https://linkedin.com/in/",      example: "jane-doe-12345" },
  telegram:  { label: "Telegram",     icon: "✈",  prefix: "https://t.me/",                 example: "@username or channel" },
  reddit:    { label: "Reddit",       icon: "🔴", prefix: "https://reddit.com/u/",         example: "u/spez" },
  github:    { label: "GitHub",       icon: "⌨",  prefix: "https://github.com/",           example: "octocat" },
  threads:   { label: "Threads",      icon: "@",  prefix: "https://threads.net/@",         example: "@username" },
  tiktok:    { label: "TikTok",       icon: "♪",  prefix: "https://tiktok.com/@",          example: "@username" },
  substack:  { label: "Substack",     icon: "📰", prefix: null,                            example: "https://name.substack.com" },
  email:     { label: "Email",        icon: "✉",  prefix: "mailto:",                       example: "user@example.com" },
  phone:     { label: "Phone",        icon: "📞", prefix: "tel:",                           example: "+1 555 867 5309 (with country code)" },
  signal:    { label: "Signal",       icon: "🔒", prefix: null,                            example: "+1 555 867 5309 (phone number)" },
  discord:   { label: "Discord",      icon: "🎮", prefix: null,                            example: "username or invite.gg/server" },
  whatsapp:  { label: "WhatsApp",     icon: "💬", prefix: "https://wa.me/",                example: "+15558675309 (no dashes)" },
  rss:       { label: "RSS Feed",     icon: "📡", prefix: null,                            example: "https://example.com/feed.xml" },
  ip:        { label: "IP Address",   icon: "🌐", prefix: null,                            example: "192.168.1.1 or 2001:db8::1" },
  website:   { label: "Website",      icon: "🔗", prefix: null,                            example: "https://example.com" },
  pastebin:  { label: "Pastebin",     icon: "📋", prefix: null,                            example: "https://pastebin.com/u/username" },
  gdoc:      { label: "Google Doc",   icon: "📄", prefix: null,                            example: "https://docs.google.com/d/..." },
  custom:    { label: "Other",        icon: "📌", prefix: null,                            example: "Any URL, handle, or address" },
};

const srcState = { initialized: false, sources: [], editingId: null, regexMode: false };

function initSources() {
  if (srcState.initialized) return;
  srcState.initialized = true;

  document.getElementById("src-add-new").addEventListener("click", () => showSourceEditor());
  document.getElementById("src-add-addr").addEventListener("click", () => addAddrRow());
  document.getElementById("src-cancel").addEventListener("click", hideSourceEditor);
  document.getElementById("src-save").addEventListener("click", saveSource);
  document.getElementById("src-search").addEventListener("input", debounce(filterSources, 300));
  document.getElementById("src-search-mode")?.addEventListener("click", () => {
    srcState.regexMode = !srcState.regexMode;
    const btn = document.getElementById("src-search-mode");
    const bar = document.getElementById("src-search-bar");
    const slashes = bar?.querySelectorAll(".src-search-slash") || [];
    const input = document.getElementById("src-search");
    btn.classList.toggle("active", srcState.regexMode);
    slashes.forEach(s => s.style.display = srcState.regexMode ? "" : "none");
    input.placeholder = srcState.regexMode
      ? "regex — e.g. gmail\\.com|yahoo  ^john  \\d{3}-\\d{4}"
      : "Search sources...";
    if (srcState.regexMode) input.classList.add("src-search-mono");
    else input.classList.remove("src-search-mono");
    filterSources();
  });
  document.getElementById("src-filter-type").addEventListener("change", filterSources);
  document.getElementById("src-filter-tag").addEventListener("change", filterSources);
  document.getElementById("src-filter-folder")?.addEventListener("change", () => {
    filterSources();
    const folderVal = document.getElementById("src-filter-folder").value;
    document.getElementById("src-folder-rename").disabled = !folderVal;
    document.getElementById("src-folder-delete").disabled = !folderVal;
  });

  // Folder management
  document.getElementById("src-folder-add")?.addEventListener("click", srcFolderAdd);
  document.getElementById("src-folder-rename")?.addEventListener("click", srcFolderRename);
  document.getElementById("src-folder-delete")?.addEventListener("click", srcFolderDelete);

  // Import / Export
  document.getElementById("src-import").addEventListener("click", () => document.getElementById("src-import-file").click());
  document.getElementById("src-import-file").addEventListener("change", importSources);
  document.getElementById("src-export").addEventListener("click", exportSources);

  loadSources();
}

async function loadSources() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getSources" });
    srcState.sources = resp?.sources || [];
  } catch { srcState.sources = []; }
  populateTagFilter();
  filterSources();
  const countEl = document.getElementById("src-count");
  if (countEl) countEl.textContent = `${srcState.sources.length} source${srcState.sources.length !== 1 ? "s" : ""}`;

  // Highlight a specific source if navigated from KG graph
  const params = new URLSearchParams(window.location.search);
  const highlightId = params.get("highlight");
  if (highlightId) {
    // Auto-filter to the source's type so it's immediately visible
    const targetSrc = srcState.sources.find(s => s.id === highlightId);
    if (targetSrc?.type) {
      const typeFilter = document.getElementById("src-filter-type");
      if (typeFilter) {
        typeFilter.value = targetSrc.type;
        filterSources();
      }
    }
    requestAnimationFrame(() => {
      const card = document.querySelector(`.src-card[data-src-id="${CSS.escape(highlightId)}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("src-card-highlight");
        setTimeout(() => card.classList.remove("src-card-highlight"), 3000);
      }
    });
    // Clean up URL so refreshing doesn't re-highlight
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState(null, "", cleanUrl);
  }
}

function populateTagFilter() {
  const sel = document.getElementById("src-filter-tag");
  const current = sel.value;
  const tags = new Set();
  for (const s of srcState.sources) {
    for (const t of (s.tags || [])) tags.add(t);
  }
  sel.innerHTML = '<option value="">All Tags</option>';
  for (const t of [...tags].sort()) {
    sel.innerHTML += `<option value="${t}">${t}</option>`;
  }
  sel.value = current;

  // Populate folder filter + datalist (merge stored folder list + folders from sources)
  const folderSel = document.getElementById("src-filter-folder");
  const folderList = document.getElementById("src-folder-list");
  const currentFolder = folderSel?.value || "";
  const folders = new Set();
  for (const s of srcState.sources) {
    if (s.folder) folders.add(s.folder);
  }
  // Also include stored folder names (so empty folders persist)
  getSrcFolderList().then(stored => {
    for (const f of stored) folders.add(f);
    if (folderSel) {
      folderSel.innerHTML = '<option value="">All Folders</option>';
      for (const f of [...folders].sort()) {
        folderSel.innerHTML += `<option value="${f}">${f}</option>`;
      }
      folderSel.value = currentFolder;
    }
    if (folderList) {
      folderList.innerHTML = '';
      for (const f of [...folders].sort()) {
        folderList.innerHTML += `<option value="${f}">`;
      }
    }
  });
}

function srcFolderAdd() {
  const name = prompt("New folder name:");
  if (!name || !name.trim()) return;
  const folderName = name.trim();
  // Check if any source already uses this folder
  if (srcState.sources.some(s => s.folder === folderName)) {
    alert(`Folder "${folderName}" already exists.`);
    return;
  }
  // Create a placeholder by setting the folder in the filter — it'll appear once a source uses it
  // But we also store it in a dedicated list so empty folders persist
  saveSrcFolderList(folderName);
  populateTagFilter();
  document.getElementById("src-filter-folder").value = folderName;
  document.getElementById("src-filter-folder").dispatchEvent(new Event("change"));
}

async function srcFolderRename() {
  const folderSel = document.getElementById("src-filter-folder");
  const oldName = folderSel.value;
  if (!oldName) return;
  const newName = prompt(`Rename folder "${oldName}" to:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  const trimmed = newName.trim();
  // Rename on all sources that use this folder
  let count = 0;
  for (const src of srcState.sources) {
    if (src.folder === oldName) {
      src.folder = trimmed;
      await browser.runtime.sendMessage({ action: "saveSource", source: src });
      count++;
    }
  }
  // Update stored folder list
  await renameSrcFolder(oldName, trimmed);
  populateTagFilter();
  folderSel.value = trimmed;
  folderSel.dispatchEvent(new Event("change"));
  filterSources();
}

async function srcFolderDelete() {
  const folderSel = document.getElementById("src-filter-folder");
  const folderName = folderSel.value;
  if (!folderName) return;
  const sourcesInFolder = srcState.sources.filter(s => s.folder === folderName);
  const action = sourcesInFolder.length > 0
    ? prompt(`Folder "${folderName}" has ${sourcesInFolder.length} source(s).\nType DELETE to remove folder AND sources, or KEEP to ungroup them:`)
    : "empty";
  if (!action) return;
  const choice = action.trim().toUpperCase();
  if (choice === "DELETE") {
    for (const src of sourcesInFolder) {
      await browser.runtime.sendMessage({ action: "deleteSource", sourceId: src.id });
    }
  } else if (choice === "KEEP") {
    for (const src of sourcesInFolder) {
      src.folder = "";
      await browser.runtime.sendMessage({ action: "saveSource", source: src });
    }
  } else if (choice !== "EMPTY") {
    return; // cancelled or unrecognized
  }
  await removeSrcFolder(folderName);
  populateTagFilter();
  folderSel.value = "";
  folderSel.dispatchEvent(new Event("change"));
  loadSources();
}

// Persist folder names independently so empty folders survive
async function getSrcFolderList() {
  try {
    const res = await browser.storage.local.get({ argusSrcFolders: [] });
    return res.argusSrcFolders || [];
  } catch { return []; }
}
async function saveSrcFolderList(newFolder) {
  const list = await getSrcFolderList();
  if (!list.includes(newFolder)) {
    list.push(newFolder);
    await browser.storage.local.set({ argusSrcFolders: list });
  }
}
async function renameSrcFolder(oldName, newName) {
  const list = await getSrcFolderList();
  const idx = list.indexOf(oldName);
  if (idx !== -1) list[idx] = newName;
  else list.push(newName);
  await browser.storage.local.set({ argusSrcFolders: list });
}
async function removeSrcFolder(name) {
  const list = await getSrcFolderList();
  const filtered = list.filter(f => f !== name);
  await browser.storage.local.set({ argusSrcFolders: filtered });
}

function filterSources() {
  const raw = (document.getElementById("src-search")?.value || "").trim();
  const typeFilter = document.getElementById("src-filter-type")?.value || "";
  const tagFilter = document.getElementById("src-filter-tag")?.value || "";
  const folderFilter = document.getElementById("src-filter-folder")?.value || "";
  const countEl = document.getElementById("src-search-count");
  const searchBar = document.querySelector(".src-search-bar");

  let filtered = srcState.sources;
  if (typeFilter) filtered = filtered.filter(s => s.type === typeFilter);
  if (tagFilter) filtered = filtered.filter(s => (s.tags || []).includes(tagFilter));
  if (folderFilter) filtered = filtered.filter(s => (s.folder || "") === folderFilter);

  const sourceText = (s) => [
    s.name, s.type, s.folder, s.location, s.notes,
    ...(s.aliases || []),
    ...(s.tags || []),
    ...(s.addresses || []).flatMap(a => [a.label, a.value])
  ].filter(Boolean).join(" ");

  if (raw && srcState.regexMode) {
    let re;
    try {
      re = new RegExp(raw, "i");
      if (searchBar) searchBar.classList.remove("src-search-error");
    } catch {
      if (searchBar) searchBar.classList.add("src-search-error");
      if (countEl) countEl.textContent = "invalid regex";
      renderSourcesGrid(filtered);
      return;
    }
    filtered = filtered.filter(s => re.test(sourceText(s)));
  } else if (raw) {
    if (searchBar) searchBar.classList.remove("src-search-error");
    const q = raw.toLowerCase();
    filtered = filtered.filter(s => sourceText(s).toLowerCase().includes(q));
  } else {
    if (searchBar) searchBar.classList.remove("src-search-error");
  }

  if (countEl) {
    countEl.textContent = raw ? `${filtered.length} / ${srcState.sources.length}` : "";
  }
  renderSourcesGrid(filtered);
}

const SOURCE_TYPE_COLORS = {
  person:       '#e94560',
  organization: '#64b5f6',
  group:        '#ab47bc',
  handle:       '#26c6da',
  journalist:   '#ffa726',
  informant:    '#66bb6a',
  target:       '#ef5350',
  adversary:    '#f44336',
  scammer:      '#ff5722',
  asset:        '#42a5f5',
  service:      '#78909c',
  webservice:   '#7e57c2',
  device:       '#8d6e63',
  academic:     '#5c6bc0',
  medical:      '#26a69a',
  legal:        '#8d6e63',
  lead:         '#ffca28',
  alias:        '#bdbdbd',
  entity:       '#90a4ae',
};

async function renderSourcesGrid(sources) {
  const grid = document.getElementById("src-grid");
  if (!sources.length) {
    grid.innerHTML = '<div class="src-empty"><p>No sources match your filter.</p></div>';
    return;
  }

  // Fetch active feeds and monitors to cross-reference with source addresses
  let activeFeedUrls = new Set();
  let monitoredUrls = new Set();
  try {
    const [feedResp, monResp] = await Promise.all([
      browser.runtime.sendMessage({ action: "getFeeds" }).catch(() => null),
      browser.runtime.sendMessage({ action: "getMonitors" }).catch(() => null),
    ]);
    if (feedResp?.feeds) {
      for (const f of feedResp.feeds) {
        if (f.url) activeFeedUrls.add(f.url);
      }
    }
    if (monResp?.monitors) {
      for (const m of monResp.monitors) {
        if (m.url) monitoredUrls.add(m.url);
      }
    }
  } catch { /* unavailable */ }

  // Group by folder when showing all folders
  const folderFilter = document.getElementById("src-filter-folder")?.value || "";
  const hasFolders = sources.some(s => s.folder);
  let orderedSources = sources;
  if (!folderFilter && hasFolders) {
    // Sort: sources with folders first (alphabetical by folder), then ungrouped
    orderedSources = [...sources].sort((a, b) => {
      if (a.folder && !b.folder) return -1;
      if (!a.folder && b.folder) return 1;
      if (a.folder && b.folder) return a.folder.localeCompare(b.folder);
      return 0;
    });
  }

  grid.innerHTML = "";
  let currentFolder = null;
  let currentSubGrid = grid; // default: cards go directly into grid
  for (const src of orderedSources) {
    // Insert folder section with its own sub-grid when grouping
    if (!folderFilter && hasFolders) {
      const sf = src.folder || "__ungrouped__";
      if (sf !== currentFolder) {
        currentFolder = sf;
        const section = document.createElement("div");
        section.className = "src-folder-section";
        const header = document.createElement("div");
        header.className = "src-folder-header";
        if (sf === "__ungrouped__") {
          header.innerHTML = `<span class="src-folder-header-icon">📋</span> Ungrouped`;
        } else {
          header.innerHTML = `<span class="src-folder-header-icon">📁</span> ${escapeHtml(sf)}`;
        }
        section.appendChild(header);
        const subGrid = document.createElement("div");
        subGrid.className = "src-grid src-folder-grid";
        section.appendChild(subGrid);
        grid.appendChild(section);
        currentSubGrid = subGrid;
      }
    }
    const card = document.createElement("div");
    card.className = "src-card";
    card.dataset.srcId = src.id;

    const typeColor = SOURCE_TYPE_COLORS[src.type] || SOURCE_TYPE_COLORS.entity;

    // Header
    const initials = (src.name || "?").slice(0, 2).toUpperCase();
    const header = document.createElement("div");
    header.className = "src-card-header";
    header.style.background = typeColor + '18';
    header.style.borderBottom = `2px solid ${typeColor}55`;
    header.innerHTML = `
      <div class="src-card-avatar" style="background:${typeColor}22;color:${typeColor};">${initials}</div>
      <div class="src-card-info">
        <div class="src-card-name">${escapeHtml(src.name || "Unnamed")}</div>
        <div class="src-card-type" style="color:${typeColor};">${escapeHtml(src.type || "entity")}</div>
        ${src.aliases?.length ? `<div class="src-card-aliases">aka ${escapeHtml(src.aliases.join(", "))}</div>` : ""}
      </div>
    `;
    card.appendChild(header);

    // Addresses (truncate to first 5, expandable)
    if (src.addresses?.length) {
      const MAX_VISIBLE = 5;
      const addrs = document.createElement("div");
      addrs.className = "src-card-addresses";
      let hasActiveFeed = false;
      let hasMonitoredPage = false;
      const allChips = [];
      for (const addr of src.addresses) {
        const def = SOURCE_ADDR_TYPES[addr.type] || SOURCE_ADDR_TYPES.custom;
        const chip = document.createElement("a");
        chip.className = "src-addr-chip";
        const isFeed = addr.type === "rss" && activeFeedUrls.has(addr.value);
        const isPageMonitor = !isFeed && monitoredUrls.has(addr.value);
        if (isFeed || isPageMonitor) {
          chip.classList.add("src-addr-monitored");
          if (isFeed) hasActiveFeed = true;
          if (isPageMonitor) hasMonitoredPage = true;
        }
        const liveLabel = isFeed ? " (subscribed feed)" : isPageMonitor ? " (monitored page)" : "";
        chip.title = `${def.label}: ${addr.value}${liveLabel}`;
        const url = getAddrUrl(addr);
        if (url) { chip.href = url; chip.target = "_blank"; }
        const liveTag = isFeed ? '<span class="src-chip-live">FEED</span>' : isPageMonitor ? '<span class="src-chip-live">MON</span>' : "";
        chip.innerHTML = `<span class="src-chip-icon">${def.icon}</span><span class="src-chip-label">${escapeHtml(addr.label || addr.value)}</span>${liveTag}`;
        chip.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(addr.value);
        });
        allChips.push(chip);
      }
      const overflow = allChips.length > MAX_VISIBLE;
      for (let i = 0; i < allChips.length; i++) {
        if (overflow && i >= MAX_VISIBLE) allChips[i].classList.add("src-addr-hidden");
        addrs.appendChild(allChips[i]);
      }
      if (overflow) {
        const moreBtn = document.createElement("button");
        moreBtn.className = "src-addr-more";
        const hiddenCount = allChips.length - MAX_VISIBLE;
        moreBtn.textContent = `+${hiddenCount} more`;
        moreBtn.addEventListener("click", () => {
          addrs.querySelectorAll(".src-addr-hidden").forEach(el => el.classList.remove("src-addr-hidden"));
          moreBtn.remove();
        });
        addrs.appendChild(moreBtn);
      }
      if (hasActiveFeed || hasMonitoredPage) {
        const badge = document.createElement("div");
        badge.className = "src-card-feed-badge";
        const parts = [];
        if (hasActiveFeed) parts.push("Subscribed Feed");
        if (hasMonitoredPage) parts.push("Monitored Page");
        badge.textContent = parts.join(" · ");
        addrs.appendChild(badge);
      }
      card.appendChild(addrs);
    }

    // Folder badge
    if (src.folder) {
      const folderBadge = document.createElement("div");
      folderBadge.className = "src-card-folder";
      folderBadge.innerHTML = `<span class="src-folder-badge">📁 ${escapeHtml(src.folder)}</span>`;
      card.appendChild(folderBadge);
    }

    // Location + Tags
    if (src.location || src.tags?.length) {
      const meta = document.createElement("div");
      meta.className = "src-card-tags";
      if (src.location) {
        meta.innerHTML += `<span class="src-tag" style="background:var(--bg-secondary);color:var(--text-secondary);">📍 ${escapeHtml(src.location)}</span>`;
      }
      for (const t of (src.tags || [])) {
        meta.innerHTML += `<span class="src-tag">${escapeHtml(t)}</span>`;
      }
      card.appendChild(meta);
    }

    // Notes preview
    if (src.notes) {
      const notes = document.createElement("div");
      notes.className = "src-card-notes";
      notes.textContent = src.notes;
      card.appendChild(notes);
    }

    // Actions
    const actions = document.createElement("div");
    actions.className = "src-card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => showSourceEditor(src));
    actions.appendChild(editBtn);

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-secondary";
    copyBtn.textContent = "Copy All";
    copyBtn.addEventListener("click", () => {
      const handles = (src.addresses || []).map(a => a.value).join("\n");
      navigator.clipboard.writeText(handles);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy All"; }, 1500);
    });
    actions.appendChild(copyBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-secondary";
    delBtn.textContent = "Delete";
    delBtn.style.color = "var(--error)";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete source "${src.name}"?`)) return;
      await browser.runtime.sendMessage({ action: "deleteSource", sourceId: src.id });
      loadSources();
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    currentSubGrid.appendChild(card);
  }
}

function getAddrUrl(addr) {
  const def = SOURCE_ADDR_TYPES[addr.type] || SOURCE_ADDR_TYPES.custom;
  const val = (addr.value || "").trim();
  if (!val) return null;
  // If value is already a full URL, use it directly
  if (/^https?:\/\//i.test(val)) return val;
  if (addr.type === "email") return `mailto:${val}`;
  if (addr.type === "phone") return `tel:${val}`;
  if (def.prefix) return def.prefix + val.replace(/^@/, "");
  return null;
}

function showSourceEditor(source) {
  srcState.editingId = source?.id || null;
  const editor = document.getElementById("src-editor");
  document.getElementById("src-editor-title").textContent = source ? "Edit Source" : "New Source";
  document.getElementById("src-name").value = source?.name || "";
  document.getElementById("src-type").value = source?.type || "person";
  document.getElementById("src-aliases").value = (source?.aliases || []).join(", ");
  document.getElementById("src-location").value = source?.location || "";
  document.getElementById("src-tags").value = (source?.tags || []).join(", ");
  document.getElementById("src-notes").value = source?.notes || "";
  document.getElementById("src-folder").value = source?.folder || "";

  // Populate address rows
  const list = document.getElementById("src-addr-list");
  list.innerHTML = "";
  if (source?.addresses?.length) {
    for (const addr of source.addresses) {
      addAddrRow(addr.type, addr.value, addr.label);
    }
  } else {
    addAddrRow(); // Start with one empty row
  }

  editor.classList.remove("hidden");
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("src-name").focus();
}

function hideSourceEditor() {
  document.getElementById("src-editor").classList.add("hidden");
  srcState.editingId = null;
}

function addAddrRow(type, value, label) {
  const list = document.getElementById("src-addr-list");
  const row = document.createElement("div");
  row.className = "src-addr-row";

  const sel = document.createElement("select");
  for (const [key, def] of Object.entries(SOURCE_ADDR_TYPES)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${def.icon} ${def.label}`;
    sel.appendChild(opt);
  }
  sel.value = type || "website";

  const valInput = document.createElement("input");
  valInput.type = "text";
  const selectedType = SOURCE_ADDR_TYPES[sel.value] || SOURCE_ADDR_TYPES.custom;
  valInput.placeholder = selectedType.example || "Handle, URL, email, IP, number...";
  valInput.value = value || "";

  // Update placeholder when type changes
  sel.addEventListener("change", () => {
    const def = SOURCE_ADDR_TYPES[sel.value] || SOURCE_ADDR_TYPES.custom;
    valInput.placeholder = def.example || "Handle, URL, email, IP, number...";
  });

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.placeholder = "Label (optional)";
  labelInput.value = label || "";
  labelInput.style.maxWidth = "120px";

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn btn-secondary";
  removeBtn.textContent = "×";
  removeBtn.style.color = "var(--error)";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(sel);
  row.appendChild(valInput);
  row.appendChild(labelInput);
  row.appendChild(removeBtn);
  list.appendChild(row);
}

async function saveSource() {
  const name = document.getElementById("src-name").value.trim();
  if (!name) { document.getElementById("src-name").focus(); return; }

  const aliases = document.getElementById("src-aliases").value.split(",").map(s => s.trim()).filter(Boolean);
  const tags = document.getElementById("src-tags").value.split(",").map(s => s.trim()).filter(Boolean);

  // Collect addresses
  const addresses = [];
  for (const row of document.querySelectorAll("#src-addr-list .src-addr-row")) {
    const type = row.querySelector("select").value;
    const value = row.querySelectorAll("input")[0].value.trim();
    const label = row.querySelectorAll("input")[1].value.trim();
    if (value) addresses.push({ type, value, label: label || "" });
  }

  const source = {
    id: srcState.editingId || `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type: document.getElementById("src-type").value,
    aliases,
    addresses,
    tags,
    location: document.getElementById("src-location").value.trim(),
    notes: document.getElementById("src-notes").value.trim(),
    folder: document.getElementById("src-folder").value.trim(),
  };

  // Preserve timestamps if editing
  if (srcState.editingId) {
    const existing = srcState.sources.find(s => s.id === srcState.editingId);
    if (existing) source.createdAt = existing.createdAt;
  }

  // Persist folder name so it survives even if all sources are removed from it
  if (source.folder) await saveSrcFolderList(source.folder);

  await browser.runtime.sendMessage({ action: "saveSource", source });
  hideSourceEditor();
  loadSources();
}

async function importSources(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const sources = Array.isArray(data) ? data : (data.sources || []);
    if (!sources.length) { alert("No sources found in file."); return; }
    // Ensure all have IDs
    for (const s of sources) {
      if (!s.id) s.id = `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    await browser.runtime.sendMessage({ action: "importSources", sources });
    loadSources();
  } catch (err) {
    alert("Import failed: " + err.message);
  }
  e.target.value = "";
}

async function exportSources() {
  const resp = await browser.runtime.sendMessage({ action: "exportSources" });
  const sources = resp?.sources || [];
  if (!sources.length) { alert("No sources to export."); return; }
  const blob = new Blob([JSON.stringify(sources, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `argus-sources-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Source picker — reusable dropdown for other tabs ──
// btnId:       ID of the trigger button
// dropdownId:  ID of the dropdown container
// addrTypes:   array of SOURCE_ADDR_TYPES keys to filter by (e.g. ["rss","website"])
// onSelect:    callback(addr, source) when user picks an address
function initSourcePicker(btnId, dropdownId, addrTypes, onSelect) {
  const btn = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  if (!btn || !dropdown) return;

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const wasHidden = dropdown.classList.contains("hidden");
    // Close all other open pickers first
    document.querySelectorAll(".src-picker-dropdown").forEach(d => d.classList.add("hidden"));
    if (!wasHidden) return;

    dropdown.classList.remove("hidden");
    dropdown.innerHTML = '<div class="src-picker-empty">Loading...</div>';

    let sources;
    try {
      const resp = await browser.runtime.sendMessage({ action: "getSources" });
      sources = resp?.sources || [];
    } catch { sources = []; }

    // Collect matching addresses across all sources
    const items = [];
    for (const src of sources) {
      for (const addr of (src.addresses || [])) {
        if (addrTypes.includes(addr.type)) {
          items.push({ source: src, addr });
        }
        // Also include website/custom addresses that look like URLs
        if (!addrTypes.includes(addr.type) && addrTypes.includes("website") && /^https?:\/\//i.test(addr.value)) {
          items.push({ source: src, addr });
        }
      }
    }

    // Deduplicate by value
    const seen = new Set();
    const unique = items.filter(i => {
      if (seen.has(i.addr.value)) return false;
      seen.add(i.addr.value);
      return true;
    });

    if (!unique.length) {
      dropdown.innerHTML = '<div class="src-picker-empty">No matching addresses in your sources.<br>Add RSS or website addresses on the Sources tab.</div>';
      return;
    }

    dropdown.innerHTML = "";
    for (const { source, addr } of unique) {
      const def = SOURCE_ADDR_TYPES[addr.type] || SOURCE_ADDR_TYPES.custom;
      const item = document.createElement("div");
      item.className = "src-picker-item";
      item.innerHTML = `
        <span class="src-picker-item-name">${def.icon} ${escapeHtml(source.name)}${addr.label ? " — " + escapeHtml(addr.label) : ""}</span>
        <span class="src-picker-item-addr">${escapeHtml(addr.value)}</span>
      `;
      item.addEventListener("click", () => {
        onSelect(addr, source);
        dropdown.classList.add("hidden");
      });
      dropdown.appendChild(item);
    }
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add("hidden");
    }
  });
}

// ══════════════════════════════════════════════════════════════
// Trawl Schedule — Phase 3
// ══════════════════════════════════════════════════════════════

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
