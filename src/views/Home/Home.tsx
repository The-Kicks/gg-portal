import type { Theme } from '../../types';
import styles from './Home.module.css';
import { PortalCard } from "../../core/components/UI/PortalCard/PortalCard.tsx";
import { PortalGroup } from '../../core/components/UI/PortalCard/PortalGroup.tsx';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useGuessWhoStats } from './useGuessWhoStats';
import { useBlindRankingStats } from './useBlindRankingStats';
import { useSorterStats } from './useSorterStats';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard.tsx';

interface HomeProps {
  theme: Theme;
  isDark: boolean;
}

export const Home = ({ theme, isDark }: HomeProps) => {
  const navigate = useNavigate();
  const { username, guessWhoStats } = useGuessWhoStats(theme.id);
  const { topBlindRankingItems } = useBlindRankingStats(theme.id);
  const { sorterRuns, averageTop5 } = useSorterStats(theme.id);

  const [sorterIndex, setSorterIndex] = useState<number>(0);

  const sortedGames = [...(theme.games || [])].sort((a, b) => a.localeCompare(b));

  const availableGamesLower = sortedGames.map(g => g.toLowerCase());
  const hasSorter = availableGamesLower.some(g => g === 'sorter');
  const hasGuessWho = availableGamesLower.some(g => g === 'guesswho' || g === 'guess');
  const hasBlindRanking = availableGamesLower.some(g => g === 'blindranking' || g === 'blind');

  const gridTemplateColumns = sortedGames.map(game => {
    const lower = game.toLowerCase();
    if (lower === 'sorter') return '1.6fr';
    if (lower === 'blindranking' || lower === 'blind') return '1.1fr';
    return '0.55fr';
  }).join(' ');

  const totalSorterSlides = 1 + sorterRuns.length;

  const handlePrevSorterSlide = () => {
    setSorterIndex((prev) => (prev === 0 ? totalSorterSlides - 1 : prev - 1));
  };

  const handleNextSorterSlide = () => {
    setSorterIndex((prev) => (prev === totalSorterSlides - 1 ? 0 : prev + 1));
  };

  const currentSorterTitle = sorterIndex === 0 
    ? "Sorter Top 5 (Elo)" 
    : sorterRuns[sorterIndex - 1]?.name || "Sorter Result";

  const currentSorterTop5 = sorterIndex === 0 
    ? averageTop5 
    : sorterRuns[sorterIndex - 1]?.top5 || [];

  const numGames = sortedGames.length;
  const calculatedSize = numGames === 1 ? 100 : numGames === 2 ? 50 : 33;

  const cardBg = isDark
    ? 'color-mix(in srgb, var(--bg), white 5%)'
    : 'color-mix(in srgb, var(--bg), white 40%)';

  return (
    <main>
      <header className={styles.appHeader}>
        {username && (
          <div className={styles.welcomeBadge}>
            Logged in as <span className={styles.username}>@{username}</span>
          </div>
        )}
        <h1>{theme.title}</h1>
        <p>{theme.description}</p>
      </header>

      <section className={styles.statsSection}>
        <div className={styles.gamesList}>
          <h2 className={styles.statsSectionTitle}>
            Your Statistics & Overviews
          </h2>

          <div className={styles.statsGrid} style={{ gridTemplateColumns }}>
            {sortedGames.map((gameName) => {
              const lowerGame = gameName.toLowerCase();
              const isSorter = lowerGame === 'sorter';
              const isGuessWho = lowerGame === 'guesswho' || lowerGame === 'guess';
              const isBlindRanking = lowerGame === 'blindranking' || lowerGame === 'blind';

              if (isSorter && hasSorter) {
                return (
                  <div key="sorter" className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{currentSorterTitle}</h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {totalSorterSlides > 1 && (
                            <>
                              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                {sorterIndex + 1}/{totalSorterSlides}
                              </span>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                <button 
                                  type="button" 
                                  onClick={handlePrevSorterSlide}
                                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '1px 5px', cursor: 'pointer', color: 'inherit', fontSize: '11px' }}
                                >
                                  ‹
                                </button>
                                <button 
                                  type="button" 
                                  onClick={handleNextSorterSlide}
                                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '1px 5px', cursor: 'pointer', color: 'inherit', fontSize: '11px' }}
                                >
                                  ›
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.sorterContent}>
                      {currentSorterTop5.length > 0 ? (
                        <div className={styles.sorterTop5Row}>
                          {currentSorterTop5.slice(0, 5).map((item, index) => {
                            const rank = index + 1;
                            const entity = theme.entities?.find(e => e.id === item.id || e.name === item.name);
                            if (!entity) return null;

                            let borderClass = styles.sorterTop5EntityBorderStandard;
                            if (rank === 1) borderClass = styles.sorterTop5EntityBorderFirst;
                            else if (rank === 2) borderClass = styles.sorterTop5EntityBorderSilver;
                            else if (rank === 3) borderClass = styles.sorterTop5EntityBorderBronze;

                            return (
                              <div key={item.id || rank} className={styles.sorterTop5Item}>
                                <span className={`${styles.sorterTop5RankBadge} ${rank === 1 ? styles.sorterTop5FirstBadge : ''}`}>
                                  {rank === 1 ? '👑 #1' : `#${rank}`}
                                </span>
                                <div className={`${styles.sorterScaleWrapper} ${borderClass}`}>
                                  <EntityCard
                                    entity={entity}
                                    activeKey="l4"
                                    theme={theme}
                                    labels={theme.labels || {}}
                                  />
                                </div>
                                <div className={styles.sorterEloWrapper}>
                                  <span className={styles.sorterEloValue}>
                                    {item.elo}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1.5rem 0', opacity: 0.6, fontSize: '0.85rem' }}>
                          No Sorter results yet.
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (isGuessWho && hasGuessWho) {
                const featuredEntity = theme.entities?.find(
                  e => e.id === guessWhoStats.mostGuessedEntity || e.name === guessWhoStats.mostGuessedEntity
                );

                return (
                  <div key="guesswho" className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <h3>Guess Who</h3>
                    </div>

                    <div className={styles.guessWhoBody}>
                      <div className={styles.guessWhoStatsList}>
                        <div className={styles.guessWhoStatRow}>
                          <span className={styles.metricLabel}>Played</span>
                          <span className={styles.metricValue}>{guessWhoStats.gamesPlayed}</span>
                        </div>
                        <div className={styles.guessWhoStatRow}>
                          <span className={styles.metricLabel}>Avg Guesses</span>
                          <span className={styles.metricValue}>{guessWhoStats.averageGuesses}</span>
                        </div>
                        <div className={styles.guessWhoStatRow}>
                          <span className={styles.metricLabel}>Hints</span>
                          <span className={styles.metricValue}>{guessWhoStats.hintsUsed}</span>
                        </div>
                        <div className={styles.guessWhoStatRow}>
                          <span className={styles.metricLabel}>Gave Up</span>
                          <span className={styles.metricValue}>{guessWhoStats.gaveUp}</span>
                        </div>
                      </div>

                      <div className={styles.guessWhoFeatured}>
                        {featuredEntity ? (
                          <div className={styles.guessWhoScaleWrapper}>
                            <EntityCard
                              entity={featuredEntity}
                              activeKey="l4"
                              theme={theme}
                              labels={theme.labels || {}}
                            />
                          </div>
                        ) : (
                          <div style={{ width: '40px', height: '55px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                            ❓
                          </div>
                        )}
                        <div className={styles.guessWhoFeaturedInfo}>
                          <span style={{ fontSize: '0.65rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Most correctly guessed:
                          </span>
                          <strong style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {featuredEntity?.name || guessWhoStats.mostGuessedEntity || 'Not known yet'}
                          </strong>
                          {guessWhoStats.mostGuessedCount > 0 && (
                            <span style={{ fontSize: '0.65rem', color: '#818cf8', marginTop: '2px' }}>
                              Guessed correctly {guessWhoStats.mostGuessedCount} times!
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isBlindRanking && hasBlindRanking) {
                return (
                  <div key="blindranking" className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <h3>Blind Ranking Top 3</h3>
                    </div>

                    <div className={styles.podiumContainer}>
                      {topBlindRankingItems.length > 0 ? (
                        <>
                          {topBlindRankingItems[1] && (() => {
                            const entity = theme.entities?.find(e => e.id === topBlindRankingItems[1].id);
                            return entity ? (
                              <div className={`${styles.podiumItem} ${styles.podiumSecond}`}>
                                <span className={styles.podiumRank}>#2</span>
                                <div className={`${styles.podiumScaleWrapper} ${styles.podiumEntityBorderSilver}`}>
                                  <EntityCard
                                    entity={entity}
                                    activeKey="l4"
                                    theme={theme}
                                    labels={theme.labels || {}}
                                  />
                                </div>
                              </div>
                            ) : null;
                          })()}

                          {topBlindRankingItems[0] && (() => {
                            const entity = theme.entities?.find(e => e.id === topBlindRankingItems[0].id);
                            return entity ? (
                              <div className={`${styles.podiumItem} ${styles.podiumFirst}`}>
                                <span className={styles.podiumCrown}>👑</span>
                                <span className={styles.podiumRank}>#1</span>
                                <div className={`${styles.podiumScaleWrapper} ${styles.podiumEntityBorderFirst}`}>
                                  <EntityCard
                                    entity={entity}
                                    activeKey="l4"
                                    theme={theme}
                                    labels={theme.labels || {}}
                                  />
                                </div>
                              </div>
                            ) : null;
                          })()}

                          {topBlindRankingItems[2] && (() => {
                            const entity = theme.entities?.find(e => e.id === topBlindRankingItems[2].id);
                            return entity ? (
                              <div className={`${styles.podiumItem} ${styles.podiumThird}`}>
                                <span className={styles.podiumRank}>#3</span>
                                <div className={`${styles.podiumScaleWrapper} ${styles.podiumEntityBorderBronze}`}>
                                  <EntityCard
                                    entity={entity}
                                    activeKey="l4"
                                    theme={theme}
                                    labels={theme.labels || {}}
                                  />
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </>
                      ) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1.5rem 0', opacity: 0.6, fontSize: '0.85rem' }}>
                          No Blind Ranking played yet.
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </section>

      <section className={styles.gamesList}>
        <PortalGroup title="Choose your game:" customBg={cardBg}>
          <div className={styles.cardContainer}>
            {sortedGames.map((game) => (
              <PortalCard
                key={`${theme.id}-${game}`}
                size={calculatedSize}
                spotlight={true}
                customBg={cardBg}
                onClick={() => navigate(`/${theme.id}/${game.toLowerCase()}`)}
              >
                <span className={styles.gameTitle}>{game.toUpperCase()}</span>
              </PortalCard>
            ))}
          </div>
        </PortalGroup>
      </section>
    </main>
  );
};

export default Home;