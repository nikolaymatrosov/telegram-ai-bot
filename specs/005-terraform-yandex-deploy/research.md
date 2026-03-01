# Research: Terraform Yandex Cloud Deployment

**Feature**: 005-terraform-yandex-deploy
**Date**: 2026-03-01

---

## Topic 1: ZIP Packaging for YCF Node.js Functions

### Decision
Bundle compiled JS output **and** production `node_modules` together in a single staging directory, then ZIP that directory. Include `package.json` at the ZIP root.

### Rationale
YCF's automatic dependency install (`npm ci --production`) has hard limits: 5-minute timeout, 1 GB RAM, 700 MB temp storage. A project with `grammy`, `@ydbjs/*`, `openai`, and their transitive dependencies would likely hit these limits under load. Pre-bundling is explicitly recommended by Yandex Cloud documentation when remote install is too slow or resource-constrained.

`package.json` must be present at the ZIP root because the project sets `"type": "module"` — Node.js reads this to interpret `.js` files as ESM. Without it, `export` statements in the compiled output cause a syntax error.

### Build flow
```
1. npm ci --only=production  (or use existing node_modules after npm install)
2. npm run build             (tsc → outputs to dist/)
3. Assemble staging dir:
     cp dist/*   staging/
     cp -r node_modules/ staging/node_modules/
     cp package.json staging/
4. ZIP staging/ → function.zip
```

### Alternatives considered
- **Automatic install (no node_modules in ZIP)**: Rejected — risky for large dependency trees; 5-min remote install limit.
- **Single bundler (webpack/esbuild)**: Not in project toolchain; adds complexity. YAGNI principle from constitution applies.
- **Separate `dist/` archive only**: Incorrect — Node.js cannot resolve module imports without `node_modules`.

---

## Topic 2: Function Entrypoints

### Decision
Use `entrypoint = "handler.handler"` for the webhook function and `entrypoint = "migrate.handler"` for the migration function.

### Rationale
YCF entrypoint format is `<filename_without_extension>.<exported_function_name>`, resolved relative to the ZIP root. Because the ZIP is assembled from the flattened `dist/` contents (i.e., compiled `.js` files are at the ZIP root, not in a `dist/` subdirectory), the entry point does not include a path prefix. This matches the pattern used in `examples/tf/main.tf` (`producer.handler`, `consumer.handler`).

The project exports:
- `src/handler.ts` → `dist/handler.js` → `export async function handler(...)` → entrypoint: `handler.handler`
- `src/migrate.ts` → `dist/migrate.js` → `export async function handler(...)` → entrypoint: `migrate.handler`

### Alternatives considered
- `dist/handler.handler`: Only correct if `dist/` is a subdirectory within the ZIP. Rejected for this project's packaging approach.

---

## Topic 3: ESM Support in YCF `nodejs22` Runtime

### Decision
ESM is fully supported in `nodejs22`. No changes to the TypeScript compilation target or module format are needed.

### Rationale
Node.js 22 (used by YCF `nodejs22` runtime on Ubuntu 22.04) has native ESM support since Node 12. The project's `tsconfig.json` uses `module: nodenext` + `target: ES2022`, and `package.json` sets `"type": "module"`. All import paths in source already use explicit `.js` extensions, which is required for ESM with `nodenext` resolution.

All runtime dependencies (`grammy`, `openai`, `@ydbjs/*`) ship ESM-compatible builds.

---

## Topic 4: Database Migration Strategy

### Decision
Deploy a **separate `yandex_function.migrate` resource** (entrypoint `migrate.handler`) and invoke it via a `null_resource` provisioner (`local-exec` calling `yc serverless function invoke`) after all infrastructure is ready.

### Rationale
`src/migrate.ts` already exists as a clean, dedicated YCF entry point designed for this purpose. It runs 6 idempotent `CREATE TABLE` DDL statements and returns `{ ok: true }`. Idempotency means re-running on re-deploy is safe.

The `null_resource` pattern with `local-exec` is already established in the `examples/tf/main.tf` (used for the TypeScript build step) and requires no new concepts. Setting `depends_on` to include the migration function, the YDB database, and the IAM bindings gives Terraform a deterministic ordering.

Trigger strategy: tie `null_resource.triggers` to the migration function's `version` attribute so migrations re-run after each deploy (safe due to idempotency).

Use synchronous invocation (without `--async`) so Terraform receives the exit code and fails the apply if migration fails.

### Alternatives considered
- **Rely on webhook handler's cold start**: The webhook handler's `handler.ts` does not currently call `runMigrations`. Adding it would add cold-start latency (schema migration before first Telegram update), risk concurrent calls during initialization, and mix concerns. Rejected.
- **`terraform_data` instead of `null_resource`**: Functionally identical; `terraform_data` is built into Terraform 1.4+ and does not require the `null` provider. Since `null >= 3.2` is already declared in the example `terraform.tf`, either works. Will use `null_resource` for consistency with the example pattern.
- **External database migration tool (Flyway, Liquibase)**: No such tool in the project. Constitution (Principle V: YAGNI) prohibits adding infrastructure for hypothetical needs.

---

## Topic 5: WEBHOOK_SECRET Handling

### Decision
Auto-generate `WEBHOOK_SECRET` using a `random_password` resource from the `hashicorp/random` provider. Expose the result as a sensitive Terraform output. Require the user to read it with `terraform output -raw webhook_secret` and pass it when running the `set-webhook` script.

### Rationale
If `WEBHOOK_SECRET` is an optional user-provided variable with a `null` default, operators may silently skip it, leaving the webhook endpoint accessible to anyone without authentication. Auto-generation eliminates this class of misconfiguration. The `random_password` value is stored in Terraform state (same security boundary as any sensitive variable) and committed to it on first apply — subsequent applies do not rotate it unless manually triggered.

Telegram bot API webhook secret token constraints: 1–256 characters, `[A-Za-z0-9_-]`. `random_password` with `special = false` satisfies this.

### Alternatives considered
- **User-provided variable**: Simpler but risks silently running without a secret. Rejected.
- **Yandex Lockbox**: Appropriate when state is shared across a team and stored remotely. For a single-developer local backend, the added `yandex_lockbox_secret` + IAM resources are not justified. Deferred to a future remote-state migration.

---

## Topic 6: BOT_INFO Handling

### Decision
Do **not** add `BOT_INFO` as a Terraform variable. Always let the function call `getMe()` at runtime on cold start.

### Rationale
`handler.ts` already uses a module-level `initialized` flag — `getMe()` (called by grammY on first initialization) runs at most once per container lifetime, not per invocation. The extra cold-start cost (~100–300 ms) is acceptable for a serverless bot. Maintaining a manually-populated JSON string in `.tfvars` that can go stale is a higher ongoing cost than the occasional cold-start overhead.

### Alternatives considered
- **Terraform variable with JSON string**: Requires manual `getMe()` call, JSON formatting, and `.tfvars` update whenever bot profile changes. Maintenance cost exceeds benefit.

---

## Topic 7: Sensitive Environment Variable Injection

### Decision
Inject sensitive variables (`BOT_TOKEN`, `OPENAI_API_KEY`) as inline `environment` in `yandex_function` via `sensitive = true` Terraform variables. Use `random_password` for `WEBHOOK_SECRET`. Reference YDB resource outputs directly for `YDB_ENDPOINT` and `YDB_DATABASE`.

### Rationale
Inline env var injection is the pattern established in `examples/tf/main.tf`. The project uses a local `backend "local"` with `terraform.tfstate` excluded from git (FR-007). Lockbox adds three additional resources and an extra IAM role without providing meaningful security improvement for a single-developer, local-state deployment. The constitution (Principle V: YAGNI) supports deferring this until a shared remote backend is introduced.

Marking variables `sensitive = true` ensures Terraform redacts values from plan/apply output and console display.

---

## Topic 8: IAM Role Requirements

### Decision
Create two service accounts: one for the **webhook function** and one for the **migration function**. Assign minimum required roles with `sleep_after` on each binding to handle IAM propagation delays.

### Required roles
- Webhook function SA: `ydb.viewer` (reads data) + `functions.functionInvoker` (allow invocation via trigger/Telegram)
- Migration function SA: `ydb.editor` (CREATE TABLE requires DDL write access)
- Public invocation binding on the webhook function: `functions.functionInvoker` for `system:allUsers`

### Rationale
Follows the least-privilege pattern established in `examples/tf/iam.tf`. The `sleep_after` attribute on `yandex_resourcemanager_folder_iam_member` is required to avoid race conditions where the function is invoked before IAM propagation completes.

Note: The webhook function also needs `functions.functionInvoker` for `system:allUsers` (unauthenticated Telegram POST access) — same as the producer function in the example.

---

## Topic 9: Two Build Artifacts for Two Functions

### Decision
Both the webhook function (`handler.handler`) and the migration function (`migrate.handler`) **share a single ZIP archive**. Both entry points compile to `dist/handler.js` and `dist/migrate.js`, which end up at the ZIP root.

### Rationale
`tsc` compiles the entire `src/` tree to `dist/`. Both `handler.ts` and `migrate.ts` are entry points that share common modules (`infrastructure/ydb/`, `config/`, etc.). Packaging them together into a single ZIP and pointing two separate `yandex_function` resources at different entrypoints is the simplest approach — one build step, one archive, two functions.

This mirrors the approach in `examples/tf/main.tf` where both `producer` and `consumer` functions share `data.archive_file.function_files`.

---

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|-----------|
| Must `node_modules` be in ZIP? | Yes — bundle in staging dir with compiled JS + `package.json` |
| Entrypoint format | `handler.handler` / `migrate.handler` (ZIP-root relative) |
| ESM support in nodejs22 | Fully supported; no changes needed |
| DB migration strategy | Dedicated migrate function + `null_resource` provisioner |
| WEBHOOK_SECRET | `random_password` auto-generated; output as sensitive |
| BOT_INFO | Not in Terraform; always fetch at runtime |
| Sensitive env vars | Inline `environment` with `sensitive = true` variables; Lockbox deferred |
| IAM roles | Two SAs (webhook SA: `ydb.viewer`, migrate SA: `ydb.editor`) + public invoker binding |
| Two functions, one archive | Share single ZIP; two `yandex_function` resources with different entrypoints |
