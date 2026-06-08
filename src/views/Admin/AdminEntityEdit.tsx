import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Theme, HydratedEntity, HydratedEntityConnection, BaseEntity } from '../../types';
import { entityService } from './EntityService';

interface Props {
  theme: Theme;
  entityId: string;
  onSave: (updatedEntity: HydratedEntity) => void | Promise<void>;
  onCancel: () => void;
}

interface TriggerConfig {
  key: string;
  value: string;
}

interface LayerConfig {
  badgeKey?: string;
  subtitleKey?: string;
  gridKeys?: string[];
  statusTriggers?: Record<string, TriggerConfig>;
}

interface LayerMetadataMap {
  [layerKey: string]: LayerConfig | undefined;
}

interface UnifiedConnection {
  id: number;
  direction: 'outgoing' | 'incoming';
  relatedEntity: HydratedEntity | undefined;
  relatedEntityId: string;
  status: string;
}

type MetadataValue = string | number | boolean | string[] | undefined;

const LAYER_ORDER: Record<string, number> = { l1: 1, l2: 2, l3: 3, l4: 4 };
const REQUIRED_L4_FIELDS = ['Nationality', 'Role', 'DebutYear', 'Birthday', 'Height'];

export const AdminEntityEdit: React.FC<Props> = ({ theme, entityId, onSave, onCancel }) => {
  const originalEntity = useMemo(() => {
    return (theme.entities || []).find(e => e.id === entityId);
  }, [theme, entityId]);

  // --- Form Local States ---
  const [name, setName] = useState<string>('');
  const [status, setStatus] = useState<string>('active');
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [imageInputs, setImageInputs] = useState<Record<string, string>>({});
  const [metadataInputs, setMetadataInputs] = useState<Record<string, string>>({});
  const [localConnections, setLocalConnections] = useState<HydratedEntityConnection[]>([]);
  const [localTargetConnections, setLocalTargetConnections] = useState<HydratedEntityConnection[]>([]);

  // Referentie-state om prop/data wijzigingen tijdens de render-fase te detecteren
  const [prevEntity, setPrevEntity] = useState<HydratedEntity | null>(null);

  // --- Fast-track Provisioning Pool ---
  const [quickCreatedEntities, setQuickCreatedEntities] = useState<HydratedEntity[]>([]);
  
  // Gecombineerde pool via Derived State
  const entitiesPool = useMemo(() => {
    return [...(theme.entities || []), ...quickCreatedEntities];
  }, [theme.entities, quickCreatedEntities]);

  // --- UI Control States ---
  const [newImageKey, setNewImageKey] = useState<string>('');
  const [newMetadataKey, setNewMetadataKey] = useState<string>('');
  const [quickCreateName, setQuickCreateName] = useState<string>('');
  const [quickCreateLayer, setQuickCreateLayer] = useState<string>('l4');
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);

  const [connectionSearchTerm, setConnectionSearchTerm] = useState<string>('');
  const [isConnectionDropdownOpen, setIsConnectionDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Layer Config Resolution ---
  const layerConfig = useMemo<LayerConfig | undefined>(() => {
    const currentLayer = originalEntity?.type?.toLowerCase() || '';
    if (!theme.layerMetadata) return undefined;
    try {
      const parsedConfig = typeof theme.layerMetadata === 'string'
        ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
        : (theme.layerMetadata as unknown as LayerMetadataMap);
      return parsedConfig[currentLayer];
    } catch (err) {
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

  // --- SYNCHRONISATIE TIJDENS RENDER ---
  if (originalEntity && originalEntity !== prevEntity) {
    setPrevEntity(originalEntity);
    setName(originalEntity.name || '');
    setStatus(originalEntity.status || 'active');
    setIsStandalone(originalEntity.isStandalone || false);

    // Sync Images
    const imgInputs: Record<string, string> = {};
    if (originalEntity.image) {
      Object.entries(originalEntity.image).forEach(([key, val]) => {
        imgInputs[key] = Array.isArray(val) ? val.join(', ') : String(val ?? '');
      });
    }
    setImageInputs(imgInputs);

    // Sync Metadata Framework
    const metaInputs: Record<string, string> = {};
    const currentType = originalEntity.type?.toLowerCase() || '';

    // 1. Garandeer dat verplichte L4 velden altijd als (lege) input bestaan
    if (currentType === 'l4') {
      REQUIRED_L4_FIELDS.forEach(field => {
        metaInputs[field] = '';
      });
    }

    // 2. Bestaande schema-metadata uit lay-out toevoegen
    if (layerConfig) {
      const defaultKeys: string[] = [];
      if (layerConfig.badgeKey) defaultKeys.push(layerConfig.badgeKey);
      if (layerConfig.subtitleKey) defaultKeys.push(layerConfig.subtitleKey);
      if (Array.isArray(layerConfig.gridKeys)) {
        defaultKeys.push(...layerConfig.gridKeys);
      }
      if (layerConfig.statusTriggers) {
        Object.values(layerConfig.statusTriggers).forEach(t => {
          if (t?.key) defaultKeys.push(t.key);
        });
      }
      defaultKeys.forEach((key: string) => {
        if (key) metaInputs[key] = metaInputs[key] !== undefined ? metaInputs[key] : '';
      });
    }

    // 3. Reeds opgeslagen waarden uit database overschrijven over de blauwdruk heen
    if (originalEntity.metadata) {
      Object.entries(originalEntity.metadata).forEach(([key, val]) => {
        metaInputs[key] = Array.isArray(val) ? val.join(', ') : String(val ?? '');
      });
    }
    setMetadataInputs(metaInputs);

    // Sync Relational Connections
    setLocalConnections(originalEntity.connections || []);
    setLocalTargetConnections(originalEntity.targetConnections || []);
  }

  // Scheiding van velden voor de interface om Required en Dynamic los te koppelen
  const partitionedMetadataKeys = useMemo(() => {
    const allKeys = Object.keys(metadataInputs);
    const isL4 = originalEntity?.type?.toLowerCase() === 'l4';

    return {
      requiredKeys: allKeys.filter(key => isL4 && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())),
      dynamicKeys: allKeys.filter(key => !(isL4 && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())))
    };
  }, [metadataInputs, originalEntity?.type]);

  // --- Target Filter Logic ---
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

  if (!originalEntity) {
    return <div style={{ color: 'red', padding: '20px' }}>Target entity record not found.</div>;
  }

  // --- Handlers ---
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
    if (!cleanKey || metadataInputs[cleanKey] !== undefined) return;
    
    if (originalEntity.type.toLowerCase() === 'l4' && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === cleanKey.toLowerCase())) {
      alert(`Field "${cleanKey}" is already configured inside the required system attributes.`);
      return;
    }

    setMetadataInputs(prev => ({ ...prev, [cleanKey]: '' }));
    setNewMetadataKey('');
  };

  const handleRemoveImageField = (key: string) => {
    setImageInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const handleRemoveMetadataField = (key: string) => {
    if (originalEntity.type.toLowerCase() === 'l4' && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
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
    if (!selectedEntityId) return;

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

  const handleInlineQuickCreate = async (): Promise<void> => {
    if (!quickCreateName.trim()) return;
    const baseSlug = quickCreateName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const generatedId = `${baseSlug}-${randomSuffix}`;

    const newSkeletonEntity: BaseEntity = {
      id: generatedId,
      themeId: theme.id,
      name: quickCreateName,
      type: quickCreateLayer,
      status: 'active',
      isStandalone: quickCreateLayer === 'l4',
      image: { profileCard: '', heroBanner: '' },
      metadata: {}
    };

    try {
      const savedEntityFromDb: HydratedEntity = await entityService.create(theme.id, newSkeletonEntity);
      setQuickCreatedEntities(prev => [...prev, savedEntityFromDb]);

      const allExistingIds = [
        ...localConnections.map(c => c.id),
        ...localTargetConnections.map(c => c.id)
      ];
      const maxId = allExistingIds.length > 0 ? Math.max(...allExistingIds) : 0;

      const newConn: HydratedEntityConnection = {
        id: maxId + 1,
        themeId: theme.id,
        sourceEntityId: originalEntity.id,
        targetEntityId: savedEntityFromDb.id,
        metadata: { status: 'active' },
        targetEntity: savedEntityFromDb
      };

      setLocalConnections(prev => [...prev, newConn]);
      setQuickCreateName('');
      window.dispatchEvent(new Event('refresh-database'));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(errorMessage);
      alert("Failed to quickly provision the requested entity record.");
    }
  };

  const reconstructObject = (
    currentInputs: Record<string, string>,
    originalObject: Record<string, unknown>
  ): Record<string, MetadataValue> => {
    const result: Record<string, MetadataValue> = {};
    const isL4 = originalEntity.type.toLowerCase() === 'l4';

    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];
      const originalValue = originalObject ? originalObject[key] : undefined;

      if (!rawValue.trim()) return;

      if (key.toLowerCase() === 'nationality' || rawValue.includes(',')) {
        result[key] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if (isL4 && (key.toLowerCase() === 'height' || key.toLowerCase() === 'debutyear')) {
        result[key] = Number(rawValue.trim()) || 0;
      } else if (typeof originalValue === 'number') {
        result[key] = Number(rawValue) || 0;
      } else if (typeof originalValue === 'boolean') {
        result[key] = rawValue.toLowerCase() === 'true';
      } else {
        result[key] = rawValue;
      }
    });
    return result;
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!name.trim()) {
      alert("Please enter a valid name.");
      return;
    }

    // Valideer L4 specifieke vereisten analoog aan de Create pagina logica
    if (originalEntity.type.toLowerCase() === 'l4') {
      for (const field of REQUIRED_L4_FIELDS) {
        if (!metadataInputs[field] || !metadataInputs[field].trim()) {
          alert(`Game Error: The field "${field}" is strictly required for Layer 4 entities.`);
          return;
        }
      }

      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(metadataInputs['Birthday'].trim())) {
        alert("Format Error: Birthday must use the DD-MM-YYYY standard layout (e.g., 25-04-1947).");
        return;
      }

      if (isNaN(Number(metadataInputs['Height'].trim()))) {
        alert("Format Error: Height must be a valid numeric configuration in cm (e.g., 184).");
        return;
      }

      if (isNaN(Number(metadataInputs['DebutYear'].trim()))) {
        alert("Format Error: Debut Year must be a valid numeric configuration year (e.g., 2015).");
        return;
      }
    }

    const updatedMetadata = reconstructObject(metadataInputs, originalEntity.metadata || {});

    if (dynamicTriggers[status]) {
      const trigger = dynamicTriggers[status];
      updatedMetadata[trigger.key] = trigger.value;
    }

    const updatedEntity: HydratedEntity = {
      ...originalEntity,
      name: name.trim(),
      status,
      isStandalone,
      image: imageInputs as Record<string, string | string[] | undefined> as HydratedEntity['image'],
      metadata: updatedMetadata as Record<string, string | number | boolean | string[] | undefined> as HydratedEntity['metadata'],
      connections: localConnections,
      targetConnections: localTargetConnections
    };

    try {
      if (onSave) {
        await onSave(updatedEntity);
      }
    } catch (err) {
      console.error(err);
      alert("Could not update the entity modifications inside the database engine.");
    }
  };

  return (
    <div style={{ padding: '20px', background: '#1e1e1e', color: '#fff', borderRadius: '8px', marginBottom: '20px', border: '2px solid #deff9a' }}>
      <h2>Modify {originalEntity.type.toUpperCase()}: <span style={{ color: '#deff9a' }}>{name}</span></h2>

      {/* Core Base Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px', marginBottom: '25px' }}>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Name</div>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
        </div>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Status</div>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
            <option value="active">Active</option>
            <option value="disbanded">Disbanded</option>
            <option value="inactive">Inactive</option>
            <option value="retired">Retired</option>
            {Object.entries(dynamicTriggers).map(([triggerKey, triggerConfig]) => (
              <option key={triggerKey} value={triggerKey}>
                {triggerConfig.value.charAt(0).toUpperCase() + triggerConfig.value.slice(1)} (Schema Trigger)
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Standalone Node</div>
          <input type="checkbox" checked={isStandalone} onChange={e => setIsStandalone(e.target.checked)} style={{ marginTop: '14px', transform: 'scale(1.4)' }} />
        </div>
      </div>

      {/* SECTIE A: CORE REQUIRED GAME FIELDS (Zichtbaar bij Layer 4) */}
      {originalEntity.type.toLowerCase() === 'l4' && partitionedMetadataKeys.requiredKeys.length > 0 && (
        <div style={{ border: '2px dashed #ffb300', padding: '15px', borderRadius: '6px', marginBottom: '25px', background: '#2e2516' }}>
          <h3 style={{ margin: '0 0 5px 0', color: '#ffb300' }}>🔒 Required Game Metrics (Layer 4 Core)</h3>
          <p style={{ fontSize: '12px', color: '#ccc', margin: '0 0 15px 0' }}>These attributes are strictly required by the GuessWho game configuration engine.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {partitionedMetadataKeys.requiredKeys.map(key => (
              <div key={key}>
                <div style={{ marginBottom: '5px', fontSize: '13px', color: '#ffb300', fontWeight: 'bold' }}>
                  {key} {key.toLowerCase() === 'nationality' && <small style={{ color: '#aaa' }}>(Comma separated list)</small>}
                </div>
                <input
                  type="text"
                  placeholder={key.toLowerCase() === 'birthday' ? 'DD-MM-YYYY' : `Enter required ${key}`}
                  value={metadataInputs[key] || ''}
                  onChange={e => handleMetadataInputChange(key, e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #ffb300', borderRadius: '4px' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTIE B: DYNAMIC THEME ATTRIBUTES */}
      <h3>🛠️ Dynamic Attributes (Populated via {originalEntity.type.toUpperCase()} Theme Schema)</h3>
      <div style={{ background: '#151515', padding: '15px', borderRadius: '6px', marginBottom: '25px' }}>
        {partitionedMetadataKeys.dynamicKeys.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', margin: '0' }}>No specific layout metadata schema properties injected for this layer. Append custom fields below:</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {partitionedMetadataKeys.dynamicKeys.map(key => {
              const triggerValues = triggerFieldsMap[key];
              const isList = key.toLowerCase() === 'nationality' || (metadataInputs[key] && metadataInputs[key].includes(','));

              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px', color: '#deff9a' }}>
                    <span>
                      {key} 
                      {isList && <small style={{ color: '#888' }}> (Array List)</small>}
                      {triggerValues && <small style={{ color: '#ffb300' }}> (Schema Controlled 🔒)</small>}
                    </span>
                    <button type="button" onClick={() => handleRemoveMetadataField(key)} style={{ background: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0 }}>Remove</button>
                  </div>

                  {triggerValues ? (
                    <select
                      value={metadataInputs[key]}
                      onChange={e => handleMetadataInputChange(key, e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                    >
                      <option value="">-- Active / Normal --</option>
                      {triggerValues.map(val => (
                        <option key={val} value={val}>
                          {val.charAt(0).toUpperCase() + val.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={metadataInputs[key] || ''} 
                      onChange={e => handleMetadataInputChange(key, e.target.value)} 
                      style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} 
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center', background: '#222', padding: '10px', borderRadius: '4px' }}>
          <input type="text" placeholder="e.g., Twitter, Instagram or SquadNumber" value={newMetadataKey} onChange={e => setNewMetadataKey(e.target.value)} style={{ padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', flex: 1 }} />
          <button type="button" onClick={handleAddMetadataField} style={{ background: '#deff9a', color: '#000', border: 'none', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}>Add Attribute Property</button>
        </div>
      </div>

      {/* Media Assets */}
      <h3>Media Assets</h3>
      <div style={{ background: '#151515', padding: '15px', borderRadius: '6px', marginBottom: '25px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {Object.keys(imageInputs).map(key => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px', color: '#b3e5fc' }}>
                <span>{key} {Array.isArray(originalEntity.image?.[key]) && <small style={{ color: '#888' }}>(Array List)</small>}</span>
                <button type="button" onClick={() => handleRemoveImageField(key)} style={{ background: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0 }}>Remove</button>
              </div>
              <input type="text" value={imageInputs[key]} onChange={e => handleImageInputChange(key, e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center', background: '#222', padding: '10px', borderRadius: '4px' }}>
          <input type="text" placeholder="e.g., streamingTeaser or liveries" value={newImageKey} onChange={e => setNewImageKey(e.target.value)} style={{ padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', flex: 1 }} />
          <button type="button" onClick={handleAddImageField} style={{ background: '#b3e5fc', color: '#000', border: 'none', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}>Add Asset Field</button>
        </div>
      </div>

      {/* Mapped Registry Entity Connections */}
      <h3>Mapped Registry Entity Connections (Direction Agnostic)</h3>
      <div style={{ background: '#2d2d2d', padding: '15px', borderRadius: '6px', marginBottom: '25px' }}>
        {unifiedConnections.map(conn => {
          const isL4ToL4 = originalEntity.type.toLowerCase() === 'l4' && conn.relatedEntity?.type?.toLowerCase() === 'l4';
          const isExpanded = expandedChildId === conn.relatedEntityId;

          return (
            <div key={conn.id} style={{ borderBottom: '1px solid #444', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedChildId(isExpanded ? null : conn.relatedEntityId)}
                    style={{ background: isExpanded ? '#555' : '#444', color: '#deff9a', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                  <span style={{ background: conn.direction === 'incoming' ? '#2e4053' : '#1e3f20', color: '#fff', padding: '2px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>
                    {conn.direction === 'incoming' ? 'INBOUND' : 'OUTBOUND'}
                  </span>
                  <span style={{ background: '#151515', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', color: '#aaa' }}>
                    {conn.relatedEntity?.type?.toUpperCase() || 'L4'}
                  </span>
                  <strong style={{ color: '#deff9a' }}>{conn.relatedEntity?.name || conn.relatedEntityId}</strong>
                  {isL4ToL4 && (
                    <span style={{ color: '#ffb300', fontSize: '12px', marginLeft: '5px' }}>Cross-individual connection (L4 to L4 Peer)</span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    value={conn.status}
                    onChange={e => handleConnectionStatusChange(conn.id, e.target.value)}
                    style={{ padding: '6px 10px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                  >
                    <option value="active">Active</option>
                    <option value="former">Former</option>
                    <option value="inactive">Inactive</option>
                    <option value="retired">Retired</option>
                  </select>
                  <button type="button" onClick={() => handleRemoveConnection(conn.id)} style={{ background: '#ff4d4d', color: '#fff', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>
                    Unlink
                  </button>
                </div>
              </div>

              {isExpanded && conn.relatedEntity && (
                <div style={{ marginTop: '15px', padding: '15px', background: '#151515', borderRadius: '6px', borderLeft: '4px solid #deff9a' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#b3e5fc' }}>Inline sub-modification portal for: {conn.relatedEntity.name}</h4>
                  <AdminEntityEdit
                    theme={theme}
                    entityId={conn.relatedEntityId}
                    onSave={async (updatedChild) => {
                      try {
                        await entityService.update(theme.id, updatedChild.id, updatedChild);
                        setQuickCreatedEntities(prev => prev.map(e => e.id === updatedChild.id ? updatedChild : e));
                        setLocalConnections(prev => prev.map(c => c.targetEntityId === updatedChild.id ? { ...c, targetEntity: updatedChild } : c));
                        setLocalTargetConnections(prev => prev.map(c => c.sourceEntityId === updatedChild.id ? { ...c, sourceEntity: updatedChild } : c));
                        window.dispatchEvent(new Event('refresh-database'));
                        setExpandedChildId(null);
                      } catch (err) {
                        console.error("Failed to update child relational parameters:", err);
                        alert("Could not update the downstream relational entity in the repository.");
                      }
                    }}
                    onCancel={() => setExpandedChildId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}

        <div ref={dropdownRef} style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #555', position: 'relative' }}>
          <div style={{ display: 'block', fontSize: '13px', marginBottom: '5px', color: '#aaa' }}>
            Link Existing Component Entity Record (Search by Name, Layer or ID)
          </div>
          <input
            type="text"
            placeholder="Type to search entities... (e.g. L3, Team Name)"
            value={connectionSearchTerm}
            onFocus={() => setIsConnectionDropdownOpen(true)}
            onChange={e => {
              setConnectionSearchTerm(e.target.value);
              setIsConnectionDropdownOpen(true);
            }}
            style={{ width: '100%', padding: '10px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }}
          />

          {isConnectionDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '250px', overflowY: 'auto', background: '#1e1e1e', border: '1px solid #444', borderRadius: '4px', marginTop: '5px', zIndex: 999, boxShadow: '0px 4px 12px rgba(0,0,0,0.5)' }}>
              {filteredAvailableTargets.length > 0 ? (
                filteredAvailableTargets.map(t => (
                  <div
                    key={t.id}
                    onClick={() => {
                      handleAddConnection(t.id);
                      setConnectionSearchTerm('');
                      setIsConnectionDropdownOpen(false);
                    }}
                    style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #2d2d2d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#252525' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#2d2d2d')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#252525')}
                  >
                    <span style={{ color: '#fff', fontWeight: '500' }}>{t.name}</span>
                    <span style={{ background: '#151515', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', color: '#aaa' }}>{t.type.toUpperCase()}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px 15px', color: '#888', fontStyle: 'italic', background: '#252525' }}>No matching entities found in workspace...</div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: '#222', borderRadius: '6px', border: '1px dashed #444' }}>
          <div style={{ display: 'block', fontSize: '13px', marginBottom: '8px', color: '#b3e5fc', fontWeight: 'bold' }}>Fast-track Provisioning: Create New Entity & Link Instantly</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="Entry Name" value={quickCreateName} onChange={e => setQuickCreateName(e.target.value)} style={{ flex: 2, padding: '8px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
            <select value={quickCreateLayer} onChange={e => setQuickCreateLayer(e.target.value)} style={{ flex: 1, padding: '8px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
              <option value="l2">Layer 2 (Governing Body / Association)</option>
              <option value="l3">Layer 3 (Team / Club / Constructor)</option>
              <option value="l4">Layer 4 (Driver / Player / Individual)</option>
            </select>
            <button type="button" onClick={() => { void handleInlineQuickCreate(); }} style={{ background: '#b3e5fc', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}>Provision Record</button>
          </div>
        </div>
      </div>

      {/* Action Footers */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 20px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
        <button type="button" onClick={(e) => { void handleSubmit(e); }} style={{ padding: '10px 20px', background: '#deff9a', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Save Commit Changes</button>
      </div>
    </div>
  );
};