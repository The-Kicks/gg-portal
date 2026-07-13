import { useState, useMemo, useEffect } from 'react';
import type { Theme, HydratedEntity, BaseEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { INITIAL_ELO, calculateElo, getNextMatch } from './eloUtils';
import { extractMediaUrls, shuffleArray, getGroupIdsFromTheme } from './sorterUtils';
import { SorterView } from './SorterView';
import { SorterResultsView } from './SorterResultsView';
import { useSorterKeybinds } from './useSorterKeybinds';
import styles from './SorterCSS/SorterSetup.module.css';

export type SorterEntity = HydratedEntity;

interface SorterViewPageProps {
  theme: Theme;
}

interface SorterHistorySnapshot {
  tournamentList: EloExtended<SorterEntity>[];
  currentMatchup: [EloExtended<SorterEntity>, EloExtended<SorterEntity>];
  voteCount: number;
}

interface SorterSaveData {
  includedGroupIds: string[];
  isSorterActive: boolean;
  tournamentList: EloExtended<SorterEntity>[];
  currentMatchup: [EloExtended<SorterEntity>, EloExtended<SorterEntity>] | null;
  voteCount: number;
  history: SorterHistorySnapshot[];
}

export function SorterViewPage({ theme }: SorterViewPageProps) {
  const storageKey = `sorter_save_${theme.id}`;
  const favoritesStorageKey = `sorter_favorites_${theme.id}`;

  // --- BASE STATES & MEMOS ---
  const entitiesWithEloState = useMemo<EloExtended<SorterEntity>[]>(() => {
    const allEntities = theme.entities || [];
    return allEntities.map((entity: HydratedEntity) => ({
      ...entity,
      elo: INITIAL_ELO,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      playedAgainst: [],
    }));
  }, [theme.entities]);

  const rankableItems = useMemo<EloExtended<SorterEntity>[]>(() => {
    return entitiesWithEloState.filter((entity) => entity.type === 'l4');
  }, [entitiesWithEloState]);

  const filterCategories = useMemo(() => {
    const l1Map = new Map<string, BaseEntity>();
    const l2Map = new Map<string, BaseEntity>();
    const l3Map = new Map<string, BaseEntity>();

    rankableItems.forEach((item) => {
      item.targetConnections?.forEach((connection) => {
        const connectedParent = connection.sourceEntity;
        if (!connectedParent) return;
        if (connectedParent.type === 'l1') l1Map.set(connectedParent.id, connectedParent);
        if (connectedParent.type === 'l2') l2Map.set(connectedParent.id, connectedParent);
        if (connectedParent.type === 'l3') l3Map.set(connectedParent.id, connectedParent);
      });
    });

    return {
      l1: Array.from(l1Map.values()),
      l2: Array.from(l2Map.values()),
      l3: Array.from(l3Map.values()),
    };
  }, [rankableItems]);

  const allGroupIds = useMemo<string[]>(() => {
    return [
      ...filterCategories.l1,
      ...filterCategories.l2,
      ...filterCategories.l3,
    ].map((group) => group.id);
  }, [filterCategories]);

  // --- UI STATES ---
  const [includedGroupIds, setIncludedGroupIds] = useState<string[]>(() => getGroupIdsFromTheme(theme));
  const [isSorterActive, setIsSorterActive] = useState<boolean>(false);

  // --- GLOBAL PERMANENT FAVORITES ---
  const [globalFavorites, setGlobalFavorites] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(favoritesStorageKey);
    return saved ? JSON.parse(saved) : {};
  });

  // --- ACTIVE SORTER RUNTIME STATES ---
  const [tournamentList, setTournamentList] = useState<EloExtended<SorterEntity>[]>([]);
  const [currentMatchup, setCurrentMatchup] = useState<[EloExtended<SorterEntity>, EloExtended<SorterEntity>] | null>(null);
  const [voteCount, setVoteCount] = useState<number>(0);
  const [history, setHistory] = useState<SorterHistorySnapshot[]>([]);
  const [hasSave, setHasSave] = useState<boolean>(() => localStorage.getItem(storageKey) !== null);

  // --- PRESENTATION & INTERACTION STATES ---
  const [leftMediaIndex, setLeftMediaIndex] = useState<number>(0);
  const [rightMediaIndex, setRightMediaIndex] = useState<number>(0);
  const [hoveredAction, setHoveredAction] = useState<string>('Hover over a key to see its function');

  // Reset indices & sync bij matchup wissel
  const [prevLeftId, setPrevLeftId] = useState<string>('');
  const [prevRightId, setPrevRightId] = useState<string>('');

  if (currentMatchup) {
    const [leftItem, rightItem] = currentMatchup;
    if (leftItem.id !== prevLeftId) {
      setPrevLeftId(leftItem.id);
      setLeftMediaIndex(0);
    }
    if (rightItem.id !== prevRightId) {
      setPrevRightId(rightItem.id);
      setRightMediaIndex(0);
    }
  }

  // Synchroniseer state als het thema verandert
  const [prevTheme, setPrevTheme] = useState<Theme>(theme);
  if (theme !== prevTheme) {
    setPrevTheme(theme);
    setIncludedGroupIds(getGroupIdsFromTheme(theme));
    setHasSave(localStorage.getItem(`sorter_save_${theme.id}`) !== null);
    
    const savedFavs = localStorage.getItem(`sorter_favorites_${theme.id}`);
    setGlobalFavorites(savedFavs ? JSON.parse(savedFavs) : {});
  }

  // SCROLL LOCK
  useEffect(() => {
    const appContainerEl = document.querySelector('.app-container');
    if (appContainerEl) {
      (appContainerEl as HTMLElement).style.height = '100vh';
      (appContainerEl as HTMLElement).style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (appContainerEl) {
        (appContainerEl as HTMLElement).style.height = '';
        (appContainerEl as HTMLElement).style.overflow = '';
      }
      document.body.style.overflow = '';
    };
  }, []);

  // --- HANDLERS ---
  const handleToggleInclusion = (id: string): void => {
    setIncludedGroupIds((prevIds) =>
      prevIds.includes(id) ? prevIds.filter((itemId) => itemId !== id) : [...prevIds, id]
    );
  };

  const activeMatchCandidates = useMemo<EloExtended<SorterEntity>[]>(() => {
    return rankableItems.filter((item) => {
      const connectedParentIds = item.targetConnections?.map((conn) => conn.sourceEntityId) || [];
      return connectedParentIds.some((parentId) => includedGroupIds.includes(parentId));
    });
  }, [rankableItems, includedGroupIds]);

  const handleSave = (): void => {
    const saveData: SorterSaveData = {
      includedGroupIds,
      isSorterActive,
      tournamentList,
      currentMatchup,
      voteCount,
      history,
    };
    localStorage.setItem(storageKey, JSON.stringify(saveData));
    setHasSave(true);
  };

  const handleLoad = (): void => {
    const savedRaw = localStorage.getItem(storageKey);
    if (!savedRaw) return;
    try {
      const data = JSON.parse(savedRaw) as SorterSaveData;
      setIncludedGroupIds(data.includedGroupIds);
      setTournamentList(data.tournamentList);
      setCurrentMatchup(data.currentMatchup);
      setVoteCount(data.voteCount);
      setHistory(data.history || []);
      setIsSorterActive(data.isSorterActive);
    } catch (error) {
      console.error('Failed to parse sorter save game', error);
    }
  };

  const handleStartSorter = (): void => {
    const scrambledSelection = shuffleArray(activeMatchCandidates);
    setHistory([]);
    setTournamentList(scrambledSelection);
    setCurrentMatchup(getNextMatch(scrambledSelection));
    setIsSorterActive(true);
  };

  const handleProcessVote = (winner: 'A' | 'B'): void => {
    if (!currentMatchup) return;
    const [leftItem, rightItem] = currentMatchup;

    setHistory((prevHistory) => [
      ...prevHistory,
      {
        tournamentList,
        currentMatchup: [...currentMatchup] as [EloExtended<SorterEntity>, EloExtended<SorterEntity>],
        voteCount,
      },
    ]);

    const { newRatingA, newRatingB } = calculateElo(leftItem.elo, rightItem.elo, winner);

    const updatedList = tournamentList.map((item) => {
      if (item.id === leftItem.id) {
        return {
          ...item,
          elo: newRatingA,
          matchesPlayed: item.matchesPlayed + 1,
          wins: item.wins + (winner === 'A' ? 1 : 0),
          losses: item.losses + (winner === 'A' ? 0 : 1),
          playedAgainst: [...item.playedAgainst, rightItem.id],
        };
      }
      if (item.id === rightItem.id) {
        return {
          ...item,
          elo: newRatingB,
          matchesPlayed: item.matchesPlayed + 1,
          wins: item.wins + (winner === 'B' ? 1 : 0),
          losses: item.losses + (winner === 'B' ? 0 : 1),
          playedAgainst: [...item.playedAgainst, leftItem.id],
        };
      }
      return item;
    });

    setTournamentList(updatedList);
    setVoteCount((prev) => prev + 1);
    setCurrentMatchup(getNextMatch(updatedList));
  };

  const handleUndo = (): void => {
    if (history.length === 0) return;
    setHistory((prevHistory) => {
      const newHistory = [...prevHistory];
      const previousState = newHistory.pop();
      if (previousState) {
        setTournamentList(previousState.tournamentList);
        setCurrentMatchup(previousState.currentMatchup);
        setVoteCount(previousState.voteCount);
      }
      return newHistory;
    });
  };

  // --- MEDIA COMPONENT GENERATION ---
  const mediaCalculation = useMemo(() => {
    if (!currentMatchup) return null;
    const [leftItem, rightItem] = currentMatchup;

    const currentLeftFav = globalFavorites[leftItem.id] || '';
    const currentRightFav = globalFavorites[rightItem.id] || '';

    const rawLeftMedia = extractMediaUrls(leftItem, theme);
    const rawRightMedia = extractMediaUrls(rightItem, theme);

    // PASSED: We voegen de favoriet toe aan het begin zónder hem uit de originele lijst te filteren (Dupliceren)
    const leftItemMedia = currentLeftFav && rawLeftMedia.includes(currentLeftFav)
      ? [currentLeftFav, ...rawLeftMedia]
      : rawLeftMedia;

    const rightItemMedia = currentRightFav && rawRightMedia.includes(currentRightFav)
      ? [currentRightFav, ...rawRightMedia]
      : rawRightMedia;

    const currentLeftMediaUrl = leftItemMedia[leftMediaIndex] || '';
    const currentRightMediaUrl = rightItemMedia[rightMediaIndex] || '';

    return {
      leftItemMedia,
      rightItemMedia,
      currentLeftMediaUrl,
      currentRightMediaUrl,
      currentLeftFav,
      currentRightFav,
    };
  }, [currentMatchup, leftMediaIndex, rightMediaIndex, theme, globalFavorites]);

  const toggleFavorite = (side: 'left' | 'right') => {
    if (!currentMatchup || !mediaCalculation) return;
    const [leftItem, rightItem] = currentMatchup;
    const { currentLeftMediaUrl, currentRightMediaUrl, currentLeftFav, currentRightFav } = mediaCalculation;

    const isLeft = side === 'left';
    const targetItem = isLeft ? leftItem : rightItem;
    const currentMediaUrl = isLeft ? currentLeftMediaUrl : currentRightMediaUrl;
    const currentFav = isLeft ? currentLeftFav : currentRightFav;

    if (!currentMediaUrl) return;

    const nextFav = currentFav === currentMediaUrl ? '' : currentMediaUrl;

    setGlobalFavorites((prev) => {
      const updated = { ...prev };
      if (nextFav) {
        updated[targetItem.id] = nextFav;
      } else {
        delete updated[targetItem.id];
      }
      localStorage.setItem(favoritesStorageKey, JSON.stringify(updated));
      return updated;
    });

    if (isLeft) {
      setLeftMediaIndex(0);
    } else {
      setRightMediaIndex(0);
    }
  };

  // --- BIND CUSTOM KEYBOARD HOOK ---
  useSorterKeybinds({
    onProcessVote: handleProcessVote,
    onUndo: handleUndo,
    canUndo: history.length > 0,
    toggleFavorite,
    leftItemMedia: mediaCalculation?.leftItemMedia || [],
    rightItemMedia: mediaCalculation?.rightItemMedia || [],
    currentLeftMediaUrl: mediaCalculation?.currentLeftMediaUrl || '',
    currentRightMediaUrl: mediaCalculation?.currentRightMediaUrl || '',
    setLeftMediaIndex,
    setRightMediaIndex,
  });

  // --- RENDER ROUTING ---
  if (!isSorterActive) {
    return (
      <div className={styles.optionsContainer}>
        <h2 className={styles.title}>{theme.title} Sorter</h2>
        <p className={styles.description}>Select the options below to include them in your rating pool.</p>

        <div className={styles.bulkActions}>
          <button type="button" onClick={() => setIncludedGroupIds(allGroupIds)} className={styles.actionButton}>
            Select All
          </button>
          <button type="button" onClick={() => setIncludedGroupIds([])} className={styles.actionButton}>
            Unselect All
          </button>
          {hasSave && (
            <button type="button" onClick={handleLoad} className={`${styles.actionButton} ${styles.resumeButton}`}>
              📂 Resume Saved Session
            </button>
          )}
        </div>

        {(['l1', 'l2', 'l3'] as const).map((layerKey) => {
          const categories = filterCategories[layerKey];
          if (!categories || categories.length === 0) return null;
          return (
            <div key={layerKey} className={styles.filterSection}>
              <h3 className={styles.sectionTitle}>{theme.labels[layerKey] || `Layer ${layerKey}`}</h3>
              <div className={styles.grid}>
                {categories.map((group) => (
                  <label key={group.id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={includedGroupIds.includes(group.id)}
                      onChange={() => handleToggleInclusion(group.id)}
                    />
                    <span className={styles.groupName}>{group.name}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        <button
          onClick={handleStartSorter}
          disabled={activeMatchCandidates.length < 2}
          className={styles.startButton}
        >
          Start New Sorter ({activeMatchCandidates.length} items remaining)
        </button>
      </div>
    );
  }

  if (isSorterActive && !currentMatchup) {
    localStorage.removeItem(storageKey);
    return (
      <SorterResultsView
        theme={theme}
        finalPool={tournamentList}
        // PASSED: Ook hier dupliceren we de favoriet naar plek 1 zonder hem uit de rest van de lijst te halen
        extractMediaUrls={(entity: SorterEntity) => {
          const rawMedia = extractMediaUrls(entity, theme);
          const fav = globalFavorites[entity.id];
          if (fav && rawMedia.includes(fav)) {
            return [fav, ...rawMedia];
          }
          return rawMedia;
        }}
        onRestart={() => window.location.reload()}
      />
    );
  }

  return (
    <SorterView
      theme={theme}
      tournamentList={tournamentList}
      currentMatchup={currentMatchup!}
      voteCount={voteCount}
      leftItemMedia={mediaCalculation!.leftItemMedia}
      rightItemMedia={mediaCalculation!.rightItemMedia}
      currentLeftMediaUrl={mediaCalculation!.currentLeftMediaUrl}
      currentRightMediaUrl={mediaCalculation!.currentRightMediaUrl}
      currentLeftFav={mediaCalculation!.currentLeftFav}
      currentRightFav={mediaCalculation!.currentRightFav}
      leftMediaIndex={leftMediaIndex}
      rightMediaIndex={rightMediaIndex}
      hoveredAction={hoveredAction}
      setLeftMediaIndex={setLeftMediaIndex}
      setRightMediaIndex={setRightMediaIndex}
      setHoveredAction={setHoveredAction}
      onProcessVote={handleProcessVote}
      onUndo={handleUndo}
      canUndo={history.length > 0}
      onSave={handleSave}
      toggleFavorite={toggleFavorite}
    />
  );
}