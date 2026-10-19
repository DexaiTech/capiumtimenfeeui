import { screen } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { apiPath, fail, ok, server } from '@/test/server';
import { mockClosedDeployment } from '@/test/systemFixtures';

import { roleDisplayName, SUPER_ADMIN_NAME } from './roleName';
import { useRoleName } from './useRoleName';
import { useSystemInfo } from './useSystemInfo';

function Probe() {
  const { ready, closed, organization, openRegistration } = useSystemInfo();
  const roleName = useRoleName();
  return (
    <ul>
      <li>ready: {String(ready)}</li>
      <li>closed: {String(closed)}</li>
      <li>open registration: {String(openRegistration)}</li>
      <li>organization: {organization?.slug ?? 'none'}</li>
      <li>owner: {roleName({ name: 'Owner', system_key: 'owner' })}</li>
    </ul>
  );
}

describe('useSystemInfo', () => {
  it('reports an open deployment by default, with no organization', async () => {
    renderWithProviders(<Probe />);
    expect(await screen.findByText('ready: true')).toBeInTheDocument();
    expect(screen.getByText('closed: false')).toBeInTheDocument();
    expect(screen.getByText('open registration: true')).toBeInTheDocument();
    expect(screen.getByText('organization: none')).toBeInTheDocument();
    expect(screen.getByText('owner: Owner')).toBeInTheDocument();
  });

  it('is not ready, and offers no registration, until the answer arrives', async () => {
    renderWithProviders(<Probe />);
    expect(screen.getByText('ready: false')).toBeInTheDocument();
    expect(screen.getByText('open registration: false')).toBeInTheDocument();
    await screen.findByText('ready: true');
  });

  it('reports a closed deployment with its single organization and the Super admin name', async () => {
    mockClosedDeployment({ name: 'Acme Inc', slug: 'acme' });
    renderWithProviders(<Probe />);
    expect(await screen.findByText('closed: true')).toBeInTheDocument();
    expect(screen.getByText('open registration: false')).toBeInTheDocument();
    expect(screen.getByText('organization: acme')).toBeInTheDocument();
    expect(screen.getByText(`owner: ${SUPER_ADMIN_NAME}`)).toBeInTheDocument();
  });

  it('treats an API without the endpoint as an open deployment, as before the mode existed', async () => {
    server.use(http.get(apiPath('/system'), () => fail(404, 'NOT_FOUND', 'Not found')));
    renderWithProviders(<Probe />);
    expect(await screen.findByText('ready: true')).toBeInTheDocument();
    expect(screen.getByText('closed: false')).toBeInTheDocument();
    expect(screen.getByText('open registration: true')).toBeInTheDocument();
  });

  it.each([502, 503, 500])(
    'treats an API that is down (%i) as closed: no sign-up or password reset is offered',
    async (status) => {
      server.use(http.get(apiPath('/system'), () => fail(status, 'SERVICE_UNAVAILABLE', 'Down')));
      renderWithProviders(<Probe />);
      expect(await screen.findByText('ready: true')).toBeInTheDocument();
      expect(screen.getByText('closed: true')).toBeInTheDocument();
      expect(screen.getByText('open registration: false')).toBeInTheDocument();
    },
  );

  it('asks only once for any number of readers', async () => {
    let calls = 0;
    server.use(
      http.get(apiPath('/system'), () => {
        calls += 1;
        return ok({ closed_deployment: false, organization: null });
      }),
    );
    renderWithProviders(
      <>
        <Probe />
        <Probe />
      </>,
    );
    await screen.findAllByText('ready: true');
    expect(calls).toBe(1);
  });
});

describe('roleDisplayName', () => {
  it('renames only the owner, and only in a closed deployment', () => {
    const owner = { name: 'Owner', system_key: 'owner' };
    const admin = { name: 'Admin', system_key: 'admin' };
    expect(roleDisplayName(owner, true)).toBe('Super admin');
    expect(roleDisplayName(owner, false)).toBe('Owner');
    expect(roleDisplayName(admin, true)).toBe('Admin');
    expect(roleDisplayName({ name: 'Custom', system_key: null }, true)).toBe('Custom');
  });
});
