# telegram-ai-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-28

## Active Technologies

- TypeScript 5.9.3 (strict mode) on Node.js 20+ LTS + grammY 1.40.1, @grammyjs/conversations 2.1.1, @grammyjs/menu 1.3.1, openai 6.25.0, @ydbjs/core ^6.0.7, @ydbjs/query ^6.0.7, @ydbjs/auth ^6.0.5, dotenv 17.3.1 (003-serverless-webhook)
- YDB (Yandex Database) — 5 tables: users, characters, story_sessions, story_turns, bot_sessions (003-serverless-webhook)

- TypeScript 5.9.3 (strict mode) on Node.js 20+ LTS + Jest 29.x, ts-jest 29.x, @types/jes (002-jest-test-coverage)
- N/A (all DB interactions mocked in tests) (002-jest-test-coverage)

- TypeScript 5.x (strict mode) on Node.js 20+ LTS + grammY, @grammY/conversations, @grammY/menu, openai, ydb-sdk, dotenv (001-dm-bot)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.9.3 (strict mode) on Node.js 20+ LTS: Follow standard conventions

## Recent Changes

- 003-serverless-webhook: Added TypeScript 5.9.3 (strict mode) on Node.js 20+ LTS + grammY 1.40.1, @grammyjs/conversations 2.1.1, @grammyjs/menu 1.3.1, openai 6.25.0, @ydbjs/core ^6.0.7, @ydbjs/query ^6.0.7, @ydbjs/auth ^6.0.5, dotenv 17.3.1

- 002-jest-test-coverage: Added TypeScript 5.9.3 (strict mode) on Node.js 20+ LTS + Jest 29.x, ts-jest 29.x, @types/jest

- 001-dm-bot: Added TypeScript 5.x (strict mode) on Node.js 20+ LTS + grammY, @grammY/conversations, @grammY/menu, openai, ydb-sdk, dotenv

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
