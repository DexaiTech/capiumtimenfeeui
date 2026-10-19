import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { ImportExportView } from '../components/importExport/ImportExportView';
import { NoAccess, SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/import-export`: what can be moved in and out of the application in bulk.
 * Clients can be exported (`client.read`) and imported (`client.create`); the rest is not
 * available from the API yet.
 */
export default function ImportExportPage() {
  const { can } = useOrg();
  useDocumentTitle('Import/Export');
  const allowed = [P.clientRead, P.clientCreate, P.dataImportExport, P.openingBalanceImport].some(
    (code) => can(code),
  );
  return (
    <SettingsSection title="Import/Export" description="Import and export staff, rates and jobs.">
      {allowed ? <ImportExportView /> : <NoAccess what="importing and exporting data" />}
    </SettingsSection>
  );
}
