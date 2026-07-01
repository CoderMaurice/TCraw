import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { AgentCapabilities } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { useKnowledgeBaseSelectorQuery } from '~/data-provider';
import KnowledgeBases from '../KnowledgeBases';

jest.mock('~/data-provider', () => ({
  useKnowledgeBaseSelectorQuery: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: Record<string, unknown>) => {
    const labels: Record<string, string> = {
      com_ui_knowledge_bases: 'Knowledge bases',
      com_agents_search_knowledge_bases: 'Search knowledge bases',
      com_agents_add_knowledge_base: 'Add knowledge base',
      com_agents_no_knowledge_bases: 'No knowledge bases found',
      com_agents_remove_knowledge_base_var: `Remove ${vars?.['0'] ?? ''}`,
    };
    return labels[key] ?? key;
  },
}));

const selectorItems = [
  {
    id: 'kb_1',
    name: 'Support',
    description: 'Support playbooks',
    documentCount: 2,
    readyDocumentCount: 1,
    failedDocumentCount: 0,
  },
  {
    id: 'kb_2',
    name: 'Policies',
    description: '',
    documentCount: 1,
    readyDocumentCount: 1,
    failedDocumentCount: 0,
  },
];

function FormValues() {
  const knowledgeBaseIds = useWatch<AgentForm>({ name: 'knowledge_base_ids' }) as string[];
  const fileSearch = useWatch<AgentForm>({
    name: AgentCapabilities.file_search,
  }) as boolean;

  return (
    <>
      <div data-testid="knowledge-base-ids">{(knowledgeBaseIds ?? []).join(',')}</div>
      <div data-testid="file-search-enabled">{String(fileSearch === true)}</div>
    </>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const methods = useForm<AgentForm>({
    defaultValues: {
      knowledge_base_ids: [],
      [AgentCapabilities.file_search]: false,
    } as Partial<AgentForm>,
  });

  return (
    <FormProvider {...methods}>
      {children}
      <FormValues />
    </FormProvider>
  );
}

describe('KnowledgeBases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useKnowledgeBaseSelectorQuery as jest.Mock).mockReturnValue({
      data: { data: selectorItems },
      isLoading: false,
    });
  });

  it('toggles multiple selected knowledge bases and enables file search without closing the dialog', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <KnowledgeBases />
      </Wrapper>,
    );

    expect(screen.queryByLabelText('Search knowledge bases')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add knowledge base' }));
    const dialog = screen.getByRole('dialog', { name: 'Knowledge bases' });
    expect(dialog).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Add knowledge base Support' }));

    expect(screen.getByTestId('knowledge-base-ids')).toHaveTextContent('kb_1');
    expect(screen.getByTestId('file-search-enabled')).toHaveTextContent('true');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remove Support' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Add knowledge base Policies' }));

    expect(screen.getByTestId('knowledge-base-ids')).toHaveTextContent('kb_1,kb_2');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remove Support' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remove Policies' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Remove Support' }));

    expect(screen.getByTestId('knowledge-base-ids')).toHaveTextContent('kb_2');
    expect(within(dialog).getByRole('button', { name: 'Add knowledge base Support' })).toBeInTheDocument();
  });
});
