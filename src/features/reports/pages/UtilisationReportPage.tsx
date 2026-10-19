import { ReportScreen } from '../components/ReportScreen';
import { utilisationReport } from '../definitions/utilisation';

/** /:orgSlug/reports/utilisation: Chargeable hours against capacity and target. */
export default function UtilisationReportPage() {
  return <ReportScreen config={utilisationReport} />;
}
