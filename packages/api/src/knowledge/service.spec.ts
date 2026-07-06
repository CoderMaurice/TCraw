import {
  AccessRoleIds,
  PermissionBits,
  PrincipalType,
  ResourceType,
} from 'librechat-data-provider';

import {
  buildWeKnoraKnowledgeContext,
  createKnowledgeBaseForUser,
  createKnowledgeBaseDocumentForUser,
  deleteKnowledgeBaseDocumentForUser,
  deleteKnowledgeBaseForUser,
  getKnowledgeBaseCapabilities,
  getKnowledgeBaseForUser,
  listKnowledgeBaseDocumentsForUser,
  listKnowledgeBasesForUser,
  assertKnowledgeBaseUploadable,
  requireKnowledgeBasePermission,
  resolveKnowledgeBaseFileIdsForAgent,
  updateKnowledgeBaseDocumentForUser,
  updateKnowledgeBaseForUser,
  validateKnowledgeBaseBindings,
} from './service';
import type {
  KnowledgeAuthContext,
  KnowledgeBaseDocumentRecord,
  KnowledgeBaseRecord,
  KnowledgeBaseServiceDependencies,
  WeKnoraClient,
} from './types';

type MongoId = {
  toString(): string;
};

function mongoId(value: string): MongoId {
  return {
    toString: () => value,
  };
}

function makeAuth(): KnowledgeAuthContext {
  return {
    userId: '507f1f77bcf86cd799439011',
    name: 'Ada Lovelace',
    tenantId: 'tenant-a',
    role: 'user',
  };
}

function makeDeps(): jest.Mocked<KnowledgeBaseServiceDependencies> {
  return {
    createKnowledgeBase: jest.fn(),
    findKnowledgeBaseById: jest.fn(),
    findKnowledgeBaseByExternalId: jest.fn(),
    upsertExternalKnowledgeBase: jest.fn(),
    findKnowledgeBasesByResourceIds: jest.fn(),
    updateKnowledgeBase: jest.fn(),
    createKnowledgeBaseDocument: jest.fn(),
    findKnowledgeBaseDocuments: jest.fn(),
    findReadyKnowledgeBaseDocumentFileIds: jest.fn(),
    updateKnowledgeBaseDocument: jest.fn(),
    updateKnowledgeBaseLifecycle: jest.fn(),
    updateKnowledgeBaseCounts: jest.fn(),
    deleteKnowledgeBaseDocument: jest.fn(),
    deleteKnowledgeBaseWithDocuments: jest.fn(),
    grantPermission: jest.fn(),
    findAccessibleResources: jest.fn(),
    checkPermission: jest.fn(),
    env: { WEKNORA_DEFAULT_CONFIG_KB_ID: 'wk_template' } as NodeJS.ProcessEnv,
  };
}

function makeKnowledgeBase(
  authOrOverrides: KnowledgeAuthContext | Partial<KnowledgeBaseRecord> = makeAuth(),
): KnowledgeBaseRecord {
  const auth = 'userId' in authOrOverrides ? authOrOverrides : makeAuth();
  const overrides = 'userId' in authOrOverrides ? {} : authOrOverrides;

  return {
    _id: mongoId('64f1f77bcf86cd799439011'),
    id: 'kb_allowed',
    name: 'Allowed',
    description: '',
    author: auth.userId,
    authorName: auth.name,
    tenantId: auth.tenantId,
    documentCount: 0,
    readyDocumentCount: 0,
    failedDocumentCount: 0,
    ...overrides,
  };
}

function makeDocument(auth = makeAuth()): KnowledgeBaseDocumentRecord {
  return {
    _id: mongoId('74f1f77bcf86cd799439011'),
    id: 'kbdoc_1',
    knowledgeBaseId: 'kb_allowed',
    file_id: 'file_1',
    filename: 'handbook.pdf',
    bytes: 1234,
    mimeType: 'application/pdf',
    status: 'ready',
    error: '',
    createdBy: auth.userId,
    tenantId: auth.tenantId,
  };
}

describe('knowledge base service', () => {
  it('rejects knowledge base creation when WeKnora is not configured', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    await expect(
      createKnowledgeBaseForUser(
        auth,
        { name: ' Product Docs ', description: ' Shared support knowledge ' },
        deps,
      ),
    ).rejects.toMatchObject({
      message: 'WeKnora knowledge service is not configured',
      statusCode: 500,
    });

    expect(deps.createKnowledgeBase).not.toHaveBeenCalled();
    expect(deps.grantPermission).not.toHaveBeenCalled();
  });

  it('creates knowledge bases in WeKnora and mirrors them locally', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.createKnowledgeBase.mockResolvedValue(makeKnowledgeBase({ id: 'kb_local' }));
    deps.weknoraClient = {
      createKnowledgeBase: jest.fn().mockResolvedValue({
        externalId: 'wk_new',
        externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
        externalShareId: '',
        name: '销售资料',
        description: '销售常用文档',
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
    } as unknown as WeKnoraClient;
    deps.upsertExternalKnowledgeBase = jest.fn().mockResolvedValue(
      makeKnowledgeBase({
        _id: mongoId('64f1f77bcf86cd799439088'),
        id: 'kb_new',
        provider: 'weknora',
        externalId: 'wk_new',
        externalShareId: '',
        name: '销售资料',
        lifecycleStatus: 'initializing',
      }),
    );
    deps.updateKnowledgeBaseLifecycle.mockResolvedValue(
      makeKnowledgeBase({
        _id: mongoId('64f1f77bcf86cd799439088'),
        id: 'kb_new',
        provider: 'weknora',
        externalId: 'wk_new',
        externalShareId: 'share_new',
        name: '销售资料',
        lifecycleStatus: 'ready',
      }),
    );
    deps.grantPermission.mockResolvedValue(null);

    const result = await createKnowledgeBaseForUser(
      auth,
      { name: ' 销售资料 ', description: ' 销售常用文档 ' },
      deps,
    );

    expect(deps.weknoraClient.createKnowledgeBase).toHaveBeenCalledWith({
      name: '销售资料',
      description: '销售常用文档',
    });
    expect(deps.createKnowledgeBase).not.toHaveBeenCalled();
    expect(deps.upsertExternalKnowledgeBase).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'weknora',
        externalId: 'wk_new',
        externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
        externalShareId: '',
        lifecycleStatus: 'initializing',
        lifecycleStep: 'initializing',
        lifecycleError: '',
        configTemplateExternalId: 'wk_template',
        name: '销售资料',
        description: '销售常用文档',
        documentCount: 0,
        readyDocumentCount: 0,
        failedDocumentCount: 0,
        processingDocumentCount: 0,
        author: auth.userId,
        authorName: auth.name,
        tenantId: auth.tenantId,
      }),
    );
    expect(deps.grantPermission).toHaveBeenCalledWith({
      principalType: PrincipalType.USER,
      principalId: auth.userId,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      resourceId: '64f1f77bcf86cd799439088',
      accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
      grantedBy: auth.userId,
    });
    expect(deps.grantPermission).not.toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'wk_new' }),
    );
    expect(deps.weknoraClient.copyInitializationConfig).toHaveBeenCalledWith(
      'wk_template',
      'wk_new',
    );
    expect(deps.weknoraClient.shareKnowledgeBase).toHaveBeenCalledWith('wk_new');
    expect(result.id).toBe('kb_new');
    expect(result.lifecycleStatus).toBe('ready');
  });

  it('reports WeKnora create capabilities from configured client and template env', () => {
    const deps = makeDeps();
    deps.weknoraClient = {
      createKnowledgeBase: jest.fn(),
    } as unknown as WeKnoraClient;

    expect(getKnowledgeBaseCapabilities(deps)).toEqual({
      weknora: {
        configured: true,
        canCreate: true,
        canUpload: true,
        requiresTemplate: true,
        templateConfigured: true,
      },
    });
  });

  it('disables create capability when the WeKnora template is missing', () => {
    const deps = makeDeps();
    deps.env = {};
    deps.weknoraClient = {
      createKnowledgeBase: jest.fn(),
    } as unknown as WeKnoraClient;

    expect(getKnowledgeBaseCapabilities(deps)).toEqual({
      weknora: {
        configured: true,
        canCreate: false,
        canUpload: true,
        requiresTemplate: true,
        templateConfigured: false,
      },
    });
  });

  it('creates a WeKnora knowledge base through initialization lifecycle', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.weknoraClient = {
      createKnowledgeBase: jest.fn().mockResolvedValue({
        externalId: 'wk_new',
        externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
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
    } as unknown as WeKnoraClient;
    deps.upsertExternalKnowledgeBase.mockResolvedValue(
      makeKnowledgeBase({
        _id: mongoId('64f1f77bcf86cd799439088'),
        id: 'kb_new',
        provider: 'weknora',
        externalId: 'wk_new',
        lifecycleStatus: 'initializing',
      }),
    );
    deps.updateKnowledgeBaseLifecycle.mockResolvedValue(
      makeKnowledgeBase({
        _id: mongoId('64f1f77bcf86cd799439088'),
        id: 'kb_new',
        provider: 'weknora',
        externalId: 'wk_new',
        externalShareId: 'share_new',
        lifecycleStatus: 'ready',
      }),
    );

    const result = await createKnowledgeBaseForUser(auth, { name: 'New KB' }, deps);

    expect(deps.weknoraClient.copyInitializationConfig).toHaveBeenCalledWith(
      'wk_template',
      'wk_new',
    );
    expect(deps.weknoraClient.shareKnowledgeBase).toHaveBeenCalledWith('wk_new');
    expect(deps.updateKnowledgeBaseLifecycle).toHaveBeenCalledWith(
      'kb_new',
      auth.tenantId,
      expect.objectContaining({
        lifecycleStatus: 'ready',
        lifecycleStep: 'ready',
        lifecycleError: '',
        externalShareId: 'share_new',
      }),
    );
    expect(result.lifecycleStatus).toBe('ready');
  });

  it('marks a created external knowledge base failed when initialization fails', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.weknoraClient = {
      createKnowledgeBase: jest.fn().mockResolvedValue({
        externalId: 'wk_failed',
        externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
        externalShareId: '',
        permission: 'editor',
        name: 'Broken KB',
        description: '',
        documentCount: 0,
        readyDocumentCount: 0,
        failedDocumentCount: 0,
        processingDocumentCount: 0,
      }),
      copyInitializationConfig: jest.fn().mockRejectedValue(new Error('copy failed')),
      shareKnowledgeBase: jest.fn(),
    } as unknown as WeKnoraClient;
    deps.upsertExternalKnowledgeBase.mockResolvedValue(
      makeKnowledgeBase({
        _id: mongoId('64f1f77bcf86cd799439088'),
        id: 'kb_failed',
        provider: 'weknora',
        externalId: 'wk_failed',
        lifecycleStatus: 'initializing',
      }),
    );
    deps.updateKnowledgeBaseLifecycle.mockResolvedValue(
      makeKnowledgeBase({
        id: 'kb_failed',
        provider: 'weknora',
        externalId: 'wk_failed',
        lifecycleStatus: 'failed',
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
    expect(deps.weknoraClient.shareKnowledgeBase).not.toHaveBeenCalled();
  });

  it('lists only WeKnora-backed accessible knowledge base records with VIEW by default', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const firstResourceId = mongoId('64f1f77bcf86cd799439011');
    const secondResourceId = mongoId('64f1f77bcf86cd799439012');
    const records = [
      {
        _id: firstResourceId,
        id: 'kb_first',
        name: 'First',
        description: '',
        author: auth.userId,
        authorName: auth.name,
        tenantId: auth.tenantId,
        documentCount: 0,
        readyDocumentCount: 0,
        failedDocumentCount: 0,
      },
      {
        _id: secondResourceId,
        id: 'kb_second',
        name: 'Second',
        description: '',
        author: auth.userId,
        authorName: auth.name,
        tenantId: auth.tenantId,
        provider: 'weknora',
        externalId: 'wk_second',
        documentCount: 1,
        readyDocumentCount: 1,
        failedDocumentCount: 0,
      },
    ];

    deps.findAccessibleResources.mockResolvedValue([firstResourceId, secondResourceId]);
    deps.findKnowledgeBasesByResourceIds.mockResolvedValue(records);

    const result = await listKnowledgeBasesForUser(auth, {}, deps);

    expect(result).toEqual({
      data: [{ ...records[1], access: 'owned' }],
      nextCursor: undefined,
    });
    expect(deps.findAccessibleResources).toHaveBeenCalledWith({
      userId: auth.userId,
      role: auth.role,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      requiredPermissions: PermissionBits.VIEW,
    });
    expect(deps.findKnowledgeBasesByResourceIds).toHaveBeenCalledWith(
      [firstResourceId, secondResourceId],
      auth.tenantId,
    );
  });

  it('does not grant access to organization-shared WeKnora knowledge bases while listing', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.weknoraClient = {
      listSharedKnowledgeBases: jest.fn().mockResolvedValue([
        {
          externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
          externalSpaceId: '3c6805d0-88c3-46dd-8d20-3a90dd51d63d',
          externalShareId: '003cff10-6084-4602-84c3-86d3b9e3fa74',
          permission: 'editor',
          name: '上海致拓',
          description: '',
          documentCount: 22,
          readyDocumentCount: 22,
          failedDocumentCount: 0,
          processingDocumentCount: 0,
        },
      ]),
    } as unknown as WeKnoraClient;
    deps.findAccessibleResources.mockResolvedValue([]);

    const result = await listKnowledgeBasesForUser(auth, {}, deps);

    expect(result).toEqual({ data: [], nextCursor: undefined });
    expect(deps.weknoraClient.listSharedKnowledgeBases).not.toHaveBeenCalled();
    expect(deps.upsertExternalKnowledgeBase).not.toHaveBeenCalled();
    expect(deps.grantPermission).not.toHaveBeenCalled();
  });

  it('labels listed knowledge bases as owned or shared from the current user perspective', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findAccessibleResources.mockResolvedValue([
      '64f1f77bcf86cd799439099',
      '64f1f77bcf86cd799439100',
    ]);
    deps.findKnowledgeBasesByResourceIds.mockResolvedValue([
      makeKnowledgeBase({
        _id: mongoId('64f1f77bcf86cd799439099'),
        id: 'kb_owned',
        provider: 'weknora',
        author: auth.userId,
      }),
      makeKnowledgeBase({
        _id: mongoId('64f1f77bcf86cd799439100'),
        id: 'kb_shared',
        provider: 'weknora',
        author: 'other_user',
      }),
    ]);

    const result = await listKnowledgeBasesForUser(auth, {}, deps);

    expect(result.data.map((knowledgeBase) => [knowledgeBase.id, knowledgeBase.access])).toEqual([
      ['kb_owned', 'owned'],
      ['kb_shared', 'shared'],
    ]);
  });

  it('does not query knowledge base records when no accessible resources exist', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findAccessibleResources.mockResolvedValue([]);

    const result = await listKnowledgeBasesForUser(auth, {}, deps);

    expect(result).toEqual({ data: [], nextCursor: undefined });
    expect(deps.findKnowledgeBasesByResourceIds).not.toHaveBeenCalled();
  });

  it('gets a knowledge base after VIEW permission succeeds', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const kb = makeKnowledgeBase(auth);

    deps.findKnowledgeBaseById.mockResolvedValue(kb);
    deps.checkPermission.mockResolvedValue(true);

    const result = await getKnowledgeBaseForUser(auth, 'kb_allowed', deps);

    expect(result).toBe(kb);
    expect(deps.checkPermission).toHaveBeenCalledWith({
      userId: auth.userId,
      role: auth.role,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      resourceId: '64f1f77bcf86cd799439011',
      requiredPermission: PermissionBits.VIEW,
    });
  });

  it('updates sanitized editable fields after EDIT permission succeeds', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const kb = makeKnowledgeBase(auth);
    const updated = { ...kb, name: 'Updated', description: 'New description' };

    deps.findKnowledgeBaseById.mockResolvedValue(kb);
    deps.checkPermission.mockResolvedValue(true);
    deps.updateKnowledgeBase.mockResolvedValue(updated);

    const result = await updateKnowledgeBaseForUser(
      auth,
      'kb_allowed',
      { name: ' Updated ', description: ' New description ' },
      deps,
    );

    expect(result).toBe(updated);
    expect(deps.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPermission: PermissionBits.EDIT }),
    );
    expect(deps.updateKnowledgeBase).toHaveBeenCalledWith('kb_allowed', auth.tenantId, {
      name: 'Updated',
      description: 'New description',
    });
  });

  it('returns a 404-style error when an authorized update no longer finds the record', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findKnowledgeBaseById.mockResolvedValue(makeKnowledgeBase(auth));
    deps.checkPermission.mockResolvedValue(true);
    deps.updateKnowledgeBase.mockResolvedValue(null);

    await expect(
      updateKnowledgeBaseForUser(auth, 'kb_allowed', { name: 'Renamed' }, deps),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('deletes a knowledge base and documents after DELETE permission succeeds', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findKnowledgeBaseById.mockResolvedValue(makeKnowledgeBase(auth));
    deps.checkPermission.mockResolvedValue(true);
    deps.deleteKnowledgeBaseWithDocuments.mockResolvedValue({
      deletedCount: 1,
      documentDeletedCount: 2,
    });

    const result = await deleteKnowledgeBaseForUser(auth, 'kb_allowed', deps);

    expect(result).toEqual({ acknowledged: true });
    expect(deps.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPermission: PermissionBits.DELETE }),
    );
    expect(deps.deleteKnowledgeBaseWithDocuments).toHaveBeenCalledWith('kb_allowed', auth.tenantId);
  });

  it('lists documents after VIEW permission succeeds', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const document = makeDocument(auth);

    deps.findKnowledgeBaseById.mockResolvedValue(makeKnowledgeBase(auth));
    deps.checkPermission.mockResolvedValue(true);
    deps.findKnowledgeBaseDocuments.mockResolvedValue([document]);

    const result = await listKnowledgeBaseDocumentsForUser(auth, 'kb_allowed', {}, deps);

    expect(result).toEqual({ data: [document], nextCursor: undefined });
    expect(deps.findKnowledgeBaseDocuments).toHaveBeenCalledWith('kb_allowed', auth.tenantId);
  });

  it('lists documents from WeKnora for WeKnora-backed knowledge bases', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    deps.weknoraClient = {
      listDocuments: jest.fn().mockResolvedValue({
        data: [
          {
            externalId: 'wk_doc_1',
            externalKnowledgeBaseId: 'wk_kb_1',
            fileId: 'file_1',
            filename: 'guide.pdf',
            bytes: 123,
            mimeType: 'application/pdf',
            status: 'ready',
            error: '',
          },
        ],
        nextCursor: '3',
      }),
    } as unknown as WeKnoraClient;

    deps.findKnowledgeBaseById.mockResolvedValue(
      makeKnowledgeBase({
        id: 'kb_weknora',
        provider: 'weknora',
        externalId: 'wk_kb_1',
      }),
    );
    deps.checkPermission.mockResolvedValue(true);

    const result = await listKnowledgeBaseDocumentsForUser(
      auth,
      'kb_weknora',
      { cursor: '2', limit: 50 },
      deps,
    );

    expect(result).toEqual({
      data: [
        {
          id: 'wk_doc_1',
          knowledgeBaseId: 'kb_weknora',
          file_id: 'file_1',
          filename: 'guide.pdf',
          bytes: 123,
          mimeType: 'application/pdf',
          status: 'ready',
          error: '',
          createdBy: auth.userId,
          tenantId: auth.tenantId,
        },
      ],
      nextCursor: '3',
    });
    expect(deps.weknoraClient.listDocuments).toHaveBeenCalledWith('wk_kb_1', {
      cursor: '2',
      limit: 50,
    });
    expect(deps.findKnowledgeBaseDocuments).not.toHaveBeenCalled();
  });

  it('syncs local document counts after listing a complete WeKnora document page', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    deps.weknoraClient = {
      listDocuments: jest.fn().mockResolvedValue({
        data: [
          {
            externalId: 'wk_doc_ready',
            externalKnowledgeBaseId: 'wk_kb_1',
            fileId: 'file_ready',
            filename: 'ready.pdf',
            bytes: 123,
            mimeType: 'application/pdf',
            status: 'ready',
            error: '',
          },
          {
            externalId: 'wk_doc_processing',
            externalKnowledgeBaseId: 'wk_kb_1',
            fileId: 'file_processing',
            filename: 'processing.pdf',
            bytes: 456,
            mimeType: 'application/pdf',
            status: 'processing',
            error: '',
          },
          {
            externalId: 'wk_doc_failed',
            externalKnowledgeBaseId: 'wk_kb_1',
            fileId: 'file_failed',
            filename: 'failed.pdf',
            bytes: 789,
            mimeType: 'application/pdf',
            status: 'failed',
            error: 'parse failed',
          },
        ],
        total: 3,
      }),
    } as unknown as WeKnoraClient;

    deps.findKnowledgeBaseById.mockResolvedValue(
      makeKnowledgeBase({
        id: 'kb_weknora',
        provider: 'weknora',
        externalId: 'wk_kb_1',
        documentCount: 0,
        readyDocumentCount: 0,
        failedDocumentCount: 0,
        processingDocumentCount: 0,
      }),
    );
    deps.checkPermission.mockResolvedValue(true);
    deps.updateKnowledgeBaseLifecycle.mockResolvedValue(null);

    await listKnowledgeBaseDocumentsForUser(auth, 'kb_weknora', { limit: 50 }, deps);

    expect(deps.updateKnowledgeBaseLifecycle).toHaveBeenCalledWith(
      'kb_weknora',
      auth.tenantId,
      expect.objectContaining({
        documentCount: 3,
        readyDocumentCount: 1,
        failedDocumentCount: 1,
        processingDocumentCount: 1,
      }),
    );
  });

  it('rejects WeKnora-backed document listing when the external id is missing', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    deps.weknoraClient = {
      listDocuments: jest.fn(),
    } as unknown as WeKnoraClient;

    deps.findKnowledgeBaseById.mockResolvedValue(
      makeKnowledgeBase({
        id: 'kb_weknora',
        provider: 'weknora',
      }),
    );
    deps.checkPermission.mockResolvedValue(true);

    await expect(
      listKnowledgeBaseDocumentsForUser(auth, 'kb_weknora', {}, deps),
    ).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(deps.weknoraClient.listDocuments).not.toHaveBeenCalled();
    expect(deps.findKnowledgeBaseDocuments).not.toHaveBeenCalled();
  });

  it('rejects WeKnora-backed document listing when the WeKnora client is unavailable', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findKnowledgeBaseById.mockResolvedValue(
      makeKnowledgeBase({
        id: 'kb_weknora',
        provider: 'weknora',
        externalId: 'wk_kb_1',
      }),
    );
    deps.checkPermission.mockResolvedValue(true);

    await expect(
      listKnowledgeBaseDocumentsForUser(auth, 'kb_weknora', {}, deps),
    ).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(deps.findKnowledgeBaseDocuments).not.toHaveBeenCalled();
  });

  it('rejects uploading to a WeKnora knowledge base before it is ready', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findKnowledgeBaseById.mockResolvedValue(
      makeKnowledgeBase({
        id: 'kb_initializing',
        provider: 'weknora',
        externalId: 'wk_initializing',
        lifecycleStatus: 'initializing',
      }),
    );
    deps.checkPermission.mockResolvedValue(true);
    deps.weknoraClient = {
      uploadDocument: jest.fn(),
    } as unknown as WeKnoraClient;

    await expect(
      assertKnowledgeBaseUploadable(auth, 'kb_initializing', deps),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Knowledge base is not ready for uploads',
    });
  });

  it('skips WeKnora search when the current user lacks VIEW on a bound knowledge base', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    deps.findKnowledgeBaseById.mockResolvedValue(
      makeKnowledgeBase({
        id: 'kb_weknora',
        provider: 'weknora',
        externalId: 'wk_kb_1',
      }),
    );
    deps.checkPermission.mockResolvedValue(false);
    deps.weknoraClient = {
      search: jest.fn(),
    } as unknown as WeKnoraClient;

    const context = await buildWeKnoraKnowledgeContext(
      auth,
      {
        query: '怎么报销',
        knowledgeBaseIds: ['kb_weknora'],
      },
      deps,
    );

    expect(context).toBe('');
    expect(deps.checkPermission).toHaveBeenCalledWith({
      userId: auth.userId,
      role: auth.role,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      resourceId: '64f1f77bcf86cd799439011',
      requiredPermission: PermissionBits.VIEW,
    });
    expect(deps.weknoraClient.search).not.toHaveBeenCalled();
  });

  it('creates a ready document and refreshes counts after EDIT permission succeeds', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const document = makeDocument(auth);

    deps.findKnowledgeBaseById.mockResolvedValue(makeKnowledgeBase(auth));
    deps.checkPermission.mockResolvedValue(true);
    deps.createKnowledgeBaseDocument.mockResolvedValue(document);
    deps.updateKnowledgeBaseCounts.mockResolvedValue(makeKnowledgeBase(auth));

    const result = await createKnowledgeBaseDocumentForUser(
      auth,
      'kb_allowed',
      {
        file_id: 'file_1',
        filename: ' handbook.pdf ',
        bytes: 1234,
        mimeType: 'application/pdf',
        status: 'ready',
      },
      deps,
    );

    expect(result).toBe(document);
    expect(deps.createKnowledgeBaseDocument).toHaveBeenCalledWith({
      id: expect.stringMatching(/^kbdoc_[0-9a-f-]+$/),
      knowledgeBaseId: 'kb_allowed',
      file_id: 'file_1',
      filename: 'handbook.pdf',
      bytes: 1234,
      mimeType: 'application/pdf',
      status: 'ready',
      error: undefined,
      createdBy: auth.userId,
      tenantId: auth.tenantId,
    });
    expect(deps.updateKnowledgeBaseCounts).toHaveBeenCalledWith('kb_allowed', auth.tenantId);
  });

  it('creates a failed document, refreshes counts, and rejects failed uploads', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const failedDocument = {
      ...makeDocument(auth),
      status: 'failed' as const,
      error: 'RAG failed',
    };

    deps.findKnowledgeBaseById.mockResolvedValue(makeKnowledgeBase(auth));
    deps.checkPermission.mockResolvedValue(true);
    deps.createKnowledgeBaseDocument.mockResolvedValue(failedDocument);
    deps.updateKnowledgeBaseCounts.mockResolvedValue(makeKnowledgeBase(auth));

    await expect(
      createKnowledgeBaseDocumentForUser(
        auth,
        'kb_allowed',
        {
          file_id: 'file_1',
          filename: 'handbook.pdf',
          bytes: 1234,
          mimeType: 'application/pdf',
          status: 'failed',
          error: 'RAG failed',
        },
        deps,
      ),
    ).rejects.toMatchObject({
      statusCode: 500,
      document: failedDocument,
    });
    expect(deps.createKnowledgeBaseDocument).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'RAG failed' }),
    );
    expect(deps.updateKnowledgeBaseCounts).toHaveBeenCalledWith('kb_allowed', auth.tenantId);
  });

  it('updates a processing document status and refreshes counts after EDIT permission succeeds', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const updatedDocument = {
      ...makeDocument(auth),
      status: 'ready' as const,
      filename: 'indexed.pdf',
      error: '',
    };

    deps.findKnowledgeBaseById.mockResolvedValue(makeKnowledgeBase(auth));
    deps.checkPermission.mockResolvedValue(true);
    deps.updateKnowledgeBaseDocument.mockResolvedValue(updatedDocument);
    deps.updateKnowledgeBaseCounts.mockResolvedValue(makeKnowledgeBase(auth));

    const result = await updateKnowledgeBaseDocumentForUser(
      auth,
      'kb_allowed',
      'kbdoc_1',
      {
        filename: ' indexed.pdf ',
        bytes: 2048,
        mimeType: 'application/pdf',
        status: 'ready',
        error: '',
      },
      deps,
    );

    expect(result).toBe(updatedDocument);
    expect(deps.updateKnowledgeBaseDocument).toHaveBeenCalledWith(
      'kbdoc_1',
      'kb_allowed',
      auth.tenantId,
      {
        filename: 'indexed.pdf',
        bytes: 2048,
        mimeType: 'application/pdf',
        status: 'ready',
        error: '',
      },
    );
    expect(deps.updateKnowledgeBaseCounts).toHaveBeenCalledWith('kb_allowed', auth.tenantId);
  });

  it('deletes a document after EDIT permission succeeds and refreshes counts', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findKnowledgeBaseById.mockResolvedValue(makeKnowledgeBase(auth));
    deps.checkPermission.mockResolvedValue(true);
    deps.deleteKnowledgeBaseDocument.mockResolvedValue({ deletedCount: 1 });
    deps.updateKnowledgeBaseCounts.mockResolvedValue(makeKnowledgeBase(auth));

    const result = await deleteKnowledgeBaseDocumentForUser(auth, 'kb_allowed', 'kbdoc_1', deps);

    expect(result).toEqual({ acknowledged: true });
    expect(deps.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPermission: PermissionBits.EDIT }),
    );
    expect(deps.deleteKnowledgeBaseDocument).toHaveBeenCalledWith(
      'kbdoc_1',
      'kb_allowed',
      auth.tenantId,
    );
    expect(deps.updateKnowledgeBaseCounts).toHaveBeenCalledWith('kb_allowed', auth.tenantId);
  });

  it('rejects bindings when the second knowledge base is denied', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findKnowledgeBaseById
      .mockResolvedValueOnce({
        _id: mongoId('64f1f77bcf86cd799439011'),
        id: 'kb_allowed',
        name: 'Allowed',
        description: '',
        author: auth.userId,
        authorName: auth.name,
        tenantId: auth.tenantId,
        documentCount: 0,
        readyDocumentCount: 0,
        failedDocumentCount: 0,
      })
      .mockResolvedValueOnce({
        _id: mongoId('64f1f77bcf86cd799439012'),
        id: 'kb_denied',
        name: 'Denied',
        description: '',
        author: auth.userId,
        authorName: auth.name,
        tenantId: auth.tenantId,
        documentCount: 0,
        readyDocumentCount: 0,
        failedDocumentCount: 0,
      });
    deps.checkPermission.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      validateKnowledgeBaseBindings(auth, ['kb_allowed', 'kb_denied'], deps),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('de-duplicates knowledge base binding IDs before permission checks', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const kb = {
      _id: mongoId('64f1f77bcf86cd799439011'),
      id: 'kb_allowed',
      name: 'Allowed',
      description: '',
      author: auth.userId,
      authorName: auth.name,
      tenantId: auth.tenantId,
      documentCount: 0,
      readyDocumentCount: 0,
      failedDocumentCount: 0,
    };

    deps.findKnowledgeBaseById.mockResolvedValue(kb);
    deps.checkPermission.mockResolvedValue(true);

    const result = await validateKnowledgeBaseBindings(
      auth,
      ['kb_allowed', '', 'kb_allowed', '  ', 'kb_other', 'kb_other'],
      deps,
    );

    expect(result).toEqual(['kb_allowed', 'kb_other']);
    expect(deps.findKnowledgeBaseById).toHaveBeenCalledTimes(2);
    expect(deps.findKnowledgeBaseById).toHaveBeenNthCalledWith(1, 'kb_allowed', auth.tenantId);
    expect(deps.findKnowledgeBaseById).toHaveBeenNthCalledWith(2, 'kb_other', auth.tenantId);
  });

  it('returns a 404-style error when a required knowledge base is unknown', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findKnowledgeBaseById.mockResolvedValue(null);

    await expect(
      requireKnowledgeBasePermission(auth, 'kb_missing', PermissionBits.VIEW, deps),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(deps.checkPermission).not.toHaveBeenCalled();
  });

  it('resolves unique ready file IDs without calling permission dependencies', async () => {
    const deps = makeDeps();

    deps.findReadyKnowledgeBaseDocumentFileIds.mockResolvedValue([
      { file_id: 'file-a' },
      { file_id: '' },
      { file_id: 'file-a' },
      { file_id: 'file-b' },
    ]);

    const result = await resolveKnowledgeBaseFileIdsForAgent(
      ['kb_allowed', 'kb_allowed', 'kb_other'],
      deps,
      'tenant-a',
    );

    expect(result).toEqual(['file-a', 'file-b']);
    expect(deps.findReadyKnowledgeBaseDocumentFileIds).toHaveBeenCalledWith(
      ['kb_allowed', 'kb_allowed', 'kb_other'],
      'tenant-a',
    );
    expect(deps.findKnowledgeBaseById).not.toHaveBeenCalled();
    expect(deps.checkPermission).not.toHaveBeenCalled();
    expect(deps.findAccessibleResources).not.toHaveBeenCalled();
    expect(deps.grantPermission).not.toHaveBeenCalled();
  });
});
