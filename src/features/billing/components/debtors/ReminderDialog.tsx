import { useQuery } from '@tanstack/react-query';
import { CircleAlert, Mail } from 'lucide-react';
import { useState } from 'react';

import { Button, Modal, Select, Spinner, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatMoney } from '@/utils/money';

import { billingApi, useSendReminders } from '../../api';
import { REMINDER_SKIP_LABELS, REMINDER_TEMPLATE_LABELS } from '../../constants';
import type { ReminderRequest, ReminderResult, ReminderTemplate } from '../../types';
import { dialogError } from '../../utils/errors';
import { dateCell, plural } from '../../utils/format';

/** Who to remind: every overdue invoice of some clients, or particular invoices. */
export type ReminderTarget =
  { clientIds: string[]; label: string } | { invoiceIds: string[]; label: string };

const TEMPLATES = (Object.keys(REMINDER_TEMPLATE_LABELS) as ReminderTemplate[]).map((value) => ({
  value,
  label: REMINDER_TEMPLATE_LABELS[value],
}));

function requestOf(
  target: ReminderTarget,
  template: ReminderTemplate,
  dryRun: boolean,
): ReminderRequest {
  return 'clientIds' in target
    ? { client_ids: target.clientIds, template, dry_run: dryRun }
    : { invoice_ids: target.invoiceIds, template, dry_run: dryRun };
}

/** The emails a real send would queue, asked for with `dry_run` (nothing is written or sent). */
function useReminderPreview(target: ReminderTarget | null, template: ReminderTemplate) {
  const { organization } = useOrg();
  const ids = target === null ? [] : 'clientIds' in target ? target.clientIds : target.invoiceIds;
  return useQuery({
    // Not under the debtors keys: queuing the reminders refreshes those, not the preview.
    queryKey: ['org', organization.id, 'reminder-preview', template, ids],
    queryFn: () =>
      target === null
        ? Promise.reject(new Error('No target'))
        : billingApi.sendReminders(organization.id, requestOf(target, template, true)),
    enabled: target !== null,
    gcTime: 0,
    retry: false,
  });
}

function Preview({ result }: { result: ReminderResult }) {
  const { organization } = useOrg();
  const currency = organization.currency;
  return (
    <div className="flex flex-col gap-3">
      {result.clients.map((email) => (
        <section
          key={email.client.id}
          aria-label={`Email to ${email.client.name}`}
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-sm font-semibold text-text">{email.client.name}</h3>
            <span className="text-sm font-semibold tabular-nums text-text">
              {formatMoney(email.total_due, currency)} overdue
            </span>
          </header>
          <p className="text-xs text-text-muted">To: {email.to.join(', ')}</p>
          <p className="text-xs text-text-muted">Subject: {email.subject}</p>
          <ul className="flex flex-col gap-0.5 text-sm text-text">
            {email.invoices.map((invoice) => (
              <li key={invoice.invoice_id} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {invoice.number ?? 'Invoice'}, due {dateCell(invoice.due_date)} (
                  {plural(invoice.days_overdue, 'day', 'days')} overdue)
                </span>
                <span className="tabular-nums">{formatMoney(invoice.outstanding, currency)}</span>
              </li>
            ))}
          </ul>
          <details className="text-xs text-text-muted">
            <summary className="cursor-pointer">Read the email</summary>
            <pre className="mt-2 font-sans whitespace-pre-wrap">{email.text}</pre>
          </details>
        </section>
      ))}
      {result.skipped.length > 0 ? (
        <section aria-label="Not reminded" className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-text">Not reminded</h3>
          <ul className="flex flex-col gap-0.5 text-sm text-text-muted">
            {result.skipped.map((skip) => (
              <li key={skip.invoice_id}>
                {skip.number ?? 'Invoice'}: {REMINDER_SKIP_LABELS[skip.reason]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export interface ReminderDialogProps {
  /** Null keeps the dialog closed. */
  target: ReminderTarget | null;
  onClose: () => void;
  /** Called once the reminders are queued, before the dialog closes. */
  onSent?: () => void;
}

function ReminderBody({
  target,
  onClose,
  onSent,
}: Omit<ReminderDialogProps, 'target'> & { target: ReminderTarget }) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<ReminderTemplate>('client_payment_reminder');
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const preview = useReminderPreview(target, template);
  const send = useSendReminders();
  const result = preview.data;
  const emails = result?.clients.length ?? 0;

  const submit = () => {
    setRefusal(null);
    send.mutate(requestOf(target, template, false), {
      onSuccess: (data) => {
        toast({
          tone: data.skipped.length > 0 ? 'warning' : 'success',
          title: `${plural(data.emails_queued, 'reminder', 'reminders')} queued`,
          description:
            data.skipped.length > 0
              ? `${plural(data.invoices_queued, 'invoice', 'invoices')} reminded, ${String(data.skipped.length)} skipped.`
              : `${plural(data.invoices_queued, 'invoice', 'invoices')} reminded.`,
        });
        onSent?.();
        onClose();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          Reminds {target.label} about overdue invoices. An invoice is reminded at most once a day.
        </p>
        <Select
          label="Email to send"
          options={TEMPLATES}
          value={template}
          onChange={(event) => setTemplate(event.target.value as ReminderTemplate)}
        />
        {preview.isPending ? (
          <p role="status" className="flex items-center gap-2 text-sm text-text-muted">
            <Spinner size="sm" /> Preparing the emails…
          </p>
        ) : preview.isError ? (
          <div role="alert" className="flex items-start gap-2 text-sm text-text">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <p>{dialogError(preview.error).message}</p>
          </div>
        ) : result ? (
          <>
            <p className="text-sm font-medium text-text" aria-live="polite">
              {emails === 0
                ? 'Nothing can be sent: every invoice was skipped.'
                : `${plural(emails, 'email', 'emails')} will go out.`}
            </p>
            <Preview result={result} />
          </>
        ) : null}
        {refusal ? (
          <div role="alert" className="flex items-start gap-2 text-sm text-text">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <p>{refusal.message}</p>
          </div>
        ) : null}
      </div>
      <footer className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          leftIcon={<Mail aria-hidden="true" className="size-4" />}
          loading={send.isPending}
          disabled={emails === 0 || preview.isFetching}
          onClick={submit}
        >
          {emails > 0 ? `Send ${plural(emails, 'email', 'emails')}` : 'Send emails'}
        </Button>
      </footer>
    </>
  );
}

/** Previews the payment reminders (dry run) and queues them once the person confirms. */
export function ReminderDialog({ target, onClose, onSent }: ReminderDialogProps) {
  return (
    <Modal open={target !== null} onClose={onClose} title="Send payment reminders" size="lg">
      {target ? <ReminderBody target={target} onClose={onClose} onSent={onSent} /> : null}
    </Modal>
  );
}
