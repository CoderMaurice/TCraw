# WeKnora Knowledge Lifecycle Design

## Goal

Make TCraw own the enterprise knowledge-base product flow while using WeKnora as the RAG engine. The backend must create, initialize, share, mirror, upload, index, authorize, and search knowledge bases through explicit states before the UI exposes create or upload actions.

## Problem

The current TCraw integration treats knowledge-base creation as a simple WeKnora create call plus organization sharing. In the current WeKnora deployment, `POST /knowledge-bases` creates an empty shell. It does not automatically finish model defaults, chunking defaults, storage defaults, OCR/VLM settings, or other initialization fields. WeKnora UI then correctly reports that default settings are incomplete.

The missing product boundary is not a UI issue. TCraw needs a server-side lifecycle orchestrator that understands when a knowledge base is configured, searchable, uploadable, failed, or repairable.

## Product Principles

- TCraw is the user-facing system of record for permissions, lifecycle state, and UI language.
- WeKnora is the storage, parsing, indexing, and retrieval engine.
- Browser code never receives WeKnora API keys or model configuration secrets.
- Private/public labels are TCraw ACL labels, not WeKnora organization-sharing labels.
- UI actions are gated by backend capability and lifecycle state, not by optimistic assumptions.
- Failed external operations must leave an inspectable TCraw record when possible, so operators can retry or clean up.

## Architecture

```text
TCraw UI
  -> TCraw knowledge routes
  -> TCraw knowledge lifecycle service
  -> TCraw ACL and mirror records
  -> WeKnora adapter
  -> WeKnora API
```

The WeKnora adapter remains a thin HTTP boundary. The lifecycle service owns ordering, retry policy, permission writes, TCraw state transitions, and user-facing errors.

## Knowledge Base Lifecycle

Add a lifecycle state to TCraw mirrored knowledge-base records.

```text
creating_external
initializing
sharing
ready
failed
archived
```

State meanings:

| State | Meaning | User actions |
| --- | --- | --- |
| `creating_external` | TCraw accepted the request and is creating the WeKnora KB. | none |
| `initializing` | External KB exists and TCraw is applying default WeKnora configuration. | view status only |
| `sharing` | WeKnora config is valid and TCraw is sharing it into the configured organization. | view status only |
| `ready` | Knowledge base is initialized, mirrored, permissioned, and upload/search capable. | upload, bind, search |
| `failed` | One lifecycle step failed. Error and failed step are stored. | retry, delete/disconnect |
| `archived` | TCraw hides or disconnects the record without exposing it as active knowledge. | no phase-1 restore action |

Persist these fields:

```ts
lifecycleStatus: 'creating_external' | 'initializing' | 'sharing' | 'ready' | 'failed' | 'archived';
lifecycleStep: string;
lifecycleError: string;
externalId: string;
externalSpaceId: string;
externalShareId: string;
initializedAt: Date | null;
lastSyncedAt: Date | null;
configTemplateExternalId: string;
```

## Create Flow

The recommended create chain is synchronous enough to return a useful result, but stateful enough to survive partial failure.

```text
1. Validate TCraw CREATE permission.
2. Validate backend WeKnora capability:
   - base URL configured
   - API key configured
   - organization id configured
   - default config template KB configured
3. Create WeKnora knowledge base.
4. Create or update TCraw mirror record:
   - provider = "weknora"
   - lifecycleStatus = "initializing"
   - author = creator
   - TCraw ACL owner = creator
5. Copy initialization config from template KB to the new WeKnora KB.
6. Verify initialization config is complete.
7. Share the WeKnora KB into WEKNORA_ORG_ID with editor permission.
8. Update TCraw mirror:
   - externalShareId
   - lifecycleStatus = "ready"
   - initializedAt
9. Return the TCraw record to UI.
```

If any step after external creation fails, TCraw updates the mirror record to:

```text
lifecycleStatus = failed
lifecycleStep = <failed step>
lifecycleError = <safe user-facing reason>
```

The failed record remains visible only to users with TCraw ACL access. Upload and agent binding stay disabled until retry succeeds.

## Default Configuration Strategy

Use a configured WeKnora template knowledge base.

```env
WEKNORA_DEFAULT_CONFIG_KB_ID=<external WeKnora KB id used only as a config template>
WEKNORA_REQUIRE_INITIALIZED_ON_CREATE=true
```

The backend copies the template configuration through WeKnora initialization APIs:

```text
GET /initialization/config/:template_kb_id
PUT /initialization/config/:new_kb_id
GET /initialization/config/:new_kb_id
```

The adapter must sanitize response handling:

- do not log API keys, model keys, or raw provider credentials
- do not persist copied config in TCraw
- do not return config values to the browser
- omit non-config fields such as file-state indicators when writing config

Verification should check for configured embedding, document splitting, and required model blocks. It should not compare or print secret values.

## Template Selection

Current WeKnora shared knowledge bases with complete initialization config:

| Candidate | External id | Chunking | Notes |
| --- | --- | --- | --- |
| `上海致拓` | `2a2da502-5549-44e7-b98c-ff5b9417b208` | `chunkSize=2048`, `chunkOverlap=80`, 7 separators | Complete config, but it is a real business KB and uses larger chunks. Larger chunks are useful for long-form continuity, but less precise as a general enterprise Q&A default. |
| `FY27-Q1考核规则` | `ad407e39-cfce-4bfc-8234-d3b9c567d054` | `chunkSize=512`, `chunkOverlap=80`, 7 separators | Complete config with the same model stack as `上海致拓`. The smaller chunk size is a better default for policy, process, FAQ, HR, sales, and operational knowledge retrieval. |

Recommended decision:

1. Do not use a business KB directly as the permanent template.
2. Create a dedicated WeKnora KB named `TCraw默认知识库模板`.
3. Seed that template by copying initialization config from `FY27-Q1考核规则`.
4. Store the dedicated template id in `WEKNORA_DEFAULT_CONFIG_KB_ID`.
5. All future TCraw-created knowledge bases copy config from `TCraw默认知识库模板`, not from a live business KB.

The copied config should include only initialization sections:

```text
llm
embedding
documentSplitting
multimodal
nodeExtract
rerank
```

The copied config must exclude file-state or content-derived fields:

```text
hasFiles
document count
knowledge records
document ids
parse results
```

The current complete shared configs use:

```text
embedding dimension = 4096
chunkSize = 512 for the recommended default
chunkOverlap = 80
separators = ["\n\n", "\n", "。", "！", "？", ";", "；"]
multimodal enabled = true
node extraction enabled = false
rerank enabled = false
```

## Upload Flow

Upload is allowed only when:

```text
knowledgeBase.provider === "weknora"
knowledgeBase.lifecycleStatus === "ready"
user has EDIT permission
weknoraClient is configured
```

Flow:

```text
1. Validate TCraw EDIT permission.
2. Validate knowledge base is ready.
3. Stream or forward file to WeKnora.
4. Return the WeKnora document record mapped into TCraw shape.
5. Show document immediately as processing.
6. Refresh document list from WeKnora as source of truth.
7. Mirror aggregate counts into TCraw after list/upload operations.
```

Upload failures before a WeKnora document exists return a toast-level failure. Parse failures after a WeKnora document exists stay visible in the document list with the WeKnora failure reason.

## Document Lifecycle

Use WeKnora parse state as source of truth and map it into TCraw.

```text
uploading
processing
ready
failed
```

Mapping:

| WeKnora status | TCraw status |
| --- | --- |
| `pending` | `processing` |
| `processing` | `processing` |
| `completed` | `ready` |
| `failed` | `failed` |

Only `ready` documents should count toward ready searchable content. Failed documents remain inspectable with failure reasons and can be replaced by re-upload.

## Permissions

TCraw ACL remains the user-facing permission layer.

- Creating a KB grants the creator owner ACL.
- Listing uses TCraw accessible resource ids first.
- TCraw must not auto-grant every user access just because a KB is shared to the WeKnora organization.
- WeKnora organization sharing is a backend integration requirement, not a TCraw public/private decision.
- Agent sharing carries the agent's bound knowledge capability according to TCraw's current agent-sharing semantics.

## Search Flow

An agent can search a knowledge base only when all are true:

```text
agent has bound TCraw knowledge_base_ids
bound records are provider="weknora"
bound records are lifecycleStatus="ready"
current user can access the agent/session
WeKnora search client is configured
```

Runtime flow:

```text
1. Resolve bound TCraw ids to records.
2. Filter non-ready or inaccessible records.
3. Convert TCraw ids to WeKnora external ids.
4. Expose knowledge_search tool with dynamic context explaining the bound knowledge.
5. Tool calls WeKnora /knowledge-search.
6. Results are formatted with title/source/content/score and returned to the model.
7. If retrieval fails, return an explicit retrieval failure note instead of invented context.
```

The runtime should suppress misleading empty file-search context when knowledge-search is available for the agent.

## UI Exposure Rules

The UI should not expose write actions until backend lifecycle support exists.

List page:

- Show only TCraw-accessible knowledge bases.
- Show lifecycle status when not ready.
- Show private/public/team labels from TCraw ACL.
- Hide create if backend capability says create is unavailable.

Detail page:

- Show upload only when lifecycle state is `ready` and user can edit.
- Show retry action when lifecycle state is `failed` and user can edit.
- Show document status and parse failure reason.
- Settings should edit TCraw-facing metadata only; external metadata sync is out of scope for this lifecycle pass.

Agent picker:

- Show only ready knowledge bases for binding by default.
- Optionally show failed or initializing records disabled with a short reason.

## Backend Capability Endpoint

Add a small backend capability response so UI does not guess:

```json
{
  "weknora": {
    "configured": true,
    "canCreate": true,
    "canUpload": true,
    "requiresTemplate": true,
    "templateConfigured": true
  }
}
```

The create button depends on `canCreate`. Upload still depends on the individual KB lifecycle state.

## Error Handling

Use safe, user-facing errors:

| Failure | Backend behavior | UI behavior |
| --- | --- | --- |
| Missing WeKnora config | capability disables create/upload | hide or disable write actions |
| External create fails | no TCraw mirror unless external id exists | create failure toast |
| Config copy fails | mirror as `failed` with step `initializing` | show retry |
| Config verify fails | mirror as `failed` with step `initializing` | show retry |
| Share fails | mirror as `failed` with step `sharing` | show retry |
| Upload before ready | return 409 | disable button; toast if stale UI |
| WeKnora parse fails | keep document row as failed | show failure reason |
| Search fails | return retrieval failure text to model | do not invent answer |

Do not log raw WeKnora initialization config because it can contain provider credentials.

## Implementation Phases

Phase 1: backend lifecycle foundation.

- Add lifecycle fields to TCraw knowledge-base schema and types.
- Add WeKnora initialization adapter methods.
- Add template config env support.
- Add create orchestration with failure states.
- Add capability endpoint.
- Add tests for success and failure transitions.

Phase 2: upload and counts hardening.

- Block upload unless KB is ready.
- Mirror WeKnora document counts after upload/list.
- Keep parse failures visible.
- Add tests for blocked upload and failed document mapping.

Phase 3: UI exposure.

- Re-enable create only when capability allows it.
- Re-enable upload only for ready editable KBs.
- Add lifecycle badges and retry entry points.
- Keep access labels based on TCraw ACL.

Phase 4: search hardening.

- Filter bound KBs by `ready`.
- Improve tool context and retrieval-failure handling.
- Add tests proving bound ready KBs trigger knowledge search.

## Manual Verification

Local development should use the SSH tunnel to server Docker dependencies:

```text
localhost:27017 -> server Mongo
localhost:7700  -> server Meilisearch
localhost:8000  -> server RAG API
localhost:13112 -> server auxiliary service
```

Verification sequence:

1. Start SSH tunnel.
2. Start backend on `http://localhost:3080`.
3. Start frontend on `http://localhost:3090`.
4. Check knowledge capability response.
5. Create KB from TCraw.
6. Confirm WeKnora UI no longer says default settings are incomplete.
7. Upload one PDF.
8. Confirm document state survives refresh.
9. Bind KB to an agent.
10. Ask a question whose answer exists only in that KB.
11. Confirm `knowledge_search` is called.
