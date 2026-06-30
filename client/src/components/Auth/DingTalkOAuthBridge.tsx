import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGetStartupConfig } from '~/data-provider';

export function buildDingTalkBridgeCallbackUrl(searchParams: URLSearchParams, serverDomain: string) {
  const authCode = searchParams.get('authCode') ?? searchParams.get('code');
  if (!authCode) {
    return null;
  }

  const callbackUrl = new URL('/oauth/dingtalk/callback', serverDomain);
  searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value);
  });
  if (!callbackUrl.searchParams.has('authCode')) {
    callbackUrl.searchParams.set('authCode', authCode);
  }

  return callbackUrl.toString();
}

export default function DingTalkOAuthBridge() {
  const [searchParams] = useSearchParams();
  const { data: startupConfig } = useGetStartupConfig();

  useEffect(() => {
    if (!startupConfig?.serverDomain) {
      return;
    }

    const callbackUrl = buildDingTalkBridgeCallbackUrl(searchParams, startupConfig.serverDomain);
    if (!callbackUrl) {
      window.location.assign('/login?redirect=false&error=auth_failed');
      return;
    }

    window.location.assign(callbackUrl);
  }, [searchParams, startupConfig?.serverDomain]);

  return null;
}
