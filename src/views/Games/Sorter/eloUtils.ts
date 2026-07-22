import type { HydratedEntity } from '../../../types';

// ============================================================================
// CONFIGUREERBARE INSTELLINGEN (SETTINGS)
// ============================================================================
export const SORTER_SETTINGS = {
  /**
   * De startscore voor elk item. Dit is het nulpunt van je ranglijst.
   */
  INITIAL_ELO: 1200,

  /**
   * # of placement matches before K value drops
   */
  PLACEMENT_GAMES: 5,

  /**
   * Favour high ranked entities in matchup selection
   */
  ELO_ADVANTAGE: 2,

  /**
   * Disfavour entities with a lot of matches in matchup selection
   */
  PLAYED_ADVANTAGE: 2,
};

// Backwards compatibility voor andere componenten die INITIAL_ELO rechtstreeks importeren
export const INITIAL_ELO = SORTER_SETTINGS.INITIAL_ELO;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
export type EloExtended<T> = T & {
  elo: number;
  matchesPlayed: number;
};

export interface SorterStage {
  title: string;
  description: string;
  color: string;
}

export interface SorterTier {
  name: string;
  abbreviation: string;
  color: string;
  minElo: number;
}

// ============================================================================
// TIERS
// ============================================================================
// Quick & dirty local tiers. TODO: derive these from the database (cutoff,
// name, abbreviation, colour, and eventually an image) instead of hardcoding.

// Shown for entities that have not finished their placement games yet.
export const UNRANKED_TIER: SorterTier = {
  name: 'Unranked',
  abbreviation: 'UR',
  color: '#71717a',
  minElo: -Infinity,
};

// Ordered from highest cutoff to lowest so getTier can return the first match.
export const SORTER_TIERS: SorterTier[] = [
  { name: 'Master',   abbreviation: 'MST', color: '#c084fc', minElo: 1550 },
  { name: 'Diamond',  abbreviation: 'DIA', color: '#38bdf8', minElo: 1450 },
  { name: 'Platinum', abbreviation: 'PLT', color: '#2dd4bf', minElo: 1350 },
  { name: 'Gold',     abbreviation: 'GLD', color: '#eab308', minElo: 1250 },
  { name: 'Silver',   abbreviation: 'SLV', color: '#9ca3af', minElo: 1150 },
  { name: 'Bronze',   abbreviation: 'BRZ', color: '#cd7f32', minElo: -Infinity },
];

export function getTier<T extends HydratedEntity>(entity: EloExtended<T>): SorterTier {
  if (entity.matchesPlayed < SORTER_SETTINGS.PLACEMENT_GAMES) {
    return UNRANKED_TIER;
  }
  return SORTER_TIERS.find((tier) => entity.elo >= tier.minElo) ?? UNRANKED_TIER;
}

// ============================================================================
// FUNCTIES
// ============================================================================
export function processMatch <T extends HydratedEntity> (A: EloExtended<T>, B:EloExtended<T>, outcome: 'A' | 'B'): void {
  const expectedA: number = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400));
  const expectedB: number = 1 / (1 + Math.pow(10, (A.elo - B.elo) / 400));

  const actualA: number = outcome === 'A' ? 1 : 0;
  const actualB: number = outcome === 'B' ? 1 : 0;

  const kA: number = A.matchesPlayed++ < SORTER_SETTINGS.PLACEMENT_GAMES ? 40 : 20;
  const kB: number = B.matchesPlayed++ < SORTER_SETTINGS.PLACEMENT_GAMES ? 40 : 20;

  A.elo += kA * (actualA - expectedA);
  B.elo += kB * (actualB - expectedB);
}

export function getNextMatch <T extends HydratedEntity> (pool: EloExtended<T>[]) : [EloExtended<T>, EloExtended<T>] | null {
  if (pool.length < 2)
    return null;

  const minELO: number = Math.min(...pool.map(e => e.elo));
  const maxELO: number = Math.max(...pool.map(e => e.elo));
  const minMatches: number = Math.min(...pool.map(e => e.matchesPlayed));
  const maxMatches: number = Math.max(...pool.map(e => e.matchesPlayed));
  function weight (entry: EloExtended<T>) : number {
    return 1 + SORTER_SETTINGS.ELO_ADVANTAGE * (entry.elo - minELO) / (maxELO - minELO)
             + SORTER_SETTINGS.PLAYED_ADVANTAGE * (entry.matchesPlayed - maxMatches) / (minMatches - maxMatches);
  }
  const total = pool.reduce((sum, current) => sum + weight(current), 0);
  const target = Math.random() * total;

  let index: number = 0;
  for (let sum: number = 0; sum + weight(pool[index]) < target; sum += weight(pool[index++]));
  const A: EloExtended<T> = pool[index];

  // OPTIONAL: implement max ELO gap
  let eloGap:number  = 25;
  for (; pool.filter(e => Math.abs(A.elo - e.elo) <= eloGap).filter(e => e !== A).length === 0; eloGap += 25);
  const opponentPool: EloExtended<T>[] = pool.filter(e => Math.abs(A.elo - e.elo) < eloGap).filter(e => e !== A);
  const B: EloExtended<T> = opponentPool[Math.floor(Math.random() * opponentPool.length)];

  return [A, B];
}