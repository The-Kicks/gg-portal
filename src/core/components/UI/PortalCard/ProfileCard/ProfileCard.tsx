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

export const ProfileCard: React.FC<ProfileCardProps> = ({ 
  entity, 
  organization, 
  profileCardBadge, 
  subtitle 
}) => {
  const mediaPath = getEntityImage(entity.image as EntityImages, 'profileCard');

  // Check of het om een video gaat (inclusief .gifv, .mp4, .webm, .mov)
  const isVideo = typeof mediaPath === 'string' && /\.(mp4|webm|ogg|mov|gifv)(\?.*)?$/i.test(mediaPath);

  // Als subtitle of profileCardBadge gelijk is aan 'L3' (of 'l3'), tonen we de organisatienaam als label. Anders gebruiken we de normale subtitle.
  const isL3 = (subtitle && subtitle.toLowerCase() === 'l3') || (profileCardBadge && profileCardBadge.toLowerCase() === 'l3');
  
  const displayBadgeLabel = isL3 ? organization?.name : subtitle;
  const displayBadgeValue = profileCardBadge;

  // De container verschijnt alleen als er daadwerkelijk content is
  const shouldRenderBadgeContainer = Boolean(displayBadgeLabel || displayBadgeValue);

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

        {/* Landvlag(gen) absoluut gepositioneerd in de linker bovenhoek (zonder achtergrond en niet rond) */}
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