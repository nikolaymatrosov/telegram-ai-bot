import { Composer } from "grammy";
import type { Menu } from "@grammyjs/menu";
import type { MyContext } from "../types.js";
import type { createUserRepo } from "../../infrastructure/ydb/repositories/user.repo.js";
import type { createCharacterService } from "../../domain/character/service.js";
import type { createStoryService } from "../../domain/story/service.js";
import { createStartCommand } from "./start.js";
import { helpCommand } from "./help.js";

type UserRepo = ReturnType<typeof createUserRepo>;
type CharacterService = ReturnType<typeof createCharacterService>;
type StoryService = ReturnType<typeof createStoryService>;

export function createCommands(
  userRepo: UserRepo,
  characterService: CharacterService,
  storyService: StoryService,
  mainMenu: Menu<MyContext>,
): Composer<MyContext> {
  const commands = new Composer<MyContext>();
  commands.use(createStartCommand(userRepo, characterService, storyService, mainMenu));
  commands.use(helpCommand);
  return commands;
}
