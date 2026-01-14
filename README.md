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
- 📦 **Zero Dependencies**: Core logic is dependency-free (only peer-depends on React).

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

Create a central storage instance. This acts as your "Single Source of Truth".
```typescript
// storage.ts
import { createTypedStorage } from 'use-sync-typed-storage';

type MyStorageSchema = {
    theme: 'light' | 'dark';
    notifications: boolean;
    user: { id: number; name: string } | null;
}

export const myStorage = createTypedStorage<MyStorageSchema>('localStorage');
```
### 2. Use in components
```tsx
import { useTypedStorageItem } from 'use-sync-typed-storage';
import { myStorage } from './storage';

function ThemeToggle() {
    const { value, set } = useTypedStorageItem('theme', {
        storage: myStorage,
        defaultValue: 'light'
    });
    
    return (
        <button onClick={() => set(value === 'light' ? 'dark' : 'light')}>
            Current mode: {value}
        </button>
    );
}
```
**NB: Always create your storage instance outside of React components or memoize it**

## Advanced Features

### Runtime Validation (e.g., with Zod)

Protect your app from corrupted or manually edited data in `localStorage`.
```typescript
import { z } from 'zod';

const UserSchema = z.object({
    id: z.number(),
    name: z.string()
});

const { value } = useTypedStorageItem('user', {
    storage: myStorage,
    validate: (data) => UserSchema.parse(data), // Throws or returns sanitized data
    defaultValue: null
});
```
### Direct Storage Access (Outside React)

You can read or write to storage anywhere in your app. All active hooks will automatically update their state.
```typescript
// In some API utility or event handler
myStorage.set('notifications', true);

// Clear all data managed by this instance
myStorage.clear();
```
### Server-Side Rendering (SSR)

The library is SSR-safe. On the server, it will always return the `defaultValue` (or `null`) and will synchronize with the actual browser storage immediately after hydration.

## API Reference

### `createTypedStorage<T>(type: 'localStorage' | 'sessionStorage')`
Creates a typed storage instance.
- `get(key, options)`
- `set(key, value, options)`
- `remove(key)`
- `clear()`

### `useTypedStorageItem(key, options)`
React hook to subscribe to a specific key.
- `options.storage`: The instance created by `createTypedStorage`.
- `options.defaultValue`: Initial value if key is empty.
- `options.validate`: Optional function to validate/transform data.

