import { ReactCountryFlag } from 'react-country-flag';
import type { BaseEntity, EntityImages } from '../../../../../types';
import { getEntityImage } from '../../../../helpers/getEntityImage';
import styles from './ProfileCard.module.css';

interface ProfileCardProps {
  entity: BaseEntity;
  organization?: BaseEntity;
  label: string;
  profileCardBadge?: string; 
  subtitle?: string;         
}

/**
 * Renders a detailed visual profile showcase layout, resolving dynamic background asset paths, 
 * embedding multi-national country flag badges, and applying context label overrides with high precedence.
 */
export const ProfileCard: React.FC<ProfileCardProps> = ({ 
  entity, 
  organization, 
  label, 
  profileCardBadge, 
  subtitle 
}) => {
  const imagePath = getEntityImage(entity.image as EntityImages, 'profileCard');

  const hasCustomBadgeData = Boolean(profileCardBadge || subtitle);
  const shouldRenderBadgeContainer = hasCustomBadgeData || Boolean(organization);

  const displayBadgeLabel = profileCardBadge || label;
  const displayBadgeValue = subtitle || organization?.name;

  return (
    <div className={styles.card}>
      <div
        className={styles.imageContainer}
        style={{ backgroundImage: `url(${imagePath})` }}
      >
        <div className={styles.overlay}>
          <div className={styles.info}>
            
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

            <h2 className={styles.name}>{entity.name}</h2>
            
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