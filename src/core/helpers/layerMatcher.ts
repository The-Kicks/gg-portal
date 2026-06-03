// core/utils/layerMatcher.ts
import type { Theme } from '../../types';

export type LayerRole = 'TOP_LEVEL' | 'MID_LEVEL' | 'LOW_LEVEL' | 'PROFILE_LEVEL';

export function getLayerRole(theme: Theme, currentLayer: string): LayerRole {
  const totalLayers = theme.navbarItems?.filter(item => item.startsWith('l')).length || 4;
  
  if (totalLayers === 3) {
    // Triple layer logica (Bijv: L1 = Groep, L2 = Afdeling, L3 = Profielen)
    switch (currentLayer.toLowerCase()) {
      case 'l1': return 'MID_LEVEL';     // Slaat de absolute top over, begint direct op geaggregeerd niveau
      case 'l2': return 'LOW_LEVEL';
      case 'l3': return 'PROFILE_LEVEL';
      default: return 'MID_LEVEL';
    }
  } else {
    // Quad layer logica (Standaard: L1 = Holding, L2 = Organisatie, L3 = Afdeling, L4 = Profiel)
    switch (currentLayer.toLowerCase()) {
      case 'l1': return 'TOP_LEVEL';
      case 'l2': return 'MID_LEVEL';
      case 'l3': return 'LOW_LEVEL';
      case 'l4': return 'PROFILE_LEVEL';
      default: return 'TOP_LEVEL';
    }
  }
}