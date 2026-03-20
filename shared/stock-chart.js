/*
 * Argus Stock Chart — Canvas OHLCV renderer
 * ==========================================
 * Draws candlestick or line charts from { t, o, h, l, c, v } candle arrays.
 *
 * Usage:
 *   StockChart.render(canvasEl, candles, { mode: "candle"|"line", theme: "dark"|"light" });
 */
const StockChart = (function () {
  "use strict";

  const THEMES = {
    dark: {
      bg: "#1a1a2e", grid: "#2a2a4a", text: "#a0a0b0", axis: "#3a3a5a",
      up: "#4caf50", down: "#e94560", line: "#64b5f6", wick: "#6a6a80",
      crosshair: "#ffffff33", volUp: "rgba(76,175,80,0.25)", volDn: "rgba(233,69,96,0.25)",
    },
    light: {
      bg: "#f0f1f5", grid: "#dcdfe6", text: "#555568", axis: "#c8cbd4",
      up: "#2e7d32", down: "#c62828", line: "#1565c0", wick: "#8888a0",
      crosshair: "#00000022", volUp: "rgba(46,125,50,0.2)", volDn: "rgba(198,40,40,0.2)",
    },
  };

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function render(canvas, candles, opts = {}) {
    if (!canvas || !candles || !candles.length) return;

    const mode = opts.mode || "candle";
    const th = THEMES[opts.theme || getTheme()];
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // Layout: main chart 75%, volume 20%, gap 5%
    const PAD_L = 55, PAD_R = 10, PAD_T = 10, PAD_B = 22;
    const chartH = (h - PAD_T - PAD_B) * 0.75;
    const volH = (h - PAD_T - PAD_B) * 0.20;
    const chartTop = PAD_T;
    const chartBot = chartTop + chartH;
    const volTop = chartBot + (h - PAD_T - PAD_B) * 0.05;
    const volBot = volTop + volH;
    const plotW = w - PAD_L - PAD_R;

    // Data ranges
    let minL = Infinity, maxH = -Infinity, maxV = 0;
    candles.forEach(c => {
      if (c.l < minL) minL = c.l;
      if (c.h > maxH) maxH = c.h;
      if (c.v > maxV) maxV = c.v;
    });
    const priceRange = maxH - minL || 1;
    const pricePad = priceRange * 0.05;
    minL -= pricePad;
    maxH += pricePad;
    const adjRange = maxH - minL;

    function priceY(p) { return chartTop + (1 - (p - minL) / adjRange) * chartH; }
    function volY(v) { return volBot - (v / (maxV || 1)) * volH; }
    function candleX(i) { return PAD_L + (i + 0.5) * (plotW / candles.length); }
    const candleW = Math.max(1, (plotW / candles.length) * 0.7);

    // Background
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, w, h);

    // Grid lines (horizontal)
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 0.5;
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = chartTop + (chartH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(w - PAD_R, y);
      ctx.stroke();

      // Price labels
      const price = maxH - (adjRange / gridSteps) * i;
      ctx.fillStyle = th.text;
      ctx.font = "9px -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(formatPrice(price), PAD_L - 4, y + 3);
    }

    // Volume bars
    candles.forEach((c, i) => {
      const x = candleX(i);
      const bw = Math.max(1, candleW);
      const vy = volY(c.v);
      ctx.fillStyle = c.c >= c.o ? th.volUp : th.volDn;
      ctx.fillRect(x - bw / 2, vy, bw, volBot - vy);
    });

    // Volume axis label
    ctx.fillStyle = th.text;
    ctx.font = "8px -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Vol", PAD_L - 4, volTop + 8);

    if (mode === "candle") {
      drawCandlestick(ctx, candles, th, candleX, priceY, candleW);
    } else {
      drawLine(ctx, candles, th, candleX, priceY, chartTop, chartBot);
    }

    // Time axis labels
    drawTimeAxis(ctx, candles, th, candleX, h - 4);

    // Crosshair on hover
    setupCrosshair(canvas, candles, th, candleX, priceY, PAD_L, PAD_R, chartTop, chartBot, w, h, mode, adjRange, minL);
  }

  function drawCandlestick(ctx, candles, th, candleX, priceY, candleW) {
    candles.forEach((c, i) => {
      const x = candleX(i);
      const isUp = c.c >= c.o;
      const color = isUp ? th.up : th.down;
      const bw = Math.max(1, candleW);

      // Wick
      ctx.strokeStyle = th.wick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceY(c.h));
      ctx.lineTo(x, priceY(c.l));
      ctx.stroke();

      // Body
      const top = priceY(Math.max(c.o, c.c));
      const bot = priceY(Math.min(c.o, c.c));
      const bodyH = Math.max(1, bot - top);
      ctx.fillStyle = color;
      ctx.fillRect(x - bw / 2, top, bw, bodyH);
    });
  }

  function drawLine(ctx, candles, th, candleX, priceY, chartTop, chartBot) {
    if (candles.length < 2) return;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, chartTop, 0, chartBot);
    grad.addColorStop(0, th.line + "40");
    grad.addColorStop(1, th.line + "05");

    ctx.beginPath();
    ctx.moveTo(candleX(0), priceY(candles[0].c));
    candles.forEach((c, i) => { if (i > 0) ctx.lineTo(candleX(i), priceY(c.c)); });
    // Fill area
    ctx.lineTo(candleX(candles.length - 1), chartBot);
    ctx.lineTo(candleX(0), chartBot);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(candleX(0), priceY(candles[0].c));
    candles.forEach((c, i) => { if (i > 0) ctx.lineTo(candleX(i), priceY(c.c)); });
    ctx.strokeStyle = th.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawTimeAxis(ctx, candles, th, candleX, y) {
    ctx.fillStyle = th.text;
    ctx.font = "8px -apple-system, sans-serif";
    ctx.textAlign = "center";

    const labelCount = Math.min(6, candles.length);
    const step = Math.floor(candles.length / labelCount);
    for (let i = 0; i < candles.length; i += step) {
      const d = new Date(candles[i].t);
      let label;
      if (candles.length <= 78) { // intraday
        label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (candles.length <= 365) {
        label = d.toLocaleDateString([], { month: "short", day: "numeric" });
      } else {
        label = d.toLocaleDateString([], { month: "short", year: "2-digit" });
      }
      ctx.fillText(label, candleX(i), y);
    }
  }

  function setupCrosshair(canvas, candles, th, candleX, priceY, padL, padR, chartTop, chartBot, w, h, mode, adjRange, minL) {
    let overlayCanvas = canvas.parentElement?.querySelector(".stock-chart-overlay");
    if (!overlayCanvas) {
      overlayCanvas = document.createElement("canvas");
      overlayCanvas.className = "stock-chart-overlay";
      overlayCanvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";
      canvas.parentElement.style.position = "relative";
      canvas.parentElement.appendChild(overlayCanvas);
    }
    const dpr = window.devicePixelRatio || 1;
    overlayCanvas.width = w * dpr;
    overlayCanvas.height = h * dpr;
    const octx = overlayCanvas.getContext("2d");
    octx.scale(dpr, dpr);

    canvas.onmousemove = function (e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      octx.clearRect(0, 0, w, h);
      if (mx < padL || mx > w - padR || my < chartTop || my > chartBot) return;

      // Find nearest candle
      const plotW = w - padL - padR;
      const idx = Math.round((mx - padL) / plotW * candles.length - 0.5);
      if (idx < 0 || idx >= candles.length) return;
      const c = candles[idx];
      const cx = candleX(idx);

      // Crosshair lines
      octx.strokeStyle = th.crosshair;
      octx.lineWidth = 0.5;
      octx.setLineDash([3, 3]);
      octx.beginPath();
      octx.moveTo(cx, chartTop);
      octx.lineTo(cx, chartBot);
      octx.moveTo(padL, my);
      octx.lineTo(w - padR, my);
      octx.stroke();
      octx.setLineDash([]);

      // Tooltip
      const isUp = c.c >= c.o;
      const d = new Date(c.t);
      const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
      const lines = [
        dateStr,
        "O: " + formatPrice(c.o) + "  H: " + formatPrice(c.h),
        "L: " + formatPrice(c.l) + "  C: " + formatPrice(c.c),
        "Vol: " + formatVol(c.v),
      ];

      octx.font = "9px -apple-system, sans-serif";
      const lw = Math.max(...lines.map(l => octx.measureText(l).width)) + 12;
      const lh = lines.length * 13 + 8;
      let tx = cx + 10;
      if (tx + lw > w - padR) tx = cx - lw - 10;
      let ty = my - lh / 2;
      if (ty < chartTop) ty = chartTop;

      octx.fillStyle = th.bg + "ee";
      octx.strokeStyle = isUp ? th.up : th.down;
      octx.lineWidth = 1;
      octx.beginPath();
      octx.roundRect(tx, ty, lw, lh, 4);
      octx.fill();
      octx.stroke();

      octx.fillStyle = th.text;
      lines.forEach((l, i) => {
        octx.fillText(l, tx + 6, ty + 14 + i * 13);
      });

      // Dot on price
      octx.fillStyle = isUp ? th.up : th.down;
      octx.beginPath();
      octx.arc(cx, priceY(c.c), 3, 0, Math.PI * 2);
      octx.fill();
    };

    canvas.onmouseleave = function () {
      octx.clearRect(0, 0, w, h);
    };
  }

  function formatPrice(p) {
    if (p >= 1000) return p.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(2);
    return p.toFixed(4);
  }

  function formatVol(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return String(v);
  }

  return { render, THEMES };
})();
