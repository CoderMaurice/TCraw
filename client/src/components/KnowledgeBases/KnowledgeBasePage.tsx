import { useDeferredValue, useMemo, useState } from 'react';
import { Database, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Spinner, useMediaQuery } from '@librechat/client';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import { useKnowledgeBasesQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import KnowledgeBaseCreateDialog from './KnowledgeBaseCreateDialog';

export function KnowledgeBasePage() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  const { data, isLoading } = useKnowledgeBasesQuery({
    limit: 50,
    search: deferredSearch || undefined,
  });
  const knowledgeBases = useMemo(() => data?.data ?? [], [data?.data]);

  return (
    <main className="flex h-full min-h-0 flex-col overflow-auto bg-surface-primary text-text-primary">
      <div className="container mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 md:px-6 lg:pt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {isSmallScreen ? <OpenSidebar /> : null}
            <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              {localize('com_ui_knowledge_bases')}
            </h1>
          </div>
          <Button type="button" variant="submit" size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {localize('com_ui_create_knowledge_base')}
          </Button>
        </div>

        <label className="relative min-w-0 flex-1">
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

        <KnowledgeBaseCreateDialog
          open={isCreating}
          onOpenChange={setIsCreating}
          onCreated={(knowledgeBase) => navigate(`/knowledge/${knowledgeBase.id}`)}
        />

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="text-text-primary" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {knowledgeBases.map((knowledgeBase) => (
              <button
                key={knowledgeBase.id}
                type="button"
                className={cn(
                  'group/knowledge flex min-h-[8rem] flex-col rounded-xl border border-border-medium bg-surface-secondary p-4 text-left transition-colors',
                  'hover:border-border-heavy hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
                )}
                onClick={() => navigate(`/knowledge/${knowledgeBase.id}`)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Database
                    className="h-4 w-4 shrink-0 text-text-secondary"
                    aria-hidden="true"
                  />
                  <span className="truncate text-base font-semibold text-text-primary">
                    {knowledgeBase.name}
                  </span>
                </span>
                {knowledgeBase.description ? (
                  <span className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                    {knowledgeBase.description}
                  </span>
                ) : null}
                <span className="mt-auto pt-4 text-xs text-text-secondary">
                  {knowledgeBase.readyDocumentCount} / {knowledgeBase.documentCount}{' '}
                  {localize('com_ui_ready')}
                </span>
              </button>
            ))}
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
