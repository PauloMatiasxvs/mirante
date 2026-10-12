import { createContext, useContext, useSyncExternalStore } from 'react';
import type { MapEngine, MapState } from '../map/engine';

export const MapContext = createContext<MapEngine | null>(null);

export function useEngine(): MapEngine {
  const engine = useContext(MapContext);
  if (!engine) throw new Error('useEngine must be used below a ready MapContext provider');
  return engine;
}

/** Subscribes to a slice of the map state; re-renders only when that slice changes. */
export function useMapState<T>(selector: (state: MapState) => T): T {
  const { store } = useEngine();
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
