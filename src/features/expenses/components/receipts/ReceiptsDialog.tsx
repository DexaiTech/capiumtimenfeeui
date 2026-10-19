import { Download, Eye, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { Button, Modal, Spinner, useToast } from '@/components/ui';
import { formatUkDate, formatUkDateTime } from '@/utils/dates';
import { formatMoney } from '@/utils/money';
import { useOrg } from '@/features/organizations';

import { useClaim, useDeleteReceipt, useExpenseSettings } from '../../api';
import { useDownloadReceipt } from '../../hooks/useReceiptFile';
import type { Receipt } from '../../types';
import { dialogError } from '../../utils/errors';
import { formatFileSize } from '../../utils/format';
import { ReceiptThumb } from './ReceiptThumb';
import { ReceiptViewer } from './ReceiptPreview';
import { UploadZone } from './UploadZone';

export interface ReceiptsDialogProps {
  claimId: string;
  /** The line whose receipts are shown; null keeps the dialog closed. */
  lineId: string | null;
  onClose: () => void;
}

type View =
  { kind: 'list' } | { kind: 'preview'; receipt: Receipt } | { kind: 'delete'; receipt: Receipt };

function ReceiptsBody({
  claimId,
  lineId,
  onClose,
}: {
  claimId: string;
  lineId: string;
  onClose: () => void;
}) {
  const { organization } = useOrg();
  const claim = useClaim(claimId);
  const settings = useExpenseSettings();
  const remove = useDeleteReceipt();
  const { download, pending } = useDownloadReceipt();
  const { toast } = useToast();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  const line = claim.data?.lines.find((entry) => entry.id === lineId);
  const canEdit = claim.data?.actions.can_edit ?? false;

  const title =
    view.kind === 'preview'
      ? view.receipt.file_name
      : view.kind === 'delete'
        ? 'Delete receipt?'
        : 'Receipts';

  const confirmDelete = (receipt: Receipt) => {
    setRefusal(null);
    remove.mutate(
      { claimId, lineId, receiptId: receipt.id },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `${receipt.file_name} deleted` });
          setView({ kind: 'list' });
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  let body;
  let footer;
  if (!line) {
    body = claim.isError ? (
      <p role="alert" className="py-8 text-center text-sm text-text-muted">
        The expense could not be loaded.
      </p>
    ) : (
      <div role="status" aria-label="Loading the receipts" className="flex justify-center py-8">
        <Spinner />
      </div>
    );
    footer = <Button onClick={onClose}>Close</Button>;
  } else if (view.kind === 'preview') {
    body = <ReceiptViewer lineId={line.id} receipt={view.receipt} />;
    footer = (
      <>
        <Button onClick={() => setView({ kind: 'list' })}>Back to receipts</Button>
        <Button
          variant="primary"
          loading={pending}
          onClick={() => void download(line.id, view.receipt)}
          leftIcon={<Download aria-hidden="true" className="size-4" />}
        >
          Download
        </Button>
      </>
    );
  } else if (view.kind === 'delete') {
    body = (
      <div className="flex flex-col gap-3 text-sm text-text-muted">
        <p>{view.receipt.file_name} will be removed from this expense. This cannot be undone.</p>
        {refusal ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-text"
          >
            {refusal.message}
          </p>
        ) : null}
      </div>
    );
    footer = (
      <>
        <Button onClick={() => setView({ kind: 'list' })}>Cancel</Button>
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() => confirmDelete(view.receipt)}
        >
          Delete receipt
        </Button>
      </>
    );
  } else {
    const missing = line.receipt_required && line.receipt_count === 0;
    body = (
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-text-muted">Date</dt>
            <dd className="font-medium text-text">{formatUkDate(line.incurred_on)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Gross</dt>
            <dd className="font-medium text-text tabular-nums">
              {formatMoney(line.gross, organization.currency)}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-text-muted">Expense</dt>
            <dd className="truncate font-medium text-text" title={line.description}>
              {line.description}
            </dd>
          </div>
        </dl>
        {line.receipt_required ? (
          <p
            role={missing ? 'alert' : undefined}
            className="flex items-start gap-2 text-xs text-text-muted"
          >
            <TriangleAlert
              aria-hidden="true"
              className={
                missing
                  ? 'mt-0.5 size-4 shrink-0 text-danger'
                  : 'mt-0.5 size-4 shrink-0 text-text-subtle'
              }
            />
            <span>
              {settings.receiptThreshold === null
                ? 'This amount is above the receipt limit of the practice.'
                : `This amount is above ${formatMoney(settings.receiptThreshold, organization.currency)}.`}{' '}
              {missing
                ? 'A receipt is needed before the claim can be submitted.'
                : 'It has the receipt it needs.'}
            </span>
          </p>
        ) : null}
        {line.receipts.length === 0 ? (
          <p className="text-sm text-text-muted">No receipts yet.</p>
        ) : (
          <ul
            aria-label="Receipts"
            className="flex flex-col divide-y divide-row-border rounded-md border border-border"
          >
            {line.receipts.map((receipt) => (
              <li key={receipt.id} className="flex items-center gap-3 px-3 py-2">
                <ReceiptThumb lineId={line.id} receipt={receipt} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="truncate text-sm font-medium text-text"
                    title={receipt.file_name}
                  >
                    {receipt.file_name}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatFileSize(receipt.size_bytes)} · {receipt.uploaded_by_name ?? 'Someone'} ·{' '}
                    {formatUkDateTime(receipt.created_at, organization.timezone)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Preview ${receipt.file_name}`}
                    onClick={() => setView({ kind: 'preview', receipt })}
                  >
                    <Eye aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Download ${receipt.file_name}`}
                    onClick={() => void download(line.id, receipt)}
                  >
                    <Download aria-hidden="true" className="size-4" />
                  </Button>
                  {canEdit ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${receipt.file_name}`}
                      onClick={() => {
                        setRefusal(null);
                        setView({ kind: 'delete', receipt });
                      }}
                    >
                      <Trash2 aria-hidden="true" className="size-4 text-danger" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <UploadZone claimId={claimId} lineId={line.id} count={line.receipts.length} />
        ) : (
          <p className="text-sm text-text-muted">
            Receipts can only be added or removed while the claim is a draft or returned.
          </p>
        )}
      </div>
    );
    footer = (
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    );
  }

  return (
    <Modal
      open
      onClose={view.kind === 'list' ? onClose : () => setView({ kind: 'list' })}
      title={title}
      description={view.kind === 'list' && line ? line.description : undefined}
      size="lg"
      footer={footer}
    >
      {body}
    </Modal>
  );
}

/**
 * The receipts of one expense line: the files with their preview, download and delete, and (while
 * the claim can still be edited) the upload zone. One dialog: the preview and the delete
 * confirmation replace the list and come back to it.
 */
export function ReceiptsDialog({ claimId, lineId, onClose }: ReceiptsDialogProps) {
  if (lineId === null) return null;
  return <ReceiptsBody key={lineId} claimId={claimId} lineId={lineId} onClose={onClose} />;
}
