import { useRef } from 'react';
import type { UseFormGetValues, UseFormSetValue } from 'react-hook-form';

import { parsePounds, penceToPoundsInput } from '@/utils/money';

import type { LineValues } from '../schemas/line';
import { vatInGross, vatOnNet } from '../utils/amounts';

export interface AmountFieldsOptions {
  getValues: UseFormGetValues<LineValues>;
  setValue: UseFormSetValue<LineValues>;
  /** The rate (basis points) of a VAT code id; null when it is not known (yet). */
  rateBpOf: (vatRateId: string) => number | null;
  /** The VAT field holds a value that must be sent (a line whose VAT is not the rate's). */
  initialVatTouched?: boolean;
  /** The person already chose the VAT code, so a new type must not replace it. */
  initialVatCodeTouched?: boolean;
  /** The person already set "billable", so a new type or client must not change it. */
  initialBillableTouched?: boolean;
}

const read = (text: string): number | null => {
  const pence = parsePounds(text);
  return pence !== null && pence >= 0 ? pence : null;
};

/**
 * The net, VAT and gross fields of a line, linked the way a person expects: typing the net
 * works out the VAT and the gross, typing the gross works out the VAT contained in it and the
 * net, typing the VAT keeps the other of the two and moves the gross or the net. A change of
 * the VAT code works the VAT out again. The API repeats the sums and has the last word; these
 * refs tell the form what to send (`utils/lineBody`).
 */
export function useAmountFields({
  getValues,
  setValue,
  rateBpOf,
  initialVatTouched = false,
  initialVatCodeTouched = false,
  initialBillableTouched = false,
}: AmountFieldsOptions) {
  const anchor = useRef<'net' | 'gross'>('net');
  const amountsTouched = useRef(false);
  const vatTouched = useRef(initialVatTouched);
  const vatCodeTouched = useRef(initialVatCodeTouched);
  const billableTouched = useRef(initialBillableTouched);

  const write = (field: 'net' | 'vat' | 'gross', pence: number | null) => {
    setValue(field, pence === null ? '' : penceToPoundsInput(pence));
  };

  const refresh = () => {
    const values = getValues();
    const rate = rateBpOf(values.vat_rate_id) ?? 0;
    if (anchor.current === 'net') {
      const net = read(values.net);
      if (net === null) {
        write('gross', null);
        if (!vatTouched.current) write('vat', null);
        return;
      }
      const vat = vatTouched.current ? (read(values.vat) ?? 0) : vatOnNet(net, rate);
      if (!vatTouched.current) write('vat', vat);
      write('gross', net + vat);
      return;
    }
    const gross = read(values.gross);
    if (gross === null) {
      write('net', null);
      if (!vatTouched.current) write('vat', null);
      return;
    }
    const vat = vatTouched.current
      ? Math.min(read(values.vat) ?? 0, gross)
      : vatInGross(gross, rate);
    if (!vatTouched.current) write('vat', vat);
    write('net', gross - vat);
  };

  return {
    anchor,
    amountsTouched,
    vatTouched,
    vatCodeTouched,
    billableTouched,
    /** The person chose the VAT code (miles: the VAT is not typed, only the code). */
    markVatCode: () => {
      vatCodeTouched.current = true;
    },
    /** The person chose the VAT code: the VAT is worked out again from the amount typed last. */
    onVatCodeChange: () => {
      vatCodeTouched.current = true;
      vatTouched.current = false;
      refresh();
    },
    markBillable: () => {
      billableTouched.current = true;
    },
    onNetChange: () => {
      anchor.current = 'net';
      amountsTouched.current = true;
      refresh();
    },
    onGrossChange: () => {
      anchor.current = 'gross';
      amountsTouched.current = true;
      refresh();
    },
    onVatChange: () => {
      vatTouched.current = true;
      amountsTouched.current = true;
      refresh();
    },
    /** A new VAT code (or type): the VAT is worked out again from the amount typed last. */
    onRateChange: () => {
      vatTouched.current = false;
      refresh();
    },
    /** Starts over (the type changed between mileage and money): nothing typed yet. */
    clear: () => {
      anchor.current = 'net';
      amountsTouched.current = false;
      vatTouched.current = false;
      write('net', null);
      write('vat', null);
      write('gross', null);
    },
  };
}
