const express = require('express');
const { logger } = require('@librechat/data-schemas');
const {
  generateCheckAccess,
  createKnowledgeBaseForUser,
  listKnowledgeBasesForUser,
} = require('@librechat/api');
const { Permissions, PermissionBits, PermissionTypes } = require('librechat-data-provider');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const PermissionService = require('~/server/services/PermissionService');
const db = require('~/models');

const router = express.Router();

const deps = {
  createKnowledgeBase: db.createKnowledgeBase,
  findKnowledgeBaseById: db.findKnowledgeBaseById,
  findKnowledgeBasesByResourceIds: db.findKnowledgeBasesByResourceIds,
  findReadyKnowledgeBaseDocumentFileIds: db.findReadyKnowledgeBaseDocumentFileIds,
  grantPermission: PermissionService.grantPermission,
  findAccessibleResources: PermissionService.findAccessibleResources,
  checkPermission: PermissionService.checkPermission,
};

const checkKnowledgeBaseAccess = generateCheckAccess({
  permissionType: PermissionTypes.KNOWLEDGE_BASES,
  permissions: [Permissions.USE],
  getRoleByName: db.getRoleByName,
});
const checkKnowledgeBaseCreate = generateCheckAccess({
  permissionType: PermissionTypes.KNOWLEDGE_BASES,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName: db.getRoleByName,
});

const authFromRequest = (req) => ({
  userId: req.user.id,
  name: req.user.name,
  role: req.user.role,
  tenantId: req.user.tenantId,
});

const firstQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const parseListQuery = (query) => {
  const parsed = {};
  const search = firstQueryValue(query.search);
  const cursor = firstQueryValue(query.cursor);
  const limitValue = firstQueryValue(query.limit);
  const limit = Number(limitValue);

  if (typeof search === 'string') {
    parsed.search = search;
  }

  if (typeof cursor === 'string') {
    parsed.cursor = cursor;
  }

  if (Number.isInteger(limit) && limit > 0) {
    parsed.limit = limit;
  }

  return parsed;
};

const sendServiceError = (res, error) => {
  if (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error('[knowledgeBases] Unexpected route error:', error);
  return res.status(500).json({ message: 'Failed to process knowledge base request' });
};

router.use(requireJwtAuth);
router.use(checkKnowledgeBaseAccess);

router.get('/', async (req, res) => {
  try {
    const result = await listKnowledgeBasesForUser(
      authFromRequest(req),
      parseListQuery(req.query),
      deps,
    );
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.get('/selector', async (req, res) => {
  try {
    const result = await listKnowledgeBasesForUser(
      authFromRequest(req),
      { ...parseListQuery(req.query), requiredPermission: PermissionBits.VIEW },
      deps,
    );
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.post('/', checkKnowledgeBaseCreate, async (req, res) => {
  try {
    const result = await createKnowledgeBaseForUser(authFromRequest(req), req.body, deps);
    return res.status(201).json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

module.exports = router;
