import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, FormPanel, Select, Textarea, useToast } from '@/components/ui';
import { pictureRefusal } from '@/features/account';
import { useOrg } from '@/features/organizations';
import { useObjectUrl } from '@/hooks';
import { isApiError } from '@/services/api';

import {
  useCreateInvoiceTemplate,
  useRemoveWatermarkImage,
  useUpdateInvoiceTemplate,
  useUploadWatermarkImage,
  useWatermarkImage,
} from '../../api/billingHooks';
import type {
  InvoiceTemplate,
  InvoiceTemplateCreate,
  InvoiceTemplateUpdate,
} from '../../billingTypes';
import { invoiceTemplateSchema, type InvoiceTemplateValues } from '../../schemas/billing';
import { toBillingFormError } from '../../utils/billingErrors';
import {
  FOOTER_MAX,
  LAYOUT_HINT,
  LAYOUT_OPTIONS,
  WATERMARK_KIND_OPTIONS,
  WATERMARK_MAX,
} from '../../utils/templates';
import { DialogActions } from '../DialogActions';
import { AccentColorField } from './AccentColorField';
import { InvoicePreview } from './InvoicePreview';
import { WatermarkImageField } from './WatermarkImageField';

const FIELDS = [
  'name',
  'layout',
  'show_logo',
  'show_bank_details',
  'footer_text',
  'accent_color',
  'watermark_text',
] as const;

export interface InvoiceTemplateFormPanelProps {
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
  const uploadImage = useUploadWatermarkImage();
  const removeImage = useRemoveWatermarkImage();
  const savedImage = useWatermarkImage(template);
  // A picture chosen here, uploaded when the template is saved.
  const [picture, setPicture] = useState<File | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const pictureUrl = useObjectUrl(picture ?? savedImage.data);
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
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
      accent_color: template?.accent_color ?? '',
      watermark_kind: template?.watermark_image
        ? 'image'
        : template?.watermark_text
          ? 'text'
          : 'none',
      watermark_text: template?.watermark_text ?? '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<InvoiceTemplateValues>({ setError, fields: FIELDS });
  const draft = useWatch({ control });
  const saving =
    create.isPending || update.isPending || uploadImage.isPending || removeImage.isPending;
  const footerLength = Array.from(draft.footer_text ?? '').length;

  const choosePicture = (file: File) => {
    const refusal = pictureRefusal(file);
    setPictureError(refusal);
    if (!refusal) setPicture(file);
  };

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const footer = values.footer_text || null;
    const accent = values.accent_color || null;
    // The text is emptied when another kind of watermark is chosen.
    const watermark = values.watermark_text || null;
    const withPicture = values.watermark_kind === 'image';
    const addPicture = withPicture ? picture : null;
    if (withPicture && !addPicture && !template?.watermark_image) {
      setPictureError('Choose an image for the watermark');
      return;
    }
    const onError = (error: unknown) => handleSubmitError(toBillingFormError(error));

    if (!template) {
      const body: InvoiceTemplateCreate = {
        name: values.name,
        layout: values.layout,
        show_logo: values.show_logo,
        show_bank_details: values.show_bank_details,
      };
      if (footer) body.footer_text = footer;
      if (accent) body.accent_color = accent;
      if (watermark) body.watermark_text = watermark;
      let created: InvoiceTemplate;
      try {
        created = await create.mutateAsync(body);
      } catch (error) {
        onError(error);
        return;
      }
      if (addPicture) {
        try {
          await uploadImage.mutateAsync({ templateId: created.id, file: addPicture });
        } catch (error) {
          // The template exists: say so, and why its picture is missing.
          toast({
            tone: 'error',
            title: `${created.name} added without its watermark image`,
            description: isApiError(error) ? error.message : undefined,
          });
          onClose();
          return;
        }
      }
      toast({ tone: 'success', title: `${created.name} added` });
      onClose();
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
    if (accent !== (template.accent_color ?? null)) changes.accent_color = accent;
    if (watermark !== (template.watermark_text ?? null)) changes.watermark_text = watermark;
    const dropPicture = Boolean(template.watermark_image) && !withPicture;
    if (Object.keys(changes).length === 0 && !dropPicture && !addPicture) {
      onClose();
      return;
    }
    // A watermark is a text or a picture: the old picture goes before a text is set, and the
    // new one is uploaded once the text is gone.
    let saved = template;
    try {
      if (dropPicture) saved = await removeImage.mutateAsync(template.id);
      if (Object.keys(changes).length > 0) {
        saved = await update.mutateAsync({ templateId: template.id, body: changes });
      }
      if (addPicture) {
        saved = await uploadImage.mutateAsync({ templateId: template.id, file: addPicture });
      }
    } catch (error) {
      onError(error);
      return;
    }
    toast({ tone: 'success', title: `${saved.name} saved` });
    onClose();
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
              required
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
            <Controller
              control={control}
              name="accent_color"
              render={({ field }) => (
                <AccentColorField
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.accent_color?.message}
                />
              )}
            />
            <Select
              label="Watermark"
              options={WATERMARK_KIND_OPTIONS}
              hint="A text or an image, printed large and pale across every page."
              {...register('watermark_kind', {
                onChange: (event: { target: { value: string } }) => {
                  if (event.target.value !== 'text') setValue('watermark_text', '');
                },
              })}
            />
            {draft.watermark_kind === 'text' ? (
              <Input
                label="Watermark text"
                autoComplete="off"
                placeholder="e.g. COPY, PAID or CONFIDENTIAL"
                maxLength={WATERMARK_MAX}
                hint="Leave empty for none."
                error={errors.watermark_text?.message}
                {...register('watermark_text')}
              />
            ) : null}
            {draft.watermark_kind === 'image' ? (
              <WatermarkImageField
                url={pictureUrl}
                onChoose={choosePicture}
                error={pictureError}
                disabled={readOnly}
              />
            ) : null}
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
          accentColor={draft.accent_color ?? ''}
          watermarkText={draft.watermark_text ?? ''}
          watermarkImageUrl={draft.watermark_kind === 'image' ? pictureUrl : null}
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
              disabled={(template !== null && !isDirty && !picture) || retryIn > 0}
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
export function InvoiceTemplateFormPanel({
  template,
  open,
  readOnly = false,
  onClose,
}: InvoiceTemplateFormPanelProps) {
  const title = readOnly
    ? 'Invoice template'
    : template
      ? 'Edit invoice template'
      : 'Add invoice template';
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={title}
      description={
        template
          ? template.name
          : 'How an invoice looks: the layout of its lines, the logo, the bank details, the colour, a watermark and the footer.'
      }
    >
      {open ? (
        <TemplateForm
          key={template?.id ?? 'new'}
          template={template}
          readOnly={readOnly}
          onClose={onClose}
        />
      ) : null}
    </FormPanel>
  );
}
