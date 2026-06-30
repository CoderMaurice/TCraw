// file deepcode ignore NoRateLimitingForLogin: Rate limiting is handled by the `loginLimiter` middleware
const express = require('express');
const undici = require('undici');
const passport = require('passport');
const { randomState } = require('openid-client');
const { logger } = require('@librechat/data-schemas');
const { ErrorTypes } = require('librechat-data-provider');
const {
  buildOAuthFailureLog,
  buildDingTalkAuthorizationUrl,
  createOpenIDCallbackAuthenticator,
  createSetBalanceConfig,
  exchangeDingTalkAuthCode,
  fetchDingTalkUserProfile,
  getOAuthFailureMessage,
  normalizeDingTalkProfile,
  redirectToAuthFailure,
} = require('@librechat/api');
const { checkDomainAllowed, loginLimiter, logHeaders } = require('~/server/middleware');
const { createOAuthHandler } = require('~/server/controllers/auth/oauth');
const { createUser, findBalanceByUser, findUser, getUserById, upsertBalanceFields } = require('~/models');
const { getAppConfig } = require('~/server/services/Config');

const setBalanceConfig = createSetBalanceConfig({
  getAppConfig,
  findBalanceByUser,
  upsertBalanceFields,
});

const router = express.Router();

const domains = {
  client: process.env.DOMAIN_CLIENT,
  server: process.env.DOMAIN_SERVER,
};

const authFailureRedirectOptions = {
  clientDomain: domains.client,
  authFailedError: ErrorTypes.AUTH_FAILED,
};

router.use(logHeaders);
router.use(loginLimiter);

const oauthHandler = createOAuthHandler();
const authenticateOpenIDCallback = createOpenIDCallbackAuthenticator({
  passport,
  logger,
  ...authFailureRedirectOptions,
});

function getDingTalkConfig() {
  return {
    clientId: process.env.DINGTALK_CLIENT_ID,
    clientSecret: process.env.DINGTALK_CLIENT_SECRET,
    corpId: process.env.DINGTALK_CORP_ID,
    callbackUrl: process.env.DINGTALK_CALLBACK_URL,
  };
}

function getDingTalkCallbackUrl(callbackUrl) {
  if (!callbackUrl) {
    return `${domains.server}/oauth/dingtalk/callback`;
  }
  if (/^https?:\/\//i.test(callbackUrl)) {
    return callbackUrl;
  }
  return `${domains.server}${callbackUrl.startsWith('/') ? callbackUrl : `/${callbackUrl}`}`;
}

function redirectDingTalkFailure(res, err) {
  logger.error('[DingTalk OAuth] Authentication failed', err);
  redirectToAuthFailure(res, authFailureRedirectOptions);
}

router.get('/error', (req, res) => {
  /** A single error message is pushed by passport when authentication fails. */
  const errorMessage = getOAuthFailureMessage(req);
  logger.warn(
    '[OAuth] Authentication failed',
    buildOAuthFailureLog({
      provider: 'unknown',
      req,
      info: { message: errorMessage },
      defaultMessage: errorMessage,
    }),
  );

  redirectToAuthFailure(res, authFailureRedirectOptions);
});

/**
 * Google Routes
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['openid', 'profile', 'email'],
    session: false,
  }),
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['openid', 'profile', 'email'],
  }),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);

/**
 * Facebook Routes
 */
router.get(
  '/facebook',
  passport.authenticate('facebook', {
    scope: ['public_profile'],
    profileFields: ['id', 'email', 'name'],
    session: false,
  }),
);

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['public_profile'],
    profileFields: ['id', 'email', 'name'],
  }),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);

/**
 * OpenID Routes
 */
router.get('/openid', (req, res, next) => {
  return passport.authenticate('openid', {
    session: false,
    state: randomState(),
  })(req, res, next);
});

router.get(
  '/openid/callback',
  authenticateOpenIDCallback,
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);

/**
 * DingTalk Routes
 */
router.get('/dingtalk', (req, res) => {
  const { clientId, clientSecret, corpId, callbackUrl } = getDingTalkConfig();
  if (!clientId || !clientSecret) {
    return redirectDingTalkFailure(res, new Error('DingTalk OAuth is not configured'));
  }

  const state = randomState();
  if (req.session) {
    req.session.dingtalkOAuthState = state;
  }

  const url = buildDingTalkAuthorizationUrl({
    clientId,
    redirectUri: getDingTalkCallbackUrl(callbackUrl),
    state,
    corpId,
  });
  return res.redirect(url.toString());
});

router.get('/dingtalk/callback', async (req, res, next) => {
  const { clientId, clientSecret } = getDingTalkConfig();
  const authCode = req.query.authCode || req.query.code;
  try {
    if (!clientId || !clientSecret) {
      throw new Error('DingTalk OAuth is not configured');
    }
    if (typeof authCode !== 'string' || !authCode) {
      throw new Error('DingTalk callback is missing authCode');
    }
    if (
      req.session?.dingtalkOAuthState &&
      req.query.state &&
      req.query.state !== req.session.dingtalkOAuthState
    ) {
      throw new Error('DingTalk callback state does not match');
    }

    const token = await exchangeDingTalkAuthCode({
      clientId,
      clientSecret,
      authCode,
      fetch: undici.fetch,
    });
    const rawProfile = await fetchDingTalkUserProfile({
      accessToken: token.accessToken,
      fetch: undici.fetch,
    });
    const profile = normalizeDingTalkProfile(rawProfile);

    let user = await findUser({ dingtalkId: profile.id });
    if (!user) {
      const userId = await createUser({
        email: profile.email,
        emailVerified: true,
        provider: 'dingtalk',
        dingtalkId: profile.id,
        username: profile.username,
        name: profile.name,
        avatar: profile.avatarUrl,
      });
      user = await getUserById(userId.toString());
    }

    req.user = user;
    return next();
  } catch (err) {
    return redirectDingTalkFailure(res, err);
  }
}, setBalanceConfig, checkDomainAllowed, oauthHandler);

/**
 * GitHub Routes
 */
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email', 'read:user'],
    session: false,
  }),
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['user:email', 'read:user'],
  }),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);

/**
 * Discord Routes
 */
router.get(
  '/discord',
  passport.authenticate('discord', {
    scope: ['identify', 'email'],
    session: false,
  }),
);

router.get(
  '/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['identify', 'email'],
  }),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);

/**
 * Apple Routes
 */
router.get(
  '/apple',
  passport.authenticate('apple', {
    session: false,
  }),
);

router.post(
  '/apple/callback',
  passport.authenticate('apple', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
  }),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);

/**
 * SAML Routes
 */
router.get(
  '/saml',
  passport.authenticate('saml', {
    session: false,
  }),
);

router.post(
  '/saml/callback',
  passport.authenticate('saml', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
  }),
  oauthHandler,
);

module.exports = router;
