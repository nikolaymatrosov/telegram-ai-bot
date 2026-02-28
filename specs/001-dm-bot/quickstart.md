# Quickstart: Dungeon Master Bot

## Prerequisites

- Node.js 20+ (LTS)
- A Telegram bot token (from @BotFather)
- An OpenAI API key
- YDB instance (local Docker or Yandex Cloud)

## Setup

1. Clone and install:

```bash
git clone <repo-url>
cd telegram-ai-bot
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Fill in `.env`:

```
BOT_TOKEN=your-telegram-bot-token
OPENAI_API_KEY=your-openai-api-key
YDB_ENDPOINT=grpc://localhost:2136
YDB_DATABASE=/local
```

3. Start local YDB (Docker):

```bash
docker run -d --name ydb-local \
  -p 2136:2136 \
  -e GRPC_TLS_PORT=2135 \
  -e GRPC_PORT=2136 \
  -e MON_PORT=8765 \
  cr.yandex/yc/yandex-docker-local-ydb:latest
```

4. Build and run:

```bash
npm run build
npm start
```

The bot will:
- Connect to YDB and create tables if they don't exist
- Start polling for Telegram updates
- Log "Bot started" when ready

## Verify

1. Open Telegram, find your bot by username
2. Send `/start`
3. You should see the character creation prompt
4. Complete: enter name → select class → write backstory
5. Review the generated character sheet and confirm
6. The DM begins narrating your adventure

## Development

```bash
npm run dev    # ts-node with watch mode (if configured)
npm run build  # compile TypeScript
npm run lint   # run ESLint
```

## Project Structure

```
src/
├── bot.ts                 # Entry point
├── config/
│   └── index.ts           # Env loading and validation
├── telegram/
│   ├── bot.ts             # Bot instance creation
│   ├── commands/
│   │   ├── start.ts       # /start command + routing
│   │   ├── help.ts        # /help command
│   │   └── index.ts       # Commands Composer
│   ├── conversations/
│   │   ├── character-creation.ts
│   │   └── index.ts
│   ├── handlers/
│   │   ├── story-action.ts # Callback query handler for actions
│   │   └── index.ts
│   ├── menu/
│   │   ├── main-menu.ts   # Returning user menu
│   │   └── index.ts
│   ├── middleware/
│   │   ├── session.ts     # Session setup
│   │   ├── error.ts       # Error boundary
│   │   └── index.ts
│   └── index.ts           # Telegram layer Composer
├── domain/
│   ├── character/
│   │   ├── service.ts     # Character creation logic
│   │   └── types.ts       # Character types
│   ├── story/
│   │   ├── service.ts     # Scene generation logic
│   │   └── types.ts       # Story types
│   └── ai/
│       ├── service.ts     # OpenAI wrapper
│       ├── prompts.ts     # System prompts
│       └── types.ts       # AI request/response types
└── infrastructure/
    ├── ydb/
    │   ├── driver.ts      # YDB driver singleton
    │   ├── storage-adapter.ts  # grammY session adapter
    │   └── repositories/
    │       ├── user.repo.ts
    │       ├── character.repo.ts
    │       ├── story-session.repo.ts
    │       └── story-turn.repo.ts
    └── openai/
        └── client.ts      # OpenAI client singleton
```
