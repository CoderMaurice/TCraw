import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { AgentCapabilities } from 'librechat-data-provider';
import type { KnowledgeBaseSelectorItem } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { useKnowledgeBaseSelectorQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export default function KnowledgeBases() {
  const localize = useLocalize();
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const [search, setSearch] = useState('');
  const selectedIds = useWatch({ control, name: 'knowledge_base_ids' }) ?? [];
  const { data, isLoading } = useKnowledgeBaseSelectorQuery(search || undefined);

  const selectorItems = data?.data ?? [];
  const itemById = useMemo(() => {
    const map = new Map<string, KnowledgeBaseSelectorItem>();
    selectorItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [selectorItems]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const availableItems = selectorItems.filter((item) => !selectedSet.has(item.id));

  const addKnowledgeBase = (item: KnowledgeBaseSelectorItem) => {
    const current = getValues('knowledge_base_ids') ?? [];
    if (!current.includes(item.id)) {
      setValue('knowledge_base_ids', [...current, item.id], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
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

      <input
        id="agent-knowledge-base-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className={cn(
          'flex h-9 w-full rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
        )}
        placeholder={localize('com_agents_search_knowledge_bases')}
        aria-label={localize('com_agents_search_knowledge_bases')}
      />

      <div className="space-y-1">
        {availableItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => addKnowledgeBase(item)}
            className="flex w-full items-center justify-between rounded-md border border-border-light px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
            aria-label={`${localize('com_agents_add_knowledge_base')} ${item.name}`}
          >
            <span className="min-w-0 truncate text-text-primary">{item.name}</span>
            <span className="ml-2 flex-shrink-0 text-xs text-text-secondary">
              {item.readyDocumentCount} / {item.documentCount}
            </span>
          </button>
        ))}
        {!isLoading && availableItems.length === 0 && (
          <p className="text-sm text-text-secondary">{localize('com_agents_no_knowledge_bases')}</p>
        )}
      </div>
    </div>
  );
}
