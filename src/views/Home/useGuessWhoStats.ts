import { useState, useEffect } from 'react';
import { getGameResults, type GameResultItem } from '../../core/api';

export interface GuessWhoStats {
  gamesPlayed: number;
  averageGuesses: number;
  hintsUsed: number;
  gaveUp: number;
  mostGuessedEntity: string;
  mostGuessedCount: number;
}

interface UserStorageObject {
  username?: string;
  id?: string;
  _id?: string;
}

export const getStoredUser = (): { username: string; userId: string } => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr) as UserStorageObject;
      return {
        username: typeof userObj.username === 'string' ? userObj.username : '',
        userId: userObj.id || userObj._id || localStorage.getItem('userId') || ''
      };
    } catch (err: unknown) {
      console.error("Fout bij het uitlezen van gebruikersgegevens:", err);
    }
  }
  return {
    username: '',
    userId: localStorage.getItem('userId') || ''
  };
};

export function useGuessWhoStats(themeId: string) {
  const { username, userId } = getStoredUser();

  const [guessWhoStats, setGuessWhoStats] = useState<GuessWhoStats>({
    gamesPlayed: 0,
    averageGuesses: 0,
    hintsUsed: 0,
    gaveUp: 0,
    mostGuessedEntity: 'Nog niet gespeeld',
    mostGuessedCount: 0
  });

  useEffect(() => {
    if (!userId) return;

    getGameResults({ userId, themeId, type: 'guesswho' })
      .then((results: GameResultItem[]) => {
        if (!results || results.length === 0) return;

        const games = results.filter((r: GameResultItem) => r.type === 'guesswho' && r.themeId === themeId);
        const gamesPlayed = games.length;

        if (gamesPlayed === 0) return;

        let totalGuesses = 0;
        let hintsUsed = 0;
        let gaveUp = 0;
        const entityCounts: Record<string, number> = {};

        games.forEach((game: GameResultItem) => {
          const data = game.data;
          if (data.result === 'gave_up') {
            gaveUp++;
          } else {
            totalGuesses += Number(data.guessesCount) || 0;
            
            if (typeof data.secretEntityName === 'string' && data.secretEntityName.trim() !== '') {
              entityCounts[data.secretEntityName] = (entityCounts[data.secretEntityName] || 0) + 1;
            }
          }
          hintsUsed += Number(data.hintsUsed) || 0;
        });

        let topEntity = 'Nog geen winstpartijen';
        let topCount = 0;

        Object.entries(entityCounts).forEach(([name, count]) => {
          if (count > topCount) {
            topCount = count;
            topEntity = name;
          }
        });

        const successfulGames = gamesPlayed - gaveUp;
        const averageGuesses = successfulGames > 0 ? Number((totalGuesses / successfulGames).toFixed(1)) : 0;

        setGuessWhoStats({
          gamesPlayed,
          averageGuesses,
          hintsUsed,
          gaveUp,
          mostGuessedEntity: topEntity,
          mostGuessedCount: topCount
        });
      })
      .catch((err: unknown) => {
        console.error("Fout bij het ophalen van Guess Who statistieken:", err);
      });
  }, [userId, themeId]);

  return { username, userId, guessWhoStats };
}