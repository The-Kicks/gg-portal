/**
 * COMPONENT: AdminThemeManager.tsx
 * Doel: De hoofdinterface voor het beheren van thema-profielen in het admin-paneel.
 * Functies: Toont het overzicht van bestaande thema's en biedt de formulier-UI
 * voor het aanmaken of aanpassen van thema-metadata, labels en spel-instellingen.
 */
import { useParams } from 'react-router-dom';
import { GLOBAL_AVAILABLE_GAMES, GUESSWHO_AVAILABLE_COLUMNS } from '../../core/gamesConfig';
import { useAdminTheme } from './AdminTheme/useAdminTheme';
import { ThemeOverviewTable } from './AdminTheme/ThemeOverviewTable';
import { LayerMetadataCard } from './AdminTheme/LayerMetadataCard';
import type { Theme, MetaDataStandard } from '../../types';
import styles from './AdminGlobal.module.css'; // Import van de centrale styles

interface AdminThemeManagerProps {
    loadedThemes: Theme[];
    onRefresh: () => Promise<void>;
}

const AVAILABLE_LAYERS = ['l1', 'l2', 'l3', 'l4'];
const CUSTOM_PORTAL_LABELS = [
    { key: 'l4_standalone', label: 'L4 Standalone / Iconen Sectie', placeholder: 'Bijv. Clubloos / Iconen & Legendes' },
    { key: 'disbanded_tag', label: 'Inactief / Opgeheven Label Achtervoegsel', placeholder: 'Bijv. Opgeheven / Historisch' }
];

export function AdminThemeManager({ loadedThemes, onRefresh }: AdminThemeManagerProps) {
    const { themeName } = useParams<{ themeName: string }>();

    const {
        handleReturnToControlPanel, editingTheme, isNew, error, metaInputs, guesswhoDisabledColumns, setEditingTheme,
        handleStartCreate, handleStartEdit, handleDelete, handleSave,
        updateLabel, updateLayerString, updateLayerArrayInput, handleArrayToggle, handleGuessWhoColumnToggle
    } = useAdminTheme(onRefresh, themeName);

    const layerMetadataRecord = (editingTheme?.layerMetadata || {}) as Record<string, MetaDataStandard>;

    return (
        <div className={styles.container}>

            {/* Topbar */}
            <div className={styles.header}>
                <h2 className={styles.title}>Portals & Theme Brand Identities</h2>
                <button
                    onClick={handleReturnToControlPanel}
                    className={`${styles.btn} ${styles.btnOutline}`}
                >
                    Return to Control Panel
                </button>
            </div>

            {!editingTheme ? (
                <div>
                    <button 
                        onClick={handleStartCreate} 
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        style={{ marginBottom: '20px' }} // Spacing onder de hoofdaanmaakknop
                    >
                        Generate New Theme Record
                    </button>
                    <ThemeOverviewTable loadedThemes={loadedThemes} onEdit={handleStartEdit} onDelete={handleDelete} />
                </div>
            ) : (
                <form onSubmit={handleSave} className={styles.formContainer}>
                    <h3>{isNew ? 'Configure New Theme Instance' : `Modify System Theme Profile: ${editingTheme.id}`}</h3>
                    {error && <p className={styles.textError}>Exception Alert: {error}</p>}

                    {/* Meta Gegevens */}
                    <div className={styles.twoColumnGrid}>
                        <div>
                            <label className={styles.fieldLabel}>Theme Unique ID:</label>
                            <input
                                type="text"
                                disabled={!isNew}
                                value={editingTheme.id || ''}
                                onChange={e => {
                                    const sanitized = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                    setEditingTheme({ ...editingTheme, id: sanitized });
                                }}
                                className={styles.inputField}
                                required
                            />
                        </div>
                        <div>
                            <label className={styles.fieldLabel}>Theme Title Reference:</label>
                            <input 
                                type="text" 
                                value={editingTheme.title || ''} 
                                onChange={e => setEditingTheme({ ...editingTheme, title: e.target.value })} 
                                className={styles.inputField} 
                                required 
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label className={styles.fieldLabel}>Description Meta Content:</label>
                        <textarea 
                            value={editingTheme.description || ''} 
                            onChange={e => setEditingTheme({ ...editingTheme, description: e.target.value })} 
                            className={styles.textareaField} 
                        />
                    </div>

                    {/* Topologies */}
                    <h4 className={styles.accentHeading}>Structure & Navigation Topologies</h4>
                    <div className={`${styles.configSectionBlock} ${styles.twoColumnGrid}`}>
                        <div>
                            <div style={{ marginBottom: '15px' }}>
                                <label className={`${styles.fieldLabel} ${styles.textBold}`}>Core Anchor Stratum:</label>
                                <select 
                                    value={editingTheme.orgLayer || 'l3'} 
                                    onChange={e => setEditingTheme({ ...editingTheme, orgLayer: e.target.value })} 
                                    className={styles.inputField}
                                >
                                    <option value="l1">Layer 1 (Framework)</option>
                                    <option value="l2">Layer 2 (Identity)</option>
                                    <option value="l3">Layer 3 (Team Formation)</option>
                                    <option value="l4">Layer 4 (Asset Level)</option>
                                </select>
                            </div>
                            <div>
                                <label className={`${styles.fieldLabel} ${styles.textBold}`}>Miniature Views:</label>
                                {AVAILABLE_LAYERS.map(l => (
                                    <label key={l} className={styles.checkboxLabelInline}>
                                        <input 
                                            type="checkbox" 
                                            checked={((editingTheme.miniViewLayers || []) as string[]).includes(l)} 
                                            onChange={() => handleArrayToggle('miniViewLayers', l)} 
                                        />
                                        {l.toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div style={{ marginBottom: '15px' }}>
                                <label className={`${styles.fieldLabel} ${styles.textBold}`}>Active Modules:</label>
                                {GLOBAL_AVAILABLE_GAMES.map(g => (
                                    <label key={g.id} className={styles.checkboxLabelInline}>
                                        <input 
                                            type="checkbox" 
                                            checked={((editingTheme.games || []) as string[]).includes(g.id)} 
                                            onChange={() => handleArrayToggle('games', g.id)} 
                                        />
                                        {g.name}
                                    </label>
                                ))}
                            </div>
                            <div>
                                <label className={`${styles.fieldLabel} ${styles.textBold}`}>Navbar Interface Items:</label>
                                {AVAILABLE_LAYERS.map(l => (
                                    <label key={l} className={styles.checkboxLabelInline}>
                                        <input 
                                            type="checkbox" 
                                            checked={((editingTheme.navbarItems || []) as string[]).includes(l)} 
                                            onChange={() => handleArrayToggle('navbarItems', l)} 
                                        />
                                        {l.toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Guess Who Config */}
                    <h4 className={styles.accentHeading}>Game Specific Settings</h4>
                    <div className={styles.configSectionBlock}>
                        <h5>Guess Who Configuration</h5>
                        <div className={styles.verticalStack}>
                            <h6>EXCLUDE FROM THE GUESS WHO GAME</h6>
                            {GUESSWHO_AVAILABLE_COLUMNS.map((col) => {
                                const colId = col.id;
                                const colLabel = col.label;
                                const isMandatory = col.isMandatory === true;
                                const isChecked = guesswhoDisabledColumns.includes(colId);

                                // Genereer voorwaardelijke klassen voor een schone styling-afhandeling
                                const labelClasses = [
                                    styles.guessWhoLabel,
                                    isChecked ? styles.isChecked : '',
                                    isMandatory ? styles.isMandatory : ''
                                ].filter(Boolean).join(' ');

                                return (
                                    <label key={colId} className={labelClasses}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={isMandatory}
                                            onChange={() => handleGuessWhoColumnToggle(colId)}
                                        />
                                        <span>
                                            {colLabel} {isMandatory && '(Required)'}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Nomenclature Labels */}
                    <h4 className={styles.accentHeading}>Layer Schema Nomenclature Definitions</h4>
                    <div className={styles.fourColumnGrid}>
                        {AVAILABLE_LAYERS.map(l => (
                            <div key={l}>
                                <label className={styles.fieldLabel}>{l.toUpperCase()} Alias:</label>
                                <input 
                                    type="text" 
                                    value={editingTheme.labels?.[l] || ''} 
                                    onChange={e => updateLabel(l, e.target.value)} 
                                    className={styles.inputField} 
                                />
                            </div>
                        ))}
                    </div>

                    {/* Custom Portals */}
                    <h4 className={styles.accentHeading}>Custom Portal Display Labels</h4>
                    <div className={styles.twoColumnGrid}>
                        {CUSTOM_PORTAL_LABELS.map(c => (
                            <div key={c.key}>
                                <label className={styles.fieldLabel}>{c.label}:</label>
                                <input 
                                    type="text" 
                                    placeholder={c.placeholder} 
                                    value={editingTheme.labels?.[c.key] || ''} 
                                    onChange={e => updateLabel(c.key, e.target.value)} 
                                    className={styles.inputField} 
                                />
                            </div>
                        ))}
                    </div>

                    {/* Dynamic Layer Metadata Grid */}
                    <h4 className={styles.accentHeading}>Layer Metadata Standard Configuration</h4>
                    <div className={styles.twoColumnGrid} style={{ marginBottom: '30px' }}>
                        {AVAILABLE_LAYERS.map(layer => (
                            <LayerMetadataCard
                                key={layer}
                                layer={layer}
                                layerAlias={editingTheme.labels?.[layer] || `Layer ${layer.toUpperCase()}`}
                                layerMeta={layerMetadataRecord[layer] || { badgeKey: '', subtitleKey: '', gridKeys: [] }}
                                inputs={metaInputs[layer] || { gridKeys: '', statusFormerVal: '', statusAlertVal: '', statusWarningVal: '', statusInfoVal: '' }}
                                onLayerStringChange={updateLayerString}
                                onLayerArrayChange={updateLayerArrayInput}
                            />
                        ))}
                    </div>

                    {/* Form Acties */}
                    <div className={styles.footerActions} style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                        <button 
                            type="submit" 
                            className={`${styles.btn} ${styles.btnPrimary}`}
                        >
                            {isNew ? 'Save New Theme' : 'Apply Settings Changes'}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setEditingTheme(null)} 
                            className={`${styles.btn} ${styles.btnBack}`}
                            style={{ marginBottom: 0 }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}