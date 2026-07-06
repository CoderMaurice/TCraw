import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button, OGDialog, OGDialogTemplate, Spinner, useToastContext } from '@librechat/client';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Trash2,
  Upload,
} from 'lucide-react';
import type { KnowledgeBaseDocument } from 'librechat-data-provider';
import {
  useDeleteKnowledgeBaseDocumentMutation,
  useUploadKnowledgeBaseDocumentsMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { cn } from '~/utils';

type KnowledgeBaseDocumentsProps = {
  id: string;
  documents: KnowledgeBaseDocument[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  provider?: 'local' | 'weknora';
  lifecycleStatus?: string;
  totalDocuments?: number;
  readyDocuments?: number;
  processingDocuments?: number;
  failedDocuments?: number;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const documentStatusLabelKeys: Record<KnowledgeBaseDocument['status'], TranslationKeys> = {
  processing: 'com_ui_knowledge_base_status_processing',
  ready: 'com_ui_knowledge_base_status_ready',
  failed: 'com_ui_knowledge_base_status_failed',
};

function formatDocumentDate(dateString?: string) {
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

export default function KnowledgeBaseDocuments({
  id,
  documents,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  provider = 'local',
  lifecycleStatus,
  totalDocuments = documents.length,
  readyDocuments = documents.filter((document) => document.status === 'ready').length,
  processingDocuments = documents.filter((document) => document.status === 'processing').length,
  failedDocuments = documents.filter((document) => document.status === 'failed').length,
}: KnowledgeBaseDocumentsProps) {
  const localize = useLocalize();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFailedDocument, setSelectedFailedDocument] =
    useState<KnowledgeBaseDocument | null>(null);
  const deleteDocument = useDeleteKnowledgeBaseDocumentMutation(id);
  const uploadDocuments = useUploadKnowledgeBaseDocumentsMutation(id);
  const { showToast } = useToastContext();
  const canDeleteDocuments = provider !== 'weknora';
  const canUploadDocuments = provider === 'weknora' && lifecycleStatus === 'ready';
  const triggerFileUpload = () => fileInputRef.current?.click();
  let documentsContent: ReactNode;

  const handleDelete = async (documentId: string) => {
    if (deleteDocument.isLoading) {
      return;
    }
    try {
      await deleteDocument.mutateAsync(documentId);
    } catch {
      showToast({
        message: localize('com_ui_knowledge_base_document_delete_error'),
        status: 'error',
      });
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploadDocuments.isLoading) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      await uploadDocuments.mutateAsync(formData);
    } catch {
      showToast({
        message: localize('com_ui_knowledge_base_upload_error'),
        status: 'error',
      });
    }
  };

  if (isLoading) {
    documentsContent = (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    );
  } else if (documents.length === 0) {
    documentsContent = (
      <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border-medium bg-surface-secondary px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-light bg-surface-primary text-text-secondary">
          <FileText className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-text-primary">
            {localize('com_ui_no_knowledge_base_documents')}
          </p>
          <p className="text-xs text-text-secondary">
            {localize('com_ui_knowledge_base_documents_count', { 0: '0' })}
          </p>
        </div>
        {canUploadDocuments ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadDocuments.isLoading}
            onClick={triggerFileUpload}
          >
            {uploadDocuments.isLoading ? (
              <Spinner className="size-4" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {localize('com_ui_upload_documents')}
          </Button>
        ) : null}
      </div>
    );
  } else {
    documentsContent = (
      <div className="overflow-x-auto rounded-lg border border-border-medium">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-[minmax(0,1.5fr)_8rem_7rem_8rem_7rem] items-center gap-3 border-b border-border-light bg-surface-secondary px-4 py-2.5 text-xs font-medium text-text-secondary">
            <span>{localize('com_ui_filename')}</span>
            <span>{localize('com_ui_status')}</span>
            <span>{localize('com_ui_size')}</span>
            <span>{localize('com_ui_knowledge_base_updated', { 0: '' }).trim()}</span>
            <span className="text-right">{localize('com_ui_detailed')}</span>
          </div>
          {documents.map((document) => {
            const updatedDate = formatDocumentDate(document.updatedAt || document.createdAt);
            return (
              <div
                key={document.id}
                className="grid grid-cols-[minmax(0,1.5fr)_8rem_7rem_8rem_7rem] items-center gap-3 border-b border-border-light px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-surface-hover"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                  <span className="truncate font-medium text-text-primary">
                    {document.filename}
                  </span>
                </span>
                <span
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs',
                    document.status === 'ready' &&
                      'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300',
                    document.status === 'processing' &&
                      'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
                    document.status === 'failed' &&
                      'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
                  )}
                >
                  {document.status === 'ready' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : null}
                  {document.status === 'processing' ? (
                    <LoaderCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : null}
                  {document.status === 'failed' ? (
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : null}
                  {localize(documentStatusLabelKeys[document.status])}
                </span>
                <span className="truncate text-text-secondary">{formatBytes(document.bytes)}</span>
                <span className="truncate text-text-secondary">
                  {updatedDate || localize('com_ui_unknown')}
                </span>
                <span className="flex justify-end gap-1">
                  {document.status === 'failed' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      onClick={() => setSelectedFailedDocument(document)}
                    >
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                      {localize('com_ui_knowledge_base_view_failure_reason')}
                    </Button>
                  ) : null}
                  {canDeleteDocuments ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={localize('com_ui_delete_document')}
                      disabled={deleteDocument.isLoading}
                      onClick={() => handleDelete(document.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h2 className="text-base font-semibold text-text-primary">
            {localize('com_ui_knowledge_base_documents')}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-1">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {localize('com_ui_knowledge_base_documents_count', {
                0: String(totalDocuments),
              })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {localize('com_ui_knowledge_base_status_ready')}: {readyDocuments}
            </span>
            {processingDocuments > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-1">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {localize('com_ui_knowledge_base_status_processing_count', {
                  0: String(processingDocuments),
                })}
              </span>
            ) : null}
            {failedDocuments > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {localize('com_ui_knowledge_base_status_failed_count', {
                  0: String(failedDocuments),
                })}
              </span>
            ) : null}
          </div>
        </div>
        {canUploadDocuments ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              aria-label={localize('com_ui_upload_documents')}
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadDocuments.isLoading}
              onClick={triggerFileUpload}
            >
              {uploadDocuments.isLoading ? (
                <Spinner className="size-4" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              {localize('com_ui_upload_documents')}
            </Button>
          </div>
        ) : null}
      </div>

      {documentsContent}

      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore ? <Spinner className="size-4" /> : null}
            {localize('com_ui_load_more')}
          </Button>
        </div>
      ) : null}

      <OGDialog
        open={Boolean(selectedFailedDocument)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFailedDocument(null);
          }
        }}
      >
        {selectedFailedDocument ? (
          <OGDialogTemplate
            title={localize('com_ui_knowledge_base_failure_reason')}
            showCloseButton={true}
            className="w-11/12 max-w-lg bg-surface-primary text-text-primary"
            main={
              <div className="space-y-3 text-left">
                <p className="text-sm font-medium text-text-primary">
                  {selectedFailedDocument.filename}
                </p>
                <pre className="max-h-64 whitespace-pre-wrap rounded-lg border border-border-light bg-surface-secondary p-3 text-sm text-text-secondary">
                  {selectedFailedDocument.error?.trim() ||
                    localize('com_ui_knowledge_base_failure_reason_empty')}
                </pre>
              </div>
            }
            buttons={
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedFailedDocument(null)}
                >
                  {localize('com_ui_close')}
                </Button>
              </div>
            }
          />
        ) : null}
      </OGDialog>
    </section>
  );
}
