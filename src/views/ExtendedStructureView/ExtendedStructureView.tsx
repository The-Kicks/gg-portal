import React, { useMemo, useState } from 'react';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './ExtendedStructureView.module.css';

import type { BaseEntity, Theme } from '../../types';
import type { FormattedStatItem, PreparedMediaItem, MemberTimelineRow } from './ExtendedStructureViewPage';

interface ExtendedStructureViewProps {
  entity: BaseEntity;
  activeLayer: "l1" | "l2" | "l3" | "l4";
  parents: BaseEntity[];
  theme: Theme;
  mediaSections: Record<string, PreparedMediaItem[]>;
  sidebarSubLabel: string;
  formattedStatistics: FormattedStatItem[];
  relatedL2s: BaseEntity[];
  relatedL3s: BaseEntity[];
  relatedL4s: BaseEntity[];
  profileCardImageUrl: string;
  heroBannerImageUrl: string;
  hasProfileCard: boolean;
  hasHeroBanner: boolean;
  shouldShowHeroSection: boolean;
  mediaDimensions: Record<string, boolean>;
  setMediaDimensions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setProfileImageError: (err: boolean) => void;
  setHeroImageError: (err: boolean) => void;
  onNavigate: (id: string, layer: "l1" | "l2" | "l3" | "l4") => void;
  memberTimeline: {
    rows: MemberTimelineRow[];
    minYear: number;
    maxYear: number;
  } | null;
}

export const ExtendedStructureView: React.FC<ExtendedStructureViewProps> = ({
  entity,
  activeLayer,
  parents,
  theme,
  mediaSections = {},
  sidebarSubLabel,
  formattedStatistics,
  relatedL2s,
  relatedL3s,
  relatedL4s,
  profileCardImageUrl,
  heroBannerImageUrl,
  hasProfileCard,
  hasHeroBanner,
  shouldShowHeroSection,
  mediaDimensions,
  setMediaDimensions,
  setProfileImageError,
  setHeroImageError,
  onNavigate,
  memberTimeline,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = relatedL2s.length > 0 || relatedL3s.length > 0 || relatedL4s.length > 0;

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

  const visibleMembersCount = 9;
  const targetMembersList = relatedL4s;
  const hasMoreThanMax = targetMembersList.length > visibleMembersCount;
  const displayedMembers = isExpanded ? targetMembersList : targetMembersList.slice(0, visibleMembersCount);

  const timelineYears = useMemo(() => {
    if (!memberTimeline) return [];
    const years = [];
    for (let y = memberTimeline.minYear; y <= memberTimeline.maxYear; y++) {
      years.push(y);
    }
    return years;
  }, [memberTimeline]);

  return (
    <div className={styles.pageWrapper}>
      {/* --- SECTION: HERO HEADER --- */}
      {shouldShowHeroSection ? (
        <section className={styles.heroSection}>
          {hasHeroBanner && (
            <div
              className={styles.heroBg}
              style={{ backgroundImage: `url(${heroBannerImageUrl})` }}
              onError={() => setHeroImageError(true)}
            />
          )}
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            {hasProfileCard && (
              <div className={styles.avatarContainer}>
                <img
                  src={profileCardImageUrl}
                  alt={entity.name}
                  className={styles.floatingAvatar}
                  onError={() => setProfileImageError(true)}
                />
              </div>
            )}
            <div className={styles.titleBox}>
              <span className={styles.layerLabel}>{theme.labels[activeLayer] ?? activeLayer}</span>
              <h1 className={styles.entityName}>{entity.name}</h1>
              {parents.length > 0 && (
                <p className={styles.breadcrumbPath}>
                  {parents.map((p, idx) => (
                    <React.Fragment key={p.id}>
                      {idx > 0 && <span className={styles.sep}>/</span>}
                      {p.name}
                    </React.Fragment>
                  ))}
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <div className={styles.standaloneTitleWrapper}>
          <div className={styles.titleBox}>
            <span className={styles.layerLabel}>{theme.labels[activeLayer] ?? activeLayer}</span>
            <h1 className={styles.entityName}>{entity.name}</h1>
          </div>
        </div>
      )}

      {/* --- SECTION: MAIN CONTENT SPLIT LAYOUT --- */}
      <div className={styles.mainLayout}>
        <aside className={styles.sidebar}>
          <div className={`${styles.stickyContainer} ${styles.isSticky}`}>
            <div className={styles.infoCard}>
              <h3 className={styles.sidebarTitle}>Metadata</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statBox}>
                  <label>Context</label>
                  <span>{sidebarSubLabel}</span>
                </div>
                {formattedStatistics.map((stat) => (
                  <div key={stat.key} className={styles.statBox}>
                    <label>{stat.label}</label>
                    <span>{stat.displayValue}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className={styles.contentArea}>
          
          {/* 1. L3 SPECIALE TIJDLIJN VIEW (Eerst geplaatst indien activeLayer === 'l3') */}
          {activeLayer === 'l3' && memberTimeline && hasChildren && (
            <section className={styles.teammatesSection} style={{ marginBottom: '2.5rem' }}>
              <h2 className={styles.sectionHeading}>{'Roster Timeline'}</h2>
              
              <div className={styles.timelineContainer}>
                {/* Tijdlijn Jaren Header */}
                <div className={styles.timelineHeaderRow}>
                  <div className={styles.timelineMemberStickyLabel} />
                  <div className={styles.timelineBarsArea}>
                    {timelineYears.map(year => (
                      <div key={year} className={styles.timelineYearScaleLabel}>
                        {year}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tijdlijn Rijen */}
                <div className={styles.timelineRowsStack}>
                  {displayedMembers.map((member) => {
                    const rowData = memberTimeline.rows.find(r => r.memberId === member.id);
                    if (!rowData) return null;

                    const totalYears = memberTimeline.maxYear - memberTimeline.minYear;
                    const startOffset = ((rowData.startYear - memberTimeline.minYear) / totalYears) * 100;
                    const barWidth = ((rowData.endYear - rowData.startYear) / totalYears) * 100;
                    const safeBarWidth = barWidth <= 0 ? (1 / totalYears) * 100 : barWidth;

                    const isFormer = rowData.status === 'former' || rowData.status === 'left';

                    return (
                      <div 
                        key={member.id} 
                        className={`${styles.timelineRow} ${isFormer ? styles.isFormerTeammate : ''}`}
                        onClick={() => onNavigate(member.id, 'l4')}
                      >
                        {/* Member Identiteit */}
                        <div className={styles.timelineMemberMeta}>
                          <img src={rowData.memberImage} alt="" className={styles.timelineMiniThumb} />
                          <div className={styles.timelineMemberInfo}>
                            <span className={styles.timelineMemberName}>{rowData.memberName}</span>
                            <span className={styles.timelineMemberDuration}>
                              {rowData.startDate ? rowData.startYear : '???'} – {isFormer ? rowData.endYear : 'Present'}
                            </span>
                          </div>
                        </div>

                        {/* Horizontale Balk Track */}
                        <div className={styles.timelineBarsArea}>
                          {timelineYears.map(year => (
                            <div key={year} className={styles.timelineGridLine} />
                          ))}
                          
                          <div 
                            className={styles.timelineDataBar}
                            style={{
                              left: `${startOffset}%`,
                              width: `${safeBarWidth}%`
                            }}
                          >
                            <span className={styles.barInsideLabel}>
                              {isFormer ? 'Former' : 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {hasMoreThanMax && (
                <div className={styles.viewMoreContainer}>
                  <button 
                    className={styles.viewMoreBtn} 
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? 'View Less' : `View More (+${targetMembersList.length - visibleMembersCount})`}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 2. DYNAMISCHE ALBUMS LOOP (TETRIS GRID) (Nu na de tijdlijn geplaatst) */}
          {hasMedia && (
            <div className={styles.mediaContainerWrapper} style={{ marginBottom: '2.5rem' }}>
              {gallerySectionKeys.map(sectionKey => {
                const galleryItems = mediaSections[sectionKey];
                return (
                  <section key={sectionKey} className={styles.mediaSection} style={{ marginBottom: '2rem' }}>
                    <h2 className={styles.sectionHeading}>{theme.labels[sectionKey] ?? sectionKey}</h2>
                    <div className={styles.mediaGrid}>
                      {galleryItems.map((item) => {
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
              })}
            </div>
          )}

          {/* 3. OVERIGE GRIDS (Voor L1 of L2 lagen die geen tijdlijn gebruiken) */}
          {hasChildren ? (
            <>
              {/* L3: Standaard Grid (Alleen als actieve laag GEEN L3 is) */}
              {relatedL3s.length > 0 && activeLayer !== 'l3' && (
                <section className={styles.teammatesSection}>
                  <h2 className={styles.sectionHeading}>{theme.labels.l3 ?? 'Organizations'}</h2>
                  <div className={styles.teammatesGrid}>
                    {relatedL3s.map((child) => {
                      const isDisbanded = ['disbanded', 'inactive', 'retired', 'historical'].includes(
                        (child.status || '').toLowerCase().trim()
                      ) || child.metadata?.groupStatus === 'disbanded' || child.metadata?.status === 'disbanded';

                      return (
                        <div
                          key={child.id}
                          className={`${styles.teammateCardWrapper} ${isDisbanded ? styles.isFormerTeammate : ''}`}
                          onClick={() => onNavigate(child.id, 'l3')}
                          style={{ cursor: 'pointer' }}
                        >
                          <EntityCard
                            entity={child}
                            activeKey="l3"
                            theme={theme}
                            labels={theme.labels as Record<string, string>}
                            organization={entity}
                            customLabel={theme.labels.l2 ?? 'Label'}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* L4: Standaard Grid (Alleen als actieve laag GEEN L3 is) */}
              {relatedL4s.length > 0 && activeLayer !== 'l3' && (
                <section className={styles.teammatesSection}>
                  <h2 className={styles.sectionHeading}>{theme.labels.l4 ?? 'Endpoints'}</h2>
                  <div className={styles.teammatesGrid}>
                    {displayedMembers.map((child) => {
                      const isFormer = child.metadata?.groupStatus === 'former' || child.metadata?.status === 'former';
                      return (
                        <div
                          key={child.id}
                          className={`${styles.teammateCardWrapper} ${isFormer ? styles.isFormerTeammate : ''}`}
                          onClick={() => onNavigate(child.id, 'l4')}
                          style={{ cursor: 'pointer' }}
                        >
                          <EntityCard
                            entity={child}
                            activeKey="l4"
                            theme={theme}
                            labels={theme.labels as Record<string, string>}
                            organization={entity}
                            customLabel={theme.labels.l3 ?? 'Group'}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {hasMoreThanMax && (
                    <div className={styles.viewMoreContainer}>
                      <button 
                        className={styles.viewMoreBtn} 
                        onClick={() => setIsExpanded(!isExpanded)}
                      >
                        {isExpanded ? 'View Less' : `View More (+${targetMembersList.length - visibleMembersCount})`}
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* L2: Core Divisions Grid */}
              {relatedL2s.length > 0 && (
                <section className={styles.teammatesSection}>
                  <h2 className={styles.sectionHeading}>{theme.labels.l2 ?? 'Sub-layers'}</h2>
                  <div className={styles.teammatesGrid}>
                    {relatedL2s.map((child) => (
                      <div
                        key={child.id}
                        className={styles.teammateCardWrapper}
                        onClick={() => onNavigate(child.id, 'l2')}
                        style={{ cursor: 'pointer' }}
                      >
                        <EntityCard
                          entity={child}
                          activeKey="l2"
                          theme={theme}
                          labels={theme.labels as Record<string, string>}
                          organization={entity}
                          customLabel={theme.labels.l1 ?? 'Company'}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            !hasMedia && (
              <div className={styles.emptyMediaContainer}>
                <h3>No data available</h3>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};