const express = require('express');
const request = require('supertest');
const { PermissionBits } = require('librechat-data-provider');

const mockListKnowledgeBasesForUser = jest.fn();
const mockCreateKnowledgeBaseForUser = jest.fn();

jest.mock('@librechat/api', () => ({
  listKnowledgeBasesForUser: mockListKnowledgeBasesForUser,
  createKnowledgeBaseForUser: mockCreateKnowledgeBaseForUser,
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

jest.mock('~/models', () => ({
  createKnowledgeBase: jest.fn(),
  findKnowledgeBaseById: jest.fn(),
  findKnowledgeBasesByResourceIds: jest.fn(),
  findReadyKnowledgeBaseDocumentFileIds: jest.fn(),
}));

jest.mock('~/server/services/PermissionService', () => ({
  grantPermission: jest.fn(),
  findAccessibleResources: jest.fn(),
  checkPermission: jest.fn(),
}));

const db = require('~/models');
const PermissionService = require('~/server/services/PermissionService');
const knowledgeBaseRoutes = require('./knowledgeBases');

describe('knowledge base routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/knowledge-bases', knowledgeBaseRoutes);
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
      { cursor: 'next', limit: '20' },
      {
        createKnowledgeBase: db.createKnowledgeBase,
        findKnowledgeBaseById: db.findKnowledgeBaseById,
        findKnowledgeBasesByResourceIds: db.findKnowledgeBasesByResourceIds,
        findReadyKnowledgeBaseDocumentFileIds: db.findReadyKnowledgeBaseDocumentFileIds,
        grantPermission: PermissionService.grantPermission,
        findAccessibleResources: PermissionService.findAccessibleResources,
        checkPermission: PermissionService.checkPermission,
      },
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

  it('maps service statusCode errors to JSON responses', async () => {
    const error = new Error('Knowledge base access denied');
    error.statusCode = 403;
    mockListKnowledgeBasesForUser.mockRejectedValue(error);

    const response = await request(app).get('/knowledge-bases');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Knowledge base access denied' });
  });
});
