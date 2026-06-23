import { Model } from 'mongoose';
import type { IKnowledgeBaseMongoDocument } from '~/types';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import knowledgeBaseSchema from '~/schema/knowledgeBase';

export function createKnowledgeBaseModel(
  mongoose: typeof import('mongoose'),
): Model<IKnowledgeBaseMongoDocument> {
  applyTenantIsolation(knowledgeBaseSchema);
  return (
    mongoose.models.KnowledgeBase ||
    mongoose.model<IKnowledgeBaseMongoDocument>(
      'KnowledgeBase',
      knowledgeBaseSchema,
      'knowledgebases',
    )
  );
}
