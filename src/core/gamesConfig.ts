// src/core/gamesConfig.ts

export interface GameDefinition {
  id: string; // Moet matchen met de GameID uit je types
  name: string;
  icon?: string;
}

export const GLOBAL_AVAILABLE_GAMES: GameDefinition[] = [
  { id: 'guesswho', name: 'Guess Who' },
  { id: 'sorter', name: 'Sorter' },
  { id: 'blindranking', name: 'Blind Ranking' },
  // Toekomstige games voeg je simpelweg hieronder toe:
  // { id: 'trivia', name: 'Pubquiz / Trivia' },
];