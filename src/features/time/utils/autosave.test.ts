import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CellAutosave,
  INVALID_DURATION_MESSAGE,
  type AutosaveHandlers,
  type AutosaveSnapshot,
} from './autosave';

const DELAY = 800;

function setup(overrides: Partial<AutosaveHandlers> = {}) {
  const saved: Array<[string, number | null]> = [];
  const handlers: AutosaveHandlers = {
    parse: (text) => (text.trim() === '' ? null : Number.isNaN(Number(text)) ? 'invalid' : Number(text)),
    validate: () => null,
    isUnchanged: () => false,
    confirmClear: () => Promise.resolve(true),
    save: (key, minutes) => {
      saved.push([key, minutes]);
      return Promise.resolve();
    },
    describe: (error) => (error instanceof Error ? error.message : 'failed'),
    ...overrides,
  };
  const engine = new CellAutosave(DELAY);
  engine.configure(handlers);
  const snapshots: AutosaveSnapshot[] = [];
  engine.subscribe(() => snapshots.push(engine.getSnapshot()));
  return { engine, saved, snapshots };
}

describe('CellAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves a cell once typing has paused, and only the last text', async () => {
    const { engine, saved } = setup();
    engine.edit('a', '6');
    await vi.advanceTimersByTimeAsync(DELAY - 100);
    engine.edit('a', '60');
    expect(engine.getSnapshot().cells.a).toEqual({ text: '60', status: 'dirty' });
    await vi.advanceTimersByTimeAsync(DELAY - 100);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(200);
    expect(saved).toEqual([['a', 60]]);
    expect(engine.getSnapshot().cells.a).toEqual({ status: 'saved' });
    expect(engine.getSnapshot().saved).toBe(1);
  });

  it('saves at once when the person leaves the cell', async () => {
    const { engine, saved } = setup();
    engine.edit('a', '30');
    engine.commit('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual([['a', 30]]);
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(saved).toHaveLength(1);
  });

  it('shows saving while the write runs and failed with the reason when it is refused', async () => {
    let refuse: (reason: Error) => void = () => undefined;
    const { engine } = setup({
      save: () =>
        new Promise<void>((_resolve, reject) => {
          refuse = reject;
        }),
    });
    engine.edit('a', '30');
    engine.commit('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().cells.a?.status).toBe('saving');
    expect(engine.getSnapshot().saving).toBe(1);
    refuse(new Error('Period locked'));
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().cells.a).toEqual({
      text: '30',
      status: 'error',
      message: 'Period locked',
    });
    expect(engine.getSnapshot().failed).toBe(1);
  });

  it('tries a refused cell again on request', async () => {
    let attempts = 0;
    const { engine } = setup({
      save: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error('Offline')) : Promise.resolve();
      },
    });
    engine.edit('a', '30');
    engine.commit('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().cells.a?.status).toBe('error');
    engine.retry('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(attempts).toBe(2);
    expect(engine.getSnapshot().cells.a).toEqual({ status: 'saved' });
  });

  it('refuses text that is not a duration and values the page rejects, without saving', async () => {
    const { engine, saved } = setup({ validate: (_key, minutes) => (minutes === 99 ? 'Too long' : null) });
    engine.edit('a', 'abc');
    engine.commit('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().cells.a).toEqual({
      text: 'abc',
      status: 'error',
      message: INVALID_DURATION_MESSAGE,
    });
    engine.edit('b', '99');
    engine.commit('b');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().cells.b?.message).toBe('Too long');
    expect(saved).toEqual([]);
  });

  it('does nothing for a value the cell already holds', async () => {
    const { engine, saved } = setup({ isUnchanged: () => true });
    engine.edit('a', '30');
    engine.commit('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual([]);
    expect(engine.getSnapshot().cells.a).toBeUndefined();
  });

  it('asks before an emptied cell deletes time, and drops the change when refused', async () => {
    const confirmClear = vi.fn(() => Promise.resolve(false));
    const { engine, saved } = setup({ confirmClear });
    engine.edit('a', '');
    engine.commit('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(confirmClear).toHaveBeenCalledWith('a');
    expect(saved).toEqual([]);
    expect(engine.getSnapshot().cells.a).toBeUndefined();

    confirmClear.mockResolvedValueOnce(true);
    engine.edit('a', '');
    engine.commit('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual([['a', null]]);
  });

  it('keeps typing that arrives while a save runs and saves it next', async () => {
    let finish: () => void = () => undefined;
    const saved: number[] = [];
    const { engine } = setup({
      save: (_key, minutes) =>
        new Promise<void>((resolve) => {
          saved.push(minutes ?? 0);
          finish = resolve;
        }),
    });
    engine.edit('a', '30');
    engine.commit('a');
    await vi.advanceTimersByTimeAsync(0);
    engine.edit('a', '45');
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().cells.a).toEqual({ text: '45', status: 'dirty' });
    await vi.advanceTimersByTimeAsync(DELAY);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual([30, 45]);
    expect(engine.getSnapshot().cells.a).toEqual({ status: 'saved' });
  });

  it('forgets what was typed on revert and saves what is left when the grid goes away', async () => {
    const { engine, saved } = setup();
    engine.edit('a', '30');
    engine.revert('a');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(saved).toEqual([]);
    expect(engine.getSnapshot().cells.a).toBeUndefined();

    engine.edit('b', '15');
    engine.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual([['b', 15]]);
  });
});
