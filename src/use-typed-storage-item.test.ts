import {act} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useTypedStorageItem} from './use-typed-storage-item.js';
import {createTypedStorage} from './typedStorage.js';

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
    theme: 'light' | 'dark';
    count: number;
    user: { name: string };
}

describe('useTypedStorageItem', () => {
    const storage = createTypedStorage<Schema>();

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
    });


    it('should return default value initially', () => {
        const {result} = renderHook(() =>
            useTypedStorageItem('theme', {storage, defaultValue: 'light'}),
        );

        expect(result.current.value).toBe('light');
    });

    it('should update value when set is called', () => {
        const {result} = renderHook(() =>
            useTypedStorageItem('count', {storage, defaultValue: 0}),
        );

        act(() => {
            result.current.set(10);
        });

        expect(result.current.value).toBe(10);
        expect(storage.get('count')).toBe(10);
    });

    it('should update value when remove is called', () => {
        storage.set('theme', 'dark');
        const {result} = renderHook(() => useTypedStorageItem('theme', {storage}));

        expect(result.current.value).toBe('dark');

        act(() => {
            result.current.remove();
        });

        expect(result.current.value).toBeNull();
    });

    describe('Reactivity & Sync', () => {
        it('should react to external storage events (cross-tab sync)', () => {
            const {result} = renderHook(() =>
                useTypedStorageItem('theme', {storage, defaultValue: 'light'}),
            );

            act(() => {
                localStorage.setItem('theme', JSON.stringify('dark'));
                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'theme',
                    newValue: JSON.stringify('dark'),
                    storageArea: localStorage,
                }));
            });

            expect(result.current.value).toBe('dark');
        });

        it('should react to direct storage.set calls (local sync)', () => {
            const {result} = renderHook(() =>
                useTypedStorageItem('count', {storage, defaultValue: 0}),
            );

            act(() => {
                storage.set('count', 99);
            });

            expect(result.current.value).toBe(99);
        });

        it('should react to CLEAR_STORAGE_EVENT', () => {
            storage.set('theme', 'dark');
            const {result} = renderHook(() => useTypedStorageItem('theme', {storage}));

            act(() => {
                storage.clear();
            });

            expect(result.current.value).toBeNull();
        });
    });

    describe('Validation in Hook', () => {
        it('should use validation when setting value', () => {
            const validate = vi.fn((v) => v.toUpperCase());
            const {result} = renderHook(() =>
                useTypedStorageItem('theme', {storage, validate}),
            );

            act(() => {
                result.current.set('dark');
            });

            expect(result.current.value).toBe('DARK');
            expect(validate).toHaveBeenCalled();
        });

        it('should return defaultValue if stored data is invalid', () => {
            localStorage.setItem('count', JSON.stringify('not-a-number'));
            const validate = (v: any) => {
                if (typeof v !== 'number') throw new Error();
                return v;
            };

            const {result} = renderHook(() =>
                useTypedStorageItem('count', {storage, defaultValue: 0, validate}),
            );

            expect(result.current.value).toBe(0);
        });
    });

    describe('Memoization', () => {
        it('should return stable functions (set/remove)', () => {
            const {result, rerender} = renderHook(() =>
                useTypedStorageItem('theme', {storage}),
            );

            const firstSet = result.current.set;
            const firstRemove = result.current.remove;

            rerender();

            expect(result.current.set).toBe(firstSet);
            expect(result.current.remove).toBe(firstRemove);
        });
    });
});