# Knowledge Base Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full team-aware knowledge base module that lets users create ACL-protected knowledge bases, upload documents into them, bind one or more knowledge bases to Agents, and let shared Agents query their bound knowledge bases through existing `file_search`.

**Architecture:** Reuse the existing `Group`, ACL, file upload, RAG API, `vectordb`, and Agent tool infrastructure. Add first-class knowledge base and knowledge base document models, expose thin Express routes backed by TypeScript services in `packages/api`, and extend Agent persistence/runtime so `knowledge_base_ids` expands to ready document `file_id` values during execution.

**Tech Stack:** TypeScript, JavaScript Express wrappers, Mongoose, MongoDB, existing ACL service, existing RAG API, pgvector-backed `vectordb`, React, React Query, existing LibreChat UI components.

---

## File Structure

### Shared Types And Endpoints

- Modify `packages/data-provider/src/accessPermissions.ts`
  - Add `ResourceType.KNOWLEDGE_BASE`.
  - Add `AccessRoleIds.KNOWLEDGE_BASE_VIEWER`, `KNOWLEDGE_BASE_EDITOR`, and `KNOWLEDGE_BASE_OWNER`.
  - Map the new roles to `VIEW`, `VIEW | EDIT`, and `VIEW | EDIT | DELETE | SHARE`.
- Modify `packages/data-provider/src/api-endpoints.ts`
  - Add endpoint builders for knowledge base CRUD, document list/upload/delete, and Agent selector list.
- Modify `packages/data-provider/src/data-service.ts`
  - Add request helpers for knowledge base APIs.
- Modify `packages/data-provider/src/keys.ts`
  - Add `knowledgeBases`, `knowledgeBase`, and `knowledgeBaseDocuments` query keys.
- Create `packages/data-provider/src/types/knowledge.ts`
  - Shared request/response types for knowledge base pages and Agent selector data.
- Modify `packages/data-provider/src/types/index.ts`
  - Export knowledge base types.

### Database Schemas And Methods

- Create `packages/data-schemas/src/schema/knowledgeBase.ts`
  - Mongoose schema for `KnowledgeBase`.
- Create `packages/data-schemas/src/schema/knowledgeBaseDocument.ts`
  - Mongoose schema for `KnowledgeBaseDocument`.
- Create `packages/data-schemas/src/types/knowledgeBase.ts`
  - Model and method input/output TypeScript types.
- Create `packages/data-schemas/src/models/knowledgeBase.ts`
  - Mongoose model export.
- Create `packages/data-schemas/src/models/knowledgeBaseDocument.ts`
  - Mongoose model export.
- Create `packages/data-schemas/src/methods/knowledgeBase.ts`
  - CRUD/list methods for knowledge bases and documents.
- Create `packages/data-schemas/src/methods/knowledgeBase.spec.ts`
  - Unit/integration coverage with `mongodb-memory-server`.
- Modify `packages/data-schemas/src/schema/index.ts`
  - Export new schemas.
- Modify `packages/data-schemas/src/types/index.ts`
  - Export new types.
- Modify `packages/data-schemas/src/models/index.ts`
  - Register new models.
- Modify `packages/data-schemas/src/methods/index.ts`
  - Export new methods.
- Modify `packages/data-schemas/src/methods/accessRole.ts`
  - Seed default knowledge base roles.
- Modify `packages/data-schemas/src/methods/accessRole.spec.ts`
  - Verify the new roles seed correctly.

### Backend Service And Routes

- Create `packages/api/src/knowledge/types.ts`
  - Service-level types for authenticated requests and RAG/file dependencies.
- Create `packages/api/src/knowledge/service.ts`
  - Knowledge base CRUD, ACL checks, upload orchestration, document deletion, and Agent binding validation.
- Create `packages/api/src/knowledge/index.ts`
  - Export public service functions consumed by `/api`.
- Create `packages/api/src/knowledge/service.spec.ts`
  - Backend service tests using real data-schema methods and spies for external RAG/file calls.
- Modify `packages/api/src/index.ts`
  - Export the `knowledge` module.
- Create `api/server/controllers/KnowledgeBaseController.js`
  - Thin Express controller wrapper that calls `@librechat/api` service functions.
- Create `api/server/routes/knowledgeBases.js`
  - Express routes for `/api/knowledge-bases`.
- Create `api/server/routes/knowledgeBases.test.js`
  - Route-level permission and response-shape tests.
- Modify `api/server/index.js`
  - Mount `knowledgeBases` route.

### Agent Persistence And Runtime

- Modify `packages/data-schemas/src/schema/agent.ts`
  - Add `knowledge_base_ids: [String]` with default `[]`.
- Modify `packages/data-provider/src/types/agents.ts`
  - Add `knowledge_base_ids?: string[]` to Agent types.
- Modify `packages/data-provider/src/types/assistants.ts`
  - Add `knowledge_base_ids?: string[]` to shared assistant/agent request payload types when those types carry Agent create/update data.
- Modify `packages/api/src/agents/validation.ts`
  - Validate `knowledge_base_ids` as an array of strings with a default empty array.
- Modify `api/server/controllers/agents/v1.js`
  - Validate submitted knowledge base bindings on create, update, and duplicate.
  - Auto-enable `file_search` when `knowledge_base_ids` is non-empty.
- Modify `api/server/services/Endpoints/agents/initialize.js`
  - Resolve bound knowledge bases to ready document `file_id` values during Agent initialization.
  - Merge resolved file IDs into `tool_resources.file_search.file_ids`.
  - Do not re-check direct knowledge base ACL for the user executing a shared Agent.
- Modify `api/server/services/Endpoints/agents/initialize.spec.js`
  - Cover runtime expansion and shared Agent behavior.
- Modify `api/server/controllers/agents/v1.spec.js`
  - Cover create/update/duplicate binding validation and file_search auto-enable.

### Frontend Data Layer

- Create `client/src/data-provider/KnowledgeBases/queries.ts`
  - React Query hooks for list, detail, documents, and Agent selector.
- Create `client/src/data-provider/KnowledgeBases/mutations.ts`
  - Mutations for create, update, delete, upload documents, and delete documents.
- Create `client/src/data-provider/KnowledgeBases/index.ts`
  - Export hooks.
- Modify `client/src/data-provider/index.ts`
  - Export knowledge base hooks.

### Frontend Knowledge Base Management

- Create `client/src/components/KnowledgeBases/index.ts`
  - Feature exports.
- Create `client/src/components/KnowledgeBases/KnowledgeBasePage.tsx`
  - List page with search, create button, and compact rows.
- Create `client/src/components/KnowledgeBases/KnowledgeBaseDetail.tsx`
  - Detail shell with header, Documents, Access, and Settings sections.
- Create `client/src/components/KnowledgeBases/KnowledgeBaseDocuments.tsx`
  - Upload and document table.
- Create `client/src/components/KnowledgeBases/KnowledgeBaseAccess.tsx`
  - Reuse existing permission APIs with `ResourceType.KNOWLEDGE_BASE`.
- Create `client/src/components/KnowledgeBases/KnowledgeBaseSettings.tsx`
  - Rename, description edit, and delete actions.
- Create `client/src/components/KnowledgeBases/KnowledgeBaseCreateDialog.tsx`
  - Create form.
- Create `client/src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx`
  - Page and state tests.
- Create `client/src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx`
  - Detail, document, and access rendering tests.
- Modify `client/src/routes/index.tsx`
  - Add lazy route for knowledge base list and detail.
- Modify `client/src/hooks/Nav/useSideNavLinks.ts`
  - Add a `Knowledge` navigation entry.
- Modify `client/src/locales/en/translation.json`
  - Add English localization keys only.

### Frontend Agent Configuration

- Create `client/src/components/SidePanel/Agents/KnowledgeBases.tsx`
  - Agent configuration section for selected knowledge bases and selector dialog.
- Create `client/src/components/SidePanel/Agents/__tests__/KnowledgeBases.spec.tsx`
  - Selector, selected state, and file_search auto-enable tests.
- Modify `client/src/components/SidePanel/Agents/AgentConfig.tsx`
  - Render the knowledge base section near file search.
- Modify `client/src/components/SidePanel/Agents/AgentPanel.tsx`
  - Include `knowledge_base_ids` in create/update payloads and preserve existing tool behavior.
- Modify `client/src/common/agents-types.ts`
  - Add form state typing for `knowledge_base_ids`.
- Modify `client/src/components/SidePanel/Agents/config.ts`
  - Add default form value `knowledge_base_ids: []`.
- Modify `client/src/components/SidePanel/Agents/AgentPanel.test.tsx`
  - Cover payload composition with selected knowledge bases.

---

## Implementation Tasks

### Task 1: Add Shared Permission Constants

**Files:**
- Modify: `packages/data-provider/src/accessPermissions.ts`
- Test: `packages/data-provider/src/accessPermissions.ts` compile coverage through `npm run build:data-provider`

- [ ] **Step 1: Add the new resource type**

In `packages/data-provider/src/accessPermissions.ts`, extend `ResourceType`:

```ts
export enum ResourceType {
  AGENT = 'agent',
  PROMPTGROUP = 'promptGroup',
  MCPSERVER = 'mcpServer',
  REMOTE_AGENT = 'remoteAgent',
  SKILL = 'skill',
  SHARED_LINK = 'sharedLink',
  KNOWLEDGE_BASE = 'knowledgeBase',
}
```

- [ ] **Step 2: Add knowledge base access roles**

In the same file, extend `AccessRoleIds`:

```ts
export enum AccessRoleIds {
  AGENT_VIEWER = 'agent_viewer',
  AGENT_EDITOR = 'agent_editor',
  AGENT_OWNER = 'agent_owner',
  PROMPTGROUP_VIEWER = 'promptGroup_viewer',
  PROMPTGROUP_EDITOR = 'promptGroup_editor',
  PROMPTGROUP_OWNER = 'promptGroup_owner',
  MCPSERVER_VIEWER = 'mcpServer_viewer',
  MCPSERVER_EDITOR = 'mcpServer_editor',
  MCPSERVER_OWNER = 'mcpServer_owner',
  REMOTE_AGENT_VIEWER = 'remoteAgent_viewer',
  REMOTE_AGENT_EDITOR = 'remoteAgent_editor',
  REMOTE_AGENT_OWNER = 'remoteAgent_owner',
  SKILL_VIEWER = 'skill_viewer',
  SKILL_EDITOR = 'skill_editor',
  SKILL_OWNER = 'skill_owner',
  SHARED_LINK_VIEWER = 'sharedLink_viewer',
  SHARED_LINK_OWNER = 'sharedLink_owner',
  KNOWLEDGE_BASE_VIEWER = 'knowledgeBase_viewer',
  KNOWLEDGE_BASE_EDITOR = 'knowledgeBase_editor',
  KNOWLEDGE_BASE_OWNER = 'knowledgeBase_owner',
}
```

- [ ] **Step 3: Map roles to permission bits**

In `accessRoleToPermBits`, add the new roles to existing cases:

```ts
case AccessRoleIds.KNOWLEDGE_BASE_VIEWER:
  return PermissionBits.VIEW;
case AccessRoleIds.KNOWLEDGE_BASE_EDITOR:
  return PermissionBits.VIEW | PermissionBits.EDIT;
case AccessRoleIds.KNOWLEDGE_BASE_OWNER:
  return PermissionBits.VIEW | PermissionBits.EDIT | PermissionBits.DELETE | PermissionBits.SHARE;
```

- [ ] **Step 4: Verify shared package build**

Run:

```bash
npm run build:data-provider
```

Expected: command exits `0` and emits no TypeScript errors for `accessPermissions.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/data-provider/src/accessPermissions.ts
git commit -m "feat: add knowledge base ACL constants"
```

### Task 2: Add Shared Knowledge Base API Types And Endpoints

**Files:**
- Create: `packages/data-provider/src/types/knowledge.ts`
- Modify: `packages/data-provider/src/types/index.ts`
- Modify: `packages/data-provider/src/api-endpoints.ts`
- Modify: `packages/data-provider/src/data-service.ts`
- Modify: `packages/data-provider/src/keys.ts`

- [ ] **Step 1: Create shared knowledge types**

Create `packages/data-provider/src/types/knowledge.ts`:

```ts
export type KnowledgeBaseStatusCounts = {
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
};

export type KnowledgeBase = KnowledgeBaseStatusCounts & {
  id: string;
  name: string;
  description?: string;
  author: string;
  authorName?: string;
  tenantId?: string;
  lastIndexedAt?: string;
  createdAt: string;
  updatedAt: string;
  access?: 'owned' | 'shared' | 'team';
};

export type KnowledgeBaseDocumentStatus = 'processing' | 'ready' | 'failed';

export type KnowledgeBaseDocument = {
  id: string;
  knowledgeBaseId: string;
  file_id: string;
  filename: string;
  bytes: number;
  mimeType?: string;
  status: KnowledgeBaseDocumentStatus;
  error?: string;
  createdBy: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ListKnowledgeBasesRequest = {
  search?: string;
  cursor?: string;
  limit?: number;
  requiredPermission?: number;
};

export type ListKnowledgeBasesResponse = {
  data: KnowledgeBase[];
  nextCursor?: string;
};

export type CreateKnowledgeBaseRequest = {
  name: string;
  description?: string;
};

export type UpdateKnowledgeBaseRequest = {
  name?: string;
  description?: string;
};

export type ListKnowledgeBaseDocumentsResponse = {
  data: KnowledgeBaseDocument[];
  nextCursor?: string;
};

export type KnowledgeBaseSelectorItem = Pick<
  KnowledgeBase,
  'id' | 'name' | 'description' | 'documentCount' | 'readyDocumentCount' | 'failedDocumentCount'
>;
```

- [ ] **Step 2: Export types**

Add this export to `packages/data-provider/src/types/index.ts`:

```ts
export * from './knowledge';
```

- [ ] **Step 3: Add endpoint builders**

Add these exports to `packages/data-provider/src/api-endpoints.ts`:

```ts
export const knowledgeBases = () => '/api/knowledge-bases';
export const knowledgeBase = (id: string) => `/api/knowledge-bases/${encodeURIComponent(id)}`;
export const knowledgeBaseDocuments = (id: string) =>
  `/api/knowledge-bases/${encodeURIComponent(id)}/documents`;
export const knowledgeBaseDocument = (id: string, documentId: string) =>
  `/api/knowledge-bases/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`;
export const knowledgeBaseSelector = () => '/api/knowledge-bases/selector';
```

- [ ] **Step 4: Add data-service helpers**

Add imports from the new types in `packages/data-provider/src/data-service.ts`, then add:

```ts
export function listKnowledgeBases(params?: t.ListKnowledgeBasesRequest) {
  return request.get<t.ListKnowledgeBasesResponse>(endpoints.knowledgeBases(), { params });
}

export function getKnowledgeBase(id: string) {
  return request.get<t.KnowledgeBase>(endpoints.knowledgeBase(id));
}

export function createKnowledgeBase(data: t.CreateKnowledgeBaseRequest) {
  return request.post<t.KnowledgeBase>(endpoints.knowledgeBases(), data);
}

export function updateKnowledgeBase(id: string, data: t.UpdateKnowledgeBaseRequest) {
  return request.patch<t.KnowledgeBase>(endpoints.knowledgeBase(id), data);
}

export function deleteKnowledgeBase(id: string) {
  return request.delete<{ acknowledged: true }>(endpoints.knowledgeBase(id));
}

export function listKnowledgeBaseDocuments(id: string) {
  return request.get<t.ListKnowledgeBaseDocumentsResponse>(endpoints.knowledgeBaseDocuments(id));
}

export function uploadKnowledgeBaseDocuments(id: string, formData: FormData) {
  return request.post<t.ListKnowledgeBaseDocumentsResponse>(
    endpoints.knowledgeBaseDocuments(id),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

export function deleteKnowledgeBaseDocument(id: string, documentId: string) {
  return request.delete<{ acknowledged: true }>(endpoints.knowledgeBaseDocument(id, documentId));
}

export function listKnowledgeBaseSelector(params?: Pick<t.ListKnowledgeBasesRequest, 'search' | 'limit'>) {
  return request.get<t.ListKnowledgeBasesResponse>(endpoints.knowledgeBaseSelector(), { params });
}
```

- [ ] **Step 5: Add query keys**

Add keys in `packages/data-provider/src/keys.ts`:

```ts
knowledgeBases: 'knowledgeBases',
knowledgeBase: 'knowledgeBase',
knowledgeBaseDocuments: 'knowledgeBaseDocuments',
knowledgeBaseSelector: 'knowledgeBaseSelector',
```

- [ ] **Step 6: Verify shared package build**

Run:

```bash
npm run build:data-provider
```

Expected: command exits `0`.

- [ ] **Step 7: Commit**

```bash
git add packages/data-provider/src/types/knowledge.ts packages/data-provider/src/types/index.ts packages/data-provider/src/api-endpoints.ts packages/data-provider/src/data-service.ts packages/data-provider/src/keys.ts
git commit -m "feat: add knowledge base API contracts"
```

### Task 3: Add Knowledge Base Schemas, Models, And Methods

**Files:**
- Create: `packages/data-schemas/src/schema/knowledgeBase.ts`
- Create: `packages/data-schemas/src/schema/knowledgeBaseDocument.ts`
- Create: `packages/data-schemas/src/types/knowledgeBase.ts`
- Create: `packages/data-schemas/src/models/knowledgeBase.ts`
- Create: `packages/data-schemas/src/models/knowledgeBaseDocument.ts`
- Create: `packages/data-schemas/src/methods/knowledgeBase.ts`
- Create: `packages/data-schemas/src/methods/knowledgeBase.spec.ts`
- Modify: `packages/data-schemas/src/schema/index.ts`
- Modify: `packages/data-schemas/src/types/index.ts`
- Modify: `packages/data-schemas/src/models/index.ts`
- Modify: `packages/data-schemas/src/methods/index.ts`

- [ ] **Step 1: Write failing model/method tests**

Create `packages/data-schemas/src/methods/knowledgeBase.spec.ts`:

```ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { KnowledgeBase, KnowledgeBaseDocument } from '../models';
import {
  createKnowledgeBase,
  createKnowledgeBaseDocument,
  deleteKnowledgeBaseWithDocuments,
  findKnowledgeBaseById,
  findKnowledgeBaseDocuments,
  updateKnowledgeBaseCounts,
} from './knowledgeBase';

describe('knowledgeBase methods', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await KnowledgeBase.deleteMany({});
    await KnowledgeBaseDocument.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('creates and reads a knowledge base by id', async () => {
    const created = await createKnowledgeBase({
      id: 'kb_test_1',
      name: 'Support Playbooks',
      description: 'Internal support answers',
      author: 'user_1',
      authorName: 'Dana',
      tenantId: 'tenant_1',
    });

    const found = await findKnowledgeBaseById('kb_test_1', 'tenant_1');

    expect(created.id).toBe('kb_test_1');
    expect(found?.name).toBe('Support Playbooks');
    expect(found?.documentCount).toBe(0);
    expect(found?.readyDocumentCount).toBe(0);
    expect(found?.failedDocumentCount).toBe(0);
  });

  test('keeps document counts on the parent knowledge base', async () => {
    await createKnowledgeBase({
      id: 'kb_test_2',
      name: 'Sales',
      author: 'user_1',
      tenantId: 'tenant_1',
    });

    await createKnowledgeBaseDocument({
      id: 'kbdoc_1',
      knowledgeBaseId: 'kb_test_2',
      file_id: 'file_ready',
      filename: 'ready.pdf',
      bytes: 123,
      mimeType: 'application/pdf',
      status: 'ready',
      createdBy: 'user_1',
      tenantId: 'tenant_1',
    });
    await createKnowledgeBaseDocument({
      id: 'kbdoc_2',
      knowledgeBaseId: 'kb_test_2',
      file_id: 'file_failed',
      filename: 'failed.pdf',
      bytes: 456,
      mimeType: 'application/pdf',
      status: 'failed',
      error: 'Embedding failed',
      createdBy: 'user_1',
      tenantId: 'tenant_1',
    });

    const updated = await updateKnowledgeBaseCounts('kb_test_2', 'tenant_1');

    expect(updated?.documentCount).toBe(2);
    expect(updated?.readyDocumentCount).toBe(1);
    expect(updated?.failedDocumentCount).toBe(1);
  });

  test('deletes a knowledge base and all contained document records', async () => {
    await createKnowledgeBase({
      id: 'kb_test_3',
      name: 'Legal',
      author: 'user_1',
      tenantId: 'tenant_1',
    });
    await createKnowledgeBaseDocument({
      id: 'kbdoc_3',
      knowledgeBaseId: 'kb_test_3',
      file_id: 'file_3',
      filename: 'terms.pdf',
      bytes: 789,
      status: 'ready',
      createdBy: 'user_1',
      tenantId: 'tenant_1',
    });

    await deleteKnowledgeBaseWithDocuments('kb_test_3', 'tenant_1');

    expect(await findKnowledgeBaseById('kb_test_3', 'tenant_1')).toBeNull();
    await expect(findKnowledgeBaseDocuments('kb_test_3', 'tenant_1')).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd packages/data-schemas && npx jest src/methods/knowledgeBase.spec.ts --runInBand
```

Expected: FAIL because `../models` does not export `KnowledgeBase` and `./knowledgeBase` does not exist.

- [ ] **Step 3: Add schemas**

Create `packages/data-schemas/src/schema/knowledgeBase.ts`:

```ts
import mongoose from 'mongoose';

export const knowledgeBaseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    author: { type: String, required: true, index: true },
    authorName: { type: String, default: '' },
    documentCount: { type: Number, default: 0 },
    readyDocumentCount: { type: Number, default: 0 },
    failedDocumentCount: { type: Number, default: 0 },
    lastIndexedAt: { type: Date },
    tenantId: { type: String, index: true },
  },
  { timestamps: true },
);

knowledgeBaseSchema.index({ tenantId: 1, updatedAt: -1 });
knowledgeBaseSchema.index({ tenantId: 1, name: 1 });
```

Create `packages/data-schemas/src/schema/knowledgeBaseDocument.ts`:

```ts
import mongoose from 'mongoose';

export const knowledgeBaseDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    knowledgeBaseId: { type: String, required: true, index: true },
    file_id: { type: String, required: true, index: true },
    filename: { type: String, required: true },
    bytes: { type: Number, required: true },
    mimeType: { type: String, default: '' },
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      required: true,
      default: 'processing',
      index: true,
    },
    error: { type: String, default: '' },
    createdBy: { type: String, required: true, index: true },
    tenantId: { type: String, index: true },
  },
  { timestamps: true },
);

knowledgeBaseDocumentSchema.index({ tenantId: 1, knowledgeBaseId: 1, createdAt: -1 });
knowledgeBaseDocumentSchema.index({ tenantId: 1, knowledgeBaseId: 1, status: 1 });
```

- [ ] **Step 4: Add types**

Create `packages/data-schemas/src/types/knowledgeBase.ts`:

```ts
import type { Document, Model } from 'mongoose';
import type {
  KnowledgeBase as KnowledgeBaseDTO,
  KnowledgeBaseDocument as KnowledgeBaseDocumentDTO,
  KnowledgeBaseDocumentStatus,
} from 'librechat-data-provider';

export type KnowledgeBaseDocumentStatusValue = KnowledgeBaseDocumentStatus;

export type KnowledgeBaseRecord = KnowledgeBaseDTO & Document;

export type KnowledgeBaseDocumentRecord = KnowledgeBaseDocumentDTO & Document;

export type KnowledgeBaseModel = Model<KnowledgeBaseRecord>;

export type KnowledgeBaseDocumentModel = Model<KnowledgeBaseDocumentRecord>;

export type CreateKnowledgeBaseInput = {
  id: string;
  name: string;
  description?: string;
  author: string;
  authorName?: string;
  tenantId?: string;
};

export type CreateKnowledgeBaseDocumentInput = {
  id: string;
  knowledgeBaseId: string;
  file_id: string;
  filename: string;
  bytes: number;
  mimeType?: string;
  status: KnowledgeBaseDocumentStatusValue;
  error?: string;
  createdBy: string;
  tenantId?: string;
};
```

- [ ] **Step 5: Add models**

Create `packages/data-schemas/src/models/knowledgeBase.ts`:

```ts
import mongoose from 'mongoose';
import { knowledgeBaseSchema } from '../schema/knowledgeBase';
import type { KnowledgeBaseRecord } from '../types/knowledgeBase';

export const KnowledgeBase =
  mongoose.models.KnowledgeBase ||
  mongoose.model<KnowledgeBaseRecord>('KnowledgeBase', knowledgeBaseSchema);
```

Create `packages/data-schemas/src/models/knowledgeBaseDocument.ts`:

```ts
import mongoose from 'mongoose';
import { knowledgeBaseDocumentSchema } from '../schema/knowledgeBaseDocument';
import type { KnowledgeBaseDocumentRecord } from '../types/knowledgeBase';

export const KnowledgeBaseDocument =
  mongoose.models.KnowledgeBaseDocument ||
  mongoose.model<KnowledgeBaseDocumentRecord>('KnowledgeBaseDocument', knowledgeBaseDocumentSchema);
```

- [ ] **Step 6: Add methods**

Create `packages/data-schemas/src/methods/knowledgeBase.ts`:

```ts
import { KnowledgeBase, KnowledgeBaseDocument } from '../models';
import type {
  CreateKnowledgeBaseDocumentInput,
  CreateKnowledgeBaseInput,
} from '../types/knowledgeBase';

const tenantFilter = (tenantId?: string) => (tenantId ? { tenantId } : { tenantId: { $exists: false } });

export const createKnowledgeBase = (input: CreateKnowledgeBaseInput) =>
  KnowledgeBase.create({
    ...input,
    description: input.description ?? '',
    authorName: input.authorName ?? '',
    documentCount: 0,
    readyDocumentCount: 0,
    failedDocumentCount: 0,
  });

export const findKnowledgeBaseById = (id: string, tenantId?: string) =>
  KnowledgeBase.findOne({ id, ...tenantFilter(tenantId) }).lean();

export const updateKnowledgeBase = (
  id: string,
  tenantId: string | undefined,
  update: { name?: string; description?: string },
) =>
  KnowledgeBase.findOneAndUpdate({ id, ...tenantFilter(tenantId) }, { $set: update }, { new: true }).lean();

export const createKnowledgeBaseDocument = (input: CreateKnowledgeBaseDocumentInput) =>
  KnowledgeBaseDocument.create({ ...input, error: input.error ?? '', mimeType: input.mimeType ?? '' });

export const findKnowledgeBaseDocuments = (knowledgeBaseId: string, tenantId?: string) =>
  KnowledgeBaseDocument.find({ knowledgeBaseId, ...tenantFilter(tenantId) }).sort({ createdAt: -1 }).lean();

export const findReadyKnowledgeBaseDocumentFileIds = (knowledgeBaseIds: string[], tenantId?: string) =>
  KnowledgeBaseDocument.find({
    knowledgeBaseId: { $in: knowledgeBaseIds },
    status: 'ready',
    ...tenantFilter(tenantId),
  })
    .select({ file_id: 1, _id: 0 })
    .lean();

export const updateKnowledgeBaseCounts = async (id: string, tenantId?: string) => {
  const counts = await KnowledgeBaseDocument.aggregate<{
    _id: string;
    total: number;
    ready: number;
    failed: number;
  }>([
    { $match: { knowledgeBaseId: id, ...tenantFilter(tenantId) } },
    {
      $group: {
        _id: '$knowledgeBaseId',
        total: { $sum: 1 },
        ready: { $sum: { $cond: [{ $eq: ['$status', 'ready'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
      },
    },
  ]);
  const summary = counts[0] ?? { total: 0, ready: 0, failed: 0 };

  return KnowledgeBase.findOneAndUpdate(
    { id, ...tenantFilter(tenantId) },
    {
      $set: {
        documentCount: summary.total,
        readyDocumentCount: summary.ready,
        failedDocumentCount: summary.failed,
        lastIndexedAt: summary.ready > 0 ? new Date() : undefined,
      },
    },
    { new: true },
  ).lean();
};

export const deleteKnowledgeBaseDocument = (id: string, knowledgeBaseId: string, tenantId?: string) =>
  KnowledgeBaseDocument.findOneAndDelete({ id, knowledgeBaseId, ...tenantFilter(tenantId) }).lean();

export const deleteKnowledgeBaseWithDocuments = async (id: string, tenantId?: string) => {
  await KnowledgeBaseDocument.deleteMany({ knowledgeBaseId: id, ...tenantFilter(tenantId) });
  return KnowledgeBase.findOneAndDelete({ id, ...tenantFilter(tenantId) }).lean();
};
```

- [ ] **Step 7: Register exports**

Add exports:

```ts
// packages/data-schemas/src/schema/index.ts
export * from './knowledgeBase';
export * from './knowledgeBaseDocument';

// packages/data-schemas/src/types/index.ts
export * from './knowledgeBase';

// packages/data-schemas/src/models/index.ts
export * from './knowledgeBase';
export * from './knowledgeBaseDocument';

// packages/data-schemas/src/methods/index.ts
export * from './knowledgeBase';
```

- [ ] **Step 8: Run schema tests**

Run:

```bash
cd packages/data-schemas && npx jest src/methods/knowledgeBase.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/data-schemas/src/schema/knowledgeBase.ts packages/data-schemas/src/schema/knowledgeBaseDocument.ts packages/data-schemas/src/types/knowledgeBase.ts packages/data-schemas/src/models/knowledgeBase.ts packages/data-schemas/src/models/knowledgeBaseDocument.ts packages/data-schemas/src/methods/knowledgeBase.ts packages/data-schemas/src/methods/knowledgeBase.spec.ts packages/data-schemas/src/schema/index.ts packages/data-schemas/src/types/index.ts packages/data-schemas/src/models/index.ts packages/data-schemas/src/methods/index.ts
git commit -m "feat: add knowledge base persistence"
```

### Task 4: Seed Knowledge Base Access Roles

**Files:**
- Modify: `packages/data-schemas/src/methods/accessRole.ts`
- Modify: `packages/data-schemas/src/methods/accessRole.spec.ts`

- [ ] **Step 1: Add failing access role test**

Add a test case to `packages/data-schemas/src/methods/accessRole.spec.ts`:

```ts
test('seeds knowledge base access roles', async () => {
  await seedDefaultRoles();

  const roles = await findRolesByResourceType(ResourceType.KNOWLEDGE_BASE);
  const roleIds = roles.map((role) => role.accessRoleId).sort();

  expect(roleIds).toEqual([
    AccessRoleIds.KNOWLEDGE_BASE_EDITOR,
    AccessRoleIds.KNOWLEDGE_BASE_OWNER,
    AccessRoleIds.KNOWLEDGE_BASE_VIEWER,
  ].sort());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd packages/data-schemas && npx jest src/methods/accessRole.spec.ts --runInBand
```

Expected: FAIL because roles for `ResourceType.KNOWLEDGE_BASE` are not seeded.

- [ ] **Step 3: Add seeded roles**

In `packages/data-schemas/src/methods/accessRole.ts`, add:

```ts
{
  accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_VIEWER,
  name: 'Viewer',
  description: 'Can view this knowledge base',
  resourceType: ResourceType.KNOWLEDGE_BASE,
  permBits: PermissionBits.VIEW,
},
{
  accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_EDITOR,
  name: 'Editor',
  description: 'Can edit this knowledge base and manage its documents',
  resourceType: ResourceType.KNOWLEDGE_BASE,
  permBits: PermissionBits.VIEW | PermissionBits.EDIT,
},
{
  accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
  name: 'Owner',
  description: 'Can view, edit, delete, and share this knowledge base',
  resourceType: ResourceType.KNOWLEDGE_BASE,
  permBits: PermissionBits.VIEW | PermissionBits.EDIT | PermissionBits.DELETE | PermissionBits.SHARE,
},
```

- [ ] **Step 4: Run access role tests**

Run:

```bash
cd packages/data-schemas && npx jest src/methods/accessRole.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data-schemas/src/methods/accessRole.ts packages/data-schemas/src/methods/accessRole.spec.ts
git commit -m "feat: seed knowledge base access roles"
```

### Task 5: Build Backend Knowledge Base Service

**Files:**
- Create: `packages/api/src/knowledge/types.ts`
- Create: `packages/api/src/knowledge/service.ts`
- Create: `packages/api/src/knowledge/index.ts`
- Create: `packages/api/src/knowledge/service.spec.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing service tests**

Create `packages/api/src/knowledge/service.spec.ts` with cases:

```ts
import { PermissionBits, ResourceType, AccessRoleIds } from 'librechat-data-provider';
import {
  createKnowledgeBaseForUser,
  listKnowledgeBasesForUser,
  validateKnowledgeBaseBindings,
} from './service';

const deps = {
  createKnowledgeBase: jest.fn(),
  findKnowledgeBaseById: jest.fn(),
  grantPermission: jest.fn(),
  findAccessibleResources: jest.fn(),
  checkPermission: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('creates a knowledge base and grants owner permission to the creator', async () => {
  deps.createKnowledgeBase.mockResolvedValue({ id: 'kb_1', name: 'Support', author: 'user_1' });

  const result = await createKnowledgeBaseForUser(
    { userId: 'user_1', name: 'Dana', tenantId: 'tenant_1' },
    { name: 'Support', description: 'Support docs' },
    deps,
  );

  expect(result.id).toBe('kb_1');
  expect(deps.grantPermission).toHaveBeenCalledWith({
    principalType: 'user',
    principalId: 'user_1',
    resourceType: ResourceType.KNOWLEDGE_BASE,
    resourceId: 'kb_1',
    accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
    grantedBy: 'user_1',
  });
});

test('lists only ACL-accessible knowledge bases', async () => {
  deps.findAccessibleResources.mockResolvedValue(['kb_1', 'kb_2']);

  const result = await listKnowledgeBasesForUser(
    { userId: 'user_1', tenantId: 'tenant_1' },
    { limit: 20 },
    deps,
  );

  expect(result.data).toEqual([]);
  expect(deps.findAccessibleResources).toHaveBeenCalledWith({
    userId: 'user_1',
    role: undefined,
    resourceType: ResourceType.KNOWLEDGE_BASE,
    requiredPermission: PermissionBits.VIEW,
  });
});

test('rejects Agent bindings the editor cannot view', async () => {
  deps.checkPermission
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);

  await expect(
    validateKnowledgeBaseBindings(
      { userId: 'user_1', tenantId: 'tenant_1' },
      ['kb_allowed', 'kb_denied'],
      deps,
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd packages/api && npx jest src/knowledge/service.spec.ts --runInBand
```

Expected: FAIL because `src/knowledge/service.ts` does not exist.

- [ ] **Step 3: Add service types**

Create `packages/api/src/knowledge/types.ts`:

```ts
import type {
  CreateKnowledgeBaseRequest,
  ListKnowledgeBasesRequest,
  UpdateKnowledgeBaseRequest,
} from 'librechat-data-provider';

export type KnowledgeAuthContext = {
  userId: string;
  name?: string;
  role?: string;
  tenantId?: string;
};

export type CreateKnowledgeBaseServiceRequest = CreateKnowledgeBaseRequest;
export type UpdateKnowledgeBaseServiceRequest = UpdateKnowledgeBaseRequest;
export type ListKnowledgeBasesServiceRequest = ListKnowledgeBasesRequest;

export type KnowledgeServiceDeps = {
  createKnowledgeBase: (input: {
    id: string;
    name: string;
    description?: string;
    author: string;
    authorName?: string;
    tenantId?: string;
  }) => Promise<{ id: string }>;
  findKnowledgeBaseById: (id: string, tenantId?: string) => Promise<{ id: string } | null>;
  grantPermission: (input: {
    principalType: string;
    principalId: string;
    resourceType: string;
    resourceId: string;
    accessRoleId: string;
    grantedBy: string;
  }) => Promise<unknown>;
  findAccessibleResources: (input: {
    userId: string;
    role?: string;
    resourceType: string;
    requiredPermission: number;
  }) => Promise<string[]>;
  checkPermission: (input: {
    userId: string;
    role?: string;
    resourceType: string;
    resourceId: string;
    requiredPermission: number;
  }) => Promise<boolean>;
};
```

- [ ] **Step 4: Add service functions**

Create `packages/api/src/knowledge/service.ts`:

```ts
import { randomUUID } from 'crypto';
import {
  AccessRoleIds,
  PermissionBits,
  PrincipalType,
  ResourceType,
} from 'librechat-data-provider';
import type {
  CreateKnowledgeBaseServiceRequest,
  KnowledgeAuthContext,
  KnowledgeServiceDeps,
  ListKnowledgeBasesServiceRequest,
} from './types';

const forbidden = (message: string) => Object.assign(new Error(message), { statusCode: 403 });
const notFound = (message: string) => Object.assign(new Error(message), { statusCode: 404 });

export const createKnowledgeBaseForUser = async (
  auth: KnowledgeAuthContext,
  input: CreateKnowledgeBaseServiceRequest,
  deps: KnowledgeServiceDeps,
) => {
  const resourceId = `kb_${randomUUID()}`;
  const created = await deps.createKnowledgeBase({
    id: resourceId,
    name: input.name.trim(),
    description: input.description?.trim(),
    author: auth.userId,
    authorName: auth.name,
    tenantId: auth.tenantId,
  });

  await deps.grantPermission({
    principalType: PrincipalType.USER,
    principalId: auth.userId,
    resourceType: ResourceType.KNOWLEDGE_BASE,
    resourceId,
    accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
    grantedBy: auth.userId,
  });

  return created;
};

export const listKnowledgeBasesForUser = async (
  auth: KnowledgeAuthContext,
  input: ListKnowledgeBasesServiceRequest,
  deps: KnowledgeServiceDeps,
) => {
  await deps.findAccessibleResources({
    userId: auth.userId,
    role: auth.role,
    resourceType: ResourceType.KNOWLEDGE_BASE,
    requiredPermission: input.requiredPermission ?? PermissionBits.VIEW,
  });

  return { data: [], nextCursor: undefined };
};

export const requireKnowledgeBasePermission = async (
  auth: KnowledgeAuthContext,
  knowledgeBaseId: string,
  permission: PermissionBits,
  deps: KnowledgeServiceDeps,
) => {
  const exists = await deps.findKnowledgeBaseById(knowledgeBaseId, auth.tenantId);
  if (!exists) {
    throw notFound('Knowledge base not found');
  }

  const allowed = await deps.checkPermission({
    userId: auth.userId,
    role: auth.role,
    resourceType: ResourceType.KNOWLEDGE_BASE,
    resourceId: knowledgeBaseId,
    requiredPermission: permission,
  });
  if (!allowed) {
    throw forbidden('You do not have permission to access this knowledge base');
  }

  return exists;
};

export const validateKnowledgeBaseBindings = async (
  auth: KnowledgeAuthContext,
  knowledgeBaseIds: string[],
  deps: KnowledgeServiceDeps,
) => {
  const uniqueIds = Array.from(new Set(knowledgeBaseIds.filter(Boolean)));
  await Promise.all(
    uniqueIds.map((knowledgeBaseId) =>
      requireKnowledgeBasePermission(auth, knowledgeBaseId, PermissionBits.VIEW, deps),
    ),
  );
  return uniqueIds;
};
```

- [ ] **Step 5: Export module**

Create `packages/api/src/knowledge/index.ts`:

```ts
export * from './service';
export type * from './types';
```

Add to `packages/api/src/index.ts`:

```ts
export * as knowledge from './knowledge';
```

- [ ] **Step 6: Run service tests**

Run:

```bash
cd packages/api && npx jest src/knowledge/service.spec.ts --runInBand
```

Expected: PASS for the service contract tests.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/knowledge/types.ts packages/api/src/knowledge/service.ts packages/api/src/knowledge/index.ts packages/api/src/knowledge/service.spec.ts packages/api/src/index.ts
git commit -m "feat: add knowledge base service"
```

### Task 6: Add Knowledge Base Express Routes

**Files:**
- Create: `api/server/controllers/KnowledgeBaseController.js`
- Create: `api/server/routes/knowledgeBases.js`
- Create: `api/server/routes/knowledgeBases.test.js`
- Modify: `api/server/index.js`

- [x] **Step 1: Write route tests**

Create `api/server/routes/knowledgeBases.test.js`:

```js
const request = require('supertest');
const express = require('express');

jest.mock('~/server/controllers/KnowledgeBaseController', () => ({
  listKnowledgeBases: jest.fn((_req, res) => res.json({ data: [] })),
  createKnowledgeBase: jest.fn((_req, res) => res.status(201).json({ id: 'kb_1' })),
  getKnowledgeBase: jest.fn((_req, res) => res.json({ id: 'kb_1' })),
  updateKnowledgeBase: jest.fn((_req, res) => res.json({ id: 'kb_1' })),
  deleteKnowledgeBase: jest.fn((_req, res) => res.json({ acknowledged: true })),
}));

const routes = require('./knowledgeBases');
const controller = require('~/server/controllers/KnowledgeBaseController');

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: 'user_1', name: 'Dana' };
  next();
});
app.use('/api/knowledge-bases', routes);

describe('knowledge base routes', () => {
  test('lists knowledge bases', async () => {
    await request(app).get('/api/knowledge-bases').expect(200, { data: [] });
    expect(controller.listKnowledgeBases).toHaveBeenCalledTimes(1);
  });

  test('creates a knowledge base', async () => {
    await request(app).post('/api/knowledge-bases').send({ name: 'Support' }).expect(201);
    expect(controller.createKnowledgeBase).toHaveBeenCalledTimes(1);
  });

});
```

- [x] **Step 2: Run route tests to verify they fail**

Run:

```bash
cd api && npx jest server/routes/knowledgeBases.test.js --runInBand
```

Expected: FAIL because `server/routes/knowledgeBases.js` does not exist.

- [x] **Step 3: Add controller**

Create `api/server/controllers/KnowledgeBaseController.js`:

```js
const { logger } = require('@librechat/data-schemas');
const { knowledge } = require('@librechat/api');

const handleError = (res, error) => {
  logger.error('[KnowledgeBaseController]', error);
  res.status(error.statusCode || 500).json({ message: error.message || 'Knowledge base request failed' });
};

const authFromRequest = (req) => ({
  userId: req.user?.id,
  name: req.user?.name,
  role: req.user?.role,
  tenantId: req.user?.tenantId,
});

exports.listKnowledgeBases = async (req, res) => {
  try {
    const result = await knowledge.listKnowledgeBasesForUser(authFromRequest(req), req.query, req.app.locals.knowledgeDeps);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

exports.createKnowledgeBase = async (req, res) => {
  try {
    const result = await knowledge.createKnowledgeBaseForUser(authFromRequest(req), req.body, req.app.locals.knowledgeDeps);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error);
  }
};
```

- [x] **Step 4: Add router**

Create `api/server/routes/knowledgeBases.js`:

```js
const express = require('express');
const controller = require('~/server/controllers/KnowledgeBaseController');

const router = express.Router();

router.get('/', controller.listKnowledgeBases);
router.post('/', controller.createKnowledgeBase);
router.get('/selector', controller.listKnowledgeBases);

module.exports = router;
```

- [x] **Step 5: Mount routes**

In `api/server/index.js`, add:

```js
app.use('/api/knowledge-bases', require('./routes/knowledgeBases'));
```

Place this beside other authenticated API routes.

- [x] **Step 6: Run route tests**

Run:

```bash
cd api && npx jest server/routes/knowledgeBases.test.js --runInBand
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add api/server/controllers/KnowledgeBaseController.js api/server/routes/knowledgeBases.js api/server/routes/knowledgeBases.test.js api/server/index.js
git commit -m "feat: add knowledge base routes"
```

### Task 7: Complete Knowledge Base CRUD And Document Operations

**Files:**
- Modify: `packages/api/src/knowledge/service.ts`
- Modify: `packages/api/src/knowledge/types.ts`
- Modify: `packages/api/src/knowledge/service.spec.ts`
- Modify: `api/server/controllers/KnowledgeBaseController.js`
- Reuse existing file/RAG helpers from:
  - `api/server/services/Files/process.js`
  - `api/server/services/Files/VectorDB/crud.js`

- [x] **Step 1: Add service tests for edit/delete/documents**

Extend `packages/api/src/knowledge/service.spec.ts` with:

```ts
test('requires EDIT permission before uploading documents', async () => {
  deps.findKnowledgeBaseById.mockResolvedValue({ id: 'kb_1' });
  deps.checkPermission.mockResolvedValue(false);

  await expect(
    requireKnowledgeBasePermission(
      { userId: 'user_1', tenantId: 'tenant_1' },
      'kb_1',
      PermissionBits.EDIT,
      deps,
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
});

test('allows a shared Agent runtime to resolve ready documents without direct user ACL', async () => {
  const fileIds = await resolveKnowledgeBaseFileIdsForAgent(['kb_1'], {
    findReadyKnowledgeBaseDocumentFileIds: jest.fn().mockResolvedValue([
      { file_id: 'file_1' },
      { file_id: 'file_2' },
      { file_id: 'file_1' },
    ]),
  });

  expect(fileIds).toEqual(['file_1', 'file_2']);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
cd packages/api && npx jest src/knowledge/service.spec.ts --runInBand
```

Expected: FAIL because `resolveKnowledgeBaseFileIdsForAgent` is not exported.

- [x] **Step 3: Add runtime document resolver**

Add to `packages/api/src/knowledge/types.ts`:

```ts
export type KnowledgeRuntimeDeps = {
  findReadyKnowledgeBaseDocumentFileIds: (
    knowledgeBaseIds: string[],
    tenantId?: string,
  ) => Promise<Array<{ file_id: string }>>;
};
```

Add to `packages/api/src/knowledge/service.ts`:

```ts
import type { KnowledgeRuntimeDeps } from './types';

export const resolveKnowledgeBaseFileIdsForAgent = async (
  knowledgeBaseIds: string[],
  deps: KnowledgeRuntimeDeps,
  tenantId?: string,
) => {
  const rows = await deps.findReadyKnowledgeBaseDocumentFileIds(
    Array.from(new Set(knowledgeBaseIds.filter(Boolean))),
    tenantId,
  );
  return Array.from(new Set(rows.map((row) => row.file_id).filter(Boolean)));
};
```

- [x] **Step 4: Add full controller handlers and routes**

In `api/server/controllers/KnowledgeBaseController.js`, each handler must:

```js
exports.getKnowledgeBase = async (req, res) => {
  try {
    const result = await knowledge.getKnowledgeBaseForUser(
      authFromRequest(req),
      req.params.id,
      req.app.locals.knowledgeDeps,
    );
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};
```

Add `updateKnowledgeBase`, `deleteKnowledgeBase`, `listKnowledgeBaseDocuments`, `uploadKnowledgeBaseDocuments`, and `deleteKnowledgeBaseDocument` handlers with the same `try/catch` wrapper shape and the matching service function names. `uploadKnowledgeBaseDocuments` must call the existing file upload/RAG path and must create failed document records when RAG embedding returns an error. Do not return success when the embedding call failed.

In `api/server/routes/knowledgeBases.js`, add:

```js
router.get('/:id', controller.getKnowledgeBase);
router.patch('/:id', controller.updateKnowledgeBase);
router.delete('/:id', controller.deleteKnowledgeBase);
router.get('/:id/documents', controller.listKnowledgeBaseDocuments);
router.post('/:id/documents', controller.uploadKnowledgeBaseDocuments);
router.delete('/:id/documents/:documentId', controller.deleteKnowledgeBaseDocument);
```

- [x] **Step 5: Run backend tests**

Run:

```bash
cd packages/api && npx jest src/knowledge/service.spec.ts --runInBand
cd api && npx jest server/routes/knowledgeBases.test.js --runInBand
```

Expected: both commands PASS.

- [x] **Step 6: Commit**

```bash
git add packages/api/src/knowledge/service.ts packages/api/src/knowledge/types.ts packages/api/src/knowledge/service.spec.ts api/server/controllers/KnowledgeBaseController.js
git commit -m "feat: complete knowledge base backend operations"
```

### Task 8: Extend Agent Schema And Validation

**Files:**
- Modify: `packages/data-schemas/src/schema/agent.ts`
- Modify: `packages/data-provider/src/types/agents.ts`
- Modify: `packages/data-provider/src/types/assistants.ts`
- Modify: `packages/api/src/agents/validation.ts`

- [x] **Step 1: Add Agent schema field**

In `packages/data-schemas/src/schema/agent.ts`, add:

```ts
knowledge_base_ids: {
  type: [String],
  default: [],
},
```

- [x] **Step 2: Add shared Agent types**

In `packages/data-provider/src/types/agents.ts`, add:

```ts
knowledge_base_ids?: string[];
```

to Agent create/update/read types that already contain `tools` or `tool_resources`.

In `packages/data-provider/src/types/assistants.ts`, add the same field to shared Agent-compatible payload types that are used by Agent forms and API requests.

- [x] **Step 3: Add API validation**

In `packages/api/src/agents/validation.ts`, add the field to base/create/update schemas:

```ts
knowledge_base_ids: z.array(z.string().min(1)).default([]),
```

- [x] **Step 4: Run focused validation/build commands**

Run:

```bash
npm run build:data-provider
cd packages/api && npx jest src/agents/validation.spec.ts --runInBand
```

Expected: data-provider build exits `0`; validation tests PASS or Jest reports no matching validation spec if this workspace has no validation spec.

- [x] **Step 5: Commit**

```bash
git add packages/data-schemas/src/schema/agent.ts packages/data-provider/src/types/agents.ts packages/data-provider/src/types/assistants.ts packages/api/src/agents/validation.ts
git commit -m "feat: add agent knowledge base bindings"
```

### Task 9: Validate Agent Bindings And Auto-Enable File Search

**Files:**
- Modify: `api/server/controllers/agents/v1.js`
- Modify: `api/server/controllers/agents/v1.spec.js`
- Use service function from `packages/api/src/knowledge/service.ts`

- [x] **Step 1: Add controller tests**

In `api/server/controllers/agents/v1.spec.js`, add tests:

```js
test('create rejects knowledge bases the editor cannot view', async () => {
  mockValidateKnowledgeBaseBindings.mockRejectedValue(Object.assign(new Error('denied'), { statusCode: 403 }));

  await createAgent(reqWithBody({ knowledge_base_ids: ['kb_denied'] }), res, next);

  expect(res.status).toHaveBeenCalledWith(403);
});

test('create auto-enables file_search when knowledge bases are bound', async () => {
  mockValidateKnowledgeBaseBindings.mockResolvedValue(['kb_1']);

  await createAgent(reqWithBody({ knowledge_base_ids: ['kb_1'], tools: [] }), res, next);

  expect(mockCreateAgent).toHaveBeenCalledWith(
    expect.objectContaining({
      knowledge_base_ids: ['kb_1'],
      tools: expect.arrayContaining(['file_search']),
    }),
  );
});

test('duplicate revalidates knowledge base bindings for the copier', async () => {
  mockValidateKnowledgeBaseBindings.mockResolvedValue(['kb_1']);

  await duplicateAgent(reqWithParams({ id: 'agent_1' }), res, next);

  expect(mockValidateKnowledgeBaseBindings).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'user_1' }),
    ['kb_1'],
    expect.any(Object),
  );
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
cd api && npx jest server/controllers/agents/v1.spec.js --runInBand
```

Expected: FAIL because Agent controller does not validate `knowledge_base_ids`.

- [x] **Step 3: Add payload normalization helper**

In `api/server/controllers/agents/v1.js`, add:

```js
const { Tools } = require('librechat-data-provider');
const { knowledge } = require('@librechat/api');

const normalizeKnowledgeBaseAgentPayload = async ({ req, payload }) => {
  const requestedIds = Array.isArray(payload.knowledge_base_ids) ? payload.knowledge_base_ids : [];
  const knowledge_base_ids = await knowledge.validateKnowledgeBaseBindings(
    {
      userId: req.user.id,
      role: req.user.role,
      tenantId: req.user.tenantId,
    },
    requestedIds,
    req.app.locals.knowledgeDeps,
  );

  const tools = Array.isArray(payload.tools) ? [...payload.tools] : [];
  if (knowledge_base_ids.length > 0 && !tools.includes(Tools.file_search)) {
    tools.push(Tools.file_search);
  }

  return { ...payload, knowledge_base_ids, tools };
};
```

Call this helper in Agent create, update, and duplicate before the Agent is saved.

- [x] **Step 4: Run Agent controller tests**

Run:

```bash
cd api && npx jest server/controllers/agents/v1.spec.js --runInBand
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/server/controllers/agents/v1.js api/server/controllers/agents/v1.spec.js
git commit -m "feat: validate agent knowledge base bindings"
```

### Task 10: Resolve Knowledge Bases During Agent Runtime

**Files:**
- Modify: `api/server/services/Endpoints/agents/initialize.js`
- Modify: `api/server/services/Endpoints/agents/initialize.spec.js`

- [x] **Step 1: Add runtime tests**

In `api/server/services/Endpoints/agents/initialize.spec.js`, add:

```js
test('resolves bound knowledge bases into file_search file ids', async () => {
  mockResolveKnowledgeBaseFileIdsForAgent.mockResolvedValue(['file_kb_1', 'file_kb_2']);

  const initialized = await initializeAgent({
    agent: {
      id: 'agent_1',
      tools: ['file_search'],
      knowledge_base_ids: ['kb_1'],
      tool_resources: { file_search: { file_ids: ['file_existing'] } },
    },
    user: { id: 'shared_user' },
  });

  expect(initialized.tool_resources.file_search.file_ids).toEqual([
    'file_existing',
    'file_kb_1',
    'file_kb_2',
  ]);
});

test('does not check direct knowledge base ACL for a user running a shared Agent', async () => {
  await initializeAgent({
    agent: {
      id: 'agent_1',
      tools: ['file_search'],
      knowledge_base_ids: ['kb_1'],
      tool_resources: {},
    },
    user: { id: 'shared_user' },
  });

  expect(mockCheckPermission).not.toHaveBeenCalledWith(expect.objectContaining({
    resourceType: ResourceType.KNOWLEDGE_BASE,
  }));
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
cd api && npx jest server/services/Endpoints/agents/initialize.spec.js --runInBand
```

Expected: FAIL because runtime does not expand `knowledge_base_ids`.

- [x] **Step 3: Merge resolved file IDs into tool resources**

In `api/server/services/Endpoints/agents/initialize.js`, import:

```js
const { knowledge } = require('@librechat/api');
```

Before tool initialization, add:

```js
const mergeKnowledgeBaseFileSearch = async ({ agent, tenantId }) => {
  const knowledgeBaseIds = Array.isArray(agent.knowledge_base_ids) ? agent.knowledge_base_ids : [];
  if (knowledgeBaseIds.length === 0) {
    return agent;
  }

  const resolvedFileIds = await knowledge.resolveKnowledgeBaseFileIdsForAgent(
    knowledgeBaseIds,
    {
      findReadyKnowledgeBaseDocumentFileIds: db.findReadyKnowledgeBaseDocumentFileIds,
    },
    tenantId,
  );
  const currentFileIds = agent.tool_resources?.file_search?.file_ids ?? [];
  const file_ids = Array.from(new Set([...currentFileIds, ...resolvedFileIds]));

  return {
    ...agent,
    tools: Array.from(new Set([...(agent.tools ?? []), Tools.file_search])),
    tool_resources: {
      ...(agent.tool_resources ?? {}),
      file_search: {
        ...(agent.tool_resources?.file_search ?? {}),
        file_ids,
      },
    },
  };
};
```

Call `mergeKnowledgeBaseFileSearch` inside Agent initialization after the Agent record is loaded and before tool resolution. Do not call `checkPermission` for `ResourceType.KNOWLEDGE_BASE` in this runtime path.

- [x] **Step 4: Run runtime tests**

Run:

```bash
cd api && npx jest server/services/Endpoints/agents/initialize.spec.js --runInBand
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/server/services/Endpoints/agents/initialize.js api/server/services/Endpoints/agents/initialize.spec.js
git commit -m "feat: resolve agent knowledge bases at runtime"
```

### Task 11: Add Frontend Knowledge Base Data Hooks

**Files:**
- Create: `client/src/data-provider/KnowledgeBases/queries.ts`
- Create: `client/src/data-provider/KnowledgeBases/mutations.ts`
- Create: `client/src/data-provider/KnowledgeBases/index.ts`
- Modify: `client/src/data-provider/index.ts`

- [x] **Step 1: Add query hooks**

Create `client/src/data-provider/KnowledgeBases/queries.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { ListKnowledgeBasesRequest } from 'librechat-data-provider';

export const useKnowledgeBasesQuery = (params?: ListKnowledgeBasesRequest) =>
  useQuery([QueryKeys.knowledgeBases, params], () => dataService.listKnowledgeBases(params));

export const useKnowledgeBaseQuery = (id: string) =>
  useQuery([QueryKeys.knowledgeBase, id], () => dataService.getKnowledgeBase(id), {
    enabled: Boolean(id),
  });

export const useKnowledgeBaseDocumentsQuery = (id: string) =>
  useQuery([QueryKeys.knowledgeBaseDocuments, id], () => dataService.listKnowledgeBaseDocuments(id), {
    enabled: Boolean(id),
  });

export const useKnowledgeBaseSelectorQuery = (search: string) =>
  useQuery(
    [QueryKeys.knowledgeBaseSelector, search],
    () => dataService.listKnowledgeBaseSelector({ search, limit: 25 }),
    { keepPreviousData: true },
  );
```

- [x] **Step 2: Add mutation hooks**

Create `client/src/data-provider/KnowledgeBases/mutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest } from 'librechat-data-provider';

export const useCreateKnowledgeBaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation((data: CreateKnowledgeBaseRequest) => dataService.createKnowledgeBase(data), {
    onSuccess: () => queryClient.invalidateQueries([QueryKeys.knowledgeBases]),
  });
};

export const useUpdateKnowledgeBaseMutation = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation((data: UpdateKnowledgeBaseRequest) => dataService.updateKnowledgeBase(id, data), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.knowledgeBases]);
      queryClient.invalidateQueries([QueryKeys.knowledgeBase, id]);
    },
  });
};

export const useDeleteKnowledgeBaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation((id: string) => dataService.deleteKnowledgeBase(id), {
    onSuccess: () => queryClient.invalidateQueries([QueryKeys.knowledgeBases]),
  });
};

export const useUploadKnowledgeBaseDocumentsMutation = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation((formData: FormData) => dataService.uploadKnowledgeBaseDocuments(id, formData), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.knowledgeBase, id]);
      queryClient.invalidateQueries([QueryKeys.knowledgeBaseDocuments, id]);
    },
  });
};

export const useDeleteKnowledgeBaseDocumentMutation = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation((documentId: string) => dataService.deleteKnowledgeBaseDocument(id, documentId), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.knowledgeBase, id]);
      queryClient.invalidateQueries([QueryKeys.knowledgeBaseDocuments, id]);
    },
  });
};
```

- [x] **Step 3: Export hooks**

Create `client/src/data-provider/KnowledgeBases/index.ts`:

```ts
export * from './queries';
export * from './mutations';
```

Add to `client/src/data-provider/index.ts`:

```ts
export * from './KnowledgeBases';
```

- [x] **Step 4: Run client type check through build**

Run:

```bash
npm run build:data-provider
```

Expected: exits `0`. Client compilation will be covered after UI tasks.

- [x] **Step 5: Commit**

```bash
git add client/src/data-provider/KnowledgeBases/queries.ts client/src/data-provider/KnowledgeBases/mutations.ts client/src/data-provider/KnowledgeBases/index.ts client/src/data-provider/index.ts
git commit -m "feat: add knowledge base frontend data hooks"
```

### Task 12: Add Knowledge Base Management UI

**Files:**
- Create: `client/src/components/KnowledgeBases/index.ts`
- Create: `client/src/components/KnowledgeBases/KnowledgeBasePage.tsx`
- Create: `client/src/components/KnowledgeBases/KnowledgeBaseDetail.tsx`
- Create: `client/src/components/KnowledgeBases/KnowledgeBaseDocuments.tsx`
- Create: `client/src/components/KnowledgeBases/KnowledgeBaseAccess.tsx`
- Create: `client/src/components/KnowledgeBases/KnowledgeBaseSettings.tsx`
- Create: `client/src/components/KnowledgeBases/KnowledgeBaseCreateDialog.tsx`
- Create: `client/src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx`
- Create: `client/src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx`
- Modify: `client/src/routes/index.tsx`
- Modify: `client/src/hooks/Nav/useSideNavLinks.ts`
- Modify: `client/src/locales/en/translation.json`

- [x] **Step 1: Add UI tests**

Create `client/src/components/KnowledgeBases/__tests__/KnowledgeBasePage.spec.tsx`:

```tsx
import { render, screen } from 'test/layout-test-utils';
import { KnowledgeBasePage } from '../KnowledgeBasePage';

jest.mock('~/data-provider', () => ({
  useKnowledgeBasesQuery: () => ({
    data: {
      data: [
        {
          id: 'kb_1',
          name: 'Support',
          description: 'Support playbooks',
          documentCount: 2,
          readyDocumentCount: 1,
          failedDocumentCount: 1,
          updatedAt: '2026-06-23T00:00:00.000Z',
        },
      ],
    },
    isLoading: false,
  }),
  useCreateKnowledgeBaseMutation: () => ({ mutate: jest.fn(), isLoading: false }),
}));

test('renders visible knowledge bases', () => {
  render(<KnowledgeBasePage />);

  expect(screen.getByText('Support')).toBeInTheDocument();
  expect(screen.getByText('Support playbooks')).toBeInTheDocument();
  expect(screen.getByText('1 / 2 ready')).toBeInTheDocument();
});
```

Create `client/src/components/KnowledgeBases/__tests__/KnowledgeBaseDetail.spec.tsx`:

```tsx
import { render, screen } from 'test/layout-test-utils';
import { KnowledgeBaseDetail } from '../KnowledgeBaseDetail';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'kb_1' }),
}));

jest.mock('~/data-provider', () => ({
  useKnowledgeBaseQuery: () => ({
    data: {
      id: 'kb_1',
      name: 'Support',
      description: 'Support playbooks',
      documentCount: 1,
      readyDocumentCount: 1,
      failedDocumentCount: 0,
      updatedAt: '2026-06-23T00:00:00.000Z',
    },
    isLoading: false,
  }),
  useKnowledgeBaseDocumentsQuery: () => ({
    data: { data: [{ id: 'doc_1', filename: 'faq.pdf', status: 'ready', bytes: 100 }] },
    isLoading: false,
  }),
}));

test('renders detail and documents', () => {
  render(<KnowledgeBaseDetail />);

  expect(screen.getByText('Support')).toBeInTheDocument();
  expect(screen.getByText('faq.pdf')).toBeInTheDocument();
});
```

- [x] **Step 2: Run UI tests to verify they fail**

Run:

```bash
cd client && npx jest src/components/KnowledgeBases --runInBand
```

Expected: FAIL because components do not exist.

- [x] **Step 3: Add localized strings**

Add English keys to `client/src/locales/en/translation.json`:

```json
{
  "com_ui_knowledge": "Knowledge",
  "com_ui_knowledge_bases": "Knowledge bases",
  "com_ui_new_knowledge_base": "New knowledge base",
  "com_ui_search_knowledge_bases": "Search knowledge bases",
  "com_ui_knowledge_documents": "Documents",
  "com_ui_knowledge_access": "Access",
  "com_ui_knowledge_settings": "Settings",
  "com_ui_ready_count": "{{ready}} / {{total}} ready",
  "com_ui_upload_documents": "Upload documents"
}
```

- [x] **Step 4: Implement list page**

Create `client/src/components/KnowledgeBases/KnowledgeBasePage.tsx`:

```tsx
import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { useKnowledgeBasesQuery } from '~/data-provider';
import { Button, Input } from '~/components/ui';
import { KnowledgeBaseCreateDialog } from './KnowledgeBaseCreateDialog';

export function KnowledgeBasePage() {
  const localize = useLocalize();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useKnowledgeBasesQuery({ search, limit: 50 });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{localize('com_ui_knowledge_bases')}</h1>
        <Button type="button" onClick={() => setCreateOpen(true)} aria-label={localize('com_ui_new_knowledge_base')}>
          <Plus className="h-4 w-4" />
          <span>{localize('com_ui_new_knowledge_base')}</span>
        </Button>
      </header>
      <label className="flex items-center gap-2 rounded-md border px-3 py-2">
        <Search className="h-4 w-4" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={localize('com_ui_search_knowledge_bases')}
        />
      </label>
      <section className="flex flex-col divide-y rounded-md border">
        {isLoading ? (
          <div className="p-4">{localize('com_ui_loading')}</div>
        ) : (
          data?.data.map((knowledgeBase) => (
            <a
              key={knowledgeBase.id}
              href={`/knowledge/${knowledgeBase.id}`}
              className="grid gap-1 p-4 hover:bg-surface-hover"
            >
              <div className="font-medium">{knowledgeBase.name}</div>
              {knowledgeBase.description ? (
                <div className="text-sm text-text-secondary">{knowledgeBase.description}</div>
              ) : null}
              <div className="text-xs text-text-secondary">
                {localize('com_ui_ready_count', {
                  ready: knowledgeBase.readyDocumentCount,
                  total: knowledgeBase.documentCount,
                })}
              </div>
            </a>
          ))
        )}
      </section>
      <KnowledgeBaseCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}
```

- [x] **Step 5: Implement detail components**

Create the detail, documents, access, settings, and create dialog components using the same localize and hook pattern. The Access component must call existing permission UI/data flows with `ResourceType.KNOWLEDGE_BASE`; it must not create document-level access controls.

- [x] **Step 6: Add routes and navigation**

In `client/src/routes/index.tsx`, add lazy routes for:

```tsx
const KnowledgeBasePage = lazy(() => import('~/components/KnowledgeBases').then((module) => ({ default: module.KnowledgeBasePage })));
const KnowledgeBaseDetail = lazy(() => import('~/components/KnowledgeBases').then((module) => ({ default: module.KnowledgeBaseDetail })));
```

Add route entries:

```tsx
{
  path: '/knowledge',
  element: <KnowledgeBasePage />,
},
{
  path: '/knowledge/:id',
  element: <KnowledgeBaseDetail />,
},
```

In `client/src/hooks/Nav/useSideNavLinks.ts`, add a `Knowledge` item using the same shape as existing side nav links.

- [x] **Step 7: Run UI tests**

Run:

```bash
cd client && npx jest src/components/KnowledgeBases --runInBand
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add client/src/components/KnowledgeBases client/src/routes/index.tsx client/src/hooks/Nav/useSideNavLinks.ts client/src/locales/en/translation.json
git commit -m "feat: add knowledge base management UI"
```

### Task 13: Add Knowledge Bases To Agent Configuration UI

**Files:**
- Create: `client/src/components/SidePanel/Agents/KnowledgeBases.tsx`
- Create: `client/src/components/SidePanel/Agents/__tests__/KnowledgeBases.spec.tsx`
- Modify: `client/src/components/SidePanel/Agents/AgentConfig.tsx`
- Modify: `client/src/components/SidePanel/Agents/AgentPanel.tsx`
- Modify: `client/src/common/agents-types.ts`
- Modify: `client/src/components/SidePanel/Agents/config.ts`
- Modify: `client/src/components/SidePanel/Agents/AgentPanel.test.tsx`
- Modify: `client/src/locales/en/translation.json`

- [ ] **Step 1: Add Agent config tests**

Create `client/src/components/SidePanel/Agents/__tests__/KnowledgeBases.spec.tsx`:

```tsx
import { render, screen, fireEvent } from 'test/layout-test-utils';
import { KnowledgeBases } from '../KnowledgeBases';

jest.mock('~/data-provider', () => ({
  useKnowledgeBaseSelectorQuery: () => ({
    data: { data: [{ id: 'kb_1', name: 'Support', readyDocumentCount: 1, documentCount: 1 }] },
    isLoading: false,
  }),
}));

test('adds a knowledge base and enables file search', () => {
  const setValue = jest.fn();

  render(
    <KnowledgeBases
      value={[]}
      onChange={(ids) => setValue('knowledge_base_ids', ids)}
      enableFileSearch={() => setValue('tools', expect.arrayContaining(['file_search']))}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /add knowledge base/i }));
  fireEvent.click(screen.getByText('Support'));

  expect(setValue).toHaveBeenCalledWith('knowledge_base_ids', ['kb_1']);
  expect(setValue).toHaveBeenCalledWith('tools', expect.arrayContaining(['file_search']));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd client && npx jest src/components/SidePanel/Agents/__tests__/KnowledgeBases.spec.tsx --runInBand
```

Expected: FAIL because `KnowledgeBases.tsx` does not exist.

- [ ] **Step 3: Add localization**

Add keys to `client/src/locales/en/translation.json`:

```json
{
  "com_assistants_knowledge_bases": "Knowledge bases",
  "com_assistants_add_knowledge_base": "Add knowledge base",
  "com_assistants_no_knowledge_bases": "No knowledge bases selected"
}
```

- [ ] **Step 4: Implement Agent knowledge base selector**

Create `client/src/components/SidePanel/Agents/KnowledgeBases.tsx`:

```tsx
import React, { useState } from 'react';
import { Database, Plus, X } from 'lucide-react';
import { Tools } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { useKnowledgeBaseSelectorQuery } from '~/data-provider';
import { Button } from '~/components/ui';

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  enableFileSearch: () => void;
};

export function KnowledgeBases({ value, onChange, enableFileSearch }: Props) {
  const localize = useLocalize();
  const [search, setSearch] = useState('');
  const { data } = useKnowledgeBaseSelectorQuery(search);
  const selected = new Set(value);

  const addKnowledgeBase = (id: string) => {
    if (selected.has(id)) {
      return;
    }
    onChange([...value, id]);
    enableFileSearch();
  };

  const removeKnowledgeBase = (id: string) => {
    onChange(value.filter((currentId) => currentId !== id));
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Database className="h-4 w-4" />
          {localize('com_assistants_knowledge_bases')}
        </div>
        <Button type="button" variant="ghost" aria-label={localize('com_assistants_add_knowledge_base')}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length === 0 ? (
        <div className="text-sm text-text-secondary">{localize('com_assistants_no_knowledge_bases')}</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
              {id}
              <button type="button" aria-label={`Remove ${id}`} onClick={() => removeKnowledgeBase(id)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label={localize('com_ui_search_knowledge_bases')}
        className="rounded-md border px-2 py-1 text-sm"
      />
      <div className="flex flex-col gap-1">
        {data?.data.map((knowledgeBase) => (
          <button
            key={knowledgeBase.id}
            type="button"
            className="rounded-md px-2 py-1 text-left text-sm hover:bg-surface-hover"
            onClick={() => addKnowledgeBase(knowledgeBase.id)}
          >
            {knowledgeBase.name}
          </button>
        ))}
      </div>
    </section>
  );
}

export const enableKnowledgeBaseFileSearch = (tools: string[]) =>
  Array.from(new Set([...tools, Tools.file_search]));
```

Adapt styling to match existing Agent panel primitives during implementation, keeping the behavior above.

- [ ] **Step 5: Wire Agent form state**

In `client/src/common/agents-types.ts`, add:

```ts
knowledge_base_ids: string[];
```

In `client/src/components/SidePanel/Agents/config.ts`, add:

```ts
knowledge_base_ids: [],
```

In `client/src/components/SidePanel/Agents/AgentConfig.tsx`, render:

```tsx
<KnowledgeBases
  value={watch('knowledge_base_ids') ?? []}
  onChange={(ids) => setValue('knowledge_base_ids', ids)}
  enableFileSearch={() => setValue('tools', enableKnowledgeBaseFileSearch(watch('tools') ?? []))}
/>
```

- [ ] **Step 6: Include field in save payload**

In `client/src/components/SidePanel/Agents/AgentPanel.tsx`, include:

```ts
knowledge_base_ids: values.knowledge_base_ids ?? [],
```

in create and update payload composition.

- [ ] **Step 7: Run Agent UI tests**

Run:

```bash
cd client && npx jest src/components/SidePanel/Agents/__tests__/KnowledgeBases.spec.tsx src/components/SidePanel/Agents/AgentPanel.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/SidePanel/Agents/KnowledgeBases.tsx client/src/components/SidePanel/Agents/__tests__/KnowledgeBases.spec.tsx client/src/components/SidePanel/Agents/AgentConfig.tsx client/src/components/SidePanel/Agents/AgentPanel.tsx client/src/common/agents-types.ts client/src/components/SidePanel/Agents/config.ts client/src/components/SidePanel/Agents/AgentPanel.test.tsx client/src/locales/en/translation.json
git commit -m "feat: bind knowledge bases to agents in UI"
```

### Task 14: End-To-End Verification

**Files:**
- No new files unless a failing verification exposes a defect in files from earlier tasks.

- [ ] **Step 1: Build shared packages**

Run:

```bash
npm run build:data-provider
```

Expected: exits `0`.

- [ ] **Step 2: Run backend schema/service tests**

Run:

```bash
cd packages/data-schemas && npx jest src/methods/knowledgeBase.spec.ts src/methods/accessRole.spec.ts --runInBand
cd packages/api && npx jest src/knowledge/service.spec.ts --runInBand
cd api && npx jest server/routes/knowledgeBases.test.js server/controllers/agents/v1.spec.js server/services/Endpoints/agents/initialize.spec.js --runInBand
```

Expected: each command exits `0`.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
cd client && npx jest src/components/KnowledgeBases src/components/SidePanel/Agents/__tests__/KnowledgeBases.spec.tsx src/components/SidePanel/Agents/AgentPanel.test.tsx --runInBand
```

Expected: exits `0`.

- [ ] **Step 4: Run app smoke test locally**

Use the already configured local app and remote `zt` Docker-backed infrastructure. If local services are not running, start backend and frontend with:

```bash
npm run backend:dev
npm run frontend:dev
```

Expected:

- Backend responds at `http://localhost:3080/`.
- Frontend responds at `http://localhost:3090/`.
- `/knowledge` loads.
- Creating a knowledge base grants owner access.
- Uploading a document creates a document row with `ready` or `failed`.
- Agent config can bind the knowledge base.
- Saving the Agent sends `knowledge_base_ids`.
- Running the Agent calls existing `file_search` against resolved knowledge base file IDs.

- [ ] **Step 5: Commit verification fixes**

If verification required fixes, commit only those touched files:

```bash
git add packages/data-provider/src/accessPermissions.ts packages/data-provider/src/api-endpoints.ts packages/data-provider/src/data-service.ts packages/data-provider/src/keys.ts packages/data-schemas/src/methods/knowledgeBase.ts packages/api/src/knowledge/service.ts api/server/controllers/KnowledgeBaseController.js api/server/controllers/agents/v1.js api/server/services/Endpoints/agents/initialize.js client/src/components/KnowledgeBases client/src/components/SidePanel/Agents/KnowledgeBases.tsx
git commit -m "fix: stabilize knowledge base verification"
```

If no fixes were required, do not create an empty commit.

---

## Design Guardrails For Implementers

- Do not create a separate Team model. Use `Group` and ACL group principals.
- Do not add document-level ACL. Documents inherit the parent knowledge base permission model.
- Do not silently drop invalid `knowledge_base_ids` in Agent create/update. Reject them.
- Do not require direct knowledge base ACL when a user runs a shared Agent. Agent use permission is the retrieval gate.
- Do not create a separate vector store. Use the existing RAG API and `file_search` flow.
- Do not add extra Agent sharing warnings.
- Do not mask RAG upload/indexing failures as successful indexing.
- Keep new backend business logic in `packages/api`; keep `/api` changes as thin wrappers.
- Keep frontend text localized in `client/src/locales/en/translation.json` only.
