import { useId, useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Card, CardHeader } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { formatMoney } from '@/utils/money';

import { usePreviewRerate } from '../api';
import { NoAccess, PageShell } from '../components/PageShell';
import { ApplyDialog } from '../components/rerate/ApplyDialog';
import { PreviewResult } from '../components/rerate/PreviewResult';
import { RerateScopeForm } from '../components/rerate/RerateScopeForm';
import { RunsHistory } from '../components/rerate/RunsHistory';
import {
  EMPTY_SCOPE,
  rerateScopeSchema,
  type ScopeErrors,
  type ScopeState,
} from '../schemas/rerate';
import type { RerateRequest, ReratePreview, Rerun } from '../types';
import { dialogError } from '../utils/errors';
import { plural } from '../utils/format';
import { formatDelta, skipSummary } from '../utils/rerate';

/** The request body of a preview, from the form. */
function toRequest(scope: ScopeState): RerateRequest {
  const request: RerateRequest = {
    scope: {
      client_ids: scope.clients.map((item) => item.id),
      job_ids: scope.jobs.map((item) => item.id),
      user_ids: scope.staff.map((item) => item.id),
      date_from: scope.date_from || null,
      date_to: scope.date_to || null,
    },
  };
  if (scope.include_unchanged) request.include_unchanged = true;
  return request;
}

function Outcome({ run, preview }: { run: Rerun; preview: ReratePreview }) {
  const left = skipSummary(preview.skipped);
  return (
    <Card
      padding="sm"
      role="status"
      aria-labelledby="rerate-outcome"
      className="flex flex-col gap-1"
    >
      <h2 id="rerate-outcome" className="text-base font-semibold text-text">
        Re-rate applied
      </h2>
      <p className="text-sm text-text">
        {plural(run.entries_changed, 'entry', 'entries')} updated, {run.entries_skipped} left alone
        {left ? ` (${left})` : ''}.
      </p>
      <p className="text-sm text-text-muted">
        Charge-out value {formatMoney(run.charge_value_before)} →{' '}
        {formatMoney(run.charge_value_after)} ({formatDelta(run.charge_value_delta)}). It is
        recorded in the history below.
      </p>
    </Card>
  );
}

function ReRate() {
  const { can } = useOrg();
  const formId = useId();
  const canRead = can(PERMISSIONS.rateRead);
  const preview = usePreviewRerate();

  const [scope, setScope] = useState<ScopeState>(EMPTY_SCOPE);
  const [errors, setErrors] = useState<ScopeErrors>({});
  const [applying, setApplying] = useState<ReratePreview | null>(null);
  const [outcome, setOutcome] = useState<{ run: Rerun; preview: ReratePreview } | null>(null);

  // A preview is only good for the scope it was made from: any change throws it away.
  const change = (patch: Partial<ScopeState>) => {
    setScope((current) => ({ ...current, ...patch }));
    setErrors({});
    preview.reset();
  };

  const reset = () => {
    setScope(EMPTY_SCOPE);
    setErrors({});
    setOutcome(null);
    preview.reset();
  };

  const submit = () => {
    const parsed = rerateScopeSchema.safeParse(scope);
    if (!parsed.success) {
      const found: ScopeErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !(field in found)) {
          found[field as keyof ScopeErrors] = issue.message;
        }
      }
      setErrors(found);
      return;
    }
    setErrors({});
    setOutcome(null);
    preview.mutate(toRequest(scope));
  };

  return (
    <>
      <Card padding="none">
        <CardHeader
          title="1. Choose the time to re-rate"
          description="Only unbilled time is looked at. Nothing changes until you have seen the preview and applied it."
        />
        <RerateScopeForm
          formId={formId}
          value={scope}
          errors={errors}
          onChange={change}
          onSubmit={submit}
          onReset={reset}
          submitting={preview.isPending}
        />
        {preview.isError ? (
          <div className="px-5 pb-5">
            <FormAlert
              message={dialogError(preview.error).message}
              requestId={dialogError(preview.error).requestId}
            />
          </div>
        ) : null}
      </Card>

      <p role="status" className="sr-only">
        {preview.isPending
          ? 'Preparing the preview…'
          : preview.data
            ? `Preview ready: ${plural(preview.data.totals.entries_to_change, 'entry', 'entries')} would change.`
            : ''}
      </p>

      {outcome ? <Outcome run={outcome.run} preview={outcome.preview} /> : null}

      {preview.data ? (
        <PreviewResult
          preview={preview.data}
          showCost={canRead}
          onApply={() => setApplying(preview.data)}
        />
      ) : null}

      <ApplyDialog
        preview={applying}
        onClose={(stale) => {
          setApplying(null);
          // A stale preview cannot be applied: the person has to preview again.
          if (stale) preview.reset();
        }}
        onApplied={(run, applied) => {
          setApplying(null);
          setOutcome({ run, preview: applied });
          preview.reset();
        }}
      />

      {canRead ? <RunsHistory /> : null}
    </>
  );
}

/** `/:orgSlug/team/re-rate`: re-price unbilled time at today's rates, with a preview first (`rate.manage`). */
export default function ReRateTimePage() {
  const { can } = useOrg();
  useDocumentTitle('Change Rates on Past Time');
  return (
    <PageShell
      title="Change Rates on Past Time"
      description="Re-price unbilled time at the rates in force now. Preview the effect first: billed, drafted and written-off time is never touched."
    >
      {can(PERMISSIONS.rateManage) ? <ReRate /> : <NoAccess what="re-rating" />}
    </PageShell>
  );
}
