import { useCallback, useEffect, useRef, useState } from 'react';

import { useOrg } from '@/features/organizations';

import { useTicketInvalidation } from '../api/invalidation';
import { ticketsApi } from '../api/ticketsApi';
import type { TicketAttachment } from '../types';
import { uploadFailure } from '../utils/errors';
import { refusalFor } from '../utils/files';

export type UploadStatus = 'uploading' | 'done' | 'failed';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  /** 0 to 1 while uploading. */
  progress: number;
  /** Why it failed: the client's check, or the API's own message (413, 422, 409, 503). */
  error?: string;
  /** The stored file, once done. */
  attachment?: TicketAttachment;
}

export interface UploadsOptions {
  /**
   * Drop an upload from the list as soon as it is stored (the ticket's files grid shows it then).
   * Without it a stored file stays in the list as `done`, for a comment to pick up.
   */
  dismissWhenDone?: boolean;
  /** Refresh the ticket when a file is stored. Default: true. */
  refresh?: boolean;
}

/**
 * Uploads files to a ticket one request each, with progress and a per-file result. The client
 * refuses a file that is too big, empty or of another type before sending anything; a refusal
 * of the API shows with its own message. In-flight uploads are cancelled when the component goes.
 */
export function useUploads(ticketId: string, options: UploadsOptions = {}) {
  const { dismissWhenDone = false, refresh = true } = options;
  const { organization } = useOrg();
  const invalidate = useTicketInvalidation();
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const counter = useRef(0);
  const organizationId = organization.id;

  useEffect(() => {
    const running = controllers.current;
    return () => {
      for (const controller of running.values()) controller.abort();
    };
  }, []);

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, []);

  const send = useCallback(
    async (id: string, file: File) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      try {
        const attachment = await ticketsApi.uploadAttachment(organizationId, ticketId, file, {
          signal: controller.signal,
          onProgress: ({ loaded, total }) =>
            patch(id, { progress: total > 0 ? loaded / total : 0 }),
        });
        if (refresh) invalidate.attachments(ticketId);
        if (dismissWhenDone) setItems((current) => current.filter((item) => item.id !== id));
        else patch(id, { status: 'done', progress: 1, attachment });
      } catch (error) {
        // A dismissed upload has nothing left to report.
        if (!controller.signal.aborted)
          patch(id, { status: 'failed', error: uploadFailure(error) });
      } finally {
        controllers.current.delete(id);
      }
    },
    [organizationId, ticketId, patch, refresh, dismissWhenDone, invalidate],
  );

  const add = useCallback(
    (files: ReadonlyArray<File>) => {
      for (const file of files) {
        counter.current += 1;
        const id = `upload-${String(counter.current)}`;
        const base = { id, name: file.name, size: file.size, progress: 0 };
        const refusal = refusalFor(file);
        if (refusal) {
          setItems((current) => [...current, { ...base, status: 'failed', error: refusal }]);
        } else {
          setItems((current) => [...current, { ...base, status: 'uploading' }]);
          void send(id, file);
        }
      }
    },
    [send],
  );

  /** Takes an upload off the list; one still running is cancelled. */
  const dismiss = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  /** Empties the list without touching the stored files (a comment took them). */
  const reset = useCallback(() => setItems([]), []);

  return { items, add, dismiss, reset };
}
