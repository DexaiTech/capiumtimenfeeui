import { LogOut } from 'lucide-react';
import { Navigate, useLocation } from 'react-router';

import { Button } from '@/components/ui';
import { POST_LOGIN_ROUTE, safeNextPath } from '@/constants/routes';
import { ChangePasswordForm } from '@/features/account';
import { useAuth } from '@/features/auth';
import { useDocumentTitle } from '@/hooks';

import { AuthHeading } from './AuthHeading';

interface LocationState {
  from?: string;
}

/**
 * Full-page "Choose a new password": where every route leads while the account still has a
 * temporary password. Once it is changed the user goes on to where they were heading.
 */
export function ChangePasswordPage() {
  useDocumentTitle('Choose a new password');
  const { user, logout } = useAuth();
  const location = useLocation();
  const from = safeNextPath((location.state as LocationState | null)?.from);

  if (user && !user.must_change_password) {
    return <Navigate to={from ?? POST_LOGIN_ROUTE} replace />;
  }

  return (
    <>
      <AuthHeading title="Choose a new password">
        You signed in with a temporary password. Choose a password of your own to continue.
      </AuthHeading>
      <ChangePasswordForm currentLabel="Temporary password" />
      <div className="mt-6 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<LogOut className="size-4" aria-hidden="true" />}
          onClick={() => void logout()}
        >
          Sign out
        </Button>
      </div>
    </>
  );
}
