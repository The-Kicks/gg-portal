import type { GameID } from '../types';

export type GuessWhoColumnID =
  | 'profile'
  | 'name'
  | 'org'
  | 'nationality'
  | 'role'
  | 'debut'
  | 'age'
  | 'height';

/**
 * Definition structure for a Guess Who table column layout mapping.
 */
export interface GuessWhoColumnDefinition {
  id: GuessWhoColumnID;
  label: string;
  isMandatory?: boolean;
}

/**
 * Master registration array of all columns available for configuration within the Guess Who game module.
 */
export const GUESSWHO_AVAILABLE_COLUMNS: GuessWhoColumnDefinition[] = [
  { id: 'profile', label: 'ProfilePic', isMandatory: true },
  { id: 'name', label: 'Name', isMandatory: true },
  { id: 'org', label: 'Organisation/Team' },
  { id: 'nationality', label: 'Nationality' },
  { id: 'role', label: 'Rol / Position' },
  { id: 'debut', label: 'Debut Year' },
  { id: 'age', label: 'Age' },
  { id: 'height', label: 'Height' },
];

/**
 * Customizable settings schema for filtering active Guess Who game columns.
 */
export interface GuessWhoSettings {
  disabledColumns?: GuessWhoColumnID[];
  [key: string]: unknown;
}

/**
 * Configuration boundaries for managing item categories inside the Blind Ranking game mode.
 */
export interface BlindRankingSettings {
  availableCategories: string[];
  disabledCategories: string[];
}

export interface SorterSettings { [key: string]: unknown; }

/**
 * Consolidated compilation mapping game structural setups across all active dashboard sub-games.
 */
export type ThemeGameSettings = {
  guesswho?: GuessWhoSettings;
  sorter?: SorterSettings;
  blindranking?: BlindRankingSettings;
};

/**
 * Core metadata blueprint for registering an interactive portal game module.
 */
export interface GameDefinition {
  id: GameID;
  name: string;
  icon?: string;
}

/**
 * Global registry defining all officially supported game implementations accessible within the portal application framework.
 */
export const GLOBAL_AVAILABLE_GAMES: GameDefinition[] = [
  { id: 'guesswho', name: 'Guess Who' },
  { id: 'sorter', name: 'Sorter' },
  { id: 'blindranking', name: 'Blind Ranking' },
];