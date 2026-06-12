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

    const progressPercent = maxSlots > 0 ? (currentIndex / maxSlots) * 100 : 0;

    // Handler to pick a random category
    const handleSelectRandomCategory = () => {
        if (availableCategories.length === 0) return;
        const randomIndex = Math.floor(Math.random() * availableCategories.length);
        handleStartGame(availableCategories[randomIndex]);
    };

    // Helper to retrieve the thumbnail of a placed entity
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

                {/* ULTRA WIDE GAME GRID */}
                <div className={styles.gameGrid}>

                    {/* LEFT SLOT COLUMN */}
                    <div className={styles.sideColumn}>
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
                                    <div className={styles.slotBlurOverlay} />
                                    <div className={styles.slotContent}>
                                        <span className={styles.slotNumber}>{index + 1}</span>
                                        <span className={styles.slotName}>
                                            {placed ? placed.name : 'Place here'}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* MIDDLE COLUMN: THE HUGE FOCUS CARD */}
                    <div className={styles.centerColumn}>
                        {currentEntity && currentIndex < maxSlots ? (
                            <div className={styles.entityCard}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardSub}>Currently reviewing:</span>
                                    <h2 className={styles.entityName}>{currentEntity.name}</h2>
                                </div>

                                {/* FLEXIBLE ASPECT RATIO MEDIA CONTAINER */}
                                <div className={styles.albumWrapper}>
                                    {currentMediaUrls.length > 0 ? (
                                        <div className={styles.mediaFlexBox}>
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
                                                    alt={currentEntity.name}
                                                    className={styles.flexibleMedia}
                                                />
                                            )}

                                            {/* Navigation controls */}
                                            {currentMediaUrls.length > 1 && (
                                                <div className={styles.albumNavigation}>
                                                    <button type="button" onClick={handlePrevMedia} className={styles.albumNavBtn}>◀ Previous</button>
                                                    <span className={styles.albumCounter}>{currentMediaIndex + 1} / {currentMediaUrls.length}</span>
                                                    <button type="button" onClick={handleNextMedia} className={styles.albumNavBtn}>Next ▶</button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={styles.noMediaPlaceholder}>No media available</div>
                                    )}
                                </div>

                                {/* FLAGS AND METADATA */}
                                <div className={styles.quickMeta}>
                                    <div className={styles.metaBadge}>
                                        <span>Position / Role</span>
                                        <strong>{Array.isArray(currentEntity.metadata?.Role) ? currentEntity.metadata.Role.join(', ') : String(currentEntity.metadata?.Role || 'N/A')}</strong>
                                    </div>

                                    {currentEntity.metadata?.Nationality && Array.isArray(currentEntity.metadata.Nationality) && (
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
                        ) : (
                            <div className={styles.gameOverSplash}>
                                <div className={styles.splashIcon}>🎉</div>
                                <h2>Congratulations!</h2>
                                <p>You have compiled your personal top {maxSlots}.</p>
                                <button onClick={() => setIsPlaying(false)} className={styles.btnPrimary}>
                                    Back to Lobby
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SLOT COLUMN */}
                    <div className={styles.sideColumn}>
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
                                    <div className={styles.slotBlurOverlay} />
                                    <div className={styles.slotContent}>
                                        <span className={styles.slotNumber}>{index + 1}</span>
                                        <span className={styles.slotName}>
                                            {placed ? placed.name : 'Place here'}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
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

                    {/* RANDOM CATEGORY BUTTON */}
                    <button
                        onClick={handleSelectRandomCategory}
                        className={styles.btnRandomLaunch}
                    >
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