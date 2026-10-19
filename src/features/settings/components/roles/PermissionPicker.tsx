import { Lock, Search, SearchX } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Button, Input, Tooltip } from '@/components/ui';
import { cn } from '@/utils/cn';

import type { Permission } from '../../types';
import { groupPermissions } from '../../utils/roles';

export const NOT_HELD_REASON =
  "You don't hold this permission yourself, so the server won't let you grant it.";

export interface PermissionPickerProps {
  catalogue: ReadonlyArray<Permission>;
  /** Selected permission codes. */
  value: ReadonlyArray<string>;
  onChange: (codes: string[]) => void;
  /** Whether the current user holds a permission; the others cannot be granted. */
  held: (code: string) => boolean;
  /** Shows the selection without letting it change (system roles, missing `role.manage`). */
  readOnly?: boolean;
  error?: string;
}

const checkboxClasses =
  'size-4.5 shrink-0 cursor-pointer rounded-sm accent-primary disabled:cursor-not-allowed';

interface PermissionRowProps {
  permission: Permission;
  checked: boolean;
  locked: boolean;
  readOnly: boolean;
  onToggle: (checked: boolean) => void;
}

function PermissionRow({ permission, checked, locked, readOnly, onToggle }: PermissionRowProps) {
  const id = useId();
  const reasonId = `${id}-reason`;
  const row = (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-11 w-full items-start gap-3 rounded-md px-2 py-2',
        locked || readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-surface-hover',
        locked && 'opacity-70',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={locked || readOnly}
        aria-describedby={locked ? reasonId : undefined}
        onChange={(event) => onToggle(event.target.checked)}
        className={cn(checkboxClasses, 'mt-0.5')}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm text-text">{permission.description}</span>
        <code className="font-mono text-xs break-all text-text-muted">{permission.code}</code>
      </span>
      {locked ? (
        <>
          <Lock aria-hidden="true" className="mt-0.5 ml-auto size-4 shrink-0 text-text-subtle" />
          <span id={reasonId} className="sr-only">
            {NOT_HELD_REASON}
          </span>
        </>
      ) : null}
    </label>
  );
  // A disabled input never gets focus or hover, so the tooltip is anchored to the whole row.
  return locked ? (
    <Tooltip content={NOT_HELD_REASON} side="top">
      {row}
    </Tooltip>
  ) : (
    row
  );
}

/**
 * The permission catalogue grouped by category, with search and "select all" per category.
 * Permissions the current user does not hold are locked: the server refuses to grant them.
 */
export function PermissionPicker({
  catalogue,
  value,
  onChange,
  held,
  readOnly = false,
  error,
}: PermissionPickerProps) {
  const [search, setSearch] = useState('');
  const baseId = useId();
  const selected = useMemo(() => new Set(value), [value]);
  const groups = useMemo(() => groupPermissions(catalogue), [catalogue]);

  const needle = search.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      visible: needle
        ? group.permissions.filter(
            (permission) =>
              permission.code.toLowerCase().includes(needle) ||
              permission.description.toLowerCase().includes(needle) ||
              permission.category.toLowerCase().includes(needle),
          )
        : group.permissions,
    }))
    .filter((group) => group.visible.length > 0);

  const lockedCount = readOnly
    ? 0
    : catalogue.filter((permission) => !held(permission.code)).length;

  const setCodes = (codes: ReadonlyArray<string>, checked: boolean) => {
    const next = new Set(selected);
    for (const code of codes) {
      if (checked) next.add(code);
      else next.delete(code);
    }
    // Keep the catalogue's order, so the request body is stable.
    const known = catalogue.map((permission) => permission.code);
    onChange([
      ...known.filter((code) => next.has(code)),
      ...Array.from(next).filter((code) => !known.includes(code)),
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          label="Search permissions"
          hideLabel
          type="search"
          placeholder="Search permissions"
          leftIcon={<Search className="size-4" />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:w-72"
        />
        <p className="text-xs text-text-muted" aria-live="polite">
          {selected.size} of {catalogue.length} selected
        </p>
      </div>

      {lockedCount > 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-xs text-text-muted">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {lockedCount === 1
              ? '1 permission is locked because you do not hold it yourself.'
              : `${lockedCount} permissions are locked because you do not hold them yourself.`}{' '}
            You can only grant what you have.
          </span>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      {visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface shadow-card px-6 py-8 text-center">
          <SearchX aria-hidden="true" className="size-5 text-text-subtle" />
          <p className="text-sm text-text-muted">No permission matches “{search.trim()}”.</p>
          <Button size="sm" onClick={() => setSearch('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleGroups.map((group) => {
            const grantable = group.permissions
              .filter((permission) => held(permission.code))
              .map((permission) => permission.code);
            const grantableSelected = grantable.filter((code) => selected.has(code)).length;
            const groupSelected = group.permissions.filter((permission) =>
              selected.has(permission.code),
            ).length;
            const allSelected = grantable.length > 0 && grantableSelected === grantable.length;
            return (
              <div
                key={group.category}
                role="group"
                aria-labelledby={`${baseId}-${group.category}`}
                className="rounded-xl border border-border bg-surface shadow-card"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-text">
                    <span id={`${baseId}-${group.category}`}>{group.category}</span>
                    <span className="text-xs font-normal text-text-muted">
                      {groupSelected} of {group.permissions.length}
                    </span>
                  </h4>
                  {readOnly ? null : (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-text-muted md:min-h-8">
                      <input
                        type="checkbox"
                        aria-label={`Select all in ${group.category}`}
                        checked={allSelected}
                        disabled={grantable.length === 0}
                        ref={(element) => {
                          if (element) {
                            element.indeterminate = grantableSelected > 0 && !allSelected;
                          }
                        }}
                        onChange={(event) => setCodes(grantable, event.target.checked)}
                        className={checkboxClasses}
                      />
                      <span aria-hidden="true">Select all</span>
                    </label>
                  )}
                </div>
                <div className="grid gap-x-2 p-2 lg:grid-cols-2">
                  {group.visible.map((permission) => (
                    <PermissionRow
                      key={permission.code}
                      permission={permission}
                      checked={selected.has(permission.code)}
                      locked={!readOnly && !held(permission.code)}
                      readOnly={readOnly}
                      onToggle={(checked) => setCodes([permission.code], checked)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
