import { Composer } from "grammy";
import type { MyContext } from "../types.js";

const helpCommand = new Composer<MyContext>();

helpCommand.command("help", async (ctx) => {
  await ctx.reply(
    "**Dungeon Master Bot** — your AI-powered adventure companion!\n\n" +
      "**Commands:**\n" +
      "/start — Begin your adventure or return to the main menu\n" +
      "/help — Show this help message\n\n" +
      "**How to play:**\n" +
      "1. Create a character (name, class, backstory)\n" +
      "2. The DM generates your stats and starts a story\n" +
      "3. Choose actions to shape your adventure\n" +
      "4. Your progress is saved automatically",
    { parse_mode: "Markdown" },
  );
});

export { helpCommand };
