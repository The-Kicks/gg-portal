import { useState, useMemo } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { getTier } from './eloUtils';
import styles from './SorterCSS/SorterResults.module.css';

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
  const [globalFavoriteMode, setGlobalFavoriteMode] = useState<boolean>(false);
  const [showDefaultsMode, setShowDefaultsMode] = useState<boolean>(false);

  const sortedResults = useMemo(() => {
    return [...finalPool].sort((a, b) => b.elo - a.elo);
  }, [finalPool]);

  const getFavoritesForEntity = (entityId: string): string[] => {
    if (getFavoriteUrls) {
      const favs = getFavoriteUrls(entityId);
      if (favs && favs.length > 0) return favs;
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('favorite') || key.includes('fav'))) {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data[entityId] && Array.isArray(data[entityId]) && data[entityId].length > 0) {
            return data[entityId];
          }
        }
      }
    } catch (e) {
      console.error("Fout bij uitlezen localStorage favorieten", e);
    }

    return [];
  };

  const handleGlobalToggle = () => {
    setGlobalFavoriteMode(prev => !prev);
    setShowDefaultsMode(false);
  };

  const handleDefaultsToggle = () => {
    setShowDefaultsMode(prev => !prev);
  };

  const handleIndexChange = (itemId: string, direction: 'prev' | 'next', maxLen: number) => {
    setShowDefaultsMode(false);
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
        
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleGlobalToggle}
            style={{
              background: globalFavoriteMode ? '#eab308' : '#27272a',
              color: globalFavoriteMode ? '#000' : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {globalFavoriteMode ? '★ Hide Controls (Ready for Screenshot)' : '★ Swap to Favorites'}
          </button>

          <button
            type="button"
            onClick={handleDefaultsToggle}
            style={{
              background: showDefaultsMode ? '#eab308' : '#27272a',
              color: showDefaultsMode ? '#000' : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {showDefaultsMode ? '↩ Show Favorites (Restore Selection)' : '↩ Show Defaults'}
          </button>
        </div>
      </div>

      <div className={styles.photocardGrid}>
        {sortedResults.map((item, index) => {
          const position = index + 1;
          const tier = getTier(item);
          
          const allMedia = extractMediaUrls(item);
          const defaultProfilePic = allMedia[0] || '';
          
          const favoriteMedia = getFavoritesForEntity(item.id);
          
          const mediaList = showDefaultsMode 
            ? [defaultProfilePic] 
            : (favoriteMedia.length > 0 ? favoriteMedia : [defaultProfilePic]);
          
          const itemState = cardStates[item.id] || { index: 0 };
          
          const currentIndex = showDefaultsMode ? 0 : Math.min(itemState.index, Math.max(0, mediaList.length - 1));
          const currentUrl = mediaList[currentIndex] || defaultProfilePic;

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

              {globalFavoriteMode && !showDefaultsMode && mediaList.length > 1 && (
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

      {onRestart && (
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <button onClick={onRestart} className={styles.startButton} style={{ marginTop: 0 }}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}