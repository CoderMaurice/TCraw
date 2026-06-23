import { Model } from 'mongoose';
import type { IKnowledgeBaseDocumentMongo } from '~/types';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import knowledgeBaseDocumentSchema from '~/schema/knowledgeBaseDocument';

export function createKnowledgeBaseDocumentModel(
  mongoose: typeof import('mongoose'),
): Model<IKnowledgeBaseDocumentMongo> {
  applyTenantIsolation(knowledgeBaseDocumentSchema);
  return (
    mongoose.models.KnowledgeBaseDocument ||
    mongoose.model<IKnowledgeBaseDocumentMongo>(
      'KnowledgeBaseDocument',
      knowledgeBaseDocumentSchema,
      'knowledgebasedocuments',
    )
  );
}
