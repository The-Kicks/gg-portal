import { useState, useMemo, useCallback } from 'react';
import type { Theme, HydratedEntity } from '../../../types';

export interface TriggerConfig {
  key: string;
  value: string;
}

export interface LayerConfig {
  badgeKey?: string;
  subtitleKey?: string;
  gridKeys?: string[];
  mediaKeys?: string[];
  statusTriggers?: Record<string, TriggerConfig>;
}

export interface LayerMetadataMap {
  [layerKey: string]: LayerConfig | undefined;
}

export type MetadataValue = string | number | boolean | string[] | undefined;

export const REQUIRED_L4_FIELDS = ['Nationality', 'Role', 'DebutYear', 'Birthday', 'Height'];

/**
 * Parses and maps entity metadata into controlled form string record inputs.
 */
export const buildMetadataInputs = (
  entity: HydratedEntity | undefined, 
  theme: Theme,
  overrideType?: string
): Record<string, string> => {
  const metaInputs: Record<string, string> = {};
  const currentType = (overrideType || entity?.type || '').toLowerCase();

  if (currentType === 'l4') {
    REQUIRED_L4_FIELDS.forEach(field => {
      metaInputs[field] = '';
    });
  }

  if (entity?.metadata) {
    Object.entries(entity.metadata as Record<string, MetadataValue>).forEach(([dbKey, val]) => {
      const match = REQUIRED_L4_FIELDS.find(f => f.toLowerCase() === dbKey.toLowerCase());
      const targetKey = match || dbKey;
      metaInputs[targetKey] = Array.isArray(val) ? val.join(', ') : String(val ?? '');
    });
  }

  if (theme.layerMetadata) {
    try {
      const parsed = typeof theme.layerMetadata === 'string'
        ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
        : (theme.layerMetadata as unknown as LayerMetadataMap);
      const currentLayerConfig = parsed[currentType];

      if (currentLayerConfig) {
        if (currentLayerConfig.badgeKey && metaInputs[currentLayerConfig.badgeKey] === undefined) {
          metaInputs[currentLayerConfig.badgeKey] = '';
        }
        if (currentLayerConfig.subtitleKey && metaInputs[currentLayerConfig.subtitleKey] === undefined) {
          metaInputs[currentLayerConfig.subtitleKey] = '';
        }
        if (Array.isArray(currentLayerConfig.gridKeys)) {
          currentLayerConfig.gridKeys.forEach(k => {
            if (k && metaInputs[k] === undefined) metaInputs[k] = '';
          });
        }
        if (currentLayerConfig.statusTriggers) {
          Object.values(currentLayerConfig.statusTriggers).forEach(t => {
            if (t?.key && metaInputs[t.key] === undefined) metaInputs[t.key] = '';
          });
        }
      }
    } catch {
      // Fallback gracefully
    }
  }
  return metaInputs;
};

/**
 * Manages the dynamic entity custom metadata properties, validations, and scheme schema triggers.
 */
export const useDynamicAttributes = (
  originalEntity: HydratedEntity | undefined, 
  theme: Theme,
  overrideType?: string
) => {
  const currentType = overrideType || originalEntity?.type || 'l4';

  const [metadataInputs, setMetadataInputs] = useState<Record<string, string>>(() => 
    buildMetadataInputs(originalEntity, theme, currentType)
  );
  const [newMetadataKey, setNewMetadataKey] = useState<string>('');

  const layerConfig = useMemo<LayerConfig | undefined>(() => {
    if (!theme.layerMetadata) return undefined;
    try {
      const parsedConfig = typeof theme.layerMetadata === 'string'
        ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
        : (theme.layerMetadata as unknown as LayerMetadataMap);
      return parsedConfig[currentType.toLowerCase()];
    } catch {
      return undefined;
    }
  }, [theme.layerMetadata, currentType]);

  const dynamicTriggers = useMemo(() => layerConfig?.statusTriggers || {}, [layerConfig]);

  const triggerFieldsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.values(dynamicTriggers).forEach(trigger => {
      if (trigger && trigger.key) {
        if (!map[trigger.key]) map[trigger.key] = [];
        if (!map[trigger.key].includes(trigger.value)) {
          map[trigger.key].push(trigger.value);
        }
      }
    });
    return map;
  }, [dynamicTriggers]);

  const partitionedMetadataKeys = useMemo(() => {
    const allKeys = Object.keys(metadataInputs);
    const isL4 = currentType.toLowerCase() === 'l4';

    return {
      requiredKeys: allKeys.filter(key =>
        isL4 && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())
      ),
      dynamicKeys: allKeys.filter(key => {
        const isRequired = isL4 && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase());
        const isPassingDate = key.toLowerCase() === 'passingdate';
        return !isRequired && !isPassingDate;
      })
    };
  }, [metadataInputs, currentType]);

  const handleMetadataInputChange = useCallback((key: string, value: string) => {
    setMetadataInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAddMetadataField = useCallback(() => {
    const cleanKey = newMetadataKey.trim();
    if (!cleanKey) return;

    if (metadataInputs[cleanKey] !== undefined) {
      alert("This field already exists.");
      return;
    }

    const isCoreField = REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === cleanKey.toLowerCase());
    if (isCoreField) {
      alert(`The field "${cleanKey}" is a protected system metric.`);
      return;
    }

    setMetadataInputs(prev => ({ ...prev, [cleanKey]: '' }));
    setNewMetadataKey('');
  }, [newMetadataKey, metadataInputs]);

  const handleRemoveMetadataField = useCallback((key: string) => {
    if (currentType.toLowerCase() === 'l4' && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
      alert(`Field "${key}" is strictly required for the trivia logic engine and cannot be stripped.`);
      return;
    }
    setMetadataInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  }, [currentType]);

  return {
    metadataInputs,
    setMetadataInputs,
    newMetadataKey,
    setNewMetadataKey,
    layerConfig,
    dynamicTriggers,
    triggerFieldsMap,
    partitionedMetadataKeys,
    handleMetadataInputChange,
    handleAddMetadataField,
    handleRemoveMetadataField
  };
};