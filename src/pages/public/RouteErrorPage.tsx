import { useState } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { buttonClasses, ErrorState } from '@/components/ui';
import { routes } from '@/constants/routes';
import { isApiError } from '@/services/api';
import { cn } from '@/utils/cn';
import { reloadForNewVersion } from '@/utils/reloadForNewVersion';

import { NotFoundPage } from './NotFoundPage';

export interface RouteErrorPageProps {
  /** True for the root boundary (no layout around it); false inside the app shell. */
  fullPage?: boolean;
}

function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(
      error.message,
    )
  );
}

/** Route-level error boundary. Inside the shell, the chrome stays and only the content shows the error. */
export function RouteErrorPage({ fullPage = false }: RouteErrorPageProps) {
  const error = useRouteError();
  // A page file of an older release is gone (APT82): load the new version once instead of
  // showing the error. Decided once per error screen, so a render never reloads twice.
  const [reloading] = useState(() => isChunkLoadError(error) && reloadForNewVersion());

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className={cn('flex', fullPage && 'min-h-dvh bg-bg')}>
        <NotFoundPage />
      </div>
    );
  }

  const chunkFailed = isChunkLoadError(error);
  if (reloading) return null;
  if (!chunkFailed) console.error('Route error', error);

  return (
    <div className={cn('flex flex-col items-center justify-center', fullPage && 'min-h-dvh bg-bg')}>
      <ErrorState
        title={chunkFailed ? 'This page could not be loaded' : 'Something went wrong on this page'}
        error={
          isApiError(error)
            ? error
            : {
                message: chunkFailed
                  ? 'A new version may have been released, or your connection dropped. Reload to continue.'
                  : 'An unexpected error stopped this page from rendering. Reloading usually fixes it.',
              }
        }
        retryLabel="Reload"
        onRetry={() => window.location.reload()}
      />
      <Link to={routes.app} className={buttonClasses({ variant: 'ghost' })}>
        Back to home
      </Link>
    </div>
  );
}
