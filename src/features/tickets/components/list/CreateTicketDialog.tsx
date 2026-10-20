import { zodResolver } from '@hookform/resolvers/zod';
import { CloudUpload, X } from 'lucide-react';
import { useCallback, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';

import { useCreateTicket } from '../../api';
import { ticketsApi } from '../../api/ticketsApi';
import { PRIORITY_META, STATUS_META, TICKET_PRIORITIES, TICKET_STATUSES } from '../../constants';
import { usePasteFiles } from '../../hooks/usePasteFiles';
import { createTicketSchema, type TicketValues } from '../../schemas/ticket';
import type { TicketCreate } from '../../types';
import { uploadFailure } from '../../utils/errors';
import { ACCEPT_ATTRIBUTE, filesOf, MAX_FILE_LABEL, refusalFor } from '../../utils/files';
import { formatFileSize } from '../../utils/format';
import { DialogActions } from '../DialogActions';
import { KindIcon } from '../detail/KindIcon';

const FIELDS = ['subject', 'description', 'status', 'priority'] as const;

const STATUS_CHOICES = TICKET_STATUSES.map((value) => ({
  value,
  label: STATUS_META[value].label,
}));
const PRIORITY_CHOICES = TICKET_PRIORITIES.map((value) => ({
  value,
  label: PRIORITY_META[value].label,
}));

const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

/** A label with the red star of a required field. */
const required = (text: string) => (
  <>
    {text} <span className="text-danger">*</span>
  </>
);

interface StagedFile {
  id: string;
  file: File;
}

function CreateTicketForm({ onClose }: { onClose: () => void }) {
  const create = useCreateTicket();
  const { organization } = useOrg();
  const { toast } = useToast();
  const formId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<TicketValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { subject: '', description: '', status: 'open', priority: 'low' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<TicketValues>({ setError, fields: FIELDS });
  const priority = useWatch({ control, name: 'priority' });
  const status = useWatch({ control, name: 'status' });

  // Files are checked as they are added and sent once the ticket exists.
  const addFiles = useCallback((files: ReadonlyArray<File>) => {
    const refusals: string[] = [];
    const accepted: StagedFile[] = [];
    for (const file of files) {
      const refusal = refusalFor(file);
      if (refusal) {
        refusals.push(refusal);
      } else {
        counter.current += 1;
        accepted.push({ id: `file-${String(counter.current)}`, file });
      }
    }
    setFileErrors(refusals);
    if (accepted.length > 0) setStaged((current) => [...current, ...accepted]);
  }, []);
  usePasteFiles(addFiles, true);

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    // The same file can be chosen again.
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    addFiles(filesOf(event.dataTransfer));
  };

  const uploadAll = async (ticketId: string) => {
    const results = await Promise.allSettled(
      staged.map((entry) => ticketsApi.uploadAttachment(organization.id, ticketId, entry.file)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        toast({
          tone: 'error',
          title: `${staged[index]?.file.name ?? 'File'} was not attached`,
          description: uploadFailure(result.reason),
        });
      }
    });
  };

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const body: TicketCreate = {
      subject: values.subject,
      description: values.description,
      status: values.status,
      priority: values.priority,
    };
    create.mutate(body, {
      onSuccess: (ticket) => {
        setUploading(true);
        void uploadAll(ticket.id).finally(() => {
          toast({ tone: 'success', title: `Ticket ${ticket.code} created` });
          onClose();
        });
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
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <Input
            label={required('Subject')}
            autoComplete="off"
            data-autofocus
            error={errors.subject?.message}
            {...register('subject')}
          />
          <Select
            label="Priority"
            options={PRIORITY_CHOICES}
            error={errors.priority?.message}
            selectClassName={cn(
              'font-semibold',
              PRIORITY_META[priority].tone.soft,
              PRIORITY_META[priority].tone.text,
            )}
            {...register('priority')}
          />
          <Select
            label="Status"
            options={STATUS_CHOICES}
            error={errors.status?.message}
            selectClassName={cn(
              'font-semibold',
              STATUS_META[status].tone.soft,
              STATUS_META[status].tone.text,
            )}
            {...register('status')}
          />
        </div>
        <Textarea
          label={required('Description')}
          rows={6}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text">Attachments</span>
          <div
            onDragEnter={(event) => {
              if (carriesFiles(event)) setDragging(true);
            }}
            onDragOver={(event) => {
              if (!carriesFiles(event)) return;
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors duration-fast ease-standard sm:max-w-xs',
              dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-sunken',
            )}
          >
            <CloudUpload aria-hidden="true" className="size-8 text-brand-text" />
            <p className="text-sm text-text-muted">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-sm font-semibold text-text hover:underline"
              >
                Choose a file
              </button>
              , drag it here or paste it (Ctrl+V) to attach a file with ticket.
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept={ACCEPT_ATTRIBUTE}
              onChange={onChoose}
            />
          </div>
          <p className="text-xs text-text-muted">
            (Max file size - {MAX_FILE_LABEL}) | Supported formats : .doc, .docx, .pdf, .jpg, .png,
            .jpeg, .txt, .xls, .xlsx, .csv
          </p>
          {fileErrors.map((message) => (
            <p key={message} role="alert" className="text-xs font-medium text-danger">
              {message}
            </p>
          ))}
          {staged.length > 0 ? (
            <ul aria-label="Files to attach" className="flex flex-col gap-1.5">
              {staged.map(({ id, file }) => (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs"
                >
                  <KindIcon fileName={file.name} contentType="" className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium text-text" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-text-muted">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setStaged((current) => current.filter((e) => e.id !== id))}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={create.isPending || uploading}
          disabled={retryIn > 0}
        >
          Submit
        </Button>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
      </DialogActions>
    </>
  );
}

export interface CreateTicketDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Raises a ticket: subject, priority, status, description and attachments. */
export function CreateTicketDialog({ open, onClose }: CreateTicketDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Application Testing"
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? <CreateTicketForm onClose={onClose} /> : null}
    </Modal>
  );
}
