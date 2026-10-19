import { DateRangeField } from '@/components/ui';
import { useUrlParams } from '@/hooks';

export interface DateRangeFilterProps {
  /** Names the range for assistive technology and in front of the inputs: "Date", "Issue date". */
  label: string;
  /** The date range as the URL holds it. */
  from: string;
  to: string;
}

/** The date range of a tab, kept in the URL (`?from=&to=`). */
export function DateRangeFilter({ label, from, to }: DateRangeFilterProps) {
  const { setParam } = useUrlParams();
  return (
    <DateRangeField
      label={label}
      hideLabel
      prefix={label}
      value={{ from: from || null, to: to || null }}
      onChange={(range) => setParam({ from: range.from, to: range.to })}
      className="w-full sm:w-auto"
    />
  );
}
