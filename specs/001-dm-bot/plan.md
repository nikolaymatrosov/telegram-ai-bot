# Implementation Plan: Dungeon Master Bot

**Branch**: `001-dm-bot` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-dm-bot/spec.md`

## Summary

Build a Telegram bot that acts as a Dungeon Master: guides users
through character creation (name, class, backstory, AI-generated
stats), runs interactive storytelling sessions with action choices,
and persists character/story data in YDB. Uses grammY for Telegram
integration, OpenAI for AI generation, and the conversations plugin
for multi-step flows.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) on Node.js 20+ LTS
**Primary Dependencies**: grammY, @grammY/conversations, @grammY/menu, openai, ydb-sdk, dotenv
**Storage**: YDB (Yandex Database) — local Docker for dev, Yandex Cloud for prod
**Testing**: Not requested in spec (omitted per constitution)
**Target Platform**: Node.js server (long-polling mode)
**Project Type**: Telegram bot (long-running process)
**Performance Goals**: Scene generation <10s (SC-002), character load <3s (SC-004)
**Constraints**: 10-turn story context window, inline button text <64 chars
**Scale/Scope**: Single-user conversations, private chats only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. TypeScript Strict Mode | PASS | `strict: true` in tsconfig, explicit types on all module boundaries |
| II. Modular Separation of Concerns | PASS | 4-layer architecture: `telegram/` → `domain/` → `infrastructure/` + `config/`. Composer pattern for all telegram modules. Import flow enforced. |
| III. Secrets via Environment Only | PASS | `BOT_TOKEN`, `OPENAI_API_KEY`, `YDB_ENDPOINT`, `YDB_DATABASE` via env. `.env.example` provided, `.env` in `.gitignore`. |
| IV. Graceful Error Handling | PASS | Error boundary middleware in telegram layer. `conversation.external()` wraps all AI/DB calls. Fallback messages for all external failures. |
| V. Simplicity & YAGNI | PASS | YDB infrastructure justified by FR-006 (persist character data). No premature abstractions. Infrastructure modules created on-demand per spec requirements. |

**Post-Phase 1 re-check**: All principles still satisfied. The
`infrastructure/ydb/` and `infrastructure/openai/` modules are
justified by concrete spec requirements (FR-006, FR-004, FR-007).

## Project Structure

### Documentation (this feature)

```text
specs/001-dm-bot/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology research
├── data-model.md        # Phase 1: YDB schema design
├── quickstart.md        # Phase 1: setup and run guide
├── contracts/
│   ├── telegram-interface.md  # Bot commands, keyboards, flows
│   └── ai-service.md         # AI function contracts
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── bot.ts                     # Entry point: create Bot, compose layers, start
├── config/
│   └── index.ts               # Env validation, typed config export
├── telegram/
│   ├── bot.ts                 # Bot instance factory
│   ├── types.ts               # Context type with flavors
│   ├── commands/
│   │   ├── start.ts           # /start: route new vs returning user
│   │   ├── help.ts            # /help: usage info
│   │   └── index.ts           # Commands Composer
│   ├── conversations/
│   │   ├── character-creation.ts  # Multi-step character wizard
│   │   └── index.ts           # Conversations Composer
│   ├── handlers/
│   │   ├── story-action.ts    # Callback query handler for story choices
│   │   └── index.ts           # Handlers Composer
│   ├── menu/
│   │   ├── main-menu.ts       # Continue/View/New menu for returning users
│   │   └── index.ts           # Menu Composer
│   ├── middleware/
│   │   ├── session.ts         # Multi-session setup (conversation + app)
│   │   ├── error.ts           # Error boundary middleware
│   │   └── index.ts           # Middleware Composer
│   └── index.ts               # Assemble telegram layer Composer
├── domain/
│   ├── character/
│   │   ├── service.ts         # createCharacter, getCharacterSheet
│   │   └── types.ts           # Character, CharacterStats, CharacterClass
│   ├── story/
│   │   ├── service.ts         # generateScene, processAction
│   │   └── types.ts           # StorySession, StoryTurn, SceneResponse
│   └── ai/
│       ├── service.ts         # generateStats, generateScene (OpenAI calls)
│       ├── prompts.ts         # System prompt templates
│       └── types.ts           # AI request/response types
└── infrastructure/
    ├── ydb/
    │   ├── driver.ts          # Driver singleton, init/destroy
    │   ├── storage-adapter.ts # grammY StorageAdapter<T> for YDB
    │   ├── migrations.ts      # Table creation DDL
    │   └── repositories/
    │       ├── user.repo.ts
    │       ├── character.repo.ts
    │       ├── story-session.repo.ts
    │       └── story-turn.repo.ts
    └── openai/
        └── client.ts          # OpenAI client singleton
```

**Structure Decision**: Single project following the 4-layer
architecture from constitution Principle II and architecture.md.
The `telegram/` layer is split into sub-modules (commands,
conversations, handlers, menu, middleware) per the Composer pattern.
`domain/` contains character, story, and AI service logic.
`infrastructure/` contains YDB and OpenAI client code.

## Complexity Tracking

> No constitution violations. All infrastructure modules justified
> by concrete spec requirements.

| Decision | Justification |
| -------- | ------------- |
| YDB repositories (4 files) | Spec requires persistence for users, characters, story sessions, and turns (FR-006, FR-009, FR-010) |
| Separate AI service module | Spec requires AI for both stats generation (FR-004) and scene generation (FR-007) — distinct operations warrant separate module |
| Custom grammY StorageAdapter | No official YDB adapter exists; interface is 3 methods (read/write/delete) |
