const express = require('express');
const {
  createDingTalkHandlers,
  createRequireApiKeyAuth,
  preAuthTenantMiddleware,
} = require('@librechat/api');
const { createResponse } = require('~/server/controllers/agents/responses');
const { requireJwtAuth, configMiddleware } = require('~/server/middleware');
const dingTalkRuntime = require('~/server/services/DingTalk');
const db = require('~/models');

const router = express.Router();

const handlers = createDingTalkHandlers({
  getAgent: db.getAgent,
  createAgentApiKey: db.createAgentApiKey,
  deleteAgentApiKey: db.deleteAgentApiKey,
  getDingTalkBindingByAgent: db.getDingTalkBindingByAgent,
  getDingTalkBindingByApiKeyId: db.getDingTalkBindingByApiKeyId,
  upsertDingTalkBinding: db.upsertDingTalkBinding,
  deleteDingTalkBinding: db.deleteDingTalkBinding,
  runtime: dingTalkRuntime,
});

const requireIntegrationApiKey = createRequireApiKeyAuth({
  validateAgentApiKey: db.validateAgentApiKey,
  findUser: db.findUser,
});

router.post(
  '/responses',
  preAuthTenantMiddleware,
  requireIntegrationApiKey,
  configMiddleware,
  handlers.checkInternalBindingAccess,
  createResponse,
);

router.use(requireJwtAuth);
router.get('/agents/:agentId', handlers.getBinding);
router.put('/agents/:agentId', handlers.upsertBinding);
router.delete('/agents/:agentId', handlers.deleteBinding);

module.exports = router;
