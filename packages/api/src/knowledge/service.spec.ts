import { AccessRoleIds, PermissionBits, PrincipalType, ResourceType } from 'librechat-data-provider';

import {
  createKnowledgeBaseForUser,
  listKnowledgeBasesForUser,
  requireKnowledgeBasePermission,
  resolveKnowledgeBaseFileIdsForAgent,
  validateKnowledgeBaseBindings,
} from './service';
import type { KnowledgeAuthContext, KnowledgeBaseServiceDependencies } from './types';

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
    findReadyKnowledgeBaseDocumentFileIds: jest.fn(),
    grantPermission: jest.fn(),
    findAccessibleResources: jest.fn(),
    checkPermission: jest.fn(),
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

  it('lists accessible knowledge base resources with VIEW by default', async () => {
    const auth = makeAuth();
    const deps = makeDeps();

    deps.findAccessibleResources.mockResolvedValue(['64f1f77bcf86cd799439011']);

    const result = await listKnowledgeBasesForUser(auth, {}, deps);

    expect(result).toEqual({ data: [], nextCursor: undefined });
    expect(deps.findAccessibleResources).toHaveBeenCalledWith({
      userId: auth.userId,
      role: auth.role,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      requiredPermissions: PermissionBits.VIEW,
    });
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
