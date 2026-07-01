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
  useLocalize: () => (key: string) => {
    const labels: Record<string, string> = {
      com_ui_all_knowledge_bases: 'All knowledge bases',
      com_ui_knowledge_base_documents: 'Documents',
      com_ui_knowledge_base_access: 'Access',
      com_ui_knowledge_base_settings: 'Settings',
      com_ui_ready: 'ready',
      com_ui_share: 'Share',
      com_ui_delete_document: 'Delete document',
      com_ui_delete_knowledge_base: 'Delete knowledge base',
      com_ui_knowledge_base_delete_confirm: 'Delete this knowledge base?',
      com_ui_confirm_delete_knowledge_base: 'Confirm delete',
    };
    return labels[key] ?? key;
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
        documentCount: 2,
        readyDocumentCount: 1,
        failedDocumentCount: 0,
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
    expect(screen.getByText('1 / 2 ready')).toBeInTheDocument();
    expect(screen.getByText('runbook.pdf')).toBeInTheDocument();

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
});
