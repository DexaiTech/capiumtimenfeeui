import type { Channel } from './types';

/** How often the bell asks for the unread count (and again whenever the window is focused). */
export const UNREAD_POLL_MS = 60_000;

/** Notifications per page of the bell's list. */
export const BELL_PAGE_SIZE = 20;

/** Wait after the last keystroke before the template preview is asked for. */
export const PREVIEW_DELAY_MS = 500;

export const CHANNELS: ReadonlyArray<{ id: Channel; label: string }> = [
  { id: 'in_app', label: 'In-app' },
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
];

/** The SMS number input accepts what people type; the API normalises and validates it. */
export const SMS_NUMBER_MAX_LENGTH = 40;
