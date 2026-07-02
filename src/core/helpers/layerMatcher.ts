import type { Theme } from '../../types';

export type LayerRole = 'TOP_LEVEL' | 'MID_LEVEL' | 'LOW_LEVEL' | 'PROFILE_LEVEL';

/**
 * Evaluates the total number of navigation layers configured for a theme to determine 
 * and return the structural role of the current active layer.
 * * For 3-layer configurations, it maps the layers to bypass the absolute top tier, 
 * assigning L1 to MID_LEVEL, L2 to LOW_LEVEL, and L3 to PROFILE_LEVEL.
 * * For standard 4-layer configurations (and defaults), it maps the complete architectural spectrum,
 * assigning L1 to TOP_LEVEL, L2 to MID_LEVEL, L3 to LOW_LEVEL, and L4 to PROFILE_LEVEL.
 */
export function getLayerRole(theme: Theme, currentLayer: string): LayerRole {
  const totalLayers = theme.navbarItems?.filter(item => item.startsWith('l')).length || 4;
  
  if (totalLayers === 3) {
    switch (currentLayer.toLowerCase()) {
      case 'l1': return 'MID_LEVEL';
      case 'l2': return 'LOW_LEVEL';
      case 'l3': return 'PROFILE_LEVEL';
      default: return 'MID_LEVEL';
    }
  } else {
    switch (currentLayer.toLowerCase()) {
      case 'l1': return 'TOP_LEVEL';
      case 'l2': return 'MID_LEVEL';
      case 'l3': return 'LOW_LEVEL';
      case 'l4': return 'PROFILE_LEVEL';
      default: return 'TOP_LEVEL';
    }
  }
}