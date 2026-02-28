import { session } from "grammy";
import type { Driver } from "@ydbjs/core";
import type { MyContext, AppSessionData } from "../types.js";
import { createYdbStorageAdapter } from "../../infrastructure/ydb/storage-adapter.js";

export function createSessionMiddleware(driver: Driver) {
  return session<AppSessionData, MyContext>({
    initial: (): AppSessionData => ({}),
    storage: createYdbStorageAdapter<AppSessionData>(driver),
    getSessionKey: (ctx) => ctx.from?.id.toString(),
  });
}
