import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Badge, Button, Checkbox, Input, Modal, Select, useToast } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { parsePounds, penceToPoundsInput } from '@/utils/money';

import { useCreateRateRule, useGradeOptions, useServices, useUpdateRateRule } from '../../api';
import { RATE_KIND_LABEL, SCOPE_OPTIONS, scopeOptionsFor } from '../../constants';
import {
  isRateLevel,
  rateRuleEditSchema,
  rateRuleSchema,
  type RateRuleEditValues,
  type RateRuleValues,
} from '../../schemas/rate';
import type { RateKind, RateLevel, RateRule, RateRuleCreate, RateRuleUpdate } from '../../types';
import { conflictsOf, toFormError } from '../../utils/errors';
import { formatPeriod, scopeNames } from '../../utils/format';
import { ClientPicker } from '../pickers/ClientPicker';
import { StaffPicker } from '../pickers/StaffPicker';
import { DialogActions } from '../DialogActions';

const CREATE_FIELDS = [
  'level',
  'client_id',
  'service_id',
  'user_id',
  'grade_id',
  'rate',
  'effective_from',
  'effective_to',
] as const;
const EDIT_FIELDS = ['rate', 'effective_from', 'effective_to'] as const;

export interface RateRuleDialogProps {
  kind: RateKind;
  /** The rule to change; null to add one. */
  rule: RateRule | null;
  open: boolean;
  /** The scope tab the list is on, offered as the starting choice of a new rate. */
  defaultLevel?: RateLevel;
  onClose: () => void;
}

/** The rules in the way of a new period, as the API reports them. */
function Conflicts({ error }: { error: unknown }) {
  const conflicts = conflictsOf(error);
  if (conflicts.length === 0) return null;
  return (
    <ul aria-label="Rates in the way" className="list-disc pl-5 text-sm text-text">
      {conflicts.map((conflict) => (
        <li key={conflict.id}>{formatPeriod(conflict.effective_from, conflict.effective_to)}</li>
      ))}
    </ul>
  );
}

function CreateRateForm({
  kind,
  defaultLevel,
  onClose,
}: {
  kind: RateKind;
  defaultLevel?: RateLevel;
  onClose: () => void;
}) {
  const { organization, can } = useOrg();
  const create = useCreateRateRule();
  const { toast } = useToast();
  const formId = useId();
  const canPickClient = can(PERMISSIONS.clientRead);
  const canPickPeople = can(PERMISSIONS.memberRead);
  const services = useServices();
  const grades = useGradeOptions({ enabled: canPickPeople });
  const [failure, setFailure] = useState<unknown>(null);

  // Only the levels whose pickers the person can use.
  const options = scopeOptionsFor(kind).filter(
    (option) =>
      (!option.needs.client || canPickClient) &&
      ((!option.needs.staff && !option.needs.grade) || canPickPeople),
  );
  const startLevel = options.find((option) => option.level === defaultLevel) ?? options[0];

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<RateRuleValues>({
    resolver: zodResolver(rateRuleSchema),
    defaultValues: {
      level: startLevel?.level ?? '',
      client_id: null,
      service_id: '',
      user_id: null,
      grade_id: '',
      rate: '',
      effective_from: todayInZone(organization.timezone),
      effective_to: '',
      close_previous: false,
    },
  });
  const level = useWatch({ control, name: 'level' });
  const selected = SCOPE_OPTIONS.find((option) => option.level === level);
  const needs = selected?.needs;
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<RateRuleValues>({ setError, fields: CREATE_FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    setFailure(null);
    if (!isRateLevel(values.level)) return;
    const wants = SCOPE_OPTIONS.find((option) => option.level === values.level)?.needs;
    const body: RateRuleCreate = {
      kind,
      rate: parsePounds(values.rate) ?? 0,
      effective_from: values.effective_from,
    };
    if (wants?.client && values.client_id) body.client_id = values.client_id;
    if (wants?.service && values.service_id) body.service_id = values.service_id;
    if (wants?.staff && values.user_id) body.user_id = values.user_id;
    if (wants?.grade && values.grade_id) body.grade_id = values.grade_id;
    if (values.effective_to) body.effective_to = values.effective_to;
    if (values.close_previous) body.close_previous = true;
    create.mutate(body, {
      onSuccess: () => {
        toast({ tone: 'success', title: `${RATE_KIND_LABEL[kind]} rate added` });
        onClose();
      },
      onError: (error) => {
        setFailure(error);
        handleSubmitError(toFormError(error));
      },
    });
  });

  const serviceOptions = (services.data ?? [])
    .filter((service) => service.is_active)
    .map((service) => ({ value: service.id, label: service.name }));
  const gradeOptions = (grades.data ?? [])
    .filter((grade) => grade.is_active)
    .map((grade) => ({ value: grade.id, label: grade.name }));

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        {options.length === 0 ? (
          <p className="rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-sm text-text-muted">
            You need permission to view staff and grades to choose who a rate applies to.
          </p>
        ) : null}
        <Select
          label="Applies to"
          options={options.map((option) => ({ value: option.level, label: option.label }))}
          hint={selected?.help}
          error={errors.level?.message}
          {...register('level')}
        />
        {needs?.client ? (
          <Controller
            control={control}
            name="client_id"
            render={({ field }) => (
              <ClientPicker
                label="Client"
                value={field.value}
                onChange={(id) => field.onChange(id)}
                error={errors.client_id?.message}
              />
            )}
          />
        ) : null}
        {needs?.service ? (
          <Select
            label="Service"
            placeholder="Choose a service"
            options={serviceOptions}
            error={errors.service_id?.message}
            {...register('service_id')}
          />
        ) : null}
        {needs?.staff ? (
          <Controller
            control={control}
            name="user_id"
            render={({ field }) => (
              <StaffPicker
                label="Staff member"
                value={field.value}
                onChange={(id) => field.onChange(id)}
                error={errors.user_id?.message}
              />
            )}
          />
        ) : null}
        {needs?.grade ? (
          <Select
            label="Grade"
            placeholder="Choose a grade"
            options={gradeOptions}
            error={errors.grade_id?.message}
            {...register('grade_id')}
          />
        ) : null}
        <Input
          label="Rate per hour (£)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="95.00"
          error={errors.rate?.message}
          {...register('rate')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Effective from"
            type="date"
            error={errors.effective_from?.message}
            {...register('effective_from')}
          />
          <Input
            label="Effective to"
            type="date"
            hint="Leave empty for open-ended."
            error={errors.effective_to?.message}
            {...register('effective_to')}
          />
        </div>
        <Controller
          control={control}
          name="close_previous"
          render={({ field }) => (
            <Checkbox
              label="End the earlier open-ended rate the day before this one starts"
              description="Use it to replace the rate in force instead of overlapping it."
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
        {submitError ? (
          <div className="flex flex-col gap-2">
            <FormAlert message={submitError.message} requestId={submitError.requestId} />
            <Conflicts error={failure} />
          </div>
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={create.isPending}
          disabled={retryIn > 0 || options.length === 0}
        >
          Add rate
        </Button>
      </DialogActions>
    </>
  );
}

function EditRateForm({ rule, onClose }: { rule: RateRule; onClose: () => void }) {
  const update = useUpdateRateRule();
  const { toast } = useToast();
  const formId = useId();
  const [failure, setFailure] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<RateRuleEditValues>({
    resolver: zodResolver(rateRuleEditSchema),
    defaultValues: {
      rate: penceToPoundsInput(rule.rate),
      effective_from: rule.effective_from,
      effective_to: rule.effective_to ?? '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<RateRuleEditValues>({ setError, fields: EDIT_FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    setFailure(null);
    // PATCH is partial: send only what changed; null makes the rate open-ended again.
    const changes: RateRuleUpdate = {};
    const pence = parsePounds(values.rate);
    if (pence !== null && pence !== rule.rate) changes.rate = pence;
    if (values.effective_from !== rule.effective_from)
      changes.effective_from = values.effective_from;
    const to = values.effective_to || null;
    if (to !== rule.effective_to) changes.effective_to = to;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { ruleId: rule.id, body: changes },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `${RATE_KIND_LABEL[rule.kind]} rate saved` });
          onClose();
        },
        onError: (error) => {
          setFailure(error);
          handleSubmitError(toFormError(error));
        },
      },
    );
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-sunken px-3 py-2.5">
          <span className="text-xs font-medium text-text-muted">Applies to</span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-text">
            <Badge tone="violet" size="sm">
              {rule.level_label}
            </Badge>
            {scopeNames(rule).join(' · ')}
          </span>
        </div>
        <Input
          label="Rate per hour (£)"
          inputMode="decimal"
          autoComplete="off"
          error={errors.rate?.message}
          {...register('rate')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Effective from"
            type="date"
            disabled={rule.is_used}
            hint={
              rule.is_used
                ? 'Time has been recorded under this rate, so its start date cannot change.'
                : undefined
            }
            error={errors.effective_from?.message}
            {...register('effective_from')}
          />
          <Input
            label="Effective to"
            type="date"
            hint="Leave empty for open-ended."
            error={errors.effective_to?.message}
            {...register('effective_to')}
          />
        </div>
        {rule.is_used ? (
          <p className="text-xs text-text-muted">
            A rate in use can be end-dated and its amount changed. Entries already recorded keep
            their rates.
          </p>
        ) : null}
        {submitError ? (
          <div className="flex flex-col gap-2">
            <FormAlert message={submitError.message} requestId={submitError.requestId} />
            <Conflicts error={failure} />
          </div>
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={update.isPending}
          disabled={!isDirty || retryIn > 0}
        >
          Save rate
        </Button>
      </DialogActions>
    </>
  );
}

/** Add a rate (scope, amount and period) or change one (amount and period; the scope is fixed). */
export function RateRuleDialog({ kind, rule, open, defaultLevel, onClose }: RateRuleDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rule ? 'Edit rate' : `Add ${kind === 'cost' ? 'cost' : 'charge-out'} rate`}
      description={
        rule
          ? `${RATE_KIND_LABEL[rule.kind]} rate · ${rule.level_label}`
          : kind === 'cost'
            ? 'What a person or a grade costs the practice per hour.'
            : 'What the practice charges per hour. The most specific rate in force wins.'
      }
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? (
        rule ? (
          <EditRateForm key={rule.id} rule={rule} onClose={onClose} />
        ) : (
          <CreateRateForm kind={kind} defaultLevel={defaultLevel} onClose={onClose} />
        )
      ) : null}
    </Modal>
  );
}
