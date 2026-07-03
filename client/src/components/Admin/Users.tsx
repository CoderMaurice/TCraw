import { useDeferredValue, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Search, UserRound } from 'lucide-react';
import { Input, Spinner, useMediaQuery } from '@librechat/client';
import type { AdminUserListItem, AdminUserSearchResult } from 'librechat-data-provider';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import { useAdminUserSearch, useAdminUsers } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import { getResponseStatus } from '~/utils/errors';

const PAGE_SIZE = 25;

type DisplayUser = AdminUserListItem & {
  avatarUrl?: string;
};

type Localize = ReturnType<typeof useLocalize>;

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

function Value({ value, localize }: { value?: string; localize: Localize }) {
  return <span>{value?.trim() ? value : localize('com_ui_unknown')}</span>;
}

function DetailValue({
  label,
  value,
  localize,
}: {
  label: string;
  value?: string;
  localize: Localize;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 md:flex-row md:items-center">
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary md:hidden">
        {label}
      </span>
      <div className="min-w-0 text-text-secondary">
        <Value value={value} localize={localize} />
      </div>
    </div>
  );
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

export function AdminUsersPage() {
  const localize = useLocalize();
  const { isAuthenticated } = useAuthContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const deferredSearch = useDeferredValue(search);
  const trimmedSearch = deferredSearch.trim();
  const searching = trimmedSearch.length >= 2;

  const listQuery = useAdminUsers(
    { limit: PAGE_SIZE, offset },
    {
      enabled: isAuthenticated && !searching,
    },
  );

  const searchQuery = useAdminUserSearch(
    { q: trimmedSearch, limit: PAGE_SIZE },
    {
      enabled: isAuthenticated && searching,
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
  const activeError = searching ? searchQuery.error : listQuery.error;
  const isPermissionError = [401, 403].includes(getResponseStatus(activeError) ?? -1);
  const refetch = searching ? searchQuery.refetch : listQuery.refetch;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const canGoPrevious = !searching && offset > 0;
  const canGoNext = !searching && offset + PAGE_SIZE < total;

  if (!isAuthenticated) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-auto bg-surface-primary text-text-primary">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-6 lg:py-8">
          <div className="flex min-h-52 items-center justify-center">
            <Spinner className="text-text-primary" />
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
          isPermissionError ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-border-medium text-sm text-text-secondary">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
              <p>{localize('com_ui_admin_people_permission')}</p>
            </div>
          ) : (
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
          )
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
                    className="grid gap-3 px-4 py-4 text-sm md:items-center md:grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(90px,0.6fr)_minmax(90px,0.6fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)]"
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
                    <DetailValue
                      label={localize('com_ui_admin_people_username')}
                      value={item.username}
                      localize={localize}
                    />
                    <DetailValue
                      label={localize('com_ui_admin_people_role')}
                      value={item.role}
                      localize={localize}
                    />
                    <DetailValue
                      label={localize('com_ui_admin_people_provider')}
                      value={item.provider}
                      localize={localize}
                    />
                    <DetailValue
                      label={localize('com_ui_admin_people_created')}
                      value={created}
                      localize={localize}
                    />
                    <DetailValue
                      label={localize('com_ui_admin_people_updated')}
                      value={updated}
                      localize={localize}
                    />
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
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border-medium px-3 text-text-primary hover:not(:disabled):bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {localize('com_ui_admin_people_previous')}
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border-medium px-3 text-text-primary hover:not(:disabled):bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
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
