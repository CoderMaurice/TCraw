# Admin Users Directory Design

## Summary

Add a read-only personnel directory for administrators. The first version gives admins a clear place to view all users, search by identity fields, and page through the existing user list. It does not include destructive or mutating user-management actions.

## Goals

- Add a discoverable admin-only entry for viewing users.
- Reuse the existing admin users API:
  - `GET /api/admin/users`
  - `GET /api/admin/users/search`
- Show useful user fields for operational review: avatar, name, email, username, role, provider, created time, and updated time where available.
- Preserve backend authorization through the existing `ACCESS_ADMIN` and `READ_USERS` capability checks.
- Keep the UI ready for future admin actions without adding those actions now.

## Non-Goals

- Do not add delete, disable, role editing, impersonation, or bulk actions.
- Do not change the existing admin capability model.
- Do not replace the People Picker permission UI; this is a separate personnel viewing surface.
- Do not change user schema fields or backend list semantics unless a bug is found while wiring the UI.

## Recommended Approach

Create an independent admin users page at `/admin/users` and add a visible navigation entry for admins. This is preferable to placing the feature inside the personal settings dialog because personnel review is a workspace-level admin task and needs more room than a modal. It also gives future admin features a natural route family.

## Architecture

### Backend

The backend already exposes the required endpoints in `api/server/routes/admin/users.js`, backed by `packages/api/src/admin/users.ts`.

No new backend behavior is required for the first version. The UI will consume:

- `GET /api/admin/users?limit=<n>&offset=<n>` for paged list data.
- `GET /api/admin/users/search?q=<query>&limit=<n>` for search results.

The route remains protected by:

- JWT authentication.
- `ACCESS_ADMIN` capability.
- `READ_USERS` capability for read endpoints.

### Shared Data Provider

Add admin user endpoint helpers and service functions in `packages/data-provider`:

- `adminUsers()`
- `adminUsersSearch()`
- `listAdminUsers({ limit, offset })`
- `searchAdminUsers({ q, limit })`

Reuse `AdminUserListItem` and `AdminUserSearchResult` from `@librechat/data-schemas` through the package's exported type surface, or add explicit provider response types if the current exports do not surface them cleanly.

Add query keys for:

- `adminUsers`
- `adminUserSearch`

### Client Data Hooks

Add a small `client/src/data-provider/Admin` module with React Query hooks:

- `useAdminUsers({ limit, offset })`
- `useAdminUserSearch({ q, limit })`

The list query is enabled when no search query is active. The search query is enabled when the trimmed search input has at least two characters, matching backend validation.

### Client Route

Add a lazy-loaded route:

- `/admin/users`

The page component performs a lightweight client-side admin check using the authenticated user context. Backend authorization remains authoritative. If a non-admin reaches the route, the page shows a permission state instead of the table.

### Navigation

Add an admin-only "Users" or "People" entry to the existing sidebar navigation. The entry appears only when the current user role is admin. It navigates to `/admin/users`.

The first version can use the role check already used by existing admin settings buttons. If capability-aware client access helpers are already available for system admin grants, prefer those so users with `ACCESS_ADMIN` and `READ_USERS` grants are handled consistently.

## UI Design

The page is an operational admin view, not a marketing page.

Layout:

- Header with localized title and a compact total count when available.
- Search input with clear action.
- Table on desktop.
- Compact stacked rows on narrow screens.
- Pagination controls for the default list.

Columns:

- User: avatar, display name, email.
- Username.
- Role.
- Provider.
- Created.
- Updated.

States:

- Loading skeleton or simple loading row.
- Empty list.
- Empty search result.
- Backend validation for short search query is avoided by disabling search until two characters.
- Permission denied.
- Request failure with retry.

Localization:

- Add English keys in `client/src/locales/en/translation.json`.
- Add Simplified Chinese keys only if the local branch already has hand-maintained Chinese changes for this product. Otherwise follow the project rule that non-English locales are automated externally.

## Data Flow

1. Admin opens `/admin/users`.
2. Page requests `listAdminUsers({ limit, offset })`.
3. API returns `{ users, total, limit, offset }`.
4. User enters at least two search characters.
5. Page switches to `searchAdminUsers({ q, limit })`.
6. Clearing search returns to the paged list and keeps the previous offset unless the UI intentionally resets to the first page.

For first version, search results are capped by the backend and do not use pagination.

## Error Handling

- HTTP 401 or 403: show a permission message.
- HTTP 400 from search: keep UI validation aligned so this should rarely appear; if it does, show a generic search error.
- HTTP 500 or network failure: show a retryable loading error.
- Missing optional fields render as muted fallback text, not blank broken cells.

## Testing

Add focused tests for:

- Data-provider endpoint and service URL construction.
- React Query hooks enabling list vs search behavior where local patterns make this practical.
- Admin users page loading, success, empty, search, and error states.
- Route visibility or navigation entry visibility for admin vs non-admin users.

Backend tests already cover handler behavior. Add backend tests only if wiring exposes a gap in response typing or pagination semantics.

## Rollout

This is an additive, admin-only feature. It does not change existing user flows. If the route is not linked for a user, the backend still protects direct access.

## Implementation Decisions

- Label the navigation item and page as "People" in English-facing UI because the feature is a personnel directory, not an account-action surface. Use localization keys so Chinese-facing UI can render the same concept as "人员".
- Use the current client-side admin role pattern for first-version navigation visibility. The backend remains the source of truth through `ACCESS_ADMIN` and `READ_USERS`.
