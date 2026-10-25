import { useCallback, useState } from 'react';

const PREFIX = 'tf:columns:';

function read(key: string): ReadonlySet<string> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
      ? new Set(parsed)
      : null;
  } catch {
    return null;
  }
}

/**
 * The columns a person hid on a list, remembered in this browser so they are not hidden again at
 * every visit. `id` names the list; `initial` is what is hidden until the person chooses.
 */
export function usePersistentColumns(
  id: string,
  initial: ReadonlyArray<string> = [],
): readonly [ReadonlySet<string>, (next: ReadonlySet<string>) => void] {
  const key = `${PREFIX}${id}`;
  const [hidden, setState] = useState<ReadonlySet<string>>(() => read(key) ?? new Set(initial));
  const setHidden = useCallback(
    (next: ReadonlySet<string>) => {
      setState(next);
      try {
        window.localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        // Storage can be full or blocked: the choice then lasts for this visit only.
      }
    },
    [key],
  );
  return [hidden, setHidden] as const;
}
