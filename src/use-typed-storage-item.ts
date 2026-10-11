// oxlint-disable-next-line import/no-namespace -- needed to probe for `useSyncExternalStore` without a static import
import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';

import { noop } from './utils.js';
import type {
  GetOptions,
  GetOptionsWithDefault,
  StorageKey,
  StorageValidator,
  TypedStorage,
  TypedStorageValue,
} from './types.js';

type UseSyncExternalStore = <T>(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot: () => T,
) => T;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Minimal fallback for React 16/17, which lack `useSyncExternalStore`. */
const useSyncExternalStoreFallback: UseSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) => {
  const value = typeof window === 'undefined' ? getServerSnapshot() : getSnapshot();
  const latest = useRef({ value, getSnapshot });
  const [, forceUpdate] = useReducer((tick: boolean) => !tick, false);

  useIsomorphicLayoutEffect(() => {
    latest.current = { value, getSnapshot };
    if (!Object.is(value, getSnapshot())) {
      forceUpdate();
    }
  }, [value, getSnapshot]);

  useEffect(() => {
    const check = () => {
      if (!Object.is(latest.current.value, latest.current.getSnapshot())) {
        forceUpdate();
      }
    };
    check();
    return subscribe(check);
  }, [subscribe]);

  return value;
};

// Looked up by a computed name so bundlers don't flag a missing export on React 16/17.
const builtinName = 'useSyncExternalStore';
const useSyncExternalStore: UseSyncExternalStore =
  (React as unknown as Record<string, UseSyncExternalStore | undefined>)[builtinName] ?? useSyncExternalStoreFallback;

/** Subscription for `TypedStorage` implementations without `subscribe`: native cross-tab events only. */
function subscribeToStorageEvents(key: string, callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return noop;
  }

  const handleStorageEvent = (event: StorageEvent): void => {
    if (event.key === key || event.key === null) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorageEvent);
  return () => {
    window.removeEventListener('storage', handleStorageEvent);
  };
}

interface UseTypedStorageItemOptions<S extends TypedStorageValue, K extends StorageKey<S>> {
  storage: TypedStorage<S>;
  validate?: GetOptions<S[K]>['validate'];
}

interface UseTypedStorageItemOptionsWithDefault<
  S extends TypedStorageValue,
  K extends StorageKey<S>,
> extends UseTypedStorageItemOptions<S, K> {
  defaultValue: S[K];
}

export interface UseTypedStorageItemResult<T> {
  value: T;
  set: (val: T) => T | null;
  remove: () => void;
}

export function useTypedStorageItem<S extends TypedStorageValue, K extends StorageKey<S>>(
  key: K,
  options: UseTypedStorageItemOptions<S, K>,
): UseTypedStorageItemResult<S[K] | null>;

export function useTypedStorageItem<S extends TypedStorageValue, K extends StorageKey<S>>(
  key: K,
  options: UseTypedStorageItemOptionsWithDefault<S, K>,
): UseTypedStorageItemResult<S[K]>;

export function useTypedStorageItem<S extends TypedStorageValue, K extends StorageKey<S>>(
  key: K,
  options: UseTypedStorageItemOptions<S, K> | UseTypedStorageItemOptionsWithDefault<S, K>,
) {
  const { storage, validate } = options;
  const defaultValue = (options as UseTypedStorageItemOptionsWithDefault<S, K>).defaultValue;

  const subscribe = useCallback(
    (callback: () => void) => {
      if (storage.subscribe) {
        return storage.subscribe(key, callback);
      }

      return subscribeToStorageEvents(key, callback);
    },
    [key, storage],
  );

  const getSnapshot = useCallback((): S[K] | null => {
    const getOptions =
      defaultValue !== undefined
        ? ({ defaultValue, validate } as GetOptionsWithDefault<S[K]>)
        : ({ validate } as GetOptions<S[K]>);

    return storage.get(key, getOptions);
  }, [key, storage, defaultValue, validate]);

  const getServerSnapshot = useCallback((): S[K] | null => {
    return defaultValue ?? null;
  }, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (val: S[K]): S[K] | null => {
      return storage.set(key, val, { validate });
    },
    [key, storage, validate],
  );

  const remove = useCallback((): void => {
    storage.remove(key);
  }, [key, storage]);

  return useMemo(() => ({ value, set, remove }), [value, set, remove]);
}

export type StorageItemResult<T, D extends T | undefined> = D extends T
  ? UseTypedStorageItemResult<T>
  : UseTypedStorageItemResult<T | null>;

export function createStorageHook<S extends TypedStorageValue>(storage: TypedStorage<S>) {
  return function useStorageItem<K extends StorageKey<S>, D extends S[K] | undefined = undefined>(
    key: K,
    options?: { defaultValue?: D; validate?: StorageValidator<S[K]> },
  ): StorageItemResult<S[K], D> {
    return useTypedStorageItem(key, { ...options, storage }) as StorageItemResult<S[K], D>;
  };
}
