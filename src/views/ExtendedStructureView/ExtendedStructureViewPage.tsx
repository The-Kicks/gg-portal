import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExtendedStructureView } from './ExtendedStructureView';
import { getEntityImage } from '../../core/helpers/getEntityImage';
import type { Theme, BaseEntity, EntityImages, HydratedEntity } from '../../types';

interface Props {
  theme: Theme;
}

export interface FormattedStatItem {
  key: string;
  label: string;
  displayValue: string;
}

// ==========================================================================
// PURE UTILITY FUNCTIONS (Data Translators)
// ==========================================================================
const isStringValid = (url: string): boolean => {
  const cleaned = url.trim().toLowerCase();
  return cleaned !== "" && cleaned !== "/placeholder.png" && cleaned !== "placeholder.png";
};

// ==========================================================================
// MAIN CONTROLLER COMPONENT
// ==========================================================================
export const ExtendedStructureViewPage: React.FC<Props> = ({ theme }) => {
  const { id, themeName } = useParams<{ id: string; themeName: string }>();
  const navigate = useNavigate();

  // Asset validation and image error lifecycle trackers
  const [profileImageError, setProfileImageError] = useState(false);
  const [heroImageError, setHeroImageError] = useState(false);

  // Automatically flush and reset error trackers if a user jumps to a new view ID
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setProfileImageError(false);
    setHeroImageError(false);
  }

  // --- TRAVERSAL CONTROLLER: Explores connections map to build the active structural branch ---
  const structureData = useMemo(() => {
    if (!id || !theme.entities) return null;

    // Locate the focus item matching either the URL routing UUID parameter or Name identifier
    const targetEntity = theme.entities.find((e) => e.id === id || e.name === id);
    if (!targetEntity) return null;

    const activeLayer = targetEntity.type as "l1" | "l2" | "l3" | "l4";

    // Track up-tree historical parents to assemble clear structural trace views
    const l1ParentsMap = new Map<string, BaseEntity>();
    const l2ParentsMap = new Map<string, BaseEntity>();
    
    // Store down-tree target children nodes grouped out by structural type levels
    const relatedL2sMap = new Map<string, BaseEntity>();
    const relatedL3sMap = new Map<string, BaseEntity>();
    const relatedL4sMap = new Map<string, BaseEntity>();

    // Helper utility to merge inbound and outbound bidirectional nodes safely
    const getConnections = (ent: HydratedEntity) => [
      ...(ent.connections || []),
      ...(ent.targetConnections || []),
    ];

    // =========================================================================
    // BRANCH TRAVERSAL LOGIC: Filter maps depending on selected level
    // =========================================================================
    
    // FOCUS LOOKUP: Intermediate operational node ($L3$)
    if (activeLayer === 'l3') {
      getConnections(targetEntity).forEach((conn) => {
        const other = conn.sourceEntity?.id === targetEntity.id ? conn.targetEntity : conn.sourceEntity;
        if (!other) return;

        if (other.type === 'l2') l2ParentsMap.set(other.id, other);
        if (other.type === 'l1') l1ParentsMap.set(other.id, other);
        
        // Map down-tree roster entries ($L4$) and update status parameters inline
        if (other.type === 'l4') {
          const relStatus = String(conn.metadata?.status || conn.metadata?.membershipStatus || 'active').toLowerCase().trim();
          relatedL4sMap.set(other.id, {
            ...other,
            metadata: {
              ...(other.metadata || {}),
              groupStatus: relStatus,
              status: relStatus,
            },
          });
        }
      });

      // Secondary check: Trace vertically through $L2$ if there isn't a direct connection link up to $L1$
      if (l1ParentsMap.size === 0) {
        l2ParentsMap.forEach((l2Parent) => {
          const fullL2 = theme.entities!.find((e) => e.id === l2Parent.id);
          if (fullL2) {
            getConnections(fullL2).forEach((conn) => {
              const other = conn.sourceEntity?.id === fullL2.id ? conn.targetEntity : conn.sourceEntity;
              if (other && other.type === 'l1') l1ParentsMap.set(other.id, other);
            });
          }
        });
      }
    } 
    // FOCUS LOOKUP: Mid-level Structural Division ($L2$)
    else if (activeLayer === 'l2') {
      getConnections(targetEntity).forEach((conn) => {
        const other = conn.sourceEntity?.id === targetEntity.id ? conn.targetEntity : conn.sourceEntity;
        if (!other) return;

        if (other.type === 'l1') l1ParentsMap.set(other.id, other);
        if (other.type === 'l3') relatedL3sMap.set(other.id, other);
      });

      // Dig down another level to find working elements ($L4$) linked underneath our sub-groups
      relatedL3sMap.forEach((l3Group) => {
        const fullL3 = theme.entities!.find((e) => e.id === l3Group.id);
        if (fullL3) {
          getConnections(fullL3).forEach((conn) => {
            const other = conn.sourceEntity?.id === fullL3.id ? conn.targetEntity : conn.sourceEntity;
            if (other && other.type === 'l4') {
              const relStatus = String(conn.metadata?.status || conn.metadata?.membershipStatus || 'active').toLowerCase().trim();
              if (relStatus === 'former' || relStatus === 'left') return; // Hide historic items from high level index

              relatedL4sMap.set(other.id, {
                ...other,
                metadata: {
                  ...(other.metadata || {}),
                  groupStatus: relStatus,
                  status: relStatus,
                },
              });
            }
          });
        }
      });
    } 
    // FOCUS LOOKUP: Structural Core Top Organization ($L1$)
    else if (activeLayer === 'l1') {
      getConnections(targetEntity).forEach((conn) => {
        const other = conn.sourceEntity?.id === targetEntity.id ? conn.targetEntity : conn.sourceEntity;
        if (!other) return;

        if (other.type === 'l2') relatedL2sMap.set(other.id, other);
        if (other.type === 'l3') relatedL3sMap.set(other.id, other);
      });

      // Discover floating operations ($L3$) mapped inside nested structural hubs ($L2$)
      relatedL2sMap.forEach((l2Agency) => {
        const fullL2 = theme.entities!.find((e) => e.id === l2Agency.id);
        if (fullL2) {
          getConnections(fullL2).forEach((conn) => {
            const other = conn.sourceEntity?.id === fullL2.id ? conn.targetEntity : conn.sourceEntity;
            if (other && other.type === 'l3') relatedL3sMap.set(other.id, other);
          });
        }
      });

      // Aggregate global underlying items ($L4$) avoiding nodes marked historically disconnected
      relatedL3sMap.forEach((l3Group) => {
        const fullL3 = theme.entities!.find((e) => e.id === l3Group.id);
        if (fullL3) {
          getConnections(fullL3).forEach((conn) => {
            const other = conn.sourceEntity?.id === fullL3.id ? conn.targetEntity : conn.sourceEntity;
            if (other && other.type === 'l4') {
              const relStatus = String(conn.metadata?.status || conn.metadata?.membershipStatus || 'active').toLowerCase().trim();
              if (relStatus === 'former' || relStatus === 'left') return;

              relatedL4sMap.set(other.id, {
                ...other,
                metadata: {
                  ...(other.metadata || {}),
                  groupStatus: relStatus,
                  status: relStatus,
                },
              });
            }
          });
        }
      });
    }

    // Sort parent arrays cleanly into breadcrumb paths chronologically: [$L1$ Parent -> $L2$ Parent]
    const parents: BaseEntity[] = [];
    const absoluteL1 = Array.from(l1ParentsMap.values())[0];
    const absoluteL2 = Array.from(l2ParentsMap.values())[0];
    
    if (absoluteL1) parents.push(absoluteL1);
    if (absoluteL2 && absoluteL2.id !== absoluteL1?.id) parents.push(absoluteL2);

    return {
      targetEntity,
      activeLayer,
      parents,
      relatedL2s: Array.from(relatedL2sMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      relatedL3s: Array.from(relatedL3sMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      relatedL4s: Array.from(relatedL4sMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [id, theme.entities]);

  // --- ROUTING CONTROL: Dynamically shifts paths depending on target layout goals ---
  const handleNavigation = useCallback((targetId: string, layer: "l1" | "l2" | "l3" | "l4") => {
    const isL4 = layer === 'l4';
    
    // Exception rules tracking empty nested components: Route $L3$ components straight into profile showcase if children lists don't exist
    const isL3AsProfile = (layer === 'l3' && structureData?.relatedL4s.length === 0 && structureData?.activeLayer === 'l2');

    const targetView = (isL4 || isL3AsProfile) ? 'profile' : 'structure';
    navigate(`/${themeName}/${targetView}/${targetId}`);
  }, [navigate, themeName, structureData]);

  // Handle asset link configurations and handle media loading checks
  const assets = useMemo(() => {
    if (!structureData?.targetEntity) return null;
    const entityImages = structureData.targetEntity.image as EntityImages | undefined;
    const profileCardImageUrl = entityImages ? getEntityImage(entityImages, 'profileCard') : '';
    const heroBannerImageUrl = entityImages ? getEntityImage(entityImages, 'heroBanner') : '';

    const hasProfileCard = isStringValid(profileCardImageUrl) && !profileImageError;
    const hasHeroBanner = isStringValid(heroBannerImageUrl) && !heroImageError;
    const shouldShowHeroSection = hasProfileCard || hasHeroBanner;

    return {
      profileCardImageUrl,
      heroBannerImageUrl,
      hasProfileCard,
      hasHeroBanner,
      shouldShowHeroSection,
    };
  }, [structureData, profileImageError, heroImageError]);

  // Compute text descriptors describing localized position settings for standard headers
  const sidebarSubLabel = useMemo(() => {
    if (!structureData) return '';
    const { activeLayer } = structureData;
    return activeLayer === 'l1'
      ? `${theme.labels.l1 ?? 'Company'} Overview`
      : activeLayer === 'l2'
      ? `${theme.labels.l2 ?? 'Label'} Structure`
      : activeLayer === 'l3'
      ? `${theme.labels.l3 ?? 'Group'} Roster`
      : (theme.labels[activeLayer] ?? activeLayer);
  }, [structureData, theme.labels]);

  // Transform core entry settings keys out into clear arrays for UI grid components to process
  const formattedStatistics = useMemo<FormattedStatItem[]>(() => {
    if (!structureData?.targetEntity?.metadata) return [];
    return Object.entries(structureData.targetEntity.metadata)
      .filter(([key, value]) => key !== 'description' && key !== 'status' && key !== 'membershipStatus' && !!value)
      .map(([key, value]) => ({
        key,
        label: theme.labels[key] ?? key,
        displayValue: Array.isArray(value) ? value.join(', ') : String(value),
      }));
  }, [structureData, theme.labels]);

  if (!structureData || !assets) return <div style={{ padding: '2rem', color: 'var(--text)' }}>Structure entity not found</div>;

  return (
    <ExtendedStructureView
      entity={structureData.targetEntity}
      activeLayer={structureData.activeLayer}
      parents={structureData.parents}
      relatedL2s={structureData.relatedL2s}
      relatedL3s={structureData.relatedL3s}
      relatedL4s={structureData.relatedL4s}
      theme={theme}
      sidebarSubLabel={sidebarSubLabel}
      formattedStatistics={formattedStatistics}
      profileCardImageUrl={assets.profileCardImageUrl}
      heroBannerImageUrl={assets.heroBannerImageUrl}
      hasProfileCard={assets.hasProfileCard}
      hasHeroBanner={assets.hasHeroBanner}
      shouldShowHeroSection={assets.shouldShowHeroSection}
      setProfileImageError={setProfileImageError}
      setHeroImageError={setHeroImageError}
      onNavigate={handleNavigation}
    />
  );
};