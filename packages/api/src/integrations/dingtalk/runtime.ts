import { DWClient, TOPIC_ROBOT } from 'dingtalk-stream';
import { EModelEndpoint } from 'librechat-data-provider';
import { logger, tenantStorage } from '@librechat/data-schemas';
import type {
  AllMethods,
  DingTalkRuntimeBinding,
  IDingTalkConversation,
} from '@librechat/data-schemas';
import type { DWClientDownStream } from 'dingtalk-stream';
import type {
  AgentResponsePayload,
  DingTalkInboundMessage,
  DingTalkRuntimeControl,
  DingTalkRuntimeEntry,
} from './types';

const SINGLE_CONVERSATION_TYPE = '1';
const MAX_REPLY_CHARS = 5000;
const RESPONSE_TIMEOUT_MS = 10 * 60 * 1000;
const STREAM_CONNECT_TIMEOUT_MS = 15 * 1000;
const STREAM_CONNECT_POLL_MS = 100;
const DINGTALK_WEBHOOK_HOSTS = new Set(['api.dingtalk.com', 'oapi.dingtalk.com']);

export interface DingTalkRuntimeDependencies {
  getDingTalkRuntimeBinding: AllMethods['getDingTalkRuntimeBinding'];
  listEnabledDingTalkRuntimeBindings: AllMethods['listEnabledDingTalkRuntimeBindings'];
  setDingTalkBindingStatus: AllMethods['setDingTalkBindingStatus'];
  getOrCreateDingTalkConversation: AllMethods['getOrCreateDingTalkConversation'];
  claimDingTalkMessage: AllMethods['claimDingTalkMessage'];
  finishDingTalkMessage: AllMethods['finishDingTalkMessage'];
  saveConvo: AllMethods['saveConvo'];
  internalApiUrl?: string;
  fetch?: typeof fetch;
}

function getErrorMessage(error: object | string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'Unknown DingTalk integration error';
}

function parseInboundMessage(message: DWClientDownStream): DingTalkInboundMessage {
  return JSON.parse(message.data) as DingTalkInboundMessage;
}

function getSenderStaffId(message: DingTalkInboundMessage): string {
  return message.senderStaffId || message.senderId;
}

function getConversationTitle(message: DingTalkInboundMessage): string {
  const senderName = message.senderNick.trim() || getSenderStaffId(message);
  return `钉钉 - ${senderName}`.slice(0, 256);
}

function getAgentResponseText(payload: AgentResponsePayload): string {
  let text = '';
  for (const output of payload.output ?? []) {
    if (output.type !== 'message') {
      continue;
    }
    for (const part of output.content ?? []) {
      if (part.type === 'output_text' && part.text) {
        text += part.text;
      }
    }
  }
  return text.trim();
}

function splitReply(text: string): string[] {
  if (text.length <= MAX_REPLY_CHARS) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_REPLY_CHARS) {
    let splitAt = remaining.lastIndexOf('\n', MAX_REPLY_CHARS);
    if (splitAt < MAX_REPLY_CHARS / 2) {
      splitAt = MAX_REPLY_CHARS;
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

function assertDingTalkWebhook(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !DINGTALK_WEBHOOK_HOSTS.has(url.hostname)) {
    throw new Error('DingTalk session webhook host is not allowed');
  }
  return url;
}

async function waitForStreamConnection(client: DWClient): Promise<void> {
  const expiresAt = Date.now() + STREAM_CONNECT_TIMEOUT_MS;
  while (!client.connected && Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, STREAM_CONNECT_POLL_MS));
  }
  if (!client.connected) {
    throw new Error('Timed out while connecting to DingTalk Stream');
  }
}

export class DingTalkRuntime implements DingTalkRuntimeControl {
  private readonly deps: DingTalkRuntimeDependencies;
  private readonly entries = new Map<string, DingTalkRuntimeEntry>();
  private readonly fetcher: typeof fetch;
  private readonly internalApiUrl: string;

  constructor(deps: DingTalkRuntimeDependencies) {
    this.deps = deps;
    this.fetcher = deps.fetch ?? fetch;
    this.internalApiUrl = (deps.internalApiUrl ?? 'http://127.0.0.1:3080').replace(/\/+$/, '');
  }

  async start(): Promise<void> {
    const bindings = await this.deps.listEnabledDingTalkRuntimeBindings();
    const results = await Promise.allSettled(
      bindings.map((binding) => this.connectBinding(binding)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        logger.error('[DingTalk] Failed to initialize binding', {
          bindingId: bindings[i].id,
          error: getErrorMessage(result.reason as object | string),
        });
      }
    }
  }

  async stop(): Promise<void> {
    const bindingIds = [...this.entries.keys()];
    await Promise.all(bindingIds.map((bindingId) => this.disconnectBinding(bindingId)));
  }

  async refreshBinding(bindingId: string): Promise<void> {
    await this.disconnectBinding(bindingId);
    const binding = await this.deps.getDingTalkRuntimeBinding(bindingId);
    if (!binding || !binding.enabled) {
      if (binding) {
        await this.deps.setDingTalkBindingStatus(bindingId, 'disabled');
      }
      return;
    }
    await this.connectBinding(binding);
  }

  async disconnectBinding(bindingId: string): Promise<void> {
    const entry = this.entries.get(bindingId);
    if (!entry) {
      return;
    }
    entry.disconnect();
    this.entries.delete(bindingId);
  }

  private async connectBinding(binding: DingTalkRuntimeBinding): Promise<void> {
    await this.deps.setDingTalkBindingStatus(binding.id, 'connecting');

    const client = new DWClient({
      clientId: binding.clientId,
      clientSecret: binding.clientSecret,
      keepAlive: true,
      debug: false,
    });

    client.registerCallbackListener(TOPIC_ROBOT, (message) => {
      client.socketCallBackResponse(message.headers.messageId, {});
      void tenantStorage.run(
        { tenantId: binding.tenantId, userId: binding.ownerUserId },
        async () => this.processMessage(binding, message),
      );
    });

    this.entries.set(binding.id, {
      binding,
      disconnect: () => client.disconnect(),
    });

    try {
      await client.connect();
      await waitForStreamConnection(client);
      await this.deps.setDingTalkBindingStatus(binding.id, 'connected');
      logger.info('[DingTalk] Stream binding connected', {
        bindingId: binding.id,
        agentId: binding.agentId,
      });
    } catch (error) {
      this.entries.delete(binding.id);
      client.disconnect();
      const message = getErrorMessage(error as object | string);
      await this.deps.setDingTalkBindingStatus(binding.id, 'error', message);
      throw error;
    }
  }

  private async processMessage(
    binding: DingTalkRuntimeBinding,
    downstream: DWClientDownStream,
  ): Promise<void> {
    let message: DingTalkInboundMessage;
    try {
      message = parseInboundMessage(downstream);
    } catch (error) {
      logger.warn('[DingTalk] Ignored malformed robot message', {
        bindingId: binding.id,
        error: getErrorMessage(error as object | string),
      });
      return;
    }

    const senderStaffId = getSenderStaffId(message);
    if (!message.msgId || !senderStaffId) {
      logger.warn('[DingTalk] Ignored robot message without stable identifiers', {
        bindingId: binding.id,
      });
      return;
    }

    const claimed = await this.deps.claimDingTalkMessage({
      bindingId: binding.id,
      messageId: message.msgId,
      senderStaffId,
    });
    if (!claimed) {
      return;
    }

    try {
      if (binding.robotCode && message.robotCode !== binding.robotCode) {
        await this.deps.finishDingTalkMessage(binding.id, message.msgId, 'ignored');
        return;
      }

      if (message.conversationType !== SINGLE_CONVERSATION_TYPE) {
        await this.deps.finishDingTalkMessage(binding.id, message.msgId, 'ignored');
        return;
      }

      const text = message.text?.content?.trim();
      if (message.msgtype !== 'text' || !text) {
        await this.reply(message.sessionWebhook, '当前仅支持文字消息。');
        await this.deps.finishDingTalkMessage(binding.id, message.msgId, 'ignored');
        return;
      }

      const conversation = await this.deps.getOrCreateDingTalkConversation({
        bindingId: binding.id,
        agentId: binding.agentId,
        ownerUserId: binding.ownerUserId,
        senderStaffId,
        senderName: message.senderNick || senderStaffId,
      });

      await this.ensureConversation(binding, message, conversation);
      const responseText = await this.runAgent(binding, conversation.conversationId, text);
      await this.reply(message.sessionWebhook, responseText);
      await this.ensureConversation(binding, message, conversation);
      await this.deps.finishDingTalkMessage(binding.id, message.msgId, 'completed');
    } catch (error) {
      const errorMessage = getErrorMessage(error as object | string);
      await this.deps.finishDingTalkMessage(binding.id, message.msgId, 'failed', errorMessage);
      logger.error('[DingTalk] Failed to process robot message', {
        bindingId: binding.id,
        agentId: binding.agentId,
        messageId: message.msgId,
        error: errorMessage,
      });

      try {
        await this.reply(message.sessionWebhook, '处理消息时发生错误，请稍后再试。');
      } catch (replyError) {
        logger.warn('[DingTalk] Failed to send error reply', {
          bindingId: binding.id,
          error: getErrorMessage(replyError as object | string),
        });
      }
    }
  }

  private async ensureConversation(
    binding: DingTalkRuntimeBinding,
    message: DingTalkInboundMessage,
    conversation: IDingTalkConversation,
  ): Promise<void> {
    await this.deps.saveConvo(
      { userId: binding.ownerUserId },
      {
        conversationId: conversation.conversationId,
        endpoint: EModelEndpoint.agents,
        agent_id: binding.agentId,
        title: getConversationTitle(message),
      },
      { context: 'DingTalk integration conversation' },
    );
  }

  private async runAgent(
    binding: DingTalkRuntimeBinding,
    conversationId: string,
    text: string,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${binding.apiKey}`,
        'Content-Type': 'application/json',
      };
      if (binding.tenantId) {
        headers['X-Tenant-Id'] = binding.tenantId;
      }

      const response = await this.fetcher(
        `${this.internalApiUrl}/api/integrations/dingtalk/responses`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: binding.agentId,
            input: text,
            previous_response_id: conversationId,
            store: true,
          }),
          signal: controller.signal,
        },
      );
      const payload = (await response.json()) as AgentResponsePayload;
      if (!response.ok) {
        throw new Error(payload.error?.message || `Agent response failed with ${response.status}`);
      }

      const responseText = getAgentResponseText(payload);
      if (!responseText) {
        throw new Error('Agent returned an empty response');
      }
      return responseText;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async reply(sessionWebhook: string, text: string): Promise<void> {
    const webhook = assertDingTalkWebhook(sessionWebhook);
    for (const chunk of splitReply(text)) {
      const response = await this.fetcher(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: chunk },
        }),
      });
      if (!response.ok) {
        throw new Error(`DingTalk reply failed with ${response.status}`);
      }
    }
  }
}

export function createDingTalkRuntime(deps: DingTalkRuntimeDependencies): DingTalkRuntime {
  return new DingTalkRuntime(deps);
}
