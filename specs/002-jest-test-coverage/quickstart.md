# Quickstart: Running Tests

**Feature**: 002-jest-test-coverage
**Date**: 2026-02-28

## Prerequisites

- Node.js 20+ LTS
- npm

No database, API keys, or network access required.

## Setup

```bash
npm install
```

This installs all dependencies including test devDependencies (jest, ts-jest, @jest/globals, @types/jest).

## Running Tests

### Run all tests

```bash
npm test
```

This executes `node --experimental-vm-modules node_modules/.bin/jest` which:

1. Loads `jest.config.cjs` configuration
2. Discovers all `*.test.ts` files in the `tests/` directory
3. Transforms TypeScript via ts-jest with ESM support
4. Runs all test suites and reports results

### Run tests in watch mode

```bash
npm run test:watch
```

Re-runs affected tests automatically when source or test files change.

### Run a specific test file

```bash
node --experimental-vm-modules node_modules/.bin/jest tests/domain/ai/service.test.ts
```

### Run tests matching a pattern

```bash
node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="domain"
```

## Test Structure

Tests mirror the source directory:

```
tests/
├── config/                      → src/config/
├── domain/
│   ├── ai/                      → src/domain/ai/
│   ├── character/               → src/domain/character/
│   └── story/                   → src/domain/story/
├── infrastructure/
│   └── ydb/
│       └── repositories/        → src/infrastructure/ydb/repositories/
└── telegram/
    ├── commands/                 → src/telegram/commands/
    ├── handlers/                 → src/telegram/handlers/
    └── middleware/               → src/telegram/middleware/
```

## Writing a New Test

1. Create a `.test.ts` file in `tests/` mirroring the source path
2. Import test utilities from `@jest/globals`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
```

1. Use `jest.unstable_mockModule()` for mocking, followed by dynamic `await import()`:

```typescript
jest.unstable_mockModule('../../src/infrastructure/openai/client.js', () => ({
  getOpenAIClient: jest.fn(),
}));

const { myFunction } = await import('../../src/module/under/test.js');
```

1. Run `npm test` — no additional configuration needed.

## Key Conventions

- All external dependencies (OpenAI, YDB, Telegram) are mocked — tests never make real API calls
- Each test file is self-contained with its own mock setup
- Use `beforeEach(() => jest.clearAllMocks())` to reset mock state between tests
- Test both happy paths and error paths for each function
