# WeKnora Knowledge Integration Design

## Goal

Use the WeKnora `TCRAW` organization as TCraw's knowledge source. TCraw keeps its own user experience, permissions, and agent binding flow, while WeKnora handles document storage, parsing, indexing, and retrieval.

The first implementation scope is read and retrieval integration:

- Load knowledge bases shared into the WeKnora `TCRAW` organization on TCraw's knowledge base page.
- Show WeKnora knowledge documents and parse status in TCraw's knowledge base detail page.
- Let TCraw agents bind one or more WeKnora-backed knowledge bases.
- During agent conversations, search WeKnora and inject matched chunks as context.
- Keep create/upload/delete/edit operations out of the first phase.

## Verified WeKnora Context

Use environment variables for integration configuration:

```env
WEKNORA_API_BASE_URL=https://zitoo.asia/rag/api/v1
WEKNORA_API_KEY=<server-only key>
WEKNORA_ORG_ID=3c6805d0-88c3-46dd-8d20-3a90dd51d63d
```

Verified API behavior:

- `GET /organizations` returns organization `TCRAW`.
- `GET /organizations/{WEKNORA_ORG_ID}/shared-knowledge-bases` returns the `上海致拓` knowledge base.
- `GET /knowledge-bases/{knowledge_base_id}/knowledge` returns document records.
- `POST /knowledge-search` works with `knowledge_base_id` or `knowledge_base_ids`.

The public base URL must be `/rag/api/v1`; `/api/v1` currently routes to another service and returns 502.

## Architecture

TCraw should introduce a server-side WeKnora adapter. Frontend components continue calling TCraw APIs only.

```text
TCraw frontend
  -> TCraw knowledge base routes
  -> TCraw permission checks and response mapping
  -> WeKnora adapter
  -> WeKnora API
```

The API key never reaches the browser. It is read only by the TCraw backend from environment variables.

## Data Model

Extend TCraw knowledge base records to support external providers:

```text
provider: "local" | "weknora"
externalId: WeKnora knowledge_base_id
externalSpaceId: WeKnora organization_id
externalShareId: WeKnora share_id
```

For first phase, TCraw can either persist mirrored records or return mapped records dynamically. The recommended first implementation is a small sync step that upserts WeKnora knowledge bases into TCraw records. This keeps the existing agent binding, permission sharing, and selector queries mostly unchanged.

Mapped knowledge base fields:

| TCraw field | WeKnora source |
| --- | --- |
| `id` | generated TCraw `kb_*` id |
| `name` | `knowledge_base.name` |
| `description` | `knowledge_base.description` |
| `documentCount` | `knowledge_base.knowledge_count` |
| `readyDocumentCount` | `knowledge_count - processing_count` |
| `failedDocumentCount` | count from document list when available, otherwise `0` |
| `lastIndexedAt` | `knowledge_base.updated_at` |
| `provider` | `"weknora"` |
| `externalId` | `knowledge_base.id` |
| `externalSpaceId` | `WEKNORA_ORG_ID` |

Mapped document fields:

| TCraw field | WeKnora source |
| --- | --- |
| `id` | generated/mapped `kbdoc_*` or `knowledge.id` |
| `knowledgeBaseId` | TCraw knowledge base id |
| `file_id` | `knowledge.id` |
| `filename` | `file_name || title` |
| `bytes` | `file_size || storage_size || 0` |
| `mimeType` | derived from `file_type` |
| `status` | `parse_status` mapped to `processing`, `ready`, or `failed` |
| `error` | `error_message` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

Status mapping:

- `completed` -> `ready`
- `failed` -> `failed`
- `pending` or `processing` -> `processing`

## Backend API Behavior

Existing TCraw routes should remain stable:

- `GET /api/knowledge` lists both local and WeKnora-backed knowledge bases.
- `GET /api/knowledge/:id` returns a TCraw-shaped knowledge base.
- `GET /api/knowledge/:id/documents` delegates to WeKnora when `provider === "weknora"`.
- `POST /api/knowledge/:id/documents`, `PATCH /api/knowledge/:id`, and deletes return `501` or a clear disabled-operation error for WeKnora-backed records in the first phase.

Agent binding continues to store TCraw knowledge base ids in `knowledge_base_ids`. At runtime, the agent pipeline resolves those ids. For WeKnora-backed knowledge bases, it calls WeKnora `knowledge-search` with the external ids and injects the returned chunks into the model context.

## Retrieval Flow

When an agent has WeKnora-backed knowledge bases:

1. Resolve TCraw `knowledge_base_ids`.
2. Split into local and WeKnora groups.
3. For WeKnora ids, call:

```http
POST /knowledge-search
{
  "query": "<latest user query>",
  "knowledge_base_ids": ["<externalId>", "..."]
}
```

4. Convert results into concise context blocks containing content, title, filename/source, and score.
5. Add the blocks before the model call using the existing agent context/tooling pattern.

No fallback retrieval should silently mask errors. If WeKnora fails, log the error and surface a concise model-facing note that the selected knowledge base search failed.

## Permissions

TCraw remains the source of truth for user-facing permissions.

- The backend uses one service-level WeKnora API key.
- Users never call WeKnora directly.
- TCraw decides which users can view or bind each mirrored knowledge base.
- Agent sharing follows current TCraw behavior: if an agent is shared, its bound knowledge capability is shared with it.

Initial sync should grant owner/admin permission to the configured admin or service owner. Broader team access should use TCraw's existing knowledge base sharing controls.

## Configuration

Required server-only environment variables:

```env
WEKNORA_API_BASE_URL=https://zitoo.asia/rag/api/v1
WEKNORA_API_KEY=<server-only key>
WEKNORA_ORG_ID=3c6805d0-88c3-46dd-8d20-3a90dd51d63d
```

Optional:

```env
WEKNORA_SYNC_ON_START=true
WEKNORA_SEARCH_TOP_K=8
```

## Error Handling

- Missing config: keep local knowledge base behavior working and return an empty WeKnora set with a backend warning.
- WeKnora list failure: return local knowledge bases and log the WeKnora failure.
- WeKnora document failure: show the error on the knowledge base document page.
- WeKnora search failure during chat: do not invent context; surface that retrieval failed.
- Unsupported mutation on WeKnora-backed records: return a clear operation-not-supported response.

## Testing

Add focused tests for:

- WeKnora adapter request headers and response mapping.
- Knowledge base list merges local and WeKnora-backed records.
- WeKnora document list maps `parse_status` correctly.
- Unsupported mutations on WeKnora-backed records return a clear error.
- Agent retrieval calls `knowledge-search` with external ids and injects returned chunks.

Manual verification:

- Knowledge base page shows `上海致拓` from the `TCRAW` WeKnora space.
- Detail page shows its documents and statuses.
- Agent selector can bind `上海致拓`.
- A conversation with a bound agent calls WeKnora search and uses returned content.

## First Implementation Plan Boundary

This design intentionally does not include:

- Editing WeKnora knowledge base settings from TCraw.
- Uploading documents from TCraw into WeKnora.
- Deleting WeKnora documents from TCraw.
- Per-user WeKnora accounts or per-user WeKnora API keys.

Those can be added after the read/retrieval path is working end to end.
