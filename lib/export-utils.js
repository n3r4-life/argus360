// ──────────────────────────────────────────────
// Export utilities (shared across popup, results, history pages)
// ──────────────────────────────────────────────

function exportAsMarkdown(content, filename) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, filename || "analysis.md");
}

function exportAsHTML(content, title) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title || "Analysis Result")}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #e8e8e8; background: #1a1a2e; line-height: 1.7; }
  h1, h2, h3 { margin-top: 16px; margin-bottom: 8px; }
  code { background: #16213e; padding: 2px 6px; border-radius: 3px; }
  pre { background: #16213e; padding: 14px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 3px solid #e94560; padding-left: 14px; color: #a0a0b0; }
  a { color: #ff6b81; }
  ul, ol { padding-left: 24px; }
  li { margin-bottom: 6px; }
</style>
</head>
<body>
${typeof DOMPurify !== "undefined" ? DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } }) : marked.parse(content)}
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, (title || "analysis").replace(/[^a-z0-9]/gi, "_") + ".html");
}

function exportAsText(content, filename) {
  // Strip markdown formatting for plain text
  const text = content
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s/gm, "- ")
    .replace(/^>\s/gm, "");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, filename || "analysis.txt");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
