import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Theme, HydratedEntity, HydratedEntityConnection } from '../../../types';

export interface UnifiedConnection {
  id: number;
  direction: 'outgoing' | 'incoming';
  relatedEntity: HydratedEntity | undefined;
  relatedEntityId: string;
  status: string;
  startDate?: string;
  endDate?: string;
  metadata?: {
    isNonRelational?: boolean;
    customTargetName?: string;
    milestones?: string;
    [key: string]: unknown;
  };
}

export const LAYER_ORDER: Record<string, number> = { l1: 1, l2: 2, l3: 3, l4: 4 };

/**
 * Governs the multi-directional entity relational connections, filtering, and event indexing maps.
 */
export const useTimelineBuilder = (
  originalEntity: HydratedEntity | undefined,
  theme: Theme,
  entityId: string,
  overrideType?: string
) => {
  const currentType = overrideType || originalEntity?.type || 'l4';

  const [localConnections, setLocalConnections] = useState<HydratedEntityConnection[]>(() => originalEntity?.connections || []);
  const [localTargetConnections, setLocalTargetConnections] = useState<HydratedEntityConnection[]>(() => originalEntity?.targetConnections || []);
  const [connectionSearchTerm, setConnectionSearchTerm] = useState<string>('');
  const [isConnectionDropdownOpen, setIsConnectionDropdownOpen] = useState<boolean>(false);
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const entitiesPool = useMemo(() => {
    return theme.entities || [];
  }, [theme.entities]);

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
    // Wijzig dit in useTimelineBuilder.ts in de unifiedConnections useMemo:

    const outgoing = localConnections.map(c => ({
      id: c.id,
      direction: 'outgoing' as const,
      relatedEntity: c.targetEntity,
      relatedEntityId: c.targetEntityId,
      status: String(c.metadata?.status || 'active').toLowerCase(), // <-- Alleen metadata check + toLowerCase
      startDate: c.metadata?.startDate ? String(c.metadata.startDate) : undefined,
      endDate: c.metadata?.endDate ? String(c.metadata.endDate) : undefined,
      metadata: c.metadata
    }));

    const incoming = localTargetConnections.map(c => ({
      id: c.id,
      direction: 'incoming' as const,
      relatedEntity: c.sourceEntity,
      relatedEntityId: c.sourceEntityId,
      status: String(c.metadata?.status || 'active').toLowerCase(), // <-- Alleen metadata check + toLowerCase
      startDate: c.metadata?.startDate ? String(c.metadata.startDate) : undefined,
      endDate: c.metadata?.endDate ? String(c.metadata.endDate) : undefined,
      metadata: c.metadata
    }));

    return [...outgoing, ...incoming].sort((a, b) => {
      const typeA = a.relatedEntity?.type?.toLowerCase() || 'l4';
      const typeB = b.relatedEntity?.type?.toLowerCase() || 'l4';
      return (LAYER_ORDER[typeA] || 99) - (LAYER_ORDER[typeB] || 99);
    });
  }, [localConnections, localTargetConnections]);

  const handleConnectionMetadataChange = useCallback((
    connId: number,
    direction: 'outgoing' | 'incoming',
    key: string,
    value: string
  ) => {
    const updateTargetList = (prev: HydratedEntityConnection[]) =>
      prev.map(c => (c.id === connId ? { ...c, metadata: { ...c.metadata, [key]: value } } : c));

    if (direction === 'outgoing') {
      setLocalConnections(updateTargetList);
    } else {
      setLocalTargetConnections(updateTargetList);
    }
  }, []);

  const handleRemoveConnection = useCallback((connId: number, direction: 'outgoing' | 'incoming') => {
    if (direction === 'outgoing') {
      setLocalConnections(prev => prev.filter(c => c.id !== connId));
    } else {
      setLocalTargetConnections(prev => prev.filter(c => c.id !== connId));
    }
  }, []);

  /**
   * Genereert een deterministische virtuele slug ID zodat meerdere idols/coureurs
   * aan exact dezelfde custom track gekoppeld kunnen worden.
   */
  const handleCreateNonRelationalTrack = useCallback((trackName: string) => {
    if (!trackName.trim()) return;

    const trackSlug = trackName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const sharedVirtualId = `virtual-track:${trackSlug}`;

    const exists = unifiedConnections.some(c => c.relatedEntityId === sharedVirtualId);
    if (exists) {
      alert(`This entity is already connected to "${trackName}"`);
      return;
    }

    const connectionId = -1 - Math.floor(Math.random() * 1000000);

    const newCustomOutgoing: HydratedEntityConnection = {
      id: connectionId,
      themeId: theme.id,
      sourceEntityId: entityId,
      targetEntityId: sharedVirtualId,
      metadata: {
        status: 'active',
        startDate: '',
        endDate: '',
        excludedPeriods: '', // <-- TOEGEVOEGD
        isNonRelational: true,
        customTargetName: trackName,
        milestones: ''
      },
      targetEntity: undefined
    };

    setLocalConnections(prev => [...prev, newCustomOutgoing]);
  }, [unifiedConnections, theme.id, entityId]);

  const handleAddConnection = useCallback((selectedEntityId: string) => {
    if (!selectedEntityId) return;

    const selectedNode = entitiesPool.find(e => e.id === selectedEntityId);
    if (!selectedNode) return;

    const isAlreadyLinked = unifiedConnections.some(c => c.relatedEntityId === selectedEntityId);
    if (isAlreadyLinked) {
      alert("This entity is already connected.");
      return;
    }

    const currentLayerLevel = LAYER_ORDER[currentType.toLowerCase()] || 99;
    const selectedLayerLevel = LAYER_ORDER[selectedNode.type.toLowerCase()] || 99;

    const connectionId = -1 - Math.floor(Math.random() * 1000000);
    // Voeg hier excludedPeriods toe aan de basis metadata van een nieuwe connectie
    const baseMeta = { status: 'active', startDate: '', endDate: '', excludedPeriods: '' }; // <-- AANGEPAST

    if (currentLayerLevel <= selectedLayerLevel) {
      const newOutgoingConn: HydratedEntityConnection = {
        id: connectionId,
        themeId: theme.id,
        sourceEntityId: entityId,
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
        targetEntityId: entityId,
        metadata: baseMeta,
        sourceEntity: selectedNode
      };
      setLocalTargetConnections(prev => [...prev, newIncomingConn]);
    }
  }, [entitiesPool, unifiedConnections, theme.id, currentType, entityId]);

  return {
    localConnections,
    setLocalConnections,
    localTargetConnections,
    setLocalTargetConnections,
    connectionSearchTerm,
    setConnectionSearchTerm,
    isConnectionDropdownOpen,
    setIsConnectionDropdownOpen,
    expandedChildId,
    setExpandedChildId,
    dropdownRef,
    filteredAvailableTargets,
    unifiedConnections,
    handleConnectionMetadataChange,
    handleRemoveConnection,
    handleCreateNonRelationalTrack,
    handleAddConnection
  };
};