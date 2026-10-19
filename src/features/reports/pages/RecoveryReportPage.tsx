import { ReportScreen } from '../components/ReportScreen';
import { recoveryReport } from '../definitions/recovery';

/** /:orgSlug/reports/recovery: How much of the work done was billed. */
export default function RecoveryReportPage() {
  return <ReportScreen config={recoveryReport} />;
}
