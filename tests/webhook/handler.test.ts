import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { YcfEvent, YcfContext, YcfResponse } from "../../src/webhook/types.js";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";
const TEST_SECRET = "test-webhook-secret";

// Mock config
jest.unstable_mockModule("../../src/config/index.js", () => ({
  config: {
    botToken: "test-token",
    openaiApiKey: "test-key",
    ydbEndpoint: "grpc://localhost:2136",
    ydbDatabase: "/local",
    webhookSecret: TEST_SECRET,
    botInfo: {
      id: 123,
      is_bot: true,
      first_name: "TestBot",
      username: "test_bot",
    },
  },
}));

// Mock the dedup query functions
const mockCheckProcessed = jest.fn<(updateId: number) => Promise<boolean>>();
const mockMarkProcessed = jest.fn<(updateId: number) => Promise<void>>();

jest.unstable_mockModule("../../src/webhook/dedup.js", () => ({
  createDedupChecker: () => ({
    checkProcessed: mockCheckProcessed,
    markProcessed: mockMarkProcessed,
  }),
}));

// Mock the YDB driver
const mockDriver = {} as any;
jest.unstable_mockModule("../../src/infrastructure/ydb/driver.js", () => ({
  getDriver: jest.fn<() => Promise<any>>().mockResolvedValue(mockDriver),
  destroyDriver: jest.fn<() => Promise<void>>(),
}));

// Mock createBot to return a minimal bot that we can control
const mockHandleUpdate = jest.fn<(...args: any[]) => Promise<void>>();
const mockInit = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("../../src/create-bot.js", () => ({
  createBot: () => ({
    handleUpdate: mockHandleUpdate,
    init: mockInit,
    botInfo: {
      id: 123,
      is_bot: true,
      first_name: "TestBot",
      username: "test_bot",
    },
    token: "test-token",
    isInited: () => true,
    use: jest.fn(),
    catch: jest.fn(),
    errorHandler: () => {},
    on: jest.fn(),
    api: { config: { use: jest.fn() } },
    middleware: jest.fn().mockReturnValue(() => Promise.resolve()),
  }),
}));

// Mock grammy webhookCallback
const mockWebhookHandler = jest.fn<(event: YcfEvent, context: YcfContext) => Promise<YcfResponse>>();
jest.unstable_mockModule("grammy", () => {
  const actual = jest.requireActual<typeof import("grammy")>("grammy");
  return {
    ...actual,
    webhookCallback: () => mockWebhookHandler,
  };
});

function createEvent(overrides?: Partial<YcfEvent>): YcfEvent {
  return {
    httpMethod: "POST",
    headers: {
      "content-type": "application/json",
      [SECRET_HEADER]: TEST_SECRET,
    },
    body: JSON.stringify({
      update_id: 100,
      message: {
        message_id: 1,
        from: { id: 42, is_bot: false, first_name: "Test" },
        chat: { id: 42, type: "private" },
        date: 1234567890,
        text: "/start",
      },
    }),
    ...overrides,
  };
}

const dummyContext: YcfContext = {
  functionName: "webhook-handler",
  functionVersion: "1",
  memoryLimitInMB: 256,
  requestId: "req-123",
  logGroupName: "log-group",
};

// Import handler after all mocks are set up
const { handler } = await import("../../src/handler.js");

describe("webhook handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckProcessed.mockResolvedValue(false);
    mockMarkProcessed.mockResolvedValue(undefined);
    mockWebhookHandler.mockResolvedValue({ statusCode: 200 });
  });

  it("should process valid update with correct secret and return 200", async () => {
    const event = createEvent();
    const result = await handler(event, dummyContext);

    expect(result.statusCode).toBe(200);
    expect(mockCheckProcessed).toHaveBeenCalledWith(100);
    expect(mockWebhookHandler).toHaveBeenCalledWith(event, dummyContext);
    expect(mockMarkProcessed).toHaveBeenCalledWith(100);
  });

  it("should return 401 when webhookCallback rejects unauthorized request", async () => {
    mockWebhookHandler.mockResolvedValue({ statusCode: 401 });
    const event = createEvent({
      headers: { "content-type": "application/json" },
    });

    const result = await handler(event, dummyContext);

    expect(result.statusCode).toBe(401);
    expect(mockMarkProcessed).not.toHaveBeenCalled();
  });

  it("should return 200 without processing for malformed body", async () => {
    const event = createEvent({ body: "not-json{{{" });
    const result = await handler(event, dummyContext);

    expect(result.statusCode).toBe(200);
    expect(mockWebhookHandler).not.toHaveBeenCalled();
  });

  it("should return 200 without processing for empty body", async () => {
    const event = createEvent({ body: "" });
    const result = await handler(event, dummyContext);

    expect(result.statusCode).toBe(200);
    expect(mockWebhookHandler).not.toHaveBeenCalled();
  });

  it("should return 200 without re-processing for duplicate update_id", async () => {
    mockCheckProcessed.mockResolvedValue(true);
    const event = createEvent();

    const result = await handler(event, dummyContext);

    expect(result.statusCode).toBe(200);
    expect(mockCheckProcessed).toHaveBeenCalledWith(100);
    expect(mockWebhookHandler).not.toHaveBeenCalled();
    expect(mockMarkProcessed).not.toHaveBeenCalled();
  });

  it("should return 500 when internal error occurs during processing", async () => {
    mockWebhookHandler.mockRejectedValue(new Error("Internal failure"));
    const event = createEvent();

    const result = await handler(event, dummyContext);

    expect(result.statusCode).toBe(500);
    expect(mockMarkProcessed).not.toHaveBeenCalled();
  });

  it("should handle pre-parsed object body (YCF auto-parse)", async () => {
    const update = {
      update_id: 200,
      message: {
        message_id: 2,
        from: { id: 42, is_bot: false, first_name: "Test" },
        chat: { id: 42, type: "private" },
        date: 1234567890,
        text: "/help",
      },
    };
    const event = createEvent({ body: update as unknown as string });

    const result = await handler(event, dummyContext);

    expect(result.statusCode).toBe(200);
    expect(mockCheckProcessed).toHaveBeenCalledWith(200);
    expect(mockMarkProcessed).toHaveBeenCalledWith(200);
  });

  it("should not mark as processed when webhookCallback returns non-200", async () => {
    mockWebhookHandler.mockResolvedValue({ statusCode: 401 });
    const event = createEvent();

    await handler(event, dummyContext);

    expect(mockMarkProcessed).not.toHaveBeenCalled();
  });
});
