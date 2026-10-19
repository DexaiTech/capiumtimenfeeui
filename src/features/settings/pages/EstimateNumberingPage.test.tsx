import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { fail, server } from '@/test/server';

import { estimateSequence, testSequences } from '../test/billingFixtures';
import { billingHandlers, createBillingBackend, orgApiPath } from '../test/billingHandlers';
import EstimateNumberingPage from './EstimateNumberingPage';

const field = (name: string) => screen.getByRole('textbox', { name });

describe('EstimateNumberingPage', () => {
  it('explains that the numbering is not available until the API lists the estimate sequence', async () => {
    const backend = createBillingBackend();
    server.use(...billingHandlers(backend));
    renderInOrg(<EstimateNumberingPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Estimate Numbering' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Estimate numbering is not available yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Estimates are still being added to the application/),
    ).toBeInTheDocument();
    // No form, and nothing was asked of /sequences/estimate.
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(backend.calls.sequenceLists).toBe(1);
    expect(backend.calls.sequenceUpdates).toEqual([]);
  });

  it('does not treat the numbering of invoices as the numbering of estimates', async () => {
    const backend = createBillingBackend({
      sequences: testSequences.filter((entry) => entry.kind === 'invoice'),
    });
    server.use(...billingHandlers(backend));
    renderInOrg(<EstimateNumberingPage />);
    expect(
      await screen.findByRole('heading', { name: 'Estimate numbering is not available yet' }),
    ).toBeInTheDocument();
  });

  it('shows the error of the sequence list instead of the explanation', async () => {
    server.use(http.get(orgApiPath('/sequences'), () => fail(500, 'INTERNAL_ERROR', 'Boom.')));
    renderInOrg(<EstimateNumberingPage />);
    expect(await screen.findByText('Could not load the estimate numbering')).toBeInTheDocument();
  });

  it('shows and saves the numbering once the API has the estimate sequence', async () => {
    const backend = createBillingBackend({
      sequences: [...testSequences, { ...estimateSequence }],
    });
    server.use(...billingHandlers(backend));
    const user = userEvent.setup();
    renderInOrg(<EstimateNumberingPage />);
    await screen.findByRole('form', { name: 'Estimate numbering' });

    expect(field('Prefix')).toHaveValue('EST-');
    expect(field('Next number')).toHaveValue('3');
    expect(screen.getByText('EST-00003')).toBeInTheDocument();
    expect(screen.getByText('Next estimate number')).toBeInTheDocument();

    await user.clear(field('Prefix'));
    await user.type(field('Prefix'), 'QUO-');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Estimate numbering saved')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toEqual([{ kind: 'estimate', body: { prefix: 'QUO-' } }]);
    expect(await screen.findByText('QUO-00003')).toBeInTheDocument();
  });
});
