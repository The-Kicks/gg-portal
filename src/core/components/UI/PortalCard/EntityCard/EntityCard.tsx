import { useMemo } from 'react';
import type { BaseEntity, Theme, LayerKey, MetaDataStandard } from '../../../../../types';
import { ProfileCard } from '../ProfileCard/ProfileCard';
import { MiniProfileCard } from '../ProfileCard/miniProfileCard/miniProfileCard';
import styles from './EntityCard.module.css';

interface EntityCardProps {
  entity: BaseEntity;
  activeKey: LayerKey;
  theme: Theme; 
  labels: Record<string, string | undefined>;
  organization?: BaseEntity;
  customLabel?: string;
}

/**
 * A conditional gateway controller component that evaluates layout criteria, parses metadata configurations,
 * computes contextual status alerts, and returns either a compact mini profile or a detailed profile card view.
 */
export const EntityCard: React.FC<EntityCardProps> = ({
  entity, activeKey, theme, labels, organization, customLabel
}) => {
  
  const shouldShowMini = theme.miniViewLayers.includes(activeKey);

  /**
   * Safe data deserializer that parses the current layer configurations out of theme configurations,
   * with fallback verification support for raw JSON strings returned by the backend layout schema.
   */
  const layerStandard = useMemo<MetaDataStandard | undefined>(() => {
    if (!theme.layerMetadata) return undefined;

    if (typeof theme.layerMetadata === 'string') {
      try {
        const parsed = JSON.parse(theme.layerMetadata) as Record<string, MetaDataStandard | undefined>;
        return parsed[activeKey.toLowerCase()];
      } catch (err) {
        console.error("Fout bij parsen layerMetadata in EntityCard:", err);
        return undefined;
      }
    }

    const record = theme.layerMetadata as Record<string, MetaDataStandard | undefined>;
    return record[activeKey.toLowerCase()] || record[activeKey];
  }, [theme.layerMetadata, activeKey]);

  const triggers = layerStandard?.statusTriggers;

  /**
   * Reference cache stabilizer that isolates metadata object properties to prevent 
   * unnecessary rendering cycles and visual layout flashes during upstream recalculations.
   */
  const safeMetadata = useMemo(() => {
    return entity.metadata || {};
  }, [entity.metadata]);

  /**
   * Dynamic evaluation logic engine that processes contextual criteria definitions to formulate 
   * a filtered listing of applicable status tracking badges and forced historical entity state records.
   */
  const activeBadges = useMemo(() => {
    let badges: Array<{ key: string; value: string; label: string }> = [];

    if (triggers && safeMetadata) {
      badges = Object.entries(triggers).map(([triggerKey, triggerConfig]) => {
        if (!triggerConfig) return null;
        
        const currentValue = String(safeMetadata[triggerConfig.key] || '');
        
        if (currentValue.toLowerCase() === String(triggerConfig.value).toLowerCase()) {
          const displayLabel = labels[currentValue] || labels[triggerKey] || (currentValue.charAt(0).toUpperCase() + currentValue.slice(1));
          
          return {
            key: triggerKey.toLowerCase(),
            value: currentValue,
            label: displayLabel
          };
        }
        return null;
      }).filter(Boolean) as Array<{ key: string; value: string; label: string }>;
    }

    const isExplicitFormer = 
      String(safeMetadata.membershipStatus).toLowerCase() === 'former' ||
      String(safeMetadata.groupStatus).toLowerCase() === 'former' ||
      String(safeMetadata.status).toLowerCase() === 'former' ||
      safeMetadata.isFormer === true;

    if (isExplicitFormer && !badges.some(b => b.key === 'former')) {
      badges.push({
        key: 'former',
        value: 'former',
        label: labels['former'] || labels['Former'] || 'Former'
      });
    }

    return badges;
  }, [triggers, safeMetadata, labels]);

  const profileCardBadge = layerStandard?.badgeKey ? String(safeMetadata[layerStandard.badgeKey] || '') : undefined;
  const subtitle = layerStandard?.subtitleKey ? String(safeMetadata[layerStandard.subtitleKey] || '') : undefined;

  const isFormer = activeBadges.some(b => b.key === 'former');
  const primaryStatusBadge = activeBadges.find(b => b.key !== 'former');
  const containerStatus = primaryStatusBadge ? primaryStatusBadge.key : (isFormer ? 'former' : undefined);

  const defaultLabel = customLabel ?? labels[activeKey] ?? '';

  const cardContent = shouldShowMini && layerStandard ? (
    <MiniProfileCard
      entity={entity}
      theme={theme}
      organization={organization}
      standard={layerStandard}
      profileCardBadge={profileCardBadge}
      subtitle={subtitle}
    />
  ) : (
    <ProfileCard
      entity={entity}
      organization={organization}
      label={defaultLabel}
      profileCardBadge={profileCardBadge}
      subtitle={subtitle}
    />
  );

  return (
    <div
      className={`${styles.cardWrapper} ${isFormer ? styles.isFormer : ''}`}
      data-status={containerStatus}
    >
      <div className={styles.badgeOverlay}>
        {activeBadges.map((badge) => {
          let badgeClass = styles.statusBadge;
          
          if (badge.key === 'former') {
            badgeClass = styles.statusBadge;
          } else if (badge.key === 'alert' || badge.key === 'danger' || badge.key === 'critical') {
            badgeClass = styles.alertBadge;
          } else if (badge.key === 'warning' || badge.key === 'caution') {
            badgeClass = styles.warningBadge;
          } else if (badge.key === 'info' || badge.key === 'success' || badge.key === 'accent') {
            badgeClass = styles.infoBadge;
          }

          return (
            <span key={badge.key} className={badgeClass}>
              {badge.label}
            </span>
          );
        })}
      </div>
      {cardContent}
    </div>
  );
};