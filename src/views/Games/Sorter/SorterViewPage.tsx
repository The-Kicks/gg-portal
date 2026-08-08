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

export interface MediaCategoryGroup {
  key: string;
  label: string;
  urls: string[];
}

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

  const [includedGroupIds, setIncludedGroupIds] = useState<string[]>(() => getGroupIdsFromTheme(theme));

  const [globalFavorites, setGlobalFavorites] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem(favoritesStorageKey);
    return saved ? JSON.parse(saved) : {};
  });

  const [tournamentList, setTournamentList] = useState<EloExtended<SorterEntity>[]>([]);
  const [history, setHistory] = useState<[EloExtended<SorterEntity>, EloExtended<SorterEntity>][]>([]);
  const [hasSave, setHasSave] = useState<boolean>(() => localStorage.getItem(storageKey) !== null);

  const [leftMediaIndex, setLeftMediaIndex] = useState<number>(0);
  const [rightMediaIndex, setRightMediaIndex] = useState<number>(0);
  
  const [activeLeftMediaCategory, setActiveLeftMediaCategory] = useState<string | null>(null);
  const [activeRightMediaCategory, setActiveRightMediaCategory] = useState<string | null>(null);

  const [hoveredAction, setHoveredAction] = useState<string>('Hover over a key to see its function');
  const [showResultsOverlay, setShowResultsOverlay] = useState<boolean>(false);

  const [prevLeftId, setPrevLeftId] = useState<string>('');
  const [prevRightId, setPrevRightId] = useState<string>('');

  if (history.length) {
    const [leftItem, rightItem] = history.at(-1)!;
    if (leftItem.id !== prevLeftId) {
      setPrevLeftId(leftItem.id);
      setLeftMediaIndex(0);
      setActiveLeftMediaCategory(null);
    }
    if (rightItem.id !== prevRightId) {
      setPrevRightId(rightItem.id);
      setRightMediaIndex(0);
      setActiveRightMediaCategory(null);
    }
  }

  const [prevTheme, setPrevTheme] = useState<Theme>(theme);
  if (theme !== prevTheme) {
    setPrevTheme(theme);
    setIncludedGroupIds(getGroupIdsFromTheme(theme));
    setHasSave(localStorage.getItem(`sorter_save_${theme.id}`) !== null);
    
    const savedFavs = localStorage.getItem(`sorter_favorites_${theme.id}`);
    setGlobalFavorites(savedFavs ? JSON.parse(savedFavs) : {});
  }

  useEffect(() => {
    const appContainerEl = document.querySelector('.app-container');
    const optionsContainerEl = document.querySelector(`.${styles.optionsContainer}`);
    const isSetup = history.length === 0;

    if (appContainerEl) {
      (appContainerEl as HTMLElement).style.height = isSetup ? 'auto' : '100vh';
      (appContainerEl as HTMLElement).style.overflow = isSetup ? 'auto' : 'hidden';
    }

    if (optionsContainerEl) {
      (optionsContainerEl as HTMLElement).style.height = isSetup ? 'auto' : '100vh';
      (optionsContainerEl as HTMLElement).style.maxHeight = isSetup ? 'none' : '100vh';
      (optionsContainerEl as HTMLElement).style.overflowY = isSetup ? 'auto' : 'hidden';
    }

    document.body.style.overflow = isSetup ? 'auto' : 'hidden';

    return () => {
      if (appContainerEl) {
        (appContainerEl as HTMLElement).style.height = '';
        (appContainerEl as HTMLElement).style.overflow = '';
      }
      if (optionsContainerEl) {
        (appContainerEl as HTMLElement).style.height = '';
        (appContainerEl as HTMLElement).style.maxHeight = '';
        (appContainerEl as HTMLElement).style.overflowY = '';
      }
      document.body.style.overflow = '';
    };
  }, [history.length]);

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

  const handleClearFavorites = (): void => {
    const confirmed = window.confirm('Are you sure you want to delete all favorites?');
    if (!confirmed) return;

    setGlobalFavorites({});
    localStorage.removeItem(favoritesStorageKey);
  };

  const handleStartSorter = (): void => {
    setTournamentList(activeMatchCandidates);

    const A: EloExtended<SorterEntity> = activeMatchCandidates.at(Math.floor(Math.random() * activeMatchCandidates.length))!;
    const B: EloExtended<SorterEntity> = activeMatchCandidates.filter((e: EloExtended<SorterEntity>) => e !== A).at(Math.floor(Math.random() * (activeMatchCandidates.length - 1)))!;
    setHistory([[A, B]]);
  };

  const handleProcessVote = (winner: 'A' | 'B'): void => {
    if (!history.length) return;

    const [leftItem, rightItem] = history.at(-1)!;
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

  const getMediaCategoriesForEntity = useMemo(() => {
    return (entity: SorterEntity): MediaCategoryGroup[] => {
      const groups: MediaCategoryGroup[] = [];

      const profileUrls: string[] = [];
      if (entity.image?.profileCard) {
        profileUrls.push(entity.image.profileCard.trim());
      }
      if (entity.image?.heroBanner) {
        profileUrls.push(entity.image.heroBanner.trim());
      }

      if (profileUrls.length > 0) {
        groups.push({
          key: 'profile',
          label: theme.labels?.profileCard || 'Profile',
          urls: profileUrls,
        });
      }

      const layerMetadata = theme.layerMetadata[entity.type];
      if (layerMetadata && layerMetadata.mediaKeys) {
        layerMetadata.mediaKeys.forEach((key) => {
          if (key === 'profileCard' || key === 'heroBanner') return;
          const dynamicData = entity.image[key];
          const urls: string[] = [];
          if (typeof dynamicData === 'string') {
            urls.push(...dynamicData.split(' ').map((u) => u.trim()).filter(Boolean));
          } else if (Array.isArray(dynamicData)) {
            urls.push(...dynamicData.filter((u): u is string => typeof u === 'string').map((u) => u.trim()));
          }

          if (urls.length > 0) {
            groups.push({
              key,
              label: theme.labels?.[key] || key,
              urls,
            });
          }
        });
      }

      // Zet de favorites ALTIJD achteraan de groepen-lijst
      const favs = globalFavorites[entity.id] || [];
      groups.push({
        key: 'favorites',
        label: '⭐',
        urls: favs,
      });

      return groups;
    };
  }, [globalFavorites, theme]);

  const mediaCalculation = useMemo(() => {
    if (!history.length) return null;
    const [leftItem, rightItem] = history.at(-1)!;

    const leftCategories = getMediaCategoriesForEntity(leftItem);
    const rightCategories = getMediaCategoriesForEntity(rightItem);

    const getFilteredUrls = (categories: MediaCategoryGroup[], activeCat: string | null) => {
      if (activeCat) {
        const found = categories.find((c) => c.key === activeCat);
        return found ? found.urls : [];
      }
      const seenUrls = new Set<string>();
      const combinedUrls: string[] = [];

      categories.forEach((cat) => {
        cat.urls.forEach((url) => {
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            combinedUrls.push(url);
          }
        });
      });

      return combinedUrls;
    };

    const leftItemMedia = getFilteredUrls(leftCategories, activeLeftMediaCategory);
    const rightItemMedia = getFilteredUrls(rightCategories, activeRightMediaCategory);

    const currentLeftMediaUrl = leftItemMedia[leftMediaIndex] || '';
    const currentRightMediaUrl = rightItemMedia[rightMediaIndex] || '';

    return {
      leftCategories,
      rightCategories,
      leftItemMedia,
      rightItemMedia,
      currentLeftMediaUrl,
      currentRightMediaUrl,
    };
  }, [history, leftMediaIndex, rightMediaIndex, activeLeftMediaCategory, activeRightMediaCategory, getMediaCategoriesForEntity]);

  const toggleFavorite = (side: 'left' | 'right') => {
    if (!history.length || !mediaCalculation) return;
    const [leftItem, rightItem] = history.at(-1)!;
    const { currentLeftMediaUrl, currentRightMediaUrl } = mediaCalculation;

    const isLeft = side === 'left';
    const targetItem = isLeft ? leftItem : rightItem;
    const currentMediaUrl = isLeft ? currentLeftMediaUrl : currentRightMediaUrl;

    if (!currentMediaUrl) return;

    const currentFavs = globalFavorites[targetItem.id] || [];
    const isCurrentlyFav = currentFavs.includes(currentMediaUrl);

    let nextFavs: string[];
    if (isCurrentlyFav) {
      nextFavs = currentFavs.filter((url) => url !== currentMediaUrl);
    } else {
      nextFavs = [...currentFavs, currentMediaUrl];
    }

    // 1. Sla direct de nieuwe favorieten op in state en localStorage
    setGlobalFavorites((prev) => {
      const updated = { ...prev };
      if (nextFavs.length > 0) {
        updated[targetItem.id] = nextFavs;
      } else {
        delete updated[targetItem.id];
      }

      localStorage.setItem(favoritesStorageKey, JSON.stringify(updated));
      return updated;
    });

    // 2. Pas de index direct aan op basis van de huidige index (zonder +1 of geforceerde sprongen)
    if (isLeft) {
      setLeftMediaIndex((currentIndex) => {
        const categories = getMediaCategoriesForEntity(targetItem);
        // Overschrijf tijdelijk de favorites met nextFavs voor een juiste berekening
        const targetCatKey = activeLeftMediaCategory;
        const updatedCats = categories.map(c => c.key === 'favorites' ? { ...c, urls: nextFavs } : c);
        const filteredUrls = targetCatKey 
          ? (updatedCats.find((c) => c.key === targetCatKey)?.urls || [])
          : updatedCats.flatMap((c) => c.urls);
        
        const maxLen = filteredUrls.length;
        if (maxLen === 0) return 0;
        return Math.min(currentIndex, maxLen - 1);
      });
    } else {
      setRightMediaIndex((currentIndex) => {
        const categories = getMediaCategoriesForEntity(targetItem);
        const targetCatKey = activeRightMediaCategory;
        const updatedCats = categories.map(c => c.key === 'favorites' ? { ...c, urls: nextFavs } : c);
        const filteredUrls = targetCatKey 
          ? (updatedCats.find((c) => c.key === targetCatKey)?.urls || [])
          : updatedCats.flatMap((c) => c.urls);
        
        const maxLen = filteredUrls.length;
        if (maxLen === 0) return 0;
        return Math.min(currentIndex, maxLen - 1);
      });
    }
  };

  const extractMediaWithFavorite = (entity: SorterEntity): string[] => {
    return extractMediaUrls(entity, theme);
  };

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

  if (!history.length) {
    const hasFavorites = Object.keys(globalFavorites).length > 0;

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
          {hasFavorites && (
            <button type="button" onClick={handleClearFavorites} className={`${styles.actionButton} ${styles.clearFavsButton}`}>
              🗑️ Clear Favorites
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
        leftCategories={mediaCalculation!.leftCategories}
        rightCategories={mediaCalculation!.rightCategories}
        activeLeftMediaCategory={activeLeftMediaCategory}
        activeRightMediaCategory={activeRightMediaCategory}
        setActiveLeftMediaCategory={(cat) => { setActiveLeftMediaCategory(cat); setLeftMediaIndex(0); }}
        setActiveRightMediaCategory={(cat) => { setActiveRightMediaCategory(cat); setRightMediaIndex(0); }}
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