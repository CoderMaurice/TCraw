import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button, Input, Label, Spinner, TextareaAutosize, useToastContext } from '@librechat/client';
import type { KnowledgeBase } from 'librechat-data-provider';
import { useDeleteKnowledgeBaseMutation, useUpdateKnowledgeBaseMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

type KnowledgeBaseSettingsProps = {
  knowledgeBase: KnowledgeBase;
  onDeleted: () => void;
};

export default function KnowledgeBaseSettings({
  knowledgeBase,
  onDeleted,
}: KnowledgeBaseSettingsProps) {
  const localize = useLocalize();
  const formId = useId();
  const [name, setName] = useState(knowledgeBase.name);
  const [description, setDescription] = useState(knowledgeBase.description ?? '');
  const updateKnowledgeBase = useUpdateKnowledgeBaseMutation(knowledgeBase.id);
  const deleteKnowledgeBase = useDeleteKnowledgeBaseMutation();
  const { showToast } = useToastContext();

  useEffect(() => {
    setName(knowledgeBase.name);
    setDescription(knowledgeBase.description ?? '');
  }, [knowledgeBase.description, knowledgeBase.name]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || updateKnowledgeBase.isLoading) {
      return;
    }

    try {
      await updateKnowledgeBase.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
      });
    } catch {
      showToast({
        message: localize('com_ui_knowledge_base_update_error'),
        status: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (deleteKnowledgeBase.isLoading) {
      return;
    }
    try {
      await deleteKnowledgeBase.mutateAsync(knowledgeBase.id);
      onDeleted();
    } catch {
      showToast({
        message: localize('com_ui_knowledge_base_delete_error'),
        status: 'error',
      });
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <form id={formId} onSubmit={handleSave} className="space-y-4">
        <h2 className="text-base font-semibold text-text-primary">
          {localize('com_ui_knowledge_base_settings')}
        </h2>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-name`} className="text-sm font-medium text-text-primary">
            {localize('com_ui_knowledge_base_name')}
          </Label>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full bg-transparent text-text-primary placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring-primary"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor={`${formId}-description`}
            className="text-sm font-medium text-text-primary"
          >
            {localize('com_ui_description')}
          </Label>
          <TextareaAutosize
            id={`${formId}-description`}
            minRows={3}
            aria-label={localize('com_ui_description')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="flex w-full rounded-md border border-border-medium bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          />
        </div>
        <Button
          type="submit"
          variant="submit"
          disabled={!name.trim() || updateKnowledgeBase.isLoading}
        >
          {updateKnowledgeBase.isLoading ? (
            <Spinner className="size-4" />
          ) : (
            localize('com_ui_save_changes')
          )}
        </Button>
      </form>

      <div className="border-t border-border-light pt-5">
        <Button
          type="button"
          variant="destructive"
          disabled={deleteKnowledgeBase.isLoading}
          onClick={handleDelete}
        >
          {deleteKnowledgeBase.isLoading ? (
            <Spinner className="size-4" />
          ) : (
            localize('com_ui_delete_knowledge_base')
          )}
        </Button>
      </div>
    </section>
  );
}
