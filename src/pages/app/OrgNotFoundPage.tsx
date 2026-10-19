import { Building2 } from 'lucide-react';
import { Link } from 'react-router';

import { buttonClasses, Card, EmptyState } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useSystemInfo } from '@/features/system';
import { useDocumentTitle } from '@/hooks';

/** The API answers 404 both for an unknown slug and for a practice the user is not a member of. */
export function OrgNotFoundPage() {
  useDocumentTitle('Practice not found');
  const { openRegistration } = useSystemInfo();
  return (
    <Card padding="none" className="flex flex-1 flex-col justify-center">
      <EmptyState
        icon={<Building2 className="size-6" />}
        title="Practice not found"
        description="This practice does not exist, or you are not a member of it. Check the address, or ask the practice administrator for an account."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to={routes.app} className={buttonClasses({ variant: 'primary' })}>
              Go to your practice
            </Link>
            {openRegistration ? (
              <Link to={routes.onboarding} className={buttonClasses({ variant: 'secondary' })}>
                Create a practice
              </Link>
            ) : null}
          </div>
        }
      />
    </Card>
  );
}
