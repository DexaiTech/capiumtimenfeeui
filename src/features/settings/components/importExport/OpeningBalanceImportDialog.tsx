import { Download, FileUp } from 'lucide-react';
import { useId, useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, DataTable, Modal, useToast, type DataTableColumn } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useImportOpeningBalanceTime } from '../../api/adminHooks';
import type { ImportRowError, OpeningBalanceTimeImportResult } from '../../adminTypes';
import { downloadOpeningBalanceTemplate } from '../../utils/openingBalanceImport';
import { DialogActions } from '../DialogActions';
import { ImportInstructionsButton } from '@/components/common/ImportInstructionsButton';
import { OPENING_BALANCES_SHEET } from '@/utils/importInstructions';

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

const ERROR_COLUMNS: DataTableColumn<ImportRowError>[] = [
  { id: 'row', header: 'Row', cell: (error) => error.row, className: 'w-16' },
  { id: 'field', header: 'Field', cell: (error) => error.field },
  { id: 'problem', header: 'Problem', cell: (error) => error.message, className: 'min-w-48' },
];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function ImportBody({ onClose }: { onClose: () => void }) {
  const inputId = useId();
  const { toast } = useToast();
  const importer = useImportOpeningBalanceTime();
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<OpeningBalanceTimeImportResult | null>(null);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);

  const choose = (next: File | null) => {
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

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setFailure(null);
    setRowErrors([]);
    try {
      const result = await importer.mutateAsync({ file, dryRun });
      if (dryRun) {
        setCheck(result);
        setRowErrors(result.errors);
        return;
      }
      toast({
        tone: 'success',
        title: `${plural(result.created, 'time entry', 'time entries')} imported`,
      });
      onClose();
    } catch (error) {
      if (dryRun) setCheck(null);
      onError(error);
    }
  };

  const ready = check !== null && check.errors.length === 0 && check.valid_rows > 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          Upload a CSV of historic unbilled time from a previous system (at most 100 rows): client
          code, staff email, date (ISO <code>YYYY-MM-DD</code>) and hours are required; activity
          code, job number and billable (Y/N, default Y) are optional. The file is checked first;
          nothing is created until every row is valid. Imported time is shown separately from newly
          recorded time, and can still be billed together with it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={inputId}
            className="field-required inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-text hover:bg-surface-hover md:h-9"
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
            aria-required="true"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
          <span className="text-sm text-text-muted">{file ? file.name : 'No file chosen'}</span>
          <span className="ml-auto flex items-center gap-1">
            <ImportInstructionsButton sheet={OPENING_BALANCES_SHEET} />
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Download className="size-4" aria-hidden="true" />}
              onClick={downloadOpeningBalanceTemplate}
            >
              Download template
            </Button>
          </span>
        </div>

        {failure ? <FormAlert message={failure.message} requestId={failure.requestId} /> : null}

        {check ? (
          <div role="status" className="text-sm text-text">
            {plural(check.total_rows, 'row', 'rows')} checked: {check.valid_rows} valid,{' '}
            {plural(check.errors.length, 'error', 'errors')}.
            {check.ignored_columns.length > 0 ? (
              <span className="block text-text-muted">
                Ignored columns: {check.ignored_columns.join(', ')}
              </span>
            ) : null}
          </div>
        ) : null}

        {rowErrors.length > 0 ? (
          <DataTable
            caption="Rows with errors"
            columns={ERROR_COLUMNS}
            rows={rowErrors}
            rowKey={(error) => `${error.row}-${error.field}-${error.code}`}
          />
        ) : null}
      </div>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {ready ? (
          <Button variant="primary" loading={importer.isPending} onClick={() => void run(false)}>
            Import {plural(check.valid_rows, 'time entry', 'time entries')}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={!file}
            loading={importer.isPending}
            onClick={() => void run(true)}
          >
            Check file
          </Button>
        )}
      </DialogActions>
    </>
  );
}

export interface OpeningBalanceImportDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Import historic unbilled time from a CSV file: a check that lists every bad row, then the
 * real import. See `app/services/opening_balance_import.py` for the validation rules. */
export function OpeningBalanceImportDialog({ open, onClose }: OpeningBalanceImportDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import historic time"
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? <ImportBody onClose={onClose} /> : null}
    </Modal>
  );
}
