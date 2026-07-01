import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import type { AgentForm } from '~/common';
import AgentConfig from '../AgentConfig';

jest.mock('~/components/Tools', () => ({
  ToolSelectDialog: () => null,
  MCPToolSelectDialog: () => <div>MCP dialog</div>,
}));

jest.mock('~/components/Skills/dialogs', () => ({
  SkillSelectDialog: () => null,
}));

jest.mock('~/components/SidePanel/Builder/Action', () => () => <div>Add action row</div>);
jest.mock('../AgentAvatar', () => () => null);
jest.mock('../AgentCategorySelector', () => () => <div>Category selector</div>);
jest.mock('../Instructions', () => () => <div>Instructions</div>);
jest.mock('../Code/Form', () => () => <div>Run code module</div>);
jest.mock('../Search/Form', () => () => <div>Web search module</div>);
jest.mock('../FileContext', () => () => <div>File context module</div>);
jest.mock('../Artifacts', () => () => <div>Artifacts module</div>);
jest.mock('../KnowledgeBases', () => () => <div>Knowledge bases module</div>);
jest.mock('../FileSearch', () => () => <div>File search module</div>);
jest.mock('../MCPTools', () => () => <div>Add MCP Server Tools</div>);
jest.mock('../AgentTool', () => () => <div>Agent tool row</div>);

jest.mock('~/data-provider', () => ({
  useListSkillsQuery: () => ({ data: { skills: [] } }),
  useGetAgentFiles: () => ({ data: [] }),
}));

jest.mock('~/Providers', () => ({
  useFileMapContext: () => ({}),
  useAgentPanelContext: () => ({
    actions: [{ agent_id: 'agent-1' }],
    setAction: jest.fn(),
    regularTools: [{ pluginKey: 'tool-1' }],
    agentsConfig: {
      capabilities: [
        'execute_code',
        'file_search',
        'web_search',
        'artifacts',
        'context',
        'skills',
        'tools',
        'actions',
      ],
    },
    availableMCPServers: [],
    mcpServersMap: {},
    setActivePanel: jest.fn(),
    endpointsConfig: {},
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const labels: Record<string, string> = {
      com_assistants_capabilities: 'Capabilities',
      com_assistants_add_actions: 'Add actions',
      com_assistants_add_mcp_server_tools: 'Add MCP Server Tools',
      com_assistants_add_tools: 'Add tools',
      com_ui_agent_description: 'Agent description',
      com_ui_agent_name: 'Agent name',
      com_ui_category: 'Category',
      com_ui_description: 'Description',
      com_ui_model: 'Model',
      com_ui_name: 'Name',
      com_ui_select_model: 'Select model',
      com_ui_add_skills: 'Add skills',
      com_ui_skills: 'Skills',
      com_ui_skills_enable_toggle: 'Enable skills',
      com_ui_support_contact: 'Support contact',
      com_ui_support_contact_email: 'Support email',
      com_ui_support_contact_name: 'Support name',
      com_ui_tools_and_actions: 'Tools and Actions',
    };
    return labels[key] ?? key;
  },
  useVisibleTools: () => ({ toolIds: ['tool-1'], mcpServerNames: [] }),
  useHasAccess: () => true,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const methods = useForm<AgentForm>({
    defaultValues: {
      id: 'agent-1',
      name: 'Agent',
      description: '',
      model: '',
      provider: '',
      tools: ['tool-1'],
      category: 'general',
      skills_enabled: true,
    } as Partial<AgentForm>,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <FormProvider {...methods}>{children}</FormProvider>
    </QueryClientProvider>
  );
}

describe('AgentConfig', () => {
  it('hides advanced capability modules and support/tools sections from the builder form', () => {
    render(
      <Wrapper>
        <AgentConfig />
      </Wrapper>,
    );

    expect(screen.getByText('Run code module')).toBeInTheDocument();
    expect(screen.getByText('Artifacts module')).toBeInTheDocument();
    expect(screen.getByText('Knowledge bases module')).toBeInTheDocument();
    expect(screen.queryByText('Web search module')).not.toBeInTheDocument();
    expect(screen.queryByText('File context module')).not.toBeInTheDocument();
    expect(screen.queryByText('File search module')).not.toBeInTheDocument();
    expect(screen.queryByText('Support contact')).not.toBeInTheDocument();
    expect(screen.queryByText('Tools and Actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Add tools')).not.toBeInTheDocument();
    expect(screen.queryByText('Add actions')).not.toBeInTheDocument();
    expect(screen.getByText('Add MCP Server Tools')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add skills' })).toBeEnabled();
    expect(screen.queryByLabelText('Enable skills')).not.toBeInTheDocument();
  });
});
