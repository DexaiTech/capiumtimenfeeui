import { screen, within } from '@testing-library/react';

/**
 * The actions of a grid row are icon buttons in a `group` named "Actions for <row>": there is no
 * three-dot menu to open. `group` is that name, as a string (exact) or a pattern.
 */
export function rowActionsOf(group: string | RegExp): HTMLElement {
  return screen.getByRole('group', { name: group });
}

/** The button of one action of a row, for example `rowAction('Actions for Acme', 'Edit')`. */
export function rowAction(group: string | RegExp, action: string | RegExp): HTMLElement {
  return within(rowActionsOf(group)).getByRole('button', { name: action });
}

/** As `rowAction`, waiting for the row to appear. */
export async function findRowAction(
  group: string | RegExp,
  action: string | RegExp,
): Promise<HTMLElement> {
  const found = await screen.findByRole('group', { name: group });
  return within(found).getByRole('button', { name: action });
}

/** The names of the actions a row offers, in order. */
export function rowActionNames(group: string | RegExp): string[] {
  return within(rowActionsOf(group))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? '');
}
