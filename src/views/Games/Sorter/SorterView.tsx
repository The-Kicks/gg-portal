import React, { useState } from 'react';
import type { Theme } from '../../../types';
import type { EloExtended } from './eloUtils';
import { getTier } from './eloUtils';
import type { SorterEntity, MediaCategoryGroup } from './SorterViewPage';
import game from './SorterCSS/SorterGame.module.css';
import results from './SorterCSS/SorterResults.module.css';

const styles = {
  ...game,
  ...results
};

interface SorterViewProps {
  theme: Theme;
  tournamentList: EloExtended<SorterEntity>[];
  currentMatchup: [EloExtended<SorterEntity>, EloExtended<SorterEntity>];
  voteCount: number;
  leftItemMedia: string[];
  rightItemMedia: string[];
  currentLeftMediaUrl: string;
  currentRightMediaUrl: string;
  leftCategories: MediaCategoryGroup[];
  rightCategories: MediaCategoryGroup[];
  activeLeftMediaCategory: string | null;
  activeRightMediaCategory: string | null;
  setActiveLeftMediaCategory: (cat: string | null) => void;
  setActiveRightMediaCategory: (cat: string | null) => void;
  leftMediaIndex: number;
  rightMediaIndex: number;
  hoveredAction: string;
  setLeftMediaIndex: React.Dispatch<React.SetStateAction<number>>;
  setRightMediaIndex: React.Dispatch<React.SetStateAction<number>>;
  setHoveredAction: (action: string) => void;
  onProcessVote: (winner: 'A' | 'B') => void;
  onUndo: () => void;
  canUndo: boolean;
  onSave: () => void;
  toggleFavorite: (side: 'left' | 'right') => void;
  onOpenResults: () => void;
}

interface KeyInfo {
  key: string;
  label: string | React.ReactNode;
  action: string;
}

export function SorterView({
  theme,
  tournamentList,
  currentMatchup,
  voteCount,
  leftItemMedia,
  rightItemMedia,
  currentLeftMediaUrl,
  currentRightMediaUrl,
  leftCategories,
  rightCategories,
  activeLeftMediaCategory,
  activeRightMediaCategory,
  setActiveLeftMediaCategory,
  setActiveRightMediaCategory,
  leftMediaIndex,
  rightMediaIndex,
  hoveredAction,
  setLeftMediaIndex,
  setRightMediaIndex,
  setHoveredAction,
  onProcessVote,
  onUndo,
  canUndo,
  onSave,
  toggleFavorite,
  onOpenResults,
}: SorterViewProps) {
  const [leftItem, rightItem] = currentMatchup;
  const leftTier = getTier(leftItem);
  const rightTier = getTier(rightItem);

  // State om de numpad sneltoetsen sectie in/uit te schakelen
  const [showKeybinds, setShowKeybinds] = useState<boolean>(false);

  const currentLeftFavs = leftCategories.find(c => c.key === 'favorites')?.urls || [];
  const currentRightFavs = rightCategories.find(c => c.key === 'favorites')?.urls || [];
  const isLeftFav = currentLeftFavs.includes(currentLeftMediaUrl);
  const isRightFav = currentRightFavs.includes(currentRightMediaUrl);

  const renderMediaComponent = (url: string, tierColor: string): React.JSX.Element => {
    if (!url) {
      return (
        <div className={styles.mediaWrapper}>
          <span className={styles.noMediaText}>Geen media beschikbaar</span>
        </div>
      );
    }

    const isVideoFile = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.includes('mp4');

    return (
      <div className={styles.mediaContainer} data-fullscreen-target>
        {isVideoFile ? (
          <video src={url} autoPlay loop muted playsInline className={styles.mediaBgBlur} />
        ) : (
          <img src={url} alt="" className={styles.mediaBgBlur} />
        )}

        <div className={styles.mediaForegroundWrapper}>
          {isVideoFile ? (
            <video src={url} autoPlay loop muted playsInline className={styles.mediaAssetContain} style={{ borderColor: tierColor }} />
          ) : (
            <img src={url} alt="Sorter choice asset" className={styles.mediaAssetContain} style={{ borderColor: tierColor }} />
          )}
        </div>
      </div>
    );
  };

  const getItemSubtitle = (entity: SorterEntity): string => {
    const parentConnection = entity.targetConnections?.find((conn) => conn.sourceEntity?.type === theme.orgLayer);
    return parentConnection?.sourceEntity?.name || '';
  };

  const liveTopThree = [...tournamentList]
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 3);

  const numpadKeys: KeyInfo[] = [
    { key: '7', label: '7', action: 'Linker Asset: Vorige (Omhoog)' },
    { key: '8', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6" /></svg>, action: 'Beide Assets: Vorige (Omhoog)' },
    { key: '9', label: '9', action: 'Rechter Asset: Vorige (Omhoog)' },
    { key: '4', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>, action: 'Stem Links (A) | Hold [0]: Favoriet album | Hold [Enter]: Nieuw Tabblad' },
    { key: '5', label: '5', action: 'Laatste stem ongedaan maken' },
    { key: '6', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>, action: 'Stem Rechts (B) | Hold [0]: Favoriet album | Hold [Enter]: Nieuw Tabblad' },
    { key: '1', label: '1', action: 'Linker Asset: Volgende (Omlaag)' },
    { key: '2', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>, action: 'Beide Assets: Volgende (Omlaag)' },
    { key: '3', label: '3', action: 'Rechter Asset: Volgende (Omlaag)' },
    { key: '0', label: '0', action: 'Modifier: Houd ingedrukt + [4] of [6] om media aan favorieten toe te voegen' },
    { key: '.', label: '•', action: 'Volledig scherm inschakelen / Video afspelen' },
    { key: 'Enter', label: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 10l-5 5 5 5M20 4v7a4 4 0 0 1-4 4H4" /></svg>, action: 'Modifier: Houd ingedrukt + [4] of [6] om bron te openen' },
  ];

  return (
    <div className={styles.sorterContainer}>
      {/* LINKER KANDIDAAT */}
      <div className={styles.mediaColumn} onClick={() => onProcessVote('A')} data-side="left">
        <div className={styles.vignetteOverlay} />
        {renderMediaComponent(currentLeftMediaUrl, leftTier.color)}

        {currentLeftMediaUrl && (
          <button
            type="button"
            className={`${styles.favoriteStar} ${isLeftFav ? styles.isFavorite : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite('left');
            }}
          >
            <svg className={styles.starIcon} viewBox="0 0 24 24" fill={isLeftFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )}

        <div className={`${styles.entityCard} ${styles.entityCardLeft}`}>
          <h3 className={styles.entityName}>
            <span className={styles.tierTag} style={{ backgroundColor: leftTier.color }}>{leftTier.abbreviation}</span>
            {leftItem.name}
          </h3>
          <p className={styles.entitySubtitle}>{getItemSubtitle(leftItem)}</p>
        </div>
      </div>

      {/* MIDDENSECTIE */}
      <div className={styles.centerColumn}>
        {/* Bovenste groep: Matchcounter én Undo/Opslaan knoppen netjes bij elkaar */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '12px' }}>
          <div className={styles.headerZone}>
            <div className={styles.matchCounter}>
              <span className={styles.matchTitle}>Matchup</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={styles.matchNumber}>#{voteCount}</span>
                <button
                  type="button"
                  onClick={() => setShowKeybinds(!showKeybinds)}
                  title={showKeybinds ? 'Verberg sneltoetsen' : 'Toon sneltoetsen'}
                  style={{
                    background: showKeybinds ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: showKeybinds ? 'rgba(59, 130, 246, 0.4)' : '#2d2d34',
                    color: showKeybinds ? '#60a5fa' : '#a1a1aa',
                    borderRadius: '6px',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* CONTROLS AREA DIRECT ONDER MATCHCOUNTER */}
          <div className={styles.controlsArea}>
            <button type="button" onClick={onUndo} disabled={!canUndo} className={styles.undoButton}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
              Undo
            </button>
            <button type="button" onClick={onSave} className={styles.saveButton}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              Opslaan
            </button>
          </div>
        </div>

        <div className={styles.controlZone}>
          {/* Linker Kant Media Categorieën & Carrousel */}
          <div className={styles.carouselControls}>
            <span className={styles.controlLabel}>Links ({leftMediaIndex + 1}/{leftItemMedia.length})</span>

            {leftCategories.length > 0 && (
              <div className={styles.mediaCategoryChips}>
                {leftCategories.map((cat) => {
                  const isSelected = activeLeftMediaCategory === cat.key;
                  const containsMedia = currentLeftMediaUrl ? cat.urls.includes(currentLeftMediaUrl) : false;
                  const isEmptyFav = cat.key === 'favorites' && cat.urls.length === 0;
                  const isFavCat = cat.key === 'favorites';

                  return (
                    <button
                      key={cat.key}
                      type="button"
                      className={`
                  ${styles.mediaCategoryChip} 
                  ${isSelected ? styles.mediaCategoryChipActive : ''} 
                  ${!isSelected && containsMedia ? styles.mediaCategoryChipContains : ''}
                  ${isFavCat ? styles.favoriteChip : ''} 
                  ${isEmptyFav ? styles.emptyFavoriteChip : ''}
                `}
                      title={isEmptyFav ? 'Favorites (Leeg)' : cat.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLeftMediaCategory(isSelected ? null : cat.key);
                      }}
                    >
                      {isFavCat ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={containsMedia || isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ) : (
                        cat.label
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.carouselActionRow}>
              <button
                disabled={leftItemMedia.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setLeftMediaIndex((prev) => prev === 0 ? leftItemMedia.length - 1 : prev - 1);
                }}
                className={styles.arrowButton}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6" /></svg>
              </button>
              <button
                disabled={leftItemMedia.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setLeftMediaIndex((prev) => prev === leftItemMedia.length - 1 ? 0 : prev + 1);
                }}
                className={styles.arrowButton}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>
          </div>

          <div className={styles.vsBadge}>VS</div>

          {/* Rechter Kant Media Categorieën & Carrousel */}
          <div className={styles.carouselControls}>
            <span className={styles.controlLabel}>Rechts ({rightMediaIndex + 1}/{rightItemMedia.length})</span>

            {rightCategories.length > 0 && (
              <div className={styles.mediaCategoryChips}>
                {rightCategories.map((cat) => {
                  const isSelected = activeRightMediaCategory === cat.key;
                  const containsMedia = currentRightMediaUrl ? cat.urls.includes(currentRightMediaUrl) : false;
                  const isEmptyFav = cat.key === 'favorites' && cat.urls.length === 0;
                  const isFavCat = cat.key === 'favorites';

                  return (
                    <button
                      key={cat.key}
                      type="button"
                      className={`
                  ${styles.mediaCategoryChip} 
                  ${isSelected ? styles.mediaCategoryChipActive : ''} 
                  ${!isSelected && containsMedia ? styles.mediaCategoryChipContains : ''}
                  ${isFavCat ? styles.favoriteChip : ''} 
                  ${isEmptyFav ? styles.emptyFavoriteChip : ''}
                `}
                      title={isEmptyFav ? 'Favorites (Leeg)' : cat.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRightMediaCategory(isSelected ? null : cat.key);
                      }}
                    >
                      {isFavCat ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={containsMedia || isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ) : (
                        cat.label
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.carouselActionRow}>
              <button
                disabled={rightItemMedia.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setRightMediaIndex((prev) => prev === 0 ? rightItemMedia.length - 1 : prev - 1);
                }}
                className={styles.arrowButton}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6" /></svg>
              </button>
              <button
                disabled={rightItemMedia.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setRightMediaIndex((prev) => prev === rightItemMedia.length - 1 ? 0 : prev + 1);
                }}
                className={styles.arrowButton}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Visuele Keybind Numpad Map */}
        {showKeybinds && (
          <div className={styles.keybindMapSection}>
            <h4 className={styles.keybindTitle}>Numpad Sneltoetsen</h4>
            <div className={styles.numpadGrid}>
              {numpadKeys.map((k, idx) => (
                <div
                  key={typeof k.label === 'string' ? k.key + idx : idx}
                  className={styles.numpadKey}
                  onMouseEnter={() => setHoveredAction(k.action)}
                  onMouseLeave={() => setHoveredAction('Hover over een toets voor de functie')}
                >
                  {k.label}
                </div>
              ))}
            </div>
            <div className={styles.keybindInterpreter}>
              <p>{hoveredAction}</p>
            </div>
          </div>
        )}

        {/* Live Top 3 (Wordt door space-between onderaan gedrukt) */}
        <div className={styles.leaderboardZone} onClick={onOpenResults}>
          <h4 className={styles.leaderboardTitle}>Standings</h4>
          <div className={styles.topThreeContainer}>
            {liveTopThree.map((item, index) => {
              const isCurrent = item.id === leftItem.id || item.id === rightItem.id;
              const medals = ['🥇', '🥈', '🥉'];

              return (
                <div
                  key={item.id}
                  className={`${styles.topThreeItem} ${isCurrent ? styles.topThreeItemActive : ''}`}
                >
                  <div className={styles.topThreeLayout}>
                    <span className={styles.topThreeMedal}>{medals[index]}</span>
                    <span className={styles.topThreeName}>{item.name}</span>
                  </div>
                  <span className={styles.topThreeElo}>
                    {Math.round(item.elo)} <span className={styles.eloLabel}>ELO</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RECHTER KANDIDAAT */}
      <div className={styles.mediaColumn} onClick={() => onProcessVote('B')} data-side="right">
        <div className={styles.vignetteOverlay} />
        {renderMediaComponent(currentRightMediaUrl, rightTier.color)}

        {currentRightMediaUrl && (
          <button
            type="button"
            className={`${styles.favoriteStar} ${isRightFav ? styles.isFavorite : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite('right');
            }}
          >
            <svg className={styles.starIcon} viewBox="0 0 24 24" fill={isRightFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )}

        <div className={`${styles.entityCard} ${styles.entityCardRight}`}>
          <h3 className={styles.entityName}>
            <span className={styles.tierTag} style={{ backgroundColor: rightTier.color }}>{rightTier.abbreviation}</span>
            {rightItem.name}
          </h3>
          <p className={styles.entitySubtitle}>{getItemSubtitle(rightItem)}</p>
        </div>
      </div>
    </div>
  );
}