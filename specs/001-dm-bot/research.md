# Research: Dungeon Master Bot

**Feature**: 001-dm-bot
**Date**: 2026-02-28

## R1: YDB Node.js SDK

**Decision**: Use `ydb-sdk` npm package for database access.

**Rationale**: Official Yandex SDK with full TypeScript support.
Provides session pool management, typed query parameters, and
schema DDL via YQL.

**Alternatives considered**:

- Raw gRPC calls — rejected (SDK handles session pool, retries,
  auth transparently)
- `ydb-sdk-lite` — newer but less battle-tested; stick with main
  SDK

**Key patterns**:

- Use `driver.tableClient.withSessionRetry()` for all queries
- Use `UPSERT` instead of `INSERT` (YDB preferred write pattern)
- Use `Utf8` type for text (NOT `String` which is binary/Buffer)
- All query parameters require `DECLARE` statements in YQL
- No auto-increment; use string IDs (Telegram user ID + UUID)
- Call `await driver.ready(timeout)` before first use
- `TypedData.utf8()`, `TypedData.uint32()`, etc. for parameters
- `TypedData.createNativeObjects()` to deserialize result sets

**Gotchas**:

- `String` type = binary bytes, `Utf8` = text strings
- Int64/Uint64 map to BigInt in JS
- Prepared queries are session-scoped (withSessionRetry handles
  this)
- Primary key column order affects partitioning; avoid monotonic
  keys as first column

**Auth**:

- Local/Docker: `AnonymousAuthService`
- Yandex Cloud: `getCredentialsFromEnv()` reads env vars
- Env vars: `YDB_ENDPOINT`, `YDB_DATABASE`, plus auth-related

## R2: grammY Conversations Plugin

**Decision**: Use `@grammY/conversations` for character creation
flow. Use short-lived conversations or callback handlers for
story turns.

**Rationale**: Conversations plugin provides the cleanest API for
multi-step wizard flows (name → class → backstory → confirm).
For story turns, short-lived conversations avoid replay overhead.

**Alternatives considered**:

- Manual state machine with session flags — rejected (error-prone,
  verbose, hard to maintain)
- Single long-running conversation for entire story — rejected
  (replay overhead grows with each turn)

**Key patterns**:

- `conversation.waitFor("message:text")` for text input
- `conversation.waitForCallbackQuery(/regex/)` for button presses
- `conversation.form.text()` shorthand for getting text strings
- `conversation.external(fn)` wraps all side effects (DB, AI
  calls) so they run once, not on every replay
- Always `answerCallbackQuery()` after handling button press

**Three golden rules**:

1. All side effects must use `conversation.external()`
2. All waits must use `conversation.wait*()` methods
3. Do not hold stale context references after `wait()`

## R3: grammY Menu Plugin

**Decision**: Use `@grammY/menu` for the returning-user main menu.
Do NOT use Menu inside conversations (conflicts with callback
query handling).

**Rationale**: Menu plugin handles callback queries automatically,
supports dynamic content, and provides navigation/back buttons.
Perfect for the "Continue / View Character / New Character" menu.

**Key constraint**: Inside conversations, use raw `InlineKeyboard`
with `conversation.waitForCallbackQuery()` instead of Menu plugin.

## R4: Session Storage

**Decision**: Implement custom `StorageAdapter<T>` for YDB. Use
`type: "multi"` sessions to separate conversation internal state
from application state.

**Rationale**: No official `@grammY/storage-ydb` exists. The
`StorageAdapter` interface is simple (read/write/delete by key).
Multi-session separates the conversations plugin's internal
bookkeeping from our character/story data.

**Interface**:

```typescript
interface StorageAdapter<T> {
  read(key: string): MaybePromise<T | undefined>;
  write(key: string, value: T): MaybePromise<void>;
  delete(key: string): MaybePromise<void>;
}
```

## R5: Story Turn Architecture

**Decision**: Each story turn is a short-lived interaction:
present scene → user picks action → save result → end. No
persistent conversation across turns.

**Rationale**: Long-running conversations replay from the start
on each update, accumulating overhead. With 10-turn context
windows, this would replay 10+ rounds of side effects. Instead,
load story state from DB, process one turn, save, and exit.

**Implementation approach**: Use callback query handlers (not
conversations) for story action selection. Session stores the
active story session ID; story history is loaded from DB.

## R6: OpenAI Integration

**Decision**: Use official `openai` npm package with
`chat.completions.create()` API.

**Rationale**: Directly matches constitution Technology Stack
requirement. Chat completions API supports system prompts for
DM persona, structured output for stats generation, and
streaming for long narrative responses.

**Key patterns**:

- System prompt defines DM personality and world rules
- Character stats generation: use structured output or JSON mode
  to get `{str, dex, con, int, wis, cha}` reliably
- Scene generation: include character sheet + last 10 turns in
  context, request scene description + 2-4 action options
- Wrap all calls in try/catch for graceful error handling per
  Constitution Principle IV
