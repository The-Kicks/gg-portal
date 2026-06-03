import ReactCountryFlag from 'react-country-flag';
import type { BaseEntity, EntityImages } from '../../../../../types';
import { getEntityImage } from '../../../../helpers/getEntityImage';
import styles from './ProfileCard.module.css';

interface ProfileCardProps {
  entity: BaseEntity;
  organization?: BaseEntity;
  label: string;
  profileCardBadge?: string; // Database override that takes precedence over the standard layer label
  subtitle?: string;         // Database override that takes precedence over the organization name
}

/**
 * ProfileCard renders a rich visual showcase card layout (e.g., an athlete's profile banner).
 * It loads a prominent background image, handles responsive opacity overlays, maps 
 * dynamic nationality flag badges, and displays contextual organizational affiliations.
 */
export const ProfileCard: React.FC<ProfileCardProps> = ({ 
  entity, 
  organization, 
  label, 
  profileCardBadge, 
  subtitle 
}) => {
  // Resolves the correct target image asset location path for the large profile background canvas card tier
  const imagePath = getEntityImage(entity.image as EntityImages, 'profileCard');

  // Logic evaluations: Checks if database theme overrides exist, otherwise falls back to structural model properties
  const hasCustomBadgeData = Boolean(profileCardBadge || subtitle);
  const shouldRenderBadgeContainer = hasCustomBadgeData || Boolean(organization);

  // Assigns layout parameters based on override precedence rule tiers
  const displayBadgeLabel = profileCardBadge || label;
  const displayBadgeValue = subtitle || organization?.name;

  return (
    <div className={styles.card}>
      {/* BACKGROUND GRAPHIC LAYER CONTAINER */}
      <div
        className={styles.imageContainer}
        style={{ backgroundImage: `url(${imagePath})` }}
      >
        {/* FROSTED TEXT OVERLAY PANEL (Positions data cleanly at the lower base of the graphic layout) */}
        <div className={styles.overlay}>
          <div className={styles.info}>
            
            {/* Dynamic Nationality Flags Sub-Loop */}
            {entity.metadata?.Nationality && Array.isArray(entity.metadata.Nationality) && (
              <div className={styles.metadata}>
                {entity.metadata.Nationality.map((code: string) => (
                  <span key={code} className={styles.countryBadge}>
                    <ReactCountryFlag 
                      countryCode={code} 
                      svg 
                      style={{
                        width: '1.5em',
                        height: '1.5em',
                        borderRadius: '2px'
                      }}
                      title={code} 
                    />
                  </span>
                ))}
              </div>
            )}

            {/* Main Entity Identification Headline */}
            <h2 className={styles.name}>{entity.name}</h2>
            
            {/* Organizational Context Capsule Overlay Bar */}
            {shouldRenderBadgeContainer && (
              <div className={styles.orgBadge}>
                {displayBadgeLabel && <span className={styles.label}>{displayBadgeLabel}</span>}
                {displayBadgeValue && <span className={styles.orgName}>{displayBadgeValue}</span>}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};