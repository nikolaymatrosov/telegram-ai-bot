import type { Driver } from "@ydbjs/core";
import { query } from "@ydbjs/query";

export interface UserRecord {
  user_id: string;
  active_character_id: string | null;
  created_at: Date;
}

export function createUserRepo(driver: Driver) {
  const sql = query(driver);

  return {
    async findByTelegramId(userId: string): Promise<UserRecord | undefined> {
      const [rows] = await sql<[UserRecord]>`
        SELECT user_id, active_character_id, created_at
        FROM users
        WHERE user_id = ${userId};
      `;
      return rows?.[0];
    },

    async upsert(userId: string, activeCharacterId?: string | null): Promise<void> {
      const now = new Date();
      if (activeCharacterId !== undefined) {
        await sql`
          UPSERT INTO users (user_id, active_character_id, created_at)
          VALUES (${userId}, ${activeCharacterId}, ${now});
        `;
      } else {
        await sql`
          UPSERT INTO users (user_id, created_at)
          VALUES (${userId}, ${now});
        `;
      }
    },

    async updateActiveCharacter(userId: string, characterId: string | null): Promise<void> {
      await sql`
        UPSERT INTO users (user_id, active_character_id, created_at)
        VALUES (${userId}, ${characterId}, COALESCE(
          (SELECT created_at FROM users WHERE user_id = ${userId}),
          ${new Date()}
        ));
      `;
    },
  };
}
