import React from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import { useAdminEntityCreate } from './useAdminEntityCreate';
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

  const getInputValidationClass = (): string => {
    if (idStatus === 'available') return styles.inputAvailable;
    if (idStatus === 'taken') return styles.inputTaken;
    return '';
  };

  // Helper function to verify if a URL represents a video asset
  const isVideoUrl = (url: string): boolean => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
    const videoPlatforms = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'streamable.com'];
    const lowerUrl = url.toLowerCase();
    return (
      videoExtensions.some(ext => lowerUrl.includes(ext)) ||
      videoPlatforms.some(platform => lowerUrl.includes(platform))
    );
  };

  // Helper function to extract valid embed targets for video previews
  const getVideoEmbedUrl = (url: string): string | null => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (lowerUrl.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (lowerUrl.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
    }
    return null;
  };

  // Bulk link digestion handler blocking duplicate assets synchronously
  const handleCustomParseAlbum = () => {
    if (!albumInput.trim()) return;

    const freshUrls = albumInput
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const dynamicAssignedUrls: string[] = [];
    Object.keys(imageInputs).forEach(key => {
      const val = imageInputs[key];
      if (val) {
        const parsed = val.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
        dynamicAssignedUrls.push(...parsed);
      }
    });

    const uniqueFreshUrls = freshUrls.filter(url => {
      const isAlreadyInPool = unassignedImages.includes(url);
      const isAlreadyInAssets = dynamicAssignedUrls.includes(url);
      return !isAlreadyInPool && !isAlreadyInAssets;
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

      {/* SECTION A: CORE REQUIRED GAME FIELDS */}
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

      {/* SECTION B: DYNAMIC THEME ATTRIBUTES */}
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

      {/* SECTION C: MEDIA ASSETS */}
      <h3 className={styles.sectionTitle}>📸 Media Assets (Optional per Theme {type.toUpperCase()} Schema)</h3>
      <div className={styles.innerSection}>

        {/* Bulk Link Ingestion Field */}
        <div style={{ marginBottom: '15px' }}>
          <div className={styles.fieldLabel} style={{ fontSize: '12px' }}>📋 Bulk Link Ingestion List</div>
          <div className={styles.innerActionRow} style={{ marginTop: '5px' }}>
            <textarea
              placeholder="Paste multiple URLs separated by spaces, commas or newlines..."
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

        {/* Unassigned Drag Pool Container */}
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
                const { url, sourceKey } = JSON.parse(dragData);
                if (sourceKey) {
                  // Safely disconnect asset directly out of field back into staging pool
                  handleUnassignImage(url, sourceKey);
                }
              } catch {
                const url = e.dataTransfer.getData('url') || dragData;
                if (url && !unassignedImages.includes(url)) {
                  setUnassignedImages(prev => [...prev, url]);
                }
              }
            }}
          >
            {unassignedImages.map((url, idx) => {
              const embedUrl = getVideoEmbedUrl(url);
              return (
                <div
                  key={`${url}-${idx}`}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', JSON.stringify({ url, sourceKey: null })); }}
                  style={{ position: 'relative', cursor: 'grab', flexShrink: 0 }}
                >
                  {isVideoUrl(url) ? (
                    <div style={{ width: '110px', height: '110px', background: '#111', borderRadius: '6px', overflow: 'hidden', border: '1px solid #333' }}>
                      {embedUrl ? (
                        <iframe src={embedUrl} title="Video preview" style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }} />
                      ) : (
                        <video src={url} muted loop autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                  ) : (
                    <img src={url} alt="Staging thumb" style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unified Media Asset Inputs Grid */}
        <div className={styles.twoColumnGrid}>
          {Object.keys(imageInputs).map(key => {
            const isCoreMediaKey = ['profilecard', 'herobanner'].includes(key.toLowerCase());
            const rawValue = imageInputs[key] || '';
            const assignedUrls = rawValue.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

            return (
              <div
                key={key}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const dragData = e.dataTransfer.getData('text/plain');
                  try {
                    const { url, sourceKey } = JSON.parse(dragData);
                    if (sourceKey === key) return;

                    if (sourceKey) {
                      // Synchronous cross-field batch pass assignment bypassing intermediate staging renders
                      const sourceList = (imageInputs[sourceKey] || '')
                        .split(/[\s,]+/)
                        .map(s => s.trim())
                        .filter(s => s && s !== url);

                      const targetList = rawValue
                        .split(/[\s,]+/)
                        .map(s => s.trim())
                        .filter(Boolean);

                      if (!targetList.includes(url)) {
                        targetList.push(url);
                      }

                      handleImageInputChange(sourceKey, sourceList.join('\n'));
                      handleImageInputChange(key, targetList.join('\n'));
                    } else {
                      // Asset injected straight from unassigned staging pool
                      handleAssignImage(url, key);
                    }
                  } catch {
                    const url = e.dataTransfer.getData('url') || dragData;
                    if (url) {
                      handleAssignImage(url, key);
                    }
                  }
                }}
              >
                <div className={styles.labelActionRow}>
                  <span>
                    {key}
                    {isCoreMediaKey ? (
                      <small className={styles.textMuted}> (Core Asset)</small>
                    ) : (
                      <small className={styles.textWarning}> (Optional Theme-decided Key)</small>
                    )}
                  </span>
                  {!isCoreMediaKey && (
                    <button type="button" onClick={() => handleRemoveImageField(key)} className={styles.btnRemove}>Remove</button>
                  )}
                </div>

                {assignedUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {assignedUrls.map((url, uIdx) => {
                      const embedUrl = getVideoEmbedUrl(url);
                      return (
                        <div
                          key={`${url}-${uIdx}`}
                          draggable
                          onDragStart={e => { e.dataTransfer.setData('text/plain', JSON.stringify({ url, sourceKey: key })); }}
                          style={{ position: 'relative', cursor: 'grab', transition: 'transform 0.2s ease' }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.zIndex = '10'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1'; }}
                        >
                          {isVideoUrl(url) ? (
                            <div style={{ width: '110px', height: '110px', background: '#111', borderRadius: '6px', overflow: 'hidden', border: '1px solid currentColor' }}>
                              {embedUrl ? (
                                <iframe src={embedUrl} title="Video preview" style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }} />
                              ) : (
                                <video src={url} muted loop autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              )}
                            </div>
                          ) : (
                            <img src={url} alt="Asset preview" style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '6px', border: '1px solid currentColor', boxShadow: '0 4px 6px rgba(0,0,0,0.15)' }} />
                          )}

                          <button
                            type="button"
                            title="Duplicate to Staging Pool"
                            onClick={() => {
                              if (!unassignedImages.includes(url)) {
                                setUnassignedImages(prev => [...prev, url]);
                              }
                            }}
                            style={{
                              position: 'absolute', top: '-5px', right: '-5px',
                              background: '#22c55e', color: '#fff', border: 'none',
                              borderRadius: '50%', width: '20px', height: '20px', fontSize: '14px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)', zIndex: 20, fontWeight: 'bold'
                            }}
                          >
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  placeholder="https://image-url.com/asset.png"
                  value={rawValue}
                  onChange={e => {
                    handleImageInputChange(key, e.target.value);
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  ref={el => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  className={styles.textareaField}
                  rows={1}
                  style={{
                    minHeight: '38px',
                    resize: 'none',
                    overflowY: 'hidden',
                    lineHeight: '1.5'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Lower Action Row */}
        <div className={styles.innerActionRow}>
          <input
            type="text"
            placeholder="e.g., logo or fanart"
            value={newImageKey}
            onChange={e => setNewImageKey(e.target.value)}
            className={styles.inlineInput}
          />
          <button type="button" onClick={handleAddImageField} className={`${styles.btn} ${styles.btnOutline}`}>
            Add Asset Field
          </button>
        </div>
      </div>

      {/* Action Footers */}
      <div className={styles.footerActions}>
        <button type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnBack}`}>Cancel</button>
        <button type="button" onClick={() => { void handleSubmit(); }} className={`${styles.btn} ${styles.btnPrimary}`}>Create & Save</button>
      </div>
    </div>
  );
};