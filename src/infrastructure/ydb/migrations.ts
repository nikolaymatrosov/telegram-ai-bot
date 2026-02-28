import type { Driver } from "@ydbjs/core";
import { query } from "@ydbjs/query";

const CREATE_USERS = `
CREATE TABLE users (
  user_id       Utf8,
  active_character_id Utf8,
  created_at    Timestamp,
  PRIMARY KEY (user_id)
);
`;

const CREATE_CHARACTERS = `
CREATE TABLE characters (
  user_id       Utf8,
  character_id  Utf8,
  name          Utf8,
  class         Utf8,
  backstory     Utf8,
  str           Uint8,
  dex           Uint8,
  con           Uint8,
  \`int\`       Uint8,
  wis           Uint8,
  cha           Uint8,
  is_active     Bool,
  created_at    Timestamp,
  PRIMARY KEY (user_id, character_id)
);
`;

const CREATE_STORY_SESSIONS = `
CREATE TABLE story_sessions (
  user_id       Utf8,
  session_id    Utf8,
  character_id  Utf8,
  status        Utf8,
  created_at    Timestamp,
  updated_at    Timestamp,
  PRIMARY KEY (user_id, session_id)
);
`;

const CREATE_STORY_TURNS = `
CREATE TABLE story_turns (
  user_id       Utf8,
  session_id    Utf8,
  turn_number   Uint32,
  scene_text    Utf8,
  actions_json  Json,
  chosen_action Utf8,
  created_at    Timestamp,
  PRIMARY KEY (user_id, session_id, turn_number)
);
`;

const CREATE_BOT_SESSIONS = `
CREATE TABLE bot_sessions (
  session_key   Utf8,
  data          Json,
  updated_at    Timestamp,
  PRIMARY KEY (session_key)
);
`;

const TABLES = [
  { name: "users", ddl: CREATE_USERS },
  { name: "characters", ddl: CREATE_CHARACTERS },
  { name: "story_sessions", ddl: CREATE_STORY_SESSIONS },
  { name: "story_turns", ddl: CREATE_STORY_TURNS },
  { name: "bot_sessions", ddl: CREATE_BOT_SESSIONS },
];

export async function runMigrations(driver: Driver): Promise<void> {
  const sql = query(driver);

  for (const table of TABLES) {
    try {
      await sql`${sql.unsafe(table.ddl)}`;
      console.log(`Created table: ${table.name}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      if (message.includes("already exists")) {
        console.log(`Table already exists: ${table.name}`);
      } else {
        throw err;
      }
    }
  }
}
