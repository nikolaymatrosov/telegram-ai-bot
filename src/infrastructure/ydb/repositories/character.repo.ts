import type { Driver } from "@ydbjs/core";
import { query } from "@ydbjs/query";
import type { Character, CharacterStats, CharacterClass } from "../../../domain/character/types.js";

interface CharacterRow {
  character_id: string;
  user_id: string;
  name: string;
  class: string;
  backstory: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  is_active: boolean;
  created_at: Date;
}

function rowToCharacter(row: CharacterRow): Character {
  return {
    id: row.character_id,
    userId: row.user_id,
    name: row.name,
    class: row.class as CharacterClass,
    backstory: row.backstory,
    stats: {
      str: row.str,
      dex: row.dex,
      con: row.con,
      int: row.int,
      wis: row.wis,
      cha: row.cha,
    },
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function createCharacterRepo(driver: Driver) {
  const sql = query(driver);

  return {
    async upsert(
      userId: string,
      characterId: string,
      name: string,
      charClass: CharacterClass,
      backstory: string,
      stats: CharacterStats,
      isActive: boolean,
    ): Promise<void> {
      const now = new Date();
      await sql`
        UPSERT INTO characters (user_id, character_id, name, class, backstory, str, dex, con, \`int\`, wis, cha, is_active, created_at)
        VALUES (
          ${userId}, ${characterId}, ${name}, ${charClass}, ${backstory},
          CAST(${stats.str} AS Uint8), CAST(${stats.dex} AS Uint8), CAST(${stats.con} AS Uint8),
          CAST(${stats.int} AS Uint8), CAST(${stats.wis} AS Uint8), CAST(${stats.cha} AS Uint8),
          ${isActive}, ${now}
        );
      `;
    },

    async findActiveByUserId(userId: string): Promise<Character | undefined> {
      const [rows] = await sql<[CharacterRow]>`
        SELECT character_id, user_id, name, class, backstory, str, dex, con, \`int\`, wis, cha, is_active, created_at
        FROM characters
        WHERE user_id = ${userId} AND is_active = true;
      `;
      if (!rows || rows.length === 0) return undefined;
      return rowToCharacter(rows[0]);
    },

    async findById(userId: string, characterId: string): Promise<Character | undefined> {
      const [rows] = await sql<[CharacterRow]>`
        SELECT character_id, user_id, name, class, backstory, str, dex, con, \`int\`, wis, cha, is_active, created_at
        FROM characters
        WHERE user_id = ${userId} AND character_id = ${characterId};
      `;
      if (!rows || rows.length === 0) return undefined;
      return rowToCharacter(rows[0]);
    },

    async archiveByUserId(userId: string): Promise<void> {
      // Find active character first, then update
      const [rows] = await sql<[{ character_id: string }]>`
        SELECT character_id FROM characters
        WHERE user_id = ${userId} AND is_active = true;
      `;
      if (rows && rows.length > 0) {
        for (const row of rows) {
          await sql`
            UPSERT INTO characters (user_id, character_id, name, class, backstory, str, dex, con, \`int\`, wis, cha, is_active, created_at)
            SELECT user_id, character_id, name, class, backstory, str, dex, con, \`int\`, wis, cha, false, created_at
            FROM characters
            WHERE user_id = ${userId} AND character_id = ${row.character_id};
          `;
        }
      }
    },
  };
}
