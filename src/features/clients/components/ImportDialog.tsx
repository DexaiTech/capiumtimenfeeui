import { Download, FileUp } from 'lucide-react';
import { useId, useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, Modal, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useImportClients } from '../api';
import { downloadImportTemplate } from '../template';
import type { ImportResult, ImportRowError } from '../types';

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

function isRowErrorList(details: unknown): details is ImportRowError[] {
  return (
    Array.isArray(details) &&
    details.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as ImportRowError).row === 'number' &&
        typeof (entry as ImportRowError).message === 'string',
    )
  );
}

function RowErrors({ errors }: { errors: ImportRowError[] }) {
  return (
    <div className="capium-clients">
      <div className="cc-import-errors">
        <table aria-label="Rows with errors">
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Field</th>
              <th scope="col">Problem</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((error, index) => (
              <tr key={`${error.row}-${error.field}-${index}`}>
                <td>{error.row}</td>
                <td>{error.field}</td>
                <td>{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const inputId = useId();
  const { toast } = useToast();
  const importer = useImportClients();
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<ImportResult | null>(null);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);

  const reset = (next: File | null) => {
    setFile(next);
    setCheck(null);
    setRowErrors([]);
    setFailure(null);
  };

  const onError = (error: unknown) => {
    if (isApiError(error)) {
      if (isRowErrorList(error.details)) setRowErrors(error.details);
      setFailure({ message: error.message, requestId: error.requestId });
    } else {
      setFailure({ message: 'The file could not be uploaded. Please try again.' });
    }
  };

  const runCheck = async () => {
    if (!file) return;
    setFailure(null);
    setRowErrors([]);
    try {
      const result = await importer.mutateAsync({ file, dryRun: true });
      setCheck(result);
      setRowErrors(result.errors);
    } catch (error) {
      setCheck(null);
      onError(error);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setFailure(null);
    try {
      const result = await importer.mutateAsync({ file, dryRun: false });
      toast({
        tone: 'success',
        title: `${result.created} client${result.created === 1 ? '' : 's'} imported`,
      });
      onClose();
    } catch (error) {
      onError(error);
    }
  };

  const ready = check !== null && check.errors.length === 0 && check.valid_rows > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Upload a CSV with a header row (at most 5 MB and 5000 rows). The file is checked first;
        nothing is created until every row is valid.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-text hover:bg-surface-hover md:h-9"
        >
          <FileUp className="size-4" aria-hidden="true" />
          Choose CSV file
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="CSV file"
          onChange={(event) => reset(event.target.files?.[0] ?? null)}
        />
        <span className="text-sm text-text-muted">{file ? file.name : 'No file chosen'}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          leftIcon={<Download className="size-4" aria-hidden="true" />}
          onClick={downloadImportTemplate}
        >
          Download template
        </Button>
      </div>

      {failure ? <FormAlert message={failure.message} requestId={failure.requestId} /> : null}

      {check ? (
        <div role="status" className="text-sm text-text">
          {check.total_rows} row{check.total_rows === 1 ? '' : 's'} checked: {check.valid_rows}{' '}
          valid, {check.errors.length} error{check.errors.length === 1 ? '' : 's'}.
          {check.ignored_columns.length > 0 ? (
            <span className="block text-text-muted">
              Ignored columns: {check.ignored_columns.join(', ')}
            </span>
          ) : null}
        </div>
      ) : null}

      {rowErrors.length > 0 ? <RowErrors errors={rowErrors} /> : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Cancel</Button>
        {ready ? (
          <Button variant="primary" loading={importer.isPending} onClick={() => void runImport()}>
            Import {check.valid_rows} client{check.valid_rows === 1 ? '' : 's'}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={!file}
            loading={importer.isPending}
            onClick={() => void runCheck()}
          >
            Check file
          </Button>
        )}
      </div>
    </div>
  );
}

/** Import clients from CSV: a dry run with per-row errors, then the real import. */
export function ImportDialog({ open, onClose }: ImportDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Import clients" size="lg" closeOnBackdrop={false}>
      {open ? <ImportBody onClose={onClose} /> : null}
    </Modal>
  );
}
