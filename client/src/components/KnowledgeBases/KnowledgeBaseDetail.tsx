import { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Clock3, Database, FileText, Timer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import type { KnowledgeBase } from 'librechat-data-provider';
import { useInfiniteKnowledgeBaseDocumentsQuery, useKnowledgeBaseQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { cn } from '~/utils';
import KnowledgeBaseAccess from './KnowledgeBaseAccess';
import KnowledgeBaseDocuments from './KnowledgeBaseDocuments';
import KnowledgeBaseSettings from './KnowledgeBaseSettings';

type KnowledgeBaseTab = 'documents' | 'access' | 'settings';

const tabs: Array<{ id: KnowledgeBaseTab; labelKey: TranslationKeys }> = [
  { id: 'documents', labelKey: 'com_ui_knowledge_base_documents' },
  { id: 'access', labelKey: 'com_ui_knowledge_base_access' },
  { id: 'settings', labelKey: 'com_ui_knowledge_base_settings' },
];

const providerLabelKeys: Record<NonNullable<KnowledgeBase['provider']>, TranslationKeys> = {
  local: 'com_ui_knowledge_base_provider_local',
  weknora: 'com_ui_knowledge_base_provider_weknora',
};

function formatKnowledgeBaseDate(dateString?: string) {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function KnowledgeBaseDetail() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [activeTab, setActiveTab] = useState<KnowledgeBaseTab>('documents');
  const { data: knowledgeBase, isLoading: isKnowledgeBaseLoading } = useKnowledgeBaseQuery(id);
  const {
    data: documentsData,
    isLoading: isDocumentsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteKnowledgeBaseDocumentsQuery(id, { limit: 50 }, {
    refetchInterval: (data) =>
      data?.pages.some((page) =>
        page.data.some((document) => document.status === 'processing'),
      )
        ? 2000
        : false,
  });

  const documents = useMemo(
    () => documentsData?.pages.flatMap((page) => page.data) ?? [],
    [documentsData?.pages],
  );

  if (isKnowledgeBaseLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (!knowledgeBase) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-secondary">
        {localize('com_ui_knowledge_base_not_found')}
      </div>
    );
  }

  const totalDocuments = knowledgeBase.documentCount ?? 0;
  const processingDocuments = knowledgeBase.processingDocumentCount ?? 0;
  const failedDocuments = knowledgeBase.failedDocumentCount ?? 0;
  const updatedDate = formatKnowledgeBaseDate(knowledgeBase.updatedAt);
  const providerLabelKey = providerLabelKeys[knowledgeBase.provider ?? 'local'];
  const providerLabel = localize(providerLabelKey);

  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-surface-primary text-text-primary">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-10 pt-4 md:px-6 lg:pt-8">
        <button
          type="button"
          onClick={() => navigate('/knowledge')}
          className="-ml-1.5 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {localize('com_ui_all_knowledge_bases')}
        </button>

        <header className="mt-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-secondary text-text-secondary">
            <Database className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-text-primary">
              {knowledgeBase.name}
            </h1>
            {knowledgeBase.description ? (
              <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">
                {knowledgeBase.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-secondary">
              <span
                aria-label={localize('com_ui_knowledge_base_source', { 0: providerLabel })}
                className="rounded-full border border-border-light px-2 py-0.5 text-xs font-medium text-text-secondary"
              >
                {providerLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" aria-hidden="true" />
                {localize('com_ui_knowledge_base_documents_count', {
                  0: String(totalDocuments),
                })}
              </span>
              {processingDocuments > 0 ? (
                <span className="flex items-center gap-1.5">
                  <Timer className="h-4 w-4" aria-hidden="true" />
                  {localize('com_ui_knowledge_base_status_processing_count', {
                    0: String(processingDocuments),
                  })}
                </span>
              ) : null}
              {failedDocuments > 0 ? (
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  {localize('com_ui_knowledge_base_status_failed_count', {
                    0: String(failedDocuments),
                  })}
                </span>
              ) : null}
              <span className="flex min-w-0 items-center gap-1.5">
                <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {updatedDate
                    ? localize('com_ui_knowledge_base_updated', { 0: updatedDate })
                    : localize('com_ui_unknown')}
                </span>
              </span>
            </div>
          </div>
        </header>

        <div className="mt-8 flex border-b border-border-light">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
                activeTab === tab.id
                  ? 'border-text-primary text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {localize(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === 'documents' ? (
            <KnowledgeBaseDocuments
              id={knowledgeBase.id}
              documents={documents}
              isLoading={isDocumentsLoading}
              isLoadingMore={isFetchingNextPage}
              hasMore={Boolean(hasNextPage)}
              onLoadMore={() => fetchNextPage()}
              provider={knowledgeBase.provider}
            />
          ) : null}
          {activeTab === 'access' ? (
            <KnowledgeBaseAccess resourceDbId={knowledgeBase._id} name={knowledgeBase.name} />
          ) : null}
          {activeTab === 'settings' ? (
            <KnowledgeBaseSettings
              knowledgeBase={knowledgeBase}
              onDeleted={() => navigate('/knowledge')}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default KnowledgeBaseDetail;
