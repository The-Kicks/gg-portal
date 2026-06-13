import React from 'react';
import ReactCountryFlag from 'react-country-flag';
import type { HydratedEntity } from '../../../types';
import styles from './BlindRanking.module.css';

interface ViewProps {
    isPlaying: boolean;
    availableCategories: string[];
    activeCategory: string;
    currentEntity: HydratedEntity | undefined;
    currentMediaUrls: string[];
    currentMediaIndex: number;
    isMatchingCategoryMedia: boolean;
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
    isMatchingCategoryMedia,
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

    const progressPercent = maxSlots > 0 ? (currentIndex / maxSlots) * 100 : 0;
    const isGameOver = !currentEntity || currentIndex >= maxSlots;

    const handleSelectRandomCategory = () => {
        if (availableCategories.length === 0) return;
        const randomIndex = Math.floor(Math.random() * availableCategories.length);
        handleStartGame(availableCategories[randomIndex]);
    };

    const getPlacedEntityImage = (placed: HydratedEntity | null): string => {
        if (!placed?.image) return '';
        const imgs = placed.image as Record<string, string | undefined>;
        return imgs.profileCard || imgs.heroBanner || '';
    };

    if (isPlaying) {
        return (
            <div className={styles.gameContainer}>
                {/* TOP BAR */}
                <div className={styles.headerSection}>
                    <button onClick={() => setIsPlaying(false)} className={styles.btnBack}>
                        ← Lobby
                    </button>
                    <div className={styles.categoryBadge}>Blind Ranking Challenge</div>
                    <h1 className={styles.categoryTitle}>{activeCategory}</h1>

                    <div className={styles.progressWrapper}>
                        <div className={styles.progressBarContainer}>
                            <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className={styles.progressCounter}>
                            Card <strong>{Math.min(currentIndex + 1, maxSlots)}</strong> of {maxSlots}
                        </div>
                    </div>
                </div>

                {/* HORIZONTAL GAME GRID */}
                <div className={`${styles.gameGrid} ${isGameOver ? styles.gameOver : ''}`}>

                    {/* 2/3 COLUMN: HORIZONTAL RANKING ROWS */}
                    <div className={styles.rankingSection}>
                        
                        {/* TOP ROW (Ranks 1 - 5) */}
                        <div className={styles.horizontalRow}>
                            {leftSlots.map(index => {
                                const placed = rankings[index];
                                const imgUrl = getPlacedEntityImage(placed);
                                return (
                                    <button
                                        key={index}
                                        disabled={placed !== null || !currentEntity}
                                        onClick={() => handlePlaceEntity(index)}
                                        className={`${styles.slotButton} ${placed ? styles.slotFilled : styles.slotEmpty}`}
                                        style={placed && imgUrl ? { '--slot-bg': `url(${imgUrl})` } as React.CSSProperties : {}}
                                    >
                                        <span className={styles.slotNumber}>{index + 1}</span>
                                        <div className={styles.slotBlurOverlay} />
                                        <div className={styles.slotContent}>
                                            <span className={styles.slotName}>
                                                {placed ? placed.name : '＋ Place'}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* BOTTOM ROW (Ranks 6 - 10) */}
                        <div className={styles.horizontalRow}>
                            {rightSlots.map(index => {
                                const placed = rankings[index];
                                const imgUrl = getPlacedEntityImage(placed);
                                return (
                                    <button
                                        key={index}
                                        disabled={placed !== null || !currentEntity}
                                        onClick={() => handlePlaceEntity(index)}
                                        className={`${styles.slotButton} ${placed ? styles.slotFilled : styles.slotEmpty}`}
                                        style={placed && imgUrl ? { '--slot-bg': `url(${imgUrl})` } as React.CSSProperties : {}}
                                    >
                                        <span className={styles.slotNumber}>{index + 1}</span>
                                        <div className={styles.slotBlurOverlay} />
                                        <div className={styles.slotContent}>
                                            <span className={styles.slotName}>
                                                {placed ? placed.name : '＋ Place'}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 1/3 COLUMN: FOCUS CARD (MEDIA) */}
                    {!isGameOver ? (
                        <div className={styles.centerColumn}>
                            <div className={styles.entityCard}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardSub}>Currently reviewing:</span>
                                    <h2 className={styles.entityName}>{currentEntity?.name}</h2>
                                </div>

                                {/* Albumwrapper met dynamische border-klasse en info-tooltip */}
                                <div className={`${styles.albumWrapper} ${isMatchingCategoryMedia ? styles.matchingCategory : ''}`}>
                                    
                                    {/* INFO UTLEG RECHTSBOVEN IN WRAPPER */}
                                    <div className={styles.infoTooltipContainer}>
                                        <span className={styles.infoIcon}>?</span>
                                        <div className={styles.tooltipText}>
                                            The border lights up when the media matches the current category.
                                        </div>
                                    </div>

                                    {currentMediaUrls.length > 0 ? (
                                        <div className={styles.mediaFlexBox}>
                                            {/* EXTERNAL LINK BUTTON */}
                                            <a 
                                                href={currentMediaUrls[currentMediaIndex]} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className={styles.btnFullscreenMedia}
                                                title="Open in new tab"
                                            >
                                                ↗
                                            </a>

                                            {currentMediaUrls[currentMediaIndex].toLowerCase().endsWith('.mp4') ? (
                                                <video
                                                    src={currentMediaUrls[currentMediaIndex]}
                                                    className={styles.flexibleMedia}
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                />
                                            ) : (
                                                <img
                                                    src={currentMediaUrls[currentMediaIndex]}
                                                    alt={currentEntity?.name}
                                                    className={styles.flexibleMedia}
                                                />
                                            )}

                                            {currentMediaUrls.length > 1 && (
                                                <div className={styles.albumNavigation}>
                                                    <button type="button" onClick={handlePrevMedia} className={styles.albumNavBtn}>◀</button>
                                                    <span className={styles.albumCounter}>{currentMediaIndex + 1} / {currentMediaUrls.length}</span>
                                                    <button type="button" onClick={handleNextMedia} className={styles.albumNavBtn}>▶</button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={styles.noMediaPlaceholder}>No media available</div>
                                    )}
                                </div>

                                <div className={styles.quickMeta}>
                                    <div className={styles.metaBadge}>
                                        <span>Position / Role</span>
                                        <strong>{Array.isArray(currentEntity?.metadata?.Role) ? currentEntity.metadata.Role.join(', ') : String(currentEntity?.metadata?.Role || 'N/A')}</strong>
                                    </div>

                                    {currentEntity?.metadata?.Nationality && Array.isArray(currentEntity.metadata.Nationality) && (
                                        <div className={styles.metaBadge}>
                                            <span>Origin</span>
                                            <div className={styles.flagsRow}>
                                                {currentEntity.metadata.Nationality.map((code: string) => (
                                                    <ReactCountryFlag
                                                        key={code}
                                                        countryCode={code}
                                                        svg
                                                        style={{
                                                            width: '1.6em',
                                                            height: '1.2em',
                                                            borderRadius: '4px',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                        }}
                                                        title={code}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.emptyCenterSpace} />
                    )}
                </div>
            </div>
        );
    }

    {/* LOBBY INTERFACE */}
    return (
        <div className={styles.setupContainer}>
            <div className={styles.setupHeader}>
                <h1 className={styles.lobbyTitle}>Blind Ranking</h1>
                <p className={styles.lobbySubtitle}>
                    Rank 10 random cards without knowing who comes next. Every decision is final!
                </p>
            </div>

            <div className={styles.menuLayout}>
                <div className={styles.setupCard}>
                    <button onClick={handleSelectRandomCategory} className={styles.btnRandomLaunch}>
                        <span className={styles.randomIcon}>🎲</span>
                        <div className={styles.randomText}>
                            <strong>Random Criterion</strong>
                            <span>Let fate decide</span>
                        </div>
                    </button>

                    <div className={styles.divider}>
                        <span>Or choose manually</span>
                    </div>

                    <div className={styles.actionLaunchList}>
                        {availableCategories.map((categoryName, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleStartGame(categoryName)}
                                className={styles.btnLaunchGame}
                            >
                                <span>{categoryName}</span>
                                <span className={styles.launchArrow}>➔</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};