import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock AI service
const mockGenerateScene = jest.fn<(...args: any[]) => any>();
jest.unstable_mockModule("../../../src/domain/ai/service.js", () => ({
  generateScene: mockGenerateScene,
  AIServiceError: class AIServiceError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AIServiceError";
    }
  },
}));

// Mock crypto for deterministic UUIDs
jest.unstable_mockModule("node:crypto", () => ({
  randomUUID: jest.fn(() => "test-session-id"),
}));

const { createStoryService } = await import(
  "../../../src/domain/story/service.js"
);

describe("Story Service", () => {
  const mockSessionRepo = {
    upsert: jest.fn<(...args: any[]) => any>(),
    findActiveByUserId: jest.fn<(...args: any[]) => any>(),
    completeSession: jest.fn<(...args: any[]) => any>(),
    updateTimestamp: jest.fn<(...args: any[]) => any>(),
  };

  const mockTurnRepo = {
    upsert: jest.fn<(...args: any[]) => any>(),
    findRecentTurns: jest.fn<(...args: any[]) => any>(),
    getLastTurnNumber: jest.fn<(...args: any[]) => any>(),
    updateChosenAction: jest.fn<(...args: any[]) => any>(),
  };

  const mockCharacter = {
    id: "char-1",
    userId: "user-1",
    name: "Thorin",
    class: "warrior" as const,
    backstory: "A brave dwarf",
    stats: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
    isActive: true,
    createdAt: new Date(),
  };

  let service: ReturnType<typeof createStoryService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createStoryService(
      mockSessionRepo as any,
      mockTurnRepo as any,
    );
  });

  describe("startNewSession", () => {
    it("should create a session and generate the opening scene", async () => {
      const sceneResponse = {
        description: "You stand at the entrance of a dark cave...",
        actions: ["Enter the cave", "Look around", "Rest"],
      };
      mockGenerateScene.mockResolvedValueOnce(sceneResponse);

      const result = await service.startNewSession("user-1", mockCharacter);

      expect(result.session.id).toBe("test-session-id");
      expect(result.session.userId).toBe("user-1");
      expect(result.session.characterId).toBe("char-1");
      expect(result.session.status).toBe("active");
      expect(result.scene).toEqual(sceneResponse);

      expect(mockSessionRepo.upsert).toHaveBeenCalledWith(
        "user-1",
        "test-session-id",
        "char-1",
        "active",
      );
      expect(mockTurnRepo.upsert).toHaveBeenCalledWith(
        "user-1",
        "test-session-id",
        1,
        sceneResponse.description,
        sceneResponse.actions,
        null,
      );
      expect(mockGenerateScene).toHaveBeenCalledWith(
        expect.objectContaining({ isFirstScene: true }),
      );
    });
  });

  describe("generateNextScene", () => {
    it("should generate the next scene based on history", async () => {
      const recentTurns = [
        {
          userId: "user-1",
          sessionId: "session-1",
          turnNumber: 1,
          sceneText: "The cave entrance...",
          actionsJson: ["Enter", "Wait"],
          chosenAction: "Enter",
          createdAt: new Date(),
        },
      ];
      mockTurnRepo.findRecentTurns.mockResolvedValueOnce(recentTurns);
      mockTurnRepo.getLastTurnNumber.mockResolvedValueOnce(1);

      const nextScene = {
        description: "Deep inside the cave...",
        actions: ["Go left", "Go right"],
      };
      mockGenerateScene.mockResolvedValueOnce(nextScene);

      const result = await service.generateNextScene(
        "user-1",
        "session-1",
        mockCharacter,
      );

      expect(result).toEqual(nextScene);
      expect(mockGenerateScene).toHaveBeenCalledWith(
        expect.objectContaining({
          isFirstScene: false,
          history: [{ scene: "The cave entrance...", chosenAction: "Enter" }],
        }),
      );
      expect(mockTurnRepo.upsert).toHaveBeenCalledWith(
        "user-1",
        "session-1",
        2,
        nextScene.description,
        nextScene.actions,
        null,
      );
      expect(mockSessionRepo.updateTimestamp).toHaveBeenCalledWith(
        "user-1",
        "session-1",
      );
    });

    it("should filter out turns without chosen actions from history", async () => {
      const recentTurns = [
        {
          userId: "user-1",
          sessionId: "s1",
          turnNumber: 1,
          sceneText: "Scene 1",
          actionsJson: ["A", "B"],
          chosenAction: "A",
          createdAt: new Date(),
        },
        {
          userId: "user-1",
          sessionId: "s1",
          turnNumber: 2,
          sceneText: "Scene 2",
          actionsJson: ["C", "D"],
          chosenAction: null,
          createdAt: new Date(),
        },
      ];
      mockTurnRepo.findRecentTurns.mockResolvedValueOnce(recentTurns);
      mockTurnRepo.getLastTurnNumber.mockResolvedValueOnce(2);

      mockGenerateScene.mockResolvedValueOnce({
        description: "Next scene",
        actions: ["X", "Y"],
      });

      await service.generateNextScene("user-1", "s1", mockCharacter);

      const callArgs = mockGenerateScene.mock.calls[0]![0] as {
        history: Array<{ scene: string; chosenAction: string }>;
      };
      expect(callArgs.history).toHaveLength(1);
      expect(callArgs.history[0]!.chosenAction).toBe("A");
    });
  });

  describe("processActionChoice", () => {
    it("should save chosen action and return it", async () => {
      mockTurnRepo.getLastTurnNumber.mockResolvedValueOnce(3);
      mockTurnRepo.findRecentTurns.mockResolvedValueOnce([
        {
          userId: "user-1",
          sessionId: "s1",
          turnNumber: 3,
          sceneText: "Scene",
          actionsJson: ["Fight", "Flee", "Talk"],
          chosenAction: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.processActionChoice("user-1", "s1", 1);

      expect(result).toBe("Flee");
      expect(mockTurnRepo.updateChosenAction).toHaveBeenCalledWith(
        "user-1",
        "s1",
        3,
        "Flee",
      );
    });

    it("should return null when no turns exist (lastTurnNumber === 0)", async () => {
      mockTurnRepo.getLastTurnNumber.mockResolvedValueOnce(0);

      const result = await service.processActionChoice("user-1", "s1", 0);

      expect(result).toBeNull();
    });

    it("should return null when last turn is not found", async () => {
      mockTurnRepo.getLastTurnNumber.mockResolvedValueOnce(1);
      mockTurnRepo.findRecentTurns.mockResolvedValueOnce([]);

      const result = await service.processActionChoice("user-1", "s1", 0);

      expect(result).toBeNull();
    });

    it("should return null for invalid action index", async () => {
      mockTurnRepo.getLastTurnNumber.mockResolvedValueOnce(1);
      mockTurnRepo.findRecentTurns.mockResolvedValueOnce([
        {
          userId: "user-1",
          sessionId: "s1",
          turnNumber: 1,
          sceneText: "Scene",
          actionsJson: ["Fight", "Flee"],
          chosenAction: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.processActionChoice("user-1", "s1", 5);

      expect(result).toBeNull();
    });
  });

  describe("findActiveSession", () => {
    it("should return active session when found", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        characterId: "char-1",
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSessionRepo.findActiveByUserId.mockResolvedValueOnce(mockSession);

      const result = await service.findActiveSession("user-1");

      expect(result).toEqual(mockSession);
    });

    it("should return undefined when no active session", async () => {
      mockSessionRepo.findActiveByUserId.mockResolvedValueOnce(undefined);

      const result = await service.findActiveSession("user-1");

      expect(result).toBeUndefined();
    });
  });

  describe("completeSession", () => {
    it("should delegate to session repo", async () => {
      await service.completeSession("user-1", "session-1");

      expect(mockSessionRepo.completeSession).toHaveBeenCalledWith(
        "user-1",
        "session-1",
      );
    });
  });

  describe("resumeSession", () => {
    it("should return existing active session with last turn", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        characterId: "char-1",
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockTurn = {
        userId: "user-1",
        sessionId: "session-1",
        turnNumber: 3,
        sceneText: "Last scene",
        actionsJson: ["A", "B"],
        chosenAction: null,
        createdAt: new Date(),
      };
      mockSessionRepo.findActiveByUserId.mockResolvedValueOnce(mockSession);
      mockTurnRepo.findRecentTurns.mockResolvedValueOnce([mockTurn]);

      const result = await service.resumeSession("user-1", mockCharacter);

      expect(result.session).toEqual(mockSession);
      expect(result.lastTurn).toEqual(mockTurn);
    });

    it("should start new session when no active session exists", async () => {
      mockSessionRepo.findActiveByUserId.mockResolvedValueOnce(undefined);

      const sceneResponse = {
        description: "A new adventure begins...",
        actions: ["Go north", "Go south"],
      };
      mockGenerateScene.mockResolvedValueOnce(sceneResponse);

      const mockTurn = {
        userId: "user-1",
        sessionId: "test-session-id",
        turnNumber: 1,
        sceneText: "A new adventure begins...",
        actionsJson: ["Go north", "Go south"],
        chosenAction: null,
        createdAt: new Date(),
      };
      mockTurnRepo.findRecentTurns.mockResolvedValueOnce([mockTurn]);

      const result = await service.resumeSession("user-1", mockCharacter);

      expect(result.session.id).toBe("test-session-id");
      expect(result.lastTurn).toEqual(mockTurn);
      expect(mockSessionRepo.upsert).toHaveBeenCalled();
    });

    it("should return null lastTurn when active session has no turns", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        characterId: "char-1",
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSessionRepo.findActiveByUserId.mockResolvedValueOnce(mockSession);
      mockTurnRepo.findRecentTurns.mockResolvedValueOnce([]);

      const result = await service.resumeSession("user-1", mockCharacter);

      expect(result.session).toEqual(mockSession);
      expect(result.lastTurn).toBeNull();
    });
  });
});
