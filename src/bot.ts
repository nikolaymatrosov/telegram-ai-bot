import { Bot } from "grammy";
import { config } from "./config/index.js";
import { getDriver, destroyDriver } from "./infrastructure/ydb/driver.js";
import { runMigrations } from "./infrastructure/ydb/migrations.js";
import { createUserRepo } from "./infrastructure/ydb/repositories/user.repo.js";
import { createCharacterRepo } from "./infrastructure/ydb/repositories/character.repo.js";
import { createStorySessionRepo } from "./infrastructure/ydb/repositories/story-session.repo.js";
import { createStoryTurnRepo } from "./infrastructure/ydb/repositories/story-turn.repo.js";
import { createCharacterService } from "./domain/character/service.js";
import { createStoryService } from "./domain/story/service.js";
import { createTelegramLayer } from "./telegram/index.js";
import type { MyContext } from "./telegram/types.js";

async function main() {
  console.log("Starting Dungeon Master Bot...");

  // Initialize YDB
  const driver = await getDriver();
  console.log("YDB connected.");

  await runMigrations(driver);
  console.log("Migrations complete.");

  // Create repositories and services
  const userRepo = createUserRepo(driver);
  const charRepo = createCharacterRepo(driver);
  const storySessionRepo = createStorySessionRepo(driver);
  const storyTurnRepo = createStoryTurnRepo(driver);
  const characterService = createCharacterService(charRepo, userRepo);
  const storyService = createStoryService(storySessionRepo, storyTurnRepo);

  // Create bot
  const bot = new Bot<MyContext>(config.botToken);

  // Assemble telegram layer
  bot.use(createTelegramLayer(driver, userRepo, characterService, storyService));

  // Error handling (must be registered on bot, not as middleware)
  bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
    err.ctx
      .reply("Something went wrong. Please try again or use /start to begin fresh.")
      .catch(() => {});
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    await bot.stop();
    await destroyDriver();
    console.log("Shutdown complete.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start polling
  await bot.start({
    onStart: () => console.log("Bot started."),
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
