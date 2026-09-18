import { useState, useEffect } from 'react';
import { getGameResults, type GameResultItem } from '../../core/api';
import { getStoredUser } from './useGuessWhoStats';

export interface SorterEntity {
  id: string;
  name: string;
  elo: number;
  rank?: number;
}

export interface SorterRun {
  id: string;
  name: string;
  top5: SorterEntity[];
}

interface RankedItem {
  id: string;
  name: string;
  elo?: number;
  rank?: number;
}

export function useSorterStats(themeId: string) {
  const { userId } = getStoredUser();
  const [sorterRuns, setSorterRuns] = useState<SorterRun[]>([]);
  const [averageTop5, setAverageTop5] = useState<SorterEntity[]>([]);

  useEffect(() => {
    if (!userId) return;

    getGameResults({ userId, themeId })
      .then((results: GameResultItem[]) => {
        if (!results || results.length === 0) return;

        // Filter voor sorter resultaten
        const sorterGames = results.filter(
          (r) => (r.type === 'sorter_finished' || r.type === 'sorter') && r.themeId === themeId
        );

        if (sorterGames.length === 0) return;

        // 1. Individuele runs (top 5 per opgeslagen sorter)
        const runs: SorterRun[] = sorterGames.map((game) => {
          const rawItems = game.data?.rankedItems;
          const rankedItems: RankedItem[] = Array.isArray(rawItems) ? rawItems : [];
          
          const sorted = [...rankedItems].sort((a, b) => (a.rank || 0) - (b.rank || 0));
          
          return {
            id: game._id || game.id || Math.random().toString(),
            name: game.name || 'Sorter Result',
            top5: sorted.slice(0, 5).map((item) => ({
              id: item.id,
              name: item.name,
              elo: item.elo || 0,
              rank: item.rank
            }))
          };
        });
        setSorterRuns(runs);

        // 2. Geaggrementeerde gemiddelde top 5 over alle sorters heen
        const entityStats: Record<string, { name: string; eloSum: number; count: number }> = {};

        sorterGames.forEach((game) => {
          const rawItems = game.data?.rankedItems;
          const rankedItems: RankedItem[] = Array.isArray(rawItems) ? rawItems : [];

          rankedItems.forEach((item) => {
            if (item.id && item.name) {
              if (!entityStats[item.id]) {
                entityStats[item.id] = { name: item.name, eloSum: 0, count: 0 };
              }
              entityStats[item.id].eloSum += item.elo || 0;
              entityStats[item.id].count += 1;
            }
          });
        });

        const computedAverage = Object.entries(entityStats).map(([id, stats]) => ({
          id,
          name: stats.name,
          elo: Math.round(stats.eloSum / stats.count)
        }));

        computedAverage.sort((a, b) => b.elo - a.elo);
        setAverageTop5(computedAverage.slice(0, 5));
      })
      .catch((err: unknown) => {
        console.error("Fout bij ophalen Sorter statistieken:", err);
      });
  }, [userId, themeId]);

  return { sorterRuns, averageTop5 };
}