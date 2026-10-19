import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ownSettings, practiceSettings } from '@/features/notifications/test/fixtures';
import {
  createBackend,
  notificationHandlers,
  orgApiPath,
  type Backend,
} from '@/features/notifications/test/handlers';
import { contextWith, ownerContext, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, server } from '@/test/server';

import NotificationSettingsPage from './NotificationSettingsPage';

function setup(options: Partial<Pick<Backend, 'settings' | 'practice'>> = {}) {
  const backend = createBackend(options);
  server.use(...notificationHandlers(backend));
  return backend;
}

const ownTable = () => screen.getByRole('table', { name: 'Your notification choices' });
const practiceTable = () =>
  screen.getByRole('table', { name: 'Notification settings of the practice' });
const own = (name: string) => within(ownTable()).getByRole('checkbox', { name });
const practice = (name: string) => within(practiceTable()).getByRole('checkbox', { name });

async function open(options: Parameters<typeof renderInOrg>[1] = {}) {
  renderInOrg(<NotificationSettingsPage />, options);
  await screen.findByRole('table', { name: 'Your notification choices' });
}

describe('NotificationSettingsPage: your notifications', () => {
  it('shows every kind with the channels the person gets', async () => {
    setup({
      settings: ownSettings({ budget_alert: { email: false, customised: true } }, '+4407700900123'),
    });
    await open();

    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    const rows = within(ownTable()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(7);
    expect(own('Timesheet reminder: In-app')).toBeChecked();
    expect(own('Timesheet reminder: Email')).toBeChecked();
    expect(own('Timesheet reminder: SMS')).not.toBeChecked();
    expect(own('Budget alert: Email')).not.toBeChecked();
    expect(own('Invoice delivery: Email')).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Mobile number for SMS' })).toHaveValue(
      '+4407700900123',
    );
    // What the person has not chosen follows the practice.
    expect(within(ownTable()).getAllByText('Using the practice default.')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('shows a kind the practice switched off as locked', async () => {
    setup({ settings: ownSettings({ failed_job: { enabled: false } }) });
    await open();
    expect(own('Failed background job: In-app')).toBeDisabled();
    expect(own('Failed background job: Email')).toBeDisabled();
    expect(
      within(ownTable()).getByText(/Switched off by your practice: nothing is sent/),
    ).toBeInTheDocument();
    expect(own('Budget alert: Email')).toBeEnabled();
  });

  it('saves only the kinds that changed', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await open();

    await user.click(own('Budget alert: Email'));
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Notification settings saved')).toBeInTheDocument();
    expect(backend.calls.savedSettings).toEqual([
      { preferences: [{ type: 'budget_alert', in_app: true, email: false, sms: false }] },
    ]);
    // Saved: nothing pending, and the choice is now the person's own.
    expect(screen.queryByText('You have unsaved changes.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(within(ownTable()).getAllByText('Using the practice default.')).toHaveLength(6);
    expect(own('Budget alert: Email')).not.toBeChecked();
  });

  it('does not count a box turned on and off again as a change', async () => {
    const user = userEvent.setup();
    setup();
    await open();
    await user.click(own('Budget alert: SMS'));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await user.click(own('Budget alert: SMS'));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('saves the mobile number together with a kind that uses SMS', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await open();

    await user.type(screen.getByRole('textbox', { name: 'Mobile number for SMS' }), '07700 900123');
    await user.click(own('Payment reminder: SMS'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Notification settings saved')).toBeInTheDocument();
    expect(backend.calls.savedSettings).toEqual([
      {
        preferences: [{ type: 'payment_reminder', in_app: true, email: true, sms: true }],
        sms_number: '07700 900123',
      },
    ]);
    expect(screen.getByRole('textbox', { name: 'Mobile number for SMS' })).toHaveValue(
      '07700 900123',
    );
  });

  it('clears the number when the field is emptied', async () => {
    const user = userEvent.setup();
    const backend = setup({ settings: ownSettings({}, '+4407700900123') });
    await open();
    await user.clear(screen.getByRole('textbox', { name: 'Mobile number for SMS' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Notification settings saved')).toBeInTheDocument();
    expect(backend.calls.savedSettings).toEqual([{ sms_number: null }]);
  });

  it('puts the API refusal of SMS without a number on the number field', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await open();

    await user.click(own('Budget alert: SMS'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const field = screen.getByRole('textbox', { name: 'Mobile number for SMS' });
    await waitFor(() => expect(field).toBeInvalid());
    expect(screen.getByText('Add a mobile number to receive SMS.')).toBeInTheDocument();
    expect(screen.queryByText('Notification settings saved')).not.toBeInTheDocument();
    expect(backend.calls.savedSettings).toHaveLength(1);
    // The choice is kept for another try.
    expect(own('Budget alert: SMS')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('puts a malformed number on the number field', async () => {
    const user = userEvent.setup();
    setup();
    await open();
    await user.type(screen.getByRole('textbox', { name: 'Mobile number for SMS' }), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a valid mobile number.')).toBeInTheDocument();
  });

  it('tells the person when the save failed for another reason', async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.put(orgApiPath('/notification-settings'), () =>
        fail(500, 'INTERNAL_ERROR', 'Something went wrong on our side.'),
      ),
    );
    await open();
    await user.click(own('Budget alert: Email'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('Could not save your notification settings'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong on our side\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('discards unsaved changes', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await open();
    await user.click(own('Budget alert: Email'));
    await user.type(screen.getByRole('textbox', { name: 'Mobile number for SMS' }), '0770');
    // Each card has its own Discard button; this is the one of the personal card.
    const form = ownTable().closest('form');
    if (!form) throw new Error('The personal matrix is not in a form');
    await user.click(within(form).getByRole('button', { name: 'Discard changes' }));

    expect(own('Budget alert: Email')).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Mobile number for SMS' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(backend.calls.savedSettings).toHaveLength(0);
  });

  it('shows a skeleton while loading', () => {
    server.use(
      http.get(orgApiPath('/notification-settings'), () => new Promise(() => undefined)),
      ...notificationHandlers(createBackend()),
    );
    renderInOrg(<NotificationSettingsPage />);
    expect(
      screen.getByRole('status', { name: 'Loading your notification settings' }),
    ).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    const backend = createBackend();
    server.use(
      http.get(orgApiPath('/notification-settings'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Something broke.') : undefined,
      ),
      ...notificationHandlers(backend),
    );
    renderInOrg(<NotificationSettingsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Could not load your notification settings' }),
    ).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('table', { name: 'Your notification choices' }),
    ).toBeInTheDocument();
  });
});

describe('NotificationSettingsPage: the practice', () => {
  it('is not offered, nor asked for, without organization.update or settings.manage', async () => {
    const backend = setup();
    await open({ context: contextWith(STAFF_PERMISSIONS) });
    expect(screen.queryByText('Practice defaults')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Notification settings of the practice' }),
    ).not.toBeInTheDocument();
    // The person's own matrix is there for everyone.
    expect(within(ownTable()).getAllByRole('row')).toHaveLength(8);
    expect(backend.calls.practiceReads).toBe(0);
  });

  it.each([['organization.update'], ['settings.manage']])(
    'is offered with %s',
    async (permission) => {
      const backend = setup();
      await open({ context: contextWith(['organization.read', permission]) });
      expect(await screen.findByText('Practice defaults')).toBeInTheDocument();
      expect(practiceTable()).toBeInTheDocument();
      expect(backend.calls.practiceReads).toBe(1);
    },
  );

  it('saves only the kinds that changed, with every field of each', async () => {
    const user = userEvent.setup();
    const backend = setup({ practice: practiceSettings({ budget_alert: { sms: false } }) });
    await open();
    await screen.findByRole('table', { name: 'Notification settings of the practice' });

    await user.click(practice('Payment reminder: SMS'));
    await user.click(practice('Failed background job: switched on for the practice'));
    await user.click(screen.getByRole('button', { name: 'Save practice settings' }));

    expect(await screen.findByText('Practice notification settings saved')).toBeInTheDocument();
    expect(backend.calls.savedPractice).toEqual([
      {
        types: [
          { type: 'payment_reminder', enabled: true, in_app: true, email: true, sms: true },
          { type: 'failed_job', enabled: false, in_app: true, email: true, sms: false },
        ],
      },
    ]);
    expect(screen.getByRole('button', { name: 'Save practice settings' })).toBeDisabled();
  });

  it('locks the channels of a kind that is switched off', async () => {
    const user = userEvent.setup();
    setup();
    await open();
    await screen.findByRole('table', { name: 'Notification settings of the practice' });

    expect(practice('Budget alert: Email')).toBeEnabled();
    await user.click(practice('Budget alert: switched on for the practice'));
    expect(practice('Budget alert: Email')).toBeDisabled();
    expect(
      within(practiceTable()).getByText('Switched off: nobody in the practice receives this.'),
    ).toBeInTheDocument();
    await user.click(practice('Budget alert: switched on for the practice'));
    expect(practice('Budget alert: Email')).toBeEnabled();
  });

  it("refreshes the person's own matrix after the practice changed", async () => {
    const user = userEvent.setup();
    setup();
    await open();
    await screen.findByRole('table', { name: 'Notification settings of the practice' });
    expect(own('Budget alert: In-app')).toBeEnabled();

    await user.click(practice('Budget alert: switched on for the practice'));
    await user.click(screen.getByRole('button', { name: 'Save practice settings' }));
    await screen.findByText('Practice notification settings saved');
    // The practice's switch is the first thing the person's own matrix honours.
    await waitFor(() => expect(own('Budget alert: In-app')).toBeDisabled());
  });

  it('reports a failed save and keeps the changes', async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.put(orgApiPath('/notification-settings/practice'), () =>
        fail(403, 'PERMISSION_DENIED', 'You may not change the practice settings.'),
      ),
    );
    await open();
    await screen.findByRole('table', { name: 'Notification settings of the practice' });
    await user.click(practice('Budget alert: SMS'));
    await user.click(screen.getByRole('button', { name: 'Save practice settings' }));

    expect(await screen.findByText("You don't have permission to do that")).toBeInTheDocument();
    expect(practice('Budget alert: SMS')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save practice settings' })).toBeEnabled();
  });

  it('shows the error of the practice card with a retry, without hiding the personal one', async () => {
    setup();
    server.use(
      http.get(orgApiPath('/notification-settings/practice'), () =>
        fail(500, 'INTERNAL_ERROR', 'Something broke.'),
      ),
    );
    await open({ context: ownerContext });
    expect(
      await screen.findByRole('heading', {
        name: 'Could not load the practice notification settings',
      }),
    ).toBeInTheDocument();
    expect(ownTable()).toBeInTheDocument();
  });
});
