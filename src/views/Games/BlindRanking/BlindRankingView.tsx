import React from 'react';
import type { HydratedEntity } from '../../../types';
import styles from './BlindRanking.module.css';

interface ViewProps {
  isPlaying: boolean;
  availableCategories: string[];
  activeCategory: string;
  currentEntity: HydratedEntity | undefined;
  currentMediaUrls: string[];
  currentMediaIndex: number;
  rankings: (HydratedEntity | null)[];
  currentIndex: number;
  maxSlots: number;
  leftSlots: number[];
  rightSlots: number[];
  setIsPlaying: (val: boolean) => void;
  handleStartGame: (categoryName: string) => void;
  handlePlaceEntity: (slotIndex: number) => void;
  handleNextMedia: () => void;
  handlePrevMedia: () => void;
}

export const BlindRankingView: React.FC<ViewProps> = ({
  isPlaying,
  availableCategories,
  activeCategory,
  currentEntity,
  currentMediaUrls,
  currentMediaIndex,
  rankings,
  currentIndex,
  maxSlots,
  leftSlots,
  rightSlots,
  setIsPlaying,
  handleStartGame,
  handlePlaceEntity,
  handleNextMedia,
  handlePrevMedia
}) => {

  // ==========================================
  // SCHERM A: ACTIEVE GAMEPLAY INTERFACE
  // ==========================================
  if (isPlaying) {
    return (
      <div className={styles.gameContainer}>
        <div className={styles.headerSection}>
          <button onClick={() => setIsPlaying(false)} className={styles.btnBack}>◀ Categorieën</button>
          <div className={styles.categoryBadge}>BLIND RANKING</div>
          <h1 className={styles.categoryTitle}>{activeCategory}</h1>
          <div className={styles.progressCounter}>
            Kaart {Math.min(currentIndex + 1, maxSlots)} van {maxSlots}
          </div>
        </div>

        <div className={styles.gameGrid}>
          {/* LINKER SLOTKOLOM */}
          <div className={styles.sideColumn}>
            {leftSlots.map(index => {
              const placed = rankings[index];
              return (
                <button
                  key={index}
                  disabled={placed !== null || !currentEntity}
                  onClick={() => handlePlaceEntity(index)}
                  className={`${styles.slotButton} ${placed ? styles.slotFilled : styles.slotEmpty}`}
                >
                  <span className={styles.slotNumber}>{index + 1}</span>
                  <span className={styles.slotName}>{placed ? placed.name : 'Kies deze plek'}</span>
                </button>
              );
            })}
          </div>

          {/* MIDDENKOLOM: TARGET CARD & ALBUM */}
          <div className={styles.centerColumn}>
            {currentEntity && currentIndex < maxSlots ? (
              <div className={styles.entityCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardSub}>Volgende blinde kaart:</span>
                  <h2 className={styles.entityName}>{currentEntity.name}</h2>
                </div>
                
                <div className={styles.albumWrapper}>
                  {currentMediaUrls.length > 0 ? (
                    <>
                      <img src={currentMediaUrls[currentMediaIndex]} alt="Asset Album" className={styles.albumImage} />
                      {currentMediaUrls.length > 1 && (
                        <div className={styles.albumNavigation}>
                          <button type="button" onClick={handlePrevMedia} className={styles.albumNavBtn}>◀</button>
                          <span className={styles.albumCounter}>Asset {currentMediaIndex + 1} / {currentMediaUrls.length}</span>
                          <button type="button" onClick={handleNextMedia} className={styles.albumNavBtn}>▶</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.noMediaPlaceholder}>Geen media gekoppeld</div>
                  )}
                </div>

                <div className={styles.quickMeta}>
                  <span>Rol: <strong>{String(currentEntity.metadata?.Role || 'N.v.t.')}</strong></span>
                  <span>Land: <strong>{String(currentEntity.metadata?.Nationality || 'Onbekend')}</strong></span>
                </div>
              </div>
            ) : (
              <div className={styles.gameOverSplash}>
                <h2>Ranking Voltooid! 🎉</h2>
                <p>Je hebt de top {maxSlots} succesvol gerangschikt.</p>
                <button onClick={() => setIsPlaying(false)} className={styles.btnPrimary} style={{ marginTop: '20px' }}>
                  Speel Nogmaals
                </button>
              </div>
            )}
          </div>

          {/* RECHTER SLOTKOLOM */}
          <div className={styles.sideColumn}>
            {rightSlots.map(index => {
              const placed = rankings[index];
              return (
                <button
                  key={index}
                  disabled={placed !== null || !currentEntity}
                  onClick={() => handlePlaceEntity(index)}
                  className={`${styles.slotButton} ${placed ? styles.slotFilled : styles.slotEmpty}`}
                >
                  <span className={styles.slotNumber}>{index + 1}</span>
                  <span className={styles.slotName}>{placed ? placed.name : 'Kies deze plek'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // SCHERM B: CATEGORIE SELECTIE MENU (Default)
  // ==========================================
  return (
    <div className={styles.setupContainer}>
      <div className={styles.setupHeader}>
        <h2>Blind Ranking Challenge</h2>
        <p className={styles.textMuted}>Kies een categorie om de uitdaging te starten. Je krijgt één voor één 10 blinde kaarten te zien die je direct een definitieve positie moet geven.</p>
      </div>

      <div className={styles.menuLayout}>
        <div className={styles.setupCard}>
          <h3>🎮 Selecteer een Ranking Criterium</h3>
          <div className={styles.actionLaunchList}>
            {availableCategories.map((categoryName, idx) => (
              <button
                key={idx}
                onClick={() => handleStartGame(categoryName)}
                className={styles.btnLaunchGame}
              >
                Ranken op: <strong>{categoryName}</strong> ➔
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};