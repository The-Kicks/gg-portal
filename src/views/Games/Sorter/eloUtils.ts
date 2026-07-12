import type { HydratedEntity } from '../../../types';

export const INITIAL_ELO: number = 1200;
const K_FACTOR: number = 32;

export type EloExtended<T> = T & {
  elo: number;
  matchesPlayed: number;
  playedAgainst: string[];
};

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

/**
 * getIndividualTarget: Schakelt tussen Exact Sorteren en Swiss-System Ladder.
 * Voorkomt herhalende matches bij kleine pools door een harde 'N - 1' cap.
 */
export function getIndividualTarget<T extends HydratedEntity>(
  item: EloExtended<T>,
  sortedPool: EloExtended<T>[]
): number {
  const N = sortedPool.length;

  // CATCH 1: Hele kleine pools (3 tot 6 items).
  if (N <= 6) {
    return N - 1; 
  }

  // CATCH 2: Kleine tot middelgrote pools (7 tot 32 items).
  if (N <= 32) {
    return Math.min(Math.ceil(2 * Math.log2(N)), N - 1); 
  }

  // FASE 2: Grote pools (N > 32).
  const rankIndex = sortedPool.findIndex(e => e.id === item.id);
  const percentile = 1 - (rankIndex / N); // 1.0 = nummer 1, 0.0 = laatste

  // Onderste 40%: Snel lozen na 2 matches
  if (percentile < 0.40) {
    return 2;
  }
  
  // Middenmoot (top 60% tot top 15%): Krijgt een stabiele basis
  if (percentile < 0.85) {
    return 4;
  }

  // De Elite zone (Bovenste 15%): Moeten intensief strijden om de echte top 100 te finetunen
  if (N > 500) return 6;
  return 8;
}

/**
 * getCalibrationProgress: Berekent de nauwkeurige voortgang op basis van de gekozen modus.
 */
export function getCalibrationProgress<T extends HydratedEntity>(pool: EloExtended<T>[]): number {
  if (pool.length === 0) return 0;

  const sortedPool = [...pool].sort((a, b) => b.elo - a.elo);
  let totalCurrentMatches = 0;
  let totalTargetMatches = 0;

  for (const item of sortedPool) {
    const target = getIndividualTarget(item, sortedPool);
    totalCurrentMatches += Math.min(item.matchesPlayed, target);
    totalTargetMatches += target;
  }

  return Math.round((totalCurrentMatches / totalTargetMatches) * 100);
}

/**
 * getNextMatch: Selecteert de ideale matchup op de ladder zonder herhalingen en grote ELO-gaten.
 */
export function getNextMatch<T extends HydratedEntity>(
  pool: EloExtended<T>[]
): [EloExtended<T>, EloExtended<T>] | null {
  if (pool.length < 2) return null;

  const sortedPool = [...pool].sort((a, b) => b.elo - a.elo);

  // Filter op items die hun persoonlijke target nog niet hebben bereikt
  let candidates = sortedPool.filter(e => e.matchesPlayed < getIndividualTarget(e, sortedPool));

  if (candidates.length === 0) {
    return null;
  }

  const minMatches = Math.min(...candidates.map(e => e.matchesPlayed));
  candidates = candidates.filter(e => e.matchesPlayed <= minMatches + 1);

  // Schud de actieve uitdagers willekeurig om vooringenomenheid te voorkomen
  const shuffledChallengers = [...candidates].sort(() => Math.random() - 0.5);

  // Zoek naar een uitdager die een kwalitatief goede match kan krijgen
  for (const challenger of shuffledChallengers) {
    const unplayedOpponents = pool.filter(e => 
      e.id !== challenger.id && 
      !challenger.playedAgainst.includes(e.id) // Harde Swiss-regel: geen rematches
    );

    if (unplayedOpponents.length === 0) continue;

    // Sorteer potentiële tegenstanders op basis van ELO-nabijheid
    const sortedOpponents = unplayedOpponents.sort((a, b) => {
      const eloDiffA = Math.abs(a.elo - challenger.elo);
      const eloDiffB = Math.abs(b.elo - challenger.elo);

      const targetA = getIndividualTarget(a, sortedPool);
      const targetB = getIndividualTarget(b, sortedPool);
      const statusBonusA = a.matchesPlayed < targetA ? 0 : 50;
      const statusBonusB = b.matchesPlayed < targetB ? 0 : 50;

      return (eloDiffA + statusBonusA + Math.random() * 5) - (eloDiffB + statusBonusB + Math.random() * 5);
    });

    const bestOpponent = sortedOpponents[0];
    const eloDelta = Math.abs(challenger.elo - bestOpponent.elo);

    // De Swiss Noodrem
    // Als de dichtstbijzijnde vrije tegenstander een ELO-gat heeft van > 350 punten,
    // dan weigeren we deze oneerlijke match (zoals Nr 1 vs Nr Laatst).
    if (eloDelta > 350) {
      // We markeren deze specifieke uitdager virtueel als 'klaar' voor deze ronde.
      // Hierdoor slaat het algoritme hem nu over en zoekt direct een match voor de rest.
      challenger.matchesPlayed = getIndividualTarget(challenger, sortedPool);
      return getNextMatch(pool); 
    }

    // Kies uit de top 3 meest gelijkwaardige tegenstanders voor een beetje dynamiek
    const poolSize = Math.min(sortedOpponents.length, 3);
    const chosenOpponent = sortedOpponents[Math.floor(Math.random() * poolSize)];

    return [challenger, chosenOpponent];
  }

  return null;
}

export interface SorterStage {
  title: string;
  description: string;
  color: string;
}

/**
 * getSorterStageInfo: Berekent in welke fase het toernooi zich globaal bevindt.
 */
export function getSorterStageInfo<T extends HydratedEntity>(pool: EloExtended<T>[]): SorterStage {
  const N = pool.length;
  if (N === 0) return { title: 'Laden...', description: '', color: '#666666' };

  if (N <= 6) {
    return {
      title: "Volledige Competitie",
      description: "Iedereen speelt exact één keer tegen elkaar voor een 100% sluitende ranglijst.",
      color: "#3182ce"
    };
  }

  if (N <= 32) {
    return {
      title: "Swiss Toernooifase",
      description: "Items van gelijkwaardig niveau strijden tegen elkaar om de hiërarchie te bepalen.",
      color: "#319795"
    };
  }

  const sortedPool = [...pool].sort((a, b) => b.elo - a.elo);
  const activeItems = sortedPool.filter(e => e.matchesPlayed < getIndividualTarget(e, sortedPool));

  if (activeItems.length === 0) {
    return { title: "Voltooid", description: "De ranglijst is opgesteld.", color: "#38a169" };
  }

  const heeftItemsInFase1 = activeItems.some(e => e.matchesPlayed < 2);
  const heeftItemsInFase2 = activeItems.some(e => e.matchesPlayed < 4);

  if (heeftItemsInFase1) {
    return {
      title: "Fase 1: Globale Schifting",
      description: "Alle opties krijgen een basisrating. Minder populaire keuzes worden snel naar de achtergrond gefilterd.",
      color: "#dd6b20"
    };
  } 
  
  if (heeftItemsInFase2) {
    return {
      title: "F2: Positiebepaling",
      description: "De ranglijst krijgt vorm. Het algoritme scheidt de stabiele middenmoot van de potentiële winnaars.",
      color: "#4a5568"
    };
  }

  return {
    title: "Fase 3: De Elite Strijd",
    description: "De absolute koplopers worden intensief tegen elkaar uitgespeeld om de definitieve Top 3/10 te finetunen.",
    color: "#e53e3e"
  };
}