import type {
  AccessRoleIds,
  KnowledgeBaseDocumentStatus,
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
  UpsertExternalKnowledgeBaseInput,
  UpdateKnowledgeBaseDocumentInput,
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

export interface ListKnowledgeBaseDocumentsForUserInput {
  cursor?: string;
  limit?: number;
}

export interface CreateKnowledgeBaseDocumentForUserInput {
  file_id: string;
  filename: string;
  bytes: number;
  mimeType?: string;
  status?: IKnowledgeBaseDocument['status'];
  error?: string;
}

export interface UpdateKnowledgeBaseDocumentForUserInput {
  filename?: string;
  bytes?: number;
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
  findKnowledgeBaseByExternalId?(
    provider: string,
    externalId: string,
    tenantId?: string,
  ): Promise<KnowledgeBaseRecord | null>;
  upsertExternalKnowledgeBase?(
    input: UpsertExternalKnowledgeBaseInput,
  ): Promise<KnowledgeBaseRecord>;
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
  updateKnowledgeBaseDocument(
    id: string,
    knowledgeBaseId: string,
    tenantId: string | undefined,
    update: UpdateKnowledgeBaseDocumentInput,
  ): Promise<KnowledgeBaseDocumentRecord | null>;
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
  weknoraClient?: WeKnoraClient | null;
}

export type KnowledgeBaseServiceError = Error & {
  statusCode: number;
  document?: KnowledgeBaseDocumentRecord;
};

export type WeKnoraMetadataValue =
  | string
  | number
  | boolean
  | null
  | WeKnoraMetadataValue[]
  | { [key: string]: WeKnoraMetadataValue };

export type WeKnoraMetadata = { [key: string]: WeKnoraMetadataValue };

export interface MappedWeKnoraKnowledgeBase {
  externalId: string;
  externalSpaceId: string;
  externalShareId: string;
  name: string;
  description: string;
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  processingDocumentCount: number;
}

export interface MappedWeKnoraDocument {
  externalId: string;
  externalKnowledgeBaseId: string;
  fileId: string;
  filename: string;
  bytes: number;
  mimeType: string;
  status: KnowledgeBaseDocumentStatus;
  error: string;
}

export interface ListWeKnoraDocumentsInput {
  cursor?: string;
  limit?: number;
}

export interface ListWeKnoraDocumentsResult {
  data: MappedWeKnoraDocument[];
  nextCursor?: string;
}

export interface MappedWeKnoraSearchResult {
  externalDocumentId: string;
  externalKnowledgeBaseId: string;
  content: string;
  score: number;
  metadata: WeKnoraMetadata;
}

export interface CreateWeKnoraKnowledgeBaseInput {
  name: string;
  description?: string;
}

export interface UploadWeKnoraDocumentFile {
  filename: string;
  data: Blob | ArrayBuffer | Uint8Array | string;
  mimeType?: string;
  bytes?: number;
}

export interface WeKnoraClient {
  listSharedKnowledgeBases(): Promise<MappedWeKnoraKnowledgeBase[]>;
  listDocuments(
    externalKnowledgeBaseId: string,
    input?: ListWeKnoraDocumentsInput,
  ): Promise<ListWeKnoraDocumentsResult>;
  createKnowledgeBase(input: CreateWeKnoraKnowledgeBaseInput): Promise<MappedWeKnoraKnowledgeBase>;
  uploadDocument(
    externalKnowledgeBaseId: string,
    file: UploadWeKnoraDocumentFile,
  ): Promise<MappedWeKnoraDocument>;
  search(query: string, externalKnowledgeBaseIds: string[]): Promise<MappedWeKnoraSearchResult[]>;
}
