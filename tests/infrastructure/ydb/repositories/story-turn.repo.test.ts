import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock @ydbjs/query
const mockSql = jest.fn<(...args: any[]) => any>();
jest.unstable_mockModule("@ydbjs/query", () => ({
  query: jest.fn(() => mockSql),
}));

const { createStoryTurnRepo } = await import(
  "../../../../src/infrastructure/ydb/repositories/story-turn.repo.js"
);

describe("Story Turn Repository", () => {
  const mockDriver = {} as any;
  let repo: ReturnType<typeof createStoryTurnRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createStoryTurnRepo(mockDriver);
  });

  const sampleRow = {
    user_id: "user-1",
    session_id: "session-1",
    turn_number: 1,
    scene_text: "You enter a dark cave...",
    actions_json: JSON.stringify(["Explore", "Light torch", "Turn back"]),
    chosen_action: "Explore",
    created_at: new Date("2025-01-01"),
  };

  describe("upsert", () => {
    it("should upsert a turn record", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.upsert(
        "user-1",
        "session-1",
        1,
        "A scene description",
        ["Action 1", "Action 2"],
        null,
      );

      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });

  describe("findRecentTurns", () => {
    it("should return recent turns in chronological order", async () => {
      const rows = [
        { ...sampleRow, turn_number: 3, scene_text: "Scene 3" },
        { ...sampleRow, turn_number: 2, scene_text: "Scene 2" },
        { ...sampleRow, turn_number: 1, scene_text: "Scene 1" },
      ];
      mockSql.mockResolvedValueOnce([rows]);

      const result = await repo.findRecentTurns("user-1", "session-1", 10);

      // Should be reversed to chronological order
      expect(result).toHaveLength(3);
      expect(result[0]!.turnNumber).toBe(1);
      expect(result[1]!.turnNumber).toBe(2);
      expect(result[2]!.turnNumber).toBe(3);
    });

    it("should return empty array when no turns found", async () => {
      mockSql.mockResolvedValueOnce([[]] as any);

      const result = await repo.findRecentTurns("user-1", "session-1");

      expect(result).toEqual([]);
    });

    it("should return empty array when rows is undefined", async () => {
      mockSql.mockResolvedValueOnce([undefined] as any);

      const result = await repo.findRecentTurns("user-1", "session-1");

      expect(result).toEqual([]);
    });

    it("should parse actions JSON correctly", async () => {
      mockSql.mockResolvedValueOnce([[sampleRow]]);

      const result = await repo.findRecentTurns("user-1", "session-1", 1);

      expect(result[0]!.actionsJson).toEqual([
        "Explore",
        "Light torch",
        "Turn back",
      ]);
    });

    it("should handle malformed actions JSON gracefully", async () => {
      const badRow = { ...sampleRow, actions_json: "not valid json" };
      mockSql.mockResolvedValueOnce([[badRow]]);

      const result = await repo.findRecentTurns("user-1", "session-1", 1);

      expect(result[0]!.actionsJson).toEqual([]);
    });
  });

  describe("getLastTurnNumber", () => {
    it("should return the last turn number", async () => {
      mockSql.mockResolvedValueOnce([[{ turn_number: 5 }]]);

      const result = await repo.getLastTurnNumber("user-1", "session-1");

      expect(result).toBe(5);
    });

    it("should return 0 when no turns exist", async () => {
      mockSql.mockResolvedValueOnce([[]] as any);

      const result = await repo.getLastTurnNumber("user-1", "session-1");

      expect(result).toBe(0);
    });

    it("should return 0 when rows is undefined", async () => {
      mockSql.mockResolvedValueOnce([undefined] as any);

      const result = await repo.getLastTurnNumber("user-1", "session-1");

      expect(result).toBe(0);
    });
  });

  describe("updateChosenAction", () => {
    it("should update the chosen action for a turn", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.updateChosenAction("user-1", "session-1", 3, "Fight");

      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });

  describe("row transformation", () => {
    it("should correctly transform row to StoryTurn entity", async () => {
      mockSql.mockResolvedValueOnce([[sampleRow]]);

      const result = await repo.findRecentTurns("user-1", "session-1", 1);

      expect(result[0]).toEqual({
        userId: "user-1",
        sessionId: "session-1",
        turnNumber: 1,
        sceneText: "You enter a dark cave...",
        actionsJson: ["Explore", "Light torch", "Turn back"],
        chosenAction: "Explore",
        createdAt: new Date("2025-01-01"),
      });
    });
  });
});
