# Research: Jest Test Coverage for All Functionality

**Feature**: 002-jest-test-coverage
**Date**: 2026-02-28

## R1: Jest Configuration for ESM TypeScript Project

**Decision**: Use Jest 29.x + ts-jest 29.4.x with `createDefaultEsmPreset()` and `moduleNameMapper` to strip `.js` extensions.

**Rationale**:

- The project uses `"type": "module"` with `.js` extensions in all imports (ESM convention with `moduleResolution: "nodenext"`)
- ts-jest 29.4.x has explicit ESM support via `createDefaultEsmPreset()` which sets `extensionsToTreatAsEsm: ['.ts']` and `useESM: true`
- `moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }` strips `.js` from relative imports so ts-jest resolves `.ts` source files
- Jest 29 + ts-jest 29.4.x is the most stable, well-tested combination (ts-jest has no 30.x release yet)
- Requires `--experimental-vm-modules` Node flag for Jest to load ESM modules

**Alternatives considered**:

- **@swc/jest**: Faster transforms but no type-checking, harder ESM mocking, extra `.swcrc` config
- **Jest 30 + ts-jest 29.4.x**: Works but version mismatch produces warnings; ts-jest 30.x doesn't exist yet
- **Native ESM without transformer**: Requires separate `tsc` build step, impractical for TS-source testing
- **Vitest**: Superior ESM support but user explicitly requested Jest

## R2: ESM Mocking Strategy

**Decision**: Use `jest.unstable_mockModule()` with dynamic `await import()` for modules that need mocking. Import test utilities from `@jest/globals`.

**Rationale**:

- In ESM mode, `jest.mock()` does not hoist — static imports are evaluated before any code runs
- `jest.unstable_mockModule(path, factory)` is the ESM-compatible mock API; factory is **required**
- The module under test must be dynamically imported **after** mock setup
- `@jest/globals` imports (`describe`, `it`, `expect`, `jest`) are required in ESM mode — globals are not automatically available

**Alternatives considered**:

- **`jest.mock()` with CJS transform**: Would avoid ESM mocking issues but conflicts with project's ESM module system
- **Dependency injection refactor**: Cleaner long-term but requires modifying production code, out of scope for this feature
- **`jest.spyOn` on singletons**: Only works when the singleton is accessible before test execution; timing issues with ESM

**Pattern for singleton mocking (OpenAI client, YDB driver)**:

```typescript
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../infrastructure/openai/client.js', () => ({
  getOpenAIClient: jest.fn(),
}));

const { generateCharacterStats } = await import('../ai/service.js');
const { getOpenAIClient } = await import('../../infrastructure/openai/client.js');
```

## R3: Dependencies to Install

**Decision**: Install `jest@^29.7.0`, `ts-jest@^29.4.6`, `@jest/globals@^29.7.0`, `@types/jest@^29.5.14` as devDependencies.

**Rationale**:

| Package | Version | Purpose |
|---------|---------|---------|
| jest | ^29.7.0 | Test runner, assertion library |
| ts-jest | ^29.4.6 | TypeScript transformer with ESM preset |
| @jest/globals | ^29.7.0 | Explicit imports for describe/it/expect/jest in ESM |
| @types/jest | ^29.5.14 | Type definitions for IDE support |

**Alternatives considered**:

- **jest@^30.2.0**: Latest but ts-jest 30.x doesn't exist; version mismatch may cause issues
- **ts-node**: Needed only for `jest.config.ts` loading; avoided by using `jest.config.cjs` instead

## R4: Jest Configuration File Format

**Decision**: Use `jest.config.cjs` (CommonJS format) to avoid needing `ts-node` as a dependency.

**Rationale**:

- Jest needs to load its config file before any transforms run
- `jest.config.ts` requires `ts-node` (unmaintained) or Node 22.6+ type stripping (has known bugs)
- `jest.config.cjs` is reliably loaded by Jest in any ESM project
- Keeps devDependencies minimal

**Alternatives considered**:

- **jest.config.ts + ts-node**: Adds unmaintained dependency
- **jest.config.mjs**: Works but `createDefaultEsmPreset` is easier to call from CJS `require()`

## R5: Test File Organization

**Decision**: Place tests in `tests/` directory mirroring `src/` structure with `.test.ts` suffix.

**Rationale**:

- Mirrors the existing 4-layer architecture (config/, domain/, infrastructure/, telegram/)
- Each test file corresponds to exactly one source file
- `roots: ['<rootDir>/tests']` in Jest config scopes test discovery
- `.test.ts` suffix is the Jest convention and auto-discovered by default

**Alternatives considered**:

- **Co-located tests (*.test.ts next to source)**: Common pattern but pollutes source tree and complicates build output
- **`__tests__/` directories**: Jest default but adds nesting; flat mirror is clearer for this project size
