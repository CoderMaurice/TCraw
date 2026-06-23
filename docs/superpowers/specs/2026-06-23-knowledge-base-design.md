# Knowledge Base Module Design

## Summary

Add a full team-aware knowledge base module to LibreChat by reusing the existing Group, ACL, file upload, RAG API, pgvector, and Agent tool infrastructure. The module introduces knowledge bases as first-class resources that contain documents, can be shared with users or groups, and can be bound to Agents. When an Agent is shared, its bound knowledge bases are part of the Agent capability: any user who can use that Agent can query those knowledge bases through the Agent, while direct knowledge base management remains controlled by knowledge base ACL.

This design intentionally avoids a separate Team permission system, per-document permissions, separate vector storage, extra sharing warnings, and silent fallback behavior.

## Confirmed Product Rules

- Reuse existing systems wherever they fit; introduce new models only for knowledge base business concepts.
- Teams are represented by the existing `Group` model and existing ACL principal type.
- Knowledge base permissions are managed through the existing ACL system.
- Documents must belong to a knowledge base.
- Documents do not have independent permissions.
- Agent creators/editors can bind only knowledge bases they can access.
- Agent sharing carries the Agent's knowledge base retrieval capability.
- Agent users do not need direct knowledge base permission to query a bound knowledge base through the Agent.
- Users who can use an Agent do not automatically gain direct access to manage, list, edit, or delete the bound knowledge bases.
- Editing or copying an Agent revalidates the editor's permission to the submitted knowledge base bindings.
- Binding at least one knowledge base automatically enables the Agent `file_search` capability.

## Existing Infrastructure To Reuse

- `Group` for local or Entra-backed teams.
- `AclEntry`, `PrincipalType`, `ResourceType`, `PermissionBits`, and access roles for resource permissions.
- Existing principal search for users and groups.
- Existing file upload and storage path.
- Existing RAG API upload and query path.
- Existing pgvector-backed `vectordb`.
- Existing Agent `tools`, `tool_resources`, and `file_search` runtime.
- Existing UI patterns for Agent configuration, permissions, file upload, list pages, dialogs, and compact settings panels.

## Data Model

### KnowledgeBase

Stores the knowledge base resource itself.

Fields:

- `id`: Stable external ID.
- `name`: Display name.
- `description`: Optional description.
- `author`: Creating user.
- `authorName`: Display name for the creator.
- `documentCount`: Total documents.
- `readyDocumentCount`: Documents available for retrieval.
- `failedDocumentCount`: Documents whose embedding or processing failed.
- `lastIndexedAt`: Last successful document indexing timestamp.
- `tenantId`: Tenant scope.
- `createdAt`, `updatedAt`.

Permissions are not embedded in this document. They are managed through the existing ACL system with a new `ResourceType.KNOWLEDGE_BASE`.

### KnowledgeBaseDocument

Stores each document contained in a knowledge base.

Fields:

- `id`: Stable external ID.
- `knowledgeBaseId`: Parent knowledge base ID.
- `file_id`: Existing File record ID.
- `filename`: Display filename.
- `bytes`: File size.
- `mimeType`: Uploaded file MIME type.
- `status`: `processing`, `ready`, or `failed`.
- `error`: Failure message when status is `failed`.
- `createdBy`: Uploading user.
- `tenantId`: Tenant scope.
- `createdAt`, `updatedAt`.

Documents inherit all permissions from their parent knowledge base.

### Agent Extension

Add:

- `knowledge_base_ids: string[]`

The Agent stores only knowledge base bindings, not expanded document IDs. Runtime resolves bound knowledge bases to ready document file IDs.

## ACL Additions

Add resource type:

- `knowledgeBase`

Add access roles:

- `knowledgeBase_viewer`: `VIEW`
- `knowledgeBase_editor`: `VIEW | EDIT`
- `knowledgeBase_owner`: `VIEW | EDIT | DELETE | SHARE`

ACL behavior follows existing resource permission patterns:

- Knowledge bases can be shared with users, groups, roles, and public if later exposed.
- The first implementation should use users and groups in UI.
- Owner ACL is granted to the creator on create.

## API Design

### Knowledge Base Resource APIs

`GET /api/knowledge-bases`

- Lists knowledge bases visible to the current user.
- Supports `search`, `cursor`, and `limit`.
- Uses ACL to determine visibility.

`POST /api/knowledge-bases`

- Creates a knowledge base.
- Grants owner permission to the creator.

`GET /api/knowledge-bases/:id`

- Requires `VIEW`.
- Returns knowledge base detail and summary counts.

`PATCH /api/knowledge-bases/:id`

- Requires `EDIT`.
- Updates name and description.

`DELETE /api/knowledge-bases/:id`

- Requires `DELETE`.
- Deletes the knowledge base, contained document records, files, and RAG embeddings.

### Document APIs

`GET /api/knowledge-bases/:id/documents`

- Requires `VIEW`.
- Lists documents in the knowledge base.

`POST /api/knowledge-bases/:id/documents`

- Requires `EDIT`.
- Uploads one or more documents.
- Uses existing storage and RAG embedding path.
- Creates `KnowledgeBaseDocument` records.

`DELETE /api/knowledge-bases/:id/documents/:documentId`

- Requires `EDIT` or `DELETE`.
- Deletes the document, existing File record, and RAG embedding.

### Permission APIs

Reuse existing permission APIs with `resourceType=knowledgeBase`.

The knowledge base module should not introduce a separate permission API.

### Agent APIs

Extend create/update Agent request bodies with:

```json
{
  "knowledge_base_ids": ["kb_1", "kb_2"]
}
```

Validation:

- Reject unknown knowledge base IDs.
- Reject knowledge base IDs the editor cannot view.
- Reject rather than silently filtering invalid bindings.
- Automatically include `file_search` in Agent tools when the submitted list is non-empty.

## Runtime Flow

1. User sends a message to an Agent.
2. Agent initialization reads `knowledge_base_ids`.
3. Runtime resolves all ready documents under those knowledge bases.
4. Runtime expands those documents to `file_id` values.
5. Runtime injects file IDs into `tool_resources.file_search.file_ids`.
6. Runtime ensures `file_search` is available.
7. The existing `file_search` tool queries the RAG API.
8. Existing citation and source rendering remains in use.

Runtime does not filter knowledge base files by the current user's direct knowledge base ACL. Permission to use the Agent is the gate for using the Agent's bound knowledge base capability.

## Frontend Design

### Knowledge Base List Page

Add a `Knowledge` entry to the product navigation.

The page should follow existing LibreChat UI patterns:

- Compact list layout.
- Search input.
- New knowledge base button.
- Rows with name, description, document counts, status summary, updated time, and access source.

Access source labels:

- Owned
- Shared
- Team

### Knowledge Base Detail Page

Sections:

- Header: name, description, counts, updated time.
- Documents: upload, document table, status, error, delete action.
- Access: existing permissions component and principal search.
- Settings: rename, description edit, delete knowledge base.

### Agent Configuration

Add a `Knowledge Bases` section near the existing File Search area.

Behavior:

- Show selected knowledge bases as a compact list or chips.
- Add button opens a selector.
- Selector lists only knowledge bases the editor can view.
- Selecting at least one knowledge base enables `file_search`.
- Save submits `knowledge_base_ids`.
- Backend remains authoritative.

## Error Handling

- Knowledge base create/update/delete failures return normal API errors.
- Upload failures create or update document status as `failed` with an error message.
- Embedding failures are visible as failed document status.
- Agent create/update rejects inaccessible or unknown knowledge base IDs.
- Runtime with no ready documents should behave as a valid empty retrieval set for that Agent, not silently switch to unrelated sources.
- No fallback path should mask RAG failures as successful indexing.

## Testing

Backend:

- Knowledge base CRUD permission checks.
- Owner ACL creation on knowledge base creation.
- User and group ACL visibility for list/detail.
- Document upload creates File and KnowledgeBaseDocument records.
- Embedding failure marks document failed.
- Document deletion removes file and embedding.
- Agent create/update rejects inaccessible knowledge bases.
- Agent create/update auto-enables `file_search` when knowledge bases are bound.
- Agent runtime resolves bound knowledge bases to ready document file IDs.
- Shared Agent use does not require direct knowledge base ACL.

Frontend:

- Knowledge base list loads visible resources.
- Knowledge base detail handles documents and status states.
- Access tab reuses existing permission flows.
- Agent config selector lists accessible knowledge bases.
- Binding knowledge bases enables file search in form state.

Integration:

- Create knowledge base, upload document, bind to Agent, chat with Agent, verify RAG results are available.
- Share Agent with another user who lacks direct knowledge base ACL, verify chat can use Agent retrieval while direct knowledge base page remains inaccessible.

## Implementation Phases

### Phase 1: Backend foundation

- Add data schemas, models, methods, and resource type.
- Add access roles for knowledge bases.
- Add knowledge base CRUD APIs.
- Add document APIs and RAG upload/delete integration.

### Phase 2: Agent binding and runtime

- Extend Agent schema/types/validation with `knowledge_base_ids`.
- Validate bindings on create/update.
- Auto-enable `file_search` when bindings exist.
- Resolve ready knowledge base documents during Agent initialization.

### Phase 3: Frontend management UI

- Add knowledge base list and detail pages.
- Add document upload/status/delete UI.
- Add access management UI using existing permission components.

### Phase 4: Agent configuration UI

- Add knowledge base selector to Agent config.
- Save `knowledge_base_ids`.
- Reflect automatic `file_search` enablement.

### Phase 5: Verification and polish

- Add focused tests across data schemas, API, Agent runtime, and frontend.
- Run local app against existing remote infrastructure.
- Verify UI visual consistency with existing LibreChat pages.

## Out Of Scope

- Per-document permissions.
- Separate Team model or separate Team permission system.
- Separate vector database abstraction.
- Separate knowledge retrieval tool beyond `file_search`.
- Share warning UX.
- Silent fallback when RAG indexing/querying fails.
