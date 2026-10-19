import { http } from 'msw';

import { apiPath, ok, server } from './server';

/** Serves `GET /system` as a closed deployment of one organization (milestone 11). */
export function mockClosedDeployment(organization = { name: 'Acme Inc', slug: 'acme' }): void {
  server.use(http.get(apiPath('/system'), () => ok({ closed_deployment: true, organization })));
}

/** Serves `GET /system` as an open deployment (the default of every test). */
export function mockOpenDeployment(): void {
  server.use(
    http.get(apiPath('/system'), () => ok({ closed_deployment: false, organization: null })),
  );
}
