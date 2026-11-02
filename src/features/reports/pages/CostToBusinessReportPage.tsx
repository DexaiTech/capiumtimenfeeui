import { ReportScreen } from '../components/ReportScreen';
import { costToBusinessReport } from '../definitions/costToBusiness';

/** /:orgSlug/reports/cost-to-business: what the work cost the practice against the invoices. */
export default function CostToBusinessReportPage() {
  return <ReportScreen config={costToBusinessReport} />;
}
