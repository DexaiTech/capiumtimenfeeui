import { useBranches, useBranchesEnabled } from '@/features/settings';

import { branchFilterOptions } from '../constants';

/** The value of the select while it cannot name the filter: several branches ticked in Filter, or
 * one that is not (yet) in the list (the list is loading, or a saved filter names a deleted one). */
const SEVERAL = '__several__';

export interface BranchFilterProps {
  /** The `branch` list filter: branch ids and/or "No branch". */
  values: string[];
  onChange: (values: string[]) => void;
}

/**
 * The Branch select at the top of the client list (APT76): every branch, one branch or the
 * clients without one. It sets the same filter as the Branch section of Filter, where several
 * branches can be ticked. Nothing shows while the practice does not use branches.
 */
export function BranchFilter({ values, onChange }: BranchFilterProps) {
  const branchesOn = useBranchesEnabled();
  const branches = useBranches(branchesOn);
  if (!branchesOn) return null;
  const options = branchFilterOptions(branches.data ?? []);
  const named = values.length === 1 && options.some((option) => option.value === values[0]);
  const several = values.length > 0 && !named;
  return (
    <select
      className="cc-select cc-branch-filter"
      aria-label="Filter by branch"
      value={several ? SEVERAL : (values[0] ?? '')}
      onChange={(event) => onChange(event.target.value ? [event.target.value] : [])}
    >
      <option value="">All branches</option>
      {several ? (
        <option value={SEVERAL} disabled>
          {values.length === 1 ? '1 branch' : `${values.length} branches`}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
