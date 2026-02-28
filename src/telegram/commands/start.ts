import { Composer } from "grammy";
import type { Menu } from "@grammyjs/menu";
import type { MyContext } from "../types.js";
import type { createUserRepo } from "../../infrastructure/ydb/repositories/user.repo.js";
import type { createCharacterService } from "../../domain/character/service.js";
import type { createStoryService } from "../../domain/story/service.js";

type UserRepo = ReturnType<typeof createUserRepo>;
type CharacterService = ReturnType<typeof createCharacterService>;
type StoryService = ReturnType<typeof createStoryService>;

export function createStartCommand(
  userRepo: UserRepo,
  characterService: CharacterService,
  storyService: StoryService,
  mainMenu: Menu<MyContext>,
): Composer<MyContext> {
  const startCommand = new Composer<MyContext>();

  startCommand.command("start", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Upsert user on first visit
    await userRepo.upsert(userId);

    // Check for existing active character
    const character = await characterService.getActiveCharacter(userId);

    if (character) {
      // Returning user — show main menu
      await ctx.reply(
        `Welcome back, **${character.name}**!`,
        { parse_mode: "Markdown", reply_markup: mainMenu },
      );
    } else {
      // New user — start character creation conversation
      await ctx.conversation.enter("characterCreation");
    }
  });

  return startCommand;
}
