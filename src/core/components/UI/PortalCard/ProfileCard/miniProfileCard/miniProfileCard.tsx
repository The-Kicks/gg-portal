import type { BaseEntity, Theme, MetaDataStandard } from '../../../../../../types';
import styles from './MiniProfileCard.module.css';

interface MiniProps {
  entity: BaseEntity;
  theme: Theme;
  organization?: BaseEntity;
  standard?: MetaDataStandard;
  profileCardBadge?: string;
  subtitle?: string;
}

/**
 * Pure Utility Helper Function.
 * Sanitizes and formats mixed metadata data primitive forms cleanly down into strings safe for rendering inside DOM structures.
 * Placed outside the functional component loop scope to secure memory allocations from firing on re-renders.
 */
const formatMetadataValue = (
  value: string | number | boolean | string[] | Date | undefined
): React.ReactNode => {
  if (value === null || value === undefined || value === "") return '---';
  if (value instanceof Date) return value.toLocaleDateString();
  if (Array.isArray(value)) return value.join(', '); // Merges array lists into single comma-delimited string streams
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

/**
 * MiniProfileCard presents a highly compact, space-conscious grid node.
 * It bypasses heavy background images to prioritize displaying key data grids and telemetry parameters 
 * parsed directly out of layout metadata schemas.
 */
export const MiniProfileCard: React.FC<MiniProps> = ({ 
  entity, 
  theme, 
  organization, 
  standard,
  profileCardBadge,
  subtitle
}) => {
  const { metadata = {} } = entity;
  
  // Guard validation check: Verifies if the dataset contains valid grid rows mappings config parameters to display
  const hasGridData = standard && standard.gridKeys.length > 0 && Object.keys(metadata).length > 0;

  // Syncs value resolution pathways uniformly with standard ProfileCard behaviors
  const displaySubtitle = subtitle || organization?.name;
  const displayBadge = profileCardBadge || (standard?.badgeKey ? String(formatMetadataValue(metadata[standard.badgeKey])) : undefined);

  return (
    <div className={`${styles.miniCard} ${hasGridData ? styles.hasContent : ''}`}>
      {/* HEADER META LABEL CONTROL BLOCKS */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.name}>{entity.name}</h3>
          {displayBadge && (
            <span className={styles.badge}>
              {displayBadge}
            </span>
          )}
        </div>
        {displaySubtitle && (
          <div className={styles.subtitle}>
            {displaySubtitle}
          </div>
        )}
      </div>

      {/* METADATA DATA SPECIFICATIONS GRID BLOCK */}
      {hasGridData && (
        <div className={styles.statsGrid}>
          {standard.gridKeys.map((key) => (
            <div key={key} className={styles.statItem}>
              {/* Maps technical keys to human friendly dictionary translations defined within active themes configurations */}
              <span className={styles.statLabel}>
                {theme.labels[key] ?? key}
              </span>
              <span className={styles.statValue}>
                {formatMetadataValue(metadata[key])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};