import React from 'react';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './ExtendedStructureView.module.css';

import type { BaseEntity, Theme } from '../../types';
import type { FormattedStatItem } from './ExtendedStructureViewPage';

interface ExtendedStructureViewProps {
  entity: BaseEntity;
  activeLayer: "l1" | "l2" | "l3" | "l4";
  parents: BaseEntity[];
  theme: Theme;
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
  setProfileImageError: (err: boolean) => void;
  setHeroImageError: (err: boolean) => void;
  onNavigate: (id: string, layer: "l1" | "l2" | "l3" | "l4") => void;
}

export const ExtendedStructureView: React.FC<ExtendedStructureViewProps> = ({
  entity,
  activeLayer,
  parents,
  theme,
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
  setProfileImageError,
  setHeroImageError,
  onNavigate,
}) => {
  // Check if this item has any lower-level children or sub-layers to display
  const hasChildren = relatedL2s.length > 0 || relatedL3s.length > 0 || relatedL4s.length > 0;

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
              {/* Breadcrumb path displaying the vertical lineage trail */}
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
        /* Plain fallback header if there are no brand visuals or images loaded */
        <div className={styles.standaloneTitleWrapper}>
          <div className={styles.titleBox}>
            <span className={styles.layerLabel}>{theme.labels[activeLayer] ?? activeLayer}</span>
            <h1 className={styles.entityName}>{entity.name}</h1>
          </div>
        </div>
      )}

      {/* --- SECTION: MAIN CONTENT SPLIT LAYOUT --- */}
      <div className={styles.mainLayout}>
        {/* Sticky Info Sidebar */}
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

        {/* Dynamic Sub-layers Display Panels */}
        <main className={styles.contentArea}>
          {hasChildren ? (
            <>
              {/* L3: Organizations / Groups Component Grid */}
              {relatedL3s.length > 0 && (
                <section className={styles.teammatesSection}>
                  <h2 className={styles.sectionHeading}>{theme.labels.l3 ?? 'Organizations'}</h2>
                  <div className={styles.teammatesGrid}>
                    {relatedL3s.map((child) => {
                      // Determine if this organizational unit is no longer active or operating
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

              {/* L4: Roster Members / Endpoints Component Grid */}
              {relatedL4s.length > 0 && (
                <section className={styles.teammatesSection}>
                  <h2 className={styles.sectionHeading}>{theme.labels.l4 ?? 'Endpoints'}</h2>
                  <div className={styles.teammatesGrid}>
                    {relatedL4s.map((child) => {
                      // Check if a member is listed as former/ex-member to apply visual filters
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
                </section>
              )}

              {/* L2: Core Divisions / Sub-layers Component Grid */}
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
            /* Fallback layout template when there are zero nested entities mapped */
            <div className={styles.emptyMediaContainer}>
              <h3>No data available</h3>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};