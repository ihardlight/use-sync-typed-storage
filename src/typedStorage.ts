import type {
  GetOptions,
  GetOptionsWithDefault,
  SetOptions,
  StorageKey,
  StorageType,
  StorageValidator,
  TypedStorage,
  TypedStorageError,
  TypedStorageValue,
} from './types.js';
import { INVALID, createNativeAccess, createSubscribe, createValueReader, defaultOnError } from './backend.js';
import { getClearEventName, getKeyEventName } from './utils.js';
import { createStorageHook } from './use-typed-storage-item.js';

export interface CreateTypedStorageOptions<S extends TypedStorageValue> {
  validate?: <K extends keyof S>(key: K) => StorageValidator<S[K]>;
  /** Called on storage errors. Defaults to logging with `console.warn` / `console.error`. */
  onError?: (error: TypedStorageError) => void;
}

export interface TypedStorageInstance<S extends TypedStorageValue> {
  storage: TypedStorage<S>;
  useStorageItem: ReturnType<typeof createStorageHook<S>>;
}

const registry = new Map<StorageType, unknown>();

export function resetTypedStorageRegistry(): void {
  registry.clear();
}

export function createTypedStorage<S extends TypedStorageValue>(
  type: StorageType = 'localStorage',
  config?: CreateTypedStorageOptions<S>,
) {
  type Key = StorageKey<S>;
  type Value<K extends Key> = S[K];

  const existing = registry.get(type);
  if (existing) {
    console.warn(
      `[use-sync-typed-storage] Storage "${type}" already created. Returning existing instance. Call resetTypedStorageRegistry() between tests.`,
    );
    return existing as TypedStorageInstance<S>;
  }

  const isClient = typeof window !== 'undefined';
  const options = config ?? {};

  const report = (error: Omit<TypedStorageError, 'storageType'>): void => {
    (options.onError ?? defaultOnError)({ ...error, storageType: type });
  };

  const native = createNativeAccess(type, report);
  const reader = createValueReader(native, report);

  const resolveValidator = (key: Key, validate: StorageValidator<unknown> | undefined) =>
    validate ?? (options.validate?.(key) as StorageValidator<unknown> | undefined);

  const dispatch = (eventName: string): void => {
    if (isClient) {
      window.dispatchEvent(new CustomEvent(eventName));
    }
  };

  function get<K extends Key>(key: K, getOptions?: GetOptions<Value<K>>): Value<K> | null;
  function get<K extends Key>(key: K, getOptions: GetOptionsWithDefault<Value<K>>): Value<K>;
  function get<K extends Key>(
    key: K,
    getOptions?: GetOptions<Value<K>> | GetOptionsWithDefault<Value<K>>,
  ): Value<K> | null {
    const fallback = (getOptions as GetOptionsWithDefault<Value<K>> | undefined)?.defaultValue ?? null;

    if (!isClient) {
      return fallback;
    }

    // Missing and invalid values fall back to the default; a stored `null` is returned as is.
    const validator = resolveValidator(key, getOptions?.validate as StorageValidator<unknown> | undefined);
    const value = reader.read(key, validator);
    return value === INVALID ? fallback : (value as Value<K>);
  }

  function set<K extends Key>(key: K, value: Value<K>, setOptions?: SetOptions<Value<K>>): Value<K> | null {
    if (!isClient) {
      return null;
    }

    const validator = resolveValidator(key, setOptions?.validate as StorageValidator<unknown> | undefined);
    let entry: { raw: string; value: unknown } | null = null;

    try {
      const validated = validator ? validator(value) : value;
      entry = { raw: JSON.stringify(validated), value: validated };
    } catch (error) {
      report({ kind: 'invalid', operation: 'set', key, error });
      return null;
    }

    // A failed native write still lands in memory, so subscribers see it and `set` returns the value.
    native.write(key, entry.raw, 'set');
    reader.remember(key, entry);
    dispatch(getKeyEventName(type, key));

    return entry.value as Value<K>;
  }

  function remove(key: Key): void {
    if (!isClient) {
      return;
    }

    native.write(key, null, 'remove');
    reader.forget(key);
    dispatch(getKeyEventName(type, key));
  }

  function clear(): void {
    if (!isClient) {
      return;
    }

    native.clear();
    reader.forget();
    dispatch(getClearEventName(type));
  }

  const storage: TypedStorage<S> = { get, set, remove, clear, subscribe: createSubscribe(type, native) };
  const instance: TypedStorageInstance<S> = { storage, useStorageItem: createStorageHook<S>(storage) };

  registry.set(type, instance);

  return instance;
}
