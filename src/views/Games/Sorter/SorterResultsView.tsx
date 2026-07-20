import { useMemo } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { getTier } from './eloUtils';
import styles from './SorterCSS/SorterResults.module.css';

interface SorterResultsViewProps {
  theme: Theme;
  finalPool: EloExtended<HydratedEntity>[];
  extractMediaUrls: (entity: HydratedEntity) => string[];
  onRestart?: () => void;
}

export function SorterResultsView({ theme, finalPool, extractMediaUrls, onRestart }: SorterResultsViewProps) {
  const sortedResults = useMemo(() => {
    return [...finalPool].sort((a, b) => b.elo - a.elo);
  }, [finalPool]);

  return (
    <div className={styles.resultsContainer}>
      <div className={styles.resultsHeader}>
        <h2 className={styles.resultsTitle}>Sorter Results</h2>
        <p className={styles.resultsSubtitle}>Your ultimate ranking for {theme.title}</p>
      </div>

      <div className={styles.photocardGrid}>
        {sortedResults.map((item, index) => {
          const position = index + 1;
          const tier = getTier(item);
          const mediaUrls = extractMediaUrls(item);
          const firstImageUrl = mediaUrls[0] || '';

          return (
            <div key={item.id} className={styles.photocard}>
              <div className={`${styles.rankBadge} ${position <= 3 ? styles.topRank : ''}`}>
                #{position}
              </div>

              <div className={styles.photocardImageWrapper} style={{ borderColor: tier.color }}>
                {firstImageUrl ? (
                  <img
                    src={firstImageUrl}
                    alt={item.name}
                    className={styles.photocardImage}
                    loading="lazy"
                  />
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