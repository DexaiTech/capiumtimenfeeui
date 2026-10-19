/** Public surface of the system feature: the deployment mode (open or closed). */
export { systemApi } from './api/systemApi';
export {
  CLOSED_DEPLOYMENT_NOTICE,
  OpenDeploymentOnly,
  PASSWORD_RESET_NOTICE,
} from './OpenDeploymentOnly';
export { roleDisplayName, SUPER_ADMIN_NAME } from './roleName';
export type { SystemInfo, SystemOrganization } from './types';
export { useRoleName } from './useRoleName';
export { useSystemInfo, type SystemInfoState } from './useSystemInfo';
