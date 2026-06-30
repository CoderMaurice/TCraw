import reactRouter from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { TStartupConfig } from 'librechat-data-provider';
import { act, getByTestId, render, waitFor } from 'test/layout-test-utils';
import * as endpointQueries from '~/data-provider/Endpoints/queries';
import * as miscDataProvider from '~/data-provider/Misc/queries';
import * as authMutations from '~/data-provider/Auth/mutations';
import * as authQueries from '~/data-provider/Auth/queries';
import AuthLayout from '~/components/Auth/AuthLayout';
import Login from '~/components/Auth/Login';

jest.mock('librechat-data-provider/react-query');

const mockStartupConfig = {
  isFetching: false,
  isLoading: false,
  isError: false,
  data: {
    socialLogins: ['google', 'facebook', 'openid', 'github', 'discord', 'saml'],
    dingtalkLoginEnabled: true,
    dingtalkClientId: 'ding-client',
    discordLoginEnabled: true,
    facebookLoginEnabled: true,
    githubLoginEnabled: true,
    googleLoginEnabled: true,
    openidLoginEnabled: true,
    openidLabel: 'Test OpenID',
    openidImageUrl: 'http://test-server.com',
    samlLoginEnabled: true,
    samlLabel: 'Test SAML',
    samlImageUrl: 'http://test-server.com',
    ldap: {
      enabled: false,
    },
    registrationEnabled: true,
    emailLoginEnabled: true,
    socialLoginEnabled: true,
    serverDomain: 'mock-server',
  },
};

const setup = ({
  useGetUserQueryReturnValue = {
    isLoading: false,
    isError: false,
    data: {},
  },
  useLoginUserReturnValue = {
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
    data: {},
    isSuccess: false,
  },
  useRefreshTokenMutationReturnValue = {
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
    data: {
      token: 'mock-token',
      user: {},
    },
  },
  useGetStartupConfigReturnValue = mockStartupConfig,
  useGetBannerQueryReturnValue = {
    isLoading: false,
    isError: false,
    data: {},
  },
} = {}) => {
  const mockUseLoginUser = jest
    .spyOn(authMutations, 'useLoginUserMutation')
    //@ts-ignore - we don't need all parameters of the QueryObserverSuccessResult
    .mockReturnValue(useLoginUserReturnValue);
  const mockUseGetUserQuery = jest
    .spyOn(authQueries, 'useGetUserQuery')
    //@ts-ignore - we don't need all parameters of the QueryObserverSuccessResult
    .mockReturnValue(useGetUserQueryReturnValue);
  const mockUseGetStartupConfig = jest
    .spyOn(endpointQueries, 'useGetStartupConfig')
    //@ts-ignore - we don't need all parameters of the QueryObserverSuccessResult
    .mockReturnValue(useGetStartupConfigReturnValue);
  const mockUseRefreshTokenMutation = jest
    .spyOn(authMutations, 'useRefreshTokenMutation')
    //@ts-ignore - we don't need all parameters of the QueryObserverSuccessResult
    .mockReturnValue(useRefreshTokenMutationReturnValue);
  const mockUseGetBannerQuery = jest
    .spyOn(miscDataProvider, 'useGetBannerQuery')
    //@ts-ignore - we don't need all parameters of the QueryObserverSuccessResult
    .mockReturnValue(useGetBannerQueryReturnValue);
  const mockUseOutletContext = jest.spyOn(reactRouter, 'useOutletContext').mockReturnValue({
    startupConfig: useGetStartupConfigReturnValue.data,
  });
  const renderResult = render(
    <AuthLayout
      startupConfig={useGetStartupConfigReturnValue.data as TStartupConfig}
      isFetching={useGetStartupConfigReturnValue.isFetching}
      error={null}
      startupConfigError={null}
      header={'Welcome back'}
      pathname="login"
    >
      <Login />
    </AuthLayout>,
  );
  return {
    ...renderResult,
    mockUseLoginUser,
    mockUseGetUserQuery,
    mockUseOutletContext,
    mockUseGetStartupConfig,
    mockUseRefreshTokenMutation,
    mockUseGetBannerQuery,
  };
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useOutletContext: () => ({
    startupConfig: mockStartupConfig,
  }),
}));

beforeEach(() => {
  window.DTFrameLogin = jest.fn();
});

afterEach(() => {
  delete window.DTFrameLogin;
});

test('renders DingTalk login by default and keeps email login behind an admin entry', async () => {
  const dingtalkFrameLogin = window.DTFrameLogin as jest.Mock;
  const {
    getByLabelText,
    getByRole,
    getByTestId: getRenderedByTestId,
    queryByLabelText,
    queryByRole,
  } = setup({
    useGetStartupConfigReturnValue: {
      ...mockStartupConfig,
      data: {
        ...mockStartupConfig.data,
        socialLogins: ['dingtalk'],
      },
    },
  });
  expect(getRenderedByTestId('dingtalk-frame-login')).toBeInTheDocument();
  expect(getByRole('heading', { name: /钉钉扫码登录/i })).toBeInTheDocument();
  expect(queryByRole('link', { name: /钉钉扫码登录/i })).not.toBeInTheDocument();
  await waitFor(() => expect(dingtalkFrameLogin).toHaveBeenCalled());
  expect(dingtalkFrameLogin).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.stringMatching(/^dingtalk-frame-login-/) }),
    expect.objectContaining({
      client_id: 'ding-client',
      response_type: 'code',
      scope: 'openid',
    }),
    expect.any(Function),
    expect.any(Function),
  );
  expect(queryByLabelText(/email/i)).not.toBeInTheDocument();
  expect(queryByLabelText(/password/i)).not.toBeInTheDocument();
  expect(queryByRole('button', { name: /Continue/i })).not.toBeInTheDocument();
  expect(queryByRole('link', { name: /Sign up/i })).not.toBeInTheDocument();

  expect(queryByRole('button', { name: /邮箱密码登录/i })).not.toBeInTheDocument();
  await userEvent.click(getByRole('button', { name: /邮箱登录/i }));

  expect(getByLabelText(/email/i)).toBeInTheDocument();
  expect(getByLabelText(/password/i)).toBeInTheDocument();
  expect(getByTestId(document.body, 'login-button')).toBeInTheDocument();
});

test('does not show a load failure when the DingTalk QR code expires', async () => {
  const dingtalkFrameLogin = window.DTFrameLogin as jest.Mock;
  const { queryByText } = setup({
    useGetStartupConfigReturnValue: {
      ...mockStartupConfig,
      data: {
        ...mockStartupConfig.data,
        socialLogins: ['dingtalk'],
      },
    },
  });

  await waitFor(() => expect(dingtalkFrameLogin).toHaveBeenCalled());

  act(() => {
    dingtalkFrameLogin.mock.calls[0][3]('二维码已失效');
  });

  expect(queryByText(/钉钉扫码登录加载失败/i)).not.toBeInTheDocument();
});

test('renders configured social login links', () => {
  const { getByRole } = setup();
  expect(getByRole('link', { name: /Continue with Google/i })).toBeInTheDocument();
  expect(getByRole('link', { name: /Continue with Google/i })).toHaveAttribute(
    'href',
    'mock-server/oauth/google',
  );
  expect(getByRole('link', { name: /Continue with Facebook/i })).toBeInTheDocument();
  expect(getByRole('link', { name: /Continue with Facebook/i })).toHaveAttribute(
    'href',
    'mock-server/oauth/facebook',
  );
  expect(getByRole('link', { name: /Continue with Github/i })).toBeInTheDocument();
  expect(getByRole('link', { name: /Continue with Github/i })).toHaveAttribute(
    'href',
    'mock-server/oauth/github',
  );
  expect(getByRole('link', { name: /Continue with Discord/i })).toBeInTheDocument();
  expect(getByRole('link', { name: /Continue with Discord/i })).toHaveAttribute(
    'href',
    'mock-server/oauth/discord',
  );
  expect(getByRole('link', { name: /Test SAML/i })).toBeInTheDocument();
  expect(getByRole('link', { name: /Test SAML/i })).toHaveAttribute(
    'href',
    'mock-server/oauth/saml',
  );
});

test('calls loginUser.mutate on login', async () => {
  const mutate = jest.fn();
  const { getByLabelText, getByRole } = setup({
    // @ts-ignore - we don't need all parameters of the QueryObserverResult
    useLoginUserReturnValue: {
      isLoading: false,
      mutate: mutate,
      isError: false,
    },
  });

  await userEvent.click(getByRole('button', { name: /邮箱登录/i }));

  const emailInput = getByLabelText(/email/i);
  const passwordInput = getByLabelText(/password/i);
  const submitButton = getByTestId(document.body, 'login-button');

  await userEvent.type(emailInput, 'test@test.com');
  await userEvent.type(passwordInput, 'password');
  await userEvent.click(submitButton);

  waitFor(() => expect(mutate).toHaveBeenCalled());
});

test('Navigates to / on successful login', async () => {
  const { getByLabelText, getByRole } = setup({
    // @ts-ignore - we don't need all parameters of the QueryObserverResult
    useLoginUserReturnValue: {
      isLoading: false,
      mutate: jest.fn(),
      isError: false,
      isSuccess: true,
    },
    useGetStartupConfigReturnValue: {
      ...mockStartupConfig,
      data: {
        ...mockStartupConfig.data,
        emailLoginEnabled: true,
        registrationEnabled: true,
      },
    },
  });

  await userEvent.click(getByRole('button', { name: /邮箱登录/i }));

  const emailInput = getByLabelText(/email/i);
  const passwordInput = getByLabelText(/password/i);
  const submitButton = getByTestId(document.body, 'login-button');

  await userEvent.type(emailInput, 'test@test.com');
  await userEvent.type(passwordInput, 'password');
  await userEvent.click(submitButton);

  waitFor(() => expect(window.location.pathname).toBe('/'));
});
