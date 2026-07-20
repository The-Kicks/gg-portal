import { useEffect } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { SorterResultsView } from './SorterResultsView';
import styles from './SorterCSS/SorterResults.module.css';

interface SorterResultsOverlayProps {
  theme: Theme;
  finalPool: EloExtended<HydratedEntity>[];
  extractMediaUrls: (entity: HydratedEntity) => string[];
  onClose: () => void;
}

export function SorterResultsOverlay({ theme, finalPool, extractMediaUrls, onClose }: SorterResultsOverlayProps) {
  // Close the pane on Escape without touching the sorter behind it
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.resultsOverlay} onClick={onClose}>
      <div className={styles.resultsModal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.resultsModalClose} onClick={onClose} aria-label="Close results">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <SorterResultsView theme={theme} finalPool={finalPool} extractMediaUrls={extractMediaUrls} />
      </div>
    </div>
  );
}