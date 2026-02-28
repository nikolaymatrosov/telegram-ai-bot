# Telegram Bot Interface Contract

**Feature**: 001-dm-bot
**Date**: 2026-02-28

## Commands

### /start

**Behavior**: Entry point. Routes based on user state.

| User State | Response |
|------------|----------|
| No character exists | Begin character creation conversation |
| Character exists | Show main menu (inline keyboard) |

### /help

**Behavior**: Display available commands and brief usage guide.

## Inline Keyboards

### Main Menu (returning user)

Displayed when `/start` is sent by a user with an existing
character.

```
Welcome back, {character_name}!

[ Continue Adventure ]
[ View Character Sheet ]
[ Create New Character ]
```

Callback data:
- `menu_continue` → load active story session or start new one
- `menu_view_character` → display character sheet
- `menu_new_character` → archive current character, start creation

### Class Selection (character creation)

```
Choose your class:

[ Warrior ] [ Mage  ]
[ Rogue   ] [ Healer ]
```

Callback data: `class_warrior`, `class_mage`, `class_rogue`,
`class_healer`

### Character Confirmation (character creation)

```
**Your Character Sheet**

Name: {name}
Class: {class}
Backstory: {backstory_preview}...

STR: {str} | DEX: {dex} | CON: {con}
INT: {int} | WIS: {wis} | CHA: {cha}

[ Confirm ] [ Start Over ]
```

Callback data: `confirm_character`, `restart_character`

### Story Action Choices (storytelling)

```
{scene_description}

[ {action_1} ]
[ {action_2} ]
[ {action_3} ]
[ {action_4} ]  (optional, 2-4 actions)
```

Callback data: `action_0`, `action_1`, `action_2`, `action_3`

## Conversation Flows

### Character Creation

```
Bot: "Welcome, adventurer! What shall your character be named?"
User: {free text} → name

Bot: "Choose your class:" [inline keyboard]
User: [button press] → class

Bot: "Tell me your backstory (max 2000 chars):"
User: {free text} → backstory

Bot: [character sheet + confirm/restart keyboard]
User: [Confirm] → save to DB, ready for adventure
User: [Start Over] → re-enter character creation
```

### Story Turn

```
Bot: {scene description} [action buttons]
User: [button press] → chosen action
Bot: {next scene description} [new action buttons]
... (repeats)
```

## Error Messages

| Scenario | Message (localized) |
|----------|---------------------|
| AI service unavailable | "The DM is taking a short break. Please try again in a moment." |
| DB save failed | "Could not save your progress. Retrying..." |
| Backstory too long | "Your backstory is too long! Please keep it under 2000 characters." |
| Invalid name | "Please enter a valid name (1-50 characters)." |
| Unexpected input during creation | "Let's continue where we left off. {current step prompt}" |

## Message Formatting

- Character sheets use Markdown bold for labels
- Scene descriptions use plain text (AI-generated)
- Stats displayed in `STR: N | DEX: N | CON: N` format
- Parse mode: `Markdown` for character sheets, none for scenes
