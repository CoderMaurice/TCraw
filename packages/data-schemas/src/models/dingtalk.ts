import type { Model } from 'mongoose';
import type { IDingTalkBinding, IDingTalkConversation, IDingTalkMessageReceipt } from '~/types';
import {
  dingtalkBindingSchema,
  dingtalkConversationSchema,
  dingtalkMessageReceiptSchema,
} from '~/schema/dingtalk';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';

export function createDingTalkModels(mongoose: typeof import('mongoose')): {
  DingTalkBinding: Model<IDingTalkBinding>;
  DingTalkConversation: Model<IDingTalkConversation>;
  DingTalkMessageReceipt: Model<IDingTalkMessageReceipt>;
} {
  applyTenantIsolation(dingtalkBindingSchema);
  applyTenantIsolation(dingtalkConversationSchema);
  applyTenantIsolation(dingtalkMessageReceiptSchema);

  return {
    DingTalkBinding:
      mongoose.models.DingTalkBinding ||
      mongoose.model<IDingTalkBinding>('DingTalkBinding', dingtalkBindingSchema),
    DingTalkConversation:
      mongoose.models.DingTalkConversation ||
      mongoose.model<IDingTalkConversation>('DingTalkConversation', dingtalkConversationSchema),
    DingTalkMessageReceipt:
      mongoose.models.DingTalkMessageReceipt ||
      mongoose.model<IDingTalkMessageReceipt>(
        'DingTalkMessageReceipt',
        dingtalkMessageReceiptSchema,
      ),
  };
}
