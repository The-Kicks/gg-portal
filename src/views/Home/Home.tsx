import type { Theme } from '../../types';
import styles from './Home.module.css';
import { PortalCard } from "../../core/components/UI/PortalCard/PortalCard.tsx";
import { PortalGroup } from '../../core/components/UI/PortalCard/PortalGroup.tsx';
import { useNavigate } from 'react-router-dom';
import { useGuessWhoStats } from './useGuessWhoStats';
import { useBlindRankingStats } from './useBlindRankingStats';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard.tsx'

interface HomeProps {
  theme: Theme;
  isDark: boolean;
}

interface SorterEntity {
  id: string;
  name: string;
  elo: number;
}

export const Home = ({ theme, isDark }: HomeProps) => {
  const navigate = useNavigate();
  const { username, guessWhoStats } = useGuessWhoStats(theme.id);
  const { topBlindRankingItems } = useBlindRankingStats(theme.id);

  const availableGames = theme.games.map(g => g.toLowerCase());
  const hasSorter = availableGames.includes('sorter');
  const hasGuessWho = availableGames.includes('guesswho') || availableGames.includes('guess');
  const hasBlindRanking = availableGames.includes('blindranking') || availableGames.includes('blind');

  const placeholderSorterTop5: SorterEntity[] = [
    { id: '1', name: 'Cyberpunk 2077', elo: 1840 },
    { id: '2', name: 'Baldur’s Gate 3', elo: 1790 },
    { id: '3', name: 'Elden Ring', elo: 1720 },
    { id: '4', name: 'The Witcher 3', elo: 1650 },
    { id: '5', name: 'Hades II', elo: 1590 },
  ];

  const numGames = theme.games.length;
  const calculatedSize = numGames === 1 ? 100 : numGames === 2 ? 50 : 33;

  const cardBg = isDark
    ? 'color-mix(in srgb, var(--bg), white 5%)'
    : 'color-mix(in srgb, var(--bg), white 40%)';

  return (
    <main>
      <header className={styles.appHeader}>
        {username && (
          <div className={styles.welcomeBadge}>
            Ingelogd als <span className={styles.username}>@{username}</span>
          </div>
        )}
        <h1>{theme.title}</h1>
        <p>{theme.description}</p>
      </header>

      {/* STATS SECTIE */}
      <section className={styles.statsSection}>
        <div className={styles.gamesList}>
          <h2 className={styles.statsSectionTitle}>
            Jouw Statistieken & Overzichten
          </h2>

          <div className={styles.statsGrid}>

            {/* 1. SORTER STATS KAARTJE */}
            {hasSorter && (
              <div className={styles.statCard}>
                <div className={styles.statCardHeader}>
                  <h3>Sorter Top 5 (Elo Gemiddelde)</h3>
                  <span className={styles.badge}>Sorter</span>
                </div>

                <div className={styles.sorterContent}>
                  {placeholderSorterTop5[0] && (
                    <div className={styles.topEntityCardVertical}>
                      <div className={styles.rankBadge}>#1</div>
                      <div className={styles.topEntityAvatar}>
                        {placeholderSorterTop5[0].name.charAt(0)}
                      </div>
                      <div className={styles.topEntityInfo}>
                        <span className={styles.topEntityName}>{placeholderSorterTop5[0].name}</span>
                        <span className={styles.topEntityMeta}>{placeholderSorterTop5[0].elo} Elo</span>
                      </div>
                    </div>
                  )}

                  <div className={styles.runnerUpsVerticalList}>
                    {placeholderSorterTop5.slice(1).map((entity) => (
                      <div key={entity.id} className={styles.runnerUpRowCompact}>
                        <div className={styles.runnerUpMiniAvatar}>
                          {entity.name.charAt(0)}
                        </div>
                        <span className={styles.runnerUpMiniName}>{entity.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. GUESS WHO STATS KAARTJE */}
            {hasGuessWho && (
              <div className={styles.statCard}>
                <div className={styles.statCardHeader}>
                  <h3>Guess Who Prestaties</h3>
                  <span className={styles.badge}>Guess Who</span>
                </div>

                <div className={styles.guessWhoGrid}>
                  <div className={styles.statMetricBox}>
                    <span className={styles.metricValue}>{guessWhoStats.gamesPlayed}</span>
                    <span className={styles.metricLabel}>Games Played</span>
                  </div>
                  <div className={styles.statMetricBox}>
                    <span className={styles.metricValue}>{guessWhoStats.averageGuesses}</span>
                    <span className={styles.metricLabel}>Average Guesses</span>
                  </div>
                  <div className={styles.statMetricBox}>
                    <span className={styles.metricValue}>{guessWhoStats.hintsUsed}</span>
                    <span className={styles.metricLabel}>Hints Used</span>
                  </div>
                  <div className={styles.statMetricBox}>
                    <span className={styles.metricValue}>{guessWhoStats.gaveUp}</span>
                    <span className={styles.metricLabel}>Gave Up</span>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block' }}>Vaakst correct geraden:</span>
                    <strong style={{ fontSize: '0.95rem' }}>{guessWhoStats.mostGuessedEntity}</strong>
                  </div>
                  {guessWhoStats.mostGuessedCount > 0 && (
                    <span style={{ fontSize: '0.85rem', background: 'var(--accent, #007bff)', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>
                      {guessWhoStats.mostGuessedCount}x
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 3. BLIND RANKING STATS KAARTJE */}
{hasBlindRanking && (
  <div className={styles.statCard}>
    <div className={styles.statCardHeader}>
      <h3>Blind Ranking Top 3 (Gemiddeld)</h3>
      <span className={styles.badge}>Blind Ranking</span>
    </div>

    <div className={styles.podiumContainer}>
      {topBlindRankingItems.length > 0 ? (
        <>
          {/* #2 plek (Zilver) */}
          {topBlindRankingItems[1] && (() => {
            const entity = theme.entities?.find(e => e.id === topBlindRankingItems[1].id);
            return entity ? (
              <div className={`${styles.podiumItem} ${styles.podiumSecond}`}>
                <span className={styles.podiumRank}>#2</span>
                <div className={`${styles.entityCardScaleWrapper} ${styles.podiumEntityBorderSilver}`}>
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

          {/* #1 plek (Goud) */}
          {topBlindRankingItems[0] && (() => {
            const entity = theme.entities?.find(e => e.id === topBlindRankingItems[0].id);
            return entity ? (
              <div className={`${styles.podiumItem} ${styles.podiumFirst}`}>
                <span className={styles.podiumCrown}>👑</span>
                <span className={styles.podiumRank}>#1</span>
                <div className={`${styles.entityCardScaleWrapper} ${styles.podiumEntityBorderFirst}`}>
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

          {/* #3 plek (Brons) */}
          {topBlindRankingItems[2] && (() => {
            const entity = theme.entities?.find(e => e.id === topBlindRankingItems[2].id);
            return entity ? (
              <div className={`${styles.podiumItem} ${styles.podiumThird}`}>
                <span className={styles.podiumRank}>#3</span>
                <div className={`${styles.entityCardScaleWrapper} ${styles.podiumEntityBorderBronze}`}>
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
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 0', opacity: 0.6, fontSize: '0.9rem' }}>
          Nog geen Blind Ranking gespeeld.
        </div>
      )}
    </div>
  </div>
)}

          </div>
        </div>
      </section>

      {/* Spelkeuze Sectie */}
      <section className={styles.gamesList}>
        <PortalGroup title="Kies je spel:" customBg={cardBg}>
          <div className={styles.cardContainer}>
            {theme.games.map((game) => (
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