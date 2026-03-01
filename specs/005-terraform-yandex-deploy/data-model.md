# Data Model: Terraform Yandex Cloud Deployment

**Feature**: 005-terraform-yandex-deploy
**Date**: 2026-03-01

This feature is Infrastructure-as-Code only. It does not introduce new application data entities. The YDB table schema is already defined in `src/infrastructure/ydb/migrations.ts` (feature 003). This document describes the **Terraform resource model** — the infrastructure entities managed by this deployment.

---

## Terraform Resource Graph

### Input Variables

| Variable | Type | Sensitive | Default | Required | Source |
|----------|------|-----------|---------|----------|--------|
| `cloud_id` | `string` | no | — | yes | `.tfvars` |
| `folder_id` | `string` | no | — | yes | `.tfvars` |
| `zone` | `string` | no | `"ru-central1-a"` | no | `.tfvars` / default |
| `bot_token` | `string` | yes | — | yes | `.tfvars` |
| `openai_api_key` | `string` | yes | — | yes | `.tfvars` |

### Managed Resources

#### `yandex_ydb_database_serverless.bot_db`
- **Name**: `telegram-ai-bot-db`
- **Location**: `ru-central1`
- **Storage limit**: 5 GB (serverless default)
- **Outputs used by**: both function resources' environment variables
- **Dependencies**: none (created first)
- **Sleep after**: 5 s (IAM propagation guard)

#### `yandex_iam_service_account.webhook_sa`
- **Name**: `telegram-bot-webhook-sa`
- **Purpose**: Runtime identity for the webhook handler function
- **Dependencies**: none

#### `yandex_iam_service_account.migrate_sa`
- **Name**: `telegram-bot-migrate-sa`
- **Purpose**: Runtime identity for the migration function
- **Dependencies**: none

#### `yandex_resourcemanager_folder_iam_member.webhook_roles` (for_each)
- **Roles**: `ydb.viewer`, `functions.functionInvoker`
- **Principal**: `webhook_sa`
- **Sleep after**: 5 s per binding

#### `yandex_resourcemanager_folder_iam_member.migrate_roles` (for_each)
- **Roles**: `ydb.editor`, `functions.functionInvoker`
- **Principal**: `migrate_sa`
- **Sleep after**: 5 s per binding

#### `random_password.webhook_secret`
- **Length**: 32
- **Special chars**: false (Telegram constraint: `[A-Za-z0-9_-]` only)
- **Lifecycle**: generated once on first apply; persists in state

#### `data.dirhash_sha256.src`

- **Provider**: `Think-iT-Labs/dirhash`
- **Purpose**: Compute a single checksum for the entire `src/` directory tree
- **Directory**: `../src` (relative to `tf/`)
- **Output used by**: `null_resource.build_app` trigger (`src_hash`)

#### `null_resource.build_app`
- **Purpose**: Compile TypeScript + assemble staging directory + create `function.zip`
- **Triggers**: `data.dirhash_sha256.src.checksum` (covers all of `src/`), `filesha256("package.json")`, `filesha256("tsconfig.json")`
- **Local-exec steps**:
  1. `npm ci`
  2. `npm run build`
  3. Create staging dir with compiled JS + `node_modules/` + `package.json`
- **Output**: `function.zip` in the `tf/` directory

#### `data.archive_file.function_zip`
- **Source dir**: `../staging` (assembled by `null_resource.build_app`)
- **Output path**: `./function.zip`
- **Excludes**: `*.ts`, `tsconfig.json`, `.env*`
- **Dependencies**: `null_resource.build_app`

#### `yandex_function.webhook`
- **Name**: `telegram-bot-webhook`
- **Runtime**: `nodejs22`
- **Entrypoint**: `handler.handler`
- **Memory**: 256 MB
- **Timeout**: 60 s
- **Service account**: `webhook_sa`
- **Environment**:
  - `BOT_TOKEN` → `var.bot_token`
  - `OPENAI_API_KEY` → `var.openai_api_key`
  - `YDB_ENDPOINT` → `yandex_ydb_database_serverless.bot_db.ydb_full_endpoint`
  - `YDB_DATABASE` → `yandex_ydb_database_serverless.bot_db.database_path`
  - `WEBHOOK_SECRET` → `random_password.webhook_secret.result`
- **Content**: `data.archive_file.function_zip.output_path`
- **User hash**: `data.archive_file.function_zip.output_sha256`
- **Dependencies**: `webhook_roles`, `archive`

#### `yandex_function.migrate`
- **Name**: `telegram-bot-migrate`
- **Runtime**: `nodejs22`
- **Entrypoint**: `migrate.handler`
- **Memory**: 256 MB
- **Timeout**: 120 s
- **Service account**: `migrate_sa`
- **Environment**:
  - `YDB_ENDPOINT` → `yandex_ydb_database_serverless.bot_db.ydb_full_endpoint`
  - `YDB_DATABASE` → `yandex_ydb_database_serverless.bot_db.database_path`
- **Content**: same `data.archive_file.function_zip` as webhook function
- **Dependencies**: `migrate_roles`, `archive`

#### `yandex_function_iam_binding.webhook_public`
- **Purpose**: Allows Telegram to call the webhook function without authentication
- **Function**: `webhook`
- **Role**: `functions.functionInvoker`
- **Members**: `["system:allUsers"]`

#### `null_resource.run_migrations`
- **Purpose**: Invoke the migration function after deployment to apply DB schema
- **Triggers**: `{ version = yandex_function.migrate.version }`
- **Local-exec**: `yc serverless function invoke --id <migrate_function_id> --data '{}' --format json`
- **Dependencies**: `yandex_function.migrate`, `yandex_ydb_database_serverless.bot_db`, `migrate_roles`

---

## Resource Dependency Order

```
variables
    │
    ├──► yandex_ydb_database_serverless.bot_db
    │         │
    │         ├──► yandex_iam_service_account.webhook_sa
    │         │         └──► yandex_resourcemanager_folder_iam_member.webhook_roles
    │         │                   └──► yandex_function.webhook
    │         │                             ├──► yandex_function_iam_binding.webhook_public
    │         │                             └──► (output: function URL)
    │         │
    │         └──► yandex_iam_service_account.migrate_sa
    │                   └──► yandex_resourcemanager_folder_iam_member.migrate_roles
    │                             └──► yandex_function.migrate
    │                                       └──► null_resource.run_migrations
    │
    ├──► random_password.webhook_secret
    │         └──► (feeds into yandex_function.webhook environment)
    │
    └──► null_resource.build_app
              └──► data.archive_file.function_zip
                        ├──► yandex_function.webhook
                        └──► yandex_function.migrate
```

---

## Outputs

| Output | Value | Sensitive |
|--------|-------|-----------|
| `webhook_function_id` | `yandex_function.webhook.id` | no |
| `webhook_function_url` | `https://functions.yandexcloud.net/<webhook_id>` | no |
| `migrate_function_id` | `yandex_function.migrate.id` | no |
| `ydb_database_id` | `yandex_ydb_database_serverless.bot_db.id` | no |
| `ydb_endpoint` | `yandex_ydb_database_serverless.bot_db.ydb_full_endpoint` | no |
| `ydb_database_path` | `yandex_ydb_database_serverless.bot_db.database_path` | no |
| `webhook_secret` | `random_password.webhook_secret.result` | **yes** |
| `set_webhook_command` | Shell snippet using `webhook_function_url` and `webhook_secret` | **yes** |

---

## File Layout in Repository

```
tf/
├── terraform.tf       # provider + backend config
├── variables.tf       # all input variables
├── main.tf            # build artifact + function resources
├── iam.tf             # service accounts + IAM bindings
├── ydb.tf             # YDB serverless database
├── outputs.tf         # all output values
├── .gitignore         # *.zip, .tfvars, terraform.tfstate, terraform.tfstate.backup, .terraform/
└── .tfvars.example    # documented variable keys with placeholder values
```
