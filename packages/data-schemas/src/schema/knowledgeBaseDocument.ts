import { Schema } from 'mongoose';
import type { IKnowledgeBaseDocumentMongo } from '~/types';

export const KNOWLEDGE_BASE_DOCUMENT_STATUSES = ['processing', 'ready', 'failed'] as const;

const knowledgeBaseDocumentSchema: Schema<IKnowledgeBaseDocumentMongo> =
  new Schema<IKnowledgeBaseDocumentMongo>(
    {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      knowledgeBaseId: {
        type: String,
        required: true,
        index: true,
      },
      file_id: {
        type: String,
        required: true,
        index: true,
      },
      filename: {
        type: String,
        required: true,
      },
      bytes: {
        type: Number,
        required: true,
        min: 0,
      },
      mimeType: {
        type: String,
        default: '',
      },
      status: {
        type: String,
        enum: KNOWLEDGE_BASE_DOCUMENT_STATUSES,
        required: true,
        default: 'processing',
        index: true,
      },
      error: {
        type: String,
        default: '',
      },
      createdBy: {
        type: String,
        required: true,
        index: true,
      },
      tenantId: {
        type: String,
        index: true,
      },
    },
    { timestamps: true },
  );

knowledgeBaseDocumentSchema.index({ tenantId: 1, knowledgeBaseId: 1, createdAt: -1 });
knowledgeBaseDocumentSchema.index({ tenantId: 1, knowledgeBaseId: 1, status: 1 });

export default knowledgeBaseDocumentSchema;
