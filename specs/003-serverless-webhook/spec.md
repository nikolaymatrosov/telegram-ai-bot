# Feature Specification: Serverless Webhook Deployment

**Feature Branch**: `003-serverless-webhook`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "the bot should run in serverless env triggered by webhook mechanism"

## Clarifications

### Session 2026-02-28

- Q: How should database migrations be handled if not on every serverless invocation? → A: Dedicated migration cloud function triggered manually or by deployment hook.
- Q: What is the target serverless platform? → A: Yandex Cloud Functions.
- Q: How should the bot handle duplicate updates from Telegram? → A: Idempotent processing via `update_id` — skip already-processed updates using a lightweight check.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bot Receives and Processes Messages via Webhook (Priority: P1)

When a Telegram user sends a message or interacts with the bot (e.g., presses a menu button, issues a command), Telegram delivers the update to a webhook endpoint. The serverless function receives the request, processes the update through the bot logic, and responds — all within a single stateless invocation.

**Why this priority**: This is the core functionality — without webhook-based message processing, no other feature works. It replaces the current long-polling mechanism with an event-driven, serverless-compatible approach.

**Independent Test**: Can be fully tested by sending a Telegram update payload to the webhook endpoint and verifying the bot responds correctly (e.g., `/start` command returns a welcome message with main menu).

**Acceptance Scenarios**:

1. **Given** a configured webhook URL pointing to the serverless function, **When** a user sends `/start` to the bot, **Then** Telegram delivers the update to the webhook, the function processes it, and the user receives the welcome message with the main menu.
2. **Given** a configured webhook, **When** a user interacts with an inline menu button, **Then** the callback query is delivered via webhook and the bot handles it correctly (e.g., starting a story session).
3. **Given** a configured webhook, **When** Telegram sends an update but the function encounters an internal error, **Then** the function returns an appropriate HTTP error status, and the error is logged for observability.

---

### User Story 2 - Webhook Registration and Lifecycle Management (Priority: P2)

An operator (developer or CI/CD pipeline) can register, verify, and remove the webhook URL with Telegram so that updates are routed to the serverless function endpoint. This is a one-time setup step (or repeated after endpoint changes) rather than part of normal bot operation.

**Why this priority**: Webhook registration is the prerequisite for P1 to work, but it's a one-time operational concern rather than ongoing user-facing functionality. It must be reliable but is not exercised during normal bot usage.

**Independent Test**: Can be tested by running the webhook registration utility and then querying the Telegram Bot API to confirm the webhook is correctly configured.

**Acceptance Scenarios**:

1. **Given** a valid bot token and a publicly accessible webhook URL, **When** the operator runs the webhook registration utility, **Then** the webhook is registered with Telegram and the operator sees confirmation of successful registration.
2. **Given** a registered webhook, **When** the operator queries webhook status, **Then** they receive information about the current webhook configuration (URL, pending update count, any errors).
3. **Given** a registered webhook, **When** the operator wants to switch back to long-polling for local development, **Then** they can remove the webhook and resume using the existing polling-based entry point.

---

### User Story 3 - Serverless Entry Point Coexists with Polling Entry Point (Priority: P3)

Developers can run the bot locally using the existing long-polling mode for development and debugging, while production uses the serverless webhook entry point. Both modes share the same bot logic, handlers, and middleware — only the transport layer differs.

**Why this priority**: Developer experience matters for ongoing maintenance. Keeping both entry points avoids forcing developers to set up webhook tunnels for local development while ensuring production uses the serverless model.

**Independent Test**: Can be tested by running the bot locally with `npm run dev` (polling mode) and verifying all commands and conversations work identically to how they would through the webhook endpoint.

**Acceptance Scenarios**:

1. **Given** the codebase with both entry points, **When** a developer runs `npm run dev`, **Then** the bot starts in long-polling mode as it does today — no regressions.
2. **Given** the serverless entry point, **When** it receives a webhook update, **Then** it processes it using the same bot instance, middleware stack, and handlers as the polling entry point.
3. **Given** a new handler or command added to the bot, **When** a developer adds it to the shared bot configuration, **Then** it automatically works in both polling and webhook modes without duplication.

---

### Edge Cases

- What happens when the webhook receives a malformed or empty request body?
- How does the bot handle duplicate updates (Telegram may retry on timeout)? → Resolved: idempotent processing via `update_id`; already-processed updates are skipped.
- What happens when the serverless function exceeds its execution time limit during a long-running conversation step (e.g., waiting for AI-generated content)?
- How does the bot handle concurrent updates from the same user (e.g., rapid button presses) in a stateless environment?
- What happens if the database (YDB) is temporarily unreachable during a webhook invocation?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a serverless-compatible entry point that accepts incoming HTTP requests containing Telegram update payloads and processes them through the existing bot logic.
- **FR-002**: System MUST respond to each webhook request within the serverless platform's execution time limit, returning an appropriate HTTP status code (success or error).
- **FR-003**: System MUST provide a utility or script to register the webhook URL with the Telegram Bot API, including setting the webhook secret for request verification.
- **FR-004**: System MUST provide a utility or script to remove the webhook registration (to allow switching back to polling mode).
- **FR-005**: System MUST verify incoming webhook requests using Telegram's secret token mechanism to reject unauthorized requests.
- **FR-006**: System MUST preserve the existing long-polling entry point so developers can run the bot locally without webhook infrastructure.
- **FR-007**: System MUST share all bot configuration (handlers, middleware, conversations, menus) between polling and webhook entry points without code duplication.
- **FR-008**: System MUST initialize database connections and external service clients efficiently, reusing them across invocations where the serverless platform allows (warm starts). The webhook handler MUST NOT run database migrations during initialization.
- **FR-011**: System MUST provide a dedicated, separately invocable migration function (cloud function) that can be triggered manually or by a deployment hook to apply database schema changes independently from the webhook handler.
- **FR-009**: System MUST handle malformed or empty webhook payloads gracefully, returning an appropriate HTTP error response without crashing.
- **FR-010**: System MUST log errors and key events during webhook processing for operational observability.
- **FR-012**: System MUST process updates idempotently using Telegram's `update_id`, skipping updates that have already been processed to handle Telegram's retry behavior.

### Key Entities

- **Webhook Request**: An incoming HTTP request from Telegram containing an update payload; includes headers for secret token verification.
- **Serverless Handler**: The function entry point that receives webhook requests, initializes or reuses bot resources, and delegates processing to the shared bot logic.
- **Webhook Configuration**: The registration state between the bot and Telegram, including the endpoint URL and secret token.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Bot correctly processes all existing commands (`/start`, `/help`) and interactions (menu buttons, conversation flows, story actions) when invoked via webhook — zero functional regressions from polling mode.
- **SC-002**: Webhook endpoint responds to valid Telegram updates within 10 seconds under normal conditions (excluding AI generation time which is already externally bounded).
- **SC-003**: Unauthorized requests (missing or invalid secret token) are rejected before any bot logic executes.
- **SC-004**: Developers can run the bot locally in polling mode using existing commands (`npm run dev`) with no changes to their workflow.
- **SC-005**: Webhook registration and removal can each be completed in a single command invocation.

## Assumptions

- The target serverless platform supports Node.js 20+ runtime (consistent with the project's current Node.js requirement).
- The serverless platform provides HTTP request/response handling (the function is triggered by HTTP requests, not raw event streams).
- YDB remains accessible from the serverless environment (network connectivity and credentials are handled at the infrastructure level, outside the scope of this feature).
- The Telegram Bot API webhook secret token feature is used for request authentication (standard Telegram mechanism, no custom auth layer needed).
- OpenAI API calls made during webhook processing complete within the serverless platform's execution time limit. If they risk exceeding it, this is an operational concern to be addressed separately.
- The target serverless platform is Yandex Cloud Functions, providing native YDB connectivity and metadata-based credential management.

## Scope Boundaries

**In scope**:

- Serverless-compatible webhook handler entry point
- Webhook registration and removal utilities
- Request verification via Telegram secret tokens
- Shared bot configuration between polling and webhook modes
- Graceful error handling for webhook requests
- Dedicated migration cloud function (separate from webhook handler)

**Out of scope**:

- Infrastructure provisioning (cloud function setup, API gateway, DNS)
- CI/CD pipeline for automated deployment
- Monitoring dashboards or alerting configuration
- Performance optimization beyond basic connection reuse
- Rate limiting or DDoS protection (handled at infrastructure level)
