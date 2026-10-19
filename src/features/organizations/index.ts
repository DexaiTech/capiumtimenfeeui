/** Public surface of the practice (organizations) feature. Other areas import from here. */
export type { Organization, OrganizationContext, RoleSummary } from '@/types/organization';
export {
  useCreateOrganization,
  useMyOrganizations,
  useOrganizationBySlug,
  useUpdateOrganization,
} from './api/hooks';
export { organizationsApi } from './api/organizationsApi';
export { Can, type CanProps } from './components/Can';
export { CreateOrganizationForm } from './components/CreateOrganizationForm';
export { DeleteOrganization } from './components/DeleteOrganization';
export { OrgProvider, type OrgProviderProps } from './components/OrgProvider';
export { useOptionalOrg, useOrg, type OrgContextValue } from './orgContext';
export { WEEKDAYS, weekdayLabel } from './utils/schedule';
