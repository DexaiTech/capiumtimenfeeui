import { FileDown } from 'lucide-react';
import { useState } from 'react';

import { Button, SegmentedControl, useToast } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { fetchStatementPdf } from '../../api';
import { downloadBlob } from '../../format';
import { describeError } from '../errors';
import { isoDateParam } from '../records/urlFilters';
import { SummaryStrip } from '../records/SummaryStrip';
import type { ClientOverview } from '../types';
import { CreditNotesView } from './CreditNotesView';
import { InvoicesView } from './InvoicesView';

type View = 'invoices' | 'credit-notes';

const VIEWS = [
  { value: 'invoices', label: 'Invoices' },
  { value: 'credit-notes', label: 'Credit notes' },
] as const;

export interface InvoicesTabProps {
  clientId: string;
  clientCode: string;
  clientName: string;
  overview: ClientOverview | undefined;
}

/**
 * The client's billing documents: invoices and credit notes (`invoice.read`), the outstanding and
 * overdue totals from the overview and, with `payment.read`, the statement as a PDF for the
 * dates picked (all dates when none is).
 */
export function InvoicesTab({ clientId, clientCode, clientName, overview }: InvoicesTabProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const [downloading, setDownloading] = useState(false);
  const view: View = params.get('view') === 'credit-notes' ? 'credit-notes' : 'invoices';
  const currency = organization.currency;
  const invoices = overview?.invoices;

  const downloadStatement = async () => {
    setDownloading(true);
    try {
      const blob = await fetchStatementPdf(organization.id, clientId, {
        from: isoDateParam(params.get('from')),
        to: isoDateParam(params.get('to')),
      });
      downloadBlob(`statement-${clientCode}.pdf`, blob);
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not download the statement',
        description: describeError(error).message,
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {invoices ? (
        <SummaryStrip
          label="Invoice totals"
          items={[
            { label: 'Invoices', value: String(invoices.count) },
            { label: 'Outstanding', value: formatMoney(invoices.outstanding, currency) },
            {
              label: 'Overdue',
              value: formatMoney(invoices.overdue, currency),
              alert: invoices.overdue > 0,
            },
            {
              label: 'Billed this year',
              value: formatMoney(invoices.billed_ytd, currency),
              hint: `Net, since ${formatUkDate(overview?.ytd_from)}`,
            },
          ]}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Show"
          options={VIEWS}
          value={view}
          onChange={(next) =>
            setParam({
              view: next === 'invoices' ? null : next,
              q: null,
              status: null,
              from: null,
              to: null,
            })
          }
        />
        {can(P.paymentRead) ? (
          <Button
            leftIcon={<FileDown aria-hidden="true" className="size-4" />}
            loading={downloading}
            onClick={() => void downloadStatement()}
          >
            Statement (PDF)
          </Button>
        ) : null}
      </div>
      {view === 'credit-notes' ? (
        <CreditNotesView key={view} clientId={clientId} clientName={clientName} />
      ) : (
        <InvoicesView key={view} clientId={clientId} clientName={clientName} />
      )}
    </div>
  );
}
