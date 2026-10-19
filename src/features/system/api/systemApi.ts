import { api } from '@/services/api';

import type { SystemInfo } from '../types';

/** The public `GET /system` of milestone 11 (docs/api.md, "System information"). */
export const systemApi = {
  get: (signal?: AbortSignal) => api.get<SystemInfo>('/system', { signal }),
};
