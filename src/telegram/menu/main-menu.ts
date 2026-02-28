import { Menu } from "@grammyjs/menu";
import { InlineKeyboard } from "grammy";
import type { MyContext } from "../types.js";
import type { createCharacterService } from "../../domain/character/service.js";
import type { createStoryService } from "../../domain/story/service.js";
import type { CharacterStats } from "../../domain/character/types.js";

type CharacterService = ReturnType<typeof createCharacterService>;
type StoryService = ReturnType<typeof createStoryService>;

function formatFullCharacterSheet(
  name: string,
  charClass: string,
  backstory: string,
  stats: CharacterStats,
): string {
  return (
    `**Character Sheet**\n\n` +
    `**Name:** ${name}\n` +
    `**Class:** ${charClass.charAt(0).toUpperCase() + charClass.slice(1)}\n` +
    `**Backstory:** ${backstory}\n\n` +
    `**STR:** ${stats.str} | **DEX:** ${stats.dex} | **CON:** ${stats.con}\n` +
    `**INT:** ${stats.int} | **WIS:** ${stats.wis} | **CHA:** ${stats.cha}`
  );
}

function buildActionKeyboard(actions: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (let i = 0; i < actions.length; i++) {
    keyboard.text(actions[i], `action_${i}`).row();
  }
  return keyboard;
}

export function createMainMenu(
  characterService: CharacterService,
  storyService: StoryService,
): Menu<MyContext> {
  const menu = new Menu<MyContext>("main-menu");

  menu
    .text("Continue Adventure", async (ctx) => {
      const userId = ctx.from.id.toString();
      const character = await characterService.getActiveCharacter(userId);
      if (!character) {
        await ctx.reply("No active character found. Use /start to create one.");
        return;
      }

      try {
        const { session, lastTurn } = await storyService.resumeSession(
          userId,
          character,
        );

        if (lastTurn) {
          await ctx.reply(lastTurn.sceneText, {
            reply_markup: buildActionKeyboard(lastTurn.actionsJson),
          });
        } else {
          await ctx.reply("Starting a new adventure...");
          const { scene } = await storyService.startNewSession(userId, character);
          await ctx.reply(scene.description, {
            reply_markup: buildActionKeyboard(scene.actions),
          });
        }
      } catch (err) {
        console.error("Resume session failed:", err);
        await ctx.reply(
          "The DM is taking a short break. Please try again in a moment.",
        );
      }
    })
    .row()
    .text("View Character Sheet", async (ctx) => {
      const userId = ctx.from.id.toString();
      const character = await characterService.getActiveCharacter(userId);
      if (!character) {
        await ctx.reply("No active character found.");
        return;
      }

      await ctx.reply(
        formatFullCharacterSheet(
          character.name,
          character.class,
          character.backstory,
          character.stats,
        ),
        { parse_mode: "Markdown" },
      );
    })
    .row()
    .text("Create New Character", async (ctx) => {
      const userId = ctx.from.id.toString();

      // Archive current character
      await characterService.archiveCharacter(userId);

      // Complete any active story session
      const activeSession = await storyService.findActiveSession(userId);
      if (activeSession) {
        await storyService.completeSession(userId, activeSession.id);
      }

      // Enter character creation conversation
      await ctx.conversation.enter("characterCreation");
    });

  return menu;
}
