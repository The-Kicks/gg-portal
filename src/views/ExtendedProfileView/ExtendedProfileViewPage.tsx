import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExtendedProfileView } from './ExtendedProfileView';
import { getEntityImage } from '../../core/helpers/getEntityImage';
import type { Theme, BaseEntity, EntityImages, HydratedEntity } from '../../types';

interface Props {
  theme: Theme;
}

export interface PreparedMediaItem {
  file: string;
  type: 'image' | 'video-file' | 'video-embed';
  itemClassKey: 'imageItem' | 'videoItem' | 'horizontalImageItem' | 'verticalVideoItem' | 'tallImageItem';
  isPlaceholder?: boolean;
}

export interface FormattedStatItem {
  key: string;
  label: string;
  displayValue: string;
}

export interface TeammateStructure {
  l4: HydratedEntity;
  l3: BaseEntity[];
}

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

const mapMediaItemToMasonry = (
  file: string,
  mediaDimensions: Record<string, boolean>
): PreparedMediaItem => {
  const mediaType = getMediaType(file);
  let isHorizontal = mediaType !== 'image';
  if (mediaDimensions[file] !== undefined) {
    isHorizontal = mediaDimensions[file];
  }

  if (mediaType === 'video-file' || mediaType === 'video-embed') {
    return {
      file,
      type: mediaType,
      itemClassKey: isHorizontal ? 'videoItem' : 'verticalVideoItem'
    };
  }

  return {
    file,
    type: mediaType,
    itemClassKey: isHorizontal ? 'horizontalImageItem' : 'tallImageItem'
  };
};

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

export const ExtendedProfileViewPage: React.FC<Props> = ({ theme }) => {
  const { id } = useParams<{ id: string }>();
  const [mediaDimensions, setMediaDimensions] = useState<Record<string, boolean>>({});

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

  const assets = useProfileAssetValidator(profileDetails?.targetEntity);

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
          } else {
            const existing = teammatesMap.get(entity.id);
            if (existing && !existing.l3.some(group => group.id === p.id)) {
              existing.l3.push(p);
            }
          }
        }
      });
    });

    const rawTeammates = Array.from(teammatesMap.values());
    const formerTriggerValue = String(theme.layerMetadata?.['l4']?.statusTriggers?.former?.value || 'former').toLowerCase();

    return rawTeammates.map(member => {
      const explicitStatus = String(member.l4?.metadata?.['membershipStatus'] || '').toLowerCase();
      const isFormerTeammate = explicitStatus === 'former' || explicitStatus === formerTriggerValue;

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

  const groupedTeammates = useMemo(() => {
    const groups: Record<string, { groupName: string; members: TeammateStructure[] }> = {};
    
    relatedTeammates.forEach(member => {
      member.l3.forEach(group => {
        if (!groups[group.id]) {
          groups[group.id] = { groupName: group.name, members: [] };
        }
        groups[group.id].members.push(member);
      });
    });
    return groups;
  }, [relatedTeammates]);

  const groupKeys = useMemo(() => {
    return Object.keys(groupedTeammates).sort((a, b) => {
      const groupA = groupedTeammates[a].members[0]?.l3?.find(g => g.id === a);
      const groupB = groupedTeammates[b].members[0]?.l3?.find(g => g.id === b);
      const statusA = (groupA?.status === 'active' || groupA?.metadata?.membershipStatus === 'active') ? 0 : 1;
      const statusB = (groupB?.status === 'active' || groupB?.metadata?.membershipStatus === 'active') ? 0 : 1;
      if (statusA !== statusB) return statusA - statusB;
      return groupA?.name.localeCompare(groupB?.name ?? '') ?? 0;
    });
  }, [groupedTeammates]);

  const sidebarSubLabel = useMemo(() => {
    if (!profileDetails) return '';
    const { parents, activeLayer } = profileDetails;
    return parents.length > 0 ? parents[parents.length - 1].name : (theme.labels[activeLayer] ?? activeLayer);
  }, [profileDetails, theme.labels]);

  const formattedStatistics = useMemo<FormattedStatItem[]>(() => {
    if (!profileDetails?.targetEntity) return [];

    const { targetEntity, activeLayer } = profileDetails;
    const standardExclusions = new Set<string>(['description']);
    const dynamicStatusKeys = new Set<string>();
    const layerMeta = theme.layerMetadata?.[activeLayer];

    if (layerMeta?.statusTriggers && typeof layerMeta.statusTriggers === 'object') {
      Object.values(layerMeta.statusTriggers).forEach((trigger) => {
        if (trigger && typeof trigger === 'object' && 'key' in trigger) {
          const triggerObject = trigger as { key?: unknown };
          if (typeof triggerObject.key === 'string') {
            const rawKey = triggerObject.key.toLowerCase();
            dynamicStatusKeys.add(rawKey);
            dynamicStatusKeys.add(rawKey.split('.')[0]);
          }
        }
      });

      Object.keys(layerMeta.statusTriggers).forEach((triggerKey) => {
        const rawKey = triggerKey.toLowerCase();
        dynamicStatusKeys.add(rawKey);
        dynamicStatusKeys.add(rawKey.split('.')[0]);
      });
    }

    return Object.entries(targetEntity.metadata || {})
      .filter(([key, value]) => {
        const lowerKey = key.toLowerCase();
        if (standardExclusions.has(lowerKey)) return false;
        if (lowerKey.includes('status')) return false;
        if (dynamicStatusKeys.has(lowerKey)) return false;
        return !!value;
      })
      .map(([key, value]) => ({
        key,
        label: theme.labels[key] ?? key,
        displayValue: Array.isArray(value) ? value.join(', ') : String(value)
      }));
  }, [profileDetails, theme.labels, theme.layerMetadata]);

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

      organizedSections[sectionKey] = rawAssetList.map(file =>
        mapMediaItemToMasonry(file, mediaDimensions)
      );
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