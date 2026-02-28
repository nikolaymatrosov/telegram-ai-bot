import { Composer } from "grammy";
import { createConversation } from "@grammyjs/conversations";
import type { MyContext } from "../types.js";
import { characterCreation } from "./character-creation.js";

export function createConversations(): Composer<MyContext> {
  const composer = new Composer<MyContext>();
  composer.use(createConversation(characterCreation, "characterCreation"));
  return composer;
}
