import { findModule } from '@/constants/navigation';

import type { FlowTarget } from './flowData';

/** The address of the page a step points at, from the navigation (so a rename or a move follows). */
export function pageHref(slug: string, target: FlowTarget): string {
  const module = findModule(target.module);
  const page = module.pages.find((entry) => entry.id === target.page);
  return page ? page.to(slug) : module.to(slug);
}
