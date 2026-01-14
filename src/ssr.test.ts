/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { createTypedStorage } from './typedStorage.js';

describe('SSR Compatibility (Node Environment)', () => {
    it('should not throw when window is undefined', () => {
        expect(() => createTypedStorage()).not.toThrow();
    });

    it('should return defaultValue during SSR', () => {
        const storage = createTypedStorage<{ count: number }>();
        const val = storage.get('count', { defaultValue: 10 });

        expect(val).toBe(10);
    });

    it('should not fail on set/remove/clear calls', () => {
        const storage = createTypedStorage<{ count: number }>();

        expect(() => storage.set('count', 5)).not.toThrow();
        expect(() => storage.remove('count')).not.toThrow();
        expect(() => storage.clear()).not.toThrow();
    });
});