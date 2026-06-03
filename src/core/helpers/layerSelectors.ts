import type { AllLayerFormats, BaseEntity, LayerKey, QuadLayerFormat, TripleLayerFormat } from '../../types';

/**
 * Interface extensions for internal data handling
 */
interface GroupStatus {
  group: string;
  member: string;
  period?: string;
  since?: string;
  [key: string]: string | boolean | undefined | null;
}

interface GroupEntry {
  groupId: string;
  companyId: string;
  labelId?: string;
  status: GroupStatus;
}

interface BaseEntityWithEntries extends BaseEntity {
  entries?: GroupEntry[];
}

interface EntityContext {
  targetEntity: BaseEntity;
  activeLayer: LayerKey;
  parents: BaseEntity[];
}

/**
 * Normalizes status values to strings for consistent metadata usage.
 */
const normalizeStatusValue = (val: unknown): string => {
  if (val === false || val === null || val === undefined) return 'former';
  if (val === true) return 'active';
  return String(val);
};

/**
 * Searches the dataset for an entity by ID and reconstructs its hierarchy.
 */
export const findEntityAndParents = (id: string, dataset: AllLayerFormats[]): EntityContext | null => {
  let targetEntity: BaseEntity | undefined;
  let activeLayer: LayerKey = 'l4';
  const parents: BaseEntity[] = [];

  for (const item of dataset) {
    if (item.formatType === "quad-layer") {
      const quad = item as QuadLayerFormat;

      if (quad.l4.id === id) {
        targetEntity = quad.l4;
        activeLayer = 'l4';
        if (quad.l1) parents.push(quad.l1);
        if (quad.l2) quad.l2.forEach(label => parents.push(label));
        if (quad.l3?.[0]) parents.push(quad.l3[0]);
        break;
      }

      const group = quad.l3?.find(g => g.id === id);
      if (group) {
        targetEntity = group;
        activeLayer = 'l3';
        if (quad.l1) parents.push(quad.l1);
        if (quad.l2) quad.l2.forEach(label => parents.push(label));
        break;
      }
    } else if (item.formatType === "triple-layer") {
      const triple = item as TripleLayerFormat;
      if (triple.l3.id === id) {
        targetEntity = triple.l3;
        activeLayer = 'l3';
        if (triple.l1) parents.push(triple.l1);
        if (triple.l2?.[0]) parents.push(triple.l2[0]);
        break;
      }
    }
  }

  if (!targetEntity) return null;

  if (activeLayer === 'l4') {
    const parentGroup = parents[parents.length - 1];
    const profile = targetEntity as BaseEntityWithEntries;
    const entry = profile.entries?.find(e => e.groupId === parentGroup?.id);

    if (entry?.status) {
      const metadata = { ...targetEntity.metadata };
      Object.entries(entry.status).forEach(([key, val]) => {
        metadata[`groupStatus.${key}`] = normalizeStatusValue(val);
      });
      targetEntity = { ...targetEntity, metadata };
    }
  }

  return { targetEntity, activeLayer, parents };
};

const isEntityWithEntries = (entity: BaseEntity): entity is BaseEntityWithEntries => {
  return 'entries' in entity && Array.isArray((entity as BaseEntityWithEntries).entries);
};

/**
 * Retrieves all teammates across all groups associated with the target entity.
 */
export const findTeammates = (currentId: string, dataset: AllLayerFormats[]): QuadLayerFormat[] => {
  const teammatesMap = new Map<string, QuadLayerFormat>();

  const myGroupIds = new Set<string>();
  dataset.forEach(item => {
    if (item.formatType === "quad-layer") {
      const quad = item as QuadLayerFormat;
      if (quad.l4.id === currentId && quad.l3) {
        quad.l3.forEach(g => myGroupIds.add(g.id));
      }
    }
  });

  dataset.forEach(item => {
    if (item.formatType === "quad-layer") {
      const quad = item as QuadLayerFormat;
      const groupInQuad = quad.l3?.[0];

      if (groupInQuad && myGroupIds.has(groupInQuad.id) && quad.l4.id !== currentId) {
        if (!teammatesMap.has(quad.l4.id)) {
          
          const metadata = { ...quad.l4.metadata };
          
          if (isEntityWithEntries(quad.l4)) {
            
            const entry = quad.l4.entries?.find(e => e.groupId === groupInQuad.id);
            if (entry?.status) {
              Object.entries(entry.status).forEach(([k, v]) => {
                metadata[`groupStatus.${k}`] = normalizeStatusValue(v);
              });
            }
          }

          teammatesMap.set(quad.l4.id, { 
            ...quad, 
            l4: { ...quad.l4, metadata } 
          });
        }
      }
    }
  });

  return Array.from(teammatesMap.values());
};