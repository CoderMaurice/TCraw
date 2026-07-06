/**
 * @jest-environment @happy-dom/jest-environment
 */
import React from 'react';

jest.mock('../RouteErrorBoundary', () => () => null);
jest.mock('../Layouts/Startup', () => () => null);
jest.mock('../Layouts/Login', () => () => null);
jest.mock('../ShareRoute', () => () => null);
jest.mock('../ChatRoute', () => () => null);
jest.mock('../Search', () => () => null);
jest.mock('../Root', () => () => null);
jest.mock('../Dashboard', () => ({
  __esModule: true,
  default: { path: 'dashboard', element: null },
}));
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
jest.mock('~/hooks/AuthContext', () => ({
  AuthContextProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('~/lib/rum/WithRum', () => ({ children }: { children: React.ReactNode }) => children);

import { router } from '../index';

type RouteNode = {
  path?: string;
  children?: RouteNode[];
};

function flattenPaths(routes: RouteNode[]): string[] {
  return routes.flatMap((route) => [
    ...(route.path ? [route.path] : []),
    ...(route.children ? flattenPaths(route.children) : []),
  ]);
}

describe('admin users route', () => {
  it('registers /admin/users', () => {
    const paths = flattenPaths((router as unknown as { routes: RouteNode[] }).routes);

    expect(paths).toContain('admin/users');
  });
});
