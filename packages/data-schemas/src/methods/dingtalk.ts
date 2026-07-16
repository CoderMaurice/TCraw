import { randomUUID } from 'node:crypto';
import type { Model } from 'mongoose';
import type {
  DingTalkBindingStatus,
  DingTalkConversationInput,
  DingTalkMessageStatus,
  DingTalkRuntimeBinding,
  IDingTalkBinding,
  IDingTalkConversation,
  IDingTalkMessageReceipt,
  UpsertDingTalkBindingInput,
} from '~/types';
import { decryptV2, encryptV2 } from '~/crypto';

type BindingModel = Model<IDingTalkBinding>;
type ConversationModel = Model<IDingTalkConversation>;
type ReceiptModel = Model<IDingTalkMessageReceipt>;

export interface DingTalkMethods {
  getDingTalkBindingByAgent(agentId: string): Promise<IDingTalkBinding | null>;
  getDingTalkBindingByApiKeyId(apiKeyId: string): Promise<IDingTalkBinding | null>;
  getDingTalkRuntimeBinding(bindingId: string): Promise<DingTalkRuntimeBinding | null>;
  listEnabledDingTalkRuntimeBindings(): Promise<DingTalkRuntimeBinding[]>;
  upsertDingTalkBinding(input: UpsertDingTalkBindingInput): Promise<IDingTalkBinding>;
  deleteDingTalkBinding(agentId: string): Promise<IDingTalkBinding | null>;
  setDingTalkBindingStatus(
    bindingId: string,
    status: DingTalkBindingStatus,
    error?: string,
  ): Promise<void>;
  getOrCreateDingTalkConversation(input: DingTalkConversationInput): Promise<IDingTalkConversation>;
  claimDingTalkMessage(params: {
    bindingId: string;
    messageId: string;
    senderStaffId: string;
  }): Promise<boolean>;
  finishDingTalkMessage(
    bindingId: string,
    messageId: string,
    status: DingTalkMessageStatus,
    error?: string,
  ): Promise<void>;
}

function getModels(mongoose: typeof import('mongoose')): {
  Binding: BindingModel;
  Conversation: ConversationModel;
  Receipt: ReceiptModel;
} {
  return {
    Binding: mongoose.models.DingTalkBinding as BindingModel,
    Conversation: mongoose.models.DingTalkConversation as ConversationModel,
    Receipt: mongoose.models.DingTalkMessageReceipt as ReceiptModel,
  };
}

async function toRuntimeBinding(binding: IDingTalkBinding): Promise<DingTalkRuntimeBinding> {
  return {
    id: binding._id.toString(),
    agentId: binding.agentId,
    ownerUserId: binding.ownerUserId,
    clientId: binding.clientId,
    clientSecret: await decryptV2(binding.encryptedClientSecret),
    robotCode: binding.robotCode,
    apiKeyId: binding.apiKeyId,
    apiKey: await decryptV2(binding.encryptedApiKey),
    enabled: binding.enabled,
    tenantId: binding.tenantId,
  };
}

export function createDingTalkMethods(mongoose: typeof import('mongoose')): DingTalkMethods {
  const getDingTalkBindingByAgent = async (agentId: string): Promise<IDingTalkBinding | null> => {
    const { Binding } = getModels(mongoose);
    return Binding.findOne({ agentId }).lean<IDingTalkBinding>();
  };

  const getDingTalkBindingByApiKeyId = async (
    apiKeyId: string,
  ): Promise<IDingTalkBinding | null> => {
    const { Binding } = getModels(mongoose);
    return Binding.findOne({ apiKeyId }).lean<IDingTalkBinding>();
  };

  const getDingTalkRuntimeBinding = async (
    bindingId: string,
  ): Promise<DingTalkRuntimeBinding | null> => {
    const { Binding } = getModels(mongoose);
    const binding = await Binding.findById(bindingId)
      .select('+encryptedClientSecret +encryptedApiKey')
      .lean<IDingTalkBinding>();
    return binding ? toRuntimeBinding(binding) : null;
  };

  const listEnabledDingTalkRuntimeBindings = async (): Promise<DingTalkRuntimeBinding[]> => {
    const { Binding } = getModels(mongoose);
    const bindings = await Binding.find({ enabled: true })
      .select('+encryptedClientSecret +encryptedApiKey')
      .lean<IDingTalkBinding[]>();
    return Promise.all(bindings.map(toRuntimeBinding));
  };

  const upsertDingTalkBinding = async (
    input: UpsertDingTalkBindingInput,
  ): Promise<IDingTalkBinding> => {
    const { Binding } = getModels(mongoose);
    const existing = await Binding.findOne({ agentId: input.agentId })
      .select('+encryptedClientSecret +encryptedApiKey')
      .lean<IDingTalkBinding>();

    if (!existing && (!input.clientSecret || !input.apiKeyId || !input.apiKey)) {
      throw new Error('A new DingTalk binding requires client secret and internal API key');
    }

    const encryptedClientSecret = input.clientSecret
      ? await encryptV2(input.clientSecret)
      : existing?.encryptedClientSecret;
    const encryptedApiKey = input.apiKey
      ? await encryptV2(input.apiKey)
      : existing?.encryptedApiKey;

    if (!encryptedClientSecret || !encryptedApiKey) {
      throw new Error('DingTalk binding credentials are incomplete');
    }

    const binding = await Binding.findOneAndUpdate(
      { agentId: input.agentId },
      {
        $set: {
          ownerUserId: input.ownerUserId,
          clientId: input.clientId,
          encryptedClientSecret,
          apiKeyId: input.apiKeyId ?? existing?.apiKeyId,
          encryptedApiKey,
          enabled: input.enabled,
          status: input.enabled ? 'connecting' : 'disabled',
          ...(input.robotCode ? { robotCode: input.robotCode } : {}),
        },
        $unset: {
          lastError: 1,
          ...(input.robotCode ? {} : { robotCode: 1 }),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<IDingTalkBinding>();

    if (!binding) {
      throw new Error('Failed to save DingTalk binding');
    }
    return binding;
  };

  const deleteDingTalkBinding = async (agentId: string): Promise<IDingTalkBinding | null> => {
    const { Binding } = getModels(mongoose);
    return Binding.findOneAndDelete({ agentId }).lean<IDingTalkBinding>();
  };

  const setDingTalkBindingStatus = async (
    bindingId: string,
    status: DingTalkBindingStatus,
    error?: string,
  ): Promise<void> => {
    const { Binding } = getModels(mongoose);
    await Binding.updateOne(
      { _id: bindingId },
      {
        $set: {
          status,
          ...(error ? { lastError: error.slice(0, 1000) } : {}),
          ...(status === 'connected' ? { lastConnectedAt: new Date() } : {}),
        },
        ...(!error ? { $unset: { lastError: 1 } } : {}),
      },
    );
  };

  const getOrCreateDingTalkConversation = async (
    input: DingTalkConversationInput,
  ): Promise<IDingTalkConversation> => {
    const { Conversation } = getModels(mongoose);
    const filter = { bindingId: input.bindingId, senderStaffId: input.senderStaffId };
    const update = {
      $set: {
        senderName: input.senderName,
        lastMessageAt: new Date(),
      },
      $setOnInsert: {
        agentId: input.agentId,
        ownerUserId: input.ownerUserId,
        conversationId: randomUUID(),
      },
    };

    try {
      const conversation = await Conversation.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }).lean<IDingTalkConversation>();
      if (conversation) {
        return conversation;
      }
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) {
        throw error;
      }
    }

    const existing = await Conversation.findOne(filter).lean<IDingTalkConversation>();
    if (!existing) {
      throw new Error('Failed to create DingTalk conversation mapping');
    }
    return existing;
  };

  const claimDingTalkMessage = async (params: {
    bindingId: string;
    messageId: string;
    senderStaffId: string;
  }): Promise<boolean> => {
    const { Receipt } = getModels(mongoose);
    try {
      const result = await Receipt.updateOne(
        { bindingId: params.bindingId, messageId: params.messageId },
        {
          $setOnInsert: {
            senderStaffId: params.senderStaffId,
            status: 'processing',
          },
        },
        { upsert: true },
      );
      return result.upsertedCount === 1;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return false;
      }
      throw error;
    }
  };

  const finishDingTalkMessage = async (
    bindingId: string,
    messageId: string,
    status: DingTalkMessageStatus,
    error?: string,
  ): Promise<void> => {
    const { Receipt } = getModels(mongoose);
    await Receipt.updateOne(
      { bindingId, messageId },
      { $set: { status, error: error?.slice(0, 1000) } },
    );
  };

  return {
    getDingTalkBindingByAgent,
    getDingTalkBindingByApiKeyId,
    getDingTalkRuntimeBinding,
    listEnabledDingTalkRuntimeBindings,
    upsertDingTalkBinding,
    deleteDingTalkBinding,
    setDingTalkBindingStatus,
    getOrCreateDingTalkConversation,
    claimDingTalkMessage,
    finishDingTalkMessage,
  };
}
