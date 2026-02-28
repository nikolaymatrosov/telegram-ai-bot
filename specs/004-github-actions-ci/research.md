# Research: Automated Test Execution on Code Changes

**Feature**: 004-github-actions-ci
**Date**: 2026-02-28

## R-001: GitHub Actions Workflow Structure

**Decision**: Single workflow file (`.github/workflows/ci.yml`) with one job triggered on `push` to `main` and `pull_request` to all branches.

**Rationale**: A single job with sequential steps (checkout → setup-node → install → build → lint → test) is the simplest approach for a project of this size. Splitting lint and test into parallel jobs adds complexity with no meaningful speed benefit given the small test suite.

**Alternatives considered**:
- Separate workflows for PR and push — rejected: duplicates configuration, harder to maintain.
- Parallel lint/test jobs — rejected: adds matrix complexity for marginal time savings on a small project.

## R-002: Node.js Version Matrix

**Decision**: Test against Node.js 20 and 22 using a matrix strategy.

**Rationale**: The project targets "Node.js 20+ LTS". Node.js 20 LTS reaches EOL on April 30, 2026. Node.js 22 is the current Active LTS (EOL April 2027). Testing both ensures compatibility with the minimum supported version and the migration path.

**Alternatives considered**:
- Node.js 20 only — rejected: too narrow, Node 20 EOL is imminent.
- Node.js 20 + 22 + 24 — rejected: Node 24 is "Current" (not LTS), adds CI time without clear benefit for this project's LTS target.

## R-003: Dependency Installation Strategy

**Decision**: Use `npm ci` for deterministic, reproducible installs.

**Rationale**: `npm ci` uses exact versions from `package-lock.json`, never modifies the lockfile, deletes `node_modules` before installing (clean state), and is faster than `npm install` in CI due to skipping dependency resolution.

**Alternatives considered**:
- `npm install` — rejected: can modify `package-lock.json`, non-deterministic.

## R-004: Caching Strategy

**Decision**: Use `actions/setup-node@v4` with built-in `cache: 'npm'` to cache `~/.npm` (the npm global cache).

**Rationale**: This is the officially recommended and simplest approach. It caches downloaded tarballs so `npm ci` extracts locally instead of fetching from the registry. Cache key is auto-derived from `package-lock.json` hash.

**Alternatives considered**:
- Direct `node_modules` caching — rejected: `npm ci` deletes `node_modules` before install, making this counterproductive.
- `actions/cache` manual setup — rejected: `setup-node` built-in caching handles this automatically with less configuration.

## R-005: ESM and `--experimental-vm-modules` in CI

**Decision**: No special CI configuration needed. The existing `npm test` script already passes `--experimental-vm-modules` to Node.js.

**Rationale**: The flag works in GitHub Actions runners without known issues on Jest 29.x + Node.js 20/22. Node.js prints a cosmetic `ExperimentalWarning` to stderr, but this does not affect test results. Setting `NODE_OPTIONS: '--experimental-vm-modules'` at job level is optional but adds clarity.

**Alternatives considered**:
- Setting `NODE_OPTIONS` env var at job level — acceptable alternative, provides consistency but adds a line of config for no functional benefit since the test script already handles it.

## R-006: Workflow Timeout

**Decision**: Set `timeout-minutes: 15` at the job level.

**Rationale**: The spec requires completion within 10 minutes (FR-006). A 15-minute timeout provides 50% headroom for slow runners while preventing runaway jobs. GitHub's default of 360 minutes is far too generous and could burn CI minutes on hangs.

**Alternatives considered**:
- Per-step timeouts — rejected: adds granularity without clear benefit for a simple workflow.
- 10-minute timeout — rejected: too tight, could cause false failures on slow runners or cache misses.

## R-007: CI Status Badge

**Decision**: Add a clickable badge to `README.md` linking to the workflow runs page, filtered to the `main` branch.

**Rationale**: Standard practice for open-source projects. Provides at-a-glance health visibility per spec User Story 3 (FR-008).

**Format**: `[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)`

## R-008: ESLint Configuration

**Decision**: Use flat config (`eslint.config.js`) with ESLint 10, `typescript-eslint` with `recommendedTypeChecked` preset, and `eslint-plugin-jest` scoped to test files.

**Rationale**: ESLint 10 (released February 2026) completely removes `.eslintrc` support. The project has `"type": "module"` so `eslint.config.js` is interpreted as ESM natively. The `recommendedTypeChecked` preset is the sweet spot — it catches unsafe `any` and floating promises via type-aware rules while being semver-stable (unlike `strictTypeChecked`).

**Packages needed** (3 + 1 optional):
- `eslint` (v10.x)
- `@eslint/js` (built-in recommended JS rules)
- `typescript-eslint` (bundles parser + plugin)
- `eslint-plugin-jest` (Jest-specific rules, scoped to test files)

**Key config decisions**:
- `parserOptions.projectService: true` — uses TypeScript's project service (stable since v8) instead of older `project: true`
- Ignore `dist/**` — never lint compiled output
- Disable type-checked rules for `.js` files (e.g., config files)
- Lint script: `"lint": "eslint ."` — no `--ext` flag (flat config handles file matching via `files` patterns)

**Alternatives considered**:
- Legacy `.eslintrc` — rejected: removed in ESLint 10.
- `strictTypeChecked` preset — rejected: not semver-stable, changes in minor releases, intended for teams with highly proficient TS developers.
- `eslint-plugin-import` — rejected: not needed since the project has no path aliases and uses `nodenext` resolution.
