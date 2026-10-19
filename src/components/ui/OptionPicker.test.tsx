import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { describe, expect, it, vi } from 'vitest';

import { OptionPicker, type OptionPickerProps } from './OptionPicker';

const options = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana', description: 'yellow' },
  { value: 'c', label: 'Cherry', disabled: true },
];

function renderPicker(props: Partial<OptionPickerProps> = {}) {
  const onChange = vi.fn();
  render(
    <MotionConfig reducedMotion="always">
      <OptionPicker label="Fruit" options={options} value={[]} onChange={onChange} {...props}>
        Pick
      </OptionPicker>
    </MotionConfig>,
  );
  return onChange;
}

describe('OptionPicker', () => {
  it('opens a listbox, chooses one value and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker();
    const trigger = screen.getByRole('button', { name: 'Fruit' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    const list = screen.getByRole('listbox', { name: 'Fruit' });
    await user.click(within(list).getByRole('option', { name: /Banana/ }));

    expect(onChange).toHaveBeenCalledWith(['b']);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('is operable with the keyboard and skips disabled options', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker();
    screen.getByRole('button', { name: 'Fruit' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    // Cherry is disabled: nothing chosen, still open.
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('filters by the search text and closes on Escape without choosing', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker({ searchable: true, searchPlaceholder: 'Search fruit…' });
    await user.click(screen.getByRole('button', { name: 'Fruit' }));
    const search = screen.getByRole('combobox', { name: 'Search fruit' });
    expect(search).toHaveFocus();
    await user.type(search, 'yel');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('Nothing found')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Fruit' })).toHaveFocus();
  });

  it('reports every toggle of a multiple picker, or once on close with commitOnClose', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker({ multiple: true, value: ['a'] });
    await user.click(screen.getByRole('button', { name: 'Fruit' }));
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: /Banana/ }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('commits a multiple selection once when it closes', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker({ multiple: true, commitOnClose: true, value: ['a'] });
    await user.click(screen.getByRole('button', { name: 'Fruit' }));
    await user.click(screen.getByRole('option', { name: /Banana/ }));
    await user.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });
});
