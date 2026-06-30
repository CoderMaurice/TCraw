import {
  buildDingTalkAuthorizationUrl,
  createDingTalkSyntheticEmail,
  exchangeDingTalkAuthCode,
  fetchDingTalkUserProfile,
  normalizeDingTalkProfile,
} from './dingtalk';

describe('DingTalk auth helpers', () => {
  it('builds the DingTalk OAuth authorization URL with encoded redirect and state', () => {
    const url = buildDingTalkAuthorizationUrl({
      clientId: 'ding-client',
      redirectUri: 'https://server.example.com/oauth/dingtalk/callback',
      state: 'state with spaces',
      corpId: 'ding-corp',
    });

    expect(url.origin).toBe('https://login.dingtalk.com');
    expect(url.pathname).toBe('/oauth2/auth');
    expect(url.searchParams.get('client_id')).toBe('ding-client');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://server.example.com/oauth/dingtalk/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('state')).toBe('state with spaces');
    expect(url.searchParams.get('corpId')).toBe('ding-corp');
  });

  it('creates a stable synthetic email without exposing DingTalk identifiers', () => {
    const email = createDingTalkSyntheticEmail('union-id-123');

    expect(email).toMatch(/^dingtalk_[a-f0-9]{32}@dingtalk\.local$/);
    expect(email).toBe(createDingTalkSyntheticEmail('union-id-123'));
    expect(email).not.toContain('union-id-123');
  });

  it('normalizes DingTalk profile identity with unionId first and a synthetic email fallback', () => {
    const profile = normalizeDingTalkProfile({
      unionId: 'union-id-123',
      openId: 'open-id-456',
      nick: '张三',
      avatarUrl: 'https://example.com/avatar.png',
    });

    expect(profile).toEqual({
      id: 'union-id-123',
      email: createDingTalkSyntheticEmail('union-id-123'),
      name: '张三',
      username: '张三',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('exchanges an auth code for a DingTalk user access token', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: 'user-token',
        refreshToken: 'refresh-token',
        expireIn: 7200,
      }),
    });

    const token = await exchangeDingTalkAuthCode({
      clientId: 'ding-client',
      clientSecret: 'ding-secret',
      authCode: 'auth-code',
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith('https://api.dingtalk.com/v1.0/oauth2/userAccessToken', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'ding-client',
        clientSecret: 'ding-secret',
        code: 'auth-code',
        grantType: 'authorization_code',
      }),
    });
    expect(token).toEqual({
      accessToken: 'user-token',
      refreshToken: 'refresh-token',
      expireIn: 7200,
    });
  });

  it('fetches the current DingTalk user profile with the user access token header', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        unionId: 'union-id-123',
        nick: '张三',
      }),
    });

    const profile = await fetchDingTalkUserProfile({
      accessToken: 'user-token',
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith('https://api.dingtalk.com/v1.0/contact/users/me', {
      method: 'GET',
      headers: { 'x-acs-dingtalk-access-token': 'user-token' },
    });
    expect(profile).toMatchObject({
      unionId: 'union-id-123',
      nick: '张三',
    });
  });
});
