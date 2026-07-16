import type { DingTalkRuntimeBinding, IDingTalkConversation } from '@librechat/data-schemas';
import type { DWClientDownStream } from 'dingtalk-stream';
import { DingTalkRuntime } from './runtime';

interface MockDingTalkClient {
  callback?: (message: DWClientDownStream) => void;
  socketCallBackResponse: jest.Mock;
  disconnect: jest.Mock;
  connect: jest.Mock;
}

jest.mock('dingtalk-stream', () => ({
  __clients: [],
  DWClient: class {
    callback?: (message: DWClientDownStream) => void;
    socketCallBackResponse = jest.fn();
    disconnect = jest.fn();
    connect = jest.fn(async () => undefined);

    constructor() {
      const mocked = jest.requireMock('dingtalk-stream') as { __clients: MockDingTalkClient[] };
      mocked.__clients.push(this);
    }

    registerCallbackListener(_topic: string, callback: (message: DWClientDownStream) => void) {
      this.callback = callback;
      return this;
    }
  },
  TOPIC_ROBOT: '/v1.0/im/bot/messages/get',
}));

const clients = (jest.requireMock('dingtalk-stream') as { __clients: MockDingTalkClient[] })
  .__clients;

const binding: DingTalkRuntimeBinding = {
  id: 'binding-1',
  agentId: 'agent-1',
  ownerUserId: 'owner-1',
  clientId: 'client-1',
  clientSecret: 'secret-1',
  robotCode: 'robot-1',
  apiKeyId: 'key-1',
  apiKey: 'sk-internal',
  enabled: true,
};

const conversation = {
  conversationId: 'conversation-1',
  senderName: '张三',
} as IDingTalkConversation;

function createDownstream(overrides: Record<string, string> = {}): DWClientDownStream {
  return {
    specVersion: '1.0',
    type: 'CALLBACK',
    headers: {
      appId: 'app-1',
      connectionId: 'connection-1',
      contentType: 'application/json',
      messageId: 'stream-message-1',
      time: String(Date.now()),
      topic: '/v1.0/im/bot/messages/get',
    },
    data: JSON.stringify({
      conversationId: 'ding-conversation-1',
      conversationType: '1',
      msgId: 'message-1',
      msgtype: 'text',
      robotCode: 'robot-1',
      senderId: 'sender-1',
      senderNick: '张三',
      senderStaffId: 'staff-1',
      sessionWebhook: 'https://oapi.dingtalk.com/robot/sendBySession?session=1',
      sessionWebhookExpiredTime: Date.now() + 60_000,
      text: { content: '你好' },
      ...overrides,
    }),
  };
}

function createDependencies(fetcher: jest.MockedFunction<typeof fetch>) {
  return {
    getDingTalkRuntimeBinding: jest.fn(async () => binding),
    listEnabledDingTalkRuntimeBindings: jest.fn(async () => [binding]),
    setDingTalkBindingStatus: jest.fn(async () => undefined),
    getOrCreateDingTalkConversation: jest.fn(async () => conversation),
    claimDingTalkMessage: jest.fn(async () => true),
    finishDingTalkMessage: jest.fn(async () => undefined),
    saveConvo: jest.fn(async () => null),
    internalApiUrl: 'http://127.0.0.1:3080',
    fetch: fetcher,
  };
}

describe('DingTalkRuntime', () => {
  beforeEach(() => {
    clients.length = 0;
  });

  it('acknowledges a direct message, runs the owner agent, and replies', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: '你好，我是数字分身。' }],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const deps = createDependencies(fetcher);
    const completed = new Promise<void>((resolve) => {
      deps.finishDingTalkMessage.mockImplementation(async () => resolve());
    });
    const runtime = new DingTalkRuntime(deps);

    await runtime.start();
    clients[0].callback?.(createDownstream());
    await completed;

    expect(clients[0].socketCallBackResponse).toHaveBeenCalledWith('stream-message-1', {});
    expect(deps.getOrCreateDingTalkConversation).toHaveBeenCalledWith(
      expect.objectContaining({ senderStaffId: 'staff-1', ownerUserId: 'owner-1' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3080/api/integrations/dingtalk/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-internal' }),
      }),
    );

    const agentRequest = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as {
      model: string;
      previous_response_id: string;
      input: string;
    };
    expect(agentRequest).toEqual({
      model: 'agent-1',
      previous_response_id: 'conversation-1',
      input: '你好',
      store: true,
    });

    const replyRequest = JSON.parse(String(fetcher.mock.calls[1][1]?.body)) as {
      text: { content: string };
    };
    expect(replyRequest.text.content).toBe('你好，我是数字分身。');
    expect(deps.saveConvo).toHaveBeenCalledWith(
      { userId: 'owner-1' },
      expect.objectContaining({
        conversationId: 'conversation-1',
        title: '钉钉 - 张三',
      }),
      expect.any(Object),
    );
  });

  it('ignores group messages without running the agent', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const deps = createDependencies(fetcher);
    const ignored = new Promise<void>((resolve) => {
      deps.finishDingTalkMessage.mockImplementation(async () => resolve());
    });
    const runtime = new DingTalkRuntime(deps);

    await runtime.start();
    clients[0].callback?.(createDownstream({ conversationType: '2' }));
    await ignored;

    expect(fetcher).not.toHaveBeenCalled();
    expect(deps.finishDingTalkMessage).toHaveBeenCalledWith('binding-1', 'message-1', 'ignored');
  });

  it('does not execute a message that was already claimed', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const deps = createDependencies(fetcher);
    deps.claimDingTalkMessage.mockResolvedValue(false);
    const runtime = new DingTalkRuntime(deps);

    await runtime.start();
    clients[0].callback?.(createDownstream());
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetcher).not.toHaveBeenCalled();
    expect(deps.getOrCreateDingTalkConversation).not.toHaveBeenCalled();
  });
});
