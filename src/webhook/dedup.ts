import type { Driver } from "@ydbjs/core";
import { query } from "@ydbjs/query";

export interface DedupChecker {
  checkProcessed(updateId: number): Promise<boolean>;
  markProcessed(updateId: number): Promise<void>;
}

export function createDedupChecker(driver: Driver): DedupChecker {
  const sql = query(driver);

  return {
    async checkProcessed(updateId: number): Promise<boolean> {
      const [rows] = await sql<[{ update_id: number }]>`
        SELECT update_id FROM processed_updates WHERE update_id = ${BigInt(updateId)};
      `;
      return rows !== undefined && rows.length > 0;
    },

    async markProcessed(updateId: number): Promise<void> {
      const now = new Date();
      await sql`
        UPSERT INTO processed_updates (update_id, processed_at)
        VALUES (${BigInt(updateId)}, ${now});
      `;
    },
  };
}
