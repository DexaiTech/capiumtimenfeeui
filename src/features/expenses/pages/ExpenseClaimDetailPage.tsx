import {
  ArrowLeft,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
  CircleCheck,
  Redo2,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { Button, Card, CardHeader, ConfirmDialog, Skeleton, useToast } from '@/components/ui';
import { modulePath, ORG_SEGMENTS } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/services/api';
import { formatUkDateTime } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import {
  useClaim,
  useDeleteClaim,
  useDeleteLine,
  useExpenseSettings,
  useRecallClaim,
  useSubmitClaim,
} from '../api';
import { MAX_CLAIM_LINES } from '../constants';
import { ApproveDialog, ReturnDialog } from '../components/DecisionDialogs';
import { ClaimHistory } from '../components/ClaimHistory';
import { LineFormDialog } from '../components/LineFormDialog';
import { LinesTable } from '../components/LinesTable';
import { ClaimTitleDialog } from '../components/NewClaimDialog';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ReceiptsDialog } from '../components/receipts/ReceiptsDialog';
import { ClaimStatusBadge } from '../components/StatusBadge';
import { SubmitBlockedDialog } from '../components/SubmitBlockedDialog';
import { TotalsStrip } from '../components/TotalsStrip';
import type { ExpenseClaimDetail, ExpenseLine } from '../types';
import { describeFailure, dialogError, isNotFound, receiptProblems } from '../utils/errors';
import { claimLabel, dateSpan, pluralize } from '../utils/format';

type List = 'mine' | 'claims' | 'approvals';

const BACK: Record<List, { label: string; to: (slug: string) => string }> = {
  mine: {
    label: 'My Expenses',
    to: (slug) => modulePath(slug, ORG_SEGMENTS.expenses, 'mine'),
  },
  claims: { label: 'Expense Claims', to: (slug) => modulePath(slug, ORG_SEGMENTS.expenses) },
  approvals: {
    label: 'Expense Approvals',
    to: (slug) => modulePath(slug, ORG_SEGMENTS.expenses, 'approvals'),
  },
};

/** The list a claim was opened from: `/:orgSlug/expenses/<list>/:claimId`. */
function listOf(pathname: string): List {
  const segment = pathname.split('/')[3];
  return segment === 'mine' || segment === 'approvals' ? segment : 'claims';
}

type DialogState =
  | { type: 'line'; line: ExpenseLine | null; correcting: boolean }
  | { type: 'receipts'; lineId: string }
  | { type: 'deleteLine'; line: ExpenseLine }
  | { type: 'deleteClaim' }
  | { type: 'return' }
  | { type: 'approve' }
  | { type: 'title' }
  | { type: 'blocked' }
  | null;

function DecisionNote({ claim, timeZone }: { claim: ExpenseClaimDetail; timeZone: string }) {
  if (!claim.decision_note || (claim.status !== 'returned' && claim.status !== 'approved')) {
    return null;
  }
  const returned = claim.status === 'returned';
  return (
    <div
      role="status"
      className={
        returned
          ? 'flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-text'
          : 'flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text'
      }
    >
      <TriangleAlert
        aria-hidden="true"
        className={
          returned
            ? 'mt-0.5 size-4 shrink-0 text-danger'
            : 'mt-0.5 size-4 shrink-0 text-text-subtle'
        }
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold">
          {returned ? 'Returned' : 'Approved'}
          {claim.decided_by_name ? ` by ${claim.decided_by_name}` : ''}
          {claim.decided_at ? ` on ${formatUkDateTime(claim.decided_at, timeZone)}` : ''}
        </p>
        <p className="break-words whitespace-pre-line text-text-muted">{claim.decision_note}</p>
      </div>
    </div>
  );
}

function ClaimView({ claim }: { claim: ExpenseClaimDetail }) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useExpenseSettings();
  const list = listOf(location.pathname);
  const currency = organization.currency;

  const submit = useSubmitClaim();
  const recall = useRecallClaim();
  const removeClaim = useDeleteClaim();
  const removeLine = useDeleteLine();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(() => new Set());
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const { actions } = claim;
  const missing = claim.lines.filter((line) => line.receipt_required && line.receipt_count === 0);
  // The lines a refused submission named, until their receipts are in.
  const stillFlagged = new Set(
    [...flagged].filter((id) =>
      claim.lines.some((line) => line.id === id && line.receipt_count === 0),
    ),
  );
  const claimant = claim.user_name ?? 'Unknown';
  const back = BACK[list];

  const onSubmit = () => {
    submit.mutate(claim.id, {
      onSuccess: () => {
        setFlagged(new Set());
        toast({
          tone: 'success',
          title: 'Claim submitted',
          description: 'It now waits for an approver.',
        });
      },
      onError: (error) => {
        const problems = receiptProblems(error);
        if (problems.length > 0) {
          setFlagged(new Set(problems.map((problem) => problem.lineId)));
          setDialog({ type: 'blocked' });
          return;
        }
        toast({ tone: 'error', ...describeFailure(error, 'Could not submit the claim') });
      },
    });
  };

  const onRecall = () => {
    recall.mutate(claim.id, {
      onSuccess: () =>
        toast({ tone: 'success', title: 'Claim recalled', description: 'It is a draft again.' }),
      onError: (error) =>
        toast({ tone: 'error', ...describeFailure(error, 'Could not recall the claim') }),
    });
  };

  const confirmDeleteClaim = () => {
    removeClaim.mutate(claim.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Claim deleted' });
        void navigate(back.to(organization.slug), { replace: true });
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const confirmDeleteLine = (line: ExpenseLine) => {
    removeLine.mutate(
      { claimId: claim.id, lineId: line.id },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Expense deleted' });
          close();
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  const atLimit = claim.lines.length >= MAX_CLAIM_LINES;
  const headerActions = (
    <>
      {actions.can_edit ? (
        <Button
          variant="outline"
          onClick={() => setDialog({ type: 'title' })}
          leftIcon={<Pencil aria-hidden="true" className="size-4" />}
        >
          Edit title
        </Button>
      ) : null}
      {actions.can_edit ? (
        <Button
          variant="outline"
          disabled={atLimit}
          onClick={() => setDialog({ type: 'line', line: null, correcting: false })}
          leftIcon={<Plus aria-hidden="true" className="size-4" />}
        >
          Add expense
        </Button>
      ) : null}
      {actions.can_recall ? (
        <Button
          variant="outline"
          loading={recall.isPending}
          onClick={onRecall}
          leftIcon={<Undo2 aria-hidden="true" className="size-4" />}
        >
          Recall
        </Button>
      ) : null}
      {actions.can_delete ? (
        <Button
          variant="outline"
          onClick={() => {
            setRefusal(null);
            setDialog({ type: 'deleteClaim' });
          }}
          leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
        >
          Delete claim
        </Button>
      ) : null}
      {actions.can_return ? (
        <Button
          variant="outline"
          onClick={() => setDialog({ type: 'return' })}
          leftIcon={<Redo2 aria-hidden="true" className="size-4" />}
        >
          Return
        </Button>
      ) : null}
      {actions.can_submit ? (
        <Button
          variant="primary"
          loading={submit.isPending}
          onClick={onSubmit}
          leftIcon={<Send aria-hidden="true" className="size-4" />}
        >
          Submit for approval
        </Button>
      ) : null}
      {actions.can_approve ? (
        <Button
          variant="primary"
          onClick={() => setDialog({ type: 'approve' })}
          leftIcon={<CircleCheck aria-hidden="true" className="size-4" />}
        >
          Approve
        </Button>
      ) : null}
    </>
  );

  const target = dialog?.type === 'deleteLine' ? dialog.line : null;
  const receiptLine = dialog?.type === 'receipts' ? dialog.lineId : null;
  const lineDialog = dialog?.type === 'line' ? dialog : null;

  return (
    <PageShell
      title={claimLabel(claim)}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ClaimStatusBadge status={claim.status} />
          <span>{claimant}</span>
          {claim.line_count > 0 ? <span>{dateSpan(claim.first_date, claim.last_date)}</span> : null}
          <span>{pluralize(claim.line_count, 'expense')}</span>
          {claim.created_by !== claim.user_id && claim.created_by_name ? (
            <span>Entered by {claim.created_by_name}</span>
          ) : null}
        </span>
      }
      actions={headerActions}
    >
      <Link
        to={back.to(organization.slug)}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-brand-text hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to {back.label}
      </Link>
      <DecisionNote claim={claim} timeZone={organization.timezone} />
      {actions.can_submit && missing.length > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-badge-amber" />
          <p className="min-w-0 flex-1">
            {pluralize(missing.length, 'expense')} {missing.length === 1 ? 'is' : 'are'} above{' '}
            {settings.receiptThreshold === null
              ? 'the receipt limit'
              : formatMoney(settings.receiptThreshold, currency)}{' '}
            and {missing.length === 1 ? 'needs' : 'need'} a receipt before the claim can be
            submitted.
          </p>
          <Button
            size="sm"
            onClick={() => {
              const first = missing[0];
              if (first) setDialog({ type: 'receipts', lineId: first.id });
            }}
          >
            Add receipts
          </Button>
        </div>
      ) : null}
      <TotalsStrip totals={claim.totals} currency={currency} />
      <LinesTable
        claim={claim}
        currency={currency}
        flagged={stillFlagged}
        onAdd={() => setDialog({ type: 'line', line: null, correcting: false })}
        onEdit={(line) => setDialog({ type: 'line', line, correcting: false })}
        onCorrect={(line) => setDialog({ type: 'line', line, correcting: true })}
        onDelete={(line) => {
          setRefusal(null);
          setDialog({ type: 'deleteLine', line });
        }}
        onReceipts={(line) => setDialog({ type: 'receipts', lineId: line.id })}
      />
      <Card padding="none">
        <CardHeader
          title="History"
          description="Who submitted, decided on and corrected the claim."
        />
        <ClaimHistory events={claim.events} timeZone={organization.timezone} />
      </Card>

      <LineFormDialog
        claimId={claim.id}
        line={lineDialog?.line ?? null}
        correcting={lineDialog?.correcting ?? false}
        open={lineDialog !== null}
        onClose={close}
      />
      <ReceiptsDialog claimId={claim.id} lineId={receiptLine} onClose={close} />
      <SubmitBlockedDialog
        open={dialog?.type === 'blocked'}
        lines={claim.lines.filter((line) => stillFlagged.has(line.id))}
        currency={currency}
        threshold={settings.receiptThreshold}
        onClose={close}
        onAddReceipt={(line) => setDialog({ type: 'receipts', lineId: line.id })}
      />
      <ReturnDialog claim={claim} open={dialog?.type === 'return'} onClose={close} />
      <ApproveDialog claim={claim} open={dialog?.type === 'approve'} onClose={close} />
      <ClaimTitleDialog
        claimId={claim.id}
        title={claim.title}
        open={dialog?.type === 'title'}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog?.type === 'deleteClaim'}
        onClose={close}
        onConfirm={confirmDeleteClaim}
        title="Delete this claim?"
        confirmLabel="Delete claim"
        loading={removeClaim.isPending}
        error={refusal}
      >
        <p>
          {claimLabel(claim)} and its {pluralize(claim.line_count, 'expense')} will be removed, with
          their receipts. This cannot be undone.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={target !== null}
        onClose={close}
        onConfirm={() => {
          if (target) confirmDeleteLine(target);
        }}
        title="Delete this expense?"
        confirmLabel="Delete expense"
        loading={removeLine.isPending}
        error={refusal}
      >
        <p>
          {target?.description} ({formatMoney(target?.gross ?? 0, currency)}) will be removed from
          the claim, with its receipts. This cannot be undone.
        </p>
      </ConfirmDialog>
    </PageShell>
  );
}

function ClaimSkeleton() {
  return (
    <div role="status" aria-label="Loading the claim" className="flex flex-col gap-4">
      <Skeleton shape="rect" className="h-8 w-72" />
      <Skeleton shape="rect" className="h-20 w-full" />
      <Skeleton shape="rect" className="h-64 w-full" />
    </div>
  );
}

/**
 * `/:orgSlug/expenses/{mine|claims|approvals}/:claimId`: one claim with its lines, receipts and
 * history. What can be done with it (edit, submit, recall, approve, return, correct) follows the
 * `actions` the API sends; the list the person came from decides where "Back" leads.
 */
export default function ExpenseClaimDetailPage() {
  useDocumentTitle('Expense claim');
  const { claimId } = useParams();
  const claim = useClaim(claimId);

  if (claim.isPending) return <ClaimSkeleton />;
  if (claim.isError) {
    if (isApiError(claim.error) && claim.error.status === 403) {
      return <NoAccess what="seeing this claim: it belongs to someone you do not manage" />;
    }
    return (
      <LoadError
        title={isNotFound(claim.error) ? 'This claim does not exist' : 'Could not load the claim'}
        error={claim.error}
        onRetry={() => void claim.refetch()}
        retrying={claim.isRefetching}
      />
    );
  }
  return <ClaimView claim={claim.data} />;
}
