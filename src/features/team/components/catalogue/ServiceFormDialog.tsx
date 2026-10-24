import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { parsePounds, penceToPoundsInput } from '@/utils/money';

import {
  ActivityLinkError,
  TaskTemplateSaveError,
  useActivityTypes,
  useSaveService,
  useServiceTaskTemplates,
  useVatCodes,
} from '../../api';
import { serviceSchema, type ServiceValues } from '../../schemas/catalogue';
import type { BillingBasis, Service, ServiceCreate, ServiceUpdate } from '../../types';
import { dialogError, toFormError } from '../../utils/errors';
import { TaskTemplateEditor } from './TaskTemplateEditor';
import {
  hasErrors,
  rowsFromTemplates,
  toTemplateInputs,
  validateRows,
  type TemplateRow,
} from './taskTemplateRows';
import { vatOptions } from './vat';
import { DialogActions } from '../DialogActions';

const FIELDS = [
  'code',
  'name',
  'description',
  'billing_basis',
  'default_fee',
  'default_billable',
  'vat_rate_id',
  'invoice_description',
  'sort_order',
] as const;

const BASIS_OPTIONS: ReadonlyArray<{ value: BillingBasis; label: string }> = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'fixed', label: 'Fixed fee' },
];

/** Pounds as typed → pence, or null for an empty field. */
const pence = (text: string) => (text.trim() === '' ? null : parsePounds(text));

const sameSet = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((id) => b.includes(id));

export interface ServiceFormDialogProps {
  /** The service to change, null to add one. */
  service: Service | null;
  open: boolean;
  onClose: () => void;
}

function ServiceForm({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const save = useSaveService();
  const { toast } = useToast();
  const formId = useId();
  const vatCodes = useVatCodes();
  const activityTypes = useActivityTypes();
  // The default tasks are edited as a list of their own: loaded when a service is edited, and
  // saved (with the service) only when they were changed.
  const templates = useServiceTaskTemplates(service?.id);
  const loadedRows = useMemo(() => rowsFromTemplates(templates.data ?? []), [templates.data]);
  const [editedRows, setEditedRows] = useState<TemplateRow[] | null>(null);
  const [showTemplateErrors, setShowTemplateErrors] = useState(false);
  const rows = editedRows ?? loadedRows;
  const templatesChanged =
    editedRows !== null &&
    (service === null ? editedRows.length > 0 : templates.isSuccess) &&
    JSON.stringify(toTemplateInputs(editedRows)) !== JSON.stringify(toTemplateInputs(loadedRows));
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      code: service?.code ?? '',
      name: service?.name ?? '',
      description: service?.description ?? '',
      billing_basis: service?.billing_basis === 'fixed' ? 'fixed' : 'hourly',
      default_fee: penceToPoundsInput(service?.default_fee),
      default_billable: service?.default_billable ?? true,
      vat_rate_id: service?.vat_rate_id ?? '',
      invoice_description: service?.invoice_description ?? '',
      sort_order: String(service?.sort_order ?? 0),
      activity_code_ids: service?.activity_code_ids ?? [],
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ServiceValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    if (templatesChanged) {
      setShowTemplateErrors(true);
      if (hasErrors(validateRows(rows))) return;
    }
    const templateInputs = templatesChanged ? toTemplateInputs(rows) : undefined;
    const code = values.code.toUpperCase();
    const description = values.description || null;
    const fee = pence(values.default_fee);
    const vat = values.vat_rate_id || null;
    const invoiceText = values.invoice_description || null;
    const sortOrder = Number(values.sort_order);
    const basis: BillingBasis = values.billing_basis;
    const onError = (error: unknown) => {
      if (error instanceof TaskTemplateSaveError) {
        if (service) {
          // Editing: the service is saved, nothing is lost; show why and let the person retry.
          handleSubmitError(toFormError(error.reason));
          return;
        }
        toast({
          tone: 'warning',
          title: `${error.saved?.name ?? values.name} saved, but its default tasks were not`,
          description: `${dialogError(error.reason).message} Edit the service to try again.`,
        });
        onClose();
        return;
      }
      if (error instanceof ActivityLinkError) {
        // The service is saved; only its activity types were refused.
        toast({
          tone: 'warning',
          title: `${error.saved?.name ?? values.name} saved, but its activity types were not`,
          description: `${dialogError(error.reason).message} Edit the service to try again.`,
        });
        onClose();
        return;
      }
      handleSubmitError(toFormError(error));
    };

    if (!service) {
      const body: ServiceCreate = {
        code,
        name: values.name,
        billing_basis: basis,
        default_billable: values.default_billable,
        sort_order: sortOrder,
      };
      if (description) body.description = description;
      if (fee !== null) body.default_fee = fee;
      if (vat) body.vat_rate_id = vat;
      if (invoiceText) body.invoice_description = invoiceText;
      save.mutate(
        {
          mode: 'create',
          body,
          activityTypeIds: values.activity_code_ids,
          templates: templateInputs,
        },
        {
          onSuccess: () => {
            toast({ tone: 'success', title: `${values.name} added` });
            onClose();
          },
          onError,
        },
      );
      return;
    }

    // PATCH is partial: send only what changed (null clears the optional fields).
    const changes: ServiceUpdate = {};
    if (code !== service.code) changes.code = code;
    if (values.name !== service.name) changes.name = values.name;
    if (description !== service.description) changes.description = description;
    if (basis !== service.billing_basis) changes.billing_basis = basis;
    if (fee !== service.default_fee) changes.default_fee = fee;
    if (values.default_billable !== service.default_billable) {
      changes.default_billable = values.default_billable;
    }
    if (vat !== service.vat_rate_id) changes.vat_rate_id = vat;
    if (invoiceText !== service.invoice_description) changes.invoice_description = invoiceText;
    if (sortOrder !== service.sort_order) changes.sort_order = sortOrder;
    const activityChanged = !sameSet(values.activity_code_ids, service.activity_code_ids);
    if (Object.keys(changes).length === 0 && !activityChanged && !templatesChanged) {
      onClose();
      return;
    }
    save.mutate(
      {
        mode: 'update',
        serviceId: service.id,
        body: changes,
        activityTypeIds: activityChanged ? values.activity_code_ids : undefined,
        templates: templateInputs,
      },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `${values.name} saved` });
          onClose();
        },
        onError,
      },
    );
  });

  // Active types, and any inactive one the service is still limited to.
  const linked = service?.activity_code_ids ?? [];
  const typeChoices = (activityTypes.data ?? []).filter(
    (type) => type.is_active || linked.includes(type.id),
  );

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Input
            label="Name"
            required
            autoComplete="off"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Code"
            required
            autoComplete="off"
            maxLength={12}
            error={errors.code?.message}
            {...register('code')}
          />
        </div>
        <Textarea
          label="Description"
          rows={2}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Billing basis"
            options={BASIS_OPTIONS}
            hint="How jobs of this service are billed unless they say otherwise."
            error={errors.billing_basis?.message}
            {...register('billing_basis')}
          />
          <Input
            label="Default fee (£)"
            inputMode="decimal"
            autoComplete="off"
            hint="The fee suggested for a fixed-fee job. Empty for none."
            error={errors.default_fee?.message}
            {...register('default_fee')}
          />
          <Select
            label="VAT code"
            options={vatOptions(vatCodes.data, service?.vat_rate_id ?? null)}
            error={errors.vat_rate_id?.message}
            {...register('vat_rate_id')}
          />
          <Input
            label="Sort order"
            inputMode="numeric"
            autoComplete="off"
            hint="Services are listed from the lowest number."
            error={errors.sort_order?.message}
            {...register('sort_order')}
          />
        </div>
        <Controller
          control={control}
          name="default_billable"
          render={({ field }) => (
            <Checkbox
              label="Billable by default"
              description="Untick for internal work: new jobs of this service then start as non-billable."
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
        <Textarea
          label="Invoice description"
          rows={2}
          hint="The wording suggested for the line of an invoice."
          error={errors.invoice_description?.message}
          {...register('invoice_description')}
        />
        <Controller
          control={control}
          name="activity_code_ids"
          render={({ field }) => (
            <fieldset className="flex min-w-0 flex-col gap-1.5">
              <legend className="mb-1 text-sm font-medium text-text">Activity types</legend>
              <p className="text-xs text-text-muted">
                Time on jobs of this service may only use the ticked types. Leave none ticked to
                allow every activity type.
              </p>
              {typeChoices.length === 0 ? (
                <p className="rounded-md border border-border px-3 py-2 text-sm text-text-muted">
                  {activityTypes.isPending ? 'Loading activity types…' : 'No activity types yet.'}
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border px-3 py-1">
                  {typeChoices.map((type) => (
                    <Checkbox
                      key={type.id}
                      label={type.name}
                      description={`${type.code}${type.is_active ? '' : ' · inactive'}`}
                      checked={field.value.includes(type.id)}
                      onChange={(event) =>
                        field.onChange(
                          event.target.checked
                            ? [...field.value, type.id]
                            : field.value.filter((id) => id !== type.id),
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </fieldset>
          )}
        />
        {service && templates.isPending ? (
          <p className="text-sm text-text-muted">Loading default tasks…</p>
        ) : service && templates.isError ? (
          <FormAlert
            message="Could not load the default tasks of this service, so they cannot be changed now."
            action={
              <Button size="sm" onClick={() => void templates.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <TaskTemplateEditor
            rows={rows}
            onChange={setEditedRows}
            showErrors={showTemplateErrors}
          />
        )}
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
          loading={save.isPending}
          disabled={(service !== null && !isDirty && !templatesChanged) || retryIn > 0}
        >
          {service ? 'Save service' : 'Add service'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Add a service, or change one: its defaults, VAT, invoice wording and the activity types it allows. */
export function ServiceFormDialog({ service, open, onClose }: ServiceFormDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? 'Edit service' : 'Add service'}
      description={
        service
          ? `${service.name} · ${service.code}`
          : 'A kind of work the practice sells. Jobs and engagements take their defaults from it.'
      }
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? <ServiceForm key={service?.id ?? 'new'} service={service} onClose={onClose} /> : null}
    </Modal>
  );
}
