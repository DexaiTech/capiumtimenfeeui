import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';

import { useSendStatement } from '../../api';
import { splitEmails, statementSendSchema, type StatementSendValues } from '../../schemas/forms';
import type { StatementSendBody } from '../../types';
import { dialogError, toFormError } from '../../utils/errors';
import { plural } from '../../utils/format';
import { defaultStatementFrom } from '../../utils/statementPeriod';
import { DialogActions } from '../DialogActions';

/** A client a statement is to go to, and whether the client has an address to send it to. */
export interface StatementSendClient {
  id: string;
  name: string;
  hasRecipient: boolean;
}

export interface StatementSendTarget {
  clients: StatementSendClient[];
  /** The period on show when the dialog was opened from a statement. */
  period?: { from: string; to: string };
}

type Outcome =
  | { client: StatementSendClient; status: 'queued' | 'duplicate'; to: string[] }
  | { client: StatementSendClient; status: 'skipped' }
  | { client: StatementSendClient; status: 'failed'; message: string };

function outcomeText(outcome: Outcome): string {
  switch (outcome.status) {
    case 'queued':
      return outcome.to.length > 0 ? `Queued for ${outcome.to.join(', ')}` : 'Queued';
    case 'duplicate':
      return 'Already queued in the last ten minutes';
    case 'skipped':
      return 'Skipped: no email address on the client';
    case 'failed':
      return `Failed: ${outcome.message}`;
  }
}

export interface SendStatementDialogProps {
  /** Null keeps the dialog closed. */
  target: StatementSendTarget | null;
  onClose: () => void;
  /** Called with the ids of the clients whose email was queued (or was already queued). */
  onSent?: (clientIds: string[]) => void;
}

function SendForm({
  target,
  onClose,
  onSent,
}: Omit<SendStatementDialogProps, 'target'> & { target: StatementSendTarget }) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const send = useSendStatement();
  const formId = useId();
  const today = todayInZone(organization.timezone);
  const single = target.clients.length === 1 ? target.clients[0] : undefined;
  const withAddress = target.clients.filter((client) => client.hasRecipient);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StatementSendValues>({
    resolver: zodResolver(statementSendSchema),
    defaultValues: {
      date_from: target.period?.from ?? defaultStatementFrom(today),
      date_to: target.period?.to ?? today,
      to: '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<StatementSendValues>({ setError, fields: ['date_from', 'date_to', 'to'] });

  const submit = handleSubmit(async (values) => {
    clearSubmitError();
    const to = splitEmails(values.to);
    if (single && !single.hasRecipient && to.length === 0) {
      setError('to', { message: 'This client has no email address: enter one to send to.' });
      return;
    }
    const body: StatementSendBody = {
      ...(values.date_from ? { date_from: values.date_from } : {}),
      date_to: values.date_to,
      ...(single && to.length > 0 ? { to } : {}),
    };

    const results: Outcome[] = [];
    for (const client of target.clients) {
      if (!single && !client.hasRecipient) {
        results.push({ client, status: 'skipped' });
        continue;
      }
      try {
        const sent = await send.mutateAsync({ clientId: client.id, body });
        results.push({ client, status: sent.queued ? 'queued' : 'duplicate', to: sent.to });
      } catch (error) {
        if (single) {
          handleSubmitError(toFormError(error));
          return;
        }
        results.push({ client, status: 'failed', message: dialogError(error).message });
      }
    }

    const done = results.filter(
      (outcome) => outcome.status === 'queued' || outcome.status === 'duplicate',
    );
    onSent?.(done.map((outcome) => outcome.client.id));
    const first = results[0];
    if (single && first && (first.status === 'queued' || first.status === 'duplicate')) {
      toast({
        tone: 'success',
        title:
          first.status === 'queued' ? 'Statement email queued' : 'Statement email already queued',
        description:
          first.to.length > 0
            ? `The PDF goes to ${first.to.join(', ')}.`
            : 'The PDF goes to the client’s billing contacts.',
      });
      onClose();
      return;
    }
    const problems = results.length - done.length;
    toast({
      tone: problems > 0 ? 'warning' : 'success',
      title: `${plural(done.length, 'statement', 'statements')} queued`,
      description: problems > 0 ? `${String(problems)} could not be sent.` : undefined,
    });
    setOutcomes(results);
  });

  if (outcomes) {
    return (
      <>
        <ul aria-label="Results" className="flex flex-col gap-1.5 text-sm">
          {outcomes.map((outcome) => (
            <li key={outcome.client.id} className="flex flex-col">
              <span className="font-medium text-text">{outcome.client.name}</span>
              <span
                className={
                  outcome.status === 'failed' ? 'text-xs text-danger' : 'text-xs text-text-muted'
                }
              >
                {outcomeText(outcome)}
              </span>
            </li>
          ))}
        </ul>
        <DialogActions>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </>
    );
  }

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="From"
            type="date"
            hint="Empty: from the first invoice."
            error={errors.date_from?.message}
            {...register('date_from')}
          />
          <Input
            label="To"
            type="date"
            required
            max={today}
            error={errors.date_to?.message}
            {...register('date_to')}
          />
        </div>
        {single ? (
          <Textarea
            label="Send to"
            required={!single.hasRecipient}
            rows={2}
            autoComplete="off"
            hint={
              single.hasRecipient
                ? "Separate addresses with commas. Empty: the client's billing contacts."
                : 'This client has no email address: enter the addresses to send to.'
            }
            error={errors.to?.message}
            {...register('to')}
          />
        ) : (
          <div className="flex flex-col gap-1 text-sm text-text">
            <p>
              Each statement goes to the client's billing contacts.{' '}
              {plural(withAddress.length, 'client has', 'clients have')} an email address.
            </p>
            {withAddress.length < target.clients.length ? (
              <p className="text-text-muted">
                {plural(target.clients.length - withAddress.length, 'client', 'clients')} without
                one will be skipped.
              </p>
            ) : null}
          </div>
        )}
        <p className="text-xs text-text-muted">
          The email is built from the practice's Client statement template (Settings → Email
          templates) and carries the statement as a PDF.
        </p>
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={send.isPending}
          disabled={retryIn > 0 || (!single && withAddress.length === 0)}
        >
          {single ? 'Send email' : `Send ${plural(withAddress.length, 'email', 'emails')}`}
        </Button>
      </DialogActions>
    </>
  );
}

/** Emails the statement of one client, or of several at once, for a period. */
export function SendStatementDialog({ target, onClose, onSent }: SendStatementDialogProps) {
  const single = target?.clients.length === 1 ? target.clients[0] : undefined;
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={single ? 'Email the statement' : 'Email statements'}
      description={
        single
          ? single.name
          : target
            ? plural(target.clients.length, 'client', 'clients')
            : undefined
      }
      closeOnBackdrop={false}
    >
      {target ? <SendForm target={target} onClose={onClose} onSent={onSent} /> : null}
    </Modal>
  );
}
