import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import { useAdminUserSearch, useAdminUsers } from '~/data-provider';
import { AdminUsersPage } from './Users';

jest.mock('@librechat/client', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Spinner: () => <div data-testid="spinner" />,
  useMediaQuery: () => false,
}), { virtual: true });

jest.mock('~/components/Chat/Menus/OpenSidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="open-sidebar" />,
}));

jest.mock('~/hooks', () => ({
  useAuthContext: jest.fn(() => ({ user: { role: 'ADMIN' } })),
  useLocalize: () => (key: string, values?: Record<string, string>) => {
    const labels: Record<string, string> = {
      com_ui_admin_people_title: 'People',
      com_ui_admin_people_total: '{{0}} people',
      com_ui_admin_people_search: 'Search people',
      com_ui_admin_people_search_hint: 'Search by name, email, or username',
      com_ui_admin_people_user: 'User',
      com_ui_admin_people_username: 'Username',
      com_ui_admin_people_role: 'Role',
      com_ui_admin_people_provider: 'Provider',
      com_ui_admin_people_created: 'Created',
      com_ui_admin_people_updated: 'Updated',
      com_ui_admin_people_empty: 'No people found.',
      com_ui_admin_people_search_empty: 'No people match your search.',
      com_ui_admin_people_load_error: 'Could not load people.',
      com_ui_admin_people_permission: 'You do not have permission to view people.',
      com_ui_admin_people_previous: 'Previous page',
      com_ui_admin_people_next: 'Next page',
      com_ui_admin_people_page_status: 'Showing {{0}}-{{1}} of {{2}}',
      com_ui_unknown: 'Unknown',
      com_ui_retry: 'Retry',
    };

    return (labels[key] ?? key)
      .replaceAll('{{0}}', values?.[0] ?? '')
      .replaceAll('{{1}}', values?.[1] ?? '')
      .replaceAll('{{2}}', values?.[2] ?? '');
  },
}));

jest.mock('~/data-provider', () => ({
  useAdminUsers: jest.fn(),
  useAdminUserSearch: jest.fn(),
}));

describe('AdminUsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAdminUserSearch as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  it('renders the paged people list', () => {
    (useAdminUsers as jest.Mock).mockReturnValue({
      data: {
        users: [
          {
            id: 'user_1',
            name: 'Maurice Moss',
            username: 'maurice',
            email: 'maurice@example.com',
            avatar: '',
            role: SystemRoles.ADMIN,
            provider: 'local',
            createdAt: '2026-01-02T03:04:05.000Z',
            updatedAt: '2026-01-03T03:04:05.000Z',
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<AdminUsersPage />);

    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByText('Maurice Moss')).toBeInTheDocument();
    expect(screen.getByText('maurice@example.com')).toBeInTheDocument();
    expect(screen.getByText('maurice')).toBeInTheDocument();
    expect(screen.getByText(SystemRoles.ADMIN)).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
  });

  it('enables search only after two trimmed characters', async () => {
    const user = userEvent.setup();

    (useAdminUsers as jest.Mock).mockReturnValue({
      data: { users: [], total: 0, limit: 25, offset: 0 },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<AdminUsersPage />);

    await user.type(screen.getByRole('searchbox', { name: 'Search people' }), ' ma ');

    await waitFor(() => {
      expect(useAdminUserSearch).toHaveBeenLastCalledWith(
        { q: 'ma', limit: 25 },
        expect.objectContaining({ enabled: true }),
      );
    });
  });
});
