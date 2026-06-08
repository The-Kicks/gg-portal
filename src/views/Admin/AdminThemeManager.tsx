/**
 * COMPONENT: AdminThemeManager.tsx
 * * Doel: De hoofdinterface voor het beheren van thema-profielen in het admin-paneel.
 * Functies: Toont het overzicht van bestaande thema's en biedt de formulier-UI
 * voor het aanmaken of aanpassen van thema-metadata, labels en spel-instellingen.
 */
import { useParams } from 'react-router-dom';
import { GLOBAL_AVAILABLE_GAMES, GUESSWHO_AVAILABLE_COLUMNS } from '../../core/gamesConfig';
import { useAdminTheme } from './AdminTheme/useAdminTheme';
import { ThemeOverviewTable } from './AdminTheme/ThemeOverviewTable';
import { LayerMetadataCard } from './AdminTheme/LayerMetadataCard';
import type { Theme, MetaDataStandard } from '../../types';

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

    // Oplossing: loadedThemes niet meer meegeven, themeName wel doorsturen
    const {
        handleReturnToControlPanel, editingTheme, isNew, error, metaInputs, guesswhoDisabledColumns, setEditingTheme,
        handleStartCreate, handleStartEdit, handleDelete, handleSave,
        updateLabel, updateLayerString, updateLayerArrayInput, handleArrayToggle, handleGuessWhoColumnToggle
    } = useAdminTheme(onRefresh, themeName);

    const layerMetadataRecord = (editingTheme?.layerMetadata || {}) as Record<string, MetaDataStandard>;

    return (
        <div style={{ padding: '40px', background: '#121212', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>

            {/* Topbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0 }}>Portals & Theme Brand Identities</h2>
                <button
                    onClick={handleReturnToControlPanel} // Gebruikt nu de herstelde hook functie
                    style={{ padding: '10px 20px', background: '#2d2d2d', color: '#fff', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    Return to Control Panel
                </button>
            </div>

            {!editingTheme ? (
                <div>
                    <button onClick={handleStartCreate} style={{ padding: '12px 24px', background: '#deff9a', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>
                        Generate New Theme Record
                    </button>
                    <ThemeOverviewTable loadedThemes={loadedThemes} onEdit={handleStartEdit} onDelete={handleDelete} />
                </div>
            ) : (
                <form onSubmit={handleSave} style={{ background: '#1e1e1e', padding: '30px', borderRadius: '8px', border: '1px solid #333' }}>
                    <h3>{isNew ? 'Configure New Theme Instance' : `Modify System Theme Profile: ${editingTheme.id}`}</h3>
                    {error && <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>Exception Alert: {error}</p>}

                    {/* Meta Gegevens */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>Theme Unique ID:</label>
                            <input
                                type="text"
                                disabled={!isNew}
                                value={editingTheme.id || ''}
                                onChange={e => {
                                    const sanitized = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                    setEditingTheme({ ...editingTheme, id: sanitized });
                                }}
                                style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>Theme Title Reference:</label>
                            <input type="text" value={editingTheme.title || ''} onChange={e => setEditingTheme({ ...editingTheme, title: e.target.value })} style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }} required />
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>Description Meta Content:</label>
                        <textarea value={editingTheme.description || ''} onChange={e => setEditingTheme({ ...editingTheme, description: e.target.value })} style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px', height: '60px' }} />
                    </div>

                    {/* Topologies */}
                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>Structure & Navigation Topologies</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', background: '#161616', padding: '20px', borderRadius: '6px', marginBottom: '20px' }}>
                        <div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontWeight: 'bold' }}>Core Anchor Stratum:</label>
                                <select value={editingTheme.orgLayer || 'l3'} onChange={e => setEditingTheme({ ...editingTheme, orgLayer: e.target.value })} style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }}>
                                    <option value="l1">Layer 1 (Framework)</option>
                                    <option value="l2">Layer 2 (Identity)</option>
                                    <option value="l3">Layer 3 (Team Formation)</option>
                                    <option value="l4">Layer 4 (Asset Level)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontWeight: 'bold' }}>Miniature Views:</label>
                                {AVAILABLE_LAYERS.map(l => (
                                    <label key={l} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '15px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={((editingTheme.miniViewLayers || []) as string[]).includes(l)} onChange={() => handleArrayToggle('miniViewLayers', l)} style={{ marginRight: '6px' }} />
                                        {l.toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontWeight: 'bold' }}>Active Modules:</label>
                                {GLOBAL_AVAILABLE_GAMES.map(g => (
                                    <label key={g.id} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '15px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={((editingTheme.games || []) as string[]).includes(g.id)} onChange={() => handleArrayToggle('games', g.id)} style={{ marginRight: '6px' }} />
                                        {g.name}
                                    </label>
                                ))}
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontWeight: 'bold' }}>Navbar Interface Items:</label>
                                {AVAILABLE_LAYERS.map(l => (
                                    <label key={l} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '15px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={((editingTheme.navbarItems || []) as string[]).includes(l)} onChange={() => handleArrayToggle('navbarItems', l)} style={{ marginRight: '6px' }} />
                                        {l.toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Guess Who Config */}
                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>Game Specific Settings</h4>
                    <div style={{ background: '#161616', padding: '18px', borderRadius: '6px', border: '1px solid #333', marginBottom: '20px' }}>
                        <h5 style={{ margin: '0 0 15px 0', color: '#deff9a', fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px dashed #444', paddingBottom: '6px' }}>Guess Who Configuration</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h6 style={{ margin: '0 0 15px 0' }}>EXCLUDE FROM THE GUESS WHO GAME</h6>
                            {GUESSWHO_AVAILABLE_COLUMNS.map((col) => {
                                // Gebruik de object-structuur direct
                                const colId = col.id;
                                const colLabel = col.label;
                                const isMandatory = col.isMandatory === true;
                                const isChecked = guesswhoDisabledColumns.includes(colId);

                                return (
                                    <label
                                        key={colId}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            cursor: isMandatory ? 'not-allowed' : 'pointer',
                                            fontSize: '13px',
                                            opacity: isMandatory ? 0.6 : 1 // Visuele feedback dat het verplicht is
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            // Verplichte velden blokkeren we via disabled
                                            disabled={isMandatory}
                                            onChange={() => handleGuessWhoColumnToggle(colId)}
                                            style={{ marginRight: '8px', cursor: isMandatory ? 'not-allowed' : 'pointer' }}
                                        />
                                        <span style={{
                                            color: isMandatory ? '#888' : (isChecked ? '#ff6b6b' : '#fff')
                                        }}>
                                            {colLabel} {isMandatory && '(Required)'}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Nomenclature Labels */}
                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>Layer Schema Nomenclature Definitions</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        {AVAILABLE_LAYERS.map(l => (
                            <div key={l}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>{l.toUpperCase()} Alias:</label>
                                <input type="text" value={editingTheme.labels?.[l] || ''} onChange={e => updateLabel(l, e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }} />
                            </div>
                        ))}
                    </div>

                    {/* Custom Portals */}
                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>Custom Portal Display Labels</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        {CUSTOM_PORTAL_LABELS.map(c => (
                            <div key={c.key}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>{c.label}:</label>
                                <input type="text" placeholder={c.placeholder} value={editingTheme.labels?.[c.key] || ''} onChange={e => updateLabel(c.key, e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }} />
                            </div>
                        ))}
                    </div>

                    {/* Dynamic Layer Metadata Grid */}
                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>Layer Metadata Standard Configuration</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
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
                    <div style={{ display: 'flex', gap: '15px', marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                        <button type="submit" style={{ padding: '12px 24px', background: '#deff9a', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            {isNew ? 'Save New Theme' : 'Apply Settings Changes'}
                        </button>
                        <button type="button" onClick={() => setEditingTheme(null)} style={{ padding: '12px 24px', background: 'transparent', color: '#fff', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}