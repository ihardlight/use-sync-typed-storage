# use-sync-typed-storage

A lightweight ( < 1KB ), type-safe, and reactive wrapper for `localStorage` and `sessionStorage` with built-in validation support and automatic cross-tab synchronization.

[![CI](https://github.com/ihardlight/use-sync-typed-storage/actions/workflows/ci.yml/badge.svg)](https://github.com/ihardlight/use-sync-typed-storage/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/use-sync-typed-storage.svg)](https://www.npmjs.com/package/use-sync-typed-storage)

## Why this library?

Managing `localStorage` in React often leads to inconsistent UI state, missing type safety, and "manual" synchronization between tabs. This library solves these issues by using the modern `useSyncExternalStore` API.

## Features

- 🛡️ **Strictly Typed**: Define your storage schema once and get full autocomplete.
- 🔄 **Reactive & Synced**: Updates instantly across different components and browser tabs.
- ✅ **Schema Validation**: Optional validation layer (works perfectly with Zod, Valibot, etc.).
- 🚀 **Performance Optimized**: Internal caching prevents unnecessary JSON parsing and re-renders.
- 🌍 **SSR Ready**: Safe for Next.js, Remix, and other server-side rendering environments.
- 🧯 **Never throws**: If storage is blocked (Safari with cookies disabled, sandboxed webviews) or full, values are kept in memory for the page and hooks still update.
- 📦 **Zero Dependencies**: Uses React's built-in `useSyncExternalStore` (React 18+), with a small built-in fallback for React 16.8/17.

## Installation

```bash
pnpm add use-sync-typed-storage
# or
npm install use-sync-typed-storage
# or
yarn add use-sync-typed-storage
```

## Quick Start

### 1. Define your storage schema

Create a central storage file once. `createTypedStorage` is a singleton — calling it twice for the same storage type returns the same instance and logs a warning in development.

```typescript
// storage.ts
import { createTypedStorage } from 'use-sync-typed-storage';

type MyStorageSchema = {
  theme: 'light' | 'dark';
  notifications: boolean;
  user: { id: number; name: string } | null;
};

export const { storage, useStorageItem } = createTypedStorage<MyStorageSchema>('localStorage');
```

### 2. Use in components

```tsx
import { useStorageItem } from './storage';

function ThemeToggle() {
  const { value, set } = useStorageItem('theme', { defaultValue: 'light' });

  return <button onClick={() => set(value === 'light' ? 'dark' : 'light')}>Current mode: {value}</button>;
}
```

## Advanced Features

### Runtime Validation (e.g., with Zod)

Protect your app from corrupted or manually edited data in `localStorage`.

```typescript
import { z } from 'zod';
import { useStorageItem } from './storage';

const UserSchema = z.object({ id: z.number(), name: z.string() });

const { value } = useStorageItem('user', {
  validate: (data) => UserSchema.parse(data),
  defaultValue: null,
});
```

### Global Validator (per-key, at storage creation)

You can define validators for all keys centrally at creation time:

```typescript
export const { storage, useStorageItem } = createTypedStorage<MyStorageSchema>('localStorage', {
  validate: (key) => (value) => {
    if (key === 'theme' && value !== 'light' && value !== 'dark') return 'light';
    return value;
  },
});
```

### Direct Storage Access (Outside React)

You can read or write to storage anywhere in your app. All active hooks will automatically update their state.

```typescript
import { storage } from './storage';

// In some API utility or event handler
storage.set('notifications', true);

// Clear all data (same as the native clear())
storage.clear();
```

### Error handling

Storage operations never throw. Errors go to `onError`, which by default logs to the console:

```typescript
createTypedStorage<MyStorageSchema>('localStorage', {
  onError: ({ kind, operation, key, error }) => reportToSentry(error, { kind, operation, key }),
});
```

| `kind`        | When                                                             | Result                                                |
| ------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `unavailable` | Accessing the storage threw (blocked cookies, sandboxed webview) | In-memory storage is used for the page                |
| `write`       | `setItem` / `removeItem` threw (quota exceeded, Safari private)  | The change is kept in memory; `set` returns the value |
| `parse`       | The stored value is not valid JSON                               | `defaultValue` (reported once per value)              |
| `invalid`     | A validator threw, on `get` (stored value) or `set` (new value)  | `defaultValue` on `get`, `null` on `set`              |

### Server-Side Rendering (SSR)

The library is SSR-safe. On the server, it will always return the `defaultValue` (or `null`) and will synchronize with the actual browser storage immediately after hydration.

## API Reference

### `createTypedStorage<T>(type?, options?)`

Returns `{ storage, useStorageItem }`. Singleton per storage type — calling it twice for the same `type` returns the existing instance with a dev warning.

- `type`: `'localStorage'` (default) or `'sessionStorage'`
- `options.validate`: `(key) => (value) => T` — global per-key validator
- `options.onError`: `(error: TypedStorageError) => void` — see [Error handling](#error-handling)

#### `storage`

Direct access to storage, usable outside React components:

- `storage.get(key, options?)` — returns `options.defaultValue` (or `null`) when the key is missing or its value is invalid
- `storage.set(key, value, options?)` — returns the saved value, or `null` if the validator rejected it
- `storage.remove(key)`
- `storage.clear()` — same as the native `clear()`
- `storage.subscribe(key, callback)` — returns an unsubscribe function. Optional when you implement `TypedStorage` yourself; without it, hooks react only to native `storage` events from other tabs.

#### `useStorageItem(key, options?)`

React hook to subscribe to a specific key.

- `options.defaultValue`: Value returned when the key is absent or invalid.
- `options.validate`: Per-call validator/transformer function.

Returns `{ value, set, remove }`.

### `resetTypedStorageRegistry()`

Clears the singleton registry, including the in-memory fallback. Intended for use in tests only.

```typescript
import { resetTypedStorageRegistry } from 'use-sync-typed-storage';

beforeEach(() => {
  resetTypedStorageRegistry();
});
```
