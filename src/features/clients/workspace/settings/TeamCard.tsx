import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Select, Skeleton, useToast, type SelectOption } from '@/components/ui';

import { useStaffDirectory, useUpdateClient } from '../../api';
import type { ClientDetail, MemberRead } from '../../types';
import type { ClientAbilities } from '../abilities';
import { SettingsCard } from './SettingsCard';
import {
  TEAM_FORM_FIELDS,
  teamFormSchema,
  teamToForm,
  toTeamPatch,
  type TeamFormValues,
} from './schemas';

export interface TeamCardProps {
  client: ClientDetail;
  abilities: ClientAbilities;
}

/** "Nobody", the active members, and a person who has since left when they are still assigned. */
function memberOptions(
  members: ReadonlyArray<MemberRead>,
  currentId: string | null,
): SelectOption[] {
  const options: SelectOption[] = [
    { value: '', label: 'Nobody' },
    ...members.map((member) => ({ value: member.user_id, label: member.full_name })),
  ];
  if (currentId && !members.some((member) => member.user_id === currentId)) {
    options.push({ value: currentId, label: 'Former member' });
  }
  return options;
}

function TeamForm({ client, abilities, members }: TeamCardProps & { members: MemberRead[] }) {
  const { toast } = useToast();
  const update = useUpdateClient();
  const initial = useMemo(() => teamToForm(client), [client]);
  const canEdit = abilities.edit;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    values: initial,
    resetOptions: { keepDirtyValues: true },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<TeamFormValues>({ setError, fields: TEAM_FORM_FIELDS });

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const body = toTeamPatch(values, client);
    if (Object.keys(body).length === 0) return;
    try {
      await update.mutateAsync({ clientId: client.id, body });
      reset(values);
      toast({ tone: 'success', title: 'Team saved', description: client.name });
    } catch (error) {
      handleSubmitError(error);
    }
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Partner"
          options={memberOptions(members, client.partner_user_id)}
          hint="The partner responsible for the client."
          error={errors.partner_user_id?.message}
          disabled={!canEdit}
          {...register('partner_user_id')}
        />
        <Select
          label="Manager"
          options={memberOptions(members, client.manager_user_id)}
          hint="Looks after the client day to day."
          error={errors.manager_user_id?.message}
          disabled={!canEdit}
          {...register('manager_user_id')}
        />
      </div>
      {canEdit ? (
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting || update.isPending}
            disabled={!isDirty || retryIn > 0}
          >
            Save team
          </Button>
        </div>
      ) : null}
    </form>
  );
}

/** Team: the partner and the manager. Listing the staff needs `member.read`. */
export function TeamCard({ client, abilities }: TeamCardProps) {
  const staff = useStaffDirectory();
  return (
    <SettingsCard title="Team" description="Who is responsible for this client.">
      {!abilities.pickPeople ? (
        <p className="text-sm text-text-muted">
          Your role does not include the staff list, so the partner and the manager cannot be shown
          or changed here.
        </p>
      ) : staff.isPending ? (
        <div aria-busy="true" className="grid gap-4 sm:grid-cols-2">
          <Skeleton shape="rect" className="h-9" />
          <Skeleton shape="rect" className="h-9" />
        </div>
      ) : (
        <TeamForm client={client} abilities={abilities} members={staff.data ?? []} />
      )}
    </SettingsCard>
  );
}
