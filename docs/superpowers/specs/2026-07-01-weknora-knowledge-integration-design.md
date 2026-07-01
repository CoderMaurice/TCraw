# WeKnora Knowledge Integration Design

## Goal

Use the WeKnora `TCRAW` organization as TCraw's knowledge source. TCraw keeps its own user experience, permissions, and agent binding flow, while WeKnora handles document storage, parsing, indexing, and retrieval.

The target state is a full WeKnora-backed knowledge workspace inside TCraw:

- Load knowledge bases shared into the WeKnora `TCRAW` organization on TCraw's knowledge base page.
- Create new knowledge bases from TCraw and share them into the WeKnora `TCRAW` organization.
- Show WeKnora knowledge documents and parse status in TCraw's knowledge base detail page.
- Upload documents from TCraw into WeKnora knowledge bases.
- Show durable document processing state after refresh or navigation.
- Show parse failure reasons and support re-upload/reparse where WeKnora supports it.
- Let TCraw agents bind one or more WeKnora-backed knowledge bases.
- During agent conversations, search WeKnora and inject matched chunks as context.
- Keep TCraw's UI, permission model, and agent sharing semantics as the user-facing system of record.

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
- `POST /knowledge-bases` creates a WeKnora knowledge base.
- `POST /knowledge-bases/{id}/shares` shares a WeKnora knowledge base into an organization.
- `GET /knowledge-bases/{knowledge_base_id}/knowledge` returns document records.
- `POST /knowledge-bases/{knowledge_base_id}/knowledge/file` uploads a document and returns a persistent processing record.
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

TCraw should persist mirrored records for WeKnora knowledge bases. A dynamic-only list would make agent binding, sharing, and per-user permissions harder to keep stable. Mirrored records keep the existing TCraw ids and permission checks while using WeKnora external ids for storage and retrieval.

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
- `POST /api/knowledge` creates a WeKnora knowledge base, shares it into the `TCRAW` organization, mirrors it into TCraw, and grants TCraw permissions.
- `POST /api/knowledge/:id/documents` uploads to WeKnora for WeKnora-backed records and immediately returns the persisted WeKnora processing record mapped into TCraw's document shape.
- `PATCH /api/knowledge/:id` updates WeKnora and TCraw mirrored metadata when supported.
- `DELETE /api/knowledge/:id/documents/:documentId` deletes the WeKnora knowledge item when supported.
- `DELETE /api/knowledge/:id` should be conservative: first implementation can hide/unmirror from TCraw or require explicit confirmation before deleting the WeKnora knowledge base itself.

Agent binding continues to store TCraw knowledge base ids in `knowledge_base_ids`. At runtime, the agent pipeline resolves those ids. For WeKnora-backed knowledge bases, it calls WeKnora `knowledge-search` with the external ids and injects the returned chunks into the model context.

## WeKnora Write Flow

Creating a knowledge base from TCraw:

1. TCraw validates user permissions.
2. TCraw calls `POST /knowledge-bases` with WeKnora defaults for document knowledge bases.
3. TCraw calls `POST /knowledge-bases/{externalId}/shares` to share it into `WEKNORA_ORG_ID` with editor permission.
4. TCraw upserts a mirrored knowledge base record with `provider="weknora"`.
5. TCraw grants the creator owner permissions in its own permission system.

Uploading a document:

1. TCraw validates edit permission on the mirrored knowledge base.
2. TCraw forwards the file to `POST /knowledge-bases/{externalId}/knowledge/file`.
3. TCraw maps the returned WeKnora knowledge record to a TCraw document shape.
4. The document remains visible immediately with `processing` status.
5. Document list refreshes read WeKnora as the source of truth, so status survives page refreshes and navigation.

Failure and retry behavior:

- `parse_status=failed` maps to `failed`.
- `error_message` is shown in TCraw's failure dialog.
- Re-upload opens the file picker and creates a new WeKnora knowledge record.
- If WeKnora reparse is exposed for the record type, TCraw can add a separate `重新解析` action later.

Deleting behavior:

- Document delete maps to WeKnora `DELETE /knowledge/{id}`.
- Knowledge base delete should not silently remove shared enterprise data. The UI should present this as a dangerous action and explain that it deletes or disconnects the underlying WeKnora knowledge base depending on the configured mode.

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

When TCraw creates a WeKnora knowledge base, the backend shares it into the `TCRAW` organization immediately. Users still do not receive the WeKnora API key, and TCraw remains the gateway for all write operations.

## UI Requirements

The knowledge base page should feel like a native TCraw page, not an embedded WeKnora screen.

List page:

- Show name, description, document count, processing count, failed count, source badge, updated time, and access state.
- Use a compact card/table layout consistent with the current TCraw UI.
- Provide search and clear empty/loading/error states.
- The create button creates a WeKnora-backed knowledge base in the `TCRAW` space.

Detail page:

- Header shows knowledge base name, description, document count, processing count, failed count, and source badge.
- Documents tab shows rows immediately after upload with status.
- Failed rows expose `查看原因` and `重新上传`.
- Processing rows should remain visible and refreshable.
- Access tab remains TCraw permission management.
- Settings tab can edit TCraw-facing name/description first; WeKnora metadata sync can be added when the backend endpoint is in place.

Agent configuration:

- The knowledge base picker shows WeKnora-backed knowledge bases together with local ones.
- The picker should clearly show document count and source, but avoid exposing WeKnora implementation details to normal users.

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
- WeKnora create/share failure: do not create a dangling TCraw record; surface a concise create failure.
- WeKnora upload failure before record creation: show upload failure toast.
- WeKnora upload succeeds but parsing later fails: keep the document row and show `error_message`.
- WeKnora document failure: show the error on the knowledge base document page.
- WeKnora search failure during chat: do not invent context; surface that retrieval failed.
- Unsupported mutation on WeKnora-backed records: return a clear operation-not-supported response until that mutation is implemented.

## Testing

Add focused tests for:

- WeKnora adapter request headers and response mapping.
- Knowledge base list merges local and WeKnora-backed records.
- WeKnora document list maps `parse_status` correctly.
- Knowledge base create calls WeKnora create, shares into `TCRAW`, and mirrors the record.
- Document upload calls WeKnora upload and returns a durable processing row.
- Failed WeKnora documents show error reasons and re-upload entry points.
- Agent retrieval calls `knowledge-search` with external ids and injects returned chunks.

Manual verification:

- Knowledge base page shows `上海致拓` from the `TCRAW` WeKnora space.
- Detail page shows its documents and statuses.
- Creating a knowledge base in TCraw creates and shares it into the WeKnora `TCRAW` space.
- Uploading a document in TCraw creates a WeKnora knowledge record and shows processing status after refresh.
- Agent selector can bind `上海致拓`.
- A conversation with a bound agent calls WeKnora search and uses returned content.

## Implementation Phases

Phase 1: Read and retrieval.

- Configure WeKnora adapter.
- Mirror/list TCRAW space knowledge bases.
- Show document lists and statuses.
- Bind knowledge bases to agents.
- Retrieve from WeKnora during agent conversations.

Phase 2: Create and upload.

- Create WeKnora-backed knowledge bases from TCraw.
- Share created knowledge bases into TCRAW.
- Upload documents to WeKnora from TCraw.
- Show durable processing state, failure reason, and re-upload.

Phase 3: Management and polish.

- Delete documents.
- Decide between unmirror vs delete for knowledge base delete.
- Add metadata sync for settings edits where safe.
- Improve list/detail UI density, badges, status presentation, and empty states.

Out of scope until explicitly needed:

- Per-user WeKnora accounts or per-user WeKnora API keys.
- Embedding WeKnora's frontend inside TCraw.
