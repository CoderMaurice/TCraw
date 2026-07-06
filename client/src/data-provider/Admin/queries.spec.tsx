import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { dataService } from 'librechat-data-provider';
import { useAdminUsers, useAdminUserSearch } from './queries';

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    dataService: {
      ...actual.dataService,
      listAdminUsers: jest.fn(),
      searchAdminUsers: jest.fn(),
    },
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('admin user query hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads paged admin users', async () => {
    (dataService.listAdminUsers as jest.Mock).mockResolvedValue({
      users: [],
      total: 0,
      limit: 25,
      offset: 0,
    });

    const { result } = renderHook(() => useAdminUsers({ limit: 25, offset: 0 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(dataService.listAdminUsers).toHaveBeenCalledWith({ limit: 25, offset: 0 });
  });

  it('does not search until enabled by caller', () => {
    renderHook(
      () =>
        useAdminUserSearch(
          { q: 'a', limit: 20 },
          {
            enabled: false,
          },
        ),
      { wrapper },
    );

    expect(dataService.searchAdminUsers).not.toHaveBeenCalled();
  });
});
