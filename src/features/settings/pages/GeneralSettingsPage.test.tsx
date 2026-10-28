import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { Organization } from '@/features/organizations';
import { expectRequiredFields } from '@/test/requiredFields';
import { fail, ok, server } from '@/test/server';

import { orgContext, staffRole, testOrganization } from '../test/fixtures';
import { orgPath } from '../test/handlers';
import { renderSettings } from '../test/render';
import GeneralSettingsPage from './GeneralSettingsPage';

type User = ReturnType<typeof userEvent.setup>;

function capturePatch(
  respond: (body: Partial<Organization>) => Organization = (body) => ({
    ...testOrganization,
    ...body,
  }),
) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(orgPath(''), async ({ request }) => {
      const body = (await request.json()) as Partial<Organization>;
      bodies.push(body);
      return ok(respond(body));
    }),
  );
  return bodies;
}

const card = (name: string) => screen.getByRole('form', { name });
const box = (form: string, name: string) => within(card(form)).getByRole('textbox', { name });
const save = (form: string, label: string) =>
  within(card(form)).getByRole('button', { name: label });

/** The five cards are tab panels now: open the one that holds the card wanted. */
async function openTab(user: User, label: string) {
  await user.click(screen.getByRole('tab', { name: label }));
}

describe('GeneralSettingsPage', () => {
  it('shows every general setting, one tab at a time', async () => {
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice Settings' })).toHaveAttribute(
      'href',
      '/lovelace/settings/practice',
    );

    // Time recording is the default tab.
    const time = within(card('Time recording'));
    expect(time.getByRole('combobox', { name: 'Time increment' })).toHaveValue('6');
    expect(time.getByRole('textbox', { name: 'Daily target (hours)' })).toHaveValue('7.5');
    expect(time.getByRole('combobox', { name: 'Week starts on' })).toHaveValue('1');
    expect(time.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true');
    expect(time.getByRole('button', { name: 'Saturday' })).toHaveAttribute('aria-pressed', 'false');
    expect(time.getByRole('switch', { name: 'Timesheet approval' })).not.toBeChecked();
    expect(save('Time recording', 'Save time settings')).toBeDisabled();

    await openTab(user, 'WIP & billing');
    const billing = within(card('WIP and billing'));
    expect(billing.getByRole('combobox', { name: 'Fixed-fee WIP' })).toHaveValue('on_completion');
    expect(
      billing.getByRole('textbox', { name: 'WIP adjustment approval threshold (£)' }),
    ).toHaveValue('500.00');
    expect(billing.getByRole('switch', { name: 'Write-off percentage rule' })).toBeChecked();
    expect(billing.getByRole('textbox', { name: 'Write-off approval threshold (%)' })).toHaveValue(
      '10',
    );
    expect(billing.getByRole('switch', { name: 'Invoice approval' })).not.toBeChecked();
    expect(billing.getByRole('textbox', { name: 'Invoice approval threshold (£)' })).toHaveValue(
      '0.00',
    );
    expect(billing.getByRole('switch', { name: 'Automatic payment reminders' })).not.toBeChecked();
    // A practice without a schedule of its own has the one day after the due date.
    expect(billing.getByRole('list', { name: 'Reminder days' })).toHaveTextContent(
      '7 days after the due date',
    );
    expect(save('WIP and billing', 'Save billing settings')).toBeDisabled();

    await openTab(user, 'Rates');
    expect(within(card('Rates')).getByRole('combobox', { name: 'Rate mode' })).toHaveValue(
      'staff_first',
    );
    expect(save('Rates', 'Save rate settings')).toBeDisabled();

    await openTab(user, 'Expenses');
    const expenses = within(card('Expenses'));
    expect(expenses.getByRole('textbox', { name: 'Mileage rate (£ per mile)' })).toHaveValue(
      '0.45',
    );
    expect(expenses.getByRole('textbox', { name: 'Expense mark-up (%)' })).toHaveValue('0');
    expect(expenses.getByRole('textbox', { name: 'Receipt required above (£)' })).toHaveValue(
      '25.00',
    );
    expect(save('Expenses', 'Save expense settings')).toBeDisabled();

    await openTab(user, 'Locale');
    const locale = within(card('Locale'));
    expect(locale.getByRole('combobox', { name: 'Timezone' })).toHaveValue('Europe/London');
    expect(locale.getByText('dd/MM/yyyy, for example 31/12/2026')).toBeInTheDocument();
    expect(locale.getByText(/GBP \(£\), set when the practice was created/)).toBeInTheDocument();
    expect(save('Locale', 'Save locale')).toBeDisabled();
  });

  it('saves the time card with only what changed, in minutes and numbers', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);

    const time = within(card('Time recording'));
    await user.selectOptions(time.getByRole('combobox', { name: 'Time increment' }), '15');
    await user.clear(box('Time recording', 'Daily target (hours)'));
    await user.type(box('Time recording', 'Daily target (hours)'), '8');
    await user.selectOptions(time.getByRole('combobox', { name: 'Week starts on' }), '7');
    await user.click(time.getByRole('button', { name: 'Friday' }));
    await user.click(time.getByRole('button', { name: 'Saturday' }));
    await user.click(time.getByRole('switch', { name: 'Timesheet approval' }));
    // Approval is now required, so the exemption for admins and partners shows (on by default).
    expect(time.getByRole('switch', { name: 'No approval for admins and partners' })).toBeChecked();
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    await user.click(save('Time recording', 'Save time settings'));

    expect(await screen.findByText('Time settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        time_increment_minutes: 15,
        minutes_per_day: 480,
        week_start: 7,
        working_days: [1, 2, 3, 4, 6],
        require_timesheet_approval: true,
      },
    ]);
    await waitFor(() => expect(save('Time recording', 'Save time settings')).toBeDisabled());
  });

  it('keeps the unsaved changes of a tab when another tab is saved', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);

    await openTab(user, 'Expenses');
    await user.clear(box('Expenses', 'Mileage rate (£ per mile)'));
    await user.type(box('Expenses', 'Mileage rate (£ per mile)'), '0.55');

    await openTab(user, 'Rates');
    await user.selectOptions(
      within(card('Rates')).getByRole('combobox', { name: 'Rate mode' }),
      'grade_only',
    );
    await user.click(save('Rates', 'Save rate settings'));
    expect(await screen.findByText('Rate settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ rate_mode: 'grade_only' }]);

    await openTab(user, 'Expenses');
    expect(box('Expenses', 'Mileage rate (£ per mile)')).toHaveValue('0.55');
    expect(save('Expenses', 'Save expense settings')).toBeEnabled();
  });

  it('sends the WIP and billing settings in pence and days', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'WIP & billing');

    const billing = within(card('WIP and billing'));
    await user.selectOptions(
      billing.getByRole('combobox', { name: 'Fixed-fee WIP' }),
      'by_budget_progress',
    );
    expect(
      billing.getByText(/in step with the budget hours used \(fee × hours logged ÷ budget hours\)/),
    ).toBeInTheDocument();
    const wip = box('WIP and billing', 'WIP adjustment approval threshold (£)');
    await user.clear(wip);
    await user.type(wip, '1,250.5');
    await user.click(billing.getByRole('switch', { name: 'Invoice approval' }));
    const invoice = box('WIP and billing', 'Invoice approval threshold (£)');
    await user.clear(invoice);
    await user.type(invoice, '2000');
    await user.click(billing.getByRole('switch', { name: 'Automatic payment reminders' }));
    // Before the due date, on it, and two days after: the 7 days after stays.
    const reminders = within(card('WIP and billing'));
    await user.selectOptions(
      reminders.getByRole('combobox', { name: 'When' }),
      'days before the due date',
    );
    await user.clear(reminders.getByRole('textbox', { name: 'Number of days' }));
    await user.type(reminders.getByRole('textbox', { name: 'Number of days' }), '3');
    await user.click(reminders.getByRole('button', { name: 'Add a reminder' }));
    await user.selectOptions(reminders.getByRole('combobox', { name: 'When' }), 'on the due date');
    await user.click(reminders.getByRole('button', { name: 'Add a reminder' }));
    await user.click(save('WIP and billing', 'Save billing settings'));

    expect(await screen.findByText('WIP and billing settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        fixed_fee_wip_mode: 'by_budget_progress',
        wip_adjustment_approval_threshold: 125050,
        invoice_approval_required: true,
        invoice_approval_threshold: 200000,
        payment_reminders_enabled: true,
        payment_reminder_schedule: [-3, 0, 7],
      },
    ]);
  });

  it('sends the write-off percentage threshold, and null when its switch is turned off', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'WIP & billing');

    const percent = box('WIP and billing', 'Write-off approval threshold (%)');
    await user.clear(percent);
    await user.type(percent, '12.5');
    await user.click(save('WIP and billing', 'Save billing settings'));
    expect(await screen.findByText('WIP and billing settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ wip_write_off_approval_threshold_percent: 1250 }]);

    await user.click(
      within(card('WIP and billing')).getByRole('switch', { name: 'Write-off percentage rule' }),
    );
    await user.click(save('WIP and billing', 'Save billing settings'));
    // The first save's message may still be showing: wait for the second request instead.
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect((await screen.findAllByText('WIP and billing settings saved')).length).toBeGreaterThan(
      0,
    );
    expect(bodies).toEqual([
      { wip_write_off_approval_threshold_percent: 1250 },
      { wip_write_off_approval_threshold_percent: null },
    ]);
  });

  it('leaves the invoice threshold and the reminder delay off until their switches are on', async () => {
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'WIP & billing');

    const billing = within(card('WIP and billing'));
    const threshold = billing.getByRole('textbox', { name: 'Invoice approval threshold (£)' });
    const addReminder = billing.getByRole('button', { name: 'Add a reminder' });
    expect(threshold).toBeDisabled();
    expect(addReminder).toBeDisabled();
    expect(billing.getByText('Turn on invoice approval to set a threshold.')).toBeInTheDocument();

    await user.click(billing.getByRole('switch', { name: 'Invoice approval' }));
    await user.click(billing.getByRole('switch', { name: 'Automatic payment reminders' }));
    expect(threshold).toBeEnabled();
    expect(addReminder).toBeEnabled();
  });

  it('explains the rate mode and saves it', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'Rates');

    expect(
      screen.getByText(/A person's own charge-out rate prices their time/),
    ).toBeInTheDocument();
    await user.selectOptions(
      within(card('Rates')).getByRole('combobox', { name: 'Rate mode' }),
      'grade_only',
    );
    expect(screen.getByText(/Staff-level rates are skipped/)).toBeInTheDocument();
    await user.click(save('Rates', 'Save rate settings'));

    expect(await screen.findByText('Rate settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ rate_mode: 'grade_only' }]);
  });

  it('converts the expense settings: mileage in pence, the mark-up in basis points', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'Expenses');

    await user.clear(box('Expenses', 'Mileage rate (£ per mile)'));
    await user.type(box('Expenses', 'Mileage rate (£ per mile)'), '£0.55');
    await user.clear(box('Expenses', 'Expense mark-up (%)'));
    await user.type(box('Expenses', 'Expense mark-up (%)'), '12.5');
    await user.clear(box('Expenses', 'Receipt required above (£)'));
    await user.type(box('Expenses', 'Receipt required above (£)'), '50');
    await user.click(save('Expenses', 'Save expense settings'));

    expect(await screen.findByText('Expense settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([
      { mileage_rate: 55, expense_markup_bp: 1250, receipt_required_threshold: 5000 },
    ]);
  });

  it('saves the timezone', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'Locale');

    await user.selectOptions(
      within(card('Locale')).getByRole('combobox', { name: 'Timezone' }),
      'Europe/Paris',
    );
    await user.click(save('Locale', 'Save locale'));

    expect(await screen.findByText('Locale settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ timezone: 'Europe/Paris' }]);
  });

  it('checks every value against the API ranges before sending anything', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);

    await user.clear(box('Time recording', 'Daily target (hours)'));
    await user.type(box('Time recording', 'Daily target (hours)'), '25');
    await user.click(within(card('Time recording')).getByRole('button', { name: 'Monday' }));
    for (const day of ['Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      await user.click(within(card('Time recording')).getByRole('button', { name: day }));
    }
    await user.click(save('Time recording', 'Save time settings'));
    expect(
      await screen.findByText('Enter the working hours of a day, more than 0 and at most 24'),
    ).toBeInTheDocument();
    expect(screen.getByText('Choose at least one working day')).toBeInTheDocument();

    await openTab(user, 'Expenses');
    await user.clear(box('Expenses', 'Mileage rate (£ per mile)'));
    await user.type(box('Expenses', 'Mileage rate (£ per mile)'), '10.01');
    await user.clear(box('Expenses', 'Expense mark-up (%)'));
    await user.type(box('Expenses', 'Expense mark-up (%)'), '1001');
    await user.clear(box('Expenses', 'Receipt required above (£)'));
    await user.type(box('Expenses', 'Receipt required above (£)'), '1000000.01');
    await user.click(save('Expenses', 'Save expense settings'));
    expect(
      await screen.findByText(
        'Enter the rate per mile in pounds, from 0 to 10.00, for example 0.45',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Enter a percentage from 0 to 1000 with at most two decimals, for example 10 or 12.5',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Enter an amount in pounds from 0 to 1,000,000.00, for example 500.00'),
    ).toBeInTheDocument();

    await openTab(user, 'WIP & billing');
    await user.click(
      within(card('WIP and billing')).getByRole('switch', { name: 'Automatic payment reminders' }),
    );
    const reminders = within(card('WIP and billing'));
    await user.clear(reminders.getByRole('textbox', { name: 'Number of days' }));
    await user.type(reminders.getByRole('textbox', { name: 'Number of days' }), '400');
    await user.click(reminders.getByRole('button', { name: 'Add a reminder' }));
    expect(await screen.findByText('Enter a number of days from 1 to 365.')).toBeInTheDocument();

    expect(bodies).toEqual([]);
  });

  it('puts 422 details on the field they name, mapping API names to the form', async () => {
    server.use(
      http.patch(orgPath(''), () =>
        fail(422, 'VALIDATION_ERROR', 'Invalid.', {
          details: [{ field: 'minutes_per_day', message: 'A day cannot be that long here.' }],
        }),
      ),
    );
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);

    await user.clear(box('Time recording', 'Daily target (hours)'));
    await user.type(box('Time recording', 'Daily target (hours)'), '9');
    await user.click(save('Time recording', 'Save time settings'));

    expect(await screen.findByText('A day cannot be that long here.')).toBeInTheDocument();
    expect(box('Time recording', 'Daily target (hours)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows what the API refused that matches no field, and keeps the typed values', async () => {
    server.use(
      http.patch(orgPath(''), () =>
        fail(403, 'PERMISSION_DENIED', 'You do not have permission to do that.', {}),
      ),
    );
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'Expenses');

    await user.clear(box('Expenses', 'Mileage rate (£ per mile)'));
    await user.type(box('Expenses', 'Mileage rate (£ per mile)'), '0.50');
    await user.click(save('Expenses', 'Save expense settings'));

    expect(await screen.findByText('No permission')).toBeInTheDocument();
    expect(await screen.findAllByText('You do not have permission to do that.')).not.toHaveLength(
      0,
    );
    expect(box('Expenses', 'Mileage rate (£ per mile)')).toHaveValue('0.50');
  });

  it('discards the changes of a tab', async () => {
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'Expenses');

    const rate = box('Expenses', 'Mileage rate (£ per mile)');
    await user.clear(rate);
    await user.type(rate, '0.99');
    await user.click(within(card('Expenses')).getByRole('button', { name: 'Discard changes' }));

    expect(rate).toHaveValue('0.45');
    expect(save('Expenses', 'Save expense settings')).toBeDisabled();
    expect(screen.queryByText('You have unsaved changes.')).not.toBeInTheDocument();
  });

  it('asks the browser to confirm closing the tab only while a card has unsaved changes', async () => {
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);
    await openTab(user, 'Rates');

    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(closing()).toBe(false);

    await user.click(within(card('Rates')).getByRole('combobox', { name: 'Rate mode' }));
    fireEvent.change(within(card('Rates')).getByRole('combobox', { name: 'Rate mode' }), {
      target: { value: 'grade_only' },
    });
    await waitFor(() => expect(closing()).toBe(true));

    await user.click(within(card('Rates')).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(closing()).toBe(false));
  });

  it('is read-only without organization.update', async () => {
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />, {
      context: orgContext({ role: staffRole, permissions: ['organization.read'] }),
    });

    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(card('Time recording')).toBeInTheDocument();
    expect(
      within(card('Time recording')).getByRole('combobox', { name: 'Time increment' }),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Save / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument();

    await openTab(user, 'WIP & billing');
    expect(
      within(card('WIP and billing')).getByRole('switch', { name: 'Invoice approval' }),
    ).toBeDisabled();

    await openTab(user, 'Expenses');
    expect(
      within(card('Expenses')).getByRole('textbox', { name: 'Mileage rate (£ per mile)' }),
    ).toBeDisabled();
  });
});

describe('GeneralSettingsPage: mandatory fields', () => {
  it('stars the typed values of every card, and the dependent ones only while their switch is on', async () => {
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />);

    const time = card('Time recording');
    expectRequiredFields(time, { required: ['Daily target (hours)'] });
    const days = within(time).getByRole('group', { name: 'Working days' });
    expect(days).toHaveAttribute('aria-required', 'true');
    expect(within(time).getByText('Working days')).toHaveClass('field-required');

    await openTab(user, 'WIP & billing');
    const billing = card('WIP and billing');
    // The percentage rule is on, invoice approval and reminders are off.
    expectRequiredFields(billing, {
      required: [/^WIP adjustment approval threshold/, 'Write-off approval threshold (%)'],
      optional: [/^Invoice approval threshold/],
    });
    await user.click(within(billing).getByRole('switch', { name: 'Invoice approval' }));
    expectRequiredFields(billing, { required: [/^Invoice approval threshold/] });
    await user.click(within(billing).getByRole('switch', { name: 'Write-off percentage rule' }));
    expectRequiredFields(billing, { required: [], optional: ['Write-off approval threshold (%)'] });

    await openTab(user, 'Expenses');
    expectRequiredFields(card('Expenses'), {
      required: [/^Mileage rate/, 'Expense mark-up (%)', /^Receipt required above/],
    });
  });
});

describe('GeneralSettingsPage: time that needs no approval', () => {
  it('turns the exemption off and saves only that change', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderSettings(<GeneralSettingsPage />, {
      context: {
        ...orgContext(),
        organization: { ...testOrganization, require_timesheet_approval: true },
      },
    });

    const time = within(card('Time recording'));
    await user.click(time.getByRole('switch', { name: 'No approval for admins and partners' }));
    await user.click(save('Time recording', 'Save time settings'));

    expect(await screen.findByText('Time settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ auto_approve_privileged_time: false }]);
  });

  it('is not offered while timesheet approval is off', async () => {
    renderSettings(<GeneralSettingsPage />);

    const time = within(card('Time recording'));
    await time.findByRole('switch', { name: 'Timesheet approval' });
    expect(
      time.queryByRole('switch', { name: 'No approval for admins and partners' }),
    ).not.toBeInTheDocument();
  });
});
