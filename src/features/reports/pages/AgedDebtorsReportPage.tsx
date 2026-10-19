import { ReportScreen } from '../components/ReportScreen';
import { agedDebtorsReport } from '../definitions/agedDebtors';

/** /:orgSlug/reports/aged-debtors: Outstanding balances by how late they are. */
export default function AgedDebtorsReportPage() {
  return <ReportScreen config={agedDebtorsReport} />;
}
