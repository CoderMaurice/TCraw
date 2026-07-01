const express = require('express');
const request = require('supertest');
const { Permissions, PermissionBits, PermissionTypes } = require('librechat-data-provider');

const mockListKnowledgeBasesForUser = jest.fn();
const mockCreateKnowledgeBaseForUser = jest.fn();
const mockGetKnowledgeBaseForUser = jest.fn();
const mockUpdateKnowledgeBaseForUser = jest.fn();
const mockDeleteKnowledgeBaseForUser = jest.fn();
const mockListKnowledgeBaseDocumentsForUser = jest.fn();
const mockCreateKnowledgeBaseDocumentForUser = jest.fn();
const mockUpdateKnowledgeBaseDocumentForUser = jest.fn();
const mockDeleteKnowledgeBaseDocumentForUser = jest.fn();
const mockRequireKnowledgeBasePermission = jest.fn();
const mockMapWeKnoraDocumentToRecord = jest.fn((document, kb, auth) => ({
  id: document.externalId,
  knowledgeBaseId: kb.id,
  file_id: document.fileId,
  filename: document.filename,
  bytes: document.bytes,
  mimeType: document.mimeType,
  status: document.status,
  error: document.error,
  createdBy: auth.userId,
  tenantId: auth.tenantId,
}));
const mockGetStorageMetadata = jest.fn();
const mockSanitizeFilename = jest.fn((filename) => filename.trim());
const mockWeKnoraClient = {
  listSharedKnowledgeBases: jest.fn(),
  uploadDocument: jest.fn(),
};
const mockWeKnoraClientCreations = [];
const mockCreateWeKnoraClient = jest.fn((env) => {
  mockWeKnoraClientCreations.push(env);
  return mockWeKnoraClient;
});
const mockKnowledgeBaseAccessMiddleware = jest.fn((_req, _res, next) => next());
const mockKnowledgeBaseCreateMiddleware = jest.fn((_req, _res, next) => next());
const mockCheckAccessConfigs = [];
const mockUploadMiddleware = jest.fn((req, _res, next) => {
  req.file = {
    originalname: 'handbook.pdf',
    mimetype: 'application/pdf',
    size: 1234,
    path: '/tmp/handbook.pdf',
  };
  req.file_id = 'file_route';
  next();
});
const mockSingleUpload = jest.fn(() => mockUploadMiddleware);
const mockCreateMulterInstance = jest.fn(() =>
  Promise.resolve({
    single: mockSingleUpload,
  }),
);
const mockGetFileStrategy = jest.fn(() => 'local');
const mockHandleFileUpload = jest.fn();
const mockGetStrategyFunctions = jest.fn(() => ({
  handleFileUpload: mockHandleFileUpload,
}));
const mockUploadVectors = jest.fn();

jest.mock('@librechat/api', () => ({
  listKnowledgeBasesForUser: mockListKnowledgeBasesForUser,
  createKnowledgeBaseForUser: mockCreateKnowledgeBaseForUser,
  getKnowledgeBaseForUser: mockGetKnowledgeBaseForUser,
  updateKnowledgeBaseForUser: mockUpdateKnowledgeBaseForUser,
  deleteKnowledgeBaseForUser: mockDeleteKnowledgeBaseForUser,
  listKnowledgeBaseDocumentsForUser: mockListKnowledgeBaseDocumentsForUser,
  createKnowledgeBaseDocumentForUser: mockCreateKnowledgeBaseDocumentForUser,
  updateKnowledgeBaseDocumentForUser: mockUpdateKnowledgeBaseDocumentForUser,
  deleteKnowledgeBaseDocumentForUser: mockDeleteKnowledgeBaseDocumentForUser,
  requireKnowledgeBasePermission: mockRequireKnowledgeBasePermission,
  mapWeKnoraDocumentToRecord: mockMapWeKnoraDocumentToRecord,
  getStorageMetadata: mockGetStorageMetadata,
  sanitizeFilename: mockSanitizeFilename,
  createWeKnoraClient: mockCreateWeKnoraClient,
  generateCheckAccess: jest.fn((config) => {
    mockCheckAccessConfigs.push(config);

    if (config.permissions.includes('CREATE')) {
      return mockKnowledgeBaseCreateMiddleware;
    }

    return mockKnowledgeBaseAccessMiddleware;
  }),
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('~/server/middleware/requireJwtAuth', () => (req, _res, next) => {
  req.user = {
    id: 'user_1',
    name: 'Knowledge User',
    role: 'USER',
    tenantId: 'tenant_1',
  };
  next();
});

jest.mock('~/server/middleware/config/app', () => (req, _res, next) => {
  req.config = {
    paths: { uploads: '/tmp/uploads' },
    fileConfig: {},
  };
  next();
});

jest.mock('./files/multer', () => ({
  createMulterInstance: mockCreateMulterInstance,
}));

jest.mock('~/server/utils/getFileStrategy', () => ({
  getFileStrategy: mockGetFileStrategy,
}));

jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: mockGetStrategyFunctions,
}));

jest.mock('~/server/services/Files/VectorDB/crud', () => ({
  uploadVectors: mockUploadVectors,
}));

jest.mock('~/models', () => ({
  createKnowledgeBase: jest.fn(),
  findKnowledgeBaseById: jest.fn(),
  findKnowledgeBaseByExternalId: jest.fn(),
  findKnowledgeBasesByResourceIds: jest.fn(),
  upsertExternalKnowledgeBase: jest.fn(),
  updateKnowledgeBase: jest.fn(),
  createKnowledgeBaseDocument: jest.fn(),
  findKnowledgeBaseDocuments: jest.fn(),
  findReadyKnowledgeBaseDocumentFileIds: jest.fn(),
  updateKnowledgeBaseCounts: jest.fn(),
  updateKnowledgeBaseDocument: jest.fn(),
  deleteKnowledgeBaseDocument: jest.fn(),
  deleteKnowledgeBaseWithDocuments: jest.fn(),
  getRoleByName: jest.fn(),
}));

jest.mock('~/server/services/PermissionService', () => ({
  grantPermission: jest.fn(),
  findAccessibleResources: jest.fn(),
  checkPermission: jest.fn(),
}));

const db = require('~/models');
const { readFile: mockReadFile, unlink: mockUnlink } = require('fs/promises');
const { logger } = require('@librechat/data-schemas');
const PermissionService = require('~/server/services/PermissionService');
const knowledgeBaseRoutes = require('./knowledgeBases');

describe('knowledge base routes', () => {
  let app;

  beforeEach(() => {
    mockListKnowledgeBasesForUser.mockReset();
    mockCreateKnowledgeBaseForUser.mockReset();
    mockGetKnowledgeBaseForUser.mockReset();
    mockUpdateKnowledgeBaseForUser.mockReset();
    mockDeleteKnowledgeBaseForUser.mockReset();
    mockListKnowledgeBaseDocumentsForUser.mockReset();
    mockCreateKnowledgeBaseDocumentForUser.mockReset();
    mockUpdateKnowledgeBaseDocumentForUser.mockReset();
    mockDeleteKnowledgeBaseDocumentForUser.mockReset();
    mockRequireKnowledgeBasePermission.mockReset();
    mockMapWeKnoraDocumentToRecord.mockClear();
    mockGetStorageMetadata.mockReset();
    mockSanitizeFilename.mockClear();
    mockUploadMiddleware.mockClear();
    mockSingleUpload.mockClear();
    mockCreateMulterInstance.mockClear();
    mockGetFileStrategy.mockClear();
    mockHandleFileUpload.mockReset();
    mockGetStrategyFunctions.mockClear();
    mockUploadVectors.mockReset();
    mockWeKnoraClient.uploadDocument.mockReset();
    mockReadFile.mockReset();
    mockUnlink.mockReset();
    mockKnowledgeBaseAccessMiddleware.mockClear();
    mockKnowledgeBaseCreateMiddleware.mockClear();
    logger.error.mockClear();

    mockGetStorageMetadata.mockReturnValue({ storageKey: 'stored/key' });
    mockHandleFileUpload.mockResolvedValue({
      bytes: 1234,
      filename: 'handbook.pdf',
      filepath: '/uploads/user_1/file_route__handbook.pdf',
      storageKey: 'stored/key',
      storageRegion: 'us-east-1',
    });
    mockUploadVectors.mockResolvedValue({
      bytes: 1234,
      filename: 'handbook.pdf',
      embedded: true,
    });
    mockRequireKnowledgeBasePermission.mockResolvedValue({ id: 'kb_1' });

    app = express();
    app.use(express.json());
    app.use('/knowledge-bases', knowledgeBaseRoutes);
  });

  it('configures role gates for knowledge base use and creation', () => {
    expect(mockCheckAccessConfigs).toEqual([
      {
        permissionType: PermissionTypes.KNOWLEDGE_BASES,
        permissions: [Permissions.USE],
        getRoleByName: db.getRoleByName,
      },
      {
        permissionType: PermissionTypes.KNOWLEDGE_BASES,
        permissions: [Permissions.USE, Permissions.CREATE],
        getRoleByName: db.getRoleByName,
      },
    ]);
  });

  it('creates one WeKnora client for knowledge base route deps', () => {
    expect(mockWeKnoraClientCreations).toEqual([process.env]);
  });

  it('returns listed knowledge bases and passes auth, query, and deps', async () => {
    const serviceResult = {
      data: [{ id: 'kb_1', name: 'Support KB' }],
      nextCursor: undefined,
    };
    mockListKnowledgeBasesForUser.mockResolvedValue(serviceResult);

    const response = await request(app).get('/knowledge-bases?cursor=next&limit=20');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [{ id: 'kb_1', name: 'Support KB' }] });
    expect(mockListKnowledgeBasesForUser).toHaveBeenCalledWith(
      {
        userId: 'user_1',
        name: 'Knowledge User',
        role: 'USER',
        tenantId: 'tenant_1',
      },
      { cursor: 'next', limit: 20 },
      {
        createKnowledgeBase: db.createKnowledgeBase,
        findKnowledgeBaseById: db.findKnowledgeBaseById,
        findKnowledgeBaseByExternalId: db.findKnowledgeBaseByExternalId,
        findKnowledgeBasesByResourceIds: db.findKnowledgeBasesByResourceIds,
        upsertExternalKnowledgeBase: db.upsertExternalKnowledgeBase,
        updateKnowledgeBase: db.updateKnowledgeBase,
        createKnowledgeBaseDocument: db.createKnowledgeBaseDocument,
        findKnowledgeBaseDocuments: db.findKnowledgeBaseDocuments,
        findReadyKnowledgeBaseDocumentFileIds: db.findReadyKnowledgeBaseDocumentFileIds,
        updateKnowledgeBaseDocument: db.updateKnowledgeBaseDocument,
        updateKnowledgeBaseCounts: db.updateKnowledgeBaseCounts,
        deleteKnowledgeBaseDocument: db.deleteKnowledgeBaseDocument,
        deleteKnowledgeBaseWithDocuments: db.deleteKnowledgeBaseWithDocuments,
        grantPermission: PermissionService.grantPermission,
        findAccessibleResources: PermissionService.findAccessibleResources,
        checkPermission: PermissionService.checkPermission,
        weknoraClient: mockWeKnoraClient,
      },
    );
  });

  it('strips client requiredPermission and parses valid list limit as a number', async () => {
    mockListKnowledgeBasesForUser.mockResolvedValue({ data: [] });

    const response = await request(app).get(
      '/knowledge-bases?requiredPermission=8&limit=20&search=support&cursor=next&ignored=true',
    );

    expect(response.status).toBe(200);
    expect(mockListKnowledgeBasesForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      { search: 'support', cursor: 'next', limit: 20 },
      expect.any(Object),
    );
  });

  it('passes VIEW permission when listing selector knowledge bases', async () => {
    mockListKnowledgeBasesForUser.mockResolvedValue({ data: [] });

    const response = await request(app).get('/knowledge-bases/selector?search=support');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [] });
    expect(mockListKnowledgeBasesForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      { search: 'support', requiredPermission: PermissionBits.VIEW },
      expect.objectContaining({
        findAccessibleResources: PermissionService.findAccessibleResources,
      }),
    );
  });

  it('creates a knowledge base with 201 and passes auth, body, and deps', async () => {
    const requestBody = { name: 'Product Docs', description: 'Internal product notes' };
    const serviceResult = { id: 'kb_2', name: 'Product Docs' };
    mockCreateKnowledgeBaseForUser.mockResolvedValue(serviceResult);

    const response = await request(app).post('/knowledge-bases').send(requestBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(serviceResult);
    expect(mockKnowledgeBaseCreateMiddleware).toHaveBeenCalledTimes(1);
    expect(mockCreateKnowledgeBaseForUser).toHaveBeenCalledWith(
      {
        userId: 'user_1',
        name: 'Knowledge User',
        role: 'USER',
        tenantId: 'tenant_1',
      },
      requestBody,
      expect.objectContaining({
        createKnowledgeBase: db.createKnowledgeBase,
        grantPermission: PermissionService.grantPermission,
      }),
    );
  });

  it('gets a knowledge base by id and passes auth and deps', async () => {
    const serviceResult = { id: 'kb_1', name: 'Support KB' };
    mockGetKnowledgeBaseForUser.mockResolvedValue(serviceResult);

    const response = await request(app).get('/knowledge-bases/kb_1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(serviceResult);
    expect(mockGetKnowledgeBaseForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      expect.objectContaining({ findKnowledgeBaseById: db.findKnowledgeBaseById }),
    );
  });

  it('updates a knowledge base by id with PATCH body', async () => {
    const requestBody = { name: 'Updated', description: 'Notes' };
    const serviceResult = { id: 'kb_1', name: 'Updated', description: 'Notes' };
    mockUpdateKnowledgeBaseForUser.mockResolvedValue(serviceResult);

    const response = await request(app).patch('/knowledge-bases/kb_1').send(requestBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(serviceResult);
    expect(mockUpdateKnowledgeBaseForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      requestBody,
      expect.objectContaining({ updateKnowledgeBase: db.updateKnowledgeBase }),
    );
  });

  it('deletes a knowledge base by id', async () => {
    mockDeleteKnowledgeBaseForUser.mockResolvedValue({ acknowledged: true });

    const response = await request(app).delete('/knowledge-bases/kb_1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ acknowledged: true });
    expect(mockDeleteKnowledgeBaseForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      expect.objectContaining({
        deleteKnowledgeBaseWithDocuments: db.deleteKnowledgeBaseWithDocuments,
      }),
    );
  });

  it('lists documents for a knowledge base', async () => {
    const serviceResult = { data: [{ id: 'kbdoc_1', filename: 'handbook.pdf' }] };
    mockListKnowledgeBaseDocumentsForUser.mockResolvedValue(serviceResult);

    const response = await request(app).get('/knowledge-bases/kb_1/documents');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(serviceResult);
    expect(mockListKnowledgeBaseDocumentsForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      expect.objectContaining({ findKnowledgeBaseDocuments: db.findKnowledgeBaseDocuments }),
    );
  });

  it('creates a processing document record before embedding finishes', async () => {
    const serviceResult = { id: 'kbdoc_1', file_id: 'file_route', status: 'processing' };
    mockCreateKnowledgeBaseDocumentForUser.mockResolvedValue(serviceResult);
    mockUpdateKnowledgeBaseDocumentForUser.mockResolvedValue({
      ...serviceResult,
      status: 'ready',
    });

    const response = await request(app)
      .post('/knowledge-bases/kb_1/documents')
      .attach('file', Buffer.from('hello'), 'handbook.pdf');

    expect(response.status).toBe(201);
    expect(response.body).toEqual(serviceResult);
    expect(mockRequireKnowledgeBasePermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      PermissionBits.EDIT,
      expect.any(Object),
    );
    expect(mockHandleFileUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        file_id: 'file_route',
        entity_id: 'kb_1',
        basePath: 'uploads',
      }),
    );
    expect(mockUploadVectors).toHaveBeenCalledWith({
      req: expect.any(Object),
      file: expect.objectContaining({ originalname: 'handbook.pdf' }),
      file_id: 'file_route',
      entity_id: 'kb_1',
      storageMetadata: { storageKey: 'stored/key' },
    });
    expect(mockCreateKnowledgeBaseDocumentForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      {
        file_id: 'file_route',
        filename: 'handbook.pdf',
        bytes: 1234,
        mimeType: 'application/pdf',
        status: 'processing',
      },
      expect.objectContaining({ createKnowledgeBaseDocument: db.createKnowledgeBaseDocument }),
    );
    expect(mockRequireKnowledgeBasePermission.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateKnowledgeBaseDocumentForUser.mock.invocationCallOrder[0],
    );
    expect(mockCreateKnowledgeBaseDocumentForUser.mock.invocationCallOrder[0]).toBeLessThan(
      mockHandleFileUpload.mock.invocationCallOrder[0],
    );
    await new Promise(process.nextTick);
    expect(mockUpdateKnowledgeBaseDocumentForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      'kbdoc_1',
      {
        filename: 'handbook.pdf',
        bytes: 1234,
        mimeType: 'application/pdf',
        status: 'ready',
        error: '',
      },
      expect.objectContaining({ updateKnowledgeBaseDocument: db.updateKnowledgeBaseDocument }),
    );
  });

  it('updates the processing document as failed when embedding fails', async () => {
    const vectorError = new Error('RAG failed');
    const serviceResult = { id: 'kbdoc_1', file_id: 'file_route', status: 'processing' };
    mockUploadVectors.mockRejectedValue(vectorError);
    mockCreateKnowledgeBaseDocumentForUser.mockResolvedValue(serviceResult);
    mockUpdateKnowledgeBaseDocumentForUser.mockResolvedValue({
      ...serviceResult,
      status: 'failed',
      error: 'RAG failed',
    });

    const response = await request(app)
      .post('/knowledge-bases/kb_1/documents')
      .attach('file', Buffer.from('hello'), 'handbook.pdf');

    expect(response.status).toBe(201);
    expect(response.body).toEqual(serviceResult);
    await new Promise(process.nextTick);
    expect(mockUpdateKnowledgeBaseDocumentForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      'kbdoc_1',
      expect.objectContaining({
        status: 'failed',
        error: 'RAG failed',
      }),
      expect.any(Object),
    );
  });

  it('uploads documents directly to WeKnora for WeKnora-backed knowledge bases', async () => {
    const diskFileBytes = Buffer.from('disk-backed hello');
    const weknoraDocument = {
      id: 'wk_doc_1',
      knowledgeBaseId: 'kb_weknora',
      file_id: 'file_1',
      filename: 'handbook.pdf',
      bytes: 1234,
      mimeType: 'application/pdf',
      status: 'processing',
      error: '',
      createdBy: 'user_1',
      tenantId: 'tenant_1',
    };
    mockRequireKnowledgeBasePermission.mockResolvedValue({
      id: 'kb_weknora',
      provider: 'weknora',
      externalId: 'wk_kb_1',
    });
    mockWeKnoraClient.uploadDocument.mockResolvedValue({
      externalId: 'wk_doc_1',
      externalKnowledgeBaseId: 'wk_kb_1',
      fileId: 'file_1',
      filename: 'handbook.pdf',
      bytes: 1234,
      mimeType: 'application/pdf',
      status: 'processing',
      error: '',
    });
    mockReadFile.mockResolvedValue(diskFileBytes);

    const response = await request(app)
      .post('/knowledge-bases/kb_weknora/documents')
      .attach('file', Buffer.from('hello'), 'handbook.pdf');

    expect(response.status).toBe(201);
    expect(response.body).toEqual(weknoraDocument);
    expect(mockRequireKnowledgeBasePermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_weknora',
      PermissionBits.EDIT,
      expect.any(Object),
    );
    expect(mockWeKnoraClient.uploadDocument).toHaveBeenCalledWith('wk_kb_1', {
      filename: 'handbook.pdf',
      data: diskFileBytes,
      mimeType: 'application/pdf',
      bytes: 1234,
    });
    expect(mockReadFile).toHaveBeenCalledWith('/tmp/handbook.pdf');
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/handbook.pdf');
    expect(mockMapWeKnoraDocumentToRecord).toHaveBeenCalledWith(
      {
        externalId: 'wk_doc_1',
        externalKnowledgeBaseId: 'wk_kb_1',
        fileId: 'file_1',
        filename: 'handbook.pdf',
        bytes: 1234,
        mimeType: 'application/pdf',
        status: 'processing',
        error: '',
      },
      {
        id: 'kb_weknora',
        provider: 'weknora',
        externalId: 'wk_kb_1',
      },
      expect.objectContaining({ userId: 'user_1' }),
    );
    expect(mockCreateKnowledgeBaseDocumentForUser).not.toHaveBeenCalled();
    expect(mockHandleFileUpload).not.toHaveBeenCalled();
    expect(mockUploadVectors).not.toHaveBeenCalled();
    await new Promise(process.nextTick);
    expect(mockUpdateKnowledgeBaseDocumentForUser).not.toHaveBeenCalled();
  });

  it('cleans up WeKnora temp files when upload fails', async () => {
    const uploadError = new Error('WeKnora upload failed');
    uploadError.statusCode = 502;
    mockRequireKnowledgeBasePermission.mockResolvedValue({
      id: 'kb_weknora',
      provider: 'weknora',
      externalId: 'wk_kb_1',
    });
    mockReadFile.mockResolvedValue(Buffer.from('disk-backed hello'));
    mockWeKnoraClient.uploadDocument.mockRejectedValue(uploadError);

    const response = await request(app)
      .post('/knowledge-bases/kb_weknora/documents')
      .attach('file', Buffer.from('hello'), 'handbook.pdf');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Failed to process knowledge base request' });
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/handbook.pdf');
    expect(logger.error).toHaveBeenCalledWith(
      '[knowledgeBases] Unexpected route error:',
      uploadError,
    );
  });

  it('deletes a document for a knowledge base', async () => {
    mockDeleteKnowledgeBaseDocumentForUser.mockResolvedValue({ acknowledged: true });

    const response = await request(app).delete('/knowledge-bases/kb_1/documents/kbdoc_1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ acknowledged: true });
    expect(mockDeleteKnowledgeBaseDocumentForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      'kb_1',
      'kbdoc_1',
      expect.objectContaining({ deleteKnowledgeBaseDocument: db.deleteKnowledgeBaseDocument }),
    );
  });

  it('maps service statusCode errors to JSON responses', async () => {
    const error = new Error('Knowledge base access denied');
    error.statusCode = 403;
    mockListKnowledgeBasesForUser.mockRejectedValue(error);

    const response = await request(app).get('/knowledge-bases');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Knowledge base access denied' });
  });

  it('logs 5xx service statusCode errors and returns a generic message', async () => {
    const error = new Error('database connection string leaked');
    error.statusCode = 503;
    mockListKnowledgeBasesForUser.mockRejectedValue(error);

    const response = await request(app).get('/knowledge-bases');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Failed to process knowledge base request' });
    expect(logger.error).toHaveBeenCalledWith('[knowledgeBases] Unexpected route error:', error);
  });
});
