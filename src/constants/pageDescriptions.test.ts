import { describe, expect, it } from 'vitest';

import { NAV_MODULES } from './navigation';
import { PAGE_DESCRIPTIONS } from './pageDescriptions';

describe('page descriptions', () => {
  it('gives every page of the menu a one-line description', () => {
    const missing = NAV_MODULES.flatMap((module) =>
      module.pages
        .filter((page) => !PAGE_DESCRIPTIONS[`${module.id}/${page.id}`])
        .map((page) => `${module.id}/${page.id}`),
    );
    expect(missing).toEqual([]);
  });

  it('describes only pages that exist', () => {
    const known = new Set(
      NAV_MODULES.flatMap((module) => module.pages.map((page) => `${module.id}/${page.id}`)),
    );
    expect(Object.keys(PAGE_DESCRIPTIONS).filter((key) => !known.has(key))).toEqual([]);
  });

  it('is carried on the pages of the navigation', () => {
    const wip = NAV_MODULES.find((module) => module.id === 'wip');
    expect(wip?.pages.find((page) => page.id === 'summary')?.description).toContain(
      'not yet billed',
    );
  });
});
