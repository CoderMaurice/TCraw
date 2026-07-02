const { createKnowledgeSearchTool } = require('./knowledgeSearch');

describe('knowledgeSearch tool', () => {
  it('searches only agent-bound WeKnora knowledge bases', async () => {
    const weknoraClient = {
      search: jest.fn().mockResolvedValue([
        {
          externalDocumentId: 'doc_1',
          content: '售后流程需要先创建工单。',
          metadata: { title: '售后手册.pdf' },
        },
      ]),
    };
    const createWeKnoraClient = jest.fn().mockReturnValue(weknoraClient);
    const findKnowledgeBaseById = jest.fn(async (id, tenantId) => {
      if (id === 'kb_1') {
        return {
          id,
          tenantId,
          provider: 'weknora',
          externalId: 'wk_1',
        };
      }
      return {
        id,
        tenantId,
        provider: 'local',
      };
    });

    const knowledgeTool = createKnowledgeSearchTool({
      req: { user: { id: 'viewer_1', role: 'USER', tenantId: 'tenant_user' } },
      agent: { tenantId: 'tenant_agent' },
      knowledgeBaseIds: ['kb_1', 'kb_1', 'kb_local'],
      deps: {
        createWeKnoraClient,
        findKnowledgeBaseById,
        env: {},
      },
    });

    const output = await knowledgeTool.invoke({ query: '售后流程' });

    expect(findKnowledgeBaseById).toHaveBeenCalledWith('kb_1', 'tenant_agent');
    expect(findKnowledgeBaseById).toHaveBeenCalledWith('kb_local', 'tenant_agent');
    expect(weknoraClient.search).toHaveBeenCalledWith('售后流程', ['wk_1']);
    expect(output).toContain('售后手册.pdf');
    expect(output).toContain('售后流程需要先创建工单。');
  });
});
