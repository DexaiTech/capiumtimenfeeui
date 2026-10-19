import { ReportScreen } from '../components/ReportScreen';
import { expensesReport } from '../definitions/expenses';

/** /:orgSlug/reports/expenses: Expenses and disbursements by type, client and person. */
export default function ExpensesReportPage() {
  return <ReportScreen config={expensesReport} />;
}
