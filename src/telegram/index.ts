import { Composer } from "grammy";
import { conversations } from "@grammyjs/conversations";
import type { Driver } from "@ydbjs/core";
import type { MyContext } from "./types.js";
import { createMiddleware } from "./middleware/index.js";
import { createMenus } from "./menu/index.js";
import { createConversations } from "./conversations/index.js";
import { createCommands } from "./commands/index.js";
import { createHandlers } from "./handlers/index.js";
import { createYdbConversationStorage } from "../infrastructure/ydb/storage-adapter.js";
import type { createUserRepo } from "../infrastructure/ydb/repositories/user.repo.js";
import type { createCharacterService } from "../domain/character/service.js";
import type { createStoryService } from "../domain/story/service.js";

type UserRepo = ReturnType<typeof createUserRepo>;
type CharacterService = ReturnType<typeof createCharacterService>;
type StoryService = ReturnType<typeof createStoryService>;

export function createTelegramLayer(
  driver: Driver,
  userRepo: UserRepo,
  characterService: CharacterService,
  storyService: StoryService,
): Composer<MyContext> {
  const telegram = new Composer<MyContext>();

  // Order matters: middleware → conversations plugin → menu → conversations → commands → handlers
  telegram.use(createMiddleware(driver));
  telegram.use(conversations<MyContext, MyContext>({
    storage: createYdbConversationStorage(driver),
  }));

  // Menu must be registered before commands per grammY docs
  const { composer: menuComposer, mainMenu } = createMenus(
    characterService,
    storyService,
  );
  telegram.use(menuComposer);
  telegram.use(createConversations());
  telegram.use(createCommands(userRepo, characterService, storyService, mainMenu));
  telegram.use(createHandlers(storyService, characterService));

  return telegram;
}
