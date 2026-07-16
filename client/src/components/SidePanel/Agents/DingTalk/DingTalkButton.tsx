import { MessageSquareMore } from 'lucide-react';
import { Button } from '@librechat/client';
import { Panel } from '~/common';
import { useLocalize } from '~/hooks';

interface DingTalkButtonProps {
  setActivePanel: (panel: Panel) => void;
}

export default function DingTalkButton({ setActivePanel }: DingTalkButtonProps) {
  const localize = useLocalize();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="btn btn-neutral border-token-border-light relative h-9 w-full gap-1 rounded-lg font-medium focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
      onClick={() => setActivePanel(Panel.dingtalk)}
      aria-label={localize('com_ui_dingtalk')}
    >
      <MessageSquareMore className="h-4 w-4" aria-hidden="true" />
      {localize('com_ui_dingtalk')}
    </Button>
  );
}
