import { ReportScreen } from '../components/ReportScreen';
import { jobProfitabilityReport } from '../definitions/jobProfitability';

/** /:orgSlug/reports/job-profitability: Billed value, cost and margin per job. */
export default function JobProfitabilityReportPage() {
  return <ReportScreen config={jobProfitabilityReport} />;
}
