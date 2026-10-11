export type StorageType = 'localStorage' | 'sessionStorage';

export type TypedStorageValue = Record<string, unknown>;

export type StorageValidator<T> = (value: unknown) => T;

export type StorageKey<S extends TypedStorageValue> = Extract<keyof S, string>;

/**
 * - `unavailable`: the native storage threw on access (blocked cookies, sandboxed webview). In-memory fallback is used.
 * - `write`: the native storage rejected a write (quota, Safari private mode). The value is kept in memory.
 * - `parse`: the stored value is not valid JSON. The default value is returned.
 * - `invalid`: a validator rejected the value (stored value on `get`, new value on `set`).
 */
export type TypedStorageErrorKind = 'unavailable' | 'write' | 'parse' | 'invalid';

export interface TypedStorageError {
  kind: TypedStorageErrorKind;
  operation: 'get' | 'set' | 'remove' | 'clear';
  storageType: StorageType;
  key: string | null;
  error: unknown;
}

export interface GetOptions<T> {
  validate?: StorageValidator<T> | undefined;
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

  /** Returns the saved value, or `null` if the validator rejected it (or on the server). */
  set<K extends StorageKey<S>>(key: K, value: S[K], options?: SetOptions<S[K]>): S[K] | null;

  remove(key: StorageKey<S>): void;

  clear(): void;

  /**
   * Calls `callback` whenever `key` changes in this tab or another one. Returns an unsubscribe function.
   * Optional for custom implementations: without it, hooks only react to native `storage` events from other tabs.
   */
  subscribe?(key: StorageKey<S>, callback: () => void): () => void;
}
