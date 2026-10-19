import type { AuthPayload } from '@/types/models';

export type SessionEndReason = 'expired' | 'logout';

export type ChannelMessage =
  | { type: 'session'; auth: AuthPayload }
  | { type: 'ended'; reason: SessionEndReason }
  | { type: 'refresh-started' };

const CHANNEL_NAME = 'capium-auth';

let channel: BroadcastChannel | null | undefined;
const handlers = new Set<(message: ChannelMessage) => void>();

function isChannelMessage(value: unknown): value is ChannelMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  const type = value.type;
  return type === 'session' || type === 'ended' || type === 'refresh-started';
}

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  if (typeof BroadcastChannel === 'undefined') {
    channel = null;
    return channel;
  }
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (!isChannelMessage(event.data)) return;
    for (const handler of handlers) handler(event.data);
  };
  // Node's implementation (used under test) would otherwise keep the process alive.
  (channel as BroadcastChannel & { unref?: () => void }).unref?.();
  return channel;
}

/** Tells the other tabs of this origin about a session change. */
export function publish(message: ChannelMessage): void {
  try {
    getChannel()?.postMessage(message);
  } catch {
    // A closed or unsupported channel only costs cross-tab sync; the server's grace window covers it.
  }
}

export function onChannelMessage(handler: (message: ChannelMessage) => void): () => void {
  getChannel();
  handlers.add(handler);
  return () => handlers.delete(handler);
}
