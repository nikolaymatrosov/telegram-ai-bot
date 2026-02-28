import "dotenv/config";
import type { UserFromGetMe } from "grammy/types";

interface Config {
  botToken: string;
  openaiApiKey: string;
  ydbEndpoint: string;
  ydbDatabase: string;
  webhookSecret?: string;
  botInfo?: UserFromGetMe;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseBotInfo(): UserFromGetMe | undefined {
  const raw = process.env.BOT_INFO;
  if (!raw) return undefined;
  return JSON.parse(raw) as UserFromGetMe;
}

export const config: Config = {
  botToken: requireEnv("BOT_TOKEN"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  ydbEndpoint: requireEnv("YDB_ENDPOINT"),
  ydbDatabase: requireEnv("YDB_DATABASE"),
  webhookSecret: process.env.WEBHOOK_SECRET,
  botInfo: parseBotInfo(),
};
