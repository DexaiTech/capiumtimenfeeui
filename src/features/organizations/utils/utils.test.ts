import { describe, expect, it } from 'vitest';

import { createOrganizationSchema } from '../schemas';
import { slugify } from './slug';

describe('slugify', () => {
  it('derives a lowercase, hyphenated slug', () => {
    expect(slugify('Acme Inc.')).toBe('acme-inc');
    expect(slugify('  Crème & Brûlée  GmbH ')).toBe('creme-brulee-gmbh');
    expect(slugify('!!!')).toBe('');
  });

  it('keeps to 40 characters without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(39)} bcd`);
    expect(slug).toBe('a'.repeat(39));
  });
});

describe('createOrganizationSchema', () => {
  const base = { name: 'Acme', timezone: 'UTC' };

  it('accepts an empty slug and a valid one', () => {
    expect(createOrganizationSchema.safeParse({ ...base, slug: '' }).success).toBe(true);
    expect(createOrganizationSchema.safeParse({ ...base, slug: 'acme-inc' }).success).toBe(true);
  });

  it('rejects slugs the API would reject', () => {
    for (const slug of ['ab', 'Acme', '-acme', 'acme-', 'ac me', 'a'.repeat(41)]) {
      expect(createOrganizationSchema.safeParse({ ...base, slug }).success).toBe(false);
    }
  });
});
