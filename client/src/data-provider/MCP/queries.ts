import { useQuery, UseQueryOptions, QueryObserverResult } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';

/**
 * Hook for fetching all accessible MCP servers with permission metadata
 */
export const useMCPServersQuery = <TData = t.MCPServersListResponse>(
  config?: UseQueryOptions<t.MCPServersListResponse, unknown, TData> & {
    includeAgentAccess?: boolean;
  },
): QueryObserverResult<TData> => {
  const { includeAgentAccess = true, ...queryConfig } = config ?? {};
  return useQuery<t.MCPServersListResponse, unknown, TData>(
    [QueryKeys.mcpServers, includeAgentAccess],
    () => dataService.getMCPServers({ includeAgentAccess }),
    {
      staleTime: 30 * 1000, // 30 seconds — short enough to pick up servers that finish initializing after first load
      refetchOnWindowFocus: true,
      refetchOnReconnect: false,
      refetchOnMount: true,
      retry: false,
      ...queryConfig,
    },
  );
};

/**
 * Hook for fetching MCP-specific tools
 * @param config - React Query configuration
 * @returns MCP servers with their tools
 */
export const useMCPToolsQuery = <TData = t.MCPServersResponse>(
  config?: UseQueryOptions<t.MCPServersResponse, unknown, TData> & {
    includeAgentAccess?: boolean;
  },
): QueryObserverResult<TData> => {
  const { includeAgentAccess = true, ...queryConfig } = config ?? {};
  return useQuery<t.MCPServersResponse, unknown, TData>(
    [QueryKeys.mcpTools, includeAgentAccess],
    () => dataService.getMCPTools({ includeAgentAccess }),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      ...queryConfig,
    },
  );
};
