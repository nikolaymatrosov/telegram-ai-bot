import { config } from "./config/index.js";
import { getDriver, destroyDriver } from "./infrastructure/ydb/driver.js";
import { runMigrations } from "./infrastructure/ydb/migrations.js";
import { createBot } from "./create-bot.js";

async function main() {
  console.log("Starting Dungeon Master Bot...");

  const driver = await getDriver();
  console.log("YDB connected.");

  await runMigrations(driver);
  console.log("Migrations complete.");

  const bot = createBot({
    token: config.botToken,
    driver,
    botInfo: config.botInfo,
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    await bot.stop();
    await destroyDriver();
    console.log("Shutdown complete.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await bot.start({
    onStart: () => console.log("Bot started."),
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
