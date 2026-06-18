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

export interface TimelineMilestone {
  date: string;
  title: string;
}

export interface TimelineItem {
  id: string;
  groupName: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  milestones?: TimelineMilestone[];
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

  const layerMetadataConfig = useMemo(() => {
    if (!theme.layerMetadata) return null;
    try {
      return typeof theme.layerMetadata === 'string'
        ? JSON.parse(theme.layerMetadata)
        : theme.layerMetadata;
    } catch {
      return null;
    }
  }, [theme.layerMetadata]);

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

  const groupedTeammates = useMemo(() => {
    const groups: Record<string, { groupName: string; members: TeammateStructure[] }> = {};
    if (!profileDetails || !id || !theme.entities) return groups;

    const targetEntity = profileDetails.targetEntity;
    const allConns = [...(targetEntity.connections || []), ...(targetEntity.targetConnections || [])];

    const parentL3s = new Map<string, BaseEntity>();
    allConns.forEach(conn => {
      const parent = conn.sourceEntity?.type === 'l3'
        ? conn.sourceEntity
        : (conn.targetEntity?.type === 'l3' ? conn.targetEntity : null);
      if (parent) {
        parentL3s.set(parent.id, parent);
      }
    });

    const formerTriggerValue = String(layerMetadataConfig?.['l4']?.statusTriggers?.former?.value || 'former').toLowerCase();

    theme.entities.forEach(entity => {
      if (entity.type !== 'l4') return;

      const entityConns = [...(entity.connections || []), ...(entity.targetConnections || [])];

      entityConns.forEach(conn => {
        const p = conn.sourceEntity?.type === 'l3'
          ? conn.sourceEntity
          : (conn.targetEntity?.type === 'l3' ? conn.targetEntity : null);

        if (p && parentL3s.has(p.id)) {
          const membershipStatus = String(conn.metadata?.status || 'active').toLowerCase();
          const isFormerTeammate = ['former', 'retired', 'ex', 'disbanded', formerTriggerValue].includes(membershipStatus);

          if (!groups[p.id]) {
            groups[p.id] = { groupName: p.name, members: [] };
          }

          if (!groups[p.id].members.some(m => m.l4.id === entity.id)) {
            const enrichedEntity: HydratedEntity = {
              ...entity,
              metadata: {
                ...entity.metadata,
                groupStatus: isFormerTeammate ? 'former' : 'active'
              }
            };

            groups[p.id].members.push({ l4: enrichedEntity, l3: [p] });
          }
        }
      });
    });

    return groups;
  }, [id, profileDetails, theme.entities, layerMetadataConfig]);

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

  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!profileDetails?.targetEntity) return [];

    const targetEntity = profileDetails.targetEntity;
    const allConns = [...(targetEntity.connections || []), ...(targetEntity.targetConnections || [])];
    const extractedEvents: TimelineItem[] = [];

    const safeStringCast = (val: unknown): string | undefined => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'object' && Object.keys(val).length === 0) return undefined;
      if (typeof val === 'object') return undefined;
      const str = String(val).trim();
      return str !== '' ? str : undefined;
    };

    const parseMilestones = (rawMilestones: unknown): TimelineMilestone[] | undefined => {
      if (!Array.isArray(rawMilestones)) return undefined;
      return (rawMilestones as unknown[])
        .map(m => {
          if (m && typeof m === 'object') {
            const milestone = m as { date?: unknown; title?: unknown };
            const date = safeStringCast(milestone.date);
            const title = safeStringCast(milestone.title);
            if (date && title) return { date, title };
          }
          return null;
        })
        .filter((m): m is TimelineMilestone => m !== null);
    };

    // 1. Database Connecties
    allConns.forEach(conn => {
      const connectedEntity = conn.sourceEntity?.id !== id ? conn.sourceEntity : conn.targetEntity;

      if (connectedEntity) {
        const startDate = safeStringCast(conn.metadata?.startDate || conn.metadata?.startdate);
        let endDate = safeStringCast(conn.metadata?.endDate || conn.metadata?.enddate);
        const status = safeStringCast(conn.metadata?.status);

        // FIX: Als start en einddatum hetzelfde zijn (bijv. 2015-2015), zet endDate op undefined
        if (startDate && endDate && startDate === endDate) {
          endDate = undefined;
        }

        const groupName = safeStringCast(conn.metadata?.eventName) ||
          safeStringCast(conn.metadata?.relationshipLabel) ||
          connectedEntity.name;

        const isGroupMembership = connectedEntity.type === 'l3';

        if (startDate || endDate || !isGroupMembership) {
          extractedEvents.push({
            id: String(conn.id || `${connectedEntity.id}-${startDate || 'unknown'}`),
            groupName: groupName,
            startDate,
            endDate,
            status,
            milestones: parseMilestones(conn.metadata?.milestones)
          });
        }
      }
    });

    // 2. Custom Tracks
    if (Array.isArray(targetEntity.metadata?.customTracks)) {
      (targetEntity.metadata.customTracks as unknown[]).forEach((item, index) => {
        if (item && typeof item === 'object') {
          const track = item as { name?: unknown; startDate?: unknown; startdate?: unknown; endDate?: unknown; enddate?: unknown; status?: unknown; milestones?: unknown };
          const trackName = safeStringCast(track.name);
          if (trackName) {
            const startDate = safeStringCast(track.startDate || track.startdate);
            let endDate = safeStringCast(track.endDate || track.enddate);

            // FIX: Voorkom duplicatie binnen custom tracks (bijv. 2015-2015)
            if (startDate && endDate && startDate === endDate) {
              endDate = undefined;
            }

            extractedEvents.push({
              id: `custom-track-${targetEntity.id}-${index}`,
              groupName: trackName,
              startDate,
              endDate,
              status: safeStringCast(track.status),
              milestones: parseMilestones(track.milestones)
            });
          }
        }
      });
    }

    // 3. Standalone/Solo Logica
    const standaloneStartDate = safeStringCast(targetEntity.metadata?.standaloneStartDate || targetEntity.metadata?.startDate || targetEntity.metadata?.startdate);
    let standaloneEndDate = safeStringCast(targetEntity.metadata?.standaloneEndDate || targetEntity.metadata?.endDate || targetEntity.metadata?.enddate);

    // FIX: Voorkom duplicatie binnen standalone track
    if (standaloneStartDate && standaloneEndDate && standaloneStartDate === standaloneEndDate) {
      standaloneEndDate = undefined;
    }

    if (targetEntity.isStandalone || standaloneStartDate || standaloneEndDate) {
      let standaloneLabel = safeStringCast(targetEntity.metadata?.standaloneLabel) || 'Solo / Standalone Activities';

      if (!targetEntity.metadata?.standaloneLabel) {
        const metadataKeys = targetEntity.metadata ? Object.keys(targetEntity.metadata) : [];
        const hasFootballFields = metadataKeys.some(k => ['position', 'club', 'goals', 'caps'].includes(k.toLowerCase()));
        const hasF1Fields = metadataKeys.some(k => ['number', 'podiums', 'wins', 'championships'].includes(k.toLowerCase()));

        if (hasFootballFields) {
          standaloneLabel = 'Professional Football Career';
        } else if (hasF1Fields) {
          standaloneLabel = 'Formula 1 Racing Career';
        } else if (targetEntity.type === 'l4') {
          standaloneLabel = 'Solo Career / Individual Activities';
        }
      }

      const entityStatus = safeStringCast(targetEntity.status) || 'active';
      const isDuplicate = extractedEvents.some(e => e.groupName === standaloneLabel);

      if (!isDuplicate && (standaloneStartDate || standaloneEndDate || targetEntity.isStandalone)) {
        extractedEvents.push({
          id: `standalone-track-${targetEntity.id}`,
          groupName: standaloneLabel,
          startDate: standaloneStartDate,
          endDate: standaloneEndDate,
          status: entityStatus,
          milestones: parseMilestones(targetEntity.metadata?.milestones)
        });
      }
    }

    // Tracks sorteren op jouw specifieke voorwaarden
    return extractedEvents.sort((a, b) => {
      // FIX: Kijk nu puur en alleen naar de expliciete status uit de database/metadata
      const isAActive = a.status?.toLowerCase() === 'active';
      const isBActive = b.status?.toLowerCase() === 'active';

      // 1. Als de status verschilt, gaan Active tracks áltijd boven Past tracks
      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;

      // 2. Ze zijn allebei ACTIVE -> Oudste startDate bovenaan (Chronologisch)
      if (isAActive && isBActive) {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateA - dateB;
      }

      // 3. Ze zijn allebei PAST / LOAN -> Nieuwste startDate bovenaan (Omgekeerd chronologisch)
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [profileDetails, id]);

  const sidebarSubLabel = useMemo(() => {
    if (!profileDetails) return '';
    const { parents, activeLayer } = profileDetails;
    return parents.length > 0 ? parents[parents.length - 1].name : (theme.labels[activeLayer] ?? activeLayer);
  }, [profileDetails, theme.labels]);

  const formattedStatistics = useMemo<FormattedStatItem[]>(() => {
    if (!profileDetails?.targetEntity) return [];

    const { targetEntity, activeLayer } = profileDetails;
    const standardExclusions = new Set<string>([
      'description',
      'startdate',
      'enddate',
      'standalonestartdate',
      'standaloneenddate',
      'standalonelabel'
    ]);
    const dynamicStatusKeys = new Set<string>();
    const layerMeta = layerMetadataConfig?.[activeLayer];

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
  }, [profileDetails, theme.labels, layerMetadataConfig]);

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
      timelineItems={timelineItems}
      {...assets}
    />
  );
};