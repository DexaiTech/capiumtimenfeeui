import { UserRound } from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import { PageHeader } from '@/components/layout';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/services/api';

import { useProfile } from '../api/hooks';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { LogoutEverywhere } from '../components/LogoutEverywhere';
import { ProfileForm } from '../components/ProfileForm';
import { SessionsList } from '../components/SessionsList';

function ProfileSection() {
  const profile = useProfile();

  if (profile.isPending) {
    return (
      <SectionCard title="Profile">
        <div role="status" aria-label="Loading profile" className="flex flex-col gap-4">
          <Skeleton shape="rect" className="h-10 w-full" />
          <Skeleton shape="rect" className="h-10 w-full" />
          <Skeleton shape="rect" className="h-10 w-full" />
        </div>
      </SectionCard>
    );
  }
  if (profile.isError) {
    return (
      <SectionCard title="Profile">
        <ErrorState
          title="Could not load your profile"
          error={isApiError(profile.error) ? profile.error : null}
          onRetry={() => void profile.refetch()}
          retrying={profile.isRefetching}
        />
      </SectionCard>
    );
  }
  if (!profile.data) {
    return (
      <SectionCard title="Profile">
        <EmptyState
          icon={<UserRound className="size-6" />}
          title="No profile yet"
          description="Your profile could not be found. Try signing in again."
        />
      </SectionCard>
    );
  }
  const user = profile.data;
  return (
    <SectionCard
      id="profile"
      title="Profile"
      description="Your name and the timezone used for dates and timesheets."
    >
      {/* Remount when the saved values change elsewhere, so the form never shows stale defaults. */}
      <ProfileForm key={`${user.full_name}|${user.timezone}`} user={user} />
    </SectionCard>
  );
}

/** `/:orgSlug/account`: profile, password and signed-in devices of the current user. */
export default function AccountPage() {
  useDocumentTitle('My account');
  return (
    <div className="grid w-full items-start gap-5 xl:grid-cols-2">
      <PageHeader
        title="My account"
        description="Your profile, password and signed-in devices."
        className="mb-0 xl:col-span-2"
      />
      <ProfileSection />
      <SectionCard
        id="password"
        title="Password"
        description="Changing your password signs out every other device."
      >
        <ChangePasswordForm />
      </SectionCard>
      <SectionCard
        id="sessions"
        title="Signed-in devices"
        description="Devices that are currently signed in to your account."
        className="xl:col-span-2"
      >
        <SessionsList />
        <div className="border-t border-border pt-5">
          <LogoutEverywhere />
        </div>
      </SectionCard>
    </div>
  );
}
