import { getAccountDisplayName } from './accountDisplayName';

describe('getAccountDisplayName', () => {
  it('prefers the DingTalk display name over the synthetic email', () => {
    expect(
      getAccountDisplayName(
        {
          name: '马建宁',
          username: 'majianning',
          email: 'majianning@zitoo.com.cn',
        },
        'User',
      ),
    ).toBe('马建宁');
  });

  it('falls back to username, email, then fallback label', () => {
    expect(
      getAccountDisplayName({ username: 'majianning', email: 'majianning@zitoo.com.cn' }, 'User'),
    ).toBe('majianning');
    expect(getAccountDisplayName({ email: 'majianning@zitoo.com.cn' }, 'User')).toBe(
      'majianning@zitoo.com.cn',
    );
    expect(getAccountDisplayName(undefined, 'User')).toBe('User');
  });
});
