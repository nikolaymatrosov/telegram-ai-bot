import { Composer, InlineKeyboard } from "grammy";
import type { MyContext } from "../types.js";
import type { createStoryService } from "../../domain/story/service.js";
import type { createCharacterService } from "../../domain/character/service.js";

type StoryService = ReturnType<typeof createStoryService>;
type CharacterService = ReturnType<typeof createCharacterService>;

function buildActionKeyboard(actions: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (let i = 0; i < actions.length; i++) {
    keyboard.text(actions[i], `action_${i}`).row();
  }
  return keyboard;
}

export function createStoryActionHandler(
  storyService: StoryService,
  characterService: CharacterService,
): Composer<MyContext> {
  const handler = new Composer<MyContext>();

  handler.callbackQuery(/^action_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();

    const userId = ctx.from.id.toString();
    const actionIndex = parseInt(ctx.match[1], 10);

    // Get active session and character
    const activeSession = await storyService.findActiveSession(userId);
    if (!activeSession) {
      await ctx.reply("No active adventure. Use /start to begin!");
      return;
    }

    const character = await characterService.getActiveCharacter(userId);
    if (!character) {
      await ctx.reply("No active character. Use /start to create one!");
      return;
    }

    // Process the action choice
    const chosenAction = await storyService.processActionChoice(
      userId,
      activeSession.id,
      actionIndex,
    );

    if (!chosenAction) {
      await ctx.reply("Invalid action. Please try again.");
      return;
    }

    // Generate next scene
    try {
      const scene = await storyService.generateNextScene(
        userId,
        activeSession.id,
        character,
      );

      await ctx.reply(scene.description, {
        reply_markup: buildActionKeyboard(scene.actions),
      });
    } catch (err) {
      console.error("Scene generation failed:", err);
      await ctx.reply(
        "The DM is taking a short break. Please try again in a moment.",
      );
    }
  });

  return handler;
}
