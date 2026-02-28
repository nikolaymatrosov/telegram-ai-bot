import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock @ydbjs/query
const mockSql = jest.fn<(...args: any[]) => any>();
jest.unstable_mockModule("@ydbjs/query", () => ({
  query: jest.fn(() => mockSql),
}));

const { createCharacterRepo } = await import(
  "../../../../src/infrastructure/ydb/repositories/character.repo.js"
);

describe("Character Repository", () => {
  const mockDriver = {} as any;
  let repo: ReturnType<typeof createCharacterRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createCharacterRepo(mockDriver);
  });

  const sampleRow = {
    character_id: "char-1",
    user_id: "user-1",
    name: "Thorin",
    class: "warrior",
    backstory: "A mighty dwarf warrior",
    str: 16,
    dex: 10,
    con: 14,
    int: 8,
    wis: 12,
    cha: 10,
    is_active: true,
    created_at: new Date("2025-01-01"),
  };

  describe("upsert", () => {
    it("should upsert a character record", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      await repo.upsert(
        "user-1",
        "char-1",
        "Thorin",
        "warrior",
        "A mighty dwarf warrior",
        { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
        true,
      );

      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });

  describe("findActiveByUserId", () => {
    it("should return active character when found", async () => {
      mockSql.mockResolvedValueOnce([[sampleRow]]);

      const result = await repo.findActiveByUserId("user-1");

      expect(result).toBeDefined();
      expect(result!.id).toBe("char-1");
      expect(result!.userId).toBe("user-1");
      expect(result!.name).toBe("Thorin");
      expect(result!.class).toBe("warrior");
      expect(result!.stats.str).toBe(16);
      expect(result!.isActive).toBe(true);
    });

    it("should return undefined when no active character", async () => {
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

  describe("findById", () => {
    it("should return character when found", async () => {
      mockSql.mockResolvedValueOnce([[sampleRow]]);

      const result = await repo.findById("user-1", "char-1");

      expect(result).toBeDefined();
      expect(result!.id).toBe("char-1");
      expect(result!.name).toBe("Thorin");
    });

    it("should return undefined when character not found", async () => {
      mockSql.mockResolvedValueOnce([[]] as any);

      const result = await repo.findById("user-1", "nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("archiveByUserId", () => {
    it("should archive active characters", async () => {
      // First call finds active characters
      mockSql.mockResolvedValueOnce([[{ character_id: "char-1" }]]);
      // Second call updates the character
      mockSql.mockResolvedValueOnce(undefined);

      await repo.archiveByUserId("user-1");

      expect(mockSql).toHaveBeenCalledTimes(2);
    });

    it("should do nothing when no active characters found", async () => {
      mockSql.mockResolvedValueOnce([[]] as any);

      await repo.archiveByUserId("user-1");

      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it("should archive multiple active characters", async () => {
      mockSql.mockResolvedValueOnce([
        [{ character_id: "char-1" }, { character_id: "char-2" }],
      ]);
      mockSql.mockResolvedValueOnce(undefined);
      mockSql.mockResolvedValueOnce(undefined);

      await repo.archiveByUserId("user-1");

      // 1 find + 2 updates
      expect(mockSql).toHaveBeenCalledTimes(3);
    });
  });

  describe("row-to-entity transformation", () => {
    it("should correctly transform database row to Character entity", async () => {
      mockSql.mockResolvedValueOnce([[sampleRow]]);

      const result = await repo.findById("user-1", "char-1");

      expect(result).toEqual({
        id: "char-1",
        userId: "user-1",
        name: "Thorin",
        class: "warrior",
        backstory: "A mighty dwarf warrior",
        stats: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
        isActive: true,
        createdAt: new Date("2025-01-01"),
      });
    });
  });
});
