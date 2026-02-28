import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const { errorMiddleware } = await import(
  "../../../src/telegram/middleware/error.js"
);

describe("Error Middleware", () => {
  const createMockCtx = () => ({
    update: { update_id: 42 },
    reply: jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should pass through when no error occurs", async () => {
    const ctx = createMockCtx();
    const next = jest.fn<() => Promise<void>>().mockResolvedValueOnce(
      undefined,
    );

    await errorMiddleware(ctx as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("should catch errors thrown by downstream and notify user", async () => {
    const ctx = createMockCtx();
    const next = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Something broke"));

    // Suppress console.error for this test
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await errorMiddleware(ctx as any, next);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Something went wrong"),
    );
    consoleError.mockRestore();
  });

  it("should not re-throw the error", async () => {
    const ctx = createMockCtx();
    const next = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Failure"));

    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Should not throw
    await expect(
      errorMiddleware(ctx as any, next),
    ).resolves.toBeUndefined();

    consoleError.mockRestore();
  });

  it("should handle reply failure gracefully", async () => {
    const ctx = createMockCtx();
    ctx.reply.mockRejectedValueOnce(new Error("Reply failed"));
    const next = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Failure"));

    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Should not throw even if reply fails
    await expect(
      errorMiddleware(ctx as any, next),
    ).resolves.toBeUndefined();

    consoleError.mockRestore();
  });

  it("should contain error message text about trying again or /start", async () => {
    const ctx = createMockCtx();
    const next = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("DB error"));

    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await errorMiddleware(ctx as any, next);

    const replyText = ctx.reply.mock.calls[0]![0] as string;
    expect(replyText).toContain("try again");
    expect(replyText).toContain("/start");

    consoleError.mockRestore();
  });
});
