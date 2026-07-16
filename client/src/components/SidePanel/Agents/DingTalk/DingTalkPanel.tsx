import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, CircleCheck, CircleX, MessageSquareMore } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  SecretInput,
  Spinner,
  Switch,
  useToastContext,
} from '@librechat/client';
import type { DingTalkBindingStatus } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks/useLocalize';
import {
  useDeleteDingTalkBindingMutation,
  useDingTalkBindingQuery,
  useUpsertDingTalkBindingMutation,
} from '~/data-provider';
import { useAgentPanelContext } from '~/Providers';
import { Panel } from '~/common';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const statusStyles: Record<DingTalkBindingStatus, string> = {
  connected: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  connecting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  disabled: 'bg-surface-tertiary text-text-secondary',
};

export default function DingTalkPanel() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { agent_id, setActivePanel } = useAgentPanelContext();
  const selectedAgentId = agent_id ?? '';
  const bindingQuery = useDingTalkBindingQuery(selectedAgentId);
  const binding = bindingQuery.data?.binding ?? null;

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [robotCode, setRobotCode] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!binding) {
      setClientId('');
      setClientSecret('');
      setRobotCode('');
      setEnabled(true);
      return;
    }
    setClientId(binding.clientId);
    setClientSecret('');
    setRobotCode(binding.robotCode ?? '');
    setEnabled(binding.enabled);
  }, [binding]);

  const upsertBinding = useUpsertDingTalkBindingMutation(selectedAgentId, {
    onSuccess: (data) => {
      setClientSecret('');
      showToast({
        message:
          data.binding?.status === 'error'
            ? localize('com_ui_dingtalk_saved_connection_error')
            : localize('com_ui_dingtalk_saved'),
        status: data.binding?.status === 'error' ? 'warning' : 'success',
      });
    },
    onError: () => {
      showToast({ message: localize('com_ui_dingtalk_save_error'), status: 'error' });
    },
  });

  const deleteBinding = useDeleteDingTalkBindingMutation(selectedAgentId, {
    onSuccess: () => {
      showToast({ message: localize('com_ui_dingtalk_deleted'), status: 'success' });
    },
    onError: () => {
      showToast({ message: localize('com_ui_dingtalk_delete_error'), status: 'error' });
    },
  });

  const statusLabel = useMemo(() => {
    const status = binding?.status ?? 'disabled';
    const keys: Record<DingTalkBindingStatus, TranslationKeys> = {
      connected: 'com_ui_dingtalk_status_connected',
      connecting: 'com_ui_dingtalk_status_connecting',
      error: 'com_ui_dingtalk_status_error',
      disabled: 'com_ui_dingtalk_status_disabled',
    };
    return localize(keys[status]);
  }, [binding?.status, localize]);

  const isSaving = upsertBinding.isLoading;
  const isDeleting = deleteBinding.isLoading;
  const secretRequired = !binding;
  const canSave =
    selectedAgentId.length > 0 &&
    clientId.trim().length > 0 &&
    (!secretRequired || clientSecret.trim().length > 0) &&
    !isSaving &&
    !isDeleting;

  const handleSave = () => {
    upsertBinding.mutate({
      clientId: clientId.trim(),
      ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
      ...(robotCode.trim() ? { robotCode: robotCode.trim() } : {}),
      enabled,
    });
  };

  const handleDelete = () => {
    if (!window.confirm(localize('com_ui_dingtalk_delete_confirm'))) {
      return;
    }
    deleteBinding.mutate();
  };

  if (bindingQuery.isLoading) {
    return (
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <Spinner className="icon-md" aria-label={localize('com_ui_loading')} />
      </div>
    );
  }

  return (
    <div className="scrollbar-gutter-stable h-full min-h-[40vh] overflow-auto pb-8 text-sm">
      <header className="relative flex min-h-16 items-center justify-center px-12 py-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute left-0 h-9 w-9 p-0"
          onClick={() => setActivePanel(Panel.builder)}
          title={localize('com_ui_back_to_builder')}
          aria-label={localize('com_ui_back_to_builder')}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="flex items-center gap-2 text-lg font-medium">
          <MessageSquareMore className="h-5 w-5" aria-hidden="true" />
          {localize('com_ui_dingtalk_title')}
        </div>
      </header>

      <div className="space-y-5 px-2">
        <div className="flex items-start gap-3 border-y border-border-light bg-surface-secondary px-3 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" aria-hidden="true" />
          <p className="text-sm leading-5 text-text-secondary">
            {localize('com_ui_dingtalk_permission_warning')}
          </p>
        </div>

        <section className="space-y-3" aria-labelledby="dingtalk-connection-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="dingtalk-connection-heading" className="font-medium text-text-primary">
              {localize('com_ui_dingtalk_connection')}
            </h2>
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium',
                statusStyles[binding?.status ?? 'disabled'],
              )}
            >
              {binding?.status === 'connecting' && <Spinner className="h-3 w-3" />}
              {binding?.status === 'connected' && (
                <CircleCheck className="h-3 w-3" aria-hidden="true" />
              )}
              {binding?.status === 'error' && <CircleX className="h-3 w-3" aria-hidden="true" />}
              {statusLabel}
            </span>
          </div>

          {binding?.lastError && (
            <p role="alert" className="border-l-2 border-red-500 pl-3 text-xs text-red-600">
              {binding.lastError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="dingtalk-client-id">{localize('com_ui_client_id')}</Label>
            <Input
              id="dingtalk-client-id"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dingtalk-client-secret">{localize('com_ui_client_secret')}</Label>
            <SecretInput
              id="dingtalk-client-secret"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              placeholder={binding ? localize('com_ui_leave_blank_to_keep') : ''}
              autoComplete="new-password"
              controlsOnHover
              required={secretRequired}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dingtalk-robot-code">{localize('com_ui_dingtalk_robot_code')}</Label>
            <Input
              id="dingtalk-robot-code"
              value={robotCode}
              onChange={(event) => setRobotCode(event.target.value)}
              placeholder={localize('com_ui_optional')}
              autoComplete="off"
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <Label id="dingtalk-enabled-label" htmlFor="dingtalk-enabled">
                {localize('com_ui_dingtalk_enabled')}
              </Label>
              <p className="mt-1 text-xs text-text-secondary">
                {localize('com_ui_dingtalk_enabled_description')}
              </p>
            </div>
            <Switch
              id="dingtalk-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-labelledby="dingtalk-enabled-label"
            />
          </div>
        </section>

        <div className="flex gap-2 border-t border-border-light pt-4">
          {binding && (
            <Button
              type="button"
              variant="outline"
              className="h-9 text-red-600"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? <Spinner className="h-4 w-4" /> : localize('com_ui_delete')}
            </Button>
          )}
          <Button
            type="button"
            variant="submit"
            className="h-9 flex-1"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isSaving ? <Spinner className="h-4 w-4" /> : localize('com_ui_save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
