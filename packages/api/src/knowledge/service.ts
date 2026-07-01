import { randomUUID } from 'crypto';
import {
  AccessRoleIds,
  PermissionBits,
  PrincipalType,
  ResourceType,
} from 'librechat-data-provider';

import type {
  KnowledgeAuthContext,
  KnowledgeBaseAckResult,
  KnowledgeBaseDocumentRecord,
  KnowledgeBaseRecord,
  KnowledgeBaseServiceDependencies,
  KnowledgeBaseServiceError,
  CreateKnowledgeBaseDocumentForUserInput,
  CreateKnowledgeBaseForUserInput,
  ListKnowledgeBaseDocumentsForUserResult,
  ListKnowledgeBasesForUserInput,
  ListKnowledgeBasesForUserResult,
  MappedWeKnoraDocument,
  MongoResourceId,
  UpdateKnowledgeBaseDocumentForUserInput,
  UpdateKnowledgeBaseForUserInput,
} from './types';

function createServiceError(message: string, statusCode: number): KnowledgeBaseServiceError {
  const error = new Error(message) as KnowledgeBaseServiceError;
  error.statusCode = statusCode;
  return error;
}

function normalizeOptionalDescription(description?: string): string | undefined {
  return typeof description === 'string' ? description.trim() : undefined;
}

function normalizeOptionalName(name?: string): string | undefined {
  return typeof name === 'string' ? name.trim() : undefined;
}

function getMongoResourceId(kb: KnowledgeBaseRecord): string {
  const resourceId: MongoResourceId | undefined = kb._id ?? kb.resourceId;
  if (!resourceId) {
    throw createServiceError('Knowledge base is missing a Mongo resource id', 500);
  }
  return resourceId.toString();
}

export function mapWeKnoraDocumentToRecord(
  document: MappedWeKnoraDocument,
  kb: KnowledgeBaseRecord,
  auth: KnowledgeAuthContext,
): KnowledgeBaseDocumentRecord {
  return {
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
  };
}

function deduplicateNonEmptyIds(ids: string[]): string[] {
  return ids.reduce<string[]>((uniqueIds, id) => {
    const trimmedId = id.trim();
    if (!trimmedId || uniqueIds.includes(trimmedId)) {
      return uniqueIds;
    }
    return [...uniqueIds, trimmedId];
  }, []);
}

export async function syncWeKnoraKnowledgeBasesForUser(
  auth: KnowledgeAuthContext,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseRecord[]> {
  if (!deps.weknoraClient || !deps.upsertExternalKnowledgeBase) {
    return [];
  }

  const { upsertExternalKnowledgeBase, weknoraClient } = deps;
  const externalKnowledgeBases = await weknoraClient.listSharedKnowledgeBases();
  return await Promise.all(
    externalKnowledgeBases.map(async (externalKnowledgeBase) => {
      const knowledgeBase = await upsertExternalKnowledgeBase({
        id: `kb_${randomUUID()}`,
        name: externalKnowledgeBase.name,
        description: externalKnowledgeBase.description,
        author: auth.userId,
        authorName: auth.name,
        tenantId: auth.tenantId,
        provider: 'weknora',
        externalId: externalKnowledgeBase.externalId,
        externalSpaceId: externalKnowledgeBase.externalSpaceId,
        externalShareId: externalKnowledgeBase.externalShareId,
        documentCount: externalKnowledgeBase.documentCount,
        readyDocumentCount: externalKnowledgeBase.readyDocumentCount,
        failedDocumentCount: externalKnowledgeBase.failedDocumentCount,
        processingDocumentCount: externalKnowledgeBase.processingDocumentCount,
      });

      if (!knowledgeBase) {
        throw createServiceError('Failed to sync WeKnora knowledge base', 500);
      }

      await deps.grantPermission({
        principalType: PrincipalType.USER,
        principalId: auth.userId,
        resourceType: ResourceType.KNOWLEDGE_BASE,
        resourceId: getMongoResourceId(knowledgeBase),
        accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
        grantedBy: auth.userId,
      });

      return knowledgeBase;
    }),
  );
}

export async function createKnowledgeBaseForUser(
  auth: KnowledgeAuthContext,
  input: CreateKnowledgeBaseForUserInput,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseRecord> {
  if (deps.weknoraClient && deps.upsertExternalKnowledgeBase) {
    const external = await deps.weknoraClient.createKnowledgeBase({
      name: input.name.trim(),
      description: normalizeOptionalDescription(input.description) ?? '',
    });
    const created = await deps.upsertExternalKnowledgeBase({
      id: `kb_${randomUUID()}`,
      name: external.name,
      description: external.description,
      author: auth.userId,
      authorName: auth.name,
      tenantId: auth.tenantId,
      provider: 'weknora',
      externalId: external.externalId,
      externalSpaceId: external.externalSpaceId,
      externalShareId: external.externalShareId,
      documentCount: external.documentCount,
      readyDocumentCount: external.readyDocumentCount,
      failedDocumentCount: external.failedDocumentCount,
      processingDocumentCount: external.processingDocumentCount,
    });
    const resourceId = getMongoResourceId(created);

    await deps.grantPermission({
      principalType: PrincipalType.USER,
      principalId: auth.userId,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      resourceId,
      accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
      grantedBy: auth.userId,
    });

    return created;
  }

  const created = await deps.createKnowledgeBase({
    id: `kb_${randomUUID()}`,
    name: input.name.trim(),
    description: normalizeOptionalDescription(input.description),
    author: auth.userId,
    authorName: auth.name,
    tenantId: auth.tenantId,
  });
  const resourceId = getMongoResourceId(created);

  await deps.grantPermission({
    principalType: PrincipalType.USER,
    principalId: auth.userId,
    resourceType: ResourceType.KNOWLEDGE_BASE,
    resourceId,
    accessRoleId: AccessRoleIds.KNOWLEDGE_BASE_OWNER,
    grantedBy: auth.userId,
  });

  return created;
}

export async function listKnowledgeBasesForUser(
  auth: KnowledgeAuthContext,
  input: ListKnowledgeBasesForUserInput,
  deps: KnowledgeBaseServiceDependencies,
): Promise<ListKnowledgeBasesForUserResult> {
  await syncWeKnoraKnowledgeBasesForUser(auth, deps);

  const resourceIds = await deps.findAccessibleResources({
    userId: auth.userId,
    role: auth.role,
    resourceType: ResourceType.KNOWLEDGE_BASE,
    requiredPermissions: input.requiredPermission ?? PermissionBits.VIEW,
  });

  if (resourceIds.length === 0) {
    return { data: [], nextCursor: undefined };
  }

  const data = await deps.findKnowledgeBasesByResourceIds(resourceIds, auth.tenantId);
  return { data, nextCursor: undefined };
}

export async function getKnowledgeBaseForUser(
  auth: KnowledgeAuthContext,
  id: string,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseRecord> {
  return await requireKnowledgeBasePermission(auth, id, PermissionBits.VIEW, deps);
}

export async function updateKnowledgeBaseForUser(
  auth: KnowledgeAuthContext,
  id: string,
  input: UpdateKnowledgeBaseForUserInput,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseRecord> {
  await requireKnowledgeBasePermission(auth, id, PermissionBits.EDIT, deps);

  const update = {
    name: normalizeOptionalName(input.name),
    description: normalizeOptionalDescription(input.description),
  };
  const updated = await deps.updateKnowledgeBase(id, auth.tenantId, update);
  if (!updated) {
    throw createServiceError('Knowledge base not found', 404);
  }

  return updated;
}

export async function deleteKnowledgeBaseForUser(
  auth: KnowledgeAuthContext,
  id: string,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseAckResult> {
  await requireKnowledgeBasePermission(auth, id, PermissionBits.DELETE, deps);

  const result = await deps.deleteKnowledgeBaseWithDocuments(id, auth.tenantId);
  if (result.deletedCount === 0) {
    throw createServiceError('Knowledge base not found', 404);
  }

  return { acknowledged: true };
}

export async function listKnowledgeBaseDocumentsForUser(
  auth: KnowledgeAuthContext,
  id: string,
  deps: KnowledgeBaseServiceDependencies,
): Promise<ListKnowledgeBaseDocumentsForUserResult> {
  const kb = await requireKnowledgeBasePermission(auth, id, PermissionBits.VIEW, deps);

  if (kb.provider === 'weknora') {
    if (!kb.externalId) {
      throw createServiceError('WeKnora knowledge base is missing an external id', 500);
    }

    if (!deps.weknoraClient) {
      throw createServiceError('WeKnora client is not configured', 500);
    }

    const data = (await deps.weknoraClient.listDocuments(kb.externalId)).map((document) =>
      mapWeKnoraDocumentToRecord(document, kb, auth),
    );
    return { data, nextCursor: undefined };
  }

  const data = await deps.findKnowledgeBaseDocuments(id, auth.tenantId);
  return { data, nextCursor: undefined };
}

export async function createKnowledgeBaseDocumentForUser(
  auth: KnowledgeAuthContext,
  id: string,
  input: CreateKnowledgeBaseDocumentForUserInput,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseDocumentRecord> {
  await requireKnowledgeBasePermission(auth, id, PermissionBits.EDIT, deps);

  const status = input.status ?? 'ready';
  const created = await deps.createKnowledgeBaseDocument({
    id: `kbdoc_${randomUUID()}`,
    knowledgeBaseId: id,
    file_id: input.file_id.trim(),
    filename: input.filename.trim(),
    bytes: input.bytes,
    mimeType: normalizeOptionalDescription(input.mimeType),
    status,
    error: normalizeOptionalDescription(input.error),
    createdBy: auth.userId,
    tenantId: auth.tenantId,
  });
  await deps.updateKnowledgeBaseCounts(id, auth.tenantId);

  if (status === 'failed') {
    const error = createServiceError(
      input.error?.trim() || 'Knowledge base document upload failed',
      500,
    );
    error.document = created;
    throw error;
  }

  return created;
}

export async function updateKnowledgeBaseDocumentForUser(
  auth: KnowledgeAuthContext,
  id: string,
  documentId: string,
  input: UpdateKnowledgeBaseDocumentForUserInput,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseDocumentRecord> {
  await requireKnowledgeBasePermission(auth, id, PermissionBits.EDIT, deps);

  const update = {
    filename: normalizeOptionalName(input.filename),
    bytes: typeof input.bytes === 'number' ? input.bytes : undefined,
    mimeType: normalizeOptionalDescription(input.mimeType),
    status: input.status,
    error: normalizeOptionalDescription(input.error),
  };
  const updated = await deps.updateKnowledgeBaseDocument(documentId, id, auth.tenantId, update);
  if (!updated) {
    throw createServiceError('Knowledge base document not found', 404);
  }

  await deps.updateKnowledgeBaseCounts(id, auth.tenantId);
  return updated;
}

export async function deleteKnowledgeBaseDocumentForUser(
  auth: KnowledgeAuthContext,
  id: string,
  documentId: string,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseAckResult> {
  await requireKnowledgeBasePermission(auth, id, PermissionBits.EDIT, deps);

  const result = await deps.deleteKnowledgeBaseDocument(documentId, id, auth.tenantId);
  if (result.deletedCount === 0) {
    throw createServiceError('Knowledge base document not found', 404);
  }

  await deps.updateKnowledgeBaseCounts(id, auth.tenantId);
  return { acknowledged: true };
}

export async function requireKnowledgeBasePermission(
  auth: KnowledgeAuthContext,
  knowledgeBaseId: string,
  permission: PermissionBits,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseRecord> {
  const kb = await deps.findKnowledgeBaseById(knowledgeBaseId, auth.tenantId);
  if (!kb) {
    throw createServiceError('Knowledge base not found', 404);
  }

  const allowed = await deps.checkPermission({
    userId: auth.userId,
    role: auth.role,
    resourceType: ResourceType.KNOWLEDGE_BASE,
    resourceId: getMongoResourceId(kb),
    requiredPermission: permission,
  });
  if (!allowed) {
    throw createServiceError('Knowledge base access denied', 403);
  }

  return kb;
}

export async function validateKnowledgeBaseBindings(
  auth: KnowledgeAuthContext,
  knowledgeBaseIds: string[],
  deps: KnowledgeBaseServiceDependencies,
): Promise<string[]> {
  const uniqueIds = deduplicateNonEmptyIds(knowledgeBaseIds);
  await Promise.all(
    uniqueIds.map((knowledgeBaseId) =>
      requireKnowledgeBasePermission(auth, knowledgeBaseId, PermissionBits.VIEW, deps),
    ),
  );
  return uniqueIds;
}

export async function resolveKnowledgeBaseFileIdsForAgent(
  knowledgeBaseIds: string[],
  deps: Pick<KnowledgeBaseServiceDependencies, 'findReadyKnowledgeBaseDocumentFileIds'>,
  tenantId?: string,
): Promise<string[]> {
  const documents = await deps.findReadyKnowledgeBaseDocumentFileIds(knowledgeBaseIds, tenantId);
  return documents.reduce<string[]>((fileIds, document) => {
    const fileId = document.file_id.trim();
    if (!fileId || fileIds.includes(fileId)) {
      return fileIds;
    }
    return [...fileIds, fileId];
  }, []);
}
