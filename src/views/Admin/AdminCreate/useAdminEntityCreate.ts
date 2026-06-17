import { useState, useEffect } from 'react';
import type { Theme, HydratedEntity, BaseEntity, LayerKey, HydratedEntityConnection } from '../../../types';
import { entityService } from '../EntityService';

import { useStandardEntityAttributes } from '../adminUtils/useStandardEntityAttributes';
import { useDynamicAttributes, buildMetadataInputs } from '../adminUtils/useDynamicAttributes';
import type { MetadataValue } from '../adminUtils/useDynamicAttributes';
import { useMediaCategories, buildImageInputs } from '../adminUtils/useMediaCategories';
import { useTimelineBuilder } from '../adminUtils/useTimelineBuilder';

interface UseAdminEntityCreateProps {
  theme: Theme;
  onSave: (newEntity: HydratedEntity) => void | Promise<void>;
}

export const useAdminEntityCreate = ({ theme, onSave }: UseAdminEntityCreateProps) => {
  const [type, setType] = useState<LayerKey>('l4');
  const [customSuffix, setCustomSuffix] = useState<string>('');
  const [idStatus, setIdStatus] = useState<'idle' | 'available' | 'taken'>('idle');

  // Haal de metadata-standaard op voor de huidige geselecteerde laag uit het Theme
  const currentLayerMetadata = theme.layerMetadata[type];

  // Initialiseer de sub-hooks
  const standardAttrs = useStandardEntityAttributes(undefined);
  const dynamicAttrs = useDynamicAttributes(undefined, theme, type);
  const mediaCategories = useMediaCategories(undefined, theme, currentLayerMetadata, type);
  const timelineBuilder = useTimelineBuilder(undefined, theme, '', type);

  // Handmatige type switch via de dropdown
  const handleTypeChange = (newType: LayerKey) => {
    setType(newType);
    standardAttrs.setStatus('active');

    // Automatische suggestie bij laagwissel, maar overschrijfbaar via de checkbox
    standardAttrs.setIsStandalone(newType.toLowerCase() === 'l4');

    mediaCategories.setAlbumInput('');
    mediaCategories.setUnassignedImages([]);
    mediaCategories.setImageInputs(buildImageInputs(undefined, theme, newType));
    dynamicAttrs.setMetadataInputs(buildMetadataInputs(undefined, theme, newType));
    timelineBuilder.setLocalConnections([]);
    timelineBuilder.setLocalTargetConnections([]);
  };

  // Handmatige toggle voor de standalone checkbox in de UI
  const handleStandaloneChange = (checked: boolean) => {
    standardAttrs.setIsStandalone(checked);

    if (checked && !dynamicAttrs.metadataInputs['standaloneStatus']) {
      dynamicAttrs.handleMetadataInputChange('standaloneStatus', 'active');
    }
  };

  // Debounced unique ID check
  useEffect(() => {
    const baseSlug = standardAttrs.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    const suffix = customSuffix.trim() ? customSuffix.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';
    const idToCheck = suffix ? `${baseSlug}-${suffix}` : baseSlug;

    const delayDebounceFn = setTimeout(async () => {
      if (!standardAttrs.name.trim()) {
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
  }, [standardAttrs.name, customSuffix, theme.id]);

  /**
     * Genereert een inline virtuele track/node zonder directe relationele binding,
     * identiek aan de geavanceerde Edit-module functionaliteit.
     */
  const handleCreateNonRelationalTrack = () => {
    const trackName = prompt('Enter custom track or layout display name (e.g. "World Cup Squad", "Independents"):');
    if (!trackName || !trackName.trim()) return;

    const generatedTrackId = `track-virtual-${Date.now()}`;

    // Voeg toe aan de lokale uitgaande connecties binnen de timelineBuilder state
    timelineBuilder.setLocalConnections(prev => [
      ...prev,
      {
        id: Date.now(),
        themeId: theme.id,
        entityId: '',
        sourceEntityId: '',
        targetEntityId: generatedTrackId,
        relatedEntityId: generatedTrackId,
        direction: 'outgoing',
        status: 'active',
        startDate: '',
        endDate: '',
        metadata: {
          status: 'active' // Mocht je applicatie hier runtime op crashen, dan staat er nu iig een fallback
        },
        relatedEntity: {
          id: generatedTrackId,
          themeId: theme.id,
          name: trackName.trim(),
          type: 'l3',
          status: 'active',
          isStandalone: false,
          image: {},
          metadata: {},
          connections: [],
          targetConnections: []
        }
      } as HydratedEntityConnection // <-- De BEVRIJDENDE CAST! Dit stopt de TS-kettingreactie direct.
    ]);
  };

  const reconstructImageObject = (currentInputs: Record<string, string>): Record<string, string | string[]> => {
    const result: Record<string, string | string[]> = {};
    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];
      if (!rawValue || !rawValue.trim()) return;

      const cleanUrls = rawValue.split(/[\s\n,]+/).map(s => s.trim()).filter(Boolean);

      if (cleanUrls.length > 1) {
        result[key] = cleanUrls;
      } else {
        result[key] = cleanUrls[0] || '';
      }
    });
    return result;
  };

  const reconstructObject = (currentInputs: Record<string, string>): Record<string, MetadataValue> => {
    const result: Record<string, MetadataValue> = {};

    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];
      if (!rawValue || !rawValue.trim()) return;

      const lowerKey = key.toLowerCase();

      if (
        lowerKey === 'passingdate' ||
        lowerKey === 'birthday' ||
        lowerKey === 'standalonestartdate' ||
        lowerKey === 'standaloneenddate'
      ) {
        result[key] = rawValue.trim();
        return;
      }

      if (lowerKey === 'nationality' || rawValue.includes(',')) {
        result[key] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if ((lowerKey === 'height' || lowerKey === 'debutyear') && !isNaN(Number(rawValue.trim()))) {
        result[key] = Number(rawValue.trim());
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

    if (!standardAttrs.name.trim()) {
      alert("Please enter a valid name.");
      return;
    }

    if (idStatus === 'taken') {
      alert("Cannot save: This unique ID combination is already taken.");
      return;
    }

    // Valideer de REQUIRED ATTRIBUTES via dezelfde array als de UI (partitionedMetadataKeys.requiredKeys)
    if (type.toLowerCase() === 'l4') {
      const requiredFields = dynamicAttrs.partitionedMetadataKeys.requiredKeys || [];
      for (const field of requiredFields) {
        const value = dynamicAttrs.metadataInputs[field];

        if (!value || !value.trim()) {
          alert(`Validation Error: The field "${field}" is strictly required by the GuessWho game configuration engine.`);
          return;
        }
      }
    }

    // EXTRA VALIDATIE: Als standalone aanstaat, is de Track Start Date verplicht!
    if (standardAttrs.isStandalone) {
      const standaloneStart = dynamicAttrs.metadataInputs['standaloneStartDate'];
      if (!standaloneStart || !standaloneStart.trim()) {
        alert("Validation Error: Track Start Date is required when Standalone Node is enabled.");
        return;
      }
    }

    // Algemene datum-notatie validaties (indien ingevuld)
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    const birthdayKey = Object.keys(dynamicAttrs.metadataInputs).find((k: string) => k.toLowerCase() === 'birthday');
    const birthdayVal = birthdayKey ? dynamicAttrs.metadataInputs[birthdayKey]?.trim() : undefined;
    if (birthdayVal && !dateRegex.test(birthdayVal)) {
      alert("Format Error: Birthday must use the DD-MM-YYYY standard layout.");
      return;
    }

    const passingDateKey = Object.keys(dynamicAttrs.metadataInputs).find((k: string) => k.toLowerCase() === 'passingdate');
    const passingDateVal = passingDateKey ? dynamicAttrs.metadataInputs[passingDateKey]?.trim() : undefined;
    if (passingDateVal && !dateRegex.test(passingDateVal)) {
      alert("Format Error: Passing Date must use the DD-MM-YYYY standard layout.");
      return;
    }

    const baseSlug = standardAttrs.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    const suffix = customSuffix.trim() ? customSuffix.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';
    const generatedId = suffix ? `${baseSlug}-${suffix}` : baseSlug;

    const updatedMetadata = reconstructObject(dynamicAttrs.metadataInputs);
    const updatedImage = reconstructImageObject(mediaCategories.imageInputs);

    if (currentLayerMetadata?.statusTriggers) {
      const triggers = currentLayerMetadata.statusTriggers;
      const matchingTrigger = Object.values(triggers).find(t => t && t.key);
      if (matchingTrigger && standardAttrs.status === matchingTrigger.key) {
        updatedMetadata[matchingTrigger.key] = matchingTrigger.value;
      }
    }

    if (standardAttrs.isStandalone && !updatedMetadata['standaloneStatus']) {
      updatedMetadata['standaloneStatus'] = 'active';
    }

    const newEntitySkeleton: BaseEntity = {
      id: generatedId,
      themeId: theme.id,
      name: standardAttrs.name.trim(),
      type: type,
      status: standardAttrs.status,
      isStandalone: standardAttrs.isStandalone,
      image: updatedImage as BaseEntity['image'],
      metadata: updatedMetadata
    };

    try {
      const savedEntity = await entityService.create(theme.id, newEntitySkeleton);
      window.dispatchEvent(new Event('refresh-database'));

      if (onSave) {
        await onSave({
          ...savedEntity,
          connections: timelineBuilder.localConnections,
          targetConnections: timelineBuilder.localTargetConnections
        });
      }
    } catch {
      alert("Could not persist the new record.");
    }
  };

  return {
    type,
    handleTypeChange,
    customSuffix,
    setCustomSuffix,
    idStatus,
    currentLayerMetadata,
    handleStandaloneChange,

    name: standardAttrs.name,
    setName: standardAttrs.setName,
    status: standardAttrs.status,
    setStatus: standardAttrs.setStatus,
    isStandalone: standardAttrs.isStandalone,

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
    dynamicTriggers: dynamicAttrs.dynamicTriggers,
    triggerFieldsMap: dynamicAttrs.triggerFieldsMap,
    partitionedMetadataKeys: dynamicAttrs.partitionedMetadataKeys,
    handleMetadataInputChange: dynamicAttrs.handleMetadataInputChange,

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
    handleAddImageField: mediaCategories.handleAddImageField,
    handleAddMetadataField: dynamicAttrs.handleAddMetadataField,
    handleRemoveImageField: mediaCategories.handleRemoveImageField,
    handleRemoveMetadataField: dynamicAttrs.handleRemoveMetadataField,
    handleConnectionMetadataChange: timelineBuilder.handleConnectionMetadataChange,
    handleRemoveConnection: timelineBuilder.handleRemoveConnection,
    handleAddConnection: timelineBuilder.handleAddConnection,
    handleParseAlbum: mediaCategories.handleParseAlbum,
    handleAssignImage: mediaCategories.handleAssignImage,
    handleUnassignImage: mediaCategories.handleUnassignImage,
    handleCreateNonRelationalTrack,
    handleSubmit
  };
};