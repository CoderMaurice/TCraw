import { Button } from '@librechat/client';
import { ResourceType } from 'librechat-data-provider';
import { Share2 } from 'lucide-react';
import { GenericGrantAccessDialog } from '~/components/Sharing';
import { useLocalize } from '~/hooks';

type KnowledgeBaseAccessProps = {
  resourceDbId?: string;
  name: string;
};

export default function KnowledgeBaseAccess({ resourceDbId, name }: KnowledgeBaseAccessProps) {
  const localize = useLocalize();

  if (!resourceDbId) {
    return null;
  }

  return (
    <GenericGrantAccessDialog
      resourceDbId={resourceDbId}
      resourceType={ResourceType.KNOWLEDGE_BASE}
      resourceName={name}
    >
      <Button type="button" variant="outline" size="sm">
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {localize('com_ui_share')}
      </Button>
    </GenericGrantAccessDialog>
  );
}
