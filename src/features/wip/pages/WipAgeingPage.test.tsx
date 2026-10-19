import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/server';

import { IDS, ages, groupRow } from '../test/fixtures';
import { callsOf, createBackend, wipHandlers, type WipBackend } from '../test/handlers';
import { WIP, renderWipPage } from '../test/render';
import WipAgeingPage from './WipAgeingPage';

const AGEING = `${WIP}/ageing`;

function setup(init: Partial<WipBackend> = {}, options: { route?: string } = {}) {
  const backend = createBackend({
    summary: {
      client: [
        groupRow({
          ages: ages({ days_0_30: 80000, days_31_60: 20000, days_90_plus: 15000 }),
          total: 115000,
        }),
        groupRow({
          key: IDS.globex,
          name: 'Globex plc',
          code: 'GLOB',
          total: 50000,
          time: 50000,
          fixed_fee: 0,
          expense: 0,
          ages: ages({ days_0_30: 50000 }),
          oldest_date: '2026-09-20',
          item_count: 2,
          over_90_bp: 0,
        }),
      ],
    },
    ...init,
  });
  server.use(...wipHandlers(backend));
  renderWipPage(<WipAgeingPage />, { route: options.route ?? AGEING, path: AGEING });
  return backend;
}

const lists = (backend: WipBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/wip/summary');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'WIP ageing' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

describe('WIP ageing', () => {
  it('shows the WIP by age in the four buckets of the practice, with the share of each', async () => {
    setup();
    await table();

    const buckets = screen.getByLabelText('WIP by age');
    expect(buckets).toHaveTextContent('0-30 days£1,300.00');
    expect(buckets).toHaveTextContent('78.79% of the WIP');
    expect(buckets).toHaveTextContent('31-60 days£200.00');
    expect(buckets).toHaveTextContent('61-90 days£0.00');
    expect(buckets).toHaveTextContent('90+ days£150.00');
    expect(buckets).toHaveTextContent('9.09% of the WIP');
    expect(buckets).toHaveTextContent('Total WIP£1,650.00');
  });

  it('lists the rows with the most over 90 days first, each with its ageing', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.get('sort')).toBe('over_90');
    expect(lists(backend)[0]?.params?.get('order')).toBe('desc');
    expect(rows).toHaveLength(2);
    const [acme] = rows as [HTMLElement];
    expect(acme).toHaveTextContent('Acme Ltd');
    expect(acme).toHaveTextContent('£800.00');
    expect(acme).toHaveTextContent('£200.00');
    expect(acme).toHaveTextContent('13.04%');
    expect(
      within(acme).getByRole('img', {
        name: 'Ageing of Acme Ltd: 0-30 days: £800.00, 31-60 days: £200.00, 90+ days: £150.00',
      }),
    ).toBeInTheDocument();
    for (const header of ['0-30 days', '31-60 days', '61-90 days', '90+ days']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });

  it('shows nothing over 90 days when nothing is that old', async () => {
    setup({ summary: { client: [groupRow({ ages: ages({ days_0_30: 1000 }), total: 1000 })] } });
    await table();
    expect(screen.getByLabelText('WIP by age')).toHaveTextContent('90+ days£0.00');
  });

  it('groups by another dimension and keeps the sort of the address', async () => {
    const backend = setup({}, { route: `${AGEING}?group=manager&sort=total&order=desc` });
    await table();
    expect(lists(backend)[0]?.params?.get('group_by')).toBe('manager');
    expect(lists(backend)[0]?.params?.get('sort')).toBe('total');
  });

  it('says so when there is no WIP', async () => {
    setup({ summary: { client: [] } });
    expect(await screen.findByText('No work in progress')).toBeInTheDocument();
  });
});
