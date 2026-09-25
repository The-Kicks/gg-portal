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
  getAllSavedItems,
  createUserSavedItem,
  updateUserSavedItem,
  deleteUserSavedItem
} from '../../../core/api';

export type SorterEntity = HydratedEntity;

export interface MediaCategoryGroup {
  key: string;
  label: string | React.ReactNode;
  urls: string[];
  isFriendFavorite?: boolean;
  friendUsername?: string;
}

interface SorterViewPageProps {
  theme: Theme;
}

interface LeanHistoryStep {
  leftId: string;
  rightId: string;
  leftState: { elo: number; matchesPlayed: number };
  rightState: { elo: number; matchesPlayed: number };
}

interface LeanSorterSaveData {
  includedGroupIds: string[];
  eloState: Record<string, { elo: number; matchesPlayed: number }>;
  history: LeanHistoryStep[];
  totalVotes: number;
}

interface SorterSaveDataShape {
  includedGroupIds?: string[];
  eloState?: Record<string, { elo: number; matchesPlayed: number }>;
  history?: LeanHistoryStep[] | [EloExtended<SorterEntity>, EloExtended<SorterEntity>][];
  tournamentList?: EloExtended<SorterEntity>[];
  totalVotes?: number;
}

interface UserStorageObject {
  id?: string;
  _id?: string;
}

const MAX_UNDO_STEPS = 50;

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

    entitiesWithEloState.forEach((entity) => {
      if (entity.type === 'l1') l1Map.set(entity.id, entity);
      if (entity.type === 'l2') l2Map.set(entity.id, entity);
      if (entity.type === 'l3') l3Map.set(entity.id, entity);
    });

    const sortByName = (a: BaseEntity, b: BaseEntity) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true });

    return {
      l1: Array.from(l1Map.values()).sort(sortByName),
      l2: Array.from(l2Map.values()).sort(sortByName),
      l3: Array.from(l3Map.values()).sort(sortByName),
    };
  }, [entitiesWithEloState]);

  const allGroupIds = useMemo<string[]>(() => {
    return [
      ...filterCategories.l1,
      ...filterCategories.l2,
      ...filterCategories.l3,
    ].map((group) => group.id);
  }, [filterCategories]);

  const [includedGroupIds, setIncludedGroupIds] = useState<string[]>(() => {
    const initialIds = getGroupIdsFromTheme(theme);
    return initialIds.filter(id => id !== 'unknown-company-forwhenlazy');
  });

  const [globalFavorites, setGlobalFavorites] = useState<Record<string, string[]>>({});
  const [friendProfiles, setFriendProfiles] = useState<{ friendUserId: string; username: string }[]>([]);
  const [friendFavoritesMap, setFriendFavoritesMap] = useState<Record<string, Record<string, string[]>>>({});

  const [activeSaveId, setActiveSaveId] = useState<string | null>(null);

  const [tournamentList, setTournamentList] = useState<EloExtended<SorterEntity>[]>([]);
  const [history, setHistory] = useState<[EloExtended<SorterEntity>, EloExtended<SorterEntity>][]>([]);
  const [totalVotes, setTotalVotes] = useState<number>(1);
  const [hasSave, setHasSave] = useState<boolean>(false);

  const [leftMediaIndex, setLeftMediaIndex] = useState<number>(0);
  const [rightMediaIndex, setRightMediaIndex] = useState<number>(0);

  const [activeLeftMediaCategory, setActiveLeftMediaCategory] = useState<string | null>(null);
  const [activeRightMediaCategory, setActiveRightMediaCategory] = useState<string | null>(null);

  const [hoveredAction, setHoveredAction] = useState<string>('Hover over a key to see its function');
  const [showResultsOverlay, setShowResultsOverlay] = useState<boolean>(false);

  const [startOnFavorites, setStartOnFavorites] = useState<boolean>(() => {
    const saved = localStorage.getItem('sorter_startOnFavorites');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sorter_startOnFavorites', JSON.stringify(startOnFavorites));
  }, [startOnFavorites]);

  const applyStartOnFavoritesForPair = (leftItem: EloExtended<SorterEntity>, rightItem: EloExtended<SorterEntity>, startFavs: boolean) => {
    setLeftMediaIndex(0);
    setRightMediaIndex(0);
    const leftFavs = globalFavorites[leftItem.id] || [];
    const rightFavs = globalFavorites[rightItem.id] || [];
    setActiveLeftMediaCategory(startFavs && leftFavs.length > 0 ? 'favorites' : null);
    setActiveRightMediaCategory(startFavs && rightFavs.length > 0 ? 'favorites' : null);
  };

  const handleToggleStartOnFavorites = (valOrUpdater: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof valOrUpdater === 'function' ? valOrUpdater(startOnFavorites) : valOrUpdater;
    setStartOnFavorites(nextVal);

    const currentPair = history.at(-1);
    if (currentPair) {
      const [leftItem, rightItem] = currentPair;
      if (leftItem) {
        const leftFavs = globalFavorites[leftItem.id] || [];
        if (nextVal && leftFavs.length > 0) {
          setActiveLeftMediaCategory('favorites');
        } else if (!nextVal && activeLeftMediaCategory === 'favorites') {
          setActiveLeftMediaCategory(null);
        }
      }
      if (rightItem) {
        const rightFavs = globalFavorites[rightItem.id] || [];
        if (nextVal && rightFavs.length > 0) {
          setActiveRightMediaCategory('favorites');
        } else if (!nextVal && activeRightMediaCategory === 'favorites') {
          setActiveRightMediaCategory(null);
        }
      }
    }
  };

  useEffect(() => {
    async function loadDataFromDB(): Promise<void> {
      try {
        const allItems = await getAllSavedItems({ themeId: theme.id });

        const activeSaves = allItems.filter((i) => i.type === 'sorter_active' && i.userId === userId);
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

        const favoriteItems = allItems.filter((i) => i.type === 'favorites' && i.userId === userId);
        if (favoriteItems.length > 0) {
          const favItem = favoriteItems[0];
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

          for (let i = 1; i < favoriteItems.length; i++) {
            const duplicateId = favoriteItems[i]?.id;
            if (duplicateId) {
              await deleteUserSavedItem(duplicateId);
            }
          }
        }

        const myFriendProfiles = allItems.filter((i) => i.type === 'friend_profile' && i.userId === userId);
        const profileMap = new Map<string, string>();

        myFriendProfiles.forEach((fp) => {
          if (fp.data && typeof fp.data === 'object') {
            const data = fp.data as Record<string, unknown>;
            const fUserId = (data.friendUserId || data.userId) as string;
            const fUsername = (data.username || data.name) as string;
            if (fUserId) {
              profileMap.set(fUserId, fUsername || fUserId);
            }
          }
        });

        const profiles = Array.from(profileMap.entries()).map(([friendUserId, username]) => ({
          friendUserId,
          username,
        }));
        setFriendProfiles(profiles);

        const friendUserIds = new Set(profiles.map(p => p.friendUserId));
        const newFriendFavMap: Record<string, Record<string, string[]>> = {};

        allItems.forEach((item) => {
          if (item.type === 'favorites' && friendUserIds.has(item.userId)) {
            if (item.data && typeof item.data === 'object') {
              const rawData = item.data as Record<string, unknown>;
              const parsedFavs: Record<string, string[]> = {};
              for (const [key, val] of Object.entries(rawData)) {
                if (Array.isArray(val)) {
                  parsedFavs[key] = val.filter((v): v is string => typeof v === 'string');
                }
              }
              newFriendFavMap[item.userId] = parsedFavs;
            }
          }
        });
        setFriendFavoritesMap(newFriendFavMap);

      } catch (error) {
        console.error('Fout bij ophalen opgeslagen items uit DB:', error);
      }
    }

    loadDataFromDB();
  }, [userId, theme.id]);

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

  const performAutoSave = async (
    currentList: EloExtended<SorterEntity>[],
    currentHistory: [EloExtended<SorterEntity>, EloExtended<SorterEntity>][],
    currentVotes: number,
    currentGroups: string[]
  ): Promise<void> => {
    const eloState: Record<string, { elo: number; matchesPlayed: number }> = {};
    currentList.forEach((item) => {
      eloState[item.id] = { elo: item.elo, matchesPlayed: item.matchesPlayed };
    });

    const leanHistory: LeanHistoryStep[] = currentHistory.map(([left, right]) => ({
      leftId: left.id,
      rightId: right.id,
      leftState: { elo: left.elo, matchesPlayed: left.matchesPlayed },
      rightState: { elo: right.elo, matchesPlayed: right.matchesPlayed },
    }));

    const saveData: LeanSorterSaveData = {
      includedGroupIds: currentGroups,
      eloState,
      history: leanHistory,
      totalVotes: currentVotes,
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
      console.error('Fout bij automatisch opslaan sorter sessie in DB:', error);
    }
  };

  const handleLoad = async (): Promise<void> => {
    try {
      const items = await getGameResults({ userId, themeId: theme.id, type: 'sorter_active' });
      const activeSave = items.at(0);

      if (activeSave?.data) {
        const data = activeSave.data as SorterSaveDataShape;

        const loadedGroupIds = data.includedGroupIds || includedGroupIds;
        if (data.includedGroupIds) {
          setIncludedGroupIds(data.includedGroupIds);
        }

        if (data.eloState && Array.isArray(data.history)) {
          const entityMap = new Map<string, EloExtended<SorterEntity>>();
          entitiesWithEloState.forEach((e) => {
            const cloned = { ...e };
            if (data.eloState && data.eloState[e.id]) {
              cloned.elo = data.eloState[e.id].elo;
              cloned.matchesPlayed = data.eloState[e.id].matchesPlayed;
            }
            entityMap.set(e.id, cloned);
          });

          const restoredTournamentList = rankableItems
            .filter((item) => {
              const connectedParentIds = item.targetConnections?.map((conn) => conn.sourceEntityId) || [];
              return connectedParentIds.some((parentId) => loadedGroupIds.includes(parentId));
            })
            .map((e) => {
              const found = entityMap.get(e.id);
              return found ? { ...found } : { ...e, elo: INITIAL_ELO, matchesPlayed: 0 };
            });

          setTournamentList(restoredTournamentList);

          const historySteps = data.history as LeanHistoryStep[];
          const restoredHistory: [EloExtended<SorterEntity>, EloExtended<SorterEntity>][] = historySteps.map((step) => {
            const leftBase = entityMap.get(step.leftId) || entitiesWithEloState.find((e) => e.id === step.leftId)!;
            const rightBase = entityMap.get(step.rightId) || entitiesWithEloState.find((e) => e.id === step.rightId)!;

            const leftItem: EloExtended<SorterEntity> = {
              ...leftBase,
              elo: step.leftState?.elo ?? leftBase.elo,
              matchesPlayed: step.leftState?.matchesPlayed ?? leftBase.matchesPlayed,
            };
            const rightItem: EloExtended<SorterEntity> = {
              ...rightBase,
              elo: step.rightState?.elo ?? rightBase.elo,
              matchesPlayed: step.rightState?.matchesPlayed ?? rightBase.matchesPlayed,
            };

            return [leftItem, rightItem];
          });
          setHistory(restoredHistory);

          if (typeof data.totalVotes === 'number') {
            setTotalVotes(data.totalVotes);
          } else {
            setTotalVotes(restoredHistory.length);
          }

          const restoredPair = restoredHistory.at(-1);
          if (restoredPair) {
            applyStartOnFavoritesForPair(restoredPair[0], restoredPair[1], startOnFavorites);
          }
        } else if (data.tournamentList && data.history) {
          setTournamentList(data.tournamentList);
          const hist = data.history as [EloExtended<SorterEntity>, EloExtended<SorterEntity>][];
          setHistory(hist);
          setTotalVotes(data.totalVotes ?? hist.length);
          const restoredPair = hist.at(-1);
          if (restoredPair) {
            applyStartOnFavoritesForPair(restoredPair[0], restoredPair[1], startOnFavorites);
          }
        }

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
      const initialHistory: [EloExtended<SorterEntity>, EloExtended<SorterEntity>][] = [[candidateA, candidateB]];
      setHistory(initialHistory);
      setTotalVotes(1);

      applyStartOnFavoritesForPair(candidateA, candidateB, startOnFavorites);
      performAutoSave(activeMatchCandidates, initialHistory, 1, includedGroupIds);
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

    const newHistory = [...history];
    newHistory[newHistory.length - 1] = snapshot;
    newHistory.push(nextMatch);

    const finalHistory = newHistory.length > MAX_UNDO_STEPS + 1
      ? newHistory.slice(newHistory.length - (MAX_UNDO_STEPS + 1))
      : newHistory;

    const newTotalVotes = totalVotes + 1;

    setHistory(finalHistory);
    setTotalVotes(newTotalVotes);

    applyStartOnFavoritesForPair(nextMatch[0], nextMatch[1], startOnFavorites);
    performAutoSave(tournamentList, finalHistory, newTotalVotes, includedGroupIds);
  };

  const handleUndo = (): void => {
    if (history.length <= 1) return;

    const previousPair = history.at(-2);
    if (!previousPair) return;

    const [leftItem, rightItem] = previousPair;

    const newHistory = [...history];
    newHistory.pop();

    const newTournamentList = tournamentList.map((e) =>
      e.id === leftItem?.id ? leftItem : e.id === rightItem?.id ? rightItem : e
    );

    const newTotalVotes = Math.max(1, totalVotes - 1);

    setHistory(newHistory);
    setTournamentList(newTournamentList);
    setTotalVotes(newTotalVotes);

    applyStartOnFavoritesForPair(leftItem, rightItem, startOnFavorites);
    performAutoSave(newTournamentList, newHistory, newTotalVotes, includedGroupIds);
  };

  const handleOpenResults = async (): Promise<void> => {
    setShowResultsOverlay(true);
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

      friendProfiles.forEach((fp) => {
        const friendFavs = friendFavoritesMap[fp.friendUserId]?.[entity.id] || [];
        groups.push({
          key: `friend_fav_${fp.friendUserId}`,
          label: (
            <span
              title={`Friend Favorites: ${fp.username}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              ⭐ {fp.username}
            </span>
          ),
          urls: friendFavs,
          isFriendFavorite: true,
          friendUsername: fp.username,
        });
      });

      return groups;
    };
  }, [globalFavorites, friendProfiles, friendFavoritesMap, theme]);

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
    const isLeft = side === 'left';
    const activeCat = isLeft ? activeLeftMediaCategory : activeRightMediaCategory;

    if (activeCat?.startsWith('friend_fav_')) {
      return;
    }

    const currentPair = history.at(-1);
    if (!currentPair || !mediaCalculation) return;
    const [leftItem, rightItem] = currentPair;
    if (!leftItem || !rightItem) return;

    const { currentLeftMediaUrl, currentRightMediaUrl } = mediaCalculation;
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

          const isOpenByDefault = layerKey === 'l3';

          return (
            <details key={layerKey} className={styles.filterSection} open={isOpenByDefault}>
              <summary className={styles.sectionTitle} style={{ cursor: 'pointer', userSelect: 'none' }}>
                {theme.labels?.[layerKey] || `Layer ${layerKey}`} ({categories.length})
              </summary>
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
            </details>
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
        voteCount={totalVotes}
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
        toggleFavorite={toggleFavorite}
        onOpenResults={handleOpenResults}
        startOnFavorites={startOnFavorites}
        setStartOnFavorites={handleToggleStartOnFavorites}
      />

      {showResultsOverlay && (
        <SorterResultsOverlay
          theme={theme}
          finalPool={tournamentList}
          extractMediaUrls={extractMediaWithFavorite}
          getFavoriteUrls={(id) => globalFavorites[id] || []}
          onClose={() => setShowResultsOverlay(false)}
        />
      )}
    </>
  );
}