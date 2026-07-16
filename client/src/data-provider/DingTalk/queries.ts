import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataService, MutationKeys, QueryKeys } from 'librechat-data-provider';
import type {
  DingTalkBindingResponse,
  UpsertDingTalkBindingRequest,
} from 'librechat-data-provider';
import type {
  QueryObserverResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
} from '@tanstack/react-query';

export const useDingTalkBindingQuery = (
  agentId?: string,
  config?: UseQueryOptions<DingTalkBindingResponse>,
): QueryObserverResult<DingTalkBindingResponse> => {
  return useQuery<DingTalkBindingResponse>(
    [QueryKeys.dingtalkBinding, agentId],
    () => dataService.getDingTalkBinding(agentId as string),
    {
      retry: false,
      refetchOnWindowFocus: false,
      ...config,
      enabled: Boolean(agentId) && (config?.enabled ?? true),
    },
  );
};

export const useUpsertDingTalkBindingMutation = (
  agentId: string,
  options?: UseMutationOptions<DingTalkBindingResponse, unknown, UpsertDingTalkBindingRequest>,
): UseMutationResult<DingTalkBindingResponse, unknown, UpsertDingTalkBindingRequest> => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.upsertDingtalkBinding],
    (payload: UpsertDingTalkBindingRequest) => dataService.upsertDingTalkBinding(agentId, payload),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.setQueryData([QueryKeys.dingtalkBinding, agentId], data);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

export const useDeleteDingTalkBindingMutation = (
  agentId: string,
  options?: UseMutationOptions<void, unknown, void>,
): UseMutationResult<void, unknown, void> => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.deleteDingtalkBinding],
    () => dataService.deleteDingTalkBinding(agentId),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.setQueryData([QueryKeys.dingtalkBinding, agentId], { binding: null });
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};
