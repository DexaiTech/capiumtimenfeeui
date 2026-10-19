import { RecordHistory } from '@/features/audit';

export interface HistoryTabProps {
  clientId: string;
}

/**
 * Everything that happened to the client, newest first: changes to the client itself and, with
 * them, the entries that name it (contacts, services, rates, jobs, time, invoices, payments).
 * The tab is shown to people who hold `audit_log.read`.
 */
export function HistoryTab({ clientId }: HistoryTabProps) {
  return <RecordHistory targetType="client" targetId={clientId} title="Client history" includeRelated />;
}
