import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockDeleteWebhook = jest.fn<(...args: any[]) => Promise<boolean>>();

jest.unstable_mockModule("grammy", () => ({
  Bot: class MockBot {
    api = {
      deleteWebhook: mockDeleteWebhook,
    };
    constructor(public token: string) {}
  },
}));

describe("delete-webhook script", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      BOT_TOKEN: "test-token",
    };
    mockDeleteWebhook.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should call deleteWebhook with drop_pending_updates: true", async () => {
    const { deleteWebhook } = await import(
      "../../../src/webhook/scripts/delete-webhook.js"
    );
    await deleteWebhook();

    expect(mockDeleteWebhook).toHaveBeenCalledWith({
      drop_pending_updates: true,
    });
  });

  it("should print confirmation after deletion", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const { deleteWebhook } = await import(
      "../../../src/webhook/scripts/delete-webhook.js"
    );
    await deleteWebhook();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("deleted"),
    );
    consoleSpy.mockRestore();
  });

  it("should throw error if BOT_TOKEN is missing", async () => {
    delete process.env.BOT_TOKEN;
    const { deleteWebhook } = await import(
      "../../../src/webhook/scripts/delete-webhook.js"
    );

    await expect(deleteWebhook()).rejects.toThrow("BOT_TOKEN");
  });
});
