import { useEffect, useRef, useState } from 'react';
import { useLocalize } from '~/hooks';

const DINGTALK_LOGIN_SCRIPT = 'https://g.alicdn.com/dingding/h5-dingtalk-login/0.21.0/ddlogin.js';

type DingTalkLoginResult = {
  redirectUrl?: string;
  authCode?: string;
  code?: string;
  state?: string;
};

type DingTalkFrameLoginOptions = {
  id: string;
  width: number;
  height: number;
};

type DingTalkFrameLoginParams = {
  redirect_uri: string;
  client_id: string;
  scope: 'openid';
  response_type: 'code';
  state: string;
  prompt: 'consent';
};

declare global {
  interface Window {
    DTFrameLogin?: (
      options: DingTalkFrameLoginOptions,
      params: DingTalkFrameLoginParams,
      onSuccess: (result: DingTalkLoginResult) => void,
      onError: (message: string) => void,
    ) => void;
  }
}

let dingTalkScriptPromise: Promise<void> | null = null;

function loadDingTalkScript() {
  if (window.DTFrameLogin) {
    return Promise.resolve();
  }
  if (dingTalkScriptPromise) {
    return dingTalkScriptPromise;
  }

  dingTalkScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${DINGTALK_LOGIN_SCRIPT}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('load_failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = DINGTALK_LOGIN_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('load_failed'));
    document.body.appendChild(script);
  });

  return dingTalkScriptPromise;
}

function createState() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function buildFallbackRedirect(result: DingTalkLoginResult) {
  const authCode = result.authCode ?? result.code;
  if (!authCode) {
    return null;
  }

  const callbackUrl = new URL('/oauth/dingtalk/callback', window.location.origin);
  callbackUrl.searchParams.set('authCode', authCode);
  if (result.state) {
    callbackUrl.searchParams.set('state', result.state);
  }
  return callbackUrl.toString();
}

export default function DingTalkFrameLogin({ clientId }: { clientId: string }) {
  const localize = useLocalize();
  const containerIdRef = useRef(`dingtalk-frame-login-${Math.random().toString(36).slice(2)}`);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function mountDingTalkLogin() {
      try {
        await loadDingTalkScript();
        if (cancelled || !window.DTFrameLogin) {
          return;
        }

        window.DTFrameLogin(
          {
            id: containerIdRef.current,
            width: 320,
            height: 320,
          },
          {
            redirect_uri: encodeURIComponent(
              new URL('/oauth/dingtalk/callback', window.location.origin).toString(),
            ),
            client_id: clientId,
            scope: 'openid',
            response_type: 'code',
            state: createState(),
            prompt: 'consent',
          },
          (result) => {
            const redirectUrl = result.redirectUrl ?? buildFallbackRedirect(result);
            if (redirectUrl) {
              window.location.href = redirectUrl;
            }
          },
          () => {},
        );
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    }

    mountDingTalkLogin();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-4 text-center text-xl font-semibold text-text-primary">
        {localize('com_auth_dingtalk_login')}
      </h2>
      <div
        id={containerIdRef.current}
        data-testid="dingtalk-frame-login"
        className="min-h-[320px] w-full max-w-[320px]"
      />
      {error && (
        <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">
          {localize('com_auth_dingtalk_load_failed')}
        </p>
      )}
    </div>
  );
}
