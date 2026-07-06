const { readFile, unlink } = require('fs/promises');
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const {
  sanitizeFilename,
  generateCheckAccess,
  getKnowledgeBaseForUser,
  updateKnowledgeBaseForUser,
  deleteKnowledgeBaseForUser,
  createKnowledgeBaseForUser,
  getKnowledgeBaseCapabilities,
  mapWeKnoraDocumentToRecord,
  assertKnowledgeBaseUploadable,
  listKnowledgeBaseDocumentsForUser,
  deleteKnowledgeBaseDocumentForUser,
  listKnowledgeBasesForUser,
  createWeKnoraClient,
} = require('@librechat/api');
const { Permissions, PermissionBits, PermissionTypes } = require('librechat-data-provider');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const configMiddleware = require('~/server/middleware/config/app');
const PermissionService = require('~/server/services/PermissionService');
const db = require('~/models');
const { createMulterInstance } = require('./files/multer');

const router = express.Router();
let documentUpload;
const weknoraClient = createWeKnoraClient(process.env);

const deps = {
  createKnowledgeBase: db.createKnowledgeBase,
  findKnowledgeBaseById: db.findKnowledgeBaseById,
  findKnowledgeBaseByExternalId: db.findKnowledgeBaseByExternalId,
  findKnowledgeBasesByResourceIds: db.findKnowledgeBasesByResourceIds,
  upsertExternalKnowledgeBase: db.upsertExternalKnowledgeBase,
  updateKnowledgeBase: db.updateKnowledgeBase,
  updateKnowledgeBaseLifecycle: db.updateKnowledgeBaseLifecycle,
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
  weknoraClient,
  env: process.env,
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

const parseDocumentListQuery = (query) => {
  const parsed = {};
  const cursor = firstQueryValue(query.cursor);
  const limitValue = firstQueryValue(query.limit);
  const limit = Number(limitValue);

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

const cleanupTempUpload = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    logger.error('[knowledgeBases] Failed to remove temp upload:', error);
  }
};

const getDocumentUpload = async () => {
  if (!documentUpload) {
    const upload = await createMulterInstance();
    documentUpload = upload.single('file');
  }
  return documentUpload;
};

const uploadDocumentMiddleware = async (req, res, next) => {
  try {
    const upload = await getDocumentUpload();
    return upload(req, res, (error) => {
      if (error) {
        return sendServiceError(res, error);
      }
      return next();
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

router.use(requireJwtAuth);
router.use(configMiddleware);
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

router.get('/capabilities', async (_req, res) => {
  try {
    return res.json(getKnowledgeBaseCapabilities(deps));
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

router.get('/:id/documents', async (req, res) => {
  try {
    const result = await listKnowledgeBaseDocumentsForUser(
      authFromRequest(req),
      req.params.id,
      parseDocumentListQuery(req.query),
      deps,
    );
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.post('/:id/documents', uploadDocumentMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      const error = new Error('No file provided');
      error.statusCode = 400;
      throw error;
    }

    const auth = authFromRequest(req);
    const knowledgeBaseId = req.params.id;

    try {
      const kb = await assertKnowledgeBaseUploadable(auth, knowledgeBaseId, deps);
      const fileBytes = await readFile(req.file.path);
      const document = await deps.weknoraClient.uploadDocument(kb.externalId, {
        filename: sanitizeFilename(req.file.originalname),
        data: fileBytes,
        mimeType: req.file.mimetype,
        bytes: req.file.size ?? 0,
      });
      const countUpdate = {
        documentCount: (kb.documentCount ?? 0) + 1,
        readyDocumentCount: kb.readyDocumentCount ?? 0,
        failedDocumentCount: kb.failedDocumentCount ?? 0,
        processingDocumentCount: kb.processingDocumentCount ?? 0,
        lastSyncedAt: new Date(),
      };
      if (document.status === 'ready') {
        countUpdate.readyDocumentCount += 1;
      } else if (document.status === 'failed') {
        countUpdate.failedDocumentCount += 1;
      } else if (document.status === 'processing') {
        countUpdate.processingDocumentCount += 1;
      }
      await deps.updateKnowledgeBaseLifecycle(kb.id, auth.tenantId, countUpdate);

      return res.status(201).json(mapWeKnoraDocumentToRecord(document, kb, auth));
    } finally {
      await cleanupTempUpload(req.file.path);
    }
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.delete('/:id/documents/:documentId', async (req, res) => {
  try {
    const result = await deleteKnowledgeBaseDocumentForUser(
      authFromRequest(req),
      req.params.id,
      req.params.documentId,
      deps,
    );
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await getKnowledgeBaseForUser(authFromRequest(req), req.params.id, deps);
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const result = await updateKnowledgeBaseForUser(
      authFromRequest(req),
      req.params.id,
      req.body,
      deps,
    );
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await deleteKnowledgeBaseForUser(authFromRequest(req), req.params.id, deps);
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

module.exports = router;
