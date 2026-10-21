import { CloudUpload, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

import { Button, PersonAvatar, useToast } from '@/components/ui';
import { useFileIntake } from '@/hooks';
import { isApiError } from '@/services/api';
import type { User } from '@/types/models';
import { cn } from '@/utils/cn';

import { useRemoveAvatar, useUploadAvatar } from '../api/hooks';
import { AVATAR_ACCEPT, pictureRefusal } from '../avatar';

/** A picture pasted from the clipboard has no useful name ("image.png"): keep it, add a type. */
function named(file: File): File {
  if (file.name.includes('.')) return file;
  const extension = file.type.split('/')[1] ?? 'png';
  return new File([file], `${file.name || 'picture'}.${extension}`, { type: file.type });
}

export interface ProfilePictureProps {
  user: User;
}

/**
 * "Profile picture": the current picture (or initials) and a drop zone. A picture can be
 * chosen, dragged onto the zone, or pasted (Ctrl+V) while the zone has the focus; it is checked
 * here (image, up to 2 MB) and again by the API, then stored in the file store.
 */
export function ProfilePicture({ user }: ProfilePictureProps) {
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;

  const send = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const refusal = pictureRefusal(file);
    if (refusal) {
      setProblem(refusal);
      return;
    }
    setProblem(null);
    upload.mutate(named(file), {
      onSuccess: () => toast({ tone: 'success', title: 'Profile picture updated' }),
      onError: (error) =>
        setProblem(isApiError(error) ? error.message : 'Could not upload the picture. Try again.'),
    });
  };

  const { dragging, intakeProps } = useFileIntake({ onFiles: send, disabled: busy });

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    send(Array.from(event.target.files ?? []));
    // The same file can be chosen again.
    event.target.value = '';
  };

  const onRemove = () => {
    setProblem(null);
    remove.mutate(undefined, {
      onSuccess: () => toast({ tone: 'success', title: 'Profile picture removed' }),
      onError: (error) =>
        setProblem(isApiError(error) ? error.message : 'Could not remove the picture. Try again.'),
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <PersonAvatar
        userId={user.id}
        name={user.full_name}
        colorKey={user.id}
        pictureVersion={user.avatar_updated_at}
        size="xl"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div
          {...intakeProps}
          aria-label="Profile picture drop zone"
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-4 text-center outline-none transition-colors duration-fast ease-standard',
            'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30',
            dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-sunken',
          )}
        >
          <CloudUpload aria-hidden="true" className="size-6 text-brand-text" />
          <p className="text-sm text-text-muted">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-sm font-semibold text-brand-text hover:underline disabled:opacity-55"
            >
              Choose a picture
            </button>
            , drag it here, or click here and paste it (Ctrl+V).
          </p>
          <p className="text-xs text-text-subtle">PNG, JPG, WebP or GIF, up to 2 MB.</p>
          <input
            ref={inputRef}
            type="file"
            hidden
            aria-label="Profile picture file"
            accept={AVATAR_ACCEPT}
            onChange={onChoose}
          />
        </div>
        {problem ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {problem}
          </p>
        ) : null}
        {user.avatar_updated_at ? (
          <div>
            <Button
              type="button"
              size="sm"
              loading={remove.isPending}
              disabled={busy}
              onClick={onRemove}
              leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
            >
              Remove picture
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
