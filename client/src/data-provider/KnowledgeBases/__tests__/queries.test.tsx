import { createElement } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { ReactNode } from 'react';
import { useKnowledgeBaseSelectorQuery } from '../queries';
import { useUpdateKnowledgeBaseMutation } from '../mutations';

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    dataService: {
      ...actual.dataService,
      listKnowledgeBaseSelector: jest.fn(),
      updateKnowledgeBase: jest.fn(),
    },
  };
});

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('KnowledgeBases data hooks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('queries selector data with the expected key and limit', async () => {
    const queryClient = createQueryClient();
    const selectorResponse = {
      data: [
        {
          id: 'kb_1',
          name: 'Support',
          documentCount: 1,
          readyDocumentCount: 1,
          failedDocumentCount: 0,
        },
      ],
    };
    (dataService.listKnowledgeBaseSelector as jest.Mock).mockResolvedValue(selectorResponse);

    const { result } = renderHook(() => useKnowledgeBaseSelectorQuery('support'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dataService.listKnowledgeBaseSelector).toHaveBeenCalledWith({
      search: 'support',
      limit: 25,
    });
    expect(queryClient.getQueryData([QueryKeys.knowledgeBaseSelector, 'support'])).toEqual(
      selectorResponse,
    );
  });

  it('invalidates list, detail, and selector queries after update', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const updated = {
      id: 'kb_1',
      name: 'Updated',
      author: 'user_1',
      documentCount: 0,
      readyDocumentCount: 0,
      failedDocumentCount: 0,
      createdAt: '2026-06-24T00:00:00.000Z',
      updatedAt: '2026-06-24T00:00:00.000Z',
    };
    (dataService.updateKnowledgeBase as jest.Mock).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateKnowledgeBaseMutation('kb_1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Updated' });
    });

    expect(dataService.updateKnowledgeBase).toHaveBeenCalledWith('kb_1', { name: 'Updated' });
    expect(invalidateSpy).toHaveBeenCalledWith([QueryKeys.knowledgeBases]);
    expect(invalidateSpy).toHaveBeenCalledWith([QueryKeys.knowledgeBase, 'kb_1']);
    expect(invalidateSpy).toHaveBeenCalledWith([QueryKeys.knowledgeBaseSelector]);
  });
});
