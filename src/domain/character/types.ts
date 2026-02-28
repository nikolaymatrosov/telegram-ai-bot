export type CharacterClass = "warrior" | "mage" | "rogue" | "healer";

export interface CharacterStats {
  str: number; // 3-18
  dex: number; // 3-18
  con: number; // 3-18
  int: number; // 3-18
  wis: number; // 3-18
  cha: number; // 3-18
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  class: CharacterClass;
  backstory: string;
  stats: CharacterStats;
  isActive: boolean;
  createdAt: Date;
}
