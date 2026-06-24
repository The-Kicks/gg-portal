import React from 'react';
import { useAdminEntityEdit } from './useAdminEntityEdit';
import { CORE_IMAGE_FIELDS } from '../adminUtils/useMediaCategories';
import { formatEntityImages, isVideoUrl, getVideoEmbedUrl } from '../adminUtils/adminEntityHelpers';
import type { Theme, HydratedEntity } from '../../../types';
import styles from '../AdminGlobal.module.css';

interface AdminEntityEditProps {
  theme: Theme;
  entityId: string;
  onSave: (updatedEntity: HydratedEntity) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

interface DynamicTriggerConfig {
  value: string;
}

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
    handleImageInputChange,
    handleMetadataInputChange,
    handleAddImageField,
    handleAddMetadataField,
    handleRemoveImageField,
    handleRemoveMetadataField,
    handleConnectionMetadataChange,
    handleRemoveConnection,
    handleCreateNonRelationalTrack,
    handleAddConnection,
    handleAssignImage,
    handleUnassignImage,
    formatMilestonesToText,
    handleSyncMilestones,
    handleSubmit
  } = useAdminEntityEdit({ theme, entityId, onSave: handleLocalSave });

  if (!originalEntity) {
    return <div className={styles.textWarning}>Error: Target entity profile could not be localized.</div>;
  }

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

  const isL3Entity = originalEntity.type.toLowerCase() === 'l3';
  
  // Filter l3Milestones én de interne object-metadata uit de dynamic attributes lijst
  const visibleDynamicKeys = partitionedMetadataKeys.dynamicKeys.filter(
    key => key !== 'l3Milestones' && key !== 'customTracks' && key !== 'customRelationsMetadata'
  );

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
            {Object.entries(dynamicTriggers).map(([triggerKey, triggerConfig]) => {
              const config = triggerConfig as DynamicTriggerConfig;
              return (
                <option key={triggerKey} value={triggerKey}>
                  {config.value.charAt(0).toUpperCase() + config.value.slice(1)} (Schema Trigger)
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <div className={styles.fieldLabel}>Passing Date</div>
          <input type="text" placeholder="DD-MM-YYYY of YYYY" value={metadataInputs['PassingDate'] || ''} onChange={e => handleMetadataInputChange('PassingDate', e.target.value)} className={styles.inputField} />
        </div>
      </div>

      {/* Core Required Game Fields */}
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

      {/* Dynamic Theme Attributes */}
      <h3 className={styles.sectionTitle}>🛠️ Dynamic Attributes</h3>
      <div className={styles.innerSection}>
        {visibleDynamicKeys.length === 0 ? (
          <p className={`${styles.textMuted} ${styles.labelSubText}`}>No specific layout metadata schema properties injected for this layer.</p>
        ) : (
          <div className={styles.twoColumnGrid}>
            {visibleDynamicKeys.map(key => {
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

        {/* L3 Milestones Network Builder */}
        {isL3Entity && (
          <div style={{ marginBottom: '25px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div className={styles.fieldLabel} style={{ marginBottom: '2px', fontWeight: 'bold' }}>🏆 L3 Global Timeline Milestones</div>
                <small className={styles.textMuted}>Definieer hier de chronologische milestones van deze L3 (Formaat: <code>YYYY: Milestone</code>)</small>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <button
                  type="button"
                  onClick={handleSyncMilestones}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  🔄 Sync met actieve periodes
                </button>
                <span style={{ fontSize: '10px', color: '#eab308', opacity: 0.85, maxWidth: '240px', textAlign: 'right' }}>
                  ⚠️ <em>Safe-Sync: Overschrijft geen relaties waar al handmatig milestones zijn ingevuld.</em>
                </span>
              </div>
            </div>
            <textarea
              placeholder={`Bijvoorbeeld:\n2015: Group Formed and Pre-debut Activities\n2019: First World Tour Announced`}
              value={metadataInputs['l3Milestones'] || ''}
              onChange={e => handleMetadataInputChange('l3Milestones', e.target.value)}
              className={styles.textareaField}
              rows={4}
              style={{ width: '100%', resize: 'vertical', lineHeight: '1.5', fontFamily: 'monospace' }}
            />
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: '20px' }} ref={dropdownRef}>
          <label className={styles.fieldLabel}>Connect with Existing Node OR Create Shared Custom Track</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search existing node OR type a custom track name..."
              value={connectionSearchTerm}
              onChange={e => setConnectionSearchTerm(e.target.value)}
              onFocus={() => setIsConnectionDropdownOpen(true)}
              className={styles.inputField}
            />
            {connectionSearchTerm.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  handleCreateNonRelationalTrack(connectionSearchTerm.trim());
                  setConnectionSearchTerm('');
                  setIsConnectionDropdownOpen(false);
                }}
                className={`${styles.btn} ${styles.btnOutline}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                ➕ Add Custom Track
              </button>
            )}
          </div>

          {/* Dropdown voor bestaande nodes */}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {unifiedConnections.length === 0 ? (
            <p className={styles.textMuted}>This new record is currently isolated. Connect it to map it into the timeline graph engine.</p>
          ) : (
            unifiedConnections.map(conn => {
              const uniqueConnKey = `${conn.direction}-${conn.id}-${conn.relatedEntityId}`;
              const isNonRelational = conn.metadata?.isNonRelational || conn.relatedEntityId.startsWith('virtual-track:');
              const isIncoming = conn.direction === 'incoming';

              const displayName = isNonRelational
                ? (typeof conn.metadata?.customTargetName === 'object'
                  ? 'Custom Track (Foutief Object)'
                  : conn.metadata?.customTargetName || 'Custom Shared Track')
                : (conn.relatedEntity?.name || conn.relatedEntityId);

              return (
                <div
                  key={uniqueConnKey}
                  className={styles.connectionRow}
                  style={isIncoming ? { opacity: 0.85, borderLeft: '3px solid #eab308', padding: '15px' } : undefined}
                >
                  {/* Waarschuwing bovenaan bij inkomende relaties */}
                  {isIncoming && (
                    <div style={{
                      backgroundColor: 'rgba(234, 179, 8, 0.1)',
                      border: '1px solid rgba(234, 179, 8, 0.2)',
                      color: '#eab308',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      marginBottom: '12px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      ⚠️ You can only edit outgoing relations. Edit incoming relations from the source node <strong>({displayName})</strong>.
                    </div>
                  )}

                  {/* Header Layout: Info links, Datums rechts */}
                  <div className={styles.connectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    
                    {/* Linkerkant */}
                    <div className={styles.connectionRowLeft} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={isNonRelational ? styles.badgeOutbound : conn.direction === 'outgoing' ? styles.badgeOutbound : styles.badgeInbound}>
                        {isNonRelational ? 'TRACK' : conn.direction === 'outgoing' ? 'OUTGOING' : 'INBOUND 🔒'}
                      </span>
                      <span className={styles.textBold}>{displayName}</span>
                      {!isNonRelational && (
                        <span className={styles.layerBadge}>
                          {conn.relatedEntity?.type?.toUpperCase() || 'L4'}
                        </span>
                      )}
                    </div>

                    {/* Rechterkant: Datum selectors & Disconnect knop */}
                    <div className={styles.connectionDates} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className={styles.dateFieldGroup}>
                        <select
                          value={conn.status || 'active'}
                          onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'status', e.target.value)}
                          className={styles.dateHeaderInput}
                          style={{ width: '110px' }}
                          disabled={isIncoming}
                        >
                          <option value="active">Active</option>
                          <option value="past">Past</option>
                          <option value="loan">Loan</option>
                        </select>
                      </div>

                      <div className={styles.dateFieldGroup}>
                        <span className={styles.dateLabel}>From</span>
                        <input
                          type="text"
                          placeholder="DD-MM-YYYY"
                          value={conn.startDate || ''}
                          onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'startDate', e.target.value)}
                          className={styles.dateHeaderInput}
                          style={{ width: '100px', padding: '6px 8px', textAlign: 'center' }}
                          disabled={isIncoming}
                        />
                      </div>

                      <div className={styles.dateFieldGroup}>
                        <span className={styles.dateLabel}>To</span>
                        <input
                          type="text"
                          placeholder="Pres."
                          value={conn.endDate || ''}
                          onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'endDate', e.target.value)}
                          className={styles.dateHeaderInput}
                          style={{ width: '100px', padding: '6px 8px', textAlign: 'center' }}
                          disabled={isIncoming}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveConnection(conn.id, conn.direction)}
                        className={styles.btnUnlink}
                        disabled={isIncoming}
                        style={isIncoming ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Excluded Periods (Gestructureerd i.p.v. Textarea) */}
                  <div style={{ marginTop: '15px' }}>
                    <div className={styles.fieldLabel} style={{ fontSize: '12px', marginBottom: '8px', fontWeight: '500' }}>
                      🤕 Excluded Periods (Injuries / Hiatus / Breaks)
                    </div>

                    {(() => {
                      const periods: Array<{ start: string; end: string; reason: string }> = 
                        Array.isArray(conn.metadata?.excludedPeriods) ? conn.metadata.excludedPeriods : [];

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                          {periods.map((period, pIdx) => (
                            <div key={pIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="Start (DD-MM-YYYY)"
                                value={period.start || ''}
                                disabled={isIncoming}
                                className={styles.dateHeaderInput}
                                style={{ width: '130px', padding: '6px 8px' }}
                                onChange={e => {
                                  const updated = [...periods];
                                  updated[pIdx] = { ...updated[pIdx], start: e.target.value };
                                  handleConnectionMetadataChange(conn.id, conn.direction, 'excludedPeriods', updated);
                                }}
                              />
                              <span className={styles.textMuted} style={{ fontSize: '12px' }}>tot</span>
                              <input
                                type="text"
                                placeholder="Eind (DD-MM-YYYY)"
                                value={period.end || ''}
                                disabled={isIncoming}
                                className={styles.dateHeaderInput}
                                style={{ width: '130px', padding: '6px 8px' }}
                                onChange={e => {
                                  const updated = [...periods];
                                  updated[pIdx] = { ...updated[pIdx], end: e.target.value };
                                  handleConnectionMetadataChange(conn.id, conn.direction, 'excludedPeriods', updated);
                                }}
                              />
                              <input
                                type="text"
                                placeholder="Reden (bijv. Injury, Hiatus)"
                                value={period.reason || ''}
                                disabled={isIncoming}
                                className={styles.inputField}
                                style={{ margin: 0, flex: 1, padding: '6px 10px' }}
                                onChange={e => {
                                  const updated = [...periods];
                                  updated[pIdx] = { ...updated[pIdx], reason: e.target.value };
                                  handleConnectionMetadataChange(conn.id, conn.direction, 'excludedPeriods', updated);
                                }}
                              />
                              {!isIncoming && (
                                <button
                                  type="button"
                                  className={styles.btnRemove}
                                  style={{ padding: '4px 10px', height: '34px', display: 'flex', alignItems: 'center' }}
                                  onClick={() => {
                                    const updated = periods.filter((_, i) => i !== pIdx);
                                    handleConnectionMetadataChange(conn.id, conn.direction, 'excludedPeriods', updated);
                                  }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}

                          {!isIncoming && (
                            <button
                              type="button"
                              className={styles.btnOutline}
                              style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '12px', marginTop: '4px' }}
                              onClick={() => {
                                const updated = [...periods, { start: '', end: '', reason: '' }];
                                handleConnectionMetadataChange(conn.id, conn.direction, 'excludedPeriods', updated);
                              }}
                            >
                              ➕ Add Period
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Milestones Textarea */}
                  <div style={{ marginTop: '15px', paddingLeft: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                        💡 Format per regel: <strong>YYYY: Milestone</strong> of <strong>DD-MM-YYYY: Milestone</strong>
                      </span>
                    </div>
                    <textarea
                      placeholder="Example:&#10;2018: Champions League Winner&#10;12-05-2021: Voted Player of the Year"
                      value={formatMilestonesToText(conn.metadata?.milestones)}
                      onChange={e => handleConnectionMetadataChange(conn.id, conn.direction, 'milestones', e.target.value)}
                      className={styles.textareaField}
                      rows={2}
                      disabled={isIncoming}
                      style={{
                        height: 'auto',
                        minHeight: '55px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        resize: isIncoming ? 'none' : 'vertical',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        color: isIncoming ? 'rgba(255,255,255,0.5)' : '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Action Footers */}
      <div className={styles.footerActions}>
        <button type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnBack}`} style={{ marginBottom: 0 }}>Cancel</button>
        <button type="button" onClick={(e) => { void handleSubmit(e); }} className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginBottom: 0 }}>
          Save Modifications
        </button>
      </div>
    </div>
  );
};