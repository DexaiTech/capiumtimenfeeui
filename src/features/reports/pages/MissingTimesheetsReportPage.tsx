import { ReportScreen } from '../components/ReportScreen';
import { missingTimesheetsReport } from '../definitions/missingTimesheets';

/** /:orgSlug/reports/missing-timesheets: Who has not recorded or submitted time. */
export default function MissingTimesheetsReportPage() {
  return <ReportScreen config={missingTimesheetsReport} />;
}
