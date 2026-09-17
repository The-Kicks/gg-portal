import { useState, useEffect } from 'react';
import { getGameResults, type GameResultItem } from '../../core/api';
import { getStoredUser } from './useGuessWhoStats';

export interface BlindRankingTopItem {
  id: string;
  name: string;
  averageRank: number;
  appearances: number;
}

export function useBlindRankingStats(themeId: string) {
  const { userId } = getStoredUser();
  const [topBlindRankingItems, setTopBlindRankingItems] = useState<BlindRankingTopItem[]>([]);

  useEffect(() => {
    if (!userId) return;

    getGameResults({ userId, themeId, type: 'blindranking' })
      .then((results: GameResultItem[]) => {
        if (!results || results.length === 0) return;

        const games = results.filter((r: GameResultItem) => r.type === 'blindranking' && r.themeId === themeId);
        if (games.length === 0) return;

        // Houd bij hoe vaak items in de top 3 stonden en wat de som van hun ranks was
        const itemStats: Record<string, { name: string; rankSum: number; count: number }> = {};

        games.forEach((game) => {
          const rankedItems = game.data?.rankedItems;
          if (Array.isArray(rankedItems)) {
            rankedItems.forEach((item: { id: string; name: string; rank: number }) => {
              if (item.rank <= 3 && item.id) {
                if (!itemStats[item.id]) {
                  itemStats[item.id] = { name: item.name, rankSum: 0, count: 0 };
                }
                itemStats[item.id].rankSum += item.rank;
                itemStats[item.id].count += 1;
              }
            });
          }
        });

        // Bereken gemiddelde positie en sorteer op populariteit/hoogste positie
        const computedTop = Object.entries(itemStats).map(([id, stats]) => ({
          id,
          name: stats.name,
          averageRank: Number((stats.rankSum / stats.count).toFixed(1)),
          appearances: stats.count
        }));

        computedTop.sort((a, b) => {
          if (b.appearances !== a.appearances) {
            return b.appearances - a.appearances; // Wie het vaakst in de top 3 stond
          }
          return a.averageRank - b.averageRank; // Laagste gemiddelde rank (1 is het best)
        });

        setTopBlindRankingItems(computedTop.slice(0, 3));
      })
      .catch((err: unknown) => {
        console.error("Fout bij ophalen Blind Ranking statistieken:", err);
      });
  }, [userId, themeId]);

  return { topBlindRankingItems };
}