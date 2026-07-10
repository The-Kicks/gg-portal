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
 * getTargetMatchesPerItem: Berekent dynamisch het breekpunt van de sorter.
 * - Hele kleine pools (<= 6 items): Maximaal 3 tot 4 matches per item.
 * (Bij 5 items is iedereen na ~8 tot 10 stemmen al klaar).
 * - Middelgroot (7 - 30 items): 5 tot 7 matches per item voor een betrouwbare top.
 * - Groot (31 - 100 items): 4 tot 5 matches per item.
 * - Gigantisch (100+ items): Strak op 3 matches per item zodat de ladder behapbaar blijft.
 */
export function getTargetMatchesPerItem(poolLength: number): number {
  if (poolLength <= 6) return 3;   // Veel beter. Snel klaar bij een kleine set!
  if (poolLength <= 15) return 6;
  if (poolLength <= 40) return 5;
  if (poolLength <= 100) return 4;
  return 3; 
}
/**
 * getNextMatch: Selecteert op een slimme manier de volgende match op de ladder.
 * Werkt feilloos voor 5 items én voor 1000 items.
 */
export function getNextMatch<T extends HydratedEntity>(
  pool: EloExtended<T>[]
): [EloExtended<T>, EloExtended<T>] | null {
  if (pool.length < 2) return null;

  const targetMatches = getTargetMatchesPerItem(pool.length);

  // 1. Filter kandidaten voor Entity A die hun target nog NIET hebben bereikt.
  // Dit zorgt ervoor dat we bij grote pools systematisch door de ongespeelde kaarten heen akkeren.
  let candidatesA = pool.filter(e => e.matchesPlayed < targetMatches);

  // Als álle items hun minimale target hebben bereikt, is de ladder klaar!
  if (candidatesA.length === 0) {
    return null;
  }

  // Sorteer Entity A kandidaten op degenen met de minste matches om gaten in de ladder te voorkomen
  const minMatchesA = Math.min(...candidatesA.map(e => e.matchesPlayed));
  candidatesA = candidatesA.filter(e => e.matchesPlayed <= minMatchesA + 1);

  // Kies een willekeurige Entity A uit de prioriteitslijst
  const entityA = candidatesA[Math.floor(Math.random() * candidatesA.length)];

  // 2. Zoek geschikte tegenstanders (Entity B)
  let opponents = pool.filter(e => e.id !== entityA.id);

  // Voorkom directe opeenvolgende herhaling van exact dezelfde matchup
  if (lastMatchIds.includes(entityA.id)) {
    const filteredOpponents = opponents.filter(e => !lastMatchIds.includes(e.id));
    if (filteredOpponents.length > 0) {
      opponents = filteredOpponents;
    }
  }

  // 3. Matchmaking op basis van de ladder-positie:
  // We zoeken een tegenstander die qua ELO zo dicht mogelijk bij Entity A ligt (Swiss-system / Ladder principe).
  // Voor de stabiliteit geven we tegenstanders die hun target óók nog niet hebben bereikt een lichte voorrang.
  const sortedOpponents = opponents.sort((a, b) => {
    const eloDiffA = Math.abs(a.elo - entityA.elo);
    const eloDiffB = Math.abs(b.elo - entityA.elo);

    // Bonuspounten als de tegenstander ook nog 'hongerig' is naar matches
    const statusBonusA = a.matchesPlayed < targetMatches ? 0 : 100;
    const statusBonusB = b.matchesPlayed < targetMatches ? 0 : 100;

    // Voeg een kleine willekeurige jitter toe om herhalende loops te doorbreken
    const scoreA = eloDiffA + statusBonusA + (Math.random() * 10);
    const scoreB = eloDiffB + statusBonusB + (Math.random() * 10);

    return scoreA - scoreB;
  });

  // Pak een tegenstander uit de top 3 meest gelijkwaardige tegenstanders op de ladder
  const poolSize = Math.min(sortedOpponents.length, 3);
  const entityB = sortedOpponents[Math.floor(Math.random() * poolSize)];

  // Sla de match op in de in-memory herhalingsbeveiliging
  lastMatchIds = [entityA.id, entityB.id];

  return [entityA, entityB];
}