const { tool } = require('@librechat/agents/langchain/tools');
const { createWeKnoraClient } = require('@librechat/api');
const { findKnowledgeBaseById } = require('~/models');

const KNOWLEDGE_SEARCH_TOOL = 'knowledge_search';

const knowledgeSearchJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      description:
        'A natural language query to search the knowledge bases bound to the current agent.',
    },
  },
  required: ['query'],
};

const normalizeKnowledgeBaseIds = (ids) => {
  if (!Array.isArray(ids)) {
    return [];
  }
  return [...new Set(ids.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean))];
};

const getSearchResultTitle = (result, index) => {
  const title =
    typeof result.metadata?.title === 'string'
      ? result.metadata.title
      : typeof result.metadata?.filename === 'string'
        ? result.metadata.filename
        : '';

  return title || result.externalDocumentId || `知识库结果 ${index + 1}`;
};

const formatKnowledgeResults = (results) => {
  if (!Array.isArray(results) || results.length === 0) {
    return '';
  }
  return results
    .map((result, index) => `【知识库 ${index + 1}】${getSearchResultTitle(result, index)}\n${result.content}`)
    .join('\n\n');
};

const resolveExternalKnowledgeBaseIds = async ({
  tenantId,
  knowledgeBaseIds,
  findKnowledgeBase,
}) => {
  const externalKnowledgeBaseIds = [];
  const resolvedKnowledgeBaseIds = normalizeKnowledgeBaseIds(knowledgeBaseIds);

  for (const id of resolvedKnowledgeBaseIds) {
    const knowledgeBase = await findKnowledgeBase(id, tenantId);
    if (!knowledgeBase || knowledgeBase.provider !== 'weknora' || !knowledgeBase.externalId) {
      continue;
    }
    externalKnowledgeBaseIds.push(knowledgeBase.externalId);
  }

  return externalKnowledgeBaseIds;
};

const createKnowledgeSearchTool = ({ req, agent, knowledgeBaseIds, deps = {} }) => {
  const createClient = deps.createWeKnoraClient ?? createWeKnoraClient;
  const findKnowledgeBase = deps.findKnowledgeBaseById ?? findKnowledgeBaseById;
  const env = deps.env ?? process.env;
  const resolvedKnowledgeBaseIds = normalizeKnowledgeBaseIds(knowledgeBaseIds);

  return tool(
    async ({ query }) => {
      if (typeof query !== 'string' || query.trim().length === 0) {
        return 'Please provide a search query.';
      }
      if (!req?.user?.id) {
        return 'Knowledge search is not available for this request.';
      }
      if (resolvedKnowledgeBaseIds.length === 0) {
        return 'No knowledge bases are bound to this agent.';
      }

      const weknoraClient = createClient(env);
      if (!weknoraClient) {
        return 'Knowledge search is not configured.';
      }

      const externalKnowledgeBaseIds = await resolveExternalKnowledgeBaseIds({
        tenantId: agent?.tenantId ?? req.user.tenantId,
        knowledgeBaseIds: resolvedKnowledgeBaseIds,
        findKnowledgeBase,
      });
      if (externalKnowledgeBaseIds.length === 0) {
        return 'No searchable knowledge bases are bound to this agent.';
      }

      const results = await weknoraClient.search(query.trim(), externalKnowledgeBaseIds);
      return formatKnowledgeResults(results) || 'No relevant knowledge base results found.';
    },
    {
      name: KNOWLEDGE_SEARCH_TOOL,
      description:
        'Searches only the enterprise knowledge bases bound to the current agent. Use this when the user asks about internal documents, policies, product manuals, procedures, or other private company knowledge that may not be in the model.',
      schema: knowledgeSearchJsonSchema,
    },
  );
};

module.exports = {
  KNOWLEDGE_SEARCH_TOOL,
  createKnowledgeSearchTool,
  formatKnowledgeResults,
  knowledgeSearchJsonSchema,
  resolveExternalKnowledgeBaseIds,
};
