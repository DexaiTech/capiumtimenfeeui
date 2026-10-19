import type { InfiniteData } from '@tanstack/react-query';

import type { ApiResult } from '@/services/api';
import type { PageMeta } from '@/types/api';

export type ListPage<TItem> = ApiResult<TItem[], PageMeta>;

/** A page whose `data` is one object (rows and totals) walked with the cursor of `meta`. */
export type ObjectPage<TData> = ApiResult<TData>;

/** `getNextPageParam` of every cursor list: the API's `next_cursor`, undefined at the end. */
export const nextCursor = (last: { meta: PageMeta | null }) => last.meta?.next_cursor ?? undefined;

/** Flattens the pages of an infinite list. */
export function flattenPages<TItem>(data: InfiniteData<ListPage<TItem>> | undefined): TItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/** Follows the cursor to the end of a short list (a few pages at most). */
export async function fetchEverything<TItem>(
  load: (cursor: string | undefined) => Promise<ListPage<TItem>>,
  maxPages = 20,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await load(cursor);
    items.push(...result.data);
    cursor = result.meta.next_cursor ?? undefined;
    if (!cursor) break;
  }
  return items;
}
