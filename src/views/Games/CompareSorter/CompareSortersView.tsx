import { useState, useEffect, useMemo } from 'react';
import type { Theme, BaseEntity, LayerKey } from '../../../types';
import { EntityCard } from '../../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from '../CompareSorter/CompareSortersView.module.css';

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
      console.error("Fout bij uitlezen userId uit JSON:", err);
    }
  }
  return localStorage.getItem('userId') || '';
};

const extractUrl = (item: unknown): string => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const found = obj.url || obj.image || obj.src || obj.path || obj.imageUrl;
    if (typeof found === 'string') return found;
  }
  return '';
};

interface TierInfo {
  name: string;
  abbreviation: string;
  color: string;
}

const getTier = (item: { elo: number }): TierInfo => {
  const elo = item.elo || 1000;
  if (elo >= 1550) return { name: 'Master', abbreviation: 'MST', color: '#c084fc' };
  if (elo >= 1450) return { name: 'Diamond', abbreviation: 'DIA', color: '#38bdf8' };
  if (elo >= 1350) return { name: 'Platinum', abbreviation: 'PLT', color: '#2dd4bf' };
  if (elo >= 1250) return { name: 'Gold', abbreviation: 'GLD', color: '#eab308' };
  if (elo >= 1150) return { name: 'Silver', abbreviation: 'SLV', color: '#9ca3af' };
  return { name: 'Bronze', abbreviation: 'BRZ', color: '#cd7f32' };
};

interface RankedItem {
  id: string;
  name: string;
  elo: number;
  rank: number;
}

interface SavedSorterItem {
  id: string;
  name: string;
  themeId: string;
  createdAt: string;
  type: string;
  data: {
    rankedItems: RankedItem[];
  };
}

interface SavedItemRecord {
  id: string;
  userId: string;
  type: string;
  themeId?: string | null;
  name?: string;
  createdAt?: string;
  data: Record<string, unknown> | unknown[];
}

interface FriendProfileItem {
  id: string;
  name: string;
  data: {
    friendUserId: string;
  };
}

interface ComparisonRow {
  id: string;
  name: string;
  myRank: number;
  myElo: number;
  friendRank: number | null;
  friendElo: number | null;
  rankDiff: number | null;
}

interface CompareSortersViewProps {
  theme: Theme & { entities?: BaseEntity[] };
  onBack?: () => void;
  getFavoriteUrls?: (entityId: string) => string[];
  labels?: Record<string, string | undefined>;
  activeKey?: LayerKey;
}

export function CompareSortersView({
  theme,
  onBack,
  getFavoriteUrls,
  labels = {},
  activeKey = 'default' as LayerKey,
}: CompareSortersViewProps) {
  const [mySorters, setMySorters] = useState<SavedSorterItem[]>([]);
  const [selectedMyId, setSelectedMyId] = useState<string>('');

  const [friendProfiles, setFriendProfiles] = useState<FriendProfileItem[]>([]);
  const [selectedFriendProfileId, setSelectedFriendProfileId] = useState<string>('');
  
  const [friendSorters, setFriendSorters] = useState<SavedSorterItem[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string>('');

  const [myFavoritesMap, setMyFavoritesMap] = useState<Record<string, string[]>>({});
  const [friendFavoritesMap, setFriendFavoritesMap] = useState<Record<string, string[]>>({});

  const [loadingMy, setLoadingMy] = useState<boolean>(false);
  const [loadingFriendsList, setLoadingFriendsList] = useState<boolean>(false);
  const [loadingFriendSorters, setLoadingFriendSorters] = useState<boolean>(false);

  const [cardStates, setCardStates] = useState<Record<string, { index: number }>>({});
  const [showMyFavorites, setShowMyFavorites] = useState<boolean>(false);
  const [showFriendFavorites, setShowFriendFavorites] = useState<boolean>(false);
  const [hideControls, setHideControls] = useState<boolean>(false);

  const currentUserId = getStoredUserId();

  const entityMap = useMemo(() => {
    const rawEntities = (theme.entities as BaseEntity[] | undefined) || [];
    const map = new Map<string, BaseEntity>();
    
    rawEntities.forEach((e) => {
      const rawEntity = e as unknown as Record<string, unknown>;
      const entityId = e.id !== undefined 
        ? String(e.id) 
        : rawEntity._id !== undefined 
          ? String(rawEntity._id) 
          : undefined;
          
      if (entityId) {
        map.set(entityId, e);
      }
    });
    
    return map;
  }, [theme.entities]);

  const findEntityById = (id: string | number): BaseEntity | undefined => {
    if (id === undefined || id === null) return undefined;
    return entityMap.get(String(id));
  };

  const parseFavoritesToMap = (items: SavedItemRecord[]): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    
    items.forEach(item => {
      if (!item.data) return;

      if (typeof item.data === 'object' && !Array.isArray(item.data)) {
        const dataObj = item.data as Record<string, unknown>;

        Object.entries(dataObj).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            const urls = value.map(v => extractUrl(v)).filter((u): u is string => Boolean(u));
            if (urls.length > 0) {
              map[key] = urls;
            }
          } else if (value && typeof value === 'object') {
            const subObj = value as Record<string, unknown>;
            const subUrls = subObj.urls || subObj.media || subObj.images || subObj.favoriteUrls;
            if (Array.isArray(subUrls)) {
              const urls = subUrls.map(v => extractUrl(v)).filter((u): u is string => Boolean(u));
              if (urls.length > 0) {
                map[key] = urls;
              }
            }
          }
        });
      }
    });

    return map;
  };

  useEffect(() => {
    if (!currentUserId || !theme?.id) return;

    const fetchData = async () => {
      try {
        setLoadingMy(true);
        setLoadingFriendsList(true);

        const res = await fetch(`/api/saved-items?userId=${currentUserId}&themeId=${theme.id}`);
        if (res.ok) {
          const allItems: SavedItemRecord[] = await res.json();
          
          const sorters = allItems.filter(i => i.type === 'sorter_finished') as unknown as SavedSorterItem[];
          setMySorters(sorters);
          if (sorters.length > 0) setSelectedMyId(sorters[0].id);

          setMyFavoritesMap(parseFavoritesToMap(allItems));
        }

        const friendsRes = await fetch(`/api/saved-items?userId=${currentUserId}&type=friend_profile`);
        if (friendsRes.ok) {
          const profiles: FriendProfileItem[] = await friendsRes.json();
          setFriendProfiles(profiles);
          if (profiles.length > 0) {
            setSelectedFriendProfileId(profiles[0].id);
          }
        }
      } catch (err: unknown) {
        console.error("Fout bij ophalen initiële data:", err);
      } finally {
        setLoadingMy(false);
        setLoadingFriendsList(false);
      }
    };

    fetchData();
  }, [currentUserId, theme.id]);

  const activeFriendProfile = friendProfiles.find(fp => fp.id === selectedFriendProfileId);

  useEffect(() => {
    const fetchFriendData = async () => {
      if (!activeFriendProfile || !activeFriendProfile.data?.friendUserId) {
        setFriendSorters([]);
        setSelectedFriendId('');
        setFriendFavoritesMap({});
        return;
      }

      const friendUserId = activeFriendProfile.data.friendUserId;

      try {
        setLoadingFriendSorters(true);
        
        const res = await fetch(`/api/saved-items?userId=${friendUserId}&themeId=${theme.id}`);
        if (res.ok) {
          const allItems: SavedItemRecord[] = await res.json();
          
          const sorters = allItems.filter(i => i.type === 'sorter_finished') as unknown as SavedSorterItem[];
          setFriendSorters(sorters);
          if (sorters.length > 0) {
            setSelectedFriendId(sorters[0].id);
          } else {
            setSelectedFriendId('');
          }

          setFriendFavoritesMap(parseFavoritesToMap(allItems));
        } else {
          setFriendSorters([]);
          setFriendFavoritesMap({});
        }
      } catch (err: unknown) {
        console.error("Fout bij ophalen vriend data:", err);
        setFriendSorters([]);
        setFriendFavoritesMap({});
      } finally {
        setLoadingFriendSorters(false);
      }
    };

    fetchFriendData();
  }, [activeFriendProfile, theme.id]);

  const mySelectedSorter = mySorters.find(s => s.id === selectedMyId);
  const friendSelectedSorter = friendSorters.find(s => s.id === selectedFriendId);

  const comparisonData = useMemo<ComparisonRow[]>(() => {
    if (!mySelectedSorter) return [];

    const friendMap = new Map<string, RankedItem>();
    if (friendSelectedSorter) {
      friendSelectedSorter.data.rankedItems.forEach(item => {
        if (item.id !== undefined && item.id !== null) {
          friendMap.set(String(item.id), item);
        }
      });
    }

    return mySelectedSorter.data.rankedItems.map(myItem => {
      const friendItem = myItem.id !== undefined ? friendMap.get(String(myItem.id)) : undefined;
      const myRank = myItem.rank;
      const friendRank = friendItem ? friendItem.rank : null;
      const rankDiff = friendRank !== null ? friendRank - myRank : null;

      return {
        id: myItem.id,
        name: myItem.name,
        myRank,
        myElo: myItem.elo,
        friendRank,
        friendElo: friendItem ? friendItem.elo : null,
        rankDiff
      };
    }).sort((a, b) => a.myRank - b.myRank);
  }, [mySelectedSorter, friendSelectedSorter]);

  const getFavoritesForEntity = (entityId: string, entity?: BaseEntity): string[] => {
    let favs: string[] = [];
    if (showFriendFavorites) {
      favs = friendFavoritesMap[entityId] || [];
    } else if (showMyFavorites) {
      const rawFavs = myFavoritesMap[entityId] || (getFavoriteUrls ? getFavoriteUrls(entityId) : []);
      favs = rawFavs.map(u => extractUrl(u)).filter(Boolean);
    }

    if (favs.length === 0 && entity) {
      const raw = entity as unknown as Record<string, unknown>;
      const rawLayers = raw.layers as Record<string, Record<string, unknown>> | undefined;
      const layerData = rawLayers?.[activeKey];

      const possibleMedia = 
        (layerData?.favorites as unknown[]) ||
        (layerData?.media as unknown[]) ||
        (layerData?.images as unknown[]) ||
        (raw.favorites as unknown[]) ||
        (raw.media as unknown[]) ||
        (raw.images as unknown[]) ||
        (raw.imageUrl ? [raw.imageUrl] : []);

      if (Array.isArray(possibleMedia)) {
        favs = possibleMedia
          .map(m => extractUrl(m))
          .filter((u): u is string => Boolean(u));
      }
    }

    return favs;
  };

  const handleIndexChange = (itemId: string, direction: 'prev' | 'next', maxLen: number) => {
    setCardStates(prev => {
      const current = prev[itemId] || { index: 0 };
      const newIndex = direction === 'next'
        ? (current.index === maxLen - 1 ? 0 : current.index + 1)
        : (current.index === 0 ? maxLen - 1 : current.index - 1);

      return { ...prev, [itemId]: { index: newIndex } };
    });
  };

  const renderFriendComparisonBadge = (row: ComparisonRow) => {
    if (row.friendRank === null) {
      return (
        <p style={{ fontSize: '0.75rem', color: '#a1a1aa', fontStyle: 'italic', margin: '2px 0 0 0' }}>
          Vriend: Niet gerankt
        </p>
      );
    }

    let color = '#a1a1aa';
    let text = '';

    if (row.rankDiff !== null) {
      if (row.rankDiff < 0) {
        color = '#22c55e';
        text = `Vriend: #${row.friendRank} (▲ ${Math.abs(row.rankDiff)})`;
      } else if (row.rankDiff > 0) {
        color = '#ef4444';
        text = `Vriend: #${row.friendRank} (▼ ${row.rankDiff})`;
      } else {
        color = '#38bdf8';
        text = `Vriend: #${row.friendRank} (=)`;
      }
    }

    return (
      <p style={{ fontSize: '0.75rem', color, fontWeight: 'bold', margin: '2px 0 0 0' }}>
        {text}
      </p>
    );
  };

  return (
    <div className={styles.resultsContainer}>
      <div className={styles.resultsHeader}>
        <h2 className={styles.resultsTitle}>Sorter Comparator</h2>
        <p className={styles.resultsSubtitle}>Vergelijk jouw rankings met die van je vrienden voor {theme.title}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '2rem 0', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Jouw Opgeslagen Sorter</h3>
          {loadingMy ? (
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>Laden...</p>
          ) : mySorters.length === 0 ? (
            <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>Geen opgeslagen sorters gevonden voor dit thema.</p>
          ) : (
            <select
              value={selectedMyId}
              onChange={(e) => setSelectedMyId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              {mySorters.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({new Date(s.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Selecteer Vriend</h3>
          {loadingFriendsList ? (
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>Vrienden laden...</p>
          ) : friendProfiles.length === 0 ? (
            <p style={{ color: '#eab308', fontSize: '0.9rem' }}>Geen geïmporteerde vrienden gevonden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select
                value={selectedFriendProfileId}
                onChange={(e) => setSelectedFriendProfileId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                {friendProfiles.map(fp => (
                  <option key={fp.id} value={fp.id}>
                    {fp.name || 'Naamloze Vriend'}
                  </option>
                ))}
              </select>

              {loadingFriendSorters ? (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Sorters van vriend ophalen...</p>
              ) : friendSorters.length > 0 ? (
                <select
                  value={selectedFriendId}
                  onChange={(e) => setSelectedFriendId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  {friendSorters.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({new Date(s.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Geen sorters gevonden voor deze vriend bij dit thema.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {mySelectedSorter && (
        <div style={{ margin: '1.5rem 0', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setShowMyFavorites(prev => !prev);
              setShowFriendFavorites(false);
            }}
            style={{
              background: showMyFavorites ? '#eab308' : '#27272a',
              color: showMyFavorites ? '#000' : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {showMyFavorites ? '★ Hide My Favorites' : '★ Show My Favorites'}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowFriendFavorites(prev => !prev);
              setShowMyFavorites(false);
            }}
            style={{
              background: showFriendFavorites ? '#38bdf8' : '#27272a',
              color: showFriendFavorites ? '#000' : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {showFriendFavorites ? '★ Hide Friend Favorites' : '★ Show Friend Favorites'}
          </button>

          <button
            type="button"
            onClick={() => setHideControls(prev => !prev)}
            style={{
              background: hideControls ? '#eab308' : '#27272a',
              color: hideControls ? '#000' : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {hideControls ? '👁 Show Controls' : '📷 Hide Controls'}
          </button>
        </div>
      )}

      {mySelectedSorter ? (
        <div className={styles.photocardGrid}>
          {comparisonData.map((row) => {
            const hydratingEntity = findEntityById(row.id);
            const tier = getTier({ elo: row.myElo });

            const isActiveFavMode = showMyFavorites || showFriendFavorites;
            const favoriteMedia = getFavoritesForEntity(row.id, hydratingEntity);
            const mediaList = isActiveFavMode && favoriteMedia.length > 0 ? favoriteMedia : [];
            const itemState = cardStates[row.id] || { index: 0 };
            const currentIndex = Math.min(itemState.index, Math.max(0, mediaList.length - 1));

            let entityToRender = hydratingEntity;

            if (isActiveFavMode && favoriteMedia.length > 0 && hydratingEntity) {
              const currentUrl = favoriteMedia[currentIndex];
              const rawEntity = hydratingEntity as unknown as Record<string, unknown>;
              
              const updatedLayers = rawEntity.layers ? { ...(rawEntity.layers as Record<string, unknown>) } : {};
              const currentLayer = (updatedLayers[activeKey] && typeof updatedLayers[activeKey] === 'object')
                ? { ...(updatedLayers[activeKey] as Record<string, unknown>) }
                : {};
              
              updatedLayers[activeKey] = {
                ...currentLayer,
                imageUrl: currentUrl,
                image: currentUrl,
                media: favoriteMedia,
                images: favoriteMedia,
              };

              entityToRender = {
                ...hydratingEntity,
                imageUrl: currentUrl,
                image: currentUrl,
                media: favoriteMedia,
                images: favoriteMedia,
                layers: updatedLayers,
              } as unknown as BaseEntity;
            }

            return (
              <div 
                key={row.id} 
                className={styles.photocard} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  background: 'transparent', 
                  border: 'none', 
                  boxShadow: 'none' 
                }}
              >
                <div 
                  className={styles.photocardImageWrapper} 
                  style={{ 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    background: 'transparent', 
                    border: 'none',
                    aspectRatio: '3/4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isActiveFavMode && mediaList.length > 0 ? (
                    mediaList[currentIndex]?.endsWith('.mp4') ? (
                      <video
                        src={mediaList[currentIndex]}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img
                        src={mediaList[currentIndex]}
                        alt={row.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )
                  ) : entityToRender ? (
                    <EntityCard
                      entity={entityToRender}
                      activeKey={activeKey}
                      theme={theme}
                      labels={labels}
                    />
                  ) : (
                    <div className={styles.photocardPlaceholder} />
                  )}
                </div>

                {!hideControls && isActiveFavMode && mediaList.length > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(24, 24, 27, 0.8)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIndexChange(row.id, 'prev', mediaList.length);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        borderRadius: '6px',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      ‹
                    </button>
                    <span style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: '600',
                    }}>
                      {currentIndex + 1} / {mediaList.length}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIndexChange(row.id, 'next', mediaList.length);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        borderRadius: '6px',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      ›
                    </button>
                  </div>
                )}

                <div style={{ background: 'rgba(24, 24, 27, 0.9)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>
                      #{row.myRank}
                    </span>
                    <span style={{ backgroundColor: tier.color, color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {tier.abbreviation}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
                      Elo: {Math.round(row.myElo)}
                    </span>
                  </div>
                  {renderFriendComparisonBadge(row)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.6)' }}>
          Selecteer een eigen sorter om de vergelijking te starten.
        </div>
      )}

      {onBack && (
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <button onClick={onBack} className={styles.startButton} style={{ marginTop: 0, background: '#27272a' }}>
            Terug naar Sorter
          </button>
        </div>
      )}
    </div>
  );
}