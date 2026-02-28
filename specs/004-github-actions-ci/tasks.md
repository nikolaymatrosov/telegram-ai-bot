# Tasks: Automated Test Execution on Code Changes

**Input**: Design documents from `/specs/004-github-actions-ci/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No test tasks generated — this feature is CI/CD configuration only (no business logic to test). Correctness is validated by running the workflow and local verification commands.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install ESLint tooling and configure the lint script so subsequent phases can use `npm run lint`

- [x] T001 Install ESLint devDependencies (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-jest`) in package.json
- [x] T002 Add `"lint": "eslint ."` script to the `scripts` section in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish ESLint configuration and clean lint baseline — the CI workflow depends on `npm run lint` passing

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create ESLint flat config at eslint.config.js with: `@eslint/js` recommended rules, `typescript-eslint` `recommendedTypeChecked` preset with `projectService: true`, `eslint-plugin-jest` scoped to test files (`tests/**`), `dist/**` in ignores, and type-checked rules disabled for `.js` files
- [x] T004 Run `npm run lint` and fix all existing lint errors across `src/` and `tests/` to establish a clean baseline

**Checkpoint**: `npm run lint` passes with zero errors — CI lint step will succeed

---

## Phase 3: User Story 1 — Automatic Test Feedback on Pull Requests (Priority: P1) MVP

**Goal**: Tests and linting run automatically on every pull request so contributors get immediate feedback before code review

**Independent Test**: Open a pull request with passing tests — verify the CI check runs and reports green. Push a commit that breaks a test — verify it reports red with failure details visible.

### Implementation for User Story 1

- [x] T005 [US1] Create `.github/workflows/ci.yml` with `pull_request` trigger on all branches, a single job named `ci` on `ubuntu-latest`, Node.js version matrix `[20, 22]`, npm caching via `actions/setup-node@v4` with `cache: 'npm'`, and sequential steps: `actions/checkout@v4` → `actions/setup-node@v4` → `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm test`, with `timeout-minutes: 15` at the job level

**Checkpoint**: A pull request triggers the CI workflow; pass/fail results appear as a status check on the PR

---

## Phase 4: User Story 2 — Main Branch Protection via Post-Merge Testing (Priority: P2)

**Goal**: Tests run automatically on every push to main, providing a safety net for regressions that slip through pull requests

**Independent Test**: Merge a pull request into main — verify the CI workflow runs automatically on the resulting merge commit in the Actions tab.

### Implementation for User Story 2

- [x] T006 [US2] Add `push` trigger filtered to `branches: [main]` alongside the existing `pull_request` trigger in `.github/workflows/ci.yml`

**Checkpoint**: Pushing to main triggers the CI workflow; results are visible in the Actions tab

---

## Phase 5: User Story 3 — Visible Build Status for Contributors (Priority: P3)

**Goal**: Contributors can see the project's CI health at a glance from the repository page

**Independent Test**: View the repository README on GitHub — verify the badge shows the current build status (passing/failing) and links to the workflow runs page filtered to the main branch.

### Implementation for User Story 3

- [x] T007 [US3] Add CI status badge to the top of README.md using format `[![CI](https://github.com/nikolaymatrosov/telegram-ai-bot/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nikolaymatrosov/telegram-ai-bot/actions/workflows/ci.yml)` — create README.md if it does not exist

**Checkpoint**: README.md displays a clickable CI badge reflecting main branch build status

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete setup locally and ensure everything works end-to-end

- [x] T008 Run local verification: `npm install && npm run lint && npm test` to confirm both commands pass cleanly (per quickstart.md)
- [x] T009 Review ci.yml for correctness: valid YAML structure, correct action versions (`checkout@v4`, `setup-node@v4`), matrix syntax, trigger events, and step ordering

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational phase (needs `npm run lint` to pass)
- **US2 (Phase 4)**: Depends on US1 (modifies the same ci.yml file created in US1)
- **US3 (Phase 5)**: Depends on Foundational phase only (README badge is independent of workflow content)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — creates the workflow file
- **User Story 2 (P2)**: Depends on US1 — adds a trigger to the existing workflow file
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — edits README.md (independent file)

### Parallel Opportunities

- T001 and T002 can be done together (both modify package.json but different sections)
- T005 (US1) and T007 (US3) can run in parallel after Phase 2 (different files)
- T006 (US2) must wait for T005 (US1) since it modifies the same file

---

## Parallel Example: After Phase 2

```text
# These can run in parallel (different files):
Task T005: Create ci.yml with PR trigger in .github/workflows/ci.yml
Task T007: Add CI status badge to README.md

# This must wait for T005:
Task T006: Add push-to-main trigger to .github/workflows/ci.yml
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install ESLint, add lint script)
2. Complete Phase 2: Foundational (ESLint config, fix lint errors)
3. Complete Phase 3: User Story 1 (CI workflow with PR trigger)
4. **STOP and VALIDATE**: Open a test PR and verify CI runs
5. PR checks work — MVP delivered

### Incremental Delivery

1. Setup + Foundational → ESLint configured and passing
2. Add US1 (PR triggers) → Test via pull request → CI feedback works (MVP!)
3. Add US2 (push-to-main trigger) → Merge to main → Verify post-merge CI
4. Add US3 (README badge) → View repo page → Badge visible
5. Polish → Full local verification → Done

### Note on US2 Dependency

Unlike typical features where user stories are independent, US2 modifies the same workflow file created by US1. This is intentional per research decision R-001 (single workflow file). The dependency is minimal — US2 adds only a trigger line to an existing file.
