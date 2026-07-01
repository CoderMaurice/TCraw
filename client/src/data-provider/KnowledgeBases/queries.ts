import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type {
  UseInfiniteQueryOptions,
  QueryObserverResult,
  UseQueryOptions,
} from '@tanstack/react-query';
import type {
  KnowledgeBase,
  ListKnowledgeBasesRequest,
  ListKnowledgeBasesResponse,
  KnowledgeBaseSelectorResponse,
  ListKnowledgeBaseDocumentsRequest,
  ListKnowledgeBaseDocumentsResponse,
} from 'librechat-data-provider';

export const useKnowledgeBasesQuery = <TData = ListKnowledgeBasesResponse>(
  params?: ListKnowledgeBasesRequest,
  config?: UseQueryOptions<ListKnowledgeBasesResponse, unknown, TData>,
): QueryObserverResult<TData> => {
  return useQuery<ListKnowledgeBasesResponse, unknown, TData>(
    [QueryKeys.knowledgeBases, params],
    () => dataService.listKnowledgeBases(params),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export const useKnowledgeBaseQuery = (
  id?: string | null,
  config?: UseQueryOptions<KnowledgeBase>,
): QueryObserverResult<KnowledgeBase> => {
  return useQuery<KnowledgeBase>(
    [QueryKeys.knowledgeBase, id],
    () => dataService.getKnowledgeBase(id as string),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
      ...config,
      enabled: Boolean(id) && (config?.enabled ?? true),
    },
  );
};

export const useKnowledgeBaseDocumentsQuery = (
  id?: string | null,
  params?: ListKnowledgeBaseDocumentsRequest,
  config?: UseQueryOptions<ListKnowledgeBaseDocumentsResponse>,
): QueryObserverResult<ListKnowledgeBaseDocumentsResponse> => {
  return useQuery<ListKnowledgeBaseDocumentsResponse>(
    [QueryKeys.knowledgeBaseDocuments, id, params],
    () => dataService.listKnowledgeBaseDocuments(id as string, params),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
      ...config,
      enabled: Boolean(id) && (config?.enabled ?? true),
    },
  );
};

export const useInfiniteKnowledgeBaseDocumentsQuery = (
  id?: string | null,
  params?: Pick<ListKnowledgeBaseDocumentsRequest, 'limit'>,
  config?: UseInfiniteQueryOptions<ListKnowledgeBaseDocumentsResponse, unknown>,
) => {
  return useInfiniteQuery<ListKnowledgeBaseDocumentsResponse>({
    queryKey: [QueryKeys.knowledgeBaseDocuments, id, params],
    queryFn: ({ pageParam }) =>
      dataService.listKnowledgeBaseDocuments(id as string, {
        ...params,
        cursor: pageParam?.toString(),
      }),
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
    ...config,
    enabled: Boolean(id) && (config?.enabled ?? true),
  });
};

export const useKnowledgeBaseSelectorQuery = (
  search?: string,
  config?: UseQueryOptions<KnowledgeBaseSelectorResponse>,
): QueryObserverResult<KnowledgeBaseSelectorResponse> => {
  return useQuery<KnowledgeBaseSelectorResponse>(
    [QueryKeys.knowledgeBaseSelector, search],
    () => dataService.listKnowledgeBaseSelector({ search, limit: 25 }),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};
