import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useOrgPreferenceStore } from '@/app/store';
import { useToast } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { CreateOrganizationForm, useMyOrganizations } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { AuthFooterLink, AuthHeading, authLinkClasses } from '../auth/AuthHeading';

/** Create a practice: the first step for a new account, and the "Create practice" action later. */
export function OnboardingPage() {
  useDocumentTitle('Create a practice');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const organizations = useMyOrganizations();
  const setLastOrgSlug = useOrgPreferenceStore((state) => state.setLastOrgSlug);
  const [loggingOut, setLoggingOut] = useState(false);
  const hasOrganizations = (organizations.data?.length ?? 0) > 0;

  return (
    <>
      <AuthHeading title="Create a practice">
        A practice holds your clients, jobs, time and billing. You become its owner and can add your
        staff next.
      </AuthHeading>
      <CreateOrganizationForm
        onCreated={(context) => {
          setLastOrgSlug(context.organization.slug);
          toast({ tone: 'success', title: `${context.organization.name} is ready` });
          void navigate(routes.org.home(context.organization.slug), { replace: true });
        }}
      />
      <AuthFooterLink>
        {hasOrganizations ? (
          <Link to={routes.app} className={authLinkClasses}>
            Back to your practice
          </Link>
        ) : (
          <>
            Signed in as <span className="break-all text-text">{user?.email}</span>.{' '}
            <button
              type="button"
              disabled={loggingOut}
              className={authLinkClasses}
              onClick={() => {
                setLoggingOut(true);
                void logout();
              }}
            >
              Log out
            </button>
          </>
        )}
      </AuthFooterLink>
    </>
  );
}
