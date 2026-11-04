import { useOrg } from '@/features/organizations';

/**
 * Whether the practice has Capium Central (the central client integration) switched on in
 * Settings > Integrations (APT74). Every Central element of the client screens asks this: off, the
 * Central column, chip, filter, buttons, row action and client settings card are not shown.
 */
export function useCentralEnabled(): boolean {
  return useOrg().centralClientEnabled;
}
