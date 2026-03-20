// ──────────────────────────────────────────────
// Intelligence provider setup
// Extracted from attachListeners() — called during init
// ──────────────────────────────────────────────
function initIntelProviders() {
  // ── Intelligence provider tabs ──
  const INTEL_PROVIDER_KEYS = ["opensanctions", "csl", "eusanctions", "samgov", "patentsview", "lensorg", "pqai", "secedgar", "courtlistener", "opensky", "adsbexchange", "marinetraffic", "gdelt", "sentinelhub", "opencorporates", "gleif", "blockstream", "broadcastify", "vesselfinder", "flightaware", "wigle", "stadiamaps", "windywebcams", "windyforecast", "openweathermap", "dol", "fec", "propublica990"];

  document.getElementById("intel-provider-tab-list")?.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.iprovider;
      document.getElementById("intel-provider-tab-list").querySelectorAll(".tab-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.iprovider === key);
      });
      for (const k of INTEL_PROVIDER_KEYS) {
        const panel = document.getElementById(`intel-${k}-fields`);
        if (panel) panel.classList.toggle("hidden", k !== key);
      }
    });
  });

  // Intel provider API key auto-save
  for (const key of INTEL_PROVIDER_KEYS) {
    const input = document.getElementById(`intel-${key}-apikey`);
    if (input) {
      input.addEventListener("input", () => {
        browser.runtime.sendMessage({
          action: "intelSaveConfig",
          provider: key,
          config: { apiKey: input.value.trim() }
        }).then(() => {
          // Notify ribbon on all open pages to refresh their intel strip
          browser.runtime.sendMessage({ type: "argusConnectionChanged" }).catch(() => {});
        }).catch(() => {});
      });
    }
  }

  // Intel provider test connection buttons
  for (const key of INTEL_PROVIDER_KEYS) {
    const testBtn = document.getElementById(`intel-${key}-test-btn`);
    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        const statusEl = document.getElementById(`intel-${key}-status`);
        statusEl.className = "dp-status";
        statusEl.textContent = "Testing...";
        try {
          let resp;
          // Test via background — all providers support intelSearch
          resp = await browser.runtime.sendMessage({ action: "intelSearch", provider: key, query: "test", options: {} });
          if (resp?.success) {
            statusEl.className = "dp-status connected";
            statusEl.textContent = "Connected!";
          } else {
            statusEl.className = "dp-status error";
            statusEl.textContent = resp?.error || "Connection failed";
          }
        } catch (e) {
          statusEl.className = "dp-status error";
          statusEl.textContent = e.message;
        }
      });
    }
  }

  // Load intel provider status on page load
  browser.runtime.sendMessage({ action: "intelGetStatus" }).then(resp => {
    if (!resp?.providers) return;
    for (const [key, info] of Object.entries(resp.providers)) {
      const statusEl = document.getElementById(`intel-${key}-status`);
      if (statusEl) {
        if (info.status === "connected") {
          statusEl.className = "dp-status connected";
          statusEl.textContent = "Connected";
        } else if (info.status === "error") {
          statusEl.className = "dp-status error";
          statusEl.textContent = "Error";
        } else {
          statusEl.className = "dp-status";
          statusEl.textContent = "Not configured";
        }
      }
    }
  }).catch(() => {});

  // Intel provider eye toggles (show/hide password)
  document.querySelectorAll(".intel-eye-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.type = input.type === "password" ? "text" : "password";
    });
  });

  // OpenSky credentials.json file loader
  document.getElementById("intel-opensky-load-json")?.addEventListener("click", () => {
    document.getElementById("intel-opensky-file").click();
  });
  document.getElementById("intel-opensky-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const creds = JSON.parse(text);
      if (creds.clientId) document.getElementById("intel-opensky-clientid").value = creds.clientId;
      if (creds.clientSecret) document.getElementById("intel-opensky-clientsecret").value = creds.clientSecret;
      // Save to storage
      await browser.runtime.sendMessage({
        action: "intelSaveConfig",
        provider: "opensky",
        config: { clientId: creds.clientId, clientSecret: creds.clientSecret, connected: true }
      });
      document.getElementById("intel-opensky-status").className = "dp-status connected";
      document.getElementById("intel-opensky-status").textContent = "Credentials loaded!";
    } catch (err) {
      document.getElementById("intel-opensky-status").className = "dp-status error";
      document.getElementById("intel-opensky-status").textContent = "Invalid JSON file";
    }
    e.target.value = "";
  });

  // OpenSky manual field save
  for (const fieldId of ["intel-opensky-clientid", "intel-opensky-clientsecret"]) {
    document.getElementById(fieldId)?.addEventListener("input", () => {
      const clientId = document.getElementById("intel-opensky-clientid").value.trim();
      const clientSecret = document.getElementById("intel-opensky-clientsecret").value.trim();
      browser.runtime.sendMessage({
        action: "intelSaveConfig",
        provider: "opensky",
        config: { clientId, clientSecret, connected: !!(clientId && clientSecret) }
      }).catch(() => {});
    });
  }

  // WiGLE two-field save (API Name + API Token → encoded at runtime)
  for (const fieldId of ["intel-wigle-apiname", "intel-wigle-apikey"]) {
    document.getElementById(fieldId)?.addEventListener("input", () => {
      const apiName = document.getElementById("intel-wigle-apiname").value.trim();
      const apiKey  = document.getElementById("intel-wigle-apikey").value.trim();
      browser.runtime.sendMessage({
        action: "intelSaveConfig",
        provider: "wigle",
        config: { apiName, apiKey, connected: !!(apiName && apiKey) }
      }).then(() => {
        browser.runtime.sendMessage({ type: "argusConnectionChanged" }).catch(() => {});
      }).catch(() => {});
    });
  }

  // Windy Forecast two-field save (tile key + point forecast key stored separately)
  for (const fieldId of ["intel-windyforecast-tilekey", "intel-windyforecast-forecastkey"]) {
    document.getElementById(fieldId)?.addEventListener("input", () => {
      const tileKey     = document.getElementById("intel-windyforecast-tilekey")?.value.trim() || "";
      const forecastKey = document.getElementById("intel-windyforecast-forecastkey")?.value.trim() || "";
      browser.runtime.sendMessage({
        action: "intelSaveConfig",
        provider: "windyforecast",
        config: { tileKey, forecastKey, connected: !!(tileKey || forecastKey) }
      }).catch(() => {});
    });
  }

  // Load Windy Forecast keys on page open
  browser.runtime.sendMessage({ action: "intelGetProviderConfig", provider: "windyforecast" })
    .then(cfg => {
      if (!cfg) return;
      if (cfg.tileKey)     { const el = document.getElementById("intel-windyforecast-tilekey");     if (el) el.value = cfg.tileKey; }
      if (cfg.forecastKey) { const el = document.getElementById("intel-windyforecast-forecastkey"); if (el) el.value = cfg.forecastKey; }
    }).catch(() => {});

  // Stadia Maps — handled by generic loops above (INTEL_PROVIDER_KEYS includes "stadiamaps")

  // Stadia key loaded by generic loop above (argusIntelProviders.stadiamaps.apiKey)

  // Satellite defaults
  const SAT_DEFAULTS_KEY = "satDefaults";
  browser.storage.local.get({ [SAT_DEFAULTS_KEY]: {} }).then(d => {
    const cfg = d[SAT_DEFAULTS_KEY] || {};
    if (cfg.location) document.getElementById("sat-default-location").value = cfg.location;
    if (cfg.zoom) document.getElementById("sat-default-zoom").value = cfg.zoom;
    if (cfg.resolution) document.getElementById("sat-default-resolution").value = cfg.resolution;
  }).catch(() => {});

  for (const id of ["sat-default-location", "sat-default-zoom", "sat-default-resolution"]) {
    document.getElementById(id)?.addEventListener("change", () => {
      browser.storage.local.set({
        [SAT_DEFAULTS_KEY]: {
          location: document.getElementById("sat-default-location").value.trim(),
          zoom: parseInt(document.getElementById("sat-default-zoom").value) || 12,
          resolution: parseInt(document.getElementById("sat-default-resolution").value) || 1024,
        }
      });
    });
  }

  // Sentinel Hub credentials.json loader + manual fields
  document.getElementById("intel-sentinelhub-load-json")?.addEventListener("click", () => {
    document.getElementById("intel-sentinelhub-file").click();
  });
  document.getElementById("intel-sentinelhub-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const creds = JSON.parse(text);
      if (creds.clientId || creds.client_id) document.getElementById("intel-sentinelhub-clientid").value = creds.clientId || creds.client_id;
      if (creds.clientSecret || creds.client_secret) document.getElementById("intel-sentinelhub-clientsecret").value = creds.clientSecret || creds.client_secret;
      await browser.runtime.sendMessage({
        action: "intelSaveConfig", provider: "sentinelhub",
        config: { clientId: creds.clientId || creds.client_id, clientSecret: creds.clientSecret || creds.client_secret, connected: true }
      });
      document.getElementById("intel-sentinelhub-status").className = "dp-status connected";
      document.getElementById("intel-sentinelhub-status").textContent = "Credentials loaded!";
    } catch {
      document.getElementById("intel-sentinelhub-status").className = "dp-status error";
      document.getElementById("intel-sentinelhub-status").textContent = "Invalid JSON file";
    }
    e.target.value = "";
  });
  for (const fieldId of ["intel-sentinelhub-clientid", "intel-sentinelhub-clientsecret", "intel-sentinelhub-instanceid"]) {
    document.getElementById(fieldId)?.addEventListener("input", () => {
      const clientId = document.getElementById("intel-sentinelhub-clientid").value.trim();
      const clientSecret = document.getElementById("intel-sentinelhub-clientsecret").value.trim();
      const instanceId = document.getElementById("intel-sentinelhub-instanceid").value.trim();
      browser.runtime.sendMessage({
        action: "intelSaveConfig", provider: "sentinelhub",
        config: { clientId, clientSecret, instanceId, connected: !!(clientId && clientSecret) }
      }).catch(() => {});
    });
  }

  // Load saved intel provider API keys into fields
  browser.storage.local.get({ argusIntelProviders: {} }).then(data => {
    const cfg = data.argusIntelProviders || {};
    for (const key of INTEL_PROVIDER_KEYS) {
      const input = document.getElementById(`intel-${key}-apikey`);
      if (input && cfg[key]?.apiKey) {
        input.value = cfg[key].apiKey;
      }
    }
    // Sentinel Hub uses clientId/clientSecret/instanceId
    if (cfg.sentinelhub?.clientId) {
      const cid = document.getElementById("intel-sentinelhub-clientid");
      if (cid) cid.value = cfg.sentinelhub.clientId;
    }
    if (cfg.sentinelhub?.clientSecret) {
      const cs = document.getElementById("intel-sentinelhub-clientsecret");
      if (cs) cs.value = cfg.sentinelhub.clientSecret;
    }
    if (cfg.sentinelhub?.instanceId) {
      const iid = document.getElementById("intel-sentinelhub-instanceid");
      if (iid) iid.value = cfg.sentinelhub.instanceId;
    }
    // OpenSky uses clientId/clientSecret instead of apiKey
    if (cfg.opensky?.clientId) {
      const cid = document.getElementById("intel-opensky-clientid");
      if (cid) cid.value = cfg.opensky.clientId;
    }
    if (cfg.opensky?.clientSecret) {
      const cs = document.getElementById("intel-opensky-clientsecret");
      if (cs) cs.value = cfg.opensky.clientSecret;
    }
    // WiGLE uses apiName + apiKey
    if (cfg.wigle?.apiName) {
      const an = document.getElementById("intel-wigle-apiname");
      if (an) an.value = cfg.wigle.apiName;
    }
    if (cfg.wigle?.apiKey) {
      const ak = document.getElementById("intel-wigle-apikey");
      if (ak) ak.value = cfg.wigle.apiKey;
    }
  }).catch(() => {});
}
