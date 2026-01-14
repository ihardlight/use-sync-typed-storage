import {StorageType, StorageValidator, TypedStorage, TypedStorageValue} from './types.js';
import {CLEAR_STORAGE_EVENT, getCustomEventName} from './utils.js';

export function createTypedStorage<S extends TypedStorageValue>(
    type: StorageType = "localStorage",
    options?: { validate?: <K extends keyof S>(key: K) => StorageValidator<S[K]> },
): TypedStorage<S> {
    type Keys = Extract<keyof S, string>;
    type Value<K extends Keys> = S[K];
    const isClient = typeof window !== "undefined";
    const cache = new Map<string, { raw: string | null; parsed: any }>();
    const storageOptions = options || {};

    const getStorage = (): Storage | null => {
        if (!isClient) return null;

        return type === "localStorage"
            ? window.localStorage
            : window.sessionStorage;
    };

    return {
        get<K extends Keys>(
            key: K,
            options: {
                defaultValue?: Value<K>;
                validate?: StorageValidator<S[K]> | undefined;
            } = { validate: storageOptions.validate?.(key) },
        ): Value<K> | null {
            const storage = getStorage();
            if (!storage) return options?.defaultValue ?? null;

            try {
                const raw = storage.getItem(key);
                const cached = cache.get(key);
                if (cached && cached.raw === raw) {
                    return cached.parsed;
                }

                if (!raw) return options?.defaultValue ?? null;

                let parsed = JSON.parse(raw);
                if (options?.validate && parsed !== null) {
                    parsed = options.validate(parsed);
                }

                cache.set(key, { raw, parsed });
                return parsed;
            } catch (error) {
                console.warn(`[${type}] Invalid data for key "${key}":`, error);
                return options?.defaultValue ?? null;
            }
        },

        set<K extends Keys>(
            key: K, value: Value<K>,
            options: { validate?: StorageValidator<S[K]> | undefined;
        } = { validate: storageOptions.validate?.(key) }): Value<K> | null {
            const storage = getStorage();
            if (!storage) return null;

            try {
                const valueToSave = options?.validate ? options.validate(value) : value;
                const raw = JSON.stringify(valueToSave);
                storage.setItem(key, raw);
                cache.set(key, { raw, parsed: valueToSave });
                if (isClient) {
                    window.dispatchEvent(new CustomEvent(getCustomEventName(key)));
                }

                return valueToSave;
            } catch (error) {
                console.error(`[${type}] Failed to save key "${key}":`, error);
                return null;
            }
        },

        remove(key: Keys): void {
            getStorage()?.removeItem(key);
            cache.delete(key);
            if (isClient) {
                window.dispatchEvent(new CustomEvent(getCustomEventName(key)));
            }
        },

        clear() {
            getStorage()?.clear();
            cache.clear();
            if (isClient) {
                window.dispatchEvent(new CustomEvent(CLEAR_STORAGE_EVENT));
            }
        },
    };
}