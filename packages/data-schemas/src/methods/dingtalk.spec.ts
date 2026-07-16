import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createMethods } from './index';
import { createModels } from '~/models';

jest.mock('~/crypto', () => ({
  encryptV2: jest.fn(async (value: string) => `encrypted:${value}`),
  decryptV2: jest.fn(async (value: string) => value.replace(/^encrypted:/, '')),
}));

describe('DingTalk methods', () => {
  let mongoServer: MongoMemoryServer;
  const methods = createMethods(mongoose);

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    createModels(mongoose);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      mongoose.models.DingTalkBinding.deleteMany({}),
      mongoose.models.DingTalkConversation.deleteMany({}),
      mongoose.models.DingTalkMessageReceipt.deleteMany({}),
    ]);
  });

  it('encrypts credentials and preserves them when an update omits secrets', async () => {
    const created = await methods.upsertDingTalkBinding({
      agentId: 'agent-1',
      ownerUserId: 'owner-1',
      clientId: 'client-1',
      clientSecret: 'client-secret',
      robotCode: 'robot-1',
      apiKeyId: 'key-id-1',
      apiKey: 'sk-internal',
      enabled: true,
    });

    const stored = await mongoose.models.DingTalkBinding.findById(created._id)
      .select('+encryptedClientSecret +encryptedApiKey')
      .lean();
    expect(stored.encryptedClientSecret).toBe('encrypted:client-secret');
    expect(stored.encryptedApiKey).toBe('encrypted:sk-internal');

    await methods.upsertDingTalkBinding({
      agentId: 'agent-1',
      ownerUserId: 'owner-1',
      clientId: 'client-1',
      enabled: false,
    });

    const runtime = await methods.getDingTalkRuntimeBinding(created._id.toString());
    expect(runtime).toMatchObject({
      clientSecret: 'client-secret',
      apiKey: 'sk-internal',
      enabled: false,
    });
    expect(runtime?.robotCode).toBeUndefined();
  });

  it('reuses one platform conversation for the same DingTalk user', async () => {
    const first = await methods.getOrCreateDingTalkConversation({
      bindingId: 'binding-1',
      agentId: 'agent-1',
      ownerUserId: 'owner-1',
      senderStaffId: 'staff-1',
      senderName: '张三',
    });
    const second = await methods.getOrCreateDingTalkConversation({
      bindingId: 'binding-1',
      agentId: 'agent-1',
      ownerUserId: 'owner-1',
      senderStaffId: 'staff-1',
      senderName: '张三（新名称）',
    });
    const otherUser = await methods.getOrCreateDingTalkConversation({
      bindingId: 'binding-1',
      agentId: 'agent-1',
      ownerUserId: 'owner-1',
      senderStaffId: 'staff-2',
      senderName: '李四',
    });

    expect(second.conversationId).toBe(first.conversationId);
    expect(second.senderName).toBe('张三（新名称）');
    expect(otherUser.conversationId).not.toBe(first.conversationId);
  });

  it('claims each inbound DingTalk message only once', async () => {
    const input = {
      bindingId: 'binding-1',
      messageId: 'message-1',
      senderStaffId: 'staff-1',
    };

    await expect(methods.claimDingTalkMessage(input)).resolves.toBe(true);
    await expect(methods.claimDingTalkMessage(input)).resolves.toBe(false);

    await methods.finishDingTalkMessage('binding-1', 'message-1', 'completed');
    const receipt = await mongoose.models.DingTalkMessageReceipt.findOne({
      bindingId: 'binding-1',
      messageId: 'message-1',
    }).lean();
    expect(receipt.status).toBe('completed');
  });

  it('clears stale connection errors after recovery', async () => {
    const binding = await methods.upsertDingTalkBinding({
      agentId: 'agent-1',
      ownerUserId: 'owner-1',
      clientId: 'client-1',
      clientSecret: 'client-secret',
      apiKeyId: 'key-id-1',
      apiKey: 'sk-internal',
      enabled: true,
    });

    await methods.setDingTalkBindingStatus(binding._id.toString(), 'error', 'bad credentials');
    await methods.setDingTalkBindingStatus(binding._id.toString(), 'connected');

    const recovered = await methods.getDingTalkBindingByAgent('agent-1');
    expect(recovered?.status).toBe('connected');
    expect(recovered?.lastError).toBeUndefined();
    expect(recovered?.lastConnectedAt).toBeInstanceOf(Date);
  });
});
