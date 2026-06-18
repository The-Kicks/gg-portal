import React from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import { useAdminEntityCreate } from './useAdminEntityCreate';
import { CORE_IMAGE_FIELDS } from '../adminUtils/useMediaCategories';
import styles from '../AdminGlobal.module.css';

interface Props {
  theme: Theme;
  onSave: (newEntity: HydratedEntity) => void | Promise<void>;
  onCancel: () => void;
}

// HELPER: Vertaalt eventuele JSON/Arrays uit de backend live terug naar platte tekstregels voor de gebruiker
const formatMilestonesToText = (milestones: unknown): string => {
  if (!milestones) return '';
  if (typeof milestones === 'string') return milestones;

  if (Array.isArray(milestones)) {
    return milestones
      .map(m => {
        if (m && typeof m === 'object') {
          const date = m.date ? String(m.date).trim() : '';
          const title = m.title ? String(m.title).trim() : '';
          
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
    idStatus,
    currentLayerMetadata,
    imageInputs,
    metadataInputs,
    newImageKey,
    setNewImageKey,
    newMetadataKey,
    setNewMetadataKey,
    triggerFieldsMap,
    partitionedMetadataKeys,
    albumInput,
    setAlbumInput,
    unassignedImages,
    setUnassignedImages,
    handleTypeChange,
    handleStandaloneChange,
    handleImageInputChange,
    handleMetadataInputChange,
    handleAddImageField,
    handleAddMetadataField,
    handleRemoveImageField,
    handleRemoveMetadataField,
    handleAssignImage,
    handleUnassignImage,
    handleSubmit,
    expandedChildId,
    setExpandedChildId,
    connectionSearchTerm,
    setConnectionSearchTerm,
    isConnectionDropdownOpen,
    setIsConnectionDropdownOpen,
    dropdownRef,
    filteredAvailableTargets,
    unifiedConnections,
    handleConnectionMetadataChange,
    handleRemoveConnection,
    handleCreateNonRelationalTrack,
    handleAddConnection
  } = useAdminEntityCreate({ theme, onSave });

  const getInputValidationClass = (): string => {
    if (idStatus === 'available') return styles.inputAvailable;
    if (idStatus === 'taken') return styles.inputTaken;
    return '';
  };

  const isVideoUrl = (url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be');
  };

  const getVideoEmbedUrl = (url: string): string | null => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (lowerUrl.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    return null;
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
        const parsed = (Array.isArray(val) ? val : val.split(/[\s,]+/))
          .map(s => s.trim())
          .filter(Boolean);
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

  // ==========================================
  // SUB-RENDER FUNCTIES (Houdt JSX overzichtelijk)
  // ==========================================
  
  const renderStandaloneSection = () => {
    if (!isStandalone) return null;
    return (
      <div className={styles.requiredSection} style={{ borderLeftColor: 'var(--primary-color, #3b82f6)', background: 'rgba(59, 130, 246, 0.02)' }}>
        <h3 className={styles.requiredTitle}>👤 Standalone / Individual Track Properties</h3>
        <p className={`${styles.labelSubText} ${styles.textMuted}`}>Configure how this entity behaves when working outside of assigned groups, teams or collectives.</p>
        
        <div className={styles.twoColumnGrid} style={{ marginTop: '10px' }}>
          <div>
            <div className={styles.requiredLabel}>Timeline Display Label <small className={styles.textMuted}>(e.g. Solo, Free Agent, Individual)</small></div>
            <input 
              type="text" 
              placeholder="Leave empty for fallback defaults" 
              value={metadataInputs['standaloneLabel'] || ''} 
              onChange={e => handleMetadataInputChange('standaloneLabel', e.target.value)}
              className={styles.inputField}
            />
          </div>

          <div>
            <div className={styles.requiredLabel}>Individual Status</div>
            <select 
              value={metadataInputs['standaloneStatus'] || 'active'} 
              onChange={e => handleMetadataInputChange('standaloneStatus', e.target.value)}
              className={styles.inputField}
            >
              <option value="active">Active Track</option>
              <option value="former">Ended / Former Track</option>
            </select>
          </div>

          <div>
            <div className={styles.requiredLabel}>Track Start Date <span style={{ color: '#ef4444' }}>*</span></div>
            <input 
              type="text" 
              placeholder="YYYY-MM-DD or YYYY" 
              value={metadataInputs['standaloneStartDate'] || ''} 
              onChange={e => handleMetadataInputChange('standaloneStartDate', e.target.value)}
              className={styles.inputField}
              style={{ borderColor: !metadataInputs['standaloneStartDate'] ? '#ef4444' : undefined }}
            />
          </div>

          <div>
            <div className={styles.requiredLabel}>Track End Date <small className={styles.textMuted}>(Optional)</small></div>
            <input 
              type="text" 
              placeholder="YYYY-MM-DD / YYYY (Keep blank if active)" 
              value={metadataInputs['standaloneEndDate'] || ''} 
              onChange={e => handleMetadataInputChange('standaloneEndDate', e.target.value)}
              className={styles.inputField}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderLayerSpecificMetadata = () => {
    const isL4 = type.toLowerCase() === 'l4';
    const isL3 = type.toLowerCase() === 'l3';
    
    if ((isL4 || isL3) && partitionedMetadataKeys.requiredKeys.length > 0) {
      return (
        <div className={styles.requiredSection}>
          <h3 className={styles.requiredTitle}>
            🔒 Required Metrics ({isL3 ? 'Layer 3 Team Core' : 'Layer 4 Individual Core'})
          </h3>
          <p className={`${styles.labelSubText} ${styles.textMuted}`}>
            These attributes are strictly required by the engine config for this tier level.
          </p>
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
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      {/* Back to Dashboard Button */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-start' }}>
        <button 
          type="button" 
          onClick={onCancel} 
          className={`${styles.btn} ${styles.btnBack}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          ⬅️ Back to Dashboard
        </button>
      </div>

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
              {currentLayerMetadata?.statusTriggers && Object.entries(currentLayerMetadata.statusTriggers).map(([triggerKey, triggerConfig]) => {
                if (!triggerConfig) return null;
                return (
                  <option key={triggerKey} value={triggerConfig.key}>
                    {triggerConfig.value.charAt(0).toUpperCase() + triggerConfig.value.slice(1)} (Schema Trigger)
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <div className={styles.fieldLabel}>Standalone Node</div>
            <input
              id="base-standalone-checkbox"
              name="isStandalone"
              type="checkbox"
              checked={isStandalone}
              onChange={e => handleStandaloneChange(e.target.checked)}
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

        {/* Dynamic & Layer Conditional Sections */}
        {renderStandaloneSection()}
        {renderLayerSpecificMetadata()}

        {/* Dynamic Attributes */}
        <h3 className={styles.sectionTitle}>🛠️ Dynamic Attributes (Theme Properties)</h3>
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

        {/* Media Assets Section */}
        <h3 className={styles.sectionTitle}>Media Assets (Images & Videos)</h3>
        <div className={styles.innerSection}>
          <div style={{ marginBottom: '15px' }}>
            <div className={styles.fieldLabel} style={{ fontSize: '12px' }}>📋 Bulk Link Ingestion List</div>
            <div className={styles.innerActionRow} style={{ marginTop: '5px' }}>
              <textarea
                placeholder="Plak hier meerdere URL's gescheiden door spaties, komma's of regels..."
                value={albumInput}
                onChange={e => setAlbumInput(e.target.value)}
                className={styles.textareaField}
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <button type="button" onClick={handleCustomParseAlbum} className={`${styles.btn} ${styles.btnPrimary}`}>In Pool Laden</button>
            </div>
          </div>

          {unassignedImages.length > 0 && (
            <div
              className={styles.innerActionRow}
              style={{
                marginBottom: '20px', padding: '15px', border: '1px dashed var(--border-color, #ccc)', borderRadius: '6px',
                display: 'flex', gap: '15px', overflowX: 'auto', minHeight: '140px', background: 'rgba(0,0,0,0.02)'
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dragData = e.dataTransfer.getData('text/plain');
                try {
                  const { url, sourceKey } = JSON.parse(dragData);
                  if (sourceKey) {
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
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ url, sourceKey: null }));
                    }}
                    style={{ position: 'relative', cursor: 'grab', flexShrink: 0 }}
                  >
                    {isVideoUrl(url) ? (
                      <div style={{ width: '110px', height: '110px', background: '#111', borderRadius: '6px', overflow: 'hidden', border: '1px solid #333' }}>
                        {embedUrl ? (
                          <iframe src={embedUrl} title="Video preview" style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }} />
                        ) : (
                          <video src={url} muted loop autoPlay draggable={false} style={{ width: '110px', height: '110px', objectFit: 'cover' }} />
                        )}
                      </div>
                    ) : (
                      <img src={url} alt="Staging thumb" draggable={false} style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.twoColumnGrid}>
            {Object.keys(imageInputs).map(key => {
              const isCoreMediaKey = CORE_IMAGE_FIELDS.some(f => f.toLowerCase() === key.toLowerCase());
              const rawValue = imageInputs[key];
              const assignedUrls = Array.isArray(rawValue)
                ? rawValue
                : typeof rawValue === 'string'
                  ? rawValue.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
                  : [];

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
                        const sourceList = (Array.isArray(imageInputs[sourceKey])
                          ? imageInputs[sourceKey]
                          : typeof imageInputs[sourceKey] === 'string'
                            ? imageInputs[sourceKey].split(/[\s,]+/)
                            : []
                        ).map((s: string) => s.trim()).filter((s: string) => s && s !== url);

                        const targetList = (Array.isArray(imageInputs[key])
                          ? imageInputs[key]
                          : typeof imageInputs[key] === 'string'
                            ? imageInputs[key].split(/[\s,]+/)
                            : []
                        ).map((s: string) => s.trim()).filter(Boolean);

                        if (!targetList.includes(url)) {
                          targetList.push(url);
                        }

                        handleImageInputChange(sourceKey, sourceList.join('\n'));
                        handleImageInputChange(key, targetList.join('\n'));
                      } else {
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
                      {isCoreMediaKey && <span className={styles.textWarning} style={{ color: '#d32f2f' }}> (Core Asset 🔒)</span>}
                    </span>
                    <button type="button" onClick={() => handleRemoveImageField(key)} className={styles.btnRemove}>Remove Field</button>
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
                              title="Dupliceren naar Pool"
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
                    value={Array.isArray(imageInputs[key]) ? imageInputs[key].join('\n') : imageInputs[key] || ''}
                    onChange={e => {
                      handleImageInputChange(key, e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                    className={styles.textareaField}
                    rows={1}
                    style={{ minHeight: '38px', resize: 'none', overflowY: 'hidden', lineHeight: '1.5' }}
                  />
                </div>
              );
            })}
          </div>

          <div className={styles.innerActionRow}>
            <input type="text" placeholder="e.g., streamingTeaser" value={newImageKey} onChange={e => setNewImageKey(e.target.value)} className={styles.inlineInput} />
            <button type="button" onClick={handleAddImageField} className={`${styles.btn} ${styles.btnOutline}`}>Add Asset Field</button>
          </div>
        </div>

        {/* Relational Graph & Timeline Connections */}
        <h3 className={styles.sectionTitle}>🔗 Map Network Relations & Timeline History</h3>
        <div className={styles.innerSection}>
          <div style={{ position: 'relative', marginBottom: '15px' }} ref={dropdownRef}>
            <div className={styles.fieldLabel}>Connect with Existing Theme Node</div>
            <input
              type="text"
              placeholder="Search theme directory by node name or layout hierarchy level..."
              value={connectionSearchTerm}
              onChange={e => setConnectionSearchTerm(e.target.value)}
              onFocus={() => setIsConnectionDropdownOpen(true)}
              className={styles.inputField}
            />

            {isConnectionDropdownOpen && filteredAvailableTargets.length > 0 && (
              <div className={styles.dropdownMenu}>
                {filteredAvailableTargets.map(target => (
                  <div
                    key={target.id}
                    onClick={() => {
                      handleAddConnection(target.id);
                      setConnectionSearchTerm('');
                      setIsConnectionDropdownOpen(false);
                    }}
                    className={styles.dropdownItem}
                  >
                    <strong>{target.name}</strong> <small>({target.type.toUpperCase()} • ID: {target.id})</small>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inline Track Creation Utility */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
            <button 
              type="button" 
              onClick={handleCreateNonRelationalTrack} 
              className={`${styles.btn} ${styles.btnOutline}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              ➕ Create Shared Virtual Track / Custom Affiliation
            </button>
          </div>

          {/* Current Active Connections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unifiedConnections.length === 0 ? (
              <p className={styles.textMuted}>This new record is currently isolated. Connect it to map it into the timeline graph engine.</p>
            ) : (
              unifiedConnections.map(conn => {
                const uniqueConnKey = `${conn.direction}-${conn.id}-${conn.relatedEntityId}`;
                const isExpanded = expandedChildId === uniqueConnKey;

                return (
                  <div key={uniqueConnKey} className={styles.connectionCard}>
                    <div className={styles.connectionHeader}>
                      <div onClick={() => setExpandedChildId(isExpanded ? null : uniqueConnKey)} style={{ cursor: 'pointer', flexGrow: 1 }}>
                        <span className={styles.connectionBadge}>
                          {conn.direction === 'outgoing' ? '➡️ Outgoing Link' : '⬅️ Incoming Source'}
                        </span>
                        <strong style={{ marginLeft: '10px' }}>{conn.relatedEntity?.name || conn.relatedEntityId}</strong>
                        <small style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>
                          ({conn.relatedEntity?.type?.toUpperCase() || 'L4'})
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveConnection(conn.id, conn.direction)}
                        className={styles.btnRemove}
                      >
                        Disconnect
                      </button>
                    </div>

                    {isExpanded && (
                      <div className={styles.connectionBody}>
                        <div className={styles.threeColumnGrid}>
                          <div>
                            <label className={styles.fieldLabel}>Relational Lifecycle Status</label>
                            <select
                              value={conn.status}
                              onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'status', e.target.value)}
                              className={styles.inputField}
                            >
                              <option value="active">Active / Present</option>
                              <option value="past">Past / Former member</option>
                              <option value="loan">Loan Spell / External</option>
                            </select>
                          </div>
                          <div>
                            <label className={styles.fieldLabel}>Affiliation Start Year</label>
                            <input
                              type="text"
                              placeholder="e.g., 2003"
                              value={conn.startDate || ''}
                              onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'startDate', e.target.value)}
                              className={styles.inputField}
                            />
                          </div>
                          <div>
                            <label className={styles.fieldLabel}>Affiliation Termination Year</label>
                            <input
                              type="text"
                              placeholder="e.g., 2014 (or blank)"
                              value={conn.endDate || ''}
                              onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'endDate', e.target.value)}
                              className={styles.inputField}
                            />
                          </div>
                        </div>

                        {/* Milestones / Comebacks Textarea veld */}
                        <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>🏆 Milestones & Comebacks Track History</label>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', alignmentBaseline: 'middle' }}>
                              💡 Format per regel: <strong>YYYY: Milestone</strong> of <strong>DD-MM-YYYY: Milestone</strong>
                            </span>
                          </div>
                          <textarea
                            placeholder={"Example:\n2022: POP! (IM NAYEON)\n2024: ABCD (NA)"}
                            value={formatMilestonesToText(conn.metadata?.milestones)}
                            onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'milestones', e.target.value)}
                            className={styles.textareaField}
                            rows={3} 
                            style={{
                              height: 'auto',
                              minHeight: '65px',
                              padding: '8px 12px',
                              fontSize: '13px',
                              lineHeight: '1.4',
                              resize: 'vertical',
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '4px',
                              width: '100%'
                            }}
                          />
                        </div>

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footerActions} style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnBack}`}>Cancel</button>
          <button type="button" onClick={(e) => void handleSubmit(e)} className={`${styles.btn} ${styles.btnPrimary}`} style={{ padding: '12px 24px', fontSize: '16px' }}>Create & Save</button>
        </div>
      </div>
    </div>
  );
};