import { describe, expect, it } from 'vitest';

import { labelText, suggestInputMode, suggestPlaceholder } from './placeholders';

describe('suggestPlaceholder', () => {
  it('gives a real example for the common fields', () => {
    expect(suggestPlaceholder('Email', 'email')).toBe('name@example.co.uk');
    expect(suggestPlaceholder('Phone', 'tel')).toBe('e.g. 020 7946 0958');
    expect(suggestPlaceholder('Postcode', 'text')).toBe('e.g. SW1A 1AA');
    expect(suggestPlaceholder('Company number', 'text')).toBe('e.g. 01234567');
    expect(suggestPlaceholder('Practice name', 'text')).toBe('e.g. Smith & Co Accountants');
    expect(suggestPlaceholder('Town or city', 'text')).toBe('e.g. London');
    expect(suggestPlaceholder('Hourly rate (£)', 'text')).toBe('0.00');
  });

  it('does not take payment for a price, nor days for money', () => {
    expect(suggestPlaceholder('Payment terms (days)', 'number')).toBe('0');
    expect(suggestPlaceholder('Payment reference', 'text')).toBe('e.g. INV-0001');
  });

  it('falls back to "Enter <label>" and, for a text area, "Add <label>…"', () => {
    expect(suggestPlaceholder('Nickname', 'text')).toBe('Enter nickname');
    expect(suggestPlaceholder('Bank details', 'text', true)).toBe('Add bank details…');
  });

  it('reads the words of a label with a star in it', () => {
    const label = ['Subject', ' ', { type: 'span', props: { children: '*' }, key: null }];
    expect(labelText('Practice name *')).toBe('Practice name *');
    expect(suggestPlaceholder('Description *', 'text', true)).toBe('Describe it in a few words');
    expect(label).toHaveLength(3);
  });

  it('leaves dates, tick boxes and files alone', () => {
    for (const type of ['date', 'checkbox', 'file', 'time', 'radio']) {
      expect(suggestPlaceholder('Anything', type)).toBeUndefined();
    }
  });
});

describe('suggestInputMode', () => {
  it('picks the keyboard of the field', () => {
    expect(suggestInputMode('email')).toBe('email');
    expect(suggestInputMode('tel')).toBe('tel');
    expect(suggestInputMode('text')).toBeUndefined();
  });
});
