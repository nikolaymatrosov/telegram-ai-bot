export interface StorySession {
  id: string;
  userId: string;
  characterId: string;
  status: "active" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryTurn {
  userId: string;
  sessionId: string;
  turnNumber: number;
  sceneText: string;
  actionsJson: string[];
  chosenAction: string | null;
  createdAt: Date;
}

export interface SceneResponse {
  description: string;
  actions: string[];
}
