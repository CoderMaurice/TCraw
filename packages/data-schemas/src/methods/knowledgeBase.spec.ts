import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';
import type { IKnowledgeBase, IKnowledgeBaseDocument } from '~/types';
import { createKnowledgeBaseMethods, type KnowledgeBaseMethods } from './knowledgeBase';

jest.mock('~/config/winston', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

let mongoServer: InstanceType<typeof MongoMemoryServer>;
let KnowledgeBase: mongoose.Model<IKnowledgeBase>;
let KnowledgeBaseDocument: mongoose.Model<IKnowledgeBaseDocument>;
let methods: KnowledgeBaseMethods;
let modelsToCleanup: string[] = [];

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  const models = createModels(mongoose);
  modelsToCleanup = Object.keys(models);
  Object.assign(mongoose.models, models);

  KnowledgeBase = mongoose.models.KnowledgeBase as mongoose.Model<IKnowledgeBase>;
  KnowledgeBaseDocument = mongoose.models
    .KnowledgeBaseDocument as mongoose.Model<IKnowledgeBaseDocument>;
  methods = createKnowledgeBaseMethods(mongoose);

  await mongoose.connect(mongoUri);
  await Promise.all([KnowledgeBase.init(), KnowledgeBaseDocument.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();

  for (const modelName of modelsToCleanup) {
    if (mongoose.models[modelName]) {
      delete mongoose.models[modelName];
    }
  }
});

afterEach(async () => {
  await KnowledgeBase.deleteMany({});
  await KnowledgeBaseDocument.deleteMany({});
});

describe('KnowledgeBase methods', () => {
  it('creates and reads a knowledge base by id with default counts', async () => {
    const kb = await methods.createKnowledgeBase({
      id: 'kb-1',
      name: 'Support Docs',
      author: 'user-1',
    });

    expect(kb.name).toBe('Support Docs');
    expect(kb.description).toBe('');
    expect(kb.documentCount).toBe(0);
    expect(kb.readyDocumentCount).toBe(0);
    expect(kb.failedDocumentCount).toBe(0);

    const readKb = await methods.findKnowledgeBaseById('kb-1');
    expect(readKb?.id).toBe('kb-1');
    expect(readKb?.author).toBe('user-1');
  });

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

  it('updates total, ready, and failed document counts', async () => {
    await methods.createKnowledgeBase({
      id: 'kb-counts',
      name: 'Counts',
      author: 'user-1',
    });
    await methods.createKnowledgeBaseDocument({
      id: 'doc-processing',
      knowledgeBaseId: 'kb-counts',
      file_id: 'file-processing',
      filename: 'processing.txt',
      bytes: 100,
      createdBy: 'user-1',
    });
    await methods.createKnowledgeBaseDocument({
      id: 'doc-ready',
      knowledgeBaseId: 'kb-counts',
      file_id: 'file-ready',
      filename: 'ready.txt',
      bytes: 200,
      status: 'ready',
      createdBy: 'user-1',
    });
    await methods.createKnowledgeBaseDocument({
      id: 'doc-failed',
      knowledgeBaseId: 'kb-counts',
      file_id: 'file-failed',
      filename: 'failed.txt',
      bytes: 300,
      status: 'failed',
      error: 'Parse failed',
      createdBy: 'user-1',
    });

    const updated = await methods.updateKnowledgeBaseCounts('kb-counts');

    expect(updated?.documentCount).toBe(3);
    expect(updated?.readyDocumentCount).toBe(1);
    expect(updated?.failedDocumentCount).toBe(1);
    expect(updated?.lastIndexedAt).toBeInstanceOf(Date);
  });

  it('returns only ready document file ids for the requested knowledge bases', async () => {
    await methods.createKnowledgeBaseDocument({
      id: 'doc-ready-1',
      knowledgeBaseId: 'kb-ready-1',
      file_id: 'file-ready-1',
      filename: 'ready-1.txt',
      bytes: 100,
      status: 'ready',
      createdBy: 'user-1',
    });
    await methods.createKnowledgeBaseDocument({
      id: 'doc-processing-1',
      knowledgeBaseId: 'kb-ready-1',
      file_id: 'file-processing-1',
      filename: 'processing-1.txt',
      bytes: 100,
      createdBy: 'user-1',
    });
    await methods.createKnowledgeBaseDocument({
      id: 'doc-ready-2',
      knowledgeBaseId: 'kb-ready-2',
      file_id: 'file-ready-2',
      filename: 'ready-2.txt',
      bytes: 100,
      status: 'ready',
      createdBy: 'user-1',
    });

    const fileIds = await methods.findReadyKnowledgeBaseDocumentFileIds(['kb-ready-1']);

    expect(fileIds).toEqual([{ file_id: 'file-ready-1' }]);
  });

  it('updates a document status inside the requested knowledge base and tenant', async () => {
    await methods.createKnowledgeBaseDocument({
      id: 'doc-update',
      knowledgeBaseId: 'kb-update',
      file_id: 'file-update',
      filename: 'uploading.txt',
      bytes: 100,
      createdBy: 'user-1',
      tenantId: 'tenant-a',
    });

    const updated = await methods.updateKnowledgeBaseDocument(
      'doc-update',
      'kb-update',
      'tenant-a',
      {
        filename: 'ready.txt',
        bytes: 120,
        status: 'ready',
        error: '',
      },
    );

    expect(updated).toMatchObject({
      id: 'doc-update',
      knowledgeBaseId: 'kb-update',
      filename: 'ready.txt',
      bytes: 120,
      status: 'ready',
      error: '',
      tenantId: 'tenant-a',
    });

    const wrongTenant = await methods.updateKnowledgeBaseDocument(
      'doc-update',
      'kb-update',
      'tenant-b',
      { status: 'failed', error: 'wrong tenant' },
    );

    expect(wrongTenant).toBeNull();
  });

  it('finds knowledge bases by Mongo resource ids with tenant filtering in input order', async () => {
    const tenantAFirst = await methods.createKnowledgeBase({
      id: 'kb-tenant-a-first',
      name: 'Tenant A First',
      author: 'user-1',
      tenantId: 'tenant-a',
    });
    const tenantASecond = await methods.createKnowledgeBase({
      id: 'kb-tenant-a-second',
      name: 'Tenant A Second',
      author: 'user-1',
      tenantId: 'tenant-a',
    });
    const tenantB = await methods.createKnowledgeBase({
      id: 'kb-tenant-b',
      name: 'Tenant B',
      author: 'user-2',
      tenantId: 'tenant-b',
    });

    const results = await methods.findKnowledgeBasesByResourceIds(
      [tenantASecond._id!, tenantB._id!.toString(), tenantAFirst._id!.toString()],
      'tenant-a',
    );

    expect(results.map((kb) => kb.id)).toEqual(['kb-tenant-a-second', 'kb-tenant-a-first']);
  });

  it('deletes a knowledge base and all contained document records', async () => {
    await methods.createKnowledgeBase({
      id: 'kb-delete',
      name: 'Delete me',
      author: 'user-1',
    });
    await methods.createKnowledgeBaseDocument({
      id: 'doc-delete-1',
      knowledgeBaseId: 'kb-delete',
      file_id: 'file-delete-1',
      filename: 'delete-1.txt',
      bytes: 100,
      createdBy: 'user-1',
    });
    await methods.createKnowledgeBaseDocument({
      id: 'doc-delete-2',
      knowledgeBaseId: 'kb-delete',
      file_id: 'file-delete-2',
      filename: 'delete-2.txt',
      bytes: 100,
      createdBy: 'user-1',
    });

    const result = await methods.deleteKnowledgeBaseWithDocuments('kb-delete');
    const documents = await KnowledgeBaseDocument.find({ knowledgeBaseId: 'kb-delete' });
    const kb = await methods.findKnowledgeBaseById('kb-delete');

    expect(result.deletedCount).toBe(1);
    expect(result.documentDeletedCount).toBe(2);
    expect(documents).toHaveLength(0);
    expect(kb).toBeNull();
  });

  it('uses globally unique ids and explicit tenant filters do not leak documents', async () => {
    await methods.createKnowledgeBase({
      id: 'kb-tenant',
      name: 'Tenant A',
      author: 'user-1',
      tenantId: 'tenant-a',
    });

    await expect(
      methods.createKnowledgeBase({
        id: 'kb-tenant',
        name: 'Tenant B',
        author: 'user-2',
        tenantId: 'tenant-b',
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await methods.createKnowledgeBaseDocument({
      id: 'doc-tenant-a',
      knowledgeBaseId: 'kb-shared-name',
      file_id: 'file-tenant-a',
      filename: 'tenant-a.txt',
      bytes: 100,
      status: 'ready',
      createdBy: 'user-1',
      tenantId: 'tenant-a',
    });
    await methods.createKnowledgeBaseDocument({
      id: 'doc-tenant-b',
      knowledgeBaseId: 'kb-shared-name',
      file_id: 'file-tenant-b',
      filename: 'tenant-b.txt',
      bytes: 100,
      status: 'ready',
      createdBy: 'user-2',
      tenantId: 'tenant-b',
    });

    const tenantAFileIds = await methods.findReadyKnowledgeBaseDocumentFileIds(
      ['kb-shared-name'],
      'tenant-a',
    );
    const tenantBDocuments = await methods.findKnowledgeBaseDocuments('kb-shared-name', 'tenant-b');

    expect(tenantAFileIds).toEqual([{ file_id: 'file-tenant-a' }]);
    expect(tenantBDocuments.map((document) => document.file_id)).toEqual(['file-tenant-b']);
  });
});
