import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock dotenv/config to prevent actual .env loading
jest.unstable_mockModule("dotenv/config", () => ({}));

describe("Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Reset process.env for each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should load all required variables on happy path", async () => {
    process.env.BOT_TOKEN = "test-bot-token";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.YDB_ENDPOINT = "grpc://localhost:2136";
    process.env.YDB_DATABASE = "/local";

    // Re-mock dotenv for fresh import
    jest.unstable_mockModule("dotenv/config", () => ({}));
    const { config } = await import("../../src/config/index.js");

    expect(config.botToken).toBe("test-bot-token");
    expect(config.openaiApiKey).toBe("test-openai-key");
    expect(config.ydbEndpoint).toBe("grpc://localhost:2136");
    expect(config.ydbDatabase).toBe("/local");
  });

  it("should throw when BOT_TOKEN is missing", async () => {
    delete process.env.BOT_TOKEN;
    process.env.OPENAI_API_KEY = "key";
    process.env.YDB_ENDPOINT = "grpc://localhost:2136";
    process.env.YDB_DATABASE = "/local";

    jest.unstable_mockModule("dotenv/config", () => ({}));

    await expect(import("../../src/config/index.js")).rejects.toThrow(
      "Missing required environment variable: BOT_TOKEN",
    );
  });

  it("should throw when OPENAI_API_KEY is missing", async () => {
    process.env.BOT_TOKEN = "token";
    delete process.env.OPENAI_API_KEY;
    process.env.YDB_ENDPOINT = "grpc://localhost:2136";
    process.env.YDB_DATABASE = "/local";

    jest.unstable_mockModule("dotenv/config", () => ({}));

    await expect(import("../../src/config/index.js")).rejects.toThrow(
      "Missing required environment variable: OPENAI_API_KEY",
    );
  });

  it("should throw when YDB_ENDPOINT is missing", async () => {
    process.env.BOT_TOKEN = "token";
    process.env.OPENAI_API_KEY = "key";
    delete process.env.YDB_ENDPOINT;
    process.env.YDB_DATABASE = "/local";

    jest.unstable_mockModule("dotenv/config", () => ({}));

    await expect(import("../../src/config/index.js")).rejects.toThrow(
      "Missing required environment variable: YDB_ENDPOINT",
    );
  });

  it("should throw when YDB_DATABASE is missing", async () => {
    process.env.BOT_TOKEN = "token";
    process.env.OPENAI_API_KEY = "key";
    process.env.YDB_ENDPOINT = "grpc://localhost:2136";
    delete process.env.YDB_DATABASE;

    jest.unstable_mockModule("dotenv/config", () => ({}));

    await expect(import("../../src/config/index.js")).rejects.toThrow(
      "Missing required environment variable: YDB_DATABASE",
    );
  });

  it("should throw when empty string is provided for required variable", async () => {
    process.env.BOT_TOKEN = "";
    process.env.OPENAI_API_KEY = "key";
    process.env.YDB_ENDPOINT = "grpc://localhost:2136";
    process.env.YDB_DATABASE = "/local";

    jest.unstable_mockModule("dotenv/config", () => ({}));

    await expect(import("../../src/config/index.js")).rejects.toThrow(
      "Missing required environment variable: BOT_TOKEN",
    );
  });
});
