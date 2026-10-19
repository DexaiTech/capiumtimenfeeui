import type { InfiniteData } from '@tanstack/react-query';

import type { ApiResult } from '@/services/api';
import type { PageMeta } from '@/types/api';

export type ListPage<TItem> = ApiResult<TItem[], PageMeta>;
export type ListData<TItem> = InfiniteData<ListPage<TItem>>;

/** `getNextPageParam` of every cursor list: the API's `next_cursor`, undefined at the end. */
export const nextCursor = <TItem>(last: ListPage<TItem>) => last.meta?.next_cursor ?? undefined;

/** Flattens the pages of an infinite list. */
export function flattenPages<TItem>(data: ListData<TItem> | undefined): TItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/** The same list with `change` applied to every item `match` accepts; untouched pages are reused. */
export function mapListItems<TItem>(
  data: ListData<TItem> | undefined,
  match: (item: TItem) => boolean,
  change: (item: TItem) => TItem,
): ListData<TItem> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.data.some(match)
        ? { ...page, data: page.data.map((item) => (match(item) ? change(item) : item)) }
        : page,
    ),
  };
}
