import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IDLE_SIGN_OUT_MS, IDLE_WARNING_MS } from '@/constants/limits';

import { useIdleTimeout } from './useIdleTimeout';

const minutes = (count: number) => count * 60_000;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useIdleTimeout', () => {
  it('uses 25 and 30 minutes', () => {
    expect(IDLE_WARNING_MS).toBe(minutes(25));
    expect(IDLE_SIGN_OUT_MS).toBe(minutes(30));
  });

  it('is quiet while the person is active', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout({ onTimeout }));
    act(() => {
      vi.advanceTimersByTime(minutes(20));
      window.dispatchEvent(new Event('keydown'));
      vi.advanceTimersByTime(minutes(20));
    });
    expect(result.current.warning).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('warns after 25 minutes with the seconds left', () => {
    const { result } = renderHook(() => useIdleTimeout({ onTimeout: vi.fn() }));
    act(() => {
      vi.advanceTimersByTime(minutes(25) + 1_000);
    });
    expect(result.current.warning).toBe(true);
    expect(result.current.secondsLeft).toBe(299);
  });

  it('does not let activity dismiss the warning, only "stay"', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout({ onTimeout }));
    act(() => {
      vi.advanceTimersByTime(minutes(26));
    });
    expect(result.current.warning).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.warning).toBe(true);

    act(() => result.current.stay());
    expect(result.current.warning).toBe(false);
    act(() => {
      vi.advanceTimersByTime(minutes(29));
    });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('signs out once, after 30 minutes without activity', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout({ onTimeout }));
    act(() => {
      vi.advanceTimersByTime(minutes(30) + 5_000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(result.current.warning).toBe(false);
  });

  it('does nothing while disabled', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout({ onTimeout, enabled: false }));
    act(() => {
      vi.advanceTimersByTime(minutes(40));
    });
    expect(result.current.warning).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
