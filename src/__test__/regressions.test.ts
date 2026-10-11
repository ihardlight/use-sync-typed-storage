import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypedStorage, resetTypedStorageRegistry } from '../typedStorage.js';
import { useTypedStorageItem } from '../use-typed-storage-item.js';
import type { TypedStorageError } from '../types.js';

let renderHook: any;

try {
  const rtl = await import('@testing-library/react');
  if (rtl.renderHook) {
    renderHook = rtl.renderHook;
  } else {
    const rtlHooks = await import('@testing-library/react-hooks');
    renderHook = rtlHooks.renderHook;
  }
} catch {
  const rtlHooks = await import('@testing-library/react-hooks');
  renderHook = rtlHooks.renderHook;
}

type Schema = {
  count: number;
  user: { name: string } | null;
};

describe('regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetTypedStorageRegistry();
    vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    vi.spyOn(console, 'error').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when accessing window.localStorage throws (blocked cookies)', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const errors: TypedStorageError[] = [];
    const { storage } = createTypedStorage<Schema>('localStorage', { onError: (error) => errors.push(error) });

    expect(storage.get('count', { defaultValue: 1 })).toBe(1);
    expect(storage.set('count', 5)).toBe(5);
    expect(storage.get('count')).toBe(5);
    expect(() => storage.remove('count')).not.toThrow();
    expect(storage.get('count')).toBeNull();
    expect(() => storage.clear()).not.toThrow();
    expect(errors.map((error) => error.kind)).toEqual(['unavailable']);
  });

  it('falls back to memory when setItem throws and notifies subscribers', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const errors: TypedStorageError[] = [];
    const { storage, useStorageItem } = createTypedStorage<Schema>('localStorage', {
      onError: (error) => errors.push(error),
    });
    const { result } = renderHook(() => useStorageItem('count', { defaultValue: 0 }));

    act(() => {
      expect(result.current.set(7)).toBe(7);
    });

    expect(result.current.value).toBe(7);
    expect(storage.get('count')).toBe(7);
    expect(errors).toEqual([expect.objectContaining({ kind: 'write', operation: 'set', key: 'count' })]);
  });

  it('does not throw when removeItem throws', () => {
    const { storage } = createTypedStorage<Schema>();
    storage.set('count', 3);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => storage.remove('count')).not.toThrow();
    expect(storage.get('count')).toBeNull();
    expect(() => storage.clear()).not.toThrow();
  });

  it('clear() behaves like the native clear()', () => {
    localStorage.setItem('foreign', 'x');
    const { storage } = createTypedStorage<Schema>();
    storage.set('count', 1);

    storage.clear();

    expect(localStorage.length).toBe(0);
  });

  it('clear() does not throw when the native clear() throws', () => {
    const { storage } = createTypedStorage<Schema>();
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => storage.clear()).not.toThrow();
  });

  it('reports a corrupted value once instead of on every read', () => {
    localStorage.setItem('count', '{oops');
    const onError = vi.fn();
    const { storage } = createTypedStorage<Schema>('localStorage', { onError });

    storage.get('count', { defaultValue: 0 });
    storage.get('count', { defaultValue: 0 });
    storage.get('count', { defaultValue: 0 });

    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'parse', key: 'count' }));
  });

  it('a second createTypedStorage call returns the first instance and keeps its config', () => {
    const first = createTypedStorage<Schema>('localStorage', { validate: () => (() => 1) as any });
    const second = createTypedStorage<Schema>('localStorage', { validate: () => (() => 2) as any });

    expect(second).toBe(first);
    expect(console.warn).toHaveBeenCalled();
    expect(first.storage.set('count', 0)).toBe(1);
  });

  it('does not cache values that failed validation', () => {
    localStorage.setItem('count', '5');
    const { storage } = createTypedStorage<Schema>();
    const reject = () => {
      throw new Error('nope');
    };

    expect(storage.get('count', { validate: reject, defaultValue: 0 })).toBe(0);
    expect(storage.get('count')).toBe(5);
  });

  it('keeps objects returned by the global validator referentially stable', () => {
    localStorage.setItem('user', '{"name":"a"}');
    const { storage } = createTypedStorage<Schema>('localStorage', { validate: () => (value: any) => ({ ...value }) });

    expect(storage.get('user')).toBe(storage.get('user'));
  });

  it('works with a custom TypedStorage that has no subscribe', () => {
    const { storage } = createTypedStorage<Schema>();
    const { subscribe: _omit, ...custom } = storage;
    const { result } = renderHook(() => useTypedStorageItem('count', { storage: custom, defaultValue: 0 }));

    act(() => {
      localStorage.setItem('count', '3');
      window.dispatchEvent(new StorageEvent('storage', { key: 'count', storageArea: localStorage }));
    });

    expect(result.current.value).toBe(3);
  });

  it('returns a stored null as is, like 1.3.0', () => {
    localStorage.setItem('user', 'null');
    const { storage } = createTypedStorage<Schema>();

    expect(storage.get('user', { defaultValue: { name: 'guest' } })).toBeNull();
  });

  it('treats an empty string as missing without reporting', () => {
    localStorage.setItem('count', '');
    const onError = vi.fn();
    const { storage } = createTypedStorage<Schema>('localStorage', { onError });

    expect(storage.get('count', { defaultValue: 4 })).toBe(4);
    expect(onError).not.toHaveBeenCalled();
  });

  it('distinguishes a rejected value from a failed write', () => {
    const errors: TypedStorageError[] = [];
    const { storage } = createTypedStorage<Schema>('localStorage', { onError: (error) => errors.push(error) });
    const reject = () => {
      throw new Error('nope');
    };

    expect(storage.set('count', 1, { validate: reject })).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(storage.set('count', 2)).toBe(2);

    expect(errors.map((error) => error.kind)).toEqual(['invalid', 'write']);
  });

  it('ignores storage events from a different storage area', () => {
    const { useStorageItem } = createTypedStorage<Schema>('localStorage');
    const render = vi.fn();
    renderHook(() => {
      render();
      return useStorageItem('count');
    });
    const renders = render.mock.calls.length;

    act(() => {
      sessionStorage.setItem('count', '5');
      window.dispatchEvent(new StorageEvent('storage', { key: 'count', storageArea: sessionStorage }));
    });

    expect(render).toHaveBeenCalledTimes(renders);
  });

  it('local and session instances do not share change events', () => {
    const local = createTypedStorage<Schema>('localStorage');
    const session = createTypedStorage<Schema>('sessionStorage');
    const callback = vi.fn();
    local.storage.subscribe?.('count', callback);

    session.storage.set('count', 1);
    session.storage.clear();

    expect(callback).not.toHaveBeenCalled();
  });
});
