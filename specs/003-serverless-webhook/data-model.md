# Data Model: Serverless Webhook Deployment

**Feature**: 003-serverless-webhook | **Date**: 2026-02-28

## Existing Entities (unchanged)

The following tables already exist and are not modified by this feature:

| Table | Primary Key | Purpose |
|-------|-------------|---------|
| `users` | `(user_id)` | User profiles with active character reference |
| `characters` | `(user_id, character_id)` | Character sheets (stats, class, backstory) |
| `story_sessions` | `(user_id, session_id)` | Story session lifecycle tracking |
| `story_turns` | `(user_id, session_id, turn_number)` | Individual turns within a story session |
| `bot_sessions` | `(session_key)` | grammY session and conversation state storage |

## New Entity: Processed Updates

### `processed_updates`

Tracks Telegram `update_id` values that have been processed to support idempotent webhook handling (FR-012).

| Column | Type | Description |
|--------|------|-------------|
| `update_id` | `Int64` | Primary key. Telegram's monotonically increasing update identifier. |
| `processed_at` | `Timestamp` | When the update was processed. Used for TTL-based cleanup. |

**Primary key**: `(update_id)`

**TTL policy**: Rows older than 24 hours are eligible for cleanup. YDB supports automatic TTL-based deletion via `Datetime::IntervalFromDays(1)` on the `processed_at` column. This prevents unbounded table growth without manual maintenance.

**Access patterns**:

- **Read**: Check if `update_id` exists before processing (single-row point lookup)
- **Write**: Insert `update_id` + `processed_at` after successful processing
- **Delete**: Automatic via YDB TTL policy

**DDL**:

```sql
CREATE TABLE processed_updates (
    update_id Int64 NOT NULL,
    processed_at Timestamp NOT NULL,
    PRIMARY KEY (update_id)
)
WITH (
    TTL = Interval("PT24H") ON processed_at
);
```

## Entity Relationships

```text
                    ┌─────────────────────┐
 Telegram Update ──→│  processed_updates  │  (idempotency gate)
                    │  update_id (PK)     │
                    │  processed_at       │
                    └─────────────────────┘
                              │
                    (if not duplicate)
                              │
                              ▼
                    ┌─────────────────────┐
                    │   bot_sessions      │  (grammY session state)
                    │   session_key (PK)  │
                    │   data (JSON)       │
                    └─────────────────────┘
                              │
                    (session context)
                              │
                    ┌─────────┴─────────────────────┐
                    ▼                               ▼
          ┌──────────────┐                ┌──────────────────┐
          │    users     │                │   characters     │
          └──────────────┘                └──────────────────┘
                                                    │
                                          ┌─────────┴────────┐
                                          ▼                  ▼
                                 ┌────────────────┐  ┌──────────────┐
                                 │ story_sessions │  │ story_turns  │
                                 └────────────────┘  └──────────────┘
```

## State Transitions

No new state machines introduced. The webhook handler is stateless — it processes a single update per invocation and persists all state to YDB via existing repositories and session storage.

## Configuration Entities (runtime, not persisted)

### Webhook Configuration

Not stored in a database — managed via Telegram Bot API and environment variables.

| Property | Source | Description |
|----------|--------|-------------|
| `WEBHOOK_URL` | Environment variable | Public HTTPS URL of the YCF function (via API Gateway) |
| `WEBHOOK_SECRET` | Environment variable | Secret token for `X-Telegram-Bot-Api-Secret-Token` verification |
| `BOT_INFO` | Hardcoded in config | Pre-cached `getMe` response to skip API call on cold start |

## Validation Rules

- `update_id` must be a positive integer (enforced by Telegram; no application-level validation needed)
- `WEBHOOK_SECRET` must be 1-256 characters, matching `[A-Za-z0-9_-]+` (Telegram constraint; validated at config load time)
- Webhook request body must contain a valid Telegram `Update` object (grammY validates internally; malformed payloads return HTTP 200 to prevent Telegram retries with bad data)
