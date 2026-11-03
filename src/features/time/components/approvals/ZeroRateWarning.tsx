import { Link } from 'react-router';

import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { formatMinutesLong } from '@/utils/minutes';

import { Notice } from '../Notice';

export interface UnpricedTime {
  key: string;
  /** Whose time it is. */
  name: string | null;
  /** Billable minutes with no charge-out rate (`zero_rate_minutes`). */
  minutes: number;
  /** Their staff id (the user id), for the link to their rates. */
  staffId?: string;
}

/**
 * Billable time with no charge-out rate goes to WIP at £0 once it is approved (ticket APT17).
 * Said in the approval dialog, one line per person, so the approver can check the rates first;
 * approving is still allowed. Renders nothing when every hour is priced.
 */
export function ZeroRateWarning({ people }: { people: ReadonlyArray<UnpricedTime> }) {
  const { organization, can } = useOrg();
  const unpriced = people.filter((person) => person.minutes > 0);
  if (unpriced.length === 0) return null;
  const canOpen = can(PERMISSIONS.memberRead);
  return (
    <Notice tone="warning" title="Time with no charge-out rate">
      <ul className="flex flex-col gap-1">
        {unpriced.map((person) => {
          const name = person.name ?? 'this person';
          const where = `Team & Rates → ${name}`;
          return (
            <li key={person.key}>
              {formatMinutesLong(person.minutes)} of {name}&apos;s time has no charge-out rate, so
              it will go to WIP at £0. Check their rates (
              {canOpen && person.staffId ? (
                <Link
                  to={routes.org.staffMember(organization.slug, person.staffId)}
                  className="font-semibold text-brand-text hover:underline"
                >
                  {where}
                </Link>
              ) : (
                where
              )}
              ) before approving.
            </li>
          );
        })}
      </ul>
    </Notice>
  );
}
