import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockSetWebhook = jest.fn<(...args: any[]) => Promise<boolean>>();
const mockGetWebhookInfo = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule("grammy", () => ({
  Bot: class MockBot {
    api = {
      setWebhook: mockSetWebhook,
      getWebhookInfo: mockGetWebhookInfo,
    };
    constructor(public token: string) {}
  },
}));

describe("set-webhook script", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      BOT_TOKEN: "test-token",
      WEBHOOK_URL: "https://example.com/webhook",
      WEBHOOK_SECRET: "test-secret",
    };
    mockSetWebhook.mockResolvedValue(true);
    mockGetWebhookInfo.mockResolvedValue({
      url: "https://example.com/webhook",
      has_custom_certificate: false,
      pending_update_count: 0,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should call setWebhook with correct URL, secret_token, allowed_updates, and drop_pending_updates", async () => {
    const { setWebhook } = await import(
      "../../../src/webhook/scripts/set-webhook.js"
    );
    await setWebhook();

    expect(mockSetWebhook).toHaveBeenCalledWith(
      "https://example.com/webhook",
      {
        secret_token: "test-secret",
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      },
    );
  });

  it("should print webhook info after registration", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const { setWebhook } = await import(
      "../../../src/webhook/scripts/set-webhook.js"
    );
    await setWebhook();

    expect(mockGetWebhookInfo).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Webhook info:",
      expect.objectContaining({ url: "https://example.com/webhook" }),
    );
    consoleSpy.mockRestore();
  });

  it("should throw error if BOT_TOKEN is missing", async () => {
    delete process.env.BOT_TOKEN;
    const { setWebhook } = await import(
      "../../../src/webhook/scripts/set-webhook.js"
    );

    await expect(setWebhook()).rejects.toThrow("BOT_TOKEN");
  });

  it("should throw error if WEBHOOK_URL is missing", async () => {
    delete process.env.WEBHOOK_URL;
    const { setWebhook } = await import(
      "../../../src/webhook/scripts/set-webhook.js"
    );

    await expect(setWebhook()).rejects.toThrow("WEBHOOK_URL");
  });
});
