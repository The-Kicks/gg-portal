import { useState, useMemo } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { getTier } from './eloUtils';
import { saveGameResult } from '../../../core/api';
import styles from './SorterCSS/SorterResults.module.css';

interface UserStorageObject {
  id?: string;
  _id?: string;
}

/**
 * Haalt direct de userId op uit localStorage
 */
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

interface SorterResultsViewProps {
  theme: Theme;
  finalPool: EloExtended<HydratedEntity>[];
  extractMediaUrls: (entity: HydratedEntity) => string[];
  getFavoriteUrls?: (entityId: string) => string[];
  onRestart?: () => void;
}

export function SorterResultsView({
  theme,
  finalPool,
  extractMediaUrls,
  getFavoriteUrls,
  onRestart
}: SorterResultsViewProps) {
  const [cardStates, setCardStates] = useState<Record<string, { index: number }>>({});
  const [showFavorites, setShowFavorites] = useState<boolean>(false);
  const [hideControls, setHideControls] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const sortedResults = useMemo(() => {
    return [...finalPool].sort((a, b) => b.elo - a.elo);
  }, [finalPool]);

  // Map voor globale ranglijst posities
  const globalRankMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedResults.forEach((item, index) => {
      map.set(item.id, index + 1);
    });
    return map;
  }, [sortedResults]);

  // Entiteiten map voor L3 opzoekwerk
  const entityMap = useMemo(() => {
    return new Map((theme.entities || []).map(e => [e.id, e]));
  }, [theme.entities]);

  // Groepering per L3 ouderlaag voor de onderste sectie
  const rankedGroups = useMemo(() => {
    const groupMap = new Map<string, { groupName: string; entities: EloExtended<HydratedEntity>[]; totalElo: number }>();

    finalPool.forEach((item) => {
      let parentName = 'Overig';
      if (item.targetConnections && item.targetConnections.length > 0) {
        const conn = item.targetConnections.find(c => {
          const src = c.sourceEntity || (c.sourceEntityId ? entityMap.get(c.sourceEntityId) : null);
          return src?.type === theme.orgLayer;
        }) || item.targetConnections[0];
        
        const parentEntity = conn?.sourceEntity || (conn?.sourceEntityId ? entityMap.get(conn.sourceEntityId) : null);
        if (parentEntity) {
          parentName = parentEntity.name;
        }
      }

      if (!groupMap.has(parentName)) {
        groupMap.set(parentName, { groupName: parentName, entities: [], totalElo: 0 });
      }
      const group = groupMap.get(parentName)!;
      group.entities.push(item);
      group.totalElo += item.elo;
    });

    return Array.from(groupMap.values())
      .map((group) => {
        const avgElo = group.entities.length > 0 ? group.totalElo / group.entities.length : 0;
        group.entities.sort((a, b) => b.elo - a.elo);
        return { ...group, avgElo };
      })
      .sort((a, b) => b.avgElo - a.avgElo);
  }, [finalPool, entityMap, theme.orgLayer]);

  // Helper voor >30% afwijkingskleur in de onderste sectie
  const getDeviationStyle = (itemElo: number, groupAvg: number) => {
    if (groupAvg === 0) return { style: {}, borderColor: undefined };
    const diffRatio = (itemElo - groupAvg) / groupAvg;

    if (diffRatio > 0.3) {
      return {
        style: { color: '#22c55e', fontWeight: 'bold' },
        borderColor: '#22c55e'
      };
    } else if (diffRatio < -0.3) {
      return {
        style: { color: '#ef4444', fontWeight: 'bold' },
        borderColor: '#ef4444'
      };
    }
    return { style: {}, borderColor: undefined };
  };

  // Sla voltooide sorter op in de backend via een prompt voor de naam
  const handleSaveFinishedSorter = async () => {
    const defaultName = `Sorter Results: ${theme.title}`;
    const enteredName = window.prompt("Geef een naam op voor je opgeslagen sorter:", defaultName);

    if (enteredName === null) {
      return;
    }

    const userId = getStoredUserId();
    if (!userId) {
      alert("Geen actieve gebruiker gevonden in localStorage om de resultaten op te slaan.");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        userId,
        themeId: theme.id,
        type: 'sorter_finished',
        name: enteredName.trim() || defaultName,
        data: {
          rankedItems: sortedResults.map((item, index) => ({
            id: item.id,
            name: item.name,
            elo: Math.round(item.elo),
            rank: index + 1
          }))
        }
      };

      await saveGameResult(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Fout bij opslaan voltooide sorter:", err);
      alert("Er is iets misgegaan bij het opslaan van je resultaten.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportTxt = () => {
    const lines = sortedResults.map((item, index) => {
      const rank = index + 1;
      const name = item.name || 'Unknown';
      const elo = Math.round(item.elo);

      let parentName = '';
      if (item.targetConnections && item.targetConnections.length > 0) {
        const conn = item.targetConnections[0];
        const parentEntity = conn?.sourceEntityId ? entityMap.get(conn.sourceEntityId) : null;
        
        if (parentEntity) {
          parentName = parentEntity.name;
        }
      }

      const parentPart = parentName ? ` (${parentName})` : '';
      return `${rank}. ${name}${parentPart} ${elo}`;
    });

    const fileContent = lines.join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const safeTitle = theme.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}_sorter_results.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFavoritesForEntity = (entityId: string): string[] => {
    if (getFavoriteUrls) {
      const favs = getFavoriteUrls(entityId);
      if (favs && favs.length > 0) return favs;
    }
    return [];
  };

  const handleFavoritesToggle = () => {
    setShowFavorites(prev => !prev);
  };

  const handleControlsToggle = () => {
    setHideControls(prev => !prev);
  };

  const handleIndexChange = (itemId: string, direction: 'prev' | 'next', maxLen: number) => {
    setCardStates(prev => {
      const current = prev[itemId] || { index: 0 };
      const newIndex = direction === 'next'
        ? (current.index === maxLen - 1 ? 0 : current.index + 1)
        : (current.index === 0 ? maxLen - 1 : current.index - 1);

      return {
        ...prev,
        [itemId]: { index: newIndex }
      };
    });
  };

  return (
    <div className={styles.resultsContainer}>
      <div className={styles.resultsHeader}>
        <h2 className={styles.resultsTitle}>Sorter Results</h2>
        <p className={styles.resultsSubtitle}>Your ultimate ranking for {theme.title}</p>

        {/* Controle paneel met knoppen */}
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleSaveFinishedSorter}
            disabled={isSaving}
            style={{
              background: saveSuccess ? '#22c55e' : '#3b82f6',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {isSaving ? 'Saving...' : saveSuccess ? '✓ Saved!' : '💾 Save Results'}
          </button>

          <button
            type="button"
            onClick={handleExportTxt}
            style={{
              background: '#10b981',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            📄 Export TXT
          </button>

          <button
            type="button"
            onClick={handleFavoritesToggle}
            style={{
              background: showFavorites ? '#eab308' : '#27272a',
              color: showFavorites ? '#000' : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {showFavorites ? '★ Show Normal ProfileCard' : '★ Show Favorites'}
          </button>

          <button
            type="button"
            onClick={handleControlsToggle}
            style={{
              background: hideControls ? '#eab308' : '#27272a',
              color: hideControls ? '#000' : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {hideControls ? '👁 Show Controls' : '📷 Hide Controls (Screenshot)'}
          </button>
        </div>
      </div>

      {/* 1. Standaard Resultaten Grid */}
      <div className={styles.photocardGrid}>
        {sortedResults.map((item, index) => {
          const position = index + 1;
          const tier = getTier(item);

          const allMedia = extractMediaUrls(item);
          const defaultProfilePic = allMedia[0] || '';
          const favoriteMedia = getFavoritesForEntity(item.id);

          const mediaList = showFavorites && favoriteMedia.length > 0 ? favoriteMedia : [defaultProfilePic];

          const itemState = cardStates[item.id] || { index: 0 };
          const currentIndex = Math.min(itemState.index, Math.max(0, mediaList.length - 1));
          const currentUrl = mediaList[currentIndex] || '';

          const isVideoFile = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(currentUrl) || currentUrl.includes('mp4');

          return (
            <div key={item.id} className={styles.photocard} style={{ position: 'relative' }}>
              <div className={`${styles.rankBadge} ${position <= 3 ? styles.topRank : ''}`}>
                #{position}
              </div>

              <div className={styles.photocardImageWrapper} style={{ borderColor: tier.color }}>
                {currentUrl ? (
                  isVideoFile ? (
                    <video
                      src={currentUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className={styles.photocardImage}
                    />
                  ) : (
                    <img
                      src={currentUrl}
                      alt={item.name}
                      className={styles.photocardImage}
                      loading="lazy"
                    />
                  )
                ) : (
                  <div className={styles.photocardPlaceholder} />
                )}

                <div className={styles.photocardOverlay}>
                  <h4 className={styles.photocardName}>
                    <span className={styles.tierTag} style={{ backgroundColor: tier.color }}>{tier.abbreviation}</span>
                    {item.name}
                  </h4>
                  <p className={styles.photocardScore}>Elo: {Math.round(item.elo)}</p>
                </div>
              </div>

              {!hideControls && showFavorites && mediaList.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '75px',
                  left: '12px',
                  right: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  zIndex: 50,
                  pointerEvents: 'none',
                }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIndexChange(item.id, 'prev', mediaList.length);
                    }}
                    style={{
                      pointerEvents: 'auto',
                      background: 'rgba(0,0,0,0.85)',
                      border: '1px solid #fff',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                    }}
                  >
                    ‹
                  </button>
                  <span style={{
                    background: 'rgba(0,0,0,0.85)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}>
                    {currentIndex + 1} / {mediaList.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIndexChange(item.id, 'next', mediaList.length);
                    }}
                    style={{
                      pointerEvents: 'auto',
                      background: 'rgba(0,0,0,0.85)',
                      border: '1px solid #fff',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                    }}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. EXTRA SECTIE ONDERAAN: Hiërarchisch gegroepeerd per L3 groep */}
      <div style={{ marginTop: '4rem', borderTop: '2px dashed rgba(255, 255, 255, 0.15)', paddingTop: '2.5rem' }}>
        <h3 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '1.5rem', textAlign: 'center' }}>
          Hiërarchisch Overzicht per Organisatie
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {rankedGroups.map((group, groupIndex) => {
            const l3Rank = groupIndex + 1;
            const avgEloRounded = Math.round(group.avgElo);

            return (
              <div key={group.groupName} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem' }}>
                  <span style={{ background: '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    #{l3Rank}
                  </span>
                  <h4 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>{group.groupName}</h4>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>(Gemiddeld: {avgEloRounded} ELO)</span>
                </div>

                <div className={styles.photocardGrid}>
                  {group.entities.map((item) => {
                    const globalPosition = globalRankMap.get(item.id) || 0;
                    const tier = getTier(item);

                    const allMedia = extractMediaUrls(item);
                    const defaultProfilePic = allMedia[0] || '';
                    const favoriteMedia = getFavoritesForEntity(item.id);
                    const mediaList = showFavorites && favoriteMedia.length > 0 ? favoriteMedia : [defaultProfilePic];

                    const itemState = cardStates[item.id] || { index: 0 };
                    const currentIndex = Math.min(itemState.index, Math.max(0, mediaList.length - 1));
                    const currentUrl = mediaList[currentIndex] || '';
                    const isVideoFile = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(currentUrl) || currentUrl.includes('mp4');

                    const deviation = getDeviationStyle(item.elo, group.avgElo);
                    const activeBorderColor = deviation.borderColor || tier.color;

                    return (
                      <div key={item.id} className={styles.photocard} style={{ position: 'relative' }}>
                        <div className={`${styles.rankBadge} ${globalPosition <= 3 ? styles.topRank : ''}`}>
                          #{globalPosition}
                        </div>

                        <div className={styles.photocardImageWrapper} style={{ borderColor: activeBorderColor }}>
                          {currentUrl ? (
                            isVideoFile ? (
                              <video
                                src={currentUrl}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className={styles.photocardImage}
                              />
                            ) : (
                              <img
                                src={currentUrl}
                                alt={item.name}
                                className={styles.photocardImage}
                                loading="lazy"
                              />
                            )
                          ) : (
                            <div className={styles.photocardPlaceholder} />
                          )}

                          <div className={styles.photocardOverlay}>
                            <h4 className={styles.photocardName}>
                              <span className={styles.tierTag} style={{ backgroundColor: tier.color }}>{tier.abbreviation}</span>
                              {item.name}
                            </h4>
                            <p className={styles.photocardScore} style={deviation.style}>
                              Elo: {Math.round(item.elo)}
                            </p>
                          </div>
                        </div>

                        {!hideControls && showFavorites && mediaList.length > 1 && (
                          <div style={{
                            position: 'absolute',
                            bottom: '75px',
                            left: '12px',
                            right: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            zIndex: 50,
                            pointerEvents: 'none',
                          }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIndexChange(item.id, 'prev', mediaList.length);
                              }}
                              style={{
                                pointerEvents: 'auto',
                                background: 'rgba(0,0,0,0.85)',
                                border: '1px solid #fff',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                              }}
                            >
                              ‹
                            </button>
                            <span style={{
                              background: 'rgba(0,0,0,0.85)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.3)',
                            }}>
                              {currentIndex + 1} / {mediaList.length}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIndexChange(item.id, 'next', mediaList.length);
                              }}
                              style={{
                                pointerEvents: 'auto',
                                background: 'rgba(0,0,0,0.85)',
                                border: '1px solid #fff',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                              }}
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {onRestart && (
        <div style={{ textAlign: 'center', margin: '3rem 0 2rem 0' }}>
          <button onClick={onRestart} className={styles.startButton} style={{ marginTop: 0 }}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}