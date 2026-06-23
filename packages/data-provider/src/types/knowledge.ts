export type KnowledgeBaseStatusCounts = {
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
};

export type KnowledgeBase = KnowledgeBaseStatusCounts & {
  id: string;
  name: string;
  description?: string;
  author: string;
  authorName?: string;
  tenantId?: string;
  lastIndexedAt?: string;
  createdAt: string;
  updatedAt: string;
  access?: 'owned' | 'shared' | 'team';
};

export type KnowledgeBaseDocumentStatus = 'processing' | 'ready' | 'failed';

export type KnowledgeBaseDocument = {
  id: string;
  knowledgeBaseId: string;
  file_id: string;
  filename: string;
  bytes: number;
  mimeType?: string;
  status: KnowledgeBaseDocumentStatus;
  error?: string;
  createdBy: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ListKnowledgeBasesRequest = {
  search?: string;
  cursor?: string;
  limit?: number;
  requiredPermission?: number;
};

export type ListKnowledgeBasesResponse = {
  data: KnowledgeBase[];
  nextCursor?: string;
};

export type CreateKnowledgeBaseRequest = {
  name: string;
  description?: string;
};

export type UpdateKnowledgeBaseRequest = {
  name?: string;
  description?: string;
};

export type ListKnowledgeBaseDocumentsResponse = {
  data: KnowledgeBaseDocument[];
  nextCursor?: string;
};

export type KnowledgeBaseSelectorItem = Pick<
  KnowledgeBase,
  'id' | 'name' | 'description' | 'documentCount' | 'readyDocumentCount' | 'failedDocumentCount'
>;
