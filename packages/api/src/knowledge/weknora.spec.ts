import { createWeKnoraClient, mapWeKnoraDocumentStatus } from './weknora';

const env = {
  WEKNORA_API_BASE_URL: 'https://weknora.example.com/api//',
  WEKNORA_API_KEY: 'test-api-key',
  WEKNORA_ORG_ID: 'org_123',
  WEKNORA_SEARCH_TOP_K: '7',
} as NodeJS.ProcessEnv;

function mockJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

type FetchMock = jest.Mock<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>;

const originalFetch = globalThis.fetch;

function mockFetch(...responses: Response[]): FetchMock {
  const fetchMock: FetchMock = jest.fn();
  if (responses.length === 1) {
    fetchMock.mockResolvedValue(responses[0]);
  } else {
    responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  }
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: fetchMock,
  });
  return fetchMock;
}

describe('WeKnora adapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
      return;
    }
    Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('returns null when required config is missing', () => {
    expect(createWeKnoraClient({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('maps WeKnora parse statuses to TCraw statuses', () => {
    expect(mapWeKnoraDocumentStatus('completed')).toBe('ready');
    expect(mapWeKnoraDocumentStatus('failed')).toBe('failed');
    expect(mapWeKnoraDocumentStatus('pending')).toBe('processing');
    expect(mapWeKnoraDocumentStatus('processing')).toBe('processing');
    expect(mapWeKnoraDocumentStatus()).toBe('processing');
  });

  it('lists shared knowledge bases with normalized fields and safe URL joining', async () => {
    const fetch = mockFetch(
      mockJsonResponse({
        data: [
          {
            id: 'share_1',
            knowledge_base_id: 'wk_kb_1',
            space_id: 'space_1',
            name: ' Product Docs ',
            description: 'Support articles',
            knowledge_count: 5,
            completed_count: 3,
            failed_count: 1,
          },
        ],
      }),
    );

    const client = createWeKnoraClient(env);

    await expect(client?.listSharedKnowledgeBases()).resolves.toEqual([
      {
        externalId: 'wk_kb_1',
        externalShareId: 'share_1',
        externalSpaceId: 'space_1',
        name: 'Product Docs',
        description: 'Support articles',
        documentCount: 5,
        readyDocumentCount: 3,
        failedDocumentCount: 1,
        processingDocumentCount: 1,
      },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'https://weknora.example.com/api/organizations/org_123/shared-knowledge-bases',
      {
        method: 'GET',
        headers: {
          'X-API-Key': 'test-api-key',
          Accept: 'application/json',
        },
      },
    );
  });

  it('lists documents with cursor pagination and maps parse status values', async () => {
    const fetch = mockFetch(
      mockJsonResponse({
        data: [
          {
            id: 'knowledge_1',
            file_id: 'file_1',
            filename: 'Guide.pdf',
            size: 1024,
            mime_type: 'application/pdf',
            parse_status: 'completed',
          },
          {
            id: 'knowledge_2',
            name: 'Failed.txt',
            bytes: 20,
            status: 'failed',
            error: 'parse failed',
          },
          {
            id: 'knowledge_url',
            title: 'Return and Refund Policy',
            file_name: '',
            file_size: 0,
            source: 'https://topens.com/policies/refund-policy',
            parse_status: 'completed',
          },
        ],
        total: 8,
      }),
    );

    const client = createWeKnoraClient(env);

    await expect(client?.listDocuments('wk_kb_1', { cursor: '3', limit: 2 })).resolves.toEqual({
      data: [
        {
          externalId: 'knowledge_1',
          externalKnowledgeBaseId: 'wk_kb_1',
          fileId: 'file_1',
          filename: 'Guide.pdf',
          bytes: 1024,
          mimeType: 'application/pdf',
          status: 'ready',
          error: '',
        },
        {
          externalId: 'knowledge_2',
          externalKnowledgeBaseId: 'wk_kb_1',
          fileId: 'knowledge_2',
          filename: 'Failed.txt',
          bytes: 20,
          mimeType: '',
          status: 'failed',
          error: 'parse failed',
        },
        {
          externalId: 'knowledge_url',
          externalKnowledgeBaseId: 'wk_kb_1',
          fileId: 'knowledge_url',
          filename: 'Return and Refund Policy',
          bytes: 0,
          mimeType: '',
          status: 'ready',
          error: '',
        },
      ],
      nextCursor: '4',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://weknora.example.com/api/knowledge-bases/wk_kb_1/knowledge?page=3&page_size=2',
      {
        method: 'GET',
        headers: {
          'X-API-Key': 'test-api-key',
          Accept: 'application/json',
        },
      },
    );
  });

  it('uses JSON headers for creating and sharing a knowledge base', async () => {
    const fetch = mockFetch(
      mockJsonResponse({
        id: 'wk_kb_new',
        space_id: 'space_new',
        name: 'New KB',
        description: 'New description',
      }),
      mockJsonResponse({ id: 'share_new' }),
    );

    const client = createWeKnoraClient(env);

    await expect(
      client?.createKnowledgeBase({ name: ' New KB ', description: ' New description ' }),
    ).resolves.toMatchObject({
      externalId: 'wk_kb_new',
      externalShareId: 'share_new',
      externalSpaceId: 'space_new',
      name: 'New KB',
      description: 'New description',
    });
    expect(fetch).toHaveBeenNthCalledWith(1, 'https://weknora.example.com/api/knowledge-bases', {
      method: 'POST',
      headers: {
        'X-API-Key': 'test-api-key',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New KB', description: 'New description' }),
    });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://weknora.example.com/api/knowledge-bases/wk_kb_new/shares',
      {
        method: 'POST',
        headers: {
          'X-API-Key': 'test-api-key',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organization_id: 'org_123' }),
      },
    );
  });

  it('searches with configured topK and maps result metadata', async () => {
    mockFetch(
      mockJsonResponse({
        data: [
          {
            knowledge_id: 'knowledge_1',
            knowledge_base_id: 'wk_kb_1',
            content: 'Matched content',
            score: 0.91,
            metadata: { page: 2 },
          },
        ],
      }),
    );

    const client = createWeKnoraClient(env);

    await expect(client?.search('refund policy', ['wk_kb_1'])).resolves.toEqual([
      {
        externalDocumentId: 'knowledge_1',
        externalKnowledgeBaseId: 'wk_kb_1',
        content: 'Matched content',
        score: 0.91,
        metadata: { page: 2 },
      },
    ]);
  });
});
