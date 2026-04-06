import { useCallback, useMemo } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

import type {
  GetOptions,
  GetOptionsWithDefault,
  StorageKey,
  StorageValidator,
  TypedStorage,
  TypedStorageValue,
} from './types.js';
import { CLEAR_STORAGE_EVENT, getCustomEventName, noop } from './utils.js';

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

  const isClient = typeof window !== 'undefined';
  const customEventName = getCustomEventName(key);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!isClient) {
        return noop;
      }

      const handleStorageEvent = (event: StorageEvent): void => {
        if (event.key === key || event.key === null) {
          callback();
        }
      };

      window.addEventListener('storage', handleStorageEvent);
      window.addEventListener(customEventName, callback);
      window.addEventListener(CLEAR_STORAGE_EVENT, callback);

      return () => {
        window.removeEventListener('storage', handleStorageEvent);
        window.removeEventListener(customEventName, callback);
        window.removeEventListener(CLEAR_STORAGE_EVENT, callback);
      };
    },
    [key, customEventName, isClient],
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
