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
    } catch (err) {
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

  const buildDefaultKeysForLayer = (config: LayerConfig | undefined) => {
    const inputs: Record<string, string> = {};
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
      if (key) inputs[key] = '';
    });
    return inputs;
  };

  const [metadataInputs, setMetadataInputs] = useState<Record<string, string>>(() => {
    const initialConfig = theme.layerMetadata
      ? (typeof theme.layerMetadata === 'string' ? JSON.parse(theme.layerMetadata) : theme.layerMetadata)['l4']
      : undefined;
    return buildDefaultKeysForLayer(initialConfig);
  });

  const [newImageKey, setNewImageKey] = useState('');
  const [newMetadataKey, setNewMetadataKey] = useState('');

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
      } catch (err) {
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
        setMetadataInputs(buildDefaultKeysForLayer(nextConfig));
      } catch (e) {
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
    setMetadataInputs(prev => ({ ...prev, [cleanKey]: '' }));
    setNewMetadataKey('');
  };

  const handleRemoveImageField = (key: string) => {
    setImageInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const handleRemoveMetadataField = (key: string) => {
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

    const baseSlug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    const suffix = customSuffix.trim() ? customSuffix.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';
    const generatedId = suffix ? `${baseSlug}-${suffix}` : baseSlug;

    const finalMetadata: Record<string, MetadataValue> = {};

    Object.keys(metadataInputs).forEach(key => {
      const rawValue = metadataInputs[key];
      if (!rawValue.trim()) return;

      if (key.toLowerCase() === 'nationality' || rawValue.includes(',')) {
        finalMetadata[key] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
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
    } catch (err) {
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

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: '15px', marginBottom: '25px' }}>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
            Name {idStatus === 'taken' && <span style={{ color: '#f44336', fontSize: '12px' }}>(ID taken!)</span>}
          </div>
          <input type="text" placeholder="e.g., Sony, One Direction, Johan Cruijff" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: getInputBorderStyle(), borderRadius: '4px', transition: 'border 0.2s ease-in-out' }} />
        </div>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Unique Suffix (Optional)</div>
          <input type="text" placeholder="e.g., Fc Barcelona, 2000" value={customSuffix} onChange={e => setCustomSuffix(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: getInputBorderStyle(), borderRadius: '4px', transition: 'border 0.2s ease-in-out' }} />
        </div>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Tier / Layer Type</div>
          <select value={type} onChange={e => handleTypeChange(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
            <option value="l1">Layer 1 (Industry / Main Category)</option>
            <option value="l2">Layer 2 (Organization / Governing Body)</option>
            <option value="l3">Layer 3 (Team / Constructor / Club)</option>
            <option value="l4">Layer 4 (Driver / Player / Individual)</option>
          </select>
        </div>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Status</div>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
            <option value="active">Active</option>
            <option value="disbanded">Disbanded</option>
            <option value="inactive">Inactive</option>
            <option value="retired">Retired</option>

            {Object.entries(dynamicTriggers).map(([triggerKey, triggerConfig]) => {
              const displayValue = triggerConfig.value.charAt(0).toUpperCase() + triggerConfig.value.slice(1);
              return (
                <option key={triggerKey} value={triggerKey}>
                  {displayValue} (Schema Trigger)
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <div style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Standalone</div>
          <input type="checkbox" checked={isStandalone} onChange={e => setIsStandalone(e.target.checked)} style={{ marginTop: '14px', transform: 'scale(1.4)' }} />
        </div>
      </div>

      <h3>Media Assets</h3>
      <div style={{ background: '#151515', padding: '15px', borderRadius: '6px', marginBottom: '25px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {Object.keys(imageInputs).map(key => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px', color: '#b3e5fc' }}>
                <span>{key}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImageField(key);
                  }}
                  style={{ background: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                >
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

      <h3>Dynamic Attributes (Populated via {type.toUpperCase()} Schema)</h3>
      <div style={{ background: '#151515', padding: '15px', borderRadius: '6px', marginBottom: '25px' }}>
        {Object.keys(metadataInputs).length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', margin: '0 0 10px 0' }}>No preset profile configuration schema metrics for this tier layer. Append customs fields manually:</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {Object.keys(metadataInputs).map(key => {
              const triggerValues = triggerFieldsMap[key];
              const isList = key.toLowerCase() === 'nationality' || metadataInputs[key].includes(',');

              return (
                <div key={key} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px', color: '#deff9a' }}>
                    <span>
                      {key}
                      {isList && <small style={{ color: '#888' }}> (Array List)</small>}
                      {triggerValues && <small style={{ color: '#ffb300' }}> (Schema Controlled 🔒)</small>}
                    </span>

                    <div style={{ marginLeft: '10px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMetadataField(key);
                        }}
                        style={{
                          background: 'transparent',
                          color: '#ff4d4d',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: 0
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {triggerValues ? (
                    <select
                      value={metadataInputs[key]}
                      onChange={e => handleMetadataInputChange(key, e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                    >
                      <option value="">-- Active / Normal --</option>
                      {triggerValues.map(val => {
                        const displayLabel = val.charAt(0).toUpperCase() + val.slice(1);
                        return (
                          <option key={val} value={val}>
                            {displayLabel}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={key.toLowerCase() === 'nationality' ? 'e.g., NL, GB, DE' : `Metric value for ${key}`}
                      value={metadataInputs[key]}
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
          <input type="text" placeholder="e.g., RacingNumber, Headquarters, TeamPrincipal" value={newMetadataKey} onChange={e => setNewMetadataKey(e.target.value)} style={{ padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', flex: 1 }} />
          <button type="button" onClick={handleAddMetadataField} style={{ background: '#deff9a', color: '#000', border: 'none', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}>Add Attribute Property</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 20px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
        <button type="button" onClick={handleSubmit} style={{ padding: '10px 20px', background: '#deff9a', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Create & Save</button>
      </div>
    </div>
  );
};