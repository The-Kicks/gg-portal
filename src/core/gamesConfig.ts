// src/core/gamesConfig.ts
import type { GameID } from '../types';

// ==========================================
// GUESS WHO SPECIFIEKE CONFIGURATIE
// ==========================================

// 1. Alle mogelijke kolom IDs die jouw tabel snapt
export type GuessWhoColumnID =
  | 'profile'
  | 'name'
  | 'org'
  | 'nationality'
  | 'role'
  | 'debut'
  | 'age'
  | 'height';

export interface GuessWhoColumnDefinition {
  id: GuessWhoColumnID;
  label: string;      // De naam die je in de beheeromgeving/tabelkop ziet
  isMandatory?: boolean; // Optioneel: kolommen die je nooit mag uitzetten (bijv. 'name')
}

// 2. De master-lijst van kolommen (Te gebruiken voor je checkboxes!)
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

export interface GuessWhoSettings {
  disabledColumns?: GuessWhoColumnID[];
  [key: string]: unknown;
}

export interface BlindRankingSettings {
  disabledCategories: string[];
  customCategories: string[];
}

export interface SorterSettings { [key: string]: unknown; }
export interface BlindRankingSettings { [key: string]: unknown; }

export type ThemeGameSettings = {
  guesswho?: GuessWhoSettings;
  sorter?: SorterSettings;
  blindranking?: BlindRankingSettings;
};

export interface GameDefinition {
  id: GameID;
  name: string;
  icon?: string;
}

export const GLOBAL_AVAILABLE_GAMES: GameDefinition[] = [
  { id: 'guesswho', name: 'Guess Who' },
  { id: 'sorter', name: 'Sorter' },
  { id: 'blindranking', name: 'Blind Ranking' },
];