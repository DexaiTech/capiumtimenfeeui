import { useState, type SyntheticEvent } from 'react';

import { Card, CardHeader, ErrorState, Skeleton, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';

import {
  usePracticeNotificationSettings,
  useSavePracticeNotificationSettings,
} from '../../api/hooks';
import { CHANNELS } from '../../constants';
import type { Channel, PracticeNotificationSettings, PracticeTypeChoice } from '../../types';
import { describeFailure } from '../../utils/errors';
import { SaveBar } from '../SaveBar';
import { ChannelMatrix, type MatrixRow } from './ChannelMatrix';

type Field = Channel | 'enabled';
type Edits = Record<string, Partial<Record<Field, boolean>>>;

function DefaultsForm({ settings }: { settings: PracticeNotificationSettings }) {
  const save = useSavePracticeNotificationSettings();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Edits>({});

  const valueOf = (type: string, field: Field, saved: boolean) => edits[type]?.[field] ?? saved;
  const choiceOf = (entry: PracticeNotificationSettings['types'][number]): PracticeTypeChoice => ({
    type: entry.type,
    enabled: valueOf(entry.type, 'enabled', entry.enabled),
    in_app: valueOf(entry.type, 'in_app', entry.in_app),
    email: valueOf(entry.type, 'email', entry.email),
    sms: valueOf(entry.type, 'sms', entry.sms),
  });

  const changed = settings.types.filter((entry) => {
    const choice = choiceOf(entry);
    return (
      choice.enabled !== entry.enabled ||
      CHANNELS.some((channel) => choice[channel.id] !== entry[channel.id])
    );
  });
  const dirty = changed.length > 0;

  const rows: MatrixRow[] = settings.types.map((entry) => {
    const choice = choiceOf(entry);
    return {
      type: entry.type,
      label: entry.label,
      description: entry.description,
      note: choice.enabled ? null : 'Switched off: nobody in the practice receives this.',
      values: { in_app: choice.in_app, email: choice.email, sms: choice.sms },
      enabled: choice.enabled,
      locked: !choice.enabled,
    };
  });

  const edit = (type: string, field: Field, checked: boolean) =>
    setEdits((previous) => ({ ...previous, [type]: { ...previous[type], [field]: checked } }));

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    // Only the kinds that changed; the others keep their settings.
    save.mutate(
      { types: changed.map(choiceOf) },
      {
        onSuccess: () => {
          setEdits({});
          toast({ tone: 'success', title: 'Practice notification settings saved' });
        },
        onError: (error) =>
          toast({
            tone: 'error',
            ...describeFailure(error, 'Could not save the practice notification settings'),
          }),
      },
    );
  };

  return (
    <Card padding="none">
      <CardHeader
        title="Practice defaults"
        description="Switch a kind of notification on or off for everyone, and choose what people get until they make their own choice."
      />
      <form onSubmit={submit} noValidate>
        <ChannelMatrix
          caption="Notification settings of the practice"
          firstColumn="Notification"
          rows={rows}
          disabled={save.isPending}
          onChannelChange={(type, channel, checked) => edit(type, channel, checked)}
          onEnabledChange={(type, enabled) => edit(type, 'enabled', enabled)}
        />
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          saveLabel="Save practice settings"
          onDiscard={() => setEdits({})}
        />
      </form>
    </Card>
  );
}

/**
 * The practice's switches and default channels (`GET/PUT /notification-settings/practice`).
 * Only rendered for a person with `organization.update` or `settings.manage`.
 */
export function PracticeDefaults() {
  const settings = usePracticeNotificationSettings(true);
  if (settings.isPending) {
    return (
      <Card padding="md" role="status" aria-label="Loading the practice notification settings">
        <Skeleton shape="rect" className="mb-4 h-5 w-48" />
        <Skeleton shape="rect" className="h-56 w-full" />
      </Card>
    );
  }
  if (settings.isError) {
    return (
      <Card padding="none">
        <ErrorState
          title="Could not load the practice notification settings"
          error={isApiError(settings.error) ? settings.error : null}
          onRetry={() => void settings.refetch()}
          retrying={settings.isRefetching}
        />
      </Card>
    );
  }
  return <DefaultsForm settings={settings.data} />;
}
