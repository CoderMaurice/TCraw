import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { AgentCapabilities } from 'librechat-data-provider';
import { OGDialog, OGDialogContent } from '@librechat/client';
import type { KnowledgeBaseSelectorItem } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { useKnowledgeBaseSelectorQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export default function KnowledgeBases() {
  const localize = useLocalize();
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const selectedIds = useWatch({ control, name: 'knowledge_base_ids' }) ?? [];
  const { data, isLoading } = useKnowledgeBaseSelectorQuery(search || undefined, {
    enabled: isDialogOpen,
  });

  const selectorItems = data?.data ?? [];
  const itemById = useMemo(() => {
    const map = new Map<string, KnowledgeBaseSelectorItem>();
    selectorItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [selectorItems]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleKnowledgeBase = (item: KnowledgeBaseSelectorItem) => {
    const current = getValues('knowledge_base_ids') ?? [];
    const next = current.includes(item.id)
      ? current.filter((currentId) => currentId !== item.id)
      : [...current, item.id];

    setValue('knowledge_base_ids', next, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(AgentCapabilities.file_search, true, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const removeKnowledgeBase = (id: string) => {
    const current = getValues('knowledge_base_ids') ?? [];
    setValue(
      'knowledge_base_ids',
      current.filter((currentId) => currentId !== id),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <div className="w-full space-y-2">
      <label
        htmlFor="agent-knowledge-base-search"
        className="text-token-text-primary block text-sm font-medium"
      >
        {localize('com_ui_knowledge_bases')}
      </label>

      {selectedIds.length > 0 && (
        <div className="space-y-1">
          {selectedIds.map((id) => {
            const item = itemById.get(id);
            const name = item?.name ?? id;
            return (
              <div
                key={id}
                className="flex items-center justify-between rounded-md border border-border-light px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-text-primary" title={name}>
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => removeKnowledgeBase(id)}
                  className="ml-2 flex-shrink-0 text-text-secondary transition-colors hover:text-text-primary"
                  aria-label={localize('com_agents_remove_knowledge_base_var', { 0: name })}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsDialogOpen(true)}
        className="btn btn-neutral border-token-border-light relative h-9 w-full rounded-lg font-medium"
        aria-haspopup="dialog"
      >
        <div className="flex w-full items-center justify-center gap-2">
          {localize('com_agents_add_knowledge_base')}
        </div>
      </button>

      <OGDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <OGDialogContent
          aria-label={localize('com_ui_knowledge_bases')}
          className="w-11/12 max-w-[760px] overflow-hidden rounded-2xl border-border-medium p-0 shadow-xl"
          showCloseButton={false}
        >
          <div className="flex max-h-[720px] min-h-[520px] flex-col">
            <div className="flex items-center gap-2 border-b border-border-light px-6 py-4">
              <h2 className="text-base font-bold text-text-primary">
                {localize('com_ui_knowledge_bases')}
              </h2>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-light bg-transparent text-text-secondary transition-colors hover:border-border-medium hover:bg-surface-hover hover:text-text-primary"
                aria-label={localize('com_ui_close')}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-2 px-6 py-4">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
                  aria-hidden="true"
                />
                <input
                  id="agent-knowledge-base-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={cn(
                    'h-10 w-full rounded-xl border border-border-light bg-transparent pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary',
                    'focus:border-border-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
                  )}
                  placeholder={localize('com_agents_search_knowledge_bases')}
                  aria-label={localize('com_agents_search_knowledge_bases')}
                />
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-4"
              role="group"
              aria-label={localize('com_ui_knowledge_bases')}
            >
              {selectorItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectorItems.map((item) => {
                    const isSelected = selectedSet.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleKnowledgeBase(item)}
                        onMouseDown={(event) => event.preventDefault()}
                        className={cn(
                          'group relative flex h-28 cursor-pointer flex-col rounded-xl border p-3.5 text-left transition-all duration-200',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
                          isSelected
                            ? 'border-green-500/70 bg-green-500/[0.06]'
                            : 'border-border-light hover:border-border-medium hover:bg-surface-tertiary',
                        )}
                        aria-label={`${localize(
                          isSelected
                            ? 'com_agents_remove_knowledge_base_var'
                            : 'com_agents_add_knowledge_base',
                          { 0: item.name },
                        )}${isSelected ? '' : ` ${item.name}`}`}
                        aria-pressed={isSelected}
                      >
                        <div className="flex w-full items-start gap-2">
                          <p
                            className="min-w-0 flex-1 truncate pr-1 text-sm font-semibold text-text-primary"
                            title={item.name}
                          >
                            {item.name}
                          </p>
                          <span
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                              isSelected
                                ? 'scale-100 bg-green-500 text-white opacity-100'
                                : 'scale-75 bg-surface-tertiary text-text-tertiary opacity-0 group-hover:scale-100 group-hover:opacity-100',
                            )}
                            aria-hidden="true"
                          >
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-auto pt-2 text-xs text-text-secondary">
                          {item.readyDocumentCount} / {item.documentCount}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                !isLoading && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search
                      className="size-8 text-text-tertiary opacity-40"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm text-text-secondary">
                      {localize('com_agents_no_knowledge_bases')}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}
