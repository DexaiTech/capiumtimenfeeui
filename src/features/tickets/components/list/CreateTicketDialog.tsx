import { zodResolver } from '@hookform/resolvers/zod';
import { Tag } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  Input,
  Modal,
  OptionPicker,
  Select,
  Textarea,
  useToast,
  type PickerOption,
} from '@/components/ui';
import { cn } from '@/utils/cn';

import { useCreateTicket, useTicketTags } from '../../api';
import {
  PRIORITY_META,
  STATUS_META,
  TAG_DOTS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../constants';
import { ticketSchema, type TicketValues } from '../../schemas/ticket';
import type { TicketCreate } from '../../types';
import { DialogActions } from '../DialogActions';
import { TagChip } from '../TagChip';

const FIELDS = ['subject', 'description', 'status', 'priority'] as const;

const STATUS_CHOICES = TICKET_STATUSES.map((value) => ({
  value,
  label: STATUS_META[value].label,
}));
const PRIORITY_CHOICES = TICKET_PRIORITIES.map((value) => ({
  value,
  label: PRIORITY_META[value].label,
}));

function CreateTicketForm({ onClose }: { onClose: () => void }) {
  const create = useCreateTicket();
  const tags = useTicketTags();
  const { toast } = useToast();
  const formId = useId();
  const [tagIds, setTagIds] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TicketValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: '', description: '', status: 'open', priority: 'not_set' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<TicketValues>({ setError, fields: FIELDS });

  const allTags = tags.data ?? [];
  const chosen = allTags.filter((tag) => tagIds.includes(tag.id));
  const options: PickerOption[] = allTags.map((tag) => ({
    value: tag.id,
    label: tag.name,
    icon: <span aria-hidden="true" className={cn('size-2.5 rounded-full', TAG_DOTS[tag.color])} />,
  }));

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const body: TicketCreate = {
      subject: values.subject,
      status: values.status,
      priority: values.priority,
    };
    if (values.description.trim()) body.description = values.description;
    if (tagIds.length > 0) body.tag_ids = tagIds;
    create.mutate(body, {
      onSuccess: (ticket) => {
        toast({ tone: 'success', title: `Ticket ${ticket.code} created` });
        onClose();
      },
      onError: handleSubmitError,
    });
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Subject"
          autoComplete="off"
          data-autofocus
          error={errors.subject?.message}
          {...register('subject')}
        />
        <Textarea
          label="Description"
          rows={4}
          hint="What happened, what you expected, and how to see it again."
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Status"
            options={STATUS_CHOICES}
            error={errors.status?.message}
            {...register('status')}
          />
          <Select
            label="Priority"
            options={PRIORITY_CHOICES}
            error={errors.priority?.message}
            {...register('priority')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text">Tags</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {chosen.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
            <OptionPicker
              label="Choose tags"
              options={options}
              value={tagIds}
              onChange={setTagIds}
              multiple
              searchable
              searchPlaceholder="Find a tag…"
              loading={tags.isPending}
              emptyText="No tags yet"
              triggerClassName="h-7 border border-border px-2 text-xs font-medium text-text-muted"
            >
              <Tag aria-hidden="true" className="size-3.5" />
              {chosen.length > 0 ? 'Change tags' : 'Add tags'}
            </OptionPicker>
          </div>
        </div>
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
          loading={create.isPending}
          disabled={retryIn > 0}
        >
          Create ticket
        </Button>
      </DialogActions>
    </>
  );
}

export interface CreateTicketDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Raises a ticket: subject, description, status, priority and tags. */
export function CreateTicketDialog({ open, onClose }: CreateTicketDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New ticket"
      description="Report a bug or suggest an enhancement. It is numbered automatically (APT1, APT2, …)."
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? <CreateTicketForm onClose={onClose} /> : null}
    </Modal>
  );
}
