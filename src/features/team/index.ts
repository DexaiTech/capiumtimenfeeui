/**
 * Public surface of the Team & Rates feature (`/:orgSlug/team/*`). The pages are loaded by the
 * router from `pages/`; other modules take the pickers, the catalogue hooks and the types below
 * instead of reaching into this folder.
 */
export { ClientPicker } from './components/pickers/ClientPicker';
export { JobPicker } from './components/pickers/JobPicker';
export { StaffPicker } from './components/pickers/StaffPicker';
export {
  useActivityTypes,
  useGradeOptions,
  useServices,
  useServiceTaskTemplates,
  useVatCodes,
} from './api';
export type {
  ActivityType,
  Grade,
  RateRule,
  Service,
  StaffMember,
  StaffStatus,
  TaskTemplate,
  VatCode,
} from './types';
