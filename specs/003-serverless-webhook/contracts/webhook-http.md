# HTTP Contract: Webhook Endpoint

**Feature**: 003-serverless-webhook | **Date**: 2026-02-28

## Endpoint

**Method**: `POST`
**URL**: `https://<api-gateway-domain>.apigw.yandexcloud.net/webhook`
**Caller**: Telegram Bot API servers
**Handler**: Yandex Cloud Function (`src/handler.ts` → `handler` export)

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Telegram-Bot-Api-Secret-Token` | Yes | Secret token matching `WEBHOOK_SECRET` env var. Set during `setWebhook` registration. |

### Body

A Telegram [Update](https://core.telegram.org/bots/api#update) object (JSON). Key fields:

```typescript
interface TelegramUpdate {
  update_id: number;           // Monotonically increasing identifier
  message?: Message;           // New incoming message
  callback_query?: CallbackQuery; // Callback from inline keyboard button
  // ... other update types (not currently used by the bot)
}
```

The bot currently handles:
- `message` updates (text commands: `/start`, `/help`, conversation input)
- `callback_query` updates (menu button presses, story action selections)

### Example Request

```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 42,
    "from": {
      "id": 987654321,
      "is_bot": false,
      "first_name": "Alice"
    },
    "chat": {
      "id": 987654321,
      "type": "private"
    },
    "date": 1709164800,
    "text": "/start"
  }
}
```

## Responses

### 200 OK — Update Processed Successfully

Returned when the update is processed (or intentionally skipped as a duplicate).

**Body**: Empty, or optionally a JSON object for [webhook reply](https://core.telegram.org/bots/faq#how-can-i-make-requests-in-response-to-updates) (grammY may use this optimization).

```json
{}
```

### 200 OK — Malformed Payload

Returned for malformed or empty request bodies. Returns 200 (not 4xx) to prevent Telegram from retrying bad payloads indefinitely.

**Body**: Empty.

### 401 Unauthorized — Secret Token Mismatch

Returned when `X-Telegram-Bot-Api-Secret-Token` header is missing or doesn't match the configured secret.

**Body**: Empty.

### 500 Internal Server Error

Returned when an unexpected error occurs during update processing. Telegram will retry the update delivery.

**Body**: Empty.

## Idempotency

The endpoint is idempotent with respect to `update_id`. If an update with the same `update_id` has already been processed, the handler returns `200 OK` without re-executing bot logic. This handles Telegram's retry behavior on timeouts.

## Timeout Behavior

- **Function timeout**: Configured to 60 seconds
- **grammY webhook timeout**: Set to 55 seconds (`timeoutMilliseconds: 55000`)
- **Telegram retry**: Occurs after ~60 seconds of no response
- **On grammY timeout**: Returns `200 OK` via `onTimeout: "return"` to prevent Telegram retries for slow responses

## Security

- All requests must include a valid `X-Telegram-Bot-Api-Secret-Token` header
- Secret verification uses constant-time comparison (built into grammY) to prevent timing attacks
- The secret token is set during webhook registration via `bot.api.setWebhook()` and verified on every incoming request

## Webhook Registration Contract

### Register Webhook

```typescript
bot.api.setWebhook(WEBHOOK_URL, {
  secret_token: WEBHOOK_SECRET,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});
```

### Remove Webhook

```typescript
bot.api.deleteWebhook({
  drop_pending_updates: true,
});
```

### Query Webhook Status

```typescript
const info = await bot.api.getWebhookInfo();
// Returns: { url, pending_update_count, last_error_date?, last_error_message?, ... }
```
