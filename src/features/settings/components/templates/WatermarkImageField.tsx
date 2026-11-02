import { CloudUpload } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

import { AVATAR_ACCEPT } from '@/features/account';
import { useFileIntake } from '@/hooks';
import { cn } from '@/utils/cn';

export interface WatermarkImageFieldProps {
  /** A blob URL of the picture (the one just chosen, else the saved one), or null for none. */
  url: string | null;
  onChoose: (file: File) => void;
  error?: string | null;
  disabled?: boolean;
}

/**
 * The watermark picture: a thumbnail of it and a zone to choose, drop or paste another, as for a
 * profile picture. The picture is uploaded when the template is saved.
 */
export function WatermarkImageField({
  url,
  onChoose,
  error,
  disabled = false,
}: WatermarkImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const take = (files: File[]) => {
    const file = files[0];
    if (file) onChoose(file);
  };
  const { dragging, intakeProps } = useFileIntake({ onFiles: take, disabled });

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    take(Array.from(event.target.files ?? []));
    // The same file can be chosen again.
    event.target.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        {...intakeProps}
        aria-label="Watermark image drop zone"
        className={cn(
          'flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-4 text-center outline-none transition-colors duration-fast ease-standard',
          'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30',
          dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-sunken',
        )}
      >
        {url ? (
          <img src={url} alt="Watermark image" className="h-16 max-w-full object-contain" />
        ) : (
          <CloudUpload aria-hidden="true" className="size-6 text-brand-text" />
        )}
        <p className="text-sm text-text-muted">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="rounded-sm font-semibold text-brand-text hover:underline disabled:opacity-55"
          >
            {url ? 'Choose another image' : 'Choose an image'}
          </button>
          , drag it here, or click here and paste it (Ctrl+V).
        </p>
        <p className="text-xs text-text-subtle">PNG, JPG, WebP or GIF, up to 2 MB.</p>
        <input
          ref={inputRef}
          type="file"
          hidden
          aria-label="Watermark image file"
          accept={AVATAR_ACCEPT}
          onChange={onChange}
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-text-muted">Printed large and pale across every page.</p>
      )}
    </div>
  );
}
