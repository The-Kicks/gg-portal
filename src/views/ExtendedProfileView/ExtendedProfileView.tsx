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

  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});
  
  // View Entire Timeline feature states
  const [isTimelineTall, setIsTimelineTall] = useState(false);
  const [forceShowEntireTimeline, setForceShowEntireTimeline] = useState(false);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

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

  const toggleMilestones = (itemId: string) => {
    setExpandedMilestones(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const formatTimelineDate = (dateStr?: string) => {
    if (!dateStr) return '';
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

  // Dynamic monitoring for "View Entire Timeline" triggers (> 50vh)
  useEffect(() => {
    if (timelineItems.length === 0 || !timelineContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!timelineContainerRef.current) return;
      const contentHeight = timelineContainerRef.current.scrollHeight;
      const maxHeightAllowed = window.innerHeight * 0.5; // 50% of screen height
      setIsTimelineTall(contentHeight > maxHeightAllowed);
    });

    resizeObserver.observe(timelineContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [timelineItems]);

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
            newPaddings[sectionKey] = [maxHeight - h0, maxHeight - h1, maxHeight - h2];
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
                  .filter((stat) => stat.key !== 'customTracks')
                  .map((stat) => (
                    <div key={stat.key} className={styles.statBox}>
                      <label>{stat.label}</label>
                      {stat.key === 'Nationality' && Array.isArray(entity.metadata?.Nationality) ? (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {entity.metadata.Nationality.map((flagcode: string) => (
                            <ReactCountryFlag
                              key={flagcode}
                              countryCode={flagcode}
                              svg
                              style={{ width: '1.4em', height: '1.4em', borderRadius: '2px' }}
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
          {timelineItems.length > 0 && (
            <section className={styles.timelineSection}>
              <h2 className={styles.sectionHeading}>Timeline</h2>
              
              <div 
                ref={timelineContainerRef} 
                className={`${styles.timelineContainerDynamic} ${isTimelineTall && !forceShowEntireTimeline ? styles.isCapped : ''}`}
              >
                <div className={styles.timelineTrack}>
                  {timelineItems.map((item) => {
                    const isExpanded = !!expandedMilestones[item.id];
                    const totalMilestones = item.milestones?.length || 0;
                    const visibleMilestones = isExpanded ? item.milestones || [] : (item.milestones || []).slice(0, 3);
                    const hasMoreThanLimit = totalMilestones > 3;

                    const startStr = formatTimelineDate(item.startDate);
                    const endStr = formatTimelineDate(item.endDate);
                    const shouldShowEndDate = item.endDate && item.endDate !== item.startDate;
                    
                    const isPastItem = item.status?.toLowerCase() !== 'active';

                    return (
                      <div 
                        key={item.id} 
                        className={`${styles.timelineItem} ${isPastItem ? styles.isPastItem : ''}`}
                      >
                        <div className={styles.timelineSideInfo}>
                          <span className={styles.timelineDuration}>
                            {startStr}
                            {shouldShowEndDate && ` — ${endStr}`}
                            {!item.endDate && item.status === 'active' && ' — Present'}
                          </span>
                          {item.status && (
                            <span className={`${styles.timelineBadge} ${styles[String(item.status).toLowerCase()] || ''}`}>
                              {item.status}
                            </span>
                          )}
                        </div>

                        <div className={styles.timelineNode}>
                          <div className={styles.timelineDot} />
                        </div>

                        <div className={styles.timelineCard}>
                          <h4 className={styles.timelineGroupTitle}>{item.groupName}</h4>
                          {item.milestones && totalMilestones > 0 && (
                            <div className={styles.milestonesWrapper}>
                              <div className={styles.milestonesTrackLine} />
                              {visibleMilestones.map((milestone, mIdx) => (
                                <div key={`${milestone.title}-${mIdx}`} className={styles.milestoneRow}>
                                  <div className={styles.milestoneIndicator}>
                                    <div className={styles.milestoneMiniDot} />
                                  </div>
                                  <div className={styles.milestoneContent}>
                                    <span className={styles.milestoneDate}>{formatTimelineDate(milestone.date)}</span>
                                    <span className={styles.milestoneTitle}>{milestone.title}</span>
                                  </div>
                                </div>
                              ))}

                              {hasMoreThanLimit && (
                                <button onClick={() => toggleMilestones(item.id)} className={styles.milestoneExpandButton}>
                                  {isExpanded ? (
                                    <>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6"/></svg>
                                      <span>Less</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
                                      <span>{totalMilestones - 3} more</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isTimelineTall && !forceShowEntireTimeline && (
                  <div className={styles.timelineFadeOverlay}>
                    <button 
                      className={styles.viewEntireTimelineButton}
                      onClick={() => setForceShowEntireTimeline(true)}
                    >
                      <span>View Entire Timeline</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>
                )}
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
                              style={{ height: finalPlaceholderHeight, padding: finalPlaceholderHeight < 80 ? '0' : undefined, minHeight: 0 }}
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
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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