import { FileDown } from 'lucide-react';
import { Link } from 'react-router';

import { Button, ErrorState, Modal, Skeleton } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { billingApi, useCreditNote } from '../../api';
import { useFileDownload } from '../../hooks/useFileDownload';
import { dateCell } from '../../utils/format';

function CreditNoteBody({ creditNoteId, onClose }: { creditNoteId: string; onClose: () => void }) {
  const { organization } = useOrg();
  const { busy, download } = useFileDownload();
  const query = useCreditNote(creditNoteId);
  const note = query.data;
  const money = (pence: number) => formatMoney(pence, organization.currency);

  if (query.isError && !note) {
    return (
      <ErrorState
        title="Could not load the credit note"
        error={isApiError(query.error) ? query.error : null}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    );
  }
  if (!note) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium text-text-muted">Client</dt>
          <dd className="text-text">{note.client ? `${note.client.name} (${note.client.code})` : '—'}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium text-text-muted">Against invoice</dt>
          <dd>
            <Link
              to={routes.org.invoice(organization.slug, note.invoice_id)}
              className="font-semibold text-brand-text hover:underline"
            >
              {note.invoice_number ?? 'Invoice'}
            </Link>
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium text-text-muted">Date</dt>
          <dd className="text-text">{dateCell(note.issue_date)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium text-text-muted">Reason</dt>
          <dd className="text-text">{note.reason}</dd>
        </div>
      </dl>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-separate border-spacing-0 text-xs font-medium">
          <caption className="sr-only">Lines of the credit note</caption>
          <thead>
            <tr className="text-left text-text-muted">
              <th scope="col" className="h-9 px-3">
                Description
              </th>
              <th scope="col" className="h-9 px-3 text-right">
                Net
              </th>
              <th scope="col" className="h-9 px-3 text-right">
                VAT
              </th>
              <th scope="col" className="h-9 px-3 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {(note.lines ?? []).map((line) => (
              <tr key={line.id}>
                <td className="border-t border-row-border px-3 py-2 text-text">{line.description}</td>
                <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                  {money(line.net_amount)}
                </td>
                <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                  {money(line.vat_amount)}{' '}
                  <span className="text-text-muted">({formatBasisPoints(line.vat_rate_bp)})</span>
                </td>
                <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                  {money(line.gross_amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-text">
              <th scope="row" className="border-t border-row-border px-3 py-2 text-left">
                Total
              </th>
              <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                {money(note.net_total)}
              </td>
              <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                {money(note.vat_total)}
              </td>
              <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                {money(note.gross_total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button
          leftIcon={<FileDown aria-hidden="true" className="size-4" />}
          loading={busy === note.id}
          onClick={() =>
            void download(note.id, `${note.number}.pdf`, () =>
              billingApi.creditNotePdf(organization.id, note.id),
            )
          }
        >
          Download PDF
        </Button>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export interface CreditNoteDetailDialogProps {
  /** The credit note to show; null keeps the dialog closed. */
  creditNoteId: string | null;
  number?: string;
  onClose: () => void;
}

/** One credit note with its lines and VAT, and its PDF. */
export function CreditNoteDetailDialog({
  creditNoteId,
  number,
  onClose,
}: CreditNoteDetailDialogProps) {
  return (
    <Modal
      open={creditNoteId !== null}
      onClose={onClose}
      title={number ? `Credit note ${number}` : 'Credit note'}
      size="lg"
    >
      {creditNoteId ? (
        <CreditNoteBody key={creditNoteId} creditNoteId={creditNoteId} onClose={onClose} />
      ) : null}
    </Modal>
  );
}
