import type { KnowledgeBaseDocumentStatus } from 'librechat-data-provider';
import type { Document, Types } from 'mongoose';

export interface IKnowledgeBase {
  _id?: Types.ObjectId;
  id: string;
  name: string;
  description: string;
  author: string;
  authorName: string;
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
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
      | 'documentCount'
      | 'readyDocumentCount'
      | 'failedDocumentCount'
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
