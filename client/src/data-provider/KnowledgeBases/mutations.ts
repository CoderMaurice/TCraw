import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { QueryClient, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import type {
  KnowledgeBase,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  ListKnowledgeBaseDocumentsResponse,
} from 'librechat-data-provider';

const invalidateKnowledgeBaseCollections = (queryClient: QueryClient) => {
  queryClient.invalidateQueries([QueryKeys.knowledgeBases]);
  queryClient.invalidateQueries([QueryKeys.knowledgeBaseSelector]);
};

const invalidateKnowledgeBaseDetail = (queryClient: QueryClient, id: string) => {
  queryClient.invalidateQueries([QueryKeys.knowledgeBase, id]);
};

const invalidateKnowledgeBaseDocuments = (queryClient: QueryClient, id: string) => {
  queryClient.invalidateQueries([QueryKeys.knowledgeBaseDocuments, id]);
};

export const useCreateKnowledgeBaseMutation = (
  options?: UseMutationOptions<KnowledgeBase, unknown, CreateKnowledgeBaseRequest>,
): UseMutationResult<KnowledgeBase, unknown, CreateKnowledgeBaseRequest> => {
  const queryClient = useQueryClient();
  return useMutation(
    (data: CreateKnowledgeBaseRequest) => dataService.createKnowledgeBase(data),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        invalidateKnowledgeBaseCollections(queryClient);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

export const useUpdateKnowledgeBaseMutation = (
  id: string,
  options?: UseMutationOptions<KnowledgeBase, unknown, UpdateKnowledgeBaseRequest>,
): UseMutationResult<KnowledgeBase, unknown, UpdateKnowledgeBaseRequest> => {
  const queryClient = useQueryClient();
  return useMutation(
    (data: UpdateKnowledgeBaseRequest) => dataService.updateKnowledgeBase(id, data),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        invalidateKnowledgeBaseCollections(queryClient);
        invalidateKnowledgeBaseDetail(queryClient, id);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

export const useDeleteKnowledgeBaseMutation = (
  options?: UseMutationOptions<{ acknowledged: true }, unknown, string>,
): UseMutationResult<{ acknowledged: true }, unknown, string> => {
  const queryClient = useQueryClient();
  return useMutation((id: string) => dataService.deleteKnowledgeBase(id), {
    ...options,
    onSuccess: (data, id, context) => {
      invalidateKnowledgeBaseCollections(queryClient);
      invalidateKnowledgeBaseDetail(queryClient, id);
      invalidateKnowledgeBaseDocuments(queryClient, id);
      options?.onSuccess?.(data, id, context);
    },
  });
};

export const useUploadKnowledgeBaseDocumentsMutation = (
  id: string,
  options?: UseMutationOptions<ListKnowledgeBaseDocumentsResponse, unknown, FormData>,
): UseMutationResult<ListKnowledgeBaseDocumentsResponse, unknown, FormData> => {
  const queryClient = useQueryClient();
  return useMutation((formData: FormData) => dataService.uploadKnowledgeBaseDocuments(id, formData), {
    ...options,
    onSuccess: (data, variables, context) => {
      invalidateKnowledgeBaseCollections(queryClient);
      invalidateKnowledgeBaseDetail(queryClient, id);
      invalidateKnowledgeBaseDocuments(queryClient, id);
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useDeleteKnowledgeBaseDocumentMutation = (
  id: string,
  options?: UseMutationOptions<{ acknowledged: true }, unknown, string>,
): UseMutationResult<{ acknowledged: true }, unknown, string> => {
  const queryClient = useQueryClient();
  return useMutation(
    (documentId: string) => dataService.deleteKnowledgeBaseDocument(id, documentId),
    {
      ...options,
      onSuccess: (data, documentId, context) => {
        invalidateKnowledgeBaseCollections(queryClient);
        invalidateKnowledgeBaseDetail(queryClient, id);
        invalidateKnowledgeBaseDocuments(queryClient, id);
        options?.onSuccess?.(data, documentId, context);
      },
    },
  );
};
