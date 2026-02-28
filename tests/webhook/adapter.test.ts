import { describe, it, expect } from "@jest/globals";
import type { YcfEvent, YcfContext, YcfResponse } from "../../src/webhook/types.js";

const { ycfAdapter } = await import("../../src/webhook/adapter.js");

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

function createEvent(overrides?: Partial<YcfEvent>): YcfEvent {
  return {
    httpMethod: "POST",
    headers: {
      "content-type": "application/json",
      [SECRET_HEADER]: "test-secret",
    },
    body: JSON.stringify({ update_id: 123, message: { text: "/start" } }),
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

describe("ycfAdapter", () => {
  it("should extract X-Telegram-Bot-Api-Secret-Token header from event", () => {
    const event = createEvent();
    const handler = ycfAdapter(event, dummyContext);

    expect(handler.header).toBe("test-secret");
  });

  it("should return undefined header when secret token header is missing", () => {
    const event = createEvent({
      headers: { "content-type": "application/json" },
    });
    const handler = ycfAdapter(event, dummyContext);

    expect(handler.header).toBeUndefined();
  });

  it("should parse event.body when it is a JSON string", () => {
    const update = { update_id: 456, message: { text: "hello" } };
    const event = createEvent({ body: JSON.stringify(update) });
    const handler = ycfAdapter(event, dummyContext);

    expect(handler.update).toEqual(update);
  });

  it("should use event.body directly when it is a pre-parsed object", () => {
    const update = { update_id: 789, message: { text: "world" } };
    const event = createEvent({ body: update as unknown as string });
    const handler = ycfAdapter(event, dummyContext);

    expect(handler.update).toEqual(update);
  });

  it("should resolve handlerReturn with statusCode 200 when end() is called", async () => {
    const event = createEvent();
    const handler = ycfAdapter(event, dummyContext);

    handler.end!();

    const response = await handler.handlerReturn as YcfResponse;
    expect(response.statusCode).toBe(200);
  });

  it("should resolve handlerReturn with JSON body when respond() is called", async () => {
    const event = createEvent();
    const handler = ycfAdapter(event, dummyContext);
    const json = JSON.stringify({ method: "sendMessage", chat_id: 123, text: "hi" });

    handler.respond(json);

    const response = await handler.handlerReturn as YcfResponse;
    expect(response.statusCode).toBe(200);
    expect(response.headers).toEqual({ "Content-Type": "application/json" });
    expect(response.body).toBe(json);
  });

  it("should resolve handlerReturn with statusCode 401 when unauthorized() is called", async () => {
    const event = createEvent();
    const handler = ycfAdapter(event, dummyContext);

    handler.unauthorized();

    const response = await handler.handlerReturn as YcfResponse;
    expect(response.statusCode).toBe(401);
  });
});
