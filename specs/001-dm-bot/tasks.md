# Tasks: Dungeon Master Bot

**Input**: Design documents from `/specs/001-dm-bot/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested in spec. Test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize npm project with TypeScript: run `npm init`, install dependencies (grammy, @grammY/conversations, @grammY/menu, openai, ydb-sdk, dotenv), and devDependencies (typescript, @types/node) in package.json
- [x] T002 [P] Configure TypeScript with strict mode in tsconfig.json: set `strict: true`, `outDir: "./dist"`, `rootDir: "./src"`, `module: "commonjs"`, `target: "ES2022"`, `esModuleInterop: true`
- [x] T003 [P] Create .env.example with all required variables (BOT_TOKEN, OPENAI_API_KEY, YDB_ENDPOINT, YDB_DATABASE) and add `.env` and `dist/` to .gitignore
- [x] T004 [P] Add npm scripts to package.json: `build` (`tsc`), `start` (`node dist/bot.js`), `dev` (`npx ts-node src/bot.ts`), `lint` (`eslint src/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create config module in src/config/index.ts: load and validate env vars (BOT_TOKEN, OPENAI_API_KEY, YDB_ENDPOINT, YDB_DATABASE), export typed config object, throw on missing required vars
- [x] T006 Create YDB driver singleton in src/infrastructure/ydb/driver.ts: init with AnonymousAuthService (local) or getCredentialsFromEnv (cloud), `await driver.ready(10000)`, export getDriver/destroyDriver functions
- [x] T007 Create YDB table migrations in src/infrastructure/ydb/migrations.ts: DDL for all 5 tables (users, characters, story_sessions, story_turns, bot_sessions) per data-model.md using `session.executeSchemeQuery()`
- [x] T008 [P] Create OpenAI client singleton in src/infrastructure/openai/client.ts: initialize with OPENAI_API_KEY from config, export getOpenAIClient function
- [x] T009 [P] Define context types with ConversationFlavor and SessionFlavor in src/telegram/types.ts: MyContext type combining Context, ConversationFlavor, and SessionFlavor with app session data (activeCharacterId, activeStorySessionId)
- [x] T010 Create YDB storage adapter implementing grammY StorageAdapter<T> in src/infrastructure/ydb/storage-adapter.ts: read/write/delete methods using bot_sessions table, UPSERT for write, JSON serialize/deserialize
- [x] T011 Create multi-session middleware in src/telegram/middleware/session.ts: configure `type: "multi"` with conversation namespace and app namespace using YDB storage adapter, session key = user ID
- [x] T012 [P] Create error boundary middleware in src/telegram/middleware/error.ts: catch all errors in bot.catch(), log error details, reply with user-friendly fallback message per contracts/telegram-interface.md error messages
- [x] T013 Create middleware Composer assembling session + error in src/telegram/middleware/index.ts
- [x] T014 Create user repository in src/infrastructure/ydb/repositories/user.repo.ts: findByTelegramId, upsert methods per data-model.md users table schema, use withSessionRetry and TypedData.utf8 for parameters

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Character Creation (Priority: P1)

**Goal**: New users complete a guided character creation flow: name, class, backstory, AI-generated stats, confirmation, and persistence to YDB.

**Independent Test**: Send `/start` as a new user, complete all steps, verify character sheet is displayed and saved.

### Implementation for User Story 1

- [x] T015 [P] [US1] Create character domain types in src/domain/character/types.ts: CharacterClass union type ("warrior" | "mage" | "rogue" | "healer"), CharacterStats interface (str/dex/con/int/wis/cha as numbers 3-18), Character interface (id, userId, name, class, backstory, stats, isActive, createdAt)
- [x] T016 [P] [US1] Create AI domain types in src/domain/ai/types.ts: StatsRequest, CharacterStats, SceneRequest, SceneResponse interfaces per contracts/ai-service.md
- [x] T017 [P] [US1] Create AI system prompts in src/domain/ai/prompts.ts: STATS_GENERATION_PROMPT and DM_SCENE_PROMPT constants per contracts/ai-service.md system prompts section
- [x] T018 [US1] Create AI service — generateCharacterStats function in src/domain/ai/service.ts: call OpenAI chat.completions.create with JSON mode, parse and validate stats (clamp 3-18), throw typed error on failure. Use STATS_GENERATION_PROMPT from prompts.ts
- [x] T019 [US1] Create character repository in src/infrastructure/ydb/repositories/character.repo.ts: upsert, findActiveByUserId, archiveByUserId methods per data-model.md characters table, use UPSERT pattern
- [x] T020 [US1] Create character domain service in src/domain/character/service.ts: createCharacter (orchestrates stats generation + DB save + user update), getActiveCharacter, archiveCharacter. Accepts repository and AI service as dependencies
- [x] T021 [US1] Create character creation conversation in src/telegram/conversations/character-creation.ts: multi-step flow using @grammY/conversations — ask name (waitFor text, validate 1-50 chars), show class InlineKeyboard (waitForCallbackQuery), ask backstory (waitFor text, validate <2000 chars), call generateStats via conversation.external(), display character sheet, confirm/restart via InlineKeyboard
- [x] T022 [US1] Create conversations Composer in src/telegram/conversations/index.ts: register characterCreation conversation with createConversation, export Composer
- [x] T023 [US1] Create /start command in src/telegram/commands/start.ts: check user existence via user repo, if no character → enter characterCreation conversation, if character exists → placeholder (will be updated in US3)
- [x] T024 [P] [US1] Create /help command in src/telegram/commands/help.ts: display available commands and brief usage guide
- [x] T025 [US1] Create commands Composer in src/telegram/commands/index.ts: register start and help commands, export Composer
- [x] T026 [US1] Assemble telegram layer Composer in src/telegram/index.ts: compose middleware → conversations → commands (order matters for session availability)
- [x] T027 [US1] Create bot entry point in src/bot.ts: import config, init YDB driver, run migrations, create Bot<MyContext>, use telegram Composer, handle graceful shutdown (destroyDriver on SIGINT/SIGTERM), call bot.start()

**Checkpoint**: At this point, User Story 1 should be fully functional — new users can create characters end-to-end

---

## Phase 4: User Story 2 — Interactive Storytelling (Priority: P2)

**Goal**: After character creation, the DM narrates an adventure with scene descriptions and 2-4 action choices. Story context maintained across turns (10-turn window).

**Independent Test**: Complete character creation, then play through 3+ story turns verifying contextual responses and action choices.

### Implementation for User Story 2

- [x] T028 [P] [US2] Create story domain types in src/domain/story/types.ts: StorySession interface (id, userId, characterId, status, createdAt, updatedAt), StoryTurn interface (sessionId, turnNumber, sceneText, actionsJson, chosenAction, createdAt), SceneResponse interface
- [x] T029 [P] [US2] Create story session repository in src/infrastructure/ydb/repositories/story-session.repo.ts: upsert, findActiveByUserId, completeSession methods per data-model.md story_sessions table
- [x] T030 [P] [US2] Create story turn repository in src/infrastructure/ydb/repositories/story-turn.repo.ts: upsert, findRecentTurns (last 10 by session, ORDER BY turn_number DESC LIMIT 10), getLastTurnNumber methods per data-model.md story_turns table
- [x] T031 [US2] Create AI service — generateScene function in src/domain/ai/service.ts: call OpenAI chat.completions.create with DM system prompt, character sheet, and history context. Parse structured response (description + actions). Validate actions count 2-4 and length <64 chars. Use DM_SCENE_PROMPT from prompts.ts
- [x] T032 [US2] Create story domain service in src/domain/story/service.ts: startNewSession, generateNextScene (load last 10 turns, call AI, save new turn), processActionChoice (update chosen_action on current turn). Accepts repositories and AI service as dependencies
- [x] T033 [US2] Create story action callback handler in src/telegram/handlers/story-action.ts: handle `action_N` callback queries, answerCallbackQuery, call story service processActionChoice then generateNextScene, send new scene with action InlineKeyboard, handle AI errors with fallback message
- [x] T034 [US2] Create handlers Composer in src/telegram/handlers/index.ts: register storyAction handler, export Composer
- [x] T035 [US2] Update /start command in src/telegram/commands/start.ts: after character creation confirmation, auto-start first story session via story service startNewSession, send opening scene with action buttons
- [x] T036 [US2] Update telegram layer Composer in src/telegram/index.ts: add handlers Composer to composition chain (middleware → conversations → commands → handlers)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work — users can create characters and play through interactive stories

---

## Phase 5: User Story 3 — Character Persistence and Resume (Priority: P3)

**Goal**: Returning users are recognized, can continue their adventure, view their character sheet, or start a new character. Previous characters are archived.

**Independent Test**: Create a character, close the chat, reopen, send `/start` — verify bot greets by name and offers Continue/View/New menu.

### Implementation for User Story 3

- [x] T037 [US3] Create main menu using @grammY/menu in src/telegram/menu/main-menu.ts: three buttons — "Continue Adventure" (enter story or start new session), "View Character Sheet" (display full stats), "Create New Character" (archive + re-enter creation). Load character data for display
- [x] T038 [US3] Create menu Composer in src/telegram/menu/index.ts: register main menu, export Composer
- [x] T039 [US3] Update /start command in src/telegram/commands/start.ts: if user has active character, greet by character name and send main menu; if "Create New Character" selected, call archiveCharacter then enter characterCreation conversation
- [x] T040 [US3] Add story session resume logic in src/domain/story/service.ts: resumeSession method that loads active session and last turn, or starts a new session if none active
- [x] T041 [US3] Update telegram layer Composer in src/telegram/index.ts: add menu Composer to composition chain (middleware → menu → conversations → commands → handlers). Menu must be registered before commands per grammY docs
- [x] T042 [US3] Add character archiving in src/domain/character/service.ts: archiveCharacter sets is_active=false on current character, clears active_character_id on user record (in one transaction via character.repo + user.repo)

**Checkpoint**: All user stories should now be independently functional — full create/play/resume loop works

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling and improvements that affect multiple user stories

- [x] T043 [P] Add input validation edge cases in src/telegram/conversations/character-creation.ts: handle random text during creation flow (redirect to current step), backstory >2000 chars (ask to shorten), name >50 chars (ask to shorten), command input during flow (redirect)
- [x] T044 [P] Add /start mid-adventure handling in src/telegram/commands/start.ts: if user is in active story, show main menu without losing story progress (session data preserved)
- [x] T045 [P] Add AI error retry logic in src/domain/ai/service.ts: wrap OpenAI calls with single retry on transient errors (rate limit, timeout, 5xx), then throw typed error for user-facing fallback
- [x] T046 Add graceful shutdown handling in src/bot.ts: catch SIGINT/SIGTERM, stop bot polling, destroy YDB driver, log shutdown message
- [x] T047 Validate quickstart.md flow: run through setup steps from specs/001-dm-bot/quickstart.md end-to-end, verify bot starts and responds to /start

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (Phase 3) can start after Phase 2
  - US2 (Phase 4) depends on US1 completion (needs character creation working)
  - US3 (Phase 5) depends on US1 + US2 (needs both character and story flows)
- **Polish (Phase 6)**: Depends on all user stories being complete

### Within Each User Story

- Types before services
- Repositories before domain services
- Domain services before telegram handlers/conversations
- Telegram handlers before layer assembly
- Core implementation before integration

### Parallel Opportunities

**Phase 1**: T002, T003, T004 can all run in parallel after T001

**Phase 2**: T008, T009 can run in parallel; T012 parallel with T011

**Phase 3 (US1)**: T015, T016, T017 can run in parallel (type definitions); T024 parallel with other US1 tasks

**Phase 4 (US2)**: T028, T029, T030 can run in parallel (types + repos)

**Phase 6**: T043, T044, T045 can run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch all type definitions together:
Task: "Create character domain types in src/domain/character/types.ts"
Task: "Create AI domain types in src/domain/ai/types.ts"
Task: "Create AI system prompts in src/domain/ai/prompts.ts"
Task: "Create /help command in src/telegram/commands/help.ts"

# Then sequentially:
Task: "Create AI service in src/domain/ai/service.ts" (needs types)
Task: "Create character repository" (needs types)
Task: "Create character domain service" (needs AI service + repo)
Task: "Create character creation conversation" (needs domain service)
Task: "Create /start command" (needs conversation)
Task: "Assemble telegram layer" (needs all Composers)
Task: "Create bot entry point" (needs telegram layer)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 — Character Creation
4. **STOP and VALIDATE**: Test character creation end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test character creation → Deploy (MVP!)
3. Add User Story 2 → Test storytelling → Deploy
4. Add User Story 3 → Test persistence/resume → Deploy
5. Add Polish → Test edge cases → Final deploy
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All YDB writes use UPSERT pattern (research.md R1)
- Inside conversations: use InlineKeyboard, NOT Menu plugin (research.md R3)
- All conversation.external() wraps for DB/AI calls (research.md R2)
- Story turns use callback handlers, NOT long-running conversations (research.md R5)
