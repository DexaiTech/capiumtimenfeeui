import { Image as ImageIcon } from 'lucide-react';

import { Badge } from '@/components/ui';
import type { Organization } from '@/types/organization';
import { cn } from '@/utils/cn';
import { addDays, formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import type { InvoiceLayout } from '../../billingTypes';
import { sampleInvoice, SAMPLE_VAT_BP } from '../../utils/templates';

/** What the preview takes from the practice: its letterhead and bank details. */
export type PreviewPractice = Pick<
  Organization,
  | 'name'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'postcode'
  | 'vat_registered'
  | 'vat_number'
  | 'bank_details'
  | 'payment_terms_days'
  | 'currency'
>;

export interface InvoicePreviewProps {
  layout: InvoiceLayout;
  showLogo: boolean;
  showBankDetails: boolean;
  footerText: string;
  practice: PreviewPractice;
}

const SAMPLE_ISSUE_DATE = '2026-10-01';
const SAMPLE_NUMBER = 'INV-00042';
/** Columns of numbers are right-aligned. */
const NUMERIC_COLUMNS = new Set(['Qty', 'Time', 'Net']);

/**
 * A static mock of an invoice drawn from the template's settings and made-up lines: which
 * layout the lines take, whether the logo and bank details are printed, and the footer. HTML
 * and CSS tokens only; the PDF is not involved.
 */
export function InvoicePreview({
  layout,
  showLogo,
  showBankDetails,
  footerText,
  practice,
}: InvoicePreviewProps) {
  const invoice = sampleInvoice(layout, practice.currency);
  const vatBp = practice.vat_registered ? SAMPLE_VAT_BP : 0;
  const vat = Math.round((invoice.net * vatBp) / 10_000);
  const money = (pence: number) => formatMoney(pence, practice.currency);
  const address = [practice.address_line1, practice.address_line2, practice.city, practice.postcode]
    .filter(Boolean)
    .join('\n');
  const footer = footerText.trim();

  return (
    <section aria-label="Invoice preview" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-text">Preview</h3>
        <Badge tone="grey" size="sm">
          Sample data
        </Badge>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 text-2xs text-text shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {showLogo ? (
              <div
                role="img"
                aria-label="Practice logo"
                className="flex h-8 w-16 items-center justify-center gap-1 rounded-sm border border-dashed border-border-strong text-text-subtle"
              >
                <ImageIcon aria-hidden="true" className="size-3" />
                Logo
              </div>
            ) : null}
            <p className="text-xs font-semibold break-words">{practice.name}</p>
            {address ? (
              <p className="break-words whitespace-pre-line text-text-muted">{address}</p>
            ) : null}
            {practice.vat_registered && practice.vat_number ? (
              <p className="text-text-muted">VAT no. {practice.vat_number}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
            <p className="text-sm font-semibold tracking-wide uppercase">Invoice</p>
            <dl className="grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5">
              <dt className="text-text-muted">Number</dt>
              <dd>{SAMPLE_NUMBER}</dd>
              <dt className="text-text-muted">Date</dt>
              <dd>{formatUkDate(SAMPLE_ISSUE_DATE)}</dd>
              <dt className="text-text-muted">Due</dt>
              <dd>{formatUkDate(addDays(SAMPLE_ISSUE_DATE, practice.payment_terms_days))}</dd>
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="font-medium text-text-muted">Bill to</p>
          <p className="font-semibold">Sample Client Ltd</p>
          <p className="text-text-muted">12 Example Road, London EC2A 4NE</p>
        </div>

        <table className="w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">Sample invoice lines</caption>
          <thead>
            <tr>
              {invoice.head.map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={cn(
                    'border-b border-border py-1 pr-2 font-medium text-text-muted',
                    NUMERIC_COLUMNS.has(heading) && 'text-right',
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, index) => (
                  <td
                    key={invoice.head[index] ?? index}
                    className={cn(
                      'border-b border-row-border py-1 pr-2 align-top',
                      NUMERIC_COLUMNS.has(invoice.head[index] ?? '') && 'text-right tabular-nums',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right tabular-nums">
          <dt className="text-text-muted">Net</dt>
          <dd>{money(invoice.net)}</dd>
          <dt className="text-text-muted">VAT ({vatBp / 100}%)</dt>
          <dd>{money(vat)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="font-semibold">{money(invoice.net + vat)}</dd>
        </dl>

        {showBankDetails ? (
          <div className="flex flex-col gap-0.5 rounded-sm bg-surface-sunken p-2">
            <p className="font-medium text-text-muted">Bank details</p>
            {practice.bank_details ? (
              <p className="break-words whitespace-pre-line">{practice.bank_details}</p>
            ) : (
              <p className="text-text-subtle italic">The bank details of the practice settings</p>
            )}
          </div>
        ) : null}

        <div className="border-t border-border pt-2">
          {footer ? (
            <p className="break-words whitespace-pre-line text-text-muted">{footer}</p>
          ) : (
            <p className="text-text-subtle italic">The footer text appears here</p>
          )}
        </div>
      </div>

      <p className="text-xs text-text-muted">
        This preview uses sample data. The PDF renderer will apply the template when issued invoices
        are drawn; until it does, invoice PDFs still use the practice letterhead and footer.
      </p>
    </section>
  );
}
