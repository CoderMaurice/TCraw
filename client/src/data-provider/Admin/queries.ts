import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type {
  AdminUsersListParams,
  AdminUsersListResponse,
  AdminUsersSearchParams,
  AdminUsersSearchResponse,
} from 'librechat-data-provider';

export const useAdminUsers = (
  params: AdminUsersListParams,
  config?: UseQueryOptions<AdminUsersListResponse>,
): QueryObserverResult<AdminUsersListResponse> => {
  return useQuery<AdminUsersListResponse>(
    [QueryKeys.adminUsers, params.limit ?? null, params.offset ?? 0],
    () => dataService.listAdminUsers(params),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminUserSearch = (
  params: AdminUsersSearchParams,
  config?: UseQueryOptions<AdminUsersSearchResponse>,
): QueryObserverResult<AdminUsersSearchResponse> => {
  return useQuery<AdminUsersSearchResponse>(
    [QueryKeys.adminUserSearch, params.q, params.limit ?? null],
    () => dataService.searchAdminUsers(params),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};
