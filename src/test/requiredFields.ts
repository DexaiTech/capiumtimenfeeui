import { within } from '@testing-library/react';

/** The label element of a form control (by `for`, or the label that wraps it). */
export function labelOf(control: HTMLElement): HTMLElement | null {
  const wrapping = control.closest('label');
  if (wrapping) return wrapping;
  return control.id
    ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(control.id)}"]`)
    : null;
}

/**
 * True when a control is marked mandatory the way the app marks it: `aria-required` on the control
 * and the `field-required` class (the red star, drawn by CSS) on the label text.
 */
export function isMarkedRequired(control: HTMLElement): boolean {
  if (control.getAttribute('aria-required') !== 'true') return false;
  const label = labelOf(control);
  if (!label) return false;
  return (
    label.classList.contains('field-required') || label.querySelector('.field-required') !== null
  );
}

/**
 * Asserts which fields of a form carry the star: every name in `required` does, every name in
 * `optional` does not. Names are the visible labels, as `getByLabelText` takes them.
 */
export function expectRequiredFields(
  scope: HTMLElement,
  fields: { required: ReadonlyArray<string | RegExp>; optional?: ReadonlyArray<string | RegExp> },
): void {
  for (const name of fields.required) {
    const control = within(scope).getByLabelText(name);
    if (!isMarkedRequired(control)) {
      throw new Error(`Expected "${String(name)}" to be marked as required`);
    }
  }
  for (const name of fields.optional ?? []) {
    const control = within(scope).getByLabelText(name);
    if (isMarkedRequired(control)) {
      throw new Error(`Expected "${String(name)}" not to be marked as required`);
    }
  }
}
