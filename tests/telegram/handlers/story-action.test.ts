import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock grammy
jest.unstable_mockModule("grammy", () => ({
  Composer: class MockComposer {
    private handler: ((ctx: any) => Promise<void>) | null = null;
    callbackQuery(_pattern: RegExp, handler: (ctx: any) => Promise<void>) {
      this.handler = handler;
    }
    async triggerCallback(ctx: any) {
      await this.handler!(ctx);
    }
  },
  InlineKeyboard: class MockInlineKeyboard {
    private buttons: Array<{ text: string; data: string }> = [];
    text(label: string, data: string) {
      this.buttons.push({ text: label, data });
      return this;
    }
    row() {
      return this;
    }
  },
}));

const { createStoryActionHandler } = await import(
  "../../../src/telegram/handlers/story-action.js"
);

describe("Story Action Handler", () => {
  const mockStoryService = {
    startNewSession: jest.fn<(...args: any[]) => any>(),
    generateNextScene: jest.fn<(...args: any[]) => any>(),
    processActionChoice: jest.fn<(...args: any[]) => any>(),
    findActiveSession: jest.fn<(...args: any[]) => any>(),
    completeSession: jest.fn<(...args: any[]) => any>(),
    resumeSession: jest.fn<(...args: any[]) => any>(),
  };

  const mockCharacterService = {
    createCharacter: jest.fn<(...args: any[]) => any>(),
    getActiveCharacter: jest.fn<(...args: any[]) => any>(),
    archiveCharacter: jest.fn<(...args: any[]) => any>(),
    generateStats: jest.fn<(...args: any[]) => any>(),
  };

  let handler: any;

  const createMockCtx = (actionIndex: number) => ({
    from: { id: 12345 },
    match: [null, String(actionIndex)],
    answerCallbackQuery: jest.fn<(...args: any[]) => any>(),
    reply: jest.fn<(...args: any[]) => any>(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    handler = createStoryActionHandler(
      mockStoryService as any,
      mockCharacterService as any,
    );
  });

  it("should process valid action and generate next scene", async () => {
    const ctx = createMockCtx(1);

    const mockSession = {
      id: "session-1",
      userId: "12345",
      characterId: "char-1",
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
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
    const mockScene = {
      description: "You continue deeper...",
      actions: ["Fight the dragon", "Retreat"],
    };

    mockStoryService.findActiveSession.mockResolvedValueOnce(mockSession);
    mockCharacterService.getActiveCharacter.mockResolvedValueOnce(
      mockCharacter,
    );
    mockStoryService.processActionChoice.mockResolvedValueOnce("Flee");
    mockStoryService.generateNextScene.mockResolvedValueOnce(mockScene);

    await handler.triggerCallback(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(mockStoryService.findActiveSession).toHaveBeenCalledWith("12345");
    expect(mockCharacterService.getActiveCharacter).toHaveBeenCalledWith(
      "12345",
    );
    expect(mockStoryService.processActionChoice).toHaveBeenCalledWith(
      "12345",
      "session-1",
      1,
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      "You continue deeper...",
      expect.objectContaining({ reply_markup: expect.anything() }),
    );
  });

  it("should reply with no active adventure when no session", async () => {
    const ctx = createMockCtx(0);
    mockStoryService.findActiveSession.mockResolvedValueOnce(undefined);

    await handler.triggerCallback(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("No active adventure"),
    );
  });

  it("should reply with no active character when character not found", async () => {
    const ctx = createMockCtx(0);
    mockStoryService.findActiveSession.mockResolvedValueOnce({
      id: "session-1",
    });
    mockCharacterService.getActiveCharacter.mockResolvedValueOnce(undefined);

    await handler.triggerCallback(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("No active character"),
    );
  });

  it("should reply with invalid action when processActionChoice returns null", async () => {
    const ctx = createMockCtx(99);
    mockStoryService.findActiveSession.mockResolvedValueOnce({
      id: "session-1",
    });
    mockCharacterService.getActiveCharacter.mockResolvedValueOnce({
      id: "char-1",
    });
    mockStoryService.processActionChoice.mockResolvedValueOnce(null);

    await handler.triggerCallback(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Invalid action"),
    );
  });

  it("should handle scene generation failure gracefully", async () => {
    const ctx = createMockCtx(0);
    mockStoryService.findActiveSession.mockResolvedValueOnce({
      id: "session-1",
    });
    mockCharacterService.getActiveCharacter.mockResolvedValueOnce({
      id: "char-1",
      name: "Thorin",
      class: "warrior",
      backstory: "A warrior",
      stats: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
    });
    mockStoryService.processActionChoice.mockResolvedValueOnce("Fight");
    mockStoryService.generateNextScene.mockRejectedValueOnce(
      new Error("AI down"),
    );

    // Suppress console.error for this test
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await handler.triggerCallback(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("DM is taking a short break"),
    );
    consoleError.mockRestore();
  });

  it("should call answerCallbackQuery before processing", async () => {
    const ctx = createMockCtx(0);
    mockStoryService.findActiveSession.mockResolvedValueOnce(undefined);

    await handler.triggerCallback(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
