import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import { useAdminUserSearch, useAdminUsers } from '~/data-provider';
import { AdminUsersPage } from './Users';

jest.mock(
  '@librechat/client',
  () => ({
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Spinner: () => <div data-testid="spinner" />,
    useMediaQuery: () => false,
  }),
  { virtual: true },
);

jest.mock('~/components/Chat/Menus/OpenSidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="open-sidebar" />,
}));

jest.mock('~/hooks', () => {
  const labels: Record<string, string> = require('~/locales/en/translation.json');

  const localize = (key: string, values?: Record<string, string | number>) => {
    const template = labels[key] ?? key;
    return template.replace(/\{\{(\d+)\}\}/g, (_, index: string) =>
      String(values?.[index] ?? ''),
    );
  };

  return {
    useAuthContext: jest.fn(() => ({ user: { role: 'USER' }, isAuthenticated: true })),
    useLocalize: () => localize,
  };
});

jest.mock('~/data-provider', () => ({
  useAdminUsers: jest.fn(),
  useAdminUserSearch: jest.fn(),
}));

const mockUseAdminUsers = useAdminUsers as jest.Mock;
const mockUseAdminUserSearch = useAdminUserSearch as jest.Mock;

function createListQuery(overrides: Partial<ReturnType<typeof mockUseAdminUsers>> = {}) {
  return {
    data: {
      users: [],
      total: 0,
      limit: 25,
      offset: 0,
    },
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
    ...overrides,
  };
}

function createSearchQuery(overrides: Partial<ReturnType<typeof mockUseAdminUserSearch>> = {}) {
  return {
    data: {
      users: [],
      total: 0,
      limit: 25,
    },
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
    ...overrides,
  };
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAdminUsers.mockReturnValue(createListQuery());
    mockUseAdminUserSearch.mockReturnValue(createSearchQuery());
  });

  it('renders the provider column in the people list', () => {
    mockUseAdminUsers.mockReturnValue(
      createListQuery({
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
      }),
    );

    render(<AdminUsersPage />);

    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
  });

  it('shows the permission state for a 403 response', () => {
    mockUseAdminUsers.mockReturnValue(
      createListQuery({
        isError: true,
        error: { isAxiosError: true, response: { status: 403 } },
      }),
    );

    render(<AdminUsersPage />);

    expect(screen.getByText('You do not have permission to view people.')).toBeInTheDocument();
    expect(screen.queryByText('Could not load people.')).not.toBeInTheDocument();
  });

  it('shows the search empty state when a search returns no matches', async () => {
    const user = userEvent.setup();

    mockUseAdminUsers.mockReturnValue(
      createListQuery({
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
      }),
    );
    mockUseAdminUserSearch.mockReturnValue(
      createSearchQuery({
        data: {
          users: [],
          total: 0,
          limit: 25,
        },
      }),
    );

    render(<AdminUsersPage />);

    await user.type(screen.getByRole('searchbox', { name: 'Search people' }), 'ma');

    await waitFor(() => {
      expect(screen.getByText('No people match your search.')).toBeInTheDocument();
    });
  });

  it('moves between pages with the pagination buttons', async () => {
    const user = userEvent.setup();

    mockUseAdminUsers.mockReturnValue(
      createListQuery({
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
          total: 26,
          limit: 25,
          offset: 0,
        },
      }),
    );

    render(<AdminUsersPage />);

    const previousPage = screen.getByRole('button', { name: 'Previous page' });
    const nextPage = screen.getByRole('button', { name: 'Next page' });

    expect(previousPage).toBeDisabled();
    expect(nextPage).toBeEnabled();

    await user.click(nextPage);

    await waitFor(() => {
      expect(mockUseAdminUsers).toHaveBeenLastCalledWith(
        { limit: 25, offset: 25 },
        expect.objectContaining({ enabled: true }),
      );
    });

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});
