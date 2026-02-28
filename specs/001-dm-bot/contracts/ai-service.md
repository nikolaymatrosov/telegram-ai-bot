# AI Service Contract

**Feature**: 001-dm-bot
**Date**: 2026-02-28

## Domain Layer Functions

These functions live in `src/domain/` and accept/return plain
TypeScript types. No Telegram or infrastructure types.

### generateCharacterStats

**Input**:

```typescript
interface StatsRequest {
  characterClass: "warrior" | "mage" | "rogue" | "healer";
  backstory: string;
}
```

**Output**:

```typescript
interface CharacterStats {
  str: number; // 3-18
  dex: number; // 3-18
  con: number; // 3-18
  int: number; // 3-18
  wis: number; // 3-18
  cha: number; // 3-18
}
```

**Behavior**: Uses OpenAI chat completions with JSON mode to
produce stats influenced by class archetype and backstory themes.
Stats MUST be integers in range 3-18. If AI returns out-of-range
values, clamp to bounds.

**Error handling**: On AI failure, throw a typed error that the
calling layer can catch and present a user-friendly message.

### generateScene

**Input**:

```typescript
interface SceneRequest {
  character: {
    name: string;
    class: string;
    backstory: string;
    stats: CharacterStats;
  };
  history: Array<{
    scene: string;
    chosenAction: string;
  }>;
  isFirstScene: boolean;
}
```

**Output**:

```typescript
interface SceneResponse {
  description: string; // narrative text, 200-800 chars
  actions: string[];   // 2-4 action options
}
```

**Behavior**: Uses OpenAI chat completions with a DM system prompt.
Includes character sheet and last N history entries (up to 10) in
the messages array. Requests structured output with scene
description and action options.

**Constraints**:

- Scene description: 200-800 characters
- Actions: exactly 2-4 options, each under 64 characters
  (Telegram inline button limit)
- Actions MUST be distinct and relevant to the scene
- If `isFirstScene` is true, generate an adventure opening

**Error handling**: On AI failure, throw a typed error. The caller
retries once, then falls back to user-facing error message.

## System Prompts

### DM System Prompt (scene generation)

```
You are a Dungeon Master narrating an interactive fantasy
adventure. You describe scenes vividly and offer the player
meaningful choices. Consider the character's stats when describing
outcomes — higher stats lead to more favorable results in
relevant situations.

Rules:
- Keep descriptions between 200-800 characters
- Always offer 2-4 distinct action options
- Maintain consistency with previously established facts
- Reference the character's backstory naturally when relevant
- Do not break the fourth wall
- Respond in the same language as the player's backstory
```

### Stats Generation System Prompt

```
You are generating D&D-style character stats based on the
character's class and backstory. Return a JSON object with six
stats: str, dex, con, int, wis, cha. Each must be an integer
from 3 to 18.

Class archetypes affect base stat distributions:
- Warrior: higher STR, CON
- Mage: higher INT, WIS
- Rogue: higher DEX, CHA
- Healer: higher WIS, CHA

Backstory themes should further influence stats. Total stat
points should be between 60-80.
```
