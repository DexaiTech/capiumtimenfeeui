import { Download, FileUp } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { FormAlert } from '@/components/forms';
import {
  Button,
  Checkbox,
  DataTable,
  Modal,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { isApiError } from '@/services/api';

import type { BulkImportRequest } from '../../api/adminHooks';
import type { BulkImportResult, ImportRowError } from '../../adminTypes';
import { downloadImportTemplate, type BulkImportKind } from '../../utils/bulkImport';
import { DialogActions } from '../DialogActions';
import { ImportInstructionsButton } from '@/components/common/ImportInstructionsButton';
import { JOBS_SHEET, RATES_SHEET, STAFF_SHEET, type ImportSheet } from '@/utils/importInstructions';

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

/** The one-line summary of a finished import: the records, then any further counts. */
const SHEETS: Readonly<Record<string, ImportSheet>> = {
  staff: STAFF_SHEET,
  rates: RATES_SHEET,
  jobs: JOBS_SHEET,
};

/** The written instructions of an import: the prepared sheet, or one made from its column list. */
function sheetOf(kind: BulkImportKind): ImportSheet {
  return (
    SHEETS[kind.slug] ?? {
      title: kind.title,
      slug: kind.slug,
      summary: kind.intro,
      columns: kind.columns.map(([name, example]) => ({
        name,
        required: kind.required.includes(name),
        what: '',
        allowed: '',
        example,
      })),
      tips: kind.notes,
    }
  );
}

function summary(kind: BulkImportKind, result: BulkImportResult) {
  const base = `${plural(result.created, kind.one, kind.many)} imported`;
  if (kind.slug === 'staff' && result.counts.rates) {
    return `${base}, with ${plural(result.counts.rates, 'rate', 'rates')}`;
  }
  return base;
}

interface ImporterLike {
  mutateAsync: (request: BulkImportRequest) => Promise<BulkImportResult>;
  isPending: boolean;
}

function ImportBody({
  kind,
  importer,
  closePreviousLabel,
  onClose,
}: {
  kind: BulkImportKind;
  importer: ImporterLike;
  closePreviousLabel?: ReactNode;
  onClose: () => void;
}) {
  const inputId = useId();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<BulkImportResult | null>(null);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);
  const [closePrevious, setClosePrevious] = useState(false);

  const reset = () => {
    setCheck(null);
    setRowErrors([]);
    setFailure(null);
  };

  const choose = (next: File | null) => {
    setFile(next);
    reset();
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
      const result = await importer.mutateAsync({ file, dryRun, closePrevious });
      if (dryRun) {
        setCheck(result);
        setRowErrors(result.errors);
        return;
      }
      toast({ tone: 'success', title: summary(kind, result) });
      onClose();
    } catch (error) {
      if (dryRun) setCheck(null);
      onError(error);
    }
  };

  const ready = check !== null && check.errors.length === 0 && check.valid_rows > 0;
  const names = (columns: readonly string[]) => columns.join(', ');

  return (
    <>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          {kind.intro} Upload a CSV with a header row (at most 5 MB and 5,000 rows). The file is
          checked first; nothing is created until every row is valid.
        </p>
        <div className="flex flex-col gap-1 text-sm text-text-muted">
          <p>
            <span className="font-medium text-text">Required columns:</span> {names(kind.required)}.
          </p>
          <p>
            <span className="font-medium text-text">All columns:</span>{' '}
            {names(kind.columns.map(([name]) => name))}.
          </p>
          {kind.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
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
            <ImportInstructionsButton sheet={sheetOf(kind)} />
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Download className="size-4" aria-hidden="true" />}
              onClick={() => downloadImportTemplate(kind)}
            >
              Download template
            </Button>
          </span>
        </div>
        {closePreviousLabel ? (
          <Checkbox
            label={closePreviousLabel}
            checked={closePrevious}
            onChange={(event) => {
              setClosePrevious(event.target.checked);
              reset();
            }}
          />
        ) : null}

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
            Import {plural(check.valid_rows, kind.one, kind.many)}
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

export interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  kind: BulkImportKind;
  importer: ImporterLike;
  /** The label of a "close the earlier rate" checkbox (rates only). */
  closePreviousLabel?: ReactNode;
}

/** Import staff, rates or jobs from a CSV file: a check that lists every bad row, then the import. */
export function BulkImportDialog({
  open,
  onClose,
  kind,
  importer,
  closePreviousLabel,
}: BulkImportDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={kind.title} size="lg" closeOnBackdrop={false}>
      {open ? (
        <ImportBody
          kind={kind}
          importer={importer}
          closePreviousLabel={closePreviousLabel}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
