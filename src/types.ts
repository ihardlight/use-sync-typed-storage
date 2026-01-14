export type StorageType = "localStorage" | "sessionStorage";

export type TypedStorageValue = Record<string, unknown>;
export type StorageValidator<T> = (value: unknown) => T;

export type TypedStorage<S extends TypedStorageValue> = {
    get<K extends Extract<keyof S, string>>(
        key: K,
        options?: { defaultValue?: S[K] | undefined; validate?: StorageValidator<S[K]> | undefined; },
    ): S[K] | null;
    set<K extends Extract<keyof S, string>>(
        key: K,
        value: S[K],
        options?: { validate?: StorageValidator<S[K]> | undefined },
    ): S[K] | null;
    remove(key: Extract<keyof S, string>): void;
    clear(): void;
};
