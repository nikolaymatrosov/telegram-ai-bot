import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock grammy
jest.unstable_mockModule("grammy", () => ({
  Composer: class MockComposer {
    private handlers: Record<string, (ctx: any) => Promise<void>> = {};
    command(name: string, handler: (ctx: any) => Promise<void>) {
      this.handlers[name] = handler;
    }
    async triggerCommand(name: string, ctx: any) {
      await this.handlers[name]!(ctx);
    }
  },
}));

const { createStartCommand } = await import(
  "../../../src/telegram/commands/start.js"
);

describe("/start command", () => {
  const mockUserRepo = {
    findByTelegramId: jest.fn<(...args: any[]) => any>(),
    upsert: jest.fn<(...args: any[]) => any>(),
    updateActiveCharacter: jest.fn<(...args: any[]) => any>(),
  };

  const mockCharacterService = {
    createCharacter: jest.fn<(...args: any[]) => any>(),
    getActiveCharacter: jest.fn<(...args: any[]) => any>(),
    archiveCharacter: jest.fn<(...args: any[]) => any>(),
    generateStats: jest.fn<(...args: any[]) => any>(),
  };

  const mockStoryService = {
    startNewSession: jest.fn<(...args: any[]) => any>(),
    generateNextScene: jest.fn<(...args: any[]) => any>(),
    processActionChoice: jest.fn<(...args: any[]) => any>(),
    findActiveSession: jest.fn<(...args: any[]) => any>(),
    completeSession: jest.fn<(...args: any[]) => any>(),
    resumeSession: jest.fn<(...args: any[]) => any>(),
  };

  const mockMenu = {} as any;
  let composer: any;

  const createMockCtx = (userId?: number) => ({
    from: userId !== undefined ? { id: userId } : undefined,
    reply: jest.fn<(...args: any[]) => any>(),
    conversation: {
      enter: jest.fn<(...args: any[]) => any>(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    composer = createStartCommand(
      mockUserRepo as any,
      mockCharacterService as any,
      mockStoryService as any,
      mockMenu,
    );
  });

  it("should upsert user and show welcome back for returning user with character", async () => {
    const ctx = createMockCtx(12345);
    const mockCharacter = {
      id: "char-1",
      userId: "12345",
      name: "Thorin",
      class: "warrior",
      backstory: "A warrior",
      stats: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
      isActive: true,
      createdAt: new Date(),
    };
    mockCharacterService.getActiveCharacter.mockResolvedValueOnce(
      mockCharacter,
    );

    await composer.triggerCommand("start", ctx);

    expect(mockUserRepo.upsert).toHaveBeenCalledWith("12345");
    expect(mockCharacterService.getActiveCharacter).toHaveBeenCalledWith(
      "12345",
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Thorin"),
      expect.objectContaining({ parse_mode: "Markdown" }),
    );
  });

  it("should enter character creation for new user without character", async () => {
    const ctx = createMockCtx(12345);
    mockCharacterService.getActiveCharacter.mockResolvedValueOnce(undefined);

    await composer.triggerCommand("start", ctx);

    expect(mockUserRepo.upsert).toHaveBeenCalledWith("12345");
    expect(ctx.conversation.enter).toHaveBeenCalledWith("characterCreation");
  });

  it("should do nothing when ctx.from is undefined", async () => {
    const ctx = createMockCtx();

    await composer.triggerCommand("start", ctx);

    expect(mockUserRepo.upsert).not.toHaveBeenCalled();
  });
});
