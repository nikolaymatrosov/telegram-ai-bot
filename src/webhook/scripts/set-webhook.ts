import "dotenv/config";
import { Bot } from "grammy";

export async function setWebhook(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("Missing required environment variable: BOT_TOKEN");

  const url = process.env.WEBHOOK_URL;
  if (!url) throw new Error("Missing required environment variable: WEBHOOK_URL");

  const secretToken = process.env.WEBHOOK_SECRET;

  const bot = new Bot(token);

  await bot.api.setWebhook(url, {
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  const info = await bot.api.getWebhookInfo();
  console.log("Webhook info:", info);
}

// Run directly when executed as a script
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  setWebhook().catch((err) => {
    console.error("Failed to set webhook:", err);
    process.exit(1);
  });
}
