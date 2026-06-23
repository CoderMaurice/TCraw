import type {
  AccessRoleIds,
  PermissionBits,
  PrincipalType,
  ResourceType,
} from 'librechat-data-provider';
import type {
  CreateKnowledgeBaseInput,
  CreateKnowledgeBaseDocumentInput,
  DeleteKnowledgeBaseWithDocumentsResult,
  IAclEntry,
  IKnowledgeBase,
  IKnowledgeBaseDocument,
  ReadyKnowledgeBaseDocumentFileId,
  UpdateKnowledgeBaseInput,
} from '@librechat/data-schemas';

export type MongoResourceId = {
  toString(): string;
};

export type KnowledgeBaseRecord = Omit<IKnowledgeBase, '_id'> & {
  _id?: MongoResourceId;
  resourceId?: MongoResourceId;
};

export type KnowledgeBaseDocumentRecord = Omit<IKnowledgeBaseDocument, '_id'> & {
  _id?: MongoResourceId;
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

export interface UpdateKnowledgeBaseForUserInput {
  name?: string;
  description?: string;
}

export interface KnowledgeBaseAckResult {
  acknowledged: true;
}

export interface ListKnowledgeBaseDocumentsForUserResult {
  data: KnowledgeBaseDocumentRecord[];
  nextCursor?: string;
}

export interface CreateKnowledgeBaseDocumentForUserInput {
  file_id: string;
  filename: string;
  bytes: number;
  mimeType?: string;
  status?: IKnowledgeBaseDocument['status'];
  error?: string;
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
  findKnowledgeBasesByResourceIds(
    resourceIds: KnowledgeBaseResourceReference[],
    tenantId?: string,
  ): Promise<KnowledgeBaseRecord[]>;
  updateKnowledgeBase(
    id: string,
    tenantId: string | undefined,
    update: UpdateKnowledgeBaseInput,
  ): Promise<KnowledgeBaseRecord | null>;
  createKnowledgeBaseDocument(
    input: CreateKnowledgeBaseDocumentInput,
  ): Promise<KnowledgeBaseDocumentRecord>;
  findKnowledgeBaseDocuments(
    knowledgeBaseId: string,
    tenantId?: string,
  ): Promise<KnowledgeBaseDocumentRecord[]>;
  findReadyKnowledgeBaseDocumentFileIds(
    knowledgeBaseIds: string[],
    tenantId?: string,
  ): Promise<ReadyKnowledgeBaseDocumentFileId[]>;
  updateKnowledgeBaseCounts(id: string, tenantId?: string): Promise<KnowledgeBaseRecord | null>;
  deleteKnowledgeBaseDocument(
    id: string,
    knowledgeBaseId: string,
    tenantId?: string,
  ): Promise<{ deletedCount: number }>;
  deleteKnowledgeBaseWithDocuments(
    id: string,
    tenantId?: string,
  ): Promise<DeleteKnowledgeBaseWithDocumentsResult>;
  grantPermission(input: KnowledgeBasePermissionGrant): Promise<IAclEntry | null>;
  findAccessibleResources(
    input: KnowledgeBaseAccessibleResourcesInput,
  ): Promise<KnowledgeBaseResourceReference[]>;
  checkPermission(input: KnowledgeBasePermissionCheckInput): Promise<boolean>;
}

export type KnowledgeBaseServiceError = Error & {
  statusCode: number;
  document?: KnowledgeBaseDocumentRecord;
};
