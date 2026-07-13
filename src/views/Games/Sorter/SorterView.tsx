import React from 'react';
import type { Theme } from '../../../types';
import type { EloExtended } from './eloUtils';
import type { SorterEntity } from './SorterViewPage';
import { getCalibrationProgress, getSorterStageInfo } from './eloUtils';
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
  currentLeftFav: string;
  currentRightFav: string;
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
  currentLeftFav,
  currentRightFav,
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
}: SorterViewProps) {
  const [leftItem, rightItem] = currentMatchup;

  const calibrationProgress = getCalibrationProgress(tournamentList);
  const currentStage = getSorterStageInfo(tournamentList);

  const renderMediaComponent = (url: string): React.JSX.Element => {
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
        {/* 1. Wazige achtergrond om lege ruimtes op te vullen */}
        {isVideoFile ? (
          <video src={url} autoPlay loop muted playsInline className={styles.mediaBgBlur} />
        ) : (
          <img src={url} alt="" className={styles.mediaBgBlur} />
        )}

        {/* 2. Scherpe voorgrond die altijd volledig binnen het scherm past */}
        <div className={styles.mediaForegroundWrapper}>
          {isVideoFile ? (
            <video src={url} autoPlay loop muted playsInline className={styles.mediaAssetContain} />
          ) : (
            <img src={url} alt="Sorter choice asset" className={styles.mediaAssetContain} />
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
    { key: '4', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>, action: 'Stem Links (A) | Hold [0]: Favoriet | Hold [Enter]: Nieuw Tabblad' },
    { key: '5', label: '5', action: 'Laatste stem ongedaan maken' },
    { key: '6', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>, action: 'Stem Rechts (B) | Hold [0]: Favoriet | Hold [Enter]: Nieuw Tabblad' },
    { key: '1', label: '1', action: 'Linker Asset: Volgende (Omlaag)' },
    { key: '2', label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>, action: 'Beide Assets: Volgende (Omlaag)' },
    { key: '3', label: '3', action: 'Rechter Asset: Volgende (Omlaag)' },
    { key: '0', label: '0', action: 'Modifier: Houd ingedrukt + [4] of [6] om media te favorieten' },
    { key: '.', label: '•', action: 'Volledig scherm inschakelen / Video afspelen' },
    { key: 'Enter', label: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 10l-5 5 5 5M20 4v7a4 4 0 0 1-4 4H4" /></svg>, action: 'Modifier: Houd ingedrukt + [4] of [6] om bron te openen' },
  ];

  return (
    <div className={styles.sorterContainer}>
      {/* LINKER KANDIDAAT */}
      <div className={styles.mediaColumn} onClick={() => onProcessVote('A')} data-side="left">
        <div className={styles.vignetteOverlay} />
        {renderMediaComponent(currentLeftMediaUrl)}

        {currentLeftMediaUrl && (
          <button
            type="button"
            className={`${styles.favoriteStar} ${currentLeftFav === currentLeftMediaUrl ? styles.isFavorite : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite('left');
            }}
          >
            <svg className={styles.starIcon} viewBox="0 0 24 24" fill={currentLeftFav === currentLeftMediaUrl ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )}

        <div className={`${styles.entityCard} ${styles.entityCardLeft}`}>
          <h3 className={styles.entityName}>{leftItem.name}</h3>
          <p className={styles.entitySubtitle}>{getItemSubtitle(leftItem)}</p>
        </div>
      </div>

      {/* MIDDENSECTIE */}
      <div className={styles.centerColumn}>
        <div className={styles.headerZone}>
          <div className={styles.stageWrapper}>
            <span className={styles.stageBadge} style={{ borderColor: currentStage.color, color: currentStage.color, stroke: currentStage.color }}>
              <span className={styles.badgePulse} style={{ backgroundColor: currentStage.color }} />
              {currentStage.title}
            </span>
            <p className={styles.stageDescription}>{currentStage.description}</p>
          </div>

          <div className={styles.matchCounter}>
            <span className={styles.matchTitle}>Matchup</span>
            <span className={styles.matchNumber}>#{voteCount + 1}</span>
          </div>

          <div className={styles.progressContainer}>
            <div className={styles.progressBar} style={{ width: `${calibrationProgress}%` }} />
          </div>
          <div className={styles.progressTextWrapper}>
            <span className={styles.progressLabel}>Sorter Progress</span>
            <span className={styles.progressPercentage}>{calibrationProgress}%</span>
          </div>
        </div>

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

        {/* Handmatige Media Carrousel Knoppen met Wrap-Around Loop */}
        <div className={styles.controlZone}>
          <div className={styles.carouselControls}>
            <span className={styles.controlLabel}>Links ({leftMediaIndex + 1}/{leftItemMedia.length})</span>
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

          <div className={styles.carouselControls}>
            <span className={styles.controlLabel}>Rechts ({rightMediaIndex + 1}/{rightItemMedia.length})</span>
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

        {/* Live Top 3 */}
        <div className={styles.leaderboardZone}>
          <h4 className={styles.leaderboardTitle}>Live Top 3</h4>
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
        {renderMediaComponent(currentRightMediaUrl)}

        {currentRightMediaUrl && (
          <button
            type="button"
            className={`${styles.favoriteStar} ${currentRightFav === currentRightMediaUrl ? styles.isFavorite : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite('right');
            }}
          >
            <svg className={styles.starIcon} viewBox="0 0 24 24" fill={currentRightFav === currentRightMediaUrl ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )}

        <div className={`${styles.entityCard} ${styles.entityCardRight}`}>
          <h3 className={styles.entityName}>{rightItem.name}</h3>
          <p className={styles.entitySubtitle}>{getItemSubtitle(rightItem)}</p>
        </div>
      </div>
    </div>
  );
}