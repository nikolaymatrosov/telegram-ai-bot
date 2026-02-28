# Implementation Plan: Serverless Webhook Deployment

**Branch**: `003-serverless-webhook` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-serverless-webhook/spec.md`

## Summary

Convert the Telegram bot from long-polling to a serverless webhook architecture on Yandex Cloud Functions. The existing bot logic (handlers, middleware, conversations, menus) is extracted into a shared factory, consumed by both a new serverless HTTP entry point (`src/handler.ts`) and the existing polling entry point (`src/bot.ts`). A custom grammY framework adapter bridges Yandex Cloud Functions' HTTP event format to grammY's `webhookCallback`. Webhook registration and removal are handled by standalone CLI scripts. Database migrations run via a dedicated cloud function, not on every invocation. Duplicate updates are skipped via idempotent `update_id` tracking.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode) on Node.js 20+ LTS
**Primary Dependencies**: grammY 1.40.1, @grammyjs/conversations 2.1.1, @grammyjs/menu 1.3.1, openai 6.25.0, @ydbjs/core ^6.0.7, @ydbjs/query ^6.0.7, @ydbjs/auth ^6.0.5, dotenv 17.3.1
**Storage**: YDB (Yandex Database) — 5 tables: users, characters, story_sessions, story_turns, bot_sessions
**Testing**: Jest 29.x with ts-jest 29.x, ESM via `--experimental-vm-modules`
**Target Platform**: Yandex Cloud Functions (Node.js 20 runtime) with HTTP trigger via API Gateway
**Project Type**: Telegram bot (serverless webhook + local polling dual-mode)
**Performance Goals**: Webhook response within 10 seconds under normal conditions (SC-002); Telegram retries at ~60s
**Constraints**: YCF max response size 3.5 MB; function timeout configurable (recommended 60s); environment variables total ≤4 KB; single-concurrency per instance
**Scale/Scope**: Single bot, single-user interactions (no group chat), existing 5-table data model

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode | PASS | All new code uses strict mode; tsconfig unchanged |
| II. Modular Separation of Concerns | PASS | New handler.ts is transport layer (equivalent to telegram/); shared bot factory avoids duplication. Import flow preserved: telegram → domain → infrastructure |
| III. Secrets via Environment Only | PASS | `WEBHOOK_SECRET` added to .env.example; loaded via config module |
| IV. Graceful Error Handling | PASS | Webhook handler returns HTTP 200/401/500; errors logged; no crashes |
| V. Simplicity & YAGNI | PASS | Custom adapter is minimal (~20 lines); no abstraction layers beyond what grammY requires. Migration function is a thin wrapper. Idempotency uses existing bot_sessions table pattern |
| VI. Meaningful Test Coverage | PASS | Webhook handler, adapter, secret verification, idempotency logic, and webhook CLI scripts will have tests |

**Gate result: PASS** — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-serverless-webhook/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── webhook-http.md  # HTTP contract for the webhook endpoint
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── bot.ts                         # Existing polling entry point (MODIFIED: uses shared factory)
├── handler.ts                     # NEW: Serverless webhook entry point for YCF
├── migrate.ts                     # NEW: Dedicated migration cloud function entry point
├── create-bot.ts                  # NEW: Shared bot factory (extracted from bot.ts)
├── config/
│   └── index.ts                   # MODIFIED: adds WEBHOOK_SECRET (optional), BOT_INFO
├── infrastructure/
│   ├── ydb/
│   │   ├── driver.ts              # Existing (unchanged — singleton reuse on warm starts)
│   │   ├── migrations.ts          # Existing (unchanged — called by migrate.ts)
│   │   ├── storage-adapter.ts     # Existing (unchanged)
│   │   └── repositories/          # Existing (unchanged)
│   │       ├── user.repo.ts
│   │       ├── character.repo.ts
│   │       ├── story-session.repo.ts
│   │       └── story-turn.repo.ts
│   └── openai/
│       └── client.ts              # Existing (unchanged)
├── domain/                        # Existing (unchanged)
│   ├── ai/
│   ├── character/
│   └── story/
├── telegram/                      # Existing (unchanged)
│   ├── index.ts
│   ├── types.ts
│   ├── commands/
│   ├── conversations/
│   ├── menu/
│   ├── middleware/
│   └── handlers/
└── webhook/                       # NEW: Webhook-specific utilities
    ├── adapter.ts                 # Custom grammY FrameworkAdapter for YCF
    ├── types.ts                   # YCF event/context/response type definitions
    └── scripts/
        ├── set-webhook.ts         # CLI: register webhook with Telegram
        └── delete-webhook.ts      # CLI: remove webhook from Telegram

tests/
├── webhook/                       # NEW: Tests for webhook functionality
│   ├── adapter.test.ts
│   ├── handler.test.ts
│   └── scripts/
│       ├── set-webhook.test.ts
│       └── delete-webhook.test.ts
├── config/
├── domain/
├── infrastructure/
└── telegram/
```

**Structure Decision**: Extends the existing single-project structure. New code lives in `src/webhook/` for the adapter and CLI scripts, and at `src/handler.ts` / `src/migrate.ts` / `src/create-bot.ts` at the root of `src/` for entry points and the shared factory. This follows the existing pattern where entry points (`bot.ts`) live at `src/` root.

## Complexity Tracking

> No constitution violations — this section is intentionally empty.
