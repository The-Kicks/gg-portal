import { useMemo } from 'react';
import type { BaseEntity, Theme, LayerKey, MetaDataStandard } from '../../../../../types';
import { ProfileCard } from '../ProfileCard/ProfileCard';
import { MiniProfileCard } from '../ProfileCard/miniProfileCard/miniProfileCard';
import styles from './EntityCard.module.css';

/**
 * Prop definitions for the EntityCard component.
 * It takes the core entity data model, active layer navigation keys, global theme profiles,
 * rendering labels mappings, and parent relational organization references.
 */
interface EntityCardProps {
  entity: BaseEntity;
  activeKey: LayerKey;
  theme: Theme; 
  labels: Record<string, string | undefined>;
  organization?: BaseEntity;
  customLabel?: string;
}

/**
 * EntityCard serves as a highly dynamic controller gateway wrapper component.
 * It analyzes the entity's metadata schema configurations from the database,
 * evaluates active warning status conditions, computes styling buckets, 
 * and decides whether to swap views into a standard profile layout or a compact mini card layout.
 */
export const EntityCard: React.FC<EntityCardProps> = ({
  entity, activeKey, theme, labels, organization, customLabel
}) => {
  
  /**
   * Layout Check: Reads the active theme configuration profile to see if the current hierarchy layer 
   * (e.g. 'l1', 'l2') is listed inside the miniViewLayers array configuration settings.
   */
  const shouldShowMini = theme.miniViewLayers.includes(activeKey);

  /**
   * Memo Hook: Layer Standard Parsing
   * Safely decodes and extracts structural layouts instructions for this layer out of the theme metadata.
   * Handles cases where the database field might arrive as a raw JSON string block format.
   */
  const layerStandard = useMemo<MetaDataStandard | undefined>(() => {
    if (!theme.layerMetadata) return undefined;

    // Fallback parser processing sequence if the database payload arrived formatted as a raw string block
    if (typeof theme.layerMetadata === 'string') {
      try {
        const parsed = JSON.parse(theme.layerMetadata) as Record<string, MetaDataStandard | undefined>;
        return parsed[activeKey.toLowerCase()];
      } catch (err) {
        console.error("Fout bij parsen layerMetadata in EntityCard:", err);
        return undefined;
      }
    }

    // Direct object key parsing reads out matching configuration levels
    const record = theme.layerMetadata as Record<string, MetaDataStandard | undefined>;
    return record[activeKey.toLowerCase()] || record[activeKey];
  }, [theme.layerMetadata, activeKey]);

  // Extracts status validation conditional rules configurations out of the active schema profile
  const triggers = layerStandard?.statusTriggers;

  /**
   * Memo Hook: Safe Metadata Reference Stabilizer
   * Locks the object reference pointer in memory. This prevents downstream hooks from firing 
   * unnecessary re-computations or layout flickering if the parent entity component tree updates.
   */
  const safeMetadata = useMemo(() => {
    return entity.metadata || {};
  }, [entity.metadata]);

  /**
   * Memo Hook: Dynamic Status Badges Evaluator
   * Loops through the schema conditional trigger rules to compare against active entity metadata states.
   * If an entity values matches a target requirement rule, a system badge payload object is generated.
   */
  const activeBadges = useMemo(() => {
    let badges: Array<{ key: string; value: string; label: string }> = [];

    // Stap 1: Loop door de database triggers heen als deze bestaan
    if (triggers && safeMetadata) {
      badges = Object.entries(triggers).map(([triggerKey, triggerConfig]) => {
        if (!triggerConfig) return null;
        
        // Forces comparison targets down to clean flat string evaluations
        const currentValue = String(safeMetadata[triggerConfig.key] || '');
        
        // High flexibility case-insensitive rule check verification match sequences
        if (currentValue.toLowerCase() === String(triggerConfig.value).toLowerCase()) {
          // Attempts to map values to custom friendly display dictionary definitions, defaulting back to capitalized strings
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

    // 🛡️ Stap 2: HARD FORCED FALLBACK PROTECTION
    // Als de upstream view (L4View) of de database deze entiteit expliciet als 'former' heeft gemarkeerd,
    // en er is nog geen 'former' badge gegenereerd via de triggers, dan injecteren we deze hier handmatig.
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

  // Extracts explicit specific localized card fields according to layout configurations schema blueprints
  const profileCardBadge = layerStandard?.badgeKey ? String(safeMetadata[layerStandard.badgeKey] || '') : undefined;
  const subtitle = layerStandard?.subtitleKey ? String(safeMetadata[layerStandard.subtitleKey] || '') : undefined;

  // State checks to see if special historical structural layouts logic flags are present
  const isFormer = activeBadges.some(b => b.key === 'former');
  const primaryStatusBadge = activeBadges.find(b => b.key !== 'former');
  
  // Computes primary state strings to pass out to external data-attributes on the HTML nodes tree
  const containerStatus = primaryStatusBadge ? primaryStatusBadge.key : (isFormer ? 'former' : undefined);

  const defaultLabel = customLabel ?? labels[activeKey] ?? '';

  /**
   * View Factory router assignment: Conditionally builds out components paths based on layout states
   */
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
      data-status={containerStatus} // Attaches metadata tags directly onto DOM nodes for advanced CSS selection hooks
    >
      {/* Floating status alert tags overlay wrapper grouping panel */}
      <div className={styles.badgeOverlay}>
        {activeBadges.map((badge) => {
          let badgeClass = styles.statusBadge;
          
          // MAPS LOGICAL KEYS DIRECTLY INTO DISTINCT VISUAL CSS STYLE CLASSES PRESETS
          if (badge.key === 'former') {
            badgeClass = styles.statusBadge;
          } else if (badge.key === 'alert' || badge.key === 'danger' || badge.key === 'critical') {
            badgeClass = styles.alertBadge; // High danger crimson warning buckets
          } else if (badge.key === 'warning' || badge.key === 'caution') {
            badgeClass = styles.warningBadge; // Caution amber attention color alerts
          } else if (badge.key === 'info' || badge.key === 'success' || badge.key === 'accent') {
            badgeClass = styles.infoBadge; // Clean vibrant status confirmation shades
          }

          return (
            <span key={badge.key} className={badgeClass}>
              {badge.label}
            </span>
          );
        })}
      </div>
      
      {/* Outputs the computed selected structural interior card component content tree */}
      {cardContent}
    </div>
  );
};