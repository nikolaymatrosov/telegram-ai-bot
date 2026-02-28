import type { Driver } from "@ydbjs/core";
import { query } from "@ydbjs/query";
import type { StorySession } from "../../../domain/story/types.js";

interface StorySessionRow {
  session_id: string;
  user_id: string;
  character_id: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function rowToSession(row: StorySessionRow): StorySession {
  return {
    id: row.session_id,
    userId: row.user_id,
    characterId: row.character_id,
    status: row.status as "active" | "completed",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createStorySessionRepo(driver: Driver) {
  const sql = query(driver);

  return {
    async upsert(
      userId: string,
      sessionId: string,
      characterId: string,
      status: "active" | "completed",
    ): Promise<void> {
      const now = new Date();
      await sql`
        UPSERT INTO story_sessions (user_id, session_id, character_id, status, created_at, updated_at)
        VALUES (${userId}, ${sessionId}, ${characterId}, ${status}, ${now}, ${now});
      `;
    },

    async findActiveByUserId(userId: string): Promise<StorySession | undefined> {
      const [rows] = await sql<[StorySessionRow]>`
        SELECT session_id, user_id, character_id, status, created_at, updated_at
        FROM story_sessions
        WHERE user_id = ${userId} AND status = 'active';
      `;
      if (!rows || rows.length === 0) return undefined;
      return rowToSession(rows[0]);
    },

    async completeSession(userId: string, sessionId: string): Promise<void> {
      const now = new Date();
      await sql`
        UPSERT INTO story_sessions (user_id, session_id, character_id, status, created_at, updated_at)
        SELECT user_id, session_id, character_id, 'completed', created_at, ${now}
        FROM story_sessions
        WHERE user_id = ${userId} AND session_id = ${sessionId};
      `;
    },

    async updateTimestamp(userId: string, sessionId: string): Promise<void> {
      const now = new Date();
      await sql`
        UPSERT INTO story_sessions (user_id, session_id, character_id, status, created_at, updated_at)
        SELECT user_id, session_id, character_id, status, created_at, ${now}
        FROM story_sessions
        WHERE user_id = ${userId} AND session_id = ${sessionId};
      `;
    },
  };
}
