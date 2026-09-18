import { useState, useMemo, useEffect } from 'react';
import type { Theme, HydratedEntity, BaseEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { INITIAL_ELO, processMatch, getNextMatch } from './eloUtils';
import { extractMediaUrls, getGroupIdsFromTheme } from './sorterUtils';
import { SorterView } from './SorterView';
import { SorterResultsOverlay } from './SorterResultsOverlay';
import { useSorterKeybinds } from './useSorterKeybinds';
import styles from './SorterCSS/SorterSetup.module.css';
import { 
  getGameResults, 
  createUserSavedItem, 
  updateUserSavedItem, 
  deleteUserSavedItem 
} from '../../../core/api';

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

interface UserStorageObject {
  id?: string;
  _id?: string;
}

const getStoredUserId = (): string => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr) as UserStorageObject;
      return userObj.id || userObj._id || localStorage.getItem('userId') || '';
    } catch (err: unknown) {
      console.error("Fout bij het uitlezen van userId uit localStorage:", err);
    }
  }
  return localStorage.getItem('userId') || '';
};

export function SorterViewPage({ theme }: SorterViewPageProps) {
  const [userId] = useState<string>(() => getStoredUserId());
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

  const [globalFavorites, setGlobalFavorites] = useState<Record<string, string[]>>({});
  const [activeSaveId, setActiveSaveId] = useState<string | null>(null);

  const [tournamentList, setTournamentList] = useState<EloExtended<SorterEntity>[]>([]);
  const [history, setHistory] = useState<[EloExtended<SorterEntity>, EloExtended<SorterEntity>][]>([]);
  const [hasSave, setHasSave] = useState<boolean>(false);

  const [leftMediaIndex, setLeftMediaIndex] = useState<number>(0);
  const [rightMediaIndex, setRightMediaIndex] = useState<number>(0);

  const [activeLeftMediaCategory, setActiveLeftMediaCategory] = useState<string | null>(null);
  const [activeRightMediaCategory, setActiveRightMediaCategory] = useState<string | null>(null);

  const [hoveredAction, setHoveredAction] = useState<string>('Hover over a key to see its function');
  const [showResultsOverlay, setShowResultsOverlay] = useState<boolean>(false);

  useEffect(() => {
    async function loadDataFromDB(): Promise<void> {
      try {
        const items = await getGameResults({ userId, themeId: theme.id });

        const activeSaves = items.filter((i) => i.type === 'sorter_active');
        if (activeSaves.length > 0) {
          const activeSave = activeSaves[0];
          if (activeSave?.id) {
            setActiveSaveId(activeSave.id);
            setHasSave(true);
          }

          for (let i = 1; i < activeSaves.length; i++) {
            const duplicateId = activeSaves[i]?.id;
            if (duplicateId) {
              await deleteUserSavedItem(duplicateId);
            }
          }
        }

        const favItem = items.find((i) => i.type === 'favorites');
        if (favItem?.data && typeof favItem.data === 'object') {
          const rawData = favItem.data as Record<string, unknown>;
          const parsedFavs: Record<string, string[]> = {};
          for (const [key, val] of Object.entries(rawData)) {
            if (Array.isArray(val)) {
              parsedFavs[key] = val.filter((item): item is string => typeof item === 'string');
            }
          }
          setGlobalFavorites(parsedFavs);
        }
      } catch (error) {
        console.error('Fout bij ophalen opgeslagen items uit DB:', error);
      }
    }

    loadDataFromDB();
  }, [userId, theme.id]);

  const [prevLeftId, setPrevLeftId] = useState<string>('');
  const [prevRightId, setPrevRightId] = useState<string>('');

  const currentMatchup = history.at(-1);
  if (currentMatchup) {
    const [leftItem, rightItem] = currentMatchup;
    if (leftItem && leftItem.id !== prevLeftId) {
      setPrevLeftId(leftItem.id);
      setLeftMediaIndex(0);
      setActiveLeftMediaCategory(null);
    }
    if (rightItem && rightItem.id !== prevRightId) {
      setPrevRightId(rightItem.id);
      setRightMediaIndex(0);
      setActiveRightMediaCategory(null);
    }
  }

  useEffect(() => {
    const appContainerEl = document.querySelector('.app-container');
    const optionsContainerEl = document.querySelector(`.${styles.optionsContainer}`);
    const isSetup = history.length === 0;

    if (appContainerEl instanceof HTMLElement) {
      appContainerEl.style.height = isSetup ? 'auto' : '100vh';
      appContainerEl.style.overflow = isSetup ? 'auto' : 'hidden';
    }

    if (optionsContainerEl instanceof HTMLElement) {
      optionsContainerEl.style.height = isSetup ? 'auto' : '100vh';
      optionsContainerEl.style.maxHeight = isSetup ? 'none' : '100vh';
      optionsContainerEl.style.overflowY = isSetup ? 'auto' : 'hidden';
    }

    document.body.style.overflow = isSetup ? 'auto' : 'hidden';

    return () => {
      if (appContainerEl instanceof HTMLElement) {
        appContainerEl.style.height = '';
        appContainerEl.style.overflow = '';
      }
      if (optionsContainerEl instanceof HTMLElement) {
        optionsContainerEl.style.height = '';
        optionsContainerEl.style.maxHeight = '';
        optionsContainerEl.style.overflowY = '';
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

  const handleSave = async (): Promise<void> => {
    const saveData: SorterSaveData = {
      includedGroupIds,
      tournamentList,
      history,
    };

    try {
      const items = await getGameResults({ userId, themeId: theme.id, type: 'sorter_active' });
      const existingActive = items.at(0);

      if (activeSaveId || existingActive?.id) {
        const idToUpdate = activeSaveId || existingActive?.id;
        if (idToUpdate) {
          if (!activeSaveId) {
            setActiveSaveId(idToUpdate);
          }
          await updateUserSavedItem(idToUpdate, {
            data: saveData as unknown as Record<string, unknown>,
          });
        }
      } else {
        const newItem = await createUserSavedItem({
          userId,
          themeId: theme.id,
          type: 'sorter_active',
          name: `${theme.title} - In Progress`,
          data: saveData as unknown as Record<string, unknown>,
        });
        if (newItem?.id) {
          setActiveSaveId(newItem.id);
        }
      }
      setHasSave(true);
    } catch (error) {
      console.error('Fout bij opslaan sorter sessie in DB:', error);
    }
  };

  const handleLoad = async (): Promise<void> => {
    try {
      const items = await getGameResults({ userId, themeId: theme.id, type: 'sorter_active' });
      const activeSave = items.at(0);

      if (activeSave?.data) {
        const data = activeSave.data as unknown as SorterSaveData;
        if (data.includedGroupIds) setIncludedGroupIds(data.includedGroupIds);
        if (data.tournamentList) setTournamentList(data.tournamentList);
        if (data.history) setHistory(data.history);
        if (activeSave.id) {
          setActiveSaveId(activeSave.id);
        }
      }
    } catch (error) {
      console.error('Fout bij laden sorter sessie uit DB:', error);
    }
  };

  const updateFavoritesInDB = async (updatedFavs: Record<string, string[]>) => {
    try {
      const items = await getGameResults({ userId, themeId: theme.id, type: 'favorites' });
      const existingFavItem = items.at(0);

      if (existingFavItem?.id) {
        await updateUserSavedItem(existingFavItem.id, { data: updatedFavs as unknown as Record<string, unknown> });
      } else {
        await createUserSavedItem({
          userId,
          themeId: theme.id,
          type: 'favorites',
          name: 'User Favorites',
          data: updatedFavs as unknown as Record<string, unknown>,
        });
      }
    } catch (error) {
      console.error('Fout bij opslaan favorieten in DB:', error);
    }
  };

  const handleClearFavorites = async (): Promise<void> => {
    const confirmed = window.confirm('Are you sure you want to delete all favorites?');
    if (!confirmed) return;

    setGlobalFavorites({});
    await updateFavoritesInDB({});
  };

  const handleStartSorter = (): void => {
    if (activeMatchCandidates.length < 2) return;

    const randomIndexA = Math.floor(Math.random() * activeMatchCandidates.length);
    const candidateA = activeMatchCandidates[randomIndexA];

    const remainingCandidates = activeMatchCandidates.filter((e) => e.id !== candidateA?.id);
    const randomIndexB = Math.floor(Math.random() * remainingCandidates.length);
    const candidateB = remainingCandidates[randomIndexB];

    if (candidateA && candidateB) {
      setTournamentList(activeMatchCandidates);
      setHistory([[candidateA, candidateB]]);
    }
  };

  const handleProcessVote = (winner: 'A' | 'B'): void => {
    const currentPair = history.at(-1);
    if (!currentPair) return;

    const [leftItem, rightItem] = currentPair;
    if (!leftItem || !rightItem) return;

    const snapshot: [EloExtended<SorterEntity>, EloExtended<SorterEntity>] = [{ ...leftItem }, { ...rightItem }];

    processMatch(leftItem, rightItem, winner);
    const nextMatch = getNextMatch(tournamentList);
    if (!nextMatch) return;

    setHistory((prevHistory) => {
      const newHistory = [...prevHistory];
      newHistory[newHistory.length - 1] = snapshot;
      newHistory.push(nextMatch);
      return newHistory;
    });
  };

  const handleUndo = (): void => {
    if (history.length <= 1) return;

    const previousPair = history.at(-2);
    if (!previousPair) return;

    const [leftItem, rightItem] = previousPair;

    setHistory((prevHistory) => {
      const newHistory = [...prevHistory];
      newHistory.pop();
      return newHistory;
    });

    setTournamentList((prevList) =>
      prevList.map((e) =>
        e.id === leftItem?.id ? leftItem : e.id === rightItem?.id ? rightItem : e
      )
    );
  };

  const handleOpenResults = async (): Promise<void> => {
    setShowResultsOverlay(true);

    if (activeSaveId) {
      try {
        await deleteUserSavedItem(activeSaveId);
        setActiveSaveId(null);
        setHasSave(false);
      } catch (error) {
        console.error('Fout bij verwijderen actieve sorter na voltooien:', error);
      }
    }
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

      const layerMetadata = theme.layerMetadata?.[entity.type];
      if (layerMetadata?.mediaKeys) {
        layerMetadata.mediaKeys.forEach((key: string) => {
          if (key === 'profileCard' || key === 'heroBanner') return;
          const dynamicData = entity.image?.[key];
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
    const currentPair = history.at(-1);
    if (!currentPair) return null;
    const [leftItem, rightItem] = currentPair;
    if (!leftItem || !rightItem) return null;

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
    const currentPair = history.at(-1);
    if (!currentPair || !mediaCalculation) return;
    const [leftItem, rightItem] = currentPair;
    if (!leftItem || !rightItem) return;

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

    setGlobalFavorites((prev) => {
      const updated = { ...prev };
      if (nextFavs.length > 0) {
        updated[targetItem.id] = nextFavs;
      } else {
        delete updated[targetItem.id];
      }

      updateFavoritesInDB(updated);
      return updated;
    });

    if (isLeft) {
      setLeftMediaIndex((currentIndex) => {
        const categories = getMediaCategoriesForEntity(targetItem);
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
    leftItemMedia: mediaCalculation?.leftItemMedia ?? [],
    rightItemMedia: mediaCalculation?.rightItemMedia ?? [],
    currentLeftMediaUrl: mediaCalculation?.currentLeftMediaUrl ?? '',
    currentRightMediaUrl: mediaCalculation?.currentRightMediaUrl ?? '',
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
              <h3 className={styles.sectionTitle}>{theme.labels?.[layerKey] || `Layer ${layerKey}`}</h3>
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

  const activeMatchup = history.at(-1);
  if (!activeMatchup) return null;

  return (
    <>
      <SorterView
        theme={theme}
        tournamentList={tournamentList}
        currentMatchup={activeMatchup}
        voteCount={history.length}
        leftItemMedia={mediaCalculation?.leftItemMedia ?? []}
        rightItemMedia={mediaCalculation?.rightItemMedia ?? []}
        currentLeftMediaUrl={mediaCalculation?.currentLeftMediaUrl ?? ''}
        currentRightMediaUrl={mediaCalculation?.currentRightMediaUrl ?? ''}
        leftCategories={mediaCalculation?.leftCategories ?? []}
        rightCategories={mediaCalculation?.rightCategories ?? []}
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
        onOpenResults={handleOpenResults}
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