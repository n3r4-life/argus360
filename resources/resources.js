// resources.js — extracted from options-features.js initResourcesTab()

document.addEventListener("DOMContentLoaded", () => {
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
    const { resourcesJsonCache } = await browser.storage.local.get({ resourcesJsonCache: null });
    if (resourcesJsonCache && resourcesJsonCache.data) {
      renderGrid(resourcesJsonCache.data);
      if (versionInfo) versionInfo.textContent = `v${resourcesJsonCache.data.version || "?"} (updated ${resourcesJsonCache.data.updated || "?"})`;
      if (resetBtn) resetBtn.style.display = "";
      return;
    }
    try {
      const resp = await fetch(browser.runtime.getURL("../data/resources.json"));
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
  let cardLinksCache = {};

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
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "res-link-edit-cb hidden";
        cb.addEventListener("click", (e) => e.stopPropagation());
        item.prepend(cb);
        userLinkEls.push(item);
        list.appendChild(item);
      }
      card.appendChild(list);

      let editingIdx = -1;
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

      // Master list link
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
        <button class="pill-chip res-card-add-save">Add</button>
        <button class="pill-chip res-card-add-cancel">Cancel</button>
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

    // Top display card
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
      saveBtn.className = "pill-chip res-edit-btn";
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
      removeBtn.className = "pill-chip res-edit-btn";
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
});
