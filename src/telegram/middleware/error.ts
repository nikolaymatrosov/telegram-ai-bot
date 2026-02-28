import type { NextFunction } from "grammy";
import type { MyContext } from "../types.js";

export async function errorMiddleware(
  ctx: MyContext,
  next: NextFunction,
): Promise<void> {
  try {
    await next();
  } catch (err) {
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    console.error(err);
    await ctx
      .reply("Something went wrong. Please try again or use /start to begin fresh.")
      .catch(() => {});
  }
}
