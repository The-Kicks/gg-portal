import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Theme, HydratedEntity, HydratedEntityConnection } from '../../types';
import { entityService } from './EntityService';
import styles from './AdminGlobal.module.css';

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
  mediaKeys?: string[];
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
const CORE_IMAGE_FIELDS = ['profileCard', 'heroBanner'];

export const AdminEntityEdit: React.FC<Props> = ({ theme, entityId, onSave, onCancel }) => {
  const originalEntity = useMemo(() => {
    return (theme.entities || []).find(e => e.id === entityId);
  }, [theme, entityId]);

  // --- LAZY STATE INITIALIZATION ---
  const [name, setName] = useState<string>(() => originalEntity?.name || '');
  const [status, setStatus] = useState<string>(() => originalEntity?.status || 'active');
  const [isStandalone, setIsStandalone] = useState<boolean>(() => originalEntity?.isStandalone || false);

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

  // --- UI Control States ---
  const [newImageKey, setNewImageKey] = useState<string>('');
  const [newMetadataKey, setNewMetadataKey] = useState<string>('');
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
    if (!cleanKey) return;

    if (metadataInputs[cleanKey] !== undefined) {
      alert("Dit veld bestaat al.");
      return;
    }

    const isCoreField = REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === cleanKey.toLowerCase());
    if (isCoreField) {
      alert(`Het veld "${cleanKey}" is een gereserveerd systeem-veld (Core Game Metric). Je kunt deze niet toevoegen als dynamisch attribuut.`);
      return;
    }

    setMetadataInputs(prev => ({ ...prev, [cleanKey]: '' }));
    setNewMetadataKey('');
  };

  const handleRemoveImageField = (key: string) => {
    if (CORE_IMAGE_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
      alert(`Het veld "${key}" is een verplicht systeem-veld (Core Media Asset) en kan niet worden verwijderd.`);
      return;
    }

    if (layerConfig?.mediaKeys?.includes(key)) {
      if (!window.confirm(`Veld "${key}" is onderdeel van het themaschema. Weet je zeker dat je dit invoerveld wilt verwijderen?`)) return;
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
    } catch (err) {
      console.error(err);
      alert("Could not update the entity modifications.");
    }
  };

  if (!originalEntity) {
    return <div style={{ color: 'red', padding: '20px' }}>Target entity record not found.</div>;
  }

  return (
    <div className={styles.formCard}>
      <h2 className={styles.formCardTitle}>
        Modify {originalEntity.type.toUpperCase()}: <span className={styles.textPrimary}>{name}</span>
      </h2>

      {/* Core Base Info Grid */}
      <div className={styles.editInfoGrid}>
        <div>
          <div className={styles.fieldLabel}>Name</div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={styles.inputField}
          />
        </div>

        <div>
          <div className={styles.fieldLabel}>Status</div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className={styles.inputField}
          >
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
          <div className={styles.fieldLabel}>Passing Date</div>
          <input
            type="text"
            placeholder="DD-MM-YYYY"
            value={metadataInputs['PassingDate'] || ''}
            onChange={e => handleMetadataInputChange('PassingDate', e.target.value)}
            className={styles.inputField}
          />
        </div>

        <div>
          <div className={styles.fieldLabel}>Standalone Node</div>
          <input
            type="checkbox"
            checked={isStandalone}
            onChange={e => setIsStandalone(e.target.checked)}
            className={styles.checkbox}
          />
        </div>
      </div>

      {/* SECTIE A: CORE REQUIRED GAME FIELDS */}
      {originalEntity.type.toLowerCase() === 'l4' && partitionedMetadataKeys.requiredKeys.length > 0 && (
        <div className={styles.requiredSection}>
          <h3 className={styles.requiredTitle}>🔒 Required Game Metrics (Layer 4 Core)</h3>
          <p className={`${styles.labelSubText} ${styles.textMuted}`}>These attributes are strictly required by the GuessWho game configuration engine.</p>
          <div className={styles.twoColumnGrid}>
            {partitionedMetadataKeys.requiredKeys.map(key => (
              <div key={key}>
                <div className={styles.requiredLabel}>
                  {key} {key.toLowerCase() === 'nationality' && <small className={styles.textMuted}>(Comma separated list)</small>}
                </div>
                <input
                  type="text"
                  placeholder={key.toLowerCase() === 'birthday' ? 'DD-MM-YYYY' : `Enter required ${key}`}
                  value={metadataInputs[key] || ''}
                  onChange={e => handleMetadataInputChange(key, e.target.value)}
                  className={`${styles.inputField} ${styles.requiredInput}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTIE B: DYNAMIC THEME ATTRIBUTES */}
      <h3 className={styles.sectionTitle}>🛠️ Dynamic Attributes (Populated via {originalEntity.type.toUpperCase()} Theme Schema)</h3>
      <div className={styles.innerSection}>
        {partitionedMetadataKeys.dynamicKeys.length === 0 ? (
          <p className={`${styles.textMuted} ${styles.labelSubText}`}>No specific layout metadata schema properties injected for this layer. Append custom fields below:</p>
        ) : (
          <div className={styles.twoColumnGrid}>
            {partitionedMetadataKeys.dynamicKeys.map(key => {
              const triggerValues = triggerFieldsMap[key];
              const isList = key.toLowerCase() === 'nationality' || (metadataInputs[key] && metadataInputs[key].includes(','));

              return (
                <div key={key}>
                  <div className={styles.labelActionRow}>
                    <span>
                      {key}
                      {isList && <small className={styles.textDimmed}> (Array List)</small>}
                      {triggerValues && <small className={styles.textWarning}> (Schema Controlled 🔒)</small>}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMetadataField(key)}
                      className={styles.btnRemove}
                    >
                      Remove
                    </button>
                  </div>

                  {triggerValues ? (
                    <select
                      value={metadataInputs[key]}
                      onChange={e => handleMetadataInputChange(key, e.target.value)}
                      className={styles.inputField}
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
                      className={styles.inputField}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className={styles.innerActionRow}>
          <input
            type="text"
            placeholder="e.g., Twitter, Instagram or SquadNumber"
            value={newMetadataKey}
            onChange={e => setNewMetadataKey(e.target.value)}
            className={styles.inlineInput}
          />
          <button
            type="button"
            onClick={handleAddMetadataField}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            Add Attribute Property
          </button>
        </div>
      </div>

      {/* Media Assets */}
      <h3 className={styles.sectionTitle}>Media Assets</h3>
      <div className={styles.innerSection}>
        <div className={styles.twoColumnGrid}>
          {Object.keys(imageInputs).map(key => {
            const isSchemaMediaKey = layerConfig?.mediaKeys?.includes(key);
            const isCoreMediaKey = CORE_IMAGE_FIELDS.some(f => f.toLowerCase() === key.toLowerCase());
            
            return (
              <div key={key}>
                <div className={styles.labelActionRow}>
                  <span>
                    {key} 
                    {Array.isArray(originalEntity.image?.[key]) && <small className={styles.textDimmed}>(Array List)</small>}
                    {isCoreMediaKey && <small className={styles.textWarning} style={{ color: '#d32f2f' }}> (Core Systeem Asset 🔒)</small>}
                    {!isCoreMediaKey && isSchemaMediaKey && <small className={styles.textWarning}> (Schema Asset 🔒)</small>}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveImageField(key)}
                    className={styles.btnRemove}
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={imageInputs[key]}
                  onChange={e => handleImageInputChange(key, e.target.value)}
                  className={styles.inputField}
                />
              </div>
            );
          })}
        </div>
        <div className={styles.innerActionRow}>
          <input
            type="text"
            placeholder="e.g., streamingTeaser or liveries"
            value={newImageKey}
            onChange={e => setNewImageKey(e.target.value)}
            className={styles.inlineInput}
          />
          <button
            type="button"
            onClick={handleAddImageField}
            className={`${styles.btn} ${styles.btnOutline}`}
          >
            Add Asset Field
          </button>
        </div>
      </div>

      {/* Mapped Registry Entity Connections */}
      <h3 className={styles.sectionTitle}>Mapped Registry Entity Connections (Direction Agnostic)</h3>
      <div className={styles.innerSection}>
        {unifiedConnections.map(conn => {
          const isL4ToL4 = originalEntity.type.toLowerCase() === 'l4' && conn.relatedEntity?.type?.toLowerCase() === 'l4';
          const isExpanded = expandedChildId === conn.relatedEntityId;

          return (
            <div key={conn.id} className={styles.connectionRow}>
              <div className={styles.connectionHeader}>
                <span className={styles.connectionRowLeft}>
                  <button
                    type="button"
                    onClick={() => setExpandedChildId(isExpanded ? null : conn.relatedEntityId)}
                    className={styles.filterBtn}
                    style={{ padding: '2px 8px', fontSize: '13px' }}
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                  <span className={conn.direction === 'incoming' ? styles.badgeInbound : styles.badgeOutbound}>
                    {conn.direction === 'incoming' ? 'INBOUND' : 'OUTBOUND'}
                  </span>
                  <span className={styles.layerBadge}>
                    {conn.relatedEntity?.type?.toUpperCase() || 'L4'}
                  </span>
                  <strong className={styles.textPrimary}>{conn.relatedEntity?.name || conn.relatedEntityId}</strong>
                  {isL4ToL4 && (
                    <span className={styles.textWarning}>Cross-individual connection (L4 to L4 Peer)</span>
                  )}
                </span>
                <div className={styles.buttonGroup} style={{ gap: '10px' }}>
                  <select
                    value={conn.status}
                    onChange={e => handleConnectionStatusChange(conn.id, e.target.value)}
                    className={styles.inputField}
                    style={{ padding: '6px 10px', width: 'auto' }}
                  >
                    <option value="active">Active</option>
                    <option value="former">Former</option>
                    <option value="inactive">Inactive</option>
                    <option value="retired">Retired</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveConnection(conn.id)}
                    className={styles.btnUnlink}
                  >
                    Unlink
                  </button>
                </div>
              </div>

              {isExpanded && conn.relatedEntity && (
                <div className={styles.portalSection}>
                  <h4 className={styles.portalTitle}>Inline sub-modification portal for: {conn.relatedEntity.name}</h4>
                  <AdminEntityEdit
                    theme={theme}
                    entityId={conn.relatedEntityId}
                    onSave={async (updatedChild) => {
                      try {
                        await entityService.update(theme.id, updatedChild.id, updatedChild);
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

        {/* Search & Selection Dropdown */}
        <div ref={dropdownRef} className={styles.dropdownWrapper}>
          <div className={`${styles.fieldLabel} ${styles.labelSubText}`}>
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
            className={styles.inputField}
          />

          {isConnectionDropdownOpen && (
            <div className={styles.dropdownMenu}>
              {filteredAvailableTargets.length > 0 ? (
                filteredAvailableTargets.map(t => (
                  <div
                    key={t.id}
                    onClick={() => {
                      handleAddConnection(t.id);
                      setConnectionSearchTerm('');
                      setIsConnectionDropdownOpen(false);
                    }}
                    className={styles.dropdownItem}
                  >
                    <span className={styles.textBold}>{t.name}</span>
                    <span className={styles.layerBadge}>{t.type.toUpperCase()}</span>
                  </div>
                ))
              ) : (
                <div className={styles.dropdownNoResults}>
                  No matching entities found in workspace...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Footers */}
      <div className={styles.footerActions}>
        <button
          type="button"
          onClick={onCancel}
          className={`${styles.btn} ${styles.btnBack}`}
          style={{ marginBottom: 0 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={(e) => { void handleSubmit(e); }}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          Save Commit Changes
        </button>
      </div>
    </div>
  );
};