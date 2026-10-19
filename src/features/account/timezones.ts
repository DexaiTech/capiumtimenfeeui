import type { SelectOption } from '@/components/ui';

/** IANA timezones known to the browser, always including UTC and the user's current value. */
export function timezoneOptions(current?: string): SelectOption[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const names = new Set<string>(['UTC', ...supported]);
  if (current) names.add(current);
  return Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name.replaceAll('_', ' ') }));
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
