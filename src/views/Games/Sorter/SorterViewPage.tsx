import { useState, useMemo, useEffect } from 'react';
import type { Theme, HydratedEntity, BaseEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { INITIAL_ELO, processMatch, getNextMatch } from './eloUtils';
import { extractMediaUrls, getGroupIdsFromTheme } from './sorterUtils';
import { SorterView } from './SorterView';
import { SorterResultsOverlay } from './SorterResultsOverlay';
import { useSorterKeybinds } from './useSorterKeybinds';
import styles from './SorterCSS/SorterSetup.module.css';

export type SorterEntity = HydratedEntity;

interface SorterViewPageProps {
  theme: Theme;
}

interface SorterSaveData {
  includedGroupIds: string[];
  tournamentList: EloExtended<SorterEntity>[];
  history: [EloExtended<SorterEntity>, EloExtended<SorterEntity>][];
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

  // --- GLOBAL PERMANENT FAVORITES ---
  const [globalFavorites, setGlobalFavorites] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(favoritesStorageKey);
    return saved ? JSON.parse(saved) : {};
  });

  // --- ACTIVE SORTER RUNTIME STATES ---
  const [tournamentList, setTournamentList] = useState<EloExtended<SorterEntity>[]>([]);
  const [history, setHistory] = useState<[EloExtended<SorterEntity>, EloExtended<SorterEntity>][]>([]);
  const [hasSave, setHasSave] = useState<boolean>(() => localStorage.getItem(storageKey) !== null);

  // --- PRESENTATION & INTERACTION STATES ---
  const [leftMediaIndex, setLeftMediaIndex] = useState<number>(0);
  const [rightMediaIndex, setRightMediaIndex] = useState<number>(0);
  const [hoveredAction, setHoveredAction] = useState<string>('Hover over a key to see its function');
  const [showResultsOverlay, setShowResultsOverlay] = useState<boolean>(false);

  // Reset indices & sync bij matchup wissel
  const [prevLeftId, setPrevLeftId] = useState<string>('');
  const [prevRightId, setPrevRightId] = useState<string>('');

  if (history.length) {
    const [leftItem, rightItem] = history.at(-1)!;
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
      tournamentList,
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
      setHistory(data.history);
    } catch (error) {
      console.error('Failed to parse sorter save game', error);
    }
  };

  const handleStartSorter = (): void => {
    setTournamentList(activeMatchCandidates);

    const A: EloExtended<SorterEntity> = activeMatchCandidates.at(Math.floor(Math.random() * activeMatchCandidates.length))!;
    const B: EloExtended<SorterEntity> = activeMatchCandidates.filter((e: EloExtended<SorterEntity>) => e !== A).at(Math.floor(Math.random() * (activeMatchCandidates.length - 1)))!;
    setHistory([[A,B]]);
  };

  const handleProcessVote = (winner: 'A' | 'B'): void => {
    if (!history.length) return;

    const [leftItem, rightItem] = history.at(-1)!;
    // Snapshot the pre-vote entities so handleUndo can restore them later
    const snapshot: [EloExtended<SorterEntity>, EloExtended<SorterEntity>] = [{ ...leftItem }, { ...rightItem }];

    processMatch(leftItem, rightItem, winner);
    const nextMatch = getNextMatch(tournamentList)!;

    setHistory((prevHistory) => {
      const newHistory = [...prevHistory];
      newHistory[newHistory.length - 1] = snapshot;
      newHistory.push(nextMatch);
      return newHistory;
    });
  };

  const handleUndo = (): void => {
    if (history.length <= 1) return;

    // The matchup we're returning to still holds its pre-vote snapshot
    const [leftItem, rightItem] = history.at(-2)!;

    setHistory((prevHistory) => {
      const newHistory = [...prevHistory];
      newHistory.pop();
      return newHistory;
    });

    setTournamentList((prevList) =>
      prevList.map((e) =>
        e.id === leftItem.id ? leftItem : e.id === rightItem.id ? rightItem : e
      )
    );
  };

  // --- MEDIA COMPONENT GENERATION ---
  const mediaCalculation = useMemo(() => {
    if (!history.length) return null;
    const [leftItem, rightItem] = history.at(-1)!;

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
  }, [history, leftMediaIndex, rightMediaIndex, theme, globalFavorites]);

  const toggleFavorite = (side: 'left' | 'right') => {
    if (!history.length || !mediaCalculation) return;
    const [leftItem, rightItem] = history.at(-1)!;
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

  // Put the favorite first without removing it from the rest of the list
  const extractMediaWithFavorite = (entity: SorterEntity): string[] => {
    const rawMedia = extractMediaUrls(entity, theme);
    const fav = globalFavorites[entity.id];
    if (fav && rawMedia.includes(fav)) {
      return [fav, ...rawMedia];
    }
    return rawMedia;
  };

  // --- BIND CUSTOM KEYBOARD HOOK ---
  useSorterKeybinds({
    onProcessVote: handleProcessVote,
    onUndo: handleUndo,
    canUndo: history.length > 1,
    toggleFavorite,
    leftItemMedia: mediaCalculation?.leftItemMedia || [],
    rightItemMedia: mediaCalculation?.rightItemMedia || [],
    currentLeftMediaUrl: mediaCalculation?.currentLeftMediaUrl || '',
    currentRightMediaUrl: mediaCalculation?.currentRightMediaUrl || '',
    setLeftMediaIndex,
    setRightMediaIndex,
    enabled: !showResultsOverlay,
  });

  // --- RENDER ROUTING ---
  if (!history.length) {
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

  return (
    <>
      <SorterView
        theme={theme}
        tournamentList={tournamentList}
        currentMatchup={history.at(-1)!}
        voteCount={history.length}
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
        canUndo={history.length > 1}
        onSave={handleSave}
        toggleFavorite={toggleFavorite}
        onOpenResults={() => setShowResultsOverlay(true)}
      />

      {showResultsOverlay && (
        <SorterResultsOverlay
          theme={theme}
          finalPool={tournamentList}
          extractMediaUrls={extractMediaWithFavorite}
          onClose={() => setShowResultsOverlay(false)}
        />
      )}
    </>
  );
}