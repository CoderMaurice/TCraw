import { useDeferredValue, useMemo, useState } from 'react';
import { AlertCircle, Clock3, Database, FileText, Plus, Search, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Spinner, useMediaQuery } from '@librechat/client';
import type { KnowledgeBase } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import { useKnowledgeBaseCapabilitiesQuery, useKnowledgeBasesQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import KnowledgeBaseCreateDialog from './KnowledgeBaseCreateDialog';

const accessLabelKeys: Record<NonNullable<KnowledgeBase['access']>, TranslationKeys> = {
  owned: 'com_ui_knowledge_base_access_owned',
  shared: 'com_ui_knowledge_base_access_shared',
  team: 'com_ui_knowledge_base_access_team',
};

const lifecycleLabelKeys: Partial<
  Record<NonNullable<KnowledgeBase['lifecycleStatus']>, TranslationKeys>
> = {
  creating_external: 'com_ui_knowledge_lifecycle_creating_external',
  initializing: 'com_ui_knowledge_lifecycle_initializing',
  sharing: 'com_ui_knowledge_lifecycle_sharing',
  failed: 'com_ui_knowledge_lifecycle_failed',
  archived: 'com_ui_knowledge_lifecycle_archived',
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

export function KnowledgeBasePage() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  const { data: capabilities } = useKnowledgeBaseCapabilitiesQuery();
  const { data, isLoading } = useKnowledgeBasesQuery({
    limit: 50,
    search: deferredSearch || undefined,
  });
  const knowledgeBases = useMemo(() => data?.data ?? [], [data?.data]);
  const canCreateKnowledgeBase = capabilities?.weknora.canCreate === true;

  return (
    <main className="flex h-full min-h-0 flex-col overflow-auto bg-surface-primary text-text-primary">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-6 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {isSmallScreen ? <OpenSidebar /> : null}
            <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              {localize('com_ui_knowledge_bases')}
            </h1>
          </div>
          {canCreateKnowledgeBase ? (
            <KnowledgeBaseCreateDialog
              open={isCreateOpen}
              onOpenChange={setIsCreateOpen}
              onCreated={(knowledgeBase) => navigate(`/knowledge/${knowledgeBase.id}`)}
            >
              <Button
                type="button"
                variant="submit"
                className="gap-2"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {localize('com_ui_create_knowledge_base')}
              </Button>
            </KnowledgeBaseCreateDialog>
          ) : null}
        </div>

        <label className="relative min-w-0">
          <span className="sr-only">{localize('com_ui_search_knowledge_bases')}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <Input
            role="searchbox"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize('com_ui_search_knowledge_bases')}
            aria-label={localize('com_ui_search_knowledge_bases')}
            className="border-border-medium bg-surface-secondary pl-9 text-text-primary placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring-primary"
          />
        </label>

        {isLoading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Spinner className="text-text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {knowledgeBases.map((knowledgeBase) => {
              const totalDocuments = knowledgeBase.documentCount ?? 0;
              const processingDocuments = knowledgeBase.processingDocumentCount ?? 0;
              const failedDocuments = knowledgeBase.failedDocumentCount ?? 0;
              const updatedDate = formatKnowledgeBaseDate(knowledgeBase.updatedAt);
              const accessLabelKey = accessLabelKeys[knowledgeBase.access ?? 'owned'];
              const lifecycleLabelKey =
                knowledgeBase.lifecycleStatus && knowledgeBase.lifecycleStatus !== 'ready'
                  ? lifecycleLabelKeys[knowledgeBase.lifecycleStatus]
                  : undefined;

              return (
                <button
                  key={knowledgeBase.id}
                  type="button"
                  className={cn(
                    'group/knowledge flex min-h-[11rem] flex-col rounded-lg border border-border-medium bg-surface-secondary p-4 text-left transition-colors',
                    'hover:border-border-heavy hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
                  )}
                  onClick={() => navigate(`/knowledge/${knowledgeBase.id}`)}
                >
                  <span className="flex min-w-0 items-start justify-between gap-3">
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-light bg-surface-primary text-text-secondary">
                        <Database className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold text-text-primary">
                          {knowledgeBase.name}
                        </span>
                        <span className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-text-secondary">
                          {knowledgeBase.description ||
                            localize('com_ui_knowledge_base_empty_description')}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-text-secondary">
                        {localize(accessLabelKey)}
                      </span>
                      {lifecycleLabelKey ? (
                        <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary">
                          {localize(lifecycleLabelKey)}
                        </span>
                      ) : null}
                    </span>
                  </span>

                  <span className="mt-auto flex flex-col gap-2 border-t border-border-light pt-3 text-xs text-text-secondary">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        {localize('com_ui_knowledge_base_documents_count', {
                          0: String(totalDocuments),
                        })}
                      </span>
                      {processingDocuments > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                          {localize('com_ui_knowledge_base_status_processing_count', {
                            0: String(processingDocuments),
                          })}
                        </span>
                      ) : null}
                      {failedDocuments > 0 ? (
                        <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          {localize('com_ui_knowledge_base_status_failed_count', {
                            0: String(failedDocuments),
                          })}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {updatedDate
                          ? localize('com_ui_knowledge_base_updated', { 0: updatedDate })
                          : localize('com_ui_unknown')}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && knowledgeBases.length === 0 && (
          <div className="rounded-lg border border-border-medium bg-transparent py-16 text-center text-sm text-text-secondary">
            {localize('com_ui_no_knowledge_bases')}
          </div>
        )}
      </div>
    </main>
  );
}

export default KnowledgeBasePage;
