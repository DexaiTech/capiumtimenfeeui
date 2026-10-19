import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, Modal, useToast } from '@/components/ui';

import { useCreateContact, useUpdateContact } from '../api';
import {
  CONTACT_FORM_FIELDS,
  contactFormSchema,
  contactToForm,
  EMPTY_CONTACT_FORM,
  toContactPayload,
  type ContactFormValues,
} from '../schemas';
import type { ContactRead } from '../types';

export interface ContactTarget {
  clientId: string;
  clientName: string;
  /** The contact to edit; null to add one. */
  contact: ContactRead | null;
  /** For a new contact: start with "primary contact" ticked. */
  primary?: boolean;
}

export interface ContactFormDialogProps {
  target: ContactTarget | null;
  onClose: () => void;
}

function ContactForm({ target, onClose }: { target: ContactTarget; onClose: () => void }) {
  const { toast } = useToast();
  const formId = useId();
  const create = useCreateContact();
  const update = useUpdateContact();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: target.contact
      ? contactToForm(target.contact)
      : { ...EMPTY_CONTACT_FORM, is_primary: target.primary ?? true },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ContactFormValues>({ setError, fields: CONTACT_FORM_FIELDS });

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const body = toContactPayload(values);
    try {
      if (target.contact) {
        await update.mutateAsync({
          clientId: target.clientId,
          contactId: target.contact.id,
          body: { ...body, is_primary: values.is_primary },
        });
        toast({ tone: 'success', title: 'Contact updated', description: body.name });
      } else {
        await create.mutateAsync({ clientId: target.clientId, body });
        toast({ tone: 'success', title: 'Contact added', description: body.name });
      }
      onClose();
    } catch (error) {
      handleSubmitError(error);
    }
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
        <Input
          label="Name"
          autoComplete="name"
          data-autofocus
          error={errors.name?.message}
          {...register('name')}
        />
        <Input label="Position" error={errors.position?.message} {...register('position')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Phone"
            type="tel"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>
        <Checkbox
          label="Primary contact"
          description="Shown in the client list; replaces the current primary contact."
          error={errors.is_primary?.message}
          {...register('is_primary')}
        />
        <Checkbox
          label="Billing contact"
          description="Invoices are addressed to billing contacts."
          error={errors.is_billing?.message}
          {...register('is_billing')}
        />
      </form>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={create.isPending || update.isPending}
          disabled={retryIn > 0}
        >
          {target.contact ? 'Save contact' : 'Add contact'}
        </Button>
      </div>
    </>
  );
}

/** Add a contact (from the list's "+ Add" pill or the Contacts tab) or edit one. */
export function ContactFormDialog({ target, onClose }: ContactFormDialogProps) {
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={target?.contact ? 'Edit contact' : 'Add contact'}
      description={target ? target.clientName : undefined}
    >
      {target ? (
        <ContactForm
          key={`${target.clientId}-${target.contact?.id ?? 'new'}`}
          target={target}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
