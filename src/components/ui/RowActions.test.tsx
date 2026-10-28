import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DropdownItem } from './Dropdown';
import { RowActions } from './RowActions';
import { rowActionIcon } from './rowActionIcon';

const items = (onEdit = vi.fn(), onDelete = vi.fn()): DropdownItem[] => [
  { id: 'edit', label: 'Edit', onSelect: onEdit },
  { id: 'sep', separator: true },
  { id: 'delete', label: 'Delete', tone: 'danger', onSelect: onDelete },
];

describe('RowActions', () => {
  it('shows every action as its own button in a group named for the row', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<RowActions label="Actions for Acme" items={items(onEdit, onDelete)} />);

    const group = screen.getByRole('group', { name: 'Actions for Acme' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Edit', 'Delete']);
    // The tooltip is the label.
    expect(buttons.map((button) => button.getAttribute('title'))).toEqual(['Edit', 'Delete']);
    // No menu to open, and nothing that looks like a three-dot trigger.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

    await userEvent.click(within(group).getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
    await userEvent.click(within(group).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('turns a destructive action red on hover and keeps the others neutral', () => {
    render(<RowActions label="Actions for Acme" items={items()} />);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('hover:text-danger');
    expect(screen.getByRole('button', { name: 'Edit' }).className).not.toContain('text-danger');
  });

  it('disables an action that is not available', () => {
    render(
      <RowActions
        label="Actions for Acme"
        items={[{ id: 'edit', label: 'Edit', disabled: true, onSelect: vi.fn() }]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
  });

  it('shows a status instead of the buttons while the row is busy', () => {
    render(
      <RowActions label="Actions for Acme" items={items()} status={<span>Downloading…</span>} />,
    );
    const group = screen.getByRole('group', { name: 'Actions for Acme' });
    expect(within(group).getByText('Downloading…')).toBeInTheDocument();
    expect(within(group).queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing for a row without actions', () => {
    const { container } = render(<RowActions label="Actions for Acme" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('prefers the icon an action brings', () => {
    render(
      <RowActions
        label="Actions for Acme"
        items={[{ id: 'x', label: 'Special', icon: <svg data-testid="mine" />, onSelect: vi.fn() }]}
      />,
    );
    expect(screen.getByTestId('mine')).toBeInTheDocument();
  });

  it('sizes an icon an action brings, however large it was drawn', () => {
    const { rerender } = render(
      <RowActions
        label="Actions for Acme"
        items={[
          { id: 'x', label: 'Edit', icon: <svg width="24" height="24" />, onSelect: vi.fn() },
        ]}
      />,
    );
    const wrapper = () => screen.getByRole('button', { name: 'Edit' }).firstElementChild;
    expect(wrapper()?.className).toContain('[&>svg]:size-4');
    expect(screen.getByRole('button', { name: 'Edit' }).className).toContain('size-7');

    rerender(
      <RowActions
        label="Actions for Acme"
        size="sm"
        items={[
          { id: 'x', label: 'Edit', icon: <svg width="24" height="24" />, onSelect: vi.fn() },
        ]}
      />,
    );
    expect(wrapper()?.className).toContain('[&>svg]:size-3.5');
    expect(screen.getByRole('button', { name: 'Edit' }).className).toContain('size-6');
  });
});

describe('rowActionIcon', () => {
  it('gives each kind of action its own icon, and the same one for the same words', () => {
    const edit = rowActionIcon('edit', 'Edit');
    const remove = rowActionIcon('delete', 'Delete');
    const history = rowActionIcon('history', 'View history');
    const endDate = rowActionIcon('end', 'End-date');
    expect(new Set([edit, remove, history, endDate]).size).toBe(4);
    expect(rowActionIcon('x', 'Edit rate')).toBe(edit);
    expect(rowActionIcon('x', 'Delete invoice')).toBe(remove);
  });

  it('falls back to a generic icon for a name it does not know', () => {
    expect(rowActionIcon('zzz', 'Frobnicate')).toBe(rowActionIcon('qqq', 'Whatever'));
  });
});
