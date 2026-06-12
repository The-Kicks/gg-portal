import React, { useState, useEffect, useMemo } from 'react';
import type { Theme, HydratedEntity, BaseEntity } from '../../types';
import { entityService } from './EntityService';
import styles from './AdminGlobal.module.css';

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
  mediaKeys?: string[];
}

interface LayerMetadataMap {
  [layerKey: string]: LayerConfig | undefined;
}

type MetadataValue = string | number | boolean | string[] | undefined;

const REQUIRED_L4_FIELDS = ['Nationality', 'Role', 'DebutYear', 'Birthday', 'Height'];
const CORE_IMAGE_FIELDS = ['profileCard', 'heroBanner'];

export const AdminEntityCreate: React.FC<Props> = ({ theme, onSave, onCancel }) => {
  // --- Form Local States ---
  const [name, setName] = useState('');
  const [customSuffix, setCustomSuffix] = useState('');
  const [type, setType] = useState('l4');
  const [status, setStatus] = useState('active');
  const [isStandalone, setIsStandalone] = useState(true);
  const [idStatus, setIdStatus] = useState<'idle' | 'available' | 'taken'>('idle');

  // --- LAZY STATE INITIALIZATION: MEDIA ASSETS ---
  const [imageInputs, setImageInputs] = useState<Record<string, string>>(() => {
    const nextImages: Record<string, string> = {};
    
    CORE_IMAGE_FIELDS.forEach(field => {
      nextImages[field] = '';
    });

    if (theme.layerMetadata) {
      try {
        const parsed = typeof theme.layerMetadata === 'string'
          ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
          : (theme.layerMetadata as unknown as LayerMetadataMap);
        const initialConfig = parsed['l4'];

        if (initialConfig?.mediaKeys && Array.isArray(initialConfig.mediaKeys)) {
          initialConfig.mediaKeys.forEach(k => { if (k) nextImages[k] = ''; });
        }
      } catch (e: unknown) {
        console.error("Error loading initial media assets in lazy state:", e);
      }
    }
    return nextImages;
  });

  // --- LAZY STATE INITIALIZATION: METADATA ---
  const [metadataInputs, setMetadataInputs] = useState<Record<string, string>>(() => {
    const nextInputs: Record<string, string> = {};
    
    REQUIRED_L4_FIELDS.forEach(field => {
      nextInputs[field] = '';
    });

    if (theme.layerMetadata) {
      try {
        const parsed = typeof theme.layerMetadata === 'string'
          ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
          : (theme.layerMetadata as unknown as LayerMetadataMap);
        const initialConfig = parsed['l4'];

        if (initialConfig) {
          if (initialConfig.badgeKey) nextInputs[initialConfig.badgeKey] = '';
          if (initialConfig.subtitleKey) nextInputs[initialConfig.subtitleKey] = '';
          if (Array.isArray(initialConfig.gridKeys)) {
            initialConfig.gridKeys.forEach(k => { if (k) nextInputs[k] = ''; });
          }
          if (initialConfig.statusTriggers) {
            Object.values(initialConfig.statusTriggers).forEach(t => { if (t?.key) nextInputs[t.key] = ''; });
          }
        }
      } catch (e: unknown) {
        console.error("Error loading initial schema attributes in lazy state:", e);
      }
    }
    return nextInputs;
  });

  // --- UI Control States ---
  const [newImageKey, setNewImageKey] = useState('');
  const [newMetadataKey, setNewMetadataKey] = useState('');

  // --- Layer Config Resolution ---
  const layerConfig = useMemo<LayerConfig | undefined>(() => {
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
    const isL4 = type.toLowerCase() === 'l4';

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
  }, [metadataInputs, type]);

  const partitionedImageKeys = useMemo(() => {
    const allImageKeys = Object.keys(imageInputs);
    return {
      coreKeys: allImageKeys.filter(k => CORE_IMAGE_FIELDS.includes(k)),
      dynamicKeys: allImageKeys.filter(k => !CORE_IMAGE_FIELDS.includes(k))
    };
  }, [imageInputs]);

  // --- Debounced Async ID/Slug check ---
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

  // --- Handlers ---
  const handleTypeChange = (newType: string) => {
    setType(newType);
    setIsStandalone(newType.toLowerCase() === 'l4');
    setStatus('active');

    const currentLayer = newType.toLowerCase();
    
    const nextImages: Record<string, string> = {};
    CORE_IMAGE_FIELDS.forEach(field => { nextImages[field] = ''; });

    const nextInputs: Record<string, string> = {};
    if (currentLayer === 'l4') {
      REQUIRED_L4_FIELDS.forEach(field => { nextInputs[field] = ''; });
    }

    if (theme.layerMetadata) {
      try {
        const parsed = typeof theme.layerMetadata === 'string'
          ? (JSON.parse(theme.layerMetadata) as LayerMetadataMap)
          : (theme.layerMetadata as unknown as LayerMetadataMap);
        const nextConfig = parsed[currentLayer];

        if (nextConfig) {
          if (nextConfig.mediaKeys && Array.isArray(nextConfig.mediaKeys)) {
            nextConfig.mediaKeys.forEach(k => { if (k) nextImages[k] = ''; });
          }
          if (nextConfig.badgeKey) nextInputs[nextConfig.badgeKey] = '';
          if (nextConfig.subtitleKey) nextInputs[nextConfig.subtitleKey] = '';
          if (Array.isArray(nextConfig.gridKeys)) {
            nextConfig.gridKeys.forEach(k => { if (k) nextInputs[k] = ''; });
          }
          if (nextConfig.statusTriggers) {
            Object.values(nextConfig.statusTriggers).forEach(t => { if (t?.key) nextInputs[t.key] = ''; });
          }
        }
      } catch (e: unknown) {
        console.error("Error parsing schema metadata upon layer switch:", e);
      }
    }

    setImageInputs(nextImages);
    setMetadataInputs(nextInputs);
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
    if (!cleanKey) return;

    if (metadataInputs[cleanKey] !== undefined) {
      alert("Dit veld bestaat al.");
      return;
    }

    const isCoreField = REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === cleanKey.toLowerCase());
    if (isCoreField) {
      alert(`Het veld "${cleanKey}" is een gereserveerd systeem-veld.`);
      return;
    }

    setMetadataInputs(prev => ({ ...prev, [cleanKey]: '' }));
    setNewMetadataKey('');
  };

  const handleRemoveImageField = (key: string) => {
    if (CORE_IMAGE_FIELDS.includes(key)) {
      alert(`Field "${key}" is core and cannot be removed.`);
      return;
    }
    setImageInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const handleRemoveMetadataField = (key: string) => {
    if (type.toLowerCase() === 'l4' && REQUIRED_L4_FIELDS.some(f => f.toLowerCase() === key.toLowerCase())) {
      alert(`Field "${key}" is strictly required for the trivia logic engine and cannot be stripped.`);
      return;
    }
    setMetadataInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const reconstructObject = (
    currentInputs: Record<string, string>
  ): Record<string, MetadataValue> => {
    const result: Record<string, MetadataValue> = {};

    Object.keys(currentInputs).forEach(key => {
      const rawValue = currentInputs[key];
      if (!rawValue || !rawValue.trim()) return;

      if (key.toLowerCase() === 'passingdate' || key.toLowerCase() === 'birthday') {
        result[key] = rawValue.trim();
        return;
      }

      if (key.toLowerCase() === 'nationality' || rawValue.includes(',')) {
        result[key] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if (key.toLowerCase() === 'height' || key.toLowerCase() === 'debutyear') {
        result[key] = Number(rawValue.trim()) || 0;
      } else {
        result[key] = rawValue.trim();
      }
    });
    return result;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Please enter a valid name.");
      return;
    }

    if (idStatus === 'taken') {
      alert("Cannot save: This unique ID combination is already taken.");
      return;
    }

    if (type.toLowerCase() === 'l4') {
      for (const field of REQUIRED_L4_FIELDS) {
        const foundKey = Object.keys(metadataInputs).find(k => k.toLowerCase() === field.toLowerCase());
        const value = foundKey ? metadataInputs[foundKey] : undefined;

        if (!value || !value.trim()) {
          alert(`Game Error: The field "${field}" is strictly required for Layer 4 entities.`);
          return;
        }
      }
    }

    const baseSlug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    const suffix = customSuffix.trim() ? customSuffix.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';
    const generatedId = suffix ? `${baseSlug}-${suffix}` : baseSlug;

    const updatedMetadata = reconstructObject(metadataInputs);

    if (dynamicTriggers[status]) {
      const trigger = dynamicTriggers[status];
      updatedMetadata[trigger.key] = trigger.value;
    }

    const cleanedImages: Record<string, string> = {};
    Object.keys(imageInputs).forEach(k => {
      if (imageInputs[k] && imageInputs[k].trim()) {
        cleanedImages[k] = imageInputs[k].trim();
      }
    });

    const newSkeleton: BaseEntity = {
      id: generatedId,
      themeId: theme.id,
      name: name.trim(),
      type: type,
      status: status,
      isStandalone: isStandalone,
      image: cleanedImages as unknown as BaseEntity['image'],
      metadata: updatedMetadata
    };

    try {
      const savedEntity: HydratedEntity = await entityService.create(theme.id, newSkeleton);
      window.dispatchEvent(new Event('refresh-database'));
      if (onSave) onSave(savedEntity);
    } catch (err: unknown) {
      console.error(err);
      alert(`Could not persist the new record.`);
    }
  };

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
            {[
              { key: 'l1', fallback: 'Layer 1 (Main Category)' },
              { key: 'l2', fallback: 'Layer 2 (Governing Body)' },
              { key: 'l3', fallback: 'Layer 3 (Team / Club)' },
              { key: 'l4', fallback: 'Layer 4 (Individual / Player)' },
            ].map(({ key, fallback }) => {
              const customLabel = theme?.labels?.[key];
              return (
                <option key={key} value={key}>
                  {customLabel ? `${customLabel} (${key.toUpperCase()})` : fallback}
                </option>
              );
            })}
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
          <div className={styles.fieldLabel}>Standalone Node</div>
          <input
            type="checkbox"
            checked={isStandalone}
            onChange={e => setIsStandalone(e.target.checked)}
            className={styles.checkbox}
          />
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
      </div>

      {/* SECTIE A: CORE REQUIRED GAME FIELDS */}
      {type.toLowerCase() === 'l4' && partitionedMetadataKeys.requiredKeys.length > 0 && (
        <div className={styles.requiredSection}>
          <h3 className={styles.requiredTitle}>🔒 Required Game Metrics (Layer 4 Core)</h3>
          <div className={styles.twoColumnGrid}>
            {partitionedMetadataKeys.requiredKeys.map(key => (
              <div key={key}>
                <div className={styles.requiredLabel}>{key}</div>
                <input
                  type="text"
                  placeholder={`Enter required ${key}`}
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
      <h3 className={styles.sectionTitle}>🛠️ Dynamic Attributes (Populated via {type.toUpperCase()} Theme Schema)</h3>
      <div className={styles.innerSection}>
        {partitionedMetadataKeys.dynamicKeys.length === 0 ? (
          <p className={styles.textMuted}>No specific layout metadata schema properties injected for this layer.</p>
        ) : (
          <div className={styles.twoColumnGrid}>
            {partitionedMetadataKeys.dynamicKeys.map(key => {
              const triggerValues = triggerFieldsMap[key];
              return (
                <div key={key}>
                  <div className={styles.labelActionRow}>
                    <span>
                      {key}
                      {triggerValues && <small className={styles.textWarning}> (Required by theme 🔒)</small>}
                    </span>
                    <button type="button" onClick={() => handleRemoveMetadataField(key)} className={styles.btnRemove}>Remove</button>
                  </div>

                  {triggerValues ? (
                    <select
                      value={metadataInputs[key] || ''}
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
          <input type="text" placeholder="e.g., Twitter" value={newMetadataKey} onChange={e => setNewMetadataKey(e.target.value)} className={styles.inlineInput} />
          <button type="button" onClick={handleAddMetadataField} className={`${styles.btn} ${styles.btnPrimary}`}>Add Attribute Property</button>
        </div>
      </div>

      {/* SECTIE C: MEDIA ASSETS */}
      <h3 className={styles.sectionTitle}>📸 Media Assets (Optional per Theme {type.toUpperCase()} Schema)</h3>
      <div className={styles.innerSection}>
        <div className={styles.twoColumnGrid}>
          {partitionedImageKeys.coreKeys.map(key => (
            <div key={key}>
              <div className={styles.labelActionRow}>
                <span>{key} <small className={styles.textMuted}>(Core Asset)</small></span>
              </div>
              <input
                type="text"
                placeholder="https://image-url.com/asset.png"
                value={imageInputs[key] || ''}
                onChange={e => handleImageInputChange(key, e.target.value)}
                className={styles.inputField}
              />
            </div>
          ))}

          {partitionedImageKeys.dynamicKeys.map(key => (
            <div key={key}>
              <div className={styles.labelActionRow}>
            <span>{key} <small className={styles.textWarning}>(Optional Theme-decided Key)</small></span>
                <button type="button" onClick={() => handleRemoveImageField(key)} className={styles.btnRemove}>Remove</button>
              </div>
              <input
                type="text"
                placeholder="https://image-url.com/dynamic-asset.png"
                value={imageInputs[key] || ''}
                onChange={e => handleImageInputChange(key, e.target.value)}
                className={styles.inputField}
              />
            </div>
          ))}
        </div>
        
        <div className={styles.innerActionRow}>
          <input type="text" placeholder="e.g., logo or fanart" value={newImageKey} onChange={e => setNewImageKey(e.target.value)} className={styles.inlineInput} />
          <button type="button" onClick={handleAddImageField} className={`${styles.btn} ${styles.btnOutline}`}>Add Asset Field</button>
        </div>
      </div>

      {/* Action Footers */}
      <div className={styles.footerActions}>
        <button type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnBack}`}>Cancel</button>
        <button type="button" onClick={handleSubmit} className={`${styles.btn} ${styles.btnPrimary}`}>Create & Save</button>
      </div>
    </div>
  );
};