import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock grammy
jest.unstable_mockModule("grammy", () => {
  let registeredHandler: ((ctx: any) => Promise<void>) | null = null;

  class MockComposer {
    command(_name: string, handler: (ctx: any) => Promise<void>) {
      registeredHandler = handler;
    }
  }

  return {
    Composer: MockComposer,
    __getHandler: () => registeredHandler,
  };
});

const grammy = await import("grammy");
// Re-import to trigger the module-level code that creates the composer
await import("../../../src/telegram/commands/help.js");

describe("/help command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reply with help message containing commands and instructions", async () => {
    const handler = (grammy as any).__getHandler();
    expect(handler).toBeDefined();

    const mockCtx = {
      reply: jest.fn<(...args: any[]) => any>(),
    };

    await handler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);

    const replyText = mockCtx.reply.mock.calls[0]![0] as string;
    expect(replyText).toContain("Dungeon Master Bot");
    expect(replyText).toContain("/start");
    expect(replyText).toContain("/help");
    expect(replyText).toContain("How to play");

    const options = mockCtx.reply.mock.calls[0]![1] as { parse_mode: string };
    expect(options.parse_mode).toBe("Markdown");
  });
});
