import type { ReactNode } from 'react';

import { Badge, Button, Card, Input, Switch, useToast } from '@/components/ui';

import {
  useRetryFailed,
  useRunIntegration,
  useSetMockAvailability,
  useUpdateIntegration,
} from '../../api/adminHooks';
import type { IntegrationCard, IntegrationUpdate } from '../../adminTypes';
import { describeError } from '../../utils/errors';
import { CARD_STATUS, SUMMARY_LABELS, words } from '../../utils/integrations';
import { RelativeTime } from '../RelativeTime';

export interface IntegrationCardViewProps {
  card: IntegrationCard;
  /** Holds `integration.manage`. */
  canManage: boolean;
  onOpenMappings: () => void;
  onShowItems: () => void;
}

function Fact({
  label,
  children,
  danger,
}: {
  label: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd
        className={danger ? 'text-sm font-semibold text-danger' : 'text-sm font-medium text-text'}
      >
        {children}
      </dd>
    </div>
  );
}

/** One integration: where it stands, what it holds, its settings and the things to do with it. */
export function IntegrationCardView({
  card,
  canManage,
  onOpenMappings,
  onShowItems,
}: IntegrationCardViewProps) {
  const { toast } = useToast();
  const update = useUpdateIntegration();
  const run = useRunIntegration();
  const retry = useRetryFailed();
  const mock = useSetMockAvailability();
  const busy = update.isPending || run.isPending || retry.isPending || mock.isPending;
  const status = CARD_STATUS[card.status];
  const failure = (title: string) => (error: unknown) =>
    toast({ tone: 'error', ...describeError(error, title) });

  const change = (body: IntegrationUpdate, done: string) =>
    update.mutate(
      { key: card.key, body },
      {
        onSuccess: () => toast({ tone: 'success', title: done }),
        onError: failure('Could not change the integration'),
      },
    );

  const runNow = () =>
    run.mutate(card.key, {
      onSuccess: (result) =>
        toast({
          tone: result.available ? 'success' : 'warning',
          title: `${card.name}: ${result.message}`,
        }),
      onError: failure(`Could not run ${card.name}`),
    });

  const retryFailed = () =>
    retry.mutate(card.key, {
      onSuccess: (result) =>
        toast({
          tone: result.failed > 0 ? 'warning' : 'success',
          title: `${result.ok} of ${result.requeued} failed ${result.requeued === 1 ? 'item' : 'items'} sent`,
          description:
            result.remaining > 0 ? `${result.remaining} more are left to retry.` : undefined,
        }),
      onError: failure('Could not retry the failed items'),
    });

  const setMock = (available: boolean) =>
    mock.mutate(
      { key: card.key, available },
      {
        onSuccess: () =>
          toast({ tone: 'success', title: `Mock service is ${available ? 'on' : 'off'}` }),
        onError: failure('Could not switch the mock service'),
      },
    );

  const summary = Object.entries(card.summary).filter(([key]) => key in SUMMARY_LABELS);
  const sendFrom = typeof card.config.send_from === 'string' ? card.config.send_from : '';

  return (
    <Card padding="lg" role="region" aria-label={card.name} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text">{card.name}</h2>
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        </div>
        <p className="text-sm text-text-muted">{card.description}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Fact label="Last success">
          {card.last_success_at ? <RelativeTime iso={card.last_success_at} /> : 'Never'}
        </Fact>
        <Fact label="Waiting">{card.pending_items}</Fact>
        <Fact label="Failed" danger={card.failed_items > 0}>
          {card.failed_items}
        </Fact>
        {summary.map(([key, count]) => (
          <Fact key={key} label={SUMMARY_LABELS[key] ?? words(key)}>
            {count}
          </Fact>
        ))}
      </dl>

      {card.last_error && card.status === 'error' ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-text"
        >
          {card.last_error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <Switch
          label="Enabled"
          description={card.always_on ? 'Always on: it is part of the client flow.' : undefined}
          checked={card.enabled}
          disabled={!canManage || card.always_on || busy}
          onChange={(enabled) =>
            change({ enabled }, `${card.name} ${enabled ? 'switched on' : 'switched off'}`)
          }
        />
        {card.key === 'practice_management' ? (
          <Switch
            label="Keep statuses in step"
            description="Job and task statuses follow practice management, both ways."
            checked={card.config.sync_statuses === true}
            disabled={!canManage || !card.enabled || busy}
            onChange={(checked) => change({ config: { sync_statuses: checked } }, 'Setting saved')}
          />
        ) : null}
        {card.key === 'bookkeeping' ? (
          <>
            <Switch
              label="Send invoices"
              checked={card.config.send_invoices === true}
              disabled={!canManage || !card.enabled || busy}
              onChange={(checked) =>
                change({ config: { send_invoices: checked } }, 'Setting saved')
              }
            />
            <Switch
              label="Send credit notes"
              checked={card.config.send_credit_notes === true}
              disabled={!canManage || !card.enabled || busy}
              onChange={(checked) =>
                change({ config: { send_credit_notes: checked } }, 'Setting saved')
              }
            />
            <Input
              key={sendFrom}
              label="Send documents issued from"
              type="date"
              defaultValue={sendFrom}
              disabled={!canManage || !card.enabled || busy}
              hint="Leave empty to send every document."
              onChange={(event) =>
                change({ config: { send_from: event.target.value || null } }, 'Setting saved')
              }
            />
          </>
        ) : null}
        {card.mock ? (
          <Switch
            label="Mock service is available"
            description="Development only: switch it off to see an outage and the retries."
            checked={card.mock.available}
            disabled={!canManage || busy}
            onChange={setMock}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={run.isPending}
          disabled={!canManage || !card.enabled || busy}
          onClick={runNow}
        >
          Run now
        </Button>
        {card.failed_items > 0 ? (
          <Button
            size="sm"
            loading={retry.isPending}
            disabled={!canManage || !card.enabled || busy}
            onClick={retryFailed}
          >
            Retry {card.failed_items} failed
          </Button>
        ) : null}
        {card.key === 'bookkeeping' ? (
          <Button size="sm" onClick={onOpenMappings}>
            Mappings
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onShowItems}>
          Sync items
        </Button>
      </div>
    </Card>
  );
}
