import { Plus, Send } from 'lucide-react';
import { useState, type ClipboardEvent, type KeyboardEvent, type SubmitEvent } from 'react';

import { Button } from '@/components/ui';
import { useFileIntake } from '@/hooks';
import { isApiError } from '@/services/api';
import { cn } from '@/utils/cn';

import { useAddComment, useDeleteAttachment } from '../../api';
import { COMMENT_MAX_LENGTH } from '../../constants';
import { useUploads, type UploadItem } from '../../hooks/useUploads';
import { filesOf } from '../../utils/files';
import { LiveRegion } from '../LiveRegion';
import { UploadRow } from './UploadRow';

export interface CommentComposerProps {
  ticketId: string;
}

/**
 * The box under the comments: a pill-shaped field with a round send button, and "+ Add Comment".
 * Pasting an image or a file uploads it at once and attaches it to the comment that is sent
 * (Ctrl+V); Enter sends, Shift+Enter starts a new line.
 */
export function CommentComposer({ ticketId }: CommentComposerProps) {
  const [body, setBody] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const add = useAddComment(ticketId);
  const removeFile = useDeleteAttachment(ticketId);
  const uploads = useUploads(ticketId, { refresh: false });
  // Files can also be dropped anywhere on the composer (a paste goes into the comment box).
  const { dragging, intakeProps } = useFileIntake({ onFiles: uploads.add });

  const attachmentIds = uploads.items.flatMap((item) =>
    item.status === 'done' && item.attachment ? [item.attachment.id] : [],
  );
  const uploading = uploads.items.some((item) => item.status === 'uploading');
  const canSend = (body.trim() !== '' || attachmentIds.length > 0) && !uploading && !add.isPending;

  const send = () => {
    if (!canSend) return;
    setProblem(null);
    add.mutate(
      {
        body: body.trim(),
        ...(attachmentIds.length > 0 ? { attachment_ids: attachmentIds } : {}),
      },
      {
        onSuccess: () => {
          setBody('');
          uploads.reset();
          setNote('Comment added');
        },
        onError: (error) =>
          setProblem(isApiError(error) ? error.message : 'Could not add the comment. Try again.'),
      },
    );
  };

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = filesOf(event.clipboardData, { ignoreWithText: true });
    if (files.length === 0) return;
    event.preventDefault();
    uploads.add(files);
  };

  // A file the person took off the comment before sending it is deleted again.
  const remove = (item: UploadItem) => {
    if (item.attachment) {
      removeFile.mutate(item.attachment.id, { onSettled: () => uploads.dismiss(item.id) });
    } else {
      uploads.dismiss(item.id);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      onDragEnter={intakeProps.onDragEnter}
      onDragOver={intakeProps.onDragOver}
      onDragLeave={intakeProps.onDragLeave}
      onDrop={intakeProps.onDrop}
      className={cn(
        'flex flex-col gap-3 rounded-xl transition-colors duration-fast ease-standard',
        dragging ? 'bg-brand-soft ring-2 ring-brand ring-offset-4 ring-offset-brand-soft' : '',
      )}
    >
      <LiveRegion message={note} />
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          aria-label="Comment"
          placeholder="Add a comment…"
          maxLength={COMMENT_MAX_LENGTH}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setProblem(null);
          }}
          onInput={(event) => {
            const field = event.currentTarget;
            field.style.height = 'auto';
            field.style.height = `${String(field.scrollHeight)}px`;
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className="max-h-40 min-h-11 w-full resize-none rounded-full border border-border bg-surface px-4 py-2.5 text-base text-text transition-[border-color] duration-fast ease-standard placeholder:text-text-subtle hover:border-border-strong focus-visible:border-primary md:min-h-9 md:py-2 md:text-xs"
        />
        <button
          type="submit"
          aria-label="Send comment"
          disabled={!canSend}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg transition-colors duration-fast ease-standard hover:bg-brand-hover active:bg-brand-strong disabled:pointer-events-none disabled:opacity-55 md:size-9"
        >
          <Send aria-hidden="true" className="size-4" />
        </button>
      </div>
      {problem ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {problem}
        </p>
      ) : null}
      {uploads.items.length > 0 ? (
        <ul aria-label="Files for this comment" className="flex flex-col gap-1.5">
          {uploads.items.map((item) => (
            <UploadRow key={item.id} item={item} onRemove={remove} doneText="Attached" />
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={add.isPending}
          disabled={!canSend}
          leftIcon={<Plus aria-hidden="true" className="size-4" />}
        >
          Add Comment
        </Button>
        <p className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
          e.g. drop a file here, or paste a screenshot or file into the comment box
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded-sm border border-border bg-surface-sunken px-1.5 font-mono text-2xs text-text">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded-sm border border-border bg-surface-sunken px-1.5 font-mono text-2xs text-text">
              V
            </kbd>
          </span>
        </p>
      </div>
    </form>
  );
}
