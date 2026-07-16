import type { DingTalkRuntimeBinding } from '@librechat/data-schemas';

export interface DingTalkRuntimeControl {
  refreshBinding(bindingId: string): Promise<void>;
  disconnectBinding(bindingId: string): Promise<void>;
}

export interface DingTalkInboundMessage {
  conversationId: string;
  conversationType: string;
  msgId: string;
  msgtype: string;
  robotCode: string;
  senderId: string;
  senderNick: string;
  senderStaffId: string;
  sessionWebhook: string;
  sessionWebhookExpiredTime: number;
  text?: {
    content?: string;
  };
}

export interface DingTalkRuntimeEntry {
  binding: DingTalkRuntimeBinding;
  disconnect(): void;
}

export interface AgentResponseContent {
  type: string;
  text?: string;
}

export interface AgentResponseOutput {
  type: string;
  content?: AgentResponseContent[];
}

export interface AgentResponsePayload {
  status?: string;
  output?: AgentResponseOutput[];
  error?: {
    message?: string;
  };
}
