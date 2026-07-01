import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ResourceType } from 'librechat-data-provider';
import { KnowledgeBaseDetail } from '../KnowledgeBaseDetail';
import {
  useKnowledgeBaseQuery,
  useKnowledgeBaseDocumentsQuery,
  useUpdateKnowledgeBaseMutation,
  useDeleteKnowledgeBaseMutation,
  useUploadKnowledgeBaseDocumentsMutation,
  useDeleteKnowledgeBaseDocumentMutation,
} from '~/data-provider';

jest.mock('librechat-data-provider', () => ({
  ...jest.requireActual('librechat-data-provider'),
  ResourceType: { KNOWLEDGE_BASE: 'knowledgeBase' },
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
  OGDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OGDialogTemplate: ({ main, buttons }: { main?: React.ReactNode; buttons?: React.ReactNode }) => (
    <div>
      {main}
      {buttons}
    </div>
  ),
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

jest.mock('~/components/Sharing', () => ({
  GenericGrantAccessDialog: ({
    resourceDbId,
    resourceName,
    resourceType,
    children,
  }: {
    resourceDbId: string;
    resourceName: string;
    resourceType: string;
    children?: React.ReactNode;
  }) => (
    <div
      data-testid="knowledge-base-access"
      data-resource-db-id={resourceDbId}
      data-resource-name={resourceName}
      data-resource-type={resourceType}
    >
      {children}
    </div>
  ),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: Record<string, string>) => {
    const labels: Record<string, string> = {
      com_ui_all_knowledge_bases: 'All knowledge bases',
      com_ui_knowledge_base_documents: 'Documents',
      com_ui_knowledge_base_access: 'Access',
      com_ui_knowledge_base_settings: 'Settings',
      com_ui_knowledge_base_documents_count: '{{0}} documents',
      com_ui_knowledge_base_provider_local: 'Local',
      com_ui_knowledge_base_provider_weknora: 'WeKnora',
      com_ui_knowledge_base_source: 'Source: {{0}}',
      com_ui_knowledge_base_status_failed: 'Failed',
      com_ui_knowledge_base_status_failed_count: 'Failed: {{0}}',
      com_ui_knowledge_base_status_processing: 'Processing',
      com_ui_knowledge_base_status_processing_count: 'Processing: {{0}}',
      com_ui_knowledge_base_status_ready: 'Ready',
      com_ui_knowledge_base_updated: 'Updated {{0}}',
      com_ui_ready: 'ready',
      com_ui_share: 'Share',
      com_ui_delete_document: 'Delete document',
      com_ui_delete_knowledge_base: 'Delete knowledge base',
      com_ui_knowledge_base_failure_reason: 'Failure reason',
      com_ui_knowledge_base_failure_reason_empty: 'No failure reason was recorded.',
      com_ui_knowledge_base_view_failure_reason: 'View reason',
      com_ui_knowledge_base_reupload_document: 'Re-upload',
      com_ui_knowledge_base_delete_confirm: 'Delete this knowledge base?',
      com_ui_confirm_delete_knowledge_base: 'Confirm delete',
    };
    return (labels[key] ?? key).replaceAll('{{0}}', values?.[0] ?? '');
  },
}));

jest.mock('~/data-provider', () => ({
  useKnowledgeBaseQuery: jest.fn(),
  useKnowledgeBaseDocumentsQuery: jest.fn(),
  useUpdateKnowledgeBaseMutation: jest.fn(),
  useDeleteKnowledgeBaseMutation: jest.fn(),
  useUploadKnowledgeBaseDocumentsMutation: jest.fn(),
  useDeleteKnowledgeBaseDocumentMutation: jest.fn(),
}));

describe('KnowledgeBaseDetail', () => {
  const deleteKnowledgeBase = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useKnowledgeBaseQuery as jest.Mock).mockReturnValue({
      data: {
        _id: 'mongo_kb_1',
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
      isLoading: false,
    });
    (useKnowledgeBaseDocumentsQuery as jest.Mock).mockReturnValue({
      data: {
        data: [
          {
            id: 'doc_1',
            knowledgeBaseId: 'kb_1',
            file_id: 'file_1',
            filename: 'runbook.pdf',
            bytes: 2048,
            status: 'ready',
          },
          {
            id: 'doc_processing',
            knowledgeBaseId: 'kb_1',
            file_id: 'file_processing',
            filename: 'indexing.md',
            bytes: 1024,
            status: 'processing',
          },
        ],
      },
      isLoading: false,
    });
    (useUpdateKnowledgeBaseMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isLoading: false,
    });
    (useDeleteKnowledgeBaseMutation as jest.Mock).mockReturnValue({
      mutateAsync: deleteKnowledgeBase,
      isLoading: false,
    });
    (useUploadKnowledgeBaseDocumentsMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isLoading: false,
    });
    (useDeleteKnowledgeBaseDocumentMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isLoading: false,
    });
  });

  it('renders documents and grants access for the knowledge base resource', async () => {
    const router = createMemoryRouter(
      [{ path: '/knowledge/:id', element: <KnowledgeBaseDetail /> }],
      {
        initialEntries: ['/knowledge/kb_1'],
      },
    );

    render(<RouterProvider router={router} />);

    expect(useKnowledgeBaseQuery).toHaveBeenCalledWith('kb_1');
    expect(useKnowledgeBaseDocumentsQuery).toHaveBeenCalledWith(
      'kb_1',
      expect.objectContaining({ refetchInterval: expect.any(Function) }),
    );
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Support playbooks')).toBeInTheDocument();
    expect(screen.getByText('WeKnora')).toBeInTheDocument();
    expect(screen.getByText('22 documents')).toBeInTheDocument();
    expect(screen.getByText('Processing: 2')).toBeInTheDocument();
    expect(screen.getByText('Failed: 1')).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
    expect(screen.getByText('runbook.pdf')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('indexing.md')).toBeInTheDocument();
    expect(screen.getAllByText('Processing')).toHaveLength(1);
    expect(screen.queryAllByRole('button', { name: 'Delete document' })).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Access' }));

    const access = screen.getByTestId('knowledge-base-access');
    expect(access).toHaveAttribute('data-resource-db-id', 'mongo_kb_1');
    expect(access).toHaveAttribute('data-resource-name', 'Support');
    expect(access).toHaveAttribute('data-resource-type', ResourceType.KNOWLEDGE_BASE);
  });

  it('requires confirmation before deleting a knowledge base', async () => {
    const router = createMemoryRouter(
      [{ path: '/knowledge/:id', element: <KnowledgeBaseDetail /> }],
      {
        initialEntries: ['/knowledge/kb_1'],
      },
    );

    render(<RouterProvider router={router} />);

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete knowledge base' }));

    expect(deleteKnowledgeBase).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(deleteKnowledgeBase).toHaveBeenCalledWith('kb_1');
  });

  it('shows failed document details and opens file picker for re-upload', async () => {
    const inputClick = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation();
    (useKnowledgeBaseDocumentsQuery as jest.Mock).mockReturnValue({
      data: {
        data: [
          {
            id: 'doc_failed',
            knowledgeBaseId: 'kb_1',
            file_id: 'file_failed',
            filename: 'strategy.docx',
            bytes: 4096,
            status: 'failed',
            error: 'Embedding model is not configured',
          },
        ],
      },
      isLoading: false,
    });
    const router = createMemoryRouter(
      [{ path: '/knowledge/:id', element: <KnowledgeBaseDetail /> }],
      {
        initialEntries: ['/knowledge/kb_1'],
      },
    );

    try {
      render(<RouterProvider router={router} />);

      await userEvent.click(screen.getByRole('button', { name: 'View reason' }));

      expect(screen.getByText('Failure reason')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Embedding model is not configured')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Re-upload' }));

      expect(inputClick).toHaveBeenCalled();
    } finally {
      inputClick.mockRestore();
    }
  });
});
