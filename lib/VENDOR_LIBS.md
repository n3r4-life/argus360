# Vendored Third-Party Libraries

These files are **excluded from git** during development to keep the repo size
manageable for AI-assisted coding tools. They are unmodified vendor downloads
and must be present locally for the extension to function.

## Required Files

| File | Library | Version | Source |
|------|---------|---------|--------|
| `pdf.min.js` | PDF.js | 3.x | https://mozilla.github.io/pdf.js/ |
| `pdf.worker.min.js` | PDF.js (worker) | 3.x | Same as above |
| `purify.min.js` | DOMPurify | 3.x | https://github.com/cure53/DOMPurify |
| `marked.min.js` | Marked | 12.x | https://github.com/markedjs/marked |
| `fflate.min.js` | fflate | 0.8.x | https://github.com/101arrowz/fflate |
| `leaflet.js` | Leaflet | 1.9.x | https://leafletjs.com/ |
| `leaflet.css` | Leaflet CSS | 1.9.x | Same as above |
| `xterm.js` | xterm.js | 5.x | https://github.com/xtermjs/xterm.js |
| `xterm.css` | xterm.js CSS | 5.x | Same as above |
| `xterm-addon-fit.js` | xterm fit addon | 0.8.x | Same as above |
| `xterm-addon-web-links.js` | xterm web-links addon | 0.9.x | Same as above |

## Why They're Gitignored

These files total ~2MB of minified code. They cause issues with AI coding tools
(Claude Projects, Cursor, etc.) that have file count or size limits when
connecting to a GitHub repo. Since they never change, excluding them during
development has no downside.

## Before Release

Remove these entries from `.gitignore` (or use `git add -f`) before publishing
the extension so that the repo is self-contained.
