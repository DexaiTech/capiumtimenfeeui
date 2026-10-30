import { ReportScreen } from '../components/ReportScreen';
import { recoveryAnalysisReport } from '../definitions/recoveryAnalysis';

/** /:orgSlug/reports/recovery-analysis: invoice value against task rate, staff rates, cost plus. */
export default function RecoveryAnalysisReportPage() {
  return <ReportScreen config={recoveryAnalysisReport} />;
}
