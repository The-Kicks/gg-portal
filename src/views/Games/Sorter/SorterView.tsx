import React, { useState, useRef, useEffect, type SyntheticEvent } from 'react';
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
  onSave?: () => void;
  toggleFavorite: (side: 'left' | 'right') => void;
  onOpenResults: () => void;
  startOnFavorites: boolean;
  setStartOnFavorites: (valOrUpdater: boolean | ((prev: boolean) => boolean)) => void;
  leftFriendName?: string;
  rightFriendName?: string;
}

interface KeyInfo {
  key: string;
  label: string | React.ReactNode;
  action: string;
}

interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
  audioTracks?: { length: number };
}

/**
 * SorterView component renders the interactive voting interface for comparing two entities,
 * managing media playback, volume controls, category filters, favorites, keyboard shortcuts, and recent form history.
 */
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
  toggleFavorite,
  onOpenResults,
  startOnFavorites,
  setStartOnFavorites,
}: SorterViewProps) {
  const [leftItem, rightItem] = currentMatchup;
  const leftTier = getTier(leftItem);
  const rightTier = getTier(rightItem);

  const [showKeybinds, setShowKeybinds] = useState<boolean>(false);

  const [leftVolume, setLeftVolume] = useState<number>(0);
  const [rightVolume, setRightVolume] = useState<number>(0);

  const [leftHasAudio, setLeftHasAudio] = useState<boolean>(false);
  const [rightHasAudio, setRightHasAudio] = useState<boolean>(false);

  const [leftEmptyFavMessage, setLeftEmptyFavMessage] = useState<string | null>(null);
  const [rightEmptyFavMessage, setRightEmptyFavMessage] = useState<string | null>(null);

  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const leftBgVideoRef = useRef<HTMLVideoElement | null>(null);
  const rightVideoRef = useRef<HTMLVideoElement | null>(null);
  const rightBgVideoRef = useRef<HTMLVideoElement | null>(null);

  const [prevLeftUrl, setPrevLeftUrl] = useState<string>(currentLeftMediaUrl);
  if (currentLeftMediaUrl !== prevLeftUrl) {
    setPrevLeftUrl(currentLeftMediaUrl);
    setLeftVolume(0);
    setLeftHasAudio(false);
  }

  const [prevRightUrl, setPrevRightUrl] = useState<string>(currentRightMediaUrl);
  if (currentRightMediaUrl !== prevRightUrl) {
    setPrevRightUrl(currentRightMediaUrl);
    setRightVolume(0);
    setRightHasAudio(false);
  }

  useEffect(() => {
    if (leftVideoRef.current) leftVideoRef.current.volume = leftVolume;
    if (leftBgVideoRef.current) leftBgVideoRef.current.volume = leftVolume;
  }, [leftVolume]);

  useEffect(() => {
    if (rightVideoRef.current) rightVideoRef.current.volume = rightVolume;
    if (rightBgVideoRef.current) rightBgVideoRef.current.volume = rightVolume;
  }, [rightVolume]);

  const handleLoadedData = (e: SyntheticEvent<HTMLVideoElement>, side: 'left' | 'right') => {
    const video = e.currentTarget as ExtendedHTMLVideoElement;

    const hasAudio =
      Boolean(video.mozHasAudio) ||
      Boolean(video.webkitAudioDecodedByteCount && video.webkitAudioDecodedByteCount > 0) ||
      Boolean(video.audioTracks && video.audioTracks.length > 0);

    if (side === 'left') {
      setLeftHasAudio(hasAudio);
    } else {
      setRightHasAudio(hasAudio);
    }
  };

  const currentLeftFavs = leftCategories.find(c => c.key === 'favorites')?.urls || [];
  const currentRightFavs = rightCategories.find(c => c.key === 'favorites')?.urls || [];
  const isLeftFav = currentLeftFavs.includes(currentLeftMediaUrl);
  const isRightFav = currentRightFavs.includes(currentRightMediaUrl);

  /**
   * Renders the media component (image or video with a blurred background) for the specified side.
   */
  const renderMediaComponent = (url: string, tierColor: string, side: 'left' | 'right'): React.JSX.Element => {
    if (!url) {
      return (
        <div className={styles.mediaWrapper}>
          <span className={styles.noMediaText}>No media available</span>
        </div>
      );
    }

    const isVideoFile = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$|mp4|video/i.test(url);
    const currentVol = side === 'left' ? leftVolume : rightVolume;

    return (
      <div className={styles.mediaContainer} data-fullscreen-target>
        {isVideoFile ? (
          <video
            ref={side === 'left' ? leftBgVideoRef : rightBgVideoRef}
            src={url}
            autoPlay
            loop
            muted
            playsInline
            className={styles.mediaBgBlur}
          />
        ) : (
          <img src={url} alt="" className={styles.mediaBgBlur} />
        )}

        <div className={styles.mediaForegroundWrapper}>
          {isVideoFile ? (
            <video
              ref={side === 'left' ? leftVideoRef : rightVideoRef}
              src={url}
              autoPlay
              loop
              muted={currentVol === 0}
              playsInline
              onLoadedData={(e) => handleLoadedData(e, side)}
              className={styles.mediaAssetContain}
              style={{ borderColor: tierColor }}
            />
          ) : (
            <img src={url} alt="Sorter choice asset" className={styles.mediaAssetContain} style={{ borderColor: tierColor }} />
          )}
        </div>
      </div>
    );
  };

  /**
   * Retrieves the subtitle for an entity based on its parent organization layer connection.
   */
  const getItemSubtitle = (entity: SorterEntity): string => {
    const parentConnection = entity.targetConnections?.find((conn) => conn.sourceEntity?.type === theme.orgLayer);
    return parentConnection?.sourceEntity?.name || '';
  };

  /**
   * Renders a vertical list showing recent form results (wins/losses) and opponents.
   */
  const renderVerticalFormList = (form?: ('W' | 'L')[], opponents?: (string | number)[]) => {
    const maxItems = 5; 
    
    const paddedForm: (('W' | 'L') | undefined)[] = Array.from(
      { length: maxItems }, 
      (_, i) => form?.[i]
    );

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '3px', 
        alignItems: 'center', 
        width: 'fit-content',
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '4px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        minHeight: `${(maxItems * 18) + ((maxItems - 1) * 3) + 8}px`,
        justifyContent: 'flex-start'
      }}>
        {paddedForm.map((result, i) => {
          if (!result) {
            return (
              <div 
                key={`empty-${i}`} 
                style={{ 
                  width: '18px', 
                  height: '18px', 
                }} 
              />
            );
          }

          const opponentId = opponents?.[i];
          const opponent = tournamentList.find(e => e.id === opponentId);
          const opponentName = opponent ? opponent.name : 'Unknown opponent';
          
          return (
            <div 
              key={i} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '18px', 
                height: '18px',
                cursor: 'pointer'
              }}
              title={`${result === 'W' ? 'Won' : 'Lost'} against ${opponentName}`}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  backgroundColor: result === 'W' ? '#22c55e' : '#ef4444',
                  color: '#ffffff',
                }}
              >
                {result}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const liveTopThree = [...tournamentList]
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 3);

  const numpadKeys: KeyInfo[] = [
    { key: '7', label: '7', action: 'Left Asset: Previous (Up)' },
    { key: '8', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6" /></svg>, action: 'Both Assets: Previous (Up)' },
    { key: '9', label: '9', action: 'Right Asset: Previous (Up)' },
    { key: '4', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>, action: 'Vote Left (A) | Hold [0]: Favorite item | Hold [Enter]: New Tab' },
    { key: '5', label: '5', action: 'Undo last vote' },
    { key: '6', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>, action: 'Vote Right (B) | Hold [0]: Favorite item | Hold [Enter]: New Tab' },
    { key: '1', label: '1', action: 'Left Asset: Next (Down)' },
    { key: '2', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>, action: 'Both Assets: Next (Down)' },
    { key: '3', label: '3', action: 'Right Asset: Next (Down)' },
    { key: '0', label: '0', action: 'Modifier: Hold down + [4] or [6] to add media to favorites' },
    { key: '.', label: '•', action: 'Toggle fullscreen / Play video' },
    { key: 'Enter', label: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 10l-5 5 5 5M20 4v7a4 4 0 0 1-4 4H4" /></svg>, action: 'Modifier: Hold down + [4] or [6] to open source' },
  ];

  return (
    <div className={styles.sorterContainer}>
      <div className={styles.mediaColumn} onClick={() => onProcessVote('A')} data-side="left">
        <div className={styles.vignetteOverlay} />
        {renderMediaComponent(currentLeftMediaUrl, leftTier.color, 'left')}

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

      <div className={styles.centerColumn}>
        <div className={styles.centerTopSection}>
          <div className={styles.headerZone}>
            <div className={styles.matchCounter}>
              <span className={styles.matchTitle}>Matchup</span>
              <div className={styles.matchCounterRight}>
                <span className={styles.matchNumber}>#{voteCount}</span>
                <button
                  type="button"
                  onClick={() => setShowKeybinds(!showKeybinds)}
                  title={showKeybinds ? 'Hide shortcuts' : 'Show shortcuts'}
                  className={`${styles.keybindToggleButton} ${showKeybinds ? styles.keybindToggleActive : ''}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.controlsArea}>
            <div className={styles.actionButtonsRow}>
              <button type="button" onClick={onUndo} disabled={!canUndo} className={styles.undoButton}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                Undo
              </button>
            </div>
            <label className={styles.toggleWrapper}>
              <div className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={startOnFavorites}
                  onChange={(e) => setStartOnFavorites(e.target.checked)}
                />
                <span className={styles.toggleSlider}></span>
              </div>
              <span className={styles.toggleLabel}>Start on Favorite</span>
            </label>
          </div>
        </div>

        <div className={styles.controlZone}>
          {leftHasAudio && (
            <div className={styles.volumeSliderWrapperLeft}>
              <span className={styles.volumeLabelLeft}>L</span>
              <button
                type="button"
                onClick={() => setLeftVolume(prev => prev > 0 ? 0 : 0.5)}
                title={leftVolume === 0 ? 'Unmute Left' : 'Mute Left'}
                className={styles.volumeMuteButton}
              >
                {leftVolume === 0 ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                )}
              </button>
              <div className={styles.volumeRangeContainer}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={leftVolume}
                  onChange={(e) => setLeftVolume(parseFloat(e.target.value))}
                  className={styles.volumeRangeInput}
                  style={{ accentColor: '#3b82f6' }}
                />
              </div>
              <span className={styles.volumePercentText}>
                {Math.round(leftVolume * 100)}
              </span>
            </div>
          )}

          {rightHasAudio && (
            <div className={styles.volumeSliderWrapperRight}>
              <span className={styles.volumeLabelRight}>R</span>
              <button
                type="button"
                onClick={() => setRightVolume(prev => prev > 0 ? 0 : 0.5)}
                title={rightVolume === 0 ? 'Unmute Right' : 'Mute Right'}
                className={styles.volumeMuteButton}
              >
                {rightVolume === 0 ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                )}
              </button>
              <div className={styles.volumeRangeContainer}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={rightVolume}
                  onChange={(e) => setRightVolume(parseFloat(e.target.value))}
                  className={styles.volumeRangeInput}
                  style={{ accentColor: '#ec4899' }}
                />
              </div>
              <span className={styles.volumePercentText}>
                {Math.round(rightVolume * 100)}
              </span>
            </div>
          )}

          <div className={styles.carouselControls} style={{ width: '100%', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span className={styles.controlLabel}>Left ({leftMediaIndex + 1}/{leftItemMedia.length})</span>
            </div>

            {leftCategories.length > 0 && (
              <div className={styles.mediaCategoryChips}>
                {leftCategories.map((cat) => {
                  const isSelected = activeLeftMediaCategory === cat.key;
                  const containsMedia = currentLeftMediaUrl ? cat.urls.includes(currentLeftMediaUrl) : false;
                  const isUserFav = cat.key === 'favorites';
                  const isEmptyFav = isUserFav && cat.urls.length === 0;

                  const isFriendCat = Boolean(cat.isFriendFavorite);
                  const friendName = cat.friendUsername || '';

                  const titleString = isEmptyFav
                    ? 'Favorites (Empty)'
                    : (isFriendCat ? `Friend Favorites: ${friendName}` : (typeof cat.label === 'string' ? cat.label : cat.key));

                  return (
                    <button
                      key={cat.key}
                      type="button"
                      className={`
                        ${styles.mediaCategoryChip} 
                        ${isSelected ? styles.mediaCategoryChipActive : ''} 
                        ${!isSelected && containsMedia ? styles.mediaCategoryChipContains : ''}
                        ${isUserFav ? styles.favoriteChip : ''} 
                        ${isEmptyFav ? styles.emptyFavoriteChip : ''}
                      `}
                      style={{
                        opacity: isFriendCat && !containsMedia && !isSelected ? 0.4 : 1,
                      }}
                      title={titleString}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEmptyFav) {
                          setLeftEmptyFavMessage('No Favorites');
                          setTimeout(() => setLeftEmptyFavMessage(null), 3000);
                          return;
                        }
                        setActiveLeftMediaCategory(isSelected ? null : cat.key);
                      }}
                    >
                      {isUserFav ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={containsMedia || isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ) : isFriendCat ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {friendName}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={containsMedia || isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </span>
                      ) : (
                        cat.label
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {leftEmptyFavMessage && (
              <div className={styles.feedbackToast} style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px' }}>
                {leftEmptyFavMessage}
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

          <div className={styles.carouselControls} style={{ width: '100%', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span className={styles.controlLabel}>Right ({rightMediaIndex + 1}/{rightItemMedia.length})</span>
            </div>

            {rightCategories.length > 0 && (
              <div className={styles.mediaCategoryChips}>
                {rightCategories.map((cat) => {
                  const isSelected = activeRightMediaCategory === cat.key;
                  const containsMedia = currentRightMediaUrl ? cat.urls.includes(currentRightMediaUrl) : false;
                  const isUserFav = cat.key === 'favorites';
                  const isEmptyFav = isUserFav && cat.urls.length === 0;

                  const isFriendCat = Boolean(cat.isFriendFavorite);
                  const friendName = cat.friendUsername || '';

                  const titleString = isEmptyFav
                    ? 'Favorites (Empty)'
                    : (isFriendCat ? `Friend Favorites: ${friendName}` : (typeof cat.label === 'string' ? cat.label : cat.key));

                  return (
                    <button
                      key={cat.key}
                      type="button"
                      className={`
                        ${styles.mediaCategoryChip} 
                        ${isSelected ? styles.mediaCategoryChipActive : ''} 
                        ${!isSelected && containsMedia ? styles.mediaCategoryChipContains : ''}
                        ${isUserFav ? styles.favoriteChip : ''} 
                        ${isEmptyFav ? styles.emptyFavoriteChip : ''}
                      `}
                      style={{
                        opacity: isFriendCat && !containsMedia && !isSelected ? 0.4 : 1,
                      }}
                      title={titleString}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEmptyFav) {
                          setRightEmptyFavMessage('No Favorites');
                          setTimeout(() => setRightEmptyFavMessage(null), 3000);
                          return;
                        }
                        setActiveRightMediaCategory(isSelected ? null : cat.key);
                      }}
                    >
                      {isUserFav ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={containsMedia || isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ) : isFriendCat ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {friendName}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={containsMedia || isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </span>
                      ) : (
                        cat.label
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {rightEmptyFavMessage && (
              <div className={styles.feedbackToast} style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px' }}>
                {rightEmptyFavMessage}
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

        {showKeybinds && (
          <div className={styles.keybindMapSection}>
            <h4 className={styles.keybindTitle}>Numpad Shortcuts</h4>
            <div className={styles.numpadGrid}>
              {numpadKeys.map((k, idx) => (
                <div
                  key={typeof k.label === 'string' ? k.key + idx : idx}
                  className={styles.numpadKey}
                  onMouseEnter={() => setHoveredAction(k.action)}
                  onMouseLeave={() => setHoveredAction('Hover over a key for its function')}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', margin: '6px 0' }}>
          {renderVerticalFormList(leftItem.recentForm, leftItem.recentOpponents)}
          {renderVerticalFormList(rightItem.recentForm, rightItem.recentOpponents)}
        </div>

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

      <div className={styles.mediaColumn} onClick={() => onProcessVote('B')} data-side="right">
        <div className={styles.vignetteOverlay} />
        {renderMediaComponent(currentRightMediaUrl, rightTier.color, 'right')}

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