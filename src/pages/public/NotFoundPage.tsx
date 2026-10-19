import { Compass } from 'lucide-react';
import { Link } from 'react-router';

import { buttonClasses, EmptyState } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useDocumentTitle } from '@/hooks';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <EmptyState
        icon={<Compass className="size-6" />}
        title="Page not found"
        description="The page you are looking for does not exist, has moved, or is not available to you."
        action={
          <Link to={routes.app} className={buttonClasses({ variant: 'primary' })}>
            Back to home
          </Link>
        }
      />
    </div>
  );
}
