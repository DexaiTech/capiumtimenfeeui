import { useCallback, useEffect, useRef, useState } from 'react';

import { useOrg } from '@/features/organizations';

import { expensesApi, useExpenseInvalidation } from '../api';
import type { Receipt } from '../types';
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
  /** The stored receipt, once done. */
  receipt?: Receipt;
}

/**
 * Uploads receipts to a line one request each, with progress and a per-file result. The client
 * refuses a file that is too big, empty or of another type before sending anything; the API's
 * own refusal shows with its message. A stored file leaves the list at once (the line's
 * receipts show it then). In-flight uploads are cancelled when the component goes.
 */
export function useReceiptUploads(claimId: string, lineId: string) {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
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
        await expensesApi.uploadReceipt(organizationId, lineId, file, {
          signal: controller.signal,
          onProgress: ({ loaded, total }) =>
            patch(id, { progress: total > 0 ? loaded / total : 0 }),
        });
        invalidate.receipts(claimId);
        setItems((current) => current.filter((item) => item.id !== id));
      } catch (error) {
        // A dismissed upload has nothing left to report.
        if (!controller.signal.aborted)
          patch(id, { status: 'failed', error: uploadFailure(error) });
      } finally {
        controllers.current.delete(id);
      }
    },
    [organizationId, lineId, claimId, patch, invalidate],
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

  return { items, add, dismiss };
}
