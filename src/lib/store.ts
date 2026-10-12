type Listener = () => void;

export interface Store<T> {
  get: () => T;
  set: (patch: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: Listener) => () => void;
}

/** Tiny observable store, read from React through useSyncExternalStore. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      if (Object.keys(next).every((key) => Object.is(next[key as keyof T], state[key as keyof T]))) return;
      state = { ...state, ...next };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
