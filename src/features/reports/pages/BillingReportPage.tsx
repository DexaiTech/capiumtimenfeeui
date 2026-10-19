import { ReportScreen } from '../components/ReportScreen';
import { billingReport } from '../definitions/billing';

/** /:orgSlug/reports/billing: Invoices, credit notes and receipts over time. */
export default function BillingReportPage() {
  return <ReportScreen config={billingReport} />;
}
