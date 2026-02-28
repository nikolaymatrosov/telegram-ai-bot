import { Context, SessionFlavor } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";

export interface AppSessionData {
  activeCharacterId?: string;
  activeStorySessionId?: string;
}

export type MyContext = ConversationFlavor<
  Context & SessionFlavor<AppSessionData>
>;
