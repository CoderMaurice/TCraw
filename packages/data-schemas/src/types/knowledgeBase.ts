import type { KnowledgeBaseDocumentStatus } from 'librechat-data-provider';
import type { Document, Types } from 'mongoose';

export type KnowledgeBaseProvider = 'local' | 'weknora';
export type KnowledgeBaseLifecycleStatus =
  | 'creating_external'
  | 'initializing'
  | 'sharing'
  | 'ready'
  | 'failed'
  | 'archived';

export interface IKnowledgeBase {
  _id?: Types.ObjectId;
  id: string;
  name: string;
  description: string;
  author: string;
  authorName: string;
  provider?: KnowledgeBaseProvider;
  externalId?: string;
  externalSpaceId?: string;
  externalShareId?: string;
  lifecycleStatus?: KnowledgeBaseLifecycleStatus;
  lifecycleStep?: string;
  lifecycleError?: string;
  initializedAt?: Date | null;
  lastSyncedAt?: Date | null;
  configTemplateExternalId?: string;
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  processingDocumentCount?: number;
  lastIndexedAt?: Date | null;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IKnowledgeBaseDocument {
  _id?: Types.ObjectId;
  id: string;
  knowledgeBaseId: string;
  file_id: string;
  filename: string;
  bytes: number;
  mimeType: string;
  status: KnowledgeBaseDocumentStatus;
  error: string;
  createdBy: string;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IKnowledgeBaseMongoDocument
  extends Omit<IKnowledgeBase, '_id'>,
    Omit<Document, 'id'> {}

export interface IKnowledgeBaseDocumentMongo
  extends Omit<IKnowledgeBaseDocument, '_id'>,
    Omit<Document, 'id'> {}

export type CreateKnowledgeBaseInput = Pick<IKnowledgeBase, 'id' | 'name' | 'author'> &
  Partial<
    Pick<
      IKnowledgeBase,
      | 'description'
      | 'authorName'
      | 'provider'
      | 'externalId'
      | 'externalSpaceId'
      | 'externalShareId'
      | 'lifecycleStatus'
      | 'lifecycleStep'
      | 'lifecycleError'
      | 'initializedAt'
      | 'lastSyncedAt'
      | 'configTemplateExternalId'
      | 'documentCount'
      | 'readyDocumentCount'
      | 'failedDocumentCount'
      | 'processingDocumentCount'
      | 'lastIndexedAt'
      | 'tenantId'
    >
  >;

export type CreateKnowledgeBaseDocumentInput = Pick<
  IKnowledgeBaseDocument,
  'id' | 'knowledgeBaseId' | 'file_id' | 'filename' | 'bytes' | 'createdBy'
> &
  Partial<Pick<IKnowledgeBaseDocument, 'mimeType' | 'status' | 'error' | 'tenantId'>>;

export type UpdateKnowledgeBaseDocumentInput = Partial<
  Pick<IKnowledgeBaseDocument, 'filename' | 'bytes' | 'mimeType' | 'status' | 'error'>
>;
