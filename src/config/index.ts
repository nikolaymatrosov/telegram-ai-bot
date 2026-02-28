import "dotenv/config";

interface Config {
  botToken: string;
  openaiApiKey: string;
  ydbEndpoint: string;
  ydbDatabase: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config: Config = {
  botToken: requireEnv("BOT_TOKEN"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  ydbEndpoint: requireEnv("YDB_ENDPOINT"),
  ydbDatabase: requireEnv("YDB_DATABASE"),
};
