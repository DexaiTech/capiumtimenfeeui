/**
 * Public surface of the settings feature. The pages are loaded by the router straight from
 * `pages/` (one chunk each); other features import only what is listed here.
 */
export { MemberPicker, type MemberPickerProps } from './components/MemberPicker';
export { useMemberDirectory, useMembers, useRoles } from './api/hooks';
export { roleOptions, type RoleOption } from './utils/roles';
export type { Member, MemberStatus, Role } from './types';
// The invoice templates a client's billing settings can choose from (`GET /invoice-templates`).
export { useInvoiceTemplates } from './api/billingHooks';
export type { InvoiceLayout, InvoiceTemplate } from './billingTypes';
// The set-up checklist of the practice, for the dashboard's Getting started card.
export { useOnboarding } from './api/adminHooks';
// Asks the browser to confirm closing the tab while a form has unsaved changes.
export { useBeforeUnload } from './hooks/useBeforeUnload';
