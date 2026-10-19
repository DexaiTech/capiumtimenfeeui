import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { CHANNELS } from '../../constants';
import type { Channel } from '../../types';

export interface MatrixRow {
  type: string;
  label: string;
  description: string;
  /** Extra text under the description (for example "Switched off by your practice"). */
  note?: ReactNode;
  values: Record<Channel, boolean>;
  /** Draws the channel boxes disabled (the type is off, or the row may not be changed). */
  locked?: boolean;
  /** For the practice's matrix: whether the type is switched on. Left out for a person's own. */
  enabled?: boolean;
}

export interface ChannelMatrixProps {
  /** Accessible name of the table. */
  caption: string;
  /** Heading of the first column. */
  firstColumn: string;
  rows: ReadonlyArray<MatrixRow>;
  onChannelChange: (type: string, channel: Channel, checked: boolean) => void;
  /** Shows the "On" column; needs `onEnabledChange`. */
  onEnabledChange?: (type: string, enabled: boolean) => void;
  /** Disables every box, for example while saving. */
  disabled?: boolean;
}

const box = 'size-4.5 cursor-pointer rounded-sm accent-primary disabled:cursor-not-allowed';

/** Notification types in rows, channels in columns, one checkbox in each cell. */
export function ChannelMatrix({
  caption,
  firstColumn,
  rows,
  onChannelChange,
  onEnabledChange,
  disabled = false,
}: ChannelMatrixProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-y border-border bg-surface-sunken text-left text-xs font-semibold text-text-muted">
            <th scope="col" className="px-5 py-2.5 font-semibold">
              {firstColumn}
            </th>
            {onEnabledChange ? (
              <th scope="col" className="w-20 px-2 py-2.5 text-center font-semibold">
                On
              </th>
            ) : null}
            {CHANNELS.map((channel) => (
              <th
                key={channel.id}
                scope="col"
                className="w-20 px-2 py-2.5 text-center font-semibold"
              >
                {channel.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.type} className="border-b border-row-border last:border-b-0">
              <th scope="row" className="px-5 py-3 text-left align-top font-normal">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-text">{row.label}</span>
                  <span className="text-xs text-text-muted">{row.description}</span>
                  {row.note ? <span className="text-xs text-text-subtle">{row.note}</span> : null}
                </span>
              </th>
              {onEnabledChange ? (
                <td className="px-2 py-3 text-center align-top">
                  <input
                    type="checkbox"
                    aria-label={`${row.label}: switched on for the practice`}
                    checked={row.enabled ?? true}
                    disabled={disabled}
                    onChange={(event) => onEnabledChange(row.type, event.target.checked)}
                    className={box}
                  />
                </td>
              ) : null}
              {CHANNELS.map((channel) => (
                <td key={channel.id} className="px-2 py-3 text-center align-top">
                  <input
                    type="checkbox"
                    aria-label={`${row.label}: ${channel.label}`}
                    checked={row.values[channel.id]}
                    disabled={disabled || row.locked}
                    onChange={(event) =>
                      onChannelChange(row.type, channel.id, event.target.checked)
                    }
                    className={cn(box, row.locked && 'opacity-55')}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
