import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { ClientPicker, type ClientOption, type ClientPickerProps } from '..';
import { mutual, techwave, techwaveDetail } from './fixtures';
import { clientsHandlers } from './handlers';

type PickerProps = Partial<Omit<ClientPickerProps, 'value' | 'onChange'>> & {
  /** A client chosen before the picker is shown. */
  initial?: string | null;
  onPick?: (client: ClientOption | null) => void;
};

/** How a form uses the picker: it keeps the chosen id and hands it back as `value`. */
function Host({ initial = null, onPick, ...props }: PickerProps) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <ClientPicker
      label="Client"
      {...props}
      value={value}
      onChange={(client) => {
        setValue(client?.id ?? null);
        onPick?.(client);
      }}
    />
  );
}

function mount(props: PickerProps = {}, onList?: (params: URLSearchParams) => void) {
  server.use(
    ...clientsHandlers({ onList }),
    // After the list handlers: `/clients/summary` must not be taken for a client id.
    http.get(orgApiPath('/clients/:clientId'), () => ok(techwaveDetail)),
  );
  return renderInOrg(<Host {...props} />);
}

const combobox = () => screen.getByRole('combobox', { name: 'Client' });
const listbox = () => screen.getByRole('listbox', { name: 'Client' });

describe('ClientPicker', () => {
  it('searches by name or code once typing stops and returns the id, name and code', async () => {
    const seen: URLSearchParams[] = [];
    const picked: Array<ClientOption | null> = [];
    const user = userEvent.setup();
    mount({ onPick: (client) => picked.push(client) }, (params) => seen.push(params));

    await user.click(combobox());
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    // Opened, it lists the clients by name.
    expect(
      await screen.findByRole('option', { name: /Techwave Innovations Ltd/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Mutual Technologies/ })).toBeInTheDocument();
    expect(seen.at(-1)?.get('q')).toBeNull();
    expect(seen.at(-1)?.get('limit')).toBe('20');
    expect(seen.at(-1)?.get('sort')).toBe('name');

    await user.type(combobox(), 'wave');
    await waitFor(() => expect(seen.at(-1)?.get('q')).toBe('wave'));
    // Only the settled text is sent, not every key.
    expect(seen.map((params) => params.get('q')).filter((q) => q !== null)).toEqual(['wave']);
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: /Mutual Technologies/ })).toBeNull(),
    );

    await user.click(screen.getByRole('option', { name: /Techwave Innovations Ltd/ }));
    expect(picked).toEqual([{ id: techwave.id, name: techwave.name, code: techwave.code }]);
    expect(combobox()).toHaveValue('Techwave Innovations Ltd (APX006)');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Clear client' })).toBeInTheDocument();
  });

  it('shows the code under each name', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(combobox());
    const option = await screen.findByRole('option', { name: /Techwave Innovations Ltd/ });
    expect(option).toHaveTextContent('APX006');
    expect(within(listbox()).getAllByRole('option')).toHaveLength(2);
  });

  it('works from the keyboard: arrows and Enter choose, Escape closes only the list', async () => {
    const picked: Array<ClientOption | null> = [];
    const user = userEvent.setup();
    mount({ onPick: (client) => picked.push(client) });

    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    await screen.findByRole('option', { name: /Techwave Innovations Ltd/ });
    expect(combobox()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Techwave Innovations Ltd/ }).id,
    );

    await user.keyboard('{ArrowDown}');
    expect(combobox()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Mutual Technologies/ }).id,
    );
    await user.keyboard('{ArrowUp}{ArrowDown}');

    await user.keyboard('{Escape}');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(picked).toEqual([]);

    await user.keyboard('{ArrowDown}');
    await screen.findByRole('option', { name: /Mutual Technologies/ });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(picked).toEqual([{ id: mutual.id, name: mutual.name, code: mutual.code }]);
    expect(combobox()).toHaveValue('Mutual Technologies (APX007)');
  });

  it('closes when focus leaves it', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(combobox());
    await screen.findByRole('option', { name: /Techwave Innovations Ltd/ });
    await user.tab();
    await user.tab();
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('looks up the name of a client the form set, and clears the choice', async () => {
    const picked: Array<ClientOption | null> = [];
    const user = userEvent.setup();
    mount({ initial: techwave.id, onPick: (client) => picked.push(client) });

    await waitFor(() => expect(combobox()).toHaveValue('Techwave Innovations Ltd (APX006)'));
    await user.click(screen.getByRole('button', { name: 'Clear client' }));
    expect(picked).toEqual([null]);
    expect(combobox()).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear client' })).toBeNull();
  });

  it('can be left without a clear button', async () => {
    mount({ initial: techwave.id, clearable: false });
    await waitFor(() => expect(combobox()).toHaveValue('Techwave Innovations Ltd (APX006)'));
    expect(screen.queryByRole('button', { name: 'Clear client' })).toBeNull();
  });

  it('can be disabled', async () => {
    const user = userEvent.setup();
    mount({ initial: techwave.id, disabled: true });
    await waitFor(() => expect(combobox()).toHaveValue('Techwave Innovations Ltd (APX006)'));
    expect(combobox()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Clear client' })).toBeNull();
    await user.click(combobox());
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the error of the form on the field', () => {
    mount({ error: 'Choose a client' });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a client');
    expect(combobox()).toBeInvalid();
    expect(combobox()).toHaveAccessibleDescription('Choose a client');
  });

  it('keeps its label for assistive technology when it is hidden', () => {
    mount({ hideLabel: true, label: 'Billing client' });
    expect(screen.getByRole('combobox', { name: 'Billing client' })).toBeInTheDocument();
  });

  it('asks for every status but archived unless told otherwise', async () => {
    const seen: URLSearchParams[] = [];
    const user = userEvent.setup();
    mount({}, (params) => seen.push(params));
    await user.click(combobox());
    await screen.findByRole('option', { name: /Techwave Innovations Ltd/ });
    expect(seen.at(-1)?.getAll('status')).toEqual([]);
  });

  it('limits the clients to the statuses it is given', async () => {
    const seen: URLSearchParams[] = [];
    const user = userEvent.setup();
    mount({ statuses: ['active', 'prospect'] }, (params) => seen.push(params));
    await user.click(combobox());
    await screen.findByRole('option', { name: /Techwave Innovations Ltd/ });
    expect(seen.at(-1)?.getAll('status')).toEqual(['active', 'prospect']);
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(combobox());
    await user.type(combobox(), 'zzz');
    expect(await screen.findByText('No clients found.')).toBeInTheDocument();
  });

  it('explains a failed search and retries', async () => {
    let calls = 0;
    const user = userEvent.setup();
    server.use(
      http.get(orgApiPath('/clients'), () => {
        calls += 1;
        return calls === 1
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok([techwave], { meta: { next_cursor: null, has_more: false } });
      }),
    );
    renderInOrg(<Host />);

    await user.click(combobox());
    expect(await screen.findByText('Could not load the clients.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('option', { name: /Techwave Innovations Ltd/ }),
    ).toBeInTheDocument();
  });

  it('calls onChange once per choice', async () => {
    const onPick = vi.fn<(client: ClientOption | null) => void>();
    const user = userEvent.setup();
    mount({ onPick });
    await user.click(combobox());
    await user.click(await screen.findByRole('option', { name: /Mutual Technologies/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({ id: mutual.id, name: mutual.name, code: mutual.code });
  });
});
