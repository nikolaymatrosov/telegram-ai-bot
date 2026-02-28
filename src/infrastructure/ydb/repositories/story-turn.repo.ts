import type { Driver } from "@ydbjs/core";
import { query } from "@ydbjs/query";
import type { StoryTurn } from "../../../domain/story/types.js";

interface StoryTurnRow {
  user_id: string;
  session_id: string;
  turn_number: number;
  scene_text: string;
  actions_json: string;
  chosen_action: string | null;
  created_at: Date;
}

function rowToTurn(row: StoryTurnRow): StoryTurn {
  let actions: string[];
  try {
    actions = JSON.parse(row.actions_json);
  } catch {
    actions = [];
  }
  return {
    userId: row.user_id,
    sessionId: row.session_id,
    turnNumber: row.turn_number,
    sceneText: row.scene_text,
    actionsJson: actions,
    chosenAction: row.chosen_action,
    createdAt: row.created_at,
  };
}

export function createStoryTurnRepo(driver: Driver) {
  const sql = query(driver);

  return {
    async upsert(
      userId: string,
      sessionId: string,
      turnNumber: number,
      sceneText: string,
      actions: string[],
      chosenAction: string | null,
    ): Promise<void> {
      const now = new Date();
      const actionsJson = JSON.stringify(actions);
      await sql`
        UPSERT INTO story_turns (user_id, session_id, turn_number, scene_text, actions_json, chosen_action, created_at)
        VALUES (${userId}, ${sessionId}, CAST(${turnNumber} AS Uint32), ${sceneText}, CAST(${actionsJson} AS Json), ${chosenAction}, ${now});
      `;
    },

    async findRecentTurns(userId: string, sessionId: string, limit = 10): Promise<StoryTurn[]> {
      const [rows] = await sql<[StoryTurnRow]>`
        SELECT user_id, session_id, turn_number, scene_text, actions_json, chosen_action, created_at
        FROM story_turns
        WHERE user_id = ${userId} AND session_id = ${sessionId}
        ORDER BY turn_number DESC
        LIMIT ${limit};
      `;
      if (!rows || rows.length === 0) return [];
      // Reverse to get chronological order
      return rows.map(rowToTurn).reverse();
    },

    async getLastTurnNumber(userId: string, sessionId: string): Promise<number> {
      const [rows] = await sql<[{ turn_number: number }]>`
        SELECT turn_number
        FROM story_turns
        WHERE user_id = ${userId} AND session_id = ${sessionId}
        ORDER BY turn_number DESC
        LIMIT 1;
      `;
      if (!rows || rows.length === 0) return 0;
      return rows[0].turn_number;
    },

    async updateChosenAction(
      userId: string,
      sessionId: string,
      turnNumber: number,
      chosenAction: string,
    ): Promise<void> {
      await sql`
        UPSERT INTO story_turns (user_id, session_id, turn_number, scene_text, actions_json, chosen_action, created_at)
        SELECT user_id, session_id, turn_number, scene_text, actions_json, ${chosenAction}, created_at
        FROM story_turns
        WHERE user_id = ${userId} AND session_id = ${sessionId} AND turn_number = CAST(${turnNumber} AS Uint32);
      `;
    },
  };
}
