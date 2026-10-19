import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Badge, Button, Input, Modal, Skeleton, useToast } from '@/components/ui';
import { formatBasisPoints } from '@/utils/money';

import { useMappings, usePutMappings } from '../../api/adminHooks';
import type { Mappings, MappingsWrite } from '../../adminTypes';
import { mappingsSchema, type MappingsValues } from '../../schemas/admin';
import { DialogActions } from '../DialogActions';
import { LoadError } from '../LoadError';

const toValues = (mappings: Mappings): MappingsValues => ({
  services: mappings.services.map((row) => ({
    service_id: row.service_id,
    account_code: row.account_code ?? '',
    account_name: row.account_name ?? '',
  })),
  vat_rates: mappings.vat_rates.map((row) => ({
    vat_rate_id: row.vat_rate_id,
    tax_code: row.tax_code ?? '',
    tax_name: row.tax_name ?? '',
  })),
});

function RowName({
  title,
  detail,
  flag,
}: {
  title: string;
  detail?: string | null;
  flag?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex items-center gap-2 text-sm font-medium text-text">
        <span className="truncate">{title}</span>
        {flag ? (
          <Badge tone="grey" size="sm">
            {flag}
          </Badge>
        ) : null}
      </span>
      {detail ? <span className="truncate text-xs text-text-muted">{detail}</span> : null}
    </div>
  );
}

function MappingsForm({
  mappings,
  readOnly,
  onClose,
}: {
  mappings: Mappings;
  readOnly: boolean;
  onClose: () => void;
}) {
  const save = usePutMappings();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<MappingsValues>({
    resolver: zodResolver(mappingsSchema),
    defaultValues: toValues(mappings),
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<MappingsValues>({ setError, fields: [] });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    // The complete set: a row left empty is not mapped.
    const body: MappingsWrite = {
      services: values.services
        .filter((row) => row.account_code !== '')
        .map((row) => ({
          service_id: row.service_id,
          account_code: row.account_code,
          account_name: row.account_name || null,
        })),
      vat_rates: values.vat_rates
        .filter((row) => row.tax_code !== '')
        .map((row) => ({
          vat_rate_id: row.vat_rate_id,
          tax_code: row.tax_code,
          tax_name: row.tax_name || null,
        })),
    };
    save.mutate(body, {
      onSuccess: (saved) => {
        const left = saved.unmapped_services + saved.unmapped_vat_rates;
        toast({
          tone: 'success',
          title: 'Mappings saved',
          description:
            left === 0
              ? 'Everything is mapped. Retry the failed items to send them.'
              : `${left} still not mapped.`,
        });
        onClose();
      },
      onError: handleSubmitError,
    });
  });

  const left = mappings.unmapped_services + mappings.unmapped_vat_rates;

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-5"
      >
        <p className="text-sm text-text-muted" role="status">
          {left === 0
            ? 'Everything is mapped.'
            : `${mappings.unmapped_services} of ${mappings.services.length} services and ${mappings.unmapped_vat_rates} of ${mappings.vat_rates.length} VAT codes are not mapped.`}{' '}
          A document with a line that has an unmapped service or VAT code is not sent. After adding
          a mapping, retry the failed items.
        </p>

        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-text">
            Income account by service
          </legend>
          {mappings.services.map((row, index) => {
            const name = row.name ?? 'Lines without a service';
            return (
              <div
                key={row.service_id ?? 'none'}
                className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,12rem)]"
              >
                <RowName
                  title={name}
                  detail={row.code}
                  flag={row.is_active === false ? 'Inactive' : undefined}
                />
                <Input
                  label={`Account code for ${name}`}
                  hideLabel
                  placeholder="Account code"
                  autoComplete="off"
                  error={errors.services?.[index]?.account_code?.message}
                  {...register(`services.${index}.account_code`)}
                />
                <Input
                  label={`Account name for ${name}`}
                  hideLabel
                  placeholder="Account name (optional)"
                  autoComplete="off"
                  error={errors.services?.[index]?.account_name?.message}
                  {...register(`services.${index}.account_name`)}
                />
              </div>
            );
          })}
        </fieldset>

        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-text">Tax code by VAT code</legend>
          {mappings.vat_rates.map((row, index) => {
            const name = row.name ?? 'Lines without a VAT code';
            return (
              <div
                key={row.vat_rate_id ?? 'none'}
                className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,12rem)]"
              >
                <RowName
                  title={name}
                  detail={row.rate_bp === null ? null : formatBasisPoints(row.rate_bp)}
                  flag={row.is_archived ? 'Archived' : undefined}
                />
                <Input
                  label={`Tax code for ${name}`}
                  hideLabel
                  placeholder="Tax code"
                  autoComplete="off"
                  error={errors.vat_rates?.[index]?.tax_code?.message}
                  {...register(`vat_rates.${index}.tax_code`)}
                />
                <Input
                  label={`Tax name for ${name}`}
                  hideLabel
                  placeholder="Tax name (optional)"
                  autoComplete="off"
                  error={errors.vat_rates?.[index]?.tax_name?.message}
                  {...register(`vat_rates.${index}.tax_name`)}
                />
              </div>
            );
          })}
        </fieldset>

        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {readOnly ? null : (
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={save.isPending}
            disabled={!isDirty || retryIn > 0}
          >
            Save mappings
          </Button>
        )}
      </DialogActions>
    </>
  );
}

export interface MappingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Holds `integration.manage`; without it the mappings can be read only. */
  canManage: boolean;
}

/** Which income account each service is booked to, and which tax code each VAT code. */
export function MappingsDialog({ open, onClose, canManage }: MappingsDialogProps) {
  const mappings = useMappings({ enabled: open });

  let body = null;
  if (open && mappings.isPending) {
    body = (
      <div role="status" aria-label="Loading the mappings" className="flex flex-col gap-3">
        <Skeleton shape="rect" className="h-10 w-full" />
        <Skeleton shape="rect" className="h-10 w-full" />
        <Skeleton shape="rect" className="h-10 w-full" />
      </div>
    );
  } else if (open && mappings.isError && !mappings.data) {
    body = (
      <LoadError
        title="Could not load the mappings"
        error={mappings.error}
        onRetry={() => void mappings.refetch()}
        retrying={mappings.isRefetching}
      />
    );
  } else if (open && mappings.data) {
    body = <MappingsForm mappings={mappings.data} readOnly={!canManage} onClose={onClose} />;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bookkeeping mappings"
      description="The codes of the bookkeeping system that each service and VAT code is booked to."
      size="lg"
      closeOnBackdrop={false}
    >
      {body}
    </Modal>
  );
}
