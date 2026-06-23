import type {
  AccessRoleIds,
  PermissionBits,
  PrincipalType,
  ResourceType,
} from 'librechat-data-provider';
import type {
  CreateKnowledgeBaseInput,
  IAclEntry,
  IKnowledgeBase,
  ReadyKnowledgeBaseDocumentFileId,
} from '@librechat/data-schemas';

export type MongoResourceId = {
  toString(): string;
};

export type KnowledgeBaseRecord = Omit<IKnowledgeBase, '_id'> & {
  _id?: MongoResourceId;
  resourceId?: MongoResourceId;
};

export type KnowledgeBaseResourceReference = string | MongoResourceId;

export interface KnowledgeAuthContext {
  userId: string;
  name: string;
  tenantId?: string;
  role?: string;
}

export interface CreateKnowledgeBaseForUserInput {
  name: string;
  description?: string;
}

export interface ListKnowledgeBasesForUserInput {
  requiredPermission?: PermissionBits;
}

export interface ListKnowledgeBasesForUserResult {
  data: KnowledgeBaseRecord[];
  nextCursor?: string;
}

export interface KnowledgeBasePermissionGrant {
  principalType: PrincipalType;
  principalId: string | null;
  resourceType: ResourceType;
  resourceId: string;
  accessRoleId: AccessRoleIds;
  grantedBy?: string;
}

export interface KnowledgeBaseAccessibleResourcesInput {
  userId: string;
  role?: string;
  resourceType: ResourceType;
  requiredPermissions: number;
}

export interface KnowledgeBasePermissionCheckInput {
  userId: string;
  role?: string;
  resourceType: ResourceType;
  resourceId: string;
  requiredPermission: number;
}

export interface KnowledgeBaseServiceDependencies {
  createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<KnowledgeBaseRecord>;
  findKnowledgeBaseById(id: string, tenantId?: string): Promise<KnowledgeBaseRecord | null>;
  findReadyKnowledgeBaseDocumentFileIds(
    knowledgeBaseIds: string[],
    tenantId?: string,
  ): Promise<ReadyKnowledgeBaseDocumentFileId[]>;
  grantPermission(input: KnowledgeBasePermissionGrant): Promise<IAclEntry | null>;
  findAccessibleResources(
    input: KnowledgeBaseAccessibleResourcesInput,
  ): Promise<KnowledgeBaseResourceReference[]>;
  checkPermission(input: KnowledgeBasePermissionCheckInput): Promise<boolean>;
}

export type KnowledgeBaseServiceError = Error & {
  statusCode: number;
};
