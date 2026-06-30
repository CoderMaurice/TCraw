import { useRef, useState, type ChangeEvent } from 'react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import { FileText, Trash2, Upload } from 'lucide-react';
import type { KnowledgeBaseDocument } from 'librechat-data-provider';
import {
  useDeleteKnowledgeBaseDocumentMutation,
  useUploadKnowledgeBaseDocumentsMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';

type KnowledgeBaseDocumentsProps = {
  id: string;
  documents: KnowledgeBaseDocument[];
  isLoading: boolean;
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

export default function KnowledgeBaseDocuments({
  id,
  documents,
  isLoading,
}: KnowledgeBaseDocumentsProps) {
  const localize = useLocalize();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const uploadDocuments = useUploadKnowledgeBaseDocumentsMutation(id);
  const deleteDocument = useDeleteKnowledgeBaseDocumentMutation(id);
  const { showToast } = useToastContext();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!file || uploadDocuments.isLoading) {
      return;
    }
    const formData = new FormData();
    formData.append('file', file);

    try {
      await uploadDocuments.mutateAsync(formData);
      setFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch {
      showToast({
        message: localize('com_ui_knowledge_base_upload_error'),
        status: 'error',
      });
    }
  };

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

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">
          {localize('com_ui_knowledge_base_documents')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            aria-label={localize('com_ui_select_files')}
            onChange={handleFileChange}
            className="max-w-56 text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface-tertiary"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!file || uploadDocuments.isLoading}
            onClick={handleUpload}
          >
            {uploadDocuments.isLoading ? (
              <Spinner className="size-4" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {localize('com_ui_upload_documents')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner className="text-text-primary" />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-border-medium py-12 text-center text-sm text-text-secondary">
          {localize('com_ui_no_knowledge_base_documents')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-medium">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_3rem] items-center gap-3 border-b border-border-light bg-surface-secondary px-3 py-2 text-xs font-medium uppercase text-text-secondary">
            <span>{localize('com_ui_filename')}</span>
            <span>{localize('com_ui_status')}</span>
            <span>{localize('com_ui_size')}</span>
            <span className="sr-only">{localize('com_ui_delete')}</span>
          </div>
          {documents.map((document) => (
            <div
              key={document.id}
              className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_3rem] items-center gap-3 border-b border-border-light px-3 py-3 text-sm last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                <span className="truncate text-text-primary">{document.filename}</span>
              </span>
              <span className="truncate text-text-secondary">
                {localize(documentStatusLabelKeys[document.status])}
              </span>
              <span className="truncate text-text-secondary">{formatBytes(document.bytes)}</span>
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
