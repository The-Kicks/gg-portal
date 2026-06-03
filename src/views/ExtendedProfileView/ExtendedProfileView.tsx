import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './ExtendedProfileView.module.css';
import ReactCountryFlag from 'react-country-flag';
import type { PreparedMediaItem, FormattedStatItem, TeammateStructure } from './ExtendedProfileViewPage';
import type { BaseEntity, Theme } from '../../types';

interface ExtendedProfileViewProps {
  entity: BaseEntity;
  activeLayer: "l1" | "l2" | "l3" | "l4";
  parents: BaseEntity[];
  theme: Theme;
  mediaSections: Record<string, PreparedMediaItem[]>;
  profileCardImageUrl: string;
  heroBannerImageUrl: string;
  hasProfileCard: boolean;
  hasHeroBanner: boolean;
  shouldShowHeroSection: boolean;
  sidebarSubLabel: string;
  formattedStatistics: FormattedStatItem[];
  setProfileImageError: React.Dispatch<React.SetStateAction<boolean>>;
  setHeroImageError: React.Dispatch<React.SetStateAction<boolean>>;
  mediaDimensions: Record<string, boolean>;
  setMediaDimensions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  groupedTeammates: Record<string, { groupName: string; members: TeammateStructure[] }>;
  groupKeys: string[];
}

export const ExtendedProfileView: React.FC<ExtendedProfileViewProps> = ({
  entity,
  activeLayer,
  parents,
  theme,
  mediaSections,
  profileCardImageUrl,
  heroBannerImageUrl,
  hasProfileCard,
  hasHeroBanner,
  shouldShowHeroSection,
  sidebarSubLabel,
  formattedStatistics,
  setProfileImageError,
  setHeroImageError,
  mediaDimensions,
  setMediaDimensions,
  groupedTeammates,
  groupKeys,
}) => {
  // Triggers when the user scrolls past the main hero banner section
  const [isHeroScrolledPast, setIsHeroScrolledPast] = useState(false);
  const heroSectionRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { themeName } = useParams();

  const gallerySectionKeys = Object.keys(mediaSections).filter(key => mediaSections[key]?.length > 0);
  const hasMedia = gallerySectionKeys.length > 0;

  /**
 * Triggers when an image finishes loading. Calculates if it's landscape or portrait
 * and saves this state to adjust grid item size dynamicly.
 */
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>, fileUrl: string) => {
    const img = e.currentTarget;
    const isHorizontal = img.naturalWidth > img.naturalHeight;

    if (mediaDimensions[fileUrl] !== isHorizontal) {
      setMediaDimensions(prev => ({ ...prev, [fileUrl]: isHorizontal }));
    }
  };

  /**
 * Triggers when HTML5 video metadata loads. Determines video orientation
 * so portrait videos do not take up 2 horizontal blocks unnecessarily.
 */
  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>, fileUrl: string) => {
    const video = e.currentTarget;
    const isHorizontal = video.videoWidth > video.videoHeight;

    if (mediaDimensions[fileUrl] !== isHorizontal) {
      setMediaDimensions(prev => ({ ...prev, [fileUrl]: isHorizontal }));
    }
  };

  const handleTeammateClick = (targetId: string) => {
    if (!targetId) return;
    navigate(`/${themeName}/profile/${targetId}`);
  };

  // Uses IntersectionObserver to detect when the header moves out of view, making the sidebar compact header visible
  useEffect(() => {
    if (!shouldShowHeroSection) return;
    const observerOptions = { threshold: 0.05 };
    const intersectionCallback = ([entry]: IntersectionObserverEntry[]) => {
      setIsHeroScrolledPast(!entry.isIntersecting);
    };
    const intersectionObserver = new IntersectionObserver(intersectionCallback, observerOptions);
    if (heroSectionRef.current) intersectionObserver.observe(heroSectionRef.current);
    return () => intersectionObserver.disconnect();
  }, [shouldShowHeroSection]);

  // Shared function to render the name titles and breadcrumb paths in both header types
  const renderTitleBox = () => (
    <div className={styles.titleBox}>
      <span className={styles.layerLabel}>{theme.labels[activeLayer]}</span>
      <h1 className={styles.entityName}>{entity.name}</h1>
      <nav className={styles.breadcrumbPath}>
        {parents.map((parent, index) => (
          <span key={parent.id}>
            {parent.name}
            {index < parents.length - 1 && <span className={styles.sep}>/</span>}
          </span>
        ))}
      </nav>
    </div>
  );

  return (
    <div className={styles.pageWrapper}>
      {/* Hidden fallback image to check if the main asset exists before rendering */}
      {heroBannerImageUrl && !hasHeroBanner && (
        <img src={heroBannerImageUrl} style={{ display: 'none' }} onError={() => setHeroImageError(true)} alt="" />
      )}

      {/* --- SECTION: HERO CONTAINER --- */}
      {shouldShowHeroSection ? (
        <section ref={heroSectionRef} className={styles.heroSection}>
          {hasHeroBanner && <div className={styles.heroBg} style={{ backgroundImage: `url(${heroBannerImageUrl})` }} />}
          {hasHeroBanner && <div className={styles.heroOverlay} />}
          <div className={`${styles.heroContent} ${isHeroScrolledPast ? styles.hidden : ''}`}>
            {hasProfileCard && (
              <div className={styles.avatarContainer}>
                <img src={profileCardImageUrl} className={styles.floatingAvatar} onError={() => setProfileImageError(true)} alt="" />
              </div>
            )}
            {renderTitleBox()}
          </div>
        </section>
      ) : (
        <div ref={heroSectionRef} style={{ height: 0 }} />
      )}

      {/* If there are no images, show a simple static plain text header instead */}
      {!shouldShowHeroSection && <div className={styles.standaloneTitleWrapper}>{renderTitleBox()}</div>}

      {/* --- SECTION: MAIN GRID LAYOUT --- */}
      <div className={styles.mainLayout}>
        <aside className={styles.sidebar}>
          <div className={`${styles.stickyContainer} ${isHeroScrolledPast ? styles.isSticky : styles.isStatic}`}>
            
            {/* This small mini-header fades into view inside the sidebar once you scroll past the big header */}
            <div className={`${styles.compactHeader} ${isHeroScrolledPast ? styles.visible : ''}`}>
              {hasProfileCard && <img src={profileCardImageUrl} className={styles.miniAvatar} alt="" />}
              <h2 className={styles.compactName}>{entity.name}</h2>
              <span className={styles.compactLabel}>{sidebarSubLabel}</span>
            </div>
            
            {/* Main Information / Stats Card */}
            <div className={styles.infoCard}>
              <h3 className={styles.sidebarTitle}>Stats</h3>
              <div className={styles.statsGrid}>
                {formattedStatistics.map((stat) => (
                  <div key={stat.key} className={styles.statBox}>
                    <label>{stat.label}</label>
                    {stat.key === 'Nationality' && Array.isArray(entity.metadata?.Nationality) ? (
                      <div className={styles.metadata} style={{ display: 'flex', gap: '5px' }}>
                        {entity.metadata.Nationality.map((flagcode: string) => (
                          <ReactCountryFlag
                            key={flagcode}
                            countryCode={flagcode}
                            svg
                            style={{ width: '1.5em', height: '1.5em' }}
                            title={flagcode}
                          />
                        ))}
                      </div>
                    ) : (
                      <span>{stat.displayValue}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className={styles.contentArea}>
          {/* MEDIA SHOWCASE ALBUMS */}
          {hasMedia ? (
            gallerySectionKeys.map(sectionKey => {
              const galleryItems = mediaSections[sectionKey];
              return (
                <section key={sectionKey} className={styles.mediaSection}>
                  <h2 className={styles.sectionHeading}>{theme.labels[sectionKey] ?? sectionKey}</h2>
                  <div className={styles.mediaGrid}>
                    {galleryItems.map((item) => {
                      
                      // Render empty placeholders to neatly balance out uneven rows
                      if (item.isPlaceholder) {
                        const placeholderSizeClass = item.itemClassKey === 'horizontalImageItem'
                          ? styles.horizontalImageItem
                          : styles.imageItem;

                        return (
                          <div key={item.file} className={`${styles.decorativePlaceholder} ${placeholderSizeClass}`}>
                            <div className={styles.placeholderInner}>
                              <span className={styles.placeholderLabel}>{entity.name}</span>
                              <span className={styles.placeholderSub}>
                                {theme.labels[sectionKey] ?? sectionKey}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      const isHorizontal = item.itemClassKey !== 'imageItem';
                      const itemLayoutClass = isHorizontal ? styles.horizontalImageItem : styles.imageItem;
                      const mediaSourcePath = item.file.startsWith('http') ? item.file : `/${item.file}`;

                      return (
                        <div key={item.file} className={`${styles.mediaItem} ${itemLayoutClass}`}>
                          {item.type === 'image' ? (
                            <img src={mediaSourcePath} alt="" loading="lazy" onLoad={(e) => handleImageLoad(e, item.file)} />
                          ) : item.type === 'video-file' ? (
                            <video
                              src={mediaSourcePath}
                              controls
                              preload="metadata"
                              onLoadedMetadata={(e) => handleVideoMetadata(e, item.file)}
                            />
                          ) : (
                            <iframe src={mediaSourcePath} title={`${sectionKey}-${item.file}`} allowFullScreen />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          ) : (
            <div className={styles.emptyMediaContainer}>
              <div className={styles.emptyMediaInner}>
                <h3 className={styles.emptyMediaTitle}>No Media Available</h3>
                <span className={styles.emptyMediaSubtitle}>This profile currently has no showcase material</span>
              </div>
            </div>
          )}

          {/* RELATED MEMBERS / TEAMMATES */}
          {groupKeys.length > 0 && (
            <section className={styles.teammatesSection}>
              {groupKeys.map(groupId => {
                const { groupName, members } = groupedTeammates[groupId];

                return (
                  <div key={groupId} className={styles.groupSubSection}>
                    <h2 className={styles.sectionHeading}>{groupName} Members</h2>
                    <div className={styles.teammatesGrid}>
                      {members.map((member) => {
                        const currentStatus = String(member.l4.metadata?.groupStatus || '').toLowerCase();
                        const isFormer = ['former', 'retired', 'ex'].includes(currentStatus);

                        return (
                          <div
                            key={member.l4.id}
                            onClick={() => handleTeammateClick(member.l4.id)}
                            className={`${styles.teammateCardWrapper} ${isFormer ? styles.isFormerTeammate : ''}`}
                          >
                            <EntityCard
                              entity={member.l4}
                              activeKey="l4"
                              theme={theme}
                              labels={theme.labels}
                              organization={member.l3?.[0]}
                              customLabel={member.l3?.[0]?.name ?? 'Member'}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </main>
      </div>
    </div>
  );
};