import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { describe, expect, it, vi } from 'vitest';

import { Dropdown, type DropdownProps } from './Dropdown';

function renderDropdown(props: Partial<DropdownProps> = {}) {
  const onSelect = vi.fn();
  render(
    <MotionConfig reducedMotion="always">
      <Dropdown
        label="Actions"
        trigger="Menu"
        items={[
          { id: 'open', label: 'Open', onSelect },
          { id: 'separator', separator: true },
          { id: 'delete', label: 'Delete', tone: 'danger', onSelect },
        ]}
        {...props}
      />
    </MotionConfig>,
  );
  return onSelect;
}

describe('Dropdown', () => {
  it('opens a labelled menu of items with a separator, and chooses one', async () => {
    const user = userEvent.setup();
    const onSelect = renderDropdown();
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Open', 'Delete']);
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Open' })).toHaveFocus();

    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('shows a header above the items that is not one of them', async () => {
    const user = userEvent.setup();
    renderDropdown({ header: <span>Application Testing</span> });

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(within(menu).getByText('Application Testing')).toBeInTheDocument();
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
  });

  describe('onOpenChange', () => {
    it('reports the state when the menu opens and closes, and once at the start', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderDropdown({ onOpenChange });
      expect(onOpenChange.mock.calls).toEqual([[false]]);

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      expect(onOpenChange).toHaveBeenLastCalledWith(true);

      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      expect(onOpenChange.mock.calls).toEqual([[false], [true], [false]]);
    });

    it('reports a close by a click outside and by choosing an item', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderDropdown({ onOpenChange });

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      await user.click(document.body);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      expect(onOpenChange).toHaveBeenLastCalledWith(true);
      await user.click(screen.getByRole('menuitem', { name: 'Open' }));
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });
  });
});
