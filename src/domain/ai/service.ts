import type { CharacterStats } from "../character/types.js";
import type { StatsRequest, SceneRequest, SceneResponse } from "./types.js";
import { STATS_GENERATION_PROMPT, DM_SCENE_PROMPT } from "./prompts.js";
import { getOpenAIClient } from "../../infrastructure/openai/client.js";

export class AIServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AIServiceError";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("timeout") ||
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504")
    );
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isTransientError(err)) {
      console.warn("Transient AI error, retrying once...", err);
      return fn();
    }
    throw err;
  }
}

export async function generateCharacterStats(
  request: StatsRequest,
): Promise<CharacterStats> {
  const client = getOpenAIClient();

  const response = await withRetry(() =>
    client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STATS_GENERATION_PROMPT },
        {
          role: "user",
          content: `Class: ${request.characterClass}\nBackstory: ${request.backstory}`,
        },
      ],
      temperature: 0.8,
    }),
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new AIServiceError("No response from AI for stats generation");
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return {
    str: clamp(Number(parsed.str), 3, 18),
    dex: clamp(Number(parsed.dex), 3, 18),
    con: clamp(Number(parsed.con), 3, 18),
    int: clamp(Number(parsed.int), 3, 18),
    wis: clamp(Number(parsed.wis), 3, 18),
    cha: clamp(Number(parsed.cha), 3, 18),
  };
}

export async function generateScene(
  request: SceneRequest,
): Promise<SceneResponse> {
  const client = getOpenAIClient();

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: DM_SCENE_PROMPT },
    {
      role: "user",
      content: `Character Sheet:\nName: ${request.character.name}\nClass: ${request.character.class}\nBackstory: ${request.character.backstory}\nStats: STR ${request.character.stats.str} | DEX ${request.character.stats.dex} | CON ${request.character.stats.con} | INT ${request.character.stats.int} | WIS ${request.character.stats.wis} | CHA ${request.character.stats.cha}`,
    },
  ];

  for (const turn of request.history) {
    messages.push({ role: "assistant", content: turn.scene });
    messages.push({ role: "user", content: `Action chosen: ${turn.chosenAction}` });
  }

  if (request.isFirstScene) {
    messages.push({
      role: "user",
      content: "Begin the adventure! Generate the opening scene.",
    });
  } else {
    messages.push({
      role: "user",
      content: "Continue the story based on the chosen action. Generate the next scene.",
    });
  }

  const response = await withRetry(() =>
    client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages,
      temperature: 0.9,
    }),
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new AIServiceError("No response from AI for scene generation");
  }

  const parsed = JSON.parse(content) as { description?: string; actions?: string[] };

  if (!parsed.description || !Array.isArray(parsed.actions)) {
    throw new AIServiceError("Invalid scene response format from AI");
  }

  // Validate action count (2-4) and length (<64 chars)
  let actions = parsed.actions.slice(0, 4);
  if (actions.length < 2) {
    throw new AIServiceError("AI returned fewer than 2 actions");
  }
  actions = actions.map((a) => (a.length > 64 ? a.slice(0, 61) + "..." : a));

  return {
    description: parsed.description,
    actions,
  };
}
