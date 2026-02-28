# Data Model: Jest Test Coverage

**Feature**: 002-jest-test-coverage
**Date**: 2026-02-28

This feature adds test files — it does not introduce new domain entities or modify existing data models. This document defines the **test infrastructure model**: what test files exist, what they mock, and how they relate to source modules.

## Test File → Source Module Mapping

Each test file tests exactly one source module. Mocks isolate the unit under test from its dependencies.

### Config Layer

| Test File | Source Module | Mocks Required |
|-----------|---------------|----------------|
| tests/config/index.test.ts | src/config/index.ts | `process.env` (environment variables) |

### Domain Layer

| Test File | Source Module | Mocks Required |
|-----------|---------------|----------------|
| tests/domain/ai/service.test.ts | src/domain/ai/service.ts | `getOpenAIClient()` singleton (OpenAI chat completions API) |
| tests/domain/character/service.test.ts | src/domain/character/service.ts | Character repo, User repo, `generateCharacterStats()` from AI service |
| tests/domain/story/service.test.ts | src/domain/story/service.ts | Story session repo, Story turn repo, `generateScene()` from AI service |

### Infrastructure Layer

| Test File | Source Module | Mocks Required |
|-----------|---------------|----------------|
| tests/infrastructure/ydb/repositories/user.repo.test.ts | src/infrastructure/ydb/repositories/user.repo.ts | YDB Driver + QueryClient (`execute()` method) |
| tests/infrastructure/ydb/repositories/character.repo.test.ts | src/infrastructure/ydb/repositories/character.repo.ts | YDB Driver + QueryClient |
| tests/infrastructure/ydb/repositories/story-session.repo.test.ts | src/infrastructure/ydb/repositories/story-session.repo.ts | YDB Driver + QueryClient |
| tests/infrastructure/ydb/repositories/story-turn.repo.test.ts | src/infrastructure/ydb/repositories/story-turn.repo.ts | YDB Driver + QueryClient |
| tests/infrastructure/ydb/storage-adapter.test.ts | src/infrastructure/ydb/storage-adapter.ts | YDB Driver + QueryClient |

### Telegram Layer

| Test File | Source Module | Mocks Required |
|-----------|---------------|----------------|
| tests/telegram/commands/start.test.ts | src/telegram/commands/start.ts | User repo, Character service, Story service, Menu, grammY Context |
| tests/telegram/commands/help.test.ts | src/telegram/commands/help.ts | grammY Context |
| tests/telegram/handlers/story-action.test.ts | src/telegram/handlers/story-action.ts | Story service, Character service, grammY Context (callback query) |
| tests/telegram/middleware/error.test.ts | src/telegram/middleware/error.ts | grammY Context, NextFunction |

## Mock Archetypes

These are the reusable mock shapes needed across test files.

### OpenAI Client Mock

Used by: AI service tests

```
Shape: {
  chat.completions.create(params) → Promise<{ choices: [{ message: { content: string } }] }>
}
```

### YDB QueryClient Mock

Used by: All repository tests, storage adapter tests

```
Shape: {
  execute({ text, parameters }) → Promise<{ resultSets: [{ rows: Row[] }] }>
}
```

### YDB Driver Mock

Used by: All infrastructure tests

```
Shape: {
  Provides QueryClient via getQueryClient(driver)
}
```

### grammY Context Mock

Used by: All Telegram layer tests

```
Shape: {
  from: { id: number }
  reply(text, options?) → Promise
  answerCallbackQuery(text?) → Promise
  callbackQuery: { data: string }
  session: AppSessionData
  conversation.enter(name) → Promise
}
```

### Service Mocks (Character, Story)

Used by: Telegram command/handler tests

```
Shape: Factory function return types with all methods as jest.fn()
```

## State Transitions Under Test

### AI Service: Retry Logic

```
Call → Success → Return result
Call → Transient error (429/5xx) → Retry (up to N times) → Success or AIServiceError
Call → Non-transient error → AIServiceError immediately
```

### Story Session Lifecycle

```
(none) → startNewSession() → active
active → processActionChoice() + generateNextScene() → active (new turn)
active → completeSession() → completed
active → resumeSession() → active (resumed with last turn)
```

### Character Lifecycle

```
(none) → createCharacter() → active
active → archiveCharacter() → inactive
active → getActiveCharacter() → active (read-only)
```
