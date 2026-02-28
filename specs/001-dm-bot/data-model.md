# Data Model: Dungeon Master Bot

**Feature**: 001-dm-bot
**Date**: 2026-02-28
**Storage**: YDB (Yandex Database)

## Entities

### users

Primary record for each Telegram user. Created on first `/start`.

| Column | YDB Type | Nullable | Description |
|--------|----------|----------|-------------|
| `user_id` | `Utf8` | No | Telegram user ID (string) |
| `active_character_id` | `Utf8` | Yes | FK to characters.character_id |
| `created_at` | `Timestamp` | No | Registration time |

**Primary key**: `(user_id)`

### characters

Player characters with stats. One active per user; old ones are
archived.

| Column | YDB Type | Nullable | Description |
|--------|----------|----------|-------------|
| `character_id` | `Utf8` | No | UUID |
| `user_id` | `Utf8` | No | Owning Telegram user ID |
| `name` | `Utf8` | No | Character name (1-50 chars) |
| `class` | `Utf8` | No | warrior/mage/rogue/healer |
| `backstory` | `Utf8` | No | Free-form text (max 2000 chars) |
| `str` | `Uint8` | No | Strength (3-18) |
| `dex` | `Uint8` | No | Dexterity (3-18) |
| `con` | `Uint8` | No | Constitution (3-18) |
| `int` | `Uint8` | No | Intelligence (3-18) |
| `wis` | `Uint8` | No | Wisdom (3-18) |
| `cha` | `Uint8` | No | Charisma (3-18) |
| `is_active` | `Bool` | No | true = current, false = archived |
| `created_at` | `Timestamp` | No | Creation time |

**Primary key**: `(user_id, character_id)`

Partitioning by `user_id` ensures all characters for a user are
co-located. Global secondary index on `(character_id)` for direct
lookups if needed.

### story_sessions

Tracks an ongoing or completed adventure.

| Column | YDB Type | Nullable | Description |
|--------|----------|----------|-------------|
| `session_id` | `Utf8` | No | UUID |
| `user_id` | `Utf8` | No | Owning Telegram user ID |
| `character_id` | `Utf8` | No | FK to characters |
| `status` | `Utf8` | No | active/completed |
| `created_at` | `Timestamp` | No | Session start time |
| `updated_at` | `Timestamp` | No | Last activity time |

**Primary key**: `(user_id, session_id)`

### story_turns

Individual turns within a story session. Stores scene descriptions
and chosen actions for context window.

| Column | YDB Type | Nullable | Description |
|--------|----------|----------|-------------|
| `user_id` | `Utf8` | No | Owning Telegram user ID |
| `session_id` | `Utf8` | No | FK to story_sessions |
| `turn_number` | `Uint32` | No | Sequential turn number |
| `scene_text` | `Utf8` | No | DM's scene description |
| `actions_json` | `Json` | No | JSON array of offered actions |
| `chosen_action` | `Utf8` | Yes | User's selected action (null for latest turn) |
| `created_at` | `Timestamp` | No | Turn creation time |

**Primary key**: `(user_id, session_id, turn_number)`

Partitioning by `(user_id, session_id)` co-locates all turns for
a session. The 10-turn context window reads the last 10 rows
ordered by `turn_number DESC`.

### bot_sessions

grammY session storage for conversation state and app state.

| Column | YDB Type | Nullable | Description |
|--------|----------|----------|-------------|
| `session_key` | `Utf8` | No | grammY session key (user ID string) |
| `data` | `Json` | No | Serialized session JSON |
| `updated_at` | `Timestamp` | No | Last update time |

**Primary key**: `(session_key)`

## Relationships

```
users 1──* characters       (user_id)
users 1──? characters       (active_character_id → character_id)
characters 1──* story_sessions  (user_id, character_id)
story_sessions 1──* story_turns (user_id, session_id)
```

## State Transitions

### Character lifecycle
```
[new] → creating → active → archived
```
- `creating`: user in character creation flow (conversation state)
- `active`: `is_active = true`, at most one per user
- `archived`: `is_active = false`, when user creates a new character

### Story session lifecycle
```
[new] → active → completed
```
- `active`: user can continue this session
- `completed`: story has ended (user started new adventure or
  explicit conclusion)

## Write Patterns

All writes use `UPSERT` per YDB best practices:

- **Create user**: UPSERT into users
- **Create character**: UPSERT into characters + UPDATE users
  `active_character_id` (in one transaction)
- **Archive character**: UPDATE characters SET `is_active = false`
  WHERE `user_id` and previous character_id
- **New story turn**: UPSERT into story_turns + UPDATE
  story_sessions `updated_at`
- **Session storage**: UPSERT into bot_sessions (JSON blob)

## Query Patterns

- **Load user + active character**: Read users by `user_id`,
  then read characters by `(user_id, active_character_id)`
- **Load story context (10 turns)**: Read story_turns by
  `(user_id, session_id)` ORDER BY `turn_number DESC` LIMIT 10
- **Check existing character on /start**: Read users by `user_id`,
  check if `active_character_id` is set
