import type { StorageType, StorageValidator, TypedStorageError } from './types.js';
import { getClearEventName, getKeyEventName, noop } from './utils.js';

export type Operation = TypedStorageError['operation'];

export type Report = (error: Omit<TypedStorageError, 'storageType'>) => void;

export function defaultOnError({ kind, operation, storageType, key, error }: TypedStorageError): void {
  const target = `[use-sync-typed-storage] ${storageType}${key === null ? '' : ` key "${key}"`}`;

  switch (kind) {
    case 'unavailable': {
      console.warn(`${target}: storage is not accessible, falling back to in-memory storage.`, error);
      break;
    }
    case 'write': {
      console.error(`${target}: ${operation} failed, the change is kept in memory for this page only.`, error);
      break;
    }
    case 'parse': {
      console.warn(`${target}: stored value is not valid JSON, using the default value.`, error);
      break;
    }
    case 'invalid': {
      if (operation === 'set') {
        console.error(`${target}: value rejected by the validator and not saved.`, error);
      } else {
        console.warn(`${target}: stored value rejected by the validator, using the default value.`, error);
      }
      break;
    }
    default: {
      break;
    }
  }
}

export const INVALID: unique symbol = Symbol('invalid');

/** Parses and validates a raw stored string. Returns `INVALID` (after reporting) if either step fails. */
export function parseRaw(
  raw: string,
  validator: StorageValidator<unknown> | undefined,
  onError: (kind: 'parse' | 'invalid', error: unknown) => void,
): unknown {
  let value: unknown = null;

  try {
    value = JSON.parse(raw);
  } catch (error) {
    onError('parse', error);
    return INVALID;
  }

  if (!validator || value === null) {
    return value;
  }

  try {
    return validator(value);
  } catch (error) {
    onError('invalid', error);
    return INVALID;
  }
}

/**
 * Native storage access that never throws: failures are reported and served from an in-memory fallback.
 * `memory` holds values that could not be written natively; `null` marks a key removed in memory only.
 */
export function createNativeAccess(type: StorageType, report: Report) {
  const isClient = typeof window !== 'undefined';
  const memory = new Map<string, string | null>();
  let resolved = false;
  let native: Storage | null = null;

  const getNative = (operation: Operation): Storage | null => {
    if (!isClient) {
      return null;
    }

    if (!resolved) {
      resolved = true;
      try {
        native = window[type];
      } catch (error) {
        report({ kind: 'unavailable', operation, key: null, error });
      }
    }

    return native;
  };

  const read = (key: string): string | null => {
    if (memory.has(key)) {
      return memory.get(key) ?? null;
    }

    try {
      return getNative('get')?.getItem(key) ?? null;
    } catch (error) {
      report({ kind: 'unavailable', operation: 'get', key, error });
      return null;
    }
  };

  const write = (key: string, raw: string | null, operation: Operation): void => {
    const storage = getNative(operation);

    if (storage) {
      try {
        if (raw === null) {
          storage.removeItem(key);
        } else {
          storage.setItem(key, raw);
        }
        memory.delete(key);
        return;
      } catch (error) {
        report({ kind: 'write', operation, key, error });
      }
    }

    memory.set(key, raw);
  };

  const clear = (): void => {
    memory.clear();

    try {
      getNative('clear')?.clear();
    } catch (error) {
      report({ kind: 'write', operation: 'clear', key: null, error });
    }
  };

  /**
   * Whether a `storage` event from another tab concerns `key` in this storage. When it does, the native value
   * supersedes the in-memory fallback, so the fallback entry is dropped.
   */
  const acceptStorageEvent = (event: StorageEvent, key: string): boolean => {
    // Synthetic events without `storageArea` (e.g. in tests) are accepted, as before.
    if (event.storageArea !== null && event.storageArea !== getNative('get')) {
      return false;
    }

    if (event.key === null) {
      memory.clear();
      return true;
    }

    if (event.key === key) {
      memory.delete(key);
      return true;
    }

    return false;
  };

  return { read, write, clear, acceptStorageEvent };
}

type NativeAccess = ReturnType<typeof createNativeAccess>;

interface CacheEntry {
  raw: string;
  value: unknown;
}

/**
 * Reads values through a cache keyed by the raw string, which keeps returned objects referentially stable.
 * Only successfully validated values are cached; invalid ones are re-checked on each read but reported only once.
 * Returns `INVALID` when the key is missing or its value is unusable.
 */
export function createValueReader(native: NativeAccess, report: Report) {
  const cache = new Map<string, CacheEntry>();
  const reportedInvalid = new Map<string, string>();

  const read = (key: string, validator: StorageValidator<unknown> | undefined): unknown => {
    const raw = native.read(key);

    if (!raw) {
      return INVALID;
    }

    const cached = cache.get(key);
    if (cached?.raw === raw) {
      return cached.value;
    }

    const value = parseRaw(raw, validator, (kind, error) => {
      if (reportedInvalid.get(key) !== raw) {
        reportedInvalid.set(key, raw);
        report({ kind, operation: 'get', key, error });
      }
    });

    if (value === INVALID) {
      cache.delete(key);
      return INVALID;
    }

    reportedInvalid.delete(key);
    cache.set(key, { raw, value });
    return value;
  };

  const remember = (key: string, entry: CacheEntry): void => {
    cache.set(key, entry);
    reportedInvalid.delete(key);
  };

  const forget = (key?: string): void => {
    if (key === undefined) {
      cache.clear();
      reportedInvalid.clear();
    } else {
      cache.delete(key);
      reportedInvalid.delete(key);
    }
  };

  return { read, remember, forget };
}

/** Subscribes to changes of `key` made through this storage, by `clear()`, or natively in another tab. */
export function createSubscribe(type: StorageType, native: NativeAccess) {
  return (key: string, callback: () => void): (() => void) => {
    if (typeof window === 'undefined') {
      return noop;
    }

    const keyEventName = getKeyEventName(type, key);
    const clearEventName = getClearEventName(type);

    const handleStorageEvent = (event: StorageEvent): void => {
      if (native.acceptStorageEvent(event, key)) {
        callback();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener(keyEventName, callback);
    window.addEventListener(clearEventName, callback);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener(keyEventName, callback);
      window.removeEventListener(clearEventName, callback);
    };
  };
}
