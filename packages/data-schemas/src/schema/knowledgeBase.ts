import { Schema } from 'mongoose';
import type { IKnowledgeBaseMongoDocument } from '~/types';

const knowledgeBaseSchema: Schema<IKnowledgeBaseMongoDocument> =
  new Schema<IKnowledgeBaseMongoDocument>(
    {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      description: {
        type: String,
        default: '',
      },
      author: {
        type: String,
        required: true,
        index: true,
      },
      authorName: {
        type: String,
        default: '',
      },
      provider: {
        type: String,
        enum: ['local', 'weknora'],
        index: true,
      },
      externalId: {
        type: String,
        index: true,
      },
      externalSpaceId: {
        type: String,
      },
      externalShareId: {
        type: String,
        default: '',
      },
      documentCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      readyDocumentCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      failedDocumentCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      processingDocumentCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastIndexedAt: {
        type: Date,
      },
      tenantId: {
        type: String,
        index: true,
      },
    },
    { timestamps: true },
  );

knowledgeBaseSchema.index({ tenantId: 1, name: 1 });
knowledgeBaseSchema.index({ tenantId: 1, updatedAt: -1 });
knowledgeBaseSchema.index(
  { tenantId: 1, provider: 1, externalId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: { $exists: true, $type: 'string' },
      externalId: { $exists: true, $type: 'string' },
    },
  },
);

export default knowledgeBaseSchema;
