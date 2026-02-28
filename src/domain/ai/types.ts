import type { CharacterStats } from "../character/types.js";

export interface StatsRequest {
  characterClass: "warrior" | "mage" | "rogue" | "healer";
  backstory: string;
}

export interface SceneRequest {
  character: {
    name: string;
    class: string;
    backstory: string;
    stats: CharacterStats;
  };
  history: Array<{
    scene: string;
    chosenAction: string;
  }>;
  isFirstScene: boolean;
}

export interface SceneResponse {
  description: string;
  actions: string[];
}
