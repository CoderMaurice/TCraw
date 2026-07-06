import type { FilterQuery, Model, Types } from 'mongoose';
import type {
  CreateKnowledgeBaseDocumentInput,
  CreateKnowledgeBaseInput,
  IKnowledgeBaseDocumentMongo,
  IKnowledgeBaseMongoDocument,
  IKnowledgeBaseDocument,
  IKnowledgeBase,
  UpdateKnowledgeBaseDocumentInput,
} from '~/types';

export type { KnowledgeBaseProvider } from '~/types';

export type UpdateKnowledgeBaseInput = Partial<Pick<IKnowledgeBase, 'name' | 'description'>>;

export type UpdateKnowledgeBaseLifecycleInput = Partial<
  Pick<
    IKnowledgeBase,
    | 'lifecycleStatus'
    | 'lifecycleStep'
    | 'lifecycleError'
    | 'externalShareId'
    | 'initializedAt'
    | 'lastSyncedAt'
    | 'configTemplateExternalId'
    | 'documentCount'
    | 'readyDocumentCount'
    | 'failedDocumentCount'
    | 'processingDocumentCount'
    | 'lastIndexedAt'
  >
>;

export type UpsertExternalKnowledgeBaseInput = CreateKnowledgeBaseInput &
  Required<Pick<IKnowledgeBase, 'provider' | 'externalId' | 'externalSpaceId'>> &
  Partial<Pick<IKnowledgeBase, 'externalShareId' | 'processingDocumentCount'>>;

export type ReadyKnowledgeBaseDocumentFileId = Pick<IKnowledgeBaseDocument, 'file_id'>;

export type DeleteKnowledgeBaseWithDocumentsResult = {
  deletedCount: number;
  documentDeletedCount: number;
};

export interface KnowledgeBaseMethods {
  createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<IKnowledgeBase>;
  findKnowledgeBaseById(id: string, tenantId?: string): Promise<IKnowledgeBase | null>;
  findKnowledgeBaseByExternalId(
    provider: string,
    externalId: string,
    tenantId?: string,
  ): Promise<IKnowledgeBase | null>;
  upsertExternalKnowledgeBase(input: UpsertExternalKnowledgeBaseInput): Promise<IKnowledgeBase>;
  findKnowledgeBasesByResourceIds(
    resourceIds: Array<string | Types.ObjectId>,
    tenantId?: string,
  ): Promise<IKnowledgeBase[]>;
  updateKnowledgeBase(
    id: string,
    tenantId: string | undefined,
    update: UpdateKnowledgeBaseInput,
  ): Promise<IKnowledgeBase | null>;
  updateKnowledgeBaseLifecycle(
    id: string,
    tenantId: string | undefined,
    update: UpdateKnowledgeBaseLifecycleInput,
  ): Promise<IKnowledgeBase | null>;
  createKnowledgeBaseDocument(
    input: CreateKnowledgeBaseDocumentInput,
  ): Promise<IKnowledgeBaseDocument>;
  findKnowledgeBaseDocuments(
    knowledgeBaseId: string,
    tenantId?: string,
  ): Promise<IKnowledgeBaseDocument[]>;
  findReadyKnowledgeBaseDocumentFileIds(
    knowledgeBaseIds: string[],
    tenantId?: string,
  ): Promise<ReadyKnowledgeBaseDocumentFileId[]>;
  updateKnowledgeBaseDocument(
    id: string,
    knowledgeBaseId: string,
    tenantId: string | undefined,
    update: UpdateKnowledgeBaseDocumentInput,
  ): Promise<IKnowledgeBaseDocument | null>;
  updateKnowledgeBaseCounts(id: string, tenantId?: string): Promise<IKnowledgeBase | null>;
  deleteKnowledgeBaseDocument(
    id: string,
    knowledgeBaseId: string,
    tenantId?: string,
  ): Promise<{ deletedCount: number }>;
  deleteKnowledgeBaseWithDocuments(
    id: string,
    tenantId?: string,
  ): Promise<DeleteKnowledgeBaseWithDocumentsResult>;
}

function tenantFilter<T>(tenantId?: string): FilterQuery<T> {
  return tenantId
    ? ({ tenantId } as FilterQuery<T>)
    : ({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] } as FilterQuery<T>);
}

function knowledgeBaseFilter(
  id: string,
  tenantId?: string,
): FilterQuery<IKnowledgeBaseMongoDocument> {
  return {
    id,
    ...tenantFilter<IKnowledgeBaseMongoDocument>(tenantId),
  };
}

function knowledgeBaseDocumentFilter(
  knowledgeBaseId: string,
  tenantId?: string,
): FilterQuery<IKnowledgeBaseDocumentMongo> {
  return {
    knowledgeBaseId,
    ...tenantFilter<IKnowledgeBaseDocumentMongo>(tenantId),
  };
}

export function createKnowledgeBaseMethods(
  mongoose: typeof import('mongoose'),
): KnowledgeBaseMethods {
  function getKnowledgeBaseModel(): Model<IKnowledgeBaseMongoDocument> {
    return mongoose.models.KnowledgeBase as Model<IKnowledgeBaseMongoDocument>;
  }

  function getKnowledgeBaseDocumentModel(): Model<IKnowledgeBaseDocumentMongo> {
    return mongoose.models.KnowledgeBaseDocument as Model<IKnowledgeBaseDocumentMongo>;
  }

  async function createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<IKnowledgeBase> {
    const KnowledgeBase = getKnowledgeBaseModel();
    const kb = await KnowledgeBase.create({
      ...input,
      name: input.name.trim(),
      description: input.description ?? '',
      authorName: input.authorName ?? '',
      documentCount: input.documentCount ?? 0,
      readyDocumentCount: input.readyDocumentCount ?? 0,
      failedDocumentCount: input.failedDocumentCount ?? 0,
    });
    return kb.toObject() as IKnowledgeBase;
  }

  async function findKnowledgeBaseById(
    id: string,
    tenantId?: string,
  ): Promise<IKnowledgeBase | null> {
    const KnowledgeBase = getKnowledgeBaseModel();
    return await KnowledgeBase.findOne(knowledgeBaseFilter(id, tenantId)).lean<IKnowledgeBase>();
  }

  async function findKnowledgeBaseByExternalId(
    provider: string,
    externalId: string,
    tenantId?: string,
  ): Promise<IKnowledgeBase | null> {
    const KnowledgeBase = getKnowledgeBaseModel();
    return await KnowledgeBase.findOne({
      provider,
      externalId,
      ...tenantFilter<IKnowledgeBaseMongoDocument>(tenantId),
    }).lean<IKnowledgeBase>();
  }

  async function upsertExternalKnowledgeBase(
    input: UpsertExternalKnowledgeBaseInput,
  ): Promise<IKnowledgeBase> {
    const KnowledgeBase = getKnowledgeBaseModel();
    const knowledgeBase = await KnowledgeBase.findOneAndUpdate(
      {
        provider: input.provider,
        externalId: input.externalId,
        ...tenantFilter<IKnowledgeBaseMongoDocument>(input.tenantId),
      },
      {
        $setOnInsert: {
          id: input.id,
          author: input.author,
          authorName: input.authorName ?? '',
          tenantId: input.tenantId,
        },
        $set: {
          name: input.name.trim(),
          description: input.description ?? '',
          provider: input.provider,
          externalId: input.externalId,
          externalSpaceId: input.externalSpaceId,
          externalShareId: input.externalShareId ?? '',
          lifecycleStatus: input.lifecycleStatus ?? 'ready',
          lifecycleStep: input.lifecycleStep ?? '',
          lifecycleError: input.lifecycleError ?? '',
          initializedAt: input.initializedAt ?? null,
          lastSyncedAt: input.lastSyncedAt ?? new Date(),
          configTemplateExternalId: input.configTemplateExternalId ?? '',
          documentCount: input.documentCount ?? 0,
          readyDocumentCount: input.readyDocumentCount ?? 0,
          failedDocumentCount: input.failedDocumentCount ?? 0,
          processingDocumentCount: input.processingDocumentCount ?? 0,
          lastIndexedAt: input.lastIndexedAt ?? null,
        },
      },
      { new: true, upsert: true, runValidators: true },
    ).lean<IKnowledgeBase>();

    if (!knowledgeBase) {
      throw new Error('Failed to upsert external knowledge base');
    }

    return knowledgeBase;
  }

  async function findKnowledgeBasesByResourceIds(
    resourceIds: Array<string | Types.ObjectId>,
    tenantId?: string,
  ): Promise<IKnowledgeBase[]> {
    if (resourceIds.length === 0) {
      return [];
    }

    const uniqueResourceIds: Array<string | Types.ObjectId> = [];
    const orderedKeys: string[] = [];
    const seen = new Set<string>();
    for (const resourceId of resourceIds) {
      const key = resourceId.toString();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      orderedKeys.push(key);
      uniqueResourceIds.push(resourceId);
    }

    const KnowledgeBase = getKnowledgeBaseModel();
    const knowledgeBases = await KnowledgeBase.find({
      _id: { $in: uniqueResourceIds },
      ...tenantFilter<IKnowledgeBaseMongoDocument>(tenantId),
    }).lean<IKnowledgeBase[]>();
    const byResourceId = new Map<string, IKnowledgeBase>();
    for (const kb of knowledgeBases) {
      if (kb._id) {
        byResourceId.set(kb._id.toString(), kb);
      }
    }

    const orderedKnowledgeBases: IKnowledgeBase[] = [];
    for (const key of orderedKeys) {
      const kb = byResourceId.get(key);
      if (!kb) {
        continue;
      }
      orderedKnowledgeBases.push(kb);
    }
    return orderedKnowledgeBases;
  }

  async function updateKnowledgeBase(
    id: string,
    tenantId: string | undefined,
    update: UpdateKnowledgeBaseInput,
  ): Promise<IKnowledgeBase | null> {
    const KnowledgeBase = getKnowledgeBaseModel();
    const $set: UpdateKnowledgeBaseInput = {};
    if (typeof update.name === 'string') {
      $set.name = update.name.trim();
    }
    if (typeof update.description === 'string') {
      $set.description = update.description;
    }
    if (Object.keys($set).length === 0) {
      return await findKnowledgeBaseById(id, tenantId);
    }
    return await KnowledgeBase.findOneAndUpdate(
      knowledgeBaseFilter(id, tenantId),
      { $set },
      { new: true, runValidators: true },
    ).lean<IKnowledgeBase>();
  }

  async function updateKnowledgeBaseLifecycle(
    id: string,
    tenantId: string | undefined,
    update: UpdateKnowledgeBaseLifecycleInput,
  ): Promise<IKnowledgeBase | null> {
    const KnowledgeBase = getKnowledgeBaseModel();
    const $set = Object.fromEntries(
      Object.entries(update).filter(([, value]) => value !== undefined),
    );

    if (Object.keys($set).length === 0) {
      return await findKnowledgeBaseById(id, tenantId);
    }

    return await KnowledgeBase.findOneAndUpdate(
      knowledgeBaseFilter(id, tenantId),
      { $set },
      { new: true, runValidators: true },
    ).lean<IKnowledgeBase>();
  }

  async function createKnowledgeBaseDocument(
    input: CreateKnowledgeBaseDocumentInput,
  ): Promise<IKnowledgeBaseDocument> {
    const KnowledgeBaseDocument = getKnowledgeBaseDocumentModel();
    const document = await KnowledgeBaseDocument.create({
      ...input,
      mimeType: input.mimeType ?? '',
      status: input.status ?? 'processing',
      error: input.error ?? '',
    });
    return document.toObject() as IKnowledgeBaseDocument;
  }

  async function findKnowledgeBaseDocuments(
    knowledgeBaseId: string,
    tenantId?: string,
  ): Promise<IKnowledgeBaseDocument[]> {
    const KnowledgeBaseDocument = getKnowledgeBaseDocumentModel();
    return await KnowledgeBaseDocument.find(knowledgeBaseDocumentFilter(knowledgeBaseId, tenantId))
      .sort({ createdAt: -1, _id: -1 })
      .lean<IKnowledgeBaseDocument[]>();
  }

  async function findReadyKnowledgeBaseDocumentFileIds(
    knowledgeBaseIds: string[],
    tenantId?: string,
  ): Promise<ReadyKnowledgeBaseDocumentFileId[]> {
    if (knowledgeBaseIds.length === 0) {
      return [];
    }
    const KnowledgeBaseDocument = getKnowledgeBaseDocumentModel();
    return await KnowledgeBaseDocument.find({
      knowledgeBaseId: { $in: knowledgeBaseIds },
      status: 'ready',
      ...tenantFilter<IKnowledgeBaseDocumentMongo>(tenantId),
    })
      .select('file_id -_id')
      .lean<ReadyKnowledgeBaseDocumentFileId[]>();
  }

  async function updateKnowledgeBaseDocument(
    id: string,
    knowledgeBaseId: string,
    tenantId: string | undefined,
    update: UpdateKnowledgeBaseDocumentInput,
  ): Promise<IKnowledgeBaseDocument | null> {
    const KnowledgeBaseDocument = getKnowledgeBaseDocumentModel();
    const $set: UpdateKnowledgeBaseDocumentInput = {};
    if (typeof update.filename === 'string') {
      $set.filename = update.filename.trim();
    }
    if (typeof update.bytes === 'number') {
      $set.bytes = update.bytes;
    }
    if (typeof update.mimeType === 'string') {
      $set.mimeType = update.mimeType;
    }
    if (typeof update.status === 'string') {
      $set.status = update.status;
    }
    if (typeof update.error === 'string') {
      $set.error = update.error;
    }

    if (Object.keys($set).length === 0) {
      return await KnowledgeBaseDocument.findOne({
        id,
        ...knowledgeBaseDocumentFilter(knowledgeBaseId, tenantId),
      }).lean<IKnowledgeBaseDocument>();
    }

    return await KnowledgeBaseDocument.findOneAndUpdate(
      {
        id,
        ...knowledgeBaseDocumentFilter(knowledgeBaseId, tenantId),
      },
      { $set },
      { new: true, runValidators: true },
    ).lean<IKnowledgeBaseDocument>();
  }

  async function updateKnowledgeBaseCounts(
    id: string,
    tenantId?: string,
  ): Promise<IKnowledgeBase | null> {
    const KnowledgeBase = getKnowledgeBaseModel();
    const KnowledgeBaseDocument = getKnowledgeBaseDocumentModel();
    const filter = knowledgeBaseDocumentFilter(id, tenantId);
    const [documentCount, readyDocumentCount, failedDocumentCount, latestReadyDocument] =
      await Promise.all([
        KnowledgeBaseDocument.countDocuments(filter),
        KnowledgeBaseDocument.countDocuments({ ...filter, status: 'ready' }),
        KnowledgeBaseDocument.countDocuments({ ...filter, status: 'failed' }),
        KnowledgeBaseDocument.findOne({ ...filter, status: 'ready' })
          .sort({ updatedAt: -1, _id: -1 })
          .select('updatedAt')
          .lean<Pick<IKnowledgeBaseDocument, 'updatedAt'>>(),
      ]);

    const update = latestReadyDocument?.updatedAt
      ? {
          $set: {
            documentCount,
            readyDocumentCount,
            failedDocumentCount,
            lastIndexedAt: latestReadyDocument.updatedAt,
          },
        }
      : {
          $set: {
            documentCount,
            readyDocumentCount,
            failedDocumentCount,
          },
          $unset: { lastIndexedAt: '' },
        };

    return await KnowledgeBase.findOneAndUpdate(knowledgeBaseFilter(id, tenantId), update, {
      new: true,
      runValidators: true,
    }).lean<IKnowledgeBase>();
  }

  async function deleteKnowledgeBaseDocument(
    id: string,
    knowledgeBaseId: string,
    tenantId?: string,
  ): Promise<{ deletedCount: number }> {
    const KnowledgeBaseDocument = getKnowledgeBaseDocumentModel();
    const result = await KnowledgeBaseDocument.deleteOne({
      id,
      ...knowledgeBaseDocumentFilter(knowledgeBaseId, tenantId),
    });
    return { deletedCount: result.deletedCount ?? 0 };
  }

  async function deleteKnowledgeBaseWithDocuments(
    id: string,
    tenantId?: string,
  ): Promise<DeleteKnowledgeBaseWithDocumentsResult> {
    const KnowledgeBase = getKnowledgeBaseModel();
    const KnowledgeBaseDocument = getKnowledgeBaseDocumentModel();
    const kb = await KnowledgeBase.findOne(knowledgeBaseFilter(id, tenantId))
      .select('id')
      .lean<IKnowledgeBase>();
    if (!kb) {
      return { deletedCount: 0, documentDeletedCount: 0 };
    }

    const [documentResult, kbResult] = await Promise.all([
      KnowledgeBaseDocument.deleteMany(knowledgeBaseDocumentFilter(id, tenantId)),
      KnowledgeBase.deleteOne(knowledgeBaseFilter(id, tenantId)),
    ]);

    return {
      deletedCount: kbResult.deletedCount ?? 0,
      documentDeletedCount: documentResult.deletedCount ?? 0,
    };
  }

  return {
    createKnowledgeBase,
    findKnowledgeBaseById,
    findKnowledgeBaseByExternalId,
    upsertExternalKnowledgeBase,
    findKnowledgeBasesByResourceIds,
    updateKnowledgeBase,
    updateKnowledgeBaseLifecycle,
    createKnowledgeBaseDocument,
    findKnowledgeBaseDocuments,
    findReadyKnowledgeBaseDocumentFileIds,
    updateKnowledgeBaseDocument,
    updateKnowledgeBaseCounts,
    deleteKnowledgeBaseDocument,
    deleteKnowledgeBaseWithDocuments,
  };
}
