import { Download } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button, Popover, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';

import { useExportAuditLog } from '../api/hooks';
import { EXPORT_ROW_LIMIT } from '../constants';
import type { AuditExportFilters, ExportFormat } from '../types';
import { downloadBlob, exportFailure } from '../utils/download';

const FORMATS: ReadonlyArray<{ format: ExportFormat; label: string }> = [
  { format: 'csv', label: 'CSV (.csv)' },
  { format: 'xlsx', label: 'Excel (.xlsx)' },
];

export interface AuditExportMenuProps {
  /** The list's current filters: the file holds what the list shows. */
  filters: AuditExportFilters;
  /** There is nothing to export. */
  disabled?: boolean;
}

/**
 * The "Export" button of the audit log and the files it offers. The API refuses it without
 * `audit_log.export`; the page only shows it to people who hold it. The file holds the newest
 * entries that match the filters, at most `EXPORT_ROW_LIMIT`.
 */
export function AuditExportMenu({ filters, disabled = false }: AuditExportMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { organization } = useOrg();
  const { toast } = useToast();
  const exporter = useExportAuditLog();

  const run = async (format: ExportFormat) => {
    try {
      const blob = await exporter.mutateAsync({ format, filters });
      downloadBlob(`audit-log-${todayInZone(organization.timezone)}.${format}`, blob);
      toast({
        tone: 'success',
        title: 'Audit log exported',
        description: `The file holds the newest entries that match the filters, up to ${EXPORT_ROW_LIMIT.toLocaleString('en-GB')}.`,
      });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not export the audit log',
        description: exportFailure(error),
      });
    }
  };

  return (
    <>
      <Button
        ref={anchorRef}
        variant="brand-outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        loading={exporter.isPending}
        disabled={disabled}
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
                  void run(item.format);
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
