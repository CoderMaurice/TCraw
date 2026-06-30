import { buildDingTalkBridgeCallbackUrl } from '~/components/Auth/DingTalkOAuthBridge';

describe('DingTalkOAuthBridge', () => {
  it('forwards DingTalk authCode callbacks to the API callback route', () => {
    expect(
      buildDingTalkBridgeCallbackUrl(
        new URLSearchParams('authCode=auth-code&state=state-1'),
        'http://api.test',
      ),
    ).toBe('http://api.test/oauth/dingtalk/callback?authCode=auth-code&state=state-1');
  });

  it('normalizes code callbacks to authCode for the API callback route', () => {
    expect(
      buildDingTalkBridgeCallbackUrl(
        new URLSearchParams('code=code-value&state=state-1'),
        'http://api.test',
      ),
    ).toBe(
      'http://api.test/oauth/dingtalk/callback?code=code-value&state=state-1&authCode=code-value',
    );
  });
});
