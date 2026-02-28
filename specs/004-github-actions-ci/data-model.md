# Data Model: Automated Test Execution on Code Changes

**Feature**: 004-github-actions-ci
**Date**: 2026-02-28

## Entities

This feature introduces no new data entities. It is a CI/CD configuration feature that operates entirely through GitHub Actions workflow files and ESLint configuration.

## Configuration Artifacts

### Workflow Definition (`.github/workflows/ci.yml`)

- **Triggers**: push to `main`, pull requests to any branch
- **Matrix**: Node.js versions `[20, 22]`
- **Steps**: checkout, setup-node (with npm cache), install (`npm ci`), build (`tsc`), lint (`eslint`), test (`jest`)
- **Timeout**: 15 minutes per job
- **Environment**: Ubuntu latest runners

### ESLint Configuration (`eslint.config.js`)

- **Presets**: `@eslint/js` recommended + `typescript-eslint` recommendedTypeChecked + `eslint-plugin-jest` for test files
- **Parser**: TypeScript parser via `typescript-eslint` with project service
- **Ignores**: `dist/**`
- **Scope**: `.ts` files for type-checked rules, `.js` files get type-checked rules disabled

### Package Manifest Updates (`package.json`)

- **New script**: `"lint": "eslint ."`
- **New devDependencies**: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-jest`
