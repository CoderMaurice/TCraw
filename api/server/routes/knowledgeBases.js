const crypto = require('crypto');
const { readFile, unlink } = require('fs/promises');
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const {
  getStorageMetadata,
  sanitizeFilename,
  generateCheckAccess,
  getKnowledgeBaseForUser,
  updateKnowledgeBaseForUser,
  deleteKnowledgeBaseForUser,
  createKnowledgeBaseForUser,
  mapWeKnoraDocumentToRecord,
  requireKnowledgeBasePermission,
  listKnowledgeBaseDocumentsForUser,
  createKnowledgeBaseDocumentForUser,
  updateKnowledgeBaseDocumentForUser,
  deleteKnowledgeBaseDocumentForUser,
  listKnowledgeBasesForUser,
  createWeKnoraClient,
} = require('@librechat/api');
const { Permissions, PermissionBits, PermissionTypes } = require('librechat-data-provider');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const configMiddleware = require('~/server/middleware/config/app');
const PermissionService = require('~/server/services/PermissionService');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { uploadVectors } = require('~/server/services/Files/VectorDB/crud');
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

const createRouteError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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

const getUploadFileId = (req) => req.file_id || crypto.randomUUID();

const buildProcessingDocumentInput = ({ req, fileId }) => ({
  file_id: fileId,
  filename: sanitizeFilename(req.file.originalname),
  bytes: req.file.size ?? 0,
  mimeType: req.file.mimetype,
  status: 'processing',
});

const buildFailedDocumentUpdateInput = ({ req, error }) => ({
  filename: sanitizeFilename(req.file.originalname),
  bytes: req.file.size ?? 0,
  mimeType: req.file.mimetype,
  status: 'failed',
  error: error?.message || 'Knowledge base document upload failed',
});

const processKnowledgeBaseDocumentUpload = async ({ req, knowledgeBaseId, fileId }) => {
  const isImage = req.file.mimetype.startsWith('image');
  const source = getFileStrategy(req.config, { isImage });
  const { handleFileUpload } = getStrategyFunctions(source);
  const file = {
    ...req.file,
    originalname: sanitizeFilename(req.file.originalname),
  };
  const storageResult = await handleFileUpload({
    req,
    file,
    file_id: fileId,
    basePath: 'uploads',
    entity_id: knowledgeBaseId,
  });
  const storageMetadata = getStorageMetadata({
    filepath: storageResult.filepath,
    source,
    storageKey: storageResult.storageKey,
    storageRegion: storageResult.storageRegion,
  });
  const embeddingResult = await uploadVectors({
    req,
    file,
    file_id: fileId,
    entity_id: knowledgeBaseId,
    storageMetadata,
  });

  return {
    file_id: fileId,
    filename: embeddingResult.filename || storageResult.filename || file.originalname,
    bytes: embeddingResult.bytes ?? storageResult.bytes ?? req.file.size ?? 0,
    mimeType: req.file.mimetype,
    status: 'ready',
  };
};

const finalizeKnowledgeBaseDocumentUpload = async ({
  auth,
  knowledgeBaseId,
  documentId,
  req,
  fileId,
}) => {
  try {
    const documentInput = await processKnowledgeBaseDocumentUpload({
      req,
      knowledgeBaseId,
      fileId,
    });
    await updateKnowledgeBaseDocumentForUser(
      auth,
      knowledgeBaseId,
      documentId,
      {
        filename: documentInput.filename,
        bytes: documentInput.bytes,
        mimeType: documentInput.mimeType,
        status: 'ready',
        error: '',
      },
      deps,
    );
  } catch (error) {
    try {
      await updateKnowledgeBaseDocumentForUser(
        auth,
        knowledgeBaseId,
        documentId,
        buildFailedDocumentUpdateInput({ req, error }),
        deps,
      );
    } catch (updateError) {
      logger.error('[knowledgeBases] Failed to mark document upload as failed:', updateError);
    }
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

    const kb = await requireKnowledgeBasePermission(
      auth,
      knowledgeBaseId,
      PermissionBits.EDIT,
      deps,
    );

    if (kb.provider === 'weknora') {
      try {
        if (!kb.externalId) {
          throw createRouteError('WeKnora knowledge base is missing an external id', 500);
        }

        if (!deps.weknoraClient) {
          throw createRouteError('WeKnora client is not configured', 500);
        }

        const fileBytes = await readFile(req.file.path);
        const document = await deps.weknoraClient.uploadDocument(kb.externalId, {
          filename: sanitizeFilename(req.file.originalname),
          data: fileBytes,
          mimeType: req.file.mimetype,
          bytes: req.file.size ?? 0,
        });

        return res.status(201).json(mapWeKnoraDocumentToRecord(document, kb, auth));
      } finally {
        await cleanupTempUpload(req.file.path);
      }
    }

    const fileId = getUploadFileId(req);
    const result = await createKnowledgeBaseDocumentForUser(
      auth,
      knowledgeBaseId,
      buildProcessingDocumentInput({ req, fileId }),
      deps,
    );

    void finalizeKnowledgeBaseDocumentUpload({
      auth,
      knowledgeBaseId,
      documentId: result.id,
      req,
      fileId,
    });

    return res.status(201).json(result);
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
