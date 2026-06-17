import React, { useState } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import { useAdminEntityCreate, CORE_IMAGE_FIELDS } from './useAdminEntityCreate';
import styles from '../AdminGlobal.module.css';

interface Props {
  theme: Theme;
  onSave: (newEntity: HydratedEntity) => void;
  onCancel: () => void;
}

export const AdminEntityCreate: React.FC<Props> = ({ theme, onSave, onCancel }) => {
  const {
    name,
    setName,
    customSuffix,
    setCustomSuffix,
    type,
    status,
    setStatus,
    isStandalone,
    setIsStandalone,
    idStatus,
    imageInputs,
    metadataInputs,
    newImageKey,
    setNewImageKey,
    newMetadataKey,
    setNewMetadataKey,
    dynamicTriggers,
    triggerFieldsMap,
    partitionedMetadataKeys,
    albumInput,
    setAlbumInput,
    unassignedImages,
    setUnassignedImages,
    handleTypeChange,
    handleImageInputChange,
    handleMetadataInputChange,
    handleAddImageField,
    handleAddMetadataField,
    handleRemoveImageField,
    handleRemoveMetadataField,
    handleAssignImage,
    handleUnassignImage,
    handleSubmit
  } = useAdminEntityCreate({ theme, onSave });

  // Tracks the current active drag source to manage UI state
  const [activeDragSource, setActiveDragSource] = useState<string | null>(null);

  const getInputValidationClass = (): string => {
    if (idStatus === 'available') return styles.inputAvailable;
    if (idStatus === 'taken') return styles.inputTaken;
    return '';
  };

  const isVideoUrl = (url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm');
  };

  const handleCustomParseAlbum = () => {
    if (!albumInput.trim()) return;

    const freshUrls = albumInput
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(url => {
        if (url.toLowerCase().endsWith('.gifv')) {
          return url.slice(0, -5) + '.mp4';
        }
        return url;
      });

    const dynamicAssignedUrls: string[] = [];
    Object.values(imageInputs).forEach(val => {
      if (val) {
        const parsed = val.split(',').map(s => s.trim()).filter(Boolean);
        dynamicAssignedUrls.push(...parsed);
      }
    });

    const uniqueFreshUrls = freshUrls.filter(url => {
      return !unassignedImages.includes(url) && !dynamicAssignedUrls.includes(url);
    });

    if (uniqueFreshUrls.length > 0) {
      setUnassignedImages(prev => [...prev, ...uniqueFreshUrls]);
    }

    setAlbumInput('');
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
            id="base-name-input"
            name="name"
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
            id="base-suffix-input"
            name="customSuffix"
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
            id="base-type-select"
            name="type"
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
            id="base-status-select"
            name="status"
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
            id="base-standalone-checkbox"
            name="isStandalone"
            type="checkbox"
            checked={isStandalone}
            onChange={e => setIsStandalone(e.target.checked)}
            className={styles.checkbox}
          />
        </div>
        <div>
          <div className={styles.fieldLabel}>Passing Date</div>
          <input
            id="meta-field-PassingDate"
            name="PassingDate"
            type="text"
            placeholder="DD-MM-YYYY"
            value={metadataInputs['PassingDate'] || ''}
            onChange={e => handleMetadataInputChange('PassingDate', e.target.value)}
            className={styles.inputField}
          />
        </div>
      </div>

      {/* Required Game Fields */}
      {type.toLowerCase() === 'l4' && partitionedMetadataKeys.requiredKeys.length > 0 && (
        <div className={styles.requiredSection}>
          <h3 className={styles.requiredTitle}>🔒 Required Game Metrics (Layer 4 Core)</h3>
          <div className={styles.twoColumnGrid}>
            {partitionedMetadataKeys.requiredKeys.map(key => (
              <div key={key}>
                <div className={styles.requiredLabel}>{key}</div>
                <input
                  id={`required-field-${key}`}
                  name={key}
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

      {/* Dynamic Attributes */}
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
                      {triggerValues && <span className={styles.textWarning}> (Required by theme 🔒)</span>}
                    </span>
                    <button type="button" onClick={() => handleRemoveMetadataField(key)} className={styles.btnRemove}>Remove</button>
                  </div>

                  {triggerValues ? (
                    <select
                      id={`dynamic-select-${key}`}
                      name={key}
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
                      id={`dynamic-input-${key}`}
                      name={key}
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
          <input id="new-metadata-key-input" name="newMetadataKey" type="text" placeholder="e.g., Twitter" value={newMetadataKey} onChange={e => setNewMetadataKey(e.target.value)} className={styles.inlineInput} />
          <button type="button" onClick={handleAddMetadataField} className={`${styles.btn} ${styles.btnPrimary}`}>Add Attribute Property</button>
        </div>
      </div>

      {/* Media Assets */}
      <h3 className={styles.sectionTitle}>📸 Media Assets (Imgur CDN Links Only)</h3>
      <div className={styles.innerSection}>
        <div style={{ marginBottom: '15px' }}>
          <div className={styles.fieldLabel} style={{ fontSize: '12px' }}>📋 Bulk Imgur Link Ingestion List</div>
          <div className={styles.innerActionRow} style={{ marginTop: '5px' }}>
            <textarea
              id="bulk-album-textarea"
              name="albumInput"
              placeholder="Paste Imgur links separated by spaces, commas or newlines..."
              value={albumInput}
              onChange={e => setAlbumInput(e.target.value)}
              className={styles.textareaField}
              rows={2}
              style={{ width: '100%', resize: 'vertical' }}
            />
            <button
              type="button"
              onClick={handleCustomParseAlbum}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              Load In Pool
            </button>
          </div>
        </div>

        {/* Unassigned Drag Pool */}
        {unassignedImages.length > 0 && (
          <div
            className={styles.innerActionRow}
            style={{
              marginBottom: '20px', padding: '15px', border: '1px dashed var(--text-muted, #ccc)', borderRadius: '6px',
              display: 'flex', gap: '15px', overflowX: 'auto', minHeight: '140px', background: 'rgba(0,0,0,0.02)'
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const dragData = e.dataTransfer.getData('text/plain');
              
              try {
                if (dragData && dragData.startsWith('{')) {
                  const { url, sourceKey } = JSON.parse(dragData);
                  if (sourceKey) {
                    handleUnassignImage(url, sourceKey);
                    return;
                  }
                }
              } catch (err) {
                console.warn("[UI Log] JSON processing error on pool drop.", err);
              }

              let fallbackUrl = e.dataTransfer.getData('url') || dragData;
              if (fallbackUrl) {
                fallbackUrl = fallbackUrl.trim();
                if (fallbackUrl.toLowerCase().endsWith('.gifv')) {
                  fallbackUrl = fallbackUrl.slice(0, -5) + '.mp4';
                }
                if (!unassignedImages.includes(fallbackUrl)) {
                  setUnassignedImages(prev => [...prev, fallbackUrl]);
                }
              }
            }}
          >
            {unassignedImages.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                draggable
                onDragStart={e => {
                  setTimeout(() => setActiveDragSource('pool'), 0);
                  e.dataTransfer.setData('text/plain', JSON.stringify({ url, sourceKey: null }));
                }}
                onDragEnd={() => setActiveDragSource(null)}
                style={{ position: 'relative', cursor: 'grab', flexShrink: 0 }}
              >
                {isVideoUrl(url) ? (
                  <div style={{ width: '110px', height: '110px', background: '#111', borderRadius: '6px', overflow: 'hidden', border: '1px solid #333' }}>
                    <video src={url} muted loop autoPlay draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  </div>
                ) : (
                  <img src={url} alt="Staging thumb" draggable={false} style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', pointerEvents: 'none' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Media Asset Inputs Grid */}
        <div className={styles.twoColumnGrid}>
          {Object.keys(imageInputs).map(key => {
            const isCoreMediaKey = CORE_IMAGE_FIELDS.some(f => f.toLowerCase() === key.toLowerCase());
            const rawValue = imageInputs[key] || '';
            const assignedUrls = rawValue.split(',').map(s => s.trim()).filter(Boolean);

            return (
              <div
                key={key}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const dragData = e.dataTransfer.getData('text/plain');
                  let urlToAssign = '';
                  let detectedSourceKey: string | null = null;

                  try {
                    if (dragData && dragData.startsWith('{')) {
                      const { url, sourceKey } = JSON.parse(dragData);
                      urlToAssign = url;
                      detectedSourceKey = sourceKey;
                    }
                  } catch (err) {
                    console.warn("[UI Log] Error parsing drop payload.", err);
                  }

                  if (!urlToAssign) urlToAssign = e.dataTransfer.getData('url') || dragData;
                  if (!urlToAssign) return;
                  
                  urlToAssign = urlToAssign.trim();
                  if (urlToAssign.toLowerCase().endsWith('.gifv')) {
                    urlToAssign = urlToAssign.slice(0, -5) + '.mp4';
                  }

                  if (detectedSourceKey === key) return;

                  if (detectedSourceKey) {
                    const sourceList = (imageInputs[detectedSourceKey] || '')
                      .split(',')
                      .map(s => s.trim())
                      .filter(s => s && s !== urlToAssign);

                    const targetList = rawValue
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean);

                    if (!targetList.includes(urlToAssign)) targetList.push(urlToAssign);

                    handleImageInputChange(detectedSourceKey, sourceList.join(', '));
                    handleImageInputChange(key, targetList.join(', '));
                  } else {
                    handleAssignImage(urlToAssign, key);
                  }
                }}
              >
                <div className={styles.labelActionRow}>
                  <span>
                    {key}
                    {isCoreMediaKey ? <small className={styles.textMuted}> (Core Asset)</small> : <small className={styles.textWarning}> (Optional Theme Key)</small>}
                  </span>
                  {!isCoreMediaKey && <button type="button" onClick={() => handleRemoveImageField(key)} className={styles.btnRemove}>Remove</button>}
                </div>

                {assignedUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {assignedUrls.map((url, subIdx) => (
                      <div
                        key={`${url}-${subIdx}`}
                        draggable
                        onDragStart={e => {
                          setTimeout(() => setActiveDragSource(key), 0);
                          e.dataTransfer.setData('text/plain', JSON.stringify({ url, sourceKey: key }));
                        }}
                        onDragEnd={() => setActiveDragSource(null)}
                        style={{ position: 'relative', cursor: 'grab', transition: 'transform 0.2s ease', pointerEvents: activeDragSource ? 'none' : 'auto' }}
                      >
                        {isVideoUrl(url) ? (
                          <div style={{ width: '110px', height: '110px', background: '#111', borderRadius: '6px', overflow: 'hidden', border: '1px solid currentColor' }}>
                            <video src={url} muted loop autoPlay draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                          </div>
                        ) : (
                          <img src={url} alt="Asset preview" draggable={false} style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '6px', border: '1px solid currentColor', boxShadow: '0 4px 6px rgba(0,0,0,0.15)', pointerEvents: 'none' }} />
                        )}
                        <button
                          type="button"
                          title="Duplicate to Staging Pool"
                          onClick={() => { if (!unassignedImages.includes(url)) setUnassignedImages(prev => [...prev, url]); }}
                          style={{
                            position: 'absolute', top: '-5px', right: '-5px', background: '#22c55e', color: '#fff', border: 'none',
                            borderRadius: '50%', width: '20px', height: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 20
                          }}
                        >+</button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  id={`media-textarea-${key}`}
                  name={key}
                  placeholder="https://i.imgur.com/example.png"
                  value={rawValue}
                  onChange={e => handleImageInputChange(key, e.target.value)}
                  className={styles.textareaField}
                  style={{ minHeight: '38px', resize: 'none', overflowY: 'hidden', pointerEvents: activeDragSource ? 'none' : 'auto' }}
                />
              </div>
            );
          })}
        </div>

        <div className={styles.innerActionRow}>
          <input id="new-image-key-input" name="newImageKey" type="text" placeholder="e.g., logo or fanart" value={newImageKey} onChange={e => setNewImageKey(e.target.value)} className={styles.inlineInput} />
          <button type="button" onClick={handleAddImageField} className={`${styles.btn} ${styles.btnOutline}`}>Add Asset Field</button>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footerActions}>
        <button type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnBack}`}>Cancel</button>
        <button type="button" onClick={() => void handleSubmit()} className={`${styles.btn} ${styles.btnPrimary}`}>Create & Save</button>
      </div>
    </div>
  );
};