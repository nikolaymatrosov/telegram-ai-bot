import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { MyContext } from "../types.js";
import type { CharacterClass, CharacterStats } from "../../domain/character/types.js";
import { generateCharacterStats } from "../../domain/ai/service.js";
import { getDriver } from "../../infrastructure/ydb/driver.js";
import { createCharacterRepo } from "../../infrastructure/ydb/repositories/character.repo.js";
import { createUserRepo } from "../../infrastructure/ydb/repositories/user.repo.js";
import { createCharacterService } from "../../domain/character/service.js";
import { createStorySessionRepo } from "../../infrastructure/ydb/repositories/story-session.repo.js";
import { createStoryTurnRepo } from "../../infrastructure/ydb/repositories/story-turn.repo.js";
import { createStoryService } from "../../domain/story/service.js";

type MyConversation = Conversation<MyContext, MyContext>;

function formatCharacterSheet(
  name: string,
  charClass: CharacterClass,
  backstory: string,
  stats: CharacterStats,
): string {
  const backstoryPreview =
    backstory.length > 100 ? backstory.slice(0, 97) + "..." : backstory;
  return (
    `**Your Character Sheet**\n\n` +
    `**Name:** ${name}\n` +
    `**Class:** ${charClass.charAt(0).toUpperCase() + charClass.slice(1)}\n` +
    `**Backstory:** ${backstoryPreview}\n\n` +
    `**STR:** ${stats.str} | **DEX:** ${stats.dex} | **CON:** ${stats.con}\n` +
    `**INT:** ${stats.int} | **WIS:** ${stats.wis} | **CHA:** ${stats.cha}`
  );
}

async function runCreationFlow(
  conversation: MyConversation,
  ctx: MyContext,
): Promise<void> {
  // Step 1: Ask for name
  await ctx.reply("Welcome, adventurer! What shall your character be named?");
  let nameCtx = await conversation.waitFor("message:text", {
    otherwise: (ctx) => ctx.reply("Please enter a valid name (1-50 characters)."),
  });
  let name = nameCtx.message.text.trim();
  while (name.length === 0 || name.length > 50) {
    await nameCtx.reply("Please enter a valid name (1-50 characters).");
    nameCtx = await conversation.waitFor("message:text", {
      otherwise: (ctx) => ctx.reply("Please enter a valid name (1-50 characters)."),
    });
    name = nameCtx.message.text.trim();
  }

  // Step 2: Ask for class
  const classKeyboard = new InlineKeyboard()
    .text("Warrior", "class_warrior")
    .text("Mage", "class_mage")
    .row()
    .text("Rogue", "class_rogue")
    .text("Healer", "class_healer");

  await nameCtx.reply("Choose your class:", { reply_markup: classKeyboard });

  const classCtx = await conversation.waitForCallbackQuery(
    /^class_(warrior|mage|rogue|healer)$/,
    {
      otherwise: (ctx) =>
        ctx.reply("Please select a class using the buttons above."),
    },
  );
  await classCtx.answerCallbackQuery();
  const charClass = classCtx.callbackQuery.data.replace(
    "class_",
    "",
  ) as CharacterClass;

  // Step 3: Ask for backstory
  await classCtx.reply("Tell me your backstory (max 2000 characters):");
  let backstoryCtx = await conversation.waitFor("message:text", {
    otherwise: (ctx) =>
      ctx.reply("Please enter your backstory as text (max 2000 characters)."),
  });
  let backstory = backstoryCtx.message.text.trim();
  while (backstory.length > 2000) {
    await backstoryCtx.reply(
      "Your backstory is too long! Please keep it under 2000 characters.",
    );
    backstoryCtx = await conversation.waitFor("message:text", {
      otherwise: (ctx) =>
        ctx.reply("Please enter your backstory as text (max 2000 characters)."),
    });
    backstory = backstoryCtx.message.text.trim();
  }

  // Step 4: Generate stats via AI
  await backstoryCtx.reply("Generating your character stats...");

  const stats = await conversation.external(() =>
    generateCharacterStats({ characterClass: charClass, backstory }),
  );

  // Step 5: Show character sheet and confirm
  const confirmKeyboard = new InlineKeyboard()
    .text("Confirm", "confirm_character")
    .text("Start Over", "restart_character");

  await backstoryCtx.reply(
    formatCharacterSheet(name, charClass, backstory, stats),
    {
      parse_mode: "Markdown",
      reply_markup: confirmKeyboard,
    },
  );

  const confirmCtx = await conversation.waitForCallbackQuery(
    /^(confirm_character|restart_character)$/,
    {
      otherwise: (ctx) =>
        ctx.reply("Please use the buttons to confirm or start over."),
    },
  );
  await confirmCtx.answerCallbackQuery();

  if (confirmCtx.callbackQuery.data === "restart_character") {
    return runCreationFlow(conversation, confirmCtx as MyContext);
  }

  // Step 6: Save character to DB
  const userId = confirmCtx.from.id.toString();

  const result = await conversation.external(async () => {
    const driver = await getDriver();
    const charRepo = createCharacterRepo(driver);
    const userRepo = createUserRepo(driver);
    const charService = createCharacterService(charRepo, userRepo);
    const character = await charService.createCharacter(userId, name, charClass, backstory, stats);

    // Auto-start first story session
    const storySessionRepo = createStorySessionRepo(driver);
    const storyTurnRepo = createStoryTurnRepo(driver);
    const storyServ = createStoryService(storySessionRepo, storyTurnRepo);
    const { scene } = await storyServ.startNewSession(userId, character);

    return { character, scene };
  });

  await confirmCtx.reply(
    `Character **${result.character.name}** has been created! Your adventure begins...\n\n${result.scene.description}`,
    {
      parse_mode: "Markdown",
      reply_markup: (() => {
        const kb = new InlineKeyboard();
        for (let i = 0; i < result.scene.actions.length; i++) {
          kb.text(result.scene.actions[i], `action_${i}`).row();
        }
        return kb;
      })(),
    },
  );
}

export async function characterCreation(
  conversation: MyConversation,
  ctx: MyContext,
): Promise<void> {
  await runCreationFlow(conversation, ctx);
}
