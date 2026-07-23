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

export const ProfileCard: React.FC<ProfileCardProps> = ({ 
  entity, 
  organization, 
  label, 
  profileCardBadge, 
  subtitle 
}) => {
  const mediaPath = getEntityImage(entity.image as EntityImages, 'profileCard');

  // Check of het om een video gaat (inclusief .gifv, .mp4, .webm, .mov)
  const isVideo = typeof mediaPath === 'string' && /\.(mp4|webm|ogg|mov|gifv)(\?.*)?$/i.test(mediaPath);

  const hasCustomBadgeData = Boolean(profileCardBadge || subtitle);
  const shouldRenderBadgeContainer = hasCustomBadgeData || Boolean(organization);

  const displayBadgeLabel = profileCardBadge || label;
  const displayBadgeValue = subtitle || organization?.name;

  return (
    <div className={styles.card}>
      <div className={styles.imageContainer}>
        {/* Render een video-element bij video's/gifv, anders de achtergrondafbeelding */}
        {isVideo ? (
          <video 
            className={styles.backgroundVideo} 
            src={mediaPath} 
            autoPlay 
            loop 
            muted 
            playsInline 
          />
        ) : (
          <div
            className={styles.backgroundImage}
            style={{ backgroundImage: `url(${mediaPath})` }}
          />
        )}

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