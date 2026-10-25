import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DateRangeField } from './DateField';
import { datePresets } from './dateRangePresets';

describe('datePresets', () => {
  // Wednesday 21 October 2026.
  it('works out the weeks and months around today, from Monday', () => {
    expect(datePresets('2026-10-21')).toEqual([
      { label: 'This week', from: '2026-10-19', to: '2026-10-25' },
      { label: 'Last week', from: '2026-10-12', to: '2026-10-18' },
      { label: 'This month', from: '2026-10-01', to: '2026-10-31' },
      { label: 'Last month', from: '2026-09-01', to: '2026-09-30' },
    ]);
  });

  it('starts the week on the day the practice does', () => {
    expect(datePresets('2026-10-21', 7)[0]).toEqual({
      label: 'This week',
      from: '2026-10-18',
      to: '2026-10-24',
    });
  });

  it('crosses the year for last month in January', () => {
    expect(datePresets('2026-01-15')[3]).toEqual({
      label: 'Last month',
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });
});

describe('DateRangeField: quick ranges', () => {
  it('fills the range with one click, and only when asked for', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <DateRangeField label="Date" value={{ from: null, to: null }} onChange={onChange} />,
    );
    expect(screen.queryByRole('button', { name: 'Last month' })).not.toBeInTheDocument();

    rerender(
      <DateRangeField
        label="Date"
        presetsFrom="2026-10-21"
        value={{ from: null, to: null }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Last month' }));
    expect(onChange).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-09-30' });
  });
});
