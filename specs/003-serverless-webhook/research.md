# Research: Serverless Webhook Deployment

**Feature**: 003-serverless-webhook | **Date**: 2026-02-28

## R1: grammY Webhook Processing Without Polling

**Decision**: Use `webhookCallback` with a custom `FrameworkAdapter` for Yandex Cloud Functions.

**Rationale**: grammY provides `webhookCallback(bot, adapter, options)` which wraps `bot.handleUpdate()` with lazy `bot.init()`, secret token verification (constant-time comparison), and timeout handling. A custom adapter is cleaner than calling `bot.handleUpdate()` directly because it gets secret verification and timeout management for free.

**Alternatives considered**:

- **`bot.handleUpdate()` directly**: Works but requires reimplementing secret token verification and timeout logic manually. More code, more risk of timing-attack vulnerabilities in secret comparison.
- **Built-in `"aws-lambda-async"` adapter**: Close to YCF's event shape but not identical — YCF auto-parses JSON bodies (body can be an object, not always a string) and has slightly different header casing. Adapting would be fragile.
- **`"http"` / `"https"` adapter**: Requires a Node.js HTTP server, which doesn't match the YCF function handler model.

**Key findings**:

- `webhookCallback` handles `bot.init()` lazily with deduplication for concurrent cold-start requests
- `WebhookOptions.secretToken` enables built-in constant-time header verification
- `WebhookOptions.timeoutMilliseconds` + `onTimeout: "return"` prevents function timeout from crashing
- The custom adapter interface (`FrameworkAdapter → ReqResHandler`) is ~20 lines of code

## R2: Yandex Cloud Functions Handler Contract

**Decision**: Use the standard YCF async handler signature with HTTP trigger event format.

**Rationale**: YCF Node.js functions export an async handler receiving `(event, context)`. The event contains HTTP request data (method, headers, body, query params). The function returns a response object with `statusCode`, `headers`, and `body`.

**Alternatives considered**:

- **Wrapping in an Express/Fastify server**: Unnecessary overhead; YCF provides HTTP handling natively. Would add a dependency for no benefit.
- **Using YCF's message queue trigger instead of HTTP**: Would lose Telegram's webhook retry semantics and require a separate API Gateway setup to receive webhooks and enqueue them. Over-engineered for this use case.

**Key findings**:

- Handler signature: `async function handler(event, context) → { statusCode, headers?, body? }`
- **Critical**: YCF auto-parses JSON request bodies — `event.body` may be an object (not a string) when `Content-Type: application/json`. The adapter must handle both cases.
- `context.token` provides an IAM token when a service account is attached (useful for YDB metadata auth)
- Single-concurrency per instance: no race conditions on module-level state
- Cold start initializes module-level code; warm starts preserve all module-level variables (including DB connections, Bot instance)
- Default timeout: 5s (must be configured to 60s for webhook processing)
- Environment variables configured per function version, accessed via `process.env`

## R3: Cold Start Optimization

**Decision**: Pre-set `botInfo` in the Bot constructor to eliminate the `getMe` API call on cold starts. Keep YDB driver as a lazy singleton (existing pattern).

**Rationale**: `bot.init()` calls `getMe` on the Telegram API, adding 100-500ms to cold starts. Since bot info is static, it can be hardcoded. The YDB driver already uses a singleton pattern that naturally reuses connections on warm starts.

**Alternatives considered**:

- **Let `webhookCallback` call `bot.init()` lazily**: Works but adds unnecessary latency on every cold start. The `getMe` response never changes for a given bot token.
- **Cache `botInfo` in YDB or `/tmp`**: Over-engineered for a static value. Adds a DB read or file read on cold start instead of eliminating the call entirely.

**Key findings**:

- `new Bot(token, { botInfo: { ... } })` skips `bot.init()` entirely
- Bot info can be obtained once via `bot.api.getMe()` and hardcoded
- `webhookCallback` checks `initialized` flag in closure — survives warm starts, resets on cold starts
- With pre-set `botInfo`, no Telegram API call is needed during initialization

## R4: Shared Bot Factory Pattern

**Decision**: Extract bot construction and middleware registration into `src/create-bot.ts` — a factory function returning a configured `Bot<MyContext>` instance without starting polling.

**Rationale**: Both `bot.ts` (polling) and `handler.ts` (webhook) need the same Bot instance with the same middleware stack, handlers, conversations, and menus. Currently, `bot.ts` does everything in `main()`. Extracting the shared setup into a factory enables code reuse (FR-007) without duplicating middleware registration.

**Alternatives considered**:

- **Import bot.ts and conditionally skip `bot.start()`**: Fragile; module-level side effects (migrations, `bot.start()`) would execute on import. Requires significant refactoring of bot.ts's structure anyway.
- **Create a Bot singleton module**: Similar to the factory approach but uses module-level state for the Bot instance. Risk: harder to test, and the singleton couples initialization order to import order.

**Key findings**:

- Factory accepts dependencies (driver, repos, services) and returns a configured `Bot<MyContext>`
- `bot.ts` calls factory → then `bot.start()` (polling)
- `handler.ts` calls factory at module level → uses `webhookCallback` (webhook)
- Both share identical middleware stack ordering (error → session → conversations → menu → commands → handlers)

## R5: Duplicate Update Handling (Idempotency)

**Decision**: Use a lightweight `processed_updates` tracking mechanism — store recently processed `update_id` values and skip duplicates at the handler entry point.

**Rationale**: Telegram retries webhook delivery if it doesn't receive a response within ~60 seconds. In a serverless environment, this can result in the same update being processed twice (the original invocation timed out but still completed, and the retry processes it again). Skipping already-processed updates prevents duplicate bot responses.

**Alternatives considered**:

- **In-memory Set of update_ids**: Lost on cold start; only prevents duplicates within a single warm instance. Insufficient for serverless where Telegram may hit a different instance on retry.
- **Always return 200 immediately, process async**: YCF doesn't support background processing after response. The function execution stops when the handler returns.
- **Rely on Telegram's retry being rare**: Possible but violates FR-012 which explicitly requires idempotent processing.

**Key findings**:

- `update_id` is a monotonically increasing integer provided by Telegram in every update
- A simple YDB table or key-value check before processing is sufficient
- The existing `bot_sessions` table pattern (key-value with YDB) can inform the implementation
- TTL-based cleanup (e.g., drop entries older than 24h) prevents unbounded growth
- The check must happen before `bot.handleUpdate()` to prevent any side effects from duplicate processing

## R6: Webhook Registration Scripts

**Decision**: Create standalone TypeScript CLI scripts (`set-webhook.ts`, `delete-webhook.ts`) that use grammY's `bot.api` methods directly.

**Rationale**: grammY wraps Telegram's `setWebhook`, `deleteWebhook`, and `getWebhookInfo` API methods. Using `bot.api.setWebhook()` is simpler and more type-safe than raw HTTP calls. Scripts are invoked manually or from CI/CD — they are not part of the serverless function.

**Alternatives considered**:

- **HTTP calls with `fetch`**: Works but loses type safety and requires manual URL construction. No benefit over grammY's built-in methods.
- **Interactive CLI with prompts**: Over-engineered per Principle V. Simple scripts with environment variable configuration are sufficient for SC-005.
- **Built into the bot as a `/setwebhook` command**: Security risk — webhook management should not be exposed to Telegram users.

**Key findings**:

- `bot.api.setWebhook(url, { secret_token, allowed_updates, drop_pending_updates })` — registers webhook
- `bot.api.deleteWebhook({ drop_pending_updates })` — removes webhook, enables polling again
- `bot.api.getWebhookInfo()` — returns current webhook status (URL, pending count, errors)
- `secret_token` supports 1-256 chars (A-Za-z0-9_-), sent in `X-Telegram-Bot-Api-Secret-Token` header
- Scripts need only `BOT_TOKEN` and `WEBHOOK_URL` from environment — minimal configuration

## R7: Migration Cloud Function

**Decision**: Create a thin `src/migrate.ts` entry point that initializes the YDB driver and runs the existing `runMigrations()` function. Deploy as a separate cloud function.

**Rationale**: FR-008 explicitly forbids running migrations during webhook handler initialization. FR-011 requires a dedicated migration function. The existing `runMigrations()` in `src/infrastructure/ydb/migrations.ts` already contains all DDL statements — the migration entry point simply calls it.

**Alternatives considered**:

- **Run migrations in a CI/CD step using a local script**: Valid but doesn't provide an in-cloud function that operators can invoke on demand. The entry point can serve both purposes.
- **Check migration state on each invocation and skip if current**: Adds per-invocation latency for a check that almost never finds work. Violates Principle V.

**Key findings**:

- `runMigrations(driver)` executes 5 `CREATE TABLE IF NOT EXISTS` DDL statements (idempotent)
- The migration function needs only `YDB_ENDPOINT` and `YDB_DATABASE` environment variables
- Can be triggered manually via YCF console, CLI (`yc serverless function invoke`), or deployment hook
- No webhook secret or bot token needed — this function doesn't interact with Telegram
