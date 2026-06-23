import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExtendedStructureView } from './ExtendedStructureView';
import { getEntityImage } from '../../core/helpers/getEntityImage';
import type { Theme, BaseEntity, EntityImages, HydratedEntity } from '../../types';

interface Props {
  theme: Theme;
}

export interface PreparedMediaItem {
  file: string;
  type: 'image' | 'video-file' | 'video-embed';
  itemClassKey: 'imageItem' | 'videoItem' | 'horizontalImageItem';
  isPlaceholder?: boolean;
}

export interface FormattedStatItem {
  key: string;
  label: string;
  displayValue: string;
}

export interface MemberTimelineRow {
  memberId: string;
  memberName: string;
  memberImage: string;
  startDate: string;
  endDate: string;
  status: string;
  startYear: number;
  endYear: number;
}

// ==========================================================================
// PURE UTILITY FUNCTIONS (Data Translators)
// ==========================================================================
const getMediaType = (file: string): 'image' | 'video-file' | 'video-embed' => {
  const lowerCaseFile = file.toLowerCase();
  if (lowerCaseFile.includes('youtube.com') || lowerCaseFile.includes('youtu.be')) return 'video-embed';
  if (lowerCaseFile.endsWith('.mp4') || lowerCaseFile.endsWith('.webm')) return 'video-file';
  return 'image';
};

const isStringValid = (url: string): boolean => {
  const cleaned = url.trim().toLowerCase();
  return cleaned !== "" && cleaned !== "/placeholder.png" && cleaned !== "placeholder.png";
};

const mapMediaItemToGridSpace = (
  file: string,
  mediaDimensions: Record<string, boolean>
): {
  file: string;
  type: 'image' | 'video-file' | 'video-embed';
  itemClassKey: 'videoItem' | 'horizontalImageItem' | 'imageItem';
  spanSpaces: number;
} => {
  const mediaType = getMediaType(file);
  const defaultIsHorizontal = mediaType !== 'image';
  let isHorizontal = defaultIsHorizontal;

  if (mediaDimensions[file] !== undefined) {
    isHorizontal = mediaDimensions[file];
  }

  const gridSpanSpaces = isHorizontal ? 2 : 1;

  const itemClassKey = (mediaType === 'video-file' || mediaType === 'video-embed')
    ? (isHorizontal ? 'videoItem' : 'imageItem')
    : (isHorizontal ? 'horizontalImageItem' : 'imageItem');

  return { file, type: mediaType, itemClassKey, spanSpaces: gridSpanSpaces };
};

const fillRowGapsWithPlaceholders = (
  structuredRowItems: PreparedMediaItem[],
  totalAssignedSpaces: number,
  sectionKey: string,
  counter: number
): { counter: number; cost: number } => {
  const spacesLeftOnCurrentLine = 4 - (totalAssignedSpaces % 4);
  const isHorizontalPlaceholder = spacesLeftOnCurrentLine >= 2;

  structuredRowItems.push({
    file: `placeholder-${sectionKey}-${counter}`,
    type: 'image',
    itemClassKey: isHorizontalPlaceholder ? 'horizontalImageItem' : 'imageItem',
    isPlaceholder: true
  });

  return { counter: counter + 1, cost: isHorizontalPlaceholder ? 2 : 1 };
};

// Helper om een jaartal veilig uit een string te extraheren
const extractYear = (dateStr?: string): number => {
  if (!dateStr) return new Date().getFullYear();
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
};

// ==========================================================================
// MAIN CONTROLLER COMPONENT
// ==========================================================================
export const ExtendedStructureViewPage: React.FC<Props> = ({ theme }) => {
  const { id, themeName } = useParams<{ id: string; themeName: string }>();
  const navigate = useNavigate();

  const [mediaDimensions, setMediaDimensions] = useState<Record<string, boolean>>({});
  const [profileImageError, setProfileImageError] = useState(false);
  const [heroImageError, setHeroImageError] = useState(false);

  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setProfileImageError(false);
    setHeroImageError(false);
  }

  // --- TRAVERSAL CONTROLLER ---
  const structureData = useMemo(() => {
    if (!id || !theme.entities) return null;

    const targetEntity = theme.entities.find((e) => e.id === id || e.name === id);
    if (!targetEntity) return null;

    const activeLayer = targetEntity.type as "l1" | "l2" | "l3" | "l4";

    const l1ParentsMap = new Map<string, BaseEntity>();
    const l2ParentsMap = new Map<string, BaseEntity>();

    const relatedL2sMap = new Map<string, BaseEntity>();
    const relatedL3sMap = new Map<string, BaseEntity>();
    const relatedL4sMap = new Map<string, BaseEntity>();

    // Array om de ruwe connectie metadata te bewaren voor de l3 tijdlijn
    const rawMemberConnections: Array<{ memberId: string; startDate?: string; endDate?: string; status?: string }> = [];

    const getConnections = (ent: HydratedEntity) => [
      ...(ent.connections || []),
      ...(ent.targetConnections || []),
    ];

    if (activeLayer === 'l3') {
      getConnections(targetEntity).forEach((conn) => {
        const other = conn.sourceEntity?.id === targetEntity.id ? conn.targetEntity : conn.sourceEntity;
        if (!other) return;

        if (other.type === 'l2') l2ParentsMap.set(other.id, other);
        if (other.type === 'l1') l1ParentsMap.set(other.id, other);

        if (other.type === 'l4') {
          const relStatus = String(conn.metadata?.status || conn.metadata?.membershipStatus || 'active').toLowerCase().trim();

          // Definieer lokaal de verwachte structuur van de connectie-metadata
          const connectionMeta = conn.metadata as {
            startDate?: string;
            joinedDate?: string;
            endDate?: string;
            leftDate?: string;
          } | undefined;

          rawMemberConnections.push({
            memberId: other.id,
            startDate: connectionMeta?.startDate || connectionMeta?.joinedDate,
            endDate: connectionMeta?.endDate || connectionMeta?.leftDate,
            status: relStatus
          });

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
    else if (activeLayer === 'l2') {
      getConnections(targetEntity).forEach((conn) => {
        const other = conn.sourceEntity?.id === targetEntity.id ? conn.targetEntity : conn.sourceEntity;
        if (!other) return;

        if (other.type === 'l1') l1ParentsMap.set(other.id, other);
        if (other.type === 'l3') relatedL3sMap.set(other.id, other);
      });

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
    else if (activeLayer === 'l1') {
      getConnections(targetEntity).forEach((conn) => {
        const other = conn.sourceEntity?.id === targetEntity.id ? conn.targetEntity : conn.sourceEntity;
        if (!other) return;

        if (other.type === 'l2') relatedL2sMap.set(other.id, other);
        if (other.type === 'l3') relatedL3sMap.set(other.id, other);
      });

      relatedL2sMap.forEach((l2Agency) => {
        const fullL2 = theme.entities!.find((e) => e.id === l2Agency.id);
        if (fullL2) {
          getConnections(fullL2).forEach((conn) => {
            const other = conn.sourceEntity?.id === fullL2.id ? conn.targetEntity : conn.sourceEntity;
            if (other && other.type === 'l3') relatedL3sMap.set(other.id, other);
          });
        }
      });

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

    const parents: BaseEntity[] = [];
    const absoluteL1 = Array.from(l1ParentsMap.values())[0];
    const absoluteL2 = Array.from(l2ParentsMap.values())[0];

    if (absoluteL1) parents.push(absoluteL1);
    if (absoluteL2 && absoluteL2.id !== absoluteL1?.id) parents.push(absoluteL2);

    return {
      targetEntity,
      activeLayer,
      parents,
      rawMemberConnections,
      relatedL2s: Array.from(relatedL2sMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      relatedL3s: Array.from(relatedL3sMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      relatedL4s: Array.from(relatedL4sMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [id, theme.entities]);

  // --- MEMBER TIMELINE DATA GENERATOR (Alleen voor L3) ---
const memberTimelineData = useMemo(() => {
  if (!structureData || structureData.activeLayer !== 'l3' || structureData.relatedL4s.length === 0) {
    return null;
  }

  const currentYear = new Date().getFullYear(); // Dit is 2026

  const rows: MemberTimelineRow[] = structureData.relatedL4s.map(member => {
    const connectionMeta = structureData.rawMemberConnections.find(c => c.memberId === member.id);
    const entityImages = member.image as EntityImages | undefined;
    const imgUrl = entityImages ? getEntityImage(entityImages, 'profileCard') : '';

    const extractedStart = extractYear(connectionMeta?.startDate);
    // Als de startdatum onbekend of ongeldig is, pakken we het huidige jaar als fallback
    const startYear = (extractedStart && !isNaN(extractedStart)) ? extractedStart : currentYear;

    const isFormer = connectionMeta?.status === 'former' || connectionMeta?.status === 'left';
    const extractedEnd = connectionMeta?.endDate ? extractYear(connectionMeta.endDate) : null;
    
    // Als iemand weg is maar we hebben geen jaartal, fallback naar startYear of currentYear. 
    // Als iemand nog actief is, stoppen we de balk strak op het huidige jaar (2026).
    const endYear = isFormer 
      ? ((extractedEnd && !isNaN(extractedEnd)) ? extractedEnd : currentYear)
      : currentYear;

    return {
      memberId: member.id,
      memberName: member.name,
      memberImage: imgUrl || '/placeholder.png',
      startDate: connectionMeta?.startDate || '',
      endDate: connectionMeta?.endDate || '',
      status: connectionMeta?.status || 'active',
      startYear: Math.min(startYear, currentYear), // Voorkom dat start in de toekomst ligt
      endYear: Math.min(endYear, currentYear)      // Harde cap: actieve leden gaan nooit voorbij 2026
    };
  });

  // Haal alle geldige jaartallen op
  const startYears = rows.map(r => r.startYear);
  const endYears = rows.map(r => r.endYear);

  const minYear = startYears.length > 0 ? Math.min(...startYears) : currentYear;
  let maxYear = endYears.length > 0 ? Math.max(...endYears) : currentYear;

  // Als alles binnen hetzelfde jaar valt (bijv. alles gestart in 2026),
  // dan zetten we min en max gelijk, zodat de CSS grid 100% van dat jaar vult 
  // zonder loze margejaren ervoor of erna te creëren.
  if (minYear > maxYear) {
    maxYear = minYear;
  }

  return {
    rows,
    minYear,
    maxYear: Math.min(maxYear, currentYear) // Extra veiligheidsgordel tegen spookjaren in de toekomst
  };
}, [structureData]);

  // --- ROUTING CONTROL ---
  const handleNavigation = useCallback((targetId: string, layer: "l1" | "l2" | "l3" | "l4") => {
    const isL4 = layer === 'l4';
    const isL3AsProfile = (layer === 'l3' && structureData?.relatedL4s.length === 0 && structureData?.activeLayer === 'l2');
    const targetView = (isL4 || isL3AsProfile) ? 'profile' : 'structure';
    navigate(`/${themeName}/${targetView}/${targetId}`);
  }, [navigate, themeName, structureData]);

  // --- TETRIS-STYLE MEDIA GENERATOR ---
  const preparedMediaSections = useMemo(() => {
    const entityImages = structureData?.targetEntity.image as EntityImages | undefined;
    if (!structureData?.targetEntity || !entityImages) return {};

    const organizedSections: Record<string, PreparedMediaItem[]> = {};
    const galleryKeys = Object.keys(entityImages).filter(k => k !== 'profileCard' && k !== 'heroBanner');

    galleryKeys.forEach(sectionKey => {
      const sectionAssets = entityImages[sectionKey];
      if (!sectionAssets) return;

      let rawAssetList: string[] = [];
      if (Array.isArray(sectionAssets)) {
        rawAssetList = sectionAssets.filter(Boolean) as string[];
      } else if (typeof sectionAssets === 'string') {
        rawAssetList = sectionAssets.split(/\s+/).map(file => file.trim()).filter(Boolean);
      }

      if (rawAssetList.length === 0) return;

      const unplacedMediaPool = rawAssetList.map(file => mapMediaItemToGridSpace(file, mediaDimensions));
      const structuredRowItems: PreparedMediaItem[] = [];
      let placeholderCounter = 0;
      let totalAssignedSpaces = 0;

      while (unplacedMediaPool.length > 0 || totalAssignedSpaces % 4 !== 0) {
        const spacesLeftOnCurrentLine = 4 - (totalAssignedSpaces % 4);
        const optimalMatchIndex = unplacedMediaPool.findIndex(item => item.spanSpaces <= spacesLeftOnCurrentLine);

        if (unplacedMediaPool.length > 0 && optimalMatchIndex !== -1) {
          const matchedItem = unplacedMediaPool.splice(optimalMatchIndex, 1)[0];
          structuredRowItems.push({ file: matchedItem.file, type: matchedItem.type, itemClassKey: matchedItem.itemClassKey });
          totalAssignedSpaces += matchedItem.spanSpaces;
        } else {
          const res = fillRowGapsWithPlaceholders(structuredRowItems, totalAssignedSpaces, sectionKey, placeholderCounter);
          placeholderCounter = res.counter;
          totalAssignedSpaces += res.cost;
        }
      }
      organizedSections[sectionKey] = structuredRowItems;
    });

    return organizedSections;
  }, [structureData, mediaDimensions]);

  const assets = useMemo(() => {
    if (!structureData?.targetEntity) return null;
    const entityImages = structureData.targetEntity.image as EntityImages | undefined;
    const profileCardImageUrl = entityImages ? getEntityImage(entityImages, 'profileCard') : '';
    const heroBannerImageUrl = entityImages ? getEntityImage(entityImages, 'heroBanner') : '';

    const hasProfileCard = isStringValid(profileCardImageUrl) && !profileImageError;
    const hasHeroBanner = isStringValid(heroBannerImageUrl) && !heroImageError;
    const shouldShowHeroSection = hasProfileCard || hasHeroBanner;

    return { profileCardImageUrl, heroBannerImageUrl, hasProfileCard, hasHeroBanner, shouldShowHeroSection };
  }, [structureData, profileImageError, heroImageError]);

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

  // Gecorrigeerde Statsbox Filter: Alleen primitieve types (geen objecten of arrays met objecten) toelaten
  const formattedStatistics = useMemo<FormattedStatItem[]>(() => {
    if (!structureData?.targetEntity?.metadata) return [];
    return Object.entries(structureData.targetEntity.metadata)
      .filter(([key, value]) => {
        if (key === 'description' || key === 'status' || key === 'membershipStatus' || !value) return false;

        // Als het een array is, controleer of de elementen strings of nummers zijn (geen object-relaties)
        if (Array.isArray(value)) {
          return value.length > 0 && typeof value[0] !== 'object';
        }

        // Mag absoluut geen object zijn
        return typeof value !== 'object';
      })
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
      mediaSections={preparedMediaSections}
      sidebarSubLabel={sidebarSubLabel}
      formattedStatistics={formattedStatistics}
      profileCardImageUrl={assets.profileCardImageUrl}
      heroBannerImageUrl={assets.heroBannerImageUrl}
      hasProfileCard={assets.hasProfileCard}
      hasHeroBanner={assets.hasHeroBanner}
      shouldShowHeroSection={assets.shouldShowHeroSection}
      mediaDimensions={mediaDimensions}
      setMediaDimensions={setMediaDimensions}
      setProfileImageError={setProfileImageError}
      setHeroImageError={setHeroImageError}
      onNavigate={handleNavigation}
      memberTimeline={memberTimelineData} // Doorgeven aan de view component
    />
  );
};