import { defineConfig } from 'oxlint';

export default defineConfig({
    plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react', 'import', 'promise', 'vitest'],
    env: {
        browser: true,
        es2022: true,
    },
    settings: {
        react: {
            version: '19.0',
        },
    },
    categories: {
        correctness: 'error',
        suspicious: 'error',
        pedantic: 'warn',
        perf: 'warn',
        style: 'warn',
        restriction: 'warn',
    },
    rules: {
        // React 17+ automatic JSX transform — no need to import React
        'react/react-in-jsx-scope': 'off',

        // Libraries use named exports — default-only export rules don't apply
        'import/no-named-export': 'off',
        // Inline exports are idiomatic in TypeScript — consolidating them is not
        'import/group-exports': 'off',
        // A file with only type declarations / empty setup files are valid modules in TS
        'import/unambiguous': 'off',

        // Single-letter generic type parameters (S, K, T, D) are standard TypeScript convention
        'eslint/id-length': 'off',

        // function declarations are a valid and common style alongside expressions
        'eslint/func-style': 'off',

        // Block bodies in useCallback are more readable than implicit returns
        'eslint/arrow-body-style': 'off',

        // Library hooks are inherently complex — the default limits are too low
        // Factory functions that manage private closures are legitimately long
        'eslint/max-lines-per-function': ['warn', { max: 150 }],
        // Factory functions with many inner helpers can exceed the default
        'eslint/max-statements': ['warn', { max: 30 }],

        // Ternary operators are idiomatic and readable TypeScript
        'eslint/no-ternary': 'off',

        // `undefined` is a valid value in TypeScript — banning it is too restrictive
        'eslint/no-undefined': 'off',

        // Ternaries with `!== undefined` are clearer than the inverted form in some contexts
        'eslint/no-negated-condition': 'off',

        // Import ordering and key sorting are formatter concerns, not linter concerns
        'eslint/sort-imports': 'off',
        'eslint/sort-keys': 'off',

        // Destructuring is impossible when a type cast is required
        'eslint/prefer-destructuring': 'off',

        // Requiring explicit return types on every internal function is too verbose
        'typescript/explicit-function-return-type': 'off',
        'typescript/explicit-module-boundary-types': 'off',

        // The API contract explicitly uses null to mean "no value" — replacing with undefined breaks the API
        'unicorn/no-null': 'off',

        // Object spread {...obj} is standard ES2020+ — banning it is too restrictive
        'oxc/no-rest-spread-properties': 'off',

        // Optional chaining ?. is standard ES2020+ — banning it is too restrictive
        'oxc/no-optional-chaining': 'off',

        // useCallback's callback parameter is not a Node.js-style error-first callback
        'promise/prefer-await-to-callbacks': 'off',

        // window is explicitly required for browser-specific APIs (localStorage, dispatchEvent)
        'unicorn/prefer-global-this': 'off',

        // Brace style in single-statement if blocks is a formatting concern
        'eslint/curly': 'off',

        // Capitalization of inline explanatory comments is a minor style preference
        'eslint/capitalized-comments': 'off',

        // Inline exports at declaration site are idiomatic TypeScript style
        'import/exports-last': 'off',

        // Existing filenames use camelCase — renaming would break imports
        'unicorn/filename-case': 'off',

        // console.warn / console.error are intentional in library code (dev warnings, error reporting)
        'eslint/no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    overrides: [
        {
            files: ['**/*.test.ts', '**/*.test.tsx'],
            rules: {
                // Literal numbers in test assertions are expected and readable
                'eslint/no-magic-numbers': 'off',
                // Requiring timeouts on every test is overly verbose
                'vitest/require-test-timeout': 'off',
                // Some test files use @vitest-environment node and import explicitly
                'vitest/no-importing-vitest-globals': 'off',
                // Empty mock implementations (e.g. suppressing console) are valid in tests
                'eslint/no-empty-function': 'off',
                // Test suites are inherently long describe blocks
                'eslint/max-lines-per-function': 'off',
                // Describe title matching function name is the standard and expected convention
                'vitest/prefer-describe-function-title': 'off',
                // Adding type params to vi.fn() in every test is overly verbose
                'vitest/require-mock-type-parameters': 'off',
                // Validate helpers in tests are local by design — moving them out hurts readability
                'unicorn/consistent-function-scoping': 'off',
                // type aliases are perfectly valid for local test schemas
                'typescript/consistent-type-definitions': 'off',
                // `let` vars initialized in beforeEach is the standard vitest pattern
                'eslint/init-declarations': 'off',
                // any in test validators is acceptable — narrowing to unknown adds noise without safety benefit in tests
                'typescript/no-explicit-any': 'off',
            },
        },
        {
            files: ['**/*.config.ts'],
            rules: {
                'import/no-default-export': 'off',
            },
        },
    ],
    ignorePatterns: [
        'dist/**',
        // Empty vitest setup file — intentional placeholder
        'src/setupTests.ts',
    ],
});
