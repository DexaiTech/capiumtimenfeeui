import { ReportScreen } from '../components/ReportScreen';
import { wipAgeingReport } from '../definitions/wipAgeing';

/** /:orgSlug/reports/wip-ageing: Work in progress with its age. */
export default function WipAgeingReportPage() {
  return <ReportScreen config={wipAgeingReport} />;
}
