import React from 'react';
import { useAdminEntityEdit, CORE_IMAGE_FIELDS } from './useAdminEntityEdit';
import type { Theme, HydratedEntity } from '../../../types';
import styles from '../AdminGlobal.module.css';

const entityService = {
  update: async (themeId: string, id: string, data: unknown): Promise<void> => {
    void themeId;
    void id;
    void data;
  }
};

interface AdminEntityEditProps {
  theme: Theme;
  entityId: string;
  onSave: (updatedEntity: HydratedEntity) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

const formatEntityImages = (imageObj: Record<string, unknown>): Record<string, string> => {
  const formatted: Record<string, string> = {};

  Object.keys(imageObj).forEach(key => {
    const value = imageObj[key];
    if (Array.isArray(value)) {
      formatted[key] = value
        .flatMap(v => typeof v === 'string' ? v.split(/[\s,]+/) : [])
        .map(s => s.trim())
        .filter(Boolean)
        .join(' ');
    } else if (typeof value === 'string') {
      formatted[key] = value
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .join(' ');
    } else {
      formatted[key] = '';
    }
  });

  return formatted;
};

export const AdminEntityEdit: React.FC<AdminEntityEditProps> = ({ theme, entityId, onSave, onCancel }) => {

  const handleLocalSave = async (updatedEntity: HydratedEntity) => {
    if (updatedEntity.image) {
      const formattedImage = formatEntityImages(updatedEntity.image as Record<string, unknown>);
      updatedEntity.image = formattedImage as NonNullable<HydratedEntity['image']>;
    }
    await onSave(updatedEntity);
  };

  const {
    originalEntity,
    name,
    setName,
    status,
    setStatus,
    isStandalone,
    setIsStandalone,
    albumInput,
    setAlbumInput,
    unassignedImages,
    setUnassignedImages,
    imageInputs,
    metadataInputs,
    newImageKey,
    setNewImageKey,
    newMetadataKey,
    setNewMetadataKey,
    expandedChildId,
    setExpandedChildId,
    connectionSearchTerm,
    setConnectionSearchTerm,
    isConnectionDropdownOpen,
    setIsConnectionDropdownOpen,
    dropdownRef,
    dynamicTriggers,
    triggerFieldsMap,
    partitionedMetadataKeys,
    filteredAvailableTargets,
    unifiedConnections,
    setLocalConnections,
    setLocalTargetConnections,
    handleImageInputChange,
    handleMetadataInputChange,
    handleAddImageField,
    handleAddMetadataField,
    handleRemoveImageField,
    handleRemoveMetadataField,
    handleConnectionMetadataChange,
    handleRemoveConnection,
    handleAddConnection,
    handleAssignImage,
    handleUnassignImage,
    handleSubmit
  } = useAdminEntityEdit({ theme, entityId, onSave: handleLocalSave });

  if (!originalEntity) {
    return <div className={styles.textWarning}>Error: Target entity profile could not be localized.</div>;
  }

  const isVideoUrl = (url: string): boolean => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
    const videoPlatforms = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'streamable.com'];
    const lowerUrl = url.toLowerCase();
    return (
      videoExtensions.some(ext => lowerUrl.includes(ext)) ||
      videoPlatforms.some(platform => lowerUrl.includes(platform))
    );
  };

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

  const handleCustomParseAlbum = () => {
    if (!albumInput.trim()) return;

    const freshUrls = albumInput
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const dynamicAssignedUrls: string[] = [];
    Object.keys(imageInputs).forEach(key => {
      const val = imageInputs[key];
      if (Array.isArray(val)) {
        dynamicAssignedUrls.push(...val);
      } else if (typeof val === 'string') {
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
      <h2 className={styles.formCardTitle}>
        Modify {originalEntity.type.toUpperCase()}: <span className={styles.textPrimary}>{name}</span>
      </h2>

      {/* Core Base Info Grid */}
      <div className={styles.editInfoGrid}>
        <div>
          <div className={styles.fieldLabel}>Name</div>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={styles.inputField} />
        </div>

        <div>
          <div className={styles.fieldLabel}>Status</div>
          <select value={status} onChange={e => setStatus(e.target.value)} className={styles.inputField}>
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
          <input type="text" placeholder="DD-MM-YYYY of YYYY" value={metadataInputs['PassingDate'] || ''} onChange={e => handleMetadataInputChange('PassingDate', e.target.value)} className={styles.inputField} />
        </div>

        <div>
          <div className={styles.fieldLabel}>Standalone Node</div>
          <input type="checkbox" checked={isStandalone} onChange={e => setIsStandalone(e.target.checked)} className={styles.checkbox} />
        </div>
      </div>

      {/* CONDITIONELE HOEK: STANDALONE PERIOD DETAILS */}
      {isStandalone && (
        <div className={styles.requiredSection} style={{ borderLeftColor: 'var(--primary-color, #3b82f6)', background: 'rgba(59, 130, 246, 0.02)' }}>
          <h3 className={styles.requiredTitle} style={{ color: 'var(--primary-color, #3b82f6)' }}>👤 Standalone / Individual Track Properties</h3>
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
              <div className={styles.requiredLabel}>Track Start Date <span style={{ color: '#d32f2f' }}>*</span></div>
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
      )}

      {/* SECTION A: CORE REQUIRED GAME FIELDS */}
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

      {/* SECTION B: DYNAMIC THEME ATTRIBUTES */}
      <h3 className={styles.sectionTitle}>🛠️ Dynamic Attributes</h3>
      <div className={styles.innerSection}>
        {partitionedMetadataKeys.dynamicKeys.length === 0 ? (
          <p className={`${styles.textMuted} ${styles.labelSubText}`}>No specific layout metadata schema properties injected for this layer.</p>
        ) : (
          <div className={styles.twoColumnGrid}>
            {partitionedMetadataKeys.dynamicKeys.map(key => {
              const triggerValues = triggerFieldsMap[key];
              const isList = key.toLowerCase() === 'nationality' || (metadataInputs[key] && metadataInputs[key].includes(','));

              return (
                <div key={key}>
                  <div className={styles.labelActionRow}>
                    <span>
                      {key} {isList && <small className={styles.textDimmed}>(Array List)</small>}
                    </span>
                    <button type="button" onClick={() => handleRemoveMetadataField(key)} className={styles.btnRemove}>Remove</button>
                  </div>
                  {triggerValues ? (
                    <select value={metadataInputs[key]} onChange={e => handleMetadataInputChange(key, e.target.value)} className={styles.inputField}>
                      <option value="">-- Active / Normal --</option>
                      {triggerValues.map(val => (<option key={val} value={val}>{val}</option>))}
                    </select>
                  ) : (
                    <input type="text" value={metadataInputs[key] || ''} onChange={e => handleMetadataInputChange(key, e.target.value)} className={styles.inputField} />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className={styles.innerActionRow}>
          <input type="text" placeholder="e.g., Twitter" value={newMetadataKey} onChange={e => setNewMetadataKey(e.target.value)} className={styles.inlineInput} />
          <button type="button" onClick={handleAddMetadataField} className={`${styles.btn} ${styles.btnPrimary}`}>Add Attribute</button>
        </div>
      </div>

      {/* Media Assets */}
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

      {/* Mapped Registry Entity Connections */}
      <h3 className={styles.sectionTitle}>Mapped Registry Entity Connections</h3>
      <div className={styles.innerSection}>
        {unifiedConnections.map(conn => {
          const isL4ToL4 = originalEntity.type.toLowerCase() === 'l4' && conn.relatedEntity?.type?.toLowerCase() === 'l4';
          const isExpanded = expandedChildId === conn.relatedEntityId;

          return (
            <div key={conn.id} className={styles.connectionRow} style={{ marginBottom: '15px', padding: '10px', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '6px' }}>
              <div className={styles.connectionHeader}>
                <span className={styles.connectionRowLeft}>
                  <button type="button" onClick={() => setExpandedChildId(isExpanded ? null : conn.relatedEntityId)} className={styles.filterBtn} style={{ padding: '2px 8px', fontSize: '13px' }}>
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                  <span className={conn.direction === 'incoming' ? styles.badgeInbound : styles.badgeOutbound}>
                    {conn.direction === 'incoming' ? 'INBOUND' : 'OUTBOUND'}
                  </span>
                  <span className={styles.layerBadge}>{conn.relatedEntity?.type?.toUpperCase() || 'L4'}</span>
                  <strong className={styles.textPrimary}>{conn.relatedEntity?.name || conn.relatedEntityId}</strong>
                  {isL4ToL4 && <span className={styles.textWarning}>Cross-individual connection</span>}
                </span>

                <div className={styles.connectionDates}>
                  <div className={styles.dateFieldGroup}>
                    <div className={styles.dateLabel}>Start:</div>
                    <input 
                      type="text" 
                      placeholder="YYYY-MM-DD / YYYY" 
                      value={conn.startDate || ''} 
                      onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'startDate', e.target.value)}
                      className={styles.dateHeaderInput}
                    />
                  </div>
                  <div className={styles.dateFieldGroup}>
                    <div className={styles.dateLabel}>End:</div>
                    <input 
                      type="text" 
                      placeholder="YYYY-MM-DD / YYYY" 
                      value={conn.endDate || ''} 
                      onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'endDate', e.target.value)}
                      className={styles.dateHeaderInput}
                    />
                  </div>
                </div>

                <div className={styles.buttonGroup}>
                  <select value={conn.status} onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'status', e.target.value)} className={styles.inputField} style={{ padding: '6px 10px', width: 'auto' }}>
                    <option value="active">Active</option>
                    <option value="former">Former</option>
                    <option value="inactive">Inactive</option>
                    <option value="retired">Retired</option>
                  </select>
                  <button type="button" onClick={() => handleRemoveConnection(conn.id, conn.direction)} className={styles.btnUnlink}>Unlink</button>
                </div>
              </div>

              {isExpanded && conn.relatedEntity && (
                <div className={styles.portalSection} style={{ marginTop: '12px' }}>
                  <h4 className={styles.portalTitle}>Inline sub-modification portal for: {conn.relatedEntity.name}</h4>
                  <AdminEntityEdit
                    theme={theme}
                    entityId={conn.relatedEntityId}
                    onSave={async (updatedChild) => {
                      try {
                        if (updatedChild.image) {
                          const childFormattedImage = formatEntityImages(updatedChild.image as Record<string, unknown>);
                          updatedChild.image = childFormattedImage as NonNullable<HydratedEntity['image']>;
                        }

                        await entityService.update(theme.id, updatedChild.id, updatedChild);
                        setLocalConnections(prev => prev.map(c => c.targetEntityId === updatedChild.id ? { ...c, targetEntity: updatedChild } : c));
                        setLocalTargetConnections(prev => prev.map(c => c.sourceEntityId === updatedChild.id ? { ...c, sourceEntity: updatedChild } : c));
                        window.dispatchEvent(new Event('refresh-database'));
                        setExpandedChildId(null);
                      } catch (err) {
                        console.error(err);
                        alert("Could not update the downstream relational entity.");
                      }
                    }}
                    onCancel={() => setExpandedChildId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}

        <div ref={dropdownRef} className={styles.dropdownWrapper}>
          <input
            type="text"
            placeholder="Type to search entities..."
            value={connectionSearchTerm}
            onFocus={() => setIsConnectionDropdownOpen(true)}
            onChange={e => { setConnectionSearchTerm(e.target.value); setIsConnectionDropdownOpen(true); }}
            className={styles.inputField}
          />
          {isConnectionDropdownOpen && (
            <div className={styles.dropdownMenu}>
              {filteredAvailableTargets.length > 0 ? (
                filteredAvailableTargets.map(t => (
                  <div key={t.id} onClick={() => { handleAddConnection(t.id); setConnectionSearchTerm(''); setIsConnectionDropdownOpen(false); }} className={styles.dropdownItem}>
                    <span className={styles.textBold}>{t.name}</span>
                    <span className={styles.layerBadge}>{t.type.toUpperCase()}</span>
                  </div>
                ))
              ) : (
                <div className={styles.dropdownNoResults}>No matching entities found...</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Footers */}
      <div className={styles.footerActions}>
        <button type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnBack}`} style={{ marginBottom: 0 }}>Cancel</button>
        <button type="button" onClick={(e) => { void handleSubmit(e); }} className={`${styles.btn} ${styles.btnPrimary}`}>Save Commit Changes</button>
      </div>
    </div>
  );
};