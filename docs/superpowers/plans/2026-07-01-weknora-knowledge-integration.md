# WeKnora Knowledge Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TCraw use the WeKnora `TCRAW` organization as its full knowledge workspace: list, create, upload, inspect status, bind to agents, and retrieve during chat.

**Architecture:** Add a server-only WeKnora adapter and mirror WeKnora knowledge bases into TCraw records. TCraw remains the UI and permission gateway; WeKnora is the storage, parsing, indexing, and retrieval engine.

**Tech Stack:** Node/Express routes in `api/server`, TypeScript service logic in `packages/api`, Mongoose schemas in `packages/data-schemas`, React Query UI in `client/src`, Jest for unit tests.

## Global Constraints

- Do not expose `WEKNORA_API_KEY` to the browser or commit real keys.
- Use `WEKNORA_API_BASE_URL=https://zitoo.asia/rag/api/v1`.
- Use `WEKNORA_ORG_ID=3c6805d0-88c3-46dd-8d20-3a90dd51d63d`.
- TCraw permissions remain the source of truth for user-facing access.
- Agent sharing shares the bound knowledge capability with the shared agent.
- UI must match the existing TCraw style and must not embed WeKnora frontend.
- Commit after each completed task.

---

## File Structure

- Create `packages/api/src/knowledge/weknora.ts`: WeKnora HTTP adapter, response mapping, config validation.
- Modify `packages/api/src/knowledge/types.ts`: provider/external metadata types and dependency interfaces.
- Modify `packages/api/src/knowledge/service.ts`: sync/list/create/upload/delete behavior for WeKnora-backed records.
- Modify `packages/api/src/knowledge/service.spec.ts`: service tests with mocked WeKnora adapter.
- Modify `packages/data-schemas/src/types/knowledgeBase.ts`: persisted provider metadata fields.
- Modify `packages/data-schemas/src/schema/knowledgeBase.ts`: schema fields and indexes for provider metadata.
- Modify `packages/data-schemas/src/methods/knowledgeBase.ts`: upsert/find by provider external id helpers.
- Modify `packages/data-schemas/src/methods/knowledgeBase.spec.ts`: persistence tests.
- Modify `packages/data-provider/src/types/knowledge.ts`: frontend/provider fields and processing count.
- Modify `api/server/routes/knowledgeBases.js`: wire WeKnora adapter dependencies and route upload delegation.
- Modify `api/server/services/Endpoints/agents/initialize.js`: include WeKnora-backed knowledge retrieval in agent setup.
- Modify `api/server/services/Endpoints/agents/initialize.spec.js`: retrieval injection tests.
- Modify `client/src/components/KnowledgeBases/KnowledgeBasePage.tsx`: improved list UI with source/status badges.
- Modify `client/src/components/KnowledgeBases/KnowledgeBaseDetail.tsx`: improved header counts/source/status.
- Modify `client/src/components/KnowledgeBases/KnowledgeBaseDocuments.tsx`: WeKnora upload/status/delete/reupload UI.
- Modify `client/src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx`: list UI tests.
- Modify `client/src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx`: document state tests.
- Modify `client/src/components/SidePanel/Agents/KnowledgeBases.tsx`: picker source/count presentation.
- Modify `client/src/locales/en/translation.json` and `client/src/locales/zh-Hans/translation.json`: labels.

---

### Task 1: Persist WeKnora Metadata

**Files:**
- Modify: `packages/data-schemas/src/types/knowledgeBase.ts`
- Modify: `packages/data-schemas/src/schema/knowledgeBase.ts`
- Modify: `packages/data-schemas/src/methods/knowledgeBase.ts`
- Test: `packages/data-schemas/src/methods/knowledgeBase.spec.ts`

**Interfaces:**
- Produces `IKnowledgeBase.provider?: 'local' | 'weknora'`
- Produces `IKnowledgeBase.externalId?: string`
- Produces `IKnowledgeBase.externalSpaceId?: string`
- Produces `IKnowledgeBase.externalShareId?: string`
- Produces `IKnowledgeBase.processingDocumentCount?: number`
- Produces method `upsertExternalKnowledgeBase(input: UpsertExternalKnowledgeBaseInput): Promise<IKnowledgeBase>`
- Produces method `findKnowledgeBaseByExternalId(provider: string, externalId: string, tenantId?: string): Promise<IKnowledgeBase | null>`

- [ ] **Step 1: Write failing persistence tests**

Add these test cases to `packages/data-schemas/src/methods/knowledgeBase.spec.ts`:

```ts
it('upserts a WeKnora knowledge base by provider and external id', async () => {
  const created = await methods.upsertExternalKnowledgeBase({
    id: 'kb_weknora_shanghai',
    name: '上海致拓',
    description: '',
    author: 'system',
    authorName: 'System',
    tenantId: 'tenant-a',
    provider: 'weknora',
    externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
    externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
    externalShareId: '003cff10-6084-4602-84c3-86d3b9e3fa74',
    documentCount: 22,
    readyDocumentCount: 22,
    failedDocumentCount: 0,
    processingDocumentCount: 0,
  });

  const updated = await methods.upsertExternalKnowledgeBase({
    id: 'kb_weknora_shanghai_ignored',
    name: '上海致拓更新',
    description: '更新',
    author: 'system',
    tenantId: 'tenant-a',
    provider: 'weknora',
    externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
    externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
    documentCount: 23,
    readyDocumentCount: 22,
    failedDocumentCount: 1,
    processingDocumentCount: 0,
  });

  expect(updated.id).toBe(created.id);
  expect(updated.name).toBe('上海致拓更新');
  expect(updated.provider).toBe('weknora');
  expect(updated.externalId).toBe('2a2da502-5549-44e7-b98c-ff5b9417b208');
  expect(updated.documentCount).toBe(23);
  expect(updated.failedDocumentCount).toBe(1);
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm run test:api -- knowledgeBase.spec.ts --runInBand
```

Expected: TypeScript or Jest failure because `upsertExternalKnowledgeBase` does not exist.

- [ ] **Step 3: Add schema and method implementation**

Add fields to `IKnowledgeBase` and `CreateKnowledgeBaseInput`, add schema fields, and extend `KnowledgeBaseMethods` with:

```ts
export type KnowledgeBaseProvider = 'local' | 'weknora';

export type UpsertExternalKnowledgeBaseInput = CreateKnowledgeBaseInput &
  Required<Pick<IKnowledgeBase, 'provider' | 'externalId' | 'externalSpaceId'>> &
  Partial<Pick<IKnowledgeBase, 'externalShareId' | 'processingDocumentCount'>>;
```

Implement:

```ts
async function findKnowledgeBaseByExternalId(
  provider: string,
  externalId: string,
  tenantId?: string,
): Promise<IKnowledgeBase | null> {
  const KnowledgeBase = getKnowledgeBaseModel();
  return await KnowledgeBase.findOne({
    provider,
    externalId,
    ...tenantFilter<IKnowledgeBaseMongoDocument>(tenantId),
  }).lean<IKnowledgeBase>();
}

async function upsertExternalKnowledgeBase(
  input: UpsertExternalKnowledgeBaseInput,
): Promise<IKnowledgeBase> {
  const KnowledgeBase = getKnowledgeBaseModel();
  return await KnowledgeBase.findOneAndUpdate(
    {
      provider: input.provider,
      externalId: input.externalId,
      ...tenantFilter<IKnowledgeBaseMongoDocument>(input.tenantId),
    },
    {
      $setOnInsert: {
        id: input.id,
        author: input.author,
        authorName: input.authorName ?? '',
        tenantId: input.tenantId,
      },
      $set: {
        name: input.name.trim(),
        description: input.description ?? '',
        provider: input.provider,
        externalId: input.externalId,
        externalSpaceId: input.externalSpaceId,
        externalShareId: input.externalShareId ?? '',
        documentCount: input.documentCount ?? 0,
        readyDocumentCount: input.readyDocumentCount ?? 0,
        failedDocumentCount: input.failedDocumentCount ?? 0,
        processingDocumentCount: input.processingDocumentCount ?? 0,
        lastIndexedAt: input.lastIndexedAt ?? null,
      },
    },
    { new: true, upsert: true, runValidators: true },
  ).lean<IKnowledgeBase>();
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:api -- knowledgeBase.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data-schemas/src/types/knowledgeBase.ts packages/data-schemas/src/schema/knowledgeBase.ts packages/data-schemas/src/methods/knowledgeBase.ts packages/data-schemas/src/methods/knowledgeBase.spec.ts
git commit -m "feat: persist external knowledge metadata"
```

---

### Task 2: Add WeKnora Adapter

**Files:**
- Create: `packages/api/src/knowledge/weknora.ts`
- Test: `packages/api/src/knowledge/weknora.spec.ts`
- Modify: `packages/api/src/knowledge/types.ts`

**Interfaces:**
- Produces `createWeKnoraClient(env?: NodeJS.ProcessEnv): WeKnoraClient | null`
- Produces `WeKnoraClient.listSharedKnowledgeBases(): Promise<MappedWeKnoraKnowledgeBase[]>`
- Produces `WeKnoraClient.listDocuments(externalKnowledgeBaseId: string): Promise<MappedWeKnoraDocument[]>`
- Produces `WeKnoraClient.createKnowledgeBase(input): Promise<MappedWeKnoraKnowledgeBase>`
- Produces `WeKnoraClient.uploadDocument(externalKnowledgeBaseId, file): Promise<MappedWeKnoraDocument>`
- Produces `WeKnoraClient.search(query, externalKnowledgeBaseIds): Promise<MappedWeKnoraSearchResult[]>`

- [ ] **Step 1: Write adapter mapping tests**

Create `packages/api/src/knowledge/weknora.spec.ts` with tests for config, list mapping, document status mapping, and header usage:

```ts
import { createWeKnoraClient, mapWeKnoraDocumentStatus } from './weknora';

describe('WeKnora adapter', () => {
  it('returns null when required config is missing', () => {
    expect(createWeKnoraClient({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('maps WeKnora parse statuses to TCraw statuses', () => {
    expect(mapWeKnoraDocumentStatus('completed')).toBe('ready');
    expect(mapWeKnoraDocumentStatus('failed')).toBe('failed');
    expect(mapWeKnoraDocumentStatus('pending')).toBe('processing');
    expect(mapWeKnoraDocumentStatus('processing')).toBe('processing');
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm run test:api -- weknora.spec.ts --runInBand
```

Expected: FAIL because `weknora.ts` does not exist.

- [ ] **Step 3: Implement adapter**

Create `packages/api/src/knowledge/weknora.ts` with focused fetch helpers. The client must set:

```ts
headers: {
  'X-API-Key': apiKey,
  Accept: 'application/json',
}
```

and for JSON writes:

```ts
'Content-Type': 'application/json'
```

Core exported status mapper:

```ts
export function mapWeKnoraDocumentStatus(status?: string): KnowledgeBaseDocumentStatus {
  if (status === 'completed') return 'ready';
  if (status === 'failed') return 'failed';
  return 'processing';
}
```

Use these endpoints:

```text
GET  /organizations/{orgId}/shared-knowledge-bases
POST /knowledge-bases
POST /knowledge-bases/{id}/shares
GET  /knowledge-bases/{id}/knowledge?page=1&page_size=100
POST /knowledge-bases/{id}/knowledge/file
POST /knowledge-search
DELETE /knowledge/{id}
```

- [ ] **Step 4: Run adapter tests**

Run:

```bash
npm run test:api -- weknora.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/knowledge/weknora.ts packages/api/src/knowledge/weknora.spec.ts packages/api/src/knowledge/types.ts
git commit -m "feat: add weknora knowledge adapter"
```

---

### Task 3: Sync and List TCRAW Space Knowledge Bases

**Files:**
- Modify: `packages/api/src/knowledge/service.ts`
- Modify: `packages/api/src/knowledge/types.ts`
- Test: `packages/api/src/knowledge/service.spec.ts`
- Modify: `api/server/routes/knowledgeBases.js`

**Interfaces:**
- Consumes `WeKnoraClient.listSharedKnowledgeBases()`
- Produces `syncWeKnoraKnowledgeBasesForUser(auth, deps): Promise<KnowledgeBaseRecord[]>`
- Produces merged `listKnowledgeBasesForUser` output containing mirrored WeKnora records.

- [ ] **Step 1: Write failing service tests**

Add this test to `packages/api/src/knowledge/service.spec.ts`:

```ts
it('syncs TCRAW shared WeKnora knowledge bases before listing accessible knowledge bases', async () => {
  deps.weknoraClient = {
    listSharedKnowledgeBases: jest.fn().mockResolvedValue([
      {
        externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
        externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
        externalShareId: '003cff10-6084-4602-84c3-86d3b9e3fa74',
        name: '上海致拓',
        description: '',
        documentCount: 22,
        readyDocumentCount: 22,
        failedDocumentCount: 0,
        processingDocumentCount: 0,
      },
    ]),
  } as unknown as WeKnoraClient;
  deps.upsertExternalKnowledgeBase = jest.fn().mockResolvedValue(
    makeKnowledgeBase({
      id: 'kb_mirrored',
      provider: 'weknora',
      externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
      name: '上海致拓',
      documentCount: 22,
    }),
  );
  deps.grantPermission = jest.fn().mockResolvedValue(undefined);
  deps.findAccessibleResources.mockResolvedValue(['kb_mirrored']);
  deps.findKnowledgeBasesByResourceIds.mockResolvedValue([
    makeKnowledgeBase({ id: 'kb_mirrored', provider: 'weknora', name: '上海致拓', documentCount: 22 }),
  ]);

  const result = await listKnowledgeBasesForUser(auth, deps);

  expect(deps.weknoraClient.listSharedKnowledgeBases).toHaveBeenCalledTimes(1);
  expect(deps.upsertExternalKnowledgeBase).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'weknora',
      externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
      name: '上海致拓',
      documentCount: 22,
    }),
  );
  expect(deps.grantPermission).toHaveBeenCalledWith(
    expect.objectContaining({ resourceId: 'kb_mirrored', principalId: auth.userId, role: 'owner' }),
  );
  expect(result.data[0].id).toBe('kb_mirrored');
  expect(result.data[0].id).not.toBe('2a2da502-5549-44e7-b98c-ff5b9417b208');
});
```

- [ ] **Step 2: Run failing service test**

Run:

```bash
npm run test:api -- service.spec.ts --runInBand
```

Expected: FAIL because service does not call WeKnora.

- [ ] **Step 3: Implement sync in service**

Extend `KnowledgeBaseServiceDependencies`:

```ts
weknoraClient?: WeKnoraClient | null;
upsertExternalKnowledgeBase?(input: UpsertExternalKnowledgeBaseInput): Promise<KnowledgeBaseRecord>;
findKnowledgeBaseByExternalId?(provider: string, externalId: string, tenantId?: string): Promise<KnowledgeBaseRecord | null>;
```

In `listKnowledgeBasesForUser`, before finding accessible resources, call `syncWeKnoraKnowledgeBasesForUser(auth, deps)` when `deps.weknoraClient` and `deps.upsertExternalKnowledgeBase` exist. `syncWeKnoraKnowledgeBasesForUser` must map every shared WeKnora knowledge base into an `upsertExternalKnowledgeBase` call, then grant owner permission to `auth.userId` for the mirrored TCraw id.

- [ ] **Step 4: Wire route deps**

In `api/server/routes/knowledgeBases.js`, create the adapter once:

```js
const { createWeKnoraClient } = require('@librechat/api');
const weknoraClient = createWeKnoraClient(process.env);
```

Add `weknoraClient`, `upsertExternalKnowledgeBase`, and `findKnowledgeBaseByExternalId` to `deps`.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:api -- service.spec.ts knowledgeBases.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/knowledge/service.ts packages/api/src/knowledge/types.ts packages/api/src/knowledge/service.spec.ts api/server/routes/knowledgeBases.js api/server/routes/knowledgeBases.test.js
git commit -m "feat: sync weknora knowledge bases"
```

---

### Task 4: Delegate Document Listing and Upload

**Files:**
- Modify: `packages/api/src/knowledge/service.ts`
- Modify: `api/server/routes/knowledgeBases.js`
- Test: `packages/api/src/knowledge/service.spec.ts`
- Test: `api/server/routes/knowledgeBases.test.js`

**Interfaces:**
- Consumes `KnowledgeBaseRecord.provider === 'weknora'`
- Consumes `KnowledgeBaseRecord.externalId`
- Produces WeKnora-backed `listKnowledgeBaseDocumentsForUser`
- Produces WeKnora-backed `createKnowledgeBaseDocumentForUser` upload behavior.

- [ ] **Step 1: Write failing document tests**

Add tests:

```ts
it('lists documents from WeKnora for WeKnora-backed knowledge bases', async () => {
  deps.findKnowledgeBaseById.mockResolvedValue(makeKnowledgeBase({ provider: 'weknora', externalId: 'wk_1' }));
  deps.checkPermission.mockResolvedValue(true);
  deps.weknoraClient.listDocuments.mockResolvedValue([
    { id: 'doc_1', filename: 'guide.pdf', bytes: 123, status: 'ready', error: '' },
  ]);

  const result = await listKnowledgeBaseDocumentsForUser(auth, 'kb_1', deps);
  expect(result.data[0].file_id).toBe('doc_1');
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm run test:api -- service.spec.ts --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Implement document delegation**

In `listKnowledgeBaseDocumentsForUser`, after permission check, branch:

```ts
if (kb.provider === 'weknora') {
  const documents = await deps.weknoraClient.listDocuments(kb.externalId);
  return { data: documents.map((document) => mapWeKnoraDocumentToRecord(document, kb.id, auth.userId, auth.tenantId)) };
}
```

In upload route, for WeKnora-backed KBs, call `weknoraClient.uploadDocument` directly instead of local file storage plus `uploadVectors`.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:api -- service.spec.ts knowledgeBases.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/knowledge/service.ts packages/api/src/knowledge/service.spec.ts api/server/routes/knowledgeBases.js api/server/routes/knowledgeBases.test.js
git commit -m "feat: delegate weknora document operations"
```

---

### Task 5: Create WeKnora Knowledge Bases from TCraw

**Files:**
- Modify: `packages/api/src/knowledge/service.ts`
- Modify: `packages/api/src/knowledge/service.spec.ts`
- Modify: `api/server/routes/knowledgeBases.js`

**Interfaces:**
- Consumes `WeKnoraClient.createKnowledgeBase(input)`
- Consumes `WeKnoraClient.shareKnowledgeBase(externalId, orgId, permission)`
- Produces TCraw mirrored record with owner permission.

- [ ] **Step 1: Write failing create test**

Add this test to `packages/api/src/knowledge/service.spec.ts`:

```ts
it('creates knowledge bases in WeKnora and mirrors them locally', async () => {
  deps.weknoraClient = {
    createKnowledgeBase: jest.fn().mockResolvedValue({
      externalId: 'wk_new',
      externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
      name: '销售资料',
      description: '销售常用文档',
      documentCount: 0,
      readyDocumentCount: 0,
      failedDocumentCount: 0,
      processingDocumentCount: 0,
    }),
    shareKnowledgeBase: jest.fn().mockResolvedValue({ shareId: 'share_new' }),
  } as unknown as WeKnoraClient;
  deps.upsertExternalKnowledgeBase = jest.fn().mockResolvedValue(
    makeKnowledgeBase({ id: 'kb_new', provider: 'weknora', externalId: 'wk_new', name: '销售资料' }),
  );
  deps.grantPermission = jest.fn().mockResolvedValue(undefined);

  const result = await createKnowledgeBaseForUser(
    auth,
    { name: ' 销售资料 ', description: '销售常用文档' },
    deps,
  );

  expect(deps.weknoraClient.createKnowledgeBase).toHaveBeenCalledWith({
    name: '销售资料',
    description: '销售常用文档',
  });
  expect(deps.weknoraClient.shareKnowledgeBase).toHaveBeenCalledWith('wk_new', 'editor');
  expect(deps.upsertExternalKnowledgeBase).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'weknora',
      externalId: 'wk_new',
      externalShareId: 'share_new',
      name: '销售资料',
    }),
  );
  expect(deps.grantPermission).toHaveBeenCalledWith(
    expect.objectContaining({ resourceId: 'kb_new', principalId: auth.userId, role: 'owner' }),
  );
  expect(result.id).toBe('kb_new');
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm run test:api -- service.spec.ts --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Implement create behavior**

When `weknoraClient` exists, `createKnowledgeBaseForUser` should:

```ts
const external = await deps.weknoraClient.createKnowledgeBase({
  name: input.name.trim(),
  description: normalizeOptionalDescription(input.description) ?? '',
});
const share = await deps.weknoraClient.shareKnowledgeBase(external.externalId, 'editor');
const created = await deps.upsertExternalKnowledgeBase({
  id: `kb_${randomUUID()}`,
  name: external.name,
  description: external.description,
  author: auth.userId,
  authorName: auth.name,
  tenantId: auth.tenantId,
  provider: 'weknora',
  externalId: external.externalId,
  externalSpaceId: external.externalSpaceId,
  externalShareId: share.shareId,
  documentCount: external.documentCount,
  readyDocumentCount: external.readyDocumentCount,
  failedDocumentCount: external.failedDocumentCount,
  processingDocumentCount: external.processingDocumentCount,
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:api -- service.spec.ts knowledgeBases.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/knowledge/service.ts packages/api/src/knowledge/service.spec.ts api/server/routes/knowledgeBases.js api/server/routes/knowledgeBases.test.js
git commit -m "feat: create weknora knowledge bases"
```

---

### Task 6: Use WeKnora Retrieval in Agent Conversations

**Files:**
- Modify: `api/server/services/Endpoints/agents/initialize.js`
- Modify: `api/server/services/Endpoints/agents/initialize.spec.js`
- Modify: `packages/api/src/knowledge/service.ts`

**Interfaces:**
- Consumes bound TCraw `knowledge_base_ids`.
- Resolves mirrored records with `provider === 'weknora'`.
- Calls `WeKnoraClient.search(query, externalKnowledgeBaseIds)`.
- Produces context text blocks passed into the agent request.

- [ ] **Step 1: Write failing agent retrieval test**

Add this test to `api/server/services/Endpoints/agents/initialize.spec.js`:

```js
it('adds WeKnora search results to the agent context for bound knowledge bases', async () => {
  const db = {
    findKnowledgeBasesByIds: jest.fn().mockResolvedValue([
      {
        id: 'kb_mirrored',
        provider: 'weknora',
        externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
        tenantId: 'tenant-a',
      },
    ]),
  };
  const weknoraClient = {
    search: jest.fn().mockResolvedValue([
      {
        title: '制度手册',
        filename: '制度手册.pdf',
        content: '报销需要在审批系统提交。',
        score: 0.82,
      },
    ]),
  };

  const context = await buildWeKnoraKnowledgeContext({
    query: '怎么报销',
    knowledgeBaseIds: ['kb_mirrored'],
    user: { id: 'user-a', tenantId: 'tenant-a' },
    db,
    weknoraClient,
  });

  expect(db.findKnowledgeBasesByIds).toHaveBeenCalledWith(['kb_mirrored'], 'tenant-a');
  expect(weknoraClient.search).toHaveBeenCalledWith('怎么报销', [
    '2a2da502-5549-44e7-b98c-ff5b9417b208',
  ]);
  expect(context).toContain('制度手册');
  expect(context).toContain('报销需要在审批系统提交。');
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm run test:api -- initialize.spec.js --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Implement retrieval injection**

Add a helper in the agent initialization path:

```js
async function buildWeKnoraKnowledgeContext({ query, knowledgeBaseIds, user, db, weknoraClient }) {
  const knowledgeBases = await db.findKnowledgeBasesByIds(knowledgeBaseIds, user.tenantId);
  const externalIds = knowledgeBases
    .filter((kb) => kb.provider === 'weknora' && kb.externalId)
    .map((kb) => kb.externalId);
  if (!externalIds.length) {
    return '';
  }
  const results = await weknoraClient.search(query, externalIds);
  return results
    .map((result, index) => `[知识库 ${index + 1}] ${result.title || result.filename}\n${result.content}`)
    .join('\n\n');
}
```

Export `buildWeKnoraKnowledgeContext` from `api/server/services/Endpoints/agents/initialize.js` for the test. In the request assembly path that already collects agent instructions and conversation context, append the returned context as a system-side knowledge block:

```js
const weknoraKnowledgeContext = await buildWeKnoraKnowledgeContext({
  query: latestUserMessageText,
  knowledgeBaseIds: agent.knowledge_base_ids ?? [],
  user,
  db,
  weknoraClient,
});
const knowledgeSystemText = weknoraKnowledgeContext
  ? `以下内容来自已绑定知识库，回答时优先参考：\n\n${weknoraKnowledgeContext}`
  : '';
```

Pass `knowledgeSystemText` into the same system/context message path used by local knowledge retrieval, so existing model adapters receive it without a new frontend contract.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:api -- initialize.spec.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/server/services/Endpoints/agents/initialize.js api/server/services/Endpoints/agents/initialize.spec.js packages/api/src/knowledge/service.ts
git commit -m "feat: retrieve weknora knowledge for agents"
```

---

### Task 7: Update Knowledge Base UI

**Files:**
- Modify: `packages/data-provider/src/types/knowledge.ts`
- Modify: `client/src/components/KnowledgeBases/KnowledgeBasePage.tsx`
- Modify: `client/src/components/KnowledgeBases/KnowledgeBaseDetail.tsx`
- Modify: `client/src/components/KnowledgeBases/KnowledgeBaseDocuments.tsx`
- Modify: `client/src/locales/en/translation.json`
- Modify: `client/src/locales/zh-Hans/translation.json`
- Test: `client/src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx`
- Test: `client/src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx`

**Interfaces:**
- Consumes `KnowledgeBase.provider`, `processingDocumentCount`.
- Produces source badge, processing count, failed count, durable status rows, and upload/reupload UI.

- [ ] **Step 1: Write failing UI tests**

Add tests for:

```ts
expect(screen.getByText('WeKnora')).toBeInTheDocument();
expect(screen.getByText('22 documents')).toBeInTheDocument();
expect(screen.getByText('Processing')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Re-upload' })).toBeInTheDocument();
```

- [ ] **Step 2: Run failing UI tests**

Run:

```bash
cd client && npm run test:ci -- KnowledgeBasePage.spec.tsx KnowledgeBaseDetail.spec.tsx --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Implement UI**

Update cards/detail header to show:

```text
来源: WeKnora
文档: documentCount
处理中: processingDocumentCount
失败: failedDocumentCount
更新时间: updatedAt
```

Keep controls compact and consistent with the current card/table style.

- [ ] **Step 4: Run UI tests**

Run:

```bash
cd client && npm run test:ci -- KnowledgeBasePage.spec.tsx KnowledgeBaseDetail.spec.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data-provider/src/types/knowledge.ts client/src/components/KnowledgeBases client/src/locales/en/translation.json client/src/locales/zh-Hans/translation.json
git commit -m "feat: polish weknora knowledge UI"
```

---

### Task 8: Configure Local and Server Environment

**Files:**
- Modify: `.env.example`
- Modify: `/opt/librechat/.env` on `ssh zt` during deployment only
- Modify: local `.env` without committing secrets

**Interfaces:**
- Consumes `WEKNORA_API_BASE_URL`
- Consumes `WEKNORA_API_KEY`
- Consumes `WEKNORA_ORG_ID`

- [ ] **Step 1: Update example env without secrets**

Add:

```env
WEKNORA_API_BASE_URL=
WEKNORA_API_KEY=
WEKNORA_ORG_ID=
WEKNORA_SYNC_ON_START=true
WEKNORA_SEARCH_TOP_K=8
```

- [ ] **Step 2: Run config smoke test**

Run:

```bash
npm run backend:dev
```

Expected: backend starts with no config errors. Stop it after confirming.

- [ ] **Step 3: Commit example config**

```bash
git add .env.example
git commit -m "docs: add weknora environment settings"
```

---

### Task 9: End-to-End Verification

**Files:**
- No code changes expected.

**Interfaces:**
- Verifies all previous task outputs.

- [ ] **Step 1: Run backend tests**

```bash
npm run test:api -- knowledgeBase.spec.ts service.spec.ts weknora.spec.ts knowledgeBases.test.js initialize.spec.js --runInBand
```

Expected: all selected suites pass.

- [ ] **Step 2: Run frontend tests**

```bash
cd client && npm run test:ci -- KnowledgeBasePage.spec.tsx KnowledgeBaseDetail.spec.tsx --runInBand
```

Expected: all selected suites pass.

- [ ] **Step 3: Run frontend build**

```bash
cd client && npm run build:ci
```

Expected: exit code 0.

- [ ] **Step 4: Manual local check**

Open `http://localhost:3090/knowledge` and verify:

```text
上海致拓 appears.
Source badge says WeKnora.
Documents tab shows WeKnora documents.
Creating a new knowledge base creates it in WeKnora TCRAW space.
Uploading a file shows a processing row after refresh.
Agent picker can bind the knowledge base.
```

- [ ] **Step 5: Commit final verification notes only if any docs changed**

No commit is required if no files changed.
