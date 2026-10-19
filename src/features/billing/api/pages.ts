import type { InfiniteData } from '@tanstack/react-query';

import type { ApiResult } from '@/services/api';
import type { PageMeta } from '@/types/api';

export type ListPage<TItem> = ApiResult<TItem[], PageMeta>;

/** `getNextPageParam` of every cursor list: the API's `next_cursor`, undefined at the end. */
export const nextCursor = <TItem>(last: ListPage<TItem>) => last.meta?.next_cursor ?? undefined;

/** Flattens the pages of an infinite list. */
export function flattenPages<TItem>(data: InfiniteData<ListPage<TItem>> | undefined): TItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/** Follows the cursor to the end of a list (an export), never past `limit` rows. */
export async function fetchEverything<TItem>(
  load: (cursor: string | undefined) => Promise<ListPage<TItem>>,
  limit: number,
): Promise<{ rows: TItem[]; truncated: boolean }> {
  const rows: TItem[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await load(cursor);
    rows.push(...page.data);
    cursor = page.meta?.next_cursor ?? undefined;
    if (!cursor) return { rows, truncated: false };
    if (rows.length >= limit) return { rows: rows.slice(0, limit), truncated: true };
  }
}
