/**
 * The autosave of the week grid: a cell is saved a moment after the person stops typing (or at
 * once when they leave it), one save at a time per cell, and the grid shows each cell as dirty,
 * saving, saved or failed. It knows nothing of React or of the API: the page hands it the
 * functions that parse, check and write a value (`AutosaveHandlers`).
 */

export type CellStatus = 'dirty' | 'saving' | 'saved' | 'error';

export interface CellState {
  /** What the person typed. Gone once the saved value shows instead. */
  text?: string;
  status: CellStatus;
  /** Why the cell could not be saved. */
  message?: string;
}

export interface AutosaveSnapshot {
  cells: Readonly<Record<string, CellState>>;
  dirty: number;
  saving: number;
  failed: number;
  /** Cells saved since the grid was opened. */
  saved: number;
}

export interface AutosaveHandlers {
  /** Text to minutes (null for an empty cell); `'invalid'` when it is not a duration. */
  parse: (text: string) => number | null | 'invalid';
  /** Why the value cannot be saved, or null. */
  validate: (key: string, minutes: number | null) => string | null;
  /** True when the value is what the cell holds already. */
  isUnchanged: (key: string, minutes: number | null) => boolean;
  /** Asked when a filled cell was emptied (that deletes time); false drops the change. */
  confirmClear: (key: string) => Promise<boolean>;
  /** Writes the value and answers once the grid shows it; throws what the API refused. */
  save: (key: string, minutes: number | null) => Promise<void>;
  /** The words for a refusal. */
  describe: (error: unknown) => string;
}

export const INVALID_DURATION_MESSAGE = 'Use a duration like 1:30, 1.5 or 1h 30m.';

export class CellAutosave {
  private readonly delayMs: number;
  private state = new Map<string, CellState>();
  private savedTotal = 0;
  private current: AutosaveSnapshot = { cells: {}, dirty: 0, saving: 0, failed: 0, saved: 0 };
  private readonly listeners = new Set<() => void>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly versions = new Map<string, number>();
  private readonly running = new Set<string>();
  private readonly again = new Set<string>();
  private handlers: AutosaveHandlers | null = null;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AutosaveSnapshot => this.current;

  configure(handlers: AutosaveHandlers): void {
    this.handlers = handlers;
  }

  /** A keystroke in a cell: the text is kept and saved once typing pauses. */
  edit(key: string, text: string): void {
    this.bump(key);
    this.set(key, { text, status: 'dirty' });
    this.clearTimer(key);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.flush(key);
      }, this.delayMs),
    );
  }

  /** The person left the cell (or pressed Enter): save it now. */
  commit(key: string): void {
    this.clearTimer(key);
    void this.flush(key);
  }

  /** Tries a refused cell again with the text it holds. */
  retry(key: string): void {
    const cell = this.state.get(key);
    if (cell?.status !== 'error' || cell.text === undefined) return;
    this.bump(key);
    this.set(key, { text: cell.text, status: 'dirty' });
    this.commit(key);
  }

  /** Escape: forget what was typed. */
  revert(key: string): void {
    this.clearTimer(key);
    this.bump(key);
    this.set(key, null);
  }

  /** Saves everything typed and not saved yet (the grid is being left). */
  flushAll(): void {
    for (const [key, cell] of [...this.state]) {
      if (cell.status !== 'dirty') continue;
      this.clearTimer(key);
      void this.flush(key);
    }
  }

  /** Stops the timers of a grid that is going away; what was typed is saved first. */
  dispose(): void {
    this.flushAll();
    for (const key of [...this.timers.keys()]) this.clearTimer(key);
  }

  private async flush(key: string): Promise<void> {
    const handlers = this.handlers;
    const cell = this.state.get(key);
    if (!handlers || cell?.status !== 'dirty' || cell.text === undefined) return;
    if (this.running.has(key)) {
      this.again.add(key);
      return;
    }

    const text = cell.text;
    const version = this.versions.get(key) ?? 0;
    const unchangedSince = () => (this.versions.get(key) ?? 0) === version;

    const minutes = handlers.parse(text);
    if (minutes === 'invalid') {
      this.set(key, { text, status: 'error', message: INVALID_DURATION_MESSAGE });
      return;
    }
    const problem = handlers.validate(key, minutes);
    if (problem) {
      this.set(key, { text, status: 'error', message: problem });
      return;
    }
    if (handlers.isUnchanged(key, minutes)) {
      this.set(key, null);
      return;
    }

    this.running.add(key);
    try {
      if (minutes === null && !(await handlers.confirmClear(key))) {
        if (unchangedSince()) this.set(key, null);
        return;
      }
      this.set(key, { text, status: 'saving' });
      await handlers.save(key, minutes);
      this.savedTotal += 1;
      if (unchangedSince()) this.set(key, { status: 'saved' });
    } catch (error) {
      if (unchangedSince()) {
        this.set(key, { text, status: 'error', message: handlers.describe(error) });
      }
    } finally {
      this.running.delete(key);
      if (this.again.delete(key)) void this.flush(key);
    }
  }

  private bump(key: string): void {
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(key);
  }

  private set(key: string, cell: CellState | null): void {
    const next = new Map(this.state);
    if (cell === null) next.delete(key);
    else next.set(key, cell);
    this.state = next;
    const counts = { dirty: 0, saving: 0, failed: 0 };
    for (const entry of next.values()) {
      if (entry.status === 'dirty') counts.dirty += 1;
      else if (entry.status === 'saving') counts.saving += 1;
      else if (entry.status === 'error') counts.failed += 1;
    }
    this.current = { cells: Object.fromEntries(next), ...counts, saved: this.savedTotal };
    for (const listener of this.listeners) listener();
  }
}
