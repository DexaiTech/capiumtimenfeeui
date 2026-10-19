import { useState } from 'react';

import { useToast } from '@/components/ui';

import { describeFailure } from '../utils/errors';
import { downloadBlob } from '../utils/download';

/**
 * Downloads a file the API serves with the Bearer header (a PDF): the file is read into a blob and
 * offered to the browser. `busy` is the key of the download in flight, so one row's button can
 * show it while the others stay usable.
 */
export function useFileDownload() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (key: string, filename: string, load: () => Promise<Blob>) => {
    setBusy(key);
    try {
      downloadBlob(filename, await load());
    } catch (error) {
      toast({ tone: 'error', ...describeFailure(error, 'Could not download the file') });
    } finally {
      setBusy(null);
    }
  };

  return { busy, download };
}
