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
 * Sanitizes and formats mixed entity metadata primitive values into plain, 
 * render-safe string elements or placeholders.
 */
const formatMetadataValue = (
  value: string | number | boolean | string[] | Date | undefined
): React.ReactNode => {
  if (value === null || value === undefined || value === "") return '---';
  if (value instanceof Date) return value.toLocaleDateString();
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

/**
 * Renders a compact, text-driven profile grid node, emphasizing structured 
 * data layouts and telemetry properties over heavy graphic illustrations.
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
  
  const hasGridData = standard && standard.gridKeys.length > 0 && Object.keys(metadata).length > 0;

  const displaySubtitle = subtitle || organization?.name;
  const displayBadge = profileCardBadge || (standard?.badgeKey ? String(formatMetadataValue(metadata[standard.badgeKey])) : undefined);

  return (
    <div className={`${styles.miniCard} ${hasGridData ? styles.hasContent : ''}`}>
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

      {hasGridData && (
        <div className={styles.statsGrid}>
          {standard.gridKeys.map((key) => (
            <div key={key} className={styles.statItem}>
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