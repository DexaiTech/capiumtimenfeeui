import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import { expenseKeys, expensesApi } from '../api';
import { describeFailure } from '../utils/errors';

/** A blob URL for `blob`, released again when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    // The URL needs its own cleanup (and Strict Mode runs it once early), so it is made here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(null);
    };
  }, [blob]);
  return url;
}

/** Saves a blob under a file name through a temporary link (the URL is released at once). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Downloads a receipt through the cache; a failure (a file the store lost) is a toast. */
export function useDownloadReceipt() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const download = useCallback(
    async (lineId: string, receipt: { id: string; file_name: string }) => {
      setPending(true);
      try {
        const blob = await queryClient.query({
          queryKey: expenseKeys.receiptFile(organization.id, lineId, receipt.id),
          queryFn: ({ signal }) =>
            expensesApi.downloadReceipt(organization.id, lineId, receipt.id, signal),
          staleTime: Infinity,
        });
        saveBlob(blob, receipt.file_name);
      } catch (error) {
        toast({
          tone: 'error',
          ...describeFailure(error, `Could not download ${receipt.file_name}`),
        });
      } finally {
        setPending(false);
      }
    },
    [queryClient, organization.id, toast],
  );

  return { download, pending };
}
