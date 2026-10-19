import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import { useCreateInvoiceTemplate, useUpdateInvoiceTemplate } from '../../api/billingHooks';
import type {
  InvoiceTemplate,
  InvoiceTemplateCreate,
  InvoiceTemplateUpdate,
} from '../../billingTypes';
import { invoiceTemplateSchema, type InvoiceTemplateValues } from '../../schemas/billing';
import { toBillingFormError } from '../../utils/billingErrors';
import { FOOTER_MAX, LAYOUT_HINT, LAYOUT_OPTIONS } from '../../utils/templates';
import { DialogActions } from '../DialogActions';
import { InvoicePreview } from './InvoicePreview';

const FIELDS = ['name', 'layout', 'show_logo', 'show_bank_details', 'footer_text'] as const;

export interface InvoiceTemplateFormDialogProps {
  /** The template to change, null to add one. */
  template: InvoiceTemplate | null;
  open: boolean;
  /** Shows the template and its preview without the means to change it (no `settings.manage`). */
  readOnly?: boolean;
  onClose: () => void;
}

interface TemplateFormProps {
  template: InvoiceTemplate | null;
  readOnly: boolean;
  onClose: () => void;
}

function TemplateForm({ template, readOnly, onClose }: TemplateFormProps) {
  const { organization } = useOrg();
  const create = useCreateInvoiceTemplate();
  const update = useUpdateInvoiceTemplate();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<InvoiceTemplateValues>({
    resolver: zodResolver(invoiceTemplateSchema),
    defaultValues: {
      name: template?.name ?? '',
      layout: template?.layout ?? 'standard',
      show_logo: template?.show_logo ?? true,
      show_bank_details: template?.show_bank_details ?? true,
      footer_text: template?.footer_text ?? '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<InvoiceTemplateValues>({ setError, fields: FIELDS });
  const draft = useWatch({ control });
  const saving = create.isPending || update.isPending;
  const footerLength = Array.from(draft.footer_text ?? '').length;

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const footer = values.footer_text || null;
    const onError = (error: unknown) => handleSubmitError(toBillingFormError(error));

    if (!template) {
      const body: InvoiceTemplateCreate = {
        name: values.name,
        layout: values.layout,
        show_logo: values.show_logo,
        show_bank_details: values.show_bank_details,
      };
      if (footer) body.footer_text = footer;
      create.mutate(body, {
        onSuccess: (created) => {
          toast({ tone: 'success', title: `${created.name} added` });
          onClose();
        },
        onError,
      });
      return;
    }

    // PATCH is partial: send only what changed (null clears the footer).
    const changes: InvoiceTemplateUpdate = {};
    if (values.name !== template.name) changes.name = values.name;
    if (values.layout !== template.layout) changes.layout = values.layout;
    if (values.show_logo !== template.show_logo) changes.show_logo = values.show_logo;
    if (values.show_bank_details !== template.show_bank_details) {
      changes.show_bank_details = values.show_bank_details;
    }
    if (footer !== template.footer_text) changes.footer_text = footer;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { templateId: template.id, body: changes },
      {
        onSuccess: (saved) => {
          toast({ tone: 'success', title: `${saved.name} saved` });
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <form
          id={formId}
          noValidate
          aria-label="Invoice template"
          onSubmit={(event) => void onSubmit(event)}
          className="flex min-w-0 flex-col gap-4"
        >
          <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
            <Input
              label="Name"
              autoComplete="off"
              hint="Shown when a template is chosen for a client."
              error={errors.name?.message}
              {...register('name')}
            />
            <Select
              label="Layout"
              options={LAYOUT_OPTIONS}
              hint={LAYOUT_HINT[draft.layout ?? 'standard']}
              error={errors.layout?.message}
              {...register('layout')}
            />
            <Checkbox
              label="Show the practice logo"
              description="Printed at the top of the invoice."
              {...register('show_logo')}
            />
            <Checkbox
              label="Show the bank details"
              description="Printed so clients know where to pay. They come from the practice settings."
              {...register('show_bank_details')}
            />
            <Textarea
              label="Footer text"
              rows={4}
              hint={`Printed at the foot of the invoice. ${footerLength}/${FOOTER_MAX} characters.`}
              error={errors.footer_text?.message}
              {...register('footer_text')}
            />
          </fieldset>
          {submitError ? (
            <FormAlert message={submitError.message} requestId={submitError.requestId} />
          ) : null}
        </form>
        <InvoicePreview
          layout={draft.layout ?? 'standard'}
          showLogo={draft.show_logo ?? true}
          showBankDetails={draft.show_bank_details ?? true}
          footerText={draft.footer_text ?? ''}
          practice={organization}
        />
      </div>
      <DialogActions>
        {readOnly ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              loading={saving}
              disabled={(template !== null && !isDirty) || retryIn > 0}
            >
              {template ? 'Save template' : 'Add template'}
            </Button>
          </>
        )}
      </DialogActions>
    </>
  );
}

/**
 * Add an invoice template, or change one: name, layout, whether the logo and bank details are
 * printed, and the footer, with a preview of the invoice that follows the fields as they change.
 */
export function InvoiceTemplateFormDialog({
  template,
  open,
  readOnly = false,
  onClose,
}: InvoiceTemplateFormDialogProps) {
  const title = readOnly
    ? 'Invoice template'
    : template
      ? 'Edit invoice template'
      : 'Add invoice template';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={
        template
          ? template.name
          : 'How an invoice looks: the layout of its lines, the logo, the bank details and the footer.'
      }
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? (
        <TemplateForm
          key={template?.id ?? 'new'}
          template={template}
          readOnly={readOnly}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
