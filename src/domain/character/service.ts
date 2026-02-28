import { randomUUID } from "node:crypto";
import type { Character, CharacterClass, CharacterStats } from "./types.js";
import { generateCharacterStats } from "../ai/service.js";
import type { createCharacterRepo } from "../../infrastructure/ydb/repositories/character.repo.js";
import type { createUserRepo } from "../../infrastructure/ydb/repositories/user.repo.js";

type CharacterRepo = ReturnType<typeof createCharacterRepo>;
type UserRepo = ReturnType<typeof createUserRepo>;

export function createCharacterService(charRepo: CharacterRepo, userRepo: UserRepo) {
  return {
    async createCharacter(
      userId: string,
      name: string,
      charClass: CharacterClass,
      backstory: string,
      stats: CharacterStats,
    ): Promise<Character> {
      const characterId = randomUUID();

      await charRepo.upsert(
        userId,
        characterId,
        name,
        charClass,
        backstory,
        stats,
        true,
      );

      await userRepo.upsert(userId, characterId);

      return {
        id: characterId,
        userId,
        name,
        class: charClass,
        backstory,
        stats,
        isActive: true,
        createdAt: new Date(),
      };
    },

    async getActiveCharacter(userId: string): Promise<Character | undefined> {
      return charRepo.findActiveByUserId(userId);
    },

    async archiveCharacter(userId: string): Promise<void> {
      await charRepo.archiveByUserId(userId);
      await userRepo.updateActiveCharacter(userId, null);
    },

    async generateStats(charClass: CharacterClass, backstory: string): Promise<CharacterStats> {
      return generateCharacterStats({ characterClass: charClass, backstory });
    },
  };
}
