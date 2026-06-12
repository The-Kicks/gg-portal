/**
 * COMPONENT: AdminThemeManager.tsx
 * Doel: De hoofdinterface voor het beheren van thema-profielen in het admin-paneel.
 */
import { useParams } from 'react-router-dom';
import { GLOBAL_AVAILABLE_GAMES, GUESSWHO_AVAILABLE_COLUMNS } from '../../core/gamesConfig';
import { useAdminTheme } from './AdminTheme/useAdminTheme';
import { ThemeOverviewTable } from './AdminTheme/ThemeOverviewTable';
import { LayerMetadataCard } from './AdminTheme/LayerMetadataCard';
import type { Theme, MetaDataStandard } from '../../types';
import styles from './AdminGlobal.module.css';

interface AdminThemeManagerProps {
    loadedThemes: Theme[];
    onRefresh: () => Promise<void>;
}

const AVAILABLE_LAYERS = ['l1', 'l2', 'l3', 'l4'];

const CUSTOM_PORTAL_LABELS = [
    { key: 'l4_standalone', label: 'L4 Standalone / Iconen Sectie', placeholder: 'Bijv. Clubloos / Iconen & Legendes' },
    { key: 'disbanded_tag', label: 'Inactief / Opgeheven Label Achtervoegsel', placeholder: 'Bijv. Opgeheven / Historisch' }
];

const LIGHT_COLORS = [
    { key: 'primaryColor', label: 'Primary Brand Color' },
    { key: 'secondaryColor', label: 'Secondary Accent Color' },
    { key: 'backgroundColor', label: 'Main Canvas Background' },
    { key: 'navbarColor', label: 'Navigation Bar Header' },
    { key: 'textColor', label: 'Primary Typography Text' },
];

const DARK_COLORS = [
    { key: 'darkPrimaryColor', label: 'Dark Primary Color' },
    { key: 'darkSecondaryColor', label: 'Dark Secondary Accent' },
    { key: 'darkBackgroundColor', label: 'Dark Canvas Background' },
    { key: 'darkNavbarColor', label: 'Dark Navigation Bar' },
    { key: 'darkTextColor', label: 'Dark Typography Text' },
];

const CORE_ENTITY_ATTRIBUTES = [
    { key: 'DebutYear', label: 'Debut Year / Joined Date Field' },
    { key: 'Role', label: 'Role / Position Field' },
    { key: 'otherCareers', label: 'Historical / Other Careers Field' }
];

export function AdminThemeManager({ loadedThemes, onRefresh }: AdminThemeManagerProps) {
    const { themeName } = useParams<{ themeName: string }>();

    const {
        handleReturnToControlPanel, editingTheme, isNew, error, metaInputs, guesswhoDisabledColumns, setEditingTheme,
        handleStartCreate, handleStartEdit, handleDelete, handleSave,
        updateLabel, updateLayerString, updateLayerArrayInput, handleArrayToggle, handleGuessWhoColumnToggle,
        blindRankingCustomInput, setBlindRankingCustomInput, blindRankingDisabled, handleBlindRankingDisabledToggle
    } = useAdminTheme(onRefresh, themeName);

    // Als we niet aan het editen zijn, render de tabel direct
    if (!editingTheme) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Portals & Theme Brand Identities</h2>
                    <button onClick={handleReturnToControlPanel} className={`${styles.btn} ${styles.btnOutline}`}>
                        Return to Control Panel
                    </button>
                </div>
                <div>
                    <button
                        onClick={handleStartCreate}
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        style={{ marginBottom: '20px' }}
                    >
                        Generate New Theme Record
                    </button>
                    <ThemeOverviewTable loadedThemes={loadedThemes} onEdit={handleStartEdit} onDelete={handleDelete} />
                </div>
            </div>
        );
    }

    const currentTheme = editingTheme as Theme;
    const layerMetadataRecord = (currentTheme.layerMetadata || {}) as Record<string, MetaDataStandard>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Portals & Theme Brand Identities</h2>
                <button onClick={handleReturnToControlPanel} className={`${styles.btn} ${styles.btnOutline}`}>
                    Return to Control Panel
                </button>
            </div>

            <form onSubmit={handleSave} className={styles.formContainer}>
                <h3>{isNew ? 'Configure New Theme Instance' : `Modify System Theme Profile: ${currentTheme.id}`}</h3>
                {error && <p className={styles.textError}>Exception Alert: {error}</p>}

                {/* --- SECTIE 1: META GEGEVENS --- */}
                <div className={styles.twoColumnGrid}>
                    <div>
                        <label className={styles.fieldLabel}>Theme Unique ID:</label>
                        <input
                            type="text"
                            disabled={!isNew}
                            value={currentTheme.id || ''}
                            onChange={e => {
                                const sanitized = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                setEditingTheme(prev => prev ? { ...prev, id: sanitized } : null);
                            }}
                            className={styles.inputField}
                            required
                        />
                    </div>
                    <div>
                        <label className={styles.fieldLabel}>Theme Title Reference:</label>
                        <input
                            type="text"
                            value={currentTheme.title || ''}
                            onChange={e => setEditingTheme(prev => prev ? { ...prev, title: e.target.value } : null)}
                            className={styles.inputField}
                            required
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label className={styles.fieldLabel}>Description Meta Content:</label>
                    <textarea
                        value={currentTheme.description || ''}
                        onChange={e => setEditingTheme(prev => prev ? { ...prev, description: e.target.value } : null)}
                        className={styles.textareaField}
                    />
                </div>

                {/* --- SECTIE 2: TOPOLOGIES & STRUCTUUR --- */}
                <h4 className={styles.accentHeading}>Structure & Navigation Topologies</h4>
                <div className={`${styles.configSectionBlock} ${styles.twoColumnGrid}`}>
                    <div>
                        <div style={{ marginBottom: '15px' }}>
                            <label className={`${styles.fieldLabel} ${styles.textBold}`}>Core Anchor Stratum:</label>
                            <select
                                value={currentTheme.orgLayer || 'l3'}
                                onChange={e => setEditingTheme(prev => prev ? { ...prev, orgLayer: e.target.value } : null)}
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
                                        checked={((currentTheme.miniViewLayers || []) as string[]).includes(l)}
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
                                        checked={((currentTheme.games || []) as string[]).includes(g.id)}
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
                                        checked={((currentTheme.navbarItems || []) as string[]).includes(l)}
                                        onChange={() => handleArrayToggle('navbarItems', l)}
                                    />
                                    {l.toUpperCase()}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- SECTIE 3: THEME AESTHETICS (COLORS) --- */}
                <h4 className={styles.accentHeading}>Theme Aesthetics & Color Palette</h4>
                <div className={styles.configSectionBlock}>
                    <h5>Standard Light Palette</h5>
                    <div className={styles.fiveColumnGrid || styles.fourColumnGrid} style={{ marginBottom: '20px' }}>
                        {LIGHT_COLORS.map(c => (
                            <div key={c.key}>
                                <label className={styles.fieldLabel} style={{ fontSize: '0.8rem' }}>{c.label}:</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="color"
                                        value={(currentTheme[c.key as keyof Theme] as string) || '#ffffff'}
                                        onChange={e => setEditingTheme(prev => prev ? { ...prev, [c.key]: e.target.value } : null)}
                                        style={{ width: '40px', height: '38px', padding: 0, cursor: 'pointer', border: '1px solid #444' }}
                                    />
                                    <input
                                        type="text"
                                        value={(currentTheme[c.key as keyof Theme] as string) || ''}
                                        onChange={e => setEditingTheme(prev => prev ? { ...prev, [c.key]: e.target.value } : null)}
                                        className={styles.inputField}
                                        style={{ textTransform: 'uppercase' }}
                                        placeholder="#FFFFFF"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <h5>Responsive Dark Palette</h5>
                    <div className={styles.fiveColumnGrid || styles.fourColumnGrid}>
                        {DARK_COLORS.map(c => (
                            <div key={c.key}>
                                <label className={styles.fieldLabel} style={{ fontSize: '0.8rem' }}>{c.label}:</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="color"
                                        value={(currentTheme[c.key as keyof Theme] as string) || '#000000'}
                                        onChange={e => setEditingTheme(prev => prev ? { ...prev, [c.key]: e.target.value } : null)}
                                        style={{ width: '40px', height: '38px', padding: 0, cursor: 'pointer', border: '1px solid #444' }}
                                    />
                                    <input
                                        type="text"
                                        value={(currentTheme[c.key as keyof Theme] as string) || ''}
                                        onChange={e => setEditingTheme(prev => prev ? { ...prev, [c.key]: e.target.value } : null)}
                                        className={styles.inputField}
                                        style={{ textTransform: 'uppercase' }}
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- SECTIE 4: NOMENCLATURE & NOMINAL FIELD LABELS --- */}
                <h4 className={styles.accentHeading}>Layer Schema Nomenclature Definitions</h4>
                <div className={styles.configSectionBlock}>
                    <h5>Structural Layer Aliases</h5>
                    <div className={styles.fourColumnGrid} style={{ marginBottom: '20px' }}>
                        {AVAILABLE_LAYERS.map(l => (
                            <div key={l}>
                                <label className={styles.fieldLabel}>{l.toUpperCase()} Engine Alias:</label>
                                <input
                                    type="text"
                                    value={currentTheme.labels?.[l] || ''}
                                    onChange={e => updateLabel(l, e.target.value)}
                                    className={styles.inputField}
                                />
                            </div>
                        ))}
                    </div>

                    <h5>Entity Attributes & Fields Translation</h5>
                    <div className={styles.threeColumnGrid || styles.fourColumnGrid}>
                        {CORE_ENTITY_ATTRIBUTES.map(attr => (
                            <div key={attr.key}>
                                <label className={styles.fieldLabel}>{attr.label}:</label>
                                <input
                                    type="text"
                                    value={currentTheme.labels?.[attr.key] || ''}
                                    onChange={e => updateLabel(attr.key, e.target.value)}
                                    className={styles.inputField}
                                    placeholder={`Bijv. ${attr.key}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- SECTIE 5: CUSTOM PORTAL DISPLAY LABELS --- */}
                <h4 className={styles.accentHeading}>Custom Portal Display Labels</h4>
                <div className={`${styles.configSectionBlock} ${styles.twoColumnGrid}`}>
                    {CUSTOM_PORTAL_LABELS.map(c => (
                        <div key={c.key}>
                            <label className={styles.fieldLabel}>{c.label}:</label>
                            <input
                                type="text"
                                placeholder={c.placeholder}
                                value={currentTheme.labels?.[c.key] || ''}
                                onChange={e => updateLabel(c.key, e.target.value)}
                                className={styles.inputField}
                            />
                        </div>
                    ))}
                </div>

                {/* --- SECTIE 6: GAME SPECIFIC CONFIGURATIONS --- */}
                <h4 className={styles.accentHeading}>Game Specific Configurations</h4>
                <div className={styles.configSectionBlock}>
                    <h5>Guess Who Exclusions Engine</h5>
                    <div className={styles.verticalStack} style={{ marginBottom: '25px' }}>
                        {GUESSWHO_AVAILABLE_COLUMNS.map((col) => {
                            const colId = col.id;
                            const colLabel = col.label;
                            const isMandatory = col.isMandatory === true;
                            const isChecked = guesswhoDisabledColumns.includes(colId);

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
                                        {colLabel} {isMandatory && '(Required Core Parameter)'}
                                    </span>
                                </label>
                            );
                        })}
                    </div>

                    <h5 style={{ marginTop: '25px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                        Blind Ranking Engine
                    </h5>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label className={styles.fieldLabel}>Extra Custom Categories (Comma-separated):</label>
                        <input
                            type="text"
                            value={blindRankingCustomInput}
                            onChange={e => setBlindRankingCustomInput(e.target.value)}
                            className={styles.inputField}
                            placeholder="Bijv. Tracks, Teams, Masters"
                        />
                    </div>

                    <div>
                        <label className={`${styles.fieldLabel} ${styles.textBold}`}>Active Ranking Categories Checklist:</label>
                        <div className={styles.verticalStack} style={{ marginTop: '10px' }}>
                            {(() => {
                                const l4MediaKeys = metaInputs.l4?.mediaKeys
                                    ? metaInputs.l4.mediaKeys.split(',').map(s => s.trim()).filter(Boolean)
                                    : [];
                                    
                                const customCats = blindRankingCustomInput
                                    ? blindRankingCustomInput.split(',').map(s => s.trim()).filter(Boolean)
                                    : [];

                                const checklistItems = [
                                    { id: 'Normal Ranking', label: 'Normal Ranking', source: 'Verplicht', isMandatory: true },
                                    ...l4MediaKeys.map(key => ({ id: key, label: key, source: 'L4 Media Key', isMandatory: false })),
                                    ...customCats.map(key => ({ id: key, label: key, source: 'Custom Option', isMandatory: false }))
                                ];

                                return checklistItems.map(item => {
                                    const isActive = !blindRankingDisabled.includes(item.id);
                                    const isChecked = item.isMandatory || isActive;

                                    const labelClasses = [
                                        styles.guessWhoLabel,
                                        isChecked ? styles.isChecked : '',
                                        item.isMandatory ? styles.isMandatory : ''
                                    ].filter(Boolean).join(' ');

                                    return (
                                        <label key={item.id} className={labelClasses} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    disabled={item.isMandatory}
                                                    onChange={() => handleBlindRankingDisabledToggle(item.id)}
                                                />
                                                <span><strong>{item.label}</strong></span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                                                ({item.source})
                                            </span>
                                        </label>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>

                {/* --- SECTIE 7: DYNAMIC LAYER METADATA CARDS --- */}
                <h4 className={styles.accentHeading}>Layer Metadata Standard Configuration</h4>
                <div className={styles.twoColumnGrid} style={{ marginBottom: '30px' }}>
                    {AVAILABLE_LAYERS.map(layer => (
                        <LayerMetadataCard
                            key={layer}
                            layer={layer}
                            layerAlias={currentTheme.labels?.[layer] || `Layer ${layer.toUpperCase()}`}
                            layerMeta={layerMetadataRecord[layer] || { badgeKey: '', subtitleKey: '', gridKeys: [], mediaKeys: [] }}
                            inputs={metaInputs[layer] || { gridKeys: '', mediaKeys: '', statusFormerVal: '', statusAlertVal: '', statusWarningVal: '', statusInfoVal: '' }}
                            onLayerStringChange={updateLayerString}
                            onLayerArrayChange={updateLayerArrayInput}
                        />
                    ))}
                </div>

                {/* --- FORM ACTIONS --- */}
                <div className={styles.footerActions} style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                        {isNew ? 'Save New Theme Instance' : 'Apply Settings Changes'}
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
        </div>
    );
}