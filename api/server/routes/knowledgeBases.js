const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { createKnowledgeBaseForUser, listKnowledgeBasesForUser } = require('@librechat/api');
const { PermissionBits } = require('librechat-data-provider');
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

const authFromRequest = (req) => ({
  userId: req.user.id,
  name: req.user.name,
  role: req.user.role,
  tenantId: req.user.tenantId,
});

const sendServiceError = (res, error) => {
  if (error?.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error('[knowledgeBases] Unexpected route error:', error);
  return res.status(500).json({ message: 'Failed to process knowledge base request' });
};

router.use(requireJwtAuth);

router.get('/', async (req, res) => {
  try {
    const result = await listKnowledgeBasesForUser(authFromRequest(req), req.query, deps);
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.get('/selector', async (req, res) => {
  try {
    const result = await listKnowledgeBasesForUser(
      authFromRequest(req),
      { ...req.query, requiredPermission: PermissionBits.VIEW },
      deps,
    );
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await createKnowledgeBaseForUser(authFromRequest(req), req.body, deps);
    return res.status(201).json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

module.exports = router;
