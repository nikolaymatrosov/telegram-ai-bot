import { webhookCallback } from "grammy";
import { config } from "./config/index.js";
import { getDriver } from "./infrastructure/ydb/driver.js";
import { createBot } from "./create-bot.js";
import { ycfAdapter } from "./webhook/adapter.js";
import { createDedupChecker } from "./webhook/dedup.js";
import type { YcfEvent, YcfContext, YcfResponse } from "./webhook/types.js";

// Module-level initialization — reused on warm starts
let initialized = false;
let handleWebhook: (event: YcfEvent, context: YcfContext) => Promise<YcfResponse>;
let dedup: ReturnType<typeof createDedupChecker>;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const driver = await getDriver();
  dedup = createDedupChecker(driver);

  const bot = createBot({
    token: config.botToken,
    driver,
    botInfo: config.botInfo,
  });

  handleWebhook = webhookCallback(bot, ycfAdapter, {
    secretToken: config.webhookSecret,
    timeoutMilliseconds: 55_000,
    onTimeout: "return",
  });

  initialized = true;
}

function extractUpdateId(event: YcfEvent): number | undefined {
  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    if (body && typeof body === "object" && "update_id" in body) {
      return (body as { update_id: number }).update_id;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function handler(event: YcfEvent, context: YcfContext): Promise<YcfResponse> {
  // Validate body is parseable
  const updateId = extractUpdateId(event);
  if (updateId === undefined) {
    return { statusCode: 200 };
  }

  await ensureInitialized();

  // Idempotency check
  const isDuplicate = await dedup.checkProcessed(updateId);
  if (isDuplicate) {
    return { statusCode: 200 };
  }

  try {
    const response = await handleWebhook(event, context);

    // Only mark as processed on successful handling
    if (response.statusCode === 200) {
      await dedup.markProcessed(updateId);
    }

    return response;
  } catch (error) {
    console.error("Webhook handler error:", error);
    return { statusCode: 500 };
  }
}
