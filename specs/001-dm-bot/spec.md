# Feature Specification: Dungeon Master Bot

**Feature Branch**: `001-dm-bot`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "Telegram bot acting as a Dungeon Master — character creation, interactive storytelling with action choices, character persistence in YDB"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Character Creation (Priority: P1)

A new user starts the bot and goes through an interactive character
creation flow. The bot guides them step-by-step: first choosing a
character name, then selecting a class from predefined options, then
writing a free-form backstory. Once the user confirms their choices,
the DM (AI) analyzes the class and backstory to determine appropriate
character stats (strength, dexterity, constitution, intelligence,
wisdom, charisma). The bot presents the final character sheet for
the user to review before saving.

**Why this priority**: Character creation is the entry point for every
user. Without a character, no adventure can begin. This is the
foundational interaction that must work before anything else.

**Independent Test**: Can be fully tested by starting a conversation
with `/start`, completing the character creation flow, and verifying
the character sheet is displayed and saved. Delivers a complete
onboarding experience.

**Acceptance Scenarios**:

1. **Given** a user with no existing character, **When** they send
   `/start`, **Then** the bot greets them and asks for a character
   name.
2. **Given** the user has entered a name, **When** the bot prompts
   for class selection, **Then** a list of available classes is
   presented as inline buttons (e.g., Warrior, Mage, Rogue, Healer).
3. **Given** the user has selected a class, **When** the bot prompts
   for backstory, **Then** the user can type free-form text
   describing their character's history.
4. **Given** the user has provided name, class, and backstory,
   **When** the bot generates stats, **Then** six stats (STR, DEX,
   CON, INT, WIS, CHA) are assigned with values influenced by class
   and backstory, each in the range 3-18.
5. **Given** the character sheet is displayed, **When** the user
   confirms, **Then** the character is persisted and the user is
   ready to begin an adventure.

---

### User Story 2 - Interactive Storytelling (Priority: P2)

After character creation, the DM begins narrating an adventure. The
bot describes the current scene in vivid detail and presents 2-4
action options as inline buttons. The user selects an action, and
the DM generates the next scene based on the character's stats,
backstory, and previous choices. The story continues as a
back-and-forth dialogue.

**Why this priority**: This is the core gameplay loop. It is the
primary reason users interact with the bot. Without storytelling,
the character creation has no purpose.

**Independent Test**: Can be tested by completing character creation
and then selecting actions through at least 3 story turns, verifying
that each response is contextually relevant and offers new choices.

**Acceptance Scenarios**:

1. **Given** a user with a saved character, **When** the adventure
   begins, **Then** the DM describes an opening scene and presents
   2-4 action options as buttons.
2. **Given** the user selects an action, **When** the DM processes
   it, **Then** a new scene is generated that reflects the chosen
   action, the character's stats, and prior narrative context.
3. **Given** the user is in an active story, **When** a stat check
   is needed (e.g., strength to lift a boulder), **Then** the DM
   factors the character's relevant stat into the outcome
   description.
4. **Given** the user has been through multiple turns, **When** a
   new scene is generated, **Then** it maintains narrative
   consistency with all previous scenes in the session.

---

### User Story 3 - Character Persistence and Resume (Priority: P3)

A returning user can resume their adventure from where they left off.
The bot loads their saved character from the database and provides
options to continue the current adventure or view their character
sheet. If a user already has a character, `/start` does not restart
character creation but instead offers a menu.

**Why this priority**: Persistence transforms a one-time novelty into
a reusable experience. Users expect their progress to be saved
between sessions.

**Independent Test**: Can be tested by creating a character, closing
the chat, reopening, and verifying the bot recognizes the user and
offers to continue.

**Acceptance Scenarios**:

1. **Given** a user with an existing character, **When** they send
   `/start`, **Then** the bot greets them by character name and
   offers options: "Continue adventure", "View character sheet",
   "Create new character".
2. **Given** the user selects "View character sheet", **When** the
   bot responds, **Then** it displays the full character sheet
   (name, class, backstory summary, stats).
3. **Given** the user selects "Continue adventure", **When** the
   bot responds, **Then** the DM picks up from the last story
   context or starts a new adventure chapter if the previous one
   concluded.
4. **Given** the user selects "Create new character", **When** the
   bot responds, **Then** the old character is archived and a new
   character creation flow begins.

---

### Edge Cases

- What happens when a user sends random text during character
  creation instead of following the flow? The bot MUST gently
  redirect them to the current step.
- What happens when the AI service is temporarily unavailable during
  storytelling? The bot MUST inform the user and offer to retry.
- What happens when a user sends `/start` mid-adventure? The bot
  MUST offer a menu without losing current story progress.
- What happens when the user's backstory is excessively long
  (>2000 characters)? The bot MUST ask them to shorten it.
- What happens when the database is unreachable during character
  save? The bot MUST inform the user and retry automatically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST guide users through a step-by-step
  character creation flow: name, class selection, backstory input.
- **FR-002**: System MUST present class options as interactive
  inline buttons (minimum 4 classes: Warrior, Mage, Rogue, Healer).
- **FR-003**: System MUST accept free-form text input for character
  name and backstory.
- **FR-004**: System MUST use AI to generate six character stats
  (STR, DEX, CON, INT, WIS, CHA) based on the selected class and
  provided backstory, with values in the range 3-18.
- **FR-005**: System MUST display a complete character sheet for
  user confirmation before saving.
- **FR-006**: System MUST persist character data (name, class,
  backstory, stats, Telegram user ID) to the database.
- **FR-007**: System MUST generate immersive scene descriptions
  using AI, incorporating character attributes and prior story
  context.
- **FR-008**: System MUST present 2-4 action options as inline
  buttons after each scene description.
- **FR-009**: System MUST maintain narrative consistency across
  story turns within a session.
- **FR-010**: System MUST recognize returning users and load their
  saved character data.
- **FR-011**: System MUST offer returning users a menu: continue
  adventure, view character sheet, or create new character.
- **FR-012**: System MUST handle conversation state to track where
  the user is in the character creation or storytelling flow.

### Key Entities

- **Character**: Represents a player's in-game persona. Attributes:
  name, class, backstory, stats (STR, DEX, CON, INT, WIS, CHA),
  owning Telegram user ID, creation timestamp.
- **Story Session**: Represents an ongoing adventure. Attributes:
  associated character, conversation history (scene descriptions
  and chosen actions), session status (active/completed), last
  activity timestamp.
- **User**: Represents a Telegram user. Attributes: Telegram user
  ID, active character reference, registration timestamp.

### Assumptions

- Character classes are predefined by the system (not user-created).
  Initial set: Warrior, Mage, Rogue, Healer. More can be added
  later.
- Stats are generated by the AI based on class archetype and
  backstory themes (e.g., a Warrior with a military backstory gets
  higher STR; a Mage who studied ancient texts gets higher INT).
- Story context window is limited to the 10 most recent turns
  (scene + chosen action pairs) to keep AI prompts manageable
  and control cost. Older turns are discarded from the prompt.
- One active character per user at a time. Previous characters are
  archived when a new one is created.
- All bot interactions happen in private chats (not group chats).
- The bot communicates in the same language the user writes in
  (Russian or English).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete character creation (name, class,
  backstory, stats review) in under 5 minutes.
- **SC-002**: Each story scene is generated and displayed to the
  user within 10 seconds of their action selection.
- **SC-003**: 90% of story scenes maintain narrative consistency
  with prior context (no contradictions in character names,
  locations, or established facts).
- **SC-004**: Returning users see their saved character within
  3 seconds of sending `/start`.
- **SC-005**: The bot recovers gracefully from AI service outages
  with a user-friendly message 100% of the time (no silent
  failures or crashes).
