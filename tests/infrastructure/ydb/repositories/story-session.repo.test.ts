import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock @ydbjs/query
const mockSql = jest.fn<(...args: any[]) => any>();
jest.unstable_mockModule("@ydbjs/query", () => ({
  query: jest.fn(() => mockSql),
}));

const { createStorySessionRepo } = await import(
  "../../../../src/infrastructure/ydb/repositories/story-session.repo.js"
);

describe("Story Session Repository", () => {
  const mockDriver = {} as any;
  let repo: ReturnType<typeof createStorySessionRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createStorySessionRepo(mockDriver);
  });

  const sampleRow = {
    session_id: "session-1",
    user_id: "user-1",
    character_id: "char-1",
    status: "active",
    created_at: new Date("2025-01-01"),
    updated_at: new Date("2025-01-02"),
  };

  describe("upsert", () => {
    it("should upsert a session record", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.upsert("user-1", "session-1", "char-1", "active");

      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });

  describe("findActiveByUserId", () => {
    it("should return active session when found", async () => {
      mockSql.mockResolvedValueOnce([[sampleRow]]);

      const result = await repo.findActiveByUserId("user-1");

      expect(result).toBeDefined();
      expect(result!.id).toBe("session-1");
      expect(result!.userId).toBe("user-1");
      expect(result!.characterId).toBe("char-1");
      expect(result!.status).toBe("active");
    });

    it("should return undefined when no active session", async () => {
      mockSql.mockResolvedValueOnce([[]] as any);

      const result = await repo.findActiveByUserId("user-1");

      expect(result).toBeUndefined();
    });

    it("should return undefined when rows is undefined", async () => {
      mockSql.mockResolvedValueOnce([undefined] as any);

      const result = await repo.findActiveByUserId("user-1");

      expect(result).toBeUndefined();
    });
  });

  describe("completeSession", () => {
    it("should mark session as completed", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.completeSession("user-1", "session-1");

      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateTimestamp", () => {
    it("should update session timestamp", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.updateTimestamp("user-1", "session-1");

      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });

  describe("row transformation", () => {
    it("should correctly transform row to StorySession entity", async () => {
      mockSql.mockResolvedValueOnce([[sampleRow]]);

      const result = await repo.findActiveByUserId("user-1");

      expect(result).toEqual({
        id: "session-1",
        userId: "user-1",
        characterId: "char-1",
        status: "active",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
      });
    });
  });
});
