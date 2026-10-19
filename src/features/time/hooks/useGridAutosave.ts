import { useEffect, useState, useSyncExternalStore } from 'react';

import { AUTOSAVE_DELAY_MS } from '../constants';
import { CellAutosave, type AutosaveHandlers, type AutosaveSnapshot } from '../utils/autosave';

export interface GridAutosave {
  engine: CellAutosave;
  snapshot: AutosaveSnapshot;
}

/**
 * One autosave engine per grid. The handlers are read at the moment they are needed, so a save
 * always sees the entries as they are now; what was typed and not saved yet is saved when the
 * grid goes away (a new week is a new grid).
 */
export function useGridAutosave(handlers: AutosaveHandlers): GridAutosave {
  const [engine] = useState(() => new CellAutosave(AUTOSAVE_DELAY_MS));
  useEffect(() => {
    engine.configure(handlers);
  });
  useEffect(
    () => () => {
      engine.dispose();
    },
    [engine],
  );
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return { engine, snapshot };
}
