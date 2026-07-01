export type KnowledgeBaseStatusCounts = {
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  processingDocumentCount?: number;
};

export type KnowledgeBase = KnowledgeBaseStatusCounts & {
  _id?: string;
  id: string;
  name: string;
  description?: string;
  provider?: 'local' | 'weknora';
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

export type ListKnowledgeBaseDocumentsRequest = {
  cursor?: string;
  limit?: number;
};

export type ListKnowledgeBaseDocumentsResponse = {
  data: KnowledgeBaseDocument[];
  nextCursor?: string;
};

export type KnowledgeBaseSelectorItem = Pick<
  KnowledgeBase,
  | 'id'
  | 'name'
  | 'description'
  | 'provider'
  | 'documentCount'
  | 'readyDocumentCount'
  | 'failedDocumentCount'
  | 'processingDocumentCount'
>;

export type KnowledgeBaseSelectorResponse = {
  data: KnowledgeBaseSelectorItem[];
  nextCursor?: string;
};
