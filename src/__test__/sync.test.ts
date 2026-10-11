import { act } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypedStorage, resetTypedStorageRegistry } from '../typedStorage.js';

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
  theme: 'light' | 'dark';
  user: { name: string };
};

function emitFromOtherTab(init: StorageEventInit): void {
  window.dispatchEvent(new StorageEvent('storage', init));
}

describe('synchronization', () => {
  let local: ReturnType<typeof createTypedStorage<Schema>>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetTypedStorageRegistry();
    local = createTypedStorage<Schema>('localStorage');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('within one page', () => {
    it('two hooks on the same key stay in sync', () => {
      const first = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));
      const second = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));

      act(() => {
        first.result.current.set(5);
      });

      expect(second.result.current.value).toBe(5);
      expect(localStorage.getItem('count')).toBe('5');
    });

    it('hooks see storage.set / remove / clear called outside React', () => {
      const count = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));
      const theme = renderHook(() => local.useStorageItem('theme', { defaultValue: 'light' }));

      act(() => {
        local.storage.set('count', 3);
        local.storage.set('theme', 'dark');
      });
      expect(count.result.current.value).toBe(3);
      expect(theme.result.current.value).toBe('dark');

      act(() => {
        local.storage.remove('count');
      });
      expect(count.result.current.value).toBe(0);
      expect(theme.result.current.value).toBe('dark');

      act(() => {
        local.storage.clear();
      });
      expect(theme.result.current.value).toBe('light');
    });

    it('localStorage and sessionStorage hooks on the same key are independent', () => {
      const session = createTypedStorage<Schema>('sessionStorage');
      const localHook = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));
      const sessionHook = renderHook(() => session.useStorageItem('count', { defaultValue: 0 }));

      act(() => {
        session.storage.set('count', 9);
      });

      expect(sessionHook.result.current.value).toBe(9);
      expect(localHook.result.current.value).toBe(0);
    });

    it('stays in sync through the in-memory fallback when writes fail', () => {
      vi.spyOn(console, 'error').mockImplementation(vi.fn());
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const first = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));
      const second = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));

      act(() => {
        first.result.current.set(2);
      });

      expect(second.result.current.value).toBe(2);
    });

    it('an inline validator returning new objects keeps the value stable (no render loop)', () => {
      local.storage.set('user', { name: 'a' });
      const seen = new Set<unknown>();

      const { result, rerender } = renderHook(() => {
        const item = local.useStorageItem('user', { validate: (data) => ({ ...(data as { name: string }) }) });
        const [, setMirror] = useState<unknown>(null);
        useEffect(() => {
          setMirror(item.value);
        }, [item.value]);
        seen.add(item.value);
        return item;
      });
      rerender();
      rerender();

      expect(result.current.value).toEqual({ name: 'a' });
      expect(seen.size).toBe(1);
    });
  });

  describe('across tabs', () => {
    it('updates on a storage event from another tab', () => {
      const { result } = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));

      act(() => {
        localStorage.setItem('count', '7');
        emitFromOtherTab({ key: 'count', newValue: '7', storageArea: localStorage });
      });

      expect(result.current.value).toBe(7);
    });

    it('accepts synthetic storage events without storageArea, as 1.3.0 did', () => {
      const { result } = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));

      act(() => {
        localStorage.setItem('count', '8');
        emitFromOtherTab({ key: 'count', newValue: '8' });
      });

      expect(result.current.value).toBe(8);
    });

    it('resets on a native clear() in another tab', () => {
      local.storage.set('count', 1);
      const { result } = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));

      act(() => {
        localStorage.clear();
        emitFromOtherTab({ key: null, storageArea: localStorage });
      });

      expect(result.current.value).toBe(0);
    });

    it('does not re-render for other keys', () => {
      const render = vi.fn();
      renderHook(() => {
        render();
        return local.useStorageItem('count');
      });
      const renders = render.mock.calls.length;

      act(() => {
        localStorage.setItem('theme', '"dark"');
        emitFromOtherTab({ key: 'theme', storageArea: localStorage });
      });

      expect(render).toHaveBeenCalledTimes(renders);
    });

    it('a value from another tab supersedes the local in-memory fallback', () => {
      vi.spyOn(console, 'error').mockImplementation(vi.fn());
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const { result } = renderHook(() => local.useStorageItem('count', { defaultValue: 0 }));

      act(() => {
        result.current.set(1);
      });
      expect(result.current.value).toBe(1);

      setItem.mockRestore();
      act(() => {
        localStorage.setItem('count', '5');
        emitFromOtherTab({ key: 'count', storageArea: localStorage });
      });

      expect(result.current.value).toBe(5);
    });

    it('removes its listeners on unmount', () => {
      const removeListener = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => local.useStorageItem('count'));

      unmount();

      expect(removeListener).toHaveBeenCalledWith('storage', expect.any(Function));
    });
  });
});
