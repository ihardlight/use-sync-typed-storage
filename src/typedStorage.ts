import type {
    GetOptions,
    GetOptionsWithDefault,
    SetOptions,
    StorageKey,
    StorageType,
    StorageValidator,
    TypedStorage,
    TypedStorageValue,
} from './types.js';
import { CLEAR_STORAGE_EVENT, getCustomEventName } from './utils.js';
import { createStorageHook } from './use-typed-storage-item.js';

interface CacheEntry<T> {
    raw: string | null;
    parsed: T;
}

export interface CreateTypedStorageOptions<S extends TypedStorageValue> {
    validate?: <K extends keyof S>(key: K) => StorageValidator<S[K]>;
}

const registry = new Map<string, unknown>();

export function resetTypedStorageRegistry(): void {
    registry.clear();
}

export function createTypedStorage<S extends TypedStorageValue>(
    type: StorageType = 'localStorage',
    config?: CreateTypedStorageOptions<S>,
) {
    const existing = registry.get(type);
    if (existing) {
        console.warn(
            `[use-sync-typed-storage] Storage "${type}" already created. Returning existing instance. Call resetTypedStorageRegistry() between tests.`,
        );
        return existing as { storage: TypedStorage<S>; useStorageItem: ReturnType<typeof createStorageHook<S>> };
    }

    type Key = StorageKey<S>;
    type Value<K extends Key> = S[K];

    const isClient = typeof window !== 'undefined';
    const cache = new Map<string, CacheEntry<unknown>>();
    const storageOptions = config ?? {};

    const getStorage = (): Storage | null => {
        if (!isClient) {
            return null;
        }

        return type === 'localStorage' ? window.localStorage : window.sessionStorage;
    };

    const getValidator = <K extends Key>(
        key: K,
        options?: GetOptions<Value<K>>,
    ): StorageValidator<Value<K>> | undefined => {
        return options?.validate ?? storageOptions.validate?.(key);
    };

    const getCachedValue = <K extends Key>(key: K, raw: string | null): Value<K> | undefined => {
        const cached = cache.get(key);
        if (cached && cached.raw === raw) {
            return cached.parsed as Value<K>;
        }
        return undefined;
    };

    const parseAndValidate = <K extends Key>(raw: string, validator?: StorageValidator<Value<K>>): Value<K> => {
        let parsed: unknown = JSON.parse(raw);

        if (validator && parsed !== null) {
            parsed = validator(parsed);
        }

        return parsed as Value<K>;
    };

    function get<K extends Key>(key: K, options?: GetOptions<Value<K>>): Value<K> | null;
    function get<K extends Key>(key: K, options: GetOptionsWithDefault<Value<K>>): Value<K>;
    function get<K extends Key>(
        key: K,
        options?: GetOptions<Value<K>> | GetOptionsWithDefault<Value<K>>,
    ): Value<K> | null {
        const nativeStorage = getStorage();
        const defaultValue = (options as GetOptionsWithDefault<Value<K>> | undefined)?.defaultValue;

        if (!nativeStorage) {
            return defaultValue ?? null;
        }

        try {
            const raw = nativeStorage.getItem(key);
            const cachedValue = getCachedValue(key, raw);

            if (cachedValue !== undefined) {
                return cachedValue;
            }

            if (!raw) {
                return defaultValue ?? null;
            }

            const validator = getValidator(key, options);
            const parsed = parseAndValidate(raw, validator);

            cache.set(key, { raw, parsed });
            return parsed;
        } catch (error) {
            console.warn(`[${type}] Invalid data for key "${key}":`, error);
            return defaultValue ?? null;
        }
    }

    const dispatchStorageEvent = (eventName: string): void => {
        if (isClient) {
            window.dispatchEvent(new CustomEvent(eventName));
        }
    };

    function set<K extends Key>(key: K, value: Value<K>, options?: SetOptions<Value<K>>): Value<K> | null {
        const nativeStorage = getStorage();

        if (!nativeStorage) {
            return null;
        }

        try {
            const validator = options?.validate ?? storageOptions.validate?.(key);
            const valueToSave = validator ? validator(value as unknown) : value;
            const raw = JSON.stringify(valueToSave);

            nativeStorage.setItem(key, raw);
            cache.set(key, { raw, parsed: valueToSave });
            dispatchStorageEvent(getCustomEventName(key));

            return valueToSave;
        } catch (error) {
            console.error(`[${type}] Failed to save key "${key}":`, error);
            return null;
        }
    }

    function remove(key: Key): void {
        const nativeStorage = getStorage();

        nativeStorage?.removeItem(key);
        cache.delete(key);
        dispatchStorageEvent(getCustomEventName(key));
    }

    function clear(): void {
        const nativeStorage = getStorage();

        nativeStorage?.clear();
        cache.clear();
        dispatchStorageEvent(CLEAR_STORAGE_EVENT);
    }

    const storage: TypedStorage<S> = { get, set, remove, clear };
    const useStorageItem = createStorageHook<S>(storage);
    const entry = { storage, useStorageItem };
    registry.set(type, entry);

    return entry;
}
