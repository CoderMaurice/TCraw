import { randomUUID } from 'crypto';
import { AccessRoleIds, PermissionBits, PrincipalType, ResourceType } from 'librechat-data-provider';

import type {
  KnowledgeAuthContext,
  KnowledgeBaseRecord,
  KnowledgeBaseServiceDependencies,
  KnowledgeBaseServiceError,
  CreateKnowledgeBaseForUserInput,
  ListKnowledgeBasesForUserInput,
  ListKnowledgeBasesForUserResult,
  MongoResourceId,
} from './types';

function createServiceError(message: string, statusCode: number): KnowledgeBaseServiceError {
  const error = new Error(message) as KnowledgeBaseServiceError;
  error.statusCode = statusCode;
  return error;
}

function normalizeOptionalDescription(description?: string): string | undefined {
  return typeof description === 'string' ? description.trim() : undefined;
}

function getMongoResourceId(kb: KnowledgeBaseRecord): string {
  const resourceId: MongoResourceId | undefined = kb._id ?? kb.resourceId;
  if (!resourceId) {
    throw createServiceError('Knowledge base is missing a Mongo resource id', 500);
  }
  return resourceId.toString();
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

export async function createKnowledgeBaseForUser(
  auth: KnowledgeAuthContext,
  input: CreateKnowledgeBaseForUserInput,
  deps: KnowledgeBaseServiceDependencies,
): Promise<KnowledgeBaseRecord> {
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
