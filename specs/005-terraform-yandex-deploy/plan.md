# Implementation Plan: Terraform Yandex Cloud Deployment

**Branch**: `005-terraform-yandex-deploy` | **Date**: 2026-03-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/005-terraform-yandex-deploy/spec.md`

## Summary

Add a `tf/` directory containing Terraform configuration to provision and deploy the Telegram AI Bot on Yandex Cloud. The deployment provisions a YDB Serverless database, deploys two Yandex Cloud Functions (webhook handler + migration runner) with dedicated service accounts and IAM roles, auto-generates a webhook secret, and runs DB migrations automatically via a post-apply provisioner. The TypeScript project is compiled locally and packaged with `node_modules` into a single ZIP archive used by both functions.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode) on Node.js 20 LTS — existing codebase; Terraform >= 1.0 — new IaC tooling
**Primary Dependencies**: Yandex Terraform provider `>= 0.120`, `hashicorp/archive >= 2.4`, `hashicorp/null >= 3.2`, `hashicorp/random >= 3.5`
**Storage**: YDB Serverless (existing schema: 6 tables defined in `src/infrastructure/ydb/migrations.ts`)
**Testing**: No Terraform unit tests; validation via `terraform plan` output and post-deploy smoke test (send Telegram message)
**Target Platform**: Yandex Cloud Functions `nodejs22` runtime + YDB Serverless
**Project Type**: Infrastructure-as-Code configuration added to an existing Node.js serverless application
**Performance Goals**: Cold-start < 2 s; function execution timeout 60 s for webhook, 120 s for migration
**Constraints**: ZIP must include `node_modules/` + compiled JS + `package.json`; `package.json` required for `"type": "module"` ESM resolution; Terraform state stored locally (gitignored)
**Scale/Scope**: Single deployment environment; single Yandex Cloud folder

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. TypeScript Strict Mode | ✅ PASS | Terraform is HCL, not TypeScript. The existing TS code is unchanged and already strict. |
| II. Modular Separation of Concerns | ✅ PASS | Feature adds only `tf/` directory. No changes to `src/` layer structure. |
| III. Secrets via Environment Only | ✅ PASS | `bot_token` and `openai_api_key` are `sensitive = true` Terraform variables. `WEBHOOK_SECRET` is auto-generated. `.tfvars` + `.tfstate` are in `.gitignore`. |
| IV. Graceful Error Handling | ✅ PASS | No changes to application code. Migration function is already idempotent. |
| V. Simplicity & YAGNI | ✅ PASS | Minimal resource set: 2 functions, 1 DB, 2 SAs, 1 random secret, 2 null_resources. Lockbox deferred (not needed for local state). `BOT_INFO` excluded (not needed). |
| VI. Meaningful Test Coverage | ✅ PASS | No business logic in Terraform HCL. Validation is `terraform plan`; correctness verified by post-deploy smoke test. No tests to write for IaC configuration. |

**Post-design re-check**: All principles continue to pass. The design introduces no new TypeScript code, no new application layers, and no additional dependencies in `package.json`.

## Project Structure

### Documentation (this feature)

```text
specs/005-terraform-yandex-deploy/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
tf/
├── terraform.tf         # Provider versions + local backend + provider config
├── variables.tf         # cloud_id, folder_id, zone, bot_token, openai_api_key
├── main.tf              # Build null_resource, archive_file, yandex_function × 2,
│                        #   function_iam_binding (public), run_migrations null_resource
├── iam.tf               # Service accounts × 2, folder IAM member bindings × 2
├── ydb.tf               # yandex_ydb_database_serverless
├── outputs.tf           # function URLs, DB endpoint, webhook_secret (sensitive),
│                        #   set_webhook_command (sensitive)
├── .gitignore           # *.zip, .tfvars, terraform.tfstate*, .terraform/, staging/
└── .tfvars.example      # Documented placeholder values for all required variables

(no changes to src/, tests/, or any existing files)
```

**Structure Decision**: Single `tf/` directory at repository root. Follows the `examples/tf/` layout already established in the project. All Terraform files are HCL-only; no new TypeScript files are created.

## Complexity Tracking

No constitution violations. No complexity justification required.

---

## Phase 0: Research

**Status**: Complete — see [research.md](research.md)

### Key Findings

1. **ZIP packaging**: Must include `node_modules/` + compiled JS + `package.json` at ZIP root. Build via `npm ci && npm run build`, then assemble a staging directory, then archive it.
2. **Entrypoints**: `handler.handler` (webhook) and `migrate.handler` (migrations) — both at ZIP root.
3. **ESM**: `nodejs22` fully supports ESM; no changes to `tsconfig.json` or `package.json` needed.
4. **Migration strategy**: `null_resource` provisioner invoking `yc serverless function invoke` on the dedicated `migrate.handler` function. Idempotent.
5. **WEBHOOK_SECRET**: `random_password` resource. Exposed as sensitive output.
6. **BOT_INFO**: Excluded from Terraform; fetched at runtime on cold start.
7. **IAM roles**: Webhook SA → `ydb.viewer` + `functions.functionInvoker`; Migrate SA → `ydb.editor` + `functions.functionInvoker`. Public binding → `system:allUsers`.
8. **Shared archive**: Both functions reference the same `data.archive_file.function_zip`.

---

## Phase 1: Design

### Artifacts

- [research.md](research.md) — All unknowns resolved
- [data-model.md](data-model.md) — Terraform resource graph, inputs, outputs, file layout
- [quickstart.md](quickstart.md) — Developer deployment guide

### File-by-File Design

#### `tf/terraform.tf`

- `terraform.required_providers`: yandex `>= 0.120`, archive `>= 2.4`, null `>= 3.2`, random `>= 3.5`
- `terraform.required_version`: `>= 1.0`
- `backend "local"`: path `"terraform.tfstate"` (relative to `tf/`)
- `provider "yandex"`: `cloud_id = var.cloud_id`, `folder_id = var.folder_id`, `zone = var.zone`

#### `tf/variables.tf`

- `cloud_id` (string, required)
- `folder_id` (string, required)
- `zone` (string, default `"ru-central1-a"`)
- `bot_token` (string, sensitive, required)
- `openai_api_key` (string, sensitive, required)

#### `tf/ydb.tf`

- `yandex_ydb_database_serverless.bot_db`
  - name: `"telegram-ai-bot-db"`, location_id: `"ru-central1"`, storage 5 GB
  - `sleep_after = 5`

#### `tf/iam.tf`

- `yandex_iam_service_account.webhook_sa` — name `"telegram-bot-webhook-sa"`
- `yandex_iam_service_account.migrate_sa` — name `"telegram-bot-migrate-sa"`
- `yandex_resourcemanager_folder_iam_member.webhook_roles` (for_each: `["ydb.viewer", "functions.functionInvoker"]`)
  - `sleep_after = 5`
- `yandex_resourcemanager_folder_iam_member.migrate_roles` (for_each: `["ydb.editor", "functions.functionInvoker"]`)
  - `sleep_after = 5`

#### `tf/main.tf`

- `random_password.webhook_secret` — length 32, special false
- `null_resource.build_app`
  - triggers: hashes of `../src/handler.ts`, `../src/migrate.ts`, `../src/infrastructure/ydb/migrations.ts`, `../package.json`, `../tsconfig.json`
  - local-exec: `cd .. && npm ci && npm run build && rm -rf tf/staging && mkdir -p tf/staging && cp -r dist/. tf/staging/ && cp -r node_modules tf/staging/node_modules && cp package.json tf/staging/`
- `data.archive_file.function_zip`
  - type: `"zip"`, source_dir: `"./staging"`, output_path: `"./function.zip"`
  - excludes: `["*.ts", "tsconfig.json"]`
  - depends_on: `[null_resource.build_app]`
- `yandex_function.webhook`
  - runtime: `"nodejs22"`, entrypoint: `"handler.handler"`, memory: 256, timeout: `"60"`
  - service_account_id: `webhook_sa.id`
  - environment: BOT_TOKEN, OPENAI_API_KEY, YDB_ENDPOINT, YDB_DATABASE, WEBHOOK_SECRET
  - content.zip_filename: `data.archive_file.function_zip.output_path`
  - user_hash: `data.archive_file.function_zip.output_sha256`
  - depends_on: `[webhook_roles, function_zip]`
- `yandex_function.migrate`
  - runtime: `"nodejs22"`, entrypoint: `"migrate.handler"`, memory: 256, timeout: `"120"`
  - service_account_id: `migrate_sa.id`
  - environment: YDB_ENDPOINT, YDB_DATABASE
  - content.zip_filename: same as webhook
  - depends_on: `[migrate_roles, function_zip]`
- `yandex_function_iam_binding.webhook_public`
  - function_id: `webhook.id`, role: `"functions.functionInvoker"`, members: `["system:allUsers"]`
- `null_resource.run_migrations`
  - triggers: `{ migrate_version = yandex_function.migrate.version }`
  - local-exec: `yc serverless function invoke --id ${yandex_function.migrate.id} --data '{}' --format json`
  - depends_on: `[yandex_function.migrate, yandex_ydb_database_serverless.bot_db, migrate_roles]`

#### `tf/outputs.tf`

- `webhook_function_id`, `webhook_function_url` (`https://functions.yandexcloud.net/<function-id>`)
- `migrate_function_id`
- `ydb_database_id`, `ydb_endpoint`, `ydb_database_path`
- `webhook_secret` (sensitive = true)
- `set_webhook_command` (sensitive = true — contains webhook secret inline)

#### `tf/.gitignore`

```gitignore
*.zip
.tfvars
terraform.tfstate
terraform.tfstate.backup
.terraform/
staging/
```

#### `tf/.tfvars.example`

```hcl
cloud_id       = "your-cloud-id"
folder_id      = "your-folder-id"
# zone         = "ru-central1-a"  # optional, this is the default
bot_token      = "your-telegram-bot-token"
openai_api_key = "your-openai-api-key"
```

---

## Implementation Order

Tasks are ordered for minimal rework:

1. `tf/.gitignore` — prevent accidental commits from the start
2. `tf/.tfvars.example` — documentation first
3. `tf/terraform.tf` — provider + backend skeleton
4. `tf/variables.tf` — inputs
5. `tf/ydb.tf` — database (no dependencies)
6. `tf/iam.tf` — service accounts + IAM bindings
7. `tf/main.tf` — build step + functions + public binding + migration provisioner
8. `tf/outputs.tf` — outputs
9. Manual validation: `terraform init && terraform validate && terraform plan`

---

## Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| `yc` CLI not installed when `terraform apply` runs | Document in quickstart.md; `null_resource.run_migrations` will fail fast with clear error |
| IAM propagation race conditions | `sleep_after = 5` on all IAM bindings; `depends_on` in function resources |
| ZIP too large (node_modules size) | YCF limit is 256 MB unzipped; project dependencies are ~50 MB; well within limit |
| ESM import resolution failure | `package.json` at ZIP root provides `"type": "module"`; all imports use `.js` extensions |
| Stale `dist/` from previous builds | `null_resource.build_app` always runs `npm ci && npm run build` fresh; triggers on source hashes |
