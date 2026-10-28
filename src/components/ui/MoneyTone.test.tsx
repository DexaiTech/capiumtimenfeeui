import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MoneyTone } from './MoneyTone';
import { moneyToneClass } from './moneyToneClass';

describe('moneyToneClass', () => {
  it('colours money received green and money owed red', () => {
    expect(moneyToneClass('in', 500)).toBe('text-success');
    expect(moneyToneClass('out', 500)).toBe('text-danger');
  });

  it('follows the sign for an adjustment', () => {
    expect(moneyToneClass('auto', 500)).toBe('text-success');
    expect(moneyToneClass('auto', -500)).toBe('text-danger');
  });

  it('does not colour nothing: zero, null and undefined', () => {
    for (const value of [0, null, undefined]) {
      expect(moneyToneClass('out', value)).toBe('');
      expect(moneyToneClass('in', value)).toBe('');
    }
  });

  it('turns an overpaid balance (owed, but negative) green', () => {
    expect(moneyToneClass('out', -100)).toBe('text-success');
  });
});

describe('MoneyTone', () => {
  it('draws the amount in its colour', () => {
    render(
      <MoneyTone kind="out" value={1200}>
        £12.00
      </MoneyTone>,
    );
    expect(screen.getByText('£12.00')).toHaveClass('text-danger');
  });
});
