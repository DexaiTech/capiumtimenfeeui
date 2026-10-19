import { DateRangeField } from '@/components/ui';
import { ClientPicker } from '@/features/clients';

export interface InvoiceFilterFieldsProps {
  clientId: string;
  from: string;
  to: string;
  /** The client lookup needs `client.read`. */
  canPickClient: boolean;
  onChange: (changes: { client?: string | null; from?: string | null; to?: string | null }) => void;
}

/** The controls of the invoice filter panel: client and issue-date range. */
export function InvoiceFilterFields({
  clientId,
  from,
  to,
  canPickClient,
  onChange,
}: InvoiceFilterFieldsProps) {
  return (
    <>
      {canPickClient ? (
        <ClientPicker
          label="Client"
          value={clientId || null}
          onChange={(client) => onChange({ client: client?.id ?? null })}
          listPlacement="inline"
        />
      ) : null}
      <DateRangeField
        label="Issue date"
        value={{ from: from || null, to: to || null }}
        onChange={(range) => onChange({ from: range.from, to: range.to })}
      />
    </>
  );
}
