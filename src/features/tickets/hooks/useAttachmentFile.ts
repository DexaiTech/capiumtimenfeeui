import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import { ticketKeys } from '../api/keys';
import { ticketsApi } from '../api/ticketsApi';
import type { TicketAttachment } from '../types';
import { describeFailure } from '../utils/errors';

/**
 * The bytes of a file. The request carries the Bearer token (an `<img src>` or a link cannot),
 * and the blob stays cached while the ticket is open, so a thumbnail is fetched once.
 */
export function useAttachmentFile(ticketId: string, attachmentId: string, enabled = true) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: ticketKeys.file(organization.id, ticketId, attachmentId),
    queryFn: ({ signal }) =>
      ticketsApi.downloadAttachment(organization.id, ticketId, attachmentId, signal),
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  });
}

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

/** Downloads a file of a ticket through the cache; a failure (a file the store lost) is a toast. */
export function useDownloadAttachment(ticketId: string) {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const download = useCallback(
    async (attachment: Pick<TicketAttachment, 'id' | 'file_name'>) => {
      setPending(true);
      try {
        const blob = await queryClient.query({
          queryKey: ticketKeys.file(organization.id, ticketId, attachment.id),
          queryFn: ({ signal }) =>
            ticketsApi.downloadAttachment(organization.id, ticketId, attachment.id, signal),
          staleTime: Infinity,
        });
        saveBlob(blob, attachment.file_name);
      } catch (error) {
        toast({
          tone: 'error',
          ...describeFailure(error, `Could not download ${attachment.file_name}`),
        });
      } finally {
        setPending(false);
      }
    },
    [queryClient, organization.id, ticketId, toast],
  );

  return { download, pending };
}
