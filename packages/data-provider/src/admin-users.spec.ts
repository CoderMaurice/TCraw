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
