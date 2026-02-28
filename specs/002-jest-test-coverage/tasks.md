# Tasks: Jest Test Coverage for All Functionality

**Input**: Design documents from `/specs/002-jest-test-coverage/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Since this feature is entirely about adding tests, each task creates a test file — the tests ARE the implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install Jest tooling and configure the test runner for this ESM TypeScript project

- [x] T001 Install Jest devDependencies: `jest@^29.7.0`, `ts-jest@^29.4.6`, `@jest/globals@^29.7.0`, `@types/jest@^29.5.14`
- [x] T002 Create Jest configuration file at jest.config.cjs using ts-jest `createDefaultEsmPreset()`, with `moduleNameMapper` to strip `.js` extensions, `roots: ['<rootDir>/tests']`, and `testEnvironment: 'node'` (see research.md R1, R4)
- [x] T003 Update package.json scripts: set `"test"` to `"node --experimental-vm-modules node_modules/.bin/jest"` and add `"test:watch"` with `--watch` flag (see quickstart.md)

**Checkpoint**: `npm test` runs Jest successfully (0 tests found, no errors). Validates ESM + ts-jest configuration works.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create test directory structure so all user stories can proceed

**⚠️ CRITICAL**: No test file creation can begin until the test runner is configured and directory structure exists

- [x] T004 Create tests/ directory structure mirroring src/ layout: `tests/config/`, `tests/domain/ai/`, `tests/domain/character/`, `tests/domain/story/`, `tests/infrastructure/ydb/repositories/`, `tests/telegram/commands/`, `tests/telegram/handlers/`, `tests/telegram/middleware/`

**Checkpoint**: Foundation ready — all user story phases can now begin in parallel

---

## Phase 3: User Story 1 — Run Tests to Verify Core Business Logic (Priority: P1) 🎯 MVP

**Goal**: Unit tests for all three domain services (AI, character, story) verifying core business logic, error handling, and edge cases

**Independent Test**: Run `node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="domain"` — all domain tests pass

**Source modules under test**:

- `src/domain/ai/service.ts` — AI stat generation, scene generation, retry logic
- `src/domain/character/service.ts` — Character CRUD, stat generation delegation
- `src/domain/story/service.ts` — Session lifecycle, scene flow, action processing

### Implementation for User Story 1

- [x] T005 [P] [US1] Create AI service tests in tests/domain/ai/service.test.ts — mock `getOpenAIClient()` singleton via `jest.unstable_mockModule()`, test: stat generation (happy path + malformed JSON), scene generation (happy path + malformed response), retry logic (transient 429/5xx errors with retries, non-transient errors fail immediately), stat clamping validation, action count/length validation
- [x] T006 [P] [US1] Create character service tests in tests/domain/character/service.test.ts — mock character repo, user repo, and `generateCharacterStats()` from AI service via `jest.unstable_mockModule()`, test: createCharacter (happy path + boundary inputs: empty name, 50-char name, 2000-char backstory), getActiveCharacter (found + not found), archiveCharacter, stat generation delegation
- [x] T007 [P] [US1] Create story service tests in tests/domain/story/service.test.ts — mock story session repo, story turn repo, and `generateScene()` from AI service via `jest.unstable_mockModule()`, test: startNewSession, resumeSession (active session + no session), processActionChoice + generateNextScene, completeSession, missing session/character error paths

**Checkpoint**: All domain service tests pass. Core business logic is verified — character creation, story progression, and AI integration are covered.

---

## Phase 4: User Story 2 — Run Tests to Verify Data Access Layer (Priority: P2)

**Goal**: Unit tests for all four repository modules and the storage adapter, verifying database operations produce correct queries and handle responses properly

**Independent Test**: Run `node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="infrastructure"` — all repository and storage adapter tests pass

**Source modules under test**:

- `src/infrastructure/ydb/repositories/user.repo.ts` — User lookup, upsert, active character update
- `src/infrastructure/ydb/repositories/character.repo.ts` — Character CRUD, archival, row transformation
- `src/infrastructure/ydb/repositories/story-session.repo.ts` — Session upsert, find, complete, timestamp
- `src/infrastructure/ydb/repositories/story-turn.repo.ts` — Turn upsert, recent turns, action update
- `src/infrastructure/ydb/storage-adapter.ts` — Session & conversation storage read/write/delete

### Implementation for User Story 2

- [x] T008 [P] [US2] Create user repository tests in tests/infrastructure/ydb/repositories/user.repo.test.ts — mock YDB Driver + QueryClient `execute()` method, test: findByTelegramId (found + not found), upsert (create new + update existing), updateActiveCharacter
- [x] T009 [P] [US2] Create character repository tests in tests/infrastructure/ydb/repositories/character.repo.test.ts — mock YDB Driver + QueryClient, test: create, findById (found + not found), findByUserId, findActiveByUserId (found + empty result), archive, row-to-entity transformation
- [x] T010 [P] [US2] Create story session repository tests in tests/infrastructure/ydb/repositories/story-session.repo.test.ts — mock YDB Driver + QueryClient, test: upsert, findById, findActiveByCharacterId, complete (sets completion timestamp), row transformation
- [x] T011 [P] [US2] Create story turn repository tests in tests/infrastructure/ydb/repositories/story-turn.repo.test.ts — mock YDB Driver + QueryClient, test: upsert, findBySessionId, findRecentBySessionId (limit + ordering), updateAction
- [x] T012 [P] [US2] Create storage adapter tests in tests/infrastructure/ydb/storage-adapter.test.ts — mock YDB Driver + QueryClient, test: read (existing key + missing key), write, delete for grammY conversation/session storage

**Checkpoint**: All infrastructure tests pass. Database operations are verified — query construction and response handling for all repositories and the storage adapter are covered.

---

## Phase 5: User Story 3 — Run Tests to Verify Telegram Bot Layer (Priority: P3)

**Goal**: Unit tests for Telegram commands, handlers, and middleware verifying bot interactions behave correctly

**Independent Test**: Run `node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="telegram"` — all Telegram layer tests pass

**Source modules under test**:

- `src/telegram/commands/start.ts` — /start command: user upsert, routing
- `src/telegram/commands/help.ts` — /help command: message content
- `src/telegram/handlers/story-action.ts` — Callback processing, validation, scene generation
- `src/telegram/middleware/error.ts` — Error catching, user notification

### Implementation for User Story 3

- [x] T013 [P] [US3] Create /start command tests in tests/telegram/commands/start.test.ts — mock user repo, character service, story service, menu, and grammY Context, test: new user (upsert + welcome message), returning user with active character (routing to story), returning user without character (routing to creation)
- [x] T014 [P] [US3] Create /help command tests in tests/telegram/commands/help.test.ts — mock grammY Context, test: reply contains expected help message content
- [x] T015 [P] [US3] Create story action handler tests in tests/telegram/handlers/story-action.test.ts — mock story service, character service, grammY Context (callback query), test: valid action callback (processing + scene generation), invalid callback data, non-existent session reference, non-existent character reference, answerCallbackQuery called
- [x] T016 [P] [US3] Create error middleware tests in tests/telegram/middleware/error.test.ts — mock grammY Context and NextFunction, test: no error (passes through), error thrown by downstream (catches, notifies user, does not re-throw), error message content

**Checkpoint**: All Telegram layer tests pass. Bot interactions are verified — commands respond correctly, action callbacks process properly, and errors are handled gracefully.

---

## Phase 6: User Story 4 — Run Tests to Verify Configuration and Infrastructure (Priority: P4)

**Goal**: Unit tests for configuration loading verifying the application initializes correctly under different environment conditions

**Independent Test**: Run `node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="config"` — all config tests pass

**Source modules under test**:

- `src/config/index.ts` — Environment variable loading and validation

### Implementation for User Story 4

- [x] T017 [US4] Create configuration tests in tests/config/index.test.ts — mock `process.env` directly, test: all required variables present (happy path), each required variable missing individually (error with clear message), malformed values (e.g., non-numeric port), default values applied when optional variables are absent

**Checkpoint**: Configuration tests pass. App initialization logic is verified under various environment conditions.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete test suite and ensure all success criteria are met

- [x] T018 Run full test suite via `npm test` and verify all tests pass (SC-001), no test depends on external services (SC-005), suite completes in under 30 seconds (SC-004)
- [x] T019 Validate quickstart.md instructions: run each command from quickstart.md (`npm test`, `npm run test:watch`, single file run, pattern run) and confirm they work as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational phase completion
  - All four user stories can proceed in parallel (they create different files with no cross-dependencies)
  - Or sequentially in priority order: US1 → US2 → US3 → US4
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 3 (P3)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 4 (P4)**: Can start after Phase 2 — No dependencies on other stories

### Within Each User Story

- All test files within a story are marked [P] (parallelizable) — they target different source modules
- Each test file is self-contained with its own mock setup (no shared test utilities)
- No ordering constraints within a story phase

### Parallel Opportunities

- T001, T002, T003 are sequential (install → configure → update scripts)
- T005, T006, T007 can all run in parallel (US1: different domain services)
- T008–T012 can all run in parallel (US2: different repositories)
- T013–T016 can all run in parallel (US3: different Telegram modules)
- All four user story phases (3–6) can run in parallel with each other

---

## Parallel Example: User Story 1

```text
# All three domain service test files can be created simultaneously:
Task T005: "Create AI service tests in tests/domain/ai/service.test.ts"
Task T006: "Create character service tests in tests/domain/character/service.test.ts"
Task T007: "Create story service tests in tests/domain/story/service.test.ts"
```

## Parallel Example: Cross-Story

```text
# After Phase 2, all stories can begin at once:
Task T005 (US1): "AI service tests"
Task T008 (US2): "User repo tests"
Task T013 (US3): "/start command tests"
Task T017 (US4): "Config tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004)
3. Complete Phase 3: User Story 1 (T005–T007)
4. **STOP and VALIDATE**: Run `npm test` — all domain tests pass
5. Core business logic is verified — safe to proceed or ship

### Incremental Delivery

1. Setup + Foundational → Jest configured and running
2. Add US1 (domain services) → Test independently → Core logic verified (MVP!)
3. Add US2 (repositories) → Test independently → Data layer verified
4. Add US3 (Telegram layer) → Test independently → Bot interactions verified
5. Add US4 (config) → Test independently → Full coverage achieved
6. Polish → Full suite validated, quickstart confirmed

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (3 minutes)
2. Once Phase 2 is done:
   - Developer A: User Story 1 (3 domain service test files)
   - Developer B: User Story 2 (5 repository/adapter test files)
   - Developer C: User Story 3 (4 Telegram layer test files)
   - Developer D: User Story 4 (1 config test file)
3. All stories complete and are validated independently

---

## Notes

- [P] tasks = different files, no dependencies — safe to execute in parallel
- [Story] label maps each task to its user story for traceability
- Every test file uses `jest.unstable_mockModule()` + dynamic `await import()` for ESM mocking (research.md R2)
- Every test file imports from `@jest/globals` (`describe`, `it`, `expect`, `jest`, `beforeEach`)
- Every test file uses `beforeEach(() => jest.clearAllMocks())` to reset mock state
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
