import type { StorageType } from './types.js';

export function getKeyEventName(type: StorageType, key: string) {
  return `use-sync-typed-storage:${type}:key:${key}`;
}

export function getClearEventName(type: StorageType) {
  return `use-sync-typed-storage:${type}:clear`;
}

export function noop() {
  // no nothing
}
