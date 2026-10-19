import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/features/auth';

import { ThemeSync } from './ThemeSync';
import { UnhandledRejectionToaster } from './UnhandledRejectionToaster';

export interface AppProvidersProps {
  queryClient: QueryClient;
  children: ReactNode;
}

/** Everything the route tree needs, in dependency order. */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* The one place prefers-reduced-motion is honoured for Motion animations. */}
      <MotionConfig reducedMotion="user">
        <ThemeSync />
        <ToastProvider>
          <UnhandledRejectionToaster />
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
