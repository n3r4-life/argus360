# Argus Semantic Index — Proposal

## Summary

Add a manually-triggered vector index layer that lets users selectively deploy curated research data to a cloud-hosted semantic search engine. This is not ambient sync — it is a deliberate action the user takes when they want to unlock deep, cross-session, natural-language retrieval over their accumulated intelligence.

The existing cloud backup/sync layer (Google Drive, Dropbox, S3, GitHub, WebDAV) continues to handle housekeeping automatically. The semantic index is a separate tier: a weapon you choose to load, not plumbing that runs in the background.

---

## Problem Statement

Argus currently supports keyword search on individual stores — history, bookmarks, KG nodes, sources, chat sessions. Each search is scoped to one data type and requires the user to remember exact terms.

This breaks down in three ways:

1. **Cross-domain recall** — "What was that company connected to lithium mining I looked at last month?" requires the user to know whether the answer lives in bookmarks, KG entities, project items, or analysis history, and to guess the right keywords.

2. **Semantic proximity** — Keyword search misses conceptual relationships. A page about "rare earth supply chains" is related to research on "EV battery manufacturers" but shares no exact terms.

3. **Context assembly** — The Chat and Workbench tools can only use context from whatever is manually loaded. A vector index lets them pull relevant prior research automatically, turning every conversation into a RAG-powered query over the user's entire curated knowledge base.

---

## Design Principles

### Manual deployment, not auto-sync

The user explicitly chooses what enters the index and when. This is the critical distinction from the existing cloud layer. Reasons:

- **Cost control** — Embedding generation costs real API tokens. The user decides when to spend them, on what, and can see exactly what they're paying for.
- **Signal quality** — A curated index outperforms a dump. Everything in the vector store is something the user deliberately decided was worth indexing. Retrieval quality is dramatically better.
- **Privacy intent** — Some research should never leave the device. Manual deployment makes the boundary explicit. The user is never surprised by what ended up in a cloud index.
- **Argus identity** — This is an OSINT tool. "Deploy to index" feels like loading a weapon. "Auto-syncing to Pinecone" feels like enterprise middleware.

### Existing provider keys for embeddings

No new API accounts for embedding generation. Argus already holds keys for OpenAI, xAI, Anthropic, and Gemini. Each of these offers embedding endpoints. The user's default AI provider (or an explicit override) generates the vectors.

### Provider-pattern architecture

The vector store backend follows the exact same pattern as `cloud-providers.js` and `background-providers.js`: a `VectorProviders` object with per-backend implementations behind a unified interface. Configuration lives in the existing Providers tab.

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `lib/vector-providers.js` | Vector store backend implementations (Pinecone, xAI Collections, Qdrant Cloud, custom) |
| `lib/embedding.js` | Embedding generation via existing AI provider keys |
| `lib/semantic-index.js` | Orchestration layer: item selection → embedding → upsert, query → retrieval → context assembly |

### Modified Files

| File | Change |
|------|--------|
| `background.js` | New message handlers: `semanticDeploy`, `semanticQuery`, `semanticRemove`, `semanticStatus` |
| `background-providers.js` | Add `callProviderEmbedding()` router (parallel to `callProvider()` / `callProviderStream()`) |
| `options/options.html` | Vector provider config UI in the Providers tab (new section below Data Providers) |
| `options/options.js` | Vector provider tab logic, connection test, status indicators |
| `osint/graph.html` / `graph.js` | "Deploy selection to index" button on KG view |
| `options/options.js` (Projects section) | "Deploy project to index" action in project toolbar |
| `chat/chat.js` | Toggle: "Use semantic index" that enables RAG context injection |
| `lib/storage-db.js` | New `semanticMeta` store for tracking what's been indexed (item ID → vector ID mapping, last indexed timestamp) |

### No New Dependencies

All vector store APIs are REST-based. Embedding endpoints are standard HTTP calls to existing providers. No new libraries required.

### No New Permissions

All network calls go through the same `fetch()` paths Argus already uses for AI providers and cloud backup. No new host permissions needed (vector store endpoints are user-configured, same as custom AI providers and S3/WebDAV).

---

## Embedding Pipeline

### Provider Routing

New function in `background-providers.js`:

```
callProviderEmbedding(provider, apiKey, model, texts) → Promise<float[][]>
```

| Provider | Endpoint | Default Model | Dimensions |
|----------|----------|---------------|------------|
| OpenAI | `POST /v1/embeddings` | `text-embedding-3-small` | 1536 |
| xAI | `POST /v1/embeddings` (OpenAI-compatible) | TBD (Grok embedding model) | TBD |
| Anthropic | Voyager via API (if available) or fallback to OpenAI | — | — |
| Gemini | `POST /v1beta/models/{model}:embedContent` | `text-embedding-004` | 768 |
| Custom | `POST {baseUrl}/v1/embeddings` | User-configured | User-configured |

Argus sends batches of text chunks and receives vectors back. The orchestration layer handles chunking, batching (to respect rate limits), and progress reporting.

### Text Preparation

Each indexable item is converted to a text representation before embedding:

| Source | Text Format |
|--------|-------------|
| KG Node | `{type}: {label}. Aliases: {aliases}. Sources: {sourcePages[].title}. First seen: {firstSeen}` |
| KG Edge | `{sourceNode.label} → {relationType} → {targetNode.label}. Weight: {weight}. Sources: {sourcePages[].title}` |
| Project Item | `{title}. URL: {url}. Tags: {tags}. Notes: {notes}. Summary: {aiSummary}` |
| Bookmark | `{title}. URL: {url}. Tags: {tags}. Category: {category}. Summary: {summary}` |
| Analysis History | `Analysis of "{pageTitle}" ({preset}). {content} [truncated to 2000 chars]` |
| Source Profile | `{name}. Type: {type}. Aliases: {aliases}. Location: {location}. Notes: {notes}` |
| Chat Session | `Chat: {title}. {messages[].content} [truncated to 2000 chars]` |

### Metadata Attached to Each Vector

Every upserted vector carries metadata for filtered retrieval:

```json
{
  "argus_type": "kg_node|kg_edge|project_item|bookmark|analysis|source|chat",
  "argus_id": "kgn-person-a1b2c3",
  "project_id": "proj-...",
  "source_url": "https://...",
  "entity_type": "person|organization|location|...",
  "timestamp": 1710000000000,
  "title": "Human-readable label",
  "tags": ["tag1", "tag2"]
}
```

This enables scoped queries: "search only within this project," "only KG entities," "only items from the last 30 days."

---

## Vector Store Providers

### Interface

Every backend implements:

```javascript
const VectorProviders = {
  pinecone: {
    isConnected() → Promise<bool>,
    connect(config) → Promise<{success}>,
    disconnect() → Promise<{success}>,
    testConnection() → Promise<{success}>,
    upsert(vectors) → Promise<{upserted: number}>,
    query(vector, options) → Promise<{matches: [{id, score, metadata}]}>,
    remove(ids) → Promise<{deleted: number}>,
    stats() → Promise<{vectorCount, indexFullness, dimension}>,
  },
  // xai, qdrant, custom — same interface
};
```

### Pinecone

- REST API: `https://{index-host}`
- Auth: API key in header
- Config: API key + index name (host resolved via `https://api.pinecone.io/indexes/{name}`)
- Free tier: 100K vectors, 1 index — plenty for personal OSINT use
- Namespaces can separate projects if desired

### xAI Collections

- If/when xAI exposes a collections or memory API, this becomes a zero-config option for users whose default provider is already xAI
- Implementation would follow whatever REST interface they publish
- Placeholder backend that checks for API availability and gracefully reports "not yet available" if the endpoint doesn't exist

### Qdrant Cloud

- REST API: `https://{cluster-url}:6333`
- Auth: API key in header
- Config: cluster URL + API key + collection name
- Free tier: 1GB storage
- Good alternative for users who want self-hosted option (Qdrant also runs locally via Docker)

### Custom (OpenAI-compatible)

- Same pattern as the custom AI provider: user provides base URL
- Expects standard `/vectors/upsert`, `/vectors/query`, `/vectors/delete` or similar
- Covers self-hosted options like Chroma, Weaviate, Milvus running locally

---

## User Interface

### Providers Tab — Vector Index Section

New section below "Data Providers" in `options/options.html`:

```
┌─────────────────────────────────────────────┐
│  Vector Index                                │
│                                              │
│  [Pinecone] [xAI] [Qdrant] [Custom]        │
│                                              │
│  API Key:  [________________________]        │
│  Index:    [________________________]        │
│                                              │
│  Embedding Provider: [Default ▾]             │
│  (Uses your configured AI provider keys)     │
│                                              │
│  Status: ● Connected (12,847 vectors)        │
│  [Test Connection]                           │
└─────────────────────────────────────────────┘
```

Tab indicators follow the same `.configured` class pattern as AI and data providers.

### Deploy Actions

**From Projects toolbar:**
- New button: **"Deploy to Index"** (or icon with upload-to-cloud glyph)
- Deploys all project items + extracted KG entities scoped to that project
- Progress bar: "Embedding 23/47 items... Upserting to Pinecone..."
- On completion: "Deployed 47 items (142 vectors) to index"

**From Knowledge Graph view:**
- Selection mode (lasso or shift-click nodes) + **"Deploy Selected"** button
- Indexes selected nodes and their connecting edges
- Also available as "Deploy All" for the entire graph or project-scoped subgraph

**From Bookmarks toolbar:**
- Select mode + **"Deploy Selected to Index"**
- Indexes selected bookmarks with their AI-generated summaries and tags

**From Sources:**
- Select mode + **"Deploy to Index"**
- Indexes source profiles with aliases, notes, and address data

### Semantic Query in Chat

Toggle in the Chat interface header bar:

```
[Provider: Grok ▾]  [🔍 Semantic Index: ON]
```

When enabled, before sending a user message to the AI provider:
1. Generate embedding of the user's message
2. Query vector index for top-K similar items (K=10, configurable)
3. Assemble retrieved items into a context block
4. Inject into the system prompt: `"Relevant prior research from the user's Argus index:\n{retrieved_context}"`
5. Send augmented prompt to AI provider

The user sees a subtle indicator below each AI response: "📎 3 items from index" (expandable to show which items were retrieved and their similarity scores).

### Semantic Query in Workbench

Same RAG injection when a project has indexed items. The Workbench system prompt already includes project context — semantic retrieval supplements it with related items from across all indexed projects.

### Index Management

**Settings → Storage Management** (existing section), new subsection:

```
┌─────────────────────────────────────────────┐
│  Semantic Index                              │
│                                              │
│  Vectors: 12,847                             │
│  Sources: 3 projects, 412 KG entities,       │
│           89 bookmarks, 24 source profiles   │
│  Last deploy: 2 hours ago                    │
│                                              │
│  [View indexed items]  [Purge index]         │
└─────────────────────────────────────────────┘
```

"View indexed items" opens a searchable list of everything in the index with source type, title, deploy date, and a "Remove" action per item.

---

## Local Tracking: `semanticMeta` Store

New IndexedDB store in `storage-db.js`:

```javascript
semanticMeta: {
  keyPath: "id",
  indexes: [
    { name: "argusId", keyPath: "argusId" },
    { name: "provider", keyPath: "provider" },
    { name: "deployedAt", keyPath: "deployedAt" },
    { name: "projectId", keyPath: "projectId" }
  ]
}
```

Each record:

```json
{
  "id": "vec-abc123",
  "argusId": "kgn-person-a1b2c3",
  "argusType": "kg_node",
  "vectorId": "vec-abc123",
  "provider": "pinecone",
  "deployedAt": 1710000000000,
  "projectId": "proj-...",
  "textHash": "sha256-...",
  "dimension": 1536
}
```

This enables:
- Knowing whether an item has already been indexed (skip re-embedding if unchanged)
- Re-deploying only items that changed since last deploy (compare `textHash`)
- Removing vectors when the source item is deleted locally
- Showing "indexed" badges on items in the UI
- Accurate stats in the index management panel

---

## Query Flow (Detail)

```
User types question in Chat (semantic index toggle ON)
    │
    ▼
embedding.js: callProviderEmbedding(provider, key, model, [question])
    │
    ▼
vector-providers.js: activeProvider.query(vector, {
    topK: 10,
    filter: { /* optional project/type scope */ }
})
    │
    ▼
Results: [{id, score, metadata}, ...]
    │
    ▼
semantic-index.js: resolveMatches(results)
    → For each match, look up semanticMeta by vectorId
    → Fetch the original item from ArgusDB (KGNodes, Bookmarks, etc.)
    → Build context string with source attribution
    │
    ▼
Inject into system prompt as "Relevant prior research" block
    │
    ▼
Normal chat flow continues with augmented context
```

### Similarity Threshold

Matches below a configurable score threshold (default 0.7) are excluded. This prevents low-relevance noise from polluting the context window.

### Token Budget

Retrieved context is capped at a configurable token budget (default 2000 tokens). Items are added in descending similarity order until the budget is reached. This prevents the semantic context from crowding out the actual conversation.

---

## Privacy & Safety

### Explicit consent at every stage

- Vector index is **off by default**. No provider is configured on install.
- Every deployment is manually triggered. Nothing is indexed without the user clicking a button.
- The "Semantic Index: ON" toggle in Chat is per-session and defaults to OFF.

### Data boundary clarity

- The existing cloud backup layer syncs encrypted ZIP archives of your full database. It's a safety net.
- The semantic index contains **embeddings + metadata** — not raw content. The embedding is a mathematical representation, not the original text. Metadata includes titles, types, URLs, and tags, but not full analysis content or page text.

### Respect existing exclusions

- Items from pages on the Forced-Private / Incognito exclusion list are never eligible for deployment.
- If a project is marked private (future feature), its items are blocked from indexing.

### Purge capability

- "Purge index" in settings sends delete requests for all tracked vectors and clears the `semanticMeta` store.
- Per-item removal is supported.
- Disconnecting a vector provider does not delete remote data — the user must explicitly purge first (with a confirmation dialog explaining this).

---

## Embedding Cost Estimates

Rough per-item costs at current pricing (as of early 2025):

| Provider | Model | Cost per 1M tokens | ~Cost per 1000 items |
|----------|-------|--------------------|-----------------------|
| OpenAI | text-embedding-3-small | $0.02 | ~$0.006 |
| OpenAI | text-embedding-3-large | $0.13 | ~$0.04 |
| Gemini | text-embedding-004 | Free (under quota) | $0.00 |
| xAI | TBD | TBD | TBD |

Assuming average ~300 tokens per prepared text chunk. A heavy user deploying 5,000 items would spend roughly $0.03–$0.20 depending on provider and model. This is negligible.

The real cost consideration is vector store hosting, not embedding generation. Pinecone's free tier (100K vectors) covers most personal use cases comfortably.

---

## Implementation Phases

### Phase 1: Embedding Pipeline + Provider Infrastructure
- `lib/embedding.js` — embedding generation via all five AI provider backends
- `lib/vector-providers.js` — Pinecone backend (first target, simplest REST API)
- `lib/semantic-index.js` — orchestration skeleton: prepare text, embed, upsert, track
- `semanticMeta` store in `storage-db.js`
- Background message handlers in `background.js`

**New code:** ~400–500 lines across 3 new files
**Modified files:** 2 (background.js, storage-db.js)
**Testable milestone:** Deploy a project's items to Pinecone from the console, verify vectors appear in Pinecone dashboard.

### Phase 2: Query + RAG Integration
- Query flow in `semantic-index.js`: embed question → query provider → resolve matches → build context
- Chat integration: toggle UI, context injection into system prompt, source attribution display
- Workbench integration: same RAG path with project-scoped filtering

**New code:** ~200–300 lines
**Modified files:** 3 (chat.js, background.js, plus workbench if scoped in)
**Testable milestone:** Ask a question in Chat with semantic toggle on, see retrieved context influence the response.

### Phase 3: Deploy UI + Management
- "Deploy to Index" buttons on Projects, KG view, Bookmarks, Sources
- Progress reporting (embedding progress, upsert progress)
- Index management panel in Settings (stats, item list, purge)
- "Indexed" badges on items that have been deployed
- Delta detection: skip re-embedding unchanged items

**New code:** ~300–400 lines (mostly UI)
**Modified files:** 5–6 (options.html, options.js, graph.js, project section, bookmarks section)
**Testable milestone:** Full deploy-query-manage workflow from the UI.

### Phase 4: Additional Providers
- Qdrant Cloud backend
- xAI Collections backend (when/if API available)
- Custom backend (OpenAI-compatible vector API)
- Provider tab UI with connection testing for each

**New code:** ~200–300 lines (mostly provider implementations following established pattern)
**Modified files:** 2 (vector-providers.js, options.html/js for config panels)

---

## Total Resource Cost

| Resource | Cost |
|----------|------|
| Total new code | ~1100–1500 lines across all phases |
| New files | 3 (embedding.js, vector-providers.js, semantic-index.js) |
| Modified files | ~8–10 existing files |
| New library dependencies | Zero |
| New browser permissions | Zero |
| Extension size increase | < 20KB |
| IndexedDB schema changes | 1 new store (semanticMeta) |
| Performance impact | Zero when not actively deploying or querying. Deploy operations are user-triggered and show progress. |

**Cost Context**
For comparison, the cloud-providers.js + cloud-backup.js layer that already ships is ~800 lines.
The semantic index delivers a fundamentally new retrieval capability at roughly 1.5–2× the footprint of the existing cloud backup system.

---

## Open Questions

1. **xAI Collections** — Does xAI currently expose a vector storage / collections API? If so, what's the interface? This could be the lowest-friction option for Grok-default users. Needs investigation.

2. **Embedding model selection** — Should the user pick an embedding model separately from their chat model, or should Argus auto-select the best embedding model for each provider? Recommendation: auto-select with an advanced override.

3. **Namespace/collection strategy** — Should each Argus project map to a vector namespace/collection, or should everything go into one flat index with metadata filtering? Recommendation: single index with metadata filters (simpler, and metadata filtering is fast on all major providers).

4. **Re-index triggers** — When a KG entity gets updated (new mentions, merged with another entity), should Argus flag it as "stale" in the index management UI? Recommendation: yes, show a "needs re-deploy" indicator, but never auto-re-embed.

5. **Local vector fallback** — Should Phase 1 include a minimal in-browser vector store (e.g., brute-force cosine similarity over IndexedDB-stored vectors) for users who don't want any cloud dependency? This is feasible for <5000 vectors but adds complexity. Could be a Phase 5 item.

6. **Cross-device** — If a user has Argus on two machines pointing at the same Pinecone index, queries work from either device but deployment only includes items from whichever machine did the deploy. Is this acceptable, or does it need a merge/sync strategy? Recommendation: acceptable for v1, document the limitation.
