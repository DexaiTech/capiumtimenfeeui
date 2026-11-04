import type { DropdownItem } from './Dropdown';

/** The places of a grid's actions (see `RowActions` `slots`). */
export type RowActionSlots = ReadonlyArray<string | ReadonlyArray<string>>;

/**
 * The places of a grid that some row of it uses: a place no row needs (Reactivate on a list of
 * active people) would only widen every row with an empty gap. Every row of the grid gets the
 * same places, so an action is still in the same place on every row.
 */
export function slotsInUse(
  slots: RowActionSlots,
  rows: ReadonlyArray<ReadonlyArray<DropdownItem>>,
): RowActionSlots {
  const used = new Set(rows.flatMap((items) => items.map((item) => item.id)));
  return slots.filter((slot) =>
    (typeof slot === 'string' ? [slot] : slot).some((id) => used.has(id)),
  );
}
