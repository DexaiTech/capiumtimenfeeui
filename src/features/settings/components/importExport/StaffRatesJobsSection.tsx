import { Download, FileUp } from 'lucide-react';
import { useState } from 'react';

import { Button, Card, useToast } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';

import {
  useExportJobs,
  useExportRates,
  useExportStaff,
  useImportJobs,
  useImportRates,
  useImportStaff,
} from '../../api/adminHooks';
import { JOBS_IMPORT, RATES_IMPORT, STAFF_IMPORT } from '../../utils/bulkImport';
import { downloadBlob } from '../../utils/download';
import { describeError } from '../../utils/errors';
import { BulkImportDialog } from './BulkImportDialog';

interface SectionProps {
  /** Heading and region name. */
  title: string;
  description: string;
  /** What the export button says, and the file it saves. */
  exportLabel: string;
  importLabel: string;
  canExport: boolean;
  canImport: boolean;
  /** Why a button is disabled: the permission each needs, besides import/export. */
  exportNeeds: string;
  importNeeds: string;
  exporting: boolean;
  onExport: () => void;
  onImport: () => void;
}

/** Why a button is disabled, or null when both work. */
function reasonFor(
  { canExport, canImport, exportNeeds, importNeeds }: SectionProps,
  allowed: boolean,
) {
  if (canExport && canImport) return null;
  if (!allowed) return 'Importing and exporting need the import and export permission.';
  if (canExport) return `Importing needs permission ${importNeeds}.`;
  if (canImport) return `Exporting needs permission ${exportNeeds}.`;
  return `Importing needs permission ${importNeeds}, and exporting needs permission ${exportNeeds}.`;
}

function Section(props: SectionProps & { allowed: boolean }) {
  const reason = reasonFor(props, props.allowed);
  return (
    <section
      aria-label={props.title}
      className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-text">{props.title}</h3>
        <p className="text-sm text-text-muted">{props.description}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          leftIcon={<Download aria-hidden="true" className="size-4" />}
          loading={props.exporting}
          disabled={!props.canExport}
          onClick={props.onExport}
        >
          {props.exportLabel}
        </Button>
        <Button
          variant="primary"
          leftIcon={<FileUp aria-hidden="true" className="size-4" />}
          disabled={!props.canImport}
          onClick={props.onImport}
        >
          {props.importLabel}
        </Button>
      </div>
      {reason ? <p className="text-sm text-text-muted">{reason}</p> : null}
    </section>
  );
}

/** Staff, rates and jobs: a CSV export and a checked, all-or-nothing CSV import of each. */
export function StaffRatesJobsSection() {
  const { can } = useOrg();
  const { toast } = useToast();
  const [importing, setImporting] = useState<'staff' | 'rates' | 'jobs' | null>(null);
  const staffExport = useExportStaff();
  const ratesExport = useExportRates();
  const jobsExport = useExportJobs();
  const staffImport = useImportStaff();
  const ratesImport = useImportRates();
  const jobsImport = useImportJobs();
  const allowed = can(P.dataImportExport);

  const download = (
    exporter: { mutate: typeof staffExport.mutate },
    file: string,
    failure: string,
  ) =>
    exporter.mutate(undefined, {
      onSuccess: (blob) => downloadBlob(file, blob),
      onError: (error) => toast({ tone: 'error', ...describeError(error, failure) }),
    });

  const close = () => setImporting(null);

  return (
    <Card
      padding="lg"
      role="region"
      aria-label="Staff, rates and jobs"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text">Staff, rates and jobs</h2>
        <p className="text-sm text-text-muted">
          Export each as a CSV file, or add many at once from one. An import is checked first and
          creates nothing unless every row is valid. Importing only adds records; it never changes
          existing ones.
        </p>
      </div>
      <Section
        title="Staff"
        description="Staff members with their grade, hours and approver, and optionally their cost and charge-out rates."
        exportLabel="Export staff (CSV)"
        importLabel="Import staff"
        allowed={allowed}
        canExport={allowed && can(P.memberRead)}
        canImport={allowed && can(P.memberInvite)}
        exportNeeds="to view staff"
        importNeeds="to add staff"
        exporting={staffExport.isPending}
        onExport={() => download(staffExport, 'staff.csv', 'Could not export the staff')}
        onImport={() => setImporting('staff')}
      />
      <Section
        title="Rates"
        description="Every cost and charge-out rate rule, whether set for a staff member, a grade, a client or a service."
        exportLabel="Export rates (CSV)"
        importLabel="Import rates"
        allowed={allowed}
        canExport={allowed && can(P.rateRead)}
        canImport={allowed && can(P.rateManage)}
        exportNeeds="to view rates"
        importNeeds="to manage rates"
        exporting={ratesExport.isPending}
        onExport={() => download(ratesExport, 'rates.csv', 'Could not export the rates')}
        onImport={() => setImporting('rates')}
      />
      <Section
        title="Jobs"
        description="Jobs with their client, service, billing, budget, dates and people. Job numbers come from the job numbering."
        exportLabel="Export jobs (CSV)"
        importLabel="Import jobs"
        allowed={allowed}
        canExport={allowed && can(P.jobRead)}
        canImport={allowed && can(P.jobCreate)}
        exportNeeds="to view jobs"
        importNeeds="to create jobs"
        exporting={jobsExport.isPending}
        onExport={() => download(jobsExport, 'jobs.csv', 'Could not export the jobs')}
        onImport={() => setImporting('jobs')}
      />

      <BulkImportDialog
        open={importing === 'staff'}
        onClose={close}
        kind={STAFF_IMPORT}
        importer={staffImport}
      />
      <BulkImportDialog
        open={importing === 'rates'}
        onClose={close}
        kind={RATES_IMPORT}
        importer={ratesImport}
        closePreviousLabel="End the earlier rate the day before a new one starts, instead of reporting an overlap"
      />
      <BulkImportDialog
        open={importing === 'jobs'}
        onClose={close}
        kind={JOBS_IMPORT}
        importer={jobsImport}
      />
    </Card>
  );
}
