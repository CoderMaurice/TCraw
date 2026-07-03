import type { KnowledgeBaseDocumentStatus } from 'librechat-data-provider';
import type {
  CreateWeKnoraKnowledgeBaseInput,
  ListWeKnoraDocumentsInput,
  ListWeKnoraDocumentsResult,
  MappedWeKnoraDocument,
  MappedWeKnoraKnowledgeBase,
  MappedWeKnoraSearchResult,
  UploadWeKnoraDocumentFile,
  WeKnoraClient,
  WeKnoraInitializationStatus,
  WeKnoraMetadata,
} from './types';

const DEFAULT_SEARCH_TOP_K = 5;
const DEFAULT_DOCUMENT_PAGE = 1;
const DEFAULT_DOCUMENT_PAGE_SIZE = 100;

type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<JsonValue>;
};

type FetchInit = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body?: string | FormData;
};

type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponse>;

type WeKnoraConfig = {
  baseUrl: string;
  apiKey: string;
  orgId: string;
  searchTopK: number;
  fetch: FetchLike;
};

const INITIALIZATION_CONFIG_KEYS = [
  'llm',
  'embedding',
  'documentSplitting',
  'multimodal',
  'nodeExtract',
  'rerank',
] as const;

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getObject(value: JsonValue | undefined): JsonObject {
  return isJsonObject(value) ? value : {};
}

function unwrapObjectResponse(response: JsonValue): JsonObject {
  const object = getObject(response);
  const data = getObject(object.data);
  return Object.keys(data).length > 0 ? data : object;
}

function getArray(response: JsonValue): JsonObject[] {
  if (Array.isArray(response)) {
    return response.filter(isJsonObject);
  }

  if (!isJsonObject(response)) {
    return [];
  }

  const arrays = [response.data, response.items, response.results, response.knowledge_bases];
  const array = arrays.find(Array.isArray);
  return array?.filter(isJsonObject) ?? [];
}

function stringField(source: JsonObject, fields: string[], fallback = ''): string {
  const value = fields
    .map((field) => source[field])
    .find((fieldValue) => typeof fieldValue === 'string' && fieldValue.trim().length > 0);
  return typeof value === 'string' ? value.trim() : fallback;
}

function numberField(source: JsonObject, fields: string[], fallback = 0): number {
  const value = fields
    .map((field) => source[field])
    .find((fieldValue) => typeof fieldValue === 'number' || typeof fieldValue === 'string');

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function metadataField(source: JsonObject): WeKnoraMetadata {
  const metadata = source.metadata ?? source.meta;
  if (!isJsonObject(metadata)) {
    return {};
  }
  return metadata as WeKnoraMetadata;
}

function sanitizeInitializationConfig(raw: JsonValue): JsonObject {
  const source = unwrapObjectResponse(raw);
  return INITIALIZATION_CONFIG_KEYS.reduce<JsonObject>((config, key) => {
    const value = source[key];
    if (isJsonObject(value) || Array.isArray(value)) {
      return { ...config, [key]: value };
    }
    return config;
  }, {});
}

function summarizeInitializationConfig(raw: JsonValue): WeKnoraInitializationStatus {
  const source = unwrapObjectResponse(raw);
  const embedding = getObject(source.embedding);
  const splitting = getObject(source.documentSplitting);
  const separators = splitting.separators;
  const embeddingConfigured =
    stringField(embedding, ['modelName', 'model_name', 'model_id']).length > 0;
  const chunkingConfigured =
    numberField(splitting, ['chunkSize', 'chunk_size']) > 0 &&
    Array.isArray(separators) &&
    separators.length > 0;

  return {
    complete: embeddingConfigured && chunkingConfigured,
    embeddingConfigured,
    chunkingConfigured,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function buildUrl(baseUrl: string, segments: string[], query?: Record<string, string>): string {
  const path = segments.map((segment) => encodeURIComponent(segment)).join('/');
  const url = new URL(`${baseUrl}/${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function parseSearchTopK(value?: string): number {
  if (!value) {
    return DEFAULT_SEARCH_TOP_K;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SEARCH_TOP_K;
}

function parsePageCursor(cursor?: string): number {
  if (!cursor) {
    return DEFAULT_DOCUMENT_PAGE;
  }

  const parsed = Number(cursor);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DOCUMENT_PAGE;
}

function parsePageSize(limit?: number): number {
  return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_DOCUMENT_PAGE_SIZE;
}

function nextDocumentCursor(
  response: JsonValue,
  page: number,
  pageSize: number,
  resultCount: number,
): string | undefined {
  const responseObject = getObject(response);
  const hasMore = responseObject.has_more;
  if (typeof hasMore === 'boolean') {
    return hasMore ? String(page + 1) : undefined;
  }

  const nextPage = numberField(responseObject, ['next_page', 'nextPage'], 0);
  if (nextPage > page) {
    return String(nextPage);
  }

  const totalPages = numberField(responseObject, ['total_pages', 'totalPages'], 0);
  if (totalPages > page) {
    return String(page + 1);
  }

  const totalCount = numberField(
    responseObject,
    ['total_count', 'totalCount', 'total', 'count'],
    0,
  );
  if (totalCount > page * pageSize) {
    return String(page + 1);
  }

  return resultCount === pageSize ? String(page + 1) : undefined;
}

async function requestJson<T extends JsonValue>(
  config: WeKnoraConfig,
  segments: string[],
  init: Omit<FetchInit, 'headers'> & { query?: Record<string, string>; json?: JsonObject },
): Promise<T> {
  const headers: Record<string, string> = {
    'X-API-Key': config.apiKey,
    Accept: 'application/json',
  };

  let body = init.body;
  if (init.json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }

  const response = await config.fetch(buildUrl(config.baseUrl, segments, init.query), {
    method: init.method,
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`WeKnora request failed with status ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function mapKnowledgeBase(raw: JsonObject): MappedWeKnoraKnowledgeBase {
  const nested = getObject(raw.knowledge_base ?? raw.knowledgeBase);
  const source = Object.keys(nested).length > 0 ? nested : raw;
  const externalId = stringField(source, ['knowledge_base_id', 'knowledgeBaseId', 'id']);
  const documentCount = numberField(source, [
    'knowledge_count',
    'knowledgeCount',
    'document_count',
    'documentCount',
  ]);
  const readyDocumentCount = numberField(source, [
    'completed_count',
    'completedCount',
    'ready_document_count',
    'readyDocumentCount',
  ]);
  const failedDocumentCount = numberField(source, [
    'failed_count',
    'failedCount',
    'failed_document_count',
    'failedDocumentCount',
  ]);
  const processingDocumentCount = numberField(
    source,
    ['processing_count', 'processingCount', 'processing_document_count', 'processingDocumentCount'],
    Math.max(documentCount - readyDocumentCount - failedDocumentCount, 0),
  );

  return {
    externalId,
    externalSpaceId: stringField(source, ['space_id', 'spaceId', 'external_space_id']),
    externalShareId: stringField(
      raw,
      Object.keys(nested).length > 0 ? ['share_id', 'shareId', 'id'] : ['share_id', 'shareId'],
    ),
    permission: stringField(raw, ['permission'], stringField(source, ['permission'], 'viewer')),
    name: stringField(source, ['name'], externalId),
    description: stringField(source, ['description']),
    documentCount,
    readyDocumentCount,
    failedDocumentCount,
    processingDocumentCount,
  };
}

function mapDocument(raw: JsonObject, externalKnowledgeBaseId: string): MappedWeKnoraDocument {
  const externalId = stringField(raw, ['knowledge_id', 'knowledgeId', 'id']);

  return {
    externalId,
    externalKnowledgeBaseId,
    fileId: stringField(raw, ['file_id', 'fileId'], externalId),
    filename: stringField(
      raw,
      ['filename', 'file_name', 'fileName', 'name', 'title', 'source'],
      externalId,
    ),
    bytes: numberField(raw, ['bytes', 'size', 'file_size', 'fileSize']),
    mimeType: stringField(raw, ['mime_type', 'mimeType', 'content_type', 'contentType']),
    status: mapWeKnoraDocumentStatus(stringField(raw, ['parse_status', 'parseStatus', 'status'])),
    error: stringField(raw, ['error', 'error_message', 'errorMessage', 'message']),
  };
}

function mapSearchResult(raw: JsonObject): MappedWeKnoraSearchResult {
  return {
    externalDocumentId: stringField(raw, ['knowledge_id', 'knowledgeId', 'document_id', 'id']),
    externalKnowledgeBaseId: stringField(raw, [
      'knowledge_base_id',
      'knowledgeBaseId',
      'knowledgebase_id',
    ]),
    content: stringField(raw, ['content', 'text', 'chunk']),
    score: numberField(raw, ['score', 'similarity']),
    metadata: metadataField(raw),
  };
}

function toBlob(file: UploadWeKnoraDocumentFile): Blob {
  if (file.data instanceof Blob) {
    return file.data;
  }

  if (typeof file.data === 'string' || file.data instanceof ArrayBuffer) {
    return new Blob([file.data], { type: file.mimeType });
  }

  return new Blob([new Uint8Array(file.data)], { type: file.mimeType });
}

export function mapWeKnoraDocumentStatus(status?: string): KnowledgeBaseDocumentStatus {
  if (status === 'completed') {
    return 'ready';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return 'processing';
}

export function createWeKnoraClient(env: NodeJS.ProcessEnv = process.env): WeKnoraClient | null {
  const baseUrl = env.WEKNORA_API_BASE_URL?.trim();
  const apiKey = env.WEKNORA_API_KEY?.trim();
  const orgId = env.WEKNORA_ORG_ID?.trim();

  if (!baseUrl || !apiKey || !orgId) {
    return null;
  }

  const config: WeKnoraConfig = {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey,
    orgId,
    searchTopK: parseSearchTopK(env.WEKNORA_SEARCH_TOP_K),
    fetch: globalThis.fetch.bind(globalThis) as FetchLike,
  };

  return {
    async listSharedKnowledgeBases(): Promise<MappedWeKnoraKnowledgeBase[]> {
      const response = await requestJson<JsonValue>(
        config,
        ['organizations', config.orgId, 'shared-knowledge-bases'],
        {
          method: 'GET',
        },
      );
      return getArray(response).map(mapKnowledgeBase);
    },

    async listDocuments(
      externalKnowledgeBaseId: string,
      input: ListWeKnoraDocumentsInput = {},
    ): Promise<ListWeKnoraDocumentsResult> {
      const page = parsePageCursor(input.cursor);
      const pageSize = parsePageSize(input.limit);
      const response = await requestJson<JsonValue>(
        config,
        ['knowledge-bases', externalKnowledgeBaseId, 'knowledge'],
        {
          method: 'GET',
          query: { page: String(page), page_size: String(pageSize) },
        },
      );
      const data = getArray(response).map((document) =>
        mapDocument(document, externalKnowledgeBaseId),
      );
      return {
        data,
        nextCursor: nextDocumentCursor(response, page, pageSize, data.length),
      };
    },

    async createKnowledgeBase(
      input: CreateWeKnoraKnowledgeBaseInput,
    ): Promise<MappedWeKnoraKnowledgeBase> {
      const name = input.name.trim();
      const description = input.description?.trim() ?? '';
      const knowledgeBase = unwrapObjectResponse(
        await requestJson<JsonValue>(config, ['knowledge-bases'], {
          method: 'POST',
          json: { name, description },
        }),
      );
      const externalId = stringField(knowledgeBase, ['id', 'knowledge_base_id', 'knowledgeBaseId']);
      if (!externalId) {
        throw new Error('WeKnora create knowledge base response is missing id');
      }

      return mapKnowledgeBase({
        ...knowledgeBase,
        knowledge_base_id: externalId,
        permission: 'editor',
      });
    },

    async shareKnowledgeBase(externalKnowledgeBaseId: string): Promise<{ externalShareId: string }> {
      const share = unwrapObjectResponse(
        await requestJson<JsonValue>(config, ['knowledge-bases', externalKnowledgeBaseId, 'shares'], {
          method: 'POST',
          json: { organization_id: config.orgId, permission: 'editor' },
        }),
      );
      return {
        externalShareId: stringField(share, ['id', 'share_id', 'shareId']),
      };
    },

    async uploadDocument(
      externalKnowledgeBaseId: string,
      file: UploadWeKnoraDocumentFile,
    ): Promise<MappedWeKnoraDocument> {
      const form = new FormData();
      form.append('file', toBlob(file), file.filename);

      const response = unwrapObjectResponse(
        await requestJson<JsonValue>(
          config,
          ['knowledge-bases', externalKnowledgeBaseId, 'knowledge', 'file'],
          {
            method: 'POST',
            body: form,
          },
        ),
      );

      return mapDocument(response, externalKnowledgeBaseId);
    },

    async copyInitializationConfig(
      sourceExternalKnowledgeBaseId: string,
      targetExternalKnowledgeBaseId: string,
    ): Promise<WeKnoraInitializationStatus> {
      const source = await requestJson<JsonValue>(
        config,
        ['initialization', 'config', sourceExternalKnowledgeBaseId],
        { method: 'GET' },
      );
      const initializationConfig = sanitizeInitializationConfig(source);

      await requestJson<JsonValue>(
        config,
        ['initialization', 'config', targetExternalKnowledgeBaseId],
        {
          method: 'PUT',
          json: initializationConfig,
        },
      );

      return await this.getInitializationStatus(targetExternalKnowledgeBaseId);
    },

    async getInitializationStatus(
      externalKnowledgeBaseId: string,
    ): Promise<WeKnoraInitializationStatus> {
      const response = await requestJson<JsonValue>(
        config,
        ['initialization', 'config', externalKnowledgeBaseId],
        { method: 'GET' },
      );
      return summarizeInitializationConfig(response);
    },

    async search(
      query: string,
      externalKnowledgeBaseIds: string[],
    ): Promise<MappedWeKnoraSearchResult[]> {
      const response = await requestJson<JsonValue>(config, ['knowledge-search'], {
        method: 'POST',
        json: {
          query,
          knowledge_base_ids: externalKnowledgeBaseIds,
          top_k: config.searchTopK,
        },
      });
      return getArray(response).map(mapSearchResult);
    },
  };
}
