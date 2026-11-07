import { ReportScreen } from '../components/ReportScreen';
import { vatSummaryReport } from '../definitions/vatSummary';

/** /:orgSlug/reports/vat-summary: output VAT by rate on invoices and credit notes. */
export default function VatSummaryReportPage() {
  return <ReportScreen config={vatSummaryReport} />;
}
