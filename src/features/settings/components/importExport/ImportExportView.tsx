import { Download, FileUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button, buttonClasses, Card, Tabs, useToast } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';

import { useExportClients } from '../../api/adminHooks';
import { downloadBlob } from '../../utils/download';
import { describeError } from '../../utils/errors';
import { ClientsImportDialog } from './ClientsImportDialog';
import { OpeningBalanceImportDialog } from './OpeningBalanceImportDialog';
import { StaffRatesJobsSection } from './StaffRatesJobsSection';

type ImportExportTab = 'clients' | 'opening-balances' | 'reports' | 'other';

const TABS: ReadonlyArray<{ value: ImportExportTab; label: string }> = [
  { value: 'clients', label: 'Clients' },
  { value: 'opening-balances', label: 'Opening Balances' },
  { value: 'reports', label: 'Reports & logs' },
  { value: 'other', label: 'Staff, rates & jobs' },
];

/** What a practice can move in and out of the application in bulk. */
export function ImportExportView() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const exporter = useExportClients();
  const [importing, setImporting] = useState(false);
  const [importingOpeningBalances, setImportingOpeningBalances] = useState(false);
  const [tab, setTab] = useState<ImportExportTab>('clients');
  const slug = organization.slug;
  const canExport = can(P.clientRead);
  const canImport = can(P.clientCreate);
  const canImportOpeningBalances = can(P.openingBalanceImport);

  const exportClients = () =>
    exporter.mutate(undefined, {
      onSuccess: (blob) => downloadBlob('clients.csv', blob),
      onError: (error) =>
        toast({ tone: 'error', ...describeError(error, 'Could not export the clients') }),
    });

  return (
    <>
      <Tabs
        label="Import/Export section"
        idBase="import-export"
        items={TABS}
        value={tab}
        onChange={setTab}
      />
      <div
        role="tabpanel"
        id={`import-export-panel-${tab}`}
        aria-labelledby={`import-export-tab-${tab}`}
      >
        {tab === 'clients' ? (
          <Card padding="lg" role="region" aria-label="Clients" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-text">Clients</h2>
              <p className="text-sm text-text-muted">
                Export every client that is not archived, as a CSV file, or add many clients at once
                from one. An import is checked first and creates nothing unless every row is valid.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                leftIcon={<Download aria-hidden="true" className="size-4" />}
                loading={exporter.isPending}
                disabled={!canExport}
                onClick={exportClients}
              >
                Export clients
              </Button>
              <Button
                variant="primary"
                leftIcon={<FileUp aria-hidden="true" className="size-4" />}
                disabled={!canImport}
                onClick={() => setImporting(true)}
              >
                Import clients
              </Button>
            </div>
            {canExport && canImport ? null : (
              <p className="text-sm text-text-muted">
                {canExport
                  ? 'Importing clients needs permission to create them.'
                  : canImport
                    ? 'Exporting clients needs permission to view them.'
                    : 'Importing and exporting clients need permission to view and to create them.'}
              </p>
            )}
          </Card>
        ) : null}

        {tab === 'opening-balances' ? (
          <Card
            padding="lg"
            role="region"
            aria-label="Opening Balances"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-text">Opening Balances</h2>
              <p className="text-sm text-text-muted">
                Import historic unbilled time from a client&apos;s previous system. Checked first;
                nothing is created unless every row is valid. Imported time is shown separately from
                newly recorded time, and can still be billed together with it.
              </p>
            </div>
            <div>
              <Button
                variant="primary"
                leftIcon={<FileUp aria-hidden="true" className="size-4" />}
                disabled={!canImportOpeningBalances}
                onClick={() => setImportingOpeningBalances(true)}
              >
                Import historic time
              </Button>
            </div>
            {canImportOpeningBalances ? null : (
              <p className="text-sm text-text-muted">
                Importing opening balances needs the opening balance import permission.
              </p>
            )}
          </Card>
        ) : null}

        {tab === 'reports' ? (
          <Card
            padding="lg"
            role="region"
            aria-label="Reports and logs"
            className="flex flex-col gap-3"
          >
            <h2 className="text-base font-semibold text-text">Reports and logs</h2>
            <p className="text-sm text-text-muted">
              Every report downloads as CSV, Excel or PDF from its own page, and the audit log
              exports the changes it lists.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to={routes.org.module(slug, 'reports')} className={buttonClasses({})}>
                Go to the reports
              </Link>
              <Link
                to={routes.org.module(slug, 'settings', 'audit-logs')}
                className={buttonClasses({})}
              >
                Go to the audit log
              </Link>
            </div>
          </Card>
        ) : null}

        {tab === 'other' ? <StaffRatesJobsSection /> : null}
      </div>

      <ClientsImportDialog open={importing} onClose={() => setImporting(false)} />
      <OpeningBalanceImportDialog
        open={importingOpeningBalances}
        onClose={() => setImportingOpeningBalances(false)}
      />
    </>
  );
}
