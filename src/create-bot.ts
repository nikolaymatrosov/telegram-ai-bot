import { Bot } from "grammy";
import type { Driver } from "@ydbjs/core";
import type { UserFromGetMe } from "grammy/types";
import { createTelegramLayer } from "./telegram/index.js";
import { createUserRepo } from "./infrastructure/ydb/repositories/user.repo.js";
import { createCharacterRepo } from "./infrastructure/ydb/repositories/character.repo.js";
import { createStorySessionRepo } from "./infrastructure/ydb/repositories/story-session.repo.js";
import { createStoryTurnRepo } from "./infrastructure/ydb/repositories/story-turn.repo.js";
import { createCharacterService } from "./domain/character/service.js";
import { createStoryService } from "./domain/story/service.js";
import type { MyContext } from "./telegram/types.js";

export interface CreateBotOptions {
  token: string;
  driver: Driver;
  botInfo?: UserFromGetMe;
}

export function createBot(options: CreateBotOptions): Bot<MyContext> {
  const { token, driver, botInfo } = options;

  const bot = new Bot<MyContext>(token, botInfo ? { botInfo } : undefined);

  const userRepo = createUserRepo(driver);
  const charRepo = createCharacterRepo(driver);
  const storySessionRepo = createStorySessionRepo(driver);
  const storyTurnRepo = createStoryTurnRepo(driver);
  const characterService = createCharacterService(charRepo, userRepo);
  const storyService = createStoryService(storySessionRepo, storyTurnRepo);

  bot.use(createTelegramLayer(driver, userRepo, characterService, storyService));

  bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
    err.ctx
      .reply("Something went wrong. Please try again or use /start to begin fresh.")
      .catch(() => {});
  });

  return bot;
}
