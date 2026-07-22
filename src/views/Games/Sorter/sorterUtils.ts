import type { Theme, HydratedEntity } from '../../../types';

export const extractMediaUrls = (entity: HydratedEntity, theme: Theme): string[] => {
  const discoveredUrls: string[] = [];

  if (entity.image?.profileCard) {
    discoveredUrls.push(entity.image.profileCard.trim());
  }
  if (entity.image?.heroBanner) {
    discoveredUrls.push(entity.image.heroBanner.trim());
  }

  const layerMetadata = theme.layerMetadata[entity.type];
  if (layerMetadata && layerMetadata.mediaKeys) {
    layerMetadata.mediaKeys.forEach(key => {
      if (key === 'profileCard' || key === 'heroBanner') return;

      const dynamicMediaData = entity.image[key];
      if (typeof dynamicMediaData === 'string') {
        discoveredUrls.push(...dynamicMediaData.split(' ').map(url => url.trim()).filter(Boolean));
      } else if (Array.isArray(dynamicMediaData)) {
        discoveredUrls.push(...dynamicMediaData.filter((url): url is string => typeof url === 'string').map(url => url.trim()));
      }
    });
  }

  return discoveredUrls;
};

/**
 * Hustelt een array willekeurig door elkaar (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Haalt alle unieke groep-IDs uit het thema voor de initiële selectie
 */
export function getGroupIdsFromTheme(theme: Theme): string[] {
  const allEntities = theme.entities || [];
  const rankableItems = allEntities.filter(entity => entity.type === 'l4');
  const uniqueIds = new Set<string>();

  rankableItems.forEach(item => {
    item.targetConnections?.forEach(connection => {
      const connectedParent = connection.sourceEntity;
      if (!connectedParent) return;
      if (['l1', 'l2', 'l3'].includes(connectedParent.type)) {
        uniqueIds.add(connectedParent.id);
      }
    });
  });

  return Array.from(uniqueIds);
}