# Feature Specification: Terraform Yandex Cloud Deployment

**Feature Branch**: `005-terraform-yandex-deploy`
**Created**: 2026-03-01
**Status**: Draft
**Input**: User description: "Take a look at examples/tf and add terraform files to the project to deploy it to Yandex Cloud"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provision Cloud Infrastructure from Scratch (Priority: P1)

A developer who has never deployed this bot wants to set up the full infrastructure on Yandex Cloud from a single directory. They run `terraform init && terraform apply` with a `.tfvars` file and end up with a fully operational YCF (Yandex Cloud Functions) serverless function, a YDB serverless database with all required tables, a service account with the correct IAM roles, and the function URL printed as output ready for webhook registration.

**Why this priority**: The core value of this feature — a reproducible, one-command infrastructure setup. Without this, all other stories are moot.

**Independent Test**: A fresh Yandex Cloud folder with credentials and a valid `.tfvars` file should result in a working deployed function after `terraform apply`, with the invocation URL visible in outputs.

**Acceptance Scenarios**:

1. **Given** an empty Yandex Cloud folder and valid `cloud_id`/`folder_id` in `.tfvars`, **When** the developer runs `terraform init && terraform apply`, **Then** a YCF function is created, a YDB serverless database is provisioned, and the function URL is printed as a Terraform output.
2. **Given** an already-applied Terraform state with no source changes, **When** the developer re-runs `terraform apply`, **Then** Terraform reports no changes (idempotent).
3. **Given** missing required variables, **When** the developer runs `terraform plan`, **Then** Terraform fails with a clear error identifying the missing inputs.

---

### User Story 2 - Build and Package TypeScript Code for Deployment (Priority: P1)

Before the function can be deployed, the TypeScript source must be compiled and zipped. A build step compiles the project and creates a ZIP archive that Terraform uploads to YCF. When source files change, a re-apply rebuilds and re-deploys the function automatically.

**Why this priority**: Without the build step, the function content cannot be deployed — it is a prerequisite to Story 1.

**Independent Test**: Can be tested by verifying that `terraform apply` produces a `function.zip` artifact and that the YCF function reflects the correct content hash.

**Acceptance Scenarios**:

1. **Given** TypeScript sources in `src/`, **When** `terraform apply` is run, **Then** `npm install && npm run build` executes and a `function.zip` is created containing compiled JS files (no `.ts` source files, no `node_modules`).
2. **Given** a source file has changed since last apply, **When** `terraform apply` is run again, **Then** the build step re-runs and the function is updated with a new content hash.
3. **Given** a build failure (e.g., TypeScript errors), **When** `terraform apply` runs, **Then** Terraform halts with an error and does not deploy broken code.

---

### User Story 3 - Configure Bot via Variables (Priority: P2)

A developer configures all environment-specific settings (Telegram bot token, OpenAI API key, cloud IDs) through a `.tfvars` file without touching any Terraform source files. Sensitive values are never hard-coded in committed files.

**Why this priority**: Enables safe configuration management and reuse across different deployments.

**Independent Test**: Creating a `.tfvars` file with different values deploys an independent bot instance with the correct environment variables injected into the function.

**Acceptance Scenarios**:

1. **Given** a `.tfvars` file with `telegram_token` and `openai_api_key`, **When** `terraform apply` runs, **Then** the deployed YCF function's environment contains those values.
2. **Given** `.tfvars` is listed in `.gitignore`, **When** the repository is pushed, **Then** the file does not appear in any commit.
3. **Given** no `telegram_token` variable provided, **When** `terraform plan` runs, **Then** Terraform prompts for the value or fails with a clear validation error.

---

### User Story 4 - Destroy Infrastructure Cleanly (Priority: P3)

A developer can tear down all provisioned resources with `terraform destroy`, leaving no orphaned resources in the Yandex Cloud folder.

**Why this priority**: Clean teardown prevents unexpected costs and is important for developer iteration cycles.

**Independent Test**: After `terraform destroy`, the Yandex Cloud console shows no resources from this deployment remaining in the folder.

**Acceptance Scenarios**:

1. **Given** a fully deployed environment, **When** the developer runs `terraform destroy`, **Then** all YCF functions, YDB databases, service accounts, and IAM bindings are deleted.
2. **Given** a resource was manually deleted before destroy, **When** `terraform destroy` runs, **Then** it completes without fatal errors.

---

### Edge Cases

- What happens when the Yandex Cloud API rate limit is hit during `terraform apply`? (IAM role assignments should use `sleep_after` to avoid race conditions, as seen in the example.)
- How does the system handle a partially failed apply (e.g., YDB created but function deploy failed)? Subsequent apply should converge to the desired state.
- What if the bot token or OpenAI key is rotated — can the function environment variables be updated without recreating the database or function resource?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Terraform configuration MUST provision a Yandex Cloud Functions serverless function as the Telegram webhook handler, using the `nodejs22` runtime with configurable memory and execution timeout.
- **FR-002**: Terraform configuration MUST provision a YDB serverless database in `ru-central1` to serve as the bot's persistent storage.
- **FR-003**: Terraform configuration MUST create a dedicated service account with the minimum IAM roles required by the function (YDB access and function invocation).
- **FR-004**: Terraform configuration MUST expose the function invocation URL as a Terraform output so it can be used to configure the Telegram webhook.
- **FR-005**: Terraform configuration MUST accept `cloud_id`, `folder_id`, `telegram_token`, and `openai_api_key` as input variables; `telegram_token` and `openai_api_key` MUST be marked `sensitive = true`.
- **FR-006**: A build step MUST compile the TypeScript project and package the output into a ZIP archive prior to function deployment; source file hashes MUST be used as change detection triggers.
- **FR-007**: The ZIP archive, `.tfvars`, and `terraform.tfstate` files MUST be listed in `.gitignore` to prevent accidental commits of secrets or build artifacts.
- **FR-008**: All Terraform files MUST reside in a `tf/` directory at the project root.
- **FR-009**: The function MUST receive `TELEGRAM_TOKEN`, `OPENAI_API_KEY`, `YDB_ENDPOINT`, and `YDB_DATABASE` as environment variables so it can connect to all external services.
- **FR-010**: The function MUST be made publicly accessible (invocable without authentication) so Telegram can deliver webhook updates.
- **FR-011**: A `.tfvars.example` file MUST be committed to the repository showing all required variable keys with placeholder values, serving as documentation for new developers.
- **FR-012**: IAM role assignments MUST use a post-assignment delay to avoid race conditions with the Yandex Cloud IAM propagation, consistent with the pattern in the example.

### Key Entities

- **YCF Function**: The serverless function running the bot webhook handler; configured with runtime, entry point, memory, timeout, environment variables, and a service account.
- **YDB Serverless Database**: Persistent storage for bot data; provisioned once and shared across all function invocations.
- **Service Account**: Yandex Cloud identity used by the function at runtime; granted only the roles it needs.
- **IAM Binding**: Grants a role to the service account on the folder; follows the least-privilege principle.
- **Terraform State**: Tracks all managed resources; stored locally and excluded from version control.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with valid Yandex Cloud credentials and a populated `.tfvars` file can complete a full deployment in a single `terraform apply` run without any manual cloud console steps.
- **SC-002**: Re-running `terraform apply` on an unchanged codebase and configuration reports zero planned resource changes (fully idempotent).
- **SC-003**: After deployment, sending a message to the bot via Telegram receives a bot response, confirming the function is reachable and correctly configured.
- **SC-004**: `terraform destroy` removes all resources created by `terraform apply` with no orphaned resources visible in the Yandex Cloud console.
- **SC-005**: No secrets (bot token, API key, cloud IDs) appear in any committed file; all sensitive files are covered by `.gitignore`.
- **SC-006**: A new developer can determine all required configuration values by reading `.tfvars.example` alone, without consulting external documentation.

## Assumptions

- The project is already structured as a YCF serverless webhook function (implemented in feature 003); this feature adds only the Infrastructure-as-Code layer.
- The existing `npm run build` script produces compiled output in `dist/` suitable for direct packaging.
- Terraform state is stored locally (`backend "local"`), consistent with the example. Remote state backends are out of scope.
- A single deployment environment (one folder, one function) is in scope; multi-environment workspace management is out of scope.
- Registering the Telegram webhook (calling the Bot API with the function URL) is a manual step performed after `terraform apply` using the outputted URL. Automating it via Terraform is out of scope.
- The `zone` variable defaults to `ru-central1-a`.
