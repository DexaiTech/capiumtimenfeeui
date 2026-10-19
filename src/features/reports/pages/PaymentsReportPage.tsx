import { ReportScreen } from '../components/ReportScreen';
import { paymentsReport } from '../definitions/payments';

/** /:orgSlug/reports/payments: Receipts by method, client and period. */
export default function PaymentsReportPage() {
  return <ReportScreen config={paymentsReport} />;
}
