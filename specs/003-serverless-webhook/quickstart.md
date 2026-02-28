# Quickstart: Serverless Webhook Deployment

**Feature**: 003-serverless-webhook | **Date**: 2026-02-28

## Prerequisites

- Node.js 20+ LTS
- npm
- Yandex Cloud CLI (`yc`) configured with appropriate permissions
- A deployed Yandex Cloud Function with HTTP trigger (infrastructure setup is out of scope for this feature)
- Bot token from @BotFather

## Local Development (Polling Mode — unchanged)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your BOT_TOKEN, OPENAI_API_KEY, YDB_ENDPOINT, YDB_DATABASE

# 3. Run in development mode (long-polling)
npm run dev
```

Polling mode works exactly as before. No webhook infrastructure needed for local development.

## Webhook Deployment

### Step 1: Configure Environment Variables

Add to your Yandex Cloud Function's environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `YDB_ENDPOINT` | Yes | YDB endpoint (e.g., `grpcs://ydb.serverless.yandexcloud.net:2135`) |
| `YDB_DATABASE` | Yes | YDB database path (e.g., `/ru-central1/b1g.../etn...`) |
| `YDB_METADATA_CREDENTIALS` | Yes | Set to `1` for YCF service account auth |
| `WEBHOOK_SECRET` | Yes | Secret token for webhook verification (1-256 chars, `[A-Za-z0-9_-]`) |

### Step 2: Run Migrations

Invoke the migration cloud function once (or after schema changes):

```bash
# Via Yandex Cloud CLI
yc serverless function invoke <migration-function-id>

# Or via the Yandex Cloud console
```

### Step 3: Deploy the Webhook Function

The entry point for the webhook cloud function is `dist/handler.handler`.

```bash
# Build
npm run build

# Deploy (example using yc CLI — actual deployment is infrastructure-specific)
yc serverless function version create \
  --function-id <function-id> \
  --runtime nodejs20 \
  --entrypoint handler.handler \
  --source-path ./dist \
  --execution-timeout 60s \
  --memory 256m \
  --environment BOT_TOKEN=...,OPENAI_API_KEY=...,YDB_ENDPOINT=...,YDB_DATABASE=...,YDB_METADATA_CREDENTIALS=1,WEBHOOK_SECRET=...
```

### Step 4: Register Webhook with Telegram

```bash
# Set the webhook URL and secret
WEBHOOK_URL=https://<your-api-gateway>.apigw.yandexcloud.net/webhook \
BOT_TOKEN=<your-bot-token> \
WEBHOOK_SECRET=<your-secret> \
npx tsx src/webhook/scripts/set-webhook.ts

# Verify webhook is registered
# (The script prints getWebhookInfo output after registration)
```

### Step 5: Verify

Send `/start` to your bot in Telegram. You should receive the welcome message with the main menu.

## Switching Back to Polling

```bash
# Remove the webhook
BOT_TOKEN=<your-bot-token> \
npx tsx src/webhook/scripts/delete-webhook.ts

# Resume local polling
npm run dev
```

## Entry Points Summary

| Entry Point | File | Mode | Usage |
|-------------|------|------|-------|
| Polling (dev) | `src/bot.ts` | Long-polling via `bot.start()` | `npm run dev` / `npm start` |
| Webhook (prod) | `src/handler.ts` | HTTP handler for YCF | Yandex Cloud Function entrypoint |
| Migration | `src/migrate.ts` | One-shot DDL execution | Separate cloud function |
| Set Webhook | `src/webhook/scripts/set-webhook.ts` | CLI utility | `npx tsx src/webhook/scripts/set-webhook.ts` |
| Delete Webhook | `src/webhook/scripts/delete-webhook.ts` | CLI utility | `npx tsx src/webhook/scripts/delete-webhook.ts` |
