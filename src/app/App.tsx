import { useState } from 'react';
import { RouterProvider } from 'react-router';

import { AppErrorBoundary } from './providers/AppErrorBoundary';
import { AppProviders } from './providers/AppProviders';
import { createQueryClient } from './providers/queryClient';
import { createAppRouter } from './router';

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createAppRouter);

  return (
    <AppErrorBoundary>
      <AppProviders queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  );
}
