import { isApiError } from '@/services/api';

export interface BulkFailure {
  label: string;
  message: string;
}

export interface BulkResult {
  done: number;
  failed: BulkFailure[];
}

/**
 * Runs one request per item, one after the other (each needs its own locks and number), and keeps
 * going when one is refused: the caller reports how many went through and why the others did not.
 */
export async function runEach<TItem>(
  items: ReadonlyArray<TItem>,
  run: (item: TItem) => Promise<unknown>,
  label: (item: TItem) => string,
): Promise<BulkResult> {
  const result: BulkResult = { done: 0, failed: [] };
  for (const item of items) {
    try {
      await run(item);
      result.done += 1;
    } catch (error) {
      result.failed.push({
        label: label(item),
        message: isApiError(error) ? error.message : 'An unexpected error occurred.',
      });
    }
  }
  return result;
}

/** The toast of a bulk action: all done, or how many and which ones failed. */
export function bulkNotice(
  verb: string,
  noun: readonly [string, string],
  result: BulkResult,
): { tone: 'success' | 'warning' | 'error'; title: string; description?: string } {
  const total = result.done + result.failed.length;
  const word = (count: number) => (count === 1 ? noun[0] : noun[1]);
  if (result.failed.length === 0) {
    return { tone: 'success', title: `${result.done} ${word(result.done)} ${verb}` };
  }
  const shown = result.failed
    .slice(0, 3)
    .map((failure) => `${failure.label}: ${failure.message}`)
    .join(' ');
  const more = result.failed.length > 3 ? ` And ${result.failed.length - 3} more.` : '';
  return {
    tone: result.done === 0 ? 'error' : 'warning',
    title: `${result.done} of ${total} ${word(total)} ${verb}`,
    description: `${shown}${more}`,
  };
}
