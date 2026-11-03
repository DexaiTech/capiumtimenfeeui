import { useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, Checkbox, Modal, Skeleton, useToast } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import { useAdvanceItems, useClientWip } from '../../api';
import type { InvoiceDetail, InvoiceLine, WipItem } from '../../types';
import { dialogError } from '../../utils/errors';
import { dateCell, plural } from '../../utils/format';
import { DialogActions } from '../DialogActions';

export interface AssignTimeDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceDetail;
  /** The advance line the work is assigned to. */
  line: InvoiceLine | null;
}

/** The client's WIP an advance can take: time and disbursements, not time of a fixed-fee job. */
function offered(items: ReadonlyArray<WipItem>): WipItem[] {
  return items.filter(
    (item) =>
      (item.kind === 'time' || item.kind === 'disbursement') &&
      item.selectable !== false &&
      item.job?.billing_basis !== 'fixed',
  );
}

function AssignForm({
  invoice,
  line,
  onClose,
}: {
  invoice: InvoiceDetail;
  line: InvoiceLine;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const wip = useClientWip(invoice.client?.id ?? null, null);
  const assign = useAdvanceItems(invoice.id);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set());
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const money = (pence: number) => formatMoney(pence, invoice.currency);

  if (wip.isError) {
    const failure = dialogError(wip.error);
    return <FormAlert message={failure.message} requestId={failure.requestId} />;
  }
  if (!wip.data) {
    return (
      <div role="status" aria-label="Loading the work in progress" className="flex flex-col gap-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const items = offered(wip.data.items);
  const picked = items.filter((item) => chosen.has(item.id));
  const value = picked.reduce((sum, item) => sum + item.value, 0);
  const remaining = line.advance?.remaining ?? line.net_amount;
  const beyond = Math.max(value - remaining, 0);

  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const confirm = () => {
    setRefusal(null);
    assign.mutate(
      {
        lineId: line.id,
        body: {
          time_entry_ids: picked.filter((item) => item.kind === 'time').map((item) => item.id),
          disbursement_ids: picked
            .filter((item) => item.kind === 'disbursement')
            .map((item) => item.id),
        },
      },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: 'Time assigned',
            description: `${plural(picked.length, 'item is', 'items are')} billed against ${invoice.number ?? 'the invoice'} and out of WIP.`,
          });
          onClose();
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">
            {wip.data.client.name} has no unbilled time or disbursements to assign.
          </p>
        ) : (
          <fieldset className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            <legend className="sr-only">Work in progress of {wip.data.client.name}</legend>
            {items.map((item) => (
              <Checkbox
                key={item.id}
                checked={chosen.has(item.id)}
                onChange={(event) => toggle(item.id, event.target.checked)}
                label={`${dateCell(item.date)}: ${item.description ?? item.job?.name ?? (item.kind === 'time' ? 'Time' : 'Disbursement')}`}
                description={[
                  item.person?.full_name,
                  item.hours ? `${item.hours} hours` : null,
                  money(item.value),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </fieldset>
        )}
        <p aria-live="polite" className="text-sm text-text">
          {picked.length === 0
            ? `Nothing chosen yet. ${money(remaining)} of the advance is left.`
            : `${plural(picked.length, 'item', 'items')} chosen, ${money(value)} of work. ${money(remaining)} of the advance is left.`}
        </p>
        {beyond > 0 ? (
          <p role="note" className="text-sm text-warning">
            {money(beyond)} of this work is beyond the advance and will be written off.
          </p>
        ) : null}
        {refusal ? <FormAlert message={refusal.message} requestId={refusal.requestId} /> : null}
      </div>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          loading={assign.isPending}
          disabled={picked.length === 0}
          onClick={confirm}
        >
          Assign to the advance
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * Picks the client's unbilled work to bill against fees billed in advance: it leaves WIP and the
 * invoice stays as issued. Work beyond what is left of the advance is written off.
 */
export function AssignTimeDialog({ open, onClose, invoice, line }: AssignTimeDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Assign time"
      description={line ? `To ${line.description}, oldest work first.` : undefined}
    >
      {open && line ? <AssignForm invoice={invoice} line={line} onClose={onClose} /> : null}
    </Modal>
  );
}
