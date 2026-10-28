import { isValidElement, type ReactNode } from 'react';

/** The words of a label, also when it is made of elements (a label with a red star). */
export function labelText(label: ReactNode): string {
  if (typeof label === 'string') return label;
  if (typeof label === 'number') return String(label);
  if (Array.isArray(label)) return label.map(labelText).join('');
  if (isValidElement(label)) {
    const { children } = label.props as { children?: ReactNode };
    return labelText(children);
  }
  return '';
}

/** Types whose control draws its own hint (a date picker, a tick box, a file chooser). */
const NO_PLACEHOLDER = new Set([
  'checkbox',
  'radio',
  'file',
  'hidden',
  'range',
  'color',
  'date',
  'time',
  'month',
  'week',
  'datetime-local',
  'submit',
  'button',
]);

/** Label words (lower case) and the example that fits them, most specific first. */
const EXAMPLES: ReadonlyArray<readonly [RegExp, string]> = [
  [/e-?mail/, 'name@example.co.uk'],
  [/\bphone\b|\bmobile\b|telephone|\btel\b/, 'e.g. 020 7946 0958'],
  [/web ?site|web address|\burl\b|\blink\b/, 'https://www.example.co.uk'],
  [/post ?code|zip/, 'e.g. SW1A 1AA'],
  [/company (number|no)|registration number/, 'e.g. 01234567'],
  [/vat (number|no|reg)/, 'e.g. GB123456789'],
  [/\butr\b/, '10-digit reference'],
  [/sort code/, '00-00-00'],
  [/account number/, '8 digits'],
  [/\biban\b/, 'e.g. GB29 NWBK 6016 1331 9268 19'],
  [/\bcity\b|\btown\b/, 'e.g. London'],
  [/address line 1|^address$|street/, 'e.g. 10 High Street'],
  [/address line 2/, 'Flat, suite or building (optional)'],
  [/county|region/, 'e.g. Greater London'],
  [/practice name/, 'e.g. Smith & Co Accountants'],
  [/client name|company name/, 'e.g. Acme Trading Ltd'],
  [/full name|your name/, 'e.g. Jane Smith'],
  [/first name/, 'e.g. Jane'],
  [/last name|surname/, 'e.g. Smith'],
  [/job title|position|role title/, 'e.g. Senior Accountant'],
  [/\bsearch\b|\bfind\b/, 'Search…'],
  [/\breference\b|\bref\b|po number/, 'e.g. INV-0001'],
  [/\bsubject\b|\btitle\b/, 'A short, clear summary'],
  [/\breason\b|\bwhy\b/, 'Say why'],
  [/\bnotes?\b|\bcomments?\b|\bmessage\b/, 'Add a note'],
  [/description/, 'Describe it in a few words'],
  [/\bcode\b/, 'e.g. ABC'],
  [/initials/, 'e.g. JS'],
  [/\b(rate|price|fee|amount|cost|value|total|budget|threshold|salary|pay|balance)\b/, '0.00'],
  [/\b(hours?|minutes?|days?|miles?)\b/, '0'],
];

/**
 * A hint for an empty field, from its label and type, for forms that give none. The generic one
 * is "Enter <label>"; an email, a phone number, a postcode and so on get a real example. Returns
 * undefined for fields that draw their own hint.
 */
export function suggestPlaceholder(
  label: ReactNode,
  type: string | undefined,
  textarea = false,
): string | undefined {
  const kind = type ?? 'text';
  if (NO_PLACEHOLDER.has(kind)) return undefined;
  const words = labelText(label).replace(/[*:]/g, '').trim().toLowerCase();
  if (kind === 'email') return 'name@example.co.uk';
  if (kind === 'tel') return 'e.g. 020 7946 0958';
  if (kind === 'url') return 'https://www.example.co.uk';
  if (kind === 'search') return 'Search…';
  if (kind === 'password')
    return words.includes('confirm') ? 'Re-enter the password' : 'Enter the password';
  const match = EXAMPLES.find(([pattern]) => pattern.test(words));
  if (match && !(textarea && match[1] === '0.00')) return match[1];
  if (kind === 'number') return '0';
  if (!words) return undefined;
  return textarea ? `Add ${words}…` : `Enter ${words}`;
}

/** The on-screen keyboard that fits a field: digits for a phone number, "@" for an email. */
export function suggestInputMode(
  type: string | undefined,
): 'email' | 'tel' | 'url' | 'search' | undefined {
  if (type === 'email') return 'email';
  if (type === 'tel') return 'tel';
  if (type === 'url') return 'url';
  if (type === 'search') return 'search';
  return undefined;
}
