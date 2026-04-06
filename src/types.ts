export type StorageType = 'localStorage' | 'sessionStorage';

export type TypedStorageValue = Record<string, unknown>;

export type StorageValidator<T> = (value: unknown) => T;

export type StorageKey<S extends TypedStorageValue> = Extract<keyof S, string>;

export interface GetOptions<T> {
  validate?: StorageValidator<T>;
}

export interface GetOptionsWithDefault<T> extends GetOptions<T> {
  defaultValue: T;
}

export interface SetOptions<T> {
  validate?: StorageValidator<T> | undefined;
}

export interface TypedStorage<S extends TypedStorageValue> {
  get<K extends StorageKey<S>>(key: K, options?: GetOptions<S[K]>): S[K] | null;

  get<K extends StorageKey<S>>(key: K, options: GetOptionsWithDefault<S[K]>): S[K];

  set<K extends StorageKey<S>>(key: K, value: S[K], options?: SetOptions<S[K]>): S[K] | null;

  remove(key: StorageKey<S>): void;

  clear(): void;
}
