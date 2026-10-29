import { Tags } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { FormAlert } from '@/components/forms';
import { Badge, Button, Card, CardHeader, Checkbox, Skeleton, useToast } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import {
  useSegments,
  useSetStaffSegments,
  useStaffSegments,
  type Segment,
} from '@/features/settings';
import { isApiError } from '@/services/api';

import type { StaffDetail } from '../../types';

const clientsOf = (slug: string, names: ReadonlyArray<string>) =>
  `${routes.org.clients(slug)}?${names.map((name) => `segment=${encodeURIComponent(name)}`).join('&')}`;

function SegmentsEditor({
  staff,
  held,
  onClose,
}: {
  staff: StaffDetail;
  held: ReadonlyArray<Segment>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const all = useSegments();
  const save = useSetStaffSegments(staff.id);
  const [wanted, setWanted] = useState<string[]>(held.map((segment) => segment.id));
  const [failure, setFailure] = useState<string | null>(null);

  // Active segments can be added; one already held stays listed even when it is inactive.
  const offered = (all.data ?? []).filter(
    (segment) => segment.is_active || held.some((entry) => entry.id === segment.id),
  );
  const unchanged =
    wanted.length === held.length && held.every((segment) => wanted.includes(segment.id));

  const toggle = (id: string, on: boolean) =>
    setWanted((current) => (on ? [...current, id] : current.filter((entry) => entry !== id)));

  const submit = () => {
    setFailure(null);
    save.mutate(wanted, {
      onSuccess: () => {
        toast({ tone: 'success', title: `${staff.full_name}'s segments saved` });
        onClose();
      },
      onError: (error) =>
        setFailure(isApiError(error) ? error.message : 'Could not save the segments.'),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {all.isPending ? (
        <Skeleton shape="rect" className="h-12 w-full" />
      ) : offered.length === 0 ? (
        <p className="text-sm text-text-muted">There are no segments to choose from yet.</p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Segments of {staff.full_name}</legend>
          {offered.map((segment) => (
            <Checkbox
              key={segment.id}
              label={segment.is_active ? segment.name : `${segment.name} (inactive)`}
              description={`${segment.client_count} ${segment.client_count === 1 ? 'client' : 'clients'}`}
              checked={wanted.includes(segment.id)}
              onChange={(event) => toggle(segment.id, event.target.checked)}
            />
          ))}
        </fieldset>
      )}
      {failure ? <FormAlert message={failure} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={save.isPending} disabled={unchanged} onClick={submit}>
          Save segments
        </Button>
      </div>
    </div>
  );
}

/**
 * The client segments a staff member looks after, and how many clients that makes. Anyone who
 * may edit staff can change them; the clients are listed on the Clients page.
 */
export function StaffSegmentsCard({ staff }: { staff: StaffDetail }) {
  const { organization, can } = useOrg();
  const segments = useStaffSegments(staff.id);
  const [editing, setEditing] = useState(false);
  const data = segments.data;
  const canEdit = can(PERMISSIONS.memberUpdate);

  return (
    <Card padding="none" role="region" aria-label="Client segments">
      <CardHeader
        title="Client segments"
        description="The segments this person looks after. The clients in them are this person's clients."
        actions={
          canEdit && !editing ? (
            <Button
              size="sm"
              leftIcon={<Tags aria-hidden="true" className="size-4" />}
              disabled={!data}
              onClick={() => setEditing(true)}
            >
              Edit segments
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-3 p-5">
        {segments.isPending ? (
          <Skeleton shape="rect" className="h-12 w-full" />
        ) : segments.isError || !data ? (
          <p className="text-sm text-danger">Could not load this person&apos;s segments.</p>
        ) : editing ? (
          <SegmentsEditor staff={staff} held={data.segments} onClose={() => setEditing(false)} />
        ) : data.segments.length === 0 ? (
          <p className="text-sm text-text-muted">
            No segments. Give this person segments to see the clients they look after.
          </p>
        ) : (
          <>
            <ul aria-label="Segments" className="flex flex-wrap gap-2">
              {data.segments.map((segment) => (
                <li key={segment.id}>
                  <Badge tone={segment.is_active ? 'violet' : 'neutral'}>{segment.name}</Badge>
                </li>
              ))}
            </ul>
            <p className="text-sm text-text-muted">
              <Link
                to={clientsOf(
                  organization.slug,
                  data.segments.map((segment) => segment.name),
                )}
                className="font-medium text-brand-text hover:underline"
              >
                {data.client_count} {data.client_count === 1 ? 'client' : 'clients'} in these
                segments
              </Link>
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
