import { createHash } from 'crypto';

const DINGTALK_AUTHORIZATION_URL = 'https://login.dingtalk.com/oauth2/auth';
const DINGTALK_USER_ACCESS_TOKEN_URL = 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken';
const DINGTALK_USER_PROFILE_URL = 'https://api.dingtalk.com/v1.0/contact/users/me';

type FetchResponse<T> = {
  ok: boolean;
  status?: number;
  statusText?: string;
  json: () => Promise<T>;
};

type FetchLike = <T = unknown>(
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponse<T>>;

export type DingTalkAuthorizationParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  corpId?: string;
};

export type DingTalkRawProfile = {
  unionId?: string;
  openId?: string;
  userId?: string;
  nick?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
};

export type DingTalkProfile = {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl?: string;
};

export type DingTalkUserAccessToken = {
  accessToken: string;
  refreshToken?: string;
  expireIn?: number;
};

export type DingTalkAuthCodeExchangeParams = {
  clientId: string;
  clientSecret: string;
  authCode: string;
  fetch: FetchLike;
};

export type DingTalkUserProfileParams = {
  accessToken: string;
  fetch: FetchLike;
};

export function buildDingTalkAuthorizationUrl({
  clientId,
  redirectUri,
  state,
  corpId,
}: DingTalkAuthorizationParams): URL {
  const url = new URL(DINGTALK_AUTHORIZATION_URL);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', 'openid');
  url.searchParams.set('state', state);
  if (corpId) {
    url.searchParams.set('corpId', corpId);
  }
  return url;
}

export function createDingTalkSyntheticEmail(id: string): string {
  const hash = createHash('sha256').update(id).digest('hex').slice(0, 32);
  return `dingtalk_${hash}@dingtalk.local`;
}

export function normalizeDingTalkProfile(profile: DingTalkRawProfile): DingTalkProfile {
  const id = profile.unionId ?? profile.openId ?? profile.userId;
  if (!id) {
    throw new Error('DingTalk profile is missing a stable user identifier');
  }

  const name = profile.nick ?? profile.name ?? id;
  return {
    id,
    email: profile.email || createDingTalkSyntheticEmail(id),
    name,
    username: name,
    avatarUrl: profile.avatarUrl,
  };
}

export async function exchangeDingTalkAuthCode({
  clientId,
  clientSecret,
  authCode,
  fetch,
}: DingTalkAuthCodeExchangeParams): Promise<DingTalkUserAccessToken> {
  const response = await fetch<DingTalkUserAccessToken>(DINGTALK_USER_ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientId,
      clientSecret,
      code: authCode,
      grantType: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error(`DingTalk token exchange failed: ${response.status ?? 'unknown'}`);
  }

  const token = await response.json();
  if (!token.accessToken) {
    throw new Error('DingTalk token exchange response is missing accessToken');
  }
  return token;
}

export async function fetchDingTalkUserProfile({
  accessToken,
  fetch,
}: DingTalkUserProfileParams): Promise<DingTalkRawProfile> {
  const response = await fetch<DingTalkRawProfile>(DINGTALK_USER_PROFILE_URL, {
    method: 'GET',
    headers: { 'x-acs-dingtalk-access-token': accessToken },
  });

  if (!response.ok) {
    throw new Error(`DingTalk user profile request failed: ${response.status ?? 'unknown'}`);
  }

  return await response.json();
}
