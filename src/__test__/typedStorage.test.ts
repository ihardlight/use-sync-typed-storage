import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypedStorage, resetTypedStorageRegistry } from '../typedStorage.js';
import { CLEAR_STORAGE_EVENT, getCustomEventName } from '../utils.js';

type TestSchema = {
  user: { id: number; name: string };
  settings: { theme: 'light' | 'dark' };
  count: number;
};

describe('createTypedStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    resetTypedStorageRegistry();
  });

  describe('Basic Operations', () => {
    it('should correctly set and get values', () => {
      const { storage } = createTypedStorage<TestSchema>('localStorage');
      const user = { id: 1, name: 'John' };

      storage.set('user', user);
      expect(storage.get('user')).toEqual(user);
      expect(localStorage.getItem('user')).toBe(JSON.stringify(user));
    });

    it('should return defaultValue if key is missing', () => {
      const { storage } = createTypedStorage<TestSchema>();
      expect(storage.get('count', { defaultValue: 42 })).toBe(42);
    });

    it('should remove items from storage and cache', () => {
      const { storage } = createTypedStorage<TestSchema>();
      storage.set('count', 1);
      storage.remove('count');

      expect(storage.get('count')).toBeNull();
      expect(localStorage.getItem('count')).toBeNull();
    });

    it('should clear all items', () => {
      const { storage } = createTypedStorage<TestSchema>();
      storage.set('count', 1);
      storage.set('settings', { theme: 'dark' });

      storage.clear();

      expect(storage.get('count')).toBeNull();
      expect(localStorage.getItem('count')).toBeNull();
    });
  });

  describe('Caching & Referential Integrity', () => {
    it('should return the same object reference from cache', () => {
      const { storage } = createTypedStorage<TestSchema>();
      const user = { id: 1, name: 'Alice' };

      storage.set('user', user);

      const firstGet = storage.get('user');
      const secondGet = storage.get('user');

      expect(firstGet).toBe(secondGet);
      expect(firstGet).toBe(user);
    });

    it('should update cache when value is changed externally (if raw changes)', () => {
      const { storage } = createTypedStorage<TestSchema>();
      storage.set('count', 10);

      localStorage.setItem('count', '20');

      expect(storage.get('count')).toBe(20);
    });
  });

  describe('Validation', () => {
    it('should validate data on set', () => {
      const { storage } = createTypedStorage<TestSchema>();
      const validate = (val: any) => {
        if (val < 0) throw new Error('Negative');
        return val;
      };

      const result = storage.set('count', 5, { validate });
      expect(result).toBe(5);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      const invalidResult = storage.set('count', -1, { validate });

      expect(invalidResult).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should validate and sanitize data on get', () => {
      const { storage } = createTypedStorage<TestSchema>();
      localStorage.setItem('settings', JSON.stringify({ theme: 'invalid' }));

      const validate = (val: any) => {
        if (val.theme !== 'light' && val.theme !== 'dark') return { theme: 'light' };
        return val;
      };

      const result = storage.get('settings', { validate });
      expect(result).toEqual({ theme: 'light' });
    });

    it('should validate data with global validator', () => {
      const { storage } = createTypedStorage<TestSchema>('localStorage', {
        validate: (key) => (val: any) => {
          if (key === 'count' && val < 0) throw new Error('Negative');
          return val;
        },
      });

      const result = storage.set('count', 5);
      expect(result).toBe(5);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      const invalidResult = storage.set('count', -1);

      expect(invalidResult).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Events', () => {
    it('should dispatch custom event on set', () => {
      const { storage } = createTypedStorage<TestSchema>();
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      storage.set('count', 100);

      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: getCustomEventName('count') }));
    });

    it('should dispatch CLEAR_STORAGE_EVENT on clear', () => {
      const { storage } = createTypedStorage<TestSchema>();
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      storage.clear();

      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: CLEAR_STORAGE_EVENT }));
    });
  });

  describe('Error Handling', () => {
    it('should return defaultValue and warn on invalid JSON', () => {
      localStorage.setItem('count', 'invalid-json-{');
      const { storage } = createTypedStorage<TestSchema>();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());

      const result = storage.get('count', { defaultValue: 0 });

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
