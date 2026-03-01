# telegram-ai-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-28

## Active Technologies
- TypeScript 5.9.3 (strict mode) on Node.js 20 LTS + Jest 29.x (test runner), ESLint (linter — config to be added), npm (package manager) (004-github-actions-ci)
- N/A — CI configuration only, no data persistence (004-github-actions-ci)
- TypeScript 5.9.3 (strict mode) on Node.js 20 LTS — existing codebase; Terraform >= 1.0 — new IaC tooling + Yandex Terraform provider `>= 0.130`, `hashicorp/archive >= 2.0`, `hashicorp/null >= 3.2`, `hashicorp/random >= 3.5`, `Think-iT-Labs/dirhash` (no version pin) (005-terraform-yandex-deploy)
- YDB Serverless (existing schema: 6 tables defined in `src/infrastructure/ydb/migrations.ts`) (005-terraform-yandex-deploy)

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
- 005-terraform-yandex-deploy: Added TypeScript 5.9.3 (strict mode) on Node.js 20 LTS — existing codebase; Terraform >= 1.0 — new IaC tooling + Yandex Terraform provider `>= 0.120`, `hashicorp/archive >= 2.4`, `hashicorp/null >= 3.2`, `hashicorp/random >= 3.5`
- 004-github-actions-ci: Added TypeScript 5.9.3 (strict mode) on Node.js 20 LTS + Jest 29.x (test runner), ESLint (linter — config to be added), npm (package manager)

- 003-serverless-webhook: Added TypeScript 5.9.3 (strict mode) on Node.js 20+ LTS + grammY 1.40.1, @grammyjs/conversations 2.1.1, @grammyjs/menu 1.3.1, openai 6.25.0, @ydbjs/core ^6.0.7, @ydbjs/query ^6.0.7, @ydbjs/auth ^6.0.5, dotenv 17.3.1



<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
