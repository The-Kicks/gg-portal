import { useMemo, useState } from 'react';
import type { Theme, HydratedEntity } from '../../../types';

import { useStandardEntityAttributes } from '../adminUtils/useStandardEntityAttributes';
import { useDynamicAttributes, buildMetadataInputs, REQUIRED_L4_FIELDS } from '../adminUtils/useDynamicAttributes';
import type { MetadataValue } from '../adminUtils/useDynamicAttributes'; 
import { useMediaCategories, buildImageInputs } from '../adminUtils/useMediaCategories';
import { useTimelineBuilder } from '../adminUtils/useTimelineBuilder';

interface UseAdminEntityEditProps {
  theme: Theme;
  entityId: string;
  onSave: (updatedEntity: HydratedEntity) => void | Promise<void>;
}

export const useAdminEntityEdit = ({ theme, entityId, onSave }: UseAdminEntityEditProps) => {
  const originalEntity = useMemo(() => {
    return (theme.entities || []).find(e => e.id === entityId);
  }, [theme.entities, entityId]);

  const [prevEntityId, setPrevEntityId] = useState<string>(entityId);

  const standardAttrs = useStandardEntityAttributes(originalEntity);
  const dynamicAttrs = useDynamicAttributes(originalEntity, theme);
  const mediaCategories = useMediaCategories(originalEntity, theme, dynamicAttrs.layerConfig);
  const timelineBuilder = useTimelineBuilder(originalEntity, theme, entityId);

  if (entityId !== prevEntityId) {
    setPrevEntityId(entityId);
    standardAttrs.resetStandardAttributes(originalEntity);
    mediaCategories.setAlbumInput('');
    mediaCategories.setUnassignedImages([]);
    mediaCategories.setImageInputs(buildImageInputs(originalEntity, theme));
    dynamicAttrs.setMetadataInputs(buildMetadataInputs(originalEntity, theme));
    timelineBuilder.setLocalConnections(originalEntity?.connections || []);
    timelineBuilder.setLocalTargetConnections(originalEntity?.targetConnections || []);
  }

  const reconstructImageObject = (
    currentInputs: Record<string, string>,
    originalImage: Record<string, unknown>
  ): Record<string, string | string[]> => {
    const result: Record<string, string | string[]> = {};
    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];
      if (!rawValue || !rawValue.trim()) return;

      const cleanUrls = rawValue.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

      if (Array.isArray(originalImage[key]) || cleanUrls.length > 1) {
        result[key] = cleanUrls;
      } else {
        result[key] = cleanUrls[0] || '';
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
    if (!standardAttrs.name.trim()) {
      alert("Please enter a valid name.");
      return;
    }

    if (originalEntity.type.toLowerCase() === 'l4') {
      for (const field of REQUIRED_L4_FIELDS) {
        const foundKey = Object.keys(dynamicAttrs.metadataInputs).find((k: string) => k.toLowerCase() === field.toLowerCase());
        const value = foundKey ? dynamicAttrs.metadataInputs[foundKey] : undefined;

        if (!value || !value.trim()) {
          alert(`Game Error: The field "${field}" is strictly required for Layer 4 entities.`);
          return;
        }
      }

      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(dynamicAttrs.metadataInputs['Birthday'].trim())) {
        alert("Format Error: Birthday must use the DD-MM-YYYY standard layout.");
        return;
      }

      const passingDateKey = Object.keys(dynamicAttrs.metadataInputs).find((k: string) => k.toLowerCase() === 'passingdate');
      const passingDate = passingDateKey ? dynamicAttrs.metadataInputs[passingDateKey]?.trim() : undefined;
      
      if (passingDate && !dateRegex.test(passingDate)) {
        alert("Format Error: Passing Date must use the DD-MM-YYYY standard layout.");
        return;
      }

      if (isNaN(Number(dynamicAttrs.metadataInputs['Height']?.trim()))) {
        alert("Format Error: Height must be a number.");
        return;
      }
      if (isNaN(Number(dynamicAttrs.metadataInputs['DebutYear']?.trim()))) {
        alert("Format Error: Debut Year must be a number.");
        return;
      }
    }

    const updatedMetadata = reconstructObject(dynamicAttrs.metadataInputs, originalEntity.metadata || {});
    const updatedImage = reconstructImageObject(mediaCategories.imageInputs, originalEntity.image || {});

    if (dynamicAttrs.dynamicTriggers[standardAttrs.status]) {
      const trigger = dynamicAttrs.dynamicTriggers[standardAttrs.status];
      if (trigger) {
        updatedMetadata[trigger.key] = trigger.value;
      }
    }

    const updatedEntity: HydratedEntity = {
      ...originalEntity,
      name: standardAttrs.name.trim(),
      status: standardAttrs.status,
      isStandalone: standardAttrs.isStandalone,
      image: updatedImage as HydratedEntity['image'],
      metadata: updatedMetadata as HydratedEntity['metadata'],
      connections: timelineBuilder.localConnections,
      targetConnections: timelineBuilder.localTargetConnections
    };

    try {
      if (onSave) {
        await onSave(updatedEntity);
      }
    } catch {
      alert("Could not update the entity modifications.");
    }
  };

  return {
    originalEntity,
    name: standardAttrs.name,
    setName: standardAttrs.setName,
    status: standardAttrs.status,
    setStatus: standardAttrs.setStatus,
    isStandalone: standardAttrs.isStandalone,
    setIsStandalone: standardAttrs.setIsStandalone,
    
    albumInput: mediaCategories.albumInput,
    setAlbumInput: mediaCategories.setAlbumInput,
    unassignedImages: mediaCategories.unassignedImages,
    setUnassignedImages: mediaCategories.setUnassignedImages,
    imageInputs: mediaCategories.imageInputs,
    newImageKey: mediaCategories.newImageKey,
    setNewImageKey: mediaCategories.setNewImageKey,
    
    metadataInputs: dynamicAttrs.metadataInputs,
    newMetadataKey: dynamicAttrs.newMetadataKey,
    setNewMetadataKey: dynamicAttrs.setNewMetadataKey,
    layerConfig: dynamicAttrs.layerConfig,
    dynamicTriggers: dynamicAttrs.dynamicTriggers,
    triggerFieldsMap: dynamicAttrs.triggerFieldsMap,
    partitionedMetadataKeys: dynamicAttrs.partitionedMetadataKeys,
    
    expandedChildId: timelineBuilder.expandedChildId,
    setExpandedChildId: timelineBuilder.setExpandedChildId,
    connectionSearchTerm: timelineBuilder.connectionSearchTerm,
    setConnectionSearchTerm: timelineBuilder.setConnectionSearchTerm,
    isConnectionDropdownOpen: timelineBuilder.isConnectionDropdownOpen,
    setIsConnectionDropdownOpen: timelineBuilder.setIsConnectionDropdownOpen,
    dropdownRef: timelineBuilder.dropdownRef,
    filteredAvailableTargets: timelineBuilder.filteredAvailableTargets,
    unifiedConnections: timelineBuilder.unifiedConnections,
    setLocalConnections: timelineBuilder.setLocalConnections,
    setLocalTargetConnections: timelineBuilder.setLocalTargetConnections,
    
    handleImageInputChange: mediaCategories.handleImageInputChange,
    handleMetadataInputChange: dynamicAttrs.handleMetadataInputChange,
    handleAddImageField: mediaCategories.handleAddImageField,
    handleAddMetadataField: dynamicAttrs.handleAddMetadataField,
    handleRemoveImageField: mediaCategories.handleRemoveImageField,
    handleRemoveMetadataField: dynamicAttrs.handleRemoveMetadataField,
    handleConnectionMetadataChange: timelineBuilder.handleConnectionMetadataChange,
    handleRemoveConnection: timelineBuilder.handleRemoveConnection,
    handleCreateNonRelationalTrack: timelineBuilder.handleCreateNonRelationalTrack, // <-- Toegevoegd
    handleAddConnection: timelineBuilder.handleAddConnection,
    handleParseAlbum: mediaCategories.handleParseAlbum,
    handleAssignImage: mediaCategories.handleAssignImage,
    handleUnassignImage: mediaCategories.handleUnassignImage,
    handleSubmit
  };
};