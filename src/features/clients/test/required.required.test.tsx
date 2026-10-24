import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, it } from 'vitest';

import { expectRequiredFields } from '@/test/requiredFields';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { ClientFormPanel } from '../components/ClientFormPanel';
import { ClientsBulkBar } from '../components/ClientsBulkBar';
import { ContactFormPanel } from '../components/ContactFormPanel';
import { EngagementFormPanel } from '../components/EngagementFormPanel';
import { ImportDialog } from '../components/ImportDialog';
import { ClientRatePanel, RateEndPanel } from '../workspace/settings/ClientRatePanels';
import { techwave } from './fixtures';

const quiet = () =>
  server.use(
    http.get(orgApiPath('/members'), () => ok([])),
    http.get(orgApiPath('/services'), () => ok([])),
  );

describe('mandatory fields of the clients forms', () => {
  it('marks the client name and country, not the optional details', async () => {
    quiet();
    renderInOrg(<ClientFormPanel open client={null} onClose={() => undefined} />);
    const dialog = await screen.findByRole('region', { name: 'Add Client' });
    expectRequiredFields(dialog, {
      required: ['Client name', 'Country'],
      optional: ['Client code', 'Email', 'Phone', 'Segment', 'Billing notes'],
    });
  });

  it('marks the contact name', async () => {
    renderInOrg(
      <ContactFormPanel
        target={{ clientId: techwave.id, clientName: techwave.name, contact: null }}
        onClose={() => undefined}
      />,
    );
    const dialog = await screen.findByRole('region');
    expectRequiredFields(dialog, { required: ['Name'], optional: ['Position', 'Email', 'Phone'] });
  });

  it('marks the service of an engagement', async () => {
    quiet();
    renderInOrg(
      <EngagementFormPanel
        target={{ clientId: techwave.id, engagement: null, takenServiceIds: [] }}
        onClose={() => undefined}
      />,
    );
    const dialog = await screen.findByRole('region');
    expectRequiredFields(dialog, {
      required: ['Service'],
      optional: [/Agreed fee/, 'Start date', 'End date'],
    });
  });

  it('marks the CSV file of the import', async () => {
    renderInOrg(<ImportDialog open onClose={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    expectRequiredFields(dialog, { required: ['CSV file'] });
  });

  it('marks the rate amount, not the dates', async () => {
    quiet();
    renderInOrg(
      <ClientRatePanel target={{ clientId: techwave.id, rate: null }} onClose={() => undefined} />,
    );
    const dialog = await screen.findByRole('region');
    expectRequiredFields(dialog, {
      required: [/Rate per hour/],
      optional: ['Applies to', 'Effective from', 'Effective to'],
    });
  });

  it('marks the last day of a rate', async () => {
    renderInOrg(
      <RateEndPanel
        target={{
          rate: {
            id: 'r1',
            user_id: null,
            hourly_rate: 5000,
            effective_from: '2025-01-01',
            effective_to: null,
          } as never,
        }}
        onClose={() => undefined}
      />,
    );
    const dialog = await screen.findByRole('region');
    expectRequiredFields(dialog, { required: ['Last day of the rate'] });
  });

  it('marks the new segment of a bulk edit unless it is cleared', async () => {
    renderInOrg(
      <ClientsBulkBar
        ids={['a']}
        members={[]}
        canUpdate
        canDelete
        flow={{
          busy: false,
          announcement: '',
          refusal: null,
          clearRefusal: () => undefined,
          submit: () => Promise.resolve(false),
        }}
        onClear={() => undefined}
      />,
    );
    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(await screen.findByRole('option', { name: /segment/i }));
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    expectRequiredFields(dialog, { required: ['New segment'] });
    await user.click(within(dialog).getByLabelText('Clear the segment instead'));
    expectRequiredFields(dialog, { required: [], optional: ['Clear the segment instead'] });
  });
});
