import { Download } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button, Popover } from '@/components/ui';

import type { ExportFormat } from '../types';

const FORMATS: ReadonlyArray<{ format: ExportFormat; label: string }> = [
  { format: 'csv', label: 'CSV (.csv)' },
  { format: 'xlsx', label: 'Excel (.xlsx)' },
];

export interface ExportMenuProps {
  onExport: (format: ExportFormat) => void;
  /** An export is being made. */
  busy: boolean;
  /** The caller holds `report.export`; without it every download is refused by the API. */
  allowed: boolean;
  /** There is nothing to export. */
  empty: boolean;
}

/** The "Export" button of a report and the files it offers. */
export function ExportMenu({ onExport, busy, allowed, empty }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={anchorRef}
        variant="brand-outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        loading={busy}
        disabled={!allowed || empty}
        title={allowed ? undefined : 'Exporting reports needs the export permission'}
        leftIcon={<Download aria-hidden="true" className="size-4" />}
        onClick={() => setOpen((value) => !value)}
      >
        Export
      </Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Export format"
        align="end"
        className="w-52 p-1.5"
      >
        <ul className="flex flex-col">
          {FORMATS.map((item) => (
            <li key={item.format}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center rounded-sm px-2.5 text-left text-xs font-medium text-text hover:bg-surface-hover md:min-h-8"
                onClick={() => {
                  setOpen(false);
                  onExport(item.format);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}
