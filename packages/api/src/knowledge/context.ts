import { PermissionBits, ResourceType } from 'librechat-data-provider';

import type {
  KnowledgeAuthContext,
  KnowledgeBaseRecord,
  KnowledgeBaseServiceDependencies,
  MappedWeKnoraSearchResult,
  MongoResourceId,
} from './types';

interface BuildWeKnoraKnowledgeContextInput {
  query: string;
  knowledgeBaseIds: string[];
}

function getKnowledgeBaseResourceId(knowledgeBase: KnowledgeBaseRecord): string | null {
  const resourceId: MongoResourceId | undefined = knowledgeBase._id ?? knowledgeBase.resourceId;
  return resourceId ? resourceId.toString() : null;
}

function getWeKnoraSearchResultTitle(result: MappedWeKnoraSearchResult, index: number): string {
  const title =
    typeof result.metadata.title === 'string'
      ? result.metadata.title
      : typeof result.metadata.filename === 'string'
        ? result.metadata.filename
        : '';

  return title || result.externalDocumentId || `知识库结果 ${index + 1}`;
}

function formatWeKnoraKnowledgeResults(results: MappedWeKnoraSearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  return results
    .map((result, index) => {
      const title = getWeKnoraSearchResultTitle(result, index);
      return `【知识库 ${index + 1}】${title}\n${result.content}`;
    })
    .join('\n\n');
}

export async function buildWeKnoraKnowledgeContext(
  auth: KnowledgeAuthContext,
  input: BuildWeKnoraKnowledgeContextInput,
  deps: Pick<
    KnowledgeBaseServiceDependencies,
    'checkPermission' | 'findKnowledgeBaseById' | 'weknoraClient'
  >,
): Promise<string> {
  if (
    !deps.weknoraClient ||
    typeof deps.weknoraClient.search !== 'function' ||
    typeof input.query !== 'string' ||
    input.query.trim().length === 0 ||
    input.knowledgeBaseIds.length === 0
  ) {
    return '';
  }

  const externalKnowledgeBaseIds: string[] = [];
  const seenKnowledgeBaseIds = new Set<string>();

  for (const knowledgeBaseId of input.knowledgeBaseIds) {
    const trimmedId = knowledgeBaseId.trim();
    if (!trimmedId || seenKnowledgeBaseIds.has(trimmedId)) {
      continue;
    }
    seenKnowledgeBaseIds.add(trimmedId);

    const knowledgeBase = await deps.findKnowledgeBaseById(trimmedId, auth.tenantId);
    if (!knowledgeBase || knowledgeBase.provider !== 'weknora' || !knowledgeBase.externalId) {
      continue;
    }

    const resourceId = getKnowledgeBaseResourceId(knowledgeBase);
    if (!resourceId) {
      continue;
    }

    const canView = await deps.checkPermission({
      userId: auth.userId,
      role: auth.role,
      resourceType: ResourceType.KNOWLEDGE_BASE,
      resourceId,
      requiredPermission: PermissionBits.VIEW,
    });
    if (!canView) {
      continue;
    }

    externalKnowledgeBaseIds.push(knowledgeBase.externalId);
  }

  if (externalKnowledgeBaseIds.length === 0) {
    return '';
  }

  const results = await deps.weknoraClient.search(input.query, externalKnowledgeBaseIds);
  return formatWeKnoraKnowledgeResults(results);
}
