import { Composer } from "grammy";
import type { MyContext } from "../types.js";
import type { createCharacterService } from "../../domain/character/service.js";
import type { createStoryService } from "../../domain/story/service.js";
import { createMainMenu } from "./main-menu.js";
import type { Menu } from "@grammyjs/menu";

type CharacterService = ReturnType<typeof createCharacterService>;
type StoryService = ReturnType<typeof createStoryService>;

export function createMenus(
  characterService: CharacterService,
  storyService: StoryService,
): { composer: Composer<MyContext>; mainMenu: Menu<MyContext> } {
  const composer = new Composer<MyContext>();
  const mainMenu = createMainMenu(characterService, storyService);
  composer.use(mainMenu);
  return { composer, mainMenu };
}
