import { describe, expect, it } from 'vitest';

/** Raw text of every non-test source file in this folder (not impl/), read through Vite. */
const sources = Object.entries(
  import.meta.glob<string>(['./*.ts', './*.tsx', '!./*.test.ts', '!./*.test.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

describe('chart bundle boundary', () => {
  it('finds the public sources', () => {
    const names = sources.map(([path]) => path);
    expect(names).toContain('./index.ts');
    expect(names).toContain('./LineChart.tsx');
  });

  it.each(sources)('%s does not import recharts at runtime', (_path, text) => {
    const staticImports = text
      .split('\n')
      .filter((line) => /^\s*(import|export)\b.*from\s+['"]recharts['"]/.test(line))
      .filter((line) => !/^\s*(import|export)\s+type\b/.test(line));
    expect(staticImports).toEqual([]);
  });

  it.each(['LineChart', 'AreaChart', 'BarChart', 'DonutChart'])(
    '%s loads its implementation lazily',
    (name) => {
      const entry = sources.find(([path]) => path === `./${name}.tsx`);
      expect(entry?.[1]).toMatch(/lazy\(\(\) => import\('\.\/impl\//);
    },
  );
});
