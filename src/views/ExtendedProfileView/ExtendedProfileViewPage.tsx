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
 * By default: images are vertical (1 slot), videos are horizontal (2 slots).
 * Once the media loads, 'mediaDimensions' will overwrite this with the real aspect ratio.
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

  // If we already detected the actual dimensions of this file, use that instead
  if (mediaDimensions[file] !== undefined) {
    isHorizontal = mediaDimensions[file]; // true = landscape, false = portrait
  }

  const gridSpanSpaces = isHorizontal ? 2 : 1;
  
  // Assign the correct CSS module class name based on type and shape
  const itemClassKey = (mediaType === 'video-file' || mediaType === 'video-embed')
    ? (isHorizontal ? 'videoItem' : 'imageItem')
    : (isHorizontal ? 'horizontalImageItem' : 'imageItem');

  return { file, type: mediaType, itemClassKey, spanSpaces: gridSpanSpaces };
};

/**
 * Adds beautiful placeholder cards to fill up remaining empty spaces in a 4-column grid row.
 * This keeps the grid lines perfectly straight and aligned.
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

  // Returns the updated counter and how many slots this placeholder consumed (1 or 2)
  return { counter: counter + 1, cost: isHorizontalPlaceholder ? 2 : 1 };
};

// ==========================================================================
// HOOKS
// ==========================================================================

/**
 * Manages image loading errors for the profile picture and banner.
 * If the user switches to a different profile, it resets the error states back to normal.
 */
const useProfileAssetValidator = (targetEntity: BaseEntity | undefined) => {
  const [profileImageError, setProfileImageError] = useState(false);
  const [heroImageError, setHeroImageError] = useState(false);
  const [prevEntityId, setPrevEntityId] = useState(targetEntity?.id);

  // Reset errors automatically if the profile ID changes
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
  // Stores whether a file is landscape (true) or portrait (false) using its URL as the key
  const [mediaDimensions, setMediaDimensions] = useState<Record<string, boolean>>({});

  // 1. Find the current profile entity and calculate its parent hierarchy trail (breadcrumbs)
  const profileDetails = useMemo(() => {
    if (!id || !theme.entities) return null;
    const targetEntity = theme.entities.find(e => e.id === id);
    if (!targetEntity) return null;

    const activeLayer = targetEntity.type as "l1" | "l2" | "l3" | "l4";
    const allConns = [...(targetEntity.connections || []), ...(targetEntity.targetConnections || [])];
    const parentsMap = new Map<string, BaseEntity>();

    // Look through connections to find parent organizations (layers l1, l2, or l3)
    allConns.forEach(conn => {
      const potentialParent = conn.sourceEntity?.id !== id ? conn.sourceEntity : conn.targetEntity;
      if (potentialParent && potentialParent.id !== id) {
        if (['l1', 'l2', 'l3'].includes(potentialParent.type)) {
          parentsMap.set(potentialParent.id, potentialParent);
        }
      }
    });

    // Sort parents by layer type so they show up in order: L1 -> L2 -> L3
    const parents = Array.from(parentsMap.values()).sort((a, b) => a.type.localeCompare(b.type));

    return { targetEntity, activeLayer, parents };
  }, [id, theme.entities]);

  // 2. Validate profile assets (checks if images exist or are broken)
  const assets = useProfileAssetValidator(profileDetails?.targetEntity);

  // 3. Find and process all teammates (L4 entities sharing the same L3 groups)
  const relatedTeammates = useMemo<TeammateStructure[]>(() => {
    if (!profileDetails || !id || !theme.entities) return [];

    const targetEntity = profileDetails.targetEntity;
    const allConns = [...(targetEntity.connections || []), ...(targetEntity.targetConnections || [])];

    // Find all L3 groups that the current active profile belongs to
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

    // Scan all entities to find other L4 players that belong to these same L3 groups
    theme.entities.forEach(entity => {
      if (entity.type !== 'l4') return;

      const entityConns = [...(entity.connections || []), ...(entity.targetConnections || [])];

      entityConns.forEach(conn => {
        const p = conn.sourceEntity?.type === 'l3'
          ? conn.sourceEntity
          : (conn.targetEntity?.type === 'l3' ? conn.targetEntity : null);

        // If this player shares one of our active parent groups, add them as a teammate
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

    // Filter status keywords to flag former/retired members vs active ones
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

  // 4. Group the processed teammates by their L3 Group ID for UI sectioning
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

  // 5. Sort the group headers so active teams show up first, followed by alphabetical order
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

  // 6. Generate text label for the sticky sidebar header (usually the closest parent name)
  const sidebarSubLabel = useMemo(() => {
    if (!profileDetails) return '';
    const { parents, activeLayer } = profileDetails;
    return parents.length > 0 ? parents[parents.length - 1].name : (theme.labels[activeLayer] ?? activeLayer);
  }, [profileDetails, theme.labels]);

  // 7. Clean up metadata attributes into a displayable list of stats, ignoring descriptions/status fields
  const formattedStatistics = useMemo<FormattedStatItem[]>(() => {
    if (!profileDetails?.targetEntity) return [];
    return Object.entries(profileDetails.targetEntity.metadata || {})
      .filter(([key, value]) => key !== 'description' && key !== 'status' && key !== 'membershipStatus' && !!value)
      .map(([key, value]) => ({
        key,
        label: theme.labels[key] ?? key,
        displayValue: Array.isArray(value) ? value.join(', ') : String(value)
      }));
  }, [profileDetails, theme.labels]);

  // 8. Tetris-Style layout logic: Processes media lists into neat rows of 4 columns
  const preparedMediaSections = useMemo(() => {
    const entityImages = profileDetails?.targetEntity.image as EntityImages | undefined;
    if (!profileDetails?.targetEntity || !entityImages) return {};

    const organizedSections: Record<string, PreparedMediaItem[]> = {};
    const galleryKeys = Object.keys(entityImages).filter(k => k !== 'profileCard' && k !== 'heroBanner');

    galleryKeys.forEach(sectionKey => {
      const sectionAssets = entityImages[sectionKey];
      if (!sectionAssets) return;

      let rawAssetList: string[] = [];

      // Accept both modern string arrays or legacy text blocks split by enters/spaces
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

      // Loop until all media items are placed and the final row has no empty holes
      while (unplacedMediaPool.length > 0 || totalAssignedSpaces % 4 !== 0) {
        const spacesLeftOnCurrentLine = 4 - (totalAssignedSpaces % 4);
        
        // Find an item that fits perfectly in the remaining columns of this row
        const optimalMatchIndex = unplacedMediaPool.findIndex(item => item.spanSpaces <= spacesLeftOnCurrentLine);

        if (unplacedMediaPool.length > 0 && optimalMatchIndex !== -1) {
          const matchedItem = unplacedMediaPool.splice(optimalMatchIndex, 1)[0];
          structuredRowItems.push({ file: matchedItem.file, type: matchedItem.type, itemClassKey: matchedItem.itemClassKey });
          totalAssignedSpaces += matchedItem.spanSpaces;
        } else {
          // If no item fits, fill the gap with a beautifully customized placeholder card
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