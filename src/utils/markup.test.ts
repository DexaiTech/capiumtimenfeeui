import { describe, expect, it } from 'vitest';

import { isMarkupInput, markupBpToInput, percentToMarkupBp } from './markup';

describe('cost-plus mark-ups', () => {
  it('reads a percentage into basis points and back', () => {
    expect(percentToMarkupBp('50')).toBe(5000);
    expect(percentToMarkupBp('12.5%')).toBe(1250);
    expect(percentToMarkupBp('1000.01')).toBeNull();
    expect(percentToMarkupBp('lots')).toBeNull();
    expect(markupBpToInput(5000)).toBe('50');
    expect(markupBpToInput(1250)).toBe('12.5');
    expect(markupBpToInput(null)).toBe('');
  });

  it('allows a blank mark-up (not set)', () => {
    expect(isMarkupInput('')).toBe(true);
    expect(isMarkupInput(' 40 ')).toBe(true);
    expect(isMarkupInput('-5')).toBe(false);
  });
});
