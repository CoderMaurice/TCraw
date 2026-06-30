const express = require('express');
const request = require('supertest');

const originalDomainClient = process.env.DOMAIN_CLIENT;
const originalDomainServer = process.env.DOMAIN_SERVER;
const originalDingTalkClientId = process.env.DINGTALK_CLIENT_ID;
const originalDingTalkClientSecret = process.env.DINGTALK_CLIENT_SECRET;
const originalDingTalkCorpId = process.env.DINGTALK_CORP_ID;
const originalDingTalkCallbackUrl = process.env.DINGTALK_CALLBACK_URL;
process.env.DOMAIN_CLIENT = 'http://client.test';
process.env.DOMAIN_SERVER = 'http://server.test';

const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const mockOAuthHandler = jest.fn((_req, res) => res.status(204).end());
const mockOpenIDCallbackMiddleware = jest.fn((_req, _res, next) => next());
let mockOpenIDCallbackAuthenticatorOptions;
const mockCreateOpenIDCallbackAuthenticator = jest.fn((options) => {
  mockOpenIDCallbackAuthenticatorOptions = options;
  return mockOpenIDCallbackMiddleware;
});
const mockBuildOAuthFailureLog = jest.fn(({ provider, req, err, info, defaultMessage }) => ({
  provider,
  code: err?.code ?? info?.code ?? info?.error ?? req.query?.error,
  name: err?.name ?? info?.name,
  message:
    err?.message ??
    info?.message ??
    info?.error_description ??
    req.query?.error_description ??
    defaultMessage,
  cause_code: err?.cause?.code ?? info?.cause?.code,
  cause_name: err?.cause?.name ?? info?.cause?.name,
  has_code: req.query?.code != null,
  has_state: req.query?.state != null,
  query_error: req.query?.error,
  query_error_description: req.query?.error_description,
  path: req.path,
  forwarded_for: req.headers?.['x-forwarded-for'],
  user_agent: req.headers?.['user-agent'],
}));
const mockGetOAuthFailureMessage = jest.fn(
  (req) =>
    req.session?.messages?.pop() ??
    req.query?.error_description ??
    req.query?.error ??
    'OAuth authentication failed',
);
const mockRedirectToAuthFailure = jest.fn((res, { clientDomain, authFailedError }) =>
  res.redirect(`${clientDomain}/login?redirect=false&error=${authFailedError}`),
);
const mockPassportAuthenticate = jest.fn(() => (_req, _res, next) => next());
const mockBuildDingTalkAuthorizationUrl = jest.fn(
  () => new URL('https://login.dingtalk.com/oauth2/auth?client_id=ding-client'),
);
const mockExchangeDingTalkAuthCode = jest.fn();
const mockFetchDingTalkUserProfile = jest.fn();
const mockNormalizeDingTalkProfile = jest.fn();
const mockFindUser = jest.fn();
const mockCreateUser = jest.fn();
const mockGetUserById = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('passport', () => ({
  authenticate: (...args) => mockPassportAuthenticate(...args),
}));

jest.mock('openid-client', () => ({
  randomState: jest.fn(() => 'random-state'),
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: mockLogger,
}));

jest.mock('librechat-data-provider', () => ({
  ...jest.requireActual('librechat-data-provider'),
  ErrorTypes: {
    AUTH_FAILED: 'auth_failed',
  },
}));

jest.mock('@librechat/api', () => ({
  buildOAuthFailureLog: (...args) => mockBuildOAuthFailureLog(...args),
  buildDingTalkAuthorizationUrl: (...args) => mockBuildDingTalkAuthorizationUrl(...args),
  createOpenIDCallbackAuthenticator: (...args) => mockCreateOpenIDCallbackAuthenticator(...args),
  createSetBalanceConfig: jest.fn(() => (_req, _res, next) => next()),
  exchangeDingTalkAuthCode: (...args) => mockExchangeDingTalkAuthCode(...args),
  fetchDingTalkUserProfile: (...args) => mockFetchDingTalkUserProfile(...args),
  getOAuthFailureMessage: (...args) => mockGetOAuthFailureMessage(...args),
  normalizeDingTalkProfile: (...args) => mockNormalizeDingTalkProfile(...args),
  redirectToAuthFailure: (...args) => mockRedirectToAuthFailure(...args),
}));

jest.mock('~/server/middleware', () => ({
  checkDomainAllowed: jest.fn((_req, _res, next) => next()),
  loginLimiter: jest.fn((_req, _res, next) => next()),
  logHeaders: jest.fn((_req, _res, next) => next()),
}));

jest.mock('~/server/controllers/auth/oauth', () => ({
  createOAuthHandler: jest.fn(() => mockOAuthHandler),
}));

jest.mock('~/models', () => ({
  findBalanceByUser: jest.fn(),
  findUser: (...args) => mockFindUser(...args),
  createUser: (...args) => mockCreateUser(...args),
  getUserById: (...args) => mockGetUserById(...args),
  updateUser: (...args) => mockUpdateUser(...args),
  upsertBalanceFields: jest.fn(),
}));

jest.mock('~/server/services/Config', () => ({
  getAppConfig: jest.fn(),
}));

afterAll(() => {
  if (originalDomainClient === undefined) {
    delete process.env.DOMAIN_CLIENT;
  } else {
    process.env.DOMAIN_CLIENT = originalDomainClient;
  }
  if (originalDomainServer === undefined) {
    delete process.env.DOMAIN_SERVER;
  } else {
    process.env.DOMAIN_SERVER = originalDomainServer;
  }
  if (originalDingTalkClientId === undefined) {
    delete process.env.DINGTALK_CLIENT_ID;
  } else {
    process.env.DINGTALK_CLIENT_ID = originalDingTalkClientId;
  }
  if (originalDingTalkClientSecret === undefined) {
    delete process.env.DINGTALK_CLIENT_SECRET;
  } else {
    process.env.DINGTALK_CLIENT_SECRET = originalDingTalkClientSecret;
  }
  if (originalDingTalkCorpId === undefined) {
    delete process.env.DINGTALK_CORP_ID;
  } else {
    process.env.DINGTALK_CORP_ID = originalDingTalkCorpId;
  }
  if (originalDingTalkCallbackUrl === undefined) {
    delete process.env.DINGTALK_CALLBACK_URL;
  } else {
    process.env.DINGTALK_CALLBACK_URL = originalDingTalkCallbackUrl;
  }
});

function getOAuthRouter() {
  jest.resetModules();
  return require('./oauth');
}

function createApp(sessionMessages) {
  const app = express();
  app.use((req, _res, next) => {
    if (sessionMessages) {
      req.session = { messages: [...sessionMessages] };
    }
    next();
  });
  app.use('/oauth', getOAuthRouter());
  app.use((err, _req, res, _next) => {
    res.status(500).json({ message: err.message });
  });
  return app;
}

describe('OAuth route failure logging', () => {
  beforeEach(() => {
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
    mockOAuthHandler.mockClear();
    mockOpenIDCallbackMiddleware.mockClear();
    mockBuildOAuthFailureLog.mockClear();
    mockGetOAuthFailureMessage.mockClear();
    mockRedirectToAuthFailure.mockClear();
    mockPassportAuthenticate.mockClear();
    mockBuildDingTalkAuthorizationUrl.mockClear();
    mockExchangeDingTalkAuthCode.mockClear();
    mockFetchDingTalkUserProfile.mockClear();
    mockNormalizeDingTalkProfile.mockClear();
    mockFindUser.mockClear();
    mockCreateUser.mockClear();
    mockGetUserById.mockClear();
    mockUpdateUser.mockClear();
    mockOpenIDCallbackAuthenticatorOptions = undefined;
    mockPassportAuthenticate.mockImplementation(() => (_req, _res, next) => next());
    mockOpenIDCallbackMiddleware.mockImplementation((_req, _res, next) => next());
    process.env.DINGTALK_CLIENT_ID = 'ding-client';
    process.env.DINGTALK_CLIENT_SECRET = 'ding-secret';
    process.env.DINGTALK_CORP_ID = 'ding-corp';
    delete process.env.DINGTALK_CALLBACK_URL;
  });

  it('wires the package OpenID callback middleware into the route', async () => {
    const app = createApp();

    await request(app)
      .get('/oauth/openid/callback?code=secret-code&state=secret-state')
      .expect(204);

    expect(mockOpenIDCallbackAuthenticatorOptions).toEqual({
      passport: expect.objectContaining({ authenticate: expect.any(Function) }),
      logger: mockLogger,
      clientDomain: 'http://client.test',
      authFailedError: 'auth_failed',
    });
    expect(mockOpenIDCallbackMiddleware).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Function),
    );
    expect(mockOAuthHandler).toHaveBeenCalled();
  });

  it('logs structured fallback errors without using Unknown OAuth error', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/oauth/error?error=access_denied&error_description=Denied%20by%20provider')
      .set('x-forwarded-for', '203.0.113.10')
      .expect(302);

    expect(response.headers.location).toBe(
      'http://client.test/login?redirect=false&error=auth_failed',
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[OAuth] Authentication failed',
      expect.objectContaining({
        provider: 'unknown',
        code: 'access_denied',
        message: 'Denied by provider',
        query_error: 'access_denied',
        query_error_description: 'Denied by provider',
        has_code: false,
        has_state: false,
        forwarded_for: '203.0.113.10',
      }),
    );
    expect(JSON.stringify(mockLogger.warn.mock.calls[0])).not.toContain('Unknown OAuth error');
  });

  it('redirects DingTalk login requests to DingTalk OAuth with a callback URL', async () => {
    const app = createApp();

    const response = await request(app).get('/oauth/dingtalk').expect(302);

    expect(response.headers.location).toBe(
      'https://login.dingtalk.com/oauth2/auth?client_id=ding-client',
    );
    expect(mockBuildDingTalkAuthorizationUrl).toHaveBeenCalledWith({
      clientId: 'ding-client',
      redirectUri: 'http://server.test/oauth/dingtalk/callback',
      state: 'random-state',
      corpId: 'ding-corp',
    });
  });

  it('uses a configured DingTalk callback URL', async () => {
    process.env.DINGTALK_CALLBACK_URL = 'https://login.example.com/oauth/dingtalk/callback';
    const app = createApp();

    await request(app).get('/oauth/dingtalk').expect(302);

    expect(mockBuildDingTalkAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: 'https://login.example.com/oauth/dingtalk/callback',
      }),
    );
  });

  it('creates a DingTalk user on callback and continues through the OAuth handler', async () => {
    const app = createApp();
    const user = {
      _id: 'user-id',
      email: 'dingtalk_generated@dingtalk.local',
      provider: 'dingtalk',
      dingtalkId: 'union-id-123',
    };
    mockExchangeDingTalkAuthCode.mockResolvedValue({ accessToken: 'user-token' });
    mockFetchDingTalkUserProfile.mockResolvedValue({ unionId: 'union-id-123' });
    mockNormalizeDingTalkProfile.mockReturnValue({
      id: 'union-id-123',
      email: 'dingtalk_generated@dingtalk.local',
      name: '张三',
      username: '张三',
      avatarUrl: 'https://example.com/avatar.png',
    });
    mockFindUser.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue('user-id');
    mockGetUserById.mockResolvedValue(user);

    await request(app).get('/oauth/dingtalk/callback?authCode=auth-code').expect(204);

    expect(mockExchangeDingTalkAuthCode).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'ding-client',
        clientSecret: 'ding-secret',
        authCode: 'auth-code',
      }),
    );
    expect(mockFindUser).toHaveBeenCalledWith({ dingtalkId: 'union-id-123' });
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'dingtalk_generated@dingtalk.local',
      emailVerified: true,
      provider: 'dingtalk',
      dingtalkId: 'union-id-123',
      username: '张三',
      name: '张三',
      avatar: 'https://example.com/avatar.png',
    });
    expect(mockOAuthHandler.mock.calls[0][0].user).toBe(user);
  });

  it('syncs DingTalk display names for existing users before continuing', async () => {
    const app = createApp();
    const existingUser = {
      _id: 'user-id',
      email: 'majianning@zitoo.com.cn',
      provider: 'dingtalk',
      dingtalkId: 'union-id-123',
      name: 'majianning@zitoo.com.cn',
    };
    const updatedUser = {
      ...existingUser,
      name: '马建宁',
      avatar: 'https://example.com/avatar.png',
    };
    mockExchangeDingTalkAuthCode.mockResolvedValue({ accessToken: 'user-token' });
    mockFetchDingTalkUserProfile.mockResolvedValue({ unionId: 'union-id-123' });
    mockNormalizeDingTalkProfile.mockReturnValue({
      id: 'union-id-123',
      email: 'majianning@zitoo.com.cn',
      name: '马建宁',
      username: '马建宁',
      avatarUrl: 'https://example.com/avatar.png',
    });
    mockFindUser.mockResolvedValue(existingUser);
    mockUpdateUser.mockResolvedValue(updatedUser);

    await request(app).get('/oauth/dingtalk/callback?authCode=auth-code').expect(204);

    expect(mockUpdateUser).toHaveBeenCalledWith('user-id', {
      name: '马建宁',
      avatar: 'https://example.com/avatar.png',
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockOAuthHandler.mock.calls[0][0].user).toBe(updatedUser);
  });
});
