/**
 * Public surface of the settings feature. The pages are loaded by the router straight from
 * `pages/` (one chunk each); other features import only what is listed here.
 */
export { MemberPicker, type MemberPickerProps } from './components/MemberPicker';
export { useMemberDirectory, useMembers, usePermissionCatalogue, useRoles } from './api/hooks';
// The permission grid of a role, reused for one person's own permissions (Team > Staff).
export { PermissionPicker, type PermissionPickerProps } from './components/roles/PermissionPicker';
export { roleOptions, type RoleOption } from './utils/roles';
export type { Member, MemberStatus, Permission, Role } from './types';
// The invoice templates a client's billing settings can choose from (`GET /invoice-templates`).
export { useInvoiceTemplates } from './api/billingHooks';
export type { InvoiceLayout, InvoiceTemplate } from './billingTypes';
// The set-up checklist of the practice, for the dashboard's Getting started card.
export { useOnboarding } from './api/adminHooks';
// Asks the browser to confirm closing the tab while a form has unsaved changes.
export { useBeforeUnload } from './hooks/useBeforeUnload';
