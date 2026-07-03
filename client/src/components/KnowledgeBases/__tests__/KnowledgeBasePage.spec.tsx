import React from 'react';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { KnowledgeBasePage } from '../KnowledgeBasePage';
import {
  useCreateKnowledgeBaseMutation,
  useKnowledgeBaseCapabilitiesQuery,
  useKnowledgeBasesQuery,
} from '~/data-provider';

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
  OGDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OGDialogTemplate: () => null,
  Spinner: () => <div data-testid="spinner" />,
  TextareaAutosize: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
  useMediaQuery: () => false,
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('~/components/Chat/Menus/OpenSidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="open-sidebar" />,
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: Record<string, string>) => {
    const labels: Record<string, string> = {
      com_ui_create_knowledge_base: 'Create knowledge base',
      com_ui_search_knowledge_bases: 'Search knowledge bases',
      com_ui_knowledge_bases: 'Knowledge Bases',
      com_ui_knowledge_base_documents_count: '{{0}} documents',
      com_ui_knowledge_base_status_failed: 'Failed',
      com_ui_knowledge_base_status_failed_count: 'Failed: {{0}}',
      com_ui_knowledge_base_status_processing: 'Processing',
      com_ui_knowledge_base_status_processing_count: 'Processing: {{0}}',
      com_ui_knowledge_base_updated: 'Updated {{0}}',
      com_ui_knowledge_base_name: 'Knowledge base name',
      com_ui_knowledge_base_name_placeholder: 'New knowledge base',
      com_ui_description: 'Description',
      com_ui_knowledge_base_description_placeholder: 'Optional description',
      com_ui_knowledge_lifecycle_initializing: 'Configuring',
      com_ui_ready: 'ready',
    };
    return (labels[key] ?? key).replaceAll('{{0}}', values?.[0] ?? '');
  },
}));

jest.mock('~/data-provider', () => ({
  useCreateKnowledgeBaseMutation: jest.fn(),
  useKnowledgeBaseCapabilitiesQuery: jest.fn(),
  useKnowledgeBasesQuery: jest.fn(),
}));

describe('KnowledgeBasePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateKnowledgeBaseMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isLoading: false,
    });
    (useKnowledgeBaseCapabilitiesQuery as jest.Mock).mockReturnValue({
      data: {
        weknora: {
          configured: true,
          canCreate: false,
          canUpload: true,
          requiresTemplate: true,
          templateConfigured: false,
        },
      },
    });
  });

  it('renders searchable knowledge bases without exposing backend provider labels', () => {
    (useKnowledgeBasesQuery as jest.Mock).mockReturnValue({
      data: {
        data: [
          {
            id: 'kb_1',
            name: 'Support',
            description: 'Support playbooks',
            provider: 'weknora',
            documentCount: 22,
            readyDocumentCount: 19,
            processingDocumentCount: 2,
            failedDocumentCount: 1,
            updatedAt: '2026-01-02T03:04:05.000Z',
          },
        ],
      },
      isLoading: false,
    });

    const router = createMemoryRouter([{ path: '/knowledge', element: <KnowledgeBasePage /> }], {
      initialEntries: ['/knowledge'],
    });

    render(<RouterProvider router={router} />);

    expect(useKnowledgeBasesQuery).toHaveBeenCalledWith({ limit: 50, search: undefined });
    expect(screen.getByRole('searchbox', { name: 'Search knowledge bases' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create knowledge base' })).not.toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Support playbooks')).toBeInTheDocument();
    expect(screen.queryByText('WeKnora')).not.toBeInTheDocument();
    expect(screen.queryByText('com_ui_knowledge_base_provider_weknora')).not.toBeInTheDocument();
    expect(screen.getByText('22 documents')).toBeInTheDocument();
    expect(screen.getByText('Processing: 2')).toBeInTheDocument();
    expect(screen.getByText('Failed: 1')).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('shows create when knowledge base capabilities allow creation', () => {
    (useKnowledgeBaseCapabilitiesQuery as jest.Mock).mockReturnValue({
      data: {
        weknora: {
          configured: true,
          canCreate: true,
          canUpload: true,
          requiresTemplate: true,
          templateConfigured: true,
        },
      },
    });
    (useKnowledgeBasesQuery as jest.Mock).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    });

    const router = createMemoryRouter([{ path: '/knowledge', element: <KnowledgeBasePage /> }], {
      initialEntries: ['/knowledge'],
    });

    render(<RouterProvider router={router} />);

    expect(screen.getByRole('button', { name: 'Create knowledge base' })).toBeInTheDocument();
  });
});
