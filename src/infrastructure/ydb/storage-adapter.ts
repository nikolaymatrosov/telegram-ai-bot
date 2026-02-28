import type { StorageAdapter } from "grammy";
import type { Driver } from "@ydbjs/core";
import { query } from "@ydbjs/query";
import type { VersionedState } from "@grammyjs/conversations";

export function createYdbStorageAdapter<T>(
  driver: Driver,
): StorageAdapter<T> {
  const sql = query(driver);

  return {
    async read(key: string): Promise<T | undefined> {
      const [rows] = await sql<[{ data: string }]>`
        SELECT data FROM bot_sessions WHERE session_key = ${key};
      `;
      if (!rows || rows.length === 0) return undefined;
      return JSON.parse(rows[0].data) as T;
    },

    async write(key: string, value: T): Promise<void> {
      const data = JSON.stringify(value);
      const now = new Date();
      await sql`
        UPSERT INTO bot_sessions (session_key, data, updated_at)
        VALUES (${key}, CAST(${data} AS Json), ${now});
      `;
    },

    async delete(key: string): Promise<void> {
      await sql`
        DELETE FROM bot_sessions WHERE session_key = ${key};
      `;
    },
  };
}

/**
 * Creates a ConversationStorage adapter for the conversations plugin.
 * Uses the bot_sessions table with "conv:" prefix for keys.
 */
export function createYdbConversationStorage<S>(driver: Driver) {
  const sql = query(driver);

  return {
    async read(key: string): Promise<VersionedState<S> | undefined> {
      const storageKey = `conv:${key}`;
      const [rows] = await sql<[{ data: string }]>`
        SELECT data FROM bot_sessions WHERE session_key = ${storageKey};
      `;
      if (!rows || rows.length === 0) return undefined;
      return JSON.parse(rows[0].data) as VersionedState<S>;
    },

    async write(key: string, state: VersionedState<S>): Promise<void> {
      const storageKey = `conv:${key}`;
      const data = JSON.stringify(state);
      const now = new Date();
      await sql`
        UPSERT INTO bot_sessions (session_key, data, updated_at)
        VALUES (${storageKey}, CAST(${data} AS Json), ${now});
      `;
    },

    async delete(key: string): Promise<void> {
      const storageKey = `conv:${key}`;
      await sql`
        DELETE FROM bot_sessions WHERE session_key = ${storageKey};
      `;
    },
  };
}
