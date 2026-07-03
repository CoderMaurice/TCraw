# WeKnora Knowledge Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TCraw create, initialize, validate, permission, upload to, and search WeKnora-backed knowledge bases through explicit lifecycle states before exposing write actions in the UI.

**Architecture:** TCraw adds a knowledge lifecycle layer around the existing WeKnora adapter. The lifecycle layer owns state transitions, TCraw ACL, capability checks, and safe error reporting; the WeKnora adapter remains a server-only HTTP boundary.

**Tech Stack:** TypeScript in `packages/api` and `packages/data-schemas`, thin Express wiring in `api/server`, React/React Query in `client`, Jest for tests, local dev server on `localhost:3080` and `localhost:3090`.

## Global Constraints

- Do not log or expose raw WeKnora initialization config, API keys, model keys, or provider credentials.
- TCraw ACL remains the user-facing permission source of truth.
- WeKnora organization sharing is not TCraw public/private access.
- Create and upload UI must be gated by backend capability and knowledge-base lifecycle state.
- New TCraw-created knowledge bases must copy config from `WEKNORA_DEFAULT_CONFIG_KB_ID`.
- The permanent template should be a dedicated WeKnora KB named `TCraw默认知识库模板`, seeded from `FY27-Q1考核规则`.
- Upload is allowed only for `provider="weknora"` and `lifecycleStatus="ready"`.
- Search should only use ready WeKnora knowledge bases.

---

## File Structure

- Modify `packages/data-schemas/src/types/knowledgeBase.ts`: add lifecycle status fields and input types.
- Modify `packages/data-schemas/src/schema/knowledgeBase.ts`: persist lifecycle fields with indexes.
- Modify `packages/data-schemas/src/methods/knowledgeBase.ts`: update external lifecycle state and include lifecycle fields in upserts.
- Modify `packages/data-schemas/src/methods/knowledgeBase.spec.ts`: lifecycle persistence tests.
- Modify `packages/data-provider/src/types/knowledge.ts`: expose lifecycle and capability response types to frontend.
- Modify `packages/data-provider/src/api-endpoints.ts`: add knowledge capability endpoint constant.
- Modify `packages/data-provider/src/data-service.ts`: add capability request helper.
- Modify `client/src/data-provider/KnowledgeBases/queries.ts`: add React Query capability hook.
- Modify `packages/api/src/knowledge/types.ts`: add WeKnora initialization and lifecycle service interfaces.
- Modify `packages/api/src/knowledge/weknora.ts`: add initialization config copy, validation, and capability parsing.
- Modify `packages/api/src/knowledge/weknora.spec.ts`: adapter tests for config copy and secret-safe payloads.
- Modify `packages/api/src/knowledge/service.ts`: create orchestration, capability response, upload/search gating helpers.
- Modify `packages/api/src/knowledge/service.spec.ts`: lifecycle transition and failure tests.
- Modify `api/server/routes/knowledgeBases.js`: add capability route and upload readiness check through service.
- Modify `api/server/routes/knowledgeBases.test.js`: route tests for capability and 409 upload before ready.
- Modify `api/app/clients/tools/util/knowledgeSearch.js`: filter non-ready KBs during runtime search.
- Modify `api/app/clients/tools/util/knowledgeSearch.test.js`: non-ready KB search exclusion tests.
- Modify `client/src/components/KnowledgeBases/KnowledgeBasePage.tsx`: re-enable create only when capability allows it and show lifecycle.
- Modify `client/src/components/KnowledgeBases/KnowledgeBaseDocuments.tsx`: re-enable upload only when KB is ready and editable.
- Modify `client/src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx`: UI capability tests.
- Modify `client/src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx`: upload gating tests.
- Modify `client/src/locales/en/translation.json`: add English strings only.

---

### Task 1: Persist Knowledge Lifecycle State

**Files:**
- Modify: `packages/data-schemas/src/types/knowledgeBase.ts`
- Modify: `packages/data-schemas/src/schema/knowledgeBase.ts`
- Modify: `packages/data-schemas/src/methods/knowledgeBase.ts`
- Test: `packages/data-schemas/src/methods/knowledgeBase.spec.ts`

**Interfaces:**
- Produces `KnowledgeBaseLifecycleStatus`
- Produces `UpdateKnowledgeBaseLifecycleInput`
- Produces `updateKnowledgeBaseLifecycle(id, tenantId, update)`
- Extends `UpsertExternalKnowledgeBaseInput` with lifecycle fields.

- [ ] **Step 1: Write failing persistence tests**

Add tests to `packages/data-schemas/src/methods/knowledgeBase.spec.ts`:

```ts
it('persists lifecycle fields when upserting an external knowledge base', async () => {
  const created = await methods.upsertExternalKnowledgeBase({
    id: 'kb_lifecycle',
    name: 'Lifecycle KB',
    author: 'user_1',
    tenantId: 'tenant-a',
    provider: 'weknora',
    externalId: 'wk_lifecycle',
    externalSpaceId: 'org_1',
    lifecycleStatus: 'initializing',
    lifecycleStep: 'copy_config',
    lifecycleError: '',
    configTemplateExternalId: 'wk_template',
  });

  expect(created.lifecycleStatus).toBe('initializing');
  expect(created.lifecycleStep).toBe('copy_config');
  expect(created.configTemplateExternalId).toBe('wk_template');
});

it('updates lifecycle fields without changing user-facing metadata', async () => {
  await methods.upsertExternalKnowledgeBase({
    id: 'kb_lifecycle_update',
    name: 'Lifecycle Update KB',
    author: 'user_1',
    tenantId: 'tenant-a',
    provider: 'weknora',
    externalId: 'wk_lifecycle_update',
    externalSpaceId: 'org_1',
    lifecycleStatus: 'initializing',
    lifecycleStep: 'copy_config',
  });

  const updated = await methods.updateKnowledgeBaseLifecycle('kb_lifecycle_update', 'tenant-a', {
    lifecycleStatus: 'ready',
    lifecycleStep: 'ready',
    lifecycleError: '',
    initializedAt: new Date('2026-07-03T00:00:00.000Z'),
    externalShareId: 'share_1',
  });

  expect(updated?.name).toBe('Lifecycle Update KB');
  expect(updated?.lifecycleStatus).toBe('ready');
  expect(updated?.lifecycleStep).toBe('ready');
  expect(updated?.externalShareId).toBe('share_1');
  expect(updated?.initializedAt?.toISOString()).toBe('2026-07-03T00:00:00.000Z');
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd packages/data-schemas && npx jest src/methods/knowledgeBase.spec.ts --runInBand
```

Expected: FAIL because lifecycle fields and `updateKnowledgeBaseLifecycle` do not exist.

- [ ] **Step 3: Add types**

In `packages/data-schemas/src/types/knowledgeBase.ts`, add:

```ts
export type KnowledgeBaseLifecycleStatus =
  | 'creating_external'
  | 'initializing'
  | 'sharing'
  | 'ready'
  | 'failed'
  | 'archived';
```

Extend `IKnowledgeBase`:

```ts
lifecycleStatus?: KnowledgeBaseLifecycleStatus;
lifecycleStep?: string;
lifecycleError?: string;
initializedAt?: Date | null;
lastSyncedAt?: Date | null;
configTemplateExternalId?: string;
```

Extend `CreateKnowledgeBaseInput` partial pick with:

```ts
| 'lifecycleStatus'
| 'lifecycleStep'
| 'lifecycleError'
| 'initializedAt'
| 'lastSyncedAt'
| 'configTemplateExternalId'
```

- [ ] **Step 4: Add schema fields**

In `packages/data-schemas/src/schema/knowledgeBase.ts`, add:

```ts
lifecycleStatus: {
  type: String,
  enum: ['creating_external', 'initializing', 'sharing', 'ready', 'failed', 'archived'],
  default: 'ready',
  index: true,
},
lifecycleStep: {
  type: String,
  default: '',
},
lifecycleError: {
  type: String,
  default: '',
},
initializedAt: {
  type: Date,
},
lastSyncedAt: {
  type: Date,
},
configTemplateExternalId: {
  type: String,
  default: '',
},
```

Add index:

```ts
knowledgeBaseSchema.index({ tenantId: 1, lifecycleStatus: 1, updatedAt: -1 });
```

- [ ] **Step 5: Add method implementation**

In `packages/data-schemas/src/methods/knowledgeBase.ts`, add:

```ts
export type UpdateKnowledgeBaseLifecycleInput = Partial<
  Pick<
    IKnowledgeBase,
    | 'lifecycleStatus'
    | 'lifecycleStep'
    | 'lifecycleError'
    | 'externalShareId'
    | 'initializedAt'
    | 'lastSyncedAt'
    | 'configTemplateExternalId'
  >
>;
```

Add method to `KnowledgeBaseMethods`:

```ts
updateKnowledgeBaseLifecycle(
  id: string,
  tenantId: string | undefined,
  update: UpdateKnowledgeBaseLifecycleInput,
): Promise<IKnowledgeBase | null>;
```

Set lifecycle fields in `upsertExternalKnowledgeBase`:

```ts
lifecycleStatus: input.lifecycleStatus ?? 'ready',
lifecycleStep: input.lifecycleStep ?? '',
lifecycleError: input.lifecycleError ?? '',
initializedAt: input.initializedAt ?? null,
lastSyncedAt: input.lastSyncedAt ?? new Date(),
configTemplateExternalId: input.configTemplateExternalId ?? '',
```

Implement:

```ts
async function updateKnowledgeBaseLifecycle(
  id: string,
  tenantId: string | undefined,
  update: UpdateKnowledgeBaseLifecycleInput,
): Promise<IKnowledgeBase | null> {
  const KnowledgeBase = getKnowledgeBaseModel();
  const $set = Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined),
  );

  if (Object.keys($set).length === 0) {
    return await findKnowledgeBaseById(id, tenantId);
  }

  return await KnowledgeBase.findOneAndUpdate(
    knowledgeBaseFilter(id, tenantId),
    { $set },
    { new: true, runValidators: true },
  ).lean<IKnowledgeBase>();
}
```

Return the method from `createKnowledgeBaseMethods`.

- [ ] **Step 6: Run test**

Run:

```bash
cd packages/data-schemas && npx jest src/methods/knowledgeBase.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/data-schemas/src/types/knowledgeBase.ts packages/data-schemas/src/schema/knowledgeBase.ts packages/data-schemas/src/methods/knowledgeBase.ts packages/data-schemas/src/methods/knowledgeBase.spec.ts
git commit -m "feat: persist knowledge lifecycle state"
```

---

### Task 2: Add WeKnora Initialization Adapter

**Files:**
- Modify: `packages/api/src/knowledge/types.ts`
- Modify: `packages/api/src/knowledge/weknora.ts`
- Test: `packages/api/src/knowledge/weknora.spec.ts`

**Interfaces:**
- Produces `WeKnoraInitializationConfig`
- Produces `WeKnoraInitializationStatus`
- Produces `WeKnoraClient.copyInitializationConfig(sourceExternalId, targetExternalId)`
- Produces `WeKnoraClient.getInitializationStatus(externalId)`
- Produces `isWeKnoraInitializationComplete(status)`

- [ ] **Step 1: Write failing adapter tests**

Add tests to `packages/api/src/knowledge/weknora.spec.ts`:

```ts
it('copies only initialization config sections from a template knowledge base', async () => {
  const fetch = mockFetch(
    mockJsonResponse({
      success: true,
      data: {
        hasFiles: true,
        llm: { source: 'remote', modelName: 'gpt-5.5', apiKey: 'secret-llm-key' },
        embedding: {
          source: 'remote',
          modelName: 'Qwen/Qwen3-Embedding-8B',
          apiKey: 'secret-embedding-key',
          dimension: 4096,
        },
        documentSplitting: {
          chunkSize: 512,
          chunkOverlap: 80,
          separators: ['\\n\\n', '\\n', '。', '！', '？', ';', '；'],
        },
        multimodal: { enabled: true, vlm: { modelName: 'Qwen3-VL-235B-A22B-Instruct' } },
        nodeExtract: { enabled: false },
        rerank: { enabled: false },
      },
    }),
    mockJsonResponse({ success: true, data: {} }),
    mockJsonResponse({
      success: true,
      data: {
        embedding: { modelName: 'Qwen/Qwen3-Embedding-8B' },
        documentSplitting: {
          chunkSize: 512,
          chunkOverlap: 80,
          separators: ['\\n\\n', '\\n'],
        },
      },
    }),
  );

  const client = createWeKnoraClient({
    ...env,
    WEKNORA_DEFAULT_CONFIG_KB_ID: 'wk_template',
  });

  await expect(client?.copyInitializationConfig('wk_template', 'wk_new')).resolves.toEqual({
    complete: true,
    embeddingConfigured: true,
    chunkingConfigured: true,
  });

  const putBody = JSON.parse(fetch.mock.calls[1][1]?.body as string);
  expect(putBody).toEqual({
    llm: { source: 'remote', modelName: 'gpt-5.5', apiKey: 'secret-llm-key' },
    embedding: {
      source: 'remote',
      modelName: 'Qwen/Qwen3-Embedding-8B',
      apiKey: 'secret-embedding-key',
      dimension: 4096,
    },
    documentSplitting: {
      chunkSize: 512,
      chunkOverlap: 80,
      separators: ['\\n\\n', '\\n', '。', '！', '？', ';', '；'],
    },
    multimodal: { enabled: true, vlm: { modelName: 'Qwen3-VL-235B-A22B-Instruct' } },
    nodeExtract: { enabled: false },
    rerank: { enabled: false },
  });
  expect(putBody.hasFiles).toBeUndefined();
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd packages/api && npx jest src/knowledge/weknora.spec.ts --runInBand
```

Expected: FAIL because initialization adapter methods do not exist.

- [ ] **Step 3: Extend types**

In `packages/api/src/knowledge/types.ts`, add:

```ts
export interface WeKnoraInitializationStatus {
  complete: boolean;
  embeddingConfigured: boolean;
  chunkingConfigured: boolean;
}

export type WeKnoraInitializationConfig = {
  llm?: WeKnoraMetadataValue;
  embedding?: WeKnoraMetadataValue;
  documentSplitting?: WeKnoraMetadataValue;
  multimodal?: WeKnoraMetadataValue;
  nodeExtract?: WeKnoraMetadataValue;
  rerank?: WeKnoraMetadataValue;
};
```

Extend `WeKnoraClient`:

```ts
copyInitializationConfig(
  sourceExternalKnowledgeBaseId: string,
  targetExternalKnowledgeBaseId: string,
): Promise<WeKnoraInitializationStatus>;
getInitializationStatus(externalKnowledgeBaseId: string): Promise<WeKnoraInitializationStatus>;
```

- [ ] **Step 4: Add PUT support and config sanitization**

In `packages/api/src/knowledge/weknora.ts`, update `FetchInit`:

```ts
method: 'GET' | 'POST' | 'PUT' | 'DELETE';
```

Add:

```ts
const INITIALIZATION_CONFIG_KEYS = [
  'llm',
  'embedding',
  'documentSplitting',
  'multimodal',
  'nodeExtract',
  'rerank',
] as const;

function sanitizeInitializationConfig(raw: JsonValue): JsonObject {
  const source = unwrapObjectResponse(raw);
  return INITIALIZATION_CONFIG_KEYS.reduce<JsonObject>((config, key) => {
    const value = source[key];
    if (isJsonObject(value) || Array.isArray(value)) {
      return { ...config, [key]: value };
    }
    return config;
  }, {});
}

function summarizeInitializationConfig(raw: JsonValue): WeKnoraInitializationStatus {
  const source = unwrapObjectResponse(raw);
  const embedding = getObject(source.embedding);
  const splitting = getObject(source.documentSplitting);
  const separators = splitting.separators;
  const embeddingConfigured = stringField(embedding, ['modelName', 'model_name', 'model_id']).length > 0;
  const chunkingConfigured =
    numberField(splitting, ['chunkSize', 'chunk_size']) > 0 &&
    Array.isArray(separators) &&
    separators.length > 0;

  return {
    complete: embeddingConfigured && chunkingConfigured,
    embeddingConfigured,
    chunkingConfigured,
  };
}
```

- [ ] **Step 5: Implement adapter methods**

Inside returned client object:

```ts
async copyInitializationConfig(
  sourceExternalKnowledgeBaseId: string,
  targetExternalKnowledgeBaseId: string,
): Promise<WeKnoraInitializationStatus> {
  const source = await requestJson<JsonValue>(
    config,
    ['initialization', 'config', sourceExternalKnowledgeBaseId],
    { method: 'GET' },
  );
  const initializationConfig = sanitizeInitializationConfig(source);

  await requestJson<JsonValue>(
    config,
    ['initialization', 'config', targetExternalKnowledgeBaseId],
    {
      method: 'PUT',
      json: initializationConfig,
    },
  );

  return await this.getInitializationStatus(targetExternalKnowledgeBaseId);
},

async getInitializationStatus(
  externalKnowledgeBaseId: string,
): Promise<WeKnoraInitializationStatus> {
  const response = await requestJson<JsonValue>(
    config,
    ['initialization', 'config', externalKnowledgeBaseId],
    { method: 'GET' },
  );
  return summarizeInitializationConfig(response);
},
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd packages/api && npx jest src/knowledge/weknora.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/knowledge/types.ts packages/api/src/knowledge/weknora.ts packages/api/src/knowledge/weknora.spec.ts
git commit -m "feat: copy weknora initialization config"
```

---

### Task 3: Orchestrate Create Lifecycle and Capabilities

**Files:**
- Modify: `packages/api/src/knowledge/types.ts`
- Modify: `packages/api/src/knowledge/service.ts`
- Test: `packages/api/src/knowledge/service.spec.ts`
- Modify: `api/server/routes/knowledgeBases.js`
- Test: `api/server/routes/knowledgeBases.test.js`

**Interfaces:**
- Produces `getKnowledgeBaseCapabilities()`
- Updates `createKnowledgeBaseForUser()` to create, mirror, initialize, share, and mark ready.
- Produces `POST /api/knowledge-bases/:id/retry` only if retry is needed in implementation; otherwise retry stays out of phase 1.

- [ ] **Step 1: Write failing service tests**

Add service tests:

```ts
it('creates a WeKnora knowledge base through initialization lifecycle', async () => {
  deps.weknoraClient = {
    ...deps.weknoraClient,
    createKnowledgeBase: jest.fn().mockResolvedValue({
      externalId: 'wk_new',
      externalSpaceId: 'org_123',
      externalShareId: '',
      permission: 'editor',
      name: 'New KB',
      description: '',
      documentCount: 0,
      readyDocumentCount: 0,
      failedDocumentCount: 0,
      processingDocumentCount: 0,
    }),
    copyInitializationConfig: jest.fn().mockResolvedValue({
      complete: true,
      embeddingConfigured: true,
      chunkingConfigured: true,
    }),
    shareKnowledgeBase: jest.fn().mockResolvedValue({ externalShareId: 'share_new' }),
  };
  deps.upsertExternalKnowledgeBase.mockResolvedValue(
    makeKnowledgeBase({
      id: 'kb_new',
      provider: 'weknora',
      externalId: 'wk_new',
      lifecycleStatus: 'initializing',
    }),
  );
  deps.updateKnowledgeBaseLifecycle.mockResolvedValue(
    makeKnowledgeBase({
      id: 'kb_new',
      provider: 'weknora',
      externalId: 'wk_new',
      externalShareId: 'share_new',
      lifecycleStatus: 'ready',
    }),
  );

  await createKnowledgeBaseForUser(auth, { name: 'New KB' }, deps);

  expect(deps.weknoraClient.copyInitializationConfig).toHaveBeenCalledWith(
    'wk_template',
    'wk_new',
  );
  expect(deps.updateKnowledgeBaseLifecycle).toHaveBeenCalledWith(
    'kb_new',
    auth.tenantId,
    expect.objectContaining({
      lifecycleStatus: 'ready',
      lifecycleStep: 'ready',
      externalShareId: 'share_new',
    }),
  );
});

it('marks a created external knowledge base failed when initialization fails', async () => {
  deps.weknoraClient.copyInitializationConfig.mockRejectedValue(new Error('copy failed'));
  deps.upsertExternalKnowledgeBase.mockResolvedValue(
    makeKnowledgeBase({
      id: 'kb_failed',
      provider: 'weknora',
      externalId: 'wk_failed',
      lifecycleStatus: 'initializing',
    }),
  );

  await expect(createKnowledgeBaseForUser(auth, { name: 'Broken KB' }, deps)).rejects.toThrow(
    'Knowledge base initialization failed',
  );

  expect(deps.updateKnowledgeBaseLifecycle).toHaveBeenCalledWith(
    'kb_failed',
    auth.tenantId,
    expect.objectContaining({
      lifecycleStatus: 'failed',
      lifecycleStep: 'initializing',
    }),
  );
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd packages/api && npx jest src/knowledge/service.spec.ts --runInBand
```

Expected: FAIL because lifecycle dependencies and share method do not exist.

- [ ] **Step 3: Split WeKnora create and share**

Update `WeKnoraClient` so `createKnowledgeBase()` only creates the external KB. Add:

```ts
shareKnowledgeBase(externalKnowledgeBaseId: string): Promise<{ externalShareId: string }>;
```

Move current `POST /knowledge-bases/{externalId}/shares` logic from `createKnowledgeBase()` into `shareKnowledgeBase()`.

- [ ] **Step 4: Add lifecycle dependencies**

In `KnowledgeBaseServiceDependencies`, add:

```ts
updateKnowledgeBaseLifecycle(
  id: string,
  tenantId: string | undefined,
  update: UpdateKnowledgeBaseLifecycleInput,
): Promise<KnowledgeBaseRecord | null>;
env?: NodeJS.ProcessEnv;
```

- [ ] **Step 5: Add capability helper**

In `packages/api/src/knowledge/service.ts`, add:

```ts
export interface KnowledgeBaseCapabilities {
  weknora: {
    configured: boolean;
    canCreate: boolean;
    canUpload: boolean;
    requiresTemplate: boolean;
    templateConfigured: boolean;
  };
}

export function getKnowledgeBaseCapabilities(
  deps: Pick<KnowledgeBaseServiceDependencies, 'weknoraClient' | 'env'>,
): KnowledgeBaseCapabilities {
  const templateConfigured = Boolean(deps.env?.WEKNORA_DEFAULT_CONFIG_KB_ID?.trim());
  const configured = Boolean(deps.weknoraClient);
  return {
    weknora: {
      configured,
      canCreate: configured && templateConfigured,
      canUpload: configured,
      requiresTemplate: true,
      templateConfigured,
    },
  };
}
```

- [ ] **Step 6: Implement create orchestration**

Update `createKnowledgeBaseForUser()`:

```ts
const templateExternalId = deps.env?.WEKNORA_DEFAULT_CONFIG_KB_ID?.trim();
if (!templateExternalId) {
  throw createServiceError('WeKnora default configuration template is not configured', 500);
}

const external = await deps.weknoraClient.createKnowledgeBase(...);
const created = await deps.upsertExternalKnowledgeBase({
  ...,
  externalShareId: '',
  lifecycleStatus: 'initializing',
  lifecycleStep: 'initializing',
  lifecycleError: '',
  configTemplateExternalId: templateExternalId,
});
await deps.grantPermission(...owner...);

try {
  const status = await deps.weknoraClient.copyInitializationConfig(
    templateExternalId,
    external.externalId,
  );
  if (!status.complete) {
    throw new Error('WeKnora initialization config is incomplete');
  }

  await deps.updateKnowledgeBaseLifecycle(created.id, auth.tenantId, {
    lifecycleStatus: 'sharing',
    lifecycleStep: 'sharing',
    lifecycleError: '',
  });
  const share = await deps.weknoraClient.shareKnowledgeBase(external.externalId);
  const ready = await deps.updateKnowledgeBaseLifecycle(created.id, auth.tenantId, {
    externalShareId: share.externalShareId,
    lifecycleStatus: 'ready',
    lifecycleStep: 'ready',
    lifecycleError: '',
    initializedAt: new Date(),
    lastSyncedAt: new Date(),
  });
  return ready ?? created;
} catch (error) {
  await deps.updateKnowledgeBaseLifecycle(created.id, auth.tenantId, {
    lifecycleStatus: 'failed',
    lifecycleStep: 'initializing',
    lifecycleError: error instanceof Error ? error.message : 'Knowledge base initialization failed',
  });
  throw createServiceError('Knowledge base initialization failed', 500);
}
```

- [ ] **Step 7: Add route capability endpoint**

In `api/server/routes/knowledgeBases.js`, wire `env: process.env` into deps and add before `router.get('/:id/documents')`:

```js
router.get('/capabilities', async (req, res) => {
  try {
    return res.json(getKnowledgeBaseCapabilities(deps));
  } catch (error) {
    return sendServiceError(res, error);
  }
});
```

- [ ] **Step 8: Run tests**

Run:

```bash
cd packages/api && npx jest src/knowledge/weknora.spec.ts src/knowledge/service.spec.ts --runInBand
cd api && npx jest server/routes/knowledgeBases.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/knowledge/types.ts packages/api/src/knowledge/weknora.ts packages/api/src/knowledge/weknora.spec.ts packages/api/src/knowledge/service.ts packages/api/src/knowledge/service.spec.ts api/server/routes/knowledgeBases.js api/server/routes/knowledgeBases.test.js
git commit -m "feat: orchestrate weknora knowledge lifecycle"
```

---

### Task 4: Gate Upload and Search by Ready State

**Files:**
- Modify: `packages/api/src/knowledge/service.ts`
- Test: `packages/api/src/knowledge/service.spec.ts`
- Modify: `api/server/routes/knowledgeBases.js`
- Test: `api/server/routes/knowledgeBases.test.js`
- Modify: `api/app/clients/tools/util/knowledgeSearch.js`
- Test: `api/app/clients/tools/util/knowledgeSearch.test.js`

**Interfaces:**
- Upload returns `409` when KB lifecycle is not `ready`.
- Search excludes non-ready WeKnora knowledge bases.

- [ ] **Step 1: Write failing upload readiness test**

Add service or route test:

```ts
it('rejects uploading to a WeKnora knowledge base before it is ready', async () => {
  deps.findKnowledgeBaseById.mockResolvedValue(
    makeKnowledgeBase({
      id: 'kb_initializing',
      provider: 'weknora',
      externalId: 'wk_initializing',
      lifecycleStatus: 'initializing',
    }),
  );

  await expect(
    assertKnowledgeBaseUploadable(auth, 'kb_initializing', deps),
  ).rejects.toMatchObject({
    statusCode: 409,
    message: 'Knowledge base is not ready for uploads',
  });
});
```

- [ ] **Step 2: Add uploadability helper**

In `packages/api/src/knowledge/service.ts`, add:

```ts
export async function assertKnowledgeBaseUploadable(
  auth: KnowledgeAuthContext,
  id: string,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseRecord> {
  const kb = await requireKnowledgeBasePermission(auth, id, PermissionBits.EDIT, deps);
  if (kb.provider !== 'weknora') {
    throw createServiceError('Local RAG knowledge bases are no longer supported', 410);
  }
  if (kb.lifecycleStatus !== 'ready') {
    throw createServiceError('Knowledge base is not ready for uploads', 409);
  }
  if (!kb.externalId) {
    throw createServiceError('WeKnora knowledge base is missing an external id', 500);
  }
  if (!deps.weknoraClient) {
    throw createServiceError('WeKnora client is not configured', 500);
  }
  return kb;
}
```

Use this helper in `api/server/routes/knowledgeBases.js` upload route.

- [ ] **Step 3: Write failing search readiness test**

In `api/app/clients/tools/util/knowledgeSearch.test.js`, add:

```js
it('does not search non-ready WeKnora knowledge bases', async () => {
  const findKnowledgeBase = jest
    .fn()
    .mockResolvedValueOnce({
      id: 'kb_initializing',
      provider: 'weknora',
      externalId: 'wk_initializing',
      lifecycleStatus: 'initializing',
    })
    .mockResolvedValueOnce({
      id: 'kb_ready',
      provider: 'weknora',
      externalId: 'wk_ready',
      lifecycleStatus: 'ready',
    });

  await expect(
    resolveExternalKnowledgeBaseIds({
      tenantId: 'tenant-a',
      knowledgeBaseIds: ['kb_initializing', 'kb_ready'],
      findKnowledgeBase,
    }),
  ).resolves.toEqual(['wk_ready']);
});
```

- [ ] **Step 4: Update search resolver**

In `api/app/clients/tools/util/knowledgeSearch.js`, update the ready filter:

```js
if (
  !knowledgeBase ||
  knowledgeBase.provider !== 'weknora' ||
  knowledgeBase.lifecycleStatus !== 'ready' ||
  !knowledgeBase.externalId
) {
  continue;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd packages/api && npx jest src/knowledge/service.spec.ts --runInBand
cd api && npx jest server/routes/knowledgeBases.test.js app/clients/tools/util/knowledgeSearch.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/knowledge/service.ts packages/api/src/knowledge/service.spec.ts api/server/routes/knowledgeBases.js api/server/routes/knowledgeBases.test.js api/app/clients/tools/util/knowledgeSearch.js api/app/clients/tools/util/knowledgeSearch.test.js
git commit -m "fix: gate knowledge upload and search readiness"
```

---

### Task 5: Re-expose UI Through Backend Capability

**Files:**
- Modify: `packages/data-provider/src/types/knowledge.ts`
- Modify: `packages/data-provider/src/api-endpoints.ts`
- Modify: `packages/data-provider/src/data-service.ts`
- Modify: `client/src/data-provider/KnowledgeBases/queries.ts`
- Modify: `client/src/components/KnowledgeBases/KnowledgeBasePage.tsx`
- Modify: `client/src/components/KnowledgeBases/KnowledgeBaseDocuments.tsx`
- Test: `client/src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx`
- Test: `client/src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx`
- Modify: `client/src/locales/en/translation.json`

**Interfaces:**
- Produces `useKnowledgeBaseCapabilitiesQuery()`.
- Create button displays only when `capabilities.weknora.canCreate === true`.
- Upload button displays only when `kb.lifecycleStatus === 'ready'`.

- [ ] **Step 1: Write failing UI capability tests**

In `KnowledgeBasePage.spec.tsx`, add:

```tsx
it('shows create only when knowledge capabilities allow creation', async () => {
  mockKnowledgeBaseCapabilities({ weknora: { configured: true, canCreate: true, canUpload: true, requiresTemplate: true, templateConfigured: true } });

  renderKnowledgeBasePage();

  expect(await screen.findByRole('button', { name: /create knowledge base/i })).toBeInTheDocument();
});

it('hides create when the WeKnora template is not configured', async () => {
  mockKnowledgeBaseCapabilities({ weknora: { configured: true, canCreate: false, canUpload: true, requiresTemplate: true, templateConfigured: false } });

  renderKnowledgeBasePage();

  expect(screen.queryByRole('button', { name: /create knowledge base/i })).not.toBeInTheDocument();
});
```

In `KnowledgeBaseDetail.spec.tsx`, add:

```tsx
it('hides upload for a non-ready knowledge base', async () => {
  mockKnowledgeBaseDetail({ provider: 'weknora', lifecycleStatus: 'initializing' });

  renderKnowledgeBaseDetail();

  expect(screen.queryByRole('button', { name: /upload document/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add data-provider types and endpoint**

In `packages/data-provider/src/types/knowledge.ts`, add:

```ts
export interface KnowledgeBaseCapabilities {
  weknora: {
    configured: boolean;
    canCreate: boolean;
    canUpload: boolean;
    requiresTemplate: boolean;
    templateConfigured: boolean;
  };
}
```

Add lifecycle fields to `KnowledgeBase`.

In `packages/data-provider/src/api-endpoints.ts`, add:

```ts
export const knowledgeBaseCapabilitiesEndpoint = () => `${knowledgeBaseEndpoint}/capabilities`;
```

In `packages/data-provider/src/data-service.ts`, add:

```ts
export const getKnowledgeBaseCapabilities = () =>
  request.get<KnowledgeBaseCapabilities>(knowledgeBaseCapabilitiesEndpoint());
```

- [ ] **Step 3: Add React Query hook**

In `client/src/data-provider/KnowledgeBases/queries.ts`, add:

```ts
export const useKnowledgeBaseCapabilitiesQuery = () =>
  useQuery([QueryKeys.knowledgeBaseCapabilities], dataService.getKnowledgeBaseCapabilities);
```

Add a query key in `packages/data-provider/src/keys.ts` if missing:

```ts
knowledgeBaseCapabilities: 'knowledgeBaseCapabilities',
```

- [ ] **Step 4: Re-enable create and upload conditionally**

In `KnowledgeBasePage.tsx`, render create button only when capability allows:

```tsx
const { data: capabilities } = useKnowledgeBaseCapabilitiesQuery();
const canCreateKnowledgeBase = capabilities?.weknora.canCreate === true;
```

Use `canCreateKnowledgeBase` for the create button and dialog.

In `KnowledgeBaseDocuments.tsx`, use:

```tsx
const canUpload = knowledgeBase.provider === 'weknora' && knowledgeBase.lifecycleStatus === 'ready';
```

Render upload controls only when `canUpload`.

- [ ] **Step 5: Add lifecycle display**

On list/detail cards, when lifecycle is not `ready`, show a compact status label:

```tsx
{knowledgeBase.lifecycleStatus !== 'ready' && (
  <Badge>{localize(`com_ui_knowledge_lifecycle_${knowledgeBase.lifecycleStatus}`)}</Badge>
)}
```

Add English locale keys:

```json
"com_ui_knowledge_lifecycle_initializing": "Configuring",
"com_ui_knowledge_lifecycle_sharing": "Sharing",
"com_ui_knowledge_lifecycle_failed": "Failed",
"com_ui_knowledge_lifecycle_archived": "Archived"
```

- [ ] **Step 6: Run UI tests**

Run:

```bash
cd client && npx jest src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/data-provider/src/types/knowledge.ts packages/data-provider/src/api-endpoints.ts packages/data-provider/src/data-service.ts packages/data-provider/src/keys.ts client/src/data-provider/KnowledgeBases/queries.ts client/src/components/KnowledgeBases/KnowledgeBasePage.tsx client/src/components/KnowledgeBases/KnowledgeBaseDocuments.tsx client/src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx client/src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx client/src/locales/en/translation.json
git commit -m "feat: expose knowledge writes by lifecycle capability"
```

---

### Task 6: Configure Template and Verify Locally

**Files:**
- Modify: `.env` or deployment env only; do not commit secrets.
- Test: local manual flow.

**Interfaces:**
- Sets `WEKNORA_DEFAULT_CONFIG_KB_ID` for local development.
- Confirms local TCraw creates an initialized WeKnora KB.

- [ ] **Step 1: Use the known complete development template**

Use this known complete WeKnora config as the local development template:

```text
FY27-Q1考核规则
external id: ad407e39-cfce-4bfc-8234-d3b9c567d054
chunkSize: 512
chunkOverlap: 80
```

This is acceptable for local development because it is already configured and was verified complete. Before production, create a dedicated WeKnora KB named `TCraw默认知识库模板`, copy this same initialization config into it, and replace the env value with that dedicated template id.

- [ ] **Step 2: Set local env**

Add to local runtime environment:

```env
WEKNORA_DEFAULT_CONFIG_KB_ID=ad407e39-cfce-4bfc-8234-d3b9c567d054
```

Do not commit `.env` or any key values.

- [ ] **Step 3: Restart backend**

Run:

```bash
npm run backend:dev
```

Expected log includes:

```text
Server listening at http://localhost:3080
```

- [ ] **Step 4: Check capability endpoint**

Run:

```bash
curl -fsS http://localhost:3080/api/knowledge-bases/capabilities
```

Expected:

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

- [ ] **Step 5: Create KB from local UI**

Open:

```text
http://localhost:3090
```

Create a test KB named:

```text
TCraw本地初始化测试
```

Expected:

```text
Knowledge base is created, lifecycleStatus=ready, and upload appears.
```

- [ ] **Step 6: Verify WeKnora initialization**

Run a secret-safe Node check using the new KB external id from Mongo. The script prints only booleans:

Run:

```bash
node - <<'NODE'
require('dotenv').config({ quiet: true });
const externalId = process.env.TCRAW_LAST_CREATED_WEKNORA_KB_ID;
if (!externalId) {
  throw new Error('Set TCRAW_LAST_CREATED_WEKNORA_KB_ID to the new test KB external id before running this check');
}
const baseUrl = (process.env.WEKNORA_API_BASE_URL || '').replace(/\/+$/, '');
const apiKey = process.env.WEKNORA_API_KEY || '';
const res = await fetch(`${baseUrl}/initialization/config/${encodeURIComponent(externalId)}`, {
  headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
});
const raw = await res.json();
if (!res.ok) {
  throw new Error(`WeKnora config check failed: ${res.status}`);
}
const config = raw.data || raw;
const embeddingConfigured = Boolean(config.embedding?.modelName);
const chunkingConfigured = Number(config.documentSplitting?.chunkSize) > 0 && Array.isArray(config.documentSplitting?.separators);
console.log(JSON.stringify({
  embeddingConfigured,
  chunkingConfigured,
  complete: embeddingConfigured && chunkingConfigured,
}, null, 2));
NODE
```

Expected:

```json
{
  "embeddingConfigured": true,
  "chunkingConfigured": true,
  "complete": true
}
```

- [ ] **Step 7: Upload a small PDF**

Expected:

```text
Document appears immediately as processing or ready.
Refreshing the detail page still shows the document.
```

- [ ] **Step 8: Bind to an agent and verify search**

Bind the new KB to a test agent. Ask a question only answerable from the uploaded PDF.

Expected:

```text
knowledge_search is available and called.
The answer cites retrieved knowledge content instead of claiming no knowledge base is loaded.
```

- [ ] **Step 9: Run full focused verification**

Run:

```bash
cd packages/data-schemas && npx jest src/methods/knowledgeBase.spec.ts --runInBand
cd packages/api && npx jest src/knowledge/weknora.spec.ts src/knowledge/service.spec.ts --runInBand
cd api && npx jest server/routes/knowledgeBases.test.js app/clients/tools/util/knowledgeSearch.test.js --runInBand
cd client && npx jest src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx --runInBand
npm run build:api
npm run build:data-provider
npm run build:client
```

Expected: all commands PASS.

- [ ] **Step 10: Confirm no secret files are staged**

```bash
git status --short
```

Expected: `.env` is not staged. If manual verification only changed local env and external WeKnora state, no commit is needed for this task.
