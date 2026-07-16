import type { Document } from 'mongoose';

export type DingTalkBindingStatus = 'disabled' | 'connecting' | 'connected' | 'error';
export type DingTalkMessageStatus = 'processing' | 'completed' | 'ignored' | 'failed';

export interface IDingTalkBinding extends Document {
  agentId: string;
  ownerUserId: string;
  clientId: string;
  encryptedClientSecret: string;
  robotCode?: string;
  apiKeyId: string;
  encryptedApiKey: string;
  enabled: boolean;
  status: DingTalkBindingStatus;
  lastConnectedAt?: Date;
  lastError?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDingTalkConversation extends Document {
  bindingId: string;
  agentId: string;
  ownerUserId: string;
  senderStaffId: string;
  senderName: string;
  conversationId: string;
  lastMessageAt: Date;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDingTalkMessageReceipt extends Document {
  bindingId: string;
  messageId: string;
  senderStaffId: string;
  status: DingTalkMessageStatus;
  error?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DingTalkBindingSummary {
  id: string;
  agentId: string;
  clientId: string;
  robotCode?: string;
  enabled: boolean;
  status: DingTalkBindingStatus;
  hasClientSecret: boolean;
  lastConnectedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DingTalkRuntimeBinding {
  id: string;
  agentId: string;
  ownerUserId: string;
  clientId: string;
  clientSecret: string;
  robotCode?: string;
  apiKeyId: string;
  apiKey: string;
  enabled: boolean;
  tenantId?: string;
}

export interface UpsertDingTalkBindingInput {
  agentId: string;
  ownerUserId: string;
  clientId: string;
  clientSecret?: string;
  robotCode?: string;
  apiKeyId?: string;
  apiKey?: string;
  enabled: boolean;
}

export interface DingTalkConversationInput {
  bindingId: string;
  agentId: string;
  ownerUserId: string;
  senderStaffId: string;
  senderName: string;
}
