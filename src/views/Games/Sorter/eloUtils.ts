import type { HydratedEntity } from '../../../types';

/**
 * INITIAL_ELO: De standaard startscore voor elke entiteit die nog geen matches heeft gespeeld.
 */
export const INITIAL_ELO: number = 1200;

/**
 * K_FACTOR: Bepaalt hoe zwaar een overwinning of verlies meeweegt. 
 */
const K_FACTOR: number = 32;

export type EloExtended<T> = T & {
  elo: number;
  matchesPlayed: number;
};

/**
 * calculateElo: Berekent de nieuwe ELO-ratings voor beide entiteiten op basis van de winnaar.
 */
export function calculateElo(ratingA: number, ratingB: number, outcome: 'A' | 'B') {
  const expectedA: number = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB: number = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  const actualA: number = outcome === 'A' ? 1 : 0;
  const actualB: number = outcome === 'B' ? 1 : 0;

  return {
    newRatingA: Math.round(ratingA + K_FACTOR * (actualA - expectedA)),
    newRatingB: Math.round(ratingB + K_FACTOR * (actualB - expectedB)),
  };
}

// Een simpele in-memory tracker om te voorkomen dat EXACT dezelfde match direct achter elkaar komt
let lastMatchIds: string[] = [];

/**
 * getNextMatch: Selecteert op een slimme manier de volgende match.
 * Stop zodra de pool gemiddeld 15 matches per item heeft gespeeld.
 */
export function getNextMatch<T extends HydratedEntity>(
  pool: EloExtended<T>[]
): [EloExtended<T>, EloExtended<T>] | null {
  if (pool.length < 2) return null;

  // Harde stop: als de pool gemiddeld gekalibreerd is (15 matches per item), markeer als klaar.
  const targetMatchesPerItem = 15;
  const totalMatchesPlayed = pool.reduce((sum, item) => sum + item.matchesPlayed, 0);
  const averageMatchesPlayed = totalMatchesPlayed / pool.length;

  if (averageMatchesPlayed >= targetMatchesPerItem) {
    return null;
  }

  // 1. Vind het minimale aantal gespeelde wedstrijden in de huidige pool
  const minMatches = Math.min(...pool.map(e => e.matchesPlayed));

  // 2. Selecteer kandidaten voor Entity A die op of dichtbij dit minimum zitten
  let candidatesA = pool.filter(e => e.matchesPlayed <= minMatches + 1);
  if (candidatesA.length === 0) candidatesA = pool;

  // Kies een willekeurige Entity A uit deze prioriteitslijst
  const entityA = candidatesA[Math.floor(Math.random() * candidatesA.length)];

  // 3. Zoek geschikte tegenstanders (Entity B)
  let opponents = pool.filter(e => e.id !== entityA.id);

  // Filter de tegenstanders zodat we niet EXACT dezelfde match als de vorige keer voorschotelen
  if (lastMatchIds.includes(entityA.id)) {
    const filteredOpponents = opponents.filter(e => !lastMatchIds.includes(e.id));
    if (filteredOpponents.length > 0) {
      opponents = filteredOpponents;
    }
  }

  // 4. Sorteer de tegenstanders op basis van een gecombineerde score
  const sortedOpponents = opponents.sort((a, b) => {
    const matchDiffA = Math.abs(a.matchesPlayed - entityA.matchesPlayed);
    const matchDiffB = Math.abs(b.matchesPlayed - entityA.matchesPlayed);
    
    const eloDiffA = Math.abs(a.elo - entityA.elo) / 30;
    const eloDiffB = Math.abs(b.elo - entityA.elo) / 30;

    const scoreA = matchDiffA + eloDiffA + (Math.random() * 0.5);
    const scoreB = matchDiffB + eloDiffB + (Math.random() * 0.5);

    return scoreA - scoreB;
  });

  const poolSize = Math.min(sortedOpponents.length, 3);
  const entityB = sortedOpponents[Math.floor(Math.random() * poolSize)];

  lastMatchIds = [entityA.id, entityB.id];

  return [entityA, entityB];
}