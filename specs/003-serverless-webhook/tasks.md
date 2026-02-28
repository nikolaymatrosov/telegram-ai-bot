# Tasks: Serverless Webhook Deployment

**Input**: Design documents from `/specs/003-serverless-webhook/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/webhook-http.md, quickstart.md

**Tests**: All functionality with business logic MUST have tests (Constitution Principle VI). Trivial pass-through methods are exempt. Test tasks are included by default in each user story phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — new config fields, new table DDL, type definitions, and supporting entry points needed before user story work begins.

- [x] T001 Extend config with optional `webhookSecret` and `botInfo` fields in src/config/index.ts — `WEBHOOK_SECRET` is optional (not needed for polling mode); `BOT_INFO` is a pre-cached `getMe` response object to skip API call on cold start (R3)
- [x] T002 [P] Add `processed_updates` table DDL to src/infrastructure/ydb/migrations.ts — add `CREATE TABLE processed_updates (update_id Int64 NOT NULL, processed_at Timestamp NOT NULL, PRIMARY KEY (update_id)) WITH (TTL = Interval("PT24H") ON processed_at)` to the existing TABLES array per data-model.md
- [x] T003 [P] Create YCF event/context/response type definitions in src/webhook/types.ts — define `YcfEvent` (method, headers, body, queryStringParameters, requestContext), `YcfContext` (token, functionName, functionVersion, etc.), and `YcfResponse` (statusCode, headers, body) interfaces per R2
- [x] T004 [P] Create migration cloud function entry point in src/migrate.ts — thin async handler that initializes YDB driver via `getDriver()` and calls existing `runMigrations(driver)` (FR-011, R7); export as `handler(event, context)` for YCF deployment
- [x] T005 [P] Update .env.example with new environment variables — add `WEBHOOK_SECRET`, `WEBHOOK_URL` (used by CLI scripts), and a comment block for `BOT_INFO` fields

**Checkpoint**: Infrastructure pieces ready — factory extraction can now begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract shared bot factory so both webhook and polling entry points can reuse the same bot instance configuration (FR-007, R4)

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create shared bot factory function in src/create-bot.ts — extract bot construction from src/bot.ts into `createBot(options)` that accepts driver, repos, services, and optional `botInfo`; registers middleware stack (error → session → conversations → menu → commands → handlers) and `bot.catch()` error handler; returns configured `Bot<MyContext>` without starting polling (R4)
- [x] T007 Refactor src/bot.ts to use shared factory from src/create-bot.ts — replace inline bot construction with `createBot()` call; keep only polling-specific logic: `main()` initializes YDB, runs migrations, creates repos/services, calls `createBot()`, then `bot.start()` with graceful shutdown handlers

**Checkpoint**: Foundation ready — `npm run dev` (polling mode) still works as before; user story implementation can now begin

---

## Phase 3: User Story 1 — Bot Receives and Processes Messages via Webhook (P1) — MVP

**Goal**: Telegram updates arrive via HTTP POST to a serverless function, are verified, deduplicated, and processed through the shared bot logic — the core webhook pipeline.

**Independent Test**: Send a Telegram update payload to the handler function and verify it returns HTTP 200 and processes the update (e.g., `/start` triggers welcome message). Send invalid secret → 401. Send duplicate `update_id` → 200 with no re-processing.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Write unit tests for YCF adapter in tests/webhook/adapter.test.ts — test: (1) adapter extracts `X-Telegram-Bot-Api-Secret-Token` header from YcfEvent, (2) adapter handles `event.body` as both string and pre-parsed object (R2 critical finding), (3) adapter passes body to grammY's update handler, (4) adapter returns `YcfResponse` with correct statusCode/headers/body from grammY's response
- [x] T009 [P] [US1] Write unit tests for webhook handler in tests/webhook/handler.test.ts — test: (1) valid update with correct secret → processes and returns 200, (2) missing/wrong secret header → returns 401 without processing, (3) malformed/empty body → returns 200 without processing (FR-009, prevents Telegram retries), (4) duplicate `update_id` → returns 200 without re-processing (FR-012), (5) internal error during processing → returns 500 (FR-002), (6) `onTimeout: "return"` returns 200 when processing exceeds timeout threshold

### Implementation for User Story 1

- [x] T010 [P] [US1] Implement custom grammY FrameworkAdapter for YCF in src/webhook/adapter.ts — ~20 lines (R1): convert `YcfEvent` to the `{ update, header, end, respond, unauthorized }` interface that `webhookCallback` expects; handle `event.body` as string or object; map grammY's response back to `YcfResponse`
- [x] T011 [US1] Implement serverless webhook handler in src/handler.ts — module-level bot initialization (reused on warm starts via R3 `botInfo`): call `createBot()` with `botInfo` to skip `getMe`; export async `handler(event, context)` that: (1) checks `update_id` against `processed_updates` table, (2) if duplicate returns `{ statusCode: 200 }`, (3) else delegates to `webhookCallback(bot, ycfAdapter, { secretToken, timeoutMilliseconds: 55000, onTimeout: "return" })`, (4) on success inserts `update_id` into `processed_updates`, (5) returns `YcfResponse`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently — the webhook handler accepts updates, verifies secrets, deduplicates, and processes via shared bot logic

---

## Phase 4: User Story 2 — Webhook Registration and Lifecycle Management (P2)

**Goal**: Operators can register and remove the Telegram webhook in a single command each (SC-005), enabling the switch between serverless and local development modes.

**Independent Test**: Run the set-webhook script with valid env vars, then query `getWebhookInfo()` to confirm the webhook URL is registered. Run the delete-webhook script and confirm the webhook is removed.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T012 [P] [US2] Write unit tests for set-webhook script in tests/webhook/scripts/set-webhook.test.ts — mock `bot.api.setWebhook` and `bot.api.getWebhookInfo`; test: (1) calls `setWebhook` with correct URL, secret_token, allowed_updates, and drop_pending_updates per contracts/webhook-http.md, (2) prints webhook info after registration, (3) exits with error if BOT_TOKEN or WEBHOOK_URL missing
- [x] T013 [P] [US2] Write unit tests for delete-webhook script in tests/webhook/scripts/delete-webhook.test.ts — mock `bot.api.deleteWebhook`; test: (1) calls `deleteWebhook` with `drop_pending_updates: true`, (2) prints confirmation, (3) exits with error if BOT_TOKEN missing

### Implementation for User Story 2

- [x] T014 [P] [US2] Implement set-webhook CLI script in src/webhook/scripts/set-webhook.ts — reads `BOT_TOKEN`, `WEBHOOK_URL`, `WEBHOOK_SECRET` from env (via dotenv); creates minimal `Bot` instance; calls `bot.api.setWebhook(url, { secret_token, allowed_updates: ["message", "callback_query"], drop_pending_updates: true })`; prints `bot.api.getWebhookInfo()` result (R6)
- [x] T015 [P] [US2] Implement delete-webhook CLI script in src/webhook/scripts/delete-webhook.ts — reads `BOT_TOKEN` from env; creates minimal `Bot` instance; calls `bot.api.deleteWebhook({ drop_pending_updates: true })`; prints confirmation (R6)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently — the webhook can be registered, updates flow through the handler, and the webhook can be removed

---

## Phase 5: User Story 3 — Serverless Entry Point Coexists with Polling Entry Point (P3)

**Goal**: Developers can run `npm run dev` (polling) for local development while production uses the webhook entry point — both share identical bot logic via the factory (FR-006, FR-007).

**Independent Test**: Run `npm run dev` and verify all commands and conversations work. Confirm that adding a new handler to `createBot()` makes it available in both modes without duplication.

- [x] T016 [US3] Verify existing test suite passes with refactored bot.ts — run `npm test` to confirm no regressions from factory extraction; verify `npm run dev` starts polling mode successfully
- [x] T017 [US3] Add webhook-related npm scripts to package.json — add `"set-webhook": "tsx src/webhook/scripts/set-webhook.ts"` and `"delete-webhook": "tsx src/webhook/scripts/delete-webhook.ts"` scripts

**Checkpoint**: All user stories should now be independently functional — dual-mode bot with shared logic

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all user stories

- [x] T018 Run full test suite and lint validation — `npm test && npm run lint`; fix any failures
- [x] T019 Validate quickstart.md end-to-end flow — verify all documented commands, entry points, and environment variables match the implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (config) — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel
  - US3 is a verification phase that can start after Phase 2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — requires T001 (config), T002 (migrations), T003 (types), T006 (factory)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — requires T001 (config for WEBHOOK_SECRET); independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — primarily verification of T006/T007 factory refactoring

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Adapter before handler (US1: T010 before T011)
- Scripts are independent of each other (US2: T014 and T015 are parallel)
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T005 can all run in parallel (different files); T001 is independent too
- **Phase 2**: T006 → T007 must be sequential (T007 depends on T006)
- **Phase 3 (US1)**: T008 and T009 (tests) in parallel; T010 in parallel with tests; T011 depends on T010
- **Phase 4 (US2)**: All four tasks (T012–T015) can run in parallel (different files)
- **Cross-story**: US1 (Phase 3) and US2 (Phase 4) can run in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Write unit tests for YCF adapter in tests/webhook/adapter.test.ts"
Task: "Write unit tests for webhook handler in tests/webhook/handler.test.ts"

# Launch adapter implementation in parallel with tests (different files):
Task: "Implement custom grammY FrameworkAdapter in src/webhook/adapter.ts"

# After adapter is done, implement handler:
Task: "Implement serverless webhook handler in src/handler.ts"
```

## Parallel Example: User Story 2

```bash
# All US2 tasks can run in parallel (4 different files):
Task: "Write unit tests for set-webhook in tests/webhook/scripts/set-webhook.test.ts"
Task: "Write unit tests for delete-webhook in tests/webhook/scripts/delete-webhook.test.ts"
Task: "Implement set-webhook CLI script in src/webhook/scripts/set-webhook.ts"
Task: "Implement delete-webhook CLI script in src/webhook/scripts/delete-webhook.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T007) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T008–T011)
4. **STOP and VALIDATE**: Test webhook handler independently
5. Deploy/demo if ready — bot receives and processes webhook updates

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (**MVP!** — bot works via webhook)
3. Add User Story 2 → Test independently → Deploy/Demo (operators can manage webhook lifecycle)
4. Add User Story 3 → Test independently → Deploy/Demo (dual-mode confirmed, no regressions)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (webhook handler pipeline)
   - Developer B: User Story 2 (CLI scripts)
3. User Story 3 is verification — can be done by either developer after their story completes

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The YCF adapter is ~20 lines (R1) — do not over-engineer
- `event.body` in YCF can be string or pre-parsed object — handle both (R2 critical finding)
- Pre-set `botInfo` eliminates `getMe` cold-start latency (R3)
- Module-level bot instance in handler.ts survives warm starts (R2, R3)
