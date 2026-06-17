import { useState, useEffect, useMemo } from 'react';
import type { Theme, HydratedEntity, BaseEntity } from '../../../types';
import { entityService } from '../EntityService';

export interface TriggerConfig {
  key: string;
  value: string;
}

export interface LayerConfig {
  badgeKey?: string;
  subtitleKey?: string;
  gridKeys?: string[];
  statusTriggers?: Record<string, TriggerConfig>;
  mediaKeys?: string[];
}

export interface LayerMetadataMap {
  [layerKey: string]: LayerConfig | undefined;
}

export type MetadataValue = string | number | boolean | string[] | undefined;

export const REQUIRED_L4_FIELDS = ['Nationality', 'Role', 'DebutYear', 'Birthday', 'Height'];
export const CORE_IMAGE_FIELDS = ['profileCard', 'heroBanner'];

interface UseAdminEntityCreateProps {
  theme: Theme;
  onSave: (newEntity: HydratedEntity) => void;
}

export const useAdminEntityCreate = ({ theme, onSave }: UseAdminEntityCreateProps) => {
  // --- Form Local States ---
  const [name, setName] = useState('');
  const [customSuffix, setCustomSuffix] = useState('');
  const [type, setType] = useState('l4');
  const [status, setStatus] = useState('active');
  const [isStandalone, setIsStandalone] = useState(true);
  const [idStatus, setIdStatus] = useState<'idle' | 'available' | 'taken'>('idle');

  // --- Staging Pool States ---
  const [albumInput, setAlbumInput] = useState('');
  const [unassignedImages, setUnassignedImages] = useState<string[]>([]);

  // --- Helper: Normalize Imgur Links (.gifv format workaround) ---
  const cleanImgUrl = (url: string): string => {
    const trimmed = url.trim();
    if (trimmed.toLowerCase().endsWith('.gifv')) {
      return trimmed.slice(0, -5) + '.mp4';
    }
    return trimmed;
  };

  // --- LAZY STATE INITIALIZATION: MEDIA ASSETS ---
  const [imageInputs, setImageInputs] = useState<Record<string, string>>(() => {
    const nextImages: Record<string, string> = {};

    CORE_IMAGE_FIELDS.forEach(field => {
      nextImages[field] = '';
    });

    if (theme.layerMetadata) {
      try {
        const parsed = typeof theme.layerMetadata === 'string'
          ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
          : (theme.layerMetadata as unknown as LayerMetadataMap);
        const initialConfig = parsed['l4'];

        if (initialConfig?.mediaKeys && Array.isArray(initialConfig.mediaKeys)) {
          initialConfig.mediaKeys.forEach(k => { if (k) nextImages[k] = ''; });
        }
      } catch (e: unknown) {
        console.error("Error loading initial media assets in lazy state:", e);
      }
    }
    return nextImages;
  });

  // --- LAZY STATE INITIALIZATION: METADATA ---
  const [metadataInputs, setMetadataInputs] = useState<Record<string, string>>(() => {
    const nextInputs: Record<string, string> = {};

    REQUIRED_L4_FIELDS.forEach(field => {
      nextInputs[field] = '';
    });

    if (theme.layerMetadata) {
      try {
        const parsed = typeof theme.layerMetadata === 'string'
          ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
          : (theme.layerMetadata as unknown as LayerMetadataMap);
        const initialConfig = parsed['l4'];

        if (initialConfig) {
          if (initialConfig.badgeKey) nextInputs[initialConfig.badgeKey] = '';
          if (initialConfig.subtitleKey) nextInputs[initialConfig.subtitleKey] = '';
          if (Array.isArray(initialConfig.gridKeys)) {
            initialConfig.gridKeys.forEach(k => { if (k) nextInputs[k] = ''; });
          }
          if (initialConfig.statusTriggers) {
            Object.values(initialConfig.statusTriggers).forEach(t => { if (t?.key) nextInputs[t.key] = ''; });
          }
        }
      } catch (e: unknown) {
        console.error("Error loading initial schema attributes in lazy state:", e);
      }
    }
    return nextInputs;
  });

  // --- UI Control States ---
  const [newImageKey, setNewImageKey] = useState('');
  const [newMetadataKey, setNewMetadataKey] = useState('');

  // --- Layer Config Resolution ---
  const layerConfig = useMemo<LayerConfig | undefined>(() => {
    if (!theme.layerMetadata) return undefined;
    try {
      const parsedConfig = typeof theme.layerMetadata === 'string'
        ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
        : (theme.layerMetadata as unknown as LayerMetadataMap);
      return parsedConfig[type.toLowerCase()];
    } catch (err: unknown) {
      console.error("Error parsing layerMetadata layout configuration:", err);
      return undefined;
    }
  }, [theme.layerMetadata, type]);

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
    const isL4 = type.toLowerCase() === 'l4';

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
  }, [metadataInputs, type]);

  // --- Debounced Async ID/Slug check ---
  useEffect(() => {
    const baseSlug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    const suffix = customSuffix.trim() ? customSuffix.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';
    const idToCheck = suffix ? `${baseSlug}-${suffix}` : baseSlug;

    const delayDebounceFn = setTimeout(async () => {
      if (!name.trim()) {
        setIdStatus('idle');
        return;
      }
      try {
        const exists = await entityService.checkIdExists(theme.id, idToCheck);
        setIdStatus(exists ? 'taken' : 'available');
      } catch (err: unknown) {
        console.error(err);
        setIdStatus('idle');
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [name, customSuffix, theme.id]);

  // --- Synchronous Drop Action Handlers ---
  const handleAssignImage = (url: string, key: string) => {
    const cleanedUrl = cleanImgUrl(url);
    console.log(`[Hook Log] handleAssignImage executed -> target field: "${key}", url: "${cleanedUrl}"`);
    
    setImageInputs(prev => {
      const currentVal = prev[key] ? prev[key].trim() : '';
      
      if (!currentVal) {
        console.log(`[Hook Log] Field "${key}" was empty. Appending asset directly.`);
        return { ...prev, [key]: cleanedUrl };
      }
      
      const urls = currentVal.split(',').map(s => s.trim()).filter(Boolean);
      if (urls.includes(cleanedUrl)) {
        console.warn(`[Hook Log] Prevented assignment: "${cleanedUrl}" already registered inside field "${key}".`);
        return prev;
      }
      
      console.log(`[Hook Log] Field "${key}" has existing data. Merging array list.`);
      return { ...prev, [key]: [...urls, cleanedUrl].join(', ') };
    });

    setUnassignedImages(prev => {
      const filtered = prev.filter(u => cleanImgUrl(u) !== cleanedUrl);
      console.log(`[Hook Log] Staging pool update. Previous count: ${prev.length}, Next count: ${filtered.length}`);
      return filtered;
    });
  };

  const handleUnassignImage = (url: string, sourceKey: string) => {
    const cleanedUrl = cleanImgUrl(url);
    console.log(`[Hook Log] handleUnassignImage executed -> returning asset from field "${sourceKey}" back to pool.`);

    setImageInputs(prev => {
      const currentVal = prev[sourceKey] || '';
      const urls = currentVal.split(',').map(s => s.trim()).filter(Boolean);
      const updatedUrls = urls.filter(u => cleanImgUrl(u) !== cleanedUrl);
      return { ...prev, [sourceKey]: updatedUrls.join(', ') };
    });

    setUnassignedImages(prev => {
      const normalizedPrev = prev.map(cleanImgUrl);
      if (normalizedPrev.includes(cleanedUrl)) {
        console.log("[Hook Log] Asset already safely present in staging pool. Skipping duplicate push.");
        return prev;
      }
      return [...prev, cleanedUrl];
    });
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    setIsStandalone(newType.toLowerCase() === 'l4');
    setStatus('active');

    const currentLayer = newType.toLowerCase();

    const nextImages: Record<string, string> = {};
    CORE_IMAGE_FIELDS.forEach(field => { nextImages[field] = ''; });

    const nextInputs: Record<string, string> = {};
    if (currentLayer === 'l4') {
      REQUIRED_L4_FIELDS.forEach(field => { nextInputs[field] = ''; });
    }

    if (theme.layerMetadata) {
      try {
        const parsed = typeof theme.layerMetadata === 'string'
          ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
          : (theme.layerMetadata as unknown as LayerMetadataMap);
        const nextConfig = parsed[currentLayer];

        if (nextConfig) {
          if (nextConfig.mediaKeys && Array.isArray(nextConfig.mediaKeys)) {
            nextConfig.mediaKeys.forEach(k => { if (k) nextImages[k] = ''; });
          }
          if (nextConfig.badgeKey) nextInputs[nextConfig.badgeKey] = '';
          if (nextConfig.subtitleKey) nextInputs[nextConfig.subtitleKey] = '';
          if (Array.isArray(nextConfig.gridKeys)) {
            nextConfig.gridKeys.forEach(k => { if (k) nextInputs[k] = ''; });
          }
          if (nextConfig.statusTriggers) {
            Object.values(nextConfig.statusTriggers).forEach(t => { if (t?.key) nextInputs[t.key] = ''; });
          }
        }
      } catch (e: unknown) {
        console.error("Error parsing schema metadata upon layer switch:", e);
      }
    }

    setImageInputs(nextImages);
    setMetadataInputs(nextInputs);
  };

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
      alert("Dit veld bestaat al.");
      return;
    }

    const isCoreField = REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === cleanKey.toLowerCase());
    if (isCoreField) {
      alert(`Het veld "${cleanKey}" is een gereserveerd systeem-veld.`);
      return;
    }

    setMetadataInputs(prev => ({ ...prev, [cleanKey]: '' }));
    setNewMetadataKey('');
  };

  const handleRemoveImageField = (key: string) => {
    if (CORE_IMAGE_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
      alert(`Field "${key}" is core and cannot be removed.`);
      return;
    }
    setImageInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const handleRemoveMetadataField = (key: string) => {
    if (type.toLowerCase() === 'l4' && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
      alert(`Field "${key}" is strictly required for the trivia logic engine and cannot be stripped.`);
      return;
    }
    setMetadataInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const reconstructObject = (
    currentInputs: Record<string, string>
  ): Record<string, MetadataValue> => {
    const result: Record<string, MetadataValue> = {};

    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];
      if (!rawValue || !rawValue.trim()) return;

      if (key.toLowerCase() === 'passingdate' || key.toLowerCase() === 'birthday') {
        result[key] = rawValue.trim();
        return;
      }

      if (key.toLowerCase() === 'nationality' || rawValue.includes(',')) {
        result[key] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if (key.toLowerCase() === 'height' || key.toLowerCase() === 'debutyear') {
        result[key] = Number(rawValue.trim()) || 0;
      } else {
        result[key] = rawValue.trim();
      }
    });
    return result;
  };

  const reconstructImageObject = (
    currentInputs: Record<string, string>
  ): Record<string, string | string[]> => {
    const result: Record<string, string | string[]> = {};
    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];
      if (!rawValue || !rawValue.trim()) return;

      if (rawValue.includes(',')) {
        result[key] = rawValue.split(',').map(s => cleanImgUrl(s)).filter(Boolean);
      } else {
        result[key] = cleanImgUrl(rawValue);
      }
    });
    return result;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Please enter a valid name.");
      return;
    }

    if (idStatus === 'taken') {
      alert("Cannot save: This unique ID combination is already taken.");
      return;
    }

    if (type.toLowerCase() === 'l4') {
      for (const field of REQUIRED_L4_FIELDS) {
        const foundKey = Object.keys(metadataInputs).find(k => k.toLowerCase() === field.toLowerCase());
        const value = foundKey ? metadataInputs[foundKey] : undefined;

        if (!value || !value.trim()) {
          alert(`Game Error: The field "${field}" is strictly required for Layer 4 entities.`);
          return;
        }
      }
    }

    const baseSlug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    const suffix = customSuffix.trim() ? customSuffix.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';
    const generatedId = suffix ? `${baseSlug}-${suffix}` : baseSlug;

    const updatedMetadata = reconstructObject(metadataInputs);

    if (dynamicTriggers[status]) {
      const trigger = dynamicTriggers[status];
      updatedMetadata[trigger.key] = trigger.value;
    }

    const updatedImage = reconstructImageObject(imageInputs);

    const newSkeleton: BaseEntity = {
      id: generatedId,
      themeId: theme.id,
      name: name.trim(),
      type: type,
      status: status,
      isStandalone: isStandalone,
      image: updatedImage as unknown as BaseEntity['image'],
      metadata: updatedMetadata
    };

    try {
      const savedEntity: HydratedEntity = await entityService.create(theme.id, newSkeleton);
      window.dispatchEvent(new Event('refresh-database'));
      if (onSave) onSave(savedEntity);
    } catch (err: unknown) {
      console.error(err);
      alert(`Could not persist the new record.`);
    }
  };

  return {
    name,
    setName,
    customSuffix,
    setCustomSuffix,
    type,
    status,
    setStatus,
    isStandalone,
    setIsStandalone,
    idStatus,
    imageInputs,
    metadataInputs,
    newImageKey,
    setNewImageKey,
    newMetadataKey,
    setNewMetadataKey,
    dynamicTriggers,
    triggerFieldsMap,
    partitionedMetadataKeys,
    albumInput,
    setAlbumInput,
    unassignedImages,
    setUnassignedImages,
    handleTypeChange,
    handleImageInputChange,
    handleMetadataInputChange,
    handleAddImageField,
    handleAddMetadataField,
    handleRemoveImageField,
    handleRemoveMetadataField,
    handleAssignImage,
    handleUnassignImage,
    handleSubmit
  };
};