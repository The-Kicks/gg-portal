import React, { useState, useEffect, useMemo } from 'react';
import type { Theme, HydratedEntity, BaseEntity } from '../../types';
import { entityService } from './EntityService';

interface Props {
  theme: Theme;
  onSave: (newEntity: HydratedEntity) => void;
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

type MetadataValue = string | number | boolean | string[] | undefined;

const REQUIRED_L4_FIELDS = ['Nationality', 'Role', 'DebutYear', 'Birthday', 'Height'];

export const AdminEntityCreate: React.FC<Props> = ({ theme, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [customSuffix, setCustomSuffix] = useState('');
  const [type, setType] = useState('l4');
  const [status, setStatus] = useState('active');
  const [isStandalone, setIsStandalone] = useState(false);
  const [idStatus, setIdStatus] = useState<'idle' | 'available' | 'taken'>('idle');

  const [imageInputs, setImageInputs] = useState<Record<string, string>>({
    profileCard: '',
    heroBanner: ''
  });

  const activeLayerConfig = useMemo<LayerConfig | undefined>(() => {
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

  const dynamicTriggers = useMemo(() => activeLayerConfig?.statusTriggers || {}, [activeLayerConfig]);

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

  const buildDefaultKeysForLayer = (config: LayerConfig | undefined, currentType: string) => {
    const inputs: Record<string, string> = {};
    
    if (currentType.toLowerCase() === 'l4') {
      REQUIRED_L4_FIELDS.forEach(field => {
        inputs[field] = '';
      });
    }

    if (!config) return inputs;

    const defaultKeys: string[] = [];
    if (config.badgeKey) defaultKeys.push(config.badgeKey);
    if (config.subtitleKey) defaultKeys.push(config.subtitleKey);
    if (Array.isArray(config.gridKeys)) defaultKeys.push(...config.gridKeys);

    if (config.statusTriggers) {
      Object.values(config.statusTriggers).forEach(t => {
        if (t?.key) defaultKeys.push(t.key);
      });
    }

    defaultKeys.forEach((key) => {
      if (key) inputs[key] = inputs[key] !== undefined ? inputs[key] : '';
    });
    return inputs;
  };

  const [metadataInputs, setMetadataInputs] = useState<Record<string, string>>(() => {
    const initialConfig = theme.layerMetadata
      ? (typeof theme.layerMetadata === 'string' ? JSON.parse(theme.layerMetadata) : theme.layerMetadata)['l4']
      : undefined;
    return buildDefaultKeysForLayer(initialConfig, 'l4');
  });

  const [newImageKey, setNewImageKey] = useState('');
  const [newMetadataKey, setNewMetadataKey] = useState('');

  // Scheiding van velden voor de interface om Required en Dynamic los te koppelen
  const partitionedMetadataKeys = useMemo(() => {
    const allKeys = Object.keys(metadataInputs);
    const isL4 = type.toLowerCase() === 'l4';

    return {
      requiredKeys: allKeys.filter(key => isL4 && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())),
      dynamicKeys: allKeys.filter(key => !(isL4 && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())))
    };
  }, [metadataInputs, type]);

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

  const handleTypeChange = (newType: string) => {
    setType(newType);
    setIsStandalone(newType === 'l4');
    setStatus('active');

    if (theme.layerMetadata) {
      try {
        const parsed = typeof theme.layerMetadata === 'string'
          ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
          : (theme.layerMetadata as unknown as LayerMetadataMap);
        const nextConfig = parsed[newType.toLowerCase()];
        setMetadataInputs(buildDefaultKeysForLayer(nextConfig, newType));
      } catch (e: unknown) {
        console.error(e);
      }
    }
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
    if (!cleanKey || metadataInputs[cleanKey] !== undefined) return;
    
    // Voorkom handmatige duplicatie van gereserveerde core keys in de dynamic lijst
    if (type.toLowerCase() === 'l4' && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === cleanKey.toLowerCase())) {
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
    if (type.toLowerCase() === 'l4' && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
      alert(`Field "${key}" is strictly required for the trivia logic engine and cannot be stripped.`);
      return;
    }
    setMetadataInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Please enter a valid name.");
      return;
    }

    if (idStatus === 'taken') {
      alert("Cannot save: This unique ID combination is already taken. Please adjust the suffix.");
      return;
    }

    if (type.toLowerCase() === 'l4') {
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

    const baseSlug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    const suffix = customSuffix.trim() ? customSuffix.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';
    const generatedId = suffix ? `${baseSlug}-${suffix}` : baseSlug;

    const finalMetadata: Record<string, MetadataValue> = {};

    Object.keys(metadataInputs).forEach(key => {
      const rawValue = metadataInputs[key];
      if (!rawValue.trim()) return;

      if (key.toLowerCase() === 'nationality' || rawValue.includes(',')) {
        finalMetadata[key] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if (type.toLowerCase() === 'l4' && (key.toLowerCase() === 'height' || key.toLowerCase() === 'debutyear')) {
        finalMetadata[key] = Number(rawValue.trim());
      } else {
        finalMetadata[key] = rawValue;
      }
    });

    if (dynamicTriggers[status]) {
      const trigger = dynamicTriggers[status];
      finalMetadata[trigger.key] = trigger.value;
    }

    const newSkeleton: BaseEntity = {
      id: generatedId,
      themeId: theme.id,
      name: name.trim(),
      type: type,
      status: status,
      isStandalone: isStandalone,
      image: imageInputs as unknown as BaseEntity['image'],
      metadata: finalMetadata
    };

    try {
      const savedEntity: HydratedEntity = await entityService.create(theme.id, newSkeleton);
      window.dispatchEvent(new Event('refresh-database'));
      if (onSave) onSave(savedEntity);
    } catch (err: unknown) {
      console.error(err);
      alert(`Could not persist the new record. Verify that the ID "${generatedId}" does not already exist.`);
    }
  };

  const getInputBorderStyle = () => {
    if (idStatus === 'available') return '2px solid #4caf50';
    if (idStatus === 'taken') return '2px solid #f44336';
    return '1px solid #444';
  };

  return (
    <div style={{ padding: '20px', background: '#242424', color: '#fff', borderRadius: '8px', marginBottom: '20px', border: '2px solid #deff9a' }}>
      <h2 style={{ marginTop: 0, color: '#deff9a' }}>Create New Entity Records</h2>

      {/* Core Base Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: '15px', marginBottom: '25px' }}>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
            Name {idStatus === 'taken' && <span style={{ color: '#f44336', fontSize: '12px' }}>(ID taken!)</span>}
          </div>
          <input type="text" placeholder="e.g., Johan Cruijff" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: getInputBorderStyle(), borderRadius: '4px', transition: 'border 0.2s ease-in-out' }} />
        </div>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Unique Suffix (Optional)</div>
          <input type="text" placeholder="e.g., Ajax" value={customSuffix} onChange={e => setCustomSuffix(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: getInputBorderStyle(), borderRadius: '4px', transition: 'border 0.2s ease-in-out' }} />
        </div>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Tier / Layer Type</div>
          <select value={type} onChange={e => handleTypeChange(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
            <option value="l1">Layer 1 (Main Category)</option>
            <option value="l2">Layer 2 (Governing Body)</option>
            <option value="l3">Layer 3 (Team / Club)</option>
            <option value="l4">Layer 4 (Individual / Player)</option>
          </select>
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
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Standalone</div>
          <input type="checkbox" checked={isStandalone} onChange={e => setIsStandalone(e.target.checked)} style={{ marginTop: '14px', transform: 'scale(1.4)' }} />
        </div>
      </div>

      {/* SECTIE A: CORE REQUIRED GAME FIELDS (Zichtbaar bij Layer 4) */}
      {type.toLowerCase() === 'l4' && partitionedMetadataKeys.requiredKeys.length > 0 && (
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
                  value={metadataInputs[key]}
                  onChange={e => handleMetadataInputChange(key, e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #ffb300', borderRadius: '4px' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTIE B: DYNAMIC THEME ATTRIBUTES */}
      <h3>🛠️ Dynamic Attributes (Populated via {type.toUpperCase()} Theme Schema)</h3>
      <div style={{ background: '#151515', padding: '15px', borderRadius: '6px', marginBottom: '25px' }}>
        {partitionedMetadataKeys.dynamicKeys.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', margin: '0' }}>No specific layout metadata schema properties injected for this layer. Append custom fields below:</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {partitionedMetadataKeys.dynamicKeys.map(key => {
              const triggerValues = triggerFieldsMap[key];
              const isList = key.toLowerCase() === 'nationality' || metadataInputs[key].includes(',');

              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px', color: '#deff9a' }}>
                    <span>
                      {key}
                      {isList && <small style={{ color: '#888' }}> (Array List)</small>}
                      {triggerValues && <small style={{ color: '#ffb300' }}> (Schema Controlled)</small>}
                    </span>
                    <button type="button" onClick={() => handleRemoveMetadataField(key)} style={{ background: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0 }}>
                      Remove
                    </button>
                  </div>

                  {triggerValues ? (
                    <select value={metadataInputs[key]} onChange={e => handleMetadataInputChange(key, e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                      <option value="">-- Active / Normal --</option>
                      {triggerValues.map(val => (
                        <option key={val} value={val}>
                          {val.charAt(0).toUpperCase() + val.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder={`Metric value for ${key}`} value={metadataInputs[key]} onChange={e => handleMetadataInputChange(key, e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center', background: '#222', padding: '10px', borderRadius: '4px' }}>
          <input type="text" placeholder="e.g., RacingNumber, Headquarters, TeamPrincipal" value={newMetadataKey} onChange={e => setNewMetadataKey(e.target.value)} style={{ padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', flex: 1 }} />
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
                <span>{key}</span>
                <button type="button" onClick={() => handleRemoveImageField(key)} style={{ background: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
                  Remove
                </button>
              </div>
              <input type="text" placeholder="Asset target URL link" value={imageInputs[key]} onChange={e => handleImageInputChange(key, e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center', background: '#222', padding: '10px', borderRadius: '4px' }}>
          <input type="text" placeholder="e.g., brandLogo or teamLivery" value={newImageKey} onChange={e => setNewImageKey(e.target.value)} style={{ padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', flex: 1 }} />
          <button type="button" onClick={handleAddImageField} style={{ background: '#b3e5fc', color: '#000', border: 'none', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}>Add Asset Field</button>
        </div>
      </div>

      {/* Action Footers */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 20px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
        <button type="button" onClick={handleSubmit} style={{ padding: '10px 20px', background: '#deff9a', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Create & Save</button>
      </div>
    </div>
  );
};