<!--
=== Sync Impact Report ===
Version change: 1.1.0 → 1.2.0 (MINOR — new principle added)
Modified principles: none
Added sections:
  - VI. Meaningful Test Coverage (new core principle)
Modified sections:
  - Development Workflow → Testing line updated to align with
    Principle VI (was "only when explicitly requested", now
    "expected for all functionality")
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ no update needed
  - .specify/templates/spec-template.md — ✅ no update needed
  - .specify/templates/tasks-template.md — ✅ updated (tests note
    changed from OPTIONAL to expected-by-default)
  - .specify/templates/commands/*.md — ✅ no files present
Follow-up TODOs: none
=== End Report ===
-->

# Telegram AI Bot Constitution

## Core Principles

### I. TypeScript Strict Mode

All source code MUST be written in TypeScript with `strict: true`
enabled in `tsconfig.json`. Implicit `any` is forbidden. Every
function parameter, return type, and variable that crosses a module
boundary MUST have an explicit type annotation.

**Rationale**: A long-running bot process cannot afford silent type
coercion bugs. Strict typing catches integration mismatches at
compile time rather than in production chat sessions.

### II. Modular Separation of Concerns

The codebase MUST be organized into four distinct layers:

- **`telegram/`** — grammY Composers, commands, message handlers,
  menus, and middleware. Everything that touches `ctx` or Telegram
  types lives here. No direct OpenAI or database calls.
- **`domain/`** — Business logic services and types. AI prompt
  construction and response parsing live here. No Telegram-specific
  imports. No direct infrastructure access (use injected clients).
- **`infrastructure/`** — External API clients (OpenAI SDK),
  database adapters, HTTP clients. Created only when a concrete
  feature requires them (see Principle V).
- **`config/`** — Environment variable loading and validation.
  Single source of truth for all runtime configuration. Consumed
  by all layers.

**Import flow**: `telegram → domain → infrastructure`. The `config`
module is consumed by any layer but MUST NOT import from the other
three. Circular dependencies are forbidden.

**Composer pattern** (grammY-specific):

- Each module MUST be a standalone `Composer` that exports only
  its middleware via `.middleware()`.
- Only the root `bot.ts` creates the `Bot` instance.
- Modules are composed via `bot.use(composer.middleware())`.
- Sub-modules within `telegram/` (commands, messages, menu,
  middleware) each export a single aggregated `Composer`.

**Rationale**: The 4-layer architecture decouples Telegram
transport from business logic and external integrations, enabling
independent testing, provider swapping, and clear ownership. The
Composer pattern enforces modular composition without tight
coupling to a single Bot instance.

### III. Secrets via Environment Only

All sensitive values (Telegram bot token, OpenAI API key, any
future credentials) MUST be loaded exclusively from environment
variables. Hardcoded secrets in source code are forbidden. The
repository MUST contain a `.env.example` documenting every
required variable without real values. `.env` MUST be listed in
`.gitignore`.

**Rationale**: Prevents accidental credential leakage in version
control and enables per-environment configuration without code
changes.

### IV. Graceful Error Handling

The bot process MUST NOT crash on:

- Malformed or unexpected user input
- Transient OpenAI API failures (rate limits, timeouts, 5xx)
- Telegram API errors (message too long, chat not found)

Every external call (OpenAI, Telegram) MUST be wrapped in
error handling that logs the failure and returns a user-friendly
fallback message. Unhandled promise rejections MUST be caught at
the process level.

**Rationale**: A crashed bot is invisible to users — they simply
get no response. Graceful degradation preserves user trust and
provides diagnostic information for debugging.

### V. Simplicity & YAGNI

Start with the minimum viable implementation. Do not add:

- Abstractions for hypothetical future providers
- Database or cache adapters (`infrastructure/db.ts`,
  `infrastructure/redis.ts`) until persistence is explicitly
  required by a feature specification
- Plugin systems, feature flags, or configuration DSLs

Infrastructure modules MUST be created on-demand: only when a
concrete feature requires an external integration. The directory
structure in architecture documentation shows placement
conventions, not a mandate to create all files upfront.

Every structural decision MUST be justified by a current, concrete
requirement. If a simpler approach satisfies the requirement,
the simpler approach MUST be chosen.

**Rationale**: Premature complexity in bot projects creates
maintenance burden disproportionate to the value delivered.
Complexity is added incrementally when justified by real needs.

### VI. Meaningful Test Coverage

Every piece of functionality MUST be covered by tests that
verify its behavior. Test coverage SHOULD focus on code that
contains business logic, branching, data transformation, or
non-trivial orchestration.

Tests MUST NOT be written for trivial methods that merely
delegate to another method without any business logic (e.g.,
a thin wrapper that calls a single dependency and returns its
result unchanged). Such tests verify only that the programming
language works, not that the application behaves correctly.

**What MUST be tested**:

- Domain services and business logic (branching, validation,
  data mapping)
- Error handling paths (fallback behavior, retry logic)
- Input parsing and output formatting
- Non-trivial integrations (correct arguments passed to
  external APIs, response handling)

**What SHOULD be skipped**:

- Pure pass-through wrappers with no logic
- Simple getters/setters with no side effects
- Configuration re-exports or constant definitions

**Rationale**: Tests are valuable when they catch real bugs and
document intended behavior. Trivial tests add maintenance cost
without catching defects, creating a false sense of coverage.
Focusing effort on meaningful tests maximizes defect detection
per test written.

## Technology Stack

- **Runtime**: Node.js (LTS)
- **Language**: TypeScript 5.x with strict mode
- **Telegram Framework**: grammY
- **AI Provider**: OpenAI SDK (official `openai` npm package)
- **Package Manager**: npm (default; may be overridden by user
  preference)
- **Linting**: ESLint with TypeScript parser
- **Build**: `tsc` (TypeScript compiler) — no bundler unless
  explicitly required

All dependencies MUST be pinned to specific versions in
`package.json` to ensure reproducible builds.

## Development Workflow

- **Branching**: Feature branches off `main`. Direct commits to
  `main` are forbidden for non-trivial changes.
- **Commit style**: Conventional Commits (`feat:`, `fix:`,
  `docs:`, `chore:`).
- **Testing**: All functionality with business logic MUST have
  tests (see Principle VI). Tests MUST pass before merging.
  Trivial pass-through methods are exempt from mandatory coverage.
- **Environment setup**: Copy `.env.example` to `.env`, fill in
  real values, then `npm install && npm run build && npm start`.

## Governance

This constitution is the highest-authority document for project
decisions. All implementation plans, specifications, and task
lists MUST be consistent with the principles defined here.

**Amendment procedure**:

1. Propose change with rationale.
2. Update this document with new version number.
3. Verify all dependent templates and artifacts remain consistent.
4. Document the change in the Sync Impact Report comment block.

**Versioning**: MAJOR.MINOR.PATCH following semantic versioning.

- MAJOR: Principle removal or incompatible redefinition.
- MINOR: New principle added or existing one materially expanded.
- PATCH: Wording clarifications, typo fixes.

**Compliance**: Every spec, plan, and task list produced by the
project tooling MUST be validated against this constitution before
finalization.

**Version**: 1.2.0 | **Ratified**: 2026-02-28 | **Last Amended**: 2026-02-28
