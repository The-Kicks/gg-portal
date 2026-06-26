import { useMemo, useEffect, } from 'react';
import type { Theme, HydratedEntity, HydratedEntityConnection } from '../../../types';

import { useStandardEntityAttributes } from '../adminUtils/useStandardEntityAttributes';
import { useDynamicAttributes, buildMetadataInputs, REQUIRED_L4_FIELDS } from '../adminUtils/useDynamicAttributes';
import type { MetadataValue, LayerMetadataMap } from '../adminUtils/useDynamicAttributes';
import { useMediaCategories, buildImageInputs } from '../adminUtils/useMediaCategories';
import { useTimelineBuilder } from '../adminUtils/useTimelineBuilder';

interface UseAdminEntityEditProps {
  theme: Theme;
  entityId: string;
  onSave: (updatedEntity: HydratedEntity) => void | Promise<void>;
}

interface MilestoneStructure {
  date: string;
  title: string;
}

export const useAdminEntityEdit = ({ theme, entityId, onSave }: UseAdminEntityEditProps) => {
  const originalEntity = useMemo(() => {
    return (theme.entities || []).find(e => e.id === entityId);
  }, [theme.entities, entityId]);

  const standardAttrs = useStandardEntityAttributes(originalEntity);
  const dynamicAttrs = useDynamicAttributes(originalEntity, theme);
  const mediaCategories = useMediaCategories(originalEntity, theme, dynamicAttrs.layerConfig);
  const timelineBuilder = useTimelineBuilder(originalEntity, theme, entityId);

  // Parse de complete layermetadata map één keer centraal
  const parsedLayerMetadata = useMemo<LayerMetadataMap>(() => {
    if (!theme.layerMetadata) return {};
    try {
      return typeof theme.layerMetadata === 'string'
        ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
        : (theme.layerMetadata as unknown as LayerMetadataMap);
    } catch (error) {
      console.error("Fout bij het parsen van layerMetadata:", error);
      return {};
    }
  }, [theme.layerMetadata]);

  // Dynamische helper om de triggers op te halen op basis van het type van het doelwit (bijv. 'l4')
  const getTriggersForTargetType = (targetType: string | undefined): string[] => {
    const typeKey = (targetType || 'l4').toLowerCase();
    const config = parsedLayerMetadata[typeKey];
    if (!config || !config.statusTriggers) return [];

    return Object.values(config.statusTriggers)
      .map((t) => t?.value)
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  };

  // Helper om milestones tekst om te zetten naar [{date, title}]
  const parseAdminMilestones = (rawText: unknown): MilestoneStructure[] => {
    if (Array.isArray(rawText)) {
      return rawText as MilestoneStructure[];
    }

    if (typeof rawText !== 'string' || !rawText.trim()) return [];

    const lines = rawText.split('\n');
    return lines
      .map(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return null;

        const match = cleanLine.match(/^([\d-]+)[\s:-]+(.*)$/);
        if (match) {
          return {
            date: match[1].trim(),
            title: match[2].trim()
          };
        }
        return {
          date: '',
          title: cleanLine
        };
      })
      .filter((m): m is MilestoneStructure => m !== null);
  };

  const formatMilestonesToText = (milestones: unknown): string => {
    if (!milestones) return '';
    if (typeof milestones === 'string') return milestones;

    if (Array.isArray(milestones)) {
      return milestones
        .map(m => {
          if (m && typeof m === 'object') {
            const typed = m as Partial<MilestoneStructure>;
            const date = typed.date ? String(typed.date).trim() : '';
            const title = typed.title ? String(typed.title).trim() : '';
            if (date && title) return `${date}: ${title}`;
            return title || date;
          }
          return String(m);
        })
        .filter(Boolean)
        .join('\n');
    }
    return '';
  };

  const handleSyncMilestones = () => {
    const rawL3Milestones = dynamicAttrs.metadataInputs['l3Milestones'] || '';
    if (!rawL3Milestones.trim()) return;

    const milestoneLines = rawL3Milestones
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const outgoingConnections = timelineBuilder.unifiedConnections.filter(conn => conn.direction === 'outgoing');

    outgoingConnections.forEach(conn => {
      const currentRelationText = formatMilestonesToText(conn.metadata?.milestones);
      if (currentRelationText.trim().length > 0) return;

      const startYear = conn.startDate ? parseInt(conn.startDate, 10) : null;
      if (!startYear || isNaN(startYear)) return;

      const currentYear = 2026;
      const endYear = conn.endDate && !conn.endDate.toLowerCase().includes('pres')
        ? parseInt(conn.endDate, 10)
        : currentYear;

      const matchedMilestones = milestoneLines.filter(line => {
        const yearMatch = line.match(/^(\d{4})/) || line.match(/\d{2}-\d{2}-(\d{4})/);
        if (!yearMatch) return false;

        const milestoneYear = parseInt(yearMatch[1], 10);
        return milestoneYear >= startYear && milestoneYear <= endYear;
      });

      if (matchedMilestones.length > 0) {
        const updatedText = matchedMilestones.join('\n');

        timelineBuilder.handleConnectionMetadataChange(
          conn.id,
          conn.direction,
          'milestones',
          updatedText as unknown as Parameters<typeof timelineBuilder.handleConnectionMetadataChange>[3]
        );
      }
    });
  };

  useEffect(() => {
    if (!originalEntity) return;

    standardAttrs.resetStandardAttributes(originalEntity);
    mediaCategories.setAlbumInput('');
    mediaCategories.setUnassignedImages([]);
    mediaCategories.setImageInputs(buildImageInputs(originalEntity, theme));

    const cleanInputs = buildMetadataInputs(originalEntity, theme);
    const rawMetadata = originalEntity.metadata as Record<string, unknown> | undefined;

    if (rawMetadata && rawMetadata['l3Milestones']) {
      cleanInputs['l3Milestones'] = formatMilestonesToText(rawMetadata['l3Milestones']);
    }

    Object.keys(cleanInputs).forEach(key => {
      if (key === 'customTracks' || key === 'l3Milestones') {
        return;
      }
      if (rawMetadata && typeof rawMetadata[key] === 'object' && rawMetadata[key] !== null && !Array.isArray(rawMetadata[key])) {
        delete cleanInputs[key];
      }
    });

    dynamicAttrs.setMetadataInputs(cleanInputs);
    timelineBuilder.setLocalConnections(originalEntity.connections || []);
    timelineBuilder.setLocalTargetConnections(originalEntity.targetConnections || []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, theme]);

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

      if (key === 'l3Milestones') return;

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

    const fixDate = (str: string | undefined): string => {
      if (!str) return '';
      const clean = str.trim();
      if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) return clean;
      const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) return `${match[3]}-${match[2]}-${match[1]}`;
      if (/^\d{4}$/.test(clean)) return `01-01-${clean}`;
      return clean;
    };

    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

    const finalConnections: HydratedEntityConnection[] = timelineBuilder.localConnections.map(c => {
      const start = fixDate(c.metadata?.startDate);
      const end = c.metadata?.endDate && !c.metadata.endDate.toLowerCase().includes('pres') ? fixDate(c.metadata.endDate) : c.metadata?.endDate || '';

      if (start && !dateRegex.test(start)) alert("Startdatum kon niet worden omgezet naar DD-MM-YYYY.");
      if (end && !end.toLowerCase().includes('pres') && !dateRegex.test(end)) alert("Einddatum moet DD-MM-YYYY of 'Pres.' zijn.");

      return {
        ...c,
        metadata: {
          ...c.metadata,
          status: c.metadata?.status || 'active',
          startDate: start,
          endDate: end,
          milestones: parseAdminMilestones(c.metadata?.milestones)
        }
      };
    });

    const finalTargetConnections: HydratedEntityConnection[] = timelineBuilder.localTargetConnections.map(c => {
      const start = fixDate(c.metadata?.startDate);
      const end = c.metadata?.endDate && !c.metadata.endDate.toLowerCase().includes('pres') ? fixDate(c.metadata.endDate) : c.metadata?.endDate || '';

      return {
        ...c,
        metadata: {
          ...c.metadata,
          status: c.metadata?.status || 'active',
          startDate: start,
          endDate: end,
          milestones: parseAdminMilestones(c.metadata?.milestones)
        }
      };
    });

    const metadataInputsCopy = { ...dynamicAttrs.metadataInputs };

    if (originalEntity.type.toLowerCase() === 'l4') {
      for (const field of REQUIRED_L4_FIELDS) {
        const foundKey = Object.keys(metadataInputsCopy).find(k => k.toLowerCase() === field.toLowerCase());
        const value = foundKey ? metadataInputsCopy[foundKey] : undefined;

        if (!value || !value.trim()) {
          alert(`Game Error: The field "${field}" is strictly required for Layer 4 entities.`);
          return;
        }
      }

      if (metadataInputsCopy['Birthday']) metadataInputsCopy['Birthday'] = fixDate(metadataInputsCopy['Birthday']);

      const passingDateKey = Object.keys(metadataInputsCopy).find(k => k.toLowerCase() === 'passingdate');
      if (passingDateKey && metadataInputsCopy[passingDateKey]) {
        metadataInputsCopy[passingDateKey] = fixDate(metadataInputsCopy[passingDateKey]);
      }

      if (!dateRegex.test(metadataInputsCopy['Birthday']?.trim() || '')) {
        alert("Format Error: Birthday must use the DD-MM-YYYY standard layout.");
        return;
      }

      const passingDate = passingDateKey ? metadataInputsCopy[passingDateKey]?.trim() : undefined;
      if (passingDate && !dateRegex.test(passingDate)) {
        alert("Format Error: Passing Date must use the DD-MM-YYYY standard layout.");
        return;
      }

      if (isNaN(Number(metadataInputsCopy['Height']?.trim()))) {
        alert("Format Error: Height must be a number.");
        return;
      }
      if (isNaN(Number(metadataInputsCopy['DebutYear']?.trim()))) {
        alert("Format Error: Debut Year must be a number.");
        return;
      }
    }

    const rebuiltMetadata = reconstructObject(metadataInputsCopy, (originalEntity.metadata || {}) as Record<string, unknown>);

    const updatedMetadata: Record<string, MetadataValue> = {
      ...rebuiltMetadata,
      customTracks: (originalEntity.metadata as Record<string, unknown> | undefined)?.customTracks as MetadataValue || []
    };

    if (originalEntity.type.toLowerCase() === 'l3' && metadataInputsCopy['l3Milestones']) {
      updatedMetadata['l3Milestones'] = parseAdminMilestones(metadataInputsCopy['l3Milestones']) as unknown as MetadataValue;
    }

    const updatedImage = reconstructImageObject(mediaCategories.imageInputs, (originalEntity.image || {}) as Record<string, unknown>);

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
      connections: finalConnections,
      targetConnections: finalTargetConnections
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
    getTriggersForTargetType,
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
    handleConnectionMetadataChange: timelineBuilder.handleConnectionMetadataChange as (
      id: number,
      direction: 'outgoing' | 'incoming',
      key: string,
      value: string | { start: string; end: string; reason: string }[]
    ) => void,
    handleRemoveConnection: timelineBuilder.handleRemoveConnection,
    handleCreateNonRelationalTrack: timelineBuilder.handleCreateNonRelationalTrack,
    handleApplyConnection: timelineBuilder.handleAddConnection,
    handleAssignImage: mediaCategories.handleAssignImage,
    handleUnassignImage: mediaCategories.handleUnassignImage,

    formatMilestonesToText,
    handleSyncMilestones,
    handleSubmit
  };
};