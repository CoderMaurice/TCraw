# Admin Users Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only admin personnel directory with a discoverable admin-only navigation entry, searchable user list, and paginated default browsing.

**Architecture:** Reuse the existing backend admin user handlers and add only client-facing wiring: shared data-provider endpoints/service/types, React Query hooks, a lazy-loaded `/admin/users` page, and an admin-only sidebar link. Backend authorization remains authoritative through `ACCESS_ADMIN` and `READ_USERS`.

**Tech Stack:** TypeScript, React, React Router, React Query, Jest, Testing Library, LibreChat monorepo packages.

## Global Constraints

- All new backend code must be TypeScript in `/packages/api`; this feature should not need new backend code.
- Keep `/api` changes to the absolute minimum; this feature should not need `/api` changes.
- Frontend user-facing text must use `useLocalize()`.
- Only update English keys in `client/src/locales/en/translation.json` unless implementation confirms local product-owned Chinese keys must be updated.
- Do not add delete, disable, role editing, impersonation, or bulk actions.
- Use existing backend endpoints: `GET /api/admin/users` and `GET /api/admin/users/search`.
- Preserve backend authorization through `ACCESS_ADMIN` and `READ_USERS`.
- Prefer single-word file names where possible.

---

## File Structure

- Modify `packages/data-provider/src/api-endpoints.ts`
  - Adds admin users URL helpers.
- Modify `packages/data-provider/src/data-service.ts`
  - Adds `listAdminUsers` and `searchAdminUsers` service functions.
- Modify `packages/data-provider/src/types/queries.ts`
  - Adds request/response types for admin user list and search.
- Modify `packages/data-provider/src/keys.ts`
  - Adds query keys for admin users and admin user search.
- Create `client/src/data-provider/Admin/queries.ts`
  - Owns React Query hooks for admin users.
- Create `client/src/data-provider/Admin/index.ts`
  - Re-exports admin query hooks.
- Modify `client/src/data-provider/index.ts`
  - Re-exports the new Admin data-provider module.
- Create `client/src/components/Admin/Users.tsx`
  - Owns the `/admin/users` page UI and local interaction state.
- Create `client/src/components/Admin/index.ts`
  - Re-exports admin page components.
- Modify `client/src/routes/index.tsx`
  - Adds lazy route for `/admin/users`.
- Modify `client/src/hooks/Nav/useSideNavLinks.ts`
  - Adds admin-only People navigation entry.
- Modify `client/src/locales/en/translation.json`
  - Adds English copy for the page, nav, states, table labels, and pagination.
- Add focused Jest tests near the changed surfaces.

---

### Task 1: Shared Data Provider Admin User API

**Files:**
- Modify: `packages/data-provider/src/api-endpoints.ts`
- Modify: `packages/data-provider/src/data-service.ts`
- Modify: `packages/data-provider/src/types/queries.ts`
- Modify: `packages/data-provider/src/keys.ts`
- Test: `packages/data-provider/src/admin-users.spec.ts`

**Interfaces:**
- Produces:
  - `AdminUsersListParams = { limit?: number; offset?: number }`
  - `AdminUsersListResponse = { users: AdminUserListItem[]; total: number; limit: number; offset: number }`
  - `AdminUsersSearchParams = { q: string; limit?: number }`
  - `AdminUsersSearchResponse = { users: AdminUserSearchResult[]; total: number; capped: boolean }`
  - `endpoints.adminUsers(params?: AdminUsersListParams): string`
  - `endpoints.adminUsersSearch(params: AdminUsersSearchParams): string`
  - `dataService.listAdminUsers(params?: AdminUsersListParams): Promise<AdminUsersListResponse>`
  - `dataService.searchAdminUsers(params: AdminUsersSearchParams): Promise<AdminUsersSearchResponse>`

- [ ] **Step 1: Write failing data-provider tests**

Create `packages/data-provider/src/admin-users.spec.ts`:

```ts
import * as endpoints from './api-endpoints';

describe('admin users data provider helpers', () => {
  it('builds the default admin users list endpoint', () => {
    expect(endpoints.adminUsers()).toBe('/api/admin/users');
  });

  it('builds a paged admin users list endpoint', () => {
    expect(endpoints.adminUsers({ limit: 25, offset: 50 })).toBe(
      '/api/admin/users?limit=25&offset=50',
    );
  });

  it('omits undefined paging parameters', () => {
    expect(endpoints.adminUsers({ limit: 25 })).toBe('/api/admin/users?limit=25');
  });

  it('encodes admin user search query parameters', () => {
    expect(endpoints.adminUsersSearch({ q: 'maurice+admin@example.com', limit: 10 })).toBe(
      '/api/admin/users/search?q=maurice%2Badmin%40example.com&limit=10',
    );
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/packages/data-provider
npx jest src/admin-users.spec.ts --runInBand
```

Expected: FAIL because `adminUsers` and `adminUsersSearch` are not exported yet.

- [ ] **Step 3: Add query types**

Append to `packages/data-provider/src/types/queries.ts`:

```ts
export type AdminUsersListParams = {
  limit?: number;
  offset?: number;
};

export type AdminUserListItem = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  role: string;
  provider: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUsersListResponse = {
  users: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminUsersSearchParams = {
  q: string;
  limit?: number;
};

export type AdminUserSearchResult = {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatarUrl?: string;
};

export type AdminUsersSearchResponse = {
  users: AdminUserSearchResult[];
  total: number;
  capped: boolean;
};
```

- [ ] **Step 4: Add query keys**

Add to `QueryKeys` in `packages/data-provider/src/keys.ts` near other admin or role keys:

```ts
adminUsers = 'adminUsers',
adminUserSearch = 'adminUserSearch',
```

- [ ] **Step 5: Add endpoint helpers**

Add to `packages/data-provider/src/api-endpoints.ts` near the existing admin endpoint helpers:

```ts
export const adminUsers = (params?: q.AdminUsersListParams) => {
  const cleaned: Record<string, string> = {};
  if (params?.limit != null) {
    cleaned.limit = String(params.limit);
  }
  if (params?.offset != null) {
    cleaned.offset = String(params.offset);
  }
  const query = Object.keys(cleaned).length > 0 ? `?${new URLSearchParams(cleaned)}` : '';
  return `${BASE_URL}/api/admin/users${query}`;
};

export const adminUsersSearch = (params: q.AdminUsersSearchParams) => {
  const cleaned: Record<string, string> = { q: params.q };
  if (params.limit != null) {
    cleaned.limit = String(params.limit);
  }
  return `${BASE_URL}/api/admin/users/search?${new URLSearchParams(cleaned)}`;
};
```

If `api-endpoints.ts` does not already import query types as `q`, add:

```ts
import type * as q from './types/queries';
```

Keep import ordering consistent with the file.

- [ ] **Step 6: Add service functions**

Add to `packages/data-provider/src/data-service.ts` near the existing admin service functions:

```ts
export function listAdminUsers(
  params?: q.AdminUsersListParams,
): Promise<q.AdminUsersListResponse> {
  return request.get(endpoints.adminUsers(params));
}

export function searchAdminUsers(
  params: q.AdminUsersSearchParams,
): Promise<q.AdminUsersSearchResponse> {
  return request.get(endpoints.adminUsersSearch(params));
}
```

If `data-service.ts` already imports query types as `q`, reuse that alias.

- [ ] **Step 7: Run data-provider tests**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/packages/data-provider
npx jest src/admin-users.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Build data-provider**

Run from repo root:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw
npm run build:data-provider
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/data-provider/src/api-endpoints.ts packages/data-provider/src/data-service.ts packages/data-provider/src/types/queries.ts packages/data-provider/src/keys.ts packages/data-provider/src/admin-users.spec.ts
git commit -m "feat: add admin users data provider"
```

---

### Task 2: Client Admin User Query Hooks

**Files:**
- Create: `client/src/data-provider/Admin/queries.ts`
- Create: `client/src/data-provider/Admin/index.ts`
- Modify: `client/src/data-provider/index.ts`
- Test: `client/src/data-provider/Admin/queries.spec.tsx`

**Interfaces:**
- Consumes from Task 1:
  - `dataService.listAdminUsers(params?: AdminUsersListParams)`
  - `dataService.searchAdminUsers(params: AdminUsersSearchParams)`
  - `QueryKeys.adminUsers`
  - `QueryKeys.adminUserSearch`
- Produces:
  - `useAdminUsers(params: AdminUsersListParams, config?: UseQueryOptions<AdminUsersListResponse>)`
  - `useAdminUserSearch(params: AdminUsersSearchParams, config?: UseQueryOptions<AdminUsersSearchResponse>)`

- [ ] **Step 1: Write failing hook tests**

Create `client/src/data-provider/Admin/queries.spec.tsx`:

```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { dataService } from 'librechat-data-provider';
import { useAdminUsers, useAdminUserSearch } from './queries';

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    dataService: {
      ...actual.dataService,
      listAdminUsers: jest.fn(),
      searchAdminUsers: jest.fn(),
    },
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('admin user query hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads paged admin users', async () => {
    (dataService.listAdminUsers as jest.Mock).mockResolvedValue({
      users: [],
      total: 0,
      limit: 25,
      offset: 0,
    });

    const { result } = renderHook(() => useAdminUsers({ limit: 25, offset: 0 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(dataService.listAdminUsers).toHaveBeenCalledWith({ limit: 25, offset: 0 });
  });

  it('does not search until enabled by caller', () => {
    renderHook(
      () =>
        useAdminUserSearch(
          { q: 'a', limit: 20 },
          {
            enabled: false,
          },
        ),
      { wrapper },
    );

    expect(dataService.searchAdminUsers).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the failing hook tests**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/client
npx jest src/data-provider/Admin/queries.spec.tsx --runInBand
```

Expected: FAIL because the Admin data-provider module does not exist yet.

- [ ] **Step 3: Implement hooks**

Create `client/src/data-provider/Admin/queries.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type {
  AdminUsersListParams,
  AdminUsersListResponse,
  AdminUsersSearchParams,
  AdminUsersSearchResponse,
} from 'librechat-data-provider';

export const useAdminUsers = (
  params: AdminUsersListParams,
  config?: UseQueryOptions<AdminUsersListResponse>,
): QueryObserverResult<AdminUsersListResponse> => {
  return useQuery<AdminUsersListResponse>(
    [QueryKeys.adminUsers, params.limit ?? null, params.offset ?? 0],
    () => dataService.listAdminUsers(params),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminUserSearch = (
  params: AdminUsersSearchParams,
  config?: UseQueryOptions<AdminUsersSearchResponse>,
): QueryObserverResult<AdminUsersSearchResponse> => {
  return useQuery<AdminUsersSearchResponse>(
    [QueryKeys.adminUserSearch, params.q, params.limit ?? null],
    () => dataService.searchAdminUsers(params),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};
```

Create `client/src/data-provider/Admin/index.ts`:

```ts
export * from './queries';
```

Add to `client/src/data-provider/index.ts`:

```ts
export * from './Admin';
```

- [ ] **Step 4: Run hook tests**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/client
npx jest src/data-provider/Admin/queries.spec.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add client/src/data-provider/Admin client/src/data-provider/index.ts
git commit -m "feat: add admin users query hooks"
```

---

### Task 3: Admin Users Page

**Files:**
- Create: `client/src/components/Admin/Users.tsx`
- Create: `client/src/components/Admin/index.ts`
- Modify: `client/src/locales/en/translation.json`
- Test: `client/src/components/Admin/Users.spec.tsx`

**Interfaces:**
- Consumes from Task 2:
  - `useAdminUsers({ limit, offset }, { enabled })`
  - `useAdminUserSearch({ q, limit }, { enabled })`
- Produces:
  - `AdminUsersPage` default export.

- [ ] **Step 1: Add English locale keys**

Add these keys to `client/src/locales/en/translation.json` near existing `com_ui_admin` / user keys:

```json
"com_ui_admin_people": "People",
"com_ui_admin_people_title": "People",
"com_ui_admin_people_total": "{{0}} people",
"com_ui_admin_people_search": "Search people",
"com_ui_admin_people_search_hint": "Search by name, email, or username",
"com_ui_admin_people_user": "User",
"com_ui_admin_people_username": "Username",
"com_ui_admin_people_role": "Role",
"com_ui_admin_people_provider": "Provider",
"com_ui_admin_people_created": "Created",
"com_ui_admin_people_updated": "Updated",
"com_ui_admin_people_empty": "No people found.",
"com_ui_admin_people_search_empty": "No people match your search.",
"com_ui_admin_people_load_error": "Could not load people.",
"com_ui_admin_people_permission": "You do not have permission to view people.",
"com_ui_admin_people_previous": "Previous page",
"com_ui_admin_people_next": "Next page",
"com_ui_admin_people_page_status": "Showing {{0}}-{{1}} of {{2}}",
"com_ui_unknown": "Unknown"
```

If `com_ui_unknown` already exists, do not add it again.

- [ ] **Step 2: Write failing page tests**

Create `client/src/components/Admin/Users.spec.tsx`:

```tsx
import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import { AdminUsersPage } from './Users';
import { useAdminUsers, useAdminUserSearch } from '~/data-provider';

jest.mock('@librechat/client', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Spinner: () => <div data-testid="spinner" />,
  useMediaQuery: () => false,
}));

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
    (useAdminUsers as jest.Mock).mockReturnValue({
      data: { users: [], total: 0, limit: 25, offset: 0 },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<AdminUsersPage />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search people' }), 'ma');

    expect(useAdminUserSearch).toHaveBeenLastCalledWith(
      { q: 'ma', limit: 25 },
      expect.objectContaining({ enabled: true }),
    );
  });
});
```

- [ ] **Step 3: Run the failing page tests**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/client
npx jest src/components/Admin/Users.spec.tsx --runInBand
```

Expected: FAIL because the Admin users page does not exist.

- [ ] **Step 4: Implement the page**

Create `client/src/components/Admin/Users.tsx`:

```tsx
import { useDeferredValue, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Search, UserRound } from 'lucide-react';
import { Input, Spinner, useMediaQuery } from '@librechat/client';
import { SystemRoles } from 'librechat-data-provider';
import type { AdminUserListItem, AdminUserSearchResult } from 'librechat-data-provider';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import { useAdminUsers, useAdminUserSearch } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import { cn } from '~/utils';

const PAGE_SIZE = 25;

type DisplayUser = AdminUserListItem & {
  avatarUrl?: string;
};

function formatDate(value?: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function mapSearchUser(user: AdminUserSearchResult): DisplayUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? '',
    email: user.email,
    avatar: user.avatarUrl ?? '',
    avatarUrl: user.avatarUrl,
    role: '',
    provider: '',
  };
}

function UserAvatar({ user }: { user: DisplayUser }) {
  const source = user.avatarUrl || user.avatar;
  if (source) {
    return (
      <img
        src={source}
        alt=""
        className="h-9 w-9 rounded-full border border-border-light object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border-light bg-surface-tertiary text-text-secondary">
      <UserRound className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function MutedValue({ value }: { value?: string }) {
  const localize = useLocalize();
  return value ? (
    <span>{value}</span>
  ) : (
    <span className="text-text-tertiary">{localize('com_ui_unknown')}</span>
  );
}

export function AdminUsersPage() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const deferredSearch = useDeferredValue(search);
  const trimmedSearch = deferredSearch.trim();
  const searching = trimmedSearch.length >= 2;

  const listQuery = useAdminUsers(
    { limit: PAGE_SIZE, offset },
    {
      enabled: user?.role === SystemRoles.ADMIN && !searching,
    },
  );
  const searchQuery = useAdminUserSearch(
    { q: trimmedSearch, limit: PAGE_SIZE },
    {
      enabled: user?.role === SystemRoles.ADMIN && searching,
    },
  );

  const listUsers = listQuery.data?.users ?? [];
  const searchUsers = useMemo(
    () => searchQuery.data?.users.map(mapSearchUser) ?? [],
    [searchQuery.data?.users],
  );
  const users: DisplayUser[] = searching ? searchUsers : listUsers;
  const total = searching ? (searchQuery.data?.total ?? users.length) : (listQuery.data?.total ?? 0);
  const isLoading = searching ? searchQuery.isLoading : listQuery.isLoading;
  const isError = searching ? searchQuery.isError : listQuery.isError;
  const refetch = searching ? searchQuery.refetch : listQuery.refetch;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const canGoPrevious = !searching && offset > 0;
  const canGoNext = !searching && offset + PAGE_SIZE < total;

  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-auto bg-surface-primary text-text-primary">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-6 lg:py-8">
          <div className="rounded-lg border border-border-medium py-16 text-center text-sm text-text-secondary">
            {localize('com_ui_admin_people_permission')}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-auto bg-surface-primary text-text-primary">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-6 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {isSmallScreen ? <OpenSidebar /> : null}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                {localize('com_ui_admin_people_title')}
              </h1>
              {!searching && total > 0 ? (
                <p className="mt-1 text-sm text-text-secondary">
                  {localize('com_ui_admin_people_total', { 0: String(total) })}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <label className="relative min-w-0">
          <span className="sr-only">{localize('com_ui_admin_people_search')}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <Input
            role="searchbox"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            placeholder={localize('com_ui_admin_people_search_hint')}
            aria-label={localize('com_ui_admin_people_search')}
            className="border-border-medium bg-surface-secondary pl-9 text-text-primary placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring-primary"
          />
        </label>

        {isLoading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Spinner className="text-text-primary" />
          </div>
        ) : isError ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-border-medium text-sm text-text-secondary">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <p>{localize('com_ui_admin_people_load_error')}</p>
            <button
              type="button"
              className="rounded-lg border border-border-medium px-3 py-2 text-text-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
              onClick={() => refetch()}
            >
              {localize('com_ui_retry')}
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-border-medium bg-transparent py-16 text-center text-sm text-text-secondary">
            {searching
              ? localize('com_ui_admin_people_search_empty')
              : localize('com_ui_admin_people_empty')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border-medium">
            <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(90px,0.6fr)_minmax(90px,0.6fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)] gap-3 border-b border-border-light bg-surface-secondary px-4 py-3 text-xs font-medium uppercase text-text-secondary md:grid">
              <span>{localize('com_ui_admin_people_user')}</span>
              <span>{localize('com_ui_admin_people_username')}</span>
              <span>{localize('com_ui_admin_people_role')}</span>
              <span>{localize('com_ui_admin_people_provider')}</span>
              <span>{localize('com_ui_admin_people_created')}</span>
              <span>{localize('com_ui_admin_people_updated')}</span>
            </div>
            <div className="divide-y divide-border-light">
              {users.map((item) => {
                const created = formatDate(item.createdAt);
                const updated = formatDate(item.updatedAt);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'grid gap-3 px-4 py-4 text-sm',
                      'md:grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(90px,0.6fr)_minmax(90px,0.6fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)]',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={item} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-text-primary">
                          {item.name || item.email || item.id}
                        </div>
                        <div className="truncate text-text-secondary">{item.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center text-text-secondary">
                      <MutedValue value={item.username} />
                    </div>
                    <div className="flex items-center text-text-secondary">
                      <MutedValue value={item.role} />
                    </div>
                    <div className="flex items-center text-text-secondary">
                      <MutedValue value={item.provider} />
                    </div>
                    <div className="flex items-center text-text-secondary">
                      <MutedValue value={created} />
                    </div>
                    <div className="flex items-center text-text-secondary">
                      <MutedValue value={updated} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!searching && !isLoading && !isError && total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
            <span>
              {localize('com_ui_admin_people_page_status', {
                0: String(pageStart),
                1: String(pageEnd),
                2: String(total),
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canGoPrevious}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border-medium px-3 text-text-primary disabled:cursor-not-allowed disabled:opacity-50 hover:not(:disabled):bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {localize('com_ui_admin_people_previous')}
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border-medium px-3 text-text-primary disabled:cursor-not-allowed disabled:opacity-50 hover:not(:disabled):bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
              >
                {localize('com_ui_admin_people_next')}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default AdminUsersPage;
```

Create `client/src/components/Admin/index.ts`:

```ts
export { default as AdminUsersPage } from './Users';
```

- [ ] **Step 5: Run page tests**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/client
npx jest src/components/Admin/Users.spec.tsx --runInBand
```

Expected: PASS. `com_ui_retry` and `com_ui_unknown` already exist in `client/src/locales/en/translation.json`; do not duplicate those keys.

- [ ] **Step 6: Commit Task 3**

```bash
git add client/src/components/Admin client/src/locales/en/translation.json
git commit -m "feat: add admin people page"
```

---

### Task 4: Route and Navigation Entry

**Files:**
- Modify: `client/src/routes/index.tsx`
- Modify: `client/src/hooks/Nav/useSideNavLinks.ts`
- Test: `client/src/routes/__tests__/adminUsersRoute.spec.tsx`
- Test: `client/src/hooks/Nav/useSideNavLinks.admin.spec.tsx`

**Interfaces:**
- Consumes from Task 3:
  - `AdminUsersPage` via lazy import from `~/components/Admin`.
- Produces:
  - `/admin/users` authenticated route.
  - Admin-only sidebar link `{ id: 'admin-users', title: 'com_ui_admin_people', activePath: '/admin/users' }`.

- [ ] **Step 1: Write failing route test**

Create `client/src/routes/__tests__/adminUsersRoute.spec.tsx`:

```tsx
import React from 'react';

jest.mock('../RouteErrorBoundary', () => () => null);
jest.mock('../Layouts/Startup', () => () => null);
jest.mock('../Layouts/Login', () => () => null);
jest.mock('../ShareRoute', () => () => null);
jest.mock('../ChatRoute', () => () => null);
jest.mock('../Search', () => () => null);
jest.mock('../Root', () => () => null);
jest.mock('~/components/Auth', () => ({
  Login: () => null,
  VerifyEmail: () => null,
  Registration: () => null,
  ResetPassword: () => null,
  ApiErrorWatcher: () => null,
  TwoFactorScreen: () => null,
  DingTalkOAuthBridge: () => null,
  RequestPasswordReset: () => null,
}));
jest.mock('~/components/Agents/MarketplaceContext', () => ({
  MarketplaceProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('~/components/Agents/Marketplace', () => () => null);
jest.mock('~/components/OAuth', () => ({ OAuthSuccess: () => null, OAuthError: () => null }));
jest.mock('~/hooks/AuthContext', () => ({ AuthContextProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('~/lib/rum/WithRum', () => ({ children }: { children: React.ReactNode }) => children);

import { router } from '../index';

type RouteNode = {
  path?: string;
  children?: RouteNode[];
};

function flattenPaths(routes: RouteNode[]): string[] {
  return routes.flatMap((route) => [
    route.path ?? '',
    ...(route.children ? flattenPaths(route.children) : []),
  ]);
}

describe('admin users route', () => {
  it('registers /admin/users', () => {
    const paths = flattenPaths((router as unknown as { routes: RouteNode[] }).routes);
    expect(paths).toContain('admin/users');
  });
});
```

- [ ] **Step 2: Write failing navigation hook test**

Create `client/src/hooks/Nav/useSideNavLinks.admin.spec.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import useSideNavLinks from './useSideNavLinks';
import { useAuthContext } from '~/hooks';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    isParamEndpoint: () => false,
    isAgentsEndpoint: () => false,
    isAssistantsEndpoint: () => false,
  };
});

jest.mock('~/hooks', () => ({
  useAgentCapabilities: () => ({ skillsEnabled: false }),
  useMCPServerManager: () => ({ availableMCPServers: [] }),
  useGetAgentsConfig: () => ({ agentsConfig: undefined }),
  useHasAccess: () => false,
  useAuthContext: jest.fn(),
}));

jest.mock('~/components/SidePanel/MCPBuilder/MCPBuilderPanel', () => () => null);
jest.mock('~/components/SidePanel/Agents/AgentPanelSwitch', () => () => null);
jest.mock('~/components/SidePanel/Builder/PanelSwitch', () => () => null);
jest.mock('~/components/SidePanel/Parameters/Panel', () => () => null);
jest.mock('~/components/SidePanel/Memories', () => ({ MemoryPanel: () => null }));
jest.mock('~/components/SidePanel/Files/Panel', () => () => null);
jest.mock('~/components/Skills', () => ({ SkillsAccordion: () => null }));

const baseArgs = {
  keyProvided: true,
  interfaceConfig: {},
  endpointsConfig: {},
  includeHidePanel: false,
};

describe('useSideNavLinks admin people link', () => {
  it('shows people link for admins', () => {
    (useAuthContext as jest.Mock).mockReturnValue({ user: { role: SystemRoles.ADMIN } });

    const { result } = renderHook(() => useSideNavLinks(baseArgs));

    expect(result.current.some((link) => link.id === 'admin-users')).toBe(true);
  });

  it('hides people link for non-admins', () => {
    (useAuthContext as jest.Mock).mockReturnValue({ user: { role: 'USER' } });

    const { result } = renderHook(() => useSideNavLinks(baseArgs));

    expect(result.current.some((link) => link.id === 'admin-users')).toBe(false);
  });
});
```

- [ ] **Step 3: Run failing route and nav tests**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/client
npx jest src/routes/__tests__/adminUsersRoute.spec.tsx src/hooks/Nav/useSideNavLinks.admin.spec.tsx --runInBand
```

Expected: FAIL because route and navigation entry do not exist.

- [ ] **Step 4: Add lazy route**

Modify `client/src/routes/index.tsx`.

Add loader near the other lazy loaders:

```tsx
const loadAdminUsersPage = () =>
  import('~/components/Admin').then((m) => ({
    Component: m.AdminUsersPage,
  }));
```

Add route under the authenticated `Root` children:

```tsx
{
  path: 'admin/users',
  lazy: loadAdminUsersPage,
},
```

- [ ] **Step 5: Add sidebar navigation entry**

Modify `client/src/hooks/Nav/useSideNavLinks.ts`.

Add imports:

```ts
import { UsersRound } from 'lucide-react';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';
```

If `lucide-react` and `librechat-data-provider` imports already exist, merge `UsersRound` and `SystemRoles` into existing import declarations.

Inside the hook, add:

```ts
const { user } = useAuthContext();
```

Add this link before the files link:

```ts
if (user?.role === SystemRoles.ADMIN) {
  links.push({
    title: 'com_ui_admin_people',
    label: '',
    icon: UsersRound,
    id: 'admin-users',
    activePath: '/admin/users',
    onClick: () => navigate('/admin/users'),
  });
}
```

Add `user?.role` to the `useMemo` dependency list.

- [ ] **Step 6: Run route and nav tests**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/client
npx jest src/routes/__tests__/adminUsersRoute.spec.tsx src/hooks/Nav/useSideNavLinks.admin.spec.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add client/src/routes/index.tsx client/src/hooks/Nav/useSideNavLinks.ts client/src/routes/__tests__/adminUsersRoute.spec.tsx client/src/hooks/Nav/useSideNavLinks.admin.spec.tsx
git commit -m "feat: link admin people directory"
```

---

### Task 5: Integration Verification and Polish

**Files:**
- Modify only files from Tasks 1-4 if verification exposes issues.

**Interfaces:**
- Consumes all previous task outputs.
- Produces a verified admin people directory.

- [ ] **Step 1: Run targeted test suite**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw/packages/data-provider
npx jest src/admin-users.spec.ts --runInBand
cd /Users/maurice/Desktop/ZITOO/TCraw/client
npx jest src/data-provider/Admin/queries.spec.tsx src/components/Admin/Users.spec.tsx src/routes/__tests__/adminUsersRoute.spec.tsx src/hooks/Nav/useSideNavLinks.admin.spec.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run data-provider build**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw
npm run build:data-provider
```

Expected: PASS.

- [ ] **Step 3: Run focused frontend build check**

Run the repo's normal frontend validation:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw
npm run frontend
```

Expected: PASS. If this command fails due to unrelated existing errors, record the exact unrelated failure and keep the targeted Jest plus `npm run build:data-provider` results as the verification for this feature.

- [ ] **Step 4: Manual local smoke check**

Start the app if not already running:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw
npm run frontend:dev
```

Expected: frontend is available on `http://localhost:3090/`.

In a logged-in admin session:

- Open `/admin/users`.
- Confirm the People navigation item appears.
- Confirm the list loads.
- Type one search character and confirm no search error appears.
- Type two search characters and confirm search results or empty state appears.
- Clear search and confirm the paged list returns.

- [ ] **Step 5: Final status**

Run:

```bash
cd /Users/maurice/Desktop/ZITOO/TCraw
git status --short
```

Expected: only unrelated pre-existing files remain modified, or the working tree is clean for files touched by this plan.

If any verification-only fixes were needed, commit the exact touched files:

```bash
git add packages/data-provider/src/api-endpoints.ts packages/data-provider/src/data-service.ts packages/data-provider/src/types/queries.ts packages/data-provider/src/keys.ts packages/data-provider/src/admin-users.spec.ts client/src/data-provider/Admin client/src/data-provider/index.ts client/src/components/Admin client/src/locales/en/translation.json client/src/routes/index.tsx client/src/hooks/Nav/useSideNavLinks.ts client/src/routes/__tests__/adminUsersRoute.spec.tsx client/src/hooks/Nav/useSideNavLinks.admin.spec.tsx
git commit -m "fix: verify admin people directory"
```
