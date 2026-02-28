# Quickstart: Automated Test Execution on Code Changes

**Feature**: 004-github-actions-ci
**Date**: 2026-02-28

## What This Feature Does

Adds automated test and lint execution on every pull request and push to the main branch using GitHub Actions. Also introduces ESLint configuration for code quality enforcement.

## Prerequisites

- GitHub repository with Actions enabled (already configured at `nikolaymatrosov/telegram-ai-bot`)
- Existing `package-lock.json` committed to repository (required for `npm ci`)

## Files Created/Modified

| File | Action | Purpose |
| ---- | ------ | ------- |
| `.github/workflows/ci.yml` | Created | GitHub Actions workflow definition |
| `eslint.config.js` | Created | ESLint flat config for TypeScript + Jest |
| `package.json` | Modified | Add `lint` script and ESLint devDependencies |
| `README.md` | Modified | Add CI status badge |

## How It Works

1. A contributor opens a pull request or pushes to `main`
2. GitHub Actions triggers the CI workflow automatically
3. The workflow installs dependencies, compiles TypeScript, runs ESLint, and executes Jest tests
4. Results appear as a status check on the pull request (or in the Actions tab for direct pushes)
5. The README badge reflects the current build status of the `main` branch

## Local Verification

After implementation, verify locally:

```bash
# Install new ESLint dependencies
npm install

# Run lint (new command)
npm run lint

# Run tests (existing command)
npm test

# Run both (matches CI behavior)
npm test && npm run lint
```

## CI Workflow Triggers

| Event | Trigger | Scope |
| ----- | ------- | ----- |
| Pull request opened/updated | Any target branch | Full test + lint suite |
| Push to `main` | Direct push or merge | Full test + lint suite |
