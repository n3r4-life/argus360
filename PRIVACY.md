# Argus Privacy Policy

**Last updated:** March 17, 2026
**Developer:** n3r4-life

## Summary

Argus is a privacy-first browser extension. All data is stored locally on your device. Argus does not operate any servers, collect telemetry, or transmit data to the developer.

## Data Storage

All extension data is stored in your browser's local storage (`browser.storage.local`). This includes:

- API keys you provide for AI providers
- Analysis history and results
- Smart bookmarks and tags
- Project data (URLs, notes, entities, graphs)
- Page monitor snapshots and diffs
- RSS feed subscriptions and articles
- Keyword watchlist terms
- Geocoding cache (location name to coordinates)
- Shared Asset Library (collected images, locations, entities across pages)
- Satellite pins and scene metadata
- Extension settings and preferences

This data never leaves your browser except as described below. You can clear all stored data at any time using the **"Wipe Everything"** button in extension settings. Note: Firefox does not automatically clear extension data on uninstall — use "Wipe Everything" before uninstalling to leave no traces.

## External Services

Argus connects to external services only when you initiate an action that requires them. These connections are made directly from your browser using API keys you provide.

### AI Providers (user-initiated)

When you analyze a page, generate a report, or use any AI-powered feature, the content you choose to analyze is sent to the AI provider you selected:

- **xAI (Grok)** — api.x.ai
- **OpenAI (ChatGPT)** — api.openai.com
- **Anthropic (Claude)** — api.anthropic.com
- **Google (Gemini)** — generativelanguage.googleapis.com
- **Custom providers** — any OpenAI-compatible endpoint you configure

Each provider has its own privacy policy and data handling practices. Argus sends page content and your prompt to the provider's API using your own API key. The developer of Argus has no access to your API keys or the data you send to these providers.

### OpenStreetMap Nominatim (geolocation & satellite)

When you use the Geolocation Map or Satellite page, location names and coordinates are sent to the OpenStreetMap Nominatim geocoding service for forward and reverse geocoding. The Satellite page uses Nominatim for both address→coordinate and coordinate→address lookups. Results are cached locally to minimize requests. See the [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/).

### Copernicus / Sentinel Hub (satellite imagery, user-configured)

When you use the Satellite page, imagery requests are sent to the Copernicus Data Space Ecosystem Sentinel Hub API using OAuth2 client credentials you provide. Data sent includes: bounding box coordinates, date ranges, cloud cover thresholds, and processing parameters. The API returns satellite imagery tiles. The Catalog API is also queried to list available scenes for a location. No personal data is sent — only geographic coordinates and dates. See the [Copernicus Data Space Terms](https://dataspace.copernicus.eu/terms-and-conditions).

### Archive.is and Internet Archive (optional)

When enabled, Argus checks whether archived versions of visited pages exist on archive.is and/or the Internet Archive Wayback Machine. Only the page URL is sent — no page content. These checks can be disabled in settings.

### Cloud Backup Providers (user-configured, optional)

If you enable cloud backup, Argus connects to cloud storage services **using credentials you provide**. Argus does not operate any servers — your data goes directly from your browser to your own cloud storage account.

Supported providers:
- **Google Drive** — uses OAuth2 with your own GCP Client ID. Argus requests `drive.file` scope (access only to files it creates). Backups are stored in a `Google Drive/Argus Backups/` folder.
- **Dropbox** — uses OAuth2 PKCE with your own Dropbox App Key. Backups are stored in `/Apps/Argus/`.
- **WebDAV** — connects to any WebDAV server (Nextcloud, ownCloud, Synology, etc.) using URL + username + password you provide.
- **S3-compatible** — connects to any S3-compatible storage (Backblaze B2, Wasabi, Cloudflare R2, AWS S3, MinIO) using endpoint URL + access key + secret key you provide.

OAuth tokens are stored locally in `browser.storage.local`. The "Wipe Everything" button revokes tokens and clears all stored credentials. API keys for AI providers are **excluded** from backups by default.

### RSS Feeds (user-configured)

Argus fetches RSS/Atom feeds from URLs you add. Only standard HTTP requests to the feed URLs are made.

## Data NOT Collected

Argus does **not**:

- Collect or transmit analytics or telemetry
- Track browsing history beyond what you explicitly analyze
- Send data to the developer or any third party
- Use cookies or tracking pixels
- Require account creation or login
- Phone home or check for updates independently

## Permissions

Argus requests the following browser permissions:

- **activeTab / tabs** — to read the current page for analysis
- **storage / unlimitedStorage** — to store your data locally
- **contextMenus** — to add right-click menu options
- **webRequest / webRequestBlocking** — for archive.is redirect feature
- **webNavigation** — for page monitor and archive availability checks
- **downloads** — to export files (CSV, Markdown, etc.)
- **alarms** — for scheduled page monitoring, feed checks, and cloud backup schedule
- **notifications** — to alert on keyword watchlist matches and monitor changes
- **identity** — for OAuth2 authentication with cloud backup providers (Google Drive, Dropbox)
- **host permissions (`<all_urls>`)** — to analyze any webpage and connect to AI provider APIs

## Contact

For questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/n3r4-life/argus) or contact n3r4-life.

## Changes

Any changes to this privacy policy will be reflected in this document with an updated date. Significant changes will be noted in the extension's release notes.
