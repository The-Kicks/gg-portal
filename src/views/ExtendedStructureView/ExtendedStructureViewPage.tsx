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

const extractYearDecimal = (dateStr?: string): number => {
  if (!dateStr) return new Date().getFullYear();
  
  const parts = dateStr.split('-');
  
  if (parts.length >= 2) {
    const monthStr = parts.length === 3 ? parts[1] : parts[0];
    const yearStr = parts.length === 3 ? parts[2] : parts[1];
    
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    
    if (!isNaN(month) && !isNaN(year)) {
      return year + (Math.max(0, Math.min(11, month - 1)) / 12);
    }
  }

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
          const connectionMeta = conn.metadata as {
            status?: string;
            membershipStatus?: string;
            startDate?: string;
            joinedDate?: string;
            endDate?: string;
            leftDate?: string;
          } | undefined;

          const relStatus = String(connectionMeta?.status || connectionMeta?.membershipStatus || 'active').toLowerCase().trim();
          const extractedStartDate = connectionMeta?.startDate || connectionMeta?.joinedDate || '';
          const extractedEndDate = connectionMeta?.endDate || connectionMeta?.leftDate || '';

          rawMemberConnections.push({
            memberId: other.id,
            startDate: extractedStartDate,
            endDate: extractedEndDate,
            status: relStatus
          });

          const existingEntityMeta = (other.metadata || {}) as Record<string, unknown>;

          relatedL4sMap.set(other.id, {
            ...other,
            metadata: {
              ...existingEntityMeta,
              startDate: extractedStartDate,
              endDate: extractedEndDate,
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

  // --- MEMBER TIMELINE DATA GENERATOR ---
  const memberTimelineData = useMemo(() => {
    if (!structureData || structureData.activeLayer !== 'l3' || structureData.relatedL4s.length === 0) {
      return null;
    }

    const currentYear = new Date().getFullYear(); 
    const currentMonth = new Date().getMonth(); 
    const currentYearDecimal = currentYear + (currentMonth / 12);

    const rows = structureData.relatedL4s.map(member => {
      const connectionMeta = structureData.rawMemberConnections.find(c => c.memberId === member.id);
      const entityImages = member.image as EntityImages | undefined;
      const imgUrl = entityImages ? getEntityImage(entityImages, 'profileCard') : '';

      const startYearDecimal = extractYearDecimal(connectionMeta?.startDate);
      
      const normalizedStatus = String(connectionMeta?.status || 'active').toLowerCase().trim();
      const isFormer = ['former', 'left', 'past', 'inactive'].includes(normalizedStatus);
      
      const endYearDecimal = isFormer 
        ? (connectionMeta?.endDate ? extractYearDecimal(connectionMeta.endDate) : startYearDecimal)
        : currentYearDecimal;

      return {
        memberId: member.id,
        memberName: member.name,
        memberImage: imgUrl || '/placeholder.png',
        startDate: connectionMeta?.startDate || '',
        endDate: connectionMeta?.endDate || '',
        status: normalizedStatus,
        startYear: Math.min(startYearDecimal, currentYearDecimal),
        endYear: Math.min(endYearDecimal, currentYearDecimal)
      };
    });

   // Haal de ruwe decimale start- en eindpunten op
    const startYearsFloored = rows.map(r => Math.floor(r.startYear));
    const rawEndYears = rows.map(r => r.endYear);

    // Bepaal de minimale startkant (altijd naar beneden afgerond op hele jaren)
    const minYear = startYearsFloored.length > 0 ? Math.min(...startYearsFloored) : currentYear;
    
    // Bepaal de maximale eindkant op basis van de hoogste waarde in de dataset
    const maxRawYear = rawEndYears.length > 0 ? Math.max(...rawEndYears) : currentYear;
    
    // UPGRADE: Als de hoogste waarde vlak na de grens van een nieuw jaar ligt (bijv. januari = 2023.03),
    // dan willen we het VORIGE jaar (2022) als maximale grens instellen. 
    // De view maakt hier dan 2022 + 1 = 2023 van, waardoor de balk perfect aan het begin van 2023 stopt.
    let maxYear = Math.floor(maxRawYear);
    const decimalPart = maxRawYear - maxYear;

    if (decimalPart > 0 && decimalPart < 0.09) { 
      // Datum valt vroeg in januari, verlaag de grens met een jaar zodat het niet doorschiet
      maxYear = maxYear - 1;
    }

    if (minYear > maxYear) maxYear = minYear;

    return {
      rows,
      minYear,
      maxYear: Math.min(maxYear, currentYear)
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

  const formattedStatistics = useMemo<FormattedStatItem[]>(() => {
    if (!structureData?.targetEntity?.metadata) return [];
    return Object.entries(structureData.targetEntity.metadata)
      .filter(([key, value]) => {
        if (key === 'description' || key === 'status' || key === 'membershipStatus' || !value) return false;

        if (Array.isArray(value)) {
          return value.length > 0 && typeof value[0] !== 'object';
        }

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
      memberTimeline={memberTimelineData}
    />
  );
};