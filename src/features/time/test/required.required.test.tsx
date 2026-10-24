import { screen, waitFor } from '@testing-library/react';
import { describe, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { server } from '@/test/server';

import { EntryPanel } from '../components/EntryPanel';
import { ReasonDialog } from '../components/ReasonDialog';
import { CopyEntryDialog } from '../components/timesheet/CopyEntryDialog';
import { entry, TODAY } from './fixtures';
import { createBackend, timeHandlers } from './handlers';

const backend = () => server.use(...timeHandlers(createBackend()));

// Either a dialog (confirmations, reasons) or the inline panel of a form.
const panelOrDialog = () =>
  waitFor(() => {
    const found = screen.queryByRole('dialog') ?? screen.queryAllByRole('region')[0];
    if (!found) throw new Error('No dialog or form panel is open');
    return found;
  });

describe('mandatory fields of the time forms', () => {
  it('marks the date and the time of a new entry, not the rest', async () => {
    backend();
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />);
    const dialog = await panelOrDialog();
    expectRequiredFields(dialog, {
      required: ['Date', 'Time'],
      optional: ['Activity', 'Description', 'Internal note'],
    });
  });

  it('marks the reason of a correction as well', async () => {
    backend();
    renderInOrg(
      <EntryPanel
        open
        correction
        onClose={() => undefined}
        entry={entry({ id: 'e1', entry_date: TODAY, minutes: 60 })}
      />,
    );
    const dialog = await panelOrDialog();
    expectRequiredFields(dialog, {
      required: ['Reason for the correction', 'Date', 'Time'],
      optional: ['Description'],
    });
  });

  it('marks the reason of the reason dialog', async () => {
    renderInOrg(
      <ReasonDialog
        open
        onClose={() => undefined}
        title="Return this timesheet"
        submitLabel="Return"
        requiredMessage="Enter a reason"
        onSubmit={() => Promise.resolve()}
      />,
    );
    const dialog = await panelOrDialog();
    expectRequiredFields(dialog, { required: ['Reason'] });
  });

  it('marks the target day of a copied entry', async () => {
    backend();
    renderInOrg(
      <CopyEntryDialog
        open
        onClose={() => undefined}
        entry={entry({ id: 'e1', entry_date: TODAY, minutes: 60 })}
      />,
    );
    const dialog = await panelOrDialog();
    expectRequiredFields(dialog, {
      required: ['Copy to'],
      optional: ['Copy the internal note too'],
    });
  });
});
