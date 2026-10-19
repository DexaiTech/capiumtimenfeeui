import { createBrowserRouter } from 'react-router';

import { appRoutes } from './routes';

export { appRoutes } from './routes';

export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}
