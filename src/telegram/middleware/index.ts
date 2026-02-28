import { Composer } from "grammy";
import type { Driver } from "@ydbjs/core";
import type { MyContext } from "../types.js";
import { createSessionMiddleware } from "./session.js";
import { errorMiddleware } from "./error.js";

export function createMiddleware(driver: Driver): Composer<MyContext> {
  const middleware = new Composer<MyContext>();
  middleware.use(errorMiddleware);
  middleware.use(createSessionMiddleware(driver));
  return middleware;
}
