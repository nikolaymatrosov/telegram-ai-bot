import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock @ydbjs/query
const mockSql = jest.fn<(...args: any[]) => any>();
jest.unstable_mockModule("@ydbjs/query", () => ({
  query: jest.fn(() => mockSql),
}));

const { createYdbStorageAdapter, createYdbConversationStorage } = await import(
  "../../../src/infrastructure/ydb/storage-adapter.js"
);

describe("YDB Storage Adapter", () => {
  const mockDriver = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createYdbStorageAdapter", () => {
    let adapter: ReturnType<typeof createYdbStorageAdapter>;

    beforeEach(() => {
      adapter = createYdbStorageAdapter(mockDriver);
    });

    describe("read", () => {
      it("should return parsed data when key exists", async () => {
        const storedData = { activeCharacterId: "char-1" };
        mockSql.mockResolvedValueOnce([
          [{ data: JSON.stringify(storedData) }],
        ]);

        const result = await adapter.read("session:123");

        expect(result).toEqual(storedData);
      });

      it("should return undefined when key not found", async () => {
        mockSql.mockResolvedValueOnce([[]] as any);

        const result = await adapter.read("session:unknown");

        expect(result).toBeUndefined();
      });

      it("should return undefined when rows is undefined", async () => {
        mockSql.mockResolvedValueOnce([undefined] as any);

        const result = await adapter.read("session:unknown");

        expect(result).toBeUndefined();
      });
    });

    describe("write", () => {
      it("should write serialized data", async () => {
        mockSql.mockResolvedValueOnce(undefined);

        await adapter.write("session:123", { activeCharacterId: "char-2" });

        expect(mockSql).toHaveBeenCalledTimes(1);
      });
    });

    describe("delete", () => {
      it("should delete the key", async () => {
        mockSql.mockResolvedValueOnce(undefined);

        await adapter.delete("session:123");

        expect(mockSql).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("createYdbConversationStorage", () => {
    let storage: ReturnType<typeof createYdbConversationStorage>;

    beforeEach(() => {
      storage = createYdbConversationStorage(mockDriver);
    });

    describe("read", () => {
      it("should read with conv: prefix and return versioned state", async () => {
        const versionedState = { version: 1, state: { step: "name" } };
        mockSql.mockResolvedValueOnce([
          [{ data: JSON.stringify(versionedState) }],
        ]);

        const result = await storage.read("conv-key-123");

        expect(result).toEqual(versionedState);
      });

      it("should return undefined when conversation not found", async () => {
        mockSql.mockResolvedValueOnce([[]] as any);

        const result = await storage.read("conv-key-unknown");

        expect(result).toBeUndefined();
      });
    });

    describe("write", () => {
      it("should write versioned state with conv: prefix", async () => {
        mockSql.mockResolvedValueOnce(undefined);

        await storage.write("conv-key-123", {
          version: 2,
          state: { step: "class" },
        } as any);

        expect(mockSql).toHaveBeenCalledTimes(1);
      });
    });

    describe("delete", () => {
      it("should delete with conv: prefix", async () => {
        mockSql.mockResolvedValueOnce(undefined);

        await storage.delete("conv-key-123");

        expect(mockSql).toHaveBeenCalledTimes(1);
      });
    });
  });
});
