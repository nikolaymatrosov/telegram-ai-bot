import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock AI service
const mockGenerateCharacterStats = jest.fn<(...args: any[]) => any>();
jest.unstable_mockModule("../../../src/domain/ai/service.js", () => ({
  generateCharacterStats: mockGenerateCharacterStats,
}));

// Mock crypto for deterministic UUIDs
jest.unstable_mockModule("node:crypto", () => ({
  randomUUID: jest.fn(() => "test-character-id"),
}));

const { createCharacterService } = await import(
  "../../../src/domain/character/service.js"
);

describe("Character Service", () => {
  const mockCharRepo = {
    upsert: jest.fn<(...args: any[]) => any>(),
    findActiveByUserId: jest.fn<(...args: any[]) => any>(),
    findById: jest.fn<(...args: any[]) => any>(),
    archiveByUserId: jest.fn<(...args: any[]) => any>(),
  };

  const mockUserRepo = {
    findByTelegramId: jest.fn<(...args: any[]) => any>(),
    upsert: jest.fn<(...args: any[]) => any>(),
    updateActiveCharacter: jest.fn<(...args: any[]) => any>(),
  };

  let service: ReturnType<typeof createCharacterService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createCharacterService(mockCharRepo as any, mockUserRepo as any);
  });

  describe("createCharacter", () => {
    it("should create a character and update user on happy path", async () => {
      const result = await service.createCharacter(
        "user-1",
        "Thorin",
        "warrior",
        "A mighty warrior from the north",
        { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
      );

      expect(result.id).toBe("test-character-id");
      expect(result.userId).toBe("user-1");
      expect(result.name).toBe("Thorin");
      expect(result.class).toBe("warrior");
      expect(result.backstory).toBe("A mighty warrior from the north");
      expect(result.stats.str).toBe(16);
      expect(result.isActive).toBe(true);

      expect(mockCharRepo.upsert).toHaveBeenCalledWith(
        "user-1",
        "test-character-id",
        "Thorin",
        "warrior",
        "A mighty warrior from the north",
        { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
        true,
      );

      expect(mockUserRepo.upsert).toHaveBeenCalledWith(
        "user-1",
        "test-character-id",
      );
    });

    it("should handle empty name", async () => {
      const result = await service.createCharacter(
        "user-1",
        "",
        "mage",
        "A mysterious mage",
        { str: 6, dex: 10, con: 8, int: 18, wis: 16, cha: 12 },
      );

      expect(result.name).toBe("");
      expect(mockCharRepo.upsert).toHaveBeenCalled();
    });

    it("should handle max-length name (50 chars)", async () => {
      const longName = "A".repeat(50);
      const result = await service.createCharacter(
        "user-1",
        longName,
        "rogue",
        "Backstory",
        { str: 10, dex: 16, con: 10, int: 12, wis: 10, cha: 14 },
      );

      expect(result.name).toBe(longName);
    });

    it("should handle long backstory (2000 chars)", async () => {
      const longBackstory = "B".repeat(2000);
      const result = await service.createCharacter(
        "user-1",
        "Char",
        "healer",
        longBackstory,
        { str: 8, dex: 10, con: 12, int: 14, wis: 18, cha: 16 },
      );

      expect(result.backstory).toBe(longBackstory);
    });
  });

  describe("getActiveCharacter", () => {
    it("should return character when found", async () => {
      const mockCharacter = {
        id: "char-1",
        userId: "user-1",
        name: "Thorin",
        class: "warrior" as const,
        backstory: "Backstory",
        stats: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
        isActive: true,
        createdAt: new Date(),
      };
      mockCharRepo.findActiveByUserId.mockResolvedValueOnce(mockCharacter);

      const result = await service.getActiveCharacter("user-1");

      expect(result).toEqual(mockCharacter);
      expect(mockCharRepo.findActiveByUserId).toHaveBeenCalledWith("user-1");
    });

    it("should return undefined when no active character", async () => {
      mockCharRepo.findActiveByUserId.mockResolvedValueOnce(undefined);

      const result = await service.getActiveCharacter("user-1");

      expect(result).toBeUndefined();
    });
  });

  describe("archiveCharacter", () => {
    it("should archive character and clear active reference", async () => {
      await service.archiveCharacter("user-1");

      expect(mockCharRepo.archiveByUserId).toHaveBeenCalledWith("user-1");
      expect(mockUserRepo.updateActiveCharacter).toHaveBeenCalledWith(
        "user-1",
        null,
      );
    });
  });

  describe("generateStats", () => {
    it("should delegate to AI service", async () => {
      const expectedStats = {
        str: 14,
        dex: 12,
        con: 13,
        int: 10,
        wis: 8,
        cha: 11,
      };
      mockGenerateCharacterStats.mockResolvedValueOnce(expectedStats);

      const result = await service.generateStats("warrior", "A backstory");

      expect(result).toEqual(expectedStats);
      expect(mockGenerateCharacterStats).toHaveBeenCalledWith({
        characterClass: "warrior",
        backstory: "A backstory",
      });
    });
  });
});
