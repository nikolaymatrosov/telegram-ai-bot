import { randomUUID } from "node:crypto";
import type { StorySession, StoryTurn } from "./types.js";
import type { Character } from "../character/types.js";
import { generateScene } from "../ai/service.js";
import type { SceneResponse } from "../ai/types.js";
import type { createStorySessionRepo } from "../../infrastructure/ydb/repositories/story-session.repo.js";
import type { createStoryTurnRepo } from "../../infrastructure/ydb/repositories/story-turn.repo.js";

type StorySessionRepo = ReturnType<typeof createStorySessionRepo>;
type StoryTurnRepo = ReturnType<typeof createStoryTurnRepo>;

export function createStoryService(
  sessionRepo: StorySessionRepo,
  turnRepo: StoryTurnRepo,
) {
  return {
    async startNewSession(
      userId: string,
      character: Character,
    ): Promise<{ session: StorySession; scene: SceneResponse }> {
      const sessionId = randomUUID();

      await sessionRepo.upsert(userId, sessionId, character.id, "active");

      const scene = await generateScene({
        character: {
          name: character.name,
          class: character.class,
          backstory: character.backstory,
          stats: character.stats,
        },
        history: [],
        isFirstScene: true,
      });

      // Save the opening turn
      await turnRepo.upsert(
        userId,
        sessionId,
        1,
        scene.description,
        scene.actions,
        null,
      );

      const session: StorySession = {
        id: sessionId,
        userId,
        characterId: character.id,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return { session, scene };
    },

    async generateNextScene(
      userId: string,
      sessionId: string,
      character: Character,
    ): Promise<SceneResponse> {
      // Load recent turns for context
      const recentTurns = await turnRepo.findRecentTurns(userId, sessionId, 10);

      const history = recentTurns
        .filter((t) => t.chosenAction !== null)
        .map((t) => ({
          scene: t.sceneText,
          chosenAction: t.chosenAction!,
        }));

      const scene = await generateScene({
        character: {
          name: character.name,
          class: character.class,
          backstory: character.backstory,
          stats: character.stats,
        },
        history,
        isFirstScene: false,
      });

      // Save new turn
      const lastTurnNumber = await turnRepo.getLastTurnNumber(userId, sessionId);
      await turnRepo.upsert(
        userId,
        sessionId,
        lastTurnNumber + 1,
        scene.description,
        scene.actions,
        null,
      );

      // Update session timestamp
      await sessionRepo.updateTimestamp(userId, sessionId);

      return scene;
    },

    async processActionChoice(
      userId: string,
      sessionId: string,
      actionIndex: number,
    ): Promise<string | null> {
      const lastTurnNumber = await turnRepo.getLastTurnNumber(userId, sessionId);
      if (lastTurnNumber === 0) return null;

      const recentTurns = await turnRepo.findRecentTurns(userId, sessionId, 1);
      const lastTurn = recentTurns[recentTurns.length - 1];
      if (!lastTurn) return null;

      const chosenAction = lastTurn.actionsJson[actionIndex];
      if (!chosenAction) return null;

      await turnRepo.updateChosenAction(
        userId,
        sessionId,
        lastTurnNumber,
        chosenAction,
      );

      return chosenAction;
    },

    async findActiveSession(userId: string): Promise<StorySession | undefined> {
      return sessionRepo.findActiveByUserId(userId);
    },

    async completeSession(userId: string, sessionId: string): Promise<void> {
      await sessionRepo.completeSession(userId, sessionId);
    },

    async resumeSession(
      userId: string,
      character: Character,
    ): Promise<{ session: StorySession; lastTurn: StoryTurn | null }> {
      const activeSession = await sessionRepo.findActiveByUserId(userId);

      if (activeSession) {
        const recentTurns = await turnRepo.findRecentTurns(
          userId,
          activeSession.id,
          1,
        );
        const lastTurn = recentTurns[recentTurns.length - 1] ?? null;
        return { session: activeSession, lastTurn };
      }

      // No active session — start a new one
      const { session } = await this.startNewSession(userId, character);
      const recentTurns = await turnRepo.findRecentTurns(userId, session.id, 1);
      return { session, lastTurn: recentTurns[0] ?? null };
    },
  };
}
