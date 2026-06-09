import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExtendedProfileView } from './ExtendedProfileView';
import { getEntityImage } from '../../core/helpers/getEntityImage';
import type { Theme, BaseEntity, EntityImages, HydratedEntity } from '../../types';

interface Props {
  theme: Theme;
}

// Represents a media item (image/video) that is ready to be rendered in the grid
export interface PreparedMediaItem {
  file: string;
  type: 'image' | 'video-file' | 'video-embed';
  itemClassKey: 'imageItem' | 'videoItem' | 'horizontalImageItem';
  isPlaceholder?: boolean;
}

// Represents a single statistic row in the sidebar (e.g., Age: 25)
export interface FormattedStatItem {
  key: string;
  label: string;
  displayValue: string;
}

// Structure to group team members under their respective organization or group
export interface TeammateStructure {
  l4: HydratedEntity;
  l3: BaseEntity[];
}

// ==========================================================================
// PURE UTILITY FUNCTIONS (Data Translators)
// ==========================================================================

/**
 * Checks the file URL or extension to determine if it's a YouTube video, a direct video file, or an image.
 */
const getMediaType = (file: string): 'image' | 'video-file' | 'video-embed' => {
  const lowerCaseFile = file.toLowerCase();
  if (lowerCaseFile.includes('youtube.com') || lowerCaseFile.includes('youtu.be')) return 'video-embed';
  if (lowerCaseFile.endsWith('.mp4') || lowerCaseFile.endsWith('.webm')) return 'video-file';
  return 'image';
};

/**
 * Ensures a string contains a valid image path and is not just a default placeholder name.
 */
const isStringValid = (url: string): boolean => {
  const cleaned = url.trim().toLowerCase();
  return cleaned !== "" && cleaned !== "/placeholder.png" && cleaned !== "placeholder.png";
};

/**
 * Decides how much grid space a media item needs based on its type and loaded dimensions.
 */
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

/**
 * Adds beautiful placeholder cards to fill up remaining empty spaces in a 4-column grid row.
 */
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

// ==========================================================================
// HOOKS
// ==========================================================================

const useProfileAssetValidator = (targetEntity: BaseEntity | undefined) => {
  const [profileImageError, setProfileImageError] = useState(false);
  const [heroImageError, setHeroImageError] = useState(false);
  const [prevEntityId, setPrevEntityId] = useState(targetEntity?.id);

  if (targetEntity?.id !== prevEntityId) {
    setPrevEntityId(targetEntity?.id);
    setProfileImageError(false);
    setHeroImageError(false);
  }

  return useMemo(() => {
    const entityImages = targetEntity?.image as EntityImages | undefined;
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
      setProfileImageError,
      setHeroImageError
    };
  }, [targetEntity, profileImageError, heroImageError]);
};

// ==========================================================================
// MAIN COMPONENT
// ==========================================================================

export const ExtendedProfileViewPage: React.FC<Props> = ({ theme }) => {
  const { id } = useParams<{ id: string }>();
  const [mediaDimensions, setMediaDimensions] = useState<Record<string, boolean>>({});

  // 1. Find the current profile entity and calculate its parent hierarchy trail
  const profileDetails = useMemo(() => {
    if (!id || !theme.entities) return null;
    const targetEntity = theme.entities.find(e => e.id === id);
    if (!targetEntity) return null;

    const activeLayer = targetEntity.type as "l1" | "l2" | "l3" | "l4";
    const allConns = [...(targetEntity.connections || []), ...(targetEntity.targetConnections || [])];
    const parentsMap = new Map<string, BaseEntity>();

    allConns.forEach(conn => {
      const potentialParent = conn.sourceEntity?.id !== id ? conn.sourceEntity : conn.targetEntity;
      if (potentialParent && potentialParent.id !== id) {
        if (['l1', 'l2', 'l3'].includes(potentialParent.type)) {
          parentsMap.set(potentialParent.id, potentialParent);
        }
      }
    });

    const parents = Array.from(parentsMap.values()).sort((a, b) => a.type.localeCompare(b.type));

    return { targetEntity, activeLayer, parents };
  }, [id, theme.entities]);

  // 2. Validate profile assets
  const assets = useProfileAssetValidator(profileDetails?.targetEntity);

  // 3. Find and process all teammates
  const relatedTeammates = useMemo<TeammateStructure[]>(() => {
    if (!profileDetails || !id || !theme.entities) return [];

    const targetEntity = profileDetails.targetEntity;
    const allConns = [...(targetEntity.connections || []), ...(targetEntity.targetConnections || [])];

    const parentL3s: BaseEntity[] = [];
    allConns.forEach(conn => {
      const parent = conn.sourceEntity?.type === 'l3'
        ? conn.sourceEntity
        : (conn.targetEntity?.type === 'l3' ? conn.targetEntity : null);
      if (parent && !parentL3s.some(p => p.id === parent.id)) {
        parentL3s.push(parent);
      }
    });

    const teammatesMap = new Map<string, TeammateStructure>();

    theme.entities.forEach(entity => {
      if (entity.type !== 'l4') return;

      const entityConns = [...(entity.connections || []), ...(entity.targetConnections || [])];

      entityConns.forEach(conn => {
        const p = conn.sourceEntity?.type === 'l3'
          ? conn.sourceEntity
          : (conn.targetEntity?.type === 'l3' ? conn.targetEntity : null);

        if (p && parentL3s.some(parentL3 => parentL3.id === p.id)) {
          const membershipStatus = conn.metadata?.status || 'active';

          if (!teammatesMap.has(entity.id)) {
            const enrichedEntity: HydratedEntity = {
              ...entity,
              metadata: {
                ...entity.metadata,
                membershipStatus
              }
            };
            teammatesMap.set(entity.id, { l4: enrichedEntity, l3: [p] });
          }
        }
      });
    });

    const rawTeammates = Array.from(teammatesMap.values());
    const STANDALONE_KEYWORDS = ['soloist', 'retired', 'free agent', 'independent', 'solo', 'none'];
    const badgeKey = theme.layerMetadata?.['l4']?.badgeKey;

    return rawTeammates.map(member => {
      const explicitStatus = String(member.l4?.metadata?.['membershipStatus'] || '').toLowerCase();
      const badgeValue = badgeKey ? String(member.l4?.metadata?.[badgeKey] || '').toLowerCase() : '';

      const isFormerTeammate =
        explicitStatus === 'former' ||
        STANDALONE_KEYWORDS.includes(badgeValue) ||
        !!member.l4?.isStandalone;

      return {
        ...member,
        l4: {
          ...member.l4,
          metadata: {
            ...(member.l4.metadata || {}),
            groupStatus: isFormerTeammate ? 'former' : 'active'
          }
        }
      };
    });
  }, [id, profileDetails, theme.entities, theme.layerMetadata]);

  // 4. Group the processed teammates by their L3 Group ID
  const groupedTeammates = useMemo(() => {
    const groups: Record<string, { groupName: string; members: TeammateStructure[] }> = {};
    relatedTeammates.forEach(member => {
      const group = member.l3?.[0];
      if (!group) return;
      if (!groups[group.id]) {
        groups[group.id] = { groupName: group.name, members: [] };
      }
      groups[group.id].members.push(member);
    });
    return groups;
  }, [relatedTeammates]);

  // 5. Sort the group headers
  const groupKeys = useMemo(() => {
    return Object.keys(groupedTeammates).sort((a, b) => {
      const groupA = groupedTeammates[a].members[0].l3?.[0];
      const groupB = groupedTeammates[b].members[0].l3?.[0];
      const statusA = (groupA?.status === 'active' || groupA?.metadata?.membershipStatus === 'active') ? 0 : 1;
      const statusB = (groupB?.status === 'active' || groupB?.metadata?.membershipStatus === 'active') ? 0 : 1;
      if (statusA !== statusB) return statusA - statusB;
      return groupA?.name.localeCompare(groupB?.name ?? '') ?? 0;
    });
  }, [groupedTeammates]);

  // 6. Generate text label for the sticky sidebar header
  const sidebarSubLabel = useMemo(() => {
    if (!profileDetails) return '';
    const { parents, activeLayer } = profileDetails;
    return parents.length > 0 ? parents[parents.length - 1].name : (theme.labels[activeLayer] ?? activeLayer);
  }, [profileDetails, theme.labels]);

  // 7. Clean up metadata attributes into a displayable list of stats, UNIVERSALLY ignoring any status fields
  const formattedStatistics = useMemo<FormattedStatItem[]>(() => {
    if (!profileDetails?.targetEntity) return [];

    const { targetEntity, activeLayer } = profileDetails;

    // Alleen velden die géén status zijn, maar wel altijd verborgen moeten blijven
    const standardExclusions = new Set<string>(['description']);

    // Verzamel dynamisch alle keys die dit specifieke thema gebruikt voor status-triggers
    const dynamicStatusKeys = new Set<string>();
    const layerMeta = theme.layerMetadata?.[activeLayer];

    if (layerMeta?.statusTriggers && typeof layerMeta.statusTriggers === 'object') {
      // 1. Check de waarden binnen de triggers (bijv. { trigger1: { key: 'clubStatus.member' } })
      Object.values(layerMeta.statusTriggers).forEach((trigger) => {
        if (trigger && typeof trigger === 'object' && 'key' in trigger) {
          const triggerObject = trigger as { key?: unknown };
          if (typeof triggerObject.key === 'string') {
            const rawKey = triggerObject.key.toLowerCase();
            dynamicStatusKeys.add(rawKey);
            dynamicStatusKeys.add(rawKey.split('.')[0]); // Vangt ook de root 'clubstatus' op
          }
        }
      });

      // 2. Check de keys van de triggers zelf (voor het geval de structuur inline is: { 'clubStatus.member': {...} })
      Object.keys(layerMeta.statusTriggers).forEach((triggerKey) => {
        const rawKey = triggerKey.toLowerCase();
        dynamicStatusKeys.add(rawKey);
        dynamicStatusKeys.add(rawKey.split('.')[0]);
      });
    }

    return Object.entries(targetEntity.metadata || {})
      .filter(([key, value]) => {
        const lowerKey = key.toLowerCase();

        // Regel 1: Is het een standaard verborgen veld (zoals description)? -> Weg ermee.
        if (standardExclusions.has(lowerKey)) return false;

        // Regel 2: Zit het woord 'status' in de key? -> Direct weggooien.
        // Dit vangt 'clubStatus.member', 'racingStatus', 'status', etc. universeel af.
        if (lowerKey.includes('status')) return false;

        // Regel 3: Is dit veld in het thema gekoppeld aan een status-trigger? -> Weg ermee.
        if (dynamicStatusKeys.has(lowerKey)) return false;

        // Alleen doorlaten als het veld een waarde heeft
        return !!value;
      })
      .map(([key, value]) => ({
        key,
        label: theme.labels[key] ?? key,
        displayValue: Array.isArray(value) ? value.join(', ') : String(value)
      }));
  }, [profileDetails, theme.labels, theme.layerMetadata]);

  // 8. Tetris-Style layout logic
  const preparedMediaSections = useMemo(() => {
    const entityImages = profileDetails?.targetEntity.image as EntityImages | undefined;
    if (!profileDetails?.targetEntity || !entityImages) return {};

    const organizedSections: Record<string, PreparedMediaItem[]> = {};
    const galleryKeys = Object.keys(entityImages).filter(k => k !== 'profileCard' && k !== 'heroBanner');

    galleryKeys.forEach(sectionKey => {
      const sectionAssets = entityImages[sectionKey];
      if (!sectionAssets) return;

      let rawAssetList: string[] = [];

      if (Array.isArray(sectionAssets)) {
        rawAssetList = sectionAssets.filter(Boolean) as string[];
      } else if (typeof sectionAssets === 'string') {
        rawAssetList = sectionAssets
          .split(/\s+/)
          .map(file => file.trim())
          .filter(Boolean);
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
  }, [profileDetails, mediaDimensions]);

  if (!profileDetails) {
    return <div style={{ color: 'var(--text)', padding: '100px', textAlign: 'center' }}>Entity not found</div>;
  }

  return (
    <ExtendedProfileView
      key={profileDetails.targetEntity.id}
      entity={profileDetails.targetEntity}
      activeLayer={profileDetails.activeLayer}
      parents={profileDetails.parents}
      theme={theme}
      mediaSections={preparedMediaSections}
      sidebarSubLabel={sidebarSubLabel}
      formattedStatistics={formattedStatistics}
      mediaDimensions={mediaDimensions}
      setMediaDimensions={setMediaDimensions}
      groupedTeammates={groupedTeammates}
      groupKeys={groupKeys}
      {...assets}
    />
  );
};