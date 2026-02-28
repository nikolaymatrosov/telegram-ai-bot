import type { YcfEvent, YcfContext, YcfResponse } from "./types.js";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

export const ycfAdapter = (event: YcfEvent, _context: YcfContext) => {
  let resolveResponse!: (response: YcfResponse) => void;

  return {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
    get update() {
      const body = event.body;
      const parsed = typeof body === "string" ? JSON.parse(body) : body;
      return parsed;
    },
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
    header: event.headers[SECRET_HEADER],
    end: () => resolveResponse({ statusCode: 200 }),
    respond: (json: string) =>
      resolveResponse({
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: json,
      }),
    unauthorized: () => resolveResponse({ statusCode: 401 }),
    handlerReturn: new Promise<YcfResponse>((resolve) => {
      resolveResponse = resolve;
    }),
  };
};
