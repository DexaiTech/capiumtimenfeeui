import { useState } from 'react';

import { Input } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, StaffPicker } from '@/features/team';
import { parsePounds, penceToPoundsInput } from '@/utils/money';

import type { BalanceFilters } from '../hooks/useBalanceFilters';

/** Written to the URL when the field is left, so typing does not refetch on every key. */
function MinBalanceInput({ filters }: { filters: BalanceFilters }) {
  const [error, setError] = useState<string | undefined>();

  const commit = (text: string) => {
    const value = text.trim();
    if (value === '') {
      setError(undefined);
      filters.setParam({ min: null });
      return;
    }
    const pence = parsePounds(value);
    if (pence === null || pence < 0) {
      setError('Enter an amount such as 250.00');
      return;
    }
    setError(undefined);
    filters.setParam({ min: pence > 0 ? penceToPoundsInput(pence) : null });
  };

  return (
    <Input
      // A cleared filter remounts the field with the text it now has.
      key={filters.minText}
      label="Owing at least (£)"
      inputMode="decimal"
      defaultValue={filters.minText}
      error={error}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit(event.currentTarget.value);
      }}
    />
  );
}

/** Client, partner, manager and a minimum balance: what narrows the debtors and the statements. */
export function BalanceFilterFields({ filters }: { filters: BalanceFilters }) {
  const { can } = useOrg();
  return (
    <>
      {can(P.clientRead) ? (
        <ClientPicker
          label="Client"
          clearable
          value={filters.client}
          onChange={(id) => filters.setParam({ client: id })}
        />
      ) : null}
      {can(P.memberRead) ? (
        <>
          <StaffPicker
            label="Partner"
            clearable
            value={filters.partner}
            onChange={(id) => filters.setParam({ partner: id })}
          />
          <StaffPicker
            label="Manager"
            clearable
            value={filters.manager}
            onChange={(id) => filters.setParam({ manager: id })}
          />
        </>
      ) : null}
      <MinBalanceInput filters={filters} />
    </>
  );
}
