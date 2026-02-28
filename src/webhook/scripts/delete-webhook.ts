import "dotenv/config";
import { Bot } from "grammy";

export async function deleteWebhook(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("Missing required environment variable: BOT_TOKEN");

  const bot = new Bot(token);

  await bot.api.deleteWebhook({ drop_pending_updates: true });
  console.log("Webhook successfully deleted.");
}

// Run directly when executed as a script
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  deleteWebhook().catch((err) => {
    console.error("Failed to delete webhook:", err);
    process.exit(1);
  });
}
