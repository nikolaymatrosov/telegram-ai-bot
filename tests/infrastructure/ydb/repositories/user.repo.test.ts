import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock @ydbjs/query
const mockSql = jest.fn<(...args: any[]) => any>();
jest.unstable_mockModule("@ydbjs/query", () => ({
  query: jest.fn(() => mockSql),
}));

const { createUserRepo } = await import(
  "../../../../src/infrastructure/ydb/repositories/user.repo.js"
);

describe("User Repository", () => {
  const mockDriver = {} as any;
  let repo: ReturnType<typeof createUserRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createUserRepo(mockDriver);
  });

  describe("findByTelegramId", () => {
    it("should return user record when found", async () => {
      const userRow = {
        user_id: "123",
        active_character_id: "char-1",
        created_at: new Date("2025-01-01"),
      };
      mockSql.mockResolvedValueOnce([[userRow]]);

      const result = await repo.findByTelegramId("123");

      expect(result).toEqual(userRow);
    });

    it("should return undefined when user not found", async () => {
      mockSql.mockResolvedValueOnce([[]] as any);

      const result = await repo.findByTelegramId("999");

      expect(result).toBeUndefined();
    });

    it("should return undefined when rows is undefined", async () => {
      mockSql.mockResolvedValueOnce([undefined] as any);

      const result = await repo.findByTelegramId("999");

      expect(result).toBeUndefined();
    });
  });

  describe("upsert", () => {
    it("should upsert with active character ID", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.upsert("123", "char-1");

      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it("should upsert without active character ID", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.upsert("123");

      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it("should upsert with null active character ID", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.upsert("123", null);

      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateActiveCharacter", () => {
    it("should update active character reference", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.updateActiveCharacter("123", "char-2");

      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it("should clear active character reference with null", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.updateActiveCharacter("123", null);

      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });
});
