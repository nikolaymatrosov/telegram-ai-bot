# Implementation Plan: Jest Test Coverage for All Functionality

**Branch**: `002-jest-test-coverage` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-jest-test-coverage/spec.md`

## Summary

Add comprehensive Jest unit tests covering all application functionality: domain services (character, story, AI), infrastructure repositories and storage adapters, Telegram bot layer (commands, handlers, middleware), and configuration. All external dependencies (OpenAI API, YDB database, Telegram API) will be mocked. Tests use ts-jest in CJS transform mode with a `moduleNameMapper` to handle ESM `.js` import extensions.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode) on Node.js 20+ LTS
**Primary Dependencies**: Jest 29.x, ts-jest 29.x, @types/jest
**Storage**: N/A (all DB interactions mocked in tests)
**Testing**: Jest via ts-jest with CJS transform, `moduleNameMapper` for ESM `.js` extensions
**Target Platform**: Node.js 20+ LTS (test runner)
**Project Type**: Telegram bot (grammY) — adding test suite
**Performance Goals**: Test suite completes in under 30 seconds
**Constraints**: Zero external service dependencies at test time (all mocked); ESM project (`"type": "module"` in package.json) requires specific Jest configuration
**Scale/Scope**: ~20 source files across 4 architectural layers, ~15-20 test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode | PASS | All test files will be TypeScript with strict mode. Jest config uses ts-jest for TypeScript support. |
| II. Modular Separation of Concerns | PASS | Test directory mirrors the 4-layer architecture (domain/, infrastructure/, telegram/, config/). No layer violations in test code. |
| III. Secrets via Environment Only | PASS | Tests mock all configuration — no real secrets needed. Test environment requires zero `.env` file. |
| IV. Graceful Error Handling | PASS | Tests explicitly verify error handling paths — malformed AI responses, transient errors, missing data. |
| V. Simplicity & YAGNI | PASS | No test abstractions beyond what's needed. Each test file is self-contained with local mocks. No shared test utilities framework. |

**Gate result: PASS** — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/002-jest-test-coverage/
├── plan.md              # This file
├── research.md          # Phase 0: Jest + ESM + ts-jest research
├── data-model.md        # Phase 1: Test file organization model
├── quickstart.md        # Phase 1: How to run tests
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
tests/
├── config/
│   └── index.test.ts                    # Config loading & validation
├── domain/
│   ├── ai/
│   │   └── service.test.ts              # AI stat generation, scene generation, retry logic
│   ├── character/
│   │   └── service.test.ts              # Character CRUD, stat generation delegation
│   └── story/
│       └── service.test.ts              # Session lifecycle, scene flow, action processing
├── infrastructure/
│   └── ydb/
│       ├── repositories/
│       │   ├── user.repo.test.ts        # User lookup, upsert, active character update
│       │   ├── character.repo.test.ts   # Character CRUD, archival, row transformation
│       │   ├── story-session.repo.test.ts  # Session upsert, find, complete, timestamp
│       │   └── story-turn.repo.test.ts  # Turn upsert, recent turns, action update
│       └── storage-adapter.test.ts      # Session & conversation storage read/write/delete
└── telegram/
    ├── commands/
    │   ├── start.test.ts                # /start command: user upsert, routing
    │   └── help.test.ts                 # /help command: message content
    ├── handlers/
    │   └── story-action.test.ts         # Callback processing, validation, scene generation
    └── middleware/
        └── error.test.ts                # Error catching, user notification
```

**Structure Decision**: Single project with `tests/` directory mirroring `src/` layout. This follows the existing project structure convention and the 4-layer architecture from the constitution (config, domain, infrastructure, telegram).

## Constitution Check (Post-Design)

*Re-evaluation after Phase 1 design artifacts are complete.*

| Principle | Status | Post-Design Notes |
| --------- | ------ | ----------------- |
| I. TypeScript Strict Mode | PASS | Test files use TypeScript with `@jest/globals` typed imports. `jest.config.cjs` is the only non-TS file (required by Jest loader). |
| II. Modular Separation of Concerns | PASS | Test structure mirrors 4-layer architecture. Each test file mocks only its direct dependencies — no cross-layer imports in tests. |
| III. Secrets via Environment Only | PASS | Config tests mock `process.env` directly. No `.env` file needed for test execution. |
| IV. Graceful Error Handling | PASS | Data model documents error paths to test: AI retry logic, malformed responses, missing sessions/characters. |
| V. Simplicity & YAGNI | PASS | No shared test utility library, no test fixtures framework, no custom matchers. Each test is self-contained. `jest.config.cjs` is minimal (~10 lines). |

**Gate result: PASS** — No violations introduced during design. No complexity tracking needed.
