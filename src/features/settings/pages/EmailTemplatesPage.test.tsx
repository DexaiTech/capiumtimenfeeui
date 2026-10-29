import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  budgetAlertTemplate,
  invitationTemplate,
  invoiceTemplate,
} from '@/features/notifications/test/fixtures';
import {
  createBackend,
  DEFAULT_TEXT,
  notificationHandlers,
  orgApiPath,
} from '@/features/notifications/test/handlers';
import { contextWith, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import EmailTemplatesPage from './EmailTemplatesPage';

function setup() {
  const backend = createBackend();
  server.use(...notificationHandlers(backend));
  return backend;
}

const row = (name: RegExp) => screen.findByRole('row', { name });
const subject = () => screen.getByRole('textbox', { name: 'Subject' });
const htmlBody = () => screen.getByRole('textbox', { name: 'Email body (HTML)' });
const textBody = () => screen.getByRole('textbox', { name: 'Plain text body' });
const chip = (name: string) =>
  within(screen.getByRole('group', { name: 'Merge fields' })).getByRole('button', { name });
const edit = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

async function openEditor(key = 'budget_alert') {
  renderInOrg(<EmailTemplatesPage />, { route: `/?template=${key}` });
  await screen.findByRole('textbox', { name: 'Subject' });
}

describe('EmailTemplatesPage: the list', () => {
  it('lists the emails with their kind, whether they are customised and the last edit', async () => {
    setup();
    renderInOrg(<EmailTemplatesPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Email Templates' })).toBeInTheDocument();
    const invoice = within(await row(/^Invoice email/));
    expect(invoice.getByText('System')).toBeInTheDocument();
    expect(invoice.getByText('Customised')).toBeInTheDocument();
    // 09:05 UTC is 10:05 in London in October.
    expect(invoice.getByText('18/10/2026 10:05')).toBeInTheDocument();
    expect(invoice.getByText('by Ada Admin')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Team emails/ }));
    const budget = within(await row(/^Budget alert/));
    expect(budget.getByText('Notification')).toBeInTheDocument();
    expect(budget.getByText('Default')).toBeInTheDocument();
    expect(budget.getByText('—')).toBeInTheDocument();
    expect(await row(/^Staff invitation/)).toBeInTheDocument();
  });

  it('splits the client emails from the team emails', async () => {
    const user = userEvent.setup();
    setup();
    renderInOrg(<EmailTemplatesPage />);

    const external = await screen.findByRole('tab', { name: /Client emails \(external\)/ });
    const internal = screen.getByRole('tab', { name: /Team emails \(internal\)/ });
    expect(external).toHaveAttribute('aria-selected', 'true');
    expect(await row(/^Invoice email/)).toBeInTheDocument();
    expect(external).toHaveTextContent('1');
    expect(internal).toHaveTextContent('2');
    expect(screen.queryByRole('row', { name: /^Budget alert/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Staff invitation/ })).not.toBeInTheDocument();

    await user.click(internal);
    expect(internal).toHaveAttribute('aria-selected', 'true');
    expect(await row(/^Budget alert/)).toBeInTheDocument();
    expect(await row(/^Staff invitation/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Invoice email/ })).not.toBeInTheDocument();

    await user.click(external);
    expect(await row(/^Invoice email/)).toBeInTheDocument();
  });

  it('opens on the team emails with ?audience=internal and goes back to the audience of the email', async () => {
    const user = userEvent.setup();
    setup();
    renderInOrg(<EmailTemplatesPage />, { route: '/?audience=internal' });
    expect(await row(/^Budget alert/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Edit Budget alert' }));
    await user.click(await screen.findByRole('button', { name: 'All templates' }));
    expect(await row(/^Budget alert/)).toBeInTheDocument();
  });

  it('goes back from a linked email to the list of its audience', async () => {
    const user = userEvent.setup();
    setup();
    renderInOrg(<EmailTemplatesPage />, { route: '/?template=staff_invitation' });
    await user.click(await screen.findByRole('button', { name: 'All templates' }));
    expect(await row(/^Staff invitation/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Team emails/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/email-templates'), () => new Promise(() => undefined)));
    renderInOrg(<EmailTemplatesPage />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('shows the empty state when there are no templates', async () => {
    server.use(http.get(orgApiPath('/email-templates'), () => ok([])));
    renderInOrg(<EmailTemplatesPage />);
    expect(await screen.findByRole('heading', { name: 'No email templates' })).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    const backend = createBackend();
    server.use(
      http.get(orgApiPath('/email-templates'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Something broke.') : undefined,
      ),
      ...notificationHandlers(backend),
    );
    renderInOrg(<EmailTemplatesPage />);
    expect(
      await screen.findByRole('heading', { name: 'Could not load the email templates' }),
    ).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/^Invoice email/)).toBeInTheDocument();
  });

  it.each([['organization.update'], ['settings.manage']])('is open with %s', async (permission) => {
    setup();
    renderInOrg(<EmailTemplatesPage />, {
      context: contextWith(['organization.read', permission]),
    });
    expect(await row(/^Invoice email/)).toBeInTheDocument();
  });

  it('is not open to a role without organization.update or settings.manage, and asks for nothing', async () => {
    const backend = setup();
    renderInOrg(<EmailTemplatesPage />, { context: contextWith(STAFF_PERMISSIONS) });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(backend.calls.templateLists).toBe(0);
  });

  it('opens an email in the editor and comes back to the list', async () => {
    const user = userEvent.setup();
    setup();
    renderInOrg(<EmailTemplatesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Invoice email' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Invoice email' }),
    ).toBeInTheDocument();
    expect(subject()).toHaveValue(invoiceTemplate.subject);
    await user.click(screen.getByRole('button', { name: 'All templates' }));
    expect(await row(/^Invoice email/)).toBeInTheDocument();
  });

  it('says so when the email does not exist', async () => {
    setup();
    renderInOrg(<EmailTemplatesPage />, { route: '/?template=nope' });
    expect(await screen.findByRole('heading', { name: 'Template not found' })).toBeInTheDocument();
  });
});

describe('EmailTemplatesPage: the editor', () => {
  it('shows the text of the email and only the merge fields it may use', async () => {
    setup();
    await openEditor();

    expect(htmlBody()).toHaveValue(budgetAlertTemplate.html_body);
    expect(textBody()).toHaveValue(budgetAlertTemplate.text_body);
    const chips = within(screen.getByRole('group', { name: 'Merge fields' }))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(chips).toEqual([
      '{{ recipient_name }}',
      '{{ practice_name }}',
      '{{ job_name }}',
      '{{ budget_percent }}',
    ]);
    expect(screen.getByText('Default', { selector: 'span' })).toBeInTheDocument();
    // Nothing of its own to go back to.
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save template' })).toBeDisabled();
  });

  it('says which merge fields an email must contain', async () => {
    setup();
    await openEditor(invitationTemplate.key);
    expect(
      screen.getByText(/\{\{ link \}\} must appear in the HTML or the plain text\./),
    ).toBeInTheDocument();
  });

  it('inserts a merge field where the cursor is, and replaces a selection', async () => {
    const user = userEvent.setup();
    setup();
    await openEditor();

    htmlBody().focus();
    (htmlBody() as HTMLTextAreaElement).setSelectionRange(3, 3);
    await user.click(chip('{{ job_name }}'));
    expect(htmlBody()).toHaveValue(
      budgetAlertTemplate.html_body.slice(0, 3) +
        '{{ job_name }}' +
        budgetAlertTemplate.html_body.slice(3),
    );
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    // The cursor goes back into the field, after the inserted field.
    await waitFor(() => expect(htmlBody()).toHaveFocus());
    expect((htmlBody() as HTMLTextAreaElement).selectionStart).toBe(3 + '{{ job_name }}'.length);
    // Into the field that was used last: the subject, with its text selected.
    subject().focus();
    (subject() as HTMLInputElement).setSelectionRange(0, budgetAlertTemplate.subject.length);
    await user.click(chip('{{ practice_name }}'));
    expect(subject()).toHaveValue('{{ practice_name }}');
    // The text body was not touched.
    expect(textBody()).toHaveValue(budgetAlertTemplate.text_body);
  });

  it('shows the preview after typing pauses, as the API renders it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openEditor();

    const frame = await screen.findByTitle('Email preview');
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame.getAttribute('srcdoc')).toContain(
      'Hello Ada Admin, the job has used 80% of its budget.',
    );
    expect(screen.getByText('Budget alert: Year-end accounts 2026')).toBeInTheDocument();
    expect(backend.calls.previews).toEqual([
      {
        key: 'budget_alert',
        body: {
          subject: budgetAlertTemplate.subject,
          html_body: budgetAlertTemplate.html_body,
          text_body: budgetAlertTemplate.text_body,
        },
      },
    ]);

    await user.click(screen.getByRole('button', { name: 'Plain text' }));
    expect(screen.getByText(/Hello Ada Admin, the job has used 80% of its budget\./)).toBeVisible();

    // Several keystrokes, one request: the preview follows the last text.
    edit(subject(), 'Budget alert: {{ job_name }} (new)');
    edit(subject(), 'Budget alert: {{ job_name }} (newer)');
    await waitFor(() => expect(backend.calls.previews).toHaveLength(2));
    expect(backend.calls.previews[1]?.body.subject).toBe('Budget alert: {{ job_name }} (newer)');
    expect(
      await screen.findByText('Budget alert: Year-end accounts 2026 (newer)'),
    ).toBeInTheDocument();
  });

  it('marks the problems the API finds while typing, and clears them once fixed', async () => {
    setup();
    await openEditor();
    await screen.findByTitle('Email preview');

    edit(subject(), 'Alert {{ nope }}');
    expect(
      await screen.findByText('{{ nope }} is not a merge field of this email.'),
    ).toBeInTheDocument();
    expect(subject()).toBeInvalid();
    expect(
      screen.getByText('The preview appears when the problems marked on the fields are fixed.'),
    ).toBeInTheDocument();
    expect(screen.queryByTitle('Email preview')).not.toBeInTheDocument();

    edit(subject(), 'Alert {{ job_name }}');
    expect(await screen.findByTitle('Email preview')).toBeInTheDocument();
    expect(
      screen.queryByText('{{ nope }} is not a merge field of this email.'),
    ).not.toBeInTheDocument();
    expect(subject()).toBeValid();
  });

  it('saves all three texts, then shows the email as customised', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openEditor();

    edit(subject(), 'Budget at {{ budget_percent }}%');
    await user.click(screen.getByRole('button', { name: 'Save template' }));

    expect(await screen.findByText('Budget alert saved')).toBeInTheDocument();
    expect(backend.calls.savedTemplates).toEqual([
      {
        key: 'budget_alert',
        body: {
          subject: 'Budget at {{ budget_percent }}%',
          html_body: budgetAlertTemplate.html_body,
          text_body: budgetAlertTemplate.text_body,
        },
      },
    ]);
    expect(screen.getByText('Customised', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('You have unsaved changes.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'All templates' }));
    const budget = within(await row(/^Budget alert/));
    expect(budget.getByText('Customised')).toBeInTheDocument();
    // 10:00 UTC is 11:00 in London in October.
    expect(budget.getByText('19/10/2026 11:00')).toBeInTheDocument();
  });

  it('shows the problems of a refused save on the field and keeps the text', async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.put(orgApiPath('/email-templates/:key'), () =>
        fail(422, 'VALIDATION_ERROR', 'The template is not valid.', {
          details: [
            {
              field: 'subject',
              code: 'multiline_subject',
              message: 'The subject must be one line.',
            },
            { field: 'values.x', code: 'invalid', message: 'A value is not allowed.' },
          ],
        }),
      ),
    );
    await openEditor();
    edit(subject(), 'Changed');
    await user.click(screen.getByRole('button', { name: 'Save template' }));

    expect(await screen.findByText('The subject must be one line.')).toBeInTheDocument();
    expect(subject()).toBeInvalid();
    // A problem that belongs to no field is still shown.
    expect(screen.getByText('A value is not allowed.')).toBeInTheDocument();
    expect(screen.queryByText('Budget alert saved')).not.toBeInTheDocument();
    expect(subject()).toHaveValue('Changed');

    // Editing again clears what the save said.
    edit(subject(), 'Changed again');
    await waitFor(() =>
      expect(screen.queryByText('The subject must be one line.')).not.toBeInTheDocument(),
    );
  });

  it('refuses a missing required field on the HTML body', async () => {
    setup();
    await openEditor(invitationTemplate.key);
    edit(htmlBody(), '<p>Hello</p>');
    edit(textBody(), 'Hello');
    expect(
      await screen.findByText('{{ link }} must appear in the HTML or the plain text.', {
        selector: 'p',
      }),
    ).toBeInTheDocument();
  });

  it('tells the person when the save failed for another reason', async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.put(orgApiPath('/email-templates/:key'), () =>
        fail(500, 'INTERNAL_ERROR', 'Something went wrong on our side.'),
      ),
    );
    await openEditor();
    edit(subject(), 'Changed');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByText('Could not save the template')).toBeInTheDocument();
    expect(screen.getByText('The template could not be saved. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save template' })).toBeEnabled();
  });

  it('discards the edits', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openEditor();
    edit(subject(), 'Changed');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(subject()).toHaveValue(budgetAlertTemplate.subject);
    expect(backend.calls.savedTemplates).toHaveLength(0);
  });

  it('goes back to the default text after a confirmation', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openEditor('invoice');
    expect(screen.getByText('Customised', { selector: 'span' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset to the default?' });
    expect(dialog).toHaveTextContent('Your version of “Invoice email” is deleted');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Reset to the default?' }),
      ).not.toBeInTheDocument(),
    );
    expect(backend.calls.resets).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Reset to the default?' })).getByRole(
        'button',
        { name: 'Reset to default' },
      ),
    );

    expect(await screen.findByText('Invoice email reset to the default')).toBeInTheDocument();
    expect(backend.calls.resets).toEqual(['invoice']);
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Reset to the default?' }),
      ).not.toBeInTheDocument(),
    );
    expect(subject()).toHaveValue(DEFAULT_TEXT.subject);
    expect(htmlBody()).toHaveValue(DEFAULT_TEXT.html_body);
    expect(screen.getByText('Default', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeDisabled();
  });

  it('keeps the dialog open and explains a refused reset', async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.delete(orgApiPath('/email-templates/:key'), () =>
        fail(403, 'PERMISSION_DENIED', 'You may not reset email templates.'),
      ),
    );
    await openEditor('invoice');
    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset to the default?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset to default' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You may not reset email templates.',
    );
    expect(screen.getByRole('dialog', { name: 'Reset to the default?' })).toBeInTheDocument();
  });
});
