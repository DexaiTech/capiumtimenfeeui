import { Send, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { Button, Card, ConfirmDialog, ProgressBar, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDateTime } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { useRecallTimesheet, useSubmitTimesheet } from '../../api';
import { EDITABLE_SHEET_STATUSES } from '../../constants';
import type { TimesheetDetail, WeekGrid } from '../../types';
import { describeFailure, dialogError } from '../../utils/errors';
import { describeVariance, formatDayList, formatShare } from '../../utils/format';
import { formatWeekRange } from '../../utils/weeks';
import { SheetStatusBadge } from '../badges';
import { Notice } from '../Notice';

export interface TimesheetStatusBarProps {
  grid: WeekGrid;
  /** The sheet with its decision, once the week has one. */
  sheet: TimesheetDetail | undefined;
  /** The person may record time (`time.log`). */
  canRecord: boolean;
}

/**
 * The week's status: totals against the target, submit and recall, and the notices that go with
 * the status (returned with its reason, submitted, approved, days with no time).
 */
export function TimesheetStatusBar({ grid, sheet, canRecord }: TimesheetStatusBarProps) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const submit = useSubmitTimesheet();
  const recall = useRecallTimesheet();
  const [confirming, setConfirming] = useState<'submit' | 'recall' | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  const status = grid.timesheet_status;
  const editable = EDITABLE_SHEET_STATUSES.includes(status);
  const target = grid.targets?.weekly_minutes ?? 0;
  const variance = describeVariance(grid.total_minutes - target);
  const timesheetId = grid.timesheet_id;
  const missing = editable ? grid.missing_days : [];

  const close = () => {
    setConfirming(null);
    setRefusal(null);
  };

  const recalled = () =>
    toast({
      tone: 'success',
      title: 'Timesheet recalled',
      description: 'It is open again: you can change it and submit it again.',
    });

  // A complete week goes in with one click: nothing needs checking, and Undo recalls it. A week
  // with days missing still asks first, because that is what the question is for.
  const submitAtOnce = () => {
    if (!timesheetId) return;
    submit.mutate(timesheetId, {
      onSuccess: () =>
        toast({
          tone: 'success',
          title: 'Timesheet submitted',
          description: 'Your manager can now approve it.',
          action: {
            label: 'Undo',
            onClick: () =>
              recall.mutate(timesheetId, {
                onSuccess: recalled,
                onError: (error) =>
                  toast({ tone: 'error', ...describeFailure(error, 'Could not recall it') }),
              }),
          },
        }),
      // The API refused: show why in the usual dialog, where it can be retried.
      onError: (error) => {
        setConfirming('submit');
        setRefusal(dialogError(error));
      },
    });
  };

  const act = () => {
    if (!timesheetId || !confirming) return;
    const done = {
      onSuccess: () => {
        toast({
          tone: 'success',
          title: confirming === 'submit' ? 'Timesheet submitted' : 'Timesheet recalled',
          description:
            confirming === 'submit'
              ? 'Your manager can now approve it.'
              : 'It is open again: you can change it and submit it again.',
        });
        close();
      },
      onError: (error: unknown) => setRefusal(dialogError(error)),
    };
    if (confirming === 'submit') submit.mutate(timesheetId, done);
    else recall.mutate(timesheetId, done);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text">
              Week of {formatWeekRange(grid.week_start)}
            </h2>
            <SheetStatusBadge status={status} />
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div>
              <dt className="text-text-muted">Logged</dt>
              <dd className="font-semibold text-text tabular-nums">
                {formatMinutes(grid.total_minutes)}
              </dd>
            </div>
            {grid.targets ? (
              <>
                <div>
                  <dt className="text-text-muted">Target</dt>
                  <dd className="font-semibold text-text tabular-nums">{formatMinutes(target)}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Over or under</dt>
                  <dd className="font-semibold text-text tabular-nums">{variance.text}</dd>
                </div>
              </>
            ) : null}
            <div>
              <dt className="text-text-muted">Billable</dt>
              <dd className="font-semibold text-text tabular-nums">
                {formatMinutes(grid.chargeable_minutes)} (
                {formatShare(grid.chargeable_minutes, grid.total_minutes)})
              </dd>
            </div>
          </dl>
          {target > 0 ? (
            <ProgressBar
              className="mt-1 w-full max-w-72"
              label="Week against target"
              hideLabel
              value={grid.total_minutes}
              max={target}
              tone={grid.total_minutes >= target ? 'success' : 'primary'}
              valueText={`${formatMinutes(grid.total_minutes)} of ${formatMinutes(target)}`}
            />
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          {canRecord && editable ? (
            <Button
              variant="primary"
              leftIcon={<Send className="size-4" aria-hidden="true" />}
              disabled={timesheetId === null || grid.total_minutes === 0}
              loading={submit.isPending && confirming === null}
              onClick={() =>
                grid.missing_days.length === 0 ? submitAtOnce() : setConfirming('submit')
              }
            >
              Submit for approval
            </Button>
          ) : null}
          {canRecord && status === 'submitted' ? (
            <Button
              leftIcon={<Undo2 className="size-4" aria-hidden="true" />}
              onClick={() => setConfirming('recall')}
            >
              Recall
            </Button>
          ) : null}
          {canRecord && editable && grid.total_minutes === 0 ? (
            <p className="text-xs text-text-muted">Record some time before you submit.</p>
          ) : null}
        </div>
      </Card>

      {status === 'rejected' ? (
        <Notice tone="danger" title="This timesheet was returned">
          {sheet?.decided_at ? (
            <span>Returned on {formatUkDateTime(sheet.decided_at, organization.timezone)}. </span>
          ) : null}
          <span>
            Reason: {sheet?.decision_note ?? 'none was given'}. Change it and submit it again.
          </span>
        </Notice>
      ) : null}
      {status === 'submitted' ? (
        <Notice tone="info" title="This timesheet is submitted">
          {sheet?.submitted_at
            ? `Submitted on ${formatUkDateTime(sheet.submitted_at, organization.timezone)}. `
            : ''}
          Its time cannot be changed while it waits for approval. Recall it to make changes.
        </Notice>
      ) : null}
      {status === 'approved' ? (
        <Notice tone="success" title="This timesheet is approved">
          {sheet?.decided_at
            ? `Approved on ${formatUkDateTime(sheet.decided_at, organization.timezone)}. `
            : ''}
          Its time is locked. A manager can correct approved time that has not been billed.
        </Notice>
      ) : null}
      {missing.length > 0 ? (
        <Notice tone="warning" title="Days with no time recorded">
          {formatDayList(missing)}. Record the time, or submit as it is if you did not work.
        </Notice>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        onClose={close}
        onConfirm={act}
        title={confirming === 'recall' ? 'Recall this timesheet?' : 'Submit this timesheet?'}
        confirmLabel={confirming === 'recall' ? 'Recall timesheet' : 'Submit timesheet'}
        tone="default"
        loading={submit.isPending || recall.isPending}
        error={refusal}
      >
        {confirming === 'recall' ? (
          <p>
            The timesheet goes back to open so you can change it. It is not approved yet, so nothing
            is lost.
          </p>
        ) : (
          <>
            <p>
              The week of {formatWeekRange(grid.week_start)} with{' '}
              {formatMinutes(grid.total_minutes)} recorded goes to your manager. Its time is locked
              until it is approved or returned.
            </p>
            {grid.missing_days.length > 0 ? (
              <p>
                {grid.missing_days.length === 1
                  ? 'One working day has'
                  : `${grid.missing_days.length} working days have`}{' '}
                no time recorded ({formatDayList(grid.missing_days)}).
              </p>
            ) : null}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
