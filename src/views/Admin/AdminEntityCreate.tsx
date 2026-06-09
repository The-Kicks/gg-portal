import React, { useState, useEffect, useMemo } from 'react';
import type { Theme, HydratedEntity, BaseEntity } from '../../types';
import { entityService } from './EntityService';
import styles from './AdminGlobal.module.css'; // Centrale styles importeren

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

const L4_DEFAULT_FIELDS = ['Nationality', 'Role', 'DebutYear', 'Birthday', 'Height'];
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
      L4_DEFAULT_FIELDS.forEach(field => {
        inputs[field] = '';
      });
      inputs['PassingDate'] = '';
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

  const partitionedMetadataKeys = useMemo(() => {
    const allKeys = Object.keys(metadataInputs);
    const isL4 = type.toLowerCase() === 'l4';

    return {
      requiredKeys: allKeys.filter(key => isL4 && L4_DEFAULT_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())),
      dynamicKeys: allKeys.filter(key => !(isL4 && L4_DEFAULT_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())))
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

      if (metadataInputs['PassingDate'] && !/^\d{2}-\d{2}-\d{4}$/.test(metadataInputs['PassingDate'].trim())) {
        alert("Format Warning: Passing Date should also use the DD-MM-YYYY format.");
        return;
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

  // Helper om de juiste validatieklasse te bepalen voor de ID velden
  const getInputValidationClass = () => {
    if (idStatus === 'available') return styles.inputAvailable;
    if (idStatus === 'taken') return styles.inputTaken;
    return '';
  };

  return (
    <div className={styles.formCard}>
      <h2 className={styles.formCardTitle}>Create New Entity Records</h2>

      {/* Core Base Info Grid */}
      <div className={styles.baseInfoGrid}>
        <div>
          <div className={styles.fieldLabel}>
            Name {idStatus === 'taken' && <span className={styles.textError}>(ID taken!)</span>}
          </div>
          <input 
            type="text" 
            placeholder="e.g., Johan Cruijff" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className={`${styles.inputField} ${getInputValidationClass()}`} 
          />
        </div>
        <div>
          <div className={styles.fieldLabel}>Unique Suffix (Optional)</div>
          <input 
            type="text" 
            placeholder="e.g., Ajax" 
            value={customSuffix} 
            onChange={e => setCustomSuffix(e.target.value)} 
            className={`${styles.inputField} ${getInputValidationClass()}`} 
          />
        </div>
        <div>
          <div className={styles.fieldLabel}>Tier / Layer Type</div>
          <select 
            value={type} 
            onChange={e => handleTypeChange(e.target.value)} 
            className={styles.inputField}
          >
            <option value="l1">Layer 1 (Main Category)</option>
            <option value="l2">Layer 2 (Governing Body)</option>
            <option value="l3">Layer 3 (Team / Club)</option>
            <option value="l4">Layer 4 (Individual / Player)</option>
          </select>
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
          <div className={styles.fieldLabel}>Standalone</div>
          <input 
            type="checkbox" 
            checked={isStandalone} 
            onChange={e => setIsStandalone(e.target.checked)} 
            className={styles.checkbox} 
          />
        </div>
        <div>
          <div className={`${styles.fieldLabel} ${styles.labelSubText}`}>Passing Date (Optional)</div>
          <input
            type="text"
            placeholder="DD-MM-YYYY"
            value={metadataInputs['PassingDate'] || ''}
            onChange={e => handleMetadataInputChange('PassingDate', e.target.value)}
            className={styles.inputField}
          />
        </div>
      </div>

      {/* SECTIE A: CORE REQUIRED GAME FIELDS (Zichtbaar bij Layer 4) */}
      {type.toLowerCase() === 'l4' && partitionedMetadataKeys.requiredKeys.length > 0 && (
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
                  value={metadataInputs[key]}
                  onChange={e => handleMetadataInputChange(key, e.target.value)}
                  className={`${styles.inputField} ${styles.requiredInput}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTIE B: DYNAMIC THEME ATTRIBUTES */}
      <h3 className={styles.sectionTitle}>🛠️ Dynamic Attributes (Populated via {type.toUpperCase()} Theme Schema)</h3>
      <div className={styles.innerSection}>
        {partitionedMetadataKeys.dynamicKeys.length === 0 ? (
          <p className={`${styles.textMuted} ${styles.labelSubText}`}>No specific layout metadata schema properties injected for this layer. Append custom fields below:</p>
        ) : (
          <div className={styles.twoColumnGrid}>
            {partitionedMetadataKeys.dynamicKeys.map(key => {
              const triggerValues = triggerFieldsMap[key];
              const isList = key.toLowerCase() === 'nationality' || metadataInputs[key].includes(',');

              return (
                <div key={key}>
                  <div className={styles.labelActionRow}>
                    <span>
                      {key}
                      {isList && <small className={styles.textDimmed}> (Array List)</small>}
                      {triggerValues && <small className={styles.textPrimary}> (Schema Controlled)</small>}
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
                      placeholder={`Metric value for ${key}`} 
                      value={metadataInputs[key]} 
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
            placeholder="e.g., RacingNumber, Headquarters, TeamPrincipal" 
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
          {Object.keys(imageInputs).map(key => (
            <div key={key}>
              <div className={styles.labelActionRow}>
                <span>{key}</span>
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
                placeholder="Asset target URL link" 
                value={imageInputs[key]} 
                onChange={e => handleImageInputChange(key, e.target.value)} 
                className={styles.inputField} 
              />
            </div>
          ))}
        </div>
        <div className={styles.innerActionRow}>
          <input 
            type="text" 
            placeholder="e.g., brandLogo or teamLivery" 
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

      {/* Action Footers */}
      <div className={styles.footerActions}>
        <button 
          type="button" 
          onClick={onCancel} 
          className={`${styles.btn} ${styles.btnBack}`}
          style={{ marginBottom: 0 }} // Reset eventueel top/bottom margin specifiek voor footer layout
        >
          Cancel
        </button>
        <button 
          type="button" 
          onClick={handleSubmit} 
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          Create & Save
        </button>
      </div>
    </div>
  );
};