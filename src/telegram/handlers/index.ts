import { Composer } from "grammy";
import type { MyContext } from "../types.js";
import type { createStoryService } from "../../domain/story/service.js";
import type { createCharacterService } from "../../domain/character/service.js";
import { createStoryActionHandler } from "./story-action.js";

type StoryService = ReturnType<typeof createStoryService>;
type CharacterService = ReturnType<typeof createCharacterService>;

export function createHandlers(
  storyService: StoryService,
  characterService: CharacterService,
): Composer<MyContext> {
  const handlers = new Composer<MyContext>();
  handlers.use(createStoryActionHandler(storyService, characterService));
  return handlers;
}
