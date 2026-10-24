import { ArrowLeft, Ellipsis, Pencil, Plus, UserX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  Badge,
  Button,
  buttonClasses,
  Card,
  CardHeader,
  Dropdown,
  EmptyState,
  InitialsAvatar,
  Skeleton,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { RecordHistory } from '@/features/audit';
import { useOrg } from '@/features/organizations';
import { useRoleName } from '@/features/system';
import { useDocumentTitle } from '@/hooks';
import { formatUkDate, formatWeekdays } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints } from '@/utils/money';

import { flattenPages, useRateRules, useStaffMember } from '../api';
import { LoginStatusBadge, RuleStatusBadge, StaffStatusBadge } from '../components/badges';
import { LoadError, NoAccess } from '../components/PageShell';
import { StaffRatePanel } from '../components/staff/StaffRatePanel';
import {
  TemporaryPasswordDialog,
  type TemporaryPassword,
} from '../components/staff/TemporaryPasswordDialog';
import { RATE_KIND_LABEL } from '../constants';
import { useStaffActions } from '../hooks/useStaffActions';
import type { RateKind, StaffDetail } from '../types';
import { isNotFound } from '../utils/errors';
import { formatPeriod, formatRate, scopeNames } from '../utils/format';

const SOURCE_LABEL: Record<string, string> = {
  staff: "this person's own rate",
  grade: "their grade's default",
  default: "the practice's default",
  none: 'none set',
};

function sourceLabel(source: string | null): string {
  return source ? (SOURCE_LABEL[source] ?? source) : '';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-text">{children}</dd>
    </div>
  );
}

const dash = <span className="text-text-subtle">—</span>;

function ProfileCard({
  staff,
  canEdit,
  onEdit,
}: {
  staff: StaffDetail;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const roleName = useRoleName();
  return (
    <Card padding="none" role="region" aria-label="Profile">
      <CardHeader
        title="Profile"
        description="Grade, working pattern and who approves their timesheets."
        actions={
          canEdit ? (
            <Button
              size="sm"
              leftIcon={<Pencil aria-hidden="true" className="size-4" />}
              onClick={onEdit}
            >
              Edit details
            </Button>
          ) : undefined
        }
      />
      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Staff code">{staff.code}</Field>
        <Field label="Grade">{staff.grade?.name ?? dash}</Field>
        <Field label="Job title">{staff.job_title ?? dash}</Field>
        <Field label="Work email">{staff.email ?? dash}</Field>
        <Field label="Approver">{staff.approver?.full_name ?? dash}</Field>
        <Field label="Initials">{staff.initials ?? dash}</Field>
        <Field label="Hours per working day">{formatMinutes(staff.working_minutes_per_day)}</Field>
        <Field label="Working days">{formatWeekdays(staff.working_days)}</Field>
        <Field label="Chargeable target">{formatBasisPoints(staff.chargeable_target_bp)}</Field>
        <Field label="Start date">{formatUkDate(staff.start_date) || dash}</Field>
        <Field label="Leaving date">{formatUkDate(staff.leaving_date) || dash}</Field>
        <Field label="Role">
          <Badge tone="neutral">{roleName(staff.role)}</Badge>
        </Field>
      </dl>
    </Card>
  );
}

function RateSummary({
  kind,
  rate,
  source,
  canManage,
  onSet,
}: {
  kind: RateKind;
  rate: number | null;
  source: string | null;
  canManage: boolean;
  onSet: () => void;
}) {
  const label = kind === 'cost' ? 'Cost rate' : 'Charge-out rate';
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-sunken p-4">
      <span className="text-xs font-medium text-text-muted">{label} today</span>
      <span className="text-xl font-semibold text-text tabular-nums">{formatRate(rate)}</span>
      <span className="text-xs text-text-muted">{sourceLabel(source)}</span>
      {canManage ? (
        <Button
          size="sm"
          className="mt-2 self-start"
          leftIcon={<Plus aria-hidden="true" className="size-4" />}
          onClick={onSet}
        >
          Set {kind === 'cost' ? 'cost rate' : 'charge-out rate'}
        </Button>
      ) : null}
    </div>
  );
}

function RatesCard({ staff }: { staff: StaffDetail }) {
  const { organization, can } = useOrg();
  const canManage = can(PERMISSIONS.rateManage);
  const rules = useRateRules({ user_id: staff.id, sort: 'effective_from', order: 'desc' });
  const [kind, setKind] = useState<RateKind | null>(null);
  const rows = flattenPages(rules.data);

  return (
    <>
      <StaffRatePanel
        staff={kind ? staff : null}
        kind={kind ?? 'charge'}
        onClose={() => setKind(null)}
      />
      <Card padding="none" role="region" aria-label="Rates">
        <CardHeader
          title="Rates"
          description="What this person costs the practice and what you charge for them. Time uses the rate in force on its date."
          actions={
            <>
              <Link
                to={routes.org.module(organization.slug, 'team', 'rate-preview')}
                className={buttonClasses({ size: 'sm' })}
              >
                Rate preview
              </Link>
              <Link
                to={routes.org.module(organization.slug, 'team', 'rate-history')}
                className={buttonClasses({ size: 'sm' })}
              >
                Rate history
              </Link>
            </>
          }
        />
        <div className="flex flex-col gap-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <RateSummary
              kind="cost"
              rate={staff.cost_rate}
              source={staff.cost_rate_source}
              canManage={canManage}
              onSet={() => setKind('cost')}
            />
            <RateSummary
              kind="charge"
              rate={staff.charge_rate}
              source={staff.charge_rate_source}
              canManage={canManage}
              onSet={() => setKind('charge')}
            />
          </div>
          {rules.isPending ? (
            <div role="status" aria-label="Loading the rates" className="flex flex-col gap-2">
              <Skeleton shape="rect" className="h-8 w-full" />
              <Skeleton shape="rect" className="h-8 w-full" />
            </div>
          ) : rules.isError ? (
            <p className="text-sm text-danger">Could not load this person&apos;s rates.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-text-muted">
              No rate is set for this person. The grade or practice default applies.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Rates that name this person</caption>
                <thead>
                  <tr className="border-b border-row-border text-xs text-text-muted">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Type
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Applies to
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      Rate
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Period
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((rule) => (
                    <tr key={rule.id} className="border-b border-row-border last:border-b-0">
                      <td className="py-2 pr-4 text-text">{RATE_KIND_LABEL[rule.kind]}</td>
                      <td className="py-2 pr-4 text-text-muted">
                        {rule.level === 'staff'
                          ? 'Everything they do'
                          : scopeNames({ ...rule, staff: null, grade: null }).join(' · ') ||
                            rule.level_label}
                      </td>
                      <td className="py-2 pr-4 text-right text-text tabular-nums">
                        {formatRate(rule.rate)}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-text-muted">
                        {formatPeriod(rule.effective_from, rule.effective_to)}
                      </td>
                      <td className="py-2">
                        <RuleStatusBadge status={rule.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function SignInCard({ staff }: { staff: StaffDetail }) {
  return (
    <Card padding="none" role="region" aria-label="Sign-in">
      <CardHeader
        title="Sign-in"
        description="Use the Actions menu to invite them, link or unlink a login, change their role or reset their password."
      />
      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-3">
        <Field label="Access">
          <LoginStatusBadge status={staff.login_status} />
        </Field>
        <Field label="Sign-in email">{staff.login_email ?? dash}</Field>
        <Field label="Invited">{staff.invited_at ? formatUkDate(staff.invited_at) : dash}</Field>
      </dl>
    </Card>
  );
}

function UsageCard({ staff }: { staff: StaffDetail }) {
  if (staff.usage.length === 0) return null;
  return (
    <Card padding="none" role="region" aria-label="Used by">
      <CardHeader
        title="Used by"
        description="Records that refer to this person. They stay when someone is deactivated; a person with records cannot be deleted."
      />
      <ul className="flex flex-wrap gap-2 p-5">
        {staff.usage.map((item) => (
          <li key={item.kind}>
            <Badge tone="neutral">
              {item.label}: {item.count}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StaffDetailView({ staffId }: { staffId: string }) {
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const staff = useStaffMember(staffId);
  const [secret, setSecret] = useState<TemporaryPassword | null>(null);
  const { actionsFor, edit, dialogs, editPanel } = useStaffActions({
    onSecret: setSecret,
    onDeleted: () => void navigate(routes.org.staff(organization.slug), { replace: true }),
  });
  useDocumentTitle(staff.data ? staff.data.full_name : 'Staff member');
  const listPath = routes.org.staff(organization.slug);

  if (staff.isPending) {
    return (
      <div role="status" aria-label="Loading the staff member" className="flex flex-col gap-4">
        <Skeleton shape="rect" className="h-16 w-full" />
        <Skeleton shape="rect" className="h-48 w-full" />
        <Skeleton shape="rect" className="h-40 w-full" />
      </div>
    );
  }
  if (staff.isError) {
    return isNotFound(staff.error) ? (
      <Card padding="none">
        <EmptyState
          icon={<UserX className="size-6" />}
          title="Staff member not found"
          description="They may have been deleted, or the link is not right."
          action={
            <Link to={listPath} className={buttonClasses({ variant: 'primary' })}>
              Back to Staff Members
            </Link>
          }
        />
      </Card>
    ) : (
      <LoadError
        title="Could not load the staff member"
        error={staff.error}
        onRetry={() => void staff.refetch()}
        retrying={staff.isRefetching}
      />
    );
  }

  const member = staff.data;
  const items = actionsFor(member);
  const canUpdate = can(PERMISSIONS.memberUpdate);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Link
        to={listPath}
        className="inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-medium text-brand-text underline underline-offset-2 hover:text-brand-hover"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to Staff Members
      </Link>
      <Card padding="md" className="flex flex-wrap items-center gap-4">
        <InitialsAvatar
          name={member.full_name}
          initials={member.initials}
          colorKey={member.id}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-xl font-semibold text-text">{member.full_name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span className="tabular-nums">{member.code}</span>
            {member.job_title ? <span>· {member.job_title}</span> : null}
            <StaffStatusBadge status={member.status} />
            <LoginStatusBadge status={member.login_status} />
          </p>
        </div>
        {items.length > 0 ? (
          <Dropdown
            label={`Actions for ${member.full_name}`}
            items={items}
            trigger={
              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                Actions
                <Ellipsis aria-hidden="true" className="size-5 text-text-muted" />
              </span>
            }
          />
        ) : null}
      </Card>
      {editPanel}
      <ProfileCard staff={member} canEdit={canUpdate} onEdit={() => edit(member)} />
      {can(PERMISSIONS.rateRead) ? <RatesCard staff={member} /> : null}
      <SignInCard staff={member} />
      <UsageCard staff={member} />
      {can(PERMISSIONS.auditLogRead) ? (
        <RecordHistory targetType="member" targetId={member.id} title="Activity" />
      ) : null}
      {dialogs}
      <TemporaryPasswordDialog secret={secret} onClose={() => setSecret(null)} />
    </div>
  );
}

/**
 * `/:orgSlug/team/staff/:staffId`: one person in one place: profile, rates, sign-in, what refers
 * to them and (with `audit_log.read`) what happened to them. Needs `member.read`.
 */
export default function StaffDetailPage() {
  const { staffId } = useParams();
  const { can } = useOrg();
  if (!can(PERMISSIONS.memberRead)) return <NoAccess what="the staff list" />;
  return staffId ? <StaffDetailView staffId={staffId} /> : null;
}
