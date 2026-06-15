import { useState, useMemo, useRef, useEffect } from 'react';
import type { Theme, HydratedEntity, HydratedEntityConnection } from '../../../types';

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

export interface UnifiedConnection {
  id: number;
  direction: 'outgoing' | 'incoming';
  relatedEntity: HydratedEntity | undefined;
  relatedEntityId: string;
  status: string;
}

export type MetadataValue = string | number | boolean | string[] | undefined;

export const LAYER_ORDER: Record<string, number> = { l1: 1, l2: 2, l3: 3, l4: 4 };
export const REQUIRED_L4_FIELDS = ['Nationality', 'Role', 'DebutYear', 'Birthday', 'Height'];
export const CORE_IMAGE_FIELDS = ['profileCard', 'heroBanner'];

interface UseAdminEntityEditProps {
  theme: Theme;
  entityId: string;
  onSave: (updatedEntity: HydratedEntity) => void | Promise<void>;
}

export const useAdminEntityEdit = ({ theme, entityId, onSave }: UseAdminEntityEditProps) => {
  const originalEntity = useMemo(() => {
    return (theme.entities || []).find(e => e.id === entityId);
  }, [theme, entityId]);

  // --- LAZY STATE INITIALIZATION ---
  const [name, setName] = useState<string>(() => originalEntity?.name || '');
  const [status, setStatus] = useState<string>(() => originalEntity?.status || 'active');
  const [isStandalone, setIsStandalone] = useState<boolean>(() => originalEntity?.isStandalone || false);

  // --- MEDIA ASSIGNED & UNASSIGNED POOL STATES ---
  const [albumInput, setAlbumInput] = useState<string>('');
  const [unassignedImages, setUnassignedImages] = useState<string[]>([]);

  const [imageInputs, setImageInputs] = useState<Record<string, string>>(() => {
    const imgInputs: Record<string, string> = {};
    if (originalEntity?.image) {
      Object.entries(originalEntity.image).forEach(([key, val]) => {
        imgInputs[key] = Array.isArray(val) ? val.join(', ') : String(val ?? '');
      });
    }

    if (theme.layerMetadata) {
      try {
        const parsed = typeof theme.layerMetadata === 'string'
          ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
          : (theme.layerMetadata as unknown as LayerMetadataMap);
        const currentType = originalEntity?.type?.toLowerCase() || '';
        const currentLayerConfig = parsed[currentType];

        if (currentLayerConfig && Array.isArray(currentLayerConfig.mediaKeys)) {
          currentLayerConfig.mediaKeys.forEach(k => {
            if (k && imgInputs[k] === undefined) imgInputs[k] = '';
          });
        }
      } catch (e: unknown) {
        console.error("Error patching theme schema media fields into initial edit state:", e);
      }
    }
    return imgInputs;
  });

  const [metadataInputs, setMetadataInputs] = useState<Record<string, string>>(() => {
    const metaInputs: Record<string, string> = {};
    if (!originalEntity) return metaInputs;

    const currentType = originalEntity.type?.toLowerCase() || '';

    if (currentType === 'l4') {
      REQUIRED_L4_FIELDS.forEach(field => {
        metaInputs[field] = '';
      });
    }

    if (originalEntity.metadata) {
      Object.entries(originalEntity.metadata).forEach(([dbKey, val]) => {
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
      } catch (e: unknown) {
        console.error("Error patching theme schema fields into initial edit state:", e);
      }
    }

    return metaInputs;
  });

  const [localConnections, setLocalConnections] = useState<HydratedEntityConnection[]>(() => originalEntity?.connections || []);
  const [localTargetConnections, setLocalTargetConnections] = useState<HydratedEntityConnection[]>(() => originalEntity?.targetConnections || []);

  const entitiesPool = useMemo(() => {
    return theme.entities || [];
  }, [theme.entities]);

  // --- UI CONTROL STATES ---
  const [newImageKey, setNewImageKey] = useState<string>('');
  const [newMetadataKey, setNewMetadataKey] = useState<string>('');
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [connectionSearchTerm, setConnectionSearchTerm] = useState<string>('');
  const [isConnectionDropdownOpen, setIsConnectionDropdownOpen] = useState<boolean>(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- LAYER CONFIG CONFIGURATION ---
  const layerConfig = useMemo<LayerConfig | undefined>(() => {
    const currentLayer = originalEntity?.type?.toLowerCase() || '';
    if (!theme.layerMetadata) return undefined;
    try {
      const parsedConfig = typeof theme.layerMetadata === 'string'
        ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
        : (theme.layerMetadata as unknown as LayerMetadataMap);
      return parsedConfig[currentLayer];
    } catch (err: unknown) {
      console.error("Error parsing schema configuration layer metadata:", err);
      return undefined;
    }
  }, [theme.layerMetadata, originalEntity?.type]);

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
    const isL4 = originalEntity?.type?.toLowerCase() === 'l4';

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
  }, [metadataInputs, originalEntity?.type]);

  const sortedAvailableTargets = useMemo(() => {
    return entitiesPool
      .filter(e => e.id !== entityId)
      .sort((a, b) => (LAYER_ORDER[a.type.toLowerCase()] || 99) - (LAYER_ORDER[b.type.toLowerCase()] || 99));
  }, [entitiesPool, entityId]);

  const filteredAvailableTargets = useMemo(() => {
    if (!connectionSearchTerm.trim()) return sortedAvailableTargets;
    const cleanSearch = connectionSearchTerm.toLowerCase();
    return sortedAvailableTargets.filter(e =>
      e.name.toLowerCase().includes(cleanSearch) ||
      e.type.toLowerCase().includes(cleanSearch) ||
      e.id.toLowerCase().includes(cleanSearch)
    );
  }, [sortedAvailableTargets, connectionSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsConnectionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unifiedConnections = useMemo<UnifiedConnection[]>(() => {
    const outgoing = localConnections.map(c => ({
      id: c.id,
      direction: 'outgoing' as const,
      relatedEntity: c.targetEntity,
      relatedEntityId: c.targetEntityId,
      status: String(c.metadata?.status || 'active')
    }));

    const incoming = localTargetConnections.map(c => ({
      id: c.id,
      direction: 'incoming' as const,
      relatedEntity: c.sourceEntity,
      relatedEntityId: c.sourceEntityId,
      status: String(c.metadata?.status || 'active')
    }));

    return [...outgoing, ...incoming].sort((a, b) => {
      const typeA = a.relatedEntity?.type?.toLowerCase() || 'l4';
      const typeB = b.relatedEntity?.type?.toLowerCase() || 'l4';
      return (LAYER_ORDER[typeA] || 99) - (LAYER_ORDER[typeB] || 99);
    });
  }, [localConnections, localTargetConnections]);

  // --- BASIC FIELD HANDLERS ---
  const handleImageInputChange = (key: string, value: string) => {
    setImageInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleMetadataInputChange = (key: string, value: string) => {
    setMetadataInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleAddImageField = () => {
    const cleanKey = newImageKey.trim();
    if (!cleanKey || imageInputs[cleanKey] !== undefined) return;
    setImageInputs(prev => ({ ...prev, [cleanKey]: '' }));
    setNewImageKey('');
  };

  const handleAddMetadataField = () => {
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
  };

  const handleRemoveImageField = (key: string) => {
    if (CORE_IMAGE_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
      alert(`The field "${key}" is a required core asset and cannot be deleted.`);
      return;
    }

    if (layerConfig?.mediaKeys?.includes(key)) {
      if (!window.confirm(`Field "${key}" is defined in the theme schema. Are you sure you want to drop it?`)) return;
    }

    setImageInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const handleRemoveMetadataField = (key: string) => {
    if (originalEntity && originalEntity.type.toLowerCase() === 'l4' && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
      alert(`Field "${key}" is strictly required for the trivia logic engine and cannot be stripped.`);
      return;
    }
    setMetadataInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const handleConnectionStatusChange = (connId: number, newStatus: string) => {
    setLocalConnections(prev =>
      prev.map(c => (c.id === connId ? { ...c, metadata: { ...c.metadata, status: newStatus } } : c))
    );
    setLocalTargetConnections(prev =>
      prev.map(c => (c.id === connId ? { ...c, metadata: { ...c.metadata, status: newStatus } } : c))
    );
  };

  const handleRemoveConnection = (connId: number) => {
    setLocalConnections(prev => prev.filter(c => c.id !== connId));
    setLocalTargetConnections(prev => prev.filter(c => c.id !== connId));
  };

  const handleAddConnection = (selectedEntityId: string) => {
    if (!selectedEntityId || !originalEntity) return;

    const selectedNode = entitiesPool.find(e => e.id === selectedEntityId);
    if (!selectedNode) return;

    const isAlreadyLinked = unifiedConnections.some(c => c.relatedEntityId === selectedEntityId);
    if (isAlreadyLinked) {
      alert("This entity is already connected.");
      return;
    }

    const currentLayerLevel = LAYER_ORDER[originalEntity.type.toLowerCase()] || 99;
    const selectedLayerLevel = LAYER_ORDER[selectedNode.type.toLowerCase()] || 99;

    const allExistingIds = [
      ...localConnections.map(c => c.id),
      ...localTargetConnections.map(c => c.id)
    ];
    const maxId = allExistingIds.length > 0 ? Math.max(...allExistingIds) : 0;
    const connectionId = maxId + 1;

    const baseMeta = { status: 'active' };

    if (currentLayerLevel <= selectedLayerLevel) {
      const newOutgoingConn: HydratedEntityConnection = {
        id: connectionId,
        themeId: theme.id,
        sourceEntityId: originalEntity.id,
        targetEntityId: selectedNode.id,
        metadata: baseMeta,
        targetEntity: selectedNode
      };
      setLocalConnections(prev => [...prev, newOutgoingConn]);
    } else {
      const newIncomingConn: HydratedEntityConnection = {
        id: connectionId,
        themeId: theme.id,
        sourceEntityId: selectedNode.id,
        targetEntityId: originalEntity.id,
        metadata: baseMeta,
        sourceEntity: selectedNode
      };
      setLocalTargetConnections(prev => [...prev, newIncomingConn]);
    }
  };

  // --- FIXED MEDIA PORTAL HANDLING ---
  
  /**
   * Splits input values by line breaks, spaces or commas to parse multi-url asset lists
   */
  const handleParseAlbum = () => {
    if (!albumInput.trim()) return;

    const detectedUrls = albumInput
      .split(/[\n, ]+/)
      .map(url => url.trim())
      .filter(url => url.startsWith('http://') || url.startsWith('https://'));

    const currentlyAssigned = Object.values(imageInputs)
      .flatMap(val => val.split(',').map(s => s.trim()))
      .filter(Boolean);

    const filteredNewUrls = detectedUrls.filter(url => !currentlyAssigned.includes(url));

    if (filteredNewUrls.length === 0) {
      alert("No new or valid image URLs found. They might already be assigned to a category.");
    } else {
      setUnassignedImages(prev => Array.from(new Set([...prev, ...filteredNewUrls])));
      setAlbumInput('');
    }
  };

  /**
   * FIXED: Appends image URLs to the existing asset field data using comma separation.
   * This ensures multiple previews render simultaneously instead of over-writing single string inputs.
   */
  const handleAssignImage = (url: string, key: string) => {
    setImageInputs(prev => {
      const currentVal = prev[key] ? prev[key].trim() : '';
      
      if (!currentVal) {
        return { ...prev, [key]: url };
      }
      
      const urls = currentVal.split(',').map(s => s.trim()).filter(Boolean);
      if (urls.includes(url)) return prev;
      
      return { ...prev, [key]: [...urls, url].join(', ') };
    });

    setUnassignedImages(prev => prev.filter(u => u !== url));
  };

  /**
   * Isolates and slices a single detached asset image node from a comma-separated text string pool
   */
  const handleUnassignImage = (url: string, key: string) => {
    setImageInputs(prev => {
      const currentVal = prev[key] || '';
      const urls = currentVal.split(',').map(s => s.trim()).filter(Boolean);
      const updatedUrls = urls.filter(u => u !== url);
      return { ...prev, [key]: updatedUrls.join(', ') };
    });

    setUnassignedImages(prev => {
      if (prev.includes(url)) return prev;
      return [...prev, url];
    });
  };

  const reconstructImageObject = (
    currentInputs: Record<string, string>,
    originalImage: Record<string, unknown>
  ): Record<string, string | string[]> => {
    const result: Record<string, string | string[]> = {};
    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];
      if (!rawValue || !rawValue.trim()) return;

      if (Array.isArray(originalImage[key]) || rawValue.includes(',')) {
        result[key] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        result[key] = rawValue.trim();
      }
    });
    return result;
  };

  const reconstructObject = (
    currentInputs: Record<string, string>,
    originalObject: Record<string, unknown>
  ): Record<string, MetadataValue> => {
    const result: Record<string, MetadataValue> = {};
    if (!originalEntity) return result;
    const isL4 = originalEntity.type.toLowerCase() === 'l4';

    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];

      if (!rawValue || !rawValue.trim()) return;

      if (key.toLowerCase() === 'passingdate' || key.toLowerCase() === 'birthday') {
        result[key] = rawValue.trim();
        return;
      }

      if (key.toLowerCase() === 'nationality' || rawValue.includes(',')) {
        result[key] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if (isL4 && (key.toLowerCase() === 'height' || key.toLowerCase() === 'debutyear')) {
        result[key] = Number(rawValue.trim()) || 0;
      } else if (typeof originalObject[key] === 'number') {
        result[key] = Number(rawValue) || 0;
      } else if (typeof originalObject[key] === 'boolean') {
        result[key] = rawValue.toLowerCase() === 'true';
      } else {
        result[key] = rawValue.trim();
      }
    });
    return result;
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!originalEntity) return;

    if (!name.trim()) {
      alert("Please enter a valid name.");
      return;
    }

    if (originalEntity.type.toLowerCase() === 'l4') {
      for (const field of REQUIRED_L4_FIELDS) {
        const foundKey = Object.keys(metadataInputs).find(k => k.toLowerCase() === field.toLowerCase());
        const value = foundKey ? metadataInputs[foundKey] : undefined;

        if (!value || !value.trim()) {
          alert(`Game Error: The field "${field}" is strictly required for Layer 4 entities.`);
          return;
        }
      }

      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(metadataInputs['Birthday'].trim())) {
        alert("Format Error: Birthday must use the DD-MM-YYYY standard layout.");
        return;
      }

      const passingDate = metadataInputs['PassingDate']?.trim();
      if (passingDate && !dateRegex.test(passingDate)) {
        alert("Format Error: Passing Date must use the DD-MM-YYYY standard layout.");
        return;
      }

      if (isNaN(Number(metadataInputs['Height']?.trim()))) {
        alert("Format Error: Height must be a number.");
        return;
      }
      if (isNaN(Number(metadataInputs['DebutYear']?.trim()))) {
        alert("Format Error: Debut Year must be a number.");
        return;
      }
    }

    const updatedMetadata = reconstructObject(metadataInputs, originalEntity.metadata || {});
    const updatedImage = reconstructImageObject(imageInputs, originalEntity.image || {});

    if (dynamicTriggers[status]) {
      const trigger = dynamicTriggers[status];
      updatedMetadata[trigger.key] = trigger.value;
    }

    const updatedEntity: HydratedEntity = {
      ...originalEntity,
      name: name.trim(),
      status,
      isStandalone,
      image: updatedImage as HydratedEntity['image'],
      metadata: updatedMetadata as HydratedEntity['metadata'],
      connections: localConnections,
      targetConnections: localTargetConnections
    };

    try {
      if (onSave) {
        await onSave(updatedEntity);
      }
    } catch (err: unknown) {
      console.error(err);
      alert("Could not update the entity modifications.");
    }
  };

  return {
    originalEntity,
    name,
    setName,
    status,
    setStatus,
    isStandalone,
    setIsStandalone,
    albumInput,
    setAlbumInput,
    unassignedImages,
    setUnassignedImages,
    imageInputs,
    metadataInputs,
    newImageKey,
    setNewImageKey,
    newMetadataKey,
    setNewMetadataKey,
    expandedChildId,
    setExpandedChildId,
    connectionSearchTerm,
    setConnectionSearchTerm,
    isConnectionDropdownOpen,
    setIsConnectionDropdownOpen,
    dropdownRef,
    layerConfig,
    dynamicTriggers,
    triggerFieldsMap,
    partitionedMetadataKeys,
    filteredAvailableTargets,
    unifiedConnections,
    setLocalConnections,
    setLocalTargetConnections,
    handleImageInputChange,
    handleMetadataInputChange,
    handleAddImageField,
    handleAddMetadataField,
    handleRemoveImageField,
    handleRemoveMetadataField,
    handleConnectionStatusChange,
    handleRemoveConnection,
    handleAddConnection,
    handleParseAlbum,
    handleAssignImage,
    handleUnassignImage,
    handleSubmit
  };
};