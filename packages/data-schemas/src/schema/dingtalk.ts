import { Schema } from 'mongoose';
import type { IDingTalkBinding, IDingTalkConversation, IDingTalkMessageReceipt } from '~/types';

export const dingtalkBindingSchema: Schema<IDingTalkBinding> = new Schema(
  {
    agentId: { type: String, required: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    clientId: { type: String, required: true, trim: true },
    encryptedClientSecret: { type: String, required: true, select: false },
    robotCode: { type: String, trim: true },
    apiKeyId: { type: String, required: true, index: true },
    encryptedApiKey: { type: String, required: true, select: false },
    enabled: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['disabled', 'connecting', 'connected', 'error'],
      default: 'disabled',
    },
    lastConnectedAt: { type: Date },
    lastError: { type: String },
    tenantId: { type: String, index: true },
  },
  { timestamps: true },
);

dingtalkBindingSchema.index({ agentId: 1, tenantId: 1 }, { unique: true });
dingtalkBindingSchema.index({ clientId: 1, tenantId: 1 }, { unique: true });
dingtalkBindingSchema.index({ enabled: 1, status: 1 });

export const dingtalkConversationSchema: Schema<IDingTalkConversation> = new Schema(
  {
    bindingId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    senderStaffId: { type: String, required: true },
    senderName: { type: String, required: true },
    conversationId: { type: String, required: true, index: true },
    lastMessageAt: { type: Date, required: true },
    tenantId: { type: String, index: true },
  },
  { timestamps: true },
);

dingtalkConversationSchema.index({ bindingId: 1, senderStaffId: 1, tenantId: 1 }, { unique: true });
dingtalkConversationSchema.index(
  { ownerUserId: 1, conversationId: 1, tenantId: 1 },
  { unique: true },
);

export const dingtalkMessageReceiptSchema: Schema<IDingTalkMessageReceipt> = new Schema(
  {
    bindingId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    senderStaffId: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'completed', 'ignored', 'failed'],
      default: 'processing',
    },
    error: { type: String },
    tenantId: { type: String, index: true },
  },
  { timestamps: true },
);

dingtalkMessageReceiptSchema.index({ bindingId: 1, messageId: 1, tenantId: 1 }, { unique: true });
