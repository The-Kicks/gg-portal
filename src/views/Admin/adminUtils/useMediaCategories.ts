import { useState, useCallback } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import type { LayerConfig, LayerMetadataMap } from './useDynamicAttributes';

export const CORE_IMAGE_FIELDS = ['profileCard', 'heroBanner'];

export const buildImageInputs = (
  entity: HydratedEntity | undefined, 
  theme: Theme,
  overrideType?: string
): Record<string, string> => {
  const imgInputs: Record<string, string> = {};
  
  // Garandeer dat verplichte velden altijd een lege string hebben als fallback
  CORE_IMAGE_FIELDS.forEach(f => { imgInputs[f] = ''; });

  if (entity?.image) {
    Object.entries(entity.image).forEach(([key, val]) => {
      imgInputs[key] = Array.isArray(val) ? val.join('\n') : String(val ?? '');
    });
  }
  if (theme.layerMetadata) {
    try {
      const parsed = typeof theme.layerMetadata === 'string'
        ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
        : (theme.layerMetadata as unknown as LayerMetadataMap);
      const currentType = (overrideType || entity?.type || '').toLowerCase();
      const currentLayerConfig = parsed[currentType];

      if (currentLayerConfig && Array.isArray(currentLayerConfig.mediaKeys)) {
        currentLayerConfig.mediaKeys.forEach(k => {
          if (k && imgInputs[k] === undefined) imgInputs[k] = '';
        });
      }
    } catch {
      // Fallback gracefully
    }
  }
  return imgInputs;
};

export const useMediaCategories = (
  originalEntity: HydratedEntity | undefined,
  theme: Theme,
  layerConfig: LayerConfig | undefined,
  overrideType?: string
) => {
  const currentType = overrideType || originalEntity?.type || 'l4';

  const [imageInputs, setImageInputs] = useState<Record<string, string>>(() => 
    buildImageInputs(originalEntity, theme, currentType)
  );
  const [albumInput, setAlbumInput] = useState<string>('');
  const [unassignedImages, setUnassignedImages] = useState<string[]>([]);
  const [newImageKey, setNewImageKey] = useState<string>('');

  const handleImageInputChange = useCallback((key: string, value: string) => {
    setImageInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAddImageField = useCallback(() => {
    const cleanKey = newImageKey.trim();
    if (!cleanKey || imageInputs[cleanKey] !== undefined) return;
    setImageInputs(prev => ({ ...prev, [cleanKey]: '' }));
    setNewImageKey('');
  }, [newImageKey, imageInputs]);

  const handleRemoveImageField = useCallback((key: string) => {
    if (CORE_IMAGE_FIELDS.some((f: string) => f.toLowerCase() === key.toLowerCase())) {
      alert(`The field "${key}" is a required core asset and cannot be deleted.`);
      return;
    }

    if (layerConfig?.mediaKeys?.includes(key)) {
      if (!window.confirm(`Field "${key}" is defined in the theme schema. Are you sure you want to drop it?`)) return;
    }

    setImageInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  }, [layerConfig]);

  const handleParseAlbum = useCallback(() => {
    if (!albumInput.trim()) return;

    const detectedUrls = albumInput
      .split(/[\n, ]+/)
      .map(url => url.trim())
      .filter(url => url.startsWith('http://') || url.startsWith('https://'));

    const currentlyAssigned = Object.values(imageInputs)
      .flatMap(val => val.split(/[\s,]+/).map(s => s.trim()))
      .filter(Boolean);

    const filteredNewUrls = detectedUrls.filter(url => !currentlyAssigned.includes(url));

    if (filteredNewUrls.length === 0) {
      alert("No new or valid image URLs found. They might already be assigned to a category.");
    } else {
      setUnassignedImages(prev => Array.from(new Set([...prev, ...filteredNewUrls])));
      setAlbumInput('');
    }
  }, [albumInput, imageInputs]);

  const handleAssignImage = useCallback((url: string, key: string) => {
    setImageInputs(prev => {
      const currentVal = prev[key] ? prev[key].trim() : '';
      if (!currentVal) return { ...prev, [key]: url };
      
      const urls = currentVal.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
      if (urls.includes(url)) return prev;
      
      return { ...prev, [key]: [...urls, url].join('\n') };
    });
    setUnassignedImages(prev => prev.filter(u => u !== url));
  }, []);

  const handleUnassignImage = useCallback((url: string, key: string) => {
    setImageInputs(prev => {
      const currentVal = prev[key] || '';
      const urls = currentVal.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
      const updatedUrls = urls.filter(u => u !== url);
      return { ...prev, [key]: updatedUrls.join('\n') };
    });
    setUnassignedImages(prev => {
      if (prev.includes(url)) return prev;
      return [...prev, url];
    });
  }, []);

  return {
    imageInputs,
    setImageInputs,
    albumInput,
    setAlbumInput,
    unassignedImages,
    setUnassignedImages,
    newImageKey,
    setNewImageKey,
    handleImageInputChange,
    handleAddImageField,
    handleRemoveImageField,
    handleParseAlbum,
    handleAssignImage,
    handleUnassignImage,
  };
};