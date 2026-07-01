import {
  AccessRoleIds,
  PermissionBits,
  PrincipalType,
  ResourceType,
} from 'librechat-data-provider';

import {
  createKnowledgeBaseForUser,
  createKnowledgeBaseDocumentForUser,
  deleteKnowledgeBaseDocumentForUser,
  deleteKnowledgeBaseForUser,
  getKnowledgeBaseForUser,
  listKnowledgeBaseDocumentsForUser,
  listKnowledgeBasesForUser,
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
    findKnowledgeBasesByResourceIds: jest.fn(),
    updateKnowledgeBase: jest.fn(),
    createKnowledgeBaseDocument: jest.fn(),
    findKnowledgeBaseDocuments: jest.fn(),
    findReadyKnowledgeBaseDocumentFileIds: jest.fn(),
    updateKnowledgeBaseDocument: jest.fn(),
    updateKnowledgeBaseCounts: jest.fn(),
    deleteKnowledgeBaseDocument: jest.fn(),
    deleteKnowledgeBaseWithDocuments: jest.fn(),
    grantPermission: jest.fn(),
    findAccessibleResources: jest.fn(),
    checkPermission: jest.fn(),
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
  it('creates a knowledge base and grants owner permission using Mongo _id as resourceId', async () => {
    const auth = makeAuth();
    const deps = makeDeps();
    const created = {
      _id: mongoId('64f1f77bcf86cd799439011'),
      id: 'kb_created',
      name: 'Product Docs',
      description: 'Shared support knowledge',
      author: auth.userId,
      authorName: auth.name,
      tenantId: auth.tenantId,
      documentCount: 0,
      readyDocumentCount: 0,
      failedDocumentCount: 0,
    };

    deps.createKnowledgeBase.mockResolvedValue(created);
    deps.grantPermission.mockResolvedValue(null);

    const result = await createKnowledgeBaseForUser(
      auth,
      { name: ' Product Docs ', description: ' Shared support knowledge ' },
      deps,
    );

    expect(result).toBe(created);
    expect(deps.createKnowledgeBase).toHaveBeenCalledWith({
      id: expect.stringMatching(/^kb_[0-9a-f-]+$/),
      name: 'Product Docs',
      description: 'Shared support knowledge',
      author: auth.userId,
      authorName: auth.name,
      tenantId: auth.tenantId,
    });
    expect(deps.grantPermission).toHaveBeenCalledWith({
      principalType: PrincipalType.USER,
      principalId: auth.userId,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      resourceId: '64f1f77bcf86cd799439011',
      accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
      grantedBy: auth.userId,
    });
    expect(deps.grantPermission).not.toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: created.id }),
    );
  });

  it('lists accessible knowledge base records with VIEW by default', async () => {
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
        documentCount: 1,
        readyDocumentCount: 1,
        failedDocumentCount: 0,
      },
    ];

    deps.findAccessibleResources.mockResolvedValue([firstResourceId, secondResourceId]);
    deps.findKnowledgeBasesByResourceIds.mockResolvedValue(records);

    const result = await listKnowledgeBasesForUser(auth, {}, deps);

    expect(result).toEqual({ data: records, nextCursor: undefined });
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

  it('syncs TCRAW shared WeKnora knowledge bases before listing accessible knowledge bases', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

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
        _id: mongoId('64f1f77bcf86cd799439099'),
        id: 'kb_mirrored',
        provider: 'weknora',
        externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
        name: '上海致拓',
        documentCount: 22,
      }),
    );
    deps.grantPermission.mockResolvedValue(null);
    deps.findAccessibleResources.mockResolvedValue(['64f1f77bcf86cd799439099']);
    deps.findKnowledgeBasesByResourceIds.mockResolvedValue([
      makeKnowledgeBase({
        _id: mongoId('64f1f77bcf86cd799439099'),
        id: 'kb_mirrored',
        provider: 'weknora',
        name: '上海致拓',
        documentCount: 22,
      }),
    ]);

    const result = await listKnowledgeBasesForUser(auth, {}, deps);

    expect(deps.weknoraClient.listSharedKnowledgeBases).toHaveBeenCalledTimes(1);
    expect(deps.upsertExternalKnowledgeBase).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'weknora',
        externalId: '2a2da502-5549-44e7-b98c-ff5b9417b208',
        name: '上海致拓',
        documentCount: 22,
        author: auth.userId,
        authorName: auth.name,
        tenantId: auth.tenantId,
      }),
    );
    expect(deps.grantPermission).toHaveBeenCalledWith({
      principalType: PrincipalType.USER,
      principalId: auth.userId,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      resourceId: '64f1f77bcf86cd799439099',
      accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
      grantedBy: auth.userId,
    });
    expect(result.data[0].id).toBe('kb_mirrored');
    expect(result.data[0].id).not.toBe('2a2da502-5549-44e7-b98c-ff5b9417b208');
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

    const result = await listKnowledgeBaseDocumentsForUser(auth, 'kb_allowed', deps);

    expect(result).toEqual({ data: [document], nextCursor: undefined });
    expect(deps.findKnowledgeBaseDocuments).toHaveBeenCalledWith('kb_allowed', auth.tenantId);
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
