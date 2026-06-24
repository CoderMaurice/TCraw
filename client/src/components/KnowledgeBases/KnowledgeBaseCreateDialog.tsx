import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import type { KnowledgeBase } from 'librechat-data-provider';
import {
  Button,
  Input,
  Label,
  OGDialog,
  OGDialogTemplate,
  Spinner,
  TextareaAutosize,
  useToastContext,
} from '@librechat/client';
import { useCreateKnowledgeBaseMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

type KnowledgeBaseCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (knowledgeBase: KnowledgeBase) => void;
  children?: ReactNode;
  triggerRef?: MutableRefObject<HTMLButtonElement | null>;
};

export default function KnowledgeBaseCreateDialog({
  open,
  onOpenChange,
  onCreated,
  children,
  triggerRef,
}: KnowledgeBaseCreateDialogProps) {
  const localize = useLocalize();
  const formId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createKnowledgeBase = useCreateKnowledgeBaseMutation();
  const { showToast } = useToastContext();

  useEffect(() => {
    if (!open) {
      return;
    }
    const frameId = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen && !createKnowledgeBase.isLoading) {
      setName('');
      setDescription('');
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || createKnowledgeBase.isLoading) {
      return;
    }

    try {
      const knowledgeBase = await createKnowledgeBase.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      onOpenChange(false);
      onCreated?.(knowledgeBase);
    } catch {
      showToast({
        message: localize('com_ui_knowledge_base_create_error'),
        status: 'error',
      });
    }
  };

  return (
    <OGDialog open={open} onOpenChange={handleOpenChange} triggerRef={triggerRef}>
      {children}
      <OGDialogTemplate
        title={localize('com_ui_create_knowledge_base')}
        showCloseButton={true}
        className="w-11/12 max-w-lg bg-surface-primary text-text-primary"
        main={
          <form id={formId} onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-name`} className="text-sm font-medium text-text-primary">
                {localize('com_ui_knowledge_base_name')}
              </Label>
              <Input
                id={`${formId}-name`}
                ref={inputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={localize('com_ui_knowledge_base_name_placeholder')}
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
                placeholder={localize('com_ui_knowledge_base_description_placeholder')}
                className="flex w-full rounded-md border border-border-medium bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
              />
            </div>
          </form>
        }
        buttons={
          <Button
            type="submit"
            form={formId}
            variant="submit"
            disabled={!name.trim() || createKnowledgeBase.isLoading}
            aria-label={localize('com_ui_create_knowledge_base')}
          >
            {createKnowledgeBase.isLoading ? (
              <Spinner className="size-4" />
            ) : (
              localize('com_ui_create_knowledge_base')
            )}
          </Button>
        }
      />
    </OGDialog>
  );
}
