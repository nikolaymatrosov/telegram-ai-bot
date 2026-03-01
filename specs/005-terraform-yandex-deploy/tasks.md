---

description: "Task list for 005-terraform-yandex-deploy"
---

# Tasks: Terraform Yandex Cloud Deployment

**Input**: Design documents from `/specs/005-terraform-yandex-deploy/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: This feature is pure Terraform HCL (Infrastructure-as-Code). There is no application business logic to unit-test. Validation is done via `terraform validate` + `terraform plan` (static analysis) and a post-deploy smoke test (send a Telegram message). Test tasks are included where meaningful.

**Organization**: Tasks grouped by user story to enable independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1–US4)

## Path Conventions

All new files live in `tf/` at the repository root.

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create the `tf/` directory scaffold and prevent accidental secret commits from the first commit.

- [ ] T001 Create `tf/` directory at repository root
- [ ] T002 [P] Create `tf/.gitignore` excluding `*.zip`, `.tfvars`, `terraform.tfstate`, `terraform.tfstate.backup`, `.terraform/`, `staging/`
- [ ] T003 [P] Create `tf/.tfvars.example` with placeholder values for `cloud_id`, `folder_id`, `zone` (commented default), `bot_token`, `openai_api_key`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Terraform configuration that ALL user stories depend on — provider setup, input variables, and the shared function archive. Must be complete before any `yandex_function` resource can be defined.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Create `tf/terraform.tf` with required providers (`yandex >= 0.130`, `archive >= 2.0`, `null >= 3.2`, `random >= 3.5`, `dirhash` from `Think-iT-Labs/dirhash`), `required_version = ">= 1.0"`, `backend "local"` with `path = "terraform.tfstate"`, and `provider "yandex"` block using `var.cloud_id`, `var.folder_id`, `var.zone`
- [ ] T005 [P] Create `tf/variables.tf` declaring `cloud_id` (string), `folder_id` (string), `zone` (string, default `"ru-central1-a"`), `bot_token` (string, sensitive), `openai_api_key` (string, sensitive)
- [ ] T006 Create `tf/ydb.tf` with `yandex_ydb_database_serverless.bot_db` (name `"telegram-ai-bot-db"`, location_id `"ru-central1"`, storage_size_limit 5, sleep_after 5)
- [ ] T007 Add `random_password.webhook_secret` resource to `tf/main.tf` (length 32, special false) — must exist before the webhook function environment can reference it
- [ ] T008 Add `data "dirhash_sha256" "src"` to `tf/main.tf` pointing at `../src` (using the `Think-iT-Labs/dirhash` provider declared in `terraform.tf`). Add `null_resource.build_app` to `tf/main.tf` with triggers on `data.dirhash_sha256.src.checksum` (covers all of `src/`), `filesha256("../package.json")`, and `filesha256("../tsconfig.json")`; local-exec runs `npm ci && npm run build`, then assembles `tf/staging/` with compiled JS + `node_modules/` + `package.json`
- [ ] T009 Add `data "archive_file" "function_zip"` to `tf/main.tf` sourcing `./staging`, outputting `./function.zip`, excluding `*.ts` and `tsconfig.json`; set `depends_on = [null_resource.build_app]`
- [ ] T010 Run `terraform init` and `terraform validate` from `tf/` to confirm provider downloads and HCL syntax is valid (requires a local `.tfvars` with real or placeholder values)

**Checkpoint**: `terraform validate` passes. Foundation is ready — all function/IAM resources can now be authored.

---

## Phase 3: User Story 1 — Provision Cloud Infrastructure from Scratch (Priority: P1) 🎯 MVP

**Goal**: A single `terraform apply` provisions the YDB database, deploys both Cloud Functions with correct IAM, and prints the webhook URL.

**Independent Test**: `terraform apply` completes without errors; `terraform output webhook_function_url` returns a valid URL; `terraform plan` after that reports zero changes (idempotency).

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create `tf/iam.tf` with `yandex_iam_service_account.webhook_sa` (name `"telegram-bot-webhook-sa"`) and `yandex_iam_service_account.migrate_sa` (name `"telegram-bot-migrate-sa"`)
- [ ] T012 [US1] Add `yandex_resourcemanager_folder_iam_member.webhook_roles` to `tf/iam.tf` using `for_each` over `["ydb.viewer", "functions.functionInvoker"]`, member = webhook_sa, `sleep_after = 5`
- [ ] T013 [US1] Add `yandex_resourcemanager_folder_iam_member.migrate_roles` to `tf/iam.tf` using `for_each` over `["ydb.editor", "functions.functionInvoker"]`, member = migrate_sa, `sleep_after = 5`
- [ ] T014 [US1] Add `yandex_function.webhook` to `tf/main.tf`: runtime `nodejs22`, entrypoint `handler.handler`, memory 256, timeout `"60"`, service_account_id = webhook_sa.id, environment vars `BOT_TOKEN`, `OPENAI_API_KEY`, `YDB_ENDPOINT` (from ydb resource output), `YDB_DATABASE` (from ydb resource output), `WEBHOOK_SECRET` (from random_password), content from function_zip; depends_on webhook_roles
- [ ] T015 [US1] Add `yandex_function.migrate` to `tf/main.tf`: runtime `nodejs22`, entrypoint `migrate.handler`, memory 256, timeout `"120"`, service_account_id = migrate_sa.id, environment vars `YDB_ENDPOINT` and `YDB_DATABASE` only, same content zip; depends_on migrate_roles
- [ ] T016 [US1] Add `yandex_function_iam_binding.webhook_public` to `tf/main.tf`: role `functions.functionInvoker`, members `["system:allUsers"]` on webhook function
- [ ] T017 [US1] Create `tf/outputs.tf` with `webhook_function_id`, `webhook_function_url` (`https://functions.yandexcloud.net/${yandex_function.webhook.id}`), `migrate_function_id`, `ydb_database_id`, `ydb_endpoint`, `ydb_database_path`, `webhook_secret` (sensitive = true), `set_webhook_command` (sensitive = true, a heredoc with the `npx tsx` webhook registration command pre-filled)
- [ ] T018 [US1] Run `terraform plan` from `tf/` and verify the plan shows the expected resource set: 1 YDB database, 2 service accounts, 4 IAM member bindings, 1 IAM binding, 1 random password, 2 functions, 2 null_resources, 1 archive data source

**Checkpoint**: `terraform plan` shows the correct resource graph. User Story 1 infrastructure is fully specified.

---

## Phase 4: User Story 2 — Build and Package TypeScript Code (Priority: P1)

**Goal**: The `null_resource.build_app` correctly compiles TypeScript and assembles a deployable ZIP containing `handler.js`, `migrate.js`, production `node_modules/`, and `package.json` at the ZIP root.

**Independent Test**: After `terraform apply`, inspect `tf/staging/` — it contains compiled `.js` files, `node_modules/`, and `package.json`. Changing a source file and re-applying triggers a rebuild and updates `user_hash` on both functions.

**Note**: The core build resources (`null_resource.build_app`, `data.archive_file.function_zip`) were created in Phase 2 (T008, T009). This phase validates and refines them.

### Implementation for User Story 2

- [ ] T019 [US2] Verify the `null_resource.build_app` local-exec command in `tf/main.tf` correctly assembles `tf/staging/` — the working directory for the local-exec must be set to the `tf/` directory path (use `working_dir = path.module`) and the build command must correctly reference `..` to reach the project root
- [ ] T020 [US2] Confirm that `data "dirhash_sha256" "src"` in `tf/main.tf` covers the entire `../src` directory — all source files including `config/index.ts`, `webhook/adapter.ts`, and `infrastructure/ydb/driver.ts` are implicitly included; no per-file trigger additions are needed
- [ ] T021 [US2] Add `staging/` cleanup step to the build local-exec in `tf/main.tf` so a fresh staging directory is always assembled (prevent stale files from previous builds)
- [ ] T022 [US2] Manually run the build command from the `tf/` directory, inspect `tf/staging/` to confirm `handler.js`, `migrate.js`, and `node_modules/` are all present at the root level, and verify `tf/function.zip` is created

**Checkpoint**: `tf/function.zip` is successfully produced and contains the correct structure. Re-applying after a source change updates the function.

---

## Phase 5: User Story 3 — Configure Bot via Variables (Priority: P2)

**Goal**: All sensitive configuration is passed through `.tfvars` variables, marked `sensitive = true`, never hard-coded. `WEBHOOK_SECRET` is auto-generated. `.tfvars` is git-ignored.

**Independent Test**: `git status` shows `.tfvars` is not tracked. `terraform plan` output does not reveal sensitive variable values. Deployed function environment contains the correct values (visible in YCF console as set but not shown in plan output).

### Implementation for User Story 3

- [ ] T023 [P] [US3] Verify `tf/variables.tf` marks `bot_token` and `openai_api_key` as `sensitive = true` — if not already done in T005, update the variable blocks now
- [ ] T024 [P] [US3] Verify `tf/.gitignore` covers all sensitive and build artifacts: `.tfvars`, `terraform.tfstate`, `terraform.tfstate.backup`, `.terraform/`, `*.zip`, `staging/` — update if any are missing from T002
- [ ] T025 [US3] Add `description` fields to all variable declarations in `tf/variables.tf` so `.tfvars.example` comments are self-documenting
- [ ] T026 [US3] Confirm `tf/.tfvars.example` documents all five variables (`cloud_id`, `folder_id`, `zone`, `bot_token`, `openai_api_key`) with descriptive placeholder values and an inline comment explaining where to obtain each value

**Checkpoint**: A developer can follow `.tfvars.example` alone to configure the deployment without consulting any external documentation.

---

## Phase 6: User Story 4 — Destroy Infrastructure Cleanly (Priority: P3)

**Goal**: `terraform destroy` removes all provisioned resources without orphaning anything.

**Independent Test**: After `terraform destroy`, `terraform state list` returns empty. No resources visible in the Yandex Cloud console for the folder.

### Implementation for User Story 4

- [ ] T027 [US4] Review all resource definitions in `tf/iam.tf`, `tf/ydb.tf`, and `tf/main.tf` to confirm no `lifecycle { prevent_destroy = true }` blocks exist that would block `terraform destroy`
- [ ] T028 [US4] Add `terraform_data` or note in `tf/main.tf` that `null_resource.run_migrations` is a provisioner-only resource (no cloud state) and will not block destroy
- [ ] T029 [US4] Confirm `yandex_function_iam_binding.webhook_public` is in `tf/main.tf` with explicit `depends_on` so Terraform can correctly order IAM binding removal before function deletion on destroy

**Checkpoint**: Destroy ordering is correct. No resources require manual cleanup.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, quickstart accuracy, and ensuring the full deployment works end-to-end.

- [ ] T030 [P] Run `terraform fmt -recursive tf/` to normalize HCL formatting across all files
- [ ] T031 [P] Run `terraform validate` from `tf/` to confirm no HCL errors in the final state
- [ ] T032 Update `quickstart.md` in `specs/005-terraform-yandex-deploy/` if any step in the actual deployment differs from what was written during planning
- [ ] T033 Perform a full end-to-end `terraform apply` against a real Yandex Cloud folder, send `/start` to the bot via Telegram, and confirm a response is received
- [ ] T034 Run `terraform plan` a second time immediately after the successful apply and confirm zero changes (idempotency validation per SC-002)
- [ ] T035 Run `terraform destroy` to clean up the test deployment and confirm all resources are removed (SC-004 validation)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 Phase (Phase 3)**: Depends on Phase 2 — core function + IAM resources
- **US2 Phase (Phase 4)**: Depends on Phase 2 — build validation (most resources already in Phase 2)
- **US3 Phase (Phase 5)**: Depends on Phase 2 — variable and secrets hygiene
- **US4 Phase (Phase 6)**: Depends on Phase 3 — destroy requires functions to exist first
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only; no dependency on US2, US3, US4
- **US2 (P1)**: Depends on Foundational only; refines work done in T008/T009
- **US3 (P2)**: Depends on Foundational only; can run in parallel with US1/US2
- **US4 (P3)**: Depends on US1 (functions must exist to validate destroy ordering)

### Within Each Phase

- IAM service accounts (T011) before IAM role bindings (T012, T013)
- IAM role bindings before function resources (T014, T015)
- Both functions before the IAM public binding (T016)
- All resources before outputs (T017)

### Parallel Opportunities

- T002 + T003 (Phase 1): Different files, fully parallel
- T005 + T006 (Phase 2): Different files, parallel after T004
- T011 (Phase 3): Service accounts are independent of each other
- T012 + T013 (Phase 3): Parallel after T011 (different for_each resources, different files)
- T014 + T015 (Phase 3): Parallel after T012/T013 respectively
- T023 + T024 (Phase 5): Different files, fully parallel
- T030 + T031 (Phase 7): Can run in parallel

---

## Parallel Example: Phase 3 (US1)

```text
# Step 1: Create service accounts in parallel
Task T011a: yandex_iam_service_account.webhook_sa in tf/iam.tf
Task T011b: yandex_iam_service_account.migrate_sa in tf/iam.tf

# Step 2: Assign IAM roles in parallel (after T011)
Task T012: webhook_roles for_each binding in tf/iam.tf
Task T013: migrate_roles for_each binding in tf/iam.tf

# Step 3: Deploy functions in parallel (after respective role binding)
Task T014: yandex_function.webhook in tf/main.tf
Task T015: yandex_function.migrate in tf/main.tf
```

---

## Implementation Strategy

### MVP First (US1 + US2 — Core Deployment)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T010)
3. Complete Phase 3: US1 — Provision infrastructure (T011–T018)
4. Complete Phase 4: US2 — Validate build packaging (T019–T022)
5. **STOP and VALIDATE**: Run `terraform apply`, check `terraform output webhook_function_url`, send a Telegram message

### Incremental Delivery

1. Setup + Foundational → HCL skeleton ready, `terraform validate` passes
2. US1 complete → Full infrastructure deployed, bot accessible via URL
3. US2 validated → Build pipeline confirmed, re-deploy works on code changes
4. US3 complete → Secret hygiene confirmed, `.tfvars.example` documented
5. US4 + Polish → Clean teardown verified, formatting normalized

### Single-Developer Sequence

```text
T001 → T002 + T003 (parallel) →
T004 → T005 + T006 (parallel) → T007 → T008 → T009 → T010 →
T011 → T012 + T013 (parallel) → T014 + T015 (parallel) → T016 → T017 → T018 →
T019 → T020 → T021 → T022 →
T023 + T024 (parallel) → T025 → T026 →
T027 → T028 → T029 →
T030 + T031 (parallel) → T032 → T033 → T034 → T035
```

---

## Notes

- **No unit tests** for Terraform HCL — correctness is validated by `terraform validate`, `terraform plan`, and live `terraform apply`
- **`[P]` tasks** touch different files or have no shared state — safe to implement simultaneously
- **`staging/`** is a build artifact directory — always gitignored, always regenerated on apply
- **Idempotency** is a hard requirement (SC-002): every task must be authored such that re-applying the same configuration produces zero drift
- Commit after each phase checkpoint to maintain a clean git history
- Do NOT run `terraform apply` against production until US3 (secrets hygiene) is verified
