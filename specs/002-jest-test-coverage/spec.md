# Feature Specification: Jest Test Coverage for All Functionality

**Feature Branch**: `002-jest-test-coverage`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "I want to add test with Jest that will cover all functionality"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Tests to Verify Core Business Logic (Priority: P1)

As a developer, I want unit tests for all domain services (character, story, AI) so that I can verify core business logic works correctly and catch regressions early.

**Why this priority**: Domain services contain the critical business logic (character creation, story generation, AI interaction) that drives the entire application. Bugs here directly affect user experience.

**Independent Test**: Can be fully tested by running `npm test` and verifying all domain service tests pass. Delivers confidence that character creation, story progression, and AI integration logic are correct.

**Acceptance Scenarios**:

1. **Given** a developer runs the test suite, **When** character service tests execute, **Then** all character creation, retrieval, and archival logic is verified against expected behavior
2. **Given** a developer runs the test suite, **When** story service tests execute, **Then** session lifecycle (start, resume, complete) and scene generation logic are verified
3. **Given** a developer runs the test suite, **When** AI service tests execute, **Then** stat generation, scene generation, retry logic, and error handling are verified with mocked AI responses

---

### User Story 2 - Run Tests to Verify Data Access Layer (Priority: P2)

As a developer, I want unit tests for all repository modules so that I can verify database operations produce correct queries and handle responses properly.

**Why this priority**: Repositories are the data access boundary. Testing them ensures data is read, written, and transformed correctly, which prevents data corruption and retrieval errors.

**Independent Test**: Can be fully tested by running repository test suites with mocked database clients, verifying query construction and response handling.

**Acceptance Scenarios**:

1. **Given** a developer runs the test suite, **When** user repository tests execute, **Then** user lookup, creation, and update operations are verified
2. **Given** a developer runs the test suite, **When** character repository tests execute, **Then** character CRUD and archival operations are verified
3. **Given** a developer runs the test suite, **When** story session and turn repository tests execute, **Then** session lifecycle and turn tracking operations are verified
4. **Given** a developer runs the test suite, **When** storage adapter tests execute, **Then** session persistence (read, write, delete) for grammY conversations is verified

---

### User Story 3 - Run Tests to Verify Telegram Bot Layer (Priority: P3)

As a developer, I want unit tests for Telegram commands, handlers, menus, and middleware so that I can verify bot interactions behave correctly for end users.

**Why this priority**: The Telegram layer is the user-facing interface. Testing it ensures commands respond correctly, menus display proper options, story actions process correctly, and errors are handled gracefully.

**Independent Test**: Can be fully tested by running Telegram layer tests with mocked bot context and services, verifying command responses, menu behavior, and callback handling.

**Acceptance Scenarios**:

1. **Given** a developer runs the test suite, **When** command tests execute, **Then** `/start` (user upsert, routing) and `/help` (message content) commands are verified
2. **Given** a developer runs the test suite, **When** handler tests execute, **Then** story action callback processing, validation, and scene generation are verified
3. **Given** a developer runs the test suite, **When** middleware tests execute, **Then** error handling and session initialization are verified

---

### User Story 4 - Run Tests to Verify Configuration and Infrastructure (Priority: P4)

As a developer, I want tests for configuration loading and infrastructure setup so that I can verify the application initializes correctly under different environment conditions.

**Why this priority**: Configuration and infrastructure are foundational. Testing them ensures the app starts correctly and fails gracefully with clear error messages when misconfigured.

**Independent Test**: Can be fully tested by running configuration and infrastructure tests with controlled environment variables, verifying correct loading and error behavior.

**Acceptance Scenarios**:

1. **Given** a developer runs the test suite, **When** config tests execute, **Then** environment variable loading and validation (including missing variable errors) are verified
2. **Given** a developer runs the test suite, **When** infrastructure tests execute, **Then** database driver initialization and credential selection logic are verified

---

### Edge Cases

- What happens when AI returns malformed JSON for stats or scene generation?
- How does the system handle AI API rate limiting (429 errors) and server errors (5xx)?
- What happens when database queries return empty results for active characters or sessions?
- How does character creation handle input at boundary conditions (empty name, name exactly 50 chars, backstory exactly 2000 chars)?
- What happens when a story action callback references a non-existent session or character?
- How does the system behave when environment variables are missing or malformed?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST have a working test framework configured with TypeScript support
- **FR-002**: The test suite MUST include unit tests for all three domain services (character, story, AI)
- **FR-003**: The test suite MUST include unit tests for all four repository modules (user, character, story session, story turn)
- **FR-004**: The test suite MUST include unit tests for the storage adapter module
- **FR-005**: The test suite MUST include unit tests for Telegram commands (`/start`, `/help`)
- **FR-006**: The test suite MUST include unit tests for the story action handler
- **FR-007**: The test suite MUST include unit tests for the error handling middleware
- **FR-008**: The test suite MUST include unit tests for the configuration module
- **FR-009**: All external dependencies (OpenAI API, database, Telegram API) MUST be mocked in tests
- **FR-010**: The test suite MUST be executable via a single `npm test` command
- **FR-011**: The test suite MUST cover error paths and edge cases (malformed responses, missing data, boundary inputs)
- **FR-012**: The test suite MUST verify AI response validation logic (JSON parsing, stat clamping, action count/length validation)
- **FR-013**: The test suite MUST verify the retry logic for transient AI errors

### Key Entities

- **Test Suite**: Collection of all test files organized to mirror the source directory structure
- **Mock**: Simulated external dependency (AI client, database client, bot context) used to isolate units under test
- **Test Coverage Report**: Generated output showing which lines, branches, and functions are exercised by the test suite

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All tests pass successfully when a developer runs `npm test`
- **SC-002**: Every domain service function has at least one test for its happy path and one for its error path
- **SC-003**: Every repository method has at least one test verifying correct behavior
- **SC-004**: The test suite completes execution in under 30 seconds
- **SC-005**: No test depends on external services (all external calls are mocked)
- **SC-006**: The test suite can run in any environment without requiring database, API keys, or network access
- **SC-007**: Adding a new test file requires no additional configuration beyond placing it in the test directory

## Assumptions

- Jest with TypeScript support (via ts-jest or similar) is the chosen test framework, as specified by the user
- Tests will be unit tests with mocked dependencies, not integration tests requiring running services
- Test files will follow a directory structure mirroring `src/` for discoverability
- The existing `npm test` script in package.json will be updated to run Jest
- Standard Jest conventions will be used (`.test.ts` file suffix, `describe`/`it` blocks)
- No minimum code coverage percentage is mandated, but the goal is comprehensive coverage of all exported functions
