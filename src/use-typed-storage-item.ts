"use client";

import {useCallback, useMemo} from 'react';
import {useSyncExternalStore} from 'use-sync-external-store/shim';

import {StorageValidator, TypedStorage, TypedStorageValue} from './types.js';
import {CLEAR_STORAGE_EVENT, getCustomEventName, noop} from './utils.js';

export function useTypedStorageItem<S extends TypedStorageValue, K extends Extract<keyof S, string>>(
    key: K,
    {
        storage,
        defaultValue,
        validate,
    }: { storage: TypedStorage<S>; defaultValue?: S[K] | undefined; validate?: StorageValidator<S[K]>; },
) {
    const isClient = typeof window !== "undefined";
    const customEventName = getCustomEventName(key);

    const subscribe = useCallback(
        (callback: () => void) => {
            if (!isClient) return noop;

            const storageHandler = (e: StorageEvent) => {
                if (e.key === key || e.key === null) callback();
            };

            window.addEventListener("storage", storageHandler);
            window.addEventListener(customEventName, callback);
            window.addEventListener(CLEAR_STORAGE_EVENT, callback);

            return () => {
                window.removeEventListener("storage", storageHandler);
                window.removeEventListener(customEventName, callback);
                window.removeEventListener(CLEAR_STORAGE_EVENT, callback);
            };
        },
        [key, customEventName, isClient],
    );

    const getSnapshot = useCallback(() => storage?.get(key, { defaultValue, validate }) ?? null, [key, storage, defaultValue, validate]);

    const value = useSyncExternalStore(
        subscribe,
        getSnapshot,
        () => defaultValue ?? null,
    );

    const set = useCallback(
        (val: S[K]) => storage.set(key, val, { validate}),
        [key, storage, customEventName],
    );

    const remove = useCallback(() => storage?.remove(key), [key, storage, customEventName]);

    return useMemo(() => ({ value, set, remove }), [value, set, remove]);
}
