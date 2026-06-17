import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './ExtendedProfileView.module.css';
import ReactCountryFlag from 'react-country-flag';
import type { PreparedMediaItem, FormattedStatItem, TeammateStructure, TimelineItem } from './ExtendedProfileViewPage';
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
  timelineItems: TimelineItem[];
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
  timelineItems,
}) => {
  const [isHeroScrolledPast, setIsHeroScrolledPast] = useState(false);
  const heroSectionRef = useRef<HTMLDivElement>(null);

  const [columnPaddings, setColumnPaddings] = useState<Record<string, number[]>>({});
  const colContentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const navigate = useNavigate();
  const { themeName } = useParams();

  const gallerySectionKeys = useMemo(() => {
    return Object.keys(mediaSections).filter(key => mediaSections[key]?.length > 0);
  }, [mediaSections]);

  const hasMedia = gallerySectionKeys.length > 0;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>, fileUrl: string) => {
    const img = e.currentTarget;
    const isHorizontal = img.naturalWidth > img.naturalHeight;
    if (mediaDimensions[fileUrl] !== isHorizontal) {
      setMediaDimensions(prev => ({ ...prev, [fileUrl]: isHorizontal }));
    }
  };

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

  /* English comment: Format date string cleanly for timeline view */
  const formatTimelineDate = (dateStr?: string) => {
    if (!dateStr) return '';

    // Als de string puur een jaartal is (bijv. "2015"), geef deze dan direct terug zonder maand
    if (/^\d{4}$/.test(dateStr.trim())) {
      return dateStr.trim();
    }

    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

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

  useEffect(() => {
    if (!hasMedia) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const newPaddings: Record<string, number[]> = {};

        gallerySectionKeys.forEach((sectionKey) => {
          const h0 = colContentRefs.current[`${sectionKey}-0`]?.offsetHeight || 0;
          const h1 = colContentRefs.current[`${sectionKey}-1`]?.offsetHeight || 0;
          const h2 = colContentRefs.current[`${sectionKey}-2`]?.offsetHeight || 0;

          const maxHeight = Math.max(h0, h1, h2);
          if (maxHeight > 0) {
            newPaddings[sectionKey] = [
              maxHeight - h0,
              maxHeight - h1,
              maxHeight - h2
            ];
          }
        });

        setColumnPaddings(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newPaddings)) return prev;
          return newPaddings;
        });
      });
    });

    gallerySectionKeys.forEach((sectionKey) => {
      [0, 1, 2].forEach((colIndex) => {
        const el = colContentRefs.current[`${sectionKey}-${colIndex}`];
        if (el) observer.observe(el);
      });
    });

    return () => observer.disconnect();
  }, [gallerySectionKeys, hasMedia]);

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
      {heroBannerImageUrl && !hasHeroBanner && (
        <img src={heroBannerImageUrl} style={{ display: 'none' }} onError={() => setHeroImageError(true)} alt="" />
      )}

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

      {!shouldShowHeroSection && <div className={styles.standaloneTitleWrapper}>{renderTitleBox()}</div>}

      <div className={styles.mainLayout}>
        <aside className={styles.sidebar}>
          <div className={`${styles.stickyContainer} ${isHeroScrolledPast ? styles.isSticky : styles.isStatic}`}>
            <div className={`${styles.compactHeader} ${isHeroScrolledPast ? styles.visible : ''}`}>
              {hasProfileCard && <img src={profileCardImageUrl} className={styles.miniAvatar} alt="" />}
              <h2 className={styles.compactName}>{entity.name}</h2>
              <span className={styles.compactLabel}>{sidebarSubLabel}</span>
            </div>

            <div className={styles.infoCard}>
              <h3 className={styles.sidebarTitle}>Stats</h3>
              <div className={styles.statsGrid}>
                {formattedStatistics
                  .filter((stat) => stat.key !== 'customTracks') // Dit filtert de customTracks eruit
                  .map((stat) => (
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
          {/* English comment: Structural CSS classes ready for timeline styling */}
          {timelineItems.length > 0 && (
            <section className={styles.timelineSection}>
              <h2 className={styles.sectionHeading}>Timeline</h2>
              <div className={styles.timelineTrack}>
                {timelineItems.map((item) => (
                  <div key={item.id} className={styles.timelineItem}>
                    <div className={styles.timelineNode}>
                      <div className={styles.timelineDot} />
                    </div>
                    <div className={styles.timelineCard}>
                      <div className={styles.timelineMeta}>
                        <span className={styles.timelineDuration}>
                          {formatTimelineDate(item.startDate)} {item.endDate ? ` - ${formatTimelineDate(item.endDate)}` : ' - Present'}
                        </span>
                        {item.status && (
                          <span className={`${styles.timelineBadge} ${styles[String(item.status).toLowerCase()] || ''}`}>
                            {item.status}
                          </span>
                        )}
                      </div>
                      <h3 className={styles.timelineGroupTitle}>{item.groupName}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasMedia ? (
            gallerySectionKeys.map(sectionKey => {
              const galleryItems = mediaSections[sectionKey];
              return (
                <section key={sectionKey} className={styles.mediaSection}>
                  <h2 className={styles.sectionHeading}>{theme.labels[sectionKey] ?? sectionKey}</h2>
                  <div className={styles.mediaGrid}>

                    {[0, 1, 2].map((colIndex) => {
                      const itemsInColumn = galleryItems.filter((_, index) => index % 3 === colIndex);
                      const rawPadding = columnPaddings[sectionKey]?.[colIndex] || 0;
                      const finalPlaceholderHeight = rawPadding - 24;

                      return (
                        <div key={colIndex} className={styles.mediaColumn}>
                          <div
                            ref={(el) => { colContentRefs.current[`${sectionKey}-${colIndex}`] = el; }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
                          >
                            {itemsInColumn.map((item) => {
                              let itemLayoutClass = styles.imageItem;
                              if (item.itemClassKey === 'horizontalImageItem') itemLayoutClass = styles.horizontalImageItem;
                              if (item.itemClassKey === 'videoItem') itemLayoutClass = styles.videoItem;
                              if (item.itemClassKey === 'verticalVideoItem') itemLayoutClass = styles.verticalVideoItem;
                              if (item.itemClassKey === 'tallImageItem') itemLayoutClass = styles.tallImageItem;

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

                          {finalPlaceholderHeight > 10 && (
                            <div
                              className={`${styles.mediaItem} ${styles.decorativePlaceholder}`}
                              style={{
                                height: finalPlaceholderHeight,
                                padding: finalPlaceholderHeight < 80 ? '0' : undefined,
                                minHeight: 0
                              }}
                            >
                              {finalPlaceholderHeight >= 80 && (
                                <div className={styles.placeholderInner}>
                                  <span className={styles.placeholderLabel}>Showcase</span>
                                  <span className={styles.placeholderSub}>Coming Soon</span>
                                </div>
                              )}
                            </div>
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
                <div className={styles.emptyMediaIconWrapper}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>
                <h3 className={styles.emptyMediaTitle}>No Media Available</h3>
                <p className={styles.emptyMediaSubtitle}>This profile currently has no showcase material</p>
              </div>
            </div>
          )}

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
                        const isFormer = ['former', 'retired', 'ex', 'disbanded'].includes(currentStatus);

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
                              organization={member.l3?.find(g => g.id === groupId)}
                              customLabel={member.l3?.find(g => g.id === groupId)?.name ?? 'Member'}
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