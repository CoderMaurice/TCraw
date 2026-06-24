import React from 'react';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { KnowledgeBasePage } from '../KnowledgeBasePage';
import { useKnowledgeBasesQuery, useCreateKnowledgeBaseMutation } from '~/data-provider';

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
  useLocalize: () => (key: string) => {
    const labels: Record<string, string> = {
      com_ui_create_knowledge_base: 'Create knowledge base',
      com_ui_search_knowledge_bases: 'Search knowledge bases',
      com_ui_knowledge_bases: 'Knowledge Bases',
      com_ui_ready: 'ready',
    };
    return labels[key] ?? key;
  },
}));

jest.mock('~/data-provider', () => ({
  useKnowledgeBasesQuery: jest.fn(),
  useCreateKnowledgeBaseMutation: jest.fn(),
}));

describe('KnowledgeBasePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateKnowledgeBaseMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isLoading: false,
    });
  });

  it('renders searchable knowledge bases with ready document counts', () => {
    (useKnowledgeBasesQuery as jest.Mock).mockReturnValue({
      data: {
        data: [
          {
            id: 'kb_1',
            name: 'Support',
            description: 'Support playbooks',
            documentCount: 2,
            readyDocumentCount: 1,
            failedDocumentCount: 0,
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
    expect(screen.getByRole('button', { name: 'Create knowledge base' })).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Support playbooks')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 ready')).toBeInTheDocument();
  });
});
