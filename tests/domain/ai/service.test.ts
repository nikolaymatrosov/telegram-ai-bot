import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock the OpenAI client singleton
const mockCreate = jest.fn<(...args: any[]) => any>();
jest.unstable_mockModule(
  "../../../src/infrastructure/openai/client.js",
  () => ({
    getOpenAIClient: jest.fn(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  }),
);

// Mock the prompts module (just needs to exist)
jest.unstable_mockModule("../../../src/domain/ai/prompts.js", () => ({
  STATS_GENERATION_PROMPT: "test-stats-prompt",
  DM_SCENE_PROMPT: "test-scene-prompt",
}));

// Dynamic imports after mock setup
const { generateCharacterStats, generateScene, AIServiceError } = await import(
  "../../../src/domain/ai/service.js"
);

describe("AI Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateCharacterStats", () => {
    it("should return clamped stats on happy path", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                str: 15,
                dex: 12,
                con: 14,
                int: 10,
                wis: 8,
                cha: 11,
              }),
            },
          },
        ],
      });

      const result = await generateCharacterStats({
        characterClass: "warrior",
        backstory: "A brave warrior",
      });

      expect(result).toEqual({
        str: 15,
        dex: 12,
        con: 14,
        int: 10,
        wis: 8,
        cha: 11,
      });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should clamp stats to 3-18 range", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                str: 25,
                dex: 1,
                con: 18,
                int: 3,
                wis: -5,
                cha: 100,
              }),
            },
          },
        ],
      });

      const result = await generateCharacterStats({
        characterClass: "mage",
        backstory: "Extreme stats",
      });

      expect(result).toEqual({
        str: 18,
        dex: 3,
        con: 18,
        int: 3,
        wis: 3,
        cha: 18,
      });
    });

    it("should throw AIServiceError when AI returns no content", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        generateCharacterStats({
          characterClass: "rogue",
          backstory: "A sneaky thief",
        }),
      ).rejects.toThrow("No response from AI for stats generation");
    });

    it("should throw on malformed JSON response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json" } }],
      });

      await expect(
        generateCharacterStats({
          characterClass: "healer",
          backstory: "A kind healer",
        }),
      ).rejects.toThrow();
    });

    it("should retry on transient 429 error", async () => {
      const transientError = new Error("rate limit 429 exceeded");
      mockCreate
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  str: 10,
                  dex: 10,
                  con: 10,
                  int: 10,
                  wis: 10,
                  cha: 10,
                }),
              },
            },
          ],
        });

      const result = await generateCharacterStats({
        characterClass: "warrior",
        backstory: "Retry test",
      });

      expect(result).toEqual({
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      });
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("should retry on transient 5xx error", async () => {
      const transientError = new Error("503 service unavailable");
      mockCreate
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  str: 12,
                  dex: 12,
                  con: 12,
                  int: 12,
                  wis: 12,
                  cha: 12,
                }),
              },
            },
          ],
        });

      const result = await generateCharacterStats({
        characterClass: "mage",
        backstory: "Retry test 5xx",
      });

      expect(result.str).toBe(12);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("should NOT retry on non-transient error", async () => {
      const nonTransientError = new Error("Invalid API key");
      mockCreate.mockRejectedValueOnce(nonTransientError);

      await expect(
        generateCharacterStats({
          characterClass: "rogue",
          backstory: "Non-transient test",
        }),
      ).rejects.toThrow("Invalid API key");
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should round float stats to integers", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                str: 14.7,
                dex: 11.2,
                con: 13.5,
                int: 9.1,
                wis: 7.8,
                cha: 10.4,
              }),
            },
          },
        ],
      });

      const result = await generateCharacterStats({
        characterClass: "warrior",
        backstory: "Float stats",
      });

      expect(result.str).toBe(15);
      expect(result.dex).toBe(11);
      expect(result.con).toBe(14);
      expect(result.int).toBe(9);
      expect(result.wis).toBe(8);
      expect(result.cha).toBe(10);
    });
  });

  describe("generateScene", () => {
    const baseRequest = {
      character: {
        name: "Thorin",
        class: "warrior",
        backstory: "A dwarf warrior",
        stats: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
      },
      history: [],
      isFirstScene: true,
    };

    it("should return scene on happy path", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: "You enter a dark cave...",
                actions: ["Explore deeper", "Light a torch", "Turn back"],
              }),
            },
          },
        ],
      });

      const result = await generateScene(baseRequest);

      expect(result.description).toBe("You enter a dark cave...");
      expect(result.actions).toHaveLength(3);
      expect(result.actions).toContain("Explore deeper");
    });

    it("should pass history into messages for continuation", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: "The cave trembles...",
                actions: ["Run!", "Stand firm"],
              }),
            },
          },
        ],
      });

      await generateScene({
        ...baseRequest,
        isFirstScene: false,
        history: [
          { scene: "Previous scene", chosenAction: "Explore deeper" },
        ],
      });

      const callArgs = mockCreate.mock.calls[0]![0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const messages = callArgs.messages;
      expect(messages.some((m) => m.content === "Previous scene")).toBe(true);
      expect(
        messages.some((m) => m.content === "Action chosen: Explore deeper"),
      ).toBe(true);
    });

    it("should throw when AI returns no content", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(generateScene(baseRequest)).rejects.toThrow(
        "No response from AI for scene generation",
      );
    });

    it("should throw on invalid scene format (missing description)", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ actions: ["Action 1", "Action 2"] }),
            },
          },
        ],
      });

      await expect(generateScene(baseRequest)).rejects.toThrow(
        "Invalid scene response format from AI",
      );
    });

    it("should throw on invalid scene format (missing actions array)", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: "A scene",
                actions: "not an array",
              }),
            },
          },
        ],
      });

      await expect(generateScene(baseRequest)).rejects.toThrow(
        "Invalid scene response format from AI",
      );
    });

    it("should throw when fewer than 2 actions returned", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: "A lonely scene",
                actions: ["Only one action"],
              }),
            },
          },
        ],
      });

      await expect(generateScene(baseRequest)).rejects.toThrow(
        "AI returned fewer than 2 actions",
      );
    });

    it("should truncate actions to max 4 items", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: "Many options...",
                actions: [
                  "Action 1",
                  "Action 2",
                  "Action 3",
                  "Action 4",
                  "Action 5",
                ],
              }),
            },
          },
        ],
      });

      const result = await generateScene(baseRequest);
      expect(result.actions).toHaveLength(4);
    });

    it("should truncate long actions to 64 characters", async () => {
      const longAction = "A".repeat(100);
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: "A scene",
                actions: [longAction, "Short action"],
              }),
            },
          },
        ],
      });

      const result = await generateScene(baseRequest);
      expect(result.actions[0]!.length).toBeLessThanOrEqual(64);
      expect(result.actions[0]!.endsWith("...")).toBe(true);
    });

    it("should retry on transient error during scene generation", async () => {
      const transientError = new Error("timeout occurred");
      mockCreate.mockRejectedValueOnce(transientError).mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: "After retry...",
                actions: ["Act 1", "Act 2"],
              }),
            },
          },
        ],
      });

      const result = await generateScene(baseRequest);
      expect(result.description).toBe("After retry...");
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });
});
