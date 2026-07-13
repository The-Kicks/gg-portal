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
   * De agressiviteit van de score-aanpassing. 
   * Hoger (bijv. 40) = items stijgen en dalen sneller per stem (snelle kalibratie).
   * Lager (bijv. 16) = stabielere, maar langzamere verschuivingen.
   */
  K_FACTOR: 32,

  /**
   * Grenzen voor de totale poolgrootte (hoeveel items doen er in totaal mee?).
   * SMALL: Tot 6 items speelt iedereen simpelweg 1x tegen iedereen (Round Robin).
   * MEDIUM: Tot 32 items schaalt de matchcount automatisch mee met de logaritme van de pool.
   */
  SMALL_POOL_LIMIT: 6,
  MEDIUM_POOL_LIMIT: 32,

  /**
   * Percentielgrenzen om grotere pools op te splitsen in niveaus (tiers).
   * 0.00 = de absolute bodem van de lijst, 1.00 = de absolute nummer 1 van de lijst.
   * BOTTOM: De onderste 30% van de ranglijst.
   * MIDDLE: De middenmoot (alles tussen de 30% en 50%). Everything boven 50% is de 'Elite'.
   */
  BOTTOM_TIER_PERCENTILE: 0.30,
  MIDDLE_TIER_PERCENTILE: 0.50,

  /**
   * Target matches: Hoe vaak moet een individueel item minimaal vechten?
   * BOTTOM: Weinig matches (3), want als iets onderaan bungelt hoeven we niet te verfijnen of het #98 of #99 is.
   * MIDDLE: Gemiddeld (5) voor een redelijk stabiele positie in de middenmoot.
   * ELITE: Hoog (8), omdat de top 50% loepzuiver tegen elkaar uitgevochten moet worden voor de perfecte top 10.
   */
  BOTTOM_TIER_MATCHES: 3,
  MIDDLE_TIER_MATCHES: 5,
  ELITE_TIER_MATCHES: 8,

  /**
   * Matchmaking: Voorkom oneerlijke matches.
   * Als het Elo-verschil groter is dan dit getal, weigert de computer de match.
   * Dit voorkomt dat je een absolute topfavoriet moet vergelijken met een kansloze verliezer.
   */
  MAX_ELO_DELTA: 350,

  /**
   * Matchmaking variatie: De grootte van de grabbelton.
   * De computer berekent de beste tegenstanders, pakt de top 'N' en kiest er willekeurig één.
   * 1 = Geen variatie, altijd de mathematisch perfecte match (kan saai/herhalend aanvoelen).
   * 5 = Veel variatie, de matches voelen dynamischer, maar de wiskundige precisie zakt iets.
   */
  OPPONENT_POOL_SIZE: 3,

  /**
   * Matchmaking anti-lock: Een minieme willekeurige ruis (0 tot 5) bij het vergelijken.
   * Dit breekt gelijke standen (zoals aan het begin van het toernooi als iedereen nog 1200 Elo heeft)
   * zodat de computer niet in een oneindige loop vastloopt op identieke waardes.
   */
  JITTER_RANGE: 5,

  /**
   * Matchmaking prioriteit: De "laat-me-met-rust-boete".
   * Als een item zijn target aantal matches al heeft gehaald, krijgt hij virtueel deze 
   * punten opgeteld bij zijn Elo-verschil. Hierdoor kiest het algoritme hem minder snel,
   * waardoor items die nog matches *nodig* hebben voorrang krijgen.
   */
  COMPLETED_TARGET_PENALTY: 50,
};

// Backwards compatibility voor andere componenten die INITIAL_ELO rechtstreeks importeren
export const INITIAL_ELO = SORTER_SETTINGS.INITIAL_ELO;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
export type EloExtended<T> = T & {
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  playedAgainst: string[];
};

export interface SorterStage {
  title: string;
  description: string;
  color: string;
}

// ============================================================================
// FUNCTIES
// ============================================================================

export function calculateElo(ratingA: number, ratingB: number, outcome: 'A' | 'B') {
  const expectedA: number = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB: number = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  const actualA: number = outcome === 'A' ? 1 : 0;
  const actualB: number = outcome === 'B' ? 1 : 0;

  return {
    newRatingA: Math.round(ratingA + SORTER_SETTINGS.K_FACTOR * (actualA - expectedA)),
    newRatingB: Math.round(ratingB + SORTER_SETTINGS.K_FACTOR * (actualB - expectedB)),
  };
}

/**
 * Bepaalt dynamisch hoeveel matches een individueel item moet spelen op basis van de settings.
 */
export function getIndividualTarget<T extends HydratedEntity>(
  item: EloExtended<T>,
  sortedPool: EloExtended<T>[]
): number {
  const N = sortedPool.length;

  if (N <= SORTER_SETTINGS.SMALL_POOL_LIMIT) return N - 1; 
  if (N <= SORTER_SETTINGS.MEDIUM_POOL_LIMIT) return Math.min(Math.ceil(2 * Math.log2(N)), N - 1); 

  const rankIndex = sortedPool.findIndex(e => e.id === item.id);
  const percentile = 1 - (rankIndex / N); // 1.0 = #1, 0.0 = laatste

  if (percentile < SORTER_SETTINGS.BOTTOM_TIER_PERCENTILE) {
    return SORTER_SETTINGS.BOTTOM_TIER_MATCHES;
  }
  
  if (percentile < SORTER_SETTINGS.MIDDLE_TIER_PERCENTILE) {
    return SORTER_SETTINGS.MIDDLE_TIER_MATCHES;
  }

  return SORTER_SETTINGS.ELITE_TIER_MATCHES;
}

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

export function getNextMatch<T extends HydratedEntity>(
  pool: EloExtended<T>[]
): [EloExtended<T>, EloExtended<T>] | null {
  if (pool.length < 2) return null;

  const sortedPool = [...pool].sort((a, b) => b.elo - a.elo);
  let candidates = sortedPool.filter(e => e.matchesPlayed < getIndividualTarget(e, sortedPool));

  if (candidates.length === 0) return null;

  const minMatches = Math.min(...candidates.map(e => e.matchesPlayed));
  candidates = candidates.filter(e => e.matchesPlayed <= minMatches + 1);

  const shuffledChallengers = [...candidates].sort(() => Math.random() - 0.5);

  for (const challenger of shuffledChallengers) {
    const unplayedOpponents = pool.filter(e => 
      e.id !== challenger.id && 
      !challenger.playedAgainst.includes(e.id)
    );

    if (unplayedOpponents.length === 0) continue;

    const sortedOpponents = unplayedOpponents.sort((a, b) => {
      const eloDiffA = Math.abs(a.elo - challenger.elo);
      const eloDiffB = Math.abs(b.elo - challenger.elo);

      const targetA = getIndividualTarget(a, sortedPool);
      const targetB = getIndividualTarget(b, sortedPool);
      const statusBonusA = a.matchesPlayed < targetA ? 0 : SORTER_SETTINGS.COMPLETED_TARGET_PENALTY;
      const statusBonusB = b.matchesPlayed < targetB ? 0 : SORTER_SETTINGS.COMPLETED_TARGET_PENALTY;

      const weightA = eloDiffA + statusBonusA + Math.random() * SORTER_SETTINGS.JITTER_RANGE;
      const weightB = eloDiffB + statusBonusB + Math.random() * SORTER_SETTINGS.JITTER_RANGE;

      return weightA - weightB;
    });

    const bestOpponent = sortedOpponents[0];
    const eloDelta = Math.abs(challenger.elo - bestOpponent.elo);

    // Als het gat te groot is, vlaggen we deze challenger als 'klaar' voor deze ronde om oneindige loops te voorkomen
    if (eloDelta > SORTER_SETTINGS.MAX_ELO_DELTA) {
      challenger.matchesPlayed = getIndividualTarget(challenger, sortedPool);
      return getNextMatch(pool); 
    }

    const poolSize = Math.min(sortedOpponents.length, SORTER_SETTINGS.OPPONENT_POOL_SIZE);
    const chosenOpponent = sortedOpponents[Math.floor(Math.random() * poolSize)];

    return [challenger, chosenOpponent];
  }

  return null;
}

export function getSorterStageInfo<T extends HydratedEntity>(pool: EloExtended<T>[]): SorterStage {
  const N = pool.length;
  if (N === 0) return { title: 'Loading...', description: '', color: '#666666' };

  if (N <= SORTER_SETTINGS.SMALL_POOL_LIMIT) {
    return {
      title: "Full Round Robin",
      description: "Every item plays each other exactly once.",
      color: "#3182ce"
    };
  }

  const sortedPool = [...pool].sort((a, b) => b.elo - a.elo);
  const activeItems = sortedPool.filter(e => e.matchesPlayed < getIndividualTarget(e, sortedPool));

  if (activeItems.length === 0) {
    return { title: "Completed", description: "The definitive ranking has been generated.", color: "#38a169" };
  }

  const hasItemsInStage1 = activeItems.some(e => e.matchesPlayed < SORTER_SETTINGS.BOTTOM_TIER_MATCHES);
  const hasItemsInStage2 = activeItems.some(e => e.matchesPlayed < SORTER_SETTINGS.MIDDLE_TIER_MATCHES);

  if (hasItemsInStage1) {
    return {
      title: "Stage 1: Global Screening",
      description: "Trying to define bottom tier",
      color: "#dd6b20"
    };
  } 
  
  if (hasItemsInStage2) {
    return {
      title: "Stage 2: Position Seeding",
      description: "Forming a top %",
      color: "#4a5568"
    };
  }

  return {
    title: "Stage 3: Elite Championship",
    description: "Battling out the ultimate top",
    color: "#e53e3e"
  };
}