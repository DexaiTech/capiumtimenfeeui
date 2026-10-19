import { useState, type SyntheticEvent } from 'react';

import { Card, CardHeader, ErrorState, Input, Skeleton, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useNotificationSettings, useSaveNotificationSettings } from '../../api/hooks';
import { CHANNELS, SMS_NUMBER_MAX_LENGTH } from '../../constants';
import type {
  Channel,
  NotificationSettings,
  NotificationSettingsUpdate,
  PreferenceChoice,
} from '../../types';
import { describeFailure, fieldDetails } from '../../utils/errors';
import { SaveBar } from '../SaveBar';
import { ChannelMatrix, type MatrixRow } from './ChannelMatrix';

type Edits = Record<string, Partial<Record<Channel, boolean>>>;

function PreferencesForm({ settings }: { settings: NotificationSettings }) {
  const save = useSaveNotificationSettings();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Edits>({});
  // Null until the person types in the field: then the number on file is shown and left alone.
  const [typedNumber, setTypedNumber] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);

  const valueOf = (type: string, channel: Channel, saved: boolean) =>
    edits[type]?.[channel] ?? saved;

  const changed = settings.preferences.filter((pref) =>
    CHANNELS.some(
      (channel) => valueOf(pref.type, channel.id, pref[channel.id]) !== pref[channel.id],
    ),
  );
  const numberText = typedNumber ?? settings.sms_number ?? '';
  const numberChanged = typedNumber !== null && typedNumber.trim() !== (settings.sms_number ?? '');
  const dirty = changed.length > 0 || numberChanged;

  const rows: MatrixRow[] = settings.preferences.map((pref) => ({
    type: pref.type,
    label: pref.label,
    description: pref.description,
    note: !pref.enabled
      ? 'Switched off by your practice: nothing is sent, whatever you choose.'
      : pref.customised || edits[pref.type]
        ? null
        : 'Using the practice default.',
    values: {
      in_app: valueOf(pref.type, 'in_app', pref.in_app),
      email: valueOf(pref.type, 'email', pref.email),
      sms: valueOf(pref.type, 'sms', pref.sms),
    },
    locked: !pref.enabled,
  }));

  const discard = () => {
    setEdits({});
    setTypedNumber(null);
    setNumberError(null);
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setNumberError(null);
    const body: NotificationSettingsUpdate = {};
    if (changed.length > 0) {
      // Only the kinds the person changed: the rest keep following the practice's default.
      body.preferences = changed.map((pref): PreferenceChoice => ({
        type: pref.type,
        in_app: valueOf(pref.type, 'in_app', pref.in_app),
        email: valueOf(pref.type, 'email', pref.email),
        sms: valueOf(pref.type, 'sms', pref.sms),
      }));
    }
    if (numberChanged) body.sms_number = numberText.trim() === '' ? null : numberText.trim();
    save.mutate(body, {
      onSuccess: () => {
        discard();
        toast({ tone: 'success', title: 'Notification settings saved' });
      },
      onError: (error) => {
        const details = fieldDetails(error);
        const forNumber = details.find((detail) => detail.field === 'sms_number');
        if (forNumber) setNumberError(forNumber.message);
        if (!forNumber || details.length > 1) {
          toast({
            tone: 'error',
            ...describeFailure(error, 'Could not save your notification settings'),
          });
        }
      },
    });
  };

  return (
    <Card padding="none">
      <CardHeader
        title="Your notifications"
        description="Choose how each kind of notification reaches you in this practice."
      />
      <form onSubmit={submit} noValidate>
        <ChannelMatrix
          caption="Your notification choices"
          firstColumn="Notification"
          rows={rows}
          disabled={save.isPending}
          onChannelChange={(type, channel, checked) =>
            setEdits((previous) => ({
              ...previous,
              [type]: { ...previous[type], [channel]: checked },
            }))
          }
        />
        <div className="border-t border-row-border px-5 py-4">
          <Input
            label="Mobile number for SMS"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={SMS_NUMBER_MAX_LENGTH}
            className="max-w-sm"
            value={numberText}
            disabled={save.isPending}
            error={numberError ?? undefined}
            hint="Used for every notification with SMS switched on. Include the country code, for example +44 7700 900123. Leave it empty to stop SMS."
            onChange={(event) => {
              setTypedNumber(event.target.value);
              setNumberError(null);
            }}
          />
        </div>
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          saveLabel="Save changes"
          onDiscard={discard}
        />
      </form>
    </Card>
  );
}

/** The signed-in person's own notification choices (`GET/PUT /notification-settings`). */
export function OwnPreferences() {
  const settings = useNotificationSettings();
  if (settings.isPending) {
    return (
      <Card padding="md" role="status" aria-label="Loading your notification settings">
        <Skeleton shape="rect" className="mb-4 h-5 w-48" />
        <Skeleton shape="rect" className="h-56 w-full" />
      </Card>
    );
  }
  if (settings.isError) {
    return (
      <Card padding="none">
        <ErrorState
          title="Could not load your notification settings"
          error={isApiError(settings.error) ? settings.error : null}
          onRetry={() => void settings.refetch()}
          retrying={settings.isRefetching}
        />
      </Card>
    );
  }
  return <PreferencesForm settings={settings.data} />;
}
