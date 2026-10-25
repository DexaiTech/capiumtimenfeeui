import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usePersistentColumns } from './usePersistentColumns';

describe('usePersistentColumns', () => {
  it('starts from the defaults when nothing was chosen', () => {
    const { result } = renderHook(() => usePersistentColumns('jobs', ['service']));
    expect([...result.current[0]]).toEqual(['service']);
  });

  it('remembers the choice for the next visit', () => {
    const first = renderHook(() => usePersistentColumns('jobs', ['service']));
    act(() => first.result.current[1](new Set(['due'])));
    expect([...first.result.current[0]]).toEqual(['due']);
    first.unmount();

    // A later visit starts from what was chosen, not from the defaults.
    const second = renderHook(() => usePersistentColumns('jobs', ['service']));
    expect([...second.result.current[0]]).toEqual(['due']);
  });

  it('keeps each list apart', () => {
    const jobs = renderHook(() => usePersistentColumns('jobs'));
    act(() => jobs.result.current[1](new Set(['due'])));
    const tasks = renderHook(() => usePersistentColumns('tasks'));
    expect([...tasks.result.current[0]]).toEqual([]);
  });

  it('ignores a stored value that is not a list of names', () => {
    window.localStorage.setItem('tf:columns:jobs', '{"oops":1}');
    const { result } = renderHook(() => usePersistentColumns('jobs', ['service']));
    expect([...result.current[0]]).toEqual(['service']);
  });
});
