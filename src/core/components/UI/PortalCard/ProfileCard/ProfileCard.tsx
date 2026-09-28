import React from 'react';
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
 * ProfileCard component renders an entity's profile view with a background image or video,
 * optional nationality flags, and organizational badges or subtitles.
 */
export const ProfileCard: React.FC<ProfileCardProps> = ({ 
  entity, 
  organization, 
  profileCardBadge, 
  subtitle 
}) => {
  const mediaPath = getEntityImage(entity.image as EntityImages, 'profileCard');

  // Check if the media is a video (including .gifv, .mp4, .webm, .mov)
  const isVideo = typeof mediaPath === 'string' && /\.(mp4|webm|ogg|mov|gifv)(\?.*)?$/i.test(mediaPath);

  // If subtitle or profileCardBadge equals 'L3' (or 'l3'), show the organization name as the label. Otherwise, use the regular subtitle.
  const isL3 = (subtitle && subtitle.toLowerCase() === 'l3') || (profileCardBadge && profileCardBadge.toLowerCase() === 'l3');
  
  const displayBadgeLabel = isL3 ? organization?.name : subtitle;
  const displayBadgeValue = profileCardBadge;

  // The container only renders when there is actual content available
  const shouldRenderBadgeContainer = Boolean(displayBadgeLabel || displayBadgeValue);

  return (
    <div className={styles.card}>
      <div className={styles.imageContainer}>
        {/* Render a video element for videos/gifv, otherwise the background image */}
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

        {/* Country flag(s) absolutely positioned in the top-left corner */}
        {entity.metadata?.Nationality && Array.isArray(entity.metadata.Nationality) && entity.metadata.Nationality.length > 0 && (
          <div className={styles.topLeftFlags}>
            {entity.metadata.Nationality.map((code: string) => (
              <span key={code} className={styles.countryBadge}>
                <ReactCountryFlag 
                  countryCode={code} 
                  svg 
                  style={{
                    width: '1.5em',
                    height: '1.1em',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  title={code} 
                />
              </span>
            ))}
          </div>
        )}

        <div className={styles.overlay}>
          <div className={styles.info}>
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